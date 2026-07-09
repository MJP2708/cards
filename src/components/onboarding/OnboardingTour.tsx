"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { LayoutGrid, PackagePlus, CheckCircle2, FileBarChart, X } from "lucide-react";
import { useOnboardingStore } from "@/store/onboardingStore";

const STEP_ICONS = [LayoutGrid, PackagePlus, CheckCircle2, FileBarChart];

export function OnboardingTour() {
  const t = useTranslations("onboarding");
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

  const steps = STEP_ICONS.map((icon, i) => ({
    icon,
    title: t(`step${i + 1}Title`),
    body: t(`step${i + 1}Body`),
  }));
  const current = steps[step];
  const isLast = step === steps.length - 1;

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
          aria-label={t("skipTour")}
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
            {steps.map((_, i) => (
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
                {t("back")}
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
              {isLast ? t("done") : t("next")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
