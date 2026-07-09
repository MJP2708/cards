"use client";

import { useTranslations } from "next-intl";

export const PAYMENT_METHOD_VALUES = ["Cash", "PromptPay", "Bank Transfer", "Credit Card", "Other"] as const;

// PromptPay is a Thai payment-network proper noun and stays as-is in both
// locales; the DB/reports keep the English value, only the label changes.
export function usePaymentMethodLabel() {
  const t = useTranslations("dialogs");
  const map: Record<string, string> = {
    Cash: t("paymentCash"),
    PromptPay: "PromptPay",
    "Bank Transfer": t("paymentBankTransfer"),
    "Credit Card": t("paymentCreditCard"),
    Other: t("paymentOther"),
  };
  return (method: string) => map[method] ?? method;
}
