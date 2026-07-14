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
        mainBenefit: i.mainBenefit,
        usedFor: i.usedFor,
        synonyms: i.synonyms,
        casNumber: i.casNumber,
        typicalDosage: i.typicalDosage,
        storageConditions: i.storageConditions,
        shelfLife: i.shelfLife,
        safetyNotes: i.safetyNotes,
        manufacturingNotes: i.manufacturingNotes,
        qcNotes: i.qcNotes,
        regulatoryStatus: i.regulatoryStatus,
        faq: i.faq,
        source: i.source,
      }))}
    />
  );
}
