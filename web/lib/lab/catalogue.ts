import { z } from "zod";
export const categories = ["tech", "desk", "everyday"] as const;
export type Product = {
  id: string;
  name: string;
  category: (typeof categories)[number];
  description: string;
  priceMinor: number;
  stock: number;
  rating: number;
  art:
    | "headphones"
    | "keyboard"
    | "speaker"
    | "lamp"
    | "notebook"
    | "stand"
    | "bag"
    | "bottle"
    | "pouch"
    | "mouse"
    | "timer"
    | "cup";
  color: string;
};
export const products: Product[] = [
  {
    id: "p-001",
    name: "Orbit headphones",
    category: "tech",
    description:
      "Over-ear wireless headphones with a soft fit and a 30-hour battery. A fictional product for testing.",
    priceMinor: 349900,
    stock: 12,
    rating: 4.8,
    art: "headphones",
    color: "#d9d4f0",
  },
  {
    id: "p-002",
    name: "Studio keyboard",
    category: "tech",
    description:
      "A compact mechanical keyboard with quiet switches and a USB-C connection.",
    priceMinor: 429900,
    stock: 7,
    rating: 4.7,
    art: "keyboard",
    color: "#dce9da",
  },
  {
    id: "p-003",
    name: "Pebble speaker",
    category: "tech",
    description:
      "A small portable speaker for your desk. Bluetooth connection and a fabric finish.",
    priceMinor: 199900,
    stock: 0,
    rating: 4.5,
    art: "speaker",
    color: "#f2d8c6",
  },
  {
    id: "p-004",
    name: "Arc desk lamp",
    category: "desk",
    description:
      "An adjustable desk lamp with three light temperatures and a weighted base.",
    priceMinor: 249900,
    stock: 5,
    rating: 4.6,
    art: "lamp",
    color: "#e7e3d4",
  },
  {
    id: "p-005",
    name: "Field notebook",
    category: "desk",
    description:
      "A dotted notebook with 160 pages, a cloth cover and a flat binding.",
    priceMinor: 49900,
    stock: 24,
    rating: 4.9,
    art: "notebook",
    color: "#cddfe9",
  },
  {
    id: "p-006",
    name: "Rise laptop stand",
    category: "desk",
    description:
      "A folding aluminium stand with six height settings for a clearer workspace.",
    priceMinor: 129900,
    stock: 8,
    rating: 4.4,
    art: "stand",
    color: "#ead8d7",
  },
  {
    id: "p-007",
    name: "Daypack",
    category: "everyday",
    description:
      "A 16-litre everyday backpack with a padded laptop pocket and two side pockets.",
    priceMinor: 279900,
    stock: 4,
    rating: 4.7,
    art: "bag",
    color: "#d9e3d3",
  },
  {
    id: "p-008",
    name: "Trail water bottle",
    category: "everyday",
    description:
      "A 750 ml steel bottle with a leak-resistant lid and a powder-coated finish.",
    priceMinor: 89900,
    stock: 18,
    rating: 4.6,
    art: "bottle",
    color: "#efd8c3",
  },
  {
    id: "p-009",
    name: "Cable organiser",
    category: "everyday",
    description:
      "A zip pouch with elastic loops to keep your cables and adapters together.",
    priceMinor: 59900,
    stock: 0,
    rating: 4.3,
    art: "pouch",
    color: "#dcd9e8",
  },
  {
    id: "p-010",
    name: "Glide mouse",
    category: "tech",
    description:
      "A lightweight wireless mouse with adjustable sensitivity and a rechargeable battery.",
    priceMinor: 149900,
    stock: 10,
    rating: 4.5,
    art: "mouse",
    color: "#d6e6e4",
  },
  {
    id: "p-011",
    name: "Focus timer",
    category: "desk",
    description:
      "An analogue timer for focused work sessions. Turn the dial to set up to 60 minutes.",
    priceMinor: 79900,
    stock: 3,
    rating: 4.2,
    art: "timer",
    color: "#f1e4c6",
  },
  {
    id: "p-012",
    name: "Everyday cup",
    category: "everyday",
    description:
      "A 350 ml ceramic cup with a generous handle and a matte glaze.",
    priceMinor: 39900,
    stock: 16,
    rating: 4.8,
    art: "cup",
    color: "#e9d9cf",
  },
];
const positiveInt = (max: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(max));
export const catalogueQuery = z
  .object({
    q: z.string().trim().max(80).default(""),
    category: z.enum(["all", ...categories]).default("all"),
    sort: z
      .enum(["featured", "price-asc", "price-desc", "name"])
      .default("featured"),
    stock: z.enum(["all", "in", "out"]).default("all"),
    page: positiveInt(1000).default(1),
    pageSize: positiveInt(24).default(6),
  })
  .strict();
export function listProducts(params: URLSearchParams) {
  const repeated = [...params.keys()].find(
    (key) => params.getAll(key).length > 1,
  );
  if (repeated) throw new Error("Duplicate query parameter: " + repeated);
  const query = catalogueQuery.parse(Object.fromEntries(params));
  let items = products.filter(
    (p) =>
      (query.category === "all" || p.category === query.category) &&
      (query.stock === "all" ||
        (query.stock === "in" ? p.stock > 0 : p.stock === 0)) &&
      `${p.name} ${p.description}`
        .toLowerCase()
        .includes(query.q.toLowerCase()),
  );
  if (query.sort !== "featured")
    items = [...items].sort((a, b) =>
      query.sort === "name"
        ? a.name.localeCompare(b.name)
        : query.sort === "price-asc"
          ? a.priceMinor - b.priceMinor
          : b.priceMinor - a.priceMinor,
    );
  return {
    data: items.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    ),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / query.pageSize),
    },
    query,
  };
}
export const labMoney = (minor: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
export const labHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Lab-Environment": "practice",
};
