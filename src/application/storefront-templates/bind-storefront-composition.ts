import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/domain/shared/schemas";
import { validateComponentDefinitionV2 } from "@/domain/component-platform/component-platform";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront/canonical-storefront";
import { getPageFamilyDefinition } from "@/domain/storefront/page-family";
import type { PageModel } from "@/domain/storefront/storefront";
import type {
  DynamicCommerceCollectionSearchArchetype,
  DynamicCommerceProductDetailArchetype,
} from "@/domain/storefront/dynamic-commerce-route";
import type { CompiledPageBlueprintCompositionV1 } from "@/domain/storefront/compiled-page-blueprint-composition";
import {
  composedStorefrontSnapshotV1Schema,
  parseStorefrontSnapshotVersion,
  type ComposedStorefrontSnapshotV1,
} from "@/domain/storefront/storefront-composition-version";
import {
  compareCompositionStorageIds,
  createDynamicCommercePresentationAuthorityV2,
} from "@/domain/storefront/dynamic-commerce-composition-version";
import {
  compilePageBlueprintComposition,
  type PageBlueprintCompositionSelection,
} from "./compile-page-blueprint-composition";
import {
  validateCompiledPageBlueprintComposition,
  type PageBlueprintCompositionAuthority,
  type PageBlueprintCompositionOwner,
} from "./validate-page-blueprint-composition";
import { getCommercialCollectionSearchProfile } from "./commercial-collection-search-profiles";
import { getCommercialPdpProfile } from "./commercial-pdp-profiles";
import { materializeExecutablePageBlueprint } from "./profile-materializer";

declare const accepted: unique symbol;
export type AcceptedComposedStorefrontSnapshotV1 = ComposedStorefrontSnapshotV1 & {
  readonly [accepted]: true;
};
type OwnerId = CompiledPageBlueprintCompositionV1["owner"];
type TrustedAuthority = Omit<PageBlueprintCompositionAuthority, "owner">;
export type StorefrontCompositionAuthorityResolver = (
  input: Readonly<{
    owner: Readonly<OwnerId>;
    composition: PageBlueprintCompositionSelection | CompiledPageBlueprintCompositionV1;
  }>,
) => TrustedAuthority;
export type ComposedStorefrontCandidateRequest = Readonly<{
  expectedBase: Readonly<{ id: string; revision: number; contentFingerprint: string }>;
  successor: Readonly<{
    id: string;
    revision: number;
    projectId: string;
    catalogueRef: string;
    createdAt: string;
    createdBy: "user" | "agent" | "system";
  }>;
  assignments: readonly Readonly<{ selection: PageBlueprintCompositionSelection }>[];
}>;
const ownerIdSchema = z
  .object({
    kind: z.enum(["static-page", "collection-search-archetype", "product-detail-archetype"]),
    id: idSchema,
  })
  .strict();
const requestSchema = z
  .object({
    expectedBase: z
      .object({
        id: idSchema,
        revision: z.number().int().nonnegative(),
        contentFingerprint: z.string().min(1).max(256),
      })
      .strict(),
    successor: z
      .object({
        id: idSchema,
        revision: z.number().int().nonnegative(),
        projectId: idSchema,
        catalogueRef: idSchema,
        createdAt: isoDateTimeSchema,
        createdBy: z.enum(["user", "agent", "system"]),
      })
      .strict(),
    assignments: z
      .array(z.object({ selection: z.unknown() }).strict())
      .min(1)
      .max(1024),
  })
  .strict();
const selectionKeys = new Set([
  "compositionVersion",
  "owner",
  "orderAlternativeId",
  "regionAssignments",
  "relationshipRealizations",
  "breakpoints",
  "omissions",
]);
function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => freeze(entry, seen));
  return Object.freeze(value);
}
function fail(rule: string): never {
  throw new Error(`Storefront composition rejected: ${rule}`);
}

