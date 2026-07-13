"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/lib/actions/user-management-actions";
import type { Role } from "@/generated/prisma";
import { ROLE_LABEL, type ManagedUser } from "./user-management-client";
import { Button } from "@/components/ui/Button";

const ROLE_OPTIONS: Role[] = ["ADMIN", "SUPERVISOR", "TEAM_LEAD", "QA", "EMPLOYEE"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function UserFormModal({
  user,
  onClose,
}: {
  user?: ManagedUser;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!user;

  function submit(formData: FormData) {
    const fullName = String(formData.get("fullName") ?? "");
    const role = formData.get("role") as Role;
    const department = String(formData.get("department") ?? "");

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateUser(user!.id, { fullName, role, department });
        } else {
          const username = String(formData.get("username") ?? "");
          const password = String(formData.get("password") ?? "");
          const disabled = formData.get("status") === "Disabled";
          await createUser({ fullName, username, password, role, department, disabled });
        }
        router.refresh();
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit User" : "Add User"}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <Field label="Full Name">
            <input
              name="fullName"
              required
              defaultValue={user?.fullName ?? ""}
              className="input"
            />
          </Field>
          {!isEdit && (
            <>
              <Field label="User ID (Username)">
                <input
                  name="username"
                  required
                  className="input"
                />
              </Field>
              <Field label="Temporary Password">
                <input
                  name="password"
                  type="text"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="input"
                />
              </Field>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select
                name="role"
                defaultValue={user?.role ?? "EMPLOYEE"}
                className="input"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <input
                name="department"
                defaultValue={user?.department ?? ""}
                className="input"
              />
            </Field>
          </div>
          {!isEdit && (
            <Field label="Status">
              <select
                name="status"
                defaultValue="Active"
                className="input"
              >
                <option>Active</option>
                <option>Disabled</option>
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save Changes" : "Add User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
