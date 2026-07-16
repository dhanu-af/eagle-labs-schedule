"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABEL, isLowStock, expiryIndicator } from "@/lib/warehouse-defaults";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import ItemMasterModal from "./item-master-modal";
import ManageLocationsModal from "./manage-locations-modal";
import type { WarehouseItemRow, WarehouseLocationRow, GoodsReceivingRow } from "./warehouse-client";

/** Nearest expiry indicator across an item's currently-released lots (Stock Overview is an item-level
 * aggregate for Phase 1 — per-lot detail lives on each Goods Receiving record). */
function nearestExpiry(itemId: string, receivings: GoodsReceivingRow[]): string | null {
  const dates = receivings
    .flatMap((r) => r.lines)
    .filter((l) => l.itemId === itemId && l.status === "RELEASED" && l.expiryDate)
    .map((l) => l.expiryDate as string)
    .sort();
  return dates[0] ?? null;
}

export default function StockOverviewTab({
  items,
  locations,
  receivings,
  canManage,
}: {
  items: WarehouseItemRow[];
  locations: WarehouseLocationRow[];
  receivings: GoodsReceivingRow[];
  canManage: boolean;
}) {
  const [editingItem, setEditingItem] = useState<WarehouseItemRow | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "LOW_STOCK" | "QUARANTINE">("ALL");

  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const filtered = items.filter((i) => {
    if (filter === "LOW_STOCK") return i.stock && isLowStock(i.stock.AVAILABLE, i.minimumStock);
    if (filter === "QUARANTINE") return i.stock && i.stock.QUARANTINE > 0;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
          {(["ALL", "LOW_STOCK", "QUARANTINE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "ALL" ? "All Items" : f === "LOW_STOCK" ? "Low Stock" : "Quarantine"}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowLocations(true)}>
              Manage Locations
            </Button>
            <Button size="sm" onClick={() => setShowAddItem(true)}>
              + Add Item
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No items match" description="Try a different filter, or add a warehouse item." />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={THEAD_ROW_CLASS}>
                <Th>Item Code</Th>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Expiry</Th>
                <Th>Available</Th>
                <Th>Reserved</Th>
                <Th>In Production</Th>
                <Th>Quarantine</Th>
                <Th>Location</Th>
                <Th>Min / Max</Th>
                {canManage && <Th></Th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const expiry = nearestExpiry(item.id, receivings);
                const low = item.stock ? isLowStock(item.stock.AVAILABLE, item.minimumStock) : false;
                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{item.itemCode}</td>
                    <td className="px-3 py-2">
                      {item.name}
                      {item.subCategory && <span className="ml-1 text-xs text-muted-foreground">({item.subCategory})</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{CATEGORY_LABEL[item.category]}</td>
                    <td className="px-3 py-2">
                      {expiry ? (
                        <span>
                          {expiryIndicator(expiry)} {new Date(expiry).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.stock?.AVAILABLE ?? 0} {item.unit}
                      {low && (
                        <Badge tone="danger" className="ml-1.5">
                          Low
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.stock?.RESERVED ?? 0}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.stock?.IN_PRODUCTION ?? 0}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.stock?.QUARANTINE ?? 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.defaultLocationId ? locationById.get(item.defaultLocationId)?.code ?? "—" : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.minimumStock ?? "—"} / {item.maximumStock ?? "—"}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-xs font-medium text-primary hover:opacity-80"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {(showAddItem || editingItem) && (
        <ItemMasterModal
          item={editingItem}
          locations={locations}
          onClose={() => {
            setShowAddItem(false);
            setEditingItem(null);
          }}
        />
      )}
      {showLocations && <ManageLocationsModal locations={locations} onClose={() => setShowLocations(false)} />}
    </div>
  );
}
