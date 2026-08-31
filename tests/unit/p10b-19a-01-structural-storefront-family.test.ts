import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as familyAuthority from "@/domain/structural-storefront-family";
import {
  DuplicateStructuralStorefrontFamilyIdentityError,
  STRUCTURAL_STOREFRONT_FAMILY_CONTRACT_SCHEMA_VERSION,
  STRUCTURAL_STOREFRONT_FAMILY_INITIAL_LIFECYCLE_STATE,
  STRUCTURAL_STOREFRONT_FAMILY_INITIAL_RECORD_VERSION,
  STRUCTURAL_STOREFRONT_FAMILY_SUPPORTED_MAJOR_VERSION,
  assertUniqueStructuralStorefrontFamilyIdentities,
  isStructuralStorefrontFamilyId,
  isStructuralStorefrontFamilySelectable,
  resolveStructuralStorefrontFamilyLifecycleTransition,
  structuralStorefrontFamilyIdSchema,
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontFamilyIdentityV1Schema,
  structuralStorefrontFamilyIds,
  structuralStorefrontFamilyLifecycleStateSchema,
  structuralStorefrontFamilyLifecycleStates,
  structuralStorefrontFamilyLifecycleTransitionPolicies,
  structuralStorefrontFamilyVersionSchema,
  type StructuralStorefrontFamilyId,
} from "@/domain/structural-storefront-family";

const identity = {
  familyId: "editorial-offset" as const,
  familyVersion: "1.0.0",
};

const subject = (
  lifecycleState: "candidate" | "active" | "deprecated",
  overrides: Partial<{
    familyId: StructuralStorefrontFamilyId;
    familyVersion: string;
  }> = {},
) => ({ ...identity, ...overrides, lifecycleState });

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [path] : [];
  });

