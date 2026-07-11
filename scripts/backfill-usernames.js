const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

const OVERRIDES = {
  "dhanu@healthicons.com": { username: "Dhanu", fullName: "Dhanu" },
  "deepthi@capsules": { username: "deepthu", fullName: "Deepthu" },
};

function slugify(local) {
  return local.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const users = await prisma.user.findMany({
    include: { employee: { include: { team: true } } },
  });

  const used = new Set();

  for (const u of users) {
    if (u.username) {
      used.add(u.username.toLowerCase());
    }
  }

  for (const u of users) {
    if (u.username) continue;

    const override = OVERRIDES[u.email ?? ""];
    let username = override?.username ?? slugify((u.email ?? "user").split("@")[0]);
    let candidate = username;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${username}${n}`;
      n++;
    }
    username = candidate;
    used.add(username.toLowerCase());

    const fullName = override?.fullName ?? u.employee?.name ?? username;
    const department = u.employee?.team?.name ?? null;

    await prisma.user.update({
      where: { id: u.id },
      data: { username, fullName, department },
    });

    console.log(`${u.email ?? "(no email)"} -> username="${username}" fullName="${fullName}" department="${department}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
