import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function drawTable(
  doc: PDFKit.PDFDocument,
  startX: number,
  startY: number,
  columns: { header: string; width: number }[],
  rows: string[][],
  options: { rowHeight?: number; fontSize?: number } = {}
) {
  const rowHeight = options.rowHeight ?? 18;
  const fontSize = options.fontSize ?? 7;
  let y = startY;

  doc.font("Helvetica-Bold").fontSize(fontSize);
  let x = startX;
  for (const col of columns) {
    doc.text(col.header, x + 2, y + 4, { width: col.width - 4, height: rowHeight });
    x += col.width;
  }
  y += rowHeight;
  doc
    .moveTo(startX, y)
    .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y)
    .strokeColor("#334155")
    .stroke();

  doc.font("Helvetica").fontSize(fontSize);
  for (const row of rows) {
    if (y > doc.page.height - 60) {
      doc.addPage({ layout: "landscape", size: "A4", margin: 30 });
      y = 30;
    }
    x = startX;
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? "", x + 2, y + 4, { width: columns[i].width - 4, height: rowHeight });
      x += columns[i].width;
    }
    y += rowHeight;
  }

  return y;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const formulation = await prisma.formulation.findUnique({
    where: { id },
    include: { folder: true, ingredients: { orderBy: { order: "asc" } } },
  });
  if (!formulation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const search = request.nextUrl.searchParams;
  const batchSize = Number(search.get("batchSize") ?? formulation.baseBatchSize);
  const enteredBy = search.get("enteredBy") ?? "";
  const checkedBy = search.get("checkedBy") ?? "";
  const calcDate = search.get("calcDate") ?? "";

  const UNIT_TO_MG: Record<string, number> = { mg: 1, g: 1000, kg: 1_000_000 };
  const baseUnitKey = formulation.baseUnit.trim().toLowerCase();
  const canConvertUnits = baseUnitKey in UNIT_TO_MG;
  const requestedUnit = (search.get("unit") ?? formulation.baseUnit).trim().toLowerCase();
  const calcUnit = canConvertUnits && requestedUnit in UNIT_TO_MG ? requestedUnit : formulation.baseUnit;
  const unitFactor = canConvertUnits && calcUnit in UNIT_TO_MG ? UNIT_TO_MG[calcUnit] / UNIT_TO_MG[baseUnitKey] : 1;

  const totalQty = formulation.ingredients.reduce((s, i) => s + i.baseQty, 0);

  const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 30 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(14).text("MASTER FORMULATION — CONTROLLED PERCENTAGE BASIS", { align: "center" });
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(9)
    .text(`Product Name: ${formulation.productName}    Folder: ${formulation.folder.name}    Base Batch Size: ${formulation.baseBatchSize} ${formulation.baseUnit}`);
  doc.moveDown(0.5);

  let y = drawTable(
    doc,
    30,
    doc.y,
    [
      { header: "No.", width: 25 },
      { header: "RM Number", width: 60 },
      { header: "Ingredient / AAN", width: 130 },
      { header: "UIN", width: 45 },
      { header: `Base Qty (${formulation.baseUnit})`, width: 65 },
      { header: "% w/w", width: 55 },
      { header: "Control Status", width: 60 },
      { header: "Change Control Ref", width: 70 },
      { header: "Approved By", width: 60 },
      { header: "Comments", width: 120 },
    ],
    formulation.ingredients.map((ing, i) => [
      String(i + 1),
      ing.rmNumber ?? "—",
      ing.ingredientName,
      ing.uin ?? "—",
      ing.baseQty.toFixed(3),
      totalQty > 0 ? `${((ing.baseQty / totalQty) * 100).toFixed(4)}%` : "0%",
      ing.controlStatus ?? "—",
      ing.changeControlRef ?? "—",
      ing.approvedBy ?? "—",
      ing.comments ?? "—",
    ])
  );

  doc.font("Helvetica-Bold").fontSize(8).text(`TOTAL: ${totalQty.toFixed(3)} ${formulation.baseUnit}   100.0000%`, 30, y + 6);

  doc.addPage({ layout: "landscape", size: "A4", margin: 30 });
  doc.font("Helvetica-Bold").fontSize(14).text("BATCH CALCULATOR", { align: "center" });
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Required Batch Size: ${batchSize} ${calcUnit}    Entered By: ${enteredBy || "—"}    Checked By: ${checkedBy || "—"}    Date: ${calcDate || "—"}`
    );
  doc.moveDown(0.5);

  const requiredBatchSizeInBaseUnit = batchSize * unitFactor;
  let batchTotal = 0;
  const batchRows = formulation.ingredients.map((ing, i) => {
    const pctWw = totalQty > 0 ? ing.baseQty / totalQty : 0;
    const calculatedQtyRawInBaseUnit = pctWw * requiredBatchSizeInBaseUnit;
    const calculatedQtyRaw = unitFactor > 0 ? calculatedQtyRawInBaseUnit / unitFactor : calculatedQtyRawInBaseUnit;
    const calculatedQty = Math.round(calculatedQtyRaw * 1000) / 1000;
    const roundedQty = Math.round(calculatedQty * 100) / 100;
    const minQty = calculatedQty * (1 - ing.tolerancePct / 100);
    const maxQty = calculatedQty * (1 + ing.tolerancePct / 100);
    batchTotal += roundedQty;
    return [
      String(i + 1),
      ing.ingredientName,
      `${(pctWw * 100).toFixed(4)}%`,
      calculatedQty.toFixed(3),
      roundedQty.toFixed(2),
      `${ing.tolerancePct.toFixed(2)}%`,
      minQty.toFixed(3),
      maxQty.toFixed(3),
    ];
  });

  const y2 = drawTable(
    doc,
    30,
    doc.y,
    [
      { header: "No.", width: 30 },
      { header: "Ingredient", width: 140 },
      { header: "Controlled % w/w", width: 90 },
      { header: `Calculated Qty (${calcUnit})`, width: 90 },
      { header: `Rounded Qty (${calcUnit})`, width: 85 },
      { header: "Tolerance %", width: 70 },
      { header: "Min Qty", width: 75 },
      { header: "Max Qty", width: 75 },
    ],
    batchRows
  );

  doc.font("Helvetica-Bold").fontSize(8).text(`TOTAL: ${batchTotal.toFixed(2)} ${calcUnit}`, 30, y2 + 6);

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${formulation.productName.replace(/[^a-z0-9]/gi, "_")}_formulation.pdf"`,
    },
  });
}
