"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { capsulesFromKg, computeYieldPct } from "@/lib/mfg-reconciliation-defaults";
import type { MfgBatchRow } from "./mfg-reconciliation-client";

/** Flag a stage's yield when it drops below this -- a simple starting heuristic, tune once there's real usage data. */
const LOW_YIELD_WARNING_PCT = 95;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card interactive padding="sm">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

type Alert = { text: string; batchId: string };

export default function DashboardTab({ batches }: { batches: MfgBatchRow[] }) {
  const inProgress = batches.filter((b) => b.status === "IN_PROGRESS").length;
  const completed = batches.filter((b) => b.status === "COMPLETED").length;
  const qaReleased = batches.filter((b) => b.qaReleased).length;

  const alerts: Alert[] = [];
  for (const b of batches) {
    const blendYield = b.blending ? computeYieldPct(b.blending.totalBlendProducedKg, b.blending.totalTheoreticalWeightKg) : null;
    if (blendYield !== null && blendYield < LOW_YIELD_WARNING_PCT) {
      alerts.push({ text: `${b.batchNumber} — Blend Yield ${blendYield.toFixed(1)}%`, batchId: b.id });
    }
    const theoreticalCapsules = b.encapsulation ? capsulesFromKg(b.encapsulation.issuedBulkBlendKg, b.encapsulation.targetCapsuleFillWeightMg) : null;
    const capsulesProduced = b.encapsulation ? capsulesFromKg(b.encapsulation.capsulesProducedKg, b.encapsulation.avgCapsuleFullWeightMg) : null;
    const capsuleYield = computeYieldPct(capsulesProduced, theoreticalCapsules);
    if (capsuleYield !== null && capsuleYield < LOW_YIELD_WARNING_PCT) {
      alerts.push({ text: `${b.batchNumber} — Capsule Process Yield ${capsuleYield.toFixed(1)}%`, batchId: b.id });
    }
    const theoreticalCapsulesForBottling = b.bottling ? capsulesFromKg(b.bottling.capsuleReceivedKg, b.bottling.avgCapsuleFullWeightMg) : null;
    const theoreticalBottles =
      theoreticalCapsulesForBottling !== null && b.bottling?.targetCapsulesPerBottle ? theoreticalCapsulesForBottling / b.bottling.targetCapsulesPerBottle : null;
    const bottlingYield = computeYieldPct(b.bottling?.bottlesProduced, theoreticalBottles);
    if (bottlingYield !== null && bottlingYield < LOW_YIELD_WARNING_PCT) {
      alerts.push({ text: `${b.batchNumber} — Bottling Process Yield ${bottlingYield.toFixed(1)}%`, batchId: b.id });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Live Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Batches In Progress" value={inProgress} />
          <StatCard label="Completed" value={completed} />
          <StatCard label="QA Released" value={qaReleased} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Yield Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No alerts right now.</p>
        ) : (
          <Card padding="sm">
            <ul className="divide-y divide-border text-sm">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-foreground">{a.text}</span>
                  <Link href={`/mfg-reconciliation/${a.batchId}`} className="text-xs font-medium text-primary hover:opacity-80">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
