"use client";

import { useStatusLabel } from "@/lib/statusLabels";
import type { CardDTO } from "@/lib/data/types";

const STATUS_VARS: Record<CardDTO["status"], { color: string; tint: string }> = {
  "In Stock": { color: "var(--status-instock)", tint: "var(--status-instock-tint)" },
  Reserved: { color: "var(--status-reserved)", tint: "var(--status-reserved-tint)" },
  "On Hold": { color: "var(--status-hold)", tint: "var(--status-hold-tint)" },
  Sold: { color: "var(--status-sold)", tint: "var(--status-sold-tint)" },
};

// Color + shape + text, always together — color never carries the meaning
// alone, so this stays legible for colorblind users while still being much
// faster to scan than plain status text in a dense list.
export function StatusPill({ status, className = "" }: { status: CardDTO["status"]; className?: string }) {
  const statusLabel = useStatusLabel();
  const vars = STATUS_VARS[status] ?? STATUS_VARS.Sold;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ background: vars.tint, color: vars.color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: vars.color }} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
