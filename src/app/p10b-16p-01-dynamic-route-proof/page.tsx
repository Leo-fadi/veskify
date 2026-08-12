import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import {
  createDynamicCommercePresentationAuthority,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";
import { DynamicRouteArchetypeEditorProofClient } from "./proof-client";

export default function DynamicRouteArchetypeEditorProofPage() {
  const source = createP10B14PremiumEditorialFixture();
  const snapshot = source.slice.snapshot;
  const authority = snapshot.dynamicCommercePresentation;
  const sourceCollection = source.fixture.aggregate.catalogue.collections[0];
  const sourceCollectionRoute = authority?.routeInventory.find(
    (route) => route.kind === "collection" && route.collectionId === sourceCollection?.id,
  );
  const sourceCollectionMapping = sourceCollectionRoute
    ? authority?.collectionRouteMappings.find(({ routeId }) => routeId === sourceCollectionRoute.id)
    : undefined;
  if (!authority || !sourceCollection || !sourceCollectionRoute || !sourceCollectionMapping) {
    throw new Error("The dynamic-route browser proof requires collection archetype authority.");
  }
  const proofCollection = {
    ...structuredClone(sourceCollection),
    id: "collection_lumo_gifts",
    slug: "gifts",
    title: { en: "Gifts", fi: "Lahjat" },
    description: {
      en: "A canonical gift collection presented through the shared collection archetype.",
      fi: "Kanoninen lahjamallisto, joka esitetään yhteisen mallistomallin kautta.",
    },
    productIds: [...sourceCollection.productIds].reverse(),
  };
  const proofCollectionRoute = {
    id: "route_collection_lumo_gifts",
    kind: "collection" as const,
    route: "/collections/gifts",
    collectionId: proofCollection.id,
  };
  const { authorityFingerprint: _authorityFingerprint, ...authorityMaterial } = authority;
  void _authorityFingerprint;
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority({
    ...structuredClone(authorityMaterial),
    routeInventory: [...authority.routeInventory, proofCollectionRoute],
    collectionRouteMappings: [
      ...authority.collectionRouteMappings,
      {
        routeId: proofCollectionRoute.id,
        archetypeId: sourceCollectionMapping.archetypeId,
      },
    ],
  });
  const proofSnapshot = storefrontSnapshotSchema.parse({
    ...structuredClone(snapshot),
    pages: snapshot.pages.map((page) =>
      page.type === "home"
        ? {
            ...structuredClone(page),
            sections: page.sections.filter(({ component }) => component !== "homepageProof"),
          }
        : structuredClone(page),
    ),
    dynamicCommercePresentation,
  });
  const aggregate: ProjectAggregate = {
    ...structuredClone(source.fixture.aggregate),
    catalogue: {
      ...structuredClone(source.fixture.aggregate.catalogue),
      collections: [
        ...structuredClone(source.fixture.aggregate.catalogue.collections),
        proofCollection,
      ],
    },
    snapshots: [
      ...source.fixture.aggregate.snapshots.filter(({ id }) => id !== snapshot.id),
      proofSnapshot,
    ],
  };

  return (
    <DynamicRouteArchetypeEditorProofClient
      aggregate={aggregate}
      evidenceReferences={source.approvedEvidenceReferences}
    />
  );
}
