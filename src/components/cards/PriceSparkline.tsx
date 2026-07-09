"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import type { PriceCompDTO } from "@/lib/data/types";

export function PriceSparkline({ comps }: { comps: PriceCompDTO[] }) {
  const t = useTranslations("cardDetail");

  if (comps.length < 2) {
    return <p className="text-xs text-foreground/50">{t("needMoreComps")}</p>;
  }

  const data = [...comps]
    .sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime())
    .map((c) => ({ date: new Date(c.fetchedAt).toLocaleDateString(), price: c.price }));

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip
            formatter={(value) => [`฿${Number(value).toLocaleString()}`, t("tooltipPrice")]}
            contentStyle={{ fontSize: 12 }}
          />
          <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
