/**
 * Bootstraps the first ADMIN account — there is no public signup, so the very first
 * user has to be created out-of-band.
 *
 *   npx tsx --env-file=.env scripts/create-admin.ts <email> <name> <password>
 *
 * Re-running with an existing email resets that account's password and promotes it
 * to ADMIN, which doubles as the recovery path if you lock yourself out.
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error("Usage: npx tsx --env-file=.env scripts/create-admin.ts <email> <name> <password>");
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name, passwordHash, role: "ADMIN" },
    update: { passwordHash, role: "ADMIN", name },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log("Admin ready:", user);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
