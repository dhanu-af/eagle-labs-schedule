import { getSession, canManageMaterialShortages } from "@/lib/auth";
import { listMaterialShortages } from "@/lib/actions/material-shortage-actions";
import { listTaskRequestRecipients } from "@/lib/actions/task-request-actions";
import MaterialShortageClient from "./material-shortage-client";

export default async function MaterialShortagesPage() {
  const session = await getSession();
  const [shortages, taskRequestRecipients] = await Promise.all([listMaterialShortages(), listTaskRequestRecipients()]);

  return (
    <MaterialShortageClient
      shortages={shortages}
      canManage={!!session && canManageMaterialShortages(session.role)}
      taskRequestRecipients={taskRequestRecipients}
    />
  );
}
