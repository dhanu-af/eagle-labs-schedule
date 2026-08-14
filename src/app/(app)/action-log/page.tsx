import { getSession, canManageActionLog } from "@/lib/auth";
import { listActionLog } from "@/lib/actions/action-log-actions";
import ActionLogClient from "./action-log-client";

export default async function ActionLogPage() {
  const session = await getSession();
  const entries = await listActionLog();

  return (
    <ActionLogClient
      entries={entries.map((e) => ({
        id: e.id,
        actionNumber: e.actionNumber,
        dateRaised: e.dateRaised.toISOString(),
        sourceSection: e.sourceSection,
        issue: e.issue,
        businessImpact: e.businessImpact,
        priority: e.priority,
        owner: e.owner,
        dueDate: e.dueDate ? e.dueDate.toISOString() : null,
        status: e.status,
        escalationLevel: e.escalationLevel,
        resolution: e.resolution,
        closedDate: e.closedDate ? e.closedDate.toISOString() : null,
        createdByName: e.createdByName,
      }))}
      canManage={!!session && canManageActionLog(session.role)}
    />
  );
}
