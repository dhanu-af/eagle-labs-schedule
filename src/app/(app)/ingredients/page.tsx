import { redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { getIngredients, hasIngredientLibraryAccess, getIngredientLibraryAccessList } from "@/lib/actions/ingredient-actions";
import IngredientsClient from "./ingredients-client";

export default async function IngredientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isSuperAdmin = canEdit(session.role);
  const allowed = await hasIngredientLibraryAccess();
  if (!allowed) redirect("/");

  const [ingredients, accessList] = await Promise.all([
    getIngredients(),
    isSuperAdmin ? getIngredientLibraryAccessList() : Promise.resolve([]),
  ]);

  return (
    <IngredientsClient
      canEdit={isSuperAdmin}
      accessList={accessList.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        ingredientLibraryAccess: u.ingredientLibraryAccess,
      }))}
      ingredients={ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        alternateName: i.alternateName,
        type: i.type,
        category: i.category,
        aanLabel: i.aanLabel,
        aanValue: i.aanValue,
        notes: i.notes,
        verified: i.verified,
        verificationSource: i.verificationSource,
        verifiedAt: i.verifiedAt ? i.verifiedAt.toISOString() : null,
        verifiedBy: i.verifiedBy,
        classification: i.classification,
        mainBenefit: i.mainBenefit,
        usedFor: i.usedFor,
        synonyms: i.synonyms,
        chemicalName: i.chemicalName,
        casNumber: i.casNumber,
        molecularFormula: i.molecularFormula,
        molecularWeight: i.molecularWeight,
        tgaStatus: i.tgaStatus,
        apvmaStatus: i.apvmaStatus,
        fdaStatus: i.fdaStatus,
        emaStatus: i.emaStatus,
        aicisStatus: i.aicisStatus,
        regulatoryStatus: i.regulatoryStatus,
        primaryUse: i.primaryUse,
        industry: i.industry,
        productTypes: i.productTypes,
        typicalDosage: i.typicalDosage,
        storageConditions: i.storageConditions,
        shelfLife: i.shelfLife,
        safetyNotes: i.safetyNotes,
        ghsClassification: i.ghsClassification,
        signalWord: i.signalWord,
        ppe: i.ppe,
        handlingPrecautions: i.handlingPrecautions,
        manufacturingNotes: i.manufacturingNotes,
        qcNotes: i.qcNotes,
        qcIdentity: i.qcIdentity,
        qcAssay: i.qcAssay,
        qcMoisture: i.qcMoisture,
        qcHeavyMetals: i.qcHeavyMetals,
        qcMicrobialLimits: i.qcMicrobialLimits,
        appearance: i.appearance,
        colour: i.colour,
        odour: i.odour,
        solubility: i.solubility,
        density: i.density,
        meltingPoint: i.meltingPoint,
        phValue: i.phValue,
        relatedIngredientsText: i.relatedIngredientsText,
        referencesText: i.referencesText,
        faq: i.faq,
        source: i.source,
      }))}
    />
  );
}
