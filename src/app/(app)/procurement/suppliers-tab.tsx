"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupplier, updateSupplier } from "@/lib/actions/procurement-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SupplierRow } from "./procurement-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: SupplierRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [code, setCode] = useState(supplier?.code ?? "");
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(supplier?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(supplier?.contactPhone ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(supplier?.leadTimeDays != null ? String(supplier.leadTimeDays) : "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [active, setActive] = useState(supplier?.active ?? true);

  function save() {
    setError("");
    if (!code.trim() || !name.trim()) return setError("Code and name are required.");

    startTransition(async () => {
      try {
        const data = {
          code,
          name,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
          notes: notes || null,
        };
        if (supplier) await updateSupplier(supplier.id, { ...data, active });
        else await createSupplier(data);
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save supplier.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{supplier ? "Edit Supplier" : "New Supplier"}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Code">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Contact Name">
              <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </Field>
            <Field label="Contact Email">
              <input className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </Field>
            <Field label="Contact Phone">
              <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </Field>
            <Field label="Typical Lead Time (days)">
              <input type="number" className="input" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} />
            </Field>
            {supplier && (
              <Field label="Status">
                <select className="input" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuppliersTab({ suppliers, canManage }: { suppliers: SupplierRow[]; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SupplierRow | null | "new">(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => !q || `${s.name} ${s.code}`.toLowerCase().includes(q));
  }, [suppliers, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input w-full sm:w-64" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            + New Supplier
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No suppliers yet" description="Add a supplier to start placing purchase orders." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Lead Time</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => canManage && setEditing(s)} className={`border-b border-border last:border-0 ${canManage ? "cursor-pointer hover:bg-surface-muted/40" : ""}`}>
                    <td className="px-3 py-2 font-medium text-foreground">{s.code}</td>
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.contactName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.leadTimeDays != null ? `${s.leadTimeDays}d` : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={s.active ? "success" : "muted"}>{s.active ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && <SupplierModal supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
