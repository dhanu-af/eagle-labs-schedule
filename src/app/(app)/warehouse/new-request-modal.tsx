"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Priority } from "@/generated/prisma";
import { createMaterialRequest } from "@/lib/actions/warehouse-requests-actions";
import { Button } from "@/components/ui/Button";
import type { WarehouseItemRow } from "./warehouse-client";
import SendTaskForm, { type UserOption } from "@/components/send-task-form";

const PRIORITY_OPTIONS: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type DraftLine = { itemId: string; ingredientNameFreeText: string; requestedQty: string; unit: string };

function emptyLine(): DraftLine {
  return { itemId: "", ingredientNameFreeText: "", requestedQty: "", unit: "kg" };
}

type CreatedRequest = { batchReference: string; priority: Priority; requiredDate: string; lineCount: number };

export default function NewRequestModal({
  items,
  onClose,
  taskRequestRecipients,
}: {
  items: WarehouseItemRow[];
  onClose: () => void;
  taskRequestRecipients: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [batchReference, setBatchReference] = useState("");
  const [batchSize, setBatchSize] = useState("");
  const [batchSizeUnit, setBatchSizeUnit] = useState("kg");
  const [requiredDate, setRequiredDate] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [comments, setComments] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const [showSendTask, setShowSendTask] = useState(false);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function save() {
    setError("");
    if (!batchReference) {
      setError("Batch reference is required.");
      return;
    }
    if (lines.some((l) => (!l.itemId && !l.ingredientNameFreeText) || !l.requestedQty)) {
      setError("Every line needs an ingredient and a requested quantity.");
      return;
    }
    startTransition(async () => {
      try {
        await createMaterialRequest({
          batchReference,
          batchSize: batchSize ? Number(batchSize) : null,
          batchSizeUnit: batchSize ? batchSizeUnit : null,
          requiredDate: requiredDate || null,
          priority,
          comments: comments || null,
          lines: lines.map((l) => ({
            itemId: l.itemId || null,
            ingredientNameFreeText: l.itemId ? null : l.ingredientNameFreeText,
            requestedQty: Number(l.requestedQty),
            unit: l.unit,
          })),
        });
        router.refresh();
        setCreated({ batchReference, priority, requiredDate, lineCount: lines.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create request.");
      }
    });
  }

  if (created) {
    const summary = `Material request — ${created.batchReference}`;
    const details = `${created.lineCount} ingredient${created.lineCount === 1 ? "" : "s"} requested, priority ${created.priority}${
      created.requiredDate ? `, needed by ${new Date(created.requiredDate).toLocaleDateString()}` : ""
    }`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{showSendTask ? "Send Task" : "Request Created"}</h2>
            <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
              ✕
            </button>
          </div>
          {showSendTask ? (
            <SendTaskForm
              users={taskRequestRecipients}
              initialTitle={summary}
              initialMessage={details}
              initialPriority={created.priority}
              link="/warehouse"
              onSent={onClose}
              onCancel={() => setShowSendTask(false)}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {summary} has been created. {details}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                {taskRequestRecipients.length > 0 && <Button onClick={() => setShowSendTask(true)}>Send Task</Button>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">New Material Request</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Batch Reference">
              <input className="input" value={batchReference} onChange={(e) => setBatchReference(e.target.value)} />
            </Field>
            <Field label="Batch Size">
              <div className="flex gap-1">
                <input type="number" className="input" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
                <input
                  className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  value={batchSizeUnit}
                  onChange={(e) => setBatchSizeUnit(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Required Date">
              <input type="date" className="input" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
            </Field>
            <Field label="Priority">
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Ingredients</p>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-4">
                <Field label="Item (optional)">
                  <select
                    className="input"
                    value={line.itemId}
                    onChange={(e) => updateLine(i, { itemId: e.target.value, unit: items.find((it) => it.id === e.target.value)?.unit ?? line.unit })}
                  >
                    <option value="">Free text instead...</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.itemCode} — {it.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!line.itemId && (
                  <Field label="Ingredient Name">
                    <input
                      className="input"
                      value={line.ingredientNameFreeText}
                      onChange={(e) => updateLine(i, { ingredientNameFreeText: e.target.value })}
                    />
                  </Field>
                )}
                <Field label="Requested Qty">
                  <input type="number" className="input" value={line.requestedQty} onChange={(e) => updateLine(i, { requestedQty: e.target.value })} />
                </Field>
                <Field label="Unit">
                  <input className="input" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                </Field>
                {lines.length > 1 && (
                  <div className="col-span-full text-right">
                    <button
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-xs font-medium text-danger hover:opacity-80"
                    >
                      Remove Line
                    </button>
                  </div>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              + Add Ingredient
            </Button>
          </div>

          <Field label="Comments">
            <textarea className="input" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Create Request"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
