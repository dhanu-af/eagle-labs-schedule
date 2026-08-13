"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, type DraggableProvided, type DraggableStateSnapshot, type DropResult } from "@hello-pangea/dnd";
import type { CustomerOrderStatus, OrderPriority } from "@/generated/prisma";
import { updateOrderStatus } from "@/lib/actions/customer-order-actions";
import { CUSTOMER_ORDER_STATUS_LABELS, CUSTOMER_ORDER_STATUS_SEQUENCE } from "@/lib/customer-order-defaults";
import { Badge } from "@/components/ui/Badge";
import type { OrderRow } from "./customer-orders-client";
import type { RiskOrderRow } from "./dashboard-tab";

const COLUMNS: CustomerOrderStatus[] = [...CUSTOMER_ORDER_STATUS_SEQUENCE, "ON_HOLD"];

const PRIORITY_TONE: Record<OrderPriority, "muted" | "info" | "warning" | "danger"> = {
  LOW: "muted",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

export default function BoardTab({ orders: initialOrders, riskOverview, canManage }: { orders: OrderRow[]; riskOverview: RiskOrderRow[]; canManage: boolean }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const riskById = new Map(riskOverview.map((r) => [r.id, r]));
  const board = orders.filter((o) => o.status !== "CANCELLED");

  function onDragEnd(result: DropResult) {
    if (!canManage) return;
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as CustomerOrderStatus;
    const previous = orders;
    setOrders((prev) => prev.map((o) => (o.id === draggableId ? { ...o, status: newStatus } : o)));
    setError("");

    startTransition(async () => {
      try {
        await updateOrderStatus(draggableId, newStatus);
        router.refresh();
      } catch (err) {
        setOrders(previous);
        setError(err instanceof Error ? err.message : "Couldn't move order.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((status) => {
            const colOrders = board.filter((o) => o.status === status);
            return (
              <div key={status} className="w-64 shrink-0 rounded-xl border border-border bg-surface p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CUSTOMER_ORDER_STATUS_LABELS[status]}</p>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{colOrders.length}</span>
                </div>
                <Droppable droppableId={status}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[80px] space-y-2">
                      {colOrders.map((o, index) => {
                        const risk = riskById.get(o.id);
                        return (
                          <Draggable key={o.id} draggableId={o.id} index={index} isDragDisabled={!canManage}>
                            {(dragProvided, snapshot) => (
                              <BoardCard order={o} risk={risk} dragProvided={dragProvided} snapshot={snapshot} />
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {colOrders.length === 0 && <div className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">Empty</div>}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

function BoardCard({
  order,
  risk,
  dragProvided,
  snapshot,
}: {
  order: OrderRow;
  risk: RiskOrderRow | undefined;
  dragProvided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}) {
  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      className={`rounded-xl border border-border bg-surface-muted p-2.5 transition-shadow duration-150 ease-out ${snapshot.isDragging ? "card-elevated ring-1 ring-primary/40" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <Link href={`/customer-orders/${order.id}`} onMouseDown={(e) => e.stopPropagation()} className="text-xs font-medium text-foreground hover:underline">
          {order.orderNumber}
        </Link>
        <Badge tone={PRIORITY_TONE[order.priority]} className="text-[10px]">
          {order.priority}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">{order.customerName}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">Due {new Date(order.confirmedDeliveryDate ?? order.requestedDeliveryDate).toLocaleDateString()}</p>
      {risk && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {risk.risk.overdue && <Badge tone="danger" className="text-[10px]">Overdue</Badge>}
          {!risk.risk.overdue && risk.risk.atRisk && <Badge tone="warning" className="text-[10px]">At Risk</Badge>}
          {risk.qaStatus === "HELD" && <Badge tone="danger" className="text-[10px]">QA Hold</Badge>}
        </div>
      )}
    </div>
  );
}
