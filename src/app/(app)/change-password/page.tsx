import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Change Password</h1>
        <p className="text-sm text-muted-foreground">
          {session.mustChangePassword
            ? "You're using a temporary password — set a new one to continue."
            : "Update the password for your account."}
        </p>
      </div>
      <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
        <ChangePasswordForm forced={session.mustChangePassword} />
      </div>
    </div>
  );
}
