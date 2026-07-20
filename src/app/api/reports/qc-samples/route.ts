import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SAMPLE_STATUS_LABEL, SAMPLE_TYPE_LABEL, IN_LAB_STATUSES } from "@/lib/qc-sample-defaults";

const SAMPLE_COLUMNS = [
  { header: "Sample ID", key: "sampleId", width: 18 },
  { header: "Product", key: "productName", width: 20 },
  { header: "Batch", key: "batchNumber", width: 16 },
  { header: "Type", key: "sampleType", width: 16 },
  { header: "Status", key: "status", width: 16 },
  { header: "Collected By", key: "collectedByName", width: 18 },
  { header: "Collection Date", key: "collectionDate", width: 14 },
  { header: "Quantity", key: "quantity", width: 12 },
];

function baseRow(s: Awaited<ReturnType<typeof prisma.qcSample.findMany>>[number]) {
  return {
    sampleId: s.sampleId,
    productName: s.productName,
    batchNumber: s.batchNumber,
    sampleType: SAMPLE_TYPE_LABEL[s.sampleType],
    status: SAMPLE_STATUS_LABEL[s.status],
    collectedByName: s.collectedByName ?? "",
    collectionDate: s.collectionDate ? s.collectionDate.toISOString().slice(0, 10) : "",
    quantity: `${s.quantity} ${s.unit}`,
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const type = request.nextUrl.searchParams.get("type");
  const workbook = new ExcelJS.Workbook();

  if (type === "daily-collection") {
    const dateParam = request.nextUrl.searchParams.get("date");
    const day = dateParam ? new Date(dateParam) : new Date();
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(start.getTime() + 86_400_000);
    const rows = await prisma.qcSample.findMany({ where: { collectionDate: { gte: start, lt: end } }, orderBy: { collectionDate: "asc" } });
    const sheet = workbook.addWorksheet("Daily Sample Collection");
    sheet.columns = SAMPLE_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(baseRow(r)));
  } else if (type === "pending-testing") {
    const rows = await prisma.qcSample.findMany({ where: { status: { in: IN_LAB_STATUSES } }, orderBy: { receivedDate: "asc" } });
    const sheet = workbook.addWorksheet("Samples Pending Testing");
    sheet.columns = SAMPLE_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(baseRow(r)));
  } else if (type === "approved") {
    const rows = await prisma.qcSample.findMany({ where: { status: { in: ["APPROVED", "RETENTION"] } }, orderBy: { createdAt: "desc" } });
    const sheet = workbook.addWorksheet("Approved Samples");
    sheet.columns = SAMPLE_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(baseRow(r)));
  } else if (type === "failed") {
    const rows = await prisma.qcSample.findMany({ where: { status: "REJECTED" }, orderBy: { createdAt: "desc" } });
    const sheet = workbook.addWorksheet("Failed Samples");
    sheet.columns = [...SAMPLE_COLUMNS, { header: "Remarks", key: "remarks", width: 30 }];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow({ ...baseRow(r), remarks: r.remarks ?? "" }));
  } else if (type === "retention-inventory") {
    const rows = await prisma.qcSample.findMany({ where: { status: "RETENTION" }, include: { retentionRecord: true }, orderBy: { createdAt: "desc" } });
    const sheet = workbook.addWorksheet("Retention Inventory");
    sheet.columns = [...SAMPLE_COLUMNS, { header: "Shelf", key: "shelf", width: 10 }, { header: "Cabinet", key: "cabinet", width: 10 }, { header: "Box", key: "boxNumber", width: 10 }, { header: "Qty Remaining", key: "quantityRemaining", width: 14 }, { header: "Expiry", key: "expiry", width: 14 }];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow({
      ...baseRow(r),
      shelf: r.retentionRecord?.shelf ?? "",
      cabinet: r.retentionRecord?.cabinet ?? "",
      boxNumber: r.retentionRecord?.boxNumber ?? "",
      quantityRemaining: r.retentionRecord?.quantityRemaining ?? "",
      expiry: r.retentionRecord?.expiryDate ? r.retentionRecord.expiryDate.toISOString().slice(0, 10) : "",
    }));
  } else if (type === "retention-expiry") {
    const rows = await prisma.qcSample.findMany({ where: { retentionRecord: { isNot: null } }, include: { retentionRecord: true }, orderBy: { retentionRecord: { expiryDate: "asc" } } });
    const sheet = workbook.addWorksheet("Retention Expiry Report");
    sheet.columns = [...SAMPLE_COLUMNS, { header: "Expiry", key: "expiry", width: 14 }, { header: "Destroy Date", key: "destroyDate", width: 14 }];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow({
      ...baseRow(r),
      expiry: r.retentionRecord?.expiryDate ? r.retentionRecord.expiryDate.toISOString().slice(0, 10) : "",
      destroyDate: r.retentionRecord?.destroyDate ? r.retentionRecord.destroyDate.toISOString().slice(0, 10) : "",
    }));
  } else if (type === "coa") {
    const rows = await prisma.qcSample.findMany({
      where: { labTest: { isNot: null } },
      include: { labTest: { include: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    const sheet = workbook.addWorksheet("COA Report");
    sheet.columns = [...SAMPLE_COLUMNS, { header: "COA Upload", key: "coaReference", width: 30 }, { header: "Tested By", key: "testedByName", width: 18 }];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => {
      const coaItem = r.labTest?.items.find((it) => it.parameter === "COA Upload");
      sheet.addRow({ ...baseRow(r), coaReference: coaItem?.details ?? (coaItem?.result ?? ""), testedByName: r.labTest?.testedByName ?? "" });
    });
  } else if (type === "history-by-batch") {
    const rows = await prisma.qcSample.findMany({ orderBy: [{ batchNumber: "asc" }, { createdAt: "asc" }] });
    const sheet = workbook.addWorksheet("Sample History by Batch");
    sheet.columns = SAMPLE_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(baseRow(r)));
  } else if (type === "qc-performance") {
    const rows = await prisma.qcSample.findMany({ where: { labTest: { isNot: null } }, include: { labTest: true }, orderBy: { createdAt: "desc" } });
    const sheet = workbook.addWorksheet("QC Performance (Turnaround)");
    sheet.columns = [...SAMPLE_COLUMNS, { header: "Received At Lab", key: "receivedDate", width: 14 }, { header: "Tested At", key: "testedAt", width: 20 }, { header: "Turnaround (days)", key: "turnaround", width: 16 }];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => {
      const turnaround = r.receivedDate && r.labTest?.testedAt
        ? Math.round((r.labTest.testedAt.getTime() - r.receivedDate.getTime()) / 86_400_000)
        : "";
      sheet.addRow({
        ...baseRow(r),
        receivedDate: r.receivedDate ? r.receivedDate.toISOString().slice(0, 10) : "",
        testedAt: r.labTest?.testedAt ? r.labTest.testedAt.toLocaleString("en-AU") : "",
        turnaround,
      });
    });
  } else if (type === "monthly-summary") {
    const rows = await prisma.qcSample.findMany({ orderBy: { createdAt: "asc" } });
    const sheet = workbook.addWorksheet("Monthly Sample Summary");
    sheet.columns = [
      { header: "Month", key: "month", width: 12 },
      { header: "Status", key: "status", width: 16 },
      { header: "Count", key: "count", width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    const counts = new Map<string, number>();
    for (const r of rows) {
      const month = r.createdAt.toISOString().slice(0, 7);
      const key = `${month}|${SAMPLE_STATUS_LABEL[r.status]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of [...counts.entries()].sort()) {
      const [month, status] = key.split("|");
      sheet.addRow({ month, status, count });
    }
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="qc-samples-${type}.xlsx"`,
    },
  });
}
