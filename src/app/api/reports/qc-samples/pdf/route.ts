import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SAMPLE_STATUS_LABEL, SAMPLE_TYPE_LABEL, PRODUCT_CATEGORY_LABEL, timeUntilExpiryLabel } from "@/lib/qc-sample-defaults";
import { formatBrisbaneDateTime } from "@/lib/ui";

const MARGIN = 36;
const CONTENT_WIDTH = 595.28 - MARGIN * 2;
const FOOTER_ZONE = 26;
const COLOR = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#94a3b8",
  success: "#1d8a4b",
  danger: "#b91c1c",
  headerBg: "#1e293b",
  headerText: "#ffffff",
  labelBg: "#f1f5f9",
  tableHeaderBg: "#e2e8f0",
};

const LIST_COLUMNS = [
  { header: "Sample ID", width: 85 },
  { header: "Product", width: 90 },
  { header: "Batch", width: 70 },
  { header: "Type", width: 75 },
  { header: "Status", width: 75 },
  { header: "Analyst", width: 75 },
  { header: "Bay / Room", width: 80 },
];

/** Every helper below finishes by resetting doc.x to MARGIN -- pdfkit leaves doc.x wherever the last
 * piece of text was drawn, and a subsequent doc.text() call inherits that x with almost no width left
 * before the page edge, wrapping the next heading one character per line down the page. */
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

function titleBlock(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 54).lineWidth(1).stroke(COLOR.border);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLOR.text).text(title, MARGIN + 10, y + 10, { width: CONTENT_WIDTH - 20, align: "center" });
  doc.font("Helvetica").fontSize(8).fillColor(COLOR.muted).text(subtitle, MARGIN + 10, y + 30, { width: CONTENT_WIDTH - 20, align: "center" });
  resetCursor(doc, y + 54 + 10);
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 30);
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fillAndStroke(COLOR.headerBg, COLOR.headerBg);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.headerText).text(text.toUpperCase(), MARGIN + 8, y + 5, { width: CONTENT_WIDTH - 16 });
  resetCursor(doc, y + 20 + 6);
}

function subHeader(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 20);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.text).text(text, MARGIN, doc.y);
  resetCursor(doc, doc.y + 4);
}

/** A bordered two-column form grid -- label cell (shaded) : value cell -- growing to fit whichever
 * side wraps to more lines, so long remarks/notes never get clipped by the next row's border. */
function fieldRows(doc: PDFKit.PDFDocument, rows: [string, string, string?][], labelWidth = 200) {
  const valueWidth = CONTENT_WIDTH - labelWidth;
  for (const [label, value, valueColor] of rows) {
    doc.font("Helvetica-Bold").fontSize(8);
    const labelHeight = doc.heightOfString(label, { width: labelWidth - 12 });
    doc.font("Helvetica").fontSize(8.5);
    const valueHeight = doc.heightOfString(value || "—", { width: valueWidth - 12 });
    const rowHeight = Math.max(16, labelHeight + 8, valueHeight + 8);

    ensureSpace(doc, rowHeight);
    const y = doc.y;
    doc.rect(MARGIN, y, labelWidth, rowHeight).fillAndStroke(COLOR.labelBg, COLOR.border);
    doc.rect(MARGIN + labelWidth, y, valueWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted).text(label, MARGIN + 6, y + 4, { width: labelWidth - 12 });
    doc.font(valueColor ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(valueColor ?? COLOR.text).text(value || "—", MARGIN + labelWidth + 6, y + 4, { width: valueWidth - 12 });
    resetCursor(doc, y + rowHeight);
  }
  doc.y += 6;
  doc.fillColor(COLOR.text);
}

/** Generic bordered grid table with a shaded header row, used for the Audit Trail. */
function drawTable(doc: PDFKit.PDFDocument, columns: { header: string; width: number }[], rows: string[][]) {
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const rowHeight = 18;

  function drawGridRow(y: number, cells: string[], bold: boolean, bg?: string) {
    if (bg) doc.rect(MARGIN, y, totalWidth, rowHeight).fillAndStroke(bg, COLOR.border);
    else doc.rect(MARGIN, y, totalWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    let x = MARGIN;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8 : 7.5).fillColor(COLOR.text);
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i] ?? "—", x + 4, y + 5, { width: columns[i].width - 8, lineBreak: false });
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
  doc.fillColor(COLOR.text);
}

