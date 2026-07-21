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
  type ReconciliationCheck,
} from "@/lib/mfg-reconciliation-defaults";

const MARGIN = 36;
const CONTENT_WIDTH = 595.28 - MARGIN * 2;
const FOOTER_ZONE = 26;
const COLOR = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#94a3b8",
  headerBg: "#1e293b",
  headerText: "#ffffff",
  labelBg: "#f1f5f9",
  tableHeaderBg: "#e2e8f0",
  success: "#15803d",
  danger: "#b91c1c",
};

/** Every row/table helper below finishes by resetting doc.x to MARGIN -- pdfkit leaves doc.x wherever
 * the last piece of text was drawn, and a subsequent doc.text() call inherits that x with almost no
 * width left before the page edge, wrapping the next heading one character per line. */
function resetCursor(doc: PDFKit.PDFDocument, y: number) {
  doc.x = MARGIN;
  doc.y = y;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN - FOOTER_ZONE) {
    doc.addPage({ size: "A4", margin: MARGIN });
    doc.x = MARGIN;
  }
}

function titleBlock(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 54).lineWidth(1).stroke(COLOR.border);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLOR.text).text("MANUFACTURING BATCH RECONCILIATION RECORD", MARGIN + 10, y + 10, { width: CONTENT_WIDTH - 20, align: "center" });
  doc.font("Helvetica").fontSize(8).fillColor(COLOR.muted).text("GMP / GDP Controlled Document — Batch Traceability & Reconciliation Summary", MARGIN + 10, y + 30, {
    width: CONTENT_WIDTH - 20,
    align: "center",
  });
  resetCursor(doc, y + 54 + 10);
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 30);
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fillAndStroke(COLOR.headerBg, COLOR.headerBg);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.headerText).text(text.toUpperCase(), MARGIN + 8, y + 5, { width: CONTENT_WIDTH - 16 });
  resetCursor(doc, y + 20 + 6);
}

/** A bordered two-column form grid -- label cell (shaded) : value cell -- the standard GMP paper-form
 * look, and incidentally what fixes the cursor-drift wrapping bug since every cell has a fixed width. */
function fieldRows(doc: PDFKit.PDFDocument, rows: [string, string][]) {
  const labelWidth = 200;
  const valueWidth = CONTENT_WIDTH - labelWidth;
  const rowHeight = 16;
  for (const [label, value] of rows) {
    ensureSpace(doc, rowHeight);
    const y = doc.y;
    doc.rect(MARGIN, y, labelWidth, rowHeight).fillAndStroke(COLOR.labelBg, COLOR.border);
    doc.rect(MARGIN + labelWidth, y, valueWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted).text(label, MARGIN + 6, y + 4, { width: labelWidth - 12, lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.text).text(value || "—", MARGIN + labelWidth + 6, y + 4, { width: valueWidth - 12, lineBreak: false });
    resetCursor(doc, y + rowHeight);
  }
  doc.y += 8;
}

function emptyStageNotice(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 16);
  const y = doc.y;
  doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLOR.muted).text(text, MARGIN, y);
  resetCursor(doc, y + 16);
}

function drawTable(doc: PDFKit.PDFDocument, columns: { header: string; width: number }[], rows: string[][]) {
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const rowHeight = 18;

  function drawGridRow(y: number, cells: string[], bold: boolean, bg?: string) {
    if (bg) doc.rect(MARGIN, y, totalWidth, rowHeight).fillAndStroke(bg, COLOR.border);
    else doc.rect(MARGIN, y, totalWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    let x = MARGIN;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 7.5 : 7).fillColor(COLOR.text);
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i] ?? "—", x + 3, y + 5, { width: columns[i].width - 6, lineBreak: false });
      x += columns[i].width;
    }
    x = MARGIN;
    for (const col of columns) {
      doc.moveTo(x, y).lineTo(x, y + rowHeight).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      x += col.width;
    }
    doc.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor(COLOR.border).stroke();
  }

  ensureSpace(doc, rowHeight * 2);
  let y = doc.y;
  drawGridRow(y, columns.map((c) => c.header), true, COLOR.tableHeaderBg);
  y += rowHeight;

  for (const row of rows) {
    if (y + rowHeight > doc.page.height - MARGIN - FOOTER_ZONE) {
      doc.addPage({ size: "A4", margin: MARGIN });
      y = MARGIN;
      drawGridRow(y, columns.map((c) => c.header), true, COLOR.tableHeaderBg);
      y += rowHeight;
    }
    drawGridRow(y, row, false);
    y += rowHeight;
  }
  resetCursor(doc, y + 10);
}

