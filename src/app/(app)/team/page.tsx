import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, isAdminRole, canEdit } from "@/lib/auth";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) redirect("/");

  const [teams, employees] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      include: { team: true, user: true },
      orderBy: [{ teamId: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <TeamClient
      currentRole={session.role}
      canEdit={canEdit(session.role)}
      teams={teams}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        teamId: e.teamId,
        teamName: e.team.name,
        shift: e.shift,
        active: e.active,
        photoUrl: e.photoUrl,
        isPermanent: e.user?.isPermanent ?? false,
      }))}
    />
  );
}
