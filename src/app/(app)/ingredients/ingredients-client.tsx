"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { deleteIngredient } from "@/lib/actions/ingredient-actions";
import IngredientFormModal from "./ingredient-form-modal";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export type Ingredient = {
  id: string;
  name: string;
  alternateName: string | null;
  type: string;
  category: string | null;
  aanLabel: string | null;
  aanValue: string | null;
  notes: string;
  source: string | null;
};

function IngredientCard({
  ingredient,
  canEdit,
  onEdit,
  onDelete,
}: {
  ingredient: Ingredient;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card-shadow rounded-xl border border-border bg-surface p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
          {ingredient.type}
        </span>
        {ingredient.category && (
          <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {ingredient.category}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {ingredient.name}
          {ingredient.alternateName && !ingredient.name.includes(ingredient.alternateName) && (
            <span className="font-normal text-muted-foreground"> ({ingredient.alternateName})</span>
          )}
        </h3>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onEdit}
              className="text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {ingredient.aanLabel && ingredient.aanValue && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ingredient.aanLabel}: </span>
          {ingredient.aanValue}
        </p>
      )}
      <p className="mt-1.5 text-sm text-foreground">{ingredient.notes}</p>
      {ingredient.source && <p className="mt-2 text-xs text-muted-foreground">Source: {ingredient.source}</p>}
    </div>
  );
}

export default function IngredientsClient({
  canEdit,
  ingredients,
}: {
  canEdit: boolean;
  ingredients: Ingredient[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [editIngredient, setEditIngredient] = useState<Ingredient | null>(null);

  const types = useMemo(
    () => Array.from(new Set(ingredients.map((i) => i.type))).sort((a, b) => a.localeCompare(b)),
    [ingredients]
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(ingredients.map((i) => i.category).filter((c): c is string => !!c))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [ingredients]
  );

  const fuse = useMemo(
    () =>
      new Fuse(ingredients, {
        keys: [
          { name: "name", weight: 0.4 },
          { name: "alternateName", weight: 0.25 },
          { name: "aanValue", weight: 0.2 },
          { name: "type", weight: 0.1 },
          { name: "category", weight: 0.1 },
          { name: "notes", weight: 0.05 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [ingredients]
  );

  const results = useMemo(() => {
    const base = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : ingredients;
    return base.filter((i) => {
      if (type !== "ALL" && i.type !== type) return false;
      if (category !== "ALL" && i.category !== category) return false;
      return true;
    });
  }, [fuse, query, ingredients, type, category]);

  function remove(id: string) {
    if (!confirm("Delete this ingredient? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteIngredient(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredients"
        subtitle="Search the full ingredient & raw material reference — vitamins, minerals, herbal actives, excipients, and regulated chemicals across TGA, FSANZ, AICIS and APVMA."
        actions={canEdit ? <Button onClick={() => setShowAdd(true)}>+ Add Ingredient</Button> : undefined}
      />

      <div className="glass card-shadow flex flex-col gap-3 rounded-xl border border-border p-5 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, alternate name, AAN, type, or category..."
          className="input flex-1"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="input sm:max-w-[220px]">
          <option value="ALL">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input sm:max-w-[220px]">
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        {results.length} of {ingredients.length} ingredients
      </p>

      {results.length === 0 ? (
        <EmptyState title="No ingredients match your search." description="Try a different name, alternate name, or clear a filter." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((i) => (
            <IngredientCard
              key={i.id}
              ingredient={i}
              canEdit={canEdit}
              onEdit={() => setEditIngredient(i)}
              onDelete={() => remove(i.id)}
            />
          ))}
        </div>
      )}

      {(showAdd || editIngredient) && (
        <IngredientFormModal
          ingredient={editIngredient}
          onClose={() => {
            setShowAdd(false);
            setEditIngredient(null);
          }}
        />
      )}
    </div>
  );
}
