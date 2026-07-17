"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/lib/actions/user-management-actions";
import type { Role } from "@/generated/prisma";
import { ROLE_LABEL, type ManagedUser } from "./user-management-client";
import { RESTRICTED_PAGE_OPTIONS, DEFAULT_RESTRICTED_HREF } from "@/lib/restricted-pages";
import { Button } from "@/components/ui/Button";

const ROLE_OPTIONS: Role[] = ["ADMIN", "SUPERVISOR", "OPERATIONS", "TEAM_LEAD", "QA", "EMPLOYEE", "OTHERS"];

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
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYEE");

  function submit(formData: FormData) {
    const fullName = String(formData.get("fullName") ?? "");
    const role = formData.get("role") as Role;
    const department = String(formData.get("department") ?? "");
    const restrictedToHref = role === "OTHERS" ? String(formData.get("restrictedToHref") ?? DEFAULT_RESTRICTED_HREF) : null;

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateUser(user!.id, { fullName, role, department, restrictedToHref });
        } else {
          const username = String(formData.get("username") ?? "");
          const password = String(formData.get("password") ?? "");
          const disabled = formData.get("status") === "Disabled";
          // New OTHERS users default to Dhanu AI; set a different restricted page via Edit afterwards.
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
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
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
          {role === "OTHERS" && (
            <Field label="Restricted Page">
              <select name="restrictedToHref" defaultValue={user?.restrictedToHref ?? DEFAULT_RESTRICTED_HREF} className="input">
                {RESTRICTED_PAGE_OPTIONS.map((p) => (
                  <option key={p.href} value={p.href}>
                    {p.icon} {p.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                &quot;Others&quot; role users see only this one page in their nav.
              </span>
            </Field>
          )}
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
