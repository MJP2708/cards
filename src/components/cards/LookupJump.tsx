"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Hash } from "lucide-react";
import { parseLookupNumber } from "@/lib/lookupNumber";

/**
 * "How much for card 47?" — type 47, land on the card.
 *
 * Deliberately a bare always-visible input rather than something behind a menu:
 * this is used mid-conversation with a customer waiting, so it has to be one
 * action. Accepts "47" or "#47", and submits on Enter.
 */
export function LookupJump({ className = "" }: { className?: string }) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function go(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseLookupNumber(value);
    if (parsed === null) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/lookup-number?number=${parsed}`);
      if (res.ok) {
        const card = (await res.json()) as { id: string; category: string };
        setValue("");
        router.push(`/${encodeURIComponent(card.category.toLowerCase())}/card/${card.id}`);
        return;
      }
      setError(t("lookupNotFound", { number: parsed }));
      // Keep focus and the typed value on a miss: the usual cause is a slip on
      // one digit, and retyping the whole thing with a customer waiting is worse
      // than correcting it.
      inputRef.current?.select();
    } catch {
      setError(t("lookupNotFound", { number: parsed }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go} className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-1.5 rounded-md border border-border-1 px-2 py-1.5 focus-within:border-accent">
        <Hash className="h-3.5 w-3.5 shrink-0 text-foreground/40" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          // Numeric keypad on a phone: this is typed one-handed at a booth.
          inputMode="numeric"
          enterKeyHint="go"
          aria-label={t("lookupJumpLabel")}
          placeholder={t("lookupJumpPlaceholder")}
          disabled={busy}
          className="w-24 bg-transparent text-sm tabular-nums outline-none placeholder:text-foreground/30"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
