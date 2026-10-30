import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume";
import { groupSkills } from "@/lib/resume-layout";
function makeStyles(compact: boolean) {
  return StyleSheet.create({
    page: {
      paddingTop: compact ? 36 : 42,
      paddingHorizontal: 42,
      paddingBottom: 42,
      fontFamily: "Helvetica",
      fontSize: compact ? 9 : 10.2,
      lineHeight: compact ? 1.3 : 1.48,
      color: "#222b38",
    },
    heading: {
      textAlign: "center",
      paddingBottom: compact ? 12 : 17,
      borderBottomWidth: 1.2,
      borderBottomColor: "#27364b",
      marginBottom: 4,
    },
    name: {
      fontSize: compact ? 22 : 25,
      fontFamily: "Helvetica-Bold",
      letterSpacing: 0.3,
      lineHeight: 1.2,
    },
    role: { fontSize: compact ? 10.5 : 12, color: "#475569", marginTop: 5 },
    contact: {
      fontSize: compact ? 8.2 : 9.3,
      color: "#526071",
      marginTop: 7,
      lineHeight: 1.5,
    },
    section: {
      fontSize: compact ? 9.2 : 10.3,
      fontFamily: "Helvetica-Bold",
      letterSpacing: 1.1,
      marginTop: compact ? 12 : 18,
      marginBottom: compact ? 6 : 9,
      paddingBottom: 3,
      borderBottomWidth: 0.6,
      borderBottomColor: "#bfc7d2",
      color: "#27364b",
    },
    skillRow: { flexDirection: "row", marginBottom: 4 },
    skillLabel: {
      width: compact ? 112 : 135,
      fontSize: compact ? 8.6 : 9.4,
      fontFamily: "Helvetica-Bold",
      paddingRight: 10,
    },
    skillValues: { flex: 1, fontSize: compact ? 9 : 10 },
    project: { marginBottom: compact ? 9 : 17 },
    projectHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    projectTitleBlock: { flex: 1 },
    title: { fontFamily: "Helvetica-Bold", fontSize: compact ? 10.2 : 12 },
    client: { fontSize: compact ? 8.8 : 10, color: "#526071", marginTop: 2 },
    dates: {
      width: 137,
      textAlign: "right",
      fontSize: compact ? 8.5 : 9.5,
      color: "#526071",
      paddingTop: 1,
    },
    tools: {
      fontSize: compact ? 8.4 : 9.4,
      color: "#526071",
      marginTop: 5,
      marginBottom: compact ? 6 : 9,
    },
    bullet: { flexDirection: "row", marginBottom: compact ? 3 : 6 },
    bulletMark: { width: 10, fontSize: compact ? 9 : 10 },
    bulletText: { flex: 1 },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 42,
      width: 511,
      fontSize: 7,
      color: "#7a8490",
      textAlign: "right",
    },
  });
}
// Keep normal-length projects together; very long edited projects may flow.
function shouldWrapProject(
  project: Resume["projects"][number],
  compact: boolean,
) {
  const charsPerLine = compact ? 105 : 85;
  const lineHeight = compact ? 12 : 15;
  const estimatedHeight =
    90 +
    Math.ceil(project.tools.join(" · ").length / charsPerLine) * lineHeight +
    project.bullets.reduce(
      (height, text) =>
        height +
        Math.max(1, Math.ceil(text.length / charsPerLine)) * lineHeight +
        6,
      0,
    );
  return estimatedHeight > 640;
}
export function ResumePDF({ resume: r }: { resume: Resume }) {
  const s = makeStyles(r.layout === "compact");
  const bullet = (text: string, key: number) => (
    <View key={key} style={s.bullet} wrap={false}>
      <Text style={s.bulletMark}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
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
          <View
            key={p.id}
            style={s.project}
            wrap={shouldWrapProject(p, r.layout === "compact")}
          >
            <View wrap={false}>
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
              {p.bullets[0] && bullet(p.bullets[0], 0)}
            </View>
            {p.bullets.slice(1).map((b, i) => bullet(b, i + 1))}
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
