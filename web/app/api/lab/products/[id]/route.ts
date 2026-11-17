import { products, labHeaders } from "@/lib/lab/catalogue";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    product = products.find((p) => p.id === id);
  return product
    ? Response.json({ data: product }, { headers: labHeaders })
    : Response.json(
        {
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "No sample product matches this ID.",
          },
        },
        { status: 404, headers: labHeaders },
      );
}
