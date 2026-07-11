import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { parseUserAgent } from "@/lib/user-agent";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const user = searchParams.get("user");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [{ username: { contains: q } }, { fullName: { contains: q } }];
  }
  if (user) where.username = user;
  if (start || end) {
    const range: Record<string, Date> = {};
    if (start) range.gte = new Date(`${start}T00:00:00`);
    if (end) {
      const endDate = new Date(`${end}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      range.lt = endDate;
    }
    where.loginAt = range;
  }

  const events = await prisma.loginEvent.findMany({ where, orderBy: { loginAt: "desc" } });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Login History");
  sheet.columns = [
    { header: "User ID", key: "username", width: 14 },
    { header: "Name", key: "fullName", width: 20 },
    { header: "Role", key: "role", width: 14 },
    { header: "Login Date", key: "loginDate", width: 14 },
    { header: "Login Time", key: "loginTime", width: 12 },
    { header: "Logout Time", key: "logoutTime", width: 12 },
    { header: "Duration (s)", key: "duration", width: 12 },
    { header: "Status", key: "status", width: 10 },
    { header: "IP Address", key: "ip", width: 16 },
    { header: "Device", key: "device", width: 10 },
    { header: "Browser", key: "browser", width: 10 },
    { header: "OS", key: "os", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const e of events) {
    const { browser, os, device } = parseUserAgent(e.userAgent);
    const durationSeconds =
      e.logoutAt && e.loginAt ? Math.round((e.logoutAt.getTime() - e.loginAt.getTime()) / 1000) : "";

    sheet.addRow({
      username: e.username,
      fullName: e.fullName ?? "",
      role: e.role ?? "",
      loginDate: e.loginAt.toISOString().slice(0, 10),
      loginTime: e.loginAt.toLocaleTimeString("en-AU"),
      logoutTime: e.logoutAt ? e.logoutAt.toLocaleTimeString("en-AU") : "",
      duration: durationSeconds,
      status: e.status,
      ip: e.ipAddress ?? "",
      device,
      browser,
      os,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="login-history.xlsx"`,
    },
  });
}
