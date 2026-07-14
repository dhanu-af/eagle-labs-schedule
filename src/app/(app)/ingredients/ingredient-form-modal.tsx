"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIngredient, updateIngredient } from "@/lib/actions/ingredient-actions";
import type { Ingredient } from "./ingredients-client";
import { CLASSIFICATION_OPTIONS } from "./ingredients-client";
import { Button } from "@/components/ui/Button";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      {children}
    </div>
  );
}

const AUTHORITY_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "tgaStatus", label: "🇦🇺 TGA", placeholder: "e.g. Not Permitted" },
  { name: "apvmaStatus", label: "🇦🇺 APVMA", placeholder: "e.g. Registered Agricultural Chemical" },
  { name: "fdaStatus", label: "🇺🇸 FDA", placeholder: "leave blank unless verified" },
  { name: "emaStatus", label: "🇪🇺 EMA", placeholder: "leave blank unless verified" },
  { name: "aicisStatus", label: "AICIS", placeholder: "leave blank unless verified" },
];

const APPLICATION_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "primaryUse", label: "Primary use (optional)", placeholder: "e.g. Herbicide" },
  { name: "industry", label: "Industry (optional)", placeholder: "e.g. Agriculture" },
  { name: "productTypes", label: "Product types (optional)", placeholder: "e.g. Broadacre spray" },
];

const DOSAGE_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "typicalDosage", label: "Typical dosage / use level (optional)", placeholder: "leave blank if not applicable" },
  { name: "storageConditions", label: "Storage conditions (optional)", placeholder: "temperature, humidity, light protection" },
  { name: "shelfLife", label: "Shelf life (optional)", placeholder: "e.g. 24 months unopened" },
];

const SAFETY_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "ghsClassification", label: "GHS classification (optional)", placeholder: "" },
  { name: "signalWord", label: "Signal word (optional)", placeholder: "e.g. Danger, Warning" },
  { name: "ppe", label: "PPE (optional)", placeholder: "" },
];

const QC_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "qcIdentity", label: "Identity (optional)", placeholder: "" },
  { name: "qcAssay", label: "Assay (optional)", placeholder: "" },
  { name: "qcMoisture", label: "Moisture (optional)", placeholder: "" },
  { name: "qcHeavyMetals", label: "Heavy metals (optional)", placeholder: "" },
  { name: "qcMicrobialLimits", label: "Microbial limits (optional)", placeholder: "" },
];

