"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markAttendance,
  requestLeave,
  updateLeaveStatus,
} from "@/lib/actions/attendance-actions";
import { ATTENDANCE_CLASS, ATTENDANCE_LABEL, LEAVE_STATUS_CLASS, initials } from "@/lib/ui";

type EmployeeRow = {
  id: string;
  name: string;
  teamName: string;
  leaveBalance: number;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
  hoursWorked: number;
  overtime: number;
};
type LeaveRow = {
  id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"] as const;

export default function AttendanceClient({
  dateStr,
  employees,
  leaveRequests,
  canManage,
  currentEmployeeId,
}: {
  dateStr: string;
  employees: EmployeeRow[];
  leaveRequests: LeaveRow[];
  canManage: boolean;
  currentEmployeeId: string | null;
}) {
  const router = useRouter();
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  function changeDate(newDate: string) {
    router.push(`/attendance?date=${newDate}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Attendance &amp; Leave</h1>
          <p className="text-sm text-muted-foreground">Daily attendance, overtime and leave balances.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateStr}
            onChange={(e) => changeDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
          {currentEmployeeId && (
            <button
              onClick={() => setShowLeaveForm(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Request Leave
            </button>
          )}
        </div>
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Hours</th>
              <th className="px-4 py-2">Overtime</th>
              <th className="px-4 py-2">Leave Balance</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <AttendanceRow key={e.id} employee={e} dateStr={dateStr} canManage={canManage} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Leave Requests</h2>
        <div className="space-y-2">
          {leaveRequests.length === 0 && (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          )}
          {leaveRequests.map((l) => (
            <LeaveRowItem key={l.id} leave={l} canManage={canManage} />
          ))}
        </div>
      </div>

      {showLeaveForm && (
        <LeaveModal onClose={() => setShowLeaveForm(false)} />
      )}
    </div>
  );
}

function AttendanceRow({
  employee,
  dateStr,
  canManage,
}: {
  employee: EmployeeRow;
  dateStr: string;
  canManage: boolean;
}) {
  const [status, setStatus] = useState(employee.status);
  const [hours, setHours] = useState(employee.hoursWorked);
  const [overtime, setOvertime] = useState(employee.overtime);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await markAttendance(employee.id, dateStr, status, hours, overtime);
      setDirty(false);
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
        </div>
      </td>
      <td className="px-4 py-2 text-muted-foreground">{employee.teamName}</td>
      <td className="px-4 py-2">
        {canManage ? (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as EmployeeRow["status"]);
              setDirty(true);
            }}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ATTENDANCE_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ATTENDANCE_CLASS[status]}`}>
            {ATTENDANCE_LABEL[status]}
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {canManage ? (
          <input
            type="number"
            step="0.5"
            value={hours}
            onChange={(e) => {
              setHours(Number(e.target.value));
              setDirty(true);
            }}
            className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
          />
        ) : (
          <span className="text-foreground">{hours}h</span>
        )}
      </td>
      <td className="px-4 py-2">
        {canManage ? (
          <input
            type="number"
            step="0.5"
            value={overtime}
            onChange={(e) => {
              setOvertime(Number(e.target.value));
              setDirty(true);
            }}
            className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
          />
        ) : (
          <span className="text-foreground">{overtime}h</span>
        )}
      </td>
      <td className="px-4 py-2">
        <span className="text-foreground">{employee.leaveBalance} days</span>
        {dirty && canManage && (
          <button
            onClick={save}
            disabled={pending}
            className="ml-2 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "..." : "Save"}
          </button>
        )}
      </td>
    </tr>
  );
}

function LeaveRowItem({ leave, canManage }: { leave: LeaveRow; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await updateLeaveStatus(leave.id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">
          {leave.employeeName} · {leave.type}
        </p>
        <p className="text-xs text-muted-foreground">
          {leave.startDate} → {leave.endDate}
          {leave.reason ? ` · ${leave.reason}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LEAVE_STATUS_CLASS[leave.status]}`}>
          {leave.status}
        </span>
        {canManage && leave.status === "PENDING" && (
          <>
            <button
              disabled={pending}
              onClick={() => act("APPROVED")}
              className="rounded-lg bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              disabled={pending}
              onClick={() => act("REJECTED")}
              className="rounded-lg bg-danger/10 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LeaveModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await requestLeave(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Request Leave</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</span>
              <input name="startDate" type="date" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">End Date</span>
              <input name="endDate" type="date" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Type</span>
            <select name="type" defaultValue="Annual" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
              <option>Annual</option>
              <option>Sick</option>
              <option>Unpaid</option>
              <option>Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Reason</span>
            <textarea name="reason" rows={2} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
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
              {pending ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
