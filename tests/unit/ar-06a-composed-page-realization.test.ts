import { describe, expect, it } from "vitest";
import {
  composedPageRealizationSupport,
  deriveComposedPageLayout,
  inspectComposedPageArrangement,
} from "@/components/storefront/composed-page-realization";
import { createAr06aComposedTemplate } from "@/data/demo/ar-06a-composed-template";
import {
  createPageBlueprintV2CandidateAuthority,
  parsePageBlueprintV2CandidateAuthority,
} from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import { createPageBlueprintV2RegionRelationshipKey } from "@/application/storefront-templates/page-blueprint-v2-contract";
import {
  compilePageBlueprintComposition,
  type PageBlueprintCompositionSelection,
} from "@/application/storefront-templates/compile-page-blueprint-composition";
import type {
  PageBlueprintCompositionAuthority,
  PageBlueprintCompositionRealizationRequest,
} from "@/application/storefront-templates/validate-page-blueprint-composition";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { ar05aFixture } from "../helpers/ar-05a-composition-fixtures";
import {
  inspectAr06aCacheControl,
  inspectAr06aVisibility,
} from "../helpers/ar-06a-composition-observation";

describe("AR-06A actual text/control/media visibility", () => {
  const sample = {
    label: "canonical text or control",
    content: { left: 10, top: 10, right: 90, bottom: 30 },
    boundaries: [{ left: 0, top: 0, right: 100, bottom: 100 }],
    unobscured: true,
  };
  it("accepts contained, unobscured content with the original two-pixel tolerance", () => {
    expect(
      inspectAr06aVisibility([sample, { ...sample, content: { ...sample.content, left: -2 } }]),
    ).toEqual([]);
  });
  it.each([
    { content: { ...sample.content, right: 120 } },
    { content: { ...sample.content, top: -3 } },
    { content: { ...sample.content, bottom: 103 } },
    { content: { ...sample.content, right: 10 } },
    { content: { ...sample.content, left: Number.NaN } },
    { unobscured: false },
    { boundaries: [] },
    { boundaries: [...sample.boundaries, { left: 0, top: 0, right: 60, bottom: 100 }] },
  ])("rejects clipping, occlusion and missing/invalid visibility proof: %j", (change) => {
    expect(inspectAr06aVisibility([{ ...sample, ...change }])).toEqual([sample.label]);
  });
  it("rejects an empty observation", () => {
    expect(() => inspectAr06aVisibility([])).toThrow("Missing");
  });
});

