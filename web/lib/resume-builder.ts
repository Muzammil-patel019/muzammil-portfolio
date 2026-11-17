import { resumeSchema, resumeSections, type Resume } from "./resume";
export const sectionLabels = {
  summary: "Professional summary",
  skills: "Technical skills",
  projects: "Professional experience",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};
export const orderedSections = (r: Resume) =>
  r.sectionOrder || [...resumeSections];
export const textLines = (text = "") =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
export function normalizeResume(r: Resume): Resume {
  return {
    ...r,
    skills: r.skills.map((s) => s.trim()).filter(Boolean),
    projects: r.projects.map((p) => ({
      ...p,
      tools: p.tools.map((s) => s.trim()).filter(Boolean),
      bullets: p.bullets.map((s) => s.trim()).filter(Boolean),
    })),
  };
}
export function profileLinks(r: Resume) {
  return [
    { label: "LinkedIn", url: r.linkedin || "" },
    { label: "Website", url: r.website || "" },
  ].filter((l) => {
    try {
      return ["https:", "http:"].includes(new URL(l.url).protocol);
    } catch {
      return false;
    }
  });
}
export function moveSection(
  r: Resume,
  key: (typeof resumeSections)[number],
  offset: -1 | 1,
): Resume {
  const order = [...orderedSections(r)],
    i = order.indexOf(key),
    to = i + offset;
  if (i < 0 || to < 0 || to >= order.length) return r;
  [order[i], order[to]] = [order[to], order[i]];
  return { ...r, sectionOrder: order };
}
export function resumeChecks(r: Resume) {
  const clean = normalizeResume(r),
    bullets = clean.projects.flatMap((p) => p.bullets);
  return [
    {
      id: "contact",
      label: "Name, role and a valid email",
      ok:
        !!r.name.trim() &&
        !!r.title.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email),
      hint: "Use the email you want recruiters to contact.",
    },
    {
      id: "summary",
      label: "A focused profile summary",
      ok: r.summary.trim().length > 30,
      hint: "Explain your role and strongest relevant experience in a few sentences.",
    },
    {
      id: "skills",
      label: "Relevant skills listed",
      ok: clean.skills.length >= 5,
      hint: "List skills you can explain in an interview; five is a guide, not a requirement.",
    },
    {
      id: "evidence",
      label: "Contributions described",
      ok: bullets.length >= 3,
      hint: "Describe your actions and outcomes in project bullets.",
    },
    {
      id: "numbers",
      label: "Evidence of impact",
      ok: bullets.some((b) => /\d/.test(b)),
      hint: "Add real counts or outcomes when you know them. Never invent a number.",
    },
    {
      id: "education",
      label: "Education included",
      ok: !!r.education.trim(),
      hint: "Add your qualification, institution and completion year.",
    },
    {
      id: "valid",
      label: "Ready to save and export",
      ok: resumeSchema.safeParse(clean).success,
      hint: "Complete required fields and correct invalid links before exporting.",
    },
  ];
}
