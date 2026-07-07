"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid, PackagePlus, CheckCircle2, FileBarChart, X } from "lucide-react";
import { useOnboardingStore } from "@/store/onboardingStore";

const STEPS = [
  {
    icon: LayoutGrid,
    title: "Switch categories anytime",
    body: "The tabs at the top switch between NBA, Football, or All Categories — the whole app re-themes (colors, icons, fonts) to match whichever you're in.",
  },
  {
    icon: PackagePlus,
    title: "Add a card in seconds",
    body: "\"Add Card\" from any category list opens a short form grouped into Identity, Pricing & Status, and Photos — status and quantity are pre-filled with sensible defaults.",
  },
  {
    icon: CheckCircle2,
    title: "Mark a sale with one tap",
    body: "Every row in the inventory list has its own \"Mark Sold\" button — no need to open the full card page. A quick popover asks for price and payment method.",
  },
  {
    icon: FileBarChart,
    title: "Reports & Dashboard live in the top nav",
    body: "Generate an End-of-Day PDF or CSV anytime from Reports, and watch today's revenue and items sold update live on the Dashboard.",
  },
];

export function OnboardingTour() {
  const hasSeenTour = useOnboardingStore((s) => s.hasSeenTour);
  const tourOpen = useOnboardingStore((s) => s.tourOpen);
  const openTour = useOnboardingStore((s) => s.openTour);
  const closeTour = useOnboardingStore((s) => s.closeTour);
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasSeenTour) openTour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tourOpen) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-lg border border-border-1 bg-background p-6 shadow-2xl"
      >
        <button
          onClick={() => {
            markSeen();
            closeTour();
          }}
          aria-label="Skip tour"
          className="absolute right-3 top-3 text-foreground/40 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center gap-3 py-2 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-1))]">
              <current.icon className="h-6 w-6" style={{ color: "var(--accent)" }} />
            </div>
            <p className="font-display text-lg font-semibold">{current.title}</p>
            <p className="text-sm text-foreground/60">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i === step ? "var(--accent)" : "var(--border-1)" }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="rounded-md px-3 py-1.5 text-sm hover:bg-surface-1">
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) {
                  markSeen();
                  setStep(0);
                } else {
                  setStep((s) => s + 1);
                }
              }}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
