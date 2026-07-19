"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GR_LINE_STATUS_LABEL, expiryIndicator } from "@/lib/warehouse-defaults";
import { createGoodsReceiving, qaReleaseGoodsReceivingLine, rejectGoodsReceivingLine, deleteGoodsReceiving } from "@/lib/actions/warehouse-receiving-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GoodsReceivingRow, WarehouseItemRow, WarehouseLocationRow } from "./warehouse-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type DraftLine = {
  itemId: string;
  lotNumber: string;
  supplierLot: string;
  internalLot: string;
  expiryDate: string;
  manufactureDate: string;
  quantity: string;
  unit: string;
  coaReference: string;
  storageCondition: string;
};

function emptyLine(defaultUnit: string): DraftLine {
  return {
    itemId: "",
    lotNumber: "",
    supplierLot: "",
    internalLot: "",
    expiryDate: "",
    manufactureDate: "",
    quantity: "",
    unit: defaultUnit,
    coaReference: "",
    storageCondition: "",
  };
}

function NewReceivingModal({ items, onClose }: { items: WarehouseItemRow[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState("");
  const [checkedByName, setCheckedByName] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(items[0]?.unit ?? "kg")]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(items[0]?.unit ?? "kg")]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    setError("");
    if (!supplierName || !deliveryDate) {
      setError("Supplier and delivery date are required.");
      return;
    }
    if (lines.some((l) => !l.itemId || !l.lotNumber || !l.quantity)) {
      setError("Every line needs an item, lot number, and quantity.");
      return;
    }
    startTransition(async () => {
      try {
        await createGoodsReceiving(
          { supplierName, poNumber: poNumber || null, deliveryDate, invoiceRef: invoiceRef || null, checkedByName: checkedByName || null, approvedByName: approvedByName || null },
          lines.map((l) => ({
            itemId: l.itemId,
            lotNumber: l.lotNumber,
            supplierLot: l.supplierLot || null,
            internalLot: l.internalLot || null,
            expiryDate: l.expiryDate || null,
            manufactureDate: l.manufactureDate || null,
            quantity: Number(l.quantity),
            unit: l.unit,
            coaReference: l.coaReference || null,
            photoReference: null,
            deliveryDocketReference: null,
            storageCondition: l.storageCondition || null,
          }))
        );
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save goods receiving.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">New Goods Receiving</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Supplier">
              <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </Field>
            <Field label="PO Number">
              <input className="input" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </Field>
            <Field label="Delivery Date">
              <input type="date" className="input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </Field>
            <Field label="Invoice Ref">
              <input className="input" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
            </Field>
            <Field label="Checked By">
              <input className="input" value={checkedByName} onChange={(e) => setCheckedByName(e.target.value)} />
            </Field>
            <Field label="Approved By">
              <input className="input" value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Line Items</p>
            {lines.map((line, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-muted/40 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Item">
                    <select className="input" value={line.itemId} onChange={(e) => updateLine(i, { itemId: e.target.value, unit: items.find((it) => it.id === e.target.value)?.unit ?? line.unit })}>
                      <option value="">Select item...</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.itemCode} — {it.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Lot Number">
                    <input className="input" value={line.lotNumber} onChange={(e) => updateLine(i, { lotNumber: e.target.value })} />
                  </Field>
                  <Field label="Quantity">
                    <input type="number" className="input" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Unit">
                    <input className="input" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                  </Field>
                  <Field label="Supplier Lot">
                    <input className="input" value={line.supplierLot} onChange={(e) => updateLine(i, { supplierLot: e.target.value })} />
                  </Field>
                  <Field label="Internal Lot">
                    <input className="input" value={line.internalLot} onChange={(e) => updateLine(i, { internalLot: e.target.value })} />
                  </Field>
                  <Field label="Expiry">
                    <input type="date" className="input" value={line.expiryDate} onChange={(e) => updateLine(i, { expiryDate: e.target.value })} />
                  </Field>
                  <Field label="Manufacture Date">
                    <input type="date" className="input" value={line.manufactureDate} onChange={(e) => updateLine(i, { manufactureDate: e.target.value })} />
                  </Field>
                  <Field label="COA Reference">
                    <input className="input" value={line.coaReference} onChange={(e) => updateLine(i, { coaReference: e.target.value })} />
                  </Field>
                  <Field label="Storage Condition">
                    <input className="input" value={line.storageCondition} onChange={(e) => updateLine(i, { storageCondition: e.target.value })} />
                  </Field>
                </div>
                {lines.length > 1 && (
                  <div className="mt-2 text-right">
                    <button onClick={() => removeLine(i)} className="text-xs font-medium text-danger hover:opacity-80">
                      Remove Line
                    </button>
                  </div>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addLine}>
              + Add Line
            </Button>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save Receiving"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QaLineRow({ line, locations }: { line: GoodsReceivingRow["lines"][number]; locations: WarehouseLocationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState("");
  const [error, setError] = useState("");

  function release() {
    if (!locationId) {
      setError("Choose a storage location first.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await qaReleaseGoodsReceivingLine(line.id, locationId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't release.");
      }
    });
  }

  function reject() {
    const reason = prompt("Reason for rejecting this lot:");
    if (!reason) return;
    startTransition(async () => {
      try {
        await rejectGoodsReceivingLine(line.id, reason);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reject.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
      >
        <option value="">Choose location...</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.code}
          </option>
        ))}
      </select>
      <Button size="sm" variant="success" onClick={release} disabled={pending}>
        Release
      </Button>
      <Button size="sm" variant="danger" onClick={reject} disabled={pending}>
        Reject
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export default function GoodsReceivingTab({
  receivings,
  items,
  locations,
  canManage,
  canQaRelease,
  isSuperAdmin,
}: {
  receivings: GoodsReceivingRow[];
  items: WarehouseItemRow[];
  locations: WarehouseLocationRow[];
  canManage: boolean;
  canQaRelease: boolean;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  function remove(r: GoodsReceivingRow) {
    const hasReleased = r.lines.some((l) => l.status === "RELEASED");
    const message = hasReleased
      ? `"${r.supplierName}" has already-released stock — deleting it will also erase the ledger history it created. This cannot be undone. Continue?`
      : `Delete this receiving from ${r.supplierName}? This cannot be undone.`;
    if (!confirm(message)) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteGoodsReceiving(r.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowNew(true)}>
            + New Receiving
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      {receivings.length === 0 ? (
        <EmptyState title="No goods receiving records yet" description="Log a new delivery to get started." />
      ) : (
        <div className="space-y-3">
          {receivings.map((r) => {
            const deletable = isSuperAdmin || r.lines.every((l) => l.status !== "RELEASED");
            return (
            <Card key={r.id} padding="sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.supplierName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.poNumber ? `PO ${r.poNumber} · ` : ""}
                    Delivered {new Date(r.deliveryDate).toLocaleDateString()} · Received by {r.receivedByName}
                  </p>
                </div>
                {canManage && deletable && (
                  <button
                    onClick={() => remove(r)}
                    disabled={pending}
                    className="text-xs font-medium text-danger hover:opacity-80"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={THEAD_ROW_CLASS}>
                      <Th>Item</Th>
                      <Th>Lot</Th>
                      <Th>Expiry</Th>
                      <Th>Qty</Th>
                      <Th>Status</Th>
                      {canQaRelease && <Th>QA Action</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((line) => (
                      <tr key={line.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{line.itemName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.lotNumber}</td>
                        <td className="px-3 py-2">
                          {line.expiryDate ? (
                            <span>
                              {expiryIndicator(line.expiryDate)} {new Date(line.expiryDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={line.status === "RELEASED" ? "success" : line.status === "REJECTED" ? "danger" : "warning"}>
                            {GR_LINE_STATUS_LABEL[line.status]}
                          </Badge>
                          {line.status === "REJECTED" && line.qaRejectReason && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{line.qaRejectReason}</p>
                          )}
                        </td>
                        {canQaRelease && (
                          <td className="px-3 py-2">
                            {line.status === "QUARANTINE" ? (
                              <QaLineRow line={line} locations={locations} />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {line.qaReleasedByName ? `by ${line.qaReleasedByName}` : "—"}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {showNew && <NewReceivingModal items={items} onClose={() => setShowNew(false)} />}
    </div>
  );
}
