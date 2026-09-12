import { prisma } from "@/lib/prisma";

/**
 * The product's own name, used on signed-out pages (/login, /signup) where there
 * is no store context yet, and as the fallback if a store can't be read.
 */
export const APP_NAME = "Booth Cards";
export const DEFAULT_STORE_NAME = APP_NAME;

/**
 * A store's display name, read at render time so a rename takes effect on the
 * next render rather than needing a rebuild.
 *
 * It lives on `Store`, not on `User`: one name per tenant means an owner and
 * their members always see the same shop, and it cannot drift between accounts.
 */
export async function getStoreName(storeId: string | null | undefined): Promise<string> {
  if (!storeId) return DEFAULT_STORE_NAME;
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });
    return store?.name?.trim() || DEFAULT_STORE_NAME;
  } catch {
    return DEFAULT_STORE_NAME;
  }
}
