import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 border border-transparent",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "border border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15",
  success: "border border-success/30 bg-success/10 text-success hover:bg-success/15",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Presentation-only wrapper — always spreads the remaining native button props
 * (onClick, disabled, type, form, etc.) through untouched.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
});
