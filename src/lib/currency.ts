// usdExchangeRate is stored as "THB per 1 USD" (e.g. ~36).
export function toUsd(amountThb: number, usdExchangeRate: number | null | undefined): number | null {
  if (!usdExchangeRate) return null;
  return amountThb / usdExchangeRate;
}

export function formatUsdHint(amountThb: number, usdExchangeRate: number | null | undefined): string | null {
  const usd = toUsd(amountThb, usdExchangeRate);
  if (usd === null) return null;
  return `≈ $${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
