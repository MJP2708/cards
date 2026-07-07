import { LayoutGrid } from "lucide-react";
import type { ThemeTokens } from "@/lib/fieldSchema";

type IconProps = { className?: string; style?: React.CSSProperties };

function BasketballIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.3 5.3c2.4 2.4 3.7 4.4 3.7 6.7s-1.3 4.3-3.7 6.7M18.7 5.3c-2.4 2.4-3.7 4.4-3.7 6.7s1.3 4.3 3.7 6.7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SoccerBallIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.2 15.8 10l-1.5 4.5H9.7L8.2 10 12 7.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 7.2V4M15.8 10l3-1M14.3 14.5l1.4 3M9.7 14.5l-1.4 3M8.2 10l-3-1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EnergyBoltIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <path
        d="M13 3 5 13.5h5.5L10 21l8.5-11h-5.5L13 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardStackIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <rect x="6" y="3.5" width="12" height="16" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="6" width="12" height="16" rx="1.6" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

const ICONS: Record<ThemeTokens["iconSet"], (props: IconProps) => React.ReactElement> = {
  basketball: BasketballIcon,
  soccer: SoccerBallIcon,
  pokemon: EnergyBoltIcon,
  tcg: CardStackIcon,
  neutral: (props) => <LayoutGrid {...props} />,
};

export function CategoryIcon({
  iconSet,
  className = "h-5 w-5",
  style,
}: {
  iconSet: ThemeTokens["iconSet"];
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = ICONS[iconSet] ?? ICONS.neutral;
  return <Icon className={className} style={style} />;
}
