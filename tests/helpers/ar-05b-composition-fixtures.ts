import {
  createComposedStorefrontCandidate,
  type ComposedStorefrontCandidateRequest,
} from "@/application/storefront-templates/bind-storefront-composition";
import { compilePageBlueprintComposition } from "@/application/storefront-templates/compile-page-blueprint-composition";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront/canonical-storefront";
import { createCompiledPageBlueprintCompositionV1 } from "@/domain/storefront/compiled-page-blueprint-composition";
import { createDynamicCommercePresentationAuthorityV2 } from "@/domain/storefront/dynamic-commerce-composition-version";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";
import { ar05aFixture } from "./ar-05a-composition-fixtures";

export function ar05bFixture(options: Parameters<typeof ar05aFixture>[0] = {}) {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const base = structuredClone(aggregate.snapshots[1]);
  const a = ar05aFixture(options);
  const authority = () => {
    const { owner: _owner, ...trusted } = a.authority;
    void _owner;
    return trusted;
  };
  const request: ComposedStorefrontCandidateRequest = {
    expectedBase: {
      id: base.id,
      revision: base.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(base),
    },
    successor: {
      id: `${base.id}_composition`,
      revision: base.revision + 1,
      projectId: base.projectId,
      catalogueRef: base.catalogueRef,
      createdAt: "2026-07-16T09:00:00+03:00",
      createdBy: "agent",
    },
    assignments: [{ selection: a.selection }],
  };
  return {
    aggregate,
    base,
    a,
    authority,
    request,
    create: () => createComposedStorefrontCandidate(base, request, authority),
  };
}

/** Syntax fixture only: borrowed static topology is deliberately NOT dynamic acceptance. */
export function ar05bStructuralDynamic() {
  const fixture = ar05bFixture();
  const value = compilePageBlueprintComposition(fixture.a.selection, fixture.a.authority);
  const { compositionFingerprint: _fingerprint, ...composition } = value;
  void _fingerprint;
  const { authorityFingerprint: _authorityFingerprint, ...material } =
    fixture.base.dynamicCommercePresentation!;
  void _authorityFingerprint;
  const first = material.collectionSearchArchetypes[0];
  const dynamic = createDynamicCommercePresentationAuthorityV2({
    ...material,
    contractVersion: "2.0.0",
    collectionSearchArchetypes: material.collectionSearchArchetypes.map((owner) =>
      owner.id === first.id
        ? {
            ...owner,
            composition: createCompiledPageBlueprintCompositionV1({
              ...composition,
              owner: { kind: "collection-search-archetype", id: owner.id },
            }),
          }
        : owner,
    ),
  });
  return {
    fixture,
    dynamic,
    snapshot: {
      ...fixture.base,
      compositionExtensionVersion: "1.0.0" as const,
      dynamicCommercePresentation: dynamic,
    },
  };
}
