// @vitest-environment node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_REGISTRY_SCHEMA_VERSION,
  LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_SCHEMA_VERSION,
  LEGACY_V1_COORDINATED_DIRECTION_REPLAY_AUTHORITY_KIND,
  LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_AUTHORITY_KIND,
  LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_SCHEMA_VERSION,
  LegacyV1ReplayAuthorityError,
  createLegacyV1CoordinatedDirectionReplayAlias,
  createLegacyV1CoordinatedDirectionReplayAliasRegistry,
  createLegacyV1StorefrontReplayReference,
  legacyV1CoordinatedDirectionReplayAliasIdSchema,
  legacyV1CoordinatedDirectionReplayAliasIds,
  legacyV1CoordinatedDirectionReplayAliasRegistry,
  legacyV1CoordinatedDirectionReplayAliasRegistryV1Schema,
  legacyV1CoordinatedDirectionReplayAliasV1Schema,
  legacyV1ReplayAuthorityErrorCodes,
  legacyV1StorefrontReplayReferenceV1Schema,
  parseLegacyV1CoordinatedDirectionReplayAlias,
  parseLegacyV1CoordinatedDirectionReplayAliasRegistry,
  parseLegacyV1StorefrontReplayReference,
  resolveLegacyV1ReplayAlias,
  type LegacyV1CoordinatedDirectionReplayAliasId,
  type LegacyV1CoordinatedDirectionReplayAliasV1,
} from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
import type { BoundedStorefrontSynthesisSelectionNarrowing } from "@/application/bounded-storefront-synthesis/contract";
import {
  COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
  type CoordinatedStorefrontDirectionId,
} from "@/application/bounded-storefront-synthesis/direction-contract";
import {
  getCoordinatedStorefrontDirection,
  informationDensityPostureForDesignSystemSpacingDensity,
  listCoordinatedStorefrontDirections,
} from "@/application/bounded-storefront-synthesis/direction-registry";
import {
  inactiveStructuralStorefrontFamilyCandidateRegistry,
  inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
} from "@/application/storefront-templates";
import {
  canonicalValueFingerprint,
  canonicalValueString,
} from "@/domain/storefront/canonical-storefront";

const expectedMappings = [
  ["legacy-v1:premium-editorial", "premium-editorial"],
  ["legacy-v1:modern-technical", "modern-technical"],
  ["legacy-v1:minimal-commerce", "minimal-commerce"],
] as const satisfies readonly (readonly [
  LegacyV1CoordinatedDirectionReplayAliasId,
  CoordinatedStorefrontDirectionId,
])[];

const expectedDirectionFingerprints = {
  "premium-editorial":
    "coordinated-direction-v1_1841_4551ab95363451974f965fe569b702847102e034cc22830622fdf3ae9ddd9d6b",
  "modern-technical":
    "coordinated-direction-v1_1984_a77eae50c2977c9c61323c2326477304a1d8265670287449f33104222cbd21dd",
  "minimal-commerce":
    "coordinated-direction-v1_1929_d831c8a40d73eb3e482853512c04cd7539bb58a745b3a9912849b0090eec530c",
} as const;

const expectedProtectedV1SourceHashes = {
  "contract.ts": "39dc68a8484c6c9ce70dfb271ed5c25261dba31aa0b2801741bf439bb1d71784",
  "direction-contract.ts": "f62ab54f221d084a0f593d2a090feca7ba9ddce4f9d23dcf8688960f4d8d1b28",
  "direction-registry.ts": "89bc33413448fadb73a56385c4e9cd1b12ca6b23e1022eb0e5cbf4e6c0605ca1",
  "coordinated-directions.ts": "0c80158f6f3da5a07525b32c6057f2a66551b256d83f50c7635d25f7064183cc",
  "compatible-direction-selections.ts":
    "ff2af5f1cee5458e633e476cfc8bf2ffbbeb3e8ed6b451cb46f9219614db96dc",
  "index.ts": "7fa861f5e07721d36ab85220d2ec4ebe84717d8f3b73b94ba4a599cf86f937a8",
} as const;

function deepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