/** Only called with an owner already parsed by the strict aggregate codec. */
function contentView<T extends { composition: unknown }>(owner: T): Omit<T, "composition"> {
  const { composition: _composition, ...content } = owner;
  void _composition;
  return content;
}
function validateStaticProvenance(page: PageModel): void {
  const profile = page.pageFamily;
  if (
    profile &&
    !getPageFamilyDefinition(profile.familyId).allowedProfileReferences.some(
      ({ id, version }) => id === profile.profileId && version === profile.profileVersion,
    )
  )
    fail("stale static profile provenance");
}
function validateDynamicProvenance(
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  authority: TrustedAuthority,
): void {
  const families =
    archetype.family === "collection-search"
      ? archetype.supportedContexts.map((context) =>
          context === "search" ? ("search-results" as const) : ("collection" as const),
        )
      : ["product-detail" as const];
  if (
    families.some(
      (family) =>
        !getPageFamilyDefinition(family).allowedProfileReferences.some(
          ({ id, version }) =>
            id === archetype.profile.profileId && version === archetype.profile.profileVersion,
        ),
    )
  )
    fail("stale dynamic profile provenance");
  const plan =
    archetype.family === "collection-search"
      ? getCommercialCollectionSearchProfile(archetype.profile.profileId)
      : getCommercialPdpProfile(archetype.profile.profileId);
  if (!plan) fail("unknown dynamic profile");
  const material = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: authority.componentDefinitions.map(validateComponentDefinitionV2),
    availableBindingCategories:
      archetype.family === "collection-search" ? ["collection", "productList"] : ["product"],
  });
  if (
    material.profileVersion !== archetype.profile.profileVersion ||
    material.fingerprint !== archetype.profile.fingerprint
  )
    fail("stale dynamic profile fingerprint");
}

