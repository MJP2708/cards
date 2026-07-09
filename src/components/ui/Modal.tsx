"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useUiStore } from "@/store/uiStore";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One escape-to-close / outside-click / scroll-lock / focus-trap implementation,
// shared by every dialog and sheet in the app. Previously each of the five
// modal-like components reimplemented its own backdrop, and none of them
// handled Escape at all.
//
// `open` defaults to true for the common case (a dialog whose parent mounts
// it only while it's showing, e.g. `{soldCard && <MarkSoldDialog .../>}`).
// A component that instead stays permanently mounted and toggles visibility
// itself (the mobile "More" sheet) passes `open` explicitly so Modal's own
// AnimatePresence can play the close transition before unmounting.
export function Modal({
  open = true,
  onClose,
  children,
  labelledBy,
  panelClassName = "w-full max-w-sm",
  variant = "dialog",
  backdropClassName,
}: {
  open?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  panelClassName?: string;
  variant?: "dialog" | "sheet" | "bare";
  backdropClassName?: string;
}) {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Land keyboard/screen-reader focus inside the dialog on open rather than
    // leaving it on whatever triggered it, underneath the backdrop.
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const alignClass = variant === "sheet" ? "items-end justify-center" : "items-center justify-center";
  const initial =
    variant === "sheet"
      ? { y: "100%" }
      : reducedMotion
        ? { opacity: 1 }
        : { opacity: 0, scale: 0.96 };
  const animate = variant === "sheet" ? { y: 0 } : { opacity: 1, scale: 1 };
  const exit = variant === "sheet" ? { y: "100%" } : reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 };
  const transition =
    variant === "sheet" ? { type: "spring" as const, stiffness: 420, damping: 38 } : { duration: reducedMotion ? 0 : 0.16 };

  const panelBase =
    variant === "bare"
      ? ""
      : variant === "sheet"
        ? "pb-safe rounded-t-2xl border-t border-border-1 bg-background shadow-[var(--shadow-md)]"
        : "rounded-lg border border-border-1 bg-background shadow-[var(--shadow-md)]";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15 }}
          className={`fixed inset-0 z-50 flex p-4 ${backdropClassName ?? "bg-black/40"} ${alignClass}`}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
            onClick={(e) => e.stopPropagation()}
            className={`${panelBase} ${panelClassName}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
