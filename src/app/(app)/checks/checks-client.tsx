"use client";

import { useState } from "react";
import type { CheckStatus, CleaningType, EnvArea, PostOpItem, Role } from "@/generated/prisma";
import SupervisorPreOpTab from "./supervisor-preop-tab";
import QaPreOpTab from "./qa-preop-tab";
import EnvironmentalTab from "./environmental-tab";
import LineClearanceTab from "./line-clearance-tab";
import PostOpTab from "./post-op-tab";

export type Permissions = {
  canSupervisor: boolean;
  canQa: boolean;
  canOperator: boolean;
  canUnlock: boolean;
};

export type SupervisorPreOp = {
  id: string;
  date: string;
  room: string;
  roomCleanliness: boolean;
  equipmentReadiness: boolean;
  safetyPpeVerified: boolean;
  calibrationStatus: string | null;
  comments: string | null;
  status: CheckStatus;
  locked: boolean;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt: string;
  signature: string;
};

export type QaPreOp = {
  id: string;
  date: string;
  room: string;
  qaRoomInspection: boolean;
  equipmentVerification: boolean;
  gmpCompliance: boolean;
  environmentalCondition: boolean;
  comments: string | null;
  status: CheckStatus;
  locked: boolean;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt: string;
  signature: string;
};

export type EnvironmentalCheckRow = {
  id: string;
  date: string;
  area: EnvArea;
  temperature: number;
  humidity: number;
  passFail: boolean;
  remarks: string | null;
  status: CheckStatus;
  locked: boolean;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt: string;
  signature: string;
  supervisorApprovedByName: string | null;
  supervisorApprovedAt: string | null;
  qaApprovedByName: string | null;
  qaApprovedAt: string | null;
};

export type EnvLimit = {
  id: string;
  area: EnvArea;
  minTemp: number;
  maxTemp: number;
  minRH: number;
  maxRH: number;
};

export type LineClearanceRow = {
  id: string;
  date: string;
  line: string;
  previousBatchCleared: boolean;
  materialCleared: boolean;
  labelPackagingCleared: boolean;
  equipmentCleared: boolean;
  documentationVerified: boolean;
  comments: string | null;
  status: CheckStatus;
  locked: boolean;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt: string;
  signature: string;
  supervisorApprovedByName: string | null;
  supervisorApprovedAt: string | null;
  qaApprovedByName: string | null;
  qaApprovedAt: string | null;
};

export type PostOpRow = {
  id: string;
  date: string;
  item: PostOpItem;
  cleaningType: CleaningType;
  cleaningVerificationStatus: string | null;
  comments: string | null;
  status: CheckStatus;
  locked: boolean;
  submittedByName: string;
  submittedByRole: Role;
  submittedAt: string;
  signature: string;
  verifiedByName: string | null;
  verifiedAt: string | null;
};

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "supervisor", label: "Supervisor Pre-Op" },
  { key: "qa", label: "QA Pre-Op" },
  { key: "environmental", label: "RH & Temperature" },
  { key: "clearance", label: "Line Clearance" },
  { key: "postop", label: "Post-Op Checks" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ChecksClient({
  permissions,
  supervisorPreOp,
  qaPreOp,
  environmental,
  envLimits,
  lineClearance,
  postOp,
}: {
  permissions: Permissions;
  supervisorPreOp: SupervisorPreOp[];
  qaPreOp: QaPreOp[];
  environmental: EnvironmentalCheckRow[];
  envLimits: EnvLimit[];
  lineClearance: LineClearanceRow[];
  postOp: PostOpRow[];
}) {
  const [tab, setTab] = useState<TabKey>("dashboard");

  const allStatuses = [
    ...supervisorPreOp.map((r) => r.status),
    ...qaPreOp.map((r) => r.status),
    ...environmental.map((r) => r.status),
    ...lineClearance.map((r) => r.status),
    ...postOp.map((r) => r.status),
  ];
  const counts = {
    PENDING: allStatuses.filter((s) => s === "PENDING").length,
    IN_PROGRESS: allStatuses.filter((s) => s === "IN_PROGRESS").length,
    COMPLETED: allStatuses.filter((s) => s === "COMPLETED").length,
    APPROVED: allStatuses.filter((s) => s === "APPROVED").length,
  };
  const oosCount = environmental.filter((r) => !r.passFail).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Checks</h1>
        <p className="text-sm text-muted-foreground">
          Supervisor &amp; QA pre-operational checks, environmental monitoring, line clearance, and post-op cleaning verification.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Pending" value={counts.PENDING} tint="var(--warning)" />
            <StatCard label="In Progress" value={counts.IN_PROGRESS} tint="var(--info)" />
            <StatCard label="Completed" value={counts.COMPLETED} tint="var(--success)" />
            <StatCard label="Approved" value={counts.APPROVED} tint="var(--primary)" />
            <StatCard label="OOS Readings" value={oosCount} tint="var(--danger)" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SectionSummary
              title="Supervisor Pre-Op"
              total={supervisorPreOp.length}
              onClick={() => setTab("supervisor")}
            />
            <SectionSummary title="QA Pre-Op" total={qaPreOp.length} onClick={() => setTab("qa")} />
            <SectionSummary
              title="RH & Temperature"
              total={environmental.length}
              badge={oosCount > 0 ? `${oosCount} OOS` : undefined}
              onClick={() => setTab("environmental")}
            />
            <SectionSummary
              title="Line Clearance"
              total={lineClearance.length}
              onClick={() => setTab("clearance")}
            />
            <SectionSummary title="Post-Op Checks" total={postOp.length} onClick={() => setTab("postop")} />
          </div>
        </div>
      )}

      {tab === "supervisor" && (
        <SupervisorPreOpTab rows={supervisorPreOp} canSubmit={permissions.canSupervisor} canUnlock={permissions.canUnlock} />
      )}
      {tab === "qa" && (
        <QaPreOpTab rows={qaPreOp} canSubmit={permissions.canQa} canUnlock={permissions.canUnlock} />
      )}
      {tab === "environmental" && (
        <EnvironmentalTab
          rows={environmental}
          limits={envLimits}
          canRecord={permissions.canOperator}
          canApproveSupervisor={permissions.canSupervisor}
          canApproveQa={permissions.canQa}
          canConfigureLimits={permissions.canUnlock}
          canUnlock={permissions.canUnlock}
        />
      )}
      {tab === "clearance" && (
        <LineClearanceTab
          rows={lineClearance}
          canSubmit={permissions.canSupervisor || permissions.canQa}
          canApproveSupervisor={permissions.canSupervisor}
          canApproveQa={permissions.canQa}
          canUnlock={permissions.canUnlock}
        />
      )}
      {tab === "postop" && (
        <PostOpTab
          rows={postOp}
          canSubmit={permissions.canOperator}
          canVerify={permissions.canSupervisor}
          canUnlock={permissions.canUnlock}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold" style={{ color: tint }}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionSummary({
  title,
  total,
  badge,
  onClick,
}: {
  title: string;
  total: number;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-shadow flex items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{total} records</p>
      </div>
      {badge && (
        <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
          {badge}
        </span>
      )}
    </button>
  );
}