function staleFingerprint(value: string): string {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function expectLegacyError(
  operation: () => unknown,
  code: InstanceType<typeof LegacyV1ReplayAuthorityError>["code"],
): LegacyV1ReplayAuthorityError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(LegacyV1ReplayAuthorityError);
    expect(error).toMatchObject({ code });
    return error as LegacyV1ReplayAuthorityError;
  }
  throw new Error(`Expected ${code}.`);
}

function selectionFor(
  aliasId: LegacyV1CoordinatedDirectionReplayAliasId,
  overrides: Partial<BoundedStorefrontSynthesisSelectionNarrowing> = {},
): BoundedStorefrontSynthesisSelectionNarrowing {
  const alias = resolveLegacyV1ReplayAlias(aliasId);
  const direction = getCoordinatedStorefrontDirection(alias.coordinatedDirectionId);
  const spacing =
    overrides.designSystemSpacingDensity ?? direction.constraints.designSystemSpacingDensities[0];
  return {
    authorityId: `coordinated-direction:${direction.id}`,
    authorityVersion: direction.version,
    authorityFingerprint: direction.authorityFingerprint,
    selectionId: `selection-${direction.id}`,
    directionId: direction.constraints.designSystemDirectionIds[0],
    designSystemSpacingDensity: spacing,
    designSystemSurfaceDepth: direction.constraints.designSystemSurfaceDepths[0],
    sharedFrameProfileId: direction.constraints.sharedFrameProfileIds[0],
    homepageProfileId: direction.constraints.homepageProfileIds[0],
    collectionProfileId: direction.constraints.collectionProfileIds[0],
    searchProfileId: direction.constraints.searchProfileIds[0],
    pdpProfileId: direction.constraints.pdpProfileIds[0],
    includedOptionalPageFamilyIds: [...direction.constraints.optionalPageFamilyCompositions[0]],
    ...direction.constraints.postureDefaults,
    informationDensityPosture:
      overrides.informationDensityPosture ??
      informationDensityPostureForDesignSystemSpacingDensity(spacing),
    ...overrides,
  };
}

function referenceFor(
  aliasId: LegacyV1CoordinatedDirectionReplayAliasId,
  overrides: Partial<BoundedStorefrontSynthesisSelectionNarrowing> = {},
) {
  return createLegacyV1StorefrontReplayReference({
    aliasId,
    sourceSelection: selectionFor(aliasId, overrides),
  });
}

function aliasFingerprint(alias: LegacyV1CoordinatedDirectionReplayAliasV1): string {
  const { aliasFingerprint: _aliasFingerprint, ...material } = alias;
  void _aliasFingerprint;
  return `legacy-v1-direction-alias-${canonicalValueFingerprint(material)}`;
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : /\.[cm]?[jt]sx?$/u.test(entry.name)
        ? [path]
        : [];
  });
}

const invalidRegistryAliasCases: readonly (readonly [
  string,
  (aliases: readonly LegacyV1CoordinatedDirectionReplayAliasV1[]) => readonly unknown[],
])[] = [
  ["missing", (aliases) => aliases.slice(0, 2)],
  ["extra", (aliases) => [...aliases, { ...aliases[0], aliasId: "legacy-v1:extra" }]],
  ["duplicate alias", (aliases) => [aliases[0], aliases[1], aliases[0]]],
  [
    "duplicate direction mapping",
    (aliases) => [
      aliases[0],
      aliases[1],
      { ...aliases[2], coordinatedDirectionId: "premium-editorial" },
    ],
  ],
  ["wrong order", (aliases) => [aliases[1], aliases[0], aliases[2]]],
];

