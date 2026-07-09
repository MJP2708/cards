"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CardDTO } from "@/lib/data/types";
import { useMarkSold } from "@/lib/data/cards";
import { useQueryClient } from "@tanstack/react-query";
import { PAYMENT_METHOD_VALUES, usePaymentMethodLabel } from "@/lib/paymentMethods";
import { InlineError } from "@/components/ui/InlineError";
import { Price } from "@/components/ui/Price";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

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
  const [detailsOpen, setDetailsOpen] = useState(false);

  // The overwhelmingly common case — one unit, at the listed price, for cash —
  // needs one tap. Anything else is one disclosure away, not a separate flow.
  const isDefaultCase = quantitySold === 1 && soldPrice === card.askingPrice.toString() && !buyerContact;

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

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
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
      if (saleId) {
        toast(t("soldToast", { name: card.name, price: Number(soldPrice).toLocaleString() }), {
          action: { label: t("undo"), onClick: () => undoSale(saleId) },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saleFailed"));
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="mark-sold-title" panelClassName="w-full max-w-sm p-5">
      <AnimatePresence mode="wait">
        {justSold ? (
          <motion.button
            key="success"
            type="button"
            onClick={onClose}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex w-full flex-col items-center gap-2 py-8"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            </motion.div>
            <p className="font-display text-lg font-semibold">{t("soldExclaim")}</p>
            <p className="text-xs text-foreground/40">{common("tapToClose")}</p>
          </motion.button>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }}>
            <h2 id="mark-sold-title" className="mb-1 text-lg font-semibold">
              {card.name}
            </h2>
            {error && <InlineError message={error} className="mb-3" />}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-surface-1 px-3 py-2.5">
                <span className="text-sm text-foreground/60">{t("salePriceLabel")}</span>
                <Price amountThb={Number(soldPrice) || 0} size="lg" />
              </div>

              {!detailsOpen ? (
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs text-foreground/50 hover:text-foreground"
                >
                  {t("editDetails")}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="space-y-3 rounded-md border border-border-1 p-3">
                  <label className="flex flex-col gap-1 text-sm">
                    {t("salePriceLabel")}
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={soldPrice}
                      onChange={(e) => setSoldPrice(e.target.value)}
                      className="rounded-md border border-border-1 px-3 py-2"
                    />
                  </label>
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
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    className="flex w-full items-center justify-center gap-1 text-xs text-foreground/50 hover:text-foreground"
                  >
                    {t("hideDetails")}
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={onClose}>
                  {common("cancel")}
                </Button>
                <Button type="submit" variant="primary" booth loading={markSold.isPending}>
                  {markSold.isPending
                    ? t("recording")
                    : isDefaultCase
                      ? t("confirmSaleAt", { price: `฿${Number(soldPrice).toLocaleString()}` })
                      : t("confirmSale")}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
