"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteUser, setUserDisabled, unlockUser } from "@/lib/actions/user-management-actions";
import type { Role } from "@/generated/prisma";
import UserFormModal from "./user-form-modal";
import ResetPasswordModal from "./reset-password-modal";

export type ManagedUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  department: string | null;
  disabled: boolean;
  locked: boolean;
  isPermanent: boolean;
  createdAt: string;
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  TEAM_LEAD: "Team Lead",
  QA: "QA",
  EMPLOYEE: "Operator",
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">User Management</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create and manage login accounts. Only the Super Admin can create, edit, reset
            passwords for, enable/disable, or delete users.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/login-history"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Login History
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + Add User
          </button>
        </div>
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-muted/50">
                  <td className="px-4 py-2">
                    <p className="font-medium text-foreground">
                      {u.username}
                      {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.fullName}</p>
                  </td>
                  <td className="px-4 py-2">
                    {u.isPermanent ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        🔒 Super Admin (System Owner)
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-foreground">
                        {ROLE_LABEL[u.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.department ?? "—"}</td>
                  <td className="px-4 py-2">
                    {u.locked ? (
                      <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                        Locked
                      </span>
                    ) : u.disabled ? (
                      <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        Disabled
                      </span>
                    ) : (
                      <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString("en-AU")}
                  </td>
                  <td className="px-4 py-2">
                    {u.isPermanent ? (
                      <span className="text-xs text-muted-foreground">Protected system account — cannot be edited</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setEditUser(u)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setResetUser(u)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Reset Password
                        </button>
                        {u.locked && (
                          <button
                            disabled={pending}
                            onClick={() => unlock(u)}
                            className="text-xs text-info hover:opacity-80 disabled:opacity-60"
                          >
                            Unlock
                          </button>
                        )}
                        <button
                          disabled={pending}
                          onClick={() => toggleDisabled(u)}
                          className="text-xs text-warning hover:opacity-80 disabled:opacity-60"
                        >
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => remove(u)}
                          className="text-xs text-danger hover:opacity-80 disabled:opacity-60"
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
      </div>

      {showAdd && <UserFormModal onClose={() => setShowAdd(false)} />}
      {editUser && <UserFormModal user={editUser} onClose={() => setEditUser(null)} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  );
}
