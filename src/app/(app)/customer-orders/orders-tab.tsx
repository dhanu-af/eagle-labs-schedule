"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderPriority } from "@/generated/prisma";
import { createCustomerOrder, type NewOrderLineInput } from "@/lib/actions/customer-order-actions";
import { CUSTOMER_ORDER_STATUS_LABELS } from "@/lib/customer-order-defaults";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OrderRow, CustomerRow, ProductRow, PlannerOption } from "./customer-orders-client";
import SendTaskForm, { type UserOption } from "@/components/send-task-form";

const PRIORITIES: OrderPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type DraftLine = NewOrderLineInput;

function emptyLine(defaultUnit = "kg"): DraftLine {
  return { productId: "", quantity: 0, unit: defaultUnit, packagingRequirement: "", artworkStatus: "", notes: "" };
}

type CreatedOrder = { id: string; orderNumber: string; customerName: string; lineCount: number; requestedDeliveryDate: string };

function NewOrderModal({
  customers,
  products,
  onClose,
  taskRequestRecipients,
}: {
  customers: CustomerRow[];
  products: ProductRow[];
  onClose: () => void;
  taskRequestRecipients: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [customerPoNumber, setCustomerPoNumber] = useState("");
  const [customerRequestNumber, setCustomerRequestNumber] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [priority, setPriority] = useState<OrderPriority>("NORMAL");
  const [shippingRequirements, setShippingRequirements] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const [showSendTask, setShowSendTask] = useState(false);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function pickProduct(i: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(i, { productId, unit: product?.defaultUnit ?? "kg" });
  }

  function save() {
    setError("");
    if (!customerId) return setError("Customer is required.");
    if (!requestedDeliveryDate) return setError("Requested delivery date is required.");
    if (!lines.length || lines.some((l) => !l.productId || !l.quantity)) return setError("Every line needs a product and a quantity greater than 0.");

    startTransition(async () => {
      try {
        const order = await createCustomerOrder({
          customerId,
          customerPoNumber: customerPoNumber || null,
          customerRequestNumber: customerRequestNumber || null,
          requestedDeliveryDate,
          priority,
          shippingRequirements: shippingRequirements || null,
          specialRequirements: specialRequirements || null,
          notes: notes || null,
          lines,
        });
        const customerName = customers.find((c) => c.id === customerId)?.name ?? "";
        setCreated({ id: order.id, orderNumber: order.orderNumber, customerName, lineCount: lines.length, requestedDeliveryDate });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create order.");
      }
    });
  }

  function finish() {
    onClose();
    if (created) router.push(`/customer-orders/${created.id}`);
  }

  if (created) {
    const summary = `New order ${created.orderNumber} — ${created.customerName}`;
    const details = `${created.lineCount} line${created.lineCount === 1 ? "" : "s"}, requested delivery ${new Date(created.requestedDeliveryDate).toLocaleDateString()}`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{showSendTask ? "Send Task" : "Order Created"}</h2>
            <button onClick={finish} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
              ✕
            </button>
          </div>
          {showSendTask ? (
            <SendTaskForm
              users={taskRequestRecipients}
              initialTitle={summary}
              initialMessage={details}
              link={`/customer-orders/${created.id}`}
              onSent={finish}
              onCancel={() => setShowSendTask(false)}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {summary} has been created. {details}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={finish}>
                  View Order
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
      <div className="card-elevated max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">New Customer Order</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Customer">
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Customer PO Number">
              <input className="input" value={customerPoNumber} onChange={(e) => setCustomerPoNumber(e.target.value)} />
            </Field>
            <Field label="Customer Request Number">
              <input className="input" value={customerRequestNumber} onChange={(e) => setCustomerRequestNumber(e.target.value)} />
            </Field>
            <Field label="Requested Delivery Date">
              <input type="date" className="input" value={requestedDeliveryDate} onChange={(e) => setRequestedDeliveryDate(e.target.value)} />
            </Field>
            <Field label="Priority">
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as OrderPriority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shipping Requirements">
              <input className="input" value={shippingRequirements} onChange={(e) => setShippingRequirements(e.target.value)} />
            </Field>
          </div>
          <Field label="Special Requirements">
            <input className="input" value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Order Lines</span>
              <Button size="sm" variant="secondary" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                + Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <Field label="Product">
                      <select className="input" value={line.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                        <option value="">Select...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Quantity">
                    <input type="number" className="input" value={line.quantity || ""} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                  </Field>
                  <Field label="Unit">
                    <input className="input" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                  </Field>
                  <Field label="Packaging">
                    <input className="input" value={line.packagingRequirement ?? ""} onChange={(e) => updateLine(i, { packagingRequirement: e.target.value })} />
                  </Field>
                  <div className="flex items-end justify-end">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRIORITY_TONE: Record<OrderPriority, "muted" | "info" | "warning" | "danger"> = {
  LOW: "muted",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

export default function OrdersTab({
  orders,
  customers,
  products,
  canManage,
  taskRequestRecipients,
}: {
  orders: OrderRow[];
  customers: CustomerRow[];
  products: ProductRow[];
  planners: PlannerOption[];
  canManage: boolean;
  taskRequestRecipients: UserOption[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (q) {
        const haystack = `${o.orderNumber} ${o.customerName} ${o.customerPoNumber ?? ""} ${o.customerRequestNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            className="input w-full sm:w-64"
            placeholder="Search order number, customer, PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input flex-1 sm:w-44 sm:flex-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(CUSTOMER_ORDER_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            + New Order
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No orders match" description="Adjust your filters or create a new customer order." />
      ) : (
        <>
          <Card padding="none" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={THEAD_ROW_CLASS}>
                    <Th>Order #</Th>
                    <Th>Customer</Th>
                    <Th>Lines</Th>
                    <Th>Requested Delivery</Th>
                    <Th>Priority</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-muted/40">
                      <td className="px-3 py-2 font-medium text-foreground">
                        <Link href={`/customer-orders/${o.id}`} className="hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{o.customerName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.lines.length}</td>
                      <td className="px-3 py-2">{new Date(o.confirmedDeliveryDate ?? o.requestedDeliveryDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <Badge tone={PRIORITY_TONE[o.priority]}>{o.priority}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="muted">{CUSTOMER_ORDER_STATUS_LABELS[o.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-2 md:hidden">
            {filtered.map((o) => (
              <Link key={o.id} href={`/customer-orders/${o.id}`}>
                <Card padding="sm" interactive className="cursor-pointer">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{o.orderNumber}</span>
                    <Badge tone="muted">{CUSTOMER_ORDER_STATUS_LABELS[o.status]}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Customer</dt>
                      <dd className="text-foreground">{o.customerName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Lines</dt>
                      <dd className="text-foreground">{o.lines.length}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Delivery</dt>
                      <dd className="text-foreground">{new Date(o.confirmedDeliveryDate ?? o.requestedDeliveryDate).toLocaleDateString()}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Priority</dt>
                      <dd>
                        <Badge tone={PRIORITY_TONE[o.priority]}>{o.priority}</Badge>
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {showNew && (
        <NewOrderModal
          customers={customers}
          products={products}
          onClose={() => setShowNew(false)}
          taskRequestRecipients={taskRequestRecipients}
        />
      )}
    </div>
  );
}
