import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume";
const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#282432",
  },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", color: "#5540c6" },
  section: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 7,
    color: "#5540c6",
  },
  project: { marginBottom: 12 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  muted: { fontSize: 9, color: "#666" },
  bullet: { marginBottom: 5, paddingLeft: 8 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#777",
  },
});
export function ResumePDF({ resume: r }: { resume: Resume }) {
  return (
    <Document title={`${r.name} - Resume`} author={r.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{r.name}</Text>
        <Text>{r.title}</Text>
        <Text style={s.muted}>
          {r.location} | {r.email} | {r.phone}
        </Text>
        <Text style={s.section}>PROFILE</Text>
        <Text>{r.summary}</Text>
        <Text style={s.section}>SKILLS</Text>
        <Text>{r.skills.join(" / ")}</Text>
        <Text style={s.section}>PROJECT EXPERIENCE</Text>
        {r.projects.map((p) => (
          <View key={p.id} style={s.project}>
            <View wrap={false}>
              <Text style={s.title}>
                {p.name} | {p.client}
              </Text>
              <Text style={s.muted}>
                {p.dates} | {r.location}
              </Text>
              <Text style={s.muted}>{p.tools.join(" / ")}</Text>
            </View>
            {p.bullets.map((b, i) => (
              <Text key={i} style={s.bullet}>
                • {b}
              </Text>
            ))}
          </View>
        ))}
        <Text style={s.section}>EDUCATION</Text>
        <Text>{r.education}</Text>
        <Text
          fixed
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${r.name} | ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
