import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { NBA_FIELDS, FOOTBALL_FIELDS, type ThemeTokens } from "../src/lib/fieldSchema";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NBA_THEME: ThemeTokens = {
  accent: "#F97316",
  accentDark: "#C2410C",
  secondary: "#18181B",
  surface: "#FFF7ED",
  motif: "hardwood",
  headerFont: "oswald",
  iconSet: "basketball",
};

const FOOTBALL_THEME: ThemeTokens = {
  accent: "#16A34A",
  accentDark: "#15803D",
  secondary: "#FFFFFF",
  surface: "#F0FDF4",
  motif: "pitch",
  headerFont: "barlowCondensed",
  iconSet: "soccer",
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
      name: "Lionel Messi",
      series: "2022 Panini Prizm World Cup",
      year: 2022,
      cardNumber: "5",
      cardType: "Insert",
      rarity: "Base",
      grade: "Raw",
      attributes: { team: "Argentina", position: "FW" },
      costBasis: 400,
      askingPrice: 950,
      quantity: 3,
      qrCode: "SOC-MESSI-001",
    },
    {
      category: "Football",
      name: "Kylian Mbappé",
      series: "2018 Panini Prizm World Cup",
      year: 2018,
      cardNumber: "12",
      cardType: "Rookie",
      rarity: "/149",
      grade: "PSA 9",
      attributes: { team: "France", position: "FW" },
      costBasis: 1900,
      askingPrice: 3900,
      quantity: 1,
      qrCode: "SOC-MBAPPE-RC-001",
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
