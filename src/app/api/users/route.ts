import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const users = await prisma.user.findMany({
    // passwordHash is never selected — it must not leave the server.
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

/** Admin-only account creation. There is no public signup route by design. */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = createUserSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
