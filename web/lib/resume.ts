import { z } from "zod";
export const resumeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  phone: z.string().max(80),
  location: z.string().max(120),
  summary: z.string().trim().min(1).max(3000),
  skills: z.array(z.string().trim().min(1).max(100)).max(80),
  projects: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(120),
        client: z.string().min(1).max(120),
        dates: z.string().min(1).max(100),
        type: z.enum(["Desktop", "Web"]),
        tools: z.array(z.string().trim().min(1).max(80)).max(30),
        bullets: z.array(z.string().trim().min(1).max(1200)).max(25),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (projects) => new Set(projects.map((p) => p.id)).size === projects.length,
      "Project IDs must be unique.",
    ),
  education: z.string().max(2000),
});
export type Resume = z.infer<typeof resumeSchema>;
export const saveSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["master", "tailored"]),
  document: resumeSchema,
  updatedAt: z.string().optional(),
});
const terms: Record<string, string[]> = {
  Java: ["java"],
  Python: ["python"],
  "C#": ["c#", "c sharp"],
  Selenium: ["selenium"],
  TestComplete: ["testcomplete", "test complete"],
  FlaUI: ["flaui"],
  NUnit: ["nunit"],
  SpecFlow: ["specflow"],
  Cucumber: ["cucumber"],
  Gherkin: ["gherkin"],
  SQL: ["sql"],
  Postman: ["postman"],
  "API testing": ["api testing", "rest api"],
  Agile: ["agile"],
  BDD: ["bdd", "behavior driven", "behaviour driven"],
  "GitHub Actions": ["github actions"],
  Playwright: ["playwright"],
  Cypress: ["cypress"],
  Jenkins: ["jenkins"],
  Docker: ["docker"],
  TypeScript: ["typescript"],
  JavaScript: ["javascript"],
  "Azure DevOps": ["azure devops"],
};
function includesTerm(text: string, term: string) {
  return new RegExp(
    `(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`,
    "i",
  ).test(text);
}
export function analyzeJD(jd: string, resume: Resume) {
  const profile = [
    resume.summary,
    ...resume.skills,
    ...resume.projects.flatMap((p) => [...p.tools, ...p.bullets]),
  ].join(" ");
  const requested = Object.entries(terms).filter(([, aliases]) =>
    aliases.some((a) => includesTerm(jd, a)),
  );
  return {
    matched: requested
      .filter(([, a]) => a.some((t) => includesTerm(profile, t)))
      .map(([name]) => name),
    missing: requested
      .filter(([, a]) => !a.some((t) => includesTerm(profile, t)))
      .map(([name]) => name),
  };
}
