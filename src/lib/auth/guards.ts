import { NextResponse } from "next/server";
import { auth, type Role } from "@/auth";

export type SessionUser = { id: string; email: string; name: string; role: Role };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role ?? "STAFF",
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

export async function requireAdmin(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const result = await requireUser();
  if ("response" in result) return result;
  if (result.user.role !== "ADMIN") {
    return {
      response: NextResponse.json({ error: "This action requires an admin account." }, { status: 403 }),
    };
  }
  return result;
}
