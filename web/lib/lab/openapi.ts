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
// The baseline catalogue remains public and immutable. Practice writes use a separate disposable run.
const runSecurity = [{ LabWorkspace: [], DemoSession: [] }];
const runResponses = {
  "200": {
    description: "Operation succeeded",
    content: content({ type: "object" }),
  },
  "401": {
    description: "Missing, expired or revoked practice credentials",
    content: content(error),
  },
  "403": {
    description: "Demo role does not permit this action",
    content: content(error),
  },
  "404": {
    description: "Run or resource does not exist",
    content: content(error),
  },
  "409": {
    description: "Revision, stock, idempotency or state transition conflict",
    content: content(error),
  },
  "422": {
    description: "Validation error or simulated payment declined",
    content: content(error),
  },
  "503": {
    description: "Storage unavailable or simulated service failure",
    content: content(error),
  },
};
const scenarioParameter = {
  name: "X-Lab-Scenario",
  in: "header",
  required: false,
  schema: {
    type: "string",
    enum: ["normal", "slow", "unavailable", "expired", "declined"],
    default: "normal",
  },
};
const requestJSON = (example: unknown) => ({
  required: true,
  content: { "application/json": { schema: { type: "object" }, example } },
});
Object.assign(labOpenAPI, {
  components: {
    securitySchemes: {
      LabWorkspace: {
        type: "apiKey",
        in: "header",
        name: "X-Lab-Workspace",
        description:
          "Token owning a disposable fictional run; expires after 24 hours.",
      },
      DemoSession: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Lab demo HMAC",
        description:
          "Signed demo role token from /workspace/session. Not a Supabase owner token.",
      },
    },
  },
});
Object.assign(labOpenAPI.paths, {
  "/workspaces": {
    post: {
      summary: "Create a disposable practice run",
      responses: {
        "201": {
          description:
            "New run; returns workspaceToken, revision, expiresAt and storage mode",
        },
        "429": { description: "Workspace capacity reached" },
        "503": { description: "Practice storage not configured" },
      },
    },
  },
  "/workspace/session": {
    post: {
      summary: "Sign in to a public fictional demo account",
      description:
        "customer@lab.test, support@lab.test or admin@lab.test. Demo password: Practice123!",
      security: [{ LabWorkspace: [] }],
      parameters: [scenarioParameter],
      requestBody: requestJSON({
        email: "customer@lab.test",
        password: "Practice123!",
      }),
      responses: runResponses,
    },
    delete: {
      summary: "Revoke this demo session",
      security: runSecurity,
      responses: runResponses,
    },
  },
  "/workspace/state": {
    get: {
      summary: "Read role-scoped run data and revision",
      security: runSecurity,
      parameters: [scenarioParameter],
      responses: runResponses,
    },
  },
  "/workspace/cart": {
    get: {
      summary: "Read your role's cart",
      security: runSecurity,
      responses: runResponses,
    },
    post: {
      summary: "Set quantity; zero removes the product",
      security: runSecurity,
      requestBody: requestJSON({ productId: "p-001", quantity: 1 }),
      parameters: [scenarioParameter],
      responses: runResponses,
    },
  },
  "/workspace/orders": {
    get: {
      summary: "List visible run orders",
      security: runSecurity,
      responses: runResponses,
    },
    post: {
      summary: "Checkout with fake payment and idempotency",
      security: runSecurity,
      parameters: [
        scenarioParameter,
        {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string", minLength: 8, maxLength: 80 },
        },
      ],
      requestBody: requestJSON({ coupon: "SAVE10", payment: "approved" }),
      responses: {
        ...runResponses,
        "201": {
          description:
            "Order created; integer minor-unit totals and immutable item price snapshots",
        },
      },
    },
  },
  "/workspace/orders/{id}": {
    patch: {
      summary: "Cancel an order or refund as admin",
      security: runSecurity,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: requestJSON({ action: "cancel" }),
      responses: runResponses,
    },
  },
  "/workspace/products": {
    post: {
      summary: "Create a run product as admin",
      security: runSecurity,
      requestBody: requestJSON({
        id: "p-custom",
        name: "Test notebook",
        category: "desk",
        description: "A fictional test product",
        priceMinor: 50000,
        stock: 5,
        rating: 0,
        art: "notebook",
        color: "#d6e6e4",
      }),
      responses: {
        ...runResponses,
        "201": { description: "Run product created" },
      },
    },
  },
  "/workspace/products/{id}": {
    patch: {
      summary: "Edit stock/price/name/description as admin",
      security: runSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: requestJSON({ stock: 5, priceMinor: 349900 }),
      responses: runResponses,
    },
    delete: {
      summary: "Delete a run product not in carts or pending orders",
      security: runSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: runResponses,
    },
  },
  "/workspace/reset": {
    post: {
      summary: "Reset only this run and invalidate its demo sessions",
      security: [{ LabWorkspace: [] }],
      responses: runResponses,
    },
  },
  "/workspace/destroy": {
    delete: {
      summary: "Delete only this disposable run",
      security: [{ LabWorkspace: [] }],
      responses: runResponses,
    },
  },
  "/workspace/webhooks": {
    post: {
      summary: "Provider simulator: settle pending payment once",
      description:
        "Requires a demo admin session and this run's webhook key from admin state. No external payment provider is connected.",
      security: runSecurity,
      parameters: [
        {
          name: "X-Lab-Webhook-Key",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: requestJSON({
        eventId: "unique-event-id",
        orderId: "replace-with-order-uuid",
        status: "paid",
      }),
      responses: runResponses,
    },
  },
});

Object.assign(labOpenAPI.info, {
  version: "2.0.0",
  description:
    "Immutable baseline catalogue plus isolated disposable practice runs: demo roles, carts, fake checkout, inventory CRUD, reset and provider event simulator. No real payments or portfolio owner authentication are used.",
});
