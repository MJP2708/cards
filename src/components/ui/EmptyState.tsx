import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-1 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-tint-strong)]">
        <Icon className="h-6 w-6" style={{ color: "var(--accent)" }} aria-hidden />
      </div>
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-foreground/60">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="booth-target mt-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="booth-target mt-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
