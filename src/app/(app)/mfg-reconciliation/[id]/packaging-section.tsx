"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MfgPackagingMaterialType } from "@/generated/prisma";
import { savePackaging } from "@/lib/actions/mfg-reconciliation-actions";
import { PACKAGING_MATERIAL_TYPE_LABEL, DEFAULT_PACKAGING_MATERIAL_LINES, computeBalance } from "@/lib/mfg-reconciliation-defaults";
import { Button } from "@/components/ui/Button";
import { Field, Section } from "./mfg-batch-detail-client";

export type PackagingMaterialLineData = {
  materialType: MfgPackagingMaterialType;
  issued: number | null;
  used: number | null;
  damaged: number | null;
  returned: number | null;
  destroyed: number | null;
};

export type PackagingData = {
  packedBottles: number | null;
  cartonsProduced: number | null;
  casesProduced: number | null;
  packedByName: string | null;
  packedAt: string | null;
  remarks: string | null;
  lines: PackagingMaterialLineData[];
};

type LineForm = {
  materialType: MfgPackagingMaterialType;
  issued: string;
  used: string;
  damaged: string;
  returned: string;
  destroyed: string;
};

function toLineForm(l: PackagingMaterialLineData): LineForm {
  return {
    materialType: l.materialType,
    issued: l.issued?.toString() ?? "",
    used: l.used?.toString() ?? "",
    damaged: l.damaged?.toString() ?? "",
    returned: l.returned?.toString() ?? "",
    destroyed: l.destroyed?.toString() ?? "",
  };
}

function num(v: number | null | undefined) {
  return v?.toString() ?? "";
}

export default function PackagingSection({ batchId, data, canManage }: { batchId: string; data: PackagingData | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [header, setHeader] = useState({
    packedBottles: num(data?.packedBottles),
    cartonsProduced: num(data?.cartonsProduced),
    casesProduced: num(data?.casesProduced),
    packedByName: data?.packedByName ?? "",
    packedAt: data?.packedAt?.slice(0, 10) ?? "",
    remarks: data?.remarks ?? "",
  });
  const [lines, setLines] = useState<LineForm[]>(() =>
    (data?.lines.length ? data.lines : DEFAULT_PACKAGING_MATERIAL_LINES.map((materialType) => ({ materialType, issued: null, used: null, damaged: null, returned: null, destroyed: null }))).map(
      toLineForm
    )
  );

  function setHeaderField<K extends keyof typeof header>(key: K, value: (typeof header)[K]) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await savePackaging(
          batchId,
          {
            packedBottles: header.packedBottles === "" ? null : Number(header.packedBottles),
            cartonsProduced: header.cartonsProduced === "" ? null : Number(header.cartonsProduced),
            casesProduced: header.casesProduced === "" ? null : Number(header.casesProduced),
            packedByName: header.packedByName || null,
            packedAt: header.packedAt || null,
            remarks: header.remarks || null,
          },
          lines.map((l) => ({
            materialType: l.materialType,
            issued: l.issued === "" ? null : Number(l.issued),
            used: l.used === "" ? null : Number(l.used),
            damaged: l.damaged === "" ? null : Number(l.damaged),
            returned: l.returned === "" ? null : Number(l.returned),
            destroyed: l.destroyed === "" ? null : Number(l.destroyed),
          }))
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Section title="Materials">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">Material</th>
                <th className="px-2 py-1">Issued</th>
                <th className="px-2 py-1">Used</th>
                <th className="px-2 py-1">Damaged</th>
                <th className="px-2 py-1">Returned</th>
                <th className="px-2 py-1">Destroyed</th>
                <th className="px-2 py-1">Balance</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.materialType} className="border-t border-border">
                  <td className="px-2 py-1 font-medium text-foreground">{PACKAGING_MATERIAL_TYPE_LABEL[l.materialType]}</td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.issued} onChange={(e) => updateLine(i, { issued: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.used} onChange={(e) => updateLine(i, { used: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.damaged} onChange={(e) => updateLine(i, { damaged: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.returned} onChange={(e) => updateLine(i, { returned: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input w-20 py-1" disabled={!canManage} value={l.destroyed} onChange={(e) => updateLine(i, { destroyed: e.target.value })} />
                  </td>
                  <td className="px-2 py-1 tabular-nums text-foreground">
                    {computeBalance(l.issued === "" ? null : Number(l.issued), l.returned === "" ? null : Number(l.returned)) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Production">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Packed Bottles">
            <input type="number" className="input" disabled={!canManage} value={header.packedBottles} onChange={(e) => setHeaderField("packedBottles", e.target.value)} />
          </Field>
          <Field label="Cartons Produced">
            <input type="number" className="input" disabled={!canManage} value={header.cartonsProduced} onChange={(e) => setHeaderField("cartonsProduced", e.target.value)} />
          </Field>
          <Field label="Cases Produced">
            <input type="number" className="input" disabled={!canManage} value={header.casesProduced} onChange={(e) => setHeaderField("casesProduced", e.target.value)} />
          </Field>
          <Field label="Packed By">
            <input className="input" disabled={!canManage} value={header.packedByName} onChange={(e) => setHeaderField("packedByName", e.target.value)} />
          </Field>
          <Field label="Packed At">
            <input type="date" className="input" disabled={!canManage} value={header.packedAt} onChange={(e) => setHeaderField("packedAt", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Remarks">
        <textarea className="input" rows={2} disabled={!canManage} value={header.remarks} onChange={(e) => setHeaderField("remarks", e.target.value)} />
      </Section>

      {error && <p className="text-xs text-danger">{error}</p>}
      {canManage && (
        <div className="text-right">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save Packaging"}
          </Button>
        </div>
      )}
    </div>
  );
}
