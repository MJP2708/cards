"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
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
  isStock = false,
}: {
  photoFront: string | null;
  name: string;
  themeTokens: Pick<ThemeTokens, "accent" | "iconSet"> | undefined;
  size?: keyof typeof SIZES;
  onClick?: () => void;
  /** Photo came from a marketplace listing, not the seller's own camera. */
  isStock?: boolean;
}) {
  const t = useTranslations("inventory");
  const width = SIZES[size];
  const accent = themeTokens?.accent ?? "#64748B";

  const content = photoFront ? (
    <>
      <Image
        // The alt text carries the caveat too: a screen-reader user gets the same
        // warning the sighted badge gives, rather than a picture described as if
        // it were this card.
        src={photoFront}
        alt={isStock ? t("stockPhotoAlt", { name }) : name}
        fill
        sizes={`${width}px`}
        unoptimized={!isOptimizableImageUrl(photoFront)}
        className="object-cover"
      />
      {isStock && (
        // Only drawn where it is legible. At 40px the badge would be a smudge, so
        // the small size relies on the alt text and the detail view instead of
        // showing a mark nobody can read.
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[9px] font-medium uppercase leading-tight tracking-wide text-white"
          style={{ display: width >= SIZES.md ? undefined : "none" }}
        >
          {t("stockPhotoBadge")}
        </span>
      )}
    </>
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
      aria-label={t("viewPhoto", { name })}
    >
      {content}
    </button>
  );
}
