import { createHash } from "node:crypto";
import { z } from "zod";

import {
  collectionDisplayModelSchema,
  catalogueDisplayModelSchema,
  productDisplayModelSchema,
  type CatalogueDisplayModel,
} from "@/domain/catalogue";
import {
  canonicalLocaleOrder,
  idSchema,
  localeSchema,
  localizedTextSchema,
  type Locale,
} from "@/domain/shared";

const routePathSchema = z
  .string()
  .trim()
  .max(220)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?\/?$/);

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
    slug: collectionDisplayModelSchema.shape.slug,
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
    slug: z.string().trim().min(1).max(120),
    routeReferenceId: idSchema.optional(),
    routeReferenceIds: z.array(idSchema).default([]),
    categoryIds: z.array(idSchema).default([]),
  })
  .strict();

const inputCollectionSchema = collectionDisplayModelSchema
  .safeExtend({
    routeReferenceId: idSchema.optional(),
    routeReferenceIds: z.array(idSchema).default([]),
  })
  .strict();

function assertUnique(values: readonly string[], context: z.RefinementCtx, path: string[]) {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", path, message: "Identifiers must be unique." });
  }
}

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

    assertUnique(productIds, context, ["products"]);
    assertUnique(collectionIds, context, ["collections"]);
    assertUnique(categoryIds, context, ["categories"]);
    assertUnique(routeIds, context, ["routeReferences"]);
    assertUnique(navigationIds, context, ["navigation"]);

    const knownProducts = new Set(productIds);
    const knownCollections = new Set(collectionIds);
    const knownCategories = new Set(categoryIds);
    const knownRoutes = new Set(routeIds);

    const routeById = new Map(
      projection.routeReferences.map((route) => [route.id, route] as const),
    );
    const routeOwnerByPathLocale = new Map<string, string>();

    for (const route of projection.routeReferences) {
      if (!route.supportedLocales.every((locale) => projection.supportedLocales.includes(locale))) {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "supportedLocales"],
          message: "Route locales must be subset of catalogue locales.",
        });
      }

      const normalizedPath = normalizeRoutePath(route.path);
      for (const locale of route.supportedLocales) {
        const key = `${normalizedPath}|${locale}`;
        const owner = routeOwnerByPathLocale.get(key);
        if (owner !== undefined && owner !== route.id) {
          context.addIssue({
            code: "custom",
            path: ["routeReferences", route.id, "path"],
            message: "Route path and locale ownership must be unique.",
          });
          continue;
        }
        routeOwnerByPathLocale.set(key, route.id);
      }

      if (route.target.kind === "product") {
        if (!knownProducts.has(route.target.productId)) {
          context.addIssue({
            code: "custom",
            path: ["routeReferences", route.id, "target", "productId"],
            message: "Route products must be known products.",
          });
        }
      } else if (route.target.kind === "collection") {
        if (!knownCollections.has(route.target.collectionId)) {
          context.addIssue({
            code: "custom",
            path: ["routeReferences", route.id, "target", "collectionId"],
            message: "Route collections must be known collections.",
          });
        }
      } else if (route.target.kind === "category") {
        if (!knownCategories.has(route.target.categoryId)) {
          context.addIssue({
            code: "custom",
            path: ["routeReferences", route.id, "target", "categoryId"],
            message: "Route categories must be known categories.",
          });
        }
      } else if (route.target.kind === "home" && route.path !== "/") {
        context.addIssue({
          code: "custom",
          path: ["routeReferences", route.id, "path"],
          message: "The home route must be '/'.",
        });
      }

      if (route.target.kind !== "home") {
        for (const locale of route.supportedLocales) {
          if (!projection.supportedLocales.includes(locale)) {
            context.addIssue({
              code: "custom",
              path: ["routeReferences", route.id, "supportedLocales"],
              message: "Route locales must be subset of catalogue locales.",
            });
          }
        }
      }
    }

    const entityPrimaryRoutes: Array<{
      kind: "product" | "collection" | "category";
      entityId: string;
      referenceId: string;
      locales?: readonly Locale[] | undefined;
      path: string[];
    }> = [
      ...projection.products.flatMap((product) =>
        product.routeReferenceId
          ? [
              {
                kind: "product" as const,
                entityId: product.id,
                referenceId: product.routeReferenceId,
                path: ["products", product.id, "routeReferenceId"],
              },
            ]
          : [],
      ),
      ...projection.collections.flatMap((collection) =>
        collection.routeReferenceId
          ? [
              {
                kind: "collection" as const,
                entityId: collection.id,
                referenceId: collection.routeReferenceId,
                path: ["collections", collection.id, "routeReferenceId"],
              },
            ]
          : [],
      ),
      ...projection.categories.flatMap((category) =>
        category.routeReferenceId
          ? [
              {
                kind: "category" as const,
                entityId: category.id,
                referenceId: category.routeReferenceId,
                locales: category.supportedLocales,
                path: ["categories", category.id, "routeReferenceId"],
              },
            ]
          : [],
      ),
    ];

    for (const item of entityPrimaryRoutes) {
      const route = routeById.get(item.referenceId);
      if (route === undefined) {
        context.addIssue({
          code: "custom",
          path: item.path,
          message: "Entity primary route must reference a known route.",
        });
        continue;
      }
      if (route.target.kind !== item.kind) {
        context.addIssue({
          code: "custom",
          path: item.path,
          message: `Primary ${item.kind} route must target the owning ${item.kind}.`,
        });
        continue;
      }
      let targetId: string;
      if (route.target.kind === "product") {
        targetId = route.target.productId;
      } else if (route.target.kind === "collection") {
        targetId = route.target.collectionId;
      } else {
        targetId = route.target.categoryId;
      }
      if (targetId !== item.entityId) {
        context.addIssue({
          code: "custom",
          path: item.path,
          message: `Primary ${item.kind} route must target the owning ${item.kind}.`,
        });
      }
      if (!route.supportedLocales.every((locale) => item.locales?.includes(locale) ?? true)) {
        context.addIssue({
          code: "custom",
          path: item.path,
          message: `Primary ${item.kind} route locales must be compatible with the owning ${item.kind}.`,
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

    for (const category of projection.categories) {
      if (
        !category.supportedLocales.every((locale) => projection.supportedLocales.includes(locale))
      ) {
        context.addIssue({
          code: "custom",
          path: ["categories", category.id, "supportedLocales"],
          message: "Category locales must be subset of catalogue locales.",
        });
      }
      if (category.routeReferenceId !== undefined) {
        const route = routeById.get(category.routeReferenceId);
        if (
          route !== undefined &&
          !route.supportedLocales.every((locale) => category.supportedLocales.includes(locale))
        ) {
          context.addIssue({
            code: "custom",
            path: ["categories", category.id, "routeReferenceId"],
            message: "Category route locales must be compatible with category locales.",
          });
        }
      }

      const parent = category.parentCategoryId;
      if (parent !== null && parent !== undefined && !knownCategories.has(parent)) {
        context.addIssue({
          code: "custom",
          path: ["categories", category.id, "parentCategoryId"],
          message: "Category hierarchy must reference existing categories.",
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
      if (node.parentNavigationNodeId !== undefined && node.parentNavigationNodeId !== null) {
        const parentId = node.parentNavigationNodeId;
        if (!projection.navigation.some((item) => item.id === parentId)) {
          context.addIssue({
            code: "custom",
            path: ["navigation", node.id, "parentNavigationNodeId"],
            message: "Navigation hierarchy must reference an existing node.",
          });
        }
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

function stableId(prefix: string, sourceId: string): string {
  const candidate = `${prefix}_${sourceId}`;
  if (idSchema.safeParse(candidate).success && candidate.length <= 80) {
    return candidate;
  }
  const suffix = createHash("sha256").update(sourceId).digest("hex").slice(0, 24);
  return `${prefix}_${suffix}`;
}

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
  const standAloneMerchantId = stableId("merchant", catalogue.id);
  const fallback: StorefrontCatalogueProjection = {
    id: stableId("catalogue", catalogue.id),
    revision: 0,
    merchant: { id: standAloneMerchantId, name: "Standalone" },
    project: {
      id: stableId("project", catalogue.id),
      merchantId: standAloneMerchantId,
      revision: 0,
    },
    supportedLocales: ["en", "fi"],
    catalogueSafeTitle: { en: "Standalone catalogue", fi: "Paikallinen luettelo" },
    products: catalogue.products.map((product) => ({
      ...product,
      slug: product.id,
      routeReferenceId: undefined,
      routeReferenceIds: [],
      categoryIds: [],
    })),
    collections: catalogue.collections.map((collection) => ({
      ...collection,
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

function normalizeRoutePath(value: string): string {
  if (value === "/") return "/";
  return `/${value.trim().replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function normalizeReferenceIds(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function normalizeProjectionLocales(values: readonly Locale[]): Locale[] {
  return canonicalLocaleOrder(Array.from(new Set(values)));
}

function normalizeProjection(input: StorefrontCatalogueProjection): StorefrontCatalogueProjection {
  const supportedLocales = normalizeProjectionLocales(input.supportedLocales);

  return {
    ...input,
    supportedLocales,
    products: input.products.map((product) => ({
      ...product,
      routeReferenceIds: normalizeReferenceIds(product.routeReferenceIds),
      categoryIds: [...product.categoryIds],
      images: [...product.images],
    })),
    collections: input.collections.map((collection) => ({
      ...collection,
      routeReferenceIds: normalizeReferenceIds(collection.routeReferenceIds),
      productIds: [...collection.productIds],
    })),
    categories: input.categories.map((category) => ({
      ...category,
      parentCategoryId: category.parentCategoryId ?? null,
      supportedLocales: normalizeProjectionLocales(category.supportedLocales),
    })),
    routeReferences: input.routeReferences.map((route) => ({
      ...route,
      supportedLocales: normalizeProjectionLocales(route.supportedLocales),
      path: normalizeRoutePath(route.path),
    })),
    navigation: input.navigation.map((node) => ({
      ...node,
      parentNavigationNodeId: node.parentNavigationNodeId ?? null,
      supportedLocales: normalizeProjectionLocales(node.supportedLocales),
    })),
  };
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

function omitFields<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Omit<T, K> {
  const clone = { ...value } as Omit<T, K>;
  for (const key of keys) {
    delete (clone as Record<string, unknown>)[key as string];
  }
  return clone;
}

export function projectToCanonicalCommerceProjection(
  projection: StorefrontCatalogueProjection,
): CatalogueDisplayModel {
  return catalogueDisplayModelSchema.parse({
    id: projection.id,
    products: projection.products.map((product) => {
      return omitFields(product, [
        "slug",
        "routeReferenceId",
        "routeReferenceIds",
        "categoryIds",
      ] as const);
    }),
    collections: projection.collections.map((collection) => {
      return omitFields(collection, ["routeReferenceId", "routeReferenceIds"] as const);
    }),
  });
}
