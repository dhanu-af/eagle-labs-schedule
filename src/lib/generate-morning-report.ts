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

function batchLine(b: ReportBatch): string {
  const qty = `${b.numberOfTrolleys} ${b.numberOfTrolleys === 1 ? "Trolley" : "Trolleys"}`;
  return `${b.productName}\nBatch ${b.batchNumber}\n${qty} ${STAGE_LABEL[b.currentStage]}`;
}

/** Pure text-block report, matching the module spec's example format exactly. Kept separate from any delivery channel (live tab today, WhatsApp/etc. later). */
export function generateMorningReportText(bays: ReportBay[], misc: ReportMiscItem[]): string {
  const lines: string[] = ["DRYING ROOM STATUS"];

  for (const bay of bays) {
    lines.push(`Bay ${bay.bayNumber}`);
    if (bay.batches.length === 0) {
      lines.push(bay.purpose === "EMPTY" ? "Empty" : PURPOSE_LABEL[bay.purpose]);
    } else {
      for (const b of bay.batches) lines.push(batchLine(b));
    }
  }

  if (misc.length > 0) {
    lines.push("Miscellaneous");
    for (const m of misc) {
      lines.push(`${m.product}\n${m.quantityLabel}${m.status ? ` ${m.status}` : ""}`);
    }
  }

  return lines.join("\n");
}
