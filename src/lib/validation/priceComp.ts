import { z } from "zod";

export const COMP_SOURCES = ["eBay", "130point", "PWCC", "TCGplayer", "PriceCharting", "Manual"] as const;

export const priceCompInputSchema = z.object({
  source: z.enum(COMP_SOURCES),
  price: z.number().min(0),
  url: z.string().url().optional().nullable().or(z.literal("")),
});
export type PriceCompInput = z.infer<typeof priceCompInputSchema>;
