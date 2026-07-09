"use client";

import { useRef } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { CheckCircle2, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUiStore } from "@/store/uiStore";
import { useLongPress } from "@/hooks/useLongPress";

const SWIPE_THRESHOLD = 76;

// One gesture wrapper reused by both the grid and table rows: swipe right to
// sell, swipe left to select, long-press to enter selection mode — the three
// things a one-handed dealer needs to do to a card without a precise tap on a
// small target. Drag only ever engages past a real pointer movement, so a
// plain tap still passes straight through to the card link underneath.
export function SwipeableRow({
  onSwipeSell,
  onSwipeSelect,
  onLongPress,
  disabled,
  children,
  className = "",
}: {
  onSwipeSell: () => void;
  onSwipeSelect: () => void;
  onLongPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("inventory");
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const x = useMotionValue(0);
  const sellOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const selectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const draggedRef = useRef(false);
  const { pressing, handlers } = useLongPress(() => {
    if (!draggedRef.current) onLongPress();
  });

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    draggedRef.current = true;
    if (info.offset.x > SWIPE_THRESHOLD) onSwipeSell();
    else if (info.offset.x < -SWIPE_THRESHOLD) onSwipeSelect();
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!disabled && (
        <>
          <motion.div
            style={{ opacity: sellOpacity }}
            className="pointer-events-none absolute inset-y-0 left-0 flex w-20 items-center justify-center gap-1.5 bg-[var(--status-instock)] text-xs font-semibold text-white"
          >
            <CheckCircle2 className="h-4 w-4" /> {t("swipeToSell")}
          </motion.div>
          <motion.div
            style={{ opacity: selectOpacity }}
            className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-center gap-1.5 bg-accent text-xs font-semibold text-white"
          >
            <ListChecks className="h-4 w-4" /> {t("swipeToSelect")}
          </motion.div>
        </>
      )}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        style={{ x }}
        {...handlers}
        onPointerDown={(e) => {
          draggedRef.current = false;
          handlers.onPointerDown(e);
        }}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        animate={reducedMotion ? undefined : pressing ? { scale: 0.99 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        className="relative z-10 bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
}
