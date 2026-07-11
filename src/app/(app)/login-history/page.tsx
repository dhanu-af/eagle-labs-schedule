import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { parseUserAgent } from "@/lib/user-agent";
import LoginHistoryClient from "./login-history-client";

const PAGE_SIZE = 25;

export default async function LoginHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; start?: string; end?: string; user?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) redirect("/");

  const { q, start, end, user, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { username: { contains: q } },
      { fullName: { contains: q } },
    ];
  }
  if (user) {
    where.username = user;
  }
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

  const [events, total, distinctUsers] = await Promise.all([
    prisma.loginEvent.findMany({
      where,
      orderBy: { loginAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.loginEvent.count({ where }),
    prisma.user.findMany({ select: { username: true, fullName: true }, orderBy: { username: "asc" } }),
  ]);

  return (
    <LoginHistoryClient
      events={events.map((e) => {
        const { browser, os, device } = parseUserAgent(e.userAgent);
        const durationSeconds =
          e.logoutAt && e.loginAt ? Math.round((e.logoutAt.getTime() - e.loginAt.getTime()) / 1000) : null;
        return {
          id: e.id,
          username: e.username,
          fullName: e.fullName,
          role: e.role,
          loginAt: e.loginAt.toISOString(),
          logoutAt: e.logoutAt ? e.logoutAt.toISOString() : null,
          durationSeconds,
          status: e.status,
          ipAddress: e.ipAddress,
          browser,
          os,
          device,
        };
      })}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      users={distinctUsers}
      filters={{ q: q ?? "", start: start ?? "", end: end ?? "", user: user ?? "" }}
    />
  );
}
