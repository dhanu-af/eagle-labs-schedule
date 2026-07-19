"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_CLASS } from "@/lib/warehouse-defaults";
import { deleteMaterialRequest } from "@/lib/actions/warehouse-requests-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import NewRequestModal from "./new-request-modal";
import RequestDetailModal from "./request-detail-modal";
import type { MaterialRequestRow, WarehouseItemRow, WarehouseLocationRow } from "./warehouse-client";

const VIEWS = [
  { key: "all", label: "All Requests" },
  { key: "issue-log", label: "Material Issue Log" },
  { key: "return-log", label: "Material Returns Log" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

export default function ProductionRequestsTab({
  requests,
  items,
  locations,
  canManage,
  canRequest,
}: {
  requests: MaterialRequestRow[];
  items: WarehouseItemRow[];
  locations: WarehouseLocationRow[];
  canManage: boolean;
  canRequest: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ViewKey>("all");
  const [showNew, setShowNew] = useState(false);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const openRequest = requests.find((r) => r.id === openRequestId) ?? null;

  function remove(r: MaterialRequestRow) {
    if (!confirm(`Delete request ${r.requestNumber}? This cannot be undone.`)) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteMaterialRequest(r.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete.");
      }
    });
  }

  const issueLogRows = requests.flatMap((r) =>
    r.lines
      .filter((l) => l.receivedAt)
      .map((l) => ({ request: r, line: l }))
  );
  const returnLogRows = requests.flatMap((r) =>
    r.lines
      .filter((l) => l.returnVerifiedAt)
      .map((l) => ({ request: r, line: l }))
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {canRequest && view === "all" && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            + New Request
          </Button>
        )}
      </div>

      {view === "all" &&
        (requests.length === 0 ? (
          <EmptyState title="No material requests yet" description="Create a request to pull materials from the warehouse." />
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Request #</Th>
                  <Th>Batch</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Required Date</Th>
                  <Th>Requested By</Th>
                  {canManage && <Th></Th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted/40"
                    onClick={() => setOpenRequestId(r.id)}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{r.requestNumber}</td>
                    <td className="px-3 py-2">{r.batchReference}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.priority === "CRITICAL" ? "danger" : r.priority === "HIGH" ? "warning" : "muted"}>
                        {r.priority}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${REQUEST_STATUS_CLASS[r.status]}`}>
                        {REQUEST_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.requiredDate ? new Date(r.requiredDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.requestedByName}</td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        {r.status === "REQUESTED" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(r);
                            }}
                            disabled={pending}
                            className="text-xs font-medium text-danger hover:opacity-80"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      {error && <p className="text-xs text-danger">{error}</p>}

      {view === "issue-log" &&
        (issueLogRows.length === 0 ? (
          <EmptyState title="No issued materials yet" description="Materials appear here once production confirms receipt." />
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Batch</Th>
                  <Th>Item</Th>
                  <Th>Lot</Th>
                  <Th>Issued Qty</Th>
                  <Th>Issued By</Th>
                  <Th>Issued At</Th>
                </tr>
              </thead>
              <tbody>
                {issueLogRows.map(({ request, line }) => (
                  <tr key={line.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{request.batchReference}</td>
                    <td className="px-3 py-2">{line.itemName ?? line.ingredientNameFreeText}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.releaseLotNumber ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {line.receivedQty} {line.unit}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{line.receivedByName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {line.receivedAt ? new Date(line.receivedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

      {view === "return-log" &&
        (returnLogRows.length === 0 ? (
          <EmptyState title="No verified returns yet" description="Returns appear here once the warehouse confirms them." />
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Batch</Th>
                  <Th>Item</Th>
                  <Th>Returned Qty</Th>
                  <Th>Verified By</Th>
                  <Th>Verified At</Th>
                </tr>
              </thead>
              <tbody>
                {returnLogRows.map(({ request, line }) => (
                  <tr key={line.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{request.batchReference}</td>
                    <td className="px-3 py-2">{line.itemName ?? line.ingredientNameFreeText}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {line.returnQty} {line.unit}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{line.returnVerifiedByName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {line.returnVerifiedAt ? new Date(line.returnVerifiedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

      {showNew && <NewRequestModal items={items} onClose={() => setShowNew(false)} />}
      {openRequest && (
        <RequestDetailModal
          request={openRequest}
          locations={locations}
          items={items}
          canManage={canManage}
          canRequest={canRequest}
          onClose={() => setOpenRequestId(null)}
        />
      )}
    </div>
  );
}
