import { HTMLAttributes } from "react";

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift/shadow — use for clickable or otherwise interactive cards. */
  interactive?: boolean;
  /** Use the stronger resting shadow (modals, popovers) instead of the flat default. */
  elevated?: boolean;
  /** Padding is a prop, not a className override — Tailwind utility source order isn't
   * guaranteed, so a caller's `p-*` in `className` can silently lose to this component's
   * own padding class instead of overriding it. */
  padding?: keyof typeof PADDING;
}

/** Presentation-only card surface — spreads remaining div props (onClick, etc.) through untouched. */
export function Card({ interactive = false, elevated = false, padding = "md", className = "", ...props }: CardProps) {
  const shadow = elevated ? "card-elevated" : "card-shadow";
  const hover = interactive ? "card-hover" : "";
  return (
    <div
      className={`rounded-xl border border-border bg-surface ${PADDING[padding]} ${shadow} ${hover} ${className}`}
      {...props}
    />
  );
}
