import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ChangePasswordForm from "./change-password-form";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        title="Change Password"
        subtitle={
          session.mustChangePassword
            ? "You're using a temporary password — set a new one to continue."
            : "Update the password for your account."
        }
      />
      <Card>
        <ChangePasswordForm forced={session.mustChangePassword} />
      </Card>
    </div>
  );
}
