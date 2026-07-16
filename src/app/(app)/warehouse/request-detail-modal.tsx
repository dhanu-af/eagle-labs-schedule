"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReceiptOutcome } from "@/generated/prisma";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_CLASS, RECEIPT_OUTCOME_LABEL } from "@/lib/warehouse-defaults";
import {
  releaseRequestToProduction,
  recordLineReceiptCheck,
  confirmMaterialsReceived,
  updateLineUsage,
  sendReturnToWarehouse,
  confirmReturn,
} from "@/lib/actions/warehouse-requests-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MaterialRequestRow, WarehouseLocationRow } from "./warehouse-client";

const RELEASE_STATUSES = new Set(["REQUESTED", "WAREHOUSE_PREPARING"]);
const RECEIVE_STATUSES = new Set(["RELEASED", "WAITING_PRODUCTION_CONFIRMATION", "PARTIALLY_RECEIVED"]);
const USAGE_STATUSES = new Set(["RECEIVED", "IN_PRODUCTION"]);
const VERIFY_STATUSES = new Set(["RETURN_PENDING", "WAREHOUSE_VERIFYING"]);

function lineLabel(l: MaterialRequestRow["lines"][number]) {
  return l.itemName ?? l.ingredientNameFreeText ?? "Ingredient";
}

