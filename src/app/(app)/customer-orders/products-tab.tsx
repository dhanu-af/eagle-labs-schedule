"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/actions/customer-order-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ProductRow, FormulationOption } from "./customer-orders-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ProductModal({ product, formulations, onClose }: { product: ProductRow | null; formulations: FormulationOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [defaultUnit, setDefaultUnit] = useState(product?.defaultUnit ?? "kg");
  const [formulationId, setFormulationId] = useState(product?.formulationId ?? "");
  const [active, setActive] = useState(product?.active ?? true);

  function save() {
    setError("");
    if (!sku.trim() || !name.trim()) return setError("SKU and name are required.");

    startTransition(async () => {
      try {
        const data = { sku, name, category: category || null, defaultUnit, formulationId: formulationId || null };
        if (product) await updateProduct(product.id, { ...data, active });
        else await createProduct(data);
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save product.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{product ? "Edit Product" : "New Product"}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="SKU">
              <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
            </Field>
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Category">
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="Default Unit">
              <input className="input" value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)} />
            </Field>
            {product && (
              <Field label="Status">
                <select className="input" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="BOM / Formulation">
            <select className="input" value={formulationId} onChange={(e) => setFormulationId(e.target.value)}>
              <option value="">None linked — material check won&apos;t be available</option>
              {formulations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.productName}
                </option>
              ))}
            </select>
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

export default function ProductsTab({ products, formulations, canManage }: { products: ProductRow[]; formulations: FormulationOption[]; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProductRow | null | "new">(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || `${p.name} ${p.sku}`.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input w-full sm:w-64" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            + New Product
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No products yet" description="Add a product/SKU — link it to a Formulation to enable the material check." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>SKU</Th>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th>BOM</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => canManage && setEditing(p)}
                    className={`border-b border-border last:border-0 ${canManage ? "cursor-pointer hover:bg-surface-muted/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{p.sku}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.category ?? "—"}</td>
                    <td className="px-3 py-2">{p.formulationName ?? <span className="text-warning">Unlinked</span>}</td>
                    <td className="px-3 py-2">
                      <Badge tone={p.active ? "success" : "muted"}>{p.active ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && <ProductModal product={editing === "new" ? null : editing} formulations={formulations} onClose={() => setEditing(null)} />}
    </div>
  );
}
