import {
  createComposedStorefrontCandidate,
  type ComposedStorefrontCandidateRequest,
} from "@/application/storefront-templates/bind-storefront-composition";
import { compilePageBlueprintComposition } from "@/application/storefront-templates/compile-page-blueprint-composition";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront/canonical-storefront";
import { listPageFamilyDefinitions } from "@/domain/storefront/page-family";
import { storefrontSnapshotSchema } from "@/domain/storefront/storefront";
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

/** Canonical metadata controls; only the existing home inventory is composed. */
export function ar05bGovernedFixture() {
  const f = ar05bFixture();
  const home = f.base.pages[0];
  const routes: Record<string, string> = {
    home: "/",
    about: "/pages/about",
    cart: "/cart",
    checkout: "/checkout",
    "no-results": "/states/no-results",
    "empty-state": "/states/empty",
    "error-state": "/states/error",
    "not-found": "/404",
  };
  const pages = listPageFamilyDefinitions()
    .filter(
      (d) =>
        d.commerceContext === "none" &&
        (d.presenceAuthority.kind === "required-singleton" || d.id === "about"),
    )
    .map((d) => ({
      ...structuredClone(home),
      id: d.id === "home" ? home.id : `page_ar05b_${d.id.replaceAll("-", "_")}`,
      type: d.pageType,
      slug: routes[d.id],
      sections: d.id === "home" ? structuredClone(home.sections) : [],
      pageFamily: {
        familyId: d.id,
        familyVersion: d.version,
        profileId: d.allowedProfileReferences[0].id,
        profileVersion: d.allowedProfileReferences[0].version,
        localeCoverage: ["en", "fi"],
        sharedFrameId: d.sharedFrameRequirement.id,
        sharedFrameVersion: d.sharedFrameRequirement.version,
        commerceContext: { kind: "none" },
        commerceOperationAuthority: d.commerceOperationAuthority,
        navigationAreas: d.id === "home" ? ["primary"] : d.id === "about" ? ["footer"] : [],
        evidenceReferences:
          d.evidenceRequirement === "approved-facts"
            ? [
                {
                  source: "approved-source-evidence",
                  authorityId: "evidence_page_fact",
                  revision: "1",
                  status: "approved",
                  approvalAuthorityId: "brief_test",
                  approvalFingerprint: "metadata-fixture",
                },
              ]
            : [],
      },
    }));
  const base = storefrontSnapshotSchema.parse({
    ...f.base,
    pages,
    navigation: {
      primary: [
        { id: "nav_ar05b_home", label: home.title, target: { type: "page", pageId: home.id } },
      ],
      footer: [
        {
          id: "nav_ar05b_about",
          label: home.title,
          target: { type: "page", pageId: "page_ar05b_about" },
        },
      ],
    },
  });
  const request = {
    ...f.request,
    expectedBase: {
      ...f.request.expectedBase,
      contentFingerprint: canonicalStorefrontContentFingerprint(base),
    },
  };
  return {
    ...f,
    base,
    request,
    create: () => createComposedStorefrontCandidate(base, request, f.authority),
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
