import { PURPOSE_LABEL, STAGE_LABEL } from "@/lib/drying-room-defaults";
import type { DryingBayPurpose, DryingStage } from "@/generated/prisma";

type ReportBatch = {
  productName: string;
  batchNumber: string;
  numberOfTrolleys: number;
  currentStage: DryingStage;
};

type ReportBay = {
  bayNumber: number;
  purpose: DryingBayPurpose;
  batches: ReportBatch[];
};

type ReportMiscItem = {
  product: string;
  quantityLabel: string;
  status: string | null;
};

function bayStatusLine(bay: ReportBay): string {
  if (bay.purpose === "CLEANED") return "✅ Cleaned";
  if (bay.purpose === "CLEANING_REQUIRED") return "⚠️ Cleaning Required";
  if (bay.purpose === "EMPTY") return "Empty";
  return PURPOSE_LABEL[bay.purpose];
}

function batchLine(b: ReportBatch): string {
  const qty = `${b.numberOfTrolleys} ${b.numberOfTrolleys === 1 ? "Trolley" : "Trolleys"}`;
  return `• *${b.productName}* – Batch *${b.batchNumber}*\n   ${qty} – ${STAGE_LABEL[b.currentStage]}`;
}

/** Text-block report using WhatsApp's markdown (*bold*, bullets, emoji) so the message renders
 * cleanly there; the same text is also shown as-is on the live Reports tab. */
export function generateMorningReportText(bays: ReportBay[], misc: ReportMiscItem[]): string {
  const lines: string[] = ["*Drying Room Status Report*", ""];

  for (const bay of bays) {
    lines.push(`*Bay ${bay.bayNumber}*`);
    if (bay.batches.length === 0) {
      lines.push(bayStatusLine(bay));
    } else {
      for (const b of bay.batches) lines.push(batchLine(b));
    }
    lines.push("");
  }

  if (misc.length > 0) {
    lines.push("*Miscellaneous*");
    for (const m of misc) {
      lines.push(`• ${m.product} – ${m.quantityLabel}${m.status ? ` – ${m.status}` : ""}`);
    }
  }

  return lines.join("\n").trim();
}
