"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, createTeam, deleteEmployee, deleteTeam, updateEmployee, updateTeam } from "@/lib/actions/team-actions";
import { initials } from "@/lib/ui";

type Role = "SUPER_ADMIN" | "ADMIN" | "SUPERVISOR" | "TEAM_LEAD" | "QA" | "EMPLOYEE";
type Team = { id: string; name: string; description: string | null };
type Employee = {
  id: string;
  name: string;
  role: Role;
  teamId: string;
  teamName: string;
  shift: string;
  active: boolean;
  photoUrl: string | null;
  isPermanent: boolean;
};
const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "TEAM_LEAD", "QA", "EMPLOYEE"];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  TEAM_LEAD: "Team Lead",
  QA: "QA",
  EMPLOYEE: "Operator",
};

export default function TeamClient({
  currentRole,
  canEdit,
  teams,
  employees: initialEmployees,
}: {
  currentRole: Role;
  canEdit: boolean;
  teams: Team[];
  employees: Employee[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const assignableRoles =
    currentRole === "SUPER_ADMIN" ? ALL_ROLES : (["ADMIN", "SUPERVISOR", "TEAM_LEAD", "QA", "EMPLOYEE"] as Role[]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">The Heart of Production</h1>
          <p className="text-sm text-muted-foreground">Manage teams, roles, shifts and employee records.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddTeam(true)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              + Add Team
            </button>
            <button
              onClick={() => setShowAddEmployee(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + Add Employee
            </button>
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-xs text-muted-foreground">
          View-only — only the Super Admin can make changes here.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {teams.map((t) => (
          <div key={t.id} className="group relative card-shadow rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">{t.name}</p>
            <p className="text-xs text-muted-foreground">
              {employees.filter((e) => e.teamId === t.id).length} members
            </p>
            {canEdit && (
              <button
                onClick={() => setEditTeam(t)}
                className="absolute right-2 top-2 hidden text-xs text-muted-foreground hover:text-primary group-hover:block"
              >
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Shift</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <EmployeeRow
                key={e.id}
                employee={e}
                teams={teams}
                assignableRoles={assignableRoles}
                canEdit={canEdit}
                onUpdated={(updated) =>
                  setEmployees((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && showAddTeam && <AddTeamModal onClose={() => setShowAddTeam(false)} />}
      {canEdit && editTeam && <EditTeamModal team={editTeam} onClose={() => setEditTeam(null)} />}
      {canEdit && showAddEmployee && (
        <AddEmployeeModal
          teams={teams}
          assignableRoles={assignableRoles}
          onClose={() => setShowAddEmployee(false)}
        />
      )}
    </div>
  );
}

function EmployeeRow({
  employee,
  teams,
  assignableRoles,
  canEdit,
  onUpdated,
}: {
  employee: Employee;
  teams: Team[];
  assignableRoles: Role[];
  canEdit: boolean;
  onUpdated: (e: Employee) => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState(employee.role);
  const [teamId, setTeamId] = useState(employee.teamId);
  const [shift, setShift] = useState(employee.shift);
  const [active, setActive] = useState(employee.active);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const locked = employee.isPermanent;
  const disabled = locked || !canEdit;

  function save() {
    startTransition(async () => {
      await updateEmployee(employee.id, { role, teamId, shift, active });
      const team = teams.find((t) => t.id === teamId);
      onUpdated({ ...employee, role, teamId, teamName: team?.name ?? employee.teamName, shift, active });
      setDirty(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Remove ${employee.name} from the roster? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteEmployee(employee.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not remove employee");
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-surface-muted/50">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initials(employee.name)}
          </div>
          <span className="text-foreground">{employee.name}</span>
          {locked && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Protected
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <select
          value={teamId}
          disabled={disabled}
          onChange={(e) => {
            setTeamId(e.target.value);
            setDirty(true);
          }}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:opacity-50"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <select
          value={role}
          disabled={disabled}
          onChange={(e) => {
            setRole(e.target.value as Role);
            setDirty(true);
          }}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:opacity-50"
        >
          {(assignableRoles.includes(role) ? assignableRoles : [role, ...assignableRoles]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <select
          value={shift}
          disabled={disabled}
          onChange={(e) => {
            setShift(e.target.value);
            setDirty(true);
          }}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:opacity-50"
        >
          <option>Day</option>
          <option>Night</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            disabled={disabled}
            onChange={(e) => {
              setActive(e.target.checked);
              setDirty(true);
            }}
          />
          <span className="text-xs text-muted-foreground">{active ? "Active" : "Inactive"}</span>
        </label>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {dirty && !disabled && (
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "..." : "Save"}
            </button>
          )}
          {!locked && canEdit && (
            <button
              onClick={remove}
              disabled={pending}
              className="text-xs text-danger hover:opacity-80 disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddTeamModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await createTeam(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add Team</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
            <input name="name" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Description</span>
            <input name="description" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Add Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTeamModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await updateTeam(team.id, {
        name: String(formData.get("name") || team.name),
        description: String(formData.get("description") || ""),
      });
      router.refresh();
      onClose();
    });
  }

  function remove() {
    if (!confirm(`Delete team "${team.name}"? This only works if it has no active employees.`)) return;
    startTransition(async () => {
      try {
        await deleteTeam(team.id);
        router.refresh();
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not delete team");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Edit Team</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
            <input name="name" required defaultValue={team.name} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Description</span>
            <input name="description" defaultValue={team.description ?? ""} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" onClick={remove} className="rounded-lg border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/10">
              Delete
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddEmployeeModal({
  teams,
  assignableRoles,
  onClose,
}: {
  teams: Team[];
  assignableRoles: Role[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await createEmployee(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add Employee</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
            <input name="name" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Team</span>
              <select name="teamId" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Role</span>
              <select name="role" defaultValue="EMPLOYEE" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Shift</span>
            <select name="shift" defaultValue="Day" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
              <option>Day</option>
              <option>Night</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
