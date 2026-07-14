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
  verifiedBy: string | null;
  classification: string | null;
  mainBenefit: string | null;
  usedFor: string | null;
  synonyms: string | null;
  chemicalName: string | null;
  casNumber: string | null;
  molecularFormula: string | null;
  molecularWeight: string | null;
  tgaStatus: string | null;
  apvmaStatus: string | null;
  fdaStatus: string | null;
  emaStatus: string | null;
  aicisStatus: string | null;
  regulatoryStatus: string | null;
  primaryUse: string | null;
  industry: string | null;
  productTypes: string | null;
  typicalDosage: string | null;
  storageConditions: string | null;
  shelfLife: string | null;
  safetyNotes: string | null;
  ghsClassification: string | null;
  signalWord: string | null;
  ppe: string | null;
  handlingPrecautions: string | null;
  manufacturingNotes: string | null;
  qcNotes: string | null;
  qcIdentity: string | null;
  qcAssay: string | null;
  qcMoisture: string | null;
  qcHeavyMetals: string | null;
  qcMicrobialLimits: string | null;
  appearance: string | null;
  colour: string | null;
  odour: string | null;
  solubility: string | null;
  density: string | null;
  meltingPoint: string | null;
  phValue: string | null;
  relatedIngredientsText: string | null;
  referencesText: string | null;
  faq: string | null;
  source: string | null;
};

export const CLASSIFICATION_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: "TGA_PERMITTED", emoji: "🟢", label: "TGA Permitted" },
  { value: "PRESCRIPTION_API", emoji: "🔵", label: "Prescription API" },
  { value: "VETERINARY", emoji: "🟣", label: "Veterinary" },
  { value: "REFERENCE_ONLY", emoji: "🟠", label: "Reference Only" },
  { value: "CONTROLLED_SUBSTANCE", emoji: "🔴", label: "Controlled Substance" },
  { value: "PROHIBITED", emoji: "⚫", label: "Prohibited" },
];

const CLASSIFICATION_CLASSES: Record<string, string> = {
  TGA_PERMITTED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  PRESCRIPTION_API: "border-sky-400/30 bg-sky-400/10 text-sky-400",
  VETERINARY: "border-purple-400/30 bg-purple-400/10 text-purple-400",
  REFERENCE_ONLY: "border-orange-400/30 bg-orange-400/10 text-orange-400",
  CONTROLLED_SUBSTANCE: "border-red-400/30 bg-red-400/10 text-red-400",
  PROHIBITED: "border-neutral-400/30 bg-neutral-400/10 text-neutral-300",
};

