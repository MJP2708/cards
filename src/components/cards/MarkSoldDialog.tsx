"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import type { CardDTO } from "@/lib/data/types";
import { useMarkSold } from "@/lib/data/cards";
import { useQueryClient } from "@tanstack/react-query";

const PAYMENT_METHODS = ["Cash", "PromptPay", "Bank Transfer", "Credit Card", "Other"];

async function undoSale(saleId: string, qc: ReturnType<typeof useQueryClient>) {
  const res = await fetch(`/api/sales/${saleId}`, { method: "DELETE" });
  if (res.ok) {
    qc.invalidateQueries({ queryKey: ["cards"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Sale undone");
  } else {
    toast.error("Couldn't undo — the sale may already be reflected in a report.");
  }
}

export function MarkSoldDialog({ card, onClose }: { card: CardDTO; onClose: () => void }) {
  const markSold = useMarkSold();
  const qc = useQueryClient();
  const [quantitySold, setQuantitySold] = useState(1);
  const [soldPrice, setSoldPrice] = useState(card.askingPrice.toString());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [buyerContact, setBuyerContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSold, setJustSold] = useState(false);

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
          toast(`Sold "${card.name}" for ฿${Number(soldPrice).toLocaleString()}`, {
            action: { label: "Undo", onClick: () => undoSale(saleId, qc) },
          });
        }
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sale");
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
              <p className="font-display text-lg font-semibold">Sold!</p>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }}>
              <h2 className="mb-3 text-lg font-semibold">Mark Sold — {card.name}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {card.quantity > 1 && (
                  <label className="flex flex-col gap-1 text-sm">
                    Quantity sold (of {card.quantity})
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
                  Sale price (THB)
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
                  Payment method
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="rounded-md border border-border-1 px-3 py-2"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Buyer contact (optional)
                  <input
                    value={buyerContact}
                    onChange={(e) => setBuyerContact(e.target.value)}
                    className="rounded-md border border-border-1 px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-surface-1">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={markSold.isPending}
                    className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                  >
                    {markSold.isPending ? "Recording…" : "Confirm Sale"}
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
