"use client";

import Image from "next/image";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { isOptimizableImageUrl } from "@/lib/images";
import type { ThemeTokens } from "@/lib/fieldSchema";

const SIZES = { sm: 40, md: 64, lg: 160 } as const;

export function CardThumbnail({
  photoFront,
  name,
  themeTokens,
  size = "sm",
  onClick,
}: {
  photoFront: string | null;
  name: string;
  themeTokens: Pick<ThemeTokens, "accent" | "iconSet"> | undefined;
  size?: keyof typeof SIZES;
  onClick?: () => void;
}) {
  const width = SIZES[size];
  const accent = themeTokens?.accent ?? "#64748B";

  const content = photoFront ? (
    <Image
      src={photoFront}
      alt={name}
      fill
      sizes={`${width}px`}
      unoptimized={!isOptimizableImageUrl(photoFront)}
      className="object-cover"
    />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: `color-mix(in srgb, ${accent} 14%, var(--surface-1))` }}
    >
      <CategoryIcon iconSet={themeTokens?.iconSet ?? "neutral"} className="h-2/5 w-2/5" style={{ color: accent, opacity: 0.55 }} />
    </div>
  );

  const className =
    "relative shrink-0 overflow-hidden rounded-md border border-border-1 bg-surface-1";
  const style = { width, aspectRatio: "5 / 7" };

  if (!onClick) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} transition-transform hover:scale-105`}
      style={style}
      aria-label={`View ${name} photo`}
    >
      {content}
    </button>
  );
}
