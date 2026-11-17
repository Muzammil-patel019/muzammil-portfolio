import { z } from "zod";
import { listProducts, labHeaders } from "@/lib/lab/catalogue";
export async function GET(request: Request) {
  try {
    return Response.json(listProducts(new URL(request.url).searchParams), {
      headers: labHeaders,
    });
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "INVALID_QUERY",
          message:
            error instanceof z.ZodError
              ? error.issues
                  .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
                  .join("; ")
              : error instanceof Error
                ? error.message
                : "Invalid query.",
        },
      },
      { status: 400, headers: labHeaders },
    );
  }
}