function StatusBadges({ ingredient }: { ingredient: Ingredient }) {
  const classificationBadge = ingredient.classification
    ? CLASSIFICATION_OPTIONS.find((c) => c.value === ingredient.classification)
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ingredient.verified ? (
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          ✓ Verified
        </span>
      ) : (
        <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
          🟡 Not Yet Verified
        </span>
      )}
      {classificationBadge && (
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CLASSIFICATION_CLASSES[classificationBadge.value]}`}
        >
          {classificationBadge.emoji} {classificationBadge.label}
        </span>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium">{label}: </span>
      <span className="text-muted-foreground">{value}</span>
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function hasAny(...values: (string | null)[]) {
  return values.some((v) => !!v);
}

const AUTHORITY_ROWS: { key: keyof Ingredient; label: string }[] = [
  { key: "tgaStatus", label: "🇦🇺 TGA" },
  { key: "apvmaStatus", label: "🇦🇺 APVMA" },
  { key: "fdaStatus", label: "🇺🇸 FDA" },
  { key: "emaStatus", label: "🇪🇺 EMA" },
  { key: "aicisStatus", label: "AICIS" },
];

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
  const [isOpen, setIsOpen] = useState(false);
  const references = ingredient.referencesText
    ? ingredient.referencesText.split(/\r?\n|,/).map((r) => r.trim()).filter(Boolean)
    : [];

  return (
    <div id={`ing-${ingredient.id}`} className="rounded-xl border border-border bg-surface p-5">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full cursor-pointer list-none flex-col gap-2 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
            {ingredient.type}
          </span>
          {ingredient.category && (
            <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {ingredient.category}
            </span>
          )}
          <StatusBadges ingredient={ingredient} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {ingredient.name}
            {ingredient.alternateName && !ingredient.name.includes(ingredient.alternateName) && (
              <span className="font-normal text-muted-foreground"> ({ingredient.alternateName})</span>
            )}
          </h3>
          <span className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
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
      </button>

      {isOpen && (
      <div className="mt-3 space-y-3">
        {canEdit && (
          <div className="flex items-center gap-3">
            <button onClick={onEdit} className="text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
              Edit
            </button>
            <button onClick={onDelete} className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80">
              Delete
            </button>
          </div>
        )}

        <Section title="General Information">
          <DetailRow label="Chemical name" value={ingredient.chemicalName} />
          <DetailRow label={ingredient.aanLabel ?? "AAN / AHN"} value={ingredient.aanValue} />
          <DetailRow label="CAS number" value={ingredient.casNumber} />
          <DetailRow label="Formula" value={ingredient.molecularFormula} />
          <DetailRow label="Molecular weight" value={ingredient.molecularWeight} />
          <DetailRow label="Synonyms" value={ingredient.synonyms} />
          <DetailRow label="Category" value={ingredient.category} />
          <DetailRow label="Ingredient type" value={ingredient.type} />
        </Section>

        <Section title="Regulatory Status">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Authority</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {AUTHORITY_ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-border/60">
                    <td className="py-1 pr-3 text-foreground">{row.label}</td>
                    <td className="py-1 text-muted-foreground">{(ingredient[row.key] as string | null) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DetailRow label="Summary" value={ingredient.regulatoryStatus} />
        </Section>

        {hasAny(ingredient.primaryUse, ingredient.industry, ingredient.productTypes) && (
          <Section title="Applications">
            <DetailRow label="Primary use" value={ingredient.primaryUse} />
            <DetailRow label="Industry" value={ingredient.industry} />
            <DetailRow label="Product types" value={ingredient.productTypes} />
          </Section>
        )}

        {ingredient.notes && (
          <Section title="Benefits / Function">
            <p className="text-sm text-muted-foreground">{ingredient.notes}</p>
          </Section>
        )}

        <DetailRow label="Typical dosage / use level" value={ingredient.typicalDosage} />
        <DetailRow label="Storage conditions" value={ingredient.storageConditions} />
        <DetailRow label="Shelf life" value={ingredient.shelfLife} />

        {hasAny(ingredient.safetyNotes, ingredient.ghsClassification, ingredient.signalWord, ingredient.ppe, ingredient.handlingPrecautions) && (
          <Section title="Safety">
            <DetailRow label="Safety & handling" value={ingredient.safetyNotes} />
            <DetailRow label="GHS classification" value={ingredient.ghsClassification} />
            <DetailRow label="Signal word" value={ingredient.signalWord} />
            <DetailRow label="PPE" value={ingredient.ppe} />
            <DetailRow label="Handling precautions" value={ingredient.handlingPrecautions} />
          </Section>
        )}

        <DetailRow label="Manufacturing notes" value={ingredient.manufacturingNotes} />

        {hasAny(ingredient.qcNotes, ingredient.qcIdentity, ingredient.qcAssay, ingredient.qcMoisture, ingredient.qcHeavyMetals, ingredient.qcMicrobialLimits) && (
          <Section title="Quality Specifications">
            <DetailRow label="Identity" value={ingredient.qcIdentity} />
            <DetailRow label="Assay" value={ingredient.qcAssay} />
            <DetailRow label="Moisture" value={ingredient.qcMoisture} />
            <DetailRow label="Heavy metals" value={ingredient.qcHeavyMetals} />
            <DetailRow label="Microbial limits" value={ingredient.qcMicrobialLimits} />
            <DetailRow label="Other QC / CoA parameters" value={ingredient.qcNotes} />
          </Section>
        )}

        {hasAny(ingredient.appearance, ingredient.colour, ingredient.odour, ingredient.solubility, ingredient.density, ingredient.meltingPoint, ingredient.phValue) && (
          <Section title="Physical Properties">
            <DetailRow label="Appearance" value={ingredient.appearance} />
            <DetailRow label="Colour" value={ingredient.colour} />
            <DetailRow label="Odour" value={ingredient.odour} />
            <DetailRow label="Solubility" value={ingredient.solubility} />
            <DetailRow label="Density" value={ingredient.density} />
            <DetailRow label="Melting point" value={ingredient.meltingPoint} />
            <DetailRow label="pH" value={ingredient.phValue} />
          </Section>
        )}

        <DetailRow label="FAQ" value={ingredient.faq} />

        {related.length > 0 && (
          <Section title="Related Ingredients">
            <div className="flex flex-wrap gap-1.5">
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
          </Section>
        )}

        {references.length > 0 && (
          <Section title="References">
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {references.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </Section>
        )}

        {ingredient.source && <p className="text-xs text-muted-foreground">Source: {ingredient.source}</p>}

        <Section title="Revision History">
          <DetailRow label="Verified by" value={ingredient.verifiedBy} />
          <DetailRow label="Last updated" value={ingredient.verifiedAt ? new Date(ingredient.verifiedAt).toLocaleDateString() : null} />
          <DetailRow label="Source confidence" value={ingredient.verificationSource} />
        </Section>
      </div>
      )}
    </div>
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
          { name: "chemicalName", weight: 0.1 },
          { name: "casNumber", weight: 0.1 },
          { name: "mainBenefit", weight: 0.08 },
          { name: "usedFor", weight: 0.06 },
          { name: "type", weight: 0.05 },
          { name: "category", weight: 0.04 },
          { name: "notes", weight: 0.03 },
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
  const byName = useMemo(
    () => new Map(ingredients.map((i) => [i.name.trim().toLowerCase(), i])),
    [ingredients]
  );

  function relatedFor(ingredient: Ingredient): Ingredient[] {
    if (ingredient.relatedIngredientsText) {
      const tags = ingredient.relatedIngredientsText
        .split(/\r?\n|,/)
        .map((t) => t.trim())
        .filter(Boolean);
      const matched = tags
        .map((t) => byName.get(t.toLowerCase()))
        .filter((i): i is Ingredient => !!i && i.id !== ingredient.id);
      if (matched.length > 0) return matched.slice(0, 8);
    }
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
        if (!el.querySelector(":scope > div.mt-3")) {
          (el.querySelector("button") as HTMLButtonElement | null)?.click();
        }
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
          placeholder="Search by name, synonym, AAN, CAS number, type, or category..."
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
