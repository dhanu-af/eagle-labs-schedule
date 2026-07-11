import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession, canManageRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !canManageRole(session.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const start = new Date(`${searchParams.get("start") ?? ""}T00:00:00`);
  const endParam = searchParams.get("end") ?? "";
  const end = new Date(`${endParam}T00:00:00`);
  end.setDate(end.getDate() + 1);

  const tasks = await prisma.dailyTask.findMany({
    where: { date: { gte: start, lt: end } },
    include: { team: true, employee: true },
    orderBy: [{ date: "asc" }, { teamId: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Production");
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Team", key: "team", width: 16 },
    { header: "Product", key: "product", width: 18 },
    { header: "Batch No", key: "batchNo", width: 12 },
    { header: "Process", key: "process", width: 16 },
    { header: "Operator", key: "operator", width: 18 },
    { header: "Target", key: "target", width: 10 },
    { header: "Actual", key: "actual", width: 10 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Priority", key: "priority", width: 10 },
    { header: "Status", key: "status", width: 14 },
    { header: "Delay Reason", key: "delayReason", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const t of tasks) {
    sheet.addRow({
      date: t.date.toISOString().slice(0, 10),
      team: t.team.name,
      product: t.product,
      batchNo: t.batchNo ?? "",
      process: t.process,
      operator: t.employee?.name ?? "Unassigned",
      target: t.targetQty ?? "",
      actual: t.actualQty,
      unit: t.targetUnit,
      priority: t.priority,
      status: t.status,
      delayReason: t.delayReason ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="daily-production-${searchParams.get("start")}_to_${searchParams.get("end")}.xlsx"`,
    },
  });
}
