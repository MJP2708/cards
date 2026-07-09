"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CardDTO } from "@/lib/data/types";
import { useBundleSale } from "@/lib/data/cards";
import { PAYMENT_METHOD_VALUES, usePaymentMethodLabel } from "@/lib/paymentMethods";

export function BundleSaleDialog({ cards, onClose }: { cards: CardDTO[]; onClose: () => void }) {
  const t = useTranslations("dialogs");
  const common = useTranslations("common");
  const paymentLabel = usePaymentMethodLabel();
  const bundleSale = useBundleSale();
  const suggestedTotal = cards.reduce((sum, c) => sum + c.askingPrice, 0);
  const [totalPrice, setTotalPrice] = useState(suggestedTotal.toString());
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHOD_VALUES[0]);
  const [buyerContact, setBuyerContact] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await bundleSale.mutateAsync({
        cardIds: cards.map((c) => c.id),
        totalPrice: Number(totalPrice),
        paymentMethod,
        buyerContact: buyerContact || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bundleSaleFailed"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border-1 bg-background p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">{t("sellBundleTitle")}</h2>
        <p className="mb-3 text-xs text-foreground/60">{t("bundleDescription", { count: cards.length })}</p>
        <ul className="mb-3 max-h-28 overflow-y-auto text-xs text-foreground/70">
          {cards.map((c) => (
            <li key={c.id}>
              {c.name} ({c.category})
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="flex flex-col gap-1 text-sm">
            {t("combinedPriceLabel")}
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              className="rounded-md border border-border-1 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("paymentMethodLabel")}
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="rounded-md border border-border-1 px-3 py-2"
            >
              {PAYMENT_METHOD_VALUES.map((m) => (
                <option key={m} value={m}>
                  {paymentLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("buyerContactLabel")}
            <input
              value={buyerContact}
              onChange={(e) => setBuyerContact(e.target.value)}
              className="rounded-md border border-border-1 px-3 py-2"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-surface-1">
              {common("cancel")}
            </button>
            <button
              type="submit"
              disabled={bundleSale.isPending}
              className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
            >
              {bundleSale.isPending ? t("recording") : t("confirmBundleSale")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
