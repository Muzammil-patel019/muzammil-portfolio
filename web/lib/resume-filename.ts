/** Generation date uses the owner's timezone on both server and browser. */
export function resumeFilename(generatedAt: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(generatedAt);
  const month = parts.find((part) => part.type === "month")!.value;
  const year = parts.find((part) => part.type === "year")!.value;
  return `Muzammil_Patel_Resume_${month}_${year}.pdf`;
}
