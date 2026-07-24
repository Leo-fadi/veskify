import { z } from "zod";

import {
  productDisplayModelSchema,
  collectionDisplayModelSchema,
  type CatalogueDisplayModel,
} from "@/domain/catalogue";
import {
  canonicalLocaleOrder,
  idSchema,
  localeSchema,
  localizedTextSchema,
  type Locale,
} from "@/domain/shared";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/);
const routePathSchema = z
  .string()
  .trim()
  .max(220)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/);

const routeTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home") }).strict(),
  z.object({ kind: z.literal("product"), productId: idSchema }).strict(),
  z.object({ kind: z.literal("collection"), collectionId: idSchema }).strict(),
  z.object({ kind: z.literal("category"), categoryId: idSchema }).strict(),
]);

const routeReferenceSchema = z
  .object({
    id: idSchema,
    path: routePathSchema,
    target: routeTargetSchema,
    supportedLocales: z.array(localeSchema).min(1).max(2),
  })
  .strict();

const navigationNodeSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    routeReferenceId: idSchema,
    parentNavigationNodeId: z.union([idSchema, z.null()]).optional(),
    supportedLocales: z.array(localeSchema).min(1).max(2),
  })
  .strict()
  .superRefine((node, context) => {
    if (node.parentNavigationNodeId === node.id) {
      context.addIssue({
        code: "custom",
        path: ["parentNavigationNodeId"],
        message: "Navigation nodes cannot reference themselves.",
      });
    }
  });

const categoryNodeSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    title: localizedTextSchema,
    parentCategoryId: z.union([idSchema, z.null()]).optional(),
    routeReferenceId: idSchema.optional(),
    supportedLocales: z.array(localeSchema).min(1).max(2),
  })
  .strict()
  .superRefine((category, context) => {
    if (category.parentCategoryId === category.id) {
      context.addIssue({
        code: "custom",
        path: ["parentCategoryId"],
        message: "Category nodes cannot reference themselves.",
      });
    }
  });

const inputProductSchema = productDisplayModelSchema
  .safeExtend({
    slug: slugSchema,
    routeReferenceId: idSchema.optional(),
    routeReferenceIds: z.array(idSchema).default([]),
    categoryIds: z.array(idSchema).default([]),
  })
  .strict();

const inputCollectionSchema = collectionDisplayModelSchema
  .safeExtend({
    slug: slugSchema,
    routeReferenceId: idSchema.optional(),
    routeReferenceIds: z.array(idSchema).default([]),
  })
  .strict();

