import { SAMPLE_STATUS_LABEL } from "@/lib/qc-sample-defaults";
import type { QcSampleStatus } from "@/generated/prisma";

type ReportSample = {
  createdAt: string | Date;
  status: QcSampleStatus;
};

/** Text-block report using WhatsApp's markdown (*bold*, bullets) so the message renders cleanly
 * there; the same text is also shown as-is on the QC Samples Reports tab. Mirrors the counts
 * behind the "Monthly Sample Summary" Excel export (month + status breakdown). */
export function generateQcSummaryReportText(samples: ReportSample[]): string {
  const lines: string[] = ["*QC Sample Summary Report*", ""];

  const byMonth = new Map<string, Map<QcSampleStatus, number>>();
  for (const s of samples) {
    const createdAt = typeof s.createdAt === "string" ? new Date(s.createdAt) : s.createdAt;
    const month = createdAt.toISOString().slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const statusCounts = byMonth.get(month)!;
    statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
  }

  const months = [...byMonth.keys()].sort();
  if (months.length === 0) {
    lines.push("No samples recorded yet.");
  } else {
    for (const month of months) {
      lines.push(`*${month}*`);
      const statusCounts = byMonth.get(month)!;
      for (const [status, count] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`• ${SAMPLE_STATUS_LABEL[status]}: ${count}`);
      }
      lines.push("");
    }
  }

  lines.push(`*Total samples: ${samples.length}*`);

  return lines.join("\n").trim();
}
