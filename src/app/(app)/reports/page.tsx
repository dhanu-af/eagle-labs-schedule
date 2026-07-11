import { redirect } from "next/navigation";
import { getSession, canManageRole } from "@/lib/auth";
import ReportsClient from "./reports-client";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || !canManageRole(session.role)) redirect("/");

  return <ReportsClient />;
}