export const storefrontCatalogueProjectionSchema = z
  .object({
    id: idSchema,
    revision: z.number().int().nonnegative(),
    merchant: z
      .object({
        id: idSchema,
        name: z.string().trim().min(1).max(120),
      })
      .strict(),
    project: z
      .object({
        id: idSchema,
        merchantId: idSchema,
        revision: z.number().int().nonnegative(),
      })
      .strict(),
    supportedLocales: z.array(localeSchema).min(1).max(2),
    catalogueSafeTitle: localizedTextSchema,
    products: z.array(inputProductSchema),
    collections: z.array(inputCollectionSchema),
    categories: z.array(categoryNodeSchema).default([]),
    routeReferences: z.array(routeReferenceSchema).default([]),
    navigation: z.array(navigationNodeSchema).default([]),
  })
  .strict()
  .superRefine((projection, context) => {
    const productIds = projection.products.map((product) => product.id);
    const collectionIds = projection.collections.map((collection) => collection.id);
    const categoryIds = projection.categories.map((category) => category.id);
    const routeIds = projection.routeReferences.map((route) => route.id);
    const navigationIds = projection.navigation.map((node) => node.id);

    function assertUnique(values: readonly string[], path: string[]) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path, message: "Identifiers must be unique." });
      }
    }

    assertUnique(productIds, ["products"]);
    assertUnique(collectionIds, ["collections"]);
    assertUnique(categoryIds, ["categories"]);
    assertUnique(routeIds, ["routeReferences"]);
    assertUnique(navigationIds, ["navigation"]);

    const knownProducts = new Set(productIds);
    const knownCollections = new Set(collectionIds);
    const knownCategories = new Set(categoryIds);
    const knownRoutes = new Set(routeIds);

    for (const category of projection.categories) {
      const parent = category.parentCategoryId;
      if (parent !== null && parent !== undefined && !knownCategories.has(parent)) {
        context.addIssue({
          code: "custom",
          path: ["categories", category.id, "parentCategoryId"],
          message: "Category hierarchy must reference existing categories.",
        });
      }
    }

    for (const collection of projection.collections) {
      for (const productId of collection.productIds) {
        if (!knownProducts.has(productId)) {
          context.addIssue({
            code: "custom",
            path: ["collections", collection.id, "productIds"],
            message: "Collection product references must be known products.",
          });
        }
      }
      if (
        collection.routeReferenceId !== undefined &&
        !knownRoutes.has(collection.routeReferenceId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["collections", collection.id, "routeReferenceId"],
          message: "Collection routes must resolve to known route references.",
        });
      }
      for (const routeId of collection.routeReferenceIds) {
        if (!knownRoutes.has(routeId)) {
          context.addIssue({
            code: "custom",
            path: ["collections", collection.id, "routeReferenceIds"],
            message: "Collection routes must resolve to known route references.",
          });
        }
      }
    }

    for (const product of projection.products) {
      for (const categoryId of product.categoryIds) {
        if (!knownCategories.has(categoryId)) {
          context.addIssue({
            code: "custom",
            path: ["products", product.id, "categoryIds"],
            message: "Product categories must resolve to known categories.",
          });
        }
      }
      if (product.routeReferenceId !== undefined && !knownRoutes.has(product.routeReferenceId)) {
        context.addIssue({
          code: "custom",
          path: ["products", product.id, "routeReferenceId"],
          message: "Product routes must resolve to known route references.",
        });
      }
      for (const routeId of product.routeReferenceIds) {
        if (!knownRoutes.has(routeId)) {
          context.addIssue({
            code: "custom",
            path: ["products", product.id, "routeReferenceIds"],
            message: "Product routes must resolve to known route references.",
          });
        }
      }
    }

    for (const route of projection.routeReferences) {
      const routeLocales = route.supportedLocales;
      if (!routeLocales.every((locale) => projection.supportedLocales.includes(locale))) {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "supportedLocales"],
          message: "Route locales must be subset of catalogue locales.",
        });
      }
      if (route.target.kind === "product" && !knownProducts.has(route.target.productId)) {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "target", "productId"],
          message: "Route products must be known products.",
        });
      }
      if (route.target.kind === "collection" && !knownCollections.has(route.target.collectionId)) {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "target", "collectionId"],
          message: "Route collections must be known collections.",
        });
      }
      if (route.target.kind === "category" && !knownCategories.has(route.target.categoryId)) {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "target", "categoryId"],
          message: "Route categories must be known categories.",
        });
      }
      if (route.target.kind === "home" && route.path !== "/") {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "path"],
          message: "The home route must be '/'.",
        });
      }
    }

    for (const node of projection.navigation) {
      if (!node.supportedLocales.every((locale) => projection.supportedLocales.includes(locale))) {
        context.addIssue({
          code: "custom",
          path: ["navigation", node.id, "supportedLocales"],
          message: "Navigation locales must be subset of catalogue locales.",
        });
      }
      if (!knownRoutes.has(node.routeReferenceId)) {
        context.addIssue({
          code: "custom",
          path: ["navigation", node.id, "routeReferenceId"],
          message: "Navigation routes must resolve to known route references.",
        });
      }
      if (
        node.parentNavigationNodeId !== undefined &&
        node.parentNavigationNodeId !== null &&
        !knownIds(projection.navigation).has(node.parentNavigationNodeId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["navigation", node.id, "parentNavigationNodeId"],
          message: "Navigation hierarchy must reference an existing node.",
        });
      }
    }

    if (hasCycle(projection.categories.map((item) => [item.id, item.parentCategoryId ?? null]))) {
      context.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Category hierarchy contains a cycle.",
      });
    }
    if (
      hasCycle(projection.navigation.map((item) => [item.id, item.parentNavigationNodeId ?? null]))
    ) {
      context.addIssue({
        code: "custom",
        path: ["navigation"],
        message: "Navigation hierarchy contains a cycle.",
      });
    }
  });

function knownIds<T extends { id: string }>(values: readonly T[]): Set<string> {
  return new Set(values.map((item) => item.id));
}

function fallbackSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "item"
  );
}

function omitFields<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

function hasCycle(pairs: Array<[string, string | null]>): boolean {
  const parentById = new Map(pairs);
  const state = new Map<string, "visiting" | "visited">();

  const visit = (id: string): boolean => {
    const status = state.get(id);
    if (status === "visiting") return true;
    if (status === "visited") return false;

    state.set(id, "visiting");
    const parent = parentById.get(id) ?? null;
    if (parent !== null && parentById.has(parent) && visit(parent)) {
      return true;
    }
    state.set(id, "visited");
    return false;
  };

  return [...parentById.keys()].some((id) => visit(id));
}

