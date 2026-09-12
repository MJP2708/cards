import { NextResponse } from "next/server";
import { auth, type Role } from "@/auth";
import { storeDb, type StoreDb } from "@/lib/db/scoped";

export type SessionUser = { id: string; email: string; name: string; role: Role; storeId: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  // A session without a store predates multi-tenancy (or is malformed); treat it
  // as signed out rather than guessing a store and touching someone's data.
  if (!session.user.storeId) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role ?? "MEMBER",
    storeId: session.user.storeId,
  };
}

/**
 * Route-handler guards. These are the authoritative check — the proxy only does a
 * cheap cookie sniff for redirects, and hiding a button in the UI is not enforcement.
 * Every mutating handler calls one of these before touching the database.
 *
 * Returns either the user or a Response to return immediately.
 */
export async function requireUser(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  return { user };
}

/**
 * The common case: a signed-in user plus a database client pinned to their store.
 *
 * Prefer this over `requireUser` + bare `prisma` anywhere a handler touches
 * store-owned tables — `db` cannot read or write another store's rows, so
 * isolation does not depend on remembering a `where` clause.
 */
export async function requireStore(): Promise<
  { user: SessionUser; db: StoreDb } | { response: NextResponse }
> {
  const result = await requireUser();
  if ("response" in result) return result;
  return { user: result.user, db: storeDb(result.user.storeId) };
}

/**
 * Actions that manage the store itself — adding or removing members, renaming it,
 * exporting everything. Members can run the shop; only the owner reshapes it.
 */
export async function requireOwner(): Promise<
  { user: SessionUser; db: StoreDb } | { response: NextResponse }
> {
  const result = await requireStore();
  if ("response" in result) return result;
  if (result.user.role !== "OWNER") {
    return {
      response: NextResponse.json(
        { error: "This action requires the store owner's account." },
        { status: 403 }
      ),
    };
  }
  return result;
}
