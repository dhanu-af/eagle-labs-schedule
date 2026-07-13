import { ThHTMLAttributes } from "react";

/** Presentation-only table header cell — matches the header-row style repeated across every table page. */
export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-3 py-2 font-medium ${className}`} {...props} />;
}

/** Pairs with Th inside a <thead><tr> that should get the standard header row styling. */
export const THEAD_ROW_CLASS =
  "border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground";
