export type CardDTO = {
  id: string;
  category: string;
  name: string;
  series: string;
  year: number | null;
  cardNumber: string | null;
  cardType: string | null;
  rarity: string | null;
  grade: string | null;
  attributes: Record<string, unknown> | null;
  costBasis: number;
  askingPrice: number;
  quantity: number;
  status: "In Stock" | "Sold" | "Reserved" | "On Hold";
  photoFront: string | null;
  photoBack: string | null;
  qrCode: string | null;
  packed: boolean;
  isHot: boolean;
  hotNote: string | null;
  researchNotes: string | null;
  dateAdded: string;
  dateSold: string | null;
  soldPrice: number | null;
  buyerNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CardDetailDTO = CardDTO & {
  sales: Omit<SaleDTO, "card">[];
  priceComps: PriceCompDTO[];
};

export type SaleDTO = {
  id: string;
  cardId: string;
  card: CardDTO;
  soldPrice: number;
  paymentMethod: string;
  timestamp: string;
  buyerContact: string | null;
  bundleId: string | null;
};

export type PriceCompDTO = {
  id: string;
  cardId: string;
  source: string;
  price: number;
  url: string | null;
  fetchedAt: string;
};

export type CardFilters = {
  category?: string;
  status?: string;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
  packed?: boolean;
  isHot?: boolean;
  minPrice?: number;
  maxPrice?: number;
};
