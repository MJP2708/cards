import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guards";
import { runDiagnostics } from "@/lib/diagnostics";
import { storeDb } from "@/lib/db/scoped";
import { DiagnosticsView } from "@/components/settings/DiagnosticsView";

// Always reflect live state — a cached "everything's fine" at the booth is worse
// than no screen at all.
export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/all");

  const integrations = await runDiagnostics(storeDb(user.storeId));
  return <DiagnosticsView initial={integrations} checkedAt={new Date().toISOString()} />;
}
