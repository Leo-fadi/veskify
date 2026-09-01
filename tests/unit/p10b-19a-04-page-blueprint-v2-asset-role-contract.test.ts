import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ZodError } from "zod";
import { describe, expect, it } from "vitest";
import * as storefrontTemplateAuthority from "@/application/storefront-templates";
import {
  MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY,
  MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION,
  MAX_PAGE_BLUEPRINT_V2_REGION_ASSET_REQUIREMENTS,
  PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
  canonicalizePageBlueprintV2AssetRoleCompatibilityContract,
  listExecutablePageBlueprintProfiles,
  pageBlueprintV2AssetRoleCompatibilityContractV1Schema,
  pageBlueprintV2AssetRoleRequirementSchema,
  pageBlueprintV2RegionAssetRequirementsSchema,
} from "@/application/storefront-templates";
import { assetRoleSchema, assetRoleValues, type AssetRole } from "@/domain/shared";

const expectedAssetRoles = [
  "logo",
  "heroDesktop",
  "heroMobile",
  "collectionImage",
  "productMainImage",
  "productAlternativeImage",
  "editorialImage",
  "supportingContentImage",
  "iconDecorative",
] as const;

function structuralFixture() {
  return {
    id: "home-asset-structure",
    version: "1.0.0",
    pageFamilyId: "home",
    regions: [
      {
        id: "discovery-region",
        role: "primary-discovery",
        requirement: "required",
        cardinality: { minimum: 1, ideal: 1, maximum: 2 },
        visualWeight: "heavy",
      },
      {
        id: "orientation-region",
        role: "orientation",
        requirement: "required",
        cardinality: { minimum: 1, ideal: 1, maximum: 2 },
        visualWeight: "medium",
      },
      {
        id: "story-region",
        role: "brand-story",
        requirement: "optional",
        cardinality: { minimum: 0, ideal: 1, maximum: 2 },
        visualWeight: "light",
      },
    ],
    relationships: [],
    orderAlternatives: [
      {
        id: "default-reading-order",
        regionIds: ["orientation-region", "story-region", "discovery-region"],
      },
      {
        id: "alternate-reading-order",
        regionIds: ["orientation-region", "discovery-region", "story-region"],
      },
    ],
    defaultOrderAlternativeId: "default-reading-order",
  };
}

function requiredRole(role: AssetRole, cardinality = { minimum: 1, ideal: 1, maximum: 1 }) {
  return { role, requirement: "required", cardinality };
}

function optionalRole(role: AssetRole, cardinality = { minimum: 0, ideal: 1, maximum: 1 }) {
  return { role, requirement: "optional", cardinality };
}

function compatibilityFixture(
  regionAssetRequirements: readonly unknown[] = [
    {
      regionId: "orientation-region",
      roleRequirements: [requiredRole("logo")],
    },
  ],
) {
  return {
    contractSchemaVersion: PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
    blueprintId: "home-asset-structure",
    blueprintVersion: "1.0.0",
    regionAssetRequirements,
  };
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((entry) => deepFrozen(entry, seen));
}

function issueMessages(structuralInput: unknown, compatibilityInput: unknown): readonly string[] {
  try {
    canonicalizePageBlueprintV2AssetRoleCompatibilityContract(structuralInput, compatibilityInput);
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map(({ message }) => message);
    throw error;
  }
  throw new Error("Expected compatibility validation to fail.");
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

describe("P10B-19A-04 canonical AssetRole authority", () => {
  it("preserves and exposes the exact frozen nine-role order", () => {
    expect(assetRoleValues).toStrictEqual(expectedAssetRoles);
    expect(assetRoleSchema.options).toStrictEqual(expectedAssetRoles);
    expect(Object.isFrozen(assetRoleValues)).toBe(true);
    expect(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION).toBe(
      expectedAssetRoles.length,
    );

    const typedRole: AssetRole = assetRoleValues[0];
    expect(typedRole).toBe("logo");
    for (const role of expectedAssetRoles) {
      expect(assetRoleSchema.parse(role)).toBe(role);
    }
  });

  it.each(["unknown", "HeroDesktop", " heroDesktop ", "hero-desktop", "fallback"])(
    "rejects unknown, normalized, aliased or fallback role %s",
    (role) => {
      expect(assetRoleSchema.safeParse(role).success).toBe(false);
    },
  );

  it("derives role validation from the canonical owner instead of duplicating role literals", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/application/storefront-templates/page-blueprint-v2-asset-role-contract.ts",
      ),
      "utf8",
    );
    expect(source).toContain(
      'import { assetRoleSchema, assetRoleValues, type AssetRole } from "@/domain/shared/asset-role"',
    );
    expectedAssetRoles.forEach((role) => expect(source).not.toContain(`"${role}"`));
  });
});

