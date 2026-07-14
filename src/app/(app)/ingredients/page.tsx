import { redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { getIngredients } from "@/lib/actions/ingredient-actions";
import IngredientsClient from "./ingredients-client";

export default async function IngredientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const ingredients = await getIngredients();

  return (
    <IngredientsClient
      canEdit={canEdit(session.role)}
      ingredients={ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        alternateName: i.alternateName,
        type: i.type,
        category: i.category,
        aanLabel: i.aanLabel,
        aanValue: i.aanValue,
        notes: i.notes,
        source: i.source,
      }))}
    />
  );
}
