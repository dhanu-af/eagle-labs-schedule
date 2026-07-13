import { HTMLAttributes } from "react";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

const TONE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary border-primary/40",
  success: "bg-success/10 text-success border-success/40",
  warning: "bg-warning/10 text-warning border-warning/40",
  danger: "bg-danger/10 text-danger border-danger/40",
  info: "bg-info/10 text-info border-info/40",
  muted: "bg-surface-muted text-muted-foreground border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/**
 * Presentation-only pill badge — spreads remaining span props through untouched.
 * Note: don't fight the base size/display classes via `className` (e.g. `hidden`,
 * a different `py-*`) — Tailwind utility source order isn't guaranteed, so such
 * overrides can silently lose to this component's own classes. Only pass additive
 * classes (extra children spacing like `gap-1.5`) or use a wrapping element instead.
 */
export function Badge({ tone = "muted", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone]} ${className}`}
      {...props}
    />
  );
}
