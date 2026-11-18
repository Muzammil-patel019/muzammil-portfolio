import { createWorkspace } from "@/lib/lab/store";
import { json, errorResponse } from "@/lib/lab/http";
export async function POST() {
  try {
    return json(await createWorkspace(), 201);
  } catch (e) {
    return errorResponse(e);
  }
}
