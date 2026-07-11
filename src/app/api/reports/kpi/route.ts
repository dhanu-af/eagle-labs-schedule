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

  const [kpis, tasks, dailyTargets] = await Promise.all([
    prisma.kpi.findMany({ include: { team: true } }),
    prisma.dailyTask.findMany({
      where: { date: { gte: start, lt: end } },
    }),
    prisma.kpiDailyTarget.findMany({
      where: { date: { gte: start, lt: end } },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("KPI Records");
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Team", key: "team", width: 16 },
    { header: "KPI", key: "kpi", width: 22 },
    { header: "Target", key: "target", width: 10 },
    { header: "Actual", key: "actual", width: 10 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "% of target", key: "pct", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  const dateKeys = new Set(tasks.map((t) => t.date.toDateString()));

  for (const dateKey of dateKeys) {
    const date = tasks.find((t) => t.date.toDateString() === dateKey)!.date;
    for (const kpi of kpis) {
      const actual = tasks
        .filter(
          (t) =>
            t.teamId === kpi.teamId &&
            (kpi.product ? t.product === kpi.product : true) &&
            t.date.toDateString() === dateKey
        )
        .reduce((s, t) => s + t.actualQty, 0);
      if (actual === 0) continue;

      const override = dailyTargets.find(
        (dt) => dt.kpiId === kpi.id && dt.date.toDateString() === dateKey
      );
      const target = override ? override.target : kpi.target;

      sheet.addRow({
        date: date.toISOString().slice(0, 10),
        team: kpi.team.name,
        kpi: kpi.name,
        target,
        actual,
        unit: kpi.unit,
        pct: target ? Math.round((actual / target) * 100) : 0,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kpi-${searchParams.get("start")}_to_${searchParams.get("end")}.xlsx"`,
    },
  });
}
