import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import type { SalesReport } from "@/lib/reports/salesReport";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 14 },
  summaryRow: { flexDirection: "row", marginBottom: 14, gap: 16 },
  summaryBox: { border: "1 solid #ddd", borderRadius: 4, padding: 8, flexGrow: 1 },
  summaryLabel: { fontSize: 8, color: "#777" },
  summaryValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  table: { display: "flex", width: "100%" },
  tr: { flexDirection: "row", borderBottom: "1 solid #eee", paddingVertical: 4, alignItems: "center" },
  th: { fontFamily: "Helvetica-Bold", color: "#555" },
  thumb: { width: 24, height: 24, marginRight: 4, objectFit: "cover" },
  colThumb: { width: "6%" },
  colCategory: { width: "12%" },
  colCard: { width: "26%" },
  colSeries: { width: "20%" },
  colPrice: { width: "12%", textAlign: "right" },
  colProfit: { width: "12%", textAlign: "right" },
  colNote: { width: "12%" },
  groupRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
});

function money(n: number) {
  return `฿${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function SalesReportPdf({ report, title }: { report: SalesReport; title: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {report.from ? report.from.toLocaleDateString() : "All time"}
          {report.to ? ` – ${report.to.toLocaleDateString()}` : ""} · Category: {report.category ?? "All"}
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <Text style={styles.summaryValue}>{money(report.totals.revenue)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Profit</Text>
            <Text style={styles.summaryValue}>{money(report.totals.profit)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Items Sold</Text>
            <Text style={styles.summaryValue}>{report.totals.itemCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Itemized Sales</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={styles.colThumb}></Text>
            <Text style={styles.colCategory}>Category</Text>
            <Text style={styles.colCard}>Card</Text>
            <Text style={styles.colSeries}>Series/Set</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colProfit}>Profit</Text>
            <Text style={styles.colNote}>Note</Text>
          </View>
          {report.lines.map((line) => (
            <View style={styles.tr} key={line.saleId}>
              <View style={styles.colThumb}>
                {line.photoFront && <Image src={line.photoFront} style={styles.thumb} />}
              </View>
              <Text style={styles.colCategory}>{line.category}</Text>
              <Text style={styles.colCard}>{line.cardName}</Text>
              <Text style={styles.colSeries}>{line.series}</Text>
              <Text style={styles.colPrice}>{money(line.soldPrice)}</Text>
              <Text style={styles.colProfit}>{money(line.profit)}</Text>
              <Text style={styles.colNote}>{line.buyerNote ?? ""}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Breakdown by Category</Text>
        {report.byCategory.map((cat) => (
          <View key={cat.category} style={{ marginBottom: 8 }}>
            <View style={styles.groupRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {cat.category} — {cat.itemCount} items
              </Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {money(cat.revenue)} revenue / {money(cat.profit)} profit
              </Text>
            </View>
            {cat.groups.map((g) => (
              <View style={styles.groupRow} key={g.key}>
                <Text style={{ paddingLeft: 12, color: "#555" }}>{g.key}</Text>
                <Text style={{ color: "#555" }}>
                  {g.itemCount} items · {money(g.revenue)} / {money(g.profit)} profit
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
