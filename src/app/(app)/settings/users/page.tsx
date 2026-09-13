import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/guards";
import { storeDb } from "@/lib/db/scoped";
import { UsersManager } from "@/components/auth/UsersManager";

export default async function UsersPage() {
  const t = await getTranslations("auth");
  // Server-side gate: navigating straight to this URL as a MEMBER bounces, and
  // the /api/users routes refuse independently even if someone hits them directly.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/all");

  // Scoped: an owner manages their own store's people, never the whole install.
  const users = await storeDb(user.storeId).user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("membersTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-foreground/60">
        {t("membersIntro")}
      </p>
      <UsersManager
        initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={user.id}
      />
    </div>
  );
}