describe("P10B-19A-01 Structural Storefront Family identity", () => {
  it("owns exactly the canonical six-ID vocabulary in stable order", () => {
    expect(structuralStorefrontFamilyIds).toEqual([
      "editorial-offset",
      "campaign-modular",
      "product-first-commerce",
      "technical-comparison",
      "warm-narrative",
      "restrained-gallery",
    ]);
    expect(Object.isFrozen(structuralStorefrontFamilyIds)).toBe(true);
    for (const familyId of structuralStorefrontFamilyIds) {
      expect(structuralStorefrontFamilyIdSchema.parse(familyId)).toBe(familyId);
      expect(isStructuralStorefrontFamilyId(familyId)).toBe(true);
    }
  });

  it.each([
    "unknown-family",
    "Editorial-offset",
    "editorial-offset ",
    " editorial-offset",
    "editorial_offset",
    "premium-editorial",
    "default",
  ])("rejects invalid or legacy family ID %s without normalization or fallback", (familyId) => {
    expect(structuralStorefrontFamilyIdSchema.safeParse(familyId).success).toBe(false);
    expect(isStructuralStorefrontFamilyId(familyId)).toBe(false);
  });

  it("defines the distinct v1 contract-schema and initial record versions", () => {
    expect(STRUCTURAL_STOREFRONT_FAMILY_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(STRUCTURAL_STOREFRONT_FAMILY_INITIAL_RECORD_VERSION).toBe("1.0.0");
    expect(STRUCTURAL_STOREFRONT_FAMILY_SUPPORTED_MAJOR_VERSION).toBe(1);
  });

  it.each(["1.0.0", "1.4.27", "1.999999.0"])(
    "accepts canonical supported-major-v1 version %s",
    (version) => {
      expect(structuralStorefrontFamilyVersionSchema.parse(version)).toBe(version);
    },
  );

  it.each([
    "v1.0.0",
    "1",
    "1.0",
    "01.0.0",
    "1.00.0",
    "1.0.00",
    "1.0.0-alpha",
    "1.0.0+build",
    " 1.0.0",
    "1.0.0 ",
    "0.0.0",
    "2.0.0",
    "-1.0.0",
  ])("rejects malformed or unsupported version %s", (version) => {
    expect(structuralStorefrontFamilyVersionSchema.safeParse(version).success).toBe(false);
  });

  it("parses one strict readonly identity and derives only its exact ID/version key", () => {
    const parsed = structuralStorefrontFamilyIdentityV1Schema.parse(identity);
    expect(parsed).toEqual(identity);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(structuralStorefrontFamilyIdentityKey(parsed)).toBe("editorial-offset@1.0.0");
    expect(structuralStorefrontFamilyIdentityKey({ ...identity })).toBe(
      structuralStorefrontFamilyIdentityKey(identity),
    );
    expect(
      structuralStorefrontFamilyIdentityV1Schema.safeParse({
        ...identity,
        lifecycleState: "candidate",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate identity keys with deterministic bounded evidence", () => {
    const duplicateA = { familyId: "editorial-offset", familyVersion: "1.0.0" };
    const duplicateB = { ...duplicateA };
    const messages = [
      [duplicateA, duplicateB],
      [duplicateB, duplicateA],
    ].map((values) => {
      try {
        assertUniqueStructuralStorefrontFamilyIdentities(values);
        throw new Error("Expected duplicate identities to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(DuplicateStructuralStorefrontFamilyIdentityError);
        return (error as DuplicateStructuralStorefrontFamilyIdentityError).message;
      }
    });
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toContain("editorial-offset@1.0.0");
  });

  it("permits the same ID at distinct v1 versions and distinct IDs at one version", () => {
    const parsed = assertUniqueStructuralStorefrontFamilyIdentities([
      identity,
      { ...identity, familyVersion: "1.1.0" },
      { ...identity, familyId: "warm-narrative" },
    ]);
    expect(parsed).toHaveLength(3);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it.each([
    "pageProfiles",
    "pageBlueprintIds",
    "routes",
    "navigation",
    "regions",
    "frame",
    "components",
    "componentIds",
    "assets",
    "productIds",
    "commerce",
    "palette",
    "fonts",
    "css",
    "html",
    "visualRecipe",
    "providerPayload",
    "normalizedTopology",
    "fingerprint",
    "migrationAliases",
    "merchantId",
    "projectId",
    "storeId",
    "metadata",
  ])("rejects forbidden identity authority field %s", (field) => {
    expect(
      structuralStorefrontFamilyIdentityV1Schema.safeParse({ ...identity, [field]: true }).success,
    ).toBe(false);
  });
});

describe("P10B-19A-01 Structural Storefront Family lifecycle", () => {
  it("owns exactly candidate, active and deprecated states", () => {
    expect(structuralStorefrontFamilyLifecycleStates).toEqual([
      "candidate",
      "active",
      "deprecated",
    ]);
    expect(STRUCTURAL_STOREFRONT_FAMILY_INITIAL_LIFECYCLE_STATE).toBe("candidate");
    expect(structuralStorefrontFamilyLifecycleStateSchema.safeParse("unknown").success).toBe(false);
  });

  it.each([
    ["candidate", false],
    ["active", true],
    ["deprecated", false],
  ] as const)("maps %s selectability to %s", (state, selectable) => {
    expect(isStructuralStorefrontFamilySelectable(state)).toBe(selectable);
  });

  it("fails closed for unknown selectability state", () => {
    expect(() => isStructuralStorefrontFamilySelectable("unknown")).toThrow();
  });

  it("declares only the three allowed forward transitions", () => {
    expect(structuralStorefrontFamilyLifecycleTransitionPolicies).toEqual([
      {
        from: "candidate",
        to: "active",
        activationAuthorityRequirement: "future-governed-activation-required",
      },
      { from: "candidate", to: "deprecated", activationAuthorityRequirement: "none" },
      { from: "active", to: "deprecated", activationAuthorityRequirement: "none" },
    ]);
    expect(
      resolveStructuralStorefrontFamilyLifecycleTransition({
        from: subject("candidate"),
        to: subject("active"),
      }).activationAuthorityRequirement,
    ).toBe("future-governed-activation-required");
  });

  it.each([
    ["candidate", "deprecated"],
    ["active", "deprecated"],
  ] as const)("allows %s -> %s without inventing activation authority", (from, to) => {
    expect(
      resolveStructuralStorefrontFamilyLifecycleTransition({
        from: subject(from),
        to: subject(to),
      }).activationAuthorityRequirement,
    ).toBe("none");
  });

  it.each([
    ["active", "candidate"],
    ["deprecated", "active"],
    ["deprecated", "candidate"],
    ["candidate", "candidate"],
    ["active", "active"],
    ["deprecated", "deprecated"],
  ] as const)("rejects forbidden or self transition %s -> %s", (from, to) => {
    expect(() =>
      resolveStructuralStorefrontFamilyLifecycleTransition({
        from: subject(from),
        to: subject(to),
      }),
    ).toThrow(/invalid structural storefront family lifecycle transition/i);
  });

  it("rejects transitions that change ID or version", () => {
    expect(() =>
      resolveStructuralStorefrontFamilyLifecycleTransition({
        from: subject("candidate"),
        to: subject("deprecated", { familyId: "warm-narrative" }),
      }),
    ).toThrow(/cannot change structural storefront family identity/i);
    expect(() =>
      resolveStructuralStorefrontFamilyLifecycleTransition({
        from: subject("active"),
        to: subject("deprecated", { familyVersion: "1.1.0" }),
      }),
    ).toThrow(/cannot change structural storefront family identity/i);
  });
});

describe("P10B-19A-01 architecture boundary", () => {
  it("exports vocabulary and policy but no family records, registry, selector or fingerprint", () => {
    const exportNames = Object.keys(familyAuthority);
    expect(
      exportNames.filter((name) =>
        /registry|selector|fingerprint|blueprint|visualRecipe/iu.test(name),
      ),
    ).toEqual([]);

    const recordLikeExports = Object.values(familyAuthority).filter(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, "familyId"),
    );
    expect(recordLikeExports).toHaveLength(0);
  });

  it("has no current production consumer outside its own domain", () => {
    const repositoryRoot = resolve(process.cwd());
    const familyDomain = resolve(repositoryRoot, "src/domain/structural-storefront-family");
    const consumers = collectTypeScriptFiles(resolve(repositoryRoot, "src"))
      .filter((path) => !path.startsWith(familyDomain))
      .filter((path) => readFileSync(path, "utf8").includes("structural-storefront-family"))
      .map((path) => relative(repositoryRoot, path));
    expect(consumers).toEqual([]);
  });
});
