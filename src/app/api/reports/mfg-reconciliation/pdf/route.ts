import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatBrisbaneDateTime } from "@/lib/ui";
import {
  MFG_BATCH_STATUS_LABEL,
  MFG_MATERIAL_GROUP_LABEL,
  PACKAGING_MATERIAL_TYPE_LABEL,
  computeBalance,
  computeYieldPct,
  capsulesFromKg,
  formatCount,
  computeFinalReconciliationChecks,
} from "@/lib/mfg-reconciliation-defaults";

const MARGIN = 36;
const COLOR = { text: "#0f172a", muted: "#64748b", border: "#cbd5e1", success: "#1d8a4b", danger: "#b91c1c" };

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN) {
    doc.addPage({ size: "A4", margin: MARGIN });
  }
}

function heading(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 30);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLOR.text).text(text);
  doc.moveDown(0.2);
}

function detailRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 16);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.muted).text(`${label}: `, MARGIN, doc.y, { continued: true, width: 500 });
  doc.font("Helvetica").fillColor(COLOR.text).text(value || "—");
}

function drawTable(doc: PDFKit.PDFDocument, columns: { header: string; width: number }[], rows: string[][]) {
  const tableX = MARGIN;
  let y = doc.y;
  const rowHeight = 18;

  function drawHeader() {
    let x = tableX;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.text);
    for (const col of columns) {
      doc.text(col.header, x + 3, y + 4, { width: col.width - 6 });
      x += col.width;
    }
    y += rowHeight;
    doc.moveTo(tableX, y).lineTo(x, y).strokeColor(COLOR.border).lineWidth(0.5).stroke();
  }

  drawHeader();
  doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.text);
  for (const row of rows) {
    if (y + rowHeight > doc.page.height - MARGIN) {
      doc.addPage({ size: "A4", margin: MARGIN });
      y = MARGIN;
      drawHeader();
      doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.text);
    }
    let x = tableX;
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? "—", x + 3, y + 4, { width: columns[i].width - 6 });
      x += columns[i].width;
    }
    y += rowHeight;
    doc.moveTo(tableX, y).lineTo(x, y).strokeColor(COLOR.border).lineWidth(0.25).stroke();
  }
  doc.y = y + 8;
}

function reconciliationRow(doc: PDFKit.PDFDocument, label: string, pct: number | null, limitLabel: string, pass: boolean | null) {
  ensureSpace(doc, 16);
  const pctText = pct !== null ? `${pct.toFixed(1)}%` : "—";
  const resultText = pass === null ? "" : pass ? "PASS" : "FAIL";
  const resultColor = pass === null ? COLOR.muted : pass ? COLOR.success : COLOR.danger;
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(label, MARGIN, doc.y, { continued: true, width: 260 });
  doc.font("Helvetica").fillColor(COLOR.muted).text(`  ${limitLabel}`, { continued: true, width: 140 });
  doc.font("Helvetica-Bold").fillColor(COLOR.text).text(`  ${pctText}`, { continued: !!resultText, width: 70 });
  if (resultText) doc.font("Helvetica-Bold").fillColor(resultColor).text(`  ${resultText}`);
  doc.fillColor(COLOR.text);
}

