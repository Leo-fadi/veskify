import { commercialSharedFrameProfileIdSchema as frames } from "@/domain/storefront";
import * as vocabulary from "@/application/prompted-storefront-design-intent/semantic-contract";
import { approvedAssetPlacementAuthority } from "@/application/ai-storefront-generation/approved-asset-placement-authority";
import {
  boundedStorefrontSynthesisSelectionNarrowingSchema as narrowingSchema,
  boundedStorefrontSynthesisExactSelectionSchema as exactSchema,
} from "@/application/bounded-storefront-synthesis/contract";
import {
  listCoordinatedStorefrontDirections as listDirections,
  validateCoordinatedStorefrontDirectionRegistry as validateRegistry,
  getCoordinatedStorefrontDirection as getDirection,
  validateDirectionSelectionNarrowing as validateNarrowing,
} from "@/application/bounded-storefront-synthesis/direction-registry";
import {
  listCompatibleCoordinatedDirectionFactorizedCandidates as listFactors,
  listCompatibleCoordinatedDirectionSelectionNarrowings as listNarrowings,
  inspectCompatibleCoordinatedDirectionCandidateInventory as inventory,
  isCurrentCompatibleCoordinatedDirectionExactSelection as currentExact,
  resolveCompatibleCoordinatedDirectionPostureFactors as resolveFactors,
  type CompatibleCoordinatedDirectionPostureFactors as Factors,
} from "@/application/bounded-storefront-synthesis/compatible-direction-selections";
import {
  deriveSemanticCapabilityIndex as deriveIndex,
  resolveSemanticStorefrontCompatibility as resolveCompatibility,
} from "@/application/prompted-storefront-design-compiler/semantic-compatibility-resolution";
import { createPromptedStorefrontDesignRequestV2 } from "@/application/prompted-storefront-design-intent/request";
import {
  createSemanticStorefrontDesignRequestV1 as createRequest,
  semanticStorefrontCurrentAuthorityFingerprint as currentFingerprint,
} from "@/application/prompted-storefront-design-intent/semantic-request";
import { createP10B16P04RawAurumCommercialFixture } from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";
import { observeSemanticFeatures } from "./ar-02l-semantic-feature-observation";
function normalized(value: unknown): unknown {
  if (typeof value === "bigint") return { bigint: value.toString() };
  if (value instanceof Error)
    return Object.fromEntries(
      [...["name", "message", "cause"], ...Object.getOwnPropertyNames(value)]
        .filter((key, index, keys) => key !== "stack" && keys.indexOf(key) === index)
        .map((key) => [key, normalized(Reflect.get(value, key))]),
    );
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalized(item)]));
  return value === undefined ? { undefined: true } : value;
}
const serialize = (value: unknown) => JSON.stringify(normalized(value));
export function observeCoordinatedMetadata() {
  const fixture = createP10B16P04RawAurumCommercialFixture();
  const authority = {
    planningInput: fixture.planningInput,
    siteMapDecision: fixture.siteMapDecision,
    approvedEvidenceReferences: fixture.approvedEvidenceReferences,
  };
  const watched = new Map<unknown, string>();
  const watch = (...values: unknown[]) =>
    values.forEach((value) => watched.set(value, serialize(value)));
  watch(fixture);
  const rows: { id: string; result: unknown; inputUnchanged: boolean }[] = [];
  function add(id: string, run: () => unknown, input: unknown = authority) {
    const before = serialize(input);
    let result: unknown;
    try {
      const value = run();
      result = {
        value: normalized(value),
        frozen: [
          Object.isFrozen(value),
          ...Object.values(Object(value) as object).map(Object.isFrozen),
        ],
      };
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      result = { error: normalized(error) };
    }
    if (serialize(input) !== before) throw new Error(`Observation mutated input: ${id}`);
    rows.push({ id, result, inputUnchanged: true });
  }
  const packages = listDirections();
  watch(packages);
  add("direction-registry", () => validateRegistry());
  for (const pkg of packages)
    add(`direction:${pkg.id}`, () => ({
      record: getDirection(pkg.id),
      detached: getDirection(pkg.id) !== getDirection(pkg.id),
    }));
  add("registry:missing", () => validateRegistry(packages.slice(1)));
  const factorized = listFactors(authority);
  watch(factorized);
  if (!factorized.length) throw new Error("Missing baseline candidates.");
  add("inventory:rich", () => inventory(authority));
  add("factorized:rich", () => factorized);
  add("narrowings:rich", () => listNarrowings(authority));
  for (const pkg of packages) {
    add(`filtered:${pkg.id}`, () => listFactors(authority, { directionId: pkg.id }));
    const candidate = factorized.find(
      ({ backbone }) => backbone.authorityId === `coordinated-direction:${pkg.id}`,
    );
    if (!candidate) throw new Error(`Missing direction: ${pkg.id}`);
    const seed = candidate.backbone;
    const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } = seed;
    void [authorityId, authorityVersion, authorityFingerprint, selectionId];
    watch(exact);
    add(`narrowing:${pkg.id}`, () => narrowingSchema.parse(seed), seed);
    add(`exact:${pkg.id}`, () => exactSchema.parse(exact), exact);
    add(`validate:${pkg.id}`, () => validateNarrowing(seed), seed);
    add(`current-exact:${pkg.id}`, () => currentExact({ authority, exactSelection: exact }));
    for (const [key, value] of Object.entries({
      extra: true,
      directionId: "unknown",
      homepageProfileId: "unknown",
      collectionProfileId: "unknown",
      searchProfileId: "unknown",
      pdpProfileId: "unknown",
      includedOptionalPageFamilyIds: Array(41).fill("about"),
      authorityVersion: "not-semver",
    })) {
      for (const [label, schema, input] of [
        ["schema", narrowingSchema, seed],
        ["exact-schema", exactSchema, exact],
      ] as const)
        add(`${label}:${pkg.id}:${key}`, () => schema.parse({ ...input, [key]: value }));
    }
    for (const patch of [
      { authorityFingerprint: "stale" },
      { authorityVersion: "9.0.0" },
      { authorityId: "coordinated-direction:unknown" },
      {
        informationDensityPosture: pkg.constraints.informationDensityPostures.find(
          (value) => value !== seed.informationDensityPosture,
        ),
      },
      { includedOptionalPageFamilyIds: ["unknown"] },
      { sharedFrameProfileId: "unknown" },
    ])
      add(`invalid-narrowing:${pkg.id}:${Object.keys(patch)[0]}`, () =>
        validateNarrowing({ ...seed, ...patch } as typeof seed),
      );
    const factors = Object.fromEntries(
      [
        "narrativePosture",
        "merchandisingPosture",
        "informationDensityPosture",
        "artDirectionPosture",
        "responsiveMode",
      ].map((key) => [key, Reflect.get(seed, key)]),
    ) as Factors;
    watch(factors);
    add(`factors:${pkg.id}`, () => resolveFactors({ factorizedCandidate: candidate, factors }));
    add(`factors-stale:${pkg.id}`, () =>
      resolveFactors({
        factorizedCandidate: { ...candidate, factorAuthorityFingerprint: "stale" },
        factors,
      }),
    );
    add(`factors-unsupported:${pkg.id}`, () =>
      resolveFactors({
        factorizedCandidate: candidate,
        factors: { ...factors, narrativePosture: "invalid" } as unknown as typeof factors,
      }),
    );
  }
  for (const maximumCandidateEvaluations of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 1, 8192])
    add(`budget:${maximumCandidateEvaluations}`, () =>
      inventory(authority, { maximumCandidateEvaluations }),
    );
  const variants = [
    "no-assets",
    "no-facts",
    "empty-catalogue",
    "no-directions",
    "unknown-required-profile",
    "required-optional-page",
    "campaign-allowed",
    "campaign-denied",
  ] as const;
  for (const variant of variants) {
    const input = structuredClone(authority);
    if (variant.startsWith("campaign-"))
      for (const asset of input.planningInput.approvedAssetContext?.assets ?? [])
        if (asset.role === "editorialImage")
          asset.presentation.placementAuthority = {
            ...approvedAssetPlacementAuthority(asset),
            purposes: [variant === "campaign-allowed" ? "collection-campaign" : "editorial-story"],
          };
    if (variant === "no-assets") input.planningInput.approvedAssetContext = null;
    if (variant === "no-facts") {
      input.approvedEvidenceReferences = [];
      input.planningInput.brief.businessIdentity.shortDescription = "";
    }
    if (variant === "empty-catalogue") {
      input.planningInput.catalogue.products = [];
      input.planningInput.catalogue.collections = [];
    }
    if (variant === "no-directions") input.planningInput.recipeContext.designSystem.directions = [];
    if (variant === "unknown-required-profile")
      input.siteMapDecision.pages.push({
        ...input.siteMapDecision.pages[0],
        familyId: "about",
        required: true,
        profile: { ...input.siteMapDecision.pages[0].profile, id: "unknown" },
      });
    if (variant === "required-optional-page")
      input.siteMapDecision.pages = input.siteMapDecision.pages.map((page) => ({
        ...page,
        required: true,
      }));
    add(`inventory:${variant}`, () => inventory(input), input);
    add(`factorized:${variant}`, () => listFactors(input), input);
  }
  const exact = createPromptedStorefrontDesignRequestV2({
    merchantPrompt: "Create a refined premium editorial storefront.",
    project: fixture.aggregate.project,
    draft: fixture.planningInput.draft,
    catalogue: fixture.planningInput.catalogue,
    approvedBrief: fixture.brief,
    approvedAssetContext: fixture.planningInput.approvedAssetContext,
  });
  const currentAuthorityFingerprint = currentFingerprint(exact.request.currentAuthority);
  const index = deriveIndex({ authority, currentAuthorityFingerprint });
  watch(index);
  add("semantic-index", () => index);
  const request = createRequest(exact, {
    semanticAuthorityFingerprint: index.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: index.semanticInfluenceAuthority,
  });
  function resolve(
    overrides: Parameters<typeof semanticIntentFixture>[1] = {},
    req = request,
    auth = authority,
    idx = index,
    trusted = currentAuthorityFingerprint,
  ) {
    const inputs = {
      request: req,
      intent: semanticIntentFixture(req, overrides),
      compatibilityInput: auth,
      semanticCapabilityIndex: idx,
      trustedCurrentAuthorityFingerprint: trusted,
    };
    watch(inputs);
    return resolveCompatibility(inputs);
  }
  add("semantic:default-repeat", () => [resolve(), resolve()]);
  const drivers = {
    commercialPosture: vocabulary.commercialPostureSchema.options,
    density: vocabulary.densityPostureSchema.options,
    navigationPosture: vocabulary.navigationPostureSchema.options,
    storyCatalogueBalance: vocabulary.storyCatalogueBalanceSchema.options,
    discoveryPosture: vocabulary.collectionDiscoveryPostureSchema.options,
    configurableProductPosture: vocabulary.configurableProductPostureSchema.options,
    mobileHierarchy: vocabulary.mobileHierarchySchema.options,
    imageProminence: vocabulary.mediaEmphasisSchema.options,
  };
  for (const [key, values] of Object.entries(drivers))
    for (const value of values)
      add(`semantic-driver:${key}:${value}`, () => resolve({ [key]: value }));
  for (const [field, value, semantics] of [
    ["commercial-posture", "minimal-commerce", "hard"],
    ["commercial-posture", "premium-editorial", "avoid"],
    ["required-evidence", "generic-content", "hard"],
    ["required-asset-role", "intentionally-unavailable-role", "hard"],
  ] as const)
    add(`constraint:${field}:${semantics}`, () =>
      resolve(
        {},
        createRequest(exact, {
          semanticAuthorityFingerprint: index.semanticAuthorityFingerprint,
          semanticInfluenceAuthority: index.semanticInfluenceAuthority,
          explicitConstraintAuthority: [
            { clauseReference: `ar02m-${field}-${semantics}`, field, value, semantics },
          ],
        }),
      ),
    );
  add("semantic:stale", () => resolve({}, { ...request, semanticAuthorityFingerprint: "stale" }));
  add("semantic:stale-current", () => resolve({}, request, authority, index, "stale"));
  add("semantic:empty", () =>
    resolve({}, request, authority, { ...index, candidates: [], candidateCount: 0 }),
  );
  add("semantic:all-frames-avoided", () =>
    resolve(
      {},
      createRequest(exact, {
        semanticAuthorityFingerprint: index.semanticAuthorityFingerprint,
        semanticInfluenceAuthority: index.semanticInfluenceAuthority,
        explicitConstraintAuthority: frames.options.map((id) => ({
          clauseReference: id,
          field: "shared-frame-family",
          value: id,
          semantics: "avoid",
        })),
      }),
    ),
  );
  add("features-and-axes", observeSemanticFeatures);
  for (const [input, original] of watched)
    if (serialize(input) !== original) throw new Error("Observation changed retained input.");
  return { rows, fixtureUnchanged: true };
}
