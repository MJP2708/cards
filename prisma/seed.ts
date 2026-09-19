import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BUILT_IN_CATEGORIES } from "../src/lib/defaultCategories";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** The store the sample data belongs to. Seeding is per-store now. */
const SEED_STORE_NAME = "Demo Store";

async function main() {
  // Reuse the demo store across runs so re-seeding tops it up rather than
  // stacking up a new store each time.
  const existing = await prisma.store.findFirst({ where: { name: SEED_STORE_NAME } });
  const store = existing ?? (await prisma.store.create({ data: { name: SEED_STORE_NAME } }));
  const storeId = store.id;

  await prisma.settings.upsert({
    where: { storeId },
    update: {},
    create: { storeId, minMarginPct: 20 },
  });

  // Same definitions every new store gets at sign-up, so seed data cannot drift.
  const categories = BUILT_IN_CATEGORIES;

  for (const category of categories) {
    await prisma.category.upsert({
      where: { storeId_key: { storeId, key: category.key } },
      update: category,
      create: { ...category, storeId },
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

  // Seeded cards are numbered in listed order, and the store's counter is moved
  // past them so a card added afterwards continues the sequence.
  for (const [index, card] of sampleCards.entries()) {
    await prisma.card.upsert({
      where: { storeId_qrCode: { storeId, qrCode: card.qrCode } },
      update: {},
      create: { ...card, storeId, lookupNumber: index + 1 },
    });
  }
  await prisma.store.update({
    where: { id: storeId },
    data: { nextLookupNumber: sampleCards.length + 1 },
  });

  console.log(
    `Seeded ${categories.length} categories and ${sampleCards.length} cards into "${SEED_STORE_NAME}".`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
