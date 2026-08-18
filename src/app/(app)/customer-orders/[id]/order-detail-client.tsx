"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CustomerOrderStatus, OrderPriority } from "@/generated/prisma";
import {
  updateCustomerOrder,
  updateOrderStatus,
  addOrderLine,
  deleteOrderLine,
  linkBatchRecordToLine,
  unlinkBatchRecord,
  type NewOrderLineInput,
} from "@/lib/actions/customer-order-actions";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  CUSTOMER_ORDER_STATUS_SEQUENCE,
  QA_GATE_STATUS_LABELS,
  QA_GATED_STATUSES,
  computeOrderRisk,
  type MaterialCheckResult,
  type MaterialLineStatus,
  type QaGateStatus,
} from "@/lib/customer-order-defaults";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type BatchRecordOption = { id: string; productName: string; batchNumber: string; status: string; customerOrderLineId: string | null };
type PlannerOption = { id: string; fullName: string };
type ProductOption = { id: string; sku: string; name: string; defaultUnit: string };

type OrderLine = {
  id: string;
  lineNumber: number;
  productId: string;
  productName: string;
  productSku: string;
  hasBom: boolean;
  quantity: number;
  unit: string;
  packagingRequirement: string | null;
  artworkStatus: string | null;
  notes: string | null;
  batchRecords: {
    id: string;
    batchNumber: string;
    productName: string;
    status: string;
    scheduledDate: string | null;
    estimatedHours: number | null;
    machineName: string | null;
    qaStatus: QaGateStatus;
  }[];
  materialCheck: MaterialCheckResult;
  qaStatus: QaGateStatus;
};

