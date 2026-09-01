import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
  PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION,
  PAGE_BLUEPRINT_V2_INITIAL_RECORD_VERSION,
  PAGE_BLUEPRINT_V2_SUPPORTED_RECORD_MAJOR_VERSION,
  canonicalizePageBlueprintV2StructuralContract,
  createPageBlueprintV2RegionRelationshipKey,
  executablePageBlueprintProfileSchema,
  getExecutablePageBlueprintProfile,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  pageBlueprintContractEnvelopeSchema,
  pageBlueprintV2RegionIdSchema,
  pageBlueprintV2RegionRelationshipKinds,
  pageBlueprintV2RegionRequirementSchema,
  pageBlueprintV2StructuralContractSchema,
  sharedStorefrontFrameProfile,
  type PageBlueprintV2RegionRelationshipKind,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";

type StructuralPageFamilyId =
  "home" | "collection" | "search" | "product-detail" | "content-support" | "utility";

type RegionInput = Readonly<{
  id: string;
  role: string;
  requirement: "required" | "optional";
  cardinality: Readonly<{ minimum: number; ideal: number; maximum: number }>;
  visualWeight: string;
}>;

type RelationshipInput = Readonly<{
  sourceRegionId: string;
  relationshipKind: string;
  targetRegionId: string;
}>;

type BlueprintInput = Readonly<{
  id: string;
  version: string;
  pageFamilyId: StructuralPageFamilyId;
  regions: readonly RegionInput[];
  relationships: readonly RelationshipInput[];
  orderAlternatives: readonly Readonly<{ id: string; regionIds: readonly string[] }>[];
  defaultOrderAlternativeId: string;
}>;

const minimumRolesByPageFamily: Readonly<Record<StructuralPageFamilyId, readonly string[]>> = {
  home: ["orientation", "primary-discovery"],
  collection: ["orientation", "primary-discovery"],
  search: ["orientation", "primary-discovery"],
  "product-detail": ["product-focus", "conversion"],
  "content-support": ["orientation"],
  utility: ["orientation"],
};

function requiredRegion(id: string, role: string): RegionInput {
  return {
    id,
    role,
    requirement: "required",
    cardinality: { minimum: 1, ideal: 1, maximum: 2 },
    visualWeight: "medium",
  };
}

function optionalRegion(id: string, role: string): RegionInput {
  return {
    id,
    role,
    requirement: "optional",
    cardinality: { minimum: 0, ideal: 1, maximum: 2 },
    visualWeight: "light",
  };
}

function fixtureFor(pageFamilyId: StructuralPageFamilyId): BlueprintInput {
  const regions = minimumRolesByPageFamily[pageFamilyId].map((role) =>
    requiredRegion(`${role}-region`, role),
  );
  return {
    id: `${pageFamilyId}-structure`,
    version: "1.0.0",
    pageFamilyId,
    regions,
    relationships: [],
    orderAlternatives: [{ id: "canonical-order", regionIds: regions.map((region) => region.id) }],
    defaultOrderAlternativeId: "canonical-order",
  };
}

