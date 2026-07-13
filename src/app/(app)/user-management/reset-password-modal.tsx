"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/actions/user-management-actions";
import type { ManagedUser } from "./user-management-client";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordModal({
  user,
  onClose,
}: {
  user: ManagedUser;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    startTransition(async () => {
      try {
        await resetPassword(user.id, newPassword);
        router.refresh();
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not reset password");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Reset Password</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Set a new temporary password for <span className="font-medium text-foreground">{user.username}</span>.
          They&apos;ll be required to change it on next login.
        </p>
        <form action={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">New Temporary Password</span>
            <input
              name="newPassword"
              type="text"
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="input"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
