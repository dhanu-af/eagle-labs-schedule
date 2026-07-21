"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QcSampleType, QcProductCategory } from "@/generated/prisma";
import {
  SAMPLE_STATUS_LABEL,
  SAMPLE_STATUS_TONE,
  SAMPLE_TYPE_LABEL,
  PRODUCT_CATEGORY_LABEL,
  TEST_SECTIONS_BY_CATEGORY,
  timeUntilExpiryLabel,
} from "@/lib/qc-sample-defaults";
import {
  updateQcSample,
  markCollected,
  markSentToLab,
  markLabReceived,
  markTestingStarted,
  recordLabTestResults,
  approveSample,
  rejectSample,
  moveToRetention,
  updateRetentionRecord,
  markExpired,
  markDisposed,
  deleteQcSample,
  getQcSampleAuditTrail,
} from "@/lib/actions/qc-sample-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { QcSampleRow, BatchRecordOption, QcLabTestItemRow } from "./qc-samples-client";

const SAMPLE_TYPES: QcSampleType[] = ["FINISHED_PRODUCT", "STABILITY", "RETENTION", "INVESTIGATION", "COMPLAINT"];
const PRODUCT_CATEGORIES: QcProductCategory[] = ["CAPSULE", "GUMMY"];

function buildInitialLabItems(sample: QcSampleRow): QcLabTestItemRow[] {
  if (sample.labTest && sample.labTest.items.length > 0) return sample.labTest.items;
  if (!sample.productCategory) return [];
  return TEST_SECTIONS_BY_CATEGORY[sample.productCategory].flatMap((s) =>
    s.items.map((parameter) => ({ section: s.section, parameter, result: null, details: null }))
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value, valueClassName }: { label: string; value: string | null | undefined; valueClassName?: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className={valueClassName ?? "text-foreground"}>{value || "—"}</span>
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      {children}
    </div>
  );
}

