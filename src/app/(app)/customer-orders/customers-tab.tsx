"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomer, updateCustomer } from "@/lib/actions/customer-order-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CustomerRow } from "./customer-orders-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CustomerModal({ customer, onClose }: { customer: CustomerRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [code, setCode] = useState(customer?.code ?? "");
  const [name, setName] = useState(customer?.name ?? "");
  const [contactName, setContactName] = useState(customer?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(customer?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(customer?.contactPhone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [active, setActive] = useState(customer?.active ?? true);

  function save() {
    setError("");
    if (!code.trim() || !name.trim()) return setError("Code and name are required.");

    startTransition(async () => {
      try {
        const data = { code, name, contactName: contactName || null, contactEmail: contactEmail || null, contactPhone: contactPhone || null, address: address || null, notes: notes || null };
        if (customer) await updateCustomer(customer.id, { ...data, active });
        else await createCustomer(data);
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save customer.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{customer ? "Edit Customer" : "New Customer"}</h2>
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
            {customer && (
              <Field label="Status">
                <select className="input" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Address">
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
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

export default function CustomersTab({ customers, canManage }: { customers: CustomerRow[]; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CustomerRow | null | "new">(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => !q || `${c.name} ${c.code}`.toLowerCase().includes(q));
  }, [customers, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input w-full sm:w-64" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            + New Customer
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No customers yet" description="Add a customer to start capturing orders." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Phone</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => canManage && setEditing(c)}
                    className={`border-b border-border last:border-0 ${canManage ? "cursor-pointer hover:bg-surface-muted/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{c.code}</td>
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.contactName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.contactPhone ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={c.active ? "success" : "muted"}>{c.active ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && <CustomerModal customer={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