function reconciliationTable(doc: PDFKit.PDFDocument, checks: ReconciliationCheck[]) {
  const columns = [
    { header: "Parameter", width: 210 },
    { header: "Acceptance Criteria", width: 150 },
    { header: "Result", width: 80 },
    { header: "Status", width: 83 },
  ];
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const rowHeight = 20;

  function drawHeaderRow(y: number) {
    doc.rect(MARGIN, y, totalWidth, rowHeight).fillAndStroke(COLOR.tableHeaderBg, COLOR.border);
    let x = MARGIN;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.text);
    for (const col of columns) {
      doc.text(col.header, x + 4, y + 6, { width: col.width - 8 });
      x += col.width;
    }
    x = MARGIN;
    for (const col of columns) {
      doc.moveTo(x, y).lineTo(x, y + rowHeight).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      x += col.width;
    }
    doc.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor(COLOR.border).stroke();
  }

  ensureSpace(doc, rowHeight * 2);
  let y = doc.y;
  drawHeaderRow(y);
  y += rowHeight;

  for (const c of checks) {
    if (y + rowHeight > doc.page.height - MARGIN - FOOTER_ZONE) {
      doc.addPage({ size: "A4", margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(y);
      y += rowHeight;
    }
    doc.rect(MARGIN, y, totalWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    let x = MARGIN;
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.text).text(c.label, x + 4, y + 6, { width: columns[0].width - 8 });
    x += columns[0].width;
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.muted).text(c.limitLabel || "Informational", x + 4, y + 6, { width: columns[1].width - 8 });
    x += columns[1].width;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.text).text(c.pct !== null ? `${c.pct.toFixed(1)}%` : "—", x + 4, y + 6, { width: columns[2].width - 8 });
    x += columns[2].width;
    const statusText = c.pass === null ? "—" : c.pass ? "PASS" : "FAIL";
    const statusColor = c.pass === null ? COLOR.muted : c.pass ? COLOR.success : COLOR.danger;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(statusColor).text(statusText, x + 4, y + 6, { width: columns[3].width - 8 });
    x = MARGIN;
    for (const col of columns) {
      doc.moveTo(x, y).lineTo(x, y + rowHeight).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      x += col.width;
    }
    doc.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor(COLOR.border).stroke();
    y += rowHeight;
  }
  resetCursor(doc, y + 10);
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

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  titleBlock(doc);

  fieldRows(doc, [
    ["Batch Number", batch.batchNumber],
    ["Product", batch.productName],
    ["Status", MFG_BATCH_STATUS_LABEL[batch.status]],
    ["Linked Batch Record", batch.batchRecord ? `${batch.batchRecord.batchNumber} — ${batch.batchRecord.productName}` : "—"],
    ["Report Generated", formatBrisbaneDateTime(new Date())],
    ...(batch.remarks ? ([["Remarks", batch.remarks]] as [string, string][]) : []),
  ]);

  // 1. Warehouse Issue
  sectionHeader(doc, "1. Warehouse Issue");
  if (batch.warehouseIssue) {
    fieldRows(doc, [
      ["Issued By", batch.warehouseIssue.issuedByName ?? "—"],
      ["Issue Date", batch.warehouseIssue.issueDate ? batch.warehouseIssue.issueDate.toLocaleDateString("en-AU") : "—"],
      ...(batch.warehouseIssue.remarks ? ([["Remarks", batch.warehouseIssue.remarks]] as [string, string][]) : []),
    ]);
    if (batch.warehouseIssue.lines.length > 0) {
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
    emptyStageNotice(doc, "Not started.");
  }

  // 2. Blending
  sectionHeader(doc, "2. Blending");
  if (batch.blending) {
    const b = batch.blending;
    const blendYield = computeYieldPct(b.totalBlendProducedKg, b.totalTheoreticalWeightKg);
    fieldRows(doc, [
      ["Total Theoretical Weight (kg)", b.totalTheoreticalWeightKg?.toString() ?? "—"],
      ["Actual Weight (kg)", b.actualWeightKg?.toString() ?? "—"],
      ["Blend Batch Number", b.blendBatchNumber ?? "—"],
      ["Powder Remaining (kg)", b.powderRemainingKg?.toString() ?? "—"],
      ["Blender Residue (kg)", b.blenderResidueKg?.toString() ?? "—"],
      ["Sieve Loss (kg)", b.sieveLossKg?.toString() ?? "—"],
      ["Dust Loss (kg)", b.dustLossKg?.toString() ?? "—"],
      ["Spillages (kg)", b.spillagesKg?.toString() ?? "—"],
      ["QC Samples", b.qcSamplesQty?.toString() ?? "—"],
      ["Retention Samples", b.retentionSamplesQty?.toString() ?? "—"],
      ["Destroyed Material (kg)", b.destroyedMaterialKg?.toString() ?? "—"],
      ["Returned to Warehouse (kg)", b.returnedToWarehouseKg?.toString() ?? "—"],
      ["Total Blend Produced (kg)", b.totalBlendProducedKg?.toString() ?? "—"],
      ["Blend Yield %", blendYield !== null ? `${blendYield.toFixed(1)}%` : "—"],
      ["Blended By", b.blendedByName ?? "—"],
      ["Blended At", b.blendedAt ? b.blendedAt.toLocaleDateString("en-AU") : "—"],
      ...(b.remarks ? ([["Remarks", b.remarks]] as [string, string][]) : []),
    ]);
  } else {
    emptyStageNotice(doc, "Not started.");
  }

  // 3. Encapsulation
  sectionHeader(doc, "3. Encapsulation");
  if (batch.encapsulation) {
    const e = batch.encapsulation;
    const theoreticalCapsules = capsulesFromKg(e.issuedBulkBlendKg, e.targetCapsuleFillWeightMg);
    const capsulesProduced = capsulesFromKg(e.capsulesProducedKg, e.avgCapsuleFullWeightMg);
    fieldRows(doc, [
      ["Target Capsule Fill Weight (mg)", e.targetCapsuleFillWeightMg?.toString() ?? "—"],
      ["Average Capsule Full Weight (mg)", e.avgCapsuleFullWeightMg?.toString() ?? "—"],
      ["Issued Bulk Blend (kg)", e.issuedBulkBlendKg?.toString() ?? "—"],
      ["Capsules Produced (kg)", e.capsulesProducedKg?.toString() ?? "—"],
      ["Capsule Samples (kg)", e.capsuleSamplesKg?.toString() ?? "—"],
      ["Reject Capsules (kg)", e.rejectCapsulesKg?.toString() ?? "—"],
      ["Reject Powder (kg)", e.rejectPowderKg?.toString() ?? "—"],
      ["Average Capsule Fill Weight (mg)", e.avgCapsuleFillWeightMg?.toString() ?? "—"],
      ["Average Capsule Length (mm)", e.avgCapsuleLengthMm?.toString() ?? "—"],
      [
        "Average Disintegration",
        e.avgDisintegrationMinutes !== null || e.avgDisintegrationSeconds !== null ? `${e.avgDisintegrationMinutes ?? 0}m ${e.avgDisintegrationSeconds ?? 0}s` : "—",
      ],
      ["Disintegration Result", e.disintegrationResult ?? "—"],
      ["Theoretical No. of Capsules", formatCount(theoreticalCapsules)],
      ["No. of Capsules Produced", formatCount(capsulesProduced)],
      ["Completed By", e.completedByName ?? "—"],
      ["Completed Date", e.completedAt ? e.completedAt.toLocaleDateString("en-AU") : "—"],
      ["Checked By", e.checkedByName ?? "—"],
      ["Checked Date", e.checkedAt ? e.checkedAt.toLocaleDateString("en-AU") : "—"],
      ...(e.comments ? ([["Comments", e.comments]] as [string, string][]) : []),
    ]);
  } else {
    emptyStageNotice(doc, "Not started.");
  }

  // 4. Bottling
  sectionHeader(doc, "4. Bottling");
  if (batch.bottling) {
    const bt = batch.bottling;
    fieldRows(doc, [
      ["Total Capsule Bulk Weight (kg)", bt.totalCapsuleBulkWeightKg?.toString() ?? "—"],
      ["Average Capsule Full Weight (mg)", bt.avgCapsuleFullWeightMg?.toString() ?? "—"],
      ["Planned Quantity (Bottles)", bt.plannedQuantityBottles?.toString() ?? "—"],
      ["Target Capsules per Bottle", bt.targetCapsulesPerBottle?.toString() ?? "—"],
      ["Capsule Received (kg)", bt.capsuleReceivedKg?.toString() ?? "—"],
      ["Bottles Produced", bt.bottlesProduced?.toString() ?? "—"],
      ["Bottle Used", bt.bottleUsed?.toString() ?? "—"],
      ["Desiccants Used", bt.desiccantsUsed?.toString() ?? "—"],
      ["Caps Used", bt.capsUsed?.toString() ?? "—"],
      ["Completed By", bt.completedByName ?? "—"],
      ["Completed Date", bt.completedAt ? bt.completedAt.toLocaleDateString("en-AU") : "—"],
      ["Checked By", bt.checkedByName ?? "—"],
      ["Checked Date", bt.checkedAt ? bt.checkedAt.toLocaleDateString("en-AU") : "—"],
      ...(bt.comments ? ([["Comments", bt.comments]] as [string, string][]) : []),
    ]);
  } else {
    emptyStageNotice(doc, "Not started.");
  }

  // 5. X-Ray / Metal Detection
  sectionHeader(doc, "5. X-Ray / Metal Detection");
  if (batch.xrayInspection) {
    const x = batch.xrayInspection;
    fieldRows(doc, [
      ["Bottles Received", x.bottlesReceived?.toString() ?? "—"],
      ["Bottles Scanned", x.bottlesScanned?.toString() ?? "—"],
      ["Passed", x.passed?.toString() ?? "—"],
      ["Failed", x.failed?.toString() ?? "—"],
      ["Reworked", x.reworked?.toString() ?? "—"],
      ["Destroyed", x.destroyed?.toString() ?? "—"],
      ["Released", x.released?.toString() ?? "—"],
      ["Reject — Metal Detection", x.rejectMetalDetection?.toString() ?? "—"],
      ["Reject — X-Ray Failure", x.rejectXrayFailure?.toString() ?? "—"],
      ["Reject — Underweight", x.rejectUnderweight?.toString() ?? "—"],
      ["Reject — Overweight", x.rejectOverweight?.toString() ?? "—"],
      ["Reject — Damaged Bottle", x.rejectDamagedBottle?.toString() ?? "—"],
      ["Reject — Missing Cap", x.rejectMissingCap?.toString() ?? "—"],
      ["Reject — Missing Desiccant", x.rejectMissingDesiccant?.toString() ?? "—"],
      ["Inspected By", x.inspectedByName ?? "—"],
      ["Inspected At", x.inspectedAt ? x.inspectedAt.toLocaleDateString("en-AU") : "—"],
      ...(x.remarks ? ([["Remarks", x.remarks]] as [string, string][]) : []),
    ]);
  } else {
    emptyStageNotice(doc, "Not started.");
  }

  // 6. Packaging
  sectionHeader(doc, "6. Packaging");
  if (batch.packaging) {
    const p = batch.packaging;
    fieldRows(doc, [
      ["Packed Bottles", p.packedBottles?.toString() ?? "—"],
      ["Cartons Produced", p.cartonsProduced?.toString() ?? "—"],
      ["Cases Produced", p.casesProduced?.toString() ?? "—"],
      ["Packed By", p.packedByName ?? "—"],
      ["Packed At", p.packedAt ? p.packedAt.toLocaleDateString("en-AU") : "—"],
      ...(p.remarks ? ([["Remarks", p.remarks]] as [string, string][]) : []),
    ]);
    if (p.lines.length > 0) {
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
    emptyStageNotice(doc, "Not started.");
  }

  // 7. Finished Goods Warehouse
  sectionHeader(doc, "7. Finished Goods Warehouse");
  if (batch.finishedGoodsWarehouse) {
    const f = batch.finishedGoodsWarehouse;
    fieldRows(doc, [
      ["Finished Goods Received", f.finishedGoodsReceived?.toString() ?? "—"],
      ["QA Released", f.qaReleased ? "Yes" : "No"],
      ["QA Released By", f.qaReleasedByName ?? "—"],
      ["QA Released At", f.qaReleasedAt ? f.qaReleasedAt.toLocaleDateString("en-AU") : "—"],
      ["Storage Location", f.storageLocation ?? "—"],
      ["Warehouse Balance", f.warehouseBalance?.toString() ?? "—"],
      ["Batch Number", f.batchNumber ?? "—"],
      ["Expiry Date", f.expiryDate ? f.expiryDate.toLocaleDateString("en-AU") : "—"],
      ...(f.remarks ? ([["Remarks", f.remarks]] as [string, string][]) : []),
    ]);
  } else {
    emptyStageNotice(doc, "Not started.");
  }

  // 8. Dispatch
  sectionHeader(doc, "8. Dispatch");
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
    emptyStageNotice(doc, "No dispatch events recorded.");
  }

  // Final Reconciliation
  sectionHeader(doc, "Final Reconciliation");
  const checks = computeFinalReconciliationChecks(batch.blending, batch.encapsulation, batch.bottling);
  if (checks.length === 0) {
    emptyStageNotice(doc, "No reconciliation checks available yet.");
  } else {
    reconciliationTable(doc, checks);
  }

  // Footer (page N of M) on every buffered page. The footer sits inside the page's bottom margin
  // zone, and pdfkit auto-paginates any doc.text() call that would land there -- zeroing the bottom
  // margin for this page just before drawing stops it from silently inserting a blank page each time.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 30;
    doc.font("Helvetica").fontSize(7).fillColor(COLOR.muted);
    doc.text(`Batch ${batch.batchNumber} — GMP Controlled Document — Confidential`, MARGIN, footerY, { width: 300, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - MARGIN - 150, footerY, { width: 150, align: "right", lineBreak: false });
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