function ReleaseStep({ request, locations, onClose }: { request: MaterialRequestRow; locations: WarehouseLocationRow[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [rows, setRows] = useState(
    Object.fromEntries(
      request.lines.map((l) => [
        l.id,
        { releasedQty: String(l.requestedQty), releaseLotNumber: "", releaseExpiry: "", releaseLocationId: "", releaseComments: "" },
      ])
    )
  );

  function update(lineId: string, patch: Partial<(typeof rows)[string]>) {
    setRows((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  function release() {
    setError("");
    if (Object.values(rows).some((r) => !r.releasedQty || !r.releaseLotNumber)) {
      setError("Every line needs a released quantity and lot number.");
      return;
    }
    startTransition(async () => {
      try {
        await releaseRequestToProduction(
          request.id,
          request.lines.map((l) => ({
            lineId: l.id,
            releasedQty: Number(rows[l.id].releasedQty),
            releaseLotNumber: rows[l.id].releaseLotNumber || null,
            releaseExpiry: rows[l.id].releaseExpiry || null,
            releaseLocationId: rows[l.id].releaseLocationId || null,
            releaseComments: rows[l.id].releaseComments || null,
          }))
        );
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't release materials.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {request.lines.map((l) => (
        <div key={l.id} className="rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            {lineLabel(l)} <span className="text-muted-foreground">— requested {l.requestedQty} {l.unit}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              className="input"
              type="number"
              placeholder="Released Qty"
              value={rows[l.id].releasedQty}
              onChange={(e) => update(l.id, { releasedQty: e.target.value })}
            />
            <input
              className="input"
              placeholder="Lot Number"
              value={rows[l.id].releaseLotNumber}
              onChange={(e) => update(l.id, { releaseLotNumber: e.target.value })}
            />
            <input
              className="input"
              type="date"
              placeholder="Expiry"
              value={rows[l.id].releaseExpiry}
              onChange={(e) => update(l.id, { releaseExpiry: e.target.value })}
            />
            <select
              className="input"
              value={rows[l.id].releaseLocationId}
              onChange={(e) => update(l.id, { releaseLocationId: e.target.value })}
            >
              <option value="">Location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={release} disabled={pending}>
          {pending ? "Releasing..." : "Release to Production"}
        </Button>
      </div>
    </div>
  );
}

function ReceiveStep({ request }: { request: MaterialRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [qty, setQty] = useState(
    Object.fromEntries(request.lines.map((l) => [l.id, String(l.releasedQty ?? l.requestedQty)]))
  );

  function check(lineId: string, outcome: ReceiptOutcome) {
    setError("");
    startTransition(async () => {
      try {
        await recordLineReceiptCheck(lineId, outcome, Number(qty[lineId] ?? 0));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't record check.");
      }
    });
  }

  function confirmAll() {
    if (!confirm("Have you verified all ingredients? This will deduct warehouse stock.")) return;
    setError("");
    startTransition(async () => {
      try {
        await confirmMaterialsReceived(request.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't confirm materials received.");
      }
    });
  }

  const allChecked = request.lines.every((l) => l.receiptOutcome);

  return (
    <div className="space-y-3">
      {request.lines.map((l) => (
        <div key={l.id} className="rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            {lineLabel(l)} <span className="text-muted-foreground">— released {l.releasedQty} {l.unit} (lot {l.releaseLotNumber})</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              type="number"
              value={qty[l.id]}
              onChange={(e) => setQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
            />
            <Button size="sm" variant="success" onClick={() => check(l.id, "ACCEPTED")} disabled={pending}>
              Accept
            </Button>
            <Button size="sm" variant="danger" onClick={() => check(l.id, "REJECTED")} disabled={pending}>
              Reject
            </Button>
            <Button size="sm" variant="secondary" onClick={() => check(l.id, "SHORTAGE")} disabled={pending}>
              Shortage
            </Button>
            <Button size="sm" variant="secondary" onClick={() => check(l.id, "DAMAGED")} disabled={pending}>
              Damaged
            </Button>
            {l.receiptOutcome && <Badge tone="info">{RECEIPT_OUTCOME_LABEL[l.receiptOutcome]}</Badge>}
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={confirmAll} disabled={pending || !allChecked}>
          {pending ? "Confirming..." : "Confirm Materials Received"}
        </Button>
      </div>
    </div>
  );
}

function UsageStep({ request }: { request: MaterialRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(
    Object.fromEntries(request.lines.map((l) => [l.id, { used: String(l.usedQty ?? ""), waste: String(l.wasteQty ?? "") }]))
  );
  const [returnQty, setReturnQty] = useState(Object.fromEntries(request.lines.map((l) => [l.id, ""])));

  function saveUsage(lineId: string) {
    startTransition(async () => {
      try {
        const u = usage[lineId];
        await updateLineUsage(lineId, u.used ? Number(u.used) : null, u.waste ? Number(u.waste) : null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save usage.");
      }
    });
  }

  function sendReturn() {
    const lines = request.lines
      .filter((l) => Number(returnQty[l.id]) > 0)
      .map((l) => ({ lineId: l.id, returnQty: Number(returnQty[l.id]) }));
    if (lines.length === 0) {
      setError("Enter a return quantity for at least one line.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await sendReturnToWarehouse(request.id, lines);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send return.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {request.lines.map((l) => {
        const remaining = (l.receivedQty ?? 0) - (usage[l.id].used ? Number(usage[l.id].used) : 0) - (usage[l.id].waste ? Number(usage[l.id].waste) : 0);
        return (
          <div key={l.id} className="rounded-lg border border-border bg-surface-muted/40 p-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              {lineLabel(l)} <span className="text-muted-foreground">— received {l.receivedQty} {l.unit} · remaining {remaining}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                type="number"
                placeholder="Used"
                value={usage[l.id].used}
                onChange={(e) => setUsage((prev) => ({ ...prev, [l.id]: { ...prev[l.id], used: e.target.value } }))}
              />
              <input
                className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                type="number"
                placeholder="Waste"
                value={usage[l.id].waste}
                onChange={(e) => setUsage((prev) => ({ ...prev, [l.id]: { ...prev[l.id], waste: e.target.value } }))}
              />
              <Button size="sm" variant="secondary" onClick={() => saveUsage(l.id)} disabled={pending}>
                Save Usage
              </Button>
              <input
                className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                type="number"
                placeholder="Return Qty"
                value={returnQty[l.id]}
                onChange={(e) => setReturnQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
              />
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={sendReturn} disabled={pending}>
          {pending ? "Sending..." : "Send Return to Warehouse"}
        </Button>
      </div>
    </div>
  );
}

function VerifyStep({ request, locations }: { request: MaterialRequestRow; locations: WarehouseLocationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const returnLines = request.lines.filter((l) => l.returnQty);
  const [notes, setNotes] = useState(Object.fromEntries(returnLines.map((l) => [l.id, { conditionNotes: "", locationId: "" }])));

  function confirm_() {
    if (!confirm("Confirm this return? This will restore warehouse stock.")) return;
    setError("");
    startTransition(async () => {
      try {
        await confirmReturn(
          request.id,
          returnLines.map((l) => ({
            lineId: l.id,
            returnConditionNotes: notes[l.id]?.conditionNotes || null,
            returnLocationId: notes[l.id]?.locationId || null,
          }))
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't confirm return.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {returnLines.map((l) => (
        <div key={l.id} className="rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            {lineLabel(l)} <span className="text-muted-foreground">— returning {l.returnQty} {l.unit}</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Condition notes (weight, packaging, lot, contamination, seal, expiry)"
              value={notes[l.id]?.conditionNotes ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [l.id]: { ...prev[l.id], conditionNotes: e.target.value } }))}
            />
            <select
              className="input"
              value={notes[l.id]?.locationId ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [l.id]: { ...prev[l.id], locationId: e.target.value } }))}
            >
              <option value="">Storage location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={confirm_} disabled={pending}>
          {pending ? "Confirming..." : "Confirm Return"}
        </Button>
      </div>
    </div>
  );
}

function CompletedStep({ request }: { request: MaterialRequestRow }) {
  return (
    <div className="space-y-2">
      {request.lines.map((l) => (
        <div key={l.id} className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs text-muted-foreground">
          <p className="mb-1 text-sm font-medium text-foreground">{lineLabel(l)}</p>
          <p>Requested {l.requestedQty} {l.unit} · Released {l.releasedQty ?? "—"} · Received {l.receivedQty ?? "—"} ({l.receiptOutcome ?? "—"})</p>
          <p>Used {l.usedQty ?? "—"} · Waste {l.wasteQty ?? "—"} · Returned {l.returnQty ?? "—"}</p>
          <p>Released by {l.releasedByName ?? "—"} · Received by {l.receivedByName ?? "—"} · Verified by {l.returnVerifiedByName ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

export default function RequestDetailModal({
  request,
  locations,
  canManage,
  canRequest,
  onClose,
}: {
  request: MaterialRequestRow;
  locations: WarehouseLocationRow[];
  canManage: boolean;
  canRequest: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{request.requestNumber}</h2>
            <p className="text-xs text-muted-foreground">
              Batch {request.batchReference} · Requested by {request.requestedByName}
              {request.requiredDate && ` · Required ${new Date(request.requiredDate).toLocaleDateString()}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Badge tone={request.priority === "CRITICAL" ? "danger" : request.priority === "HIGH" ? "warning" : "muted"}>
            {request.priority}
          </Badge>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${REQUEST_STATUS_CLASS[request.status]}`}>
            {REQUEST_STATUS_LABEL[request.status]}
          </span>
        </div>

        {RELEASE_STATUSES.has(request.status) &&
          (canManage ? (
            <ReleaseStep request={request} locations={locations} onClose={onClose} />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the warehouse to release these materials.</p>
          ))}

        {RECEIVE_STATUSES.has(request.status) &&
          (canRequest ? (
            <ReceiveStep request={request} />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for production to check and confirm materials received.</p>
          ))}

        {USAGE_STATUSES.has(request.status) &&
          (canRequest ? (
            <UsageStep request={request} />
          ) : (
            <p className="text-sm text-muted-foreground">Materials are in production.</p>
          ))}

        {VERIFY_STATUSES.has(request.status) &&
          (canManage ? (
            <VerifyStep request={request} locations={locations} />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the warehouse to verify the returned materials.</p>
          ))}

        {request.status === "COMPLETED" && <CompletedStep request={request} />}
      </div>
    </div>
  );
}