function homeFixture(): BlueprintInput {
  return fixtureFor("home");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function accepts(value: unknown): boolean {
  return pageBlueprintV2StructuralContractSchema.safeParse(value).success;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((entry) => deepFrozen(entry, seen));
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function requiredRegisteredProfile(profileId = "blueprint-balanced-home") {
  const pagePlan = getExecutablePageBlueprintProfile(profileId);
  if (!pagePlan?.profile) throw new Error(`Missing registered profile ${profileId}.`);
  return pagePlan;
}

function materializeHome(pagePlan: ReturnType<typeof requiredRegisteredProfile>) {
  return materializeExecutablePageBlueprint({
    pagePlan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: [
      "navigation",
      "projectBrandContext",
      "collectionList",
      "productList",
    ],
  });
}

describe("P10B-19A-03 explicit PageBlueprint contract-version dispatch", () => {
  it("keeps contract-schema and record-version authority explicit and distinct", () => {
    expect(PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION).toBe("2.0.0");
    expect(PAGE_BLUEPRINT_V2_INITIAL_RECORD_VERSION).toBe("1.0.0");
    expect(PAGE_BLUEPRINT_V2_SUPPORTED_RECORD_MAJOR_VERSION).toBe(1);
  });

  it("parses explicit v1 and v2 envelopes through their existing and additive owners", () => {
    const pagePlan = requiredRegisteredProfile();
    const directV1 = executablePageBlueprintProfileSchema.parse(clone(pagePlan.profile));
    const dispatchedV1 = pageBlueprintContractEnvelopeSchema.parse({
      contractSchemaVersion: PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
      blueprint: clone(pagePlan.profile),
    });
    expect(dispatchedV1.contractSchemaVersion).toBe("1.0.0");
    expect(dispatchedV1.blueprint).toStrictEqual(directV1);
    expect(JSON.stringify(dispatchedV1.blueprint)).toBe(JSON.stringify(directV1));

    const v2 = pageBlueprintContractEnvelopeSchema.parse({
      contractSchemaVersion: PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION,
      blueprint: homeFixture(),
    });
    expect(v2.contractSchemaVersion).toBe("2.0.0");
    expect(v2.blueprint).toMatchObject({
      id: "home-structure",
      version: "1.0.0",
      pageFamilyId: "home",
    });
  });

  it.each([
    ["missing", { blueprint: homeFixture() }],
    ["unknown", { contractSchemaVersion: "3.0.0", blueprint: homeFixture() }],
    ["malformed", { contractSchemaVersion: "v2", blueprint: homeFixture() }],
    ["empty", { contractSchemaVersion: "", blueprint: homeFixture() }],
    [
      "v1 payload under v2",
      {
        contractSchemaVersion: PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION,
        blueprint: requiredRegisteredProfile().profile,
      },
    ],
    [
      "v2 payload under v1",
      {
        contractSchemaVersion: PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
        blueprint: homeFixture(),
      },
    ],
    [
      "unknown envelope field",
      {
        contractSchemaVersion: PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION,
        blueprint: homeFixture(),
        migration: true,
      },
    ],
  ])("fails closed for %s dispatch authority", (_label, value) => {
    expect(pageBlueprintContractEnvelopeSchema.safeParse(value).success).toBe(false);
  });

  it("preserves direct-v1 defaults, strictness and materialization exactly", () => {
    const pagePlan = requiredRegisteredProfile();
    const raw = clone(pagePlan.profile) as Record<string, unknown>;
    delete raw.parameterDefaults;
    delete raw.requiredBindingCategories;
    delete raw.requiredAssetRoles;

    const direct = executablePageBlueprintProfileSchema.parse(raw);
    const dispatched = pageBlueprintContractEnvelopeSchema.parse({
      contractSchemaVersion: PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
      blueprint: raw,
    });
    expect(dispatched.blueprint).toStrictEqual(direct);

    const unknown = { ...clone(pagePlan.profile), futureAuthority: true };
    expect(executablePageBlueprintProfileSchema.safeParse(unknown).success).toBe(false);
    expect(
      pageBlueprintContractEnvelopeSchema.safeParse({
        contractSchemaVersion: PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
        blueprint: unknown,
      }).success,
    ).toBe(false);

    const dispatchedRegistered = pageBlueprintContractEnvelopeSchema.parse({
      contractSchemaVersion: PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
      blueprint: clone(pagePlan.profile),
    });
    if (
      dispatchedRegistered.contractSchemaVersion !==
      PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION
    ) {
      throw new Error("Expected the explicit v1 compatibility dispatch branch.");
    }
    const dispatchedPagePlan = {
      ...clone(pagePlan),
      profile: clone(dispatchedRegistered.blueprint),
    };
    expect(materializeHome(dispatchedPagePlan)).toStrictEqual(materializeHome(pagePlan));
  });

  it("does not infer a contract upgrade from an existing v1 profile record version", () => {
    const pagePlan = requiredRegisteredProfile();
    const futureProfile = { ...clone(pagePlan.profile), version: "2.0.0" };
    expect(executablePageBlueprintProfileSchema.safeParse(futureProfile).success).toBe(true);
    const dispatched = pageBlueprintContractEnvelopeSchema.parse({
      contractSchemaVersion: PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
      blueprint: futureProfile,
    });
    expect(dispatched.contractSchemaVersion).toBe("1.0.0");
    if (
      dispatched.contractSchemaVersion !== PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION
    ) {
      throw new Error("Expected the explicit v1 compatibility dispatch branch.");
    }
    expect(() => materializeHome({ ...clone(pagePlan), profile: dispatched.blueprint })).toThrow(
      expect.objectContaining({ code: "unsupported-profile-version" }),
    );
  });
});

describe("P10B-19A-03 v2 record, region and minimum-structure authority", () => {
  it.each(["1.0.0", "1.1.0", "1.12.345"])("accepts supported record version %s", (version) => {
    expect(accepts({ ...homeFixture(), version })).toBe(true);
  });

  it.each([
    "0.1.0",
    "2.0.0",
    "01.0.0",
    "1.01.0",
    "1.0.01",
    "v1.0.0",
    "1.0",
    "1.0.0-alpha",
    "1.0.0+build",
    " 1.0.0",
    "1.0.0 ",
  ])("rejects noncanonical or unsupported record version %j", (version) => {
    expect(accepts({ ...homeFixture(), version })).toBe(false);
  });

  it.each([
    ["valid region ID", "primary-discovery"],
    ["short region ID", "a"],
    ["numeric suffix", "story-2"],
  ])("accepts %s", (_label, id) => {
    expect(pageBlueprintV2RegionIdSchema.safeParse(id).success).toBe(true);
  });

  it.each([
    ["uppercase", "Primary-discovery"],
    ["leading whitespace", " primary-discovery"],
    ["trailing whitespace", "primary-discovery "],
    ["embedded whitespace", "primary discovery"],
    ["underscore", "primary_discovery"],
    ["slash", "primary/discovery"],
    ["route syntax", ":product-id"],
    ["dot traversal", "../primary-discovery"],
    ["empty", ""],
    ["overlong", `r-${"a".repeat(256)}`],
  ])("rejects %s region IDs without normalization", (_label, id) => {
    expect(pageBlueprintV2RegionIdSchema.safeParse(id).success).toBe(false);
  });

  it("accepts exact required/optional regions and returns a deeply readonly parsed value", () => {
    expect(pageBlueprintV2RegionRequirementSchema.options).toStrictEqual(["required", "optional"]);
    const input = homeFixture();
    const parsed = pageBlueprintV2StructuralContractSchema.parse(input);
    expect(parsed.regions).toStrictEqual(input.regions);
    expect(deepFrozen(parsed)).toBe(true);
  });

  it.each([
    [
      "duplicate region ID",
      (input: BlueprintInput) => ({ ...input, regions: [...input.regions, input.regions[0]] }),
    ],
    [
      "minimum greater than ideal",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0 ? { ...region, cardinality: { minimum: 2, ideal: 1, maximum: 2 } } : region,
        ),
      }),
    ],
    [
      "ideal greater than maximum",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0 ? { ...region, cardinality: { minimum: 1, ideal: 3, maximum: 2 } } : region,
        ),
      }),
    ],
    [
      "required zero minimum",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0 ? { ...region, cardinality: { minimum: 0, ideal: 1, maximum: 2 } } : region,
        ),
      }),
    ],
    [
      "optional positive minimum",
      (input: BlueprintInput) => ({
        ...input,
        regions: [
          ...input.regions,
          {
            ...optionalRegion("story-region", "brand-story"),
            cardinality: { minimum: 1, ideal: 1, maximum: 2 },
          },
        ],
        orderAlternatives: [
          {
            id: "canonical-order",
            regionIds: [...input.regions.map((region) => region.id), "story-region"],
          },
        ],
      }),
    ],
    [
      "unsupported role",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0 ? { ...region, role: "provider-authored-role" } : region,
        ),
      }),
    ],
    [
      "unsupported visual weight",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0 ? { ...region, visualWeight: "fullscreen" } : region,
        ),
      }),
    ],
    [
      "unknown region field",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0 ? { ...region, componentId: "homepageHero" } : region,
        ),
      }),
    ],
    [
      "unknown cardinality field",
      (input: BlueprintInput) => ({
        ...input,
        regions: input.regions.map((region, index) =>
          index === 0
            ? { ...region, cardinality: { ...region.cardinality, inventory: 5 } }
            : region,
        ),
      }),
    ],
  ])("fails closed for %s", (_label, mutate) => {
    expect(accepts(mutate(homeFixture()))).toBe(false);
  });

  it.each(Object.keys(minimumRolesByPageFamily) as StructuralPageFamilyId[])(
    "accepts the locked minimum required roles for %s",
    (pageFamilyId) => {
      expect(accepts(fixtureFor(pageFamilyId))).toBe(true);
    },
  );

  it.each([
    ["home", "orientation"],
    ["home", "primary-discovery"],
    ["collection", "primary-discovery"],
    ["search", "primary-discovery"],
    ["product-detail", "product-focus"],
    ["product-detail", "conversion"],
    ["content-support", "orientation"],
    ["utility", "orientation"],
  ] as const)("rejects %s without required %s", (pageFamilyId, missingRole) => {
    const input = fixtureFor(pageFamilyId);
    const retained = input.regions.filter((region) => region.role !== missingRole);
    expect(
      accepts({
        ...input,
        regions: retained,
        orderAlternatives: [
          { id: "canonical-order", regionIds: retained.map((region) => region.id) },
        ],
      }),
    ).toBe(false);
  });

  it("does not let an optional region satisfy minimum-role authority", () => {
    const input = homeFixture();
    expect(
      accepts({
        ...input,
        regions: input.regions.map((region) =>
          region.role === "orientation"
            ? { ...optionalRegion(region.id, region.role), visualWeight: region.visualWeight }
            : region,
        ),
      }),
    ).toBe(false);
  });

  it("permits additional canonical narrative roles without turning them into templates", () => {
    const input = homeFixture();
    expect(
      accepts({
        ...input,
        regions: [...input.regions, optionalRegion("brand-story-region", "brand-story")],
        orderAlternatives: [
          {
            id: "canonical-order",
            regionIds: [...input.regions.map((region) => region.id), "brand-story-region"],
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("P10B-19A-03 region relationships and graph invariants", () => {
  const relationship = (
    relationshipKind: PageBlueprintV2RegionRelationshipKind,
    sourceRegionId = "orientation-region",
    targetRegionId = "primary-discovery-region",
  ): RelationshipInput & { relationshipKind: PageBlueprintV2RegionRelationshipKind } => ({
    sourceRegionId,
    relationshipKind,
    targetRegionId,
  });

  function withRelationships(
    relationships: readonly RelationshipInput[],
    regionIds = ["orientation-region", "primary-discovery-region"],
  ): BlueprintInput {
    return {
      ...homeFixture(),
      relationships,
      orderAlternatives: [{ id: "canonical-order", regionIds }],
    };
  }

  it("owns exactly the six ordered per-page relationship kinds", () => {
    expect(pageBlueprintV2RegionRelationshipKinds).toStrictEqual([
      "precedes",
      "pairs-with",
      "offsets",
      "contains",
      "spans",
      "anchors",
    ]);
  });

  it.each(pageBlueprintV2RegionRelationshipKinds)("accepts exact relationship kind %s", (kind) => {
    expect(accepts(withRelationships([relationship(kind)]))).toBe(true);
  });

  it.each([
    [
      "cross-page kind",
      [
        {
          sourceRegionId: "orientation-region",
          relationshipKind: "frame-continuity",
          targetRegionId: "primary-discovery-region",
        },
      ],
    ],
    ["self relationship", [relationship("anchors", "orientation-region", "orientation-region")]],
    ["missing source", [relationship("anchors", "unknown-region")]],
    ["missing target", [relationship("anchors", "orientation-region", "unknown-region")]],
    ["exact duplicate", [relationship("anchors"), relationship("anchors")]],
    [
      "reverse pairs-with duplicate",
      [
        relationship("pairs-with"),
        relationship("pairs-with", "primary-discovery-region", "orientation-region"),
      ],
    ],
  ])("rejects %s", (_label, relationships) => {
    expect(accepts(withRelationships(relationships))).toBe(false);
  });

  it("treats reverse directional and different-kind relationships as distinct", () => {
    expect(
      accepts(
        withRelationships([
          relationship("offsets"),
          relationship("offsets", "primary-discovery-region", "orientation-region"),
          relationship("anchors"),
        ]),
      ),
    ).toBe(true);
  });

  it("rejects unknown relationship fields and produces a deterministic symmetric key", () => {
    const unknownField = { ...relationship("anchors"), gridArea: "hero" };
    expect(accepts(withRelationships([unknownField]))).toBe(false);
    expect(createPageBlueprintV2RegionRelationshipKey(relationship("pairs-with"))).toBe(
      createPageBlueprintV2RegionRelationshipKey(
        relationship("pairs-with", "primary-discovery-region", "orientation-region"),
      ),
    );
    expect(createPageBlueprintV2RegionRelationshipKey(relationship("offsets"))).not.toBe(
      createPageBlueprintV2RegionRelationshipKey(
        relationship("offsets", "primary-discovery-region", "orientation-region"),
      ),
    );
  });

  it("keeps duplicate failure evidence bounded and deterministic", () => {
    const invalid = withRelationships(Array.from({ length: 40 }, () => relationship("anchors")));
    const first = pageBlueprintV2StructuralContractSchema.safeParse(invalid);
    const second = pageBlueprintV2StructuralContractSchema.safeParse(invalid);
    expect(first.success).toBe(false);
    expect(second.success).toBe(false);
    if (first.success || second.success)
      throw new Error("Expected duplicate relationship failure.");
    const firstEvidence = JSON.stringify(first.error.issues);
    expect(firstEvidence).toBe(JSON.stringify(second.error.issues));
    expect(firstEvidence.length).toBeLessThan(8_192);
  });

  it("accepts acyclic precedence and containment graphs", () => {
    expect(accepts(withRelationships([relationship("precedes")]))).toBe(true);
    expect(accepts(withRelationships([relationship("contains")]))).toBe(true);
  });

  it.each([
    [
      "precedence cycle",
      [
        relationship("precedes"),
        relationship("precedes", "primary-discovery-region", "orientation-region"),
      ],
    ],
    [
      "containment cycle",
      [
        relationship("contains"),
        relationship("contains", "primary-discovery-region", "orientation-region"),
      ],
    ],
    [
      "combined precedence/containment cycle",
      [
        relationship("contains"),
        relationship("precedes", "primary-discovery-region", "orientation-region"),
      ],
    ],
  ])("rejects a %s", (_label, relationships) => {
    expect(accepts(withRelationships(relationships))).toBe(false);
  });

  it("rejects multiple direct containment parents", () => {
    const input = homeFixture();
    const regions = [...input.regions, requiredRegion("story-region", "brand-story")];
    expect(
      accepts({
        ...input,
        regions,
        relationships: [
          relationship("contains", "orientation-region", "story-region"),
          relationship("contains", "primary-discovery-region", "story-region"),
        ],
        orderAlternatives: [
          { id: "canonical-order", regionIds: regions.map((region) => region.id) },
        ],
      }),
    ).toBe(false);
  });

  it("allows disconnected regions and reciprocal non-ordering relationships", () => {
    const input = homeFixture();
    const regions = [...input.regions, optionalRegion("story-region", "brand-story")];
    expect(
      accepts({
        ...input,
        regions,
        relationships: [
          relationship("anchors"),
          relationship("anchors", "primary-discovery-region", "orientation-region"),
        ],
        orderAlternatives: [
          { id: "canonical-order", regionIds: regions.map((region) => region.id) },
        ],
      }),
    ).toBe(true);
  });

  it("does not infer transitive or connectivity edges", () => {
    const input = homeFixture();
    const regions = [...input.regions, optionalRegion("story-region", "brand-story")];
    const canonical = canonicalizePageBlueprintV2StructuralContract({
      ...input,
      regions,
      relationships: [relationship("precedes")],
      orderAlternatives: [{ id: "canonical-order", regionIds: regions.map((region) => region.id) }],
    });
    expect(canonical.relationships).toStrictEqual([relationship("precedes")]);
  });
});

describe("P10B-19A-03 order alternatives and deterministic canonicalization", () => {
  function orderedFixture(): BlueprintInput {
    const input = homeFixture();
    const regions = [...input.regions, optionalRegion("story-region", "brand-story")];
    return {
      ...input,
      regions,
      relationships: [
        {
          sourceRegionId: "orientation-region",
          relationshipKind: "precedes",
          targetRegionId: "primary-discovery-region",
        },
        {
          sourceRegionId: "orientation-region",
          relationshipKind: "contains",
          targetRegionId: "story-region",
        },
      ],
      orderAlternatives: [
        {
          id: "z-canonical",
          regionIds: ["orientation-region", "primary-discovery-region", "story-region"],
        },
        {
          id: "a-editorial",
          regionIds: ["orientation-region", "story-region", "primary-discovery-region"],
        },
      ],
      defaultOrderAlternativeId: "z-canonical",
    };
  }

  it("accepts full permutations and multiple valid accessible reading orders", () => {
    expect(accepts(orderedFixture())).toBe(true);
  });

  it.each([
    [
      "duplicate region",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: [
          {
            id: "z-canonical",
            regionIds: ["orientation-region", "orientation-region", "story-region"],
          },
        ],
      }),
    ],
    [
      "missing region",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: [
          { id: "z-canonical", regionIds: ["orientation-region", "primary-discovery-region"] },
        ],
      }),
    ],
    [
      "unknown region",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: [
          {
            id: "z-canonical",
            regionIds: ["orientation-region", "primary-discovery-region", "unknown-region"],
          },
        ],
      }),
    ],
    [
      "duplicate alternative ID",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: [
          input.orderAlternatives[0],
          { ...input.orderAlternatives[1], id: "z-canonical" },
        ],
      }),
    ],
    [
      "missing default alternative",
      (input: BlueprintInput) => ({ ...input, defaultOrderAlternativeId: "missing-order" }),
    ],
    [
      "precedence violation",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: [
          {
            id: "z-canonical",
            regionIds: ["primary-discovery-region", "orientation-region", "story-region"],
          },
        ],
      }),
    ],
    [
      "containment parent-after-child violation",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: [
          {
            id: "z-canonical",
            regionIds: ["story-region", "orientation-region", "primary-discovery-region"],
          },
        ],
      }),
    ],
    [
      "unknown order-alternative field",
      (input: BlueprintInput) => ({
        ...input,
        orderAlternatives: input.orderAlternatives.map((alternative, index) =>
          index === 0 ? { ...alternative, gridArea: "main" } : alternative,
        ),
      }),
    ],
  ])("rejects %s", (_label, mutate) => {
    expect(accepts(mutate(orderedFixture()))).toBe(false);
  });

  it("canonicalizes default-first order, default-position regions and relationship rank", () => {
    const input = orderedFixture();
    const canonical = canonicalizePageBlueprintV2StructuralContract({
      ...input,
      regions: [...input.regions].reverse(),
      relationships: [
        {
          sourceRegionId: "orientation-region",
          relationshipKind: "anchors",
          targetRegionId: "story-region",
        },
        ...input.relationships,
        {
          sourceRegionId: "orientation-region",
          relationshipKind: "pairs-with",
          targetRegionId: "story-region",
        },
      ],
      orderAlternatives: [...input.orderAlternatives].reverse(),
    });
    expect(canonical.regions.map(({ id }) => id)).toStrictEqual([
      "orientation-region",
      "primary-discovery-region",
      "story-region",
    ]);
    expect(canonical.relationships.map(({ relationshipKind }) => relationshipKind)).toStrictEqual([
      "precedes",
      "pairs-with",
      "contains",
      "anchors",
    ]);
    expect(canonical.orderAlternatives.map(({ id }) => id)).toStrictEqual([
      "z-canonical",
      "a-editorial",
    ]);
    expect(deepFrozen(canonical)).toBe(true);
  });

  it("returns identical canonical output for semantically equivalent valid input order", () => {
    const input = orderedFixture();
    const first = canonicalizePageBlueprintV2StructuralContract({
      ...input,
      relationships: [
        ...input.relationships,
        {
          sourceRegionId: "orientation-region",
          relationshipKind: "pairs-with",
          targetRegionId: "story-region",
        },
      ],
    });
    const second = canonicalizePageBlueprintV2StructuralContract({
      ...input,
      regions: [...input.regions].reverse(),
      relationships: [
        {
          sourceRegionId: "story-region",
          relationshipKind: "pairs-with",
          targetRegionId: "orientation-region",
        },
        ...[...input.relationships].reverse(),
      ],
      orderAlternatives: [...input.orderAlternatives].reverse(),
    });
    expect(second).toStrictEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("never repairs invalid input before canonicalization", () => {
    const invalid = orderedFixture();
    expect(() =>
      canonicalizePageBlueprintV2StructuralContract({
        ...invalid,
        orderAlternatives: [
          {
            id: "z-canonical",
            regionIds: ["orientation-region", "orientation-region", "story-region"],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("P10B-19A-03 forbidden authority and zero reachability", () => {
  it.each([
    "route",
    "routes",
    "url",
    "slug",
    "pageId",
    "pageInstanceId",
    "navigation",
    "navigationItems",
    "familyId",
    "familyVersion",
    "lifecycleState",
    "component",
    "componentId",
    "componentFamily",
    "variant",
    "props",
    "asset",
    "assetId",
    "assetRole",
    "evidenceRequirement",
    "productId",
    "collectionId",
    "commerce",
    "media",
    "palette",
    "font",
    "css",
    "html",
    "gridArea",
    "coordinates",
    "breakpoint",
    "responsive",
    "omission",
    "substitution",
    "fallback",
    "providerPayload",
    "visualRecipe",
    "migrationAlias",
    "normalizedTopology",
    "structuralFingerprint",
    "realizationFingerprint",
    "metadata",
  ])("rejects premature or foreign root authority %s", (field) => {
    expect(accepts({ ...homeFixture(), [field]: "forbidden" })).toBe(false);
  });

  it("exports no v2 instance, default blueprint, registry or family record", () => {
    const exports = Object.entries(storefrontTemplateAuthority);
    expect(
      exports.filter(
        ([, value]) =>
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.hasOwn(value, "pageFamilyId") &&
          Object.hasOwn(value, "regions"),
      ),
    ).toStrictEqual([]);
    expect(
      exports
        .map(([name]) => name)
        .filter((name) => /default.*pageblueprintv2|pageblueprintv2.*registry/iu.test(name)),
    ).toStrictEqual([]);
    expect(listExecutablePageBlueprintProfiles()).toHaveLength(53);
    expect(
      listExecutablePageBlueprintProfiles().filter(
        (pagePlan) =>
          (pagePlan as unknown as { pageFamilyId?: unknown }).pageFamilyId !== undefined,
      ),
    ).toStrictEqual([]);
  });

  it("keeps v2 pure and unreachable from current production consumers", () => {
    const repositoryRoot = resolve(process.cwd());
    const allowedAuthorityFiles = new Set([
      "src/application/storefront-templates/page-blueprint-v2-contract.ts",
      "src/application/storefront-templates/page-blueprint-v2-asset-role-contract.ts",
      "src/application/storefront-templates/page-blueprint-v2-responsive-rule-contract.ts",
      "src/application/storefront-templates/page-blueprint-version-dispatch.ts",
      "src/application/storefront-templates/index.ts",
    ]);
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) =>
        /page-blueprint-v2-contract|pageBlueprintV2|PageBlueprintV2|PAGE_BLUEPRINT_V2/u.test(
          source,
        ),
      )
      .map(({ path }) => relative(repositoryRoot, path))
      .filter((path) => !allowedAuthorityFiles.has(path));
    expect(consumers).toStrictEqual([]);

    const explicitNoConsumerFiles = [
      "src/application/storefront-templates/registry.ts",
      "src/application/storefront-templates/resolver.ts",
      "src/application/storefront-templates/profile-materializer.ts",
      "src/application/storefront-templates/materializer.ts",
      "src/domain/storefront/storefront.ts",
    ];
    explicitNoConsumerFiles.forEach((path) => {
      expect(readFileSync(resolve(repositoryRoot, path), "utf8")).not.toMatch(
        /page-blueprint-v2-contract|pageBlueprintV2|PageBlueprintV2|PAGE_BLUEPRINT_V2/u,
      );
    });
  });

  it("keeps every registered v1 PageBlueprint byte/semantic authority locked", () => {
    const pagePlans = listExecutablePageBlueprintProfiles();
    expect(pagePlans).toHaveLength(53);
    expect(pagePlans.every((pagePlan) => pagePlan.profile?.version === "1.0.0")).toBe(true);
    expect(
      createHash("sha256")
        .update(JSON.stringify({ pagePlans, sharedStorefrontFrameProfile }))
        .digest("hex"),
    ).toBe("bb645147d5be601a9d1f46a4c6bfdd18111183aee0c151ddeff22d020b6e5871");

    const repositoryRoot = resolve(process.cwd());
    const v1AuthorityFiles = [
      "src/application/storefront-templates/contract.ts",
      "src/application/storefront-templates/registry.ts",
      "src/application/storefront-templates/page-family-baselines.ts",
      "src/application/storefront-templates/commercial-homepage-profiles.ts",
      "src/application/storefront-templates/commercial-content-support-profiles.ts",
      "src/application/storefront-templates/commercial-collection-search-profiles.ts",
      "src/application/storefront-templates/commercial-pdp-profiles.ts",
      "src/application/storefront-templates/commercial-utility-profiles.ts",
    ] as const;
    const sourceHash = createHash("sha256");
    v1AuthorityFiles.forEach((path) => {
      sourceHash.update(path, "utf8");
      sourceHash.update("\0", "utf8");
      sourceHash.update(readFileSync(resolve(repositoryRoot, path)));
      sourceHash.update("\0", "utf8");
    });
    expect(sourceHash.digest("hex")).toBe(
      "068da1456be8921ec1014bc10701f629be5afb770910efb0fe91a86c75b9167b",
    );
  });
});
