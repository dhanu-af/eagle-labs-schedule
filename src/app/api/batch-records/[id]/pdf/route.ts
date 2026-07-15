import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const MARGIN = 30;

function drawTable(
  doc: PDFKit.PDFDocument,
  startX: number,
  startY: number,
  columns: { header: string; width: number }[],
  rows: string[][],
  options: { rowHeight?: number; fontSize?: number } = {}
) {
  const rowHeight = options.rowHeight ?? 16;
  const fontSize = options.fontSize ?? 7;
  let y = startY;

  doc.font("Helvetica-Bold").fontSize(fontSize);
  let x = startX;
  for (const col of columns) {
    doc.text(col.header, x + 2, y + 3, { width: col.width - 4 });
    x += col.width;
  }
  y += rowHeight;
  doc.moveTo(startX, y).lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y).strokeColor("#334155").stroke();

  doc.font("Helvetica").fontSize(fontSize);
  for (const row of rows) {
    if (y > doc.page.height - 60) {
      doc.addPage({ size: "A4", margin: MARGIN });
      y = MARGIN;
    }
    x = startX;
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? "", x + 2, y + 3, { width: columns[i].width - 4 });
      x += columns[i].width;
    }
    y += rowHeight;
  }
  return y;
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > doc.page.height - 100) doc.addPage({ size: "A4", margin: MARGIN });
  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(title);
  doc.moveDown(0.3);
  doc.fillColor("#000000");
}

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const batch = await prisma.batchRecord.findUnique({
    where: { id },
    include: {
      workLogEntries: { orderBy: { rowNumber: "asc" } },
      operators: { orderBy: { rowNumber: "asc" } },
      equipment: { orderBy: { rowNumber: "asc" } },
      lineClearance: true,
      mixes: { orderBy: { mixNumber: "asc" }, include: { dispensingLines: { orderBy: { order: "asc" } }, drums: true } },
      warehouseReturns: { orderBy: { order: "asc" } },
      materialRequests: { orderBy: { order: "asc" } },
    },
  });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(16).text("BATCH MANUFACTURING RECORD", { align: "center" });
  doc.font("Helvetica-Bold").fontSize(13).text("BLENDING", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(9).text(`Product Name: ${batch.productName}    Batch Number: ${batch.batchNumber}`);
  doc.text(`Written by: ${batch.writtenByName ?? "—"} (${fmtDate(batch.writtenSignedDate)})    Checked & Authorised by: ${batch.checkedByName ?? "—"} (${fmtDate(batch.checkedSignedDate)})    Review date: ${fmtDate(batch.reviewDate)}`);

  sectionHeader(doc, "Work Log");
  let y = drawTable(
    doc, MARGIN, doc.y,
    [
      { header: "#", width: 20 }, { header: "Date", width: 55 }, { header: "Operator", width: 90 },
      { header: "Process #", width: 45 }, { header: "Start", width: 45 }, { header: "Finish", width: 45 },
      { header: "Break (min)", width: 50 }, { header: "Hours", width: 45 }, { header: "Sign", width: 140 },
    ],
    batch.workLogEntries.map((w, i) => [
      String(i + 1), fmtDate(w.date), w.operatorName ?? "—", w.processNumber?.toString() ?? "—",
      w.startTime ?? "—", w.finishTime ?? "—", w.breakMinutes?.toString() ?? "—", w.totalHours?.toString() ?? "—", w.sign ?? "—",
    ])
  );
  doc.y = y + 4;
  doc.font("Helvetica").fontSize(7).text("* Production Process: 1 Dispensing  2 Blending  3 Polishing  4 Coating  5 Rework  6 Cleaning  7 Breakdown  8 Other");
  if (batch.notes) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(8).text("Notes / Comments / Deviations:");
    doc.font("Helvetica").fontSize(8).text(batch.notes);
  }

  sectionHeader(doc, "Operators' Declaration");
  const decl = [
    batch.declEncapsulation && "Encapsulation", batch.declBlendingMixing && "Blending/Mixing",
    batch.declDispensing && "Dispensing", batch.declPolishing && "Polishing", batch.declCoating && "Coating",
  ].filter(Boolean);
  doc.font("Helvetica").fontSize(8).text(`Confirmed process steps: ${decl.length ? decl.join(", ") : "—"}`);
  doc.moveDown(0.2);
  y = drawTable(
    doc, MARGIN, doc.y,
    [{ header: "#", width: 20 }, { header: "Name", width: 170 }, { header: "Signature", width: 170 }, { header: "Date", width: 175 }],
    batch.operators.map((o, i) => [String(i + 1), o.name ?? "—", o.signature ?? "—", fmtDate(o.date)])
  );
  doc.y = y + 4;

  sectionHeader(doc, "Equipment Record");
  y = drawTable(
    doc, MARGIN, doc.y,
    [{ header: "EQ No.", width: 60 }, { header: "Item Name", width: 220 }, { header: "Calibration Updated", width: 110 }, { header: "Notes", width: 145 }],
    batch.equipment.map((e) => [e.eqNumber ?? "—", e.itemName ?? "—", e.calibrationUpdated ?? "—", e.notes ?? "—"])
  );
  doc.y = y + 4;

  sectionHeader(doc, "Line Clearance Checklist");
  const lc = batch.lineClearance;
  doc.font("Helvetica").fontSize(8);
  if (lc) {
    doc.text(`Room No.: ${lc.roomNumber ?? "—"}    Room clean: ${lc.roomCleanType ?? "—"}    Equipment clean: ${lc.equipmentCleanType ?? "—"}`);
    doc.text(`Performed by: ${lc.performedBySign ?? "—"} (${fmtDate(lc.performedByDate)} ${lc.performedByTime ?? ""})    Verified by (Supervisor): ${lc.verifiedBySign ?? "—"} (${fmtDate(lc.verifiedByDate)} ${lc.verifiedByTime ?? ""})`);
    doc.text(`Probiotic product/materials: ${lc.probioticProduct ? "Yes" : "No"}    Room RH: ${lc.roomRhPercent ?? "—"}% @ ${lc.roomRhTime ?? "—"}    Room Temp: ${lc.roomTemperature ?? "—"}°C @ ${lc.roomTempTime ?? "—"}`);
    doc.text(`Room Use Approval: ${lc.roomUseApprovalSign ?? "—"} (${fmtDate(lc.roomUseApprovalDate)})`);
    doc.text(`Materials identified for correct Product Code/Batch No.: ${lc.materialsIdentifiedChecked ? "Yes" : "No"}    PASS labelled by Warehouse: ${lc.materialsPassLabelledChecked ? "Yes" : "No"}`);
  } else {
    doc.text("Not yet completed.");
  }

  sectionHeader(doc, "Dispensing & Blending Instructions");
  doc.font("Helvetica").fontSize(8).text(
    "Verify blender clean/dry/sanitised and released for use. Weigh and dispense all raw materials per the BOM below. Load all powders except magnesium stearate, blend 20 minutes, add magnesium stearate, blend a further 5 minutes only (25 minutes total). Inspect blend uniformity, obtain Supervisor approval, then dispense into labelled containers and transfer to sanitised drums. Collect one representative sample (~50 g) per blend for QA."
  );

  for (const mix of batch.mixes) {
    doc.addPage({ size: "A4", margin: MARGIN });
    doc.font("Helvetica-Bold").fontSize(12).text(`Mix No. ${mix.mixNumber} of ${batch.numberOfMixes}`);
    doc.moveDown(0.3);

    const totalReq = mix.dispensingLines.reduce((s, l) => s + l.requiredQtyKg, 0);
    y = drawTable(
      doc, MARGIN, doc.y,
      [
        { header: "No.", width: 20 }, { header: "RM", width: 30 }, { header: "Ingredient / AAN", width: 145 },
        { header: "UIN", width: 40 }, { header: "Required kg", width: 55 }, { header: "Actual kg", width: 55 },
        { header: "Performed by", width: 95 }, { header: "Verified by", width: 95 },
      ],
      mix.dispensingLines.map((l, i) => [
        String(i + 1), l.rmNumber ?? "RM", l.ingredientName, l.uin ?? "—",
        l.requiredQtyKg.toFixed(3), l.actualQtyDispensedKg?.toFixed(3) ?? "—",
        l.performedBySign ?? "—", l.verifiedBySign ?? "—",
      ])
    );
    doc.font("Helvetica-Bold").fontSize(8).text(`TOTAL WEIGHT, Kg: ${totalReq.toFixed(3)}`, MARGIN, y + 4);
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(8);
    doc.text(`Dispensing: ${fmtDate(mix.dispensingStartDate)} ${mix.dispensingStartTime ?? ""} (${mix.dispensingStartSign ?? "—"}) → ${fmtDate(mix.dispensingEndDate)} ${mix.dispensingEndTime ?? ""} (${mix.dispensingEndSign ?? "—"})`);
    doc.text(`Blending: ${fmtDate(mix.blendingStartDate)} ${mix.blendingStartTime ?? ""} (${mix.blendingStartSign ?? "—"}) → ${fmtDate(mix.blendingEndDate)} ${mix.blendingEndTime ?? ""} (${mix.blendingEndSign ?? "—"})`);
    doc.text(`Mixing/Blending completed: ${mix.mixCompletedSign ?? "—"} (${fmtDate(mix.mixCompletedDate)} ${mix.mixCompletedTime ?? ""})    Verified by: ${mix.verifiedBySign ?? "—"} (${fmtDate(mix.verifiedByDate)} ${mix.verifiedByTime ?? ""})`);
    doc.moveDown(0.4);

    doc.font("Helvetica-Bold").fontSize(9).text("Blend Identification");
    const totalDrumWeight = mix.drums.reduce((s, d) => s + (d.netWeightKg ?? 0), 0);
    y = drawTable(
      doc, MARGIN, doc.y,
      [{ header: "Drum No.", width: 100 }, { header: "Net Weight, Kg", width: 100 }, { header: "Pass Label Attached", width: 335 }],
      mix.drums.map((d) => [d.drumNumber ?? "—", d.netWeightKg?.toFixed(2) ?? "—", d.passLabelAttached ? "Yes" : "No"])
    );
    doc.font("Helvetica-Bold").fontSize(8).text(`Total (B): ${totalDrumWeight.toFixed(2)} Kg`, MARGIN, y + 4);
    doc.moveDown(0.5);

    const A = mix.dispensingLines.reduce((s, l) => s + (l.actualQtyDispensedKg ?? l.requiredQtyKg), 0);
    const yieldPct = A > 0 && totalDrumWeight > 0 ? (totalDrumWeight / A) * 100 : null;
    const bulkDensity = mix.bulkSampleWeightG && mix.bulkVolumeMl ? mix.bulkSampleWeightG / mix.bulkVolumeMl : null;
    const tappedDensity = mix.bulkSampleWeightG && mix.tappedVolumeMl ? mix.bulkSampleWeightG / mix.tappedVolumeMl : null;
    doc.font("Helvetica-Bold").fontSize(9).text("Mix Reconciliation");
    doc.font("Helvetica").fontSize(8);
    doc.text(`Total ACTUAL Weight dispensed (A): ${A.toFixed(2)} Kg    Total Net Weight in Drums (B): ${totalDrumWeight.toFixed(2)} Kg    Samples/Rejects/Spills (D): ${mix.samplesRejectsSpillsKg?.toFixed(2) ?? "—"} Kg`);
    doc.text(`Mix Yield [(B)÷(A)]×100: ${yieldPct !== null ? yieldPct.toFixed(2) + "%" : "—"}  (limit 99-101%)`);
    doc.text(`Sample weight (M): ${mix.bulkSampleWeightG ?? "—"} g    Bulk Volume (V1): ${mix.bulkVolumeMl ?? "—"} ml    Tapped Volume (V2): ${mix.tappedVolumeMl ?? "—"} ml`);
    doc.text(`Bulk Density: ${bulkDensity !== null ? bulkDensity.toFixed(3) + " g/ml" : "—"}    Tapped Density: ${tappedDensity !== null ? tappedDensity.toFixed(3) + " g/ml" : "—"}`);
  }

  doc.addPage({ size: "A4", margin: MARGIN });
  doc.font("Helvetica-Bold").fontSize(12).text("Warehouse Return");
  doc.moveDown(0.3);
  const totalKgPerBatch = batch.warehouseReturns.reduce((s, w) => s + (w.kgPerBatch ?? 0), 0);
  y = drawTable(
    doc, MARGIN, doc.y,
    [
      { header: "RM / AAN", width: 175 }, { header: "kg/batch", width: 65 }, { header: "Qty Used", width: 65 },
      { header: "Actual Qty Returned", width: 90 }, { header: "Operator Sign", width: 70 }, { header: "Date", width: 70 },
    ],
    batch.warehouseReturns.map((w) => [
      w.ingredientName, w.kgPerBatch?.toFixed(3) ?? "—", w.qtyUsedKg?.toFixed(2) ?? "—",
      w.actualQtyReturnedKg?.toFixed(2) ?? "—", w.operatorSign ?? "—", fmtDate(w.operatorDate),
    ])
  );
  doc.font("Helvetica-Bold").fontSize(8).text(`TOTAL WEIGHT: ${totalKgPerBatch.toFixed(2)}`, MARGIN, y + 4);

  doc.addPage({ size: "A4", margin: MARGIN });
  doc.font("Helvetica-Bold").fontSize(13).text("RAW MATERIALS REQUEST DOCUMENT", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(9);
  const totalBatchSize = batch.numberOfMixes * batch.batchSizePerMix;
  doc.text(`Product Name: ${batch.productName}    Batch No.: ${batch.batchNumber}`);
  doc.text(`No. of Mixes: ${batch.numberOfMixes}    Batch Size per Mix: ${batch.batchSizePerMix.toFixed(2)} ${batch.batchSizeUnit}    Total Batch Size: ${totalBatchSize.toFixed(2)} ${batch.batchSizeUnit}`);
  doc.moveDown(0.3);
  const totalReleased = batch.materialRequests.reduce((s, m) => s + (m.kgPerBatch ?? 0), 0);
  y = drawTable(
    doc, MARGIN, doc.y,
    [
      { header: "RM / AAN", width: 175 }, { header: "kg/batch", width: 65 }, { header: "Qty Released", width: 65 },
      { header: "Actual Qty Received", width: 90 }, { header: "Operator Sign", width: 70 }, { header: "Date", width: 70 },
    ],
    batch.materialRequests.map((m) => [
      m.ingredientName, m.kgPerBatch?.toFixed(3) ?? "—", m.qtyReleasedKg?.toFixed(2) ?? "—",
      m.actualQtyReceivedKg?.toFixed(2) ?? "—", m.operatorSign ?? "—", fmtDate(m.operatorDate),
    ])
  );
  doc.font("Helvetica-Bold").fontSize(8).text(`TOTAL WEIGHT: ${totalReleased.toFixed(2)}`, MARGIN, y + 4);
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(9);
  doc.text(`Released By (Warehouse): ${batch.releasedByWarehouse ?? "—"}      Date: ${fmtDate(batch.releasedDate)}`);
  doc.text(`Checked By: ${batch.requestCheckedBy ?? "—"}`);
  doc.text(`AILS No.: ${batch.ailsNumber ?? "—"}      Pallet No.: ${batch.palletNumber ?? "—"}`);

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${batch.productName.replace(/[^a-z0-9]/gi, "_")}_${batch.batchNumber}_BMR.pdf"`,
    },
  });
}
