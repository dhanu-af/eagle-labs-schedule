import { prisma } from "@/lib/prisma";

export async function notifyEmployee(params: {
  employeeId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      employeeId: params.employeeId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
    },
  });
}

export async function notifyAllEmployees(params: {
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true },
  });

  await prisma.notification.createMany({
    data: employees.map((e) => ({
      employeeId: e.id,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
    })),
  });
}

export async function notifyManagers(params: {
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  const managers = await prisma.employee.findMany({
    where: { active: true, role: { in: ["ADMIN", "SUPER_ADMIN", "SUPERVISOR", "OPERATIONS"] } },
    select: { id: true },
  });

  await prisma.notification.createMany({
    data: managers.map((m) => ({
      employeeId: m.id,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
    })),
  });
}
