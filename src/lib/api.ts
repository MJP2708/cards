import { NextResponse } from "next/server";

export async function readJsonBody(request: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}

export function invalidJsonResponse() {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

// Prisma throws P2025 when a delete/update target doesn't exist — treat that as
// a normal 404 instead of an unhandled 500 (e.g. a double-tapped delete button,
// or a stale id from another synced device).
export function isPrismaNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
