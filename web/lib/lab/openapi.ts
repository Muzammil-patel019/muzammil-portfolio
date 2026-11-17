const product = {
  type: "object",
  required: [
    "id",
    "name",
    "category",
    "description",
    "priceMinor",
    "stock",
    "rating",
    "art",
    "color",
  ],
  properties: {
    id: { type: "string", example: "p-001" },
    name: { type: "string" },
    category: { type: "string", enum: ["tech", "desk", "everyday"] },
    description: { type: "string" },
    priceMinor: {
      type: "integer",
      minimum: 0,
      description: "Price in INR paise. 100 paise = 1 rupee.",
    },
    stock: { type: "integer", minimum: 0 },
    rating: { type: "number", minimum: 0, maximum: 5 },
    art: { type: "string" },
    color: { type: "string" },
  },
};
const content = (schema: unknown) => ({ "application/json": { schema } });
const error = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
};
export const labOpenAPI = {
  openapi: "3.0.3",
  info: {
    title: "Automation Lab API",
    version: "1.0.0",
    description:
      "Stage 1: immutable fictional catalogue. No authentication or payments. Data resets are not needed on the server; UI workspace reset is local only.",
  },
  servers: [{ url: "/api/lab" }],
  paths: {
    "/health": {
      get: {
        summary: "Read service status",
        responses: {
          "200": {
            description: "Practice service is ready",
            content: content({
              type: "object",
              required: [
                "status",
                "service",
                "version",
                "environment",
                "dataset",
              ],
              properties: {
                status: { type: "string", enum: ["ok"] },
                service: { type: "string", enum: ["automation-lab"] },
                version: { type: "string" },
                environment: { type: "string", enum: ["practice"] },
                dataset: { type: "string", enum: ["catalogue-v1"] },
              },
            }),
          },
        },
      },
    },
    "/products": {
      get: {
        summary: "Search, filter and paginate sample products",
        parameters: [
          {
            name: "q",
            in: "query",
            schema: { type: "string", maxLength: 80, default: "" },
          },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
              enum: ["all", "tech", "desk", "everyday"],
              default: "all",
            },
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["featured", "price-asc", "price-desc", "name"],
              default: "featured",
            },
          },
          {
            name: "stock",
            in: "query",
            schema: {
              type: "string",
              enum: ["all", "in", "out"],
              default: "all",
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 1000, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 24, default: 6 },
          },
        ],
        responses: {
          "200": {
            description:
              "Results; an unmatched search or out-of-range page returns an empty data array",
            content: content({
              type: "object",
              required: ["data", "pagination", "query"],
              properties: {
                data: { type: "array", items: product },
                pagination: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    pageSize: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" },
                  },
                },
                query: {
                  type: "object",
                  description: "Normalized query parameters.",
                },
              },
            }),
          },
          "400": {
            description: "Invalid, repeated or unknown query parameter",
            content: content(error),
          },
        },
      },
    },
    "/products/{id}": {
      get: {
        summary: "Read one product",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "p-001",
          },
        ],
        responses: {
          "200": {
            description: "Product found",
            content: content({
              type: "object",
              required: ["data"],
              properties: { data: product },
            }),
          },
          "404": { description: "Unknown product ID", content: content(error) },
        },
      },
    },
  },
};
