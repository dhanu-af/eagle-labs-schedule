"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QcSampleType } from "@/generated/prisma";
import { SAMPLE_STATUS_LABEL, SAMPLE_STATUS_TONE, SAMPLE_TYPE_LABEL } from "@/lib/qc-sample-defaults";
import { createQcSample } from "@/lib/actions/qc-sample-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { QcSampleRow, BatchRecordOption, BayOption, LocationOption } from "./qc-samples-client";

const SAMPLE_TYPES: QcSampleType[] = ["FINISHED_PRODUCT", "STABILITY", "RETENTION", "INVESTIGATION", "COMPLAINT"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NewSampleModal({
  batchRecords,
  bays,
  locations,
  onClose,
}: {
  batchRecords: BatchRecordOption[];
  bays: BayOption[];
  locations: LocationOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [batchRecordId, setBatchRecordId] = useState("");
  const [productName, setProductName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [sampleType, setSampleType] = useState<QcSampleType>("FINISHED_PRODUCT");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [collectionDate, setCollectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [collectionTime, setCollectionTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [bayId, setBayId] = useState("");
  const [warehouseLocationId, setWarehouseLocationId] = useState("");
  const [storageTemperature, setStorageTemperature] = useState("");
  const [storageCondition, setStorageCondition] = useState("");
  const [remarks, setRemarks] = useState("");

  function pickBatchRecord(id: string) {
    setBatchRecordId(id);
    const br = batchRecords.find((b) => b.id === id);
    if (br) {
      setProductName(br.productName);
      setBatchNumber(br.batchNumber);
    }
  }

  function save() {
    setError("");
    if (!productName || !batchNumber || !unit || !quantity) {
      setError("Product, batch number, quantity, and unit are required.");
      return;
    }
    startTransition(async () => {
      try {
        await createQcSample({
          productName,
          batchNumber,
          batchRecordId: batchRecordId || null,
          manufacturingDate: manufacturingDate || null,
          expiryDate: expiryDate || null,
          sampleType,
          quantity: Number(quantity),
          unit,
          collectionDate: collectionDate || null,
          collectionTime: collectionTime || null,
          bayId: bayId || null,
          warehouseLocationId: warehouseLocationId || null,
          storageTemperature: storageTemperature || null,
          storageCondition: storageCondition || null,
          remarks: remarks || null,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save sample.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Generate QC Sample</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Batch Record (optional link)">
              <select className="input" value={batchRecordId} onChange={(e) => pickBatchRecord(e.target.value)}>
                <option value="">Free text instead...</option>
                {batchRecords.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} — {b.productName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </Field>
            <Field label="Batch Number">
              <input className="input" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            </Field>
            <Field label="Sample Type">
              <select className="input" value={sampleType} onChange={(e) => setSampleType(e.target.value as QcSampleType)}>
                {SAMPLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SAMPLE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Manufacturing Date">
              <input type="date" className="input" value={manufacturingDate} onChange={(e) => setManufacturingDate(e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <input type="date" className="input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </Field>
            <Field label="Quantity">
              <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <Field label="Units">
              <input className="input" placeholder="Bottles / Bags / Sachets" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field label="Collection Date">
              <input type="date" className="input" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
            </Field>
            <Field label="Collection Time">
              <input type="time" className="input" value={collectionTime} onChange={(e) => setCollectionTime(e.target.value)} />
            </Field>
            <Field label="Production Room / Bay">
              <select className="input" value={bayId} onChange={(e) => setBayId(e.target.value)}>
                <option value="">None</option>
                {bays.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bay {b.bayNumber}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Warehouse Location">
              <select className="input" value={warehouseLocationId} onChange={(e) => setWarehouseLocationId(e.target.value)}>
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Storage Temperature">
              <input className="input" value={storageTemperature} onChange={(e) => setStorageTemperature(e.target.value)} />
            </Field>
            <Field label="Storage Condition">
              <input className="input" value={storageCondition} onChange={(e) => setStorageCondition(e.target.value)} />
            </Field>
          </div>
          <Field label="Remarks">
            <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Generate Sample"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SamplesTab({
  samples,
  batchRecords,
  bays,
  locations,
  canCollect,
  onSelect,
}: {
  samples: QcSampleRow[];
  batchRecords: BatchRecordOption[];
  bays: BayOption[];
  locations: LocationOption[];
  canCollect: boolean;
  onSelect: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [bayFilter, setBayFilter] = useState("");
  const [collectionDateFilter, setCollectionDateFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return samples.filter((s) => {
      if (q) {
        const haystack = `${s.sampleId} ${s.productName} ${s.batchNumber} ${s.collectedByName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      if (typeFilter && s.sampleType !== typeFilter) return false;
      if (bayFilter && s.bayId !== bayFilter) return false;
      if (collectionDateFilter && s.collectionDate?.slice(0, 10) !== collectionDateFilter) return false;
      return true;
    });
  }, [samples, search, statusFilter, typeFilter, bayFilter, collectionDateFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-56"
            placeholder="Search product, batch, sample ID, analyst..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(SAMPLE_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select className="input w-36" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(SAMPLE_TYPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select className="input w-28" value={bayFilter} onChange={(e) => setBayFilter(e.target.value)}>
            <option value="">All bays</option>
            {bays.map((b) => (
              <option key={b.id} value={b.id}>
                Bay {b.bayNumber}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input w-40"
            value={collectionDateFilter}
            onChange={(e) => setCollectionDateFilter(e.target.value)}
          />
        </div>
        {canCollect && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            + Generate Sample
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No samples match" description="Adjust your filters or generate a new QC sample." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Sample ID</Th>
                  <Th>Product</Th>
                  <Th>Batch</Th>
                  <Th>Type</Th>
                  <Th>Collection Date</Th>
                  <Th>Analyst</Th>
                  <Th>Bay</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted/40"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{s.sampleId}</td>
                    <td className="px-3 py-2">{s.productName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.batchNumber}</td>
                    <td className="px-3 py-2">{SAMPLE_TYPE_LABEL[s.sampleType]}</td>
                    <td className="px-3 py-2">{s.collectionDate ? new Date(s.collectionDate).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2">{s.collectedByName ?? "—"}</td>
                    <td className="px-3 py-2">{s.bayNumber ? `Bay ${s.bayNumber}` : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={SAMPLE_STATUS_TONE[s.status]}>{SAMPLE_STATUS_LABEL[s.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showNew && (
        <NewSampleModal batchRecords={batchRecords} bays={bays} locations={locations} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}