describe("P10B-19A-09A exact legacy-v1 alias vocabulary", () => {
  it("registers only the exact ordered aliases and one-to-one current mappings", () => {
    expect(legacyV1CoordinatedDirectionReplayAliasIds).toStrictEqual(
      expectedMappings.map(([aliasId]) => aliasId),
    );
    expect(
      legacyV1CoordinatedDirectionReplayAliasRegistry.aliases.map(
        ({ aliasId, coordinatedDirectionId }) => [aliasId, coordinatedDirectionId],
      ),
    ).toStrictEqual(expectedMappings);
    expect(new Set(legacyV1CoordinatedDirectionReplayAliasIds)).toHaveLength(3);
    expect(
      new Set(
        legacyV1CoordinatedDirectionReplayAliasRegistry.aliases.map(
          ({ coordinatedDirectionId }) => coordinatedDirectionId,
        ),
      ),
    ).toHaveLength(3);
  });

  it.each([
    "legacy-v1:editorial",
    "LEGACY-V1:PREMIUM-EDITORIAL",
    " legacy-v1:premium-editorial",
    "legacy-v1:premium-editorial ",
    "legacy-v1:*",
    "editorial-offset",
    "premium-editorial",
    "",
  ])("rejects noncanonical alias %j without normalization or fallback", (aliasId) => {
    expect(legacyV1CoordinatedDirectionReplayAliasIdSchema.safeParse(aliasId).success).toBe(false);
    expectLegacyError(() => resolveLegacyV1ReplayAlias(aliasId), "unknown-legacy-v1-alias");
  });

  it("exposes exactly the bounded six-code error authority", () => {
    expect(legacyV1ReplayAuthorityErrorCodes).toStrictEqual([
      "unknown-legacy-v1-alias",
      "invalid-legacy-v1-alias-registry",
      "stale-legacy-v1-direction-authority",
      "legacy-v1-alias-direction-mismatch",
      "invalid-legacy-v1-selection",
      "stale-legacy-v1-replay-reference",
    ]);
    const error = expectLegacyError(
      () => resolveLegacyV1ReplayAlias({ merchantId: "must-not-leak" }),
      "unknown-legacy-v1-alias",
    );
    expect(error.message).not.toContain("must-not-leak");
    expect(error.safeIdentifiers).toStrictEqual([]);
  });
});

describe("P10B-19A-09A current direction binding and alias fingerprints", () => {
  it("resolves all three current packages with imported version and exact current fingerprints", () => {
    expect(COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION).toBe("1.1.0");
    expect(listCoordinatedStorefrontDirections().map(({ id }) => id)).toStrictEqual(
      expectedMappings.map(([, directionId]) => directionId),
    );
    expectedMappings.forEach(([aliasId, directionId]) => {
      const alias = createLegacyV1CoordinatedDirectionReplayAlias(aliasId);
      expect(alias).toMatchObject({
        aliasSchemaVersion: LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_SCHEMA_VERSION,
        authorityKind: LEGACY_V1_COORDINATED_DIRECTION_REPLAY_AUTHORITY_KIND,
        aliasId,
        coordinatedDirectionId: directionId,
        coordinatedDirectionAuthorityVersion: COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
        coordinatedDirectionAuthorityFingerprint: expectedDirectionFingerprints[directionId],
      });
      expect(alias.aliasFingerprint).toBe(aliasFingerprint(alias));
      expect(alias.aliasFingerprint).toMatch(
        /^legacy-v1-direction-alias-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
      );
      expect(deepFrozen(alias)).toBe(true);
    });
  });

  it("creates deterministic alias records and makes alias identity fingerprint-significant", () => {
    const aliases = expectedMappings.map(([aliasId]) =>
      createLegacyV1CoordinatedDirectionReplayAlias(aliasId),
    );
    expectedMappings.forEach(([aliasId], index) => {
      expect(createLegacyV1CoordinatedDirectionReplayAlias(aliasId)).toStrictEqual(aliases[index]);
    });
    expect(new Set(aliases.map(({ aliasFingerprint }) => aliasFingerprint))).toHaveLength(3);
  });

  it("strict-parses current aliases and rejects stale or expanded records", () => {
    const current = createLegacyV1CoordinatedDirectionReplayAlias("legacy-v1:premium-editorial");
    expect(parseLegacyV1CoordinatedDirectionReplayAlias(current)).toStrictEqual(current);
    expect(legacyV1CoordinatedDirectionReplayAliasV1Schema.safeParse(current).success).toBe(true);
    expect(deepFrozen(legacyV1CoordinatedDirectionReplayAliasV1Schema.parse(current))).toBe(true);
    expect(
      legacyV1CoordinatedDirectionReplayAliasV1Schema.safeParse({
        ...current,
        label: "Friendly",
      }).success,
    ).toBe(false);
    expectLegacyError(
      () =>
        parseLegacyV1CoordinatedDirectionReplayAlias({
          ...current,
          coordinatedDirectionAuthorityVersion: "1.0.0",
        }),
      "stale-legacy-v1-direction-authority",
    );
    expectLegacyError(
      () =>
        parseLegacyV1CoordinatedDirectionReplayAlias({
          ...current,
          coordinatedDirectionAuthorityFingerprint: staleFingerprint(
            current.coordinatedDirectionAuthorityFingerprint,
          ),
        }),
      "stale-legacy-v1-direction-authority",
    );
    expectLegacyError(
      () =>
        parseLegacyV1CoordinatedDirectionReplayAlias({
          ...current,
          aliasFingerprint: staleFingerprint(current.aliasFingerprint),
        }),
      "invalid-legacy-v1-alias-registry",
    );
    expectLegacyError(
      () =>
        parseLegacyV1CoordinatedDirectionReplayAlias({
          ...current,
          coordinatedDirectionId: "modern-technical",
        }),
      "legacy-v1-alias-direction-mismatch",
    );
    expect(() =>
      parseLegacyV1CoordinatedDirectionReplayAlias({
        ...current,
        coordinatedDirectionId: "wrong-direction",
      }),
    ).toThrow();
  });
});

