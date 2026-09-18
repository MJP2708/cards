"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { X } from "lucide-react";
import { isOptimizableImageUrl } from "@/lib/images";
import { Modal } from "@/components/ui/Modal";

export function PhotoLightbox({
  name,
  photoFront,
  photoBack,
  onClose,
  isStock = false,
}: {
  name: string;
  photoFront: string | null;
  photoBack: string | null;
  onClose: () => void;
  /** Front photo came from a marketplace listing rather than the seller's camera. */
  isStock?: boolean;
}) {
  const t = useTranslations("inventory");
  const photos = [photoFront, photoBack].filter((p): p is string => !!p);
  const [index, setIndex] = useState(0);
  const active = photos[index];
  // Only the front is ever auto-filled, so the caveat applies to that image only.
  const showingStock = isStock && active === photoFront;

  return (
    <Modal onClose={onClose} variant="bare" backdropClassName="bg-black/80" panelClassName="relative flex flex-col items-center gap-4 p-6">
      <button
        onClick={onClose}
        aria-label="Close"
        className="tap-compact absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative max-h-[75vh] w-full max-w-md" style={{ aspectRatio: "5 / 7" }}>
        {active ? (
          <Image
            src={active}
            alt={name}
            fill
            sizes="500px"
            unoptimized={!isOptimizableImageUrl(active)}
            className="rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/5 text-sm text-white/60">
            No photo uploaded
          </div>
        )}
      </div>

      <p className="text-sm text-white/80">{name}</p>
      {showingStock && (
        // Full size is exactly where someone would try to judge condition from the
        // picture, so this is where the warning has to be explicit rather than a badge.
        <p className="max-w-md text-center text-xs text-amber-300">{t("stockPhotoWarning")}</p>
      )}

      {photos.length > 1 && (
        <div className="flex gap-2">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`tap-compact rounded-full px-3 py-1 text-xs font-medium ${
                i === index ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {i === 0 ? "Front" : "Back"}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
