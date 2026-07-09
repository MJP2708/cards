const TONE_CLASS = {
  neutral: "bg-surface-hover text-text-secondary",
  success: "bg-[var(--success-50)] text-[var(--success-700)] dark:bg-[color-mix(in_srgb,var(--success-600)_18%,transparent)] dark:text-[var(--success-400)]",
  warning: "bg-[var(--warning-50)] text-[var(--warning-700)] dark:bg-[color-mix(in_srgb,var(--warning-600)_18%,transparent)] dark:text-[var(--warning-400)]",
  danger: "bg-[var(--danger-50)] text-[var(--danger-700)] dark:bg-[color-mix(in_srgb,var(--danger-600)_20%,transparent)] dark:text-[var(--danger-300)]",
  info: "bg-[var(--info-50)] text-[var(--info-700)] dark:bg-[color-mix(in_srgb,var(--info-600)_18%,transparent)] dark:text-[var(--info-300)]",
  accent: "bg-[var(--accent-tint-strong)] text-accent-dark",
} as const;

// One small filled pill, one place to keep tone/spacing/radius consistent —
// the "HOT" flag and similar short status flags previously hand-rolled their
// own bg/text color pair per usage.
export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: keyof typeof TONE_CLASS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}
