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
    const data = {
      name: String(formData.get("name") ?? ""),
      alternateName: String(formData.get("alternateName") ?? "") || undefined,
      type: String(formData.get("type") ?? ""),
      category: String(formData.get("category") ?? "") || undefined,
      aanLabel: String(formData.get("aanLabel") ?? "") || undefined,
      aanValue: String(formData.get("aanValue") ?? "") || undefined,
      notes: String(formData.get("notes") ?? ""),
      source: String(formData.get("source") ?? "") || undefined,
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
            <textarea name="notes" required rows={4} defaultValue={ingredient?.notes ?? ""} className="input" />
          </Field>
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
