import { frameworkZip } from "@/lib/lab/framework";
export async function GET() {
  return new Response(Buffer.from(frameworkZip, "base64"), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        "attachment; filename=automation-lab-framework.zip",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
