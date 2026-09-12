import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signupSchema } from "@/lib/validation/signup";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

/** Thrown inside the transaction when an account already exists. */
class SignupClosedError extends Error {}

const CLOSED_MESSAGE =
  "Sign-up is closed. This store already has an owner — ask them to create an account for you.";

/**
 * Creates the store's first ADMIN account, then the caller signs in normally.
 *
 * Deliberately unauthenticated, and deliberately usable exactly once: see
 * `signupAvailable` for why an open ADMIN sign-up would be a hole rather than a
 * feature on a single-tenant install.
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
  // Hash before opening the transaction — bcrypt takes ~100ms and holding a
  // Serializable transaction open across it invites needless write conflicts.
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.$transaction(
      async (tx) => {
        // Re-check inside the transaction, not just in the page that rendered the
        // form: two people posting at once must not both become owners.
        if ((await tx.user.count()) > 0) throw new SignupClosedError();

        const created = await tx.user.create({
          data: { email, name, passwordHash, role: "ADMIN" },
          select: { id: true, email: true, name: true, role: true },
        });

        // The store name belongs to the install, not the person who signed up.
        await tx.settings.upsert({
          where: { id: "singleton" },
          update: { storeName },
          create: { id: "singleton", storeName },
        });

        return created;
      },
      // Serializable so the count check and the insert can't interleave.
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof SignupClosedError) {
      return NextResponse.json({ error: CLOSED_MESSAGE }, { status: 403 });
    }
    // A serialization failure (40001) or the unique email index both mean
    // someone else won the race — same outcome for the caller.
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2002" || code === "P2034") {
      return NextResponse.json({ error: CLOSED_MESSAGE }, { status: 403 });
    }
    throw error;
  }
}
