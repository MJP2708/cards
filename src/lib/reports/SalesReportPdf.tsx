import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import type { SalesReport } from "@/lib/reports/salesReport";

const NEUTRAL = "#334155";

function styles(accent: string) {
  return StyleSheet.create({
    page: { padding: 0, fontSize: 9, fontFamily: "Helvetica" },
    body: { padding: 28 },
    headerBand: {
      backgroundColor: accent,
      paddingHorizontal: 28,
      paddingVertical: 16,
      marginBottom: 18,
    },
    wordmark: {
      fontSize: 8,
      color: "#ffffff",
      opacity: 0.85,
      letterSpacing: 2,
      fontFamily: "Helvetica-Bold",
      marginBottom: 4,
    },
    title: { fontSize: 18, color: "#ffffff", fontFamily: "Helvetica-Bold" },
    subtitle: { fontSize: 9, color: "#ffffff", opacity: 0.85, marginTop: 3 },
    summaryRow: { flexDirection: "row", marginBottom: 16, gap: 12 },
    summaryBox: {
      borderLeft: `3 solid ${accent}`,
      backgroundColor: "#fafafa",
      borderRadius: 3,
      padding: 8,
      flexGrow: 1,
    },
    summaryLabel: { fontSize: 8, color: "#777" },
    summaryValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#111" },
    sectionTitle: {
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      marginTop: 16,
      marginBottom: 6,
      color: accent,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    table: { display: "flex", width: "100%" },
    tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, alignItems: "center" },
    trAlt: { backgroundColor: "#f7f7f7" },
    th: { fontFamily: "Helvetica-Bold", color: "#555", borderBottom: "1 solid #ddd", paddingBottom: 4 },
    thumb: { width: 22, height: 22, marginRight: 4, objectFit: "cover", borderRadius: 2 },
    colThumb: { width: "6%" },
    colCategory: { width: "12%" },
    colCard: { width: "26%" },
    colSeries: { width: "20%" },
    colPrice: { width: "12%", textAlign: "right" },
    colProfit: { width: "12%", textAlign: "right" },
    colNote: { width: "12%" },
    groupCard: { marginBottom: 8, borderRadius: 3, backgroundColor: "#fafafa", padding: 8 },
    groupRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  });
}

function money(n: number) {
  return `฿${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function SalesReportPdf({
  report,
  title,
  accentColor = NEUTRAL,
}: {
  report: SalesReport;
  title: string;
  accentColor?: string;
}) {
  const s = styles(accentColor);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBand}>
          <Text style={s.wordmark}>BOOTH CARDS</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>
            {report.from ? report.from.toLocaleDateString() : "All time"}
            {report.to ? ` – ${report.to.toLocaleDateString()}` : ""} · Category: {report.category ?? "All"}
          </Text>
        </View>

        <View style={s.body}>
          <View style={s.summaryRow}>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Total Revenue</Text>
              <Text style={s.summaryValue}>{money(report.totals.revenue)}</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Total Profit</Text>
              <Text style={s.summaryValue}>{money(report.totals.profit)}</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryLabel}>Items Sold</Text>
              <Text style={s.summaryValue}>{report.totals.itemCount}</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>Itemized Sales</Text>
          <View style={s.table}>
            <View style={[s.tr, s.th]}>
              <Text style={s.colThumb}></Text>
              <Text style={s.colCategory}>Category</Text>
              <Text style={s.colCard}>Card</Text>
              <Text style={s.colSeries}>Series/Set</Text>
              <Text style={s.colPrice}>Price</Text>
              <Text style={s.colProfit}>Profit</Text>
              <Text style={s.colNote}>Note</Text>
            </View>
            {report.lines.map((line, i) => (
              <View style={i % 2 === 1 ? [s.tr, s.trAlt] : s.tr} key={line.saleId}>
                <View style={s.colThumb}>
                  {line.photoFront && <Image src={line.photoFront} style={s.thumb} />}
                </View>
                <Text style={s.colCategory}>{line.category}</Text>
                <Text style={s.colCard}>{line.cardName}</Text>
                <Text style={s.colSeries}>{line.series}</Text>
                <Text style={s.colPrice}>{money(line.soldPrice)}</Text>
                <Text style={s.colProfit}>{money(line.profit)}</Text>
                <Text style={s.colNote}>{line.buyerNote ?? ""}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Breakdown by Category</Text>
          {report.byCategory.map((cat) => (
            <View key={cat.category} style={s.groupCard}>
              <View style={s.groupRow}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: "#111" }}>
                  {cat.category} — {cat.itemCount} items
                </Text>
                <Text style={{ fontFamily: "Helvetica-Bold", color: "#111" }}>
                  {money(cat.revenue)} revenue / {money(cat.profit)} profit
                </Text>
              </View>
              {cat.groups.map((g) => (
                <View style={s.groupRow} key={g.key}>
                  <Text style={{ paddingLeft: 12, color: "#555" }}>{g.key}</Text>
                  <Text style={{ color: "#555" }}>
                    {g.itemCount} items · {money(g.revenue)} / {money(g.profit)} profit
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