type Order = {
  id: string;
  orderNumber: string;
  customer: { id: string; name: string; code: string };
  customerPoNumber: string | null;
  customerRequestNumber: string | null;
  orderDate: string;
  requestedDeliveryDate: string;
  confirmedDeliveryDate: string | null;
  priority: OrderPriority;
  status: CustomerOrderStatus;
  responsiblePlannerId: string | null;
  salesOwnerId: string | null;
  shippingRequirements: string | null;
  specialRequirements: string | null;
  notes: string | null;
  lines: OrderLine[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const QA_TONE: Record<QaGateStatus, "success" | "danger" | "warning" | "muted"> = {
  NOT_STARTED: "muted",
  PENDING: "warning",
  RELEASED: "success",
  HELD: "danger",
};

const MATERIAL_TONE: Record<MaterialLineStatus | "NO_BOM", "success" | "danger" | "warning" | "muted"> = {
  READY: "success",
  SHORT: "danger",
  UNMAPPED: "warning",
  NO_BOM: "muted",
};
const MATERIAL_LABEL: Record<MaterialLineStatus | "NO_BOM", string> = {
  READY: "Material Ready",
  SHORT: "Material Short",
  UNMAPPED: "Can't Verify",
  NO_BOM: "No BOM Linked",
};

function MaterialCheckPanel({ check }: { check: MaterialCheckResult }) {
  if (check.lineStatus === "NO_BOM") {
    return <p className="text-xs text-muted-foreground">This product has no Formulation linked, so material availability can&apos;t be checked.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-2">Ingredient</th>
          <th className="py-1 pr-2">Required (kg)</th>
          <th className="py-1 pr-2">Available (kg)</th>
          <th className="py-1 pr-2">Shortage (kg)</th>
          <th className="py-1 pr-2">Status</th>
          <th className="py-1 pr-2">Incoming PO</th>
          <th className="py-1">Also Needed By</th>
        </tr>
      </thead>
      <tbody>
        {check.materials.map((m, i) => (
          <tr key={i} className="border-t border-border">
            <td className="py-1 pr-2">{m.ingredientName}</td>
            <td className="py-1 pr-2">{m.requiredQtyKg}</td>
            <td className="py-1 pr-2">{m.availableQty ?? "—"}</td>
            <td className="py-1 pr-2">{m.shortageQty ?? "—"}</td>
            <td className="py-1 pr-2">
              <Badge tone={MATERIAL_TONE[m.status]}>{MATERIAL_LABEL[m.status]}</Badge>
            </td>
            <td className="py-1 pr-2 text-muted-foreground">
              {m.incomingPo
                ? `${m.incomingPo.poNumber} — ${m.incomingPo.supplierName}, ${m.incomingPo.quantity} due ${new Date(m.incomingPo.expectedDeliveryDate).toLocaleDateString()}`
                : m.status === "SHORT"
                ? "No PO on order"
                : "—"}
            </td>
            <td className="py-1">
              {m.contestedBy.length > 0 ? (
                <span className={m.status === "READY" ? "font-medium text-warning" : "text-muted-foreground"}>
                  {m.contestedBy.map((c) => `${c.orderNumber} (${c.requiredQtyKg}kg)`).join(", ")}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LineCard({ line, batchRecordOptions, canManage }: { line: OrderLine; batchRecordOptions: BatchRecordOption[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [linkPick, setLinkPick] = useState("");
  const [error, setError] = useState("");

  const availableBatches = batchRecordOptions.filter((b) => !b.customerOrderLineId);

  function link() {
    if (!linkPick) return;
    startTransition(async () => {
      try {
        await linkBatchRecordToLine(line.id, linkPick);
        setLinkPick("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't link batch record.");
      }
    });
  }

  function unlink(batchRecordId: string) {
    startTransition(async () => {
      try {
        await unlinkBatchRecord(batchRecordId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't unlink batch record.");
      }
    });
  }

  function removeLine() {
    if (!confirm(`Remove line ${line.lineNumber} (${line.productName})?`)) return;
    startTransition(async () => {
      try {
        await deleteOrderLine(line.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove line.");
      }
    });
  }

  const status = line.materialCheck.lineStatus === "NO_BOM" ? "NO_BOM" : line.materialCheck.lineStatus;

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            #{line.lineNumber} — {line.productName} ({line.productSku})
          </p>
          <p className="text-xs text-muted-foreground">
            {line.quantity} {line.unit}
            {line.packagingRequirement ? ` · ${line.packagingRequirement}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={MATERIAL_TONE[status]}>{MATERIAL_LABEL[status]}</Badge>
          {line.qaStatus !== "NOT_STARTED" && <Badge tone={QA_TONE[line.qaStatus]}>{QA_GATE_STATUS_LABELS[line.qaStatus]}</Badge>}
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-muted-foreground hover:text-foreground">
            {expanded ? "Hide" : "Details"}
          </button>
          {canManage && line.batchRecords.length === 0 && (
            <button onClick={removeLine} disabled={pending} className="text-xs text-danger hover:underline">
              Remove
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <MaterialCheckPanel check={line.materialCheck} />

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Linked Batch Records</p>
            {line.batchRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground">None linked yet.</p>
            ) : (
              <ul className="space-y-1">
                {line.batchRecords.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-xs">
                    <span>
                      <Link href={`/batch-records/${b.id}`} className="text-foreground hover:underline">
                        {b.batchNumber} — {b.productName} ({b.status})
                      </Link>
                      <span className="ml-1 text-muted-foreground">
                        {b.machineName
                          ? `— ${b.machineName}, ${b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : "no date"} (${b.estimatedHours}h)`
                          : "— not scheduled yet"}
                      </span>
                      <Badge tone={QA_TONE[b.qaStatus]} className="ml-1">
                        {QA_GATE_STATUS_LABELS[b.qaStatus]}
                      </Badge>
                    </span>
                    {canManage && (
                      <button onClick={() => unlink(b.id)} disabled={pending} className="text-danger hover:underline">
                        Unlink
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
              <div className="mt-2 flex gap-2">
                <select className="input flex-1" value={linkPick} onChange={(e) => setLinkPick(e.target.value)}>
                  <option value="">Link an existing Batch Record...</option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} — {b.productName}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={link} disabled={pending || !linkPick}>
                  Link
                </Button>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </Card>
  );
}

export default function OrderDetailClient({
  order,
  orderQaStatus,
  auditTrail,
  batchRecordOptions,
  planners,
  products,
  canManage,
  isAdmin,
}: {
  order: Order;
  orderQaStatus: QaGateStatus;
  auditTrail: { id: string; actorName: string; summary: string; createdAt: string }[];
  batchRecordOptions: BatchRecordOption[];
  planners: PlannerOption[];
  products: ProductOption[];
  canManage: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [customerPoNumber, setCustomerPoNumber] = useState(order.customerPoNumber ?? "");
  const [customerRequestNumber, setCustomerRequestNumber] = useState(order.customerRequestNumber ?? "");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(order.requestedDeliveryDate.slice(0, 10));
  const [confirmedDeliveryDate, setConfirmedDeliveryDate] = useState(order.confirmedDeliveryDate?.slice(0, 10) ?? "");
  const [priority, setPriority] = useState<OrderPriority>(order.priority);
  const [responsiblePlannerId, setResponsiblePlannerId] = useState(order.responsiblePlannerId ?? "");
  const [salesOwnerId, setSalesOwnerId] = useState(order.salesOwnerId ?? "");
  const [shippingRequirements, setShippingRequirements] = useState(order.shippingRequirements ?? "");
  const [specialRequirements, setSpecialRequirements] = useState(order.specialRequirements ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [nextStatus, setNextStatus] = useState<CustomerOrderStatus>(order.status);
  const [qaOverrideReason, setQaOverrideReason] = useState("");

  const [showAddLine, setShowAddLine] = useState(false);

  const qaBlocksNextStatus = QA_GATED_STATUSES.includes(nextStatus) && orderQaStatus !== "RELEASED";

  const risk = useMemo(() => {
    const lineMaterialStatuses: MaterialLineStatus[] = order.lines.map((l) => (l.materialCheck.lineStatus === "NO_BOM" ? "UNMAPPED" : l.materialCheck.lineStatus));
    return computeOrderRisk({
      status: order.status,
      requestedDeliveryDate: new Date(order.requestedDeliveryDate),
      confirmedDeliveryDate: order.confirmedDeliveryDate ? new Date(order.confirmedDeliveryDate) : null,
      lineMaterialStatuses,
    });
  }, [order]);

  function saveDetails() {
    setError("");
    startTransition(async () => {
      try {
        await updateCustomerOrder(order.id, {
          customerPoNumber: customerPoNumber || null,
          customerRequestNumber: customerRequestNumber || null,
          requestedDeliveryDate,
          confirmedDeliveryDate: confirmedDeliveryDate || null,
          priority,
          responsiblePlannerId: responsiblePlannerId || null,
          salesOwnerId: salesOwnerId || null,
          shippingRequirements: shippingRequirements || null,
          specialRequirements: specialRequirements || null,
          notes: notes || null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function applyStatus() {
    setError("");
    if (qaBlocksNextStatus && isAdmin && !qaOverrideReason.trim()) return setError("An override reason is required.");
    startTransition(async () => {
      try {
        await updateOrderStatus(
          order.id,
          nextStatus,
          qaBlocksNextStatus && isAdmin ? { qaOverride: true, reason: qaOverrideReason } : undefined
        );
        setQaOverrideReason("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update status.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/customer-orders" className="text-xs text-muted-foreground hover:text-foreground">
            ← Customer Orders
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {order.orderNumber} — {order.customer.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {risk.overdue && <Badge tone="danger">Overdue</Badge>}
          {!risk.overdue && risk.atRisk && <Badge tone="warning">At Risk</Badge>}
          {orderQaStatus !== "NOT_STARTED" && <Badge tone={QA_TONE[orderQaStatus]}>{QA_GATE_STATUS_LABELS[orderQaStatus]}</Badge>}
          <Badge tone="muted">{CUSTOMER_ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
      </div>

      {(risk.overdue || risk.atRisk) && (
        <Card padding="sm" className="border-danger/30 bg-danger/5">
          <p className="text-xs font-medium text-danger">Why this order needs attention</p>
          <ul className="mt-1 list-inside list-disc text-xs text-foreground">
            {risk.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Status</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-56" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as CustomerOrderStatus)} disabled={!canManage}>
            {[...CUSTOMER_ORDER_STATUS_SEQUENCE, "ON_HOLD", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {CUSTOMER_ORDER_STATUS_LABELS[s as CustomerOrderStatus]}
              </option>
            ))}
          </select>
          {canManage && !(qaBlocksNextStatus && !isAdmin) && (
            <Button size="sm" onClick={applyStatus} disabled={pending || nextStatus === order.status}>
              {qaBlocksNextStatus ? "Override & Update Status" : "Update Status"}
            </Button>
          )}
        </div>
        {qaBlocksNextStatus && canManage && (
          <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 p-2">
            <p className="text-xs text-warning">
              {CUSTOMER_ORDER_STATUS_LABELS[nextStatus]} requires QA release — currently {QA_GATE_STATUS_LABELS[orderQaStatus]}.
            </p>
            {isAdmin ? (
              <input
                className="input mt-1 w-full"
                placeholder="Reason for overriding the QA hold (required)"
                value={qaOverrideReason}
                onChange={(e) => setQaOverrideReason(e.target.value)}
              />
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Only an Admin or Super Admin can override this.</p>
            )}
          </div>
        )}
      </Card>

      <Card padding="sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Order Details</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Customer PO Number">
            <input className="input" value={customerPoNumber} onChange={(e) => setCustomerPoNumber(e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Customer Request Number">
            <input className="input" value={customerRequestNumber} onChange={(e) => setCustomerRequestNumber(e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Priority">
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as OrderPriority)} disabled={!canManage}>
              {(["LOW", "NORMAL", "HIGH", "URGENT"] as OrderPriority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requested Delivery">
            <input type="date" className="input" value={requestedDeliveryDate} onChange={(e) => setRequestedDeliveryDate(e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Confirmed Delivery (planner override)">
            <input type="date" className="input" value={confirmedDeliveryDate} onChange={(e) => setConfirmedDeliveryDate(e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Responsible Planner">
            <select className="input" value={responsiblePlannerId} onChange={(e) => setResponsiblePlannerId(e.target.value)} disabled={!canManage}>
              <option value="">Unassigned</option>
              {planners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sales Owner">
            <select className="input" value={salesOwnerId} onChange={(e) => setSalesOwnerId(e.target.value)} disabled={!canManage}>
              <option value="">Unassigned</option>
              {planners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shipping Requirements">
            <input className="input" value={shippingRequirements} onChange={(e) => setShippingRequirements(e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Special Requirements">
            <input className="input" value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} disabled={!canManage} />
          </Field>
        </div>
        <div className="mt-2">
          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canManage} />
          </Field>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        {canManage && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={saveDetails} disabled={pending}>
              {pending ? "Saving..." : "Save Details"}
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Order Lines</p>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setShowAddLine((s) => !s)}>
            {showAddLine ? "Cancel" : "+ Add Line"}
          </Button>
        )}
      </div>
      {showAddLine && <AddLineForm orderId={order.id} products={products} onDone={() => setShowAddLine(false)} />}
      <div className="space-y-2">
        {order.lines.map((line) => (
          <LineCard key={line.id} line={line} batchRecordOptions={batchRecordOptions} canManage={canManage} />
        ))}
      </div>

      <Card padding="sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Audit Trail</p>
        {auditTrail.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {auditTrail.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 text-muted-foreground">
                <span>
                  <span className="text-foreground">{e.actorName}</span> — {e.summary}
                </span>
                <span className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AddLineForm({ orderId, products, onDone }: { orderId: string; products: ProductOption[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");

  function pickProduct(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setUnit(product.defaultUnit);
  }

  function save() {
    setError("");
    if (!productId || !quantity) return setError("Product and quantity are required.");
    const line: NewOrderLineInput = { productId, quantity: Number(quantity), unit };
    startTransition(async () => {
      try {
        await addOrderLine(orderId, line);
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add line.");
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Product">
          <select className="input" value={productId} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">Select...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity">
          <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Unit">
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          Add Line
        </Button>
      </div>
    </Card>
  );
}
