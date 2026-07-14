"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIngredient, updateIngredient } from "@/lib/actions/ingredient-actions";
import type { Ingredient } from "./ingredients-client";
import { Button } from "@/components/ui/Button";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const TEXT_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "synonyms", label: "Synonyms (optional)", placeholder: "e.g. Ascorbic Acid; L-Ascorbic Acid" },
  { name: "casNumber", label: "CAS number (optional — leave blank unless verified)", placeholder: "e.g. 50-81-7" },
  { name: "regulatoryStatus", label: "Regulatory status (optional)", placeholder: "e.g. AAN: Ascorbic acid" },
  { name: "typicalDosage", label: "Typical dosage / use level (optional)", placeholder: "e.g. 500-1000 mg/day" },
  { name: "storageConditions", label: "Storage conditions (optional)", placeholder: "e.g. Store below 25°C, dry, protected from light" },
  { name: "shelfLife", label: "Shelf life (optional)", placeholder: "e.g. 24 months unopened" },
];

const TEXTAREA_FIELDS: { name: keyof Ingredient; label: string }[] = [
  { name: "safetyNotes", label: "Safety & handling (optional)" },
  { name: "manufacturingNotes", label: "Manufacturing notes (optional)" },
  { name: "qcNotes", label: "QC / CoA parameters (optional)" },
  { name: "faq", label: "FAQ (optional)" },
];

export default function IngredientFormModal({
  ingredient,
  onClose,
}: {
  ingredient: Ingredient | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!ingredient;

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "") || undefined;
    const data = {
      name: String(formData.get("name") ?? ""),
      alternateName: get("alternateName"),
      type: String(formData.get("type") ?? ""),
      category: get("category"),
      aanLabel: get("aanLabel"),
      aanValue: get("aanValue"),
      notes: String(formData.get("notes") ?? ""),
      synonyms: get("synonyms"),
      casNumber: get("casNumber"),
      typicalDosage: get("typicalDosage"),
      storageConditions: get("storageConditions"),
      shelfLife: get("shelfLife"),
      safetyNotes: get("safetyNotes"),
      manufacturingNotes: get("manufacturingNotes"),
      qcNotes: get("qcNotes"),
      regulatoryStatus: get("regulatoryStatus"),
      faq: get("faq"),
      source: get("source"),
    };
    startTransition(async () => {
      if (ingredient) {
        await updateIngredient(ingredient.id, data);
      } else {
        await createIngredient(data);
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit Ingredient" : "Add Ingredient"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input name="name" required defaultValue={ingredient?.name ?? ""} placeholder="e.g. Vitamin C" className="input" />
            </Field>
            <Field label="Alternate name (optional)">
              <input
                name="alternateName"
                defaultValue={ingredient?.alternateName ?? ""}
                placeholder="e.g. Ascorbic Acid"
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <input name="type" required defaultValue={ingredient?.type ?? ""} placeholder="e.g. Vitamin" className="input" />
            </Field>
            <Field label="Category (optional)">
              <input
                name="category"
                defaultValue={ingredient?.category ?? ""}
                placeholder="e.g. Water-soluble"
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Identifier label (optional)">
              <input
                name="aanLabel"
                defaultValue={ingredient?.aanLabel ?? ""}
                placeholder="e.g. AAN, AHN, Status, Number"
                className="input"
              />
            </Field>
            <Field label="Identifier value (optional)">
              <input
                name="aanValue"
                defaultValue={ingredient?.aanValue ?? ""}
                placeholder="e.g. Ascorbic acid"
                className="input"
              />
            </Field>
          </div>
          <Field label="Notes / Benefits">
            <textarea name="notes" required rows={3} defaultValue={ingredient?.notes ?? ""} className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {TEXT_FIELDS.map((f) => (
              <Field key={f.name} label={f.label}>
                <input
                  name={f.name}
                  defaultValue={(ingredient?.[f.name] as string | null) ?? ""}
                  placeholder={f.placeholder}
                  className="input"
                />
              </Field>
            ))}
          </div>

          {TEXTAREA_FIELDS.map((f) => (
            <Field key={f.name} label={f.label}>
              <textarea
                name={f.name}
                rows={2}
                defaultValue={(ingredient?.[f.name] as string | null) ?? ""}
                className="input"
              />
            </Field>
          ))}

          <Field label="Source (optional)">
            <input
              name="source"
              defaultValue={ingredient?.source ?? ""}
              placeholder="e.g. TGA Ingredients Table"
              className="input"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
