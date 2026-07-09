"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { isOptimizableImageUrl } from "@/lib/images";

export function PhotoLightbox({
  name,
  photoFront,
  photoBack,
  onClose,
}: {
  name: string;
  photoFront: string | null;
  photoBack: string | null;
  onClose: () => void;
}) {
  const photos = [photoFront, photoBack].filter((p): p is string => !!p);
  const [index, setIndex] = useState(0);
  const active = photos[index];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="relative max-h-[75vh] w-full max-w-md"
          style={{ aspectRatio: "5 / 7" }}
          onClick={(e) => e.stopPropagation()}
        >
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
        </motion.div>

        <p className="text-sm text-white/80">{name}</p>

        {photos.length > 1 && (
          <div className="flex gap-2">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i === index ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {i === 0 ? "Front" : "Back"}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