/** Lab test checklist table -- like drawTable but the Result column is colour-coded per row
 * (PASS/FAIL/pending), which the generic table helper doesn't support. */
function labTestTable(doc: PDFKit.PDFDocument, items: { parameter: string; result: string | null; details: string | null }[]) {
  const columns = [
    { header: "Parameter", width: 230 },
    { header: "Result", width: 65 },
    { header: "Details", width: CONTENT_WIDTH - 295 },
  ];
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const rowHeight = 18;

  function drawHeaderRow(y: number) {
    doc.rect(MARGIN, y, totalWidth, rowHeight).fillAndStroke(COLOR.tableHeaderBg, COLOR.border);
    let x = MARGIN;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.text);
    for (const col of columns) {
      doc.text(col.header, x + 4, y + 5, { width: col.width - 8 });
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

  for (const item of items) {
    if (y + rowHeight > doc.page.height - MARGIN - FOOTER_ZONE) {
      doc.addPage({ size: "A4", margin: MARGIN });
      y = MARGIN;
      drawHeaderRow(y);
      y += rowHeight;
    }
    doc.rect(MARGIN, y, totalWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    let x = MARGIN;
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.text).text(item.parameter, x + 4, y + 5, { width: columns[0].width - 8, lineBreak: false });
    x += columns[0].width;
    const resultColor = item.result === "PASS" ? COLOR.success : item.result === "FAIL" ? COLOR.danger : COLOR.muted;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(resultColor).text(item.result ?? "—", x + 4, y + 5, { width: columns[1].width - 8, lineBreak: false });
    x += columns[1].width;
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.muted).text(item.details ?? "—", x + 4, y + 5, { width: columns[2].width - 8, lineBreak: false });
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

async function renderList(request: NextRequest) {
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
    for (const col of LIST_COLUMNS) {
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
    for (let i = 0; i < LIST_COLUMNS.length; i++) {
      doc.text(values[i], x + 4, y + 5, { width: LIST_COLUMNS[i].width - 8 });
      x += LIST_COLUMNS[i].width;
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

async function renderDetail(id: string) {
  const sample = await prisma.qcSample.findUnique({
    where: { id },
    include: { labTest: { include: { items: { orderBy: { sortOrder: "asc" } } } }, retentionRecord: true },
  });
  if (!sample) return NextResponse.json({ error: "Sample not found" }, { status: 404 });

  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "QcSample", entityId: sample.id },
    orderBy: { createdAt: "asc" },
  });

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  titleBlock(doc, "QC SAMPLE RECORD", "GMP / GDP Controlled Document — Batch & Laboratory Traceability");

  const statusColor = sample.status === "APPROVED" ? COLOR.success : sample.status === "REJECTED" ? COLOR.danger : COLOR.muted;
  fieldRows(doc, [
    ["Sample ID", sample.sampleId],
    ["Status", SAMPLE_STATUS_LABEL[sample.status], statusColor],
    ["Report Generated", formatBrisbaneDateTime(new Date())],
  ]);

  sectionHeader(doc, "Sample Details");
  fieldRows(doc, [
    ["Product", sample.productName],
    ["Batch", sample.batchNumber],
    ["Type", SAMPLE_TYPE_LABEL[sample.sampleType]],
    ["Product Category", sample.productCategory ? PRODUCT_CATEGORY_LABEL[sample.productCategory] : "—"],
    ["Quantity", `${sample.quantity} ${sample.unit}`],
    ["Manufacturing Date", sample.manufacturingDate ? sample.manufacturingDate.toLocaleDateString("en-AU") : "—"],
    ["Expiry Date", sample.expiryDate ? sample.expiryDate.toLocaleDateString("en-AU") : "—"],
    ["Time to Expiry", timeUntilExpiryLabel(sample.expiryDate), sample.expiryDate && sample.expiryDate < new Date() ? COLOR.danger : undefined],
    ["Collected By", sample.collectedByName ?? "—"],
    ["Collection Date", sample.collectionDate ? sample.collectionDate.toLocaleDateString("en-AU") : "—"],
    ["Production Room / Bay", sample.productionRoom ?? "—"],
    ["Sample Storage Location", sample.sampleStorageLocation ?? "—"],
    ["Storage Temperature", sample.storageTemperature ?? "—"],
    ["Storage Condition", sample.storageCondition ?? "—"],
    ["Sent to Lab", sample.sentDate ? sample.sentDate.toLocaleDateString("en-AU") : "—"],
    ["Courier / Internal", sample.courierOrInternal ?? "—"],
    ["Laboratory Name", sample.laboratoryName ?? "—"],
    ["Laboratory Location", sample.laboratoryLocation ?? "—"],
    ["Received by QC", sample.receivedByQcName ?? "—"],
    ["Remarks", sample.remarks ?? "—"],
  ]);

  if (sample.labTest && sample.labTest.items.length > 0) {
    sectionHeader(doc, "Laboratory Testing");

    let currentSection = "";
    let sectionItems: { parameter: string; result: string | null; details: string | null }[] = [];
    const flushSection = () => {
      if (sectionItems.length > 0) labTestTable(doc, sectionItems);
      sectionItems = [];
    };
    for (const item of sample.labTest.items) {
      if (item.section !== currentSection) {
        flushSection();
        currentSection = item.section;
        subHeader(doc, currentSection);
      }
      sectionItems.push({ parameter: item.parameter, result: item.result, details: item.details });
    }
    flushSection();

    fieldRows(doc, [
      [
        "Tested By / Date",
        `${sample.labTest.testedByName ?? "—"}${sample.labTest.testedAt ? `  /  ${sample.labTest.testedAt.toLocaleString("en-AU")}` : ""}`,
      ],
    ]);
  }

  if (sample.retentionRecord) {
    sectionHeader(doc, "Retention Sample");
    const r = sample.retentionRecord;
    fieldRows(doc, [
      ["Shelf", r.shelf ?? "—"],
      ["Cabinet", r.cabinet ?? "—"],
      ["Box Number", r.boxNumber ?? "—"],
      ["Position", r.position ?? "—"],
      ["Quantity Remaining", r.quantityRemaining !== null ? `${r.quantityRemaining} ${sample.unit}` : "—"],
      ["Opened", r.opened ? "Yes" : "No"],
      ["Expiry Date", r.expiryDate ? r.expiryDate.toLocaleDateString("en-AU") : "—"],
      ["Destroy Date", r.destroyDate ? r.destroyDate.toLocaleDateString("en-AU") : "—"],
    ]);
  }

  if (auditLog.length > 0) {
    sectionHeader(doc, "Audit Trail");
    drawTable(
      doc,
      [
        { header: "Timestamp", width: 140 },
        { header: "Event", width: CONTENT_WIDTH - 140 },
      ],
      auditLog.map((a) => [a.createdAt.toLocaleString("en-AU"), a.summary])
    );
  }

  // Footer (page N of M) on every buffered page -- the footer sits inside the page's bottom margin
  // zone, and pdfkit auto-paginates any doc.text() call that would land there; zeroing the bottom
  // margin for this page just before drawing stops it from silently inserting a blank page each time.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 30;
    doc.font("Helvetica").fontSize(7).fillColor(COLOR.muted);
    doc.text(`Sample ${sample.sampleId} — GMP/GDP Controlled Document — Confidential`, MARGIN, footerY, { width: 340, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - MARGIN - 150, footerY, { width: 150, align: "right", lineBreak: false });
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sample.sampleId}.pdf"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (id) return renderDetail(id);
  return renderList(request);
}