const PHYSICAL_FIELDS: { name: keyof Ingredient; label: string; placeholder: string }[] = [
  { name: "appearance", label: "Appearance (optional)", placeholder: "" },
  { name: "colour", label: "Colour (optional)", placeholder: "" },
  { name: "odour", label: "Odour (optional)", placeholder: "" },
  { name: "solubility", label: "Solubility (optional)", placeholder: "" },
  { name: "density", label: "Density (optional)", placeholder: "" },
  { name: "meltingPoint", label: "Melting point (optional)", placeholder: "" },
  { name: "phValue", label: "pH (optional)", placeholder: "" },
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
      notes: get("notes"),
      classification: get("classification"),
      mainBenefit: get("mainBenefit"),
      usedFor: get("usedFor"),
      synonyms: get("synonyms"),
      chemicalName: get("chemicalName"),
      casNumber: get("casNumber"),
      molecularFormula: get("molecularFormula"),
      molecularWeight: get("molecularWeight"),
      tgaStatus: get("tgaStatus"),
      apvmaStatus: get("apvmaStatus"),
      fdaStatus: get("fdaStatus"),
      emaStatus: get("emaStatus"),
      aicisStatus: get("aicisStatus"),
      regulatoryStatus: get("regulatoryStatus"),
      primaryUse: get("primaryUse"),
      industry: get("industry"),
      productTypes: get("productTypes"),
      typicalDosage: get("typicalDosage"),
      storageConditions: get("storageConditions"),
      shelfLife: get("shelfLife"),
      safetyNotes: get("safetyNotes"),
      ghsClassification: get("ghsClassification"),
      signalWord: get("signalWord"),
      ppe: get("ppe"),
      handlingPrecautions: get("handlingPrecautions"),
      manufacturingNotes: get("manufacturingNotes"),
      qcNotes: get("qcNotes"),
      qcIdentity: get("qcIdentity"),
      qcAssay: get("qcAssay"),
      qcMoisture: get("qcMoisture"),
      qcHeavyMetals: get("qcHeavyMetals"),
      qcMicrobialLimits: get("qcMicrobialLimits"),
      appearance: get("appearance"),
      colour: get("colour"),
      odour: get("odour"),
      solubility: get("solubility"),
      density: get("density"),
      meltingPoint: get("meltingPoint"),
      phValue: get("phValue"),
      relatedIngredientsText: get("relatedIngredientsText"),
      referencesText: get("referencesText"),
      faq: get("faq"),
      source: get("source"),
      verified: formData.get("verified") === "on",
      verificationSource: get("verificationSource"),
      verifiedBy: get("verifiedBy"),
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
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
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

          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="verified"
                defaultChecked={ingredient?.verified ?? false}
                className="h-4 w-4"
              />
              Verified against an authoritative source
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Verified by">
                <input
                  name="verifiedBy"
                  defaultValue={ingredient?.verifiedBy ?? ""}
                  placeholder="e.g. Dhanu"
                  className="input"
                />
              </Field>
              <Field label="Source confidence / citation">
                <input
                  name="verificationSource"
                  defaultValue={ingredient?.verificationSource ?? ""}
                  placeholder="e.g. TGA Ingredients Table, accessed 2026-07-15"
                  className="input"
                />
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Classification badge (leave blank if not yet verified)">
                <select name="classification" defaultValue={ingredient?.classification ?? ""} className="input">
                  <option value="">— none —</option>
                  {CLASSIFICATION_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <FormSection title="General Information">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Chemical name (optional)">
                <input name="chemicalName" defaultValue={ingredient?.chemicalName ?? ""} className="input" />
              </Field>
              <Field label="CAS number (optional — leave blank unless verified)">
                <input name="casNumber" defaultValue={ingredient?.casNumber ?? ""} placeholder="e.g. 50-81-7" className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Formula (optional)">
                <input name="molecularFormula" defaultValue={ingredient?.molecularFormula ?? ""} className="input" />
              </Field>
              <Field label="Molecular weight (optional)">
                <input name="molecularWeight" defaultValue={ingredient?.molecularWeight ?? ""} className="input" />
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
                <input name="aanValue" defaultValue={ingredient?.aanValue ?? ""} className="input" />
              </Field>
            </div>
            <Field label="Synonyms (optional)">
              <input
                name="synonyms"
                defaultValue={ingredient?.synonyms ?? ""}
                placeholder="e.g. Ascorbic Acid; L-Ascorbic Acid"
                className="input"
              />
            </Field>
          </FormSection>

          <FormSection title="Regulatory Status (per authority — leave blank unless confirmed)">
            <div className="grid grid-cols-2 gap-3">
              {AUTHORITY_FIELDS.map((f) => (
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
            <Field label="Regulatory summary (optional)">
              <input name="regulatoryStatus" defaultValue={ingredient?.regulatoryStatus ?? ""} className="input" />
            </Field>
          </FormSection>

          <FormSection title="Applications">
            <div className="grid grid-cols-2 gap-3">
              {APPLICATION_FIELDS.map((f) => (
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
          </FormSection>

          <FormSection title="Benefits / Function & Use">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Main benefit (shown prominently)">
                <input
                  name="mainBenefit"
                  defaultValue={ingredient?.mainBenefit ?? ""}
                  placeholder="e.g. Antioxidant support"
                  className="input"
                />
              </Field>
              <Field label="Used for (shown prominently)">
                <input
                  name="usedFor"
                  defaultValue={ingredient?.usedFor ?? ""}
                  placeholder="e.g. Capsules, tablets, powders"
                  className="input"
                />
              </Field>
            </div>
            <Field label="Benefits / function — brief scientific description (optional)">
              <textarea name="notes" rows={3} defaultValue={ingredient?.notes ?? ""} className="input" />
            </Field>
          </FormSection>

          <FormSection title="Dosage & Storage">
            {DOSAGE_FIELDS.map((f) => (
              <Field key={f.name} label={f.label}>
                <input
                  name={f.name}
                  defaultValue={(ingredient?.[f.name] as string | null) ?? ""}
                  placeholder={f.placeholder}
                  className="input"
                />
              </Field>
            ))}
          </FormSection>

          <FormSection title="Safety">
            <div className="grid grid-cols-2 gap-3">
              {SAFETY_FIELDS.map((f) => (
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
            <Field label="Handling precautions (optional)">
              <textarea name="handlingPrecautions" rows={2} defaultValue={ingredient?.handlingPrecautions ?? ""} className="input" />
            </Field>
            <Field label="Safety & handling — general notes (optional)">
              <textarea name="safetyNotes" rows={2} defaultValue={ingredient?.safetyNotes ?? ""} className="input" />
            </Field>
          </FormSection>

          <FormSection title="Manufacturing Notes">
            <textarea name="manufacturingNotes" rows={2} defaultValue={ingredient?.manufacturingNotes ?? ""} className="input" />
          </FormSection>

          <FormSection title="Quality Specifications">
            <div className="grid grid-cols-2 gap-3">
              {QC_FIELDS.map((f) => (
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
            <Field label="Other QC / CoA parameters (optional)">
              <textarea name="qcNotes" rows={2} defaultValue={ingredient?.qcNotes ?? ""} className="input" />
            </Field>
          </FormSection>

          <FormSection title="Physical Properties">
            <div className="grid grid-cols-2 gap-3">
              {PHYSICAL_FIELDS.map((f) => (
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
          </FormSection>

          <FormSection title="Related Ingredients & References">
            <Field label="Related ingredients (comma or line separated; matched by exact name)">
              <textarea name="relatedIngredientsText" rows={2} defaultValue={ingredient?.relatedIngredientsText ?? ""} className="input" />
            </Field>
            <Field label="References (one per line — e.g. TGA, PubChem, APVMA, USP, EP, Supplier Specification)">
              <textarea name="referencesText" rows={2} defaultValue={ingredient?.referencesText ?? ""} className="input" />
            </Field>
          </FormSection>

          <FormSection title="Other">
            <Field label="FAQ (optional)">
              <textarea name="faq" rows={2} defaultValue={ingredient?.faq ?? ""} className="input" />
            </Field>
            <Field label="Source (optional)">
              <input
                name="source"
                defaultValue={ingredient?.source ?? ""}
                placeholder="e.g. TGA Ingredients Table"
                className="input"
              />
            </Field>
          </FormSection>

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