describe("P10B-19A-04 contract version and structural identity", () => {
  it("keeps the compatibility version distinct and accepts exact bound identity", () => {
    expect(PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(MAX_PAGE_BLUEPRINT_V2_REGION_ASSET_REQUIREMENTS).toBe(32);
    expect(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY).toBe(32);

    const parsed = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structuralFixture(),
      compatibilityFixture(),
    );
    expect(parsed).toMatchObject({
      contractSchemaVersion: "1.0.0",
      blueprintId: "home-asset-structure",
      blueprintVersion: "1.0.0",
    });
  });

  it.each([
    ["missing version", { contractSchemaVersion: undefined }],
    ["malformed version", { contractSchemaVersion: "v1" }],
    ["unsupported version", { contractSchemaVersion: "2.0.0" }],
    ["missing blueprint ID", { blueprintId: undefined }],
    ["missing blueprint version", { blueprintVersion: undefined }],
    ["unknown top-level field", { metadata: {} }],
  ])("fails closed for %s", (_label, replacement) => {
    const input = { ...compatibilityFixture(), ...replacement };
    expect(pageBlueprintV2AssetRoleCompatibilityContractV1Schema.safeParse(input).success).toBe(
      false,
    );
  });

  it.each([
    ["blueprint ID", { blueprintId: "other-blueprint" }],
    ["blueprint version", { blueprintVersion: "1.0.1" }],
  ])("rejects exact %s mismatch", (_label, replacement) => {
    expect(() =>
      canonicalizePageBlueprintV2AssetRoleCompatibilityContract(structuralFixture(), {
        ...compatibilityFixture(),
        ...replacement,
      }),
    ).toThrow();
  });

  it("validates the structural authority first and never repairs it", () => {
    const invalidStructural = {
      ...structuralFixture(),
      regions: structuralFixture().regions.map((region) => ({
        ...region,
        id: "duplicate-region",
      })),
    };
    expect(() =>
      canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
        invalidStructural,
        compatibilityFixture([]),
      ),
    ).toThrow(/Duplicate region IDs/u);
  });
});