export type StorefrontCatalogueProjection = z.infer<typeof storefrontCatalogueProjectionSchema>;

export interface StableProjectionProvider {
  load(): Promise<StorefrontCatalogueProjection>;
}

export interface CanonicalCatalogueProjectionTransport {
  load(): unknown;
}

export type CatalogueProjectionAdapterInput = Readonly<{
  transport: CanonicalCatalogueProjectionTransport;
}>;

export function createCatalogueProjectionProvider(
  input: CatalogueProjectionAdapterInput,
): StableProjectionProvider {
  let currentRevision = -1;

  return {
    async load() {
      const parsed = storefrontCatalogueProjectionSchema.parse(await input.transport.load());
      if (parsed.revision < currentRevision) {
        throw new Error("Stale canonical projection revision.");
      }

      currentRevision = parsed.revision;
      return normalizeProjection(parsed);
    },
  };
}

export function createStandaloneCatalogueProjectionAdapter(
  catalogue: CatalogueDisplayModel,
): StableProjectionProvider {
  const standAloneMerchantId = `merchant_${catalogue.id}`;
  const fallback: StorefrontCatalogueProjection = {
    id: catalogue.id,
    revision: 0,
    merchant: { id: standAloneMerchantId, name: "Standalone" },
    project: { id: `project_${catalogue.id}`, merchantId: standAloneMerchantId, revision: 0 },
    supportedLocales: ["en", "fi"],
    catalogueSafeTitle: { en: "Standalone catalogue", fi: "Paikallinen luettelo" },
    products: catalogue.products.map((product) => ({
      ...product,
      slug: fallbackSlug(product.id),
      routeReferenceId: undefined,
      routeReferenceIds: [],
      categoryIds: [],
    })),
    collections: catalogue.collections.map((collection) => ({
      ...collection,
      slug: fallbackSlug(collection.id),
      routeReferenceId: undefined,
      routeReferenceIds: [],
    })),
    categories: [],
    routeReferences: [],
    navigation: [],
  };

  const parsed = storefrontCatalogueProjectionSchema.parse(fallback);
  return {
    load() {
      return Promise.resolve(normalizeProjection(structuredClone(parsed)));
    },
  };
}

function sortedById<Value extends { id: string }>(values: readonly Value[]): Value[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeReferenceIds(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeProjectionLocales(values: readonly Locale[]): Locale[] {
  return canonicalLocaleOrder(Array.from(new Set(values)));
}

function normalizeProjection(input: StorefrontCatalogueProjection): StorefrontCatalogueProjection {
  const supportedLocales = normalizeProjectionLocales(input.supportedLocales);
  return {
    ...input,
    supportedLocales,
    products: sortedById(input.products).map((product) => ({
      ...product,
      routeReferenceIds: normalizeReferenceIds(product.routeReferenceIds),
      categoryIds: normalizeReferenceIds(product.categoryIds),
      images: [...product.images],
    })),
    collections: sortedById(input.collections).map((collection) => ({
      ...collection,
      routeReferenceIds: normalizeReferenceIds(collection.routeReferenceIds),
      productIds: normalizeReferenceIds(collection.productIds),
    })),
    categories: sortedById(input.categories).map((category) => ({
      ...category,
      parentCategoryId: category.parentCategoryId ?? null,
      supportedLocales: normalizeProjectionLocales(category.supportedLocales),
    })),
    routeReferences: sortedById(input.routeReferences).map((route) => ({
      ...route,
      supportedLocales: normalizeProjectionLocales(route.supportedLocales),
    })),
    navigation: sortedById(input.navigation).map((node) => ({
      ...node,
      parentNavigationNodeId: node.parentNavigationNodeId ?? null,
      supportedLocales: normalizeProjectionLocales(node.supportedLocales),
    })),
  };
}

export function projectToCanonicalCommerceProjection(
  projection: StorefrontCatalogueProjection,
): CatalogueDisplayModel {
  return {
    id: projection.id,
    products: projection.products.map((product) => {
      return omitFields(product, ["routeReferenceId", "routeReferenceIds", "categoryIds"] as const);
    }),
    collections: projection.collections.map((collection) => {
      return omitFields(collection, ["routeReferenceId", "routeReferenceIds"] as const);
    }),
  };
}
