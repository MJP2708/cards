import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
});

export async function GET() {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const users = await gate.db.user.findMany({
    // passwordHash is never selected — it must not leave the server.
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

/**
 * Admin-only account creation. The one public sign-up route (/api/auth/signup)
 * only works while the store has no owner at all — after that every account,
 * Staff or Admin, is created here.
 */
export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = createUserSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  // Checked against the base client, not the store-scoped one: an email is unique
  // across the whole install, so a scoped lookup would miss a clash in another
  // store and turn a clear 409 into a P2002 further down.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const user = await gate.db.user.create({
    data: {
      storeId: gate.user.storeId,
      email,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