export default function SampleDetailModal({
  sample,
  batchRecords,
  bayOptions,
  locationOptions,
  canManage,
  canRunLabTesting,
  isSuperAdmin,
  onClose,
}: {
  sample: QcSampleRow;
  batchRecords: BatchRecordOption[];
  bayOptions: string[];
  locationOptions: string[];
  canManage: boolean;
  canRunLabTesting: boolean;
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [audit, setAudit] = useState<{ id: string; actorName: string; summary: string; createdAt: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQcSampleAuditTrail(sample.id).then((entries) => {
      if (!cancelled) setAudit(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [sample.id]);

  const [form, setForm] = useState({
    batchRecordId: sample.batchRecordId ?? "",
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    sampleType: sample.sampleType,
    productCategory: sample.productCategory ?? ("" as QcProductCategory | ""),
    manufacturingDate: sample.manufacturingDate?.slice(0, 10) ?? "",
    expiryDate: sample.expiryDate?.slice(0, 10) ?? "",
    quantity: String(sample.quantity),
    unit: sample.unit,
    productionRoom: sample.productionRoom ?? "",
    sampleStorageLocation: sample.sampleStorageLocation ?? "",
    storageTemperature: sample.storageTemperature ?? "",
    storageCondition: sample.storageCondition ?? "",
    remarks: sample.remarks ?? "",
  });

  const [sentDate, setSentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [courier, setCourier] = useState("");
  const [laboratoryName, setLaboratoryName] = useState("");
  const [laboratoryLocation, setLaboratoryLocation] = useState("");

  const [labItems, setLabItems] = useState<QcLabTestItemRow[]>(() => buildInitialLabItems(sample));
  const [labItemsSyncedWith, setLabItemsSyncedWith] = useState(sample);
  if (labItemsSyncedWith !== sample) {
    setLabItemsSyncedWith(sample);
    setLabItems(buildInitialLabItems(sample));
  }

  function setLabItem(index: number, patch: Partial<QcLabTestItemRow>) {
    setLabItems((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  const [retentionForm, setRetentionForm] = useState({
    shelf: sample.retentionRecord?.shelf ?? "",
    cabinet: sample.retentionRecord?.cabinet ?? "",
    boxNumber: sample.retentionRecord?.boxNumber ?? "",
    position: sample.retentionRecord?.position ?? "",
    quantityRemaining: sample.retentionRecord?.quantityRemaining !== null && sample.retentionRecord?.quantityRemaining !== undefined
      ? String(sample.retentionRecord.quantityRemaining)
      : "",
    opened: sample.retentionRecord?.opened ?? false,
    destroyDate: sample.retentionRecord?.destroyDate?.slice(0, 10) ?? "",
  });

  function run(action: () => Promise<unknown>) {
    setError("");
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function saveEdit() {
    if (!form.productName || !form.batchNumber || !form.unit || !form.quantity) {
      setError("Product, batch number, quantity, and unit are required.");
      return;
    }
    run(async () => {
      await updateQcSample(sample.id, {
        productName: form.productName,
        batchNumber: form.batchNumber,
        batchRecordId: form.batchRecordId || null,
        manufacturingDate: form.manufacturingDate || null,
        expiryDate: form.expiryDate || null,
        sampleType: form.sampleType,
        productCategory: form.productCategory || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        collectionDate: sample.collectionDate,
        collectionTime: sample.collectionTime,
        productionRoom: form.productionRoom || null,
        sampleStorageLocation: form.sampleStorageLocation || null,
        storageTemperature: form.storageTemperature || null,
        storageCondition: form.storageCondition || null,
        remarks: form.remarks || null,
      });
      setEditing(false);
    });
  }

  function reject() {
    const reason = prompt("Reason for rejecting this sample:");
    if (!reason) return;
    run(() => rejectSample(sample.id, reason));
  }

  function remove() {
    const message = isSuperAdmin && sample.status !== "WAITING_COLLECTION" && sample.status !== "COLLECTED"
      ? `"${sample.sampleId}" already has lab/retention history — deleting it will permanently erase that record. Continue?`
      : `Delete sample ${sample.sampleId}? This cannot be undone.`;
    if (!confirm(message)) return;
    run(async () => {
      await deleteQcSample(sample.id);
      onClose();
    });
  }

  const canDelete = isSuperAdmin || sample.status === "WAITING_COLLECTION" || sample.status === "COLLECTED";
  const inLabPhase = sample.status === "IN_LABORATORY" || sample.status === "TESTING";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{sample.sampleId}</h2>
            <Badge tone={SAMPLE_STATUS_TONE[sample.status]}>{SAMPLE_STATUS_LABEL[sample.status]}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/reports/qc-samples?type=detail&id=${sample.id}`}
              className="text-xs font-medium text-primary hover:opacity-80"
            >
              Download Excel
            </a>
            <a href={`/api/reports/qc-samples/pdf?id=${sample.id}`} className="text-xs font-medium text-primary hover:opacity-80">
              Download PDF
            </a>
            <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
              ✕
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Batch Record (optional link)">
                <select
                  className="input"
                  value={form.batchRecordId}
                  onChange={(e) => {
                    const br = batchRecords.find((b) => b.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      batchRecordId: e.target.value,
                      ...(br ? { productName: br.productName, batchNumber: br.batchNumber } : {}),
                    }));
                  }}
                >
                  <option value="">Free text instead...</option>
                  {batchRecords.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} — {b.productName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Product">
                <input className="input" value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} />
              </Field>
              <Field label="Batch Number">
                <input className="input" value={form.batchNumber} onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))} />
              </Field>
              <Field label="Sample Type">
                <select className="input" value={form.sampleType} onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value as QcSampleType }))}>
                  {SAMPLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SAMPLE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Product Category">
                <select
                  className="input"
                  value={form.productCategory}
                  onChange={(e) => setForm((f) => ({ ...f, productCategory: e.target.value as QcProductCategory | "" }))}
                >
                  <option value="">Select...</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {PRODUCT_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Manufacturing Date">
                <input type="date" className="input" value={form.manufacturingDate} onChange={(e) => setForm((f) => ({ ...f, manufacturingDate: e.target.value }))} />
              </Field>
              <Field label="Expiry Date">
                <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </Field>
              <Field label="Quantity">
                <input type="number" className="input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </Field>
              <Field label="Units">
                <input className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              </Field>
              <Field label="Production Room / Bay">
                <input
                  className="input"
                  list="edit-bay-options"
                  placeholder="Type or pick a suggestion..."
                  value={form.productionRoom}
                  onChange={(e) => setForm((f) => ({ ...f, productionRoom: e.target.value }))}
                />
                <datalist id="edit-bay-options">
                  {bayOptions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Sample Storage Location">
                <input
                  className="input"
                  list="edit-location-options"
                  placeholder="Type or pick a suggestion..."
                  value={form.sampleStorageLocation}
                  onChange={(e) => setForm((f) => ({ ...f, sampleStorageLocation: e.target.value }))}
                />
                <datalist id="edit-location-options">
                  {locationOptions.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
              <Field label="Storage Temperature">
                <input className="input" value={form.storageTemperature} onChange={(e) => setForm((f) => ({ ...f, storageTemperature: e.target.value }))} />
              </Field>
              <Field label="Storage Condition">
                <input className="input" value={form.storageCondition} onChange={(e) => setForm((f) => ({ ...f, storageCondition: e.target.value }))} />
              </Field>
            </div>
            <Field label="Remarks">
              <textarea className="input" rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <DetailRow label="Product" value={sample.productName} />
              <DetailRow label="Batch" value={sample.batchNumber} />
              <DetailRow label="Type" value={SAMPLE_TYPE_LABEL[sample.sampleType]} />
              <DetailRow label="Product Category" value={sample.productCategory ? PRODUCT_CATEGORY_LABEL[sample.productCategory] : null} />
              <DetailRow label="Quantity" value={`${sample.quantity} ${sample.unit}`} />
              <DetailRow label="Manufacturing Date" value={sample.manufacturingDate ? new Date(sample.manufacturingDate).toLocaleDateString() : null} />
              <DetailRow label="Expiry Date" value={sample.expiryDate ? new Date(sample.expiryDate).toLocaleDateString() : null} />
              <DetailRow
                label="Time to Expiry"
                value={timeUntilExpiryLabel(sample.expiryDate)}
                valueClassName={sample.expiryDate && new Date(sample.expiryDate) < new Date() ? "text-danger" : "text-foreground"}
              />
              <DetailRow label="Collected By" value={sample.collectedByName} />
              <DetailRow label="Collection Date" value={sample.collectionDate ? new Date(sample.collectionDate).toLocaleDateString() : null} />
              <DetailRow label="Production Room / Bay" value={sample.productionRoom} />
              <DetailRow label="Sample Storage Location" value={sample.sampleStorageLocation} />
              <DetailRow label="Storage Temp" value={sample.storageTemperature} />
              <DetailRow label="Storage Condition" value={sample.storageCondition} />
              <DetailRow label="Sent to Lab" value={sample.sentDate ? new Date(sample.sentDate).toLocaleDateString() : null} />
              <DetailRow label="Courier / Internal" value={sample.courierOrInternal} />
              <DetailRow label="Laboratory Name" value={sample.laboratoryName} />
              <DetailRow label="Laboratory Location" value={sample.laboratoryLocation} />
              <DetailRow label="Received by QC" value={sample.receivedByQcName} />
              <DetailRow label="Remarks" value={sample.remarks} />
            </div>
            {canManage && (
              <div className="text-right">
                <button onClick={() => setEditing(true)} className="text-xs font-medium text-primary hover:opacity-80">
                  Edit Details
                </button>
              </div>
            )}
          </div>
        )}

        {!editing && (
          <>
            <Section title="Workflow">
              <div className="flex flex-wrap items-center gap-2">
                {sample.status === "WAITING_COLLECTION" && canManage && (
                  <Button size="sm" onClick={() => run(() => markCollected(sample.id))} disabled={pending}>
                    Mark Collected
                  </Button>
                )}
                {sample.status === "COLLECTED" && canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" className="input w-40" value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
                    <input
                      className="input w-40"
                      placeholder="Courier / Internal"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                    />
                    <input
                      className="input w-40"
                      placeholder="Laboratory Name"
                      value={laboratoryName}
                      onChange={(e) => setLaboratoryName(e.target.value)}
                    />
                    <input
                      className="input w-40"
                      placeholder="Laboratory Location"
                      value={laboratoryLocation}
                      onChange={(e) => setLaboratoryLocation(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        run(() =>
                          markSentToLab(sample.id, {
                            sentDate,
                            courierOrInternal: courier || null,
                            laboratoryName: laboratoryName || null,
                            laboratoryLocation: laboratoryLocation || null,
                          })
                        )
                      }
                      disabled={pending}
                    >
                      Send to Lab
                    </Button>
                  </div>
                )}
                {sample.status === "WAITING_LAB" && canRunLabTesting && (
                  <Button size="sm" onClick={() => run(() => markLabReceived(sample.id))} disabled={pending}>
                    Mark Received at Laboratory
                  </Button>
                )}
                {sample.status === "IN_LABORATORY" && canRunLabTesting && (
                  <Button size="sm" onClick={() => run(() => markTestingStarted(sample.id))} disabled={pending}>
                    Start Testing
                  </Button>
                )}
                {sample.status === "WAITING_RESULTS" && canRunLabTesting && (
                  <>
                    <Button size="sm" variant="success" onClick={() => run(() => approveSample(sample.id))} disabled={pending}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={reject} disabled={pending}>
                      Reject
                    </Button>
                  </>
                )}
                {sample.status === "RETENTION" && canManage && (
                  <>
                    <Button size="sm" onClick={() => run(() => markExpired(sample.id))} disabled={pending}>
                      Mark Expired
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => run(() => markDisposed(sample.id))} disabled={pending}>
                      Dispose
                    </Button>
                  </>
                )}
                {sample.status === "EXPIRED" && canManage && (
                  <Button size="sm" variant="danger" onClick={() => run(() => markDisposed(sample.id))} disabled={pending}>
                    Dispose
                  </Button>
                )}
                {sample.status === "REJECTED" && <p className="text-xs text-muted-foreground">Investigate per remarks — no further workflow action.</p>}
                {sample.status === "DISPOSED" && <p className="text-xs text-muted-foreground">Closed — sample disposed.</p>}
              </div>
            </Section>

            {(inLabPhase || sample.status === "WAITING_RESULTS" || sample.labTest) && (
              <Section title="Laboratory Testing">
                {inLabPhase && canRunLabTesting ? (
                  !sample.productCategory ? (
                    <p className="text-xs text-muted-foreground">
                      Set a Product Category on the sample record (Edit Details) to load its test checklist.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...new Set(labItems.map((it) => it.section))].map((section) => (
                        <div key={section}>
                          <p className="mb-1 text-xs font-semibold text-foreground">{section}</p>
                          <div className="space-y-1">
                            {labItems.map((item, idx) =>
                              item.section === section ? (
                                <div
                                  key={idx}
                                  className="grid grid-cols-[1fr_auto_2fr] items-center gap-2 border-b border-border pb-1 text-xs last:border-0"
                                >
                                  <span className="text-foreground">{item.parameter}</span>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant={item.result === "PASS" ? "success" : "secondary"}
                                      onClick={() => setLabItem(idx, { result: item.result === "PASS" ? null : "PASS" })}
                                    >
                                      Pass
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={item.result === "FAIL" ? "danger" : "secondary"}
                                      onClick={() => setLabItem(idx, { result: item.result === "FAIL" ? null : "FAIL" })}
                                    >
                                      Fail
                                    </Button>
                                  </div>
                                  <input
                                    className="input py-1 text-[11px]"
                                    placeholder="Details..."
                                    value={item.details ?? ""}
                                    onChange={(e) => setLabItem(idx, { details: e.target.value })}
                                  />
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="text-right">
                        <Button
                          size="sm"
                          onClick={() =>
                            run(() =>
                              recordLabTestResults(
                                sample.id,
                                labItems.map((it) => ({
                                  section: it.section,
                                  parameter: it.parameter,
                                  result: it.result,
                                  details: it.details || null,
                                }))
                              )
                            )
                          }
                          disabled={pending}
                        >
                          Save Test Results
                        </Button>
                      </div>
                    </div>
                  )
                ) : sample.labTest && sample.labTest.items.length > 0 ? (
                  <div className="space-y-3">
                    {[...new Set(sample.labTest.items.map((it) => it.section))].map((section) => (
                      <div key={section}>
                        <p className="mb-1 text-xs font-semibold text-foreground">{section}</p>
                        <div className="space-y-1">
                          {sample.labTest!.items
                            .filter((it) => it.section === section)
                            .map((it, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-2 border-b border-border pb-1 text-xs last:border-0"
                              >
                                <span className="text-foreground">{it.parameter}</span>
                                <div className="flex items-center gap-2">
                                  {it.result && <Badge tone={it.result === "PASS" ? "success" : "danger"}>{it.result}</Badge>}
                                  {it.details && <span className="text-muted-foreground">{it.details}</span>}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Tested by {sample.labTest.testedByName}
                      {sample.labTest.testedAt ? ` on ${new Date(sample.labTest.testedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No test results recorded yet.</p>
                )}
              </Section>
            )}

            {sample.status === "APPROVED" && canManage && (
              <Section title="Move to Retention">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Shelf">
                    <input className="input" value={retentionForm.shelf} onChange={(e) => setRetentionForm((s) => ({ ...s, shelf: e.target.value }))} />
                  </Field>
                  <Field label="Cabinet">
                    <input className="input" value={retentionForm.cabinet} onChange={(e) => setRetentionForm((s) => ({ ...s, cabinet: e.target.value }))} />
                  </Field>
                  <Field label="Box Number">
                    <input className="input" value={retentionForm.boxNumber} onChange={(e) => setRetentionForm((s) => ({ ...s, boxNumber: e.target.value }))} />
                  </Field>
                  <Field label="Position">
                    <input className="input" value={retentionForm.position} onChange={(e) => setRetentionForm((s) => ({ ...s, position: e.target.value }))} />
                  </Field>
                  <Field label="Quantity Remaining">
                    <input type="number" className="input" value={retentionForm.quantityRemaining} onChange={(e) => setRetentionForm((s) => ({ ...s, quantityRemaining: e.target.value }))} />
                  </Field>
                </div>
                <div className="text-right">
                  <Button size="sm" onClick={() => run(() => moveToRetention(sample.id, {
                    shelf: retentionForm.shelf || null,
                    cabinet: retentionForm.cabinet || null,
                    boxNumber: retentionForm.boxNumber || null,
                    position: retentionForm.position || null,
                    quantityRemaining: retentionForm.quantityRemaining ? Number(retentionForm.quantityRemaining) : null,
                  }))} disabled={pending}>
                    Store in Retention
                  </Button>
                </div>
              </Section>
            )}

            {sample.retentionRecord && (sample.status === "RETENTION" || sample.status === "EXPIRED" || sample.status === "DISPOSED") && (
              <Section title="Retention Sample">
                {sample.status === "RETENTION" && canManage ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Field label="Shelf">
                        <input className="input" value={retentionForm.shelf} onChange={(e) => setRetentionForm((s) => ({ ...s, shelf: e.target.value }))} />
                      </Field>
                      <Field label="Cabinet">
                        <input className="input" value={retentionForm.cabinet} onChange={(e) => setRetentionForm((s) => ({ ...s, cabinet: e.target.value }))} />
                      </Field>
                      <Field label="Box Number">
                        <input className="input" value={retentionForm.boxNumber} onChange={(e) => setRetentionForm((s) => ({ ...s, boxNumber: e.target.value }))} />
                      </Field>
                      <Field label="Position">
                        <input className="input" value={retentionForm.position} onChange={(e) => setRetentionForm((s) => ({ ...s, position: e.target.value }))} />
                      </Field>
                      <Field label="Quantity Remaining">
                        <input type="number" className="input" value={retentionForm.quantityRemaining} onChange={(e) => setRetentionForm((s) => ({ ...s, quantityRemaining: e.target.value }))} />
                      </Field>
                      <Field label="Opened?">
                        <select className="input" value={retentionForm.opened ? "yes" : "no"} onChange={(e) => setRetentionForm((s) => ({ ...s, opened: e.target.value === "yes" }))}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </Field>
                    </div>
                    <div className="text-right">
                      <Button size="sm" onClick={() => run(() => updateRetentionRecord(sample.id, {
                        shelf: retentionForm.shelf || null,
                        cabinet: retentionForm.cabinet || null,
                        boxNumber: retentionForm.boxNumber || null,
                        position: retentionForm.position || null,
                        quantityRemaining: retentionForm.quantityRemaining ? Number(retentionForm.quantityRemaining) : null,
                        opened: retentionForm.opened,
                        lastChecked: new Date().toISOString(),
                        destroyDate: retentionForm.destroyDate || null,
                      }))} disabled={pending}>
                        Save Retention Update
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    <DetailRow label="Shelf" value={sample.retentionRecord.shelf} />
                    <DetailRow label="Cabinet" value={sample.retentionRecord.cabinet} />
                    <DetailRow label="Box Number" value={sample.retentionRecord.boxNumber} />
                    <DetailRow label="Position" value={sample.retentionRecord.position} />
                    <DetailRow label="Quantity Remaining" value={sample.retentionRecord.quantityRemaining !== null ? `${sample.retentionRecord.quantityRemaining} ${sample.unit}` : null} />
                    <DetailRow label="Opened" value={sample.retentionRecord.opened ? "Yes" : "No"} />
                    <DetailRow label="Destroy Date" value={sample.retentionRecord.destroyDate ? new Date(sample.retentionRecord.destroyDate).toLocaleDateString() : null} />
                  </div>
                )}
              </Section>
            )}

            <Section title="Audit Trail">
              {audit === null ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : audit.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {audit.map((a) => (
                    <li key={a.id} className="text-foreground">
                      <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()} — </span>
                      {a.summary}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {canManage && (
              <div className="border-t border-border pt-3 text-right">
                <button
                  onClick={remove}
                  disabled={pending || !canDelete}
                  className="text-xs font-medium text-danger hover:opacity-80 disabled:opacity-40"
                  title={!canDelete ? "This sample has lab/retention history — only a Super Admin can force-delete it." : undefined}
                >
                  Delete Sample
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
