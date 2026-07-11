import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function todayAt(h = 0) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d;
}

async function main() {
  await prisma.payslip.deleteMany();
  await prisma.payRun.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.kpiRecord.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.weeklyAssignment.deleteMany();
  await prisma.dailyTask.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.team.deleteMany();
  await prisma.announcement.deleteMany();

  const blending = await prisma.team.create({
    data: { name: "Blending", description: "Raw material blending & mixing" },
  });
  const encapsulation = await prisma.team.create({
    data: { name: "Encapsulation", description: "Capsule filling & packing" },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const superAdmin = await prisma.employee.create({
    data: {
      name: "DKNS Super Admin",
      role: "SUPER_ADMIN",
      shift: "Day",
      email: "dhanu@healthicons.com",
      teamId: blending.id,
      hourlyRate: 0,
    },
  });
  await prisma.user.create({
    data: {
      username: "Dhanu",
      fullName: "Dhanu",
      passwordHash,
      role: "SUPER_ADMIN",
      employeeId: superAdmin.id,
      isPermanent: true,
    },
  });

  const admin = await prisma.employee.create({
    data: {
      name: "Dhanu Nand",
      role: "ADMIN",
      shift: "Day",
      email: "admin@eaglelabs.com",
      teamId: blending.id,
      photoUrl: null,
      hourlyRate: 42,
    },
  });
  await prisma.user.create({
    data: {
      username: "admin",
      fullName: "Dhanu Nand",
      passwordHash,
      role: "ADMIN",
      employeeId: admin.id,
    },
  });

  const blendingSupervisor = await prisma.employee.create({
    data: {
      name: "Eden Carter",
      role: "SUPERVISOR",
      shift: "Day",
      email: "eden@eaglelabs.com",
      teamId: blending.id,
      hourlyRate: 35,
    },
  });
  await prisma.user.create({
    data: {
      username: "eden",
      fullName: "Eden Carter",
      passwordHash,
      role: "SUPERVISOR",
      employeeId: blendingSupervisor.id,
    },
  });

  const encapSupervisor = await prisma.employee.create({
    data: {
      name: "Deepthi Rao",
      role: "SUPERVISOR",
      shift: "Day",
      email: "deepthi@eaglelabs.com",
      teamId: encapsulation.id,
      hourlyRate: 35,
    },
  });
  await prisma.user.create({
    data: {
      username: "deepthi",
      fullName: "Deepthi Rao",
      passwordHash,
      role: "SUPERVISOR",
      employeeId: encapSupervisor.id,
    },
  });

  const blendingEmployees = await Promise.all(
    ["Tibor Costa", "Ravi Shankar", "Sunita Patel"].map((name, i) =>
      prisma.employee.create({
        data: {
          name,
          role: "EMPLOYEE",
          shift: i === 2 ? "Night" : "Day",
          email: `${name.split(" ")[0].toLowerCase()}@eaglelabs.com`,
          teamId: blending.id,
          hourlyRate: 28.5,
        },
      })
    )
  );

  const encapEmployees = await Promise.all(
    ["Riqua Osei", "Himani Sharma", "Neel Verma"].map((name, i) =>
      prisma.employee.create({
        data: {
          name,
          role: "EMPLOYEE",
          shift: i === 2 ? "Night" : "Day",
          email: `${name.split(" ")[0].toLowerCase()}@eaglelabs.com`,
          teamId: encapsulation.id,
          hourlyRate: 27,
        },
      })
    )
  );

  await Promise.all(
    ["employee"].map(async (username) => {
      const emp = blendingEmployees[0];
      return prisma.user.create({
        data: {
          username,
          fullName: emp.name,
          passwordHash,
          role: "EMPLOYEE",
          employeeId: emp.id,
        },
      });
    })
  );

  const today = todayAt();

  await prisma.dailyTask.createMany({
    data: [
      {
        date: today,
        teamId: blending.id,
        employeeId: blendingSupervisor.id,
        product: "Gut AU",
        batchNo: "TBC",
        process: "Test Batch",
        targetQty: 10,
        targetUnit: "kg",
        actualQty: 10,
        plannedStart: "09:00",
        plannedFinish: "10:00",
        priority: "HIGH",
        status: "COMPLETED",
        updatedById: blendingSupervisor.id,
      },
      {
        date: today,
        teamId: blending.id,
        employeeId: blendingEmployees[0].id,
        product: "Gut AU",
        batchNo: "TBC",
        process: "Full Batch",
        targetQty: 120,
        targetUnit: "kg",
        actualQty: 45,
        plannedStart: "10:15",
        plannedFinish: "14:00",
        priority: "CRITICAL",
        status: "RUNNING",
        notes: "After the test batch has been successfully encapsulated",
      },
      {
        date: today,
        teamId: encapsulation.id,
        employeeId: encapSupervisor.id,
        product: "Gut AU",
        batchNo: "TBC",
        process: "Machine Setup",
        targetQty: null,
        priority: "HIGH",
        status: "COMPLETED",
        updatedById: encapSupervisor.id,
      },
      {
        date: today,
        teamId: encapsulation.id,
        employeeId: encapEmployees[0].id,
        product: "Gut AU",
        batchNo: "TBC",
        process: "Test Batch",
        priority: "HIGH",
        status: "RUNNING",
        notes: "After machine setup is completed",
      },
      {
        date: today,
        teamId: encapsulation.id,
        employeeId: encapEmployees[1].id,
        product: "Gut AU",
        batchNo: "TBC",
        process: "Encapsulation",
        targetQty: 284,
        targetUnit: "kg",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        notes: "After successful completion of the test batch",
      },
    ],
  });

  const weekStart = startOfWeek(new Date());
  const weeklyProducts: Record<string, string[]> = {
    [blending.id]: ["Male AU", "Detox US", "Glyco AU", "EL Detox", "Weight Loss"],
    [encapsulation.id]: ["Weight Loss", "Detox US", "Male AU", "Glyco AU / Detox", "TGC Cola"],
  };
  const teamEmployeePool: Record<string, string[]> = {
    [blending.id]: [blendingSupervisor.id, ...blendingEmployees.map((e) => e.id)],
    [encapsulation.id]: [encapSupervisor.id, ...encapEmployees.map((e) => e.id)],
  };

  const weeklyData = [];
  for (const teamId of [blending.id, encapsulation.id]) {
    for (let day = 0; day < 5; day++) {
      const pool = teamEmployeePool[teamId];
      for (let p = 0; p < 2; p++) {
        weeklyData.push({
          weekStart,
          dayOfWeek: day,
          teamId,
          employeeId: pool[(day + p) % pool.length],
          task: weeklyProducts[teamId][day % weeklyProducts[teamId].length],
          hours: 8,
        });
      }
    }
  }
  await prisma.weeklyAssignment.createMany({ data: weeklyData });

  const blendingKpi = await prisma.kpi.create({
    data: { teamId: blending.id, name: "Blend Output", unit: "kg", target: 600 },
  });
  const encapKpi = await prisma.kpi.create({
    data: { teamId: encapsulation.id, name: "Capsules Encapsulated", unit: "kg", target: 284 },
  });

  for (let i = 0; i < 5; i++) {
    const d = addDays(weekStart, i);
    await prisma.kpiRecord.create({
      data: { kpiId: blendingKpi.id, date: d, actual: 400 + i * 40 },
    });
    await prisma.kpiRecord.create({
      data: { kpiId: encapKpi.id, date: d, actual: 180 + i * 20 },
    });
  }

  const allEmployees = [
    admin,
    blendingSupervisor,
    encapSupervisor,
    ...blendingEmployees,
    ...encapEmployees,
  ];
  for (let i = 0; i < 5; i++) {
    const d = addDays(weekStart, i);
    for (const emp of allEmployees) {
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          date: d,
          status: "PRESENT",
          hoursWorked: 8,
          overtime: i === 3 ? 2 : 0,
        },
      });
    }
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId: blendingEmployees[1].id,
      startDate: addDays(today, 3),
      endDate: addDays(today, 4),
      type: "Annual",
      reason: "Family event",
      status: "PENDING",
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: encapEmployees[2].id,
      startDate: addDays(today, -2),
      endDate: addDays(today, -1),
      type: "Sick",
      reason: "Fever",
      status: "APPROVED",
      approverId: encapSupervisor.id,
    },
  });

  await prisma.announcement.create({
    data: {
      title: "Key Priorities",
      message:
        "Blending Room: Ensure RH is below 40% before starting. Handle all raw materials carefully, this is a probiotic product.\nCapsule Room: Ensure RH is below 40% before starting. Handle all powders with care, this is a probiotic product.\nCommon: Always follow GMP requirements and maintain excellent personal hygiene when handling probiotic products.",
    },
  });
  await prisma.announcement.create({
    data: {
      title: "Team Message",
      message: "Let's make this week productive by working safely, following GMP, and supporting one another.",
    },
  });

  console.log("Seed complete.");
  console.log("Login with: dhanu@healthicons.com / password123 (Permanent Super Admin)");
  console.log("            admin@eaglelabs.com / password123 (Admin)");
  console.log("            eden@eaglelabs.com / password123 (Supervisor, Blending)");
  console.log("            deepthi@eaglelabs.com / password123 (Supervisor, Encapsulation)");
  console.log("            employee@eaglelabs.com / password123 (Employee)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
