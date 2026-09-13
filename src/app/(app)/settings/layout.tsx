import { requireOwnerPage } from "@/lib/auth/guards";

/**
 * Owner-only section. The pages below are client components and cannot gate
 * themselves, so the boundary lives here — one place, so a new page added to this
 * section is protected by default rather than by remembering to add a check.
 */
export default async function OwnerOnlyLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return <>{children}</>;
}
