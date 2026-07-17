import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PURPOSE_LABEL, STAGE_LABEL } from "@/lib/drying-room-defaults";

const MARGIN = 36;
const COLOR = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#cbd5e1",
  success: "#1d8a4b",
  successBg: "#e3f3ea",
  warning: "#b7791f",
  warningBg: "#faf1e2",
  neutralBg: "#eef2f6",
};

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN) {
    doc.addPage({ size: "A4", margin: MARGIN });
  }
}

/** Small colored status pill -- drawn as vector shapes rather than relying on emoji glyphs, which
 * don't render reliably across PDF viewers/fonts. */
function statusPill(doc: PDFKit.PDFDocument, x: number, y: number, label: string, tone: "success" | "warning" | "neutral") {
  const bg = tone === "success" ? COLOR.successBg : tone === "warning" ? COLOR.warningBg : COLOR.neutralBg;
  const fg = tone === "success" ? COLOR.success : tone === "warning" ? COLOR.warning : COLOR.muted;
  doc.font("Helvetica-Bold").fontSize(9);
  const width = doc.widthOfString(label) + 20;
  doc.roundedRect(x, y, width, 18, 9).fill(bg);
  doc.fillColor(fg).text(label, x + 10, y + 4.5, { width: width - 20 });
  doc.fillColor(COLOR.text);
  return width;
}

function fmtDate(d: Date) {
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const [bays, misc] = await Promise.all([
    prisma.dryingBay.findMany({
      orderBy: { bayNumber: "asc" },
      include: { batches: { where: { completedAt: null }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.miscStorageItem.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(18).fillColor(COLOR.text).text("Drying Room Status Report", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(`Generated ${fmtDate(new Date())}`, { align: "center" });
  doc.moveDown(1);
  doc.fillColor(COLOR.text);

  for (const bay of bays) {
    ensureSpace(doc, 70);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text).text(`Bay ${bay.bayNumber}`);
    doc.moveDown(0.2);

    if (bay.batches.length === 0) {
      const tone = bay.purpose === "CLEANED" ? "success" : bay.purpose === "CLEANING_REQUIRED" ? "warning" : "neutral";
      const label = bay.purpose === "EMPTY" ? "Empty" : PURPOSE_LABEL[bay.purpose];
      statusPill(doc, MARGIN, doc.y, label, tone);
      doc.moveDown(1.4);
    } else {
      for (const batch of bay.batches) {
        ensureSpace(doc, 34);
        const y = doc.y;
        doc.circle(MARGIN + 3, y + 5, 2.5).fill(COLOR.muted);
        doc.fillColor(COLOR.text);
        doc.font("Helvetica-Bold").fontSize(9.5).text(`${batch.productName} — Batch ${batch.batchNumber}`, MARGIN + 12, y);
        doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(
          `${batch.numberOfTrolleys} ${batch.numberOfTrolleys === 1 ? "Trolley" : "Trolleys"} — ${STAGE_LABEL[batch.currentStage]}`,
          MARGIN + 12,
          doc.y
        );
        doc.fillColor(COLOR.text);
        doc.moveDown(0.5);
      }
    }
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(COLOR.border).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
  }

  if (misc.length > 0) {
    ensureSpace(doc, 60);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text).text("Miscellaneous");
    doc.moveDown(0.2);
    for (const m of misc) {
      ensureSpace(doc, 34);
      const y = doc.y;
      doc.circle(MARGIN + 3, y + 5, 2.5).fill(COLOR.muted);
      doc.fillColor(COLOR.text);
      doc.font("Helvetica-Bold").fontSize(9.5).text(m.product, MARGIN + 12, y);
      doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(
        `${m.quantityLabel}${m.status ? ` — ${m.status}` : ""}`,
        MARGIN + 12,
        doc.y
      );
      doc.fillColor(COLOR.text);
      doc.moveDown(0.5);
    }
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Drying_Room_Status_Report_${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
