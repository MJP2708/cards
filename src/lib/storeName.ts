import { prisma } from "@/lib/prisma";

/**
 * Shown before an owner has set a real name, and whenever the database can't be
 * reached — /login and /signup have to render even then, so this must never throw.
 */
export const DEFAULT_STORE_NAME = "Booth Cards";

/**
 * The store's display name.
 *
 * Lives on the `Settings` singleton rather than on `User` because this install is
 * single-tenant: one inventory shared by every account. Putting it on `User` would
 * let an Admin and their Staff see different names for the same shop. Read at
 * render time so renaming the store in Settings takes effect on the next render.
 */
export async function getStoreName(): Promise<string> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { storeName: true },
    });
    return settings?.storeName?.trim() || DEFAULT_STORE_NAME;
  } catch {
    return DEFAULT_STORE_NAME;
  }
}