async function renderDetail(id: string) {
  const batch = await prisma.mfgBatch.findUnique({
    where: { id },
    include: {
      batchRecord: { select: { productName: true, batchNumber: true } },
      warehouseIssue: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
      blending: true,
      encapsulation: true,
      bottling: true,
      xrayInspection: true,
      packaging: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
      finishedGoodsWarehouse: true,
      dispatchEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(18).fillColor(COLOR.text).text(batch.batchNumber, { continued: true });
  doc.font("Helvetica").fontSize(11).fillColor(COLOR.muted).text(`   ${MFG_BATCH_STATUS_LABEL[batch.status]}`);
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(`Generated ${formatBrisbaneDateTime(new Date())}`);
  doc.moveDown(0.6);
  detailRow(doc, "Product", batch.productName);
  if (batch.batchRecord) detailRow(doc, "Linked Batch Record", `${batch.batchRecord.batchNumber} — ${batch.batchRecord.productName}`);
  if (batch.remarks) detailRow(doc, "Remarks", batch.remarks);

  // 1. Warehouse Issue
  heading(doc, "1. Warehouse Issue");
  if (batch.warehouseIssue) {
    detailRow(doc, "Issued By", batch.warehouseIssue.issuedByName ?? "—");
    detailRow(doc, "Issue Date", batch.warehouseIssue.issueDate ? batch.warehouseIssue.issueDate.toLocaleDateString("en-AU") : "—");
    if (batch.warehouseIssue.remarks) detailRow(doc, "Remarks", batch.warehouseIssue.remarks);
    if (batch.warehouseIssue.lines.length > 0) {
      ensureSpace(doc, 30);
      doc.moveDown(0.3);
      drawTable(
        doc,
        [
          { header: "Group", width: 70 },
          { header: "Code", width: 45 },
          { header: "Description", width: 100 },
          { header: "Supplier", width: 65 },
          { header: "Lot/Batch", width: 55 },
          { header: "Expiry", width: 45 },
          { header: "Req.", width: 40 },
          { header: "Issued", width: 40 },
          { header: "Returned", width: 45 },
          { header: "Balance", width: 40 },
        ],
        batch.warehouseIssue.lines.map((l) => [
          MFG_MATERIAL_GROUP_LABEL[l.materialGroup],
          l.materialCode ?? "—",
          l.description,
          l.supplier ?? "—",
          l.lotBatchNumber ?? "—",
          l.expiryDate ? l.expiryDate.toLocaleDateString("en-AU") : "—",
          l.quantityRequested?.toString() ?? "—",
          l.quantityIssued?.toString() ?? "—",
          l.quantityReturned?.toString() ?? "—",
          computeBalance(l.quantityIssued, l.quantityReturned)?.toString() ?? "—",
        ])
      );
    }
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 2. Blending
  heading(doc, "2. Blending");
  if (batch.blending) {
    const b = batch.blending;
    detailRow(doc, "Total Theoretical Weight (kg)", b.totalTheoreticalWeightKg?.toString() ?? "—");
    detailRow(doc, "Actual Weight (kg)", b.actualWeightKg?.toString() ?? "—");
    detailRow(doc, "Blend Batch Number", b.blendBatchNumber ?? "—");
    detailRow(doc, "Powder Remaining (kg)", b.powderRemainingKg?.toString() ?? "—");
    detailRow(doc, "Blender Residue (kg)", b.blenderResidueKg?.toString() ?? "—");
    detailRow(doc, "Sieve Loss (kg)", b.sieveLossKg?.toString() ?? "—");
    detailRow(doc, "Dust Loss (kg)", b.dustLossKg?.toString() ?? "—");
    detailRow(doc, "Spillages (kg)", b.spillagesKg?.toString() ?? "—");
    detailRow(doc, "QC Samples", b.qcSamplesQty?.toString() ?? "—");
    detailRow(doc, "Retention Samples", b.retentionSamplesQty?.toString() ?? "—");
    detailRow(doc, "Destroyed Material (kg)", b.destroyedMaterialKg?.toString() ?? "—");
    detailRow(doc, "Returned to Warehouse (kg)", b.returnedToWarehouseKg?.toString() ?? "—");
    detailRow(doc, "Total Blend Produced (kg)", b.totalBlendProducedKg?.toString() ?? "—");
    const blendYield = computeYieldPct(b.totalBlendProducedKg, b.totalTheoreticalWeightKg);
    detailRow(doc, "Blend Yield %", blendYield !== null ? `${blendYield.toFixed(1)}%` : "—");
    detailRow(doc, "Blended By", b.blendedByName ?? "—");
    detailRow(doc, "Blended At", b.blendedAt ? b.blendedAt.toLocaleDateString("en-AU") : "—");
    if (b.remarks) detailRow(doc, "Remarks", b.remarks);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 3. Encapsulation
  heading(doc, "3. Encapsulation");
  if (batch.encapsulation) {
    const e = batch.encapsulation;
    detailRow(doc, "Target Capsule Fill Weight (mg)", e.targetCapsuleFillWeightMg?.toString() ?? "—");
    detailRow(doc, "Average Capsule Full Weight (mg)", e.avgCapsuleFullWeightMg?.toString() ?? "—");
    detailRow(doc, "Issued Bulk Blend (kg)", e.issuedBulkBlendKg?.toString() ?? "—");
    detailRow(doc, "Capsules Produced (kg)", e.capsulesProducedKg?.toString() ?? "—");
    detailRow(doc, "Capsule Samples (kg)", e.capsuleSamplesKg?.toString() ?? "—");
    detailRow(doc, "Reject Capsules (kg)", e.rejectCapsulesKg?.toString() ?? "—");
    detailRow(doc, "Reject Powder (kg)", e.rejectPowderKg?.toString() ?? "—");
    detailRow(doc, "Average Capsule Fill Weight (mg)", e.avgCapsuleFillWeightMg?.toString() ?? "—");
    detailRow(doc, "Average Capsule Length (mm)", e.avgCapsuleLengthMm?.toString() ?? "—");
    detailRow(
      doc,
      "Average Disintegration",
      e.avgDisintegrationMinutes !== null || e.avgDisintegrationSeconds !== null ? `${e.avgDisintegrationMinutes ?? 0}m ${e.avgDisintegrationSeconds ?? 0}s` : "—"
    );
    detailRow(doc, "Disintegration Result", e.disintegrationResult ?? "—");

    const theoreticalCapsules = capsulesFromKg(e.issuedBulkBlendKg, e.targetCapsuleFillWeightMg);
    const capsulesProduced = capsulesFromKg(e.capsulesProducedKg, e.avgCapsuleFullWeightMg);
    detailRow(doc, "Theoretical No. of Capsules", formatCount(theoreticalCapsules));
    detailRow(doc, "No. of Capsules Produced", formatCount(capsulesProduced));
    detailRow(doc, "Completed By", e.completedByName ?? "—");
    detailRow(doc, "Completed Date", e.completedAt ? e.completedAt.toLocaleDateString("en-AU") : "—");
    detailRow(doc, "Checked By", e.checkedByName ?? "—");
    detailRow(doc, "Checked Date", e.checkedAt ? e.checkedAt.toLocaleDateString("en-AU") : "—");
    if (e.comments) detailRow(doc, "Comments", e.comments);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 4. Bottling
  heading(doc, "4. Bottling");
  if (batch.bottling) {
    const bt = batch.bottling;
    detailRow(doc, "Total Capsule Bulk Weight (kg)", bt.totalCapsuleBulkWeightKg?.toString() ?? "—");
    detailRow(doc, "Average Capsule Full Weight (mg)", bt.avgCapsuleFullWeightMg?.toString() ?? "—");
    detailRow(doc, "Planned Quantity (Bottles)", bt.plannedQuantityBottles?.toString() ?? "—");
    detailRow(doc, "Target Capsules per Bottle", bt.targetCapsulesPerBottle?.toString() ?? "—");
    detailRow(doc, "Capsule Received (kg)", bt.capsuleReceivedKg?.toString() ?? "—");
    detailRow(doc, "Bottles Produced", bt.bottlesProduced?.toString() ?? "—");
    detailRow(doc, "Bottle Used", bt.bottleUsed?.toString() ?? "—");
    detailRow(doc, "Desiccants Used", bt.desiccantsUsed?.toString() ?? "—");
    detailRow(doc, "Caps Used", bt.capsUsed?.toString() ?? "—");
    detailRow(doc, "Completed By", bt.completedByName ?? "—");
    detailRow(doc, "Completed Date", bt.completedAt ? bt.completedAt.toLocaleDateString("en-AU") : "—");
    detailRow(doc, "Checked By", bt.checkedByName ?? "—");
    detailRow(doc, "Checked Date", bt.checkedAt ? bt.checkedAt.toLocaleDateString("en-AU") : "—");
    if (bt.comments) detailRow(doc, "Comments", bt.comments);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 5. X-Ray / Metal Detection
  heading(doc, "5. X-Ray / Metal Detection");
  if (batch.xrayInspection) {
    const x = batch.xrayInspection;
    detailRow(doc, "Bottles Received", x.bottlesReceived?.toString() ?? "—");
    detailRow(doc, "Bottles Scanned", x.bottlesScanned?.toString() ?? "—");
    detailRow(doc, "Passed", x.passed?.toString() ?? "—");
    detailRow(doc, "Failed", x.failed?.toString() ?? "—");
    detailRow(doc, "Reworked", x.reworked?.toString() ?? "—");
    detailRow(doc, "Destroyed", x.destroyed?.toString() ?? "—");
    detailRow(doc, "Released", x.released?.toString() ?? "—");
    detailRow(doc, "Reject — Metal Detection", x.rejectMetalDetection?.toString() ?? "—");
    detailRow(doc, "Reject — X-Ray Failure", x.rejectXrayFailure?.toString() ?? "—");
    detailRow(doc, "Reject — Underweight", x.rejectUnderweight?.toString() ?? "—");
    detailRow(doc, "Reject — Overweight", x.rejectOverweight?.toString() ?? "—");
    detailRow(doc, "Reject — Damaged Bottle", x.rejectDamagedBottle?.toString() ?? "—");
    detailRow(doc, "Reject — Missing Cap", x.rejectMissingCap?.toString() ?? "—");
    detailRow(doc, "Reject — Missing Desiccant", x.rejectMissingDesiccant?.toString() ?? "—");
    detailRow(doc, "Inspected By", x.inspectedByName ?? "—");
    detailRow(doc, "Inspected At", x.inspectedAt ? x.inspectedAt.toLocaleDateString("en-AU") : "—");
    if (x.remarks) detailRow(doc, "Remarks", x.remarks);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 6. Packaging
  heading(doc, "6. Packaging");
  if (batch.packaging) {
    const p = batch.packaging;
    detailRow(doc, "Packed Bottles", p.packedBottles?.toString() ?? "—");
    detailRow(doc, "Cartons Produced", p.cartonsProduced?.toString() ?? "—");
    detailRow(doc, "Cases Produced", p.casesProduced?.toString() ?? "—");
    detailRow(doc, "Packed By", p.packedByName ?? "—");
    detailRow(doc, "Packed At", p.packedAt ? p.packedAt.toLocaleDateString("en-AU") : "—");
    if (p.remarks) detailRow(doc, "Remarks", p.remarks);
    if (p.lines.length > 0) {
      ensureSpace(doc, 30);
      doc.moveDown(0.3);
      drawTable(
        doc,
        [
          { header: "Material", width: 90 },
          { header: "Issued", width: 65 },
          { header: "Used", width: 65 },
          { header: "Damaged", width: 65 },
          { header: "Returned", width: 65 },
          { header: "Destroyed", width: 65 },
          { header: "Balance", width: 65 },
        ],
        p.lines.map((l) => [
          PACKAGING_MATERIAL_TYPE_LABEL[l.materialType],
          l.issued?.toString() ?? "—",
          l.used?.toString() ?? "—",
          l.damaged?.toString() ?? "—",
          l.returned?.toString() ?? "—",
          l.destroyed?.toString() ?? "—",
          computeBalance(l.issued, l.returned)?.toString() ?? "—",
        ])
      );
    }
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 7. Finished Goods Warehouse
  heading(doc, "7. Finished Goods Warehouse");
  if (batch.finishedGoodsWarehouse) {
    const f = batch.finishedGoodsWarehouse;
    detailRow(doc, "Finished Goods Received", f.finishedGoodsReceived?.toString() ?? "—");
    detailRow(doc, "QA Released", f.qaReleased ? "Yes" : "No");
    detailRow(doc, "QA Released By", f.qaReleasedByName ?? "—");
    detailRow(doc, "QA Released At", f.qaReleasedAt ? f.qaReleasedAt.toLocaleDateString("en-AU") : "—");
    detailRow(doc, "Storage Location", f.storageLocation ?? "—");
    detailRow(doc, "Warehouse Balance", f.warehouseBalance?.toString() ?? "—");
    detailRow(doc, "Batch Number", f.batchNumber ?? "—");
    detailRow(doc, "Expiry Date", f.expiryDate ? f.expiryDate.toLocaleDateString("en-AU") : "—");
    if (f.remarks) detailRow(doc, "Remarks", f.remarks);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Not started.");
  }

  // 8. Dispatch
  heading(doc, "8. Dispatch");
  if (batch.dispatchEvents.length > 0) {
    drawTable(
      doc,
      [
        { header: "Customer", width: 90 },
        { header: "Sales Order", width: 65 },
        { header: "Batch No.", width: 55 },
        { header: "Expiry", width: 50 },
        { header: "Cases", width: 45 },
        { header: "Bottles", width: 45 },
        { header: "Dispatch Date", width: 60 },
        { header: "Remaining", width: 55 },
        { header: "By", width: 55 },
      ],
      batch.dispatchEvents.map((d) => [
        d.customer,
        d.salesOrder ?? "—",
        d.batchNumber ?? "—",
        d.expiryDate ? d.expiryDate.toLocaleDateString("en-AU") : "—",
        d.casesDispatched?.toString() ?? "—",
        d.bottlesDispatched?.toString() ?? "—",
        d.dispatchDate ? d.dispatchDate.toLocaleDateString("en-AU") : "—",
        d.remainingStockAfter?.toString() ?? "—",
        d.dispatchedByName ?? "—",
      ])
    );
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("No dispatch events recorded.");
  }

  // Final Reconciliation
  heading(doc, "Final Reconciliation");
  const checks = computeFinalReconciliationChecks(batch.blending, batch.encapsulation, batch.bottling);
  if (checks.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("No reconciliation checks available yet.");
  } else {
    for (const c of checks) {
      reconciliationRow(doc, c.label, c.pct, c.limitLabel, c.pass);
    }
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${batch.batchNumber}-reconciliation.pdf"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  return renderDetail(id);
}
