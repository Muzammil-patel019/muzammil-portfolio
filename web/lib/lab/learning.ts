export const milestones = [
  {
    number: 1,
    title: "Meet the application",
    description:
      "Explore a storefront, trace real requests and learn the API contract.",
    topics: "HTTP · JSON · locators",
    available: true,
  },
  {
    number: 2,
    title: "Write your first tests",
    description:
      "Start with small pytest API tests and a Playwright browser check.",
    topics: "Arrange · Act · Assert",
    available: false,
  },
  {
    number: 3,
    title: "Build your framework",
    description:
      "Extract fixtures, an API client and page objects from real repetition.",
    topics: "Configuration · fixtures · page objects",
    available: false,
  },
  {
    number: 4,
    title: "Accounts & permissions",
    description:
      "Add customers and admins, then test sessions and access rules.",
    topics: "Authentication · authorization",
    available: false,
  },
  {
    number: 5,
    title: "Complete a purchase",
    description: "Introduce carts, coupons and a checkout with fake payments.",
    topics: "Business rules · boundary cases",
    available: false,
  },
  {
    number: 6,
    title: "Own your test data",
    description:
      "Build isolated accounts, seed/reset endpoints and database checks.",
    topics: "Setup · teardown · isolation",
    available: false,
  },
  {
    number: 7,
    title: "Make failures useful",
    description:
      "Enable controlled delays, rejected payments and expired sessions.",
    topics: "Timeouts · traces · debugging",
    available: false,
  },
  {
    number: 8,
    title: "Run in CI",
    description: "Add GitHub Actions, reports and failure artifacts.",
    topics: "Pipelines · screenshots · reports",
    available: false,
  },
  {
    number: 9,
    title: "Go beyond happy paths",
    description: "Test webhooks, accessibility and small local load scenarios.",
    topics: "Events · accessibility · performance",
    available: false,
  },
  {
    number: 10,
    title: "Ship with confidence",
    description: "Use preview deployments, smoke tests and release checks.",
    topics: "Environments · release verification",
    available: false,
  },
];
export const exercises = [
  {
    id: "health",
    title: "Check the service heartbeat",
    kind: "API",
    task: "Call GET /api/lab/health. Find the status, environment and dataset fields.",
    expected:
      "HTTP 200; status is ok, environment is practice, dataset is catalogue-v1.",
    hint: "Try the Health endpoint in API Explorer. A successful request and an application-level status are separate assertions.",
  },
  {
    id: "catalogue",
    title: "Read a paginated collection",
    kind: "API",
    task: "Call GET /api/lab/products without parameters. Compare data.length with pagination.total.",
    expected: "6 products on page 1, pageSize 6, total 12, totalPages 2.",
    hint: "The total counts matching products before pagination. It is not the length of the current page.",
  },
  {
    id: "search",
    title: "Find one product",
    kind: "UI",
    task: "Search for Orbit in the storefront, then try a name that does not exist.",
    expected:
      "Orbit returns one result. A nonsense query shows an empty state, without an error.",
    hint: "Use the Search products label to locate the field and submit the search form.",
  },
  {
    id: "category",
    title: "Check category boundaries",
    kind: "UI + API",
    task: "Select Desk and compare with GET /api/lab/products?category=desk.",
    expected: "4 products, all with category desk.",
    hint: "Assert every returned category, not just the number of cards.",
  },
  {
    id: "sort",
    title: "Prove that sorting works",
    kind: "API",
    task: "Request sort=price-asc&pageSize=24 and compare adjacent priceMinor values.",
    expected:
      "Every price is less than or equal to the next one. Prices are integer paise, not rupees.",
    hint: "Check the entire sequence. The cheapest product is Everyday cup at 39900 paise.",
  },
  {
    id: "stock",
    title: "Find unavailable inventory",
    kind: "UI + API",
    task: "Select Out of stock, then request stock=out in the API.",
    expected: "Pebble speaker and Cable organiser; both have stock 0.",
    hint: "A product with stock 3 is low stock, not out of stock.",
  },
  {
    id: "detail",
    title: "Follow a product ID",
    kind: "API",
    task: "Open a product detail and request GET /api/lab/products/p-001.",
    expected:
      "A data object with id p-001, name Orbit headphones and priceMinor 349900.",
    hint: "The list returns an array; the detail returns a single object.",
  },
  {
    id: "missing",
    title: "Handle a missing resource",
    kind: "API",
    task: "Request GET /api/lab/products/not-a-product.",
    expected: "HTTP 404 with error.code PRODUCT_NOT_FOUND.",
    hint: "Do not stop at checking a status code. Check the error body too.",
  },
  {
    id: "invalid",
    title: "Reject invalid input",
    kind: "API",
    task: "Request page=0, pageSize=25 and category=unknown separately.",
    expected: "Each request returns HTTP 400 and error.code INVALID_QUERY.",
    hint: "Test one invalid parameter at a time so the reason for a failure stays clear.",
  },
  {
    id: "reset",
    title: "Keep your workspace repeatable",
    kind: "UI",
    task: "Change the storefront filters, mark an exercise complete, then use Reset workspace.",
    expected:
      "Filters return to defaults and locally marked progress is cleared. The catalogue still has 12 products.",
    hint: "This first stage has immutable server data. Reset clears your browser workspace; database resets arrive in Stage 6.",
  },
];
