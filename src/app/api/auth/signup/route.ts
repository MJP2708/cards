import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signupSchema } from "@/lib/validation/signup";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

/**
 * Open sign-up: anyone can create an account, and each one gets its own store.
 *
 * That is safe here precisely because of tenancy — a new account lands in a brand
 * new, empty Store and every query is scoped to it (see `src/lib/db/scoped.ts`),
 * so a stranger signing up gains access to nothing but their own inventory.
 * Additional accounts inside an existing store are created by its OWNER instead,
 * via /api/users.
 */
export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();

  const parsed = signupSchema.safeParse(json.data);
  if (!parsed.success) {
    // Field-keyed so the form can put each message under its own input.
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, storeName, email, password } = parsed.data;
  // Hash before the transaction — bcrypt takes ~100ms and holding a write
  // transaction open across it serves nobody.
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { name: storeName } });
      return tx.user.create({
        data: { email, name, passwordHash, role: "OWNER", storeId: store.id },
        select: { id: true, email: true, name: true, role: true, storeId: true },
      });
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    // The unique index on email is the authority; checking first would race.
    if ((error as { code?: string } | null)?.code === "P2002") {
      return NextResponse.json(
        { error: { fieldErrors: { email: ["An account with that email already exists."] } } },
        { status: 409 }
      );
    }
    throw error;
  }
}
