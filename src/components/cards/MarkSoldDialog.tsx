"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CardDTO } from "@/lib/data/types";
import { useMarkSold } from "@/lib/data/cards";
import { useQueryClient } from "@tanstack/react-query";
import { PAYMENT_METHOD_VALUES, usePaymentMethodLabel } from "@/lib/paymentMethods";

export function MarkSoldDialog({ card, onClose }: { card: CardDTO; onClose: () => void }) {
  const t = useTranslations("dialogs");
  const common = useTranslations("common");
  const paymentLabel = usePaymentMethodLabel();
  const markSold = useMarkSold();
  const qc = useQueryClient();
  const [quantitySold, setQuantitySold] = useState(1);
  const [soldPrice, setSoldPrice] = useState(card.askingPrice.toString());
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHOD_VALUES[0]);
  const [buyerContact, setBuyerContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSold, setJustSold] = useState(false);

  async function undoSale(saleId: string) {
    const res = await fetch(`/api/sales/${saleId}`, { method: "DELETE" });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("saleUndone"));
    } else {
      toast.error(t("undoFailed"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await markSold.mutateAsync({
        cardId: card.id,
        quantitySold,
        soldPrice: Number(soldPrice),
        paymentMethod,
        buyerContact: buyerContact || undefined,
      });
      setJustSold(true);
      const saleId = (result as { id?: string }).id;
      setTimeout(() => {
        onClose();
        if (saleId) {
          toast(t("soldToast", { name: card.name, price: Number(soldPrice).toLocaleString() }), {
            action: { label: t("undo"), onClick: () => undoSale(saleId) },
          });
        }
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saleFailed"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border-1 bg-background p-5 shadow-xl">
        <AnimatePresence mode="wait">
          {justSold ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-2 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              </motion.div>
              <p className="font-display text-lg font-semibold">{t("soldExclaim")}</p>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }}>
              <h2 className="mb-3 text-lg font-semibold">{t("markSoldTitle", { name: card.name })}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {card.quantity > 1 && (
                  <label className="flex flex-col gap-1 text-sm">
                    {t("quantitySoldLabel", { total: card.quantity })}
                    <input
                      type="number"
                      min={1}
                      max={card.quantity}
                      value={quantitySold}
                      onChange={(e) => setQuantitySold(Number(e.target.value))}
                      className="rounded-md border border-border-1 px-3 py-2"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-sm">
                  {t("salePriceLabel")}
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    value={soldPrice}
                    onChange={(e) => setSoldPrice(e.target.value)}
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
                    disabled={markSold.isPending}
                    className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                  >
                    {markSold.isPending ? t("recording") : t("confirmSale")}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
