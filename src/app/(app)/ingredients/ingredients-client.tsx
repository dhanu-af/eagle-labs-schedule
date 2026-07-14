"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { deleteIngredient, setIngredientLibraryAccess } from "@/lib/actions/ingredient-actions";
import IngredientFormModal from "./ingredient-form-modal";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export type AccessUser = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  ingredientLibraryAccess: boolean;
};

function AccessManagementPanel({ users }: { users: AccessUser[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const nonSuperAdmins = users.filter((u) => u.role !== "SUPER_ADMIN");

  function toggle(userId: string, granted: boolean) {
    startTransition(async () => {
      await setIngredientLibraryAccess(userId, granted);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
      >
        Manage access — only Super Admin and selected users can open Ingredient Library
        <span className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {nonSuperAdmins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other users to manage.</p>
          ) : (
            nonSuperAdmins.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.username} · {u.role.toLowerCase().replace("_", " ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={u.ingredientLibraryAccess}
                    onChange={(e) => toggle(u.id, e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  Access
                </label>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export type Ingredient = {
  id: string;
  name: string;
  alternateName: string | null;
  type: string;
  category: string | null;
  aanLabel: string | null;
  aanValue: string | null;
  notes: string | null;
  verified: boolean;
  verificationSource: string | null;
  verifiedAt: string | null;
  mainBenefit: string | null;
  usedFor: string | null;
  synonyms: string | null;
  casNumber: string | null;
  typicalDosage: string | null;
  storageConditions: string | null;
  shelfLife: string | null;
  safetyNotes: string | null;
  manufacturingNotes: string | null;
  qcNotes: string | null;
  regulatoryStatus: string | null;
  faq: string | null;
  source: string | null;
};

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium">{label}: </span>
      <span className="text-muted-foreground">{value}</span>
    </p>
  );
}

function IngredientCard({
  ingredient,
  related,
  canEdit,
  onEdit,
  onDelete,
  onJump,
}: {
  ingredient: Ingredient;
  related: Ingredient[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onJump: (id: string) => void;
}) {
  return (
    <details id={`ing-${ingredient.id}`} className="group rounded-xl border border-border bg-surface p-5">
      <summary className="flex cursor-pointer list-none flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
            {ingredient.type}
          </span>
          {ingredient.category && (
            <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {ingredient.category}
            </span>
          )}
          {ingredient.verified ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              ✓ Verified{ingredient.verificationSource ? ` — ${ingredient.verificationSource}` : ""}
            </span>
          ) : (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              Not yet verified
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
          <span className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180">▾</span>
        </div>
        {ingredient.mainBenefit && (
          <p className="text-sm text-foreground">
            <span className="font-medium">Main benefit: </span>
            {ingredient.mainBenefit}
          </p>
        )}
        {ingredient.usedFor && (
          <p className="text-sm text-foreground">
            <span className="font-medium">Used for: </span>
            <span className="text-muted-foreground">{ingredient.usedFor}</span>
          </p>
        )}
        {ingredient.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{ingredient.notes}</p>}
      </summary>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {canEdit && (
          <div className="mb-1 flex items-center gap-3">
            <button onClick={onEdit} className="text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
              Edit
            </button>
            <button onClick={onDelete} className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80">
              Delete
            </button>
          </div>
        )}
        <DetailRow label={ingredient.aanLabel ?? "Identifier"} value={ingredient.aanValue} />
        <DetailRow label="Synonyms" value={ingredient.synonyms} />
        <DetailRow label="CAS number" value={ingredient.casNumber} />
        <DetailRow label="Regulatory status" value={ingredient.regulatoryStatus} />
        <DetailRow label="Typical dosage / use level" value={ingredient.typicalDosage} />
        <DetailRow label="Storage conditions" value={ingredient.storageConditions} />
        <DetailRow label="Shelf life" value={ingredient.shelfLife} />
        <DetailRow label="Safety & handling" value={ingredient.safetyNotes} />
        <DetailRow label="Manufacturing notes" value={ingredient.manufacturingNotes} />
        <DetailRow label="QC / CoA parameters" value={ingredient.qcNotes} />
        <DetailRow label="FAQ" value={ingredient.faq} />
        {ingredient.source && <p className="text-xs text-muted-foreground">Source: {ingredient.source}</p>}

        {related.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-medium text-foreground">Related ingredients</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onJump(r.id)}
                  className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export default function IngredientsClient({
  canEdit,
  accessList,
  ingredients,
}: {
  canEdit: boolean;
  accessList: AccessUser[];
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
          { name: "name", weight: 0.3 },
          { name: "alternateName", weight: 0.15 },
          { name: "synonyms", weight: 0.12 },
          { name: "aanValue", weight: 0.12 },
          { name: "mainBenefit", weight: 0.1 },
          { name: "usedFor", weight: 0.08 },
          { name: "type", weight: 0.07 },
          { name: "category", weight: 0.06 },
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

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  function relatedFor(ingredient: Ingredient): Ingredient[] {
    if (!ingredient.category) return [];
    return ingredients
      .filter((i) => i.id !== ingredient.id && i.category === ingredient.category)
      .slice(0, 6);
  }

  function jumpTo(id: string) {
    const target = byId.get(id);
    if (!target) return;
    setQuery("");
    setType("ALL");
    setCategory("ALL");
    requestAnimationFrame(() => {
      const el = document.getElementById(`ing-${id}`);
      if (el) {
        (el as HTMLDetailsElement).open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

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
        title="Ingredient Library"
        subtitle="Search the full ingredient & raw material reference — vitamins, minerals, herbal actives, excipients, and regulated chemicals across TGA, FSANZ, AICIS and APVMA."
        actions={canEdit ? <Button onClick={() => setShowAdd(true)}>+ Add Ingredient</Button> : undefined}
      />

      {canEdit && <AccessManagementPanel users={accessList} />}

      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
        Detail fields are intentionally left blank until independently verified against an authoritative source (TGA Ingredients Table, FSANZ Food Standards Code, AICIS, APVMA, PubChem, etc.) — a &quot;Verified&quot; badge and source citation appear once an entry has been checked.
      </div>

      <div className="glass card-shadow flex flex-col gap-3 rounded-xl border border-border p-5 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, synonym, AAN, type, or category..."
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
        <EmptyState title="No ingredients match your search." description="Try a different name, synonym, or clear a filter." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {results.map((i) => (
            <IngredientCard
              key={i.id}
              ingredient={i}
              related={relatedFor(i)}
              canEdit={canEdit}
              onEdit={() => setEditIngredient(i)}
              onDelete={() => remove(i.id)}
              onJump={jumpTo}
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
