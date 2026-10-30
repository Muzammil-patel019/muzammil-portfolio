import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume";
import { groupSkills } from "@/lib/resume-layout";
const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 42,
    paddingBottom: 32,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.3,
    color: "#222b38",
  },
  heading: {
    textAlign: "center",
    paddingBottom: 12,
    borderBottomWidth: 1.2,
    borderBottomColor: "#27364b",
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
    lineHeight: 1.2,
  },
  role: { fontSize: 10.5, color: "#475569", marginTop: 5 },
  contact: { fontSize: 8.2, color: "#526071", marginTop: 7, lineHeight: 1.5 },
  section: {
    fontSize: 9.2,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.1,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.6,
    borderBottomColor: "#bfc7d2",
    color: "#27364b",
  },
  skillRow: { flexDirection: "row", marginBottom: 4 },
  skillLabel: {
    width: 112,
    fontSize: 8.6,
    fontFamily: "Helvetica-Bold",
    paddingRight: 10,
  },
  skillValues: { flex: 1, fontSize: 9 },
  project: { marginBottom: 9 },
  projectHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  projectTitleBlock: { flex: 1 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 10.2 },
  client: { fontSize: 8.8, color: "#526071", marginTop: 2 },
  dates: {
    width: 137,
    textAlign: "right",
    fontSize: 8.5,
    color: "#526071",
    paddingTop: 1,
  },
  tools: { fontSize: 8.4, color: "#526071", marginTop: 5, marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 10, fontSize: 9 },
  bulletText: { flex: 1 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 42,
    right: 42,
    fontSize: 7,
    color: "#7a8490",
    textAlign: "right",
  },
});
export function ResumePDF({ resume: r }: { resume: Resume }) {
  return (
    <Document title={`${r.name} - Resume`} author={r.name}>
      <Page size="A4" style={s.page}>
        <View style={s.heading} wrap={false}>
          <Text style={s.name}>{r.name}</Text>
          <Text style={s.role}>{r.title}</Text>
          <Text style={s.contact}>
            {[r.location, r.email, r.phone].filter(Boolean).join("   |   ")}
          </Text>
        </View>
        <Text style={s.section} minPresenceAhead={35}>
          PROFESSIONAL SUMMARY
        </Text>
        <Text orphans={3} widows={3}>
          {r.summary}
        </Text>
        {r.skills.length > 0 && (
          <>
            <Text style={s.section} minPresenceAhead={35}>
              TECHNICAL SKILLS
            </Text>
            {groupSkills(r.skills).map((g) => (
              <View style={s.skillRow} key={g.label} wrap={false}>
                <Text style={s.skillLabel}>{g.label}</Text>
                <Text style={s.skillValues}>{g.skills.join(" · ")}</Text>
              </View>
            ))}
          </>
        )}
        <Text style={s.section} minPresenceAhead={85}>
          PROFESSIONAL EXPERIENCE
        </Text>
        {r.projects.map((p) => (
          <View key={p.id} style={s.project}>
            <View wrap={false} minPresenceAhead={30}>
              <View style={s.projectHead}>
                <View style={s.projectTitleBlock}>
                  <Text style={s.title}>{p.name}</Text>
                  <Text style={s.client}>Client: {p.client}</Text>
                </View>
                <Text style={s.dates}>{p.dates}</Text>
              </View>
              {p.tools.length > 0 && (
                <Text style={s.tools}>Environment: {p.tools.join(" · ")}</Text>
              )}
            </View>
            {p.bullets.map((b, i) => (
              <View key={i} style={s.bullet} wrap={false}>
                <Text style={s.bulletMark}>•</Text>
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
        {r.education && (
          <>
            <Text style={s.section} minPresenceAhead={45}>
              EDUCATION
            </Text>
            <Text>{r.education}</Text>
          </>
        )}
        <View fixed style={s.footer}>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${r.name}  |  ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
