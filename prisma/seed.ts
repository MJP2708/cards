import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  NBA_FIELDS,
  FOOTBALL_FIELDS,
  POKEMON_FIELDS,
  TCG_FIELDS,
  type ThemeTokens,
} from "../src/lib/fieldSchema";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NBA_THEME: ThemeTokens = {
  accent: "#F97316",
  accentDark: "#C2410C",
  secondary: "#18181B",
  surface: "#FFF7ED",
  motif: "hardwood",
};

const FOOTBALL_THEME: ThemeTokens = {
  accent: "#16A34A",
  accentDark: "#15803D",
  secondary: "#FFFFFF",
  surface: "#F0FDF4",
  motif: "pitch",
};

const POKEMON_THEME: ThemeTokens = {
  accent: "#FBBF24",
  accentDark: "#D97706",
  secondary: "#3B82F6",
  surface: "#FFFBEB",
  motif: "holo",
};

const TCG_THEME: ThemeTokens = {
  accent: "#7C3AED",
  accentDark: "#5B21B6",
  secondary: "#334155",
  surface: "#F5F3FF",
  motif: "frame",
};

async function main() {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", minMarginPct: 20 },
  });

  const categories = [
    {
      key: "NBA",
      displayName: "NBA",
      icon: "basketball",
      sortOrder: 1,
      fieldSchema: NBA_FIELDS,
      themeTokens: NBA_THEME,
      isBuiltIn: true,
    },
    {
      key: "Football",
      displayName: "Football",
      icon: "football",
      sortOrder: 2,
      fieldSchema: FOOTBALL_FIELDS,
      themeTokens: FOOTBALL_THEME,
      isBuiltIn: true,
    },
    {
      key: "Pokemon",
      displayName: "Pokémon",
      icon: "pokeball",
      sortOrder: 3,
      fieldSchema: POKEMON_FIELDS,
      themeTokens: POKEMON_THEME,
      isBuiltIn: true,
    },
    {
      key: "TCG",
      displayName: "Other TCG",
      icon: "cards",
      sortOrder: 4,
      fieldSchema: TCG_FIELDS,
      themeTokens: TCG_THEME,
      isBuiltIn: true,
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { key: category.key },
      update: category,
      create: category,
    });
  }

  const sampleCards = [
    {
      category: "NBA",
      name: "LeBron James",
      series: "2003-04 Topps Chrome",
      year: 2003,
      cardNumber: "111",
      cardType: "Rookie",
      rarity: "1/500",
      grade: "PSA 9",
      attributes: { team: "Cavaliers", position: "SF" },
      costBasis: 15000,
      askingPrice: 42000,
      quantity: 1,
      qrCode: "NBA-LEBRON-RC-001",
    },
    {
      category: "NBA",
      name: "Victor Wembanyama",
      series: "2023-24 Prizm",
      year: 2023,
      cardNumber: "1",
      cardType: "Base",
      rarity: "Silver",
      grade: "Raw",
      attributes: { team: "Spurs", position: "C" },
      costBasis: 800,
      askingPrice: 1800,
      quantity: 2,
      qrCode: "NBA-WEMBY-001",
    },
    {
      category: "Football",
      name: "Patrick Mahomes",
      series: "2017 Panini Prizm",
      year: 2017,
      cardNumber: "269",
      cardType: "Rookie",
      rarity: "/99",
      grade: "PSA 10",
      attributes: { team: "Chiefs", position: "QB", league: "NFL" },
      costBasis: 3200,
      askingPrice: 6500,
      quantity: 1,
      qrCode: "NFL-MAHOMES-RC-001",
    },
    {
      category: "Football",
      name: "Lionel Messi",
      series: "2022 Panini Prizm World Cup",
      year: 2022,
      cardNumber: "5",
      cardType: "Insert",
      rarity: "Base",
      grade: "Raw",
      attributes: { team: "Argentina", position: "FW", league: "Soccer" },
      costBasis: 400,
      askingPrice: 950,
      quantity: 3,
      qrCode: "SOC-MESSI-001",
    },
    {
      category: "Pokemon",
      name: "Charizard",
      series: "Base Set",
      cardNumber: "4/102",
      cardType: "Pokemon",
      rarity: "Holo Rare",
      grade: "PSA 8",
      attributes: { language: "EN", pokemonCardType: "Pokemon" },
      costBasis: 5500,
      askingPrice: 12000,
      quantity: 1,
      qrCode: "PKM-CHARIZARD-BASE-001",
    },
    {
      category: "Pokemon",
      name: "Pikachu VMAX",
      series: "Vivid Voltage",
      cardNumber: "44/185",
      cardType: "Pokemon",
      rarity: "Secret Rare",
      grade: "Raw",
      attributes: { language: "EN", pokemonCardType: "Pokemon" },
      costBasis: 120,
      askingPrice: 280,
      quantity: 4,
      qrCode: "PKM-PIKAVMAX-001",
    },
    {
      category: "TCG",
      name: "Black Lotus",
      series: "Alpha",
      cardType: "Artifact",
      rarity: "Rare",
      grade: "PSA 3",
      attributes: { gameTitle: "Magic: The Gathering", tcgCardType: "Artifact" },
      costBasis: 250000,
      askingPrice: 400000,
      quantity: 1,
      qrCode: "MTG-BLACKLOTUS-001",
    },
    {
      category: "TCG",
      name: "Monkey D. Luffy (Leader)",
      series: "OP-01 Romance Dawn",
      cardType: "Leader",
      rarity: "Leader",
      grade: "Raw",
      attributes: { gameTitle: "One Piece", tcgCardType: "Leader" },
      costBasis: 60,
      askingPrice: 140,
      quantity: 5,
      qrCode: "OP-LUFFY-LEADER-001",
    },
  ];

  for (const card of sampleCards) {
    await prisma.card.upsert({
      where: { qrCode: card.qrCode },
      update: {},
      create: card,
    });
  }

  console.log(`Seeded ${categories.length} categories and ${sampleCards.length} cards.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
