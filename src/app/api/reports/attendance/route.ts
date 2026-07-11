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

  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: start, lt: end } },
    include: { employee: { include: { team: true } } },
    orderBy: [{ date: "asc" }, { employeeId: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Employee", key: "employee", width: 20 },
    { header: "Team", key: "team", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Hours Worked", key: "hours", width: 14 },
    { header: "Overtime", key: "overtime", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const a of attendance) {
    sheet.addRow({
      date: a.date.toISOString().slice(0, 10),
      employee: a.employee.name,
      team: a.employee.team.name,
      status: a.status,
      hours: a.hoursWorked,
      overtime: a.overtime,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${searchParams.get("start")}_to_${searchParams.get("end")}.xlsx"`,
    },
  });
}
