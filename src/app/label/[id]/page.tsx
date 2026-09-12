import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/guards";
import { storeDb } from "@/lib/db/scoped";
import { PrintButton } from "@/components/PrintButton";

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // This page had no gate: any id printed a label for it, across stores. The
  // scoped client turns another store's card into a plain 404.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("common");
  const card = await storeDb(user.storeId).card.findUnique({ where: { id } });
  if (!card) notFound();

  const code = card.qrCode ?? card.id;
  const qrDataUrl = await QRCode.toDataURL(code, { margin: 1, width: 240 });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="flex flex-col items-center gap-2 border border-dashed border-border-1 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={t("qrCodeAlt", { name: card.name })} width={200} height={200} />
        <p className="text-center text-sm font-semibold">{card.name}</p>
        <p className="text-center text-xs text-foreground/60">{card.series}</p>
        <p className="text-center text-xs text-foreground/40">{code}</p>
      </div>
      <PrintButton />
    </div>
  );
}
