"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPassword } from "@/lib/actions/account-actions";

export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(changeOwnPassword, undefined);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => router.push("/"), 1200);
      return () => clearTimeout(t);
    }
  }, [state?.ok, router]);

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
        Password updated. Taking you to the dashboard...
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {forced && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          You must set a new password before you can continue.
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Current password</span>
        <input
          name="currentPassword"
          type="password"
          required
          autoFocus
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">New password</span>
        <input
          name="newPassword"
          type="password"
          required
          minLength={6}
          placeholder="At least 6 characters"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