describe("P10B-19A-04 region and role requirement integrity", () => {
  it("accepts an explicit empty declaration as no asset-role authority", () => {
    const parsed = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structuralFixture(),
      compatibilityFixture([]),
    );
    expect(parsed).toStrictEqual({
      contractSchemaVersion: "1.0.0",
      blueprintId: "home-asset-structure",
      blueprintVersion: "1.0.0",
      regionAssetRequirements: [],
    });
    expect(Object.keys(parsed)).toStrictEqual([
      "contractSchemaVersion",
      "blueprintId",
      "blueprintVersion",
      "regionAssetRequirements",
    ]);
  });

  it("accepts single and multiple known regions while leaving absent regions undeclared", () => {
    const parsed = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structuralFixture(),
      compatibilityFixture([
        {
          regionId: "discovery-region",
          roleRequirements: [requiredRole("collectionImage")],
        },
        {
          regionId: "orientation-region",
          roleRequirements: [optionalRole("logo")],
        },
      ]),
    );
    expect(parsed.regionAssetRequirements.map(({ regionId }) => regionId)).toStrictEqual([
      "orientation-region",
      "discovery-region",
    ]);
    expect(parsed.regionAssetRequirements.some(({ regionId }) => regionId === "story-region")).toBe(
      false,
    );
  });

  it("accepts all nine canonical roles in one declared region", () => {
    const parsed = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structuralFixture(),
      compatibilityFixture([
        {
          regionId: "orientation-region",
          roleRequirements: [...expectedAssetRoles].reverse().map((role) => requiredRole(role)),
        },
      ]),
    );
    expect(
      parsed.regionAssetRequirements[0]?.roleRequirements.map(({ role }) => role),
    ).toStrictEqual(expectedAssetRoles);
  });

  it("preserves conditional required-role semantics on an optional structural region", () => {
    const structural = structuralFixture();
    const before = clone(structural);
    const parsed = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structural,
      compatibilityFixture([
        {
          regionId: "story-region",
          roleRequirements: [requiredRole("editorialImage", { minimum: 1, ideal: 2, maximum: 3 })],
        },
      ]),
    );
    expect(parsed.regionAssetRequirements[0]).toMatchObject({
      regionId: "story-region",
      roleRequirements: [
        {
          role: "editorialImage",
          requirement: "required",
          cardinality: { minimum: 1, ideal: 2, maximum: 3 },
        },
      ],
    });
    expect(structural).toStrictEqual(before);
    expect(structural.regions.find(({ id }) => id === "story-region")?.requirement).toBe(
      "optional",
    );
  });

  it("rejects unknown regions without silently removing them", () => {
    expect(() =>
      canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
        structuralFixture(),
        compatibilityFixture([
          {
            regionId: "foreign-region",
            roleRequirements: [requiredRole("logo")],
          },
        ]),
      ),
    ).toThrow(/unknown structural regions/u);
  });

  it("rejects empty role requirements and unknown nested fields", () => {
    expect(
      pageBlueprintV2RegionAssetRequirementsSchema.safeParse({
        regionId: "orientation-region",
        roleRequirements: [],
      }).success,
    ).toBe(false);
    expect(
      pageBlueprintV2RegionAssetRequirementsSchema.safeParse({
        regionId: "orientation-region",
        roleRequirements: [requiredRole("logo")],
        componentId: "forbidden",
      }).success,
    ).toBe(false);
    expect(
      pageBlueprintV2AssetRoleRequirementSchema.safeParse({
        ...requiredRole("logo"),
        assetId: "forbidden",
      }).success,
    ).toBe(false);
    expect(
      pageBlueprintV2AssetRoleRequirementSchema.safeParse({
        ...requiredRole("logo"),
        cardinality: { minimum: 1, ideal: 1, maximum: 1, fallback: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("P10B-19A-04 cardinality authority", () => {
  it.each([
    [
      "required minimum zero",
      { role: "logo", requirement: "required", cardinality: { minimum: 0, ideal: 1, maximum: 1 } },
    ],
    [
      "optional positive minimum",
      { role: "logo", requirement: "optional", cardinality: { minimum: 1, ideal: 1, maximum: 1 } },
    ],
    [
      "minimum above ideal",
      { role: "logo", requirement: "required", cardinality: { minimum: 2, ideal: 1, maximum: 2 } },
    ],
    [
      "ideal above maximum",
      { role: "logo", requirement: "required", cardinality: { minimum: 1, ideal: 3, maximum: 2 } },
    ],
    [
      "maximum above 32",
      { role: "logo", requirement: "required", cardinality: { minimum: 1, ideal: 1, maximum: 33 } },
    ],
    [
      "fractional minimum",
      {
        role: "logo",
        requirement: "required",
        cardinality: { minimum: 1.5, ideal: 2, maximum: 2 },
      },
    ],
    [
      "negative ideal",
      { role: "logo", requirement: "optional", cardinality: { minimum: 0, ideal: -1, maximum: 1 } },
    ],
    [
      "non-positive maximum",
      { role: "logo", requirement: "optional", cardinality: { minimum: 0, ideal: 0, maximum: 0 } },
    ],
  ])("rejects %s without correction", (_label, value) => {
    expect(pageBlueprintV2AssetRoleRequirementSchema.safeParse(value).success).toBe(false);
  });

  it("accepts exact bounds and preserves numeric values", () => {
    const required = pageBlueprintV2AssetRoleRequirementSchema.parse(
      requiredRole("heroDesktop", { minimum: 1, ideal: 16, maximum: 32 }),
    );
    const optional = pageBlueprintV2AssetRoleRequirementSchema.parse(
      optionalRole("heroMobile", { minimum: 0, ideal: 0, maximum: 32 }),
    );
    expect(required.cardinality).toStrictEqual({ minimum: 1, ideal: 16, maximum: 32 });
    expect(optional.cardinality).toStrictEqual({ minimum: 0, ideal: 0, maximum: 32 });
  });
});

describe("P10B-19A-04 duplicate rejection and canonicalization", () => {
  it("rejects duplicate regions with stable structural-order evidence", () => {
    const entries = [
      { regionId: "story-region", roleRequirements: [requiredRole("editorialImage")] },
      { regionId: "orientation-region", roleRequirements: [requiredRole("logo")] },
      { regionId: "story-region", roleRequirements: [requiredRole("heroDesktop")] },
      { regionId: "orientation-region", roleRequirements: [requiredRole("heroMobile")] },
    ];
    const first = issueMessages(structuralFixture(), compatibilityFixture(entries));
    const second = issueMessages(structuralFixture(), compatibilityFixture([...entries].reverse()));
    expect(first).toStrictEqual(second);
    expect(first.join(" ")).toContain(
      "Duplicate asset-role compatibility region IDs: orientation-region, story-region.",
    );
    expect(first.join(" ")).not.toContain('{"');
  });

  it("rejects duplicate roles with stable region and canonical-role evidence", () => {
    const entries = [
      {
        regionId: "story-region",
        roleRequirements: [requiredRole("collectionImage"), requiredRole("collectionImage")],
      },
      {
        regionId: "orientation-region",
        roleRequirements: [
          requiredRole("heroDesktop"),
          requiredRole("logo"),
          requiredRole("heroDesktop"),
          requiredRole("logo"),
        ],
      },
    ];
    const first = issueMessages(structuralFixture(), compatibilityFixture(entries));
    const second = issueMessages(
      structuralFixture(),
      compatibilityFixture(
        [...entries]
          .reverse()
          .map((entry) => ({ ...entry, roleRequirements: [...entry.roleRequirements].reverse() })),
      ),
    );
    expect(first).toStrictEqual(second);
    expect(first.join(" ")).toContain(
      "orientation-region=[logo, heroDesktop]; story-region=[collectionImage]",
    );
  });

  it("canonicalizes equivalent permutations identically without mutating input", () => {
    const regionRequirements = [
      {
        regionId: "discovery-region",
        roleRequirements: [
          requiredRole("productAlternativeImage"),
          requiredRole("collectionImage"),
        ],
      },
      {
        regionId: "story-region",
        roleRequirements: [optionalRole("iconDecorative"), requiredRole("editorialImage")],
      },
      {
        regionId: "orientation-region",
        roleRequirements: [
          requiredRole("productMainImage"),
          optionalRole("heroDesktop"),
          requiredRole("logo"),
        ],
      },
    ];
    const structural = structuralFixture();
    const firstInput = compatibilityFixture(regionRequirements);
    const secondInput = compatibilityFixture(
      [...regionRequirements]
        .reverse()
        .map((entry) => ({ ...entry, roleRequirements: [...entry.roleRequirements].reverse() })),
    );
    const structuralBefore = clone(structural);
    const firstBefore = clone(firstInput);
    const secondBefore = clone(secondInput);

    const first = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(structural, firstInput);
    const second = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
      structural,
      secondInput,
    );

    expect(first).toStrictEqual(second);
    expect(first.regionAssetRequirements.map(({ regionId }) => regionId)).toStrictEqual([
      "orientation-region",
      "story-region",
      "discovery-region",
    ]);
    expect(
      first.regionAssetRequirements[0]?.roleRequirements.map(({ role }) => role),
    ).toStrictEqual(["logo", "heroDesktop", "productMainImage"]);
    expect(first).not.toHaveProperty("fingerprint");
    expect(deepFrozen(first)).toBe(true);
    expect(structural).toStrictEqual(structuralBefore);
    expect(firstInput).toStrictEqual(firstBefore);
    expect(secondInput).toStrictEqual(secondBefore);
  });
});

describe("P10B-19A-04 forbidden authority and zero reachability", () => {
  it.each([
    "assetId",
    "assetIds",
    "assetRef",
    "assetRevision",
    "revision",
    "sourceOwnerId",
    "provenanceKind",
    "approvalStatus",
    "materialFingerprint",
    "fingerprint",
    "url",
    "src",
    "alt",
    "width",
    "height",
    "mimeType",
    "crop",
    "focalPoint",
    "safeArea",
    "ratio",
    "overlay",
    "derivative",
    "derivatives",
    "responsiveSource",
    "responsiveSources",
    "breakpoint",
    "component",
    "componentId",
    "componentFamily",
    "variant",
    "anatomy",
    "assetSlotId",
    "pageId",
    "route",
    "slug",
    "productId",
    "collectionId",
    "commerce",
    "media",
    "palette",
    "font",
    "css",
    "html",
    "evidenceRequirement",
    "availability",
    "availableCount",
    "reuse",
    "omission",
    "omitWhen",
    "substitution",
    "fallback",
    "placeholder",
    "providerPayload",
    "visualRecipe",
    "normalizedTopology",
    "migrationAlias",
  ])("rejects foreign root authority %s", (field) => {
    expect(
      pageBlueprintV2AssetRoleCompatibilityContractV1Schema.safeParse({
        ...compatibilityFixture(),
        [field]: "forbidden",
      }).success,
    ).toBe(false);
  });

  it("exports schemas and helpers but no contract instance or default record", () => {
    const records = Object.entries(storefrontTemplateAuthority).filter(
      ([, value]) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "contractSchemaVersion") &&
        Object.hasOwn(value, "regionAssetRequirements"),
    );
    expect(records).toStrictEqual([]);
    expect(
      Object.keys(storefrontTemplateAuthority).filter((name) =>
        /default.*assetrole|assetrole.*registry|assetrole.*record/iu.test(name),
      ),
    ).toStrictEqual([]);
    expect(listExecutablePageBlueprintProfiles()).toHaveLength(53);
  });

  it("keeps the companion unreachable from current production consumers", () => {
    const repositoryRoot = resolve(process.cwd());
    const allowedAuthorityFiles = new Set([
      "src/domain/shared/asset-role.ts",
      "src/application/storefront-templates/page-blueprint-v2-asset-role-contract.ts",
      "src/application/storefront-templates/index.ts",
    ]);
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) =>
        /assetRoleValues|page-blueprint-v2-asset-role-contract|PageBlueprintV2AssetRole|PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY/u.test(
          source,
        ),
      )
      .map(({ path }) => relative(repositoryRoot, path))
      .filter((path) => !allowedAuthorityFiles.has(path));
    expect(consumers).toStrictEqual([]);

    [
      "src/application/storefront-templates/registry.ts",
      "src/application/storefront-templates/resolver.ts",
      "src/application/storefront-templates/profile-materializer.ts",
      "src/application/storefront-templates/materializer.ts",
      "src/application/whole-storefront-generation-plan/planner.ts",
      "src/domain/storefront/storefront.ts",
    ].forEach((path) => {
      expect(readFileSync(resolve(repositoryRoot, path), "utf8")).not.toMatch(
        /page-blueprint-v2-asset-role-contract|PageBlueprintV2AssetRole|PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY/u,
      );
    });
  });

  it("keeps A-03 structural, dispatch and registered v1 authority byte-identical", () => {
    const repositoryRoot = resolve(process.cwd());
    expect(
      createHash("sha256")
        .update(
          readFileSync(
            resolve(
              repositoryRoot,
              "src/application/storefront-templates/page-blueprint-v2-contract.ts",
            ),
          ),
        )
        .digest("hex"),
    ).toBe("4a050629af7b792e59b54c229891020cde65fffc793ae88c9049b2a3e143da69");
    expect(
      createHash("sha256")
        .update(
          readFileSync(
            resolve(
              repositoryRoot,
              "src/application/storefront-templates/page-blueprint-version-dispatch.ts",
            ),
          ),
        )
        .digest("hex"),
    ).toBe("56a72d7dc001249b64b355991cdf04cc441149a6c7d0e248d64993d29afc9331");

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
