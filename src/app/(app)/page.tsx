import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import PostAnnouncementCard from "@/components/post-announcement-card";
import ProgressRing from "@/components/progress-ring";
import BrisbaneClock from "@/components/brisbane-clock";
import {
  STATUS_CLASS,
  STATUS_LABEL,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  formatBrisbaneDate,
  formatBrisbaneDateTime,
  todayInBrisbane,
  pct,
  initials,
} from "@/lib/ui";

const STAT_ICONS = {
  tasks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  running: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  completed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  delayed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  ),
};

export default async function DashboardPage() {
  const session = await getSession();
  const today = todayInBrisbane();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [tasks, teams, kpis, todaysKpiTargets, pendingLeaves, latestAnnouncements] =
    await Promise.all([
      prisma.dailyTask.findMany({
        where: { date: { gte: today, lt: tomorrow } },
        include: { team: true, employee: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.team.findMany({ orderBy: { name: "asc" } }),
      prisma.kpi.findMany({ include: { team: true } }),
      prisma.kpiDailyTarget.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 2 }),
    ]);

  const statusCounts = {
    NOT_STARTED: tasks.filter((t) => t.status === "NOT_STARTED").length,
    RUNNING: tasks.filter((t) => t.status === "RUNNING").length,
    COMPLETED: tasks.filter((t) => t.status === "COMPLETED").length,
    DELAYED: tasks.filter((t) => t.status === "DELAYED").length,
  };
  const completionPct = tasks.length
    ? Math.round((statusCounts.COMPLETED / tasks.length) * 100)
    : 0;

  return (
    <div className="animate-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {session?.fullName.split(" ")[0]}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{formatBrisbaneDate(today)}</span>
            <span className="text-border">·</span>
            <BrisbaneClock />
          </div>
        </div>
        {(statusCounts.DELAYED > 0 || pendingLeaves > 0) && (
          <div className="flex gap-2">
            {statusCounts.DELAYED > 0 && (
              <span className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-medium text-danger">
                {statusCounts.DELAYED} task{statusCounts.DELAYED > 1 ? "s" : ""} delayed
              </span>
            )}
            {pendingLeaves > 0 && (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                {pendingLeaves} leave request{pendingLeaves > 1 ? "s" : ""} pending
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Today's Tasks" value={tasks.length} icon={STAT_ICONS.tasks} tint="var(--info)" />
        <StatCard label="Running" value={statusCounts.RUNNING} icon={STAT_ICONS.running} tint="var(--info)" />
        <StatCard label="Completed" value={statusCounts.COMPLETED} icon={STAT_ICONS.completed} tint="var(--success)" />
        <StatCard label="Delayed" value={statusCounts.DELAYED} icon={STAT_ICONS.delayed} tint="var(--danger)" />
        <div className="card-shadow flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5">
          <ProgressRing percent={completionPct} size={56} stroke={6} />
          <div>
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-sm font-medium text-foreground">today&apos;s progress</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-shadow lg:col-span-2 rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Today&apos;s Production — Blending &amp; Encapsulation
          </h2>
          <div className="space-y-4">
            {teams.map((team) => {
              const teamTasks = tasks.filter((t) => t.teamId === team.id);
              if (teamTasks.length === 0) {
                return (
                  <div key={team.id} className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                    {team.name}: no tasks scheduled today
                  </div>
                );
              }
              return (
                <div key={team.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {team.name}
                  </p>
                  <div className="space-y-1.5">
                    {teamTasks.map((t) => (
                      <div
                        key={t.id}
                        className="group flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition hover:bg-surface-muted"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
                            {t.employee ? initials(t.employee.name) : "—"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">
                              {t.product} · {t.process}
                              {t.batchNo ? ` · Batch ${t.batchNo}` : ""}
                            </p>
                            <p className="flex items-center gap-1.5 text-xs">
                              {t.employee ? (
                                <span className="font-medium text-foreground">{t.employee.name}</span>
                              ) : (
                                <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                  Unassigned
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {t.targetQty ? `· ${t.actualQty}/${t.targetQty} ${t.targetUnit}` : ""}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[t.priority]}`}>
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[t.status]}`}>
                            {STATUS_LABEL[t.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">KPI — Target vs Actual (Today)</h2>
            <div className="flex flex-wrap justify-around gap-4">
              {kpis.map((k) => {
                const actual = tasks
                  .filter((t) => t.teamId === k.teamId && (k.product ? t.product === k.product : true))
                  .reduce((s, t) => s + t.actualQty, 0);
                const todayOverride = todaysKpiTargets.find((dt) => dt.kpiId === k.id);
                const target = todayOverride ? todayOverride.target : k.target;
                const p = pct(actual, target);
                return (
                  <div key={k.id} className="flex flex-col items-center gap-2 text-center">
                    <ProgressRing
                      percent={p}
                      size={78}
                      stroke={7}
                      color={p >= 100 ? "var(--success)" : p >= 50 ? "var(--primary)" : "var(--warning)"}
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {k.team.name}
                        {k.product ? ` · ${k.product}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {actual}/{target} {k.unit}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span aria-hidden>📣</span> Latest Announcements
            </h2>
            {latestAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {latestAnnouncements.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border bg-surface-muted/40 p-3">
                    <p className="whitespace-pre-line text-sm text-foreground">{a.message}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {formatBrisbaneDateTime(a.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!!session && <PostAnnouncementCard />}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="card-shadow group rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5">
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          color: tint,
          background: `color-mix(in srgb, ${tint} 14%, transparent)`,
        }}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