type Snapshot = ReturnType<typeof parseStorefrontSnapshotVersion>;
function containingOwners(
  snapshot: Snapshot,
  identity: OwnerId,
  authority: TrustedAuthority,
): PageBlueprintCompositionOwner[] {
  if (identity.kind === "static-page") {
    const page = snapshot.pages.find(({ id }) => id === identity.id);
    if (!page) fail("missing static owner");
    const content = "composition" in page ? contentView(page) : page;
    validateStaticProvenance(content);
    return [{ kind: "static-page", page: content }];
  }
  const dynamic = snapshot.dynamicCommercePresentation;
  if (identity.kind === "product-detail-archetype") {
    const owner = dynamic?.productDetailArchetypes.find(({ id }) => id === identity.id);
    if (!owner) fail("missing product-detail owner");
    const archetype = "composition" in owner ? contentView(owner) : owner;
    validateDynamicProvenance(archetype, authority);
    return [{ kind: "product-detail-archetype", archetype }];
  }
  const owner = dynamic?.collectionSearchArchetypes.find(({ id }) => id === identity.id);
  if (!owner) fail("missing collection/search owner");
  const archetype = "composition" in owner ? contentView(owner) : owner;
  validateDynamicProvenance(archetype, authority);
  // This hint only orders diagnostics. A validates the complete candidate for every context.
  const candidate = authority.candidate;
  const structural =
    candidate && typeof candidate === "object" && "structural" in candidate
      ? candidate.structural
      : undefined;
  const familyHint =
    structural && typeof structural === "object" && "pageFamilyId" in structural
      ? structural.pageFamilyId
      : undefined;
  const family = familyHint === "collection" || familyHint === "search" ? familyHint : undefined;
  const contexts = [...archetype.supportedContexts].sort(
    (a, b) => Number(b === family) - Number(a === family),
  );
  return contexts.map((context) => ({ kind: "collection-search-archetype", archetype, context }));
}
function trusted(
  resolver: StorefrontCompositionAuthorityResolver,
  identity: OwnerId,
  composition: PageBlueprintCompositionSelection | CompiledPageBlueprintCompositionV1,
): TrustedAuthority {
  const value = resolver(freeze(structuredClone({ owner: identity, composition })));
  if (!value || typeof value !== "object" || "owner" in value)
    fail("resolver must supply authority without an owner");
  // Caller-supplied trust never becomes serialized data or replaces containing content.
  return {
    candidate: value.candidate,
    componentDefinitions: value.componentDefinitions,
    support: value.support,
    requiredAssetRoleCapacityEvidence: value.requiredAssetRoleCapacityEvidence,
  };
}
function validateAll(
  snapshot: ComposedStorefrontSnapshotV1,
  resolver: StorefrontCompositionAuthorityResolver,
): AcceptedComposedStorefrontSnapshotV1 {
  const compositions = [
    ...snapshot.pages.flatMap((page) => ("composition" in page ? [page.composition] : [])),
    ...(snapshot.dynamicCommercePresentation?.collectionSearchArchetypes.flatMap((owner) =>
      "composition" in owner ? [owner.composition] : [],
    ) ?? []),
    ...(snapshot.dynamicCommercePresentation?.productDetailArchetypes.flatMap((owner) =>
      "composition" in owner ? [owner.composition] : [],
    ) ?? []),
  ];
  for (const composition of compositions) {
    const authority = trusted(resolver, composition.owner, composition);
    for (const owner of containingOwners(snapshot, composition.owner, authority))
      validateCompiledPageBlueprintComposition(composition, { ...authority, owner });
  }
  return freeze(snapshot) as AcceptedComposedStorefrontSnapshotV1;
}
export function validateComposedStorefrontSnapshot(
  input: unknown,
  resolveAuthority: StorefrontCompositionAuthorityResolver,
): AcceptedComposedStorefrontSnapshotV1 {
  return validateAll(composedStorefrontSnapshotV1Schema.parse(input), resolveAuthority);
}
export function createComposedStorefrontCandidate(
  base: unknown,
  request: ComposedStorefrontCandidateRequest,
  resolveAuthority: StorefrontCompositionAuthorityResolver,
): AcceptedComposedStorefrontSnapshotV1 {
  const parsed = parseStorefrontSnapshotVersion(base);
  const control = requestSchema.parse(request);
  if (
    parsed.id !== control.expectedBase.id ||
    parsed.revision !== control.expectedBase.revision ||
    canonicalStorefrontContentFingerprint(parsed) !== control.expectedBase.contentFingerprint
  )
    fail("stale base identity");
  if (
    control.successor.id === parsed.id ||
    control.successor.revision !== parsed.revision + 1 ||
    control.successor.projectId !== parsed.projectId ||
    control.successor.catalogueRef !== parsed.catalogueRef
  )
    fail("inconsistent successor identity");
  const selected = new Map<string, CompiledPageBlueprintCompositionV1>();
  for (const { selection } of structuredClone(request.assignments)) {
    if (
      !selection ||
      typeof selection !== "object" ||
      Object.keys(selection).some((key) => !selectionKeys.has(key))
    )
      fail("unknown selection field");
    const identity = ownerIdSchema.parse(selection.owner);
    const key = `${identity.kind}:${identity.id}`;
    if (selected.has(key)) fail("duplicate owner assignment");
    const authority = trusted(resolveAuthority, identity, selection);
    const owners = containingOwners(parsed, identity, authority);
    const composition = compilePageBlueprintComposition(selection, {
      ...authority,
      owner: owners[0],
    });
    for (const owner of owners)
      validateCompiledPageBlueprintComposition(composition, { ...authority, owner });
    selected.set(key, composition);
  }
  const pages = parsed.pages.map((page) => {
    const composition =
      selected.get(`static-page:${page.id}`) ??
      ("composition" in page ? page.composition : undefined);
    return composition
      ? {
          ...page,
          composition,
          sections: [...page.sections].sort((a, b) => compareCompositionStorageIds(a.id, b.id)),
        }
      : page;
  });
  let dynamic = parsed.dynamicCommercePresentation;
  if (dynamic && [...selected.keys()].some((key) => !key.startsWith("static-page:"))) {
    const { authorityFingerprint: _fingerprint, ...material } = dynamic;
    void _fingerprint;
    const collectionSearchArchetypes = dynamic.collectionSearchArchetypes.map((owner) => {
      const composition = selected.get(`collection-search-archetype:${owner.id}`);
      return composition ? { ...owner, composition } : owner;
    });
    const productDetailArchetypes = dynamic.productDetailArchetypes.map((owner) => {
      const composition = selected.get(`product-detail-archetype:${owner.id}`);
      return composition ? { ...owner, composition } : owner;
    });
    dynamic = createDynamicCommercePresentationAuthorityV2({
      ...material,
      contractVersion: "2.0.0",
      collectionSearchArchetypes,
      productDetailArchetypes,
    });
  }
  return validateComposedStorefrontSnapshot(
    {
      ...parsed,
      ...control.successor,
      compositionExtensionVersion: "1.0.0",
      pages,
      ...(dynamic ? { dynamicCommercePresentation: dynamic } : {}),
    },
    resolveAuthority,
  );
}
