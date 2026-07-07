"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useSalesReport, reportDownloadUrl } from "@/lib/data/reports";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { data: categories } = useCategories();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [category, setCategory] = useState("all");

  const filters = { from, to: `${to}T23:59:59.999Z`, category };
  const { data: report, isLoading } = useSalesReport(filters);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Sales Reports</h1>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5">
            <option value="all">All categories</option>
            {categories?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setFrom(todayISO());
            setTo(todayISO());
          }}
          className="booth-target rounded-md border border-border-1 px-3 py-2 hover:bg-surface-1"
        >
          Today (End of Day)
        </button>
        <a
          href={reportDownloadUrl("pdf", filters, "Sales Report")}
          className="booth-target rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-dark"
        >
          Download PDF
        </a>
        <a
          href={reportDownloadUrl("csv", filters)}
          className="booth-target rounded-md border border-border-1 px-4 py-2 hover:bg-surface-1"
        >
          Export CSV
        </a>
      </div>

      {isLoading && <p className="text-sm text-foreground/60">Loading…</p>}

      {report && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border-1 p-4">
              <p className="text-xs text-foreground/50">Total Revenue</p>
              <p className="text-2xl font-semibold">฿{report.totals.revenue.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border-1 p-4">
              <p className="text-xs text-foreground/50">Total Profit</p>
              <p className="text-2xl font-semibold">฿{report.totals.profit.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border-1 p-4">
              <p className="text-xs text-foreground/50">Items Sold</p>
              <p className="text-2xl font-semibold">{report.totals.itemCount}</p>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground/70">Breakdown by Category</h2>
            <div className="space-y-3">
              {report.byCategory.map((cat) => (
                <div key={cat.category} className="rounded-lg border border-border-1 p-3 text-sm">
                  <div className="flex justify-between font-medium">
                    <span>
                      {cat.category} · {cat.itemCount} items
                    </span>
                    <span>
                      ฿{cat.revenue.toLocaleString()} revenue / ฿{cat.profit.toLocaleString()} profit
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5 pl-4 text-foreground/60">
                    {cat.groups.map((g) => (
                      <li key={g.key} className="flex justify-between">
                        <span>{g.key}</span>
                        <span>
                          {g.itemCount} items · ฿{g.revenue.toLocaleString()} / ฿{g.profit.toLocaleString()} profit
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {report.byCategory.length === 0 && <p className="text-sm text-foreground/50">No sales in this range.</p>}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground/70">Itemized Sales</h2>
            <div className="overflow-x-auto rounded-lg border border-border-1">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 text-left text-xs uppercase text-foreground/60">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Card</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Profit</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Buyer Note</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((l) => (
                    <tr key={l.saleId} className="border-t border-border-1">
                      <td className="px-3 py-2">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2">{l.category}</td>
                      <td className="px-3 py-2">{l.cardName}</td>
                      <td className="px-3 py-2">฿{l.soldPrice.toLocaleString()}</td>
                      <td className="px-3 py-2">฿{l.profit.toLocaleString()}</td>
                      <td className="px-3 py-2">{l.paymentMethod}</td>
                      <td className="px-3 py-2">{l.buyerNote ?? "—"}</td>
                    </tr>
                  ))}
                  {report.lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-foreground/50">
                        No sales in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
