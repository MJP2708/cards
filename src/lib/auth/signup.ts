import { prisma } from "@/lib/prisma";

/**
 * Public sign-up is a one-time bootstrap, not an open door.
 *
 * This install is single-tenant — every account shares one inventory — so an
 * always-open sign-up that grants ADMIN would let anyone who loads the URL take
 * over the shop's cards, sales and settings. Instead the route exists only until
 * the first account is created; after that an Admin adds people from
 * Settings -> Users, which is the flow the app already had.
 */
export async function signupAvailable(): Promise<boolean> {
  try {
    return (await prisma.user.count()) === 0;
  } catch {
    // If we can't tell, assume closed. Failing shut is the safe direction here.
    return false;
  }
}
