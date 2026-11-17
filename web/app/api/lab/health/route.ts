import { labHeaders } from "@/lib/lab/catalogue";
export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "automation-lab",
      version: "1.0.0",
      environment: "practice",
      dataset: "catalogue-v1",
    },
    { headers: labHeaders },
  );
}
