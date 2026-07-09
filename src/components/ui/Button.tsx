"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "success";
type Size = "sm" | "md" | "lg";

// hover / focus / disabled all come from one shared rule each (global
// :focus-visible ring, global :active press-scale, this file's disabled
// treatment) rather than being redefined per variant — that's what keeps five
// variants from turning into five slightly-different-feeling buttons.
const VARIANT_CLASS: Record<Variant, string> = {
  primary: "border border-transparent bg-accent text-white hover:bg-accent-dark",
  secondary: "border border-border bg-transparent text-foreground hover:bg-surface-hover",
  ghost: "border border-transparent bg-transparent text-foreground/70 hover:bg-surface-hover hover:text-foreground",
  destructive:
    "border border-transparent bg-transparent text-[var(--danger-600)] hover:bg-[var(--danger-50)] dark:hover:bg-[color-mix(in_srgb,var(--danger-600)_16%,transparent)]",
  success: "border border-transparent bg-[var(--success-600)] text-white hover:brightness-95",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1",
  md: "px-4 py-2 text-sm gap-1.5",
  lg: "px-5 py-2.5 text-[0.9375rem] gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ComponentType<{ className?: string }>;
    /** Opts into the existing booth-mode enlarged minimum (`.booth-target`). */
    booth?: boolean;
  }
>(function Button(
  { variant = "primary", size = "md", loading = false, icon: Icon, booth = false, className = "", children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${booth ? "booth-target" : ""} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
});
