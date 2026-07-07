export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[color-mix(in_srgb,var(--secondary)_16%,var(--surface-1))] ${className}`}
      style={style}
      aria-hidden
    />
  );
}

export function CardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-t border-border-1 px-3 py-3">
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-40 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-lg border border-border-1 p-4">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-64 items-end gap-2 rounded-lg border border-border-1 p-4">
      {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
