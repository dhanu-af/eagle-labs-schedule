"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteUser, setUserDisabled, unlockUser } from "@/lib/actions/user-management-actions";
import type { Role } from "@/generated/prisma";
import UserFormModal from "./user-form-modal";
import ResetPasswordModal from "./reset-password-modal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

export type ManagedUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  department: string | null;
  disabled: boolean;
  locked: boolean;
  isPermanent: boolean;
  restrictedToHref: string | null;
  createdAt: string;
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  OPERATIONS: "Operations",
  TEAM_LEAD: "Team Lead",
  QA: "QA",
  EMPLOYEE: "Operator",
  OTHERS: "Others",
  EXTRA: "Extra",
};

export default function UserManagementClient({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: ManagedUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);

  function toggleDisabled(u: ManagedUser) {
    startTransition(async () => {
      await setUserDisabled(u.id, !u.disabled);
      router.refresh();
    });
  }

  function unlock(u: ManagedUser) {
    startTransition(async () => {
      await unlockUser(u.id);
      router.refresh();
    });
  }

  function remove(u: ManagedUser) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteUser(u.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not delete user");
      }
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        subtitle={
          <span className="max-w-2xl">
            Create and manage login accounts. Only the Super Admin can create, edit, reset
            passwords for, enable/disable, or delete users.
          </span>
        }
        actions={
          <>
            <Link
              href="/login-history"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted active:scale-[0.98]"
            >
              Login History
            </Link>
            <Button onClick={() => setShowAdd(true)}>+ Add User</Button>
          </>
        }
      />

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Username</Th>
              <Th>Role</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">
                      {u.username}
                      {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.fullName}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.isPermanent ? (
                      <Badge tone="primary" className="gap-1">
                        🔒 Super Admin (System Owner)
                      </Badge>
                    ) : (
                      <Badge tone="muted">{ROLE_LABEL[u.role]}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.department ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {u.locked ? (
                      <Badge tone="danger">Locked</Badge>
                    ) : u.disabled ? (
                      <Badge tone="warning">Disabled</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString("en-AU")}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.isPermanent ? (
                      <span className="text-xs text-muted-foreground">Protected system account — cannot be edited</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setEditUser(u)}
                          className="text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setResetUser(u)}
                          className="text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
                        >
                          Reset Password
                        </button>
                        {u.locked && (
                          <button
                            disabled={pending}
                            onClick={() => unlock(u)}
                            className="text-xs font-medium text-info transition-colors duration-150 ease-out hover:opacity-80 disabled:opacity-60"
                          >
                            Unlock
                          </button>
                        )}
                        <button
                          disabled={pending}
                          onClick={() => toggleDisabled(u)}
                          className="text-xs font-medium text-warning transition-colors duration-150 ease-out hover:opacity-80 disabled:opacity-60"
                        >
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => remove(u)}
                          className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {showAdd && <UserFormModal onClose={() => setShowAdd(false)} />}
      {editUser && <UserFormModal user={editUser} onClose={() => setEditUser(null)} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  );
}
