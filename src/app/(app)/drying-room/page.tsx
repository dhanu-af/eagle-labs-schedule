import { prisma } from "@/lib/prisma";
import { getSession, canManageDryingRoom } from "@/lib/auth";
import DryingRoomClient from "./drying-room-client";

const BAY_COUNT = 7;
const DEFAULT_WHATSAPP_GROUPS = [
  { name: "Production Team", identifier: null },
  { name: "Management", identifier: null },
  { name: "Dhanu", identifier: "0433517390" },
  { name: "Wood", identifier: "+61421708100" },
];

export default async function DryingRoomPage() {
  const session = await getSession();

  const bayCount = await prisma.dryingBay.count();
  if (bayCount < BAY_COUNT) {
    await prisma.dryingBay.createMany({
      data: Array.from({ length: BAY_COUNT }, (_, i) => ({ bayNumber: i + 1 })),
      skipDuplicates: true,
    });
  }

  await prisma.whatsAppGroup.createMany({
    data: DEFAULT_WHATSAPP_GROUPS,
    skipDuplicates: true,
  });

  const [bays, misc, employees, whatsAppGroups] = await Promise.all([
    prisma.dryingBay.findMany({
      orderBy: { bayNumber: "asc" },
      include: {
        batches: {
          where: { completedAt: null },
          orderBy: { createdAt: "asc" },
          include: { trolleys: { orderBy: { trolleyNumber: "asc" } } },
        },
      },
    }),
    prisma.miscStorageItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.whatsAppGroup.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <DryingRoomClient
      bays={bays.map((b) => ({
        id: b.id,
        bayNumber: b.bayNumber,
        purpose: b.purpose,
        assignedEmployeeId: b.assignedEmployeeId,
        department: b.department,
        comments: b.comments,
        expectedFinishTime: b.expectedFinishTime?.toISOString() ?? null,
        updatedAt: b.updatedAt.toISOString(),
        batches: b.batches.map((batch) => ({
          id: batch.id,
          productName: batch.productName,
          batchNumber: batch.batchNumber,
          batchSize: batch.batchSize,
          batchSizeUnit: batch.batchSizeUnit,
          numberOfTrolleys: batch.numberOfTrolleys,
          trayCount: batch.trayCount,
          dateEnteredDryingRoom: batch.dateEnteredDryingRoom.toISOString(),
          dryingStartTime: batch.dryingStartTime?.toISOString() ?? null,
          currentStage: batch.currentStage,
          stageUpdatedAt: batch.stageUpdatedAt.toISOString(),
          assignedEmployeeId: batch.assignedEmployeeId,
          priorityRank: batch.priorityRank,
          trolleys: batch.trolleys.map((t) => ({
            id: t.id,
            trolleyNumber: t.trolleyNumber,
            quantity: t.quantity,
            trayCount: t.trayCount,
            wrapped: t.wrapped,
            rotationCompleted: t.rotationCompleted,
            qcStatus: t.qcStatus,
            assignedEmployeeId: t.assignedEmployeeId,
            remarks: t.remarks,
          })),
        })),
      }))}
      misc={misc.map((m) => ({
        id: m.id,
        product: m.product,
        batchNumber: m.batchNumber,
        quantityLabel: m.quantityLabel,
        storageType: m.storageType,
        status: m.status,
        requiredAction: m.requiredAction,
        location: m.location,
        remarks: m.remarks,
        updatedAt: m.updatedAt.toISOString(),
      }))}
      employees={employees}
      whatsAppGroups={whatsAppGroups.map((g) => ({ id: g.id, name: g.name }))}
      canManage={!!session && canManageDryingRoom(session.role)}
    />
  );
}
