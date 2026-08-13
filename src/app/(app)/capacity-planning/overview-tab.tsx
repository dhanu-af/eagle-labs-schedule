"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CapacityOverviewRow } from "@/lib/actions/capacity-planning-actions";

function cellTone(overload: boolean, utilizationPct: number | null): "danger" | "warning" | "success" | "muted" {
  if (overload) return "danger";
  if (utilizationPct === null) return "muted";
  if (utilizationPct >= 90) return "warning";
  return "success";
}

export default function OverviewTab({ overview }: { overview: { dateKeys: string[]; rows: CapacityOverviewRow[] } }) {
  const [selected, setSelected] = useState<{ machineId: string; dateKey: string } | null>(null);

  if (overview.rows.length === 0) {
    return <EmptyState title="No machines yet" description="Add a machine on the Machines tab to start seeing utilisation here." />;
  }

  const selectedCell = selected ? overview.rows.find((r) => r.machineId === selected.machineId)?.cells[selected.dateKey] : null;
  const selectedRow = selected ? overview.rows.find((r) => r.machineId === selected.machineId) : null;

  return (
    <div className="space-y-3">
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40 text-left text-muted-foreground">
                <th className="sticky left-0 bg-surface-muted/40 px-3 py-2 font-medium">Machine</th>
                {overview.dateKeys.map((d) => (
                  <th key={d} className="px-2 py-2 text-center font-medium">
                    {new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.rows.map((row) => (
                <tr key={row.machineId} className="border-b border-border last:border-0">
                  <td className="sticky left-0 bg-surface px-3 py-2 font-medium text-foreground">
                    {row.name}
                    {row.workCenter && <span className="ml-1 text-muted-foreground">({row.workCenter})</span>}
                  </td>
                  {overview.dateKeys.map((d) => {
                    const cell = row.cells[d];
                    const isSelected = selected?.machineId === row.machineId && selected?.dateKey === d;
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <button
                          onClick={() => setSelected(isSelected ? null : { machineId: row.machineId, dateKey: d })}
                          className={`w-full rounded px-1.5 py-1 ${isSelected ? "ring-2 ring-primary" : ""}`}
                        >
                          <Badge tone={cellTone(cell.overload, cell.utilizationPct)} className="w-full justify-center">
                            {cell.utilizationPct === null ? "—" : `${cell.utilizationPct}%`}
                          </Badge>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && selectedCell && selectedRow && (
        <Card padding="sm">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {selectedRow.name} — {new Date(selected.dateKey).toLocaleDateString()}
          </p>
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Available</p>
              <p className="font-medium text-foreground">{selectedCell.availableHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scheduled</p>
              <p className="font-medium text-foreground">{selectedCell.scheduledHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className={`font-medium ${selectedCell.overload ? "text-danger" : "text-foreground"}`}>{selectedCell.remainingHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{selectedCell.overload ? <span className="text-danger">Overload</span> : "OK"}</p>
            </div>
          </div>
          {selectedCell.batches.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing scheduled on this machine this day.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {selectedCell.batches.map((b) => (
                <li key={b.id} className="flex justify-between">
                  <span className="text-foreground">
                    {b.batchNumber} — {b.productName}
                  </span>
                  <span className="text-muted-foreground">{b.estimatedHours}h</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
