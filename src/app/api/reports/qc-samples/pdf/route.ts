import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SAMPLE_STATUS_LABEL, SAMPLE_TYPE_LABEL, PRODUCT_CATEGORY_LABEL } from "@/lib/qc-sample-defaults";
import { formatBrisbaneDateTime } from "@/lib/ui";

const MARGIN = 36;
const COLOR = { text: "#0f172a", muted: "#64748b", border: "#cbd5e1", success: "#1d8a4b", danger: "#b91c1c" };

const LIST_COLUMNS = [
  { header: "Sample ID", width: 85 },
  { header: "Product", width: 90 },
  { header: "Batch", width: 70 },
  { header: "Type", width: 75 },
  { header: "Status", width: 75 },
  { header: "Analyst", width: 75 },
  { header: "Bay / Room", width: 80 },
];

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN) {
    doc.addPage({ size: "A4", margin: MARGIN });
  }
}

function detailRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 16);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.muted).text(`${label}: `, MARGIN, doc.y, { continued: true, width: 500 });
  doc.font("Helvetica").fillColor(COLOR.text).text(value || "—");
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

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(18).fillColor(COLOR.text).text(sample.sampleId, { continued: true });
  doc.font("Helvetica").fontSize(11).fillColor(COLOR.muted).text(`   ${SAMPLE_STATUS_LABEL[sample.status]}`);
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(`Generated ${formatBrisbaneDateTime(new Date())}`);
  doc.moveDown(0.8);

  detailRow(doc, "Product", sample.productName);
  detailRow(doc, "Batch", sample.batchNumber);
  detailRow(doc, "Type", SAMPLE_TYPE_LABEL[sample.sampleType]);
  detailRow(doc, "Product Category", sample.productCategory ? PRODUCT_CATEGORY_LABEL[sample.productCategory] : "—");
  detailRow(doc, "Quantity", `${sample.quantity} ${sample.unit}`);
  detailRow(doc, "Manufacturing Date", sample.manufacturingDate ? sample.manufacturingDate.toLocaleDateString("en-AU") : "—");
  detailRow(doc, "Expiry Date", sample.expiryDate ? sample.expiryDate.toLocaleDateString("en-AU") : "—");
  detailRow(doc, "Collected By", sample.collectedByName ?? "—");
  detailRow(doc, "Collection Date", sample.collectionDate ? sample.collectionDate.toLocaleDateString("en-AU") : "—");
  detailRow(doc, "Production Room / Bay", sample.productionRoom ?? "—");
  detailRow(doc, "Sample Storage Location", sample.sampleStorageLocation ?? "—");
  detailRow(doc, "Storage Temperature", sample.storageTemperature ?? "—");
  detailRow(doc, "Storage Condition", sample.storageCondition ?? "—");
  detailRow(doc, "Sent to Lab", sample.sentDate ? sample.sentDate.toLocaleDateString("en-AU") : "—");
  detailRow(doc, "Courier / Internal", sample.courierOrInternal ?? "—");
  detailRow(doc, "Laboratory Name", sample.laboratoryName ?? "—");
  detailRow(doc, "Laboratory Location", sample.laboratoryLocation ?? "—");
  detailRow(doc, "Received by QC", sample.receivedByQcName ?? "—");
  detailRow(doc, "Remarks", sample.remarks ?? "—");

  if (sample.labTest && sample.labTest.items.length > 0) {
    ensureSpace(doc, 40);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text).text("Laboratory Testing");
    doc.moveDown(0.2);

    let currentSection = "";
    for (const item of sample.labTest.items) {
      if (item.section !== currentSection) {
        currentSection = item.section;
        ensureSpace(doc, 20);
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.text).text(currentSection);
      }
      ensureSpace(doc, 14);
      const resultColor = item.result === "PASS" ? COLOR.success : item.result === "FAIL" ? COLOR.danger : COLOR.muted;
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(item.parameter, MARGIN + 10, doc.y, { continued: true, width: 200 });
      doc.font("Helvetica-Bold").fillColor(resultColor).text(`  ${item.result ?? "—"}`, { continued: !!item.details, width: 60 });
      if (item.details) {
        doc.font("Helvetica").fillColor(COLOR.muted).text(`  ${item.details}`);
      }
    }
    doc.fillColor(COLOR.text);
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(
      `Tested by ${sample.labTest.testedByName ?? "—"}${sample.labTest.testedAt ? ` on ${sample.labTest.testedAt.toLocaleString("en-AU")}` : ""}`
    );
    doc.fillColor(COLOR.text);
  }

  if (sample.retentionRecord) {
    ensureSpace(doc, 40);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text).text("Retention Sample");
    doc.moveDown(0.2);
    const r = sample.retentionRecord;
    detailRow(doc, "Shelf", r.shelf ?? "—");
    detailRow(doc, "Cabinet", r.cabinet ?? "—");
    detailRow(doc, "Box Number", r.boxNumber ?? "—");
    detailRow(doc, "Position", r.position ?? "—");
    detailRow(doc, "Quantity Remaining", r.quantityRemaining !== null ? `${r.quantityRemaining} ${sample.unit}` : "—");
    detailRow(doc, "Opened", r.opened ? "Yes" : "No");
    detailRow(doc, "Expiry Date", r.expiryDate ? r.expiryDate.toLocaleDateString("en-AU") : "—");
    detailRow(doc, "Destroy Date", r.destroyDate ? r.destroyDate.toLocaleDateString("en-AU") : "—");
  }

  if (auditLog.length > 0) {
    ensureSpace(doc, 40);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text).text("Audit Trail");
    doc.moveDown(0.2);
    for (const a of auditLog) {
      ensureSpace(doc, 14);
      doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(`${a.createdAt.toLocaleString("en-AU")} — `, MARGIN, doc.y, { continued: true });
      doc.fillColor(COLOR.text).text(a.summary);
    }
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
