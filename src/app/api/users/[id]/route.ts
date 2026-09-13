import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["OWNER", "MEMBER"]).optional(),
  // Owner-assisted reset: the owner sets a new password directly, so no email
  // service is needed to get a locked-out helper back on the till mid-event.
  password: z.string().min(MIN_PASSWORD_LENGTH).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = updateUserSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Don't let the last owner demote themselves and lock the store out of its own
  // settings. This counted the pre-multi-tenancy "ADMIN" role, which no longer
  // exists — so the count was always 0 and the guard never fired.
  if (parsed.data.role === "MEMBER") {
    const target = await gate.db.user.findUnique({ where: { id } });
    if (target?.role === "OWNER") {
      const owners = await gate.db.user.count({ where: { role: "OWNER" } });
      if (owners <= 1) {
        return NextResponse.json(
          { error: "This is the store's only owner — promote someone else first." },
          { status: 409 }
        );
      }
    }
  }

  const user = await gate.db.user.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  if (id === gate.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 409 });
  }

  const target = await gate.db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "OWNER") {
    const owners = await gate.db.user.count({ where: { role: "OWNER" } });
    if (owners <= 1) {
      return NextResponse.json({ error: "This is the store's only owner." }, { status: 409 });
    }
  }

  // Sale.userId is ON DELETE SET NULL, so sales history survives — the sale stays,
  // it just loses its attribution.
  await gate.db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
