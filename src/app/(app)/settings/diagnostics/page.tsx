import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guards";
import { runDiagnostics } from "@/lib/diagnostics";
import { DiagnosticsView } from "@/components/settings/DiagnosticsView";

// Always reflect live state — a cached "everything's fine" at the booth is worse
// than no screen at all.
export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/all");

  const integrations = await runDiagnostics();
  return <DiagnosticsView initial={integrations} checkedAt={new Date().toISOString()} />;
}
