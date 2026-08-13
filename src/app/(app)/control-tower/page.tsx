import Link from "next/link";
import { getControlTowerSnapshot } from "@/lib/actions/control-tower-actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "warning" | "success" }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}

const SEVERITY_TONE = { overdue: "danger", qaHeld: "danger", atRisk: "warning" } as const;
const SEVERITY_LABEL = { overdue: "Overdue", qaHeld: "QA Hold", atRisk: "At Risk" } as const;

export default async function ControlTowerPage() {
  const s = await getControlTowerSnapshot();

  return (
    <div className="space-y-4">
      <PageHeader title="Operations Control Tower" subtitle="Customer promise first, material reality second, capacity reality third." />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s Customer Commitment</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Due Today" value={s.ordersDueToday} />
          <StatCard label="Due This Week" value={s.ordersDueThisWeek} />
          <StatCard label="Overdue" value={s.overdueCount} tone={s.overdueCount > 0 ? "danger" : undefined} />
          <StatCard label="At Risk" value={s.atRiskCount} tone={s.atRiskCount > 0 ? "warning" : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capacity (Today)</p>
          <Card padding="sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-lg font-semibold text-foreground">{s.capacity.availableHours}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="text-lg font-semibold text-foreground">{s.capacity.scheduledHours}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilisation</p>
                <p className="text-lg font-semibold text-foreground">{s.capacity.utilizationPct === null ? "—" : `${s.capacity.utilizationPct}%`}</p>
              </div>
            </div>
            {s.capacity.overloadedMachines > 0 && <p className="mt-2 text-center text-xs text-danger">{s.capacity.overloadedMachines} machine(s) overloaded today</p>}
          </Card>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials</p>
          <Card padding="sm">
            <p className="text-xs text-muted-foreground">Orders affected by a shortage</p>
            <p className={`text-lg font-semibold ${s.ordersAffectedByShortage > 0 ? "text-danger" : "text-foreground"}`}>{s.ordersAffectedByShortage}</p>
            <Link href="/procurement" className="mt-1 inline-block text-xs text-primary hover:underline">
              Check Procurement →
            </Link>
          </Card>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quality</p>
          <Card padding="sm">
            <p className="text-xs text-muted-foreground">Orders on QA hold</p>
            <p className={`text-lg font-semibold ${s.qaHeldCount > 0 ? "text-danger" : "text-foreground"}`}>{s.qaHeldCount}</p>
          </Card>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Risks</p>
        <Card padding="sm">
          {s.topRisks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active order is currently overdue, at risk, or on QA hold.</p>
          ) : (
            <ul className="divide-y divide-border">
              {s.topRisks.map((r) => (
                <li key={r.orderId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <Link href={`/customer-orders/${r.orderId}`} className="text-sm font-medium text-foreground hover:underline">
                      {r.orderNumber} — {r.customerName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{r.reasons.join("; ")}</p>
                  </div>
                  <Badge tone={SEVERITY_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s Production</p>
        {s.todaysProduction.length === 0 ? (
          <EmptyState title="Nothing scheduled today" description="No Batch Records are scheduled on a machine for today." />
        ) : (
          <Card padding="sm">
            <ul className="divide-y divide-border text-sm">
              {s.todaysProduction.map((p, i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-foreground">
                    {p.batchNumber} — {p.productName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.machineName} · {p.estimatedHours}h
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
