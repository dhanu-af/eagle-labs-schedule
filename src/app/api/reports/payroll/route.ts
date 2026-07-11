import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession, isAdminRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const payRunId = searchParams.get("payRunId");
  if (!payRunId) {
    return NextResponse.json({ error: "payRunId is required" }, { status: 400 });
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: { payslips: { include: { employee: true } } },
  });
  if (!payRun) {
    return NextResponse.json({ error: "Pay run not found" }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payslips");
  sheet.columns = [
    { header: "Employee", key: "employee", width: 22 },
    { header: "Regular Hours", key: "regular", width: 14 },
    { header: "Overtime Hours", key: "overtime", width: 14 },
    { header: "Rate/hr", key: "rate", width: 10 },
    { header: "Gross Pay", key: "gross", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const p of payRun.payslips) {
    sheet.addRow({
      employee: p.employee.name,
      regular: p.regularHours,
      overtime: p.overtimeHours,
      rate: p.hourlyRate,
      gross: p.grossPay,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payroll-${payRun.periodStart.toISOString().slice(0, 10)}_to_${payRun.periodEnd.toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
