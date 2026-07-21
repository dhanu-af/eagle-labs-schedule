"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDispatchEvent, deleteDispatchEvent } from "@/lib/actions/mfg-reconciliation-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Section } from "./mfg-batch-detail-client";

export type DispatchEventData = {
  id: string;
  customer: string;
  salesOrder: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  casesDispatched: number | null;
  bottlesDispatched: number | null;
  dispatchDate: string | null;
  remainingStockAfter: number | null;
  dispatchedByName: string | null;
  remarks: string | null;
};

export default function DispatchSection({ batchId, events, canManage }: { batchId: string; events: DispatchEventData[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customer: "",
    salesOrder: "",
    batchNumber: "",
    expiryDate: "",
    casesDispatched: "",
    bottlesDispatched: "",
    remainingStockAfter: "",
    remarks: "",
  });
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10));

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function add() {
    setError("");
    if (!form.customer) {
      setError("Customer is required.");
      return;
    }
    startTransition(async () => {
      try {
        await addDispatchEvent(batchId, {
          customer: form.customer,
          salesOrder: form.salesOrder || null,
          batchNumber: form.batchNumber || null,
          expiryDate: form.expiryDate || null,
          casesDispatched: form.casesDispatched === "" ? null : Number(form.casesDispatched),
          bottlesDispatched: form.bottlesDispatched === "" ? null : Number(form.bottlesDispatched),
          dispatchDate: dispatchDate || null,
          remainingStockAfter: form.remainingStockAfter === "" ? null : Number(form.remainingStockAfter),
          remarks: form.remarks || null,
        });
        setForm({ customer: "", salesOrder: "", batchNumber: "", expiryDate: "", casesDispatched: "", bottlesDispatched: "", remainingStockAfter: "", remarks: "" });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this dispatch event?")) return;
    startTransition(async () => {
      try {
        await deleteDispatchEvent(batchId, id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Section title="Dispatch History">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No dispatch events recorded yet.</p>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1.5">Customer</th>
                    <th className="px-2 py-1.5">Sales Order</th>
                    <th className="px-2 py-1.5">Batch Number</th>
                    <th className="px-2 py-1.5">Expiry</th>
                    <th className="px-2 py-1.5">Cases</th>
                    <th className="px-2 py-1.5">Bottles</th>
                    <th className="px-2 py-1.5">Dispatch Date</th>
                    <th className="px-2 py-1.5">Remaining Stock</th>
                    {canManage && <th className="px-2 py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-2 py-1.5 font-medium text-foreground">{e.customer}</td>
                      <td className="px-2 py-1.5">{e.salesOrder ?? "—"}</td>
                      <td className="px-2 py-1.5">{e.batchNumber ?? "—"}</td>
                      <td className="px-2 py-1.5">{e.expiryDate ? new Date(e.expiryDate).toLocaleDateString() : "—"}</td>
                      <td className="px-2 py-1.5 tabular-nums">{e.casesDispatched ?? "—"}</td>
                      <td className="px-2 py-1.5 tabular-nums">{e.bottlesDispatched ?? "—"}</td>
                      <td className="px-2 py-1.5">{e.dispatchDate ? new Date(e.dispatchDate).toLocaleDateString() : "—"}</td>
                      <td className="px-2 py-1.5 tabular-nums">{e.remainingStockAfter ?? "—"}</td>
                      {canManage && (
                        <td className="px-2 py-1.5">
                          <button onClick={() => remove(e.id)} className="text-danger hover:opacity-80">
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      {canManage && (
        <Section title="Record a Dispatch">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Customer">
              <input className="input" value={form.customer} onChange={(e) => set("customer", e.target.value)} />
            </Field>
            <Field label="Sales Order">
              <input className="input" value={form.salesOrder} onChange={(e) => set("salesOrder", e.target.value)} />
            </Field>
            <Field label="Batch Number">
              <input className="input" value={form.batchNumber} onChange={(e) => set("batchNumber", e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <input type="date" className="input" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
            </Field>
            <Field label="Cases Dispatched">
              <input type="number" className="input" value={form.casesDispatched} onChange={(e) => set("casesDispatched", e.target.value)} />
            </Field>
            <Field label="Bottles Dispatched">
              <input type="number" className="input" value={form.bottlesDispatched} onChange={(e) => set("bottlesDispatched", e.target.value)} />
            </Field>
            <Field label="Dispatch Date">
              <input type="date" className="input" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
            </Field>
            <Field label="Remaining Stock">
              <input type="number" className="input" value={form.remainingStockAfter} onChange={(e) => set("remainingStockAfter", e.target.value)} />
            </Field>
          </div>
          <Field label="Remarks">
            <textarea className="input" rows={2} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="text-right">
            <Button size="sm" onClick={add} disabled={pending}>
              {pending ? "Saving..." : "Add Dispatch"}
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}
