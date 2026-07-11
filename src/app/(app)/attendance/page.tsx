import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { toDateInputValue, toDateInputValueUTC, todayInBrisbane } from "@/lib/ui";
import AttendanceClient from "./attendance-client";

function parseDate(input?: string) {
  if (input) {
    const d = new Date(`${input}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return todayInBrisbane();
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const session = await getSession();
  const date = parseDate(dateParam);
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const [employees, attendance, leaveRequests] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      include: { team: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({ where: { date: { gte: date, lt: nextDay } } }),
    prisma.leaveRequest.findMany({
      include: { employee: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const attendanceByEmployee = new Map(attendance.map((a) => [a.employeeId, a]));

  return (
    <AttendanceClient
      dateStr={toDateInputValueUTC(date)}
      employees={employees.map((e) => {
        const a = attendanceByEmployee.get(e.id);
        return {
          id: e.id,
          name: e.name,
          teamName: e.team.name,
          leaveBalance: e.leaveBalance,
          status: a?.status ?? "PRESENT",
          hoursWorked: a?.hoursWorked ?? 8,
          overtime: a?.overtime ?? 0,
        };
      })}
      leaveRequests={leaveRequests.map((l) => ({
        id: l.id,
        employeeName: l.employee.name,
        startDate: toDateInputValue(l.startDate),
        endDate: toDateInputValue(l.endDate),
        type: l.type,
        reason: l.reason,
        status: l.status,
      }))}
      canManage={!!session && canEdit(session.role)}
      currentEmployeeId={session?.employeeId ?? null}
    />
  );
}
