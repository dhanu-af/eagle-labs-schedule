"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseOrderStatus } from "@/generated/prisma";
import { createPurchaseOrder, updatePurchaseOrderStatus, type NewPoLineInput } from "@/lib/actions/procurement-actions";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/procurement-defaults";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SupplierRow, PurchaseOrderRow, ItemOption } from "./procurement-client";

const PO_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];
const PO_TONE: Record<PurchaseOrderStatus, "muted" | "info" | "success" | "danger" | "warning"> = {
  DRAFT: "muted",
  SENT: "info",
  CONFIRMED: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type DraftLine = NewPoLineInput;
function emptyLine(unit = "kg"): DraftLine {
  return { itemId: "", quantity: 0, unit, notes: "" };
}

function NewPoModal({ suppliers, items, onClose }: { suppliers: SupplierRow[]; items: ItemOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function pickItem(i: number, itemId: string) {
    const item = items.find((it) => it.id === itemId);
    updateLine(i, { itemId, unit: item?.unit ?? "kg" });
  }

  function save() {
    setError("");
    if (!supplierId) return setError("Supplier is required.");
    if (!expectedDeliveryDate) return setError("Expected delivery date is required.");
    if (!lines.length || lines.some((l) => !l.itemId || !l.quantity)) return setError("Every line needs an item and a quantity greater than 0.");

    startTransition(async () => {
      try {
        await createPurchaseOrder({ supplierId, expectedDeliveryDate, notes: notes || null, lines });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create purchase order.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">New Purchase Order</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Supplier">
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select...</option>
                {suppliers.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expected Delivery Date">
              <input type="date" className="input" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Lines</span>
              <Button size="sm" variant="secondary" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                + Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <Field label="Item">
                      <select className="input" value={line.itemId} onChange={(e) => pickItem(i, e.target.value)}>
                        <option value="">Select...</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.itemCode})
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Quantity">
                    <input type="number" className="input" value={line.quantity || ""} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                  </Field>
                  <Field label="Unit">
                    <input className="input" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                  </Field>
                  <div className="flex items-end justify-end">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-danger hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Creating..." : "Create PO"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PoCard({ po, canManage }: { po: PurchaseOrderRow; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [nextStatus, setNextStatus] = useState<PurchaseOrderStatus>(po.status);
  const [error, setError] = useState("");

  function applyStatus() {
    startTransition(async () => {
      try {
        await updatePurchaseOrderStatus(po.id, nextStatus);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update status.");
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {po.poNumber} — {po.supplierName}
          </p>
          <p className="text-xs text-muted-foreground">
            {po.lines.length} line{po.lines.length === 1 ? "" : "s"} · expected {new Date(po.expectedDeliveryDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={PO_TONE[po.status]}>{PURCHASE_ORDER_STATUS_LABELS[po.status]}</Badge>
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-muted-foreground hover:text-foreground">
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">Item</th>
                <th className="py-1 pr-2">Quantity</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-1 pr-2">
                    {l.itemName} ({l.itemCode})
                  </td>
                  <td className="py-1 pr-2">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="py-1 text-muted-foreground">{l.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <select className="input w-56" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as PurchaseOrderStatus)}>
                {PO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PURCHASE_ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={applyStatus} disabled={pending || nextStatus === po.status}>
                Update Status
              </Button>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </Card>
  );
}

export default function PurchaseOrdersTab({
  purchaseOrders,
  suppliers,
  items,
  canManage,
}: {
  purchaseOrders: PurchaseOrderRow[];
  suppliers: SupplierRow[];
  items: ItemOption[];
  canManage: boolean;
}) {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchaseOrders.filter((po) => !q || `${po.poNumber} ${po.supplierName}`.toLowerCase().includes(q));
  }, [purchaseOrders, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input w-full sm:w-64" placeholder="Search PO number, supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {canManage && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            + New Purchase Order
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No purchase orders yet" description="Create one to track what's on order from a supplier." />
      ) : (
        <div className="space-y-2">
          {filtered.map((po) => (
            <PoCard key={po.id} po={po} canManage={canManage} />
          ))}
        </div>
      )}

      {showNew && <NewPoModal suppliers={suppliers} items={items} onClose={() => setShowNew(false)} />}
    </div>
  );
}
