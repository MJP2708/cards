/**
 * Creates a store and its OWNER account out-of-band.
 *
 *   npx tsx --env-file=.env scripts/create-admin.ts <email> <name> <password> [storeName]
 *
 * Sign-up at /signup does the same thing through the UI, so this is mainly a
 * recovery path: re-running with an existing email resets that account's
 * password and promotes it to OWNER of the store it already belongs to, which is
 * how you get back in after losing a password.
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";

async function main() {
  const [email, name, password, storeNameArg] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error(
      "Usage: npx tsx --env-file=.env scripts/create-admin.ts <email> <name> <password> [storeName]"
    );
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, storeId: true },
  });

  // Keep an existing account in its current store — a password reset must never
  // silently move someone's inventory to a brand new, empty store.
  const storeId =
    existing?.storeId ??
    (await prisma.store.create({ data: { name: storeNameArg?.trim() || `${name}'s Store` } })).id;

  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name, passwordHash, role: "OWNER", storeId },
    update: { passwordHash, role: "OWNER", name },
    select: { id: true, email: true, name: true, role: true, storeId: true },
  });

  const store = await prisma.store.findUnique({ where: { id: user.storeId }, select: { name: true } });
  console.log("Owner ready:", { ...user, store: store?.name });
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
