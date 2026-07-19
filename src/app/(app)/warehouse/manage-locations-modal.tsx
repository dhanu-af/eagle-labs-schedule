"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WarehouseZone } from "@/generated/prisma";
import { ZONE_LABEL } from "@/lib/warehouse-defaults";
import { createWarehouseLocation, updateWarehouseLocation, deleteWarehouseLocation } from "@/lib/actions/warehouse-actions";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import type { WarehouseLocationRow } from "./warehouse-client";

const ZONE_OPTIONS: WarehouseZone[] = [
  "DRY_STORE",
  "COLD_STORE",
  "QUARANTINE",
  "RELEASED",
  "REJECTED",
  "PACKAGING",
  "FINISHED_GOODS",
];

export default function ManageLocationsModal({
  locations,
  onClose,
}: {
  locations: WarehouseLocationRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [zone, setZone] = useState<WarehouseZone>("DRY_STORE");
  const [parentId, setParentId] = useState("");

  function resetForm() {
    setEditingId(null);
    setCode("");
    setLabel("");
    setZone("DRY_STORE");
    setParentId("");
  }

  function editLocation(loc: WarehouseLocationRow) {
    setEditingId(loc.id);
    setCode(loc.code);
    setLabel(loc.label);
    setZone(loc.zone);
    setParentId(loc.parentId ?? "");
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        if (editingId) {
          await updateWarehouseLocation(editingId, { label, zone, parentId: parentId || null, active: true });
        } else {
          await createWarehouseLocation({ code, label, zone, parentId: parentId || null });
        }
        router.refresh();
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save location.");
      }
    });
  }

  function remove(loc: WarehouseLocationRow) {
    if (!confirm(`Delete location "${loc.code}"?`)) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteWarehouseLocation(loc.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Warehouse Locations</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className={THEAD_ROW_CLASS}>
                <Th>Code</Th>
                <Th>Label</Th>
                <Th>Zone</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{l.code}</td>
                  <td className="px-3 py-2">{l.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ZONE_LABEL[l.zone]}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => editLocation(l)}
                      className="text-xs font-medium text-primary hover:opacity-80"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(l)}
                      disabled={pending}
                      className="ml-2 text-xs font-medium text-danger hover:opacity-80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No locations yet — add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            {editingId ? "Edit Location" : "Add Location"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Code (e.g. A-01-R03-B02)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!editingId}
            />
            <input className="input" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <select className="input" value={zone} onChange={(e) => setZone(e.target.value as WarehouseZone)}>
              {ZONE_OPTIONS.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </select>
            <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">No parent</option>
              {locations
                .filter((l) => l.id !== editingId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
            </select>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            {editingId && (
              <Button variant="secondary" size="sm" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={pending || !label || (!editingId && !code)}>
              {pending ? "Saving..." : editingId ? "Save Changes" : "+ Add Location"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
