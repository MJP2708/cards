import { z } from "zod";

export const cardStatusSchema = z.enum(["In Stock", "Sold", "Reserved", "On Hold"]);

export const cardInputSchema = z.object({
  id: z.string().optional(), // set when replaying an offline-created card so its id never needs remapping
  category: z.string().min(1),
  name: z.string().min(1),
  series: z.string().min(1),
  year: z.number().int().optional().nullable(),
  cardNumber: z.string().optional().nullable(),
  cardType: z.string().optional().nullable(),
  rarity: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  costBasis: z.number().min(0),
  askingPrice: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
  status: cardStatusSchema.default("In Stock"),
  photoFront: z.string().optional().nullable(),
  photoBack: z.string().optional().nullable(),
  qrCode: z.string().optional().nullable(),
  packed: z.boolean().optional(),
  isHot: z.boolean().optional(),
  hotNote: z.string().optional().nullable(),
  buyerNote: z.string().optional().nullable(),
  researchNotes: z.string().optional().nullable(),
});
export type CardInput = z.infer<typeof cardInputSchema>;

export const cardUpdateSchema = cardInputSchema.partial();

export const markSoldSchema = z.object({
  quantitySold: z.number().int().min(1).default(1),
  soldPrice: z.number().min(0),
  paymentMethod: z.string().min(1),
  buyerContact: z.string().optional().nullable(),
  buyerNote: z.string().optional().nullable(),
});

export const bundleSaleSchema = z.object({
  cardIds: z.array(z.string()).min(1),
  totalPrice: z.number().min(0),
  paymentMethod: z.string().min(1),
  buyerContact: z.string().optional().nullable(),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["delete", "priceAdjust", "markPacked", "markUnpacked"]),
  payload: z
    .object({
      mode: z.enum(["percent", "fixed"]).optional(),
      amount: z.number().optional(),
    })
    .optional(),
});
