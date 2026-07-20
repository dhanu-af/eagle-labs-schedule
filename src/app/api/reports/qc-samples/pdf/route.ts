import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SAMPLE_STATUS_LABEL, SAMPLE_TYPE_LABEL } from "@/lib/qc-sample-defaults";
import { formatBrisbaneDateTime } from "@/lib/ui";

const MARGIN = 36;
const COLOR = { text: "#0f172a", muted: "#64748b", border: "#cbd5e1" };

const COLUMNS = [
  { header: "Sample ID", width: 85 },
  { header: "Product", width: 90 },
  { header: "Batch", width: 70 },
  { header: "Type", width: 75 },
  { header: "Status", width: 75 },
  { header: "Analyst", width: 75 },
  { header: "Bay / Room", width: 80 },
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const samples = await prisma.qcSample.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "desc" } });

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLOR.text).text("QC Samples", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(`Generated ${formatBrisbaneDateTime(new Date())}`, { align: "center" });
  doc.moveDown(1);

  const tableX = MARGIN;
  let y = doc.y;
  const rowHeight = 20;

  function drawHeader() {
    let x = tableX;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.text);
    for (const col of COLUMNS) {
      doc.text(col.header, x + 4, y + 5, { width: col.width - 8 });
      x += col.width;
    }
    y += rowHeight;
    doc.moveTo(tableX, y).lineTo(x, y).strokeColor(COLOR.border).lineWidth(0.5).stroke();
  }

  drawHeader();

  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.text);
  for (const s of samples) {
    if (y + rowHeight > doc.page.height - MARGIN) {
      doc.addPage({ size: "A4", margin: MARGIN, layout: "landscape" });
      y = MARGIN;
      drawHeader();
      doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.text);
    }
    let x = tableX;
    const values = [
      s.sampleId,
      s.productName,
      s.batchNumber,
      SAMPLE_TYPE_LABEL[s.sampleType],
      SAMPLE_STATUS_LABEL[s.status],
      s.collectedByName ?? "—",
      s.productionRoom ?? "—",
    ];
    for (let i = 0; i < COLUMNS.length; i++) {
      doc.text(values[i], x + 4, y + 5, { width: COLUMNS[i].width - 8 });
      x += COLUMNS[i].width;
    }
    y += rowHeight;
    doc.moveTo(tableX, y).lineTo(x, y).strokeColor(COLOR.border).lineWidth(0.25).stroke();
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="qc-samples-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
