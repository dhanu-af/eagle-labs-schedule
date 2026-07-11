"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/lib/actions/auth-actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-sm font-medium text-emerald-50/80">User ID</label>
        <input
          name="username"
          type="text"
          required
          autoFocus
          autoComplete="username"
          placeholder="Enter your User ID"
          className="w-full rounded-xl border border-transparent bg-emerald-50/95 px-3 py-2.5 text-sm text-emerald-950 placeholder:text-emerald-900/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/60"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-emerald-50/80">Password</label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-transparent bg-emerald-50/95 px-3 py-2.5 pr-16 text-sm text-emerald-950 placeholder:text-emerald-900/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-emerald-900/50 hover:text-emerald-900/80"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-emerald-50/70">
        <input
          name="remember"
          type="checkbox"
          className="h-4 w-4 rounded border-emerald-400/40 bg-emerald-50/10 accent-emerald-400"
        />
        Remember me
      </label>

      {state?.error && (
        <p
          className="rounded-xl border px-3 py-2 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            borderColor: "rgba(248,113,113,0.25)",
            color: "#fca5a5",
          }}
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full py-2.5 text-sm font-bold text-emerald-950 transition hover:brightness-110 disabled:opacity-60"
        style={{
          background: "linear-gradient(90deg, #34d399 0%, #2dd4bf 100%)",
          boxShadow: "0 0 24px rgba(45,212,191,0.35)",
        }}
      >
        {pending ? "Signing in..." : "Log in"}
      </button>
    </form>
  );
}
