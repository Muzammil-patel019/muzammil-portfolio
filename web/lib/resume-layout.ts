const categories: [string, string[]][] = [
  [
    "Languages",
    [
      "c#",
      "c sharp",
      "python",
      "java",
      "javascript",
      "typescript",
      "sql",
      "html",
      "css",
    ],
  ],
  [
    "Automation",
    [
      "flaui",
      "selenium",
      "selenium webdriver",
      "testcomplete",
      "playwright",
      "cypress",
      "appium",
    ],
  ],
  [
    "Frameworks & methods",
    [
      "nunit",
      "specflow",
      "cucumber",
      "gherkin",
      "bdd",
      "bdd / gherkin",
      "testng",
      "junit",
      "pytest",
      "agile",
      "page object model",
      "pom",
    ],
  ],
  [
    "Tools & delivery",
    [
      "postman",
      "git",
      "github",
      "gitlab",
      "git bash",
      "github actions",
      "azure devops",
      "jenkins",
      "docker",
      "jira",
    ],
  ],
];
/** Preview and PDF share these groups; unfamiliar skills are always retained. */
export function groupSkills(skills: string[]) {
  const groups = categories.map(([label]) => ({
    label,
    skills: [] as string[],
  }));
  const other = { label: "Additional skills", skills: [] as string[] };
  for (const skill of skills) {
    const index = categories.findIndex(([, values]) =>
      values.includes(skill.trim().toLowerCase()),
    );
    (index === -1 ? other : groups[index]).skills.push(skill);
  }
  return [...groups, other].filter((g) => g.skills.length > 0);
}