describe("P10B-19A-09A immutable compatibility alias registry", () => {
  it("exports one exact deeply readonly deterministic populated registry", () => {
    expect(legacyV1CoordinatedDirectionReplayAliasRegistry.registrySchemaVersion).toBe(
      LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_REGISTRY_SCHEMA_VERSION,
    );
    expect(Array.isArray(legacyV1CoordinatedDirectionReplayAliasRegistry.aliases)).toBe(true);
    expect(legacyV1CoordinatedDirectionReplayAliasRegistry.aliases).toHaveLength(3);
    expect(legacyV1CoordinatedDirectionReplayAliasRegistry.registryFingerprint).toMatch(
      /^legacy-v1-direction-alias-registry-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(createLegacyV1CoordinatedDirectionReplayAliasRegistry()).toStrictEqual(
      legacyV1CoordinatedDirectionReplayAliasRegistry,
    );
    expect(
      parseLegacyV1CoordinatedDirectionReplayAliasRegistry(
        legacyV1CoordinatedDirectionReplayAliasRegistry,
      ),
    ).toStrictEqual(legacyV1CoordinatedDirectionReplayAliasRegistry);
    expect(
      legacyV1CoordinatedDirectionReplayAliasRegistryV1Schema.safeParse(
        legacyV1CoordinatedDirectionReplayAliasRegistry,
      ).success,
    ).toBe(true);
    expect(
      deepFrozen(
        legacyV1CoordinatedDirectionReplayAliasRegistryV1Schema.parse(
          legacyV1CoordinatedDirectionReplayAliasRegistry,
        ),
      ),
    ).toBe(true);
    expect(deepFrozen(legacyV1CoordinatedDirectionReplayAliasRegistry)).toBe(true);
  });

  it.each(invalidRegistryAliasCases)("rejects %s registry authority", (_label, mutateAliases) => {
    const registry = structuredClone(legacyV1CoordinatedDirectionReplayAliasRegistry);
    expect(() =>
      parseLegacyV1CoordinatedDirectionReplayAliasRegistry({
        ...registry,
        aliases: mutateAliases(registry.aliases),
      }),
    ).toThrow(LegacyV1ReplayAuthorityError);
  });

  it("rejects stale child, stale registry and unknown registry fields", () => {
    const registry = structuredClone(legacyV1CoordinatedDirectionReplayAliasRegistry);
    expectLegacyError(
      () =>
        parseLegacyV1CoordinatedDirectionReplayAliasRegistry({
          ...registry,
          aliases: [
            {
              ...registry.aliases[0],
              aliasFingerprint: staleFingerprint(registry.aliases[0].aliasFingerprint),
            },
            ...registry.aliases.slice(1),
          ],
        }),
      "invalid-legacy-v1-alias-registry",
    );
    expectLegacyError(
      () =>
        parseLegacyV1CoordinatedDirectionReplayAliasRegistry({
          ...legacyV1CoordinatedDirectionReplayAliasRegistry,
          registryFingerprint: staleFingerprint(
            legacyV1CoordinatedDirectionReplayAliasRegistry.registryFingerprint,
          ),
        }),
      "invalid-legacy-v1-alias-registry",
    );
    expect(
      legacyV1CoordinatedDirectionReplayAliasRegistryV1Schema.safeParse({
        ...legacyV1CoordinatedDirectionReplayAliasRegistry,
        register: () => undefined,
      }).success,
    ).toBe(false);
  });
});

describe("P10B-19A-09A exact replay-reference validation", () => {
  it.each(expectedMappings)("creates a valid immutable replay for %s", (aliasId) => {
    const input = { aliasId, sourceSelection: selectionFor(aliasId) };
    const before = canonicalValueString(input);
    const reference = createLegacyV1StorefrontReplayReference(input);
    expect(canonicalValueString(input)).toBe(before);
    expect(reference).toMatchObject({
      replaySchemaVersion: LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_SCHEMA_VERSION,
      authorityKind: LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_AUTHORITY_KIND,
      aliasId,
      sourceSelection: input.sourceSelection,
    });
    expect(reference.replayFingerprint).toMatch(
      /^legacy-v1-storefront-replay-reference-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
    );
    expect(parseLegacyV1StorefrontReplayReference(reference)).toStrictEqual(reference);
    expect(legacyV1StorefrontReplayReferenceV1Schema.safeParse(reference).success).toBe(true);
    expect(deepFrozen(legacyV1StorefrontReplayReferenceV1Schema.parse(reference))).toBe(true);
    expect(deepFrozen(reference)).toBe(true);
  });

  it.each([
    ["shared frame", { sharedFrameProfileId: "compact-technical" }],
    ["homepage", { homepageProfileId: "homepage-commerce-led-discovery" }],
    ["collection", { collectionProfileId: "collection-catalogue-comparison" }],
    ["search", { searchProfileId: "collection-catalogue-comparison" }],
    ["PDP", { pdpProfileId: "pdp-variant-led" }],
    ["Design DNA direction", { directionId: "modernTechnical" }],
    ["spacing", { designSystemSpacingDensity: "compact", informationDensityPosture: "compact" }],
    ["surface", { designSystemSurfaceDepth: "flat" }],
    ["narrative posture", { narrativePosture: "restrained" }],
    ["merchandising posture", { merchandisingPosture: "dense" }],
    ["density posture", { informationDensityPosture: "compact" }],
    ["art direction posture", { artDirectionPosture: "contained" }],
    ["responsive posture", { responsiveMode: "commerce-first" }],
    [
      "optional page-family composition",
      { includedOptionalPageFamilyIds: ["contact", "cart", "no-results", "error-state"] },
    ],
  ] satisfies readonly (readonly [
    string,
    Partial<BoundedStorefrontSynthesisSelectionNarrowing>,
  ])[])("rejects unsupported %s authority", (_label, override) => {
    expectLegacyError(
      () => referenceFor("legacy-v1:premium-editorial", override),
      "invalid-legacy-v1-selection",
    );
  });

  it("rejects mismatched aliases and malformed or stale direction envelopes", () => {
    expectLegacyError(
      () =>
        createLegacyV1StorefrontReplayReference({
          aliasId: "legacy-v1:premium-editorial",
          sourceSelection: selectionFor("legacy-v1:modern-technical"),
        }),
      "legacy-v1-alias-direction-mismatch",
    );
    expectLegacyError(
      () =>
        referenceFor("legacy-v1:premium-editorial", {
          authorityId: "malformed-direction-authority",
        }),
      "stale-legacy-v1-direction-authority",
    );
    expectLegacyError(
      () =>
        referenceFor("legacy-v1:premium-editorial", {
          authorityVersion: "1.0.0",
        }),
      "stale-legacy-v1-direction-authority",
    );
    expectLegacyError(
      () =>
        referenceFor("legacy-v1:premium-editorial", {
          authorityFingerprint: "coordinated-direction-stale",
        }),
      "stale-legacy-v1-direction-authority",
    );
  });

  it("rejects unknown selection and replay fields without discarding them", () => {
    const selection = selectionFor("legacy-v1:premium-editorial");
    expectLegacyError(
      () =>
        createLegacyV1StorefrontReplayReference({
          aliasId: "legacy-v1:premium-editorial",
          sourceSelection: { ...selection, snapshotId: "not-authority" },
        }),
      "invalid-legacy-v1-selection",
    );
    const reference = referenceFor("legacy-v1:premium-editorial");
    expectLegacyError(
      () => parseLegacyV1StorefrontReplayReference({ ...reference, selected: true }),
      "stale-legacy-v1-replay-reference",
    );
  });
});

describe("P10B-19A-09A executable replay fingerprint identity", () => {
  it("is deterministic, retains selectionId, and excludes only that incidental ID", () => {
    const first = referenceFor("legacy-v1:premium-editorial", { selectionId: "selection-one" });
    const second = referenceFor("legacy-v1:premium-editorial", { selectionId: "selection-two" });
    expect(first.sourceSelection.selectionId).toBe("selection-one");
    expect(second.sourceSelection.selectionId).toBe("selection-two");
    expect(second.replayFingerprint).toBe(first.replayFingerprint);
    expect(referenceFor("legacy-v1:premium-editorial")).toStrictEqual(
      referenceFor("legacy-v1:premium-editorial"),
    );
  });

  it.each([
    ["shared frame", "legacy-v1:premium-editorial", { sharedFrameProfileId: "centered-minimal" }],
    [
      "homepage profile",
      "legacy-v1:premium-editorial",
      { homepageProfileId: "homepage-campaign-led" },
    ],
    [
      "collection profile",
      "legacy-v1:premium-editorial",
      { collectionProfileId: "collection-campaign-led-discovery" },
    ],
    [
      "search profile",
      "legacy-v1:modern-technical",
      { searchProfileId: "collection-catalogue-comparison" },
    ],
    ["PDP profile", "legacy-v1:premium-editorial", { pdpProfileId: "pdp-gallery-led" }],
    [
      "spacing and canonical density",
      "legacy-v1:premium-editorial",
      { designSystemSpacingDensity: "spacious", informationDensityPosture: "airy" },
    ],
    ["narrative posture", "legacy-v1:premium-editorial", { narrativePosture: "campaign-led" }],
    ["merchandising posture", "legacy-v1:premium-editorial", { merchandisingPosture: "campaign" }],
    ["art direction posture", "legacy-v1:premium-editorial", { artDirectionPosture: "immersive" }],
    ["responsive posture", "legacy-v1:premium-editorial", { responsiveMode: "balanced" }],
    [
      "optional page-family composition",
      "legacy-v1:premium-editorial",
      {
        includedOptionalPageFamilyIds: [
          "about",
          "shipping-information",
          "returns-information",
          "not-found",
        ],
      },
    ],
  ] satisfies readonly (readonly [
    string,
    LegacyV1CoordinatedDirectionReplayAliasId,
    Partial<BoundedStorefrontSynthesisSelectionNarrowing>,
  ])[])("changes when valid executable %s changes", (_label, aliasId, override) => {
    expect(referenceFor(aliasId, override).replayFingerprint).not.toBe(
      referenceFor(aliasId).replayFingerprint,
    );
  });

  it("changes across valid Design DNA and surface authorities", () => {
    const premium = referenceFor("legacy-v1:premium-editorial");
    const technical = referenceFor("legacy-v1:modern-technical");
    expect(premium.sourceSelection.directionId).not.toBe(technical.sourceSelection.directionId);
    expect(premium.sourceSelection.designSystemSurfaceDepth).not.toBe(
      technical.sourceSelection.designSystemSurfaceDepth,
    );
    expect(premium.replayFingerprint).not.toBe(technical.replayFingerprint);
  });

  it("treats exact optional composition order as executable current authority", () => {
    const reference = referenceFor("legacy-v1:premium-editorial");
    const reversed = [...reference.sourceSelection.includedOptionalPageFamilyIds].reverse();
    expectLegacyError(
      () =>
        referenceFor("legacy-v1:premium-editorial", {
          includedOptionalPageFamilyIds: reversed,
        }),
      "invalid-legacy-v1-selection",
    );
  });

  it("rejects a stale supplied replay fingerprint without repair", () => {
    const reference = referenceFor("legacy-v1:minimal-commerce");
    expectLegacyError(
      () =>
        parseLegacyV1StorefrontReplayReference({
          ...reference,
          replayFingerprint: staleFingerprint(reference.replayFingerprint),
        }),
      "stale-legacy-v1-replay-reference",
    );
  });
});

describe("P10B-19A-09A no-inference, no-v2 and runtime isolation boundaries", () => {
  it("keeps current direction, narrowing, execution and barrel source authority byte-identical", () => {
    const authorityRoot = resolve(process.cwd(), "src/application/bounded-storefront-synthesis");
    Object.entries(expectedProtectedV1SourceHashes).forEach(([name, expected]) => {
      expect(
        createHash("sha256")
          .update(readFileSync(join(authorityRoot, name)))
          .digest("hex"),
      ).toBe(expected);
    });
  });

  it.each([
    { snapshot: { pages: [] } },
    { profiles: ["homepage-editorial-storytelling"] },
    { normalizedTopologyFingerprint: "topology-only" },
    { palette: { primary: "#000000" }, typography: "serif" },
  ])("rejects non-selection replay input %#", (sourceSelection) => {
    expectLegacyError(
      () =>
        createLegacyV1StorefrontReplayReference({
          aliasId: "legacy-v1:premium-editorial",
          sourceSelection,
        }),
      "invalid-legacy-v1-selection",
    );
  });

  it("reuses the existing strict narrowing, validator and exact projection", () => {
    const path = resolve(
      process.cwd(),
      "src/application/bounded-storefront-synthesis/legacy-v1-replay-authority.ts",
    );
    const source = readFileSync(path, "utf8");
    expect(source).toContain("boundedStorefrontSynthesisSelectionNarrowingSchema.safeParse");
    expect(source).toContain("validateDirectionSelectionNarrowing(sourceSelection)");
    expect(source).toContain(
      "boundedStorefrontSynthesisExactSelectionSchema.parse(executableSelection)",
    );
    expect(source).not.toMatch(/nearest|fallbackAlias|defaultAlias/iu);
  });

  it("emits no false v2, snapshot, migration, render or publication authority", () => {
    const authority = {
      aliases: legacyV1CoordinatedDirectionReplayAliasRegistry.aliases,
      reference: referenceFor("legacy-v1:premium-editorial"),
    };
    const forbiddenKeys = [
      "structuralFamilyId",
      "structuralFamilyVersion",
      "pageBlueprintV2CandidateId",
      "normalizedTopologyFingerprint",
      "compatibilityProfile",
      "selectionRequest",
      "selectionReceipt",
      "visualRecipeId",
      "designDnaV2",
      "snapshot",
      "snapshotId",
      "migrationResult",
      "renderResult",
      "publicationResult",
    ];
    const serialized = canonicalValueString(authority);
    forbiddenKeys.forEach((key) => expect(serialized).not.toContain(`"${key}"`));
    expect(
      inactiveStructuralStorefrontFamilyCandidateRegistry.pageBlueprintCandidates,
    ).toHaveLength(0);
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates).toHaveLength(0);
    expect(inactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue.profiles).toHaveLength(
      0,
    );
  });

  it("has no current production consumer and is absent from the client-reachable barrel", () => {
    const repositoryRoot = resolve(process.cwd());
    const modulePath = "src/application/bounded-storefront-synthesis/legacy-v1-replay-authority.ts";
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path: relative(repositoryRoot, path), source: readFileSync(path, "utf8") }))
      .filter(({ path }) => path !== modulePath)
      .filter(({ source }) =>
        /legacy-v1-replay-authority|legacyV1CoordinatedDirectionReplayAliasRegistry|createLegacyV1StorefrontReplayReference/u.test(
          source,
        ),
      )
      .map(({ path }) => path);
    expect(consumers).toStrictEqual([]);
    expect(
      readFileSync(
        resolve(repositoryRoot, "src/application/bounded-storefront-synthesis/index.ts"),
        "utf8",
      ),
    ).not.toContain("legacy-v1-replay-authority");
  });
});
