"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WarehouseItemCategory } from "@/generated/prisma";
import { CATEGORY_LABEL, CATEGORY_SUBCATEGORY_SUGGESTIONS } from "@/lib/warehouse-defaults";
import { createWarehouseItem, updateWarehouseItem } from "@/lib/actions/warehouse-actions";
import { Button } from "@/components/ui/Button";
import type { WarehouseItemRow, WarehouseLocationRow } from "./warehouse-client";

const CATEGORY_OPTIONS: WarehouseItemCategory[] = ["RAW_MATERIAL", "PACKAGING", "CONSUMABLE", "FINISHED_GOOD"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function ItemMasterModal({
  item,
  locations,
  onClose,
}: {
  item: WarehouseItemRow | null;
  locations: WarehouseLocationRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [itemCode, setItemCode] = useState(item?.itemCode ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<WarehouseItemCategory>(item?.category ?? "RAW_MATERIAL");
  const [subCategory, setSubCategory] = useState(item?.subCategory ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "kg");
  const [minimumStock, setMinimumStock] = useState(item?.minimumStock?.toString() ?? "");
  const [maximumStock, setMaximumStock] = useState(item?.maximumStock?.toString() ?? "");
  const [defaultLocationId, setDefaultLocationId] = useState(item?.defaultLocationId ?? "");

  function save() {
    setError("");
    startTransition(async () => {
      try {
        const shared = {
          name,
          category,
          subCategory: subCategory || null,
          unit,
          minimumStock: minimumStock ? Number(minimumStock) : null,
          maximumStock: maximumStock ? Number(maximumStock) : null,
          defaultLocationId: defaultLocationId || null,
        };
        if (item) {
          await updateWarehouseItem(item.id, { ...shared, active: true });
        } else {
          await createWarehouseItem({ ...shared, itemCode, ingredientId: null });
        }
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save item.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{item ? "Edit Item" : "Add Item"}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Item Code">
            <input
              className="input"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              disabled={!!item}
              placeholder="e.g. RM-BERBERINE"
            />
          </Field>
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Category">
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as WarehouseItemCategory)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sub-Category">
            <input
              className="input"
              list="subcategory-suggestions"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
            />
            <datalist id="subcategory-suggestions">
              {CATEGORY_SUBCATEGORY_SUGGESTIONS[category].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Unit">
              <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field label="Minimum Stock">
              <input
                className="input"
                type="number"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
              />
            </Field>
            <Field label="Maximum Stock">
              <input
                className="input"
                type="number"
                value={maximumStock}
                onChange={(e) => setMaximumStock(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Default Location">
            <select className="input" value={defaultLocationId} onChange={(e) => setDefaultLocationId(e.target.value)}>
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.label}
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !name || !unit || (!item && !itemCode)}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
