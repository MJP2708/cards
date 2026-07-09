import { UsdHint } from "@/components/UsdHint";

const SIZE_CLASS = {
  sm: "text-price-sm",
  md: "text-price-md",
  lg: "text-price-lg",
} as const;

// The one figure a dealer and a buyer both stare at — gets its own type scale
// (tabular-nums so a column of prices lines up on the digit) instead of
// inheriting whatever size the surrounding row happens to use.
export function Price({
  amountThb,
  size = "md",
  showUsd = false,
  className = "",
}: {
  amountThb: number;
  size?: keyof typeof SIZE_CLASS;
  showUsd?: boolean;
  className?: string;
}) {
  return (
    <span className={`tabular-nums ${SIZE_CLASS[size]} ${className}`}>
      ฿{amountThb.toLocaleString()}
      {showUsd && <UsdHint amountThb={amountThb} className="text-xs font-normal" />}
    </span>
  );
}
