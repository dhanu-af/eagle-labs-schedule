"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markAttendance,
  requestLeave,
  updateLeaveStatus,
} from "@/lib/actions/attendance-actions";
import { ATTENDANCE_CLASS, ATTENDANCE_LABEL, LEAVE_STATUS_CLASS, initials } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

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
      <PageHeader
        title="Attendance & Leave"
        subtitle="Daily attendance, overtime and leave balances."
        actions={
          <>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => changeDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
            {currentEmployeeId && <Button onClick={() => setShowLeaveForm(true)}>Request Leave</Button>}
          </>
        }
      />

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Employee</Th>
              <Th>Team</Th>
              <Th>Status</Th>
              <Th>Hours</Th>
              <Th>Overtime</Th>
              <Th>Leave Balance</Th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <AttendanceRow key={e.id} employee={e} dateStr={dateStr} canManage={canManage} />
            ))}
          </tbody>
        </table>
      </Card>

      <Card padding="sm">
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Leave Requests</h2>
        <div className="space-y-2">
          {leaveRequests.length === 0 && (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          )}
          {leaveRequests.map((l) => (
            <LeaveRowItem key={l.id} leave={l} canManage={canManage} />
          ))}
        </div>
      </Card>

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
    <tr className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initials(employee.name)}
          </div>
          <span className="text-foreground">{employee.name}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{employee.teamName}</td>
      <td className="px-4 py-2.5">
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
      <td className="px-4 py-2.5">
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
          <span className="tabular-nums text-foreground">{hours}h</span>
        )}
      </td>
      <td className="px-4 py-2.5">
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
          <span className="tabular-nums text-foreground">{overtime}h</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="tabular-nums text-foreground">{employee.leaveBalance} days</span>
        {dirty && canManage && (
          <Button onClick={save} disabled={pending} size="sm" className="ml-2">
            {pending ? "..." : "Save"}
          </Button>
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
            <Button variant="success" size="sm" disabled={pending} onClick={() => act("APPROVED")}>
              Approve
            </Button>
            <Button variant="danger" size="sm" disabled={pending} onClick={() => act("REJECTED")}>
              Reject
            </Button>
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
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Request Leave</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</span>
              <input name="startDate" type="date" required className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">End Date</span>
              <input name="endDate" type="date" required className="input" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Type</span>
            <select name="type" defaultValue="Annual" className="input">
              <option>Annual</option>
              <option>Sick</option>
              <option>Unpaid</option>
              <option>Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Reason</span>
            <textarea name="reason" rows={2} className="input" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