describe("AR-06A bounded development cache directive exception", () => {
  const scope = {
    pathname: "/acceptance/ar-06a",
    nodeEnvironment: "development",
    runtimeMode: "standalone",
    acceptanceFlag: "1",
    approvedFixtureOnly: true,
  };
  it.each([
    "no-cache, must-revalidate",
    " MUST-REVALIDATE , No-CaChe ",
    "private",
    "no-store",
    "private, no-cache, must-revalidate",
    "private, no-cache, no-store, max-age=0, must-revalidate",
    'PRIVATE, NO-STORE, MAX-AGE = "0"',
  ])("accepts bounded directives: %s", (header) => {
    expect(inspectAr06aCacheControl(header, scope).mode).toBe(
      /private|no-store/iu.test(header)
        ? "original-private-or-no-store"
        : "development-revalidation-exception",
    );
  });
  it("compares parsed directives independently of spelling, order and whitespace", () => {
    expect(inspectAr06aCacheControl(" No-Cache , MUST-REVALIDATE ", scope)).toEqual(
      inspectAr06aCacheControl("must-revalidate,no-cache", scope),
    );
  });
  it.each([
    undefined,
    "",
    " ",
    "no-cache",
    "must-revalidate",
    "no-cache, must-revalidate,",
    "no-cache,,must-revalidate",
    "public",
    "no-store, public",
    "private, immutable",
    "private, max-age=1",
    "private, max-age=-1",
    "private, max-age=0.1",
    "private, s-maxage=0",
    "private, s-maxage=3600",
    "private, max-stale",
    "private, stale-while-revalidate=0",
    "private, stale-if-error=1",
    'no-cache="Set-Cookie", must-revalidate',
    'private="Set-Cookie"',
    "no-store=0",
    'private, max-age="0',
    "no-cache, No-Cache, must-revalidate",
    "private, max-age=0, max-age=1",
    "private, max-age=0, max-age=0",
    "private, x-cache-policy",
    "no-cache; must-revalidate",
  ])("rejects missing, malformed or unsafe directives: %s", (header) => {
    expect(() => inspectAr06aCacheControl(header, scope)).toThrow();
  });
  it.each([
    { pathname: "/projects/private" },
    { nodeEnvironment: "production" },
    { nodeEnvironment: "test" },
    { runtimeMode: "integrated" },
    { acceptanceFlag: "0" },
    { approvedFixtureOnly: false },
  ])("does not apply the exception outside its exact scope: %j", (change) => {
    expect(() =>
      inspectAr06aCacheControl("no-cache, must-revalidate", { ...scope, ...change }),
    ).toThrow();
  });
});

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
type Candidate = ReturnType<typeof parsePageBlueprintV2CandidateAuthority>;
function control(change: (candidate: Mutable<Candidate>) => void = () => {}) {
  const fixture = createAr06aComposedTemplate("offset");
  const composed = fixture.snapshot.pages.find((page) => page.id === fixture.homeId)!;
  if (!("composition" in composed)) throw new Error("Actual fixture is not composed");
  const trusted = fixture.resolver({
    owner: composed.composition.owner,
    composition: composed.composition,
  });
  const raw = structuredClone(
    parsePageBlueprintV2CandidateAuthority(trusted.candidate),
  ) as Mutable<Candidate>;
  change(raw);
  const { candidateFingerprint: _candidateFingerprint, ...material } = raw;
  void _candidateFingerprint;
  // Recreate authority, so controls cannot pass solely because of a stale hash.
  const candidate = createPageBlueprintV2CandidateAuthority(material);
  const { composition, ...page } = composed;
  const {
    blueprint: _blueprint,
    support: _support,
    bindingFingerprint: _binding,
    compositionFingerprint: _fingerprint,
    ...selection
  } = structuredClone(composition);
  void _blueprint;
  void _support;
  void _binding;
  void _fingerprint;
  const authority: PageBlueprintCompositionAuthority = {
    ...trusted,
    owner: { kind: "static-page", page },
    candidate,
    requiredAssetRoleCapacityEvidence: {
      blueprintId: candidate.structural.id,
      blueprintVersion: candidate.structural.version,
      exactCandidateFingerprint: candidate.candidateFingerprint,
      requiredRoleCapacities: [],
    },
  };
  return {
    fixture,
    candidate,
    selection,
    authority,
    compile: () => compilePageBlueprintComposition(selection, authority),
  };
}
function addPair(raw: Mutable<Candidate>, sourceRegionId: string, targetRegionId: string) {
  const relationship = { sourceRegionId, targetRegionId, relationshipKind: "pairs-with" as const };
  raw.structural.relationships.push(relationship);
  for (const rule of raw.responsiveRules.breakpointRules)
    rule.relationshipTransformations.push({
      relationshipKey: createPageBlueprintV2RegionRelationshipKey(relationship),
      transformation:
        rule.breakpoint === "mobile" || rule.breakpoint === "tablet" ? "stack" : "preserve",
    });
}
function selectRelationships(c: ReturnType<typeof control>) {
  const ids = (transformation: string, kind: string) =>
    transformation === "stack"
      ? "pair-stack"
      : transformation === "remove-offset"
        ? "offset-none"
        : kind === "pairs-with"
          ? "pair-columns"
          : kind === "offsets"
            ? "offset-block-start"
            : "precedes-preserve";
  const byKey = new Map(
    c.candidate.structural.relationships.map((relation) => [
      createPageBlueprintV2RegionRelationshipKey(relation),
      relation.relationshipKind,
    ]),
  );
  c.selection.relationshipRealizations = [...byKey].map(([relationshipKey, kind]) => ({
    relationshipKey,
    realizationId: ids("preserve", kind),
  }));
  c.selection.breakpoints = c.candidate.responsiveRules.breakpointRules.map((rule) => ({
    breakpoint: rule.breakpoint,
    viewport: rule.viewport,
    orderAlternativeId: rule.orderAlternativeId,
    ruleFingerprint: canonicalValueFingerprint(rule),
    relationshipRealizations: rule.relationshipTransformations.map((relation) => ({
      relationshipKey: relation.relationshipKey,
      realizationId: ids(relation.transformation, byKey.get(relation.relationshipKey)!),
    })),
  }));
}
describe("AR-06A executable support", () => {
  it("changes actual structure while retaining complete static content/media/brand/catalogue identities", () => {
    const stack = createAr06aComposedTemplate("stack");
    const offset = createAr06aComposedTemplate("offset");
    for (const key of ["content", "brand", "catalogue", "contentMedia", "support"] as const)
      expect(stack.identities[key]).toBe(offset.identities[key]);
    expect(stack.identities.composition).not.toBe(offset.identities.composition);
    expect(stack.identities.candidate).not.toBe(offset.identities.candidate);
    expect(stack.snapshot.pages.map((page) => page.sections)).toEqual(
      offset.snapshot.pages.map((page) => page.sections),
    );
    expect(stack.snapshot.sharedFrame).toEqual(offset.snapshot.sharedFrame);
  });
  it("compiles and maps multiple generic disjoint adjacent pairs, including canonical reverse endpoint spelling", () => {
    const c = control((raw) => addPair(raw, "brand-story", "campaign"));
    selectRelationships(c);
    const composition = c.compile();
    expect(deriveComposedPageLayout({ composition, candidate: c.candidate }).pairs).toEqual([
      { sourceRegionId: "orientation", targetRegionId: "primary-discovery", offset: true },
      { sourceRegionId: "campaign", targetRegionId: "brand-story", offset: false },
    ]);
  });
  it.each(["contains", "spans", "anchors"] as const)(
    "rejects schema-valid unsupported %s",
    (relationship) => {
      const fixture = ar05aFixture({ relationship });
      expect(parsePageBlueprintV2CandidateAuthority(fixture.candidate)).toEqual(fixture.candidate);
      expect(() => inspectComposedPageArrangement(fixture.candidate)).toThrow(
        /unsupported relationship/u,
      );
    },
  );
  it.each([
    ["overlapping", "primary-discovery", "campaign"],
    ["nonadjacent", "brand-story", "continuation"],
  ])("rejects %s pairs with freshly valid candidate identity", (_label, source, target) => {
    const c = control((raw) => addPair(raw, source, target));
    expect(() => inspectComposedPageArrangement(c.candidate)).toThrow(
      /overlapping or non-adjacent/u,
    );
    selectRelationships(c);
    expect(() => c.compile()).toThrow(/unresolved/u);
  });
  it("rejects a schema-valid alternate responsive reading order", () => {
    const c = control((raw) => {
      raw.structural.relationships = raw.structural.relationships.filter(
        (relation) => relation.relationshipKind !== "precedes",
      );
      const keys = new Set(
        raw.structural.relationships.map(createPageBlueprintV2RegionRelationshipKey),
      );
      raw.responsiveRules.breakpointRules.forEach((rule) => {
        rule.relationshipTransformations = rule.relationshipTransformations.filter((relation) =>
          keys.has(relation.relationshipKey),
        );
      });
      const order = raw.structural.orderAlternatives.find((entry) => entry.id === "pair-columns")!;
      order.regionIds = [...order.regionIds.slice(0, 2), ...order.regionIds.slice(2).reverse()];
    });
    expect(() => inspectComposedPageArrangement(c.candidate)).toThrow(
      /divergent responsive order/u,
    );
  });
  it("rejects an offset directed outside its pair", () => {
    const c = control((raw) => {
      const offset = raw.structural.relationships.find(
        (relation) => relation.relationshipKind === "offsets",
      )!;
      const previousKey = createPageBlueprintV2RegionRelationshipKey(offset);
      offset.targetRegionId = "campaign";
      for (const rule of raw.responsiveRules.breakpointRules)
        rule.relationshipTransformations.find(
          (entry) => entry.relationshipKey === previousKey,
        )!.relationshipKey = createPageBlueprintV2RegionRelationshipKey(offset);
    });
    expect(() => inspectComposedPageArrangement(c.candidate)).toThrow(/offset outside/u);
  });
  it("declines wrong IDs, compact geometry, projected omissions and dynamic owners at actual support callbacks", () => {
    const c = control();
    const requests: PageBlueprintCompositionRealizationRequest[] = [];
    compilePageBlueprintComposition(c.selection, {
      ...c.authority,
      support: {
        ...composedPageRealizationSupport,
        resolve: (request) => {
          requests.push(request);
          return composedPageRealizationSupport.resolve(request);
        },
      },
    });
    const region = requests.find((request) => request.kind === "region")!;
    expect(composedPageRealizationSupport.resolve({ ...region, realizationId: "unknown" })).toBe(
      false,
    );
    const projected = {
      ...region,
      structural: { ...region.structural, regions: region.structural.regions.slice(1) },
    };
    expect(composedPageRealizationSupport.resolve(projected)).toBe(false);
    expect(
      composedPageRealizationSupport.resolve({
        ...region,
        owner: { kind: "collection-search-archetype", id: "foreign" },
      }),
    ).toBe(false);
    const compact = requests.find(
      (request) =>
        request.kind === "relationship" &&
        request.relationship.relationshipKind === "pairs-with" &&
        request.breakpoint === "mobile",
    )!;
    if (compact.kind !== "relationship")
      throw new Error("Expected real compact relationship invocation");
    expect(
      composedPageRealizationSupport.resolve({
        ...compact,
        realizationId: "pair-columns",
        transformation: "preserve",
      }),
    ).toBe(false);
    expect(requests.every((request) => Object.isFrozen(request))).toBe(true);
  });
  it("cannot compile a copied permissive choice through real authority", () => {
    const c = control();
    const selection: PageBlueprintCompositionSelection = structuredClone(c.selection);
    selection.regionAssignments[0].realizationId = "flat-fallback";
    expect(() => compilePageBlueprintComposition(selection, c.authority)).toThrow(
      /unresolved region/u,
    );
  });
});
