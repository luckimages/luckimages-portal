import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

export type BrochureData = {
  photos: string[];
  address?: string;
  price?: string;
  details?: string;
  features?: string[];
  description?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  agentHeadshotB64?: string;
  brokerage?: string;
  brokerageLogoB64?: string;
  mlsNumber?: string;
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#ffffff", flexDirection: "column" },
  photoGrid: { flexDirection: "row", height: 300, width: "100%" },
  photoSmall: { flex: 1, objectFit: "cover" },
  photoMain: { flex: 2, objectFit: "cover" },
  photoSide: { flex: 1, flexDirection: "column" },
  photoSingle: { width: "100%", height: 300, objectFit: "cover" },
  body: { flex: 1, flexDirection: "row", padding: 32, gap: 24 },
  left: { flex: 3, flexDirection: "column", gap: 14 },
  right: { flex: 1.4, flexDirection: "column", gap: 14, borderLeft: "1 solid #e5e5e5", paddingLeft: 24 },
  address: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#111", lineHeight: 1.2 },
  price: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#111", marginTop: 2 },
  detailsRow: { flexDirection: "row", gap: 16, marginTop: 2, flexWrap: "wrap" },
  detail: { fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 },
  sectionLabel: { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  description: { fontSize: 9, color: "#444", lineHeight: 1.6 },
  featureRow: { flexDirection: "row", alignItems: "flex-start" },
  featureDot: { fontSize: 9, color: "#888", marginRight: 6 },
  featureItem: { fontSize: 9, color: "#333", lineHeight: 1.5, flex: 1 },
  agentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  agentHeadshot: { width: 52, height: 52, objectFit: "cover" },
  agentInfo: { flex: 1, flexDirection: "column", gap: 2 },
  agentName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111" },
  agentBrokerage: { fontSize: 8, color: "#666" },
  agentContact: { fontSize: 8, color: "#444" },
  brokerageLogo: { height: 28, maxWidth: 100, objectFit: "contain", marginTop: 4 },
  footer: { borderTop: "1 solid #eee", paddingHorizontal: 32, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#bbb", letterSpacing: 1, textTransform: "uppercase" },
  mlsText: { fontSize: 7, color: "#bbb", letterSpacing: 0.5 },
});

function PhotoGrid({ photos }: { photos: string[] }) {
  if (!photos.length) return null;
  if (photos.length === 1) return <Image src={photos[0]} style={s.photoSingle} />;
  if (photos.length === 2) return (
    <View style={s.photoGrid}>
      <Image src={photos[0]} style={s.photoSmall} />
      <Image src={photos[1]} style={s.photoSmall} />
    </View>
  );
  if (photos.length === 3) return (
    <View style={s.photoGrid}>
      <Image src={photos[0]} style={s.photoMain} />
      <View style={s.photoSide}>
        <Image src={photos[1]} style={s.photoSmall} />
        <Image src={photos[2]} style={s.photoSmall} />
      </View>
    </View>
  );
  return (
    <View style={s.photoGrid}>
      <View style={{ flex: 1, flexDirection: "column" }}>
        <Image src={photos[0]} style={s.photoSmall} />
        <Image src={photos[2]} style={s.photoSmall} />
      </View>
      <View style={{ flex: 1, flexDirection: "column" }}>
        <Image src={photos[1]} style={s.photoSmall} />
        <Image src={photos[3]} style={s.photoSmall} />
      </View>
    </View>
  );
}

function FeatureSheet({ data }: { data: BrochureData }) {
  const hasAgent = !!(data.agentName || data.agentPhone || data.agentEmail || data.agentHeadshotB64);
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {data.photos.length > 0 && <PhotoGrid photos={data.photos} />}
        <View style={s.body}>
          <View style={s.left}>
            {data.address && <Text style={s.address}>{data.address}</Text>}
            {data.price && <Text style={s.price}>{data.price}</Text>}
            {data.details && (
              <View style={s.detailsRow}>
                {data.details.split("·").map((d, i) => (
                  <Text key={i} style={s.detail}>{d.trim()}</Text>
                ))}
              </View>
            )}
            {data.description && (
              <View>
                <Text style={s.sectionLabel}>About This Property</Text>
                <Text style={s.description}>{data.description}</Text>
              </View>
            )}
            {data.features && data.features.length > 0 && (
              <View>
                <Text style={s.sectionLabel}>Property Features</Text>
                {data.features.map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <Text style={s.featureDot}>·</Text>
                    <Text style={s.featureItem}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {hasAgent && (
            <View style={s.right}>
              <Text style={s.sectionLabel}>Listed By</Text>
              <View style={s.agentRow}>
                {data.agentHeadshotB64 && <Image src={data.agentHeadshotB64} style={s.agentHeadshot} />}
                <View style={s.agentInfo}>
                  {data.agentName && <Text style={s.agentName}>{data.agentName}</Text>}
                  {data.brokerage && <Text style={s.agentBrokerage}>{data.brokerage}</Text>}
                  {data.agentPhone && <Text style={s.agentContact}>{data.agentPhone}</Text>}
                  {data.agentEmail && <Text style={s.agentContact}>{data.agentEmail}</Text>}
                </View>
              </View>
              {data.brokerageLogoB64 && <Image src={data.brokerageLogoB64} style={s.brokerageLogo} />}
            </View>
          )}
        </View>
        <View style={s.footer}>
          <Text style={s.footerText}>Photography by Luck Images · luckimages.com</Text>
          {data.mlsNumber && <Text style={s.mlsText}>MLS# {data.mlsNumber}</Text>}
        </View>
      </Page>
    </Document>
  );
}

export async function renderBrochurePDF(data: BrochureData): Promise<Buffer> {
  return renderToBuffer(<FeatureSheet data={data} />);
}
