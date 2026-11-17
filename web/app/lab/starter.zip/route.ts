import { starterZip } from "@/lib/lab/starter";
export async function GET() {
  return new Response(Buffer.from(starterZip, "base64"), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=automation-lab-starter.zip",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
