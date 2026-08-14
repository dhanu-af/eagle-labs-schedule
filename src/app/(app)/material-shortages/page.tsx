import { getSession, canManageMaterialShortages } from "@/lib/auth";
import { listMaterialShortages } from "@/lib/actions/material-shortage-actions";
import MaterialShortageClient from "./material-shortage-client";

export default async function MaterialShortagesPage() {
  const session = await getSession();
  const shortages = await listMaterialShortages();

  return <MaterialShortageClient shortages={shortages} canManage={!!session && canManageMaterialShortages(session.role)} />;
}
