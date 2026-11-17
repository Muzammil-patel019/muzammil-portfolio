import { labOpenAPI } from "@/lib/lab/openapi";
import { labHeaders } from "@/lib/lab/catalogue";
export async function GET() {
  return Response.json(labOpenAPI, { headers: labHeaders });
}
