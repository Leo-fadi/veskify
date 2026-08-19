import {
  commercialPdpProfileIdSchema,
  getCommercialPdpProfile,
} from "@/application/storefront-templates";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  P9_05A_COMPLEX_PRODUCT_ID,
  P9_05A_SIMPLE_PRODUCT_ID,
  createP905aFreshMerchantFixture,
} from "@/data/demo/p9-05a-fresh-store-generation";
import { createRawKarvonenStorefrontFixture } from "@/data/demo/raw-karvonen-storefront-fixture";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import { P10B11PdpProofClient } from "./pdp-proof-client";

const directionByProfile = {
  "pdp-standard-commerce": "modernTechnical",
  "pdp-high-consideration": "premiumEditorial",
  "pdp-gallery-led": "premiumEditorial",
  "pdp-variant-led": "modernTechnical",
} as const;
const proofDirections = ["premiumEditorial", "modernTechnical", "warmApproachable"] as const;

const scenarios = ["complex", "simple", "light", "rich", "sparse"] as const;
type Scenario = (typeof scenarios)[number];

function proofCatalogue(
  fixture: ReturnType<typeof createP905aFreshMerchantFixture>,
  scenario: Scenario,
  relatedCount: number,
) {
  const sourceId = scenario === "complex" ? P9_05A_COMPLEX_PRODUCT_ID : P9_05A_SIMPLE_PRODUCT_ID;
  const source = fixture.aggregate.catalogue.products.find(({ id }) => id === sourceId)!;
  let primary = structuredClone(source);
  if (scenario === "light") {
    primary.title = { en: "Arc Studs · finish", fi: "Kaari-nappikorvakorut · viimeistely" };
    primary.images = [...primary.images, { ...primary.images[0], id: "media_lumo_studs_detail" }];
    primary.orderOptions = [
      {
        id: "option_lumo_finish",
        type: "selection",
        label: { en: "Finish", fi: "Viimeistely" },
        required: true,
        values: [
          { en: "Polished", fi: "Kiillotettu" },
          { en: "Brushed", fi: "Harjattu" },
        ],
      },
    ];
  }
  if (scenario === "rich") {
    const richProduct = createRawKarvonenStorefrontFixture().aggregate.catalogue.products.find(
      ({ images }) => images.length >= 3,
    );
    if (!richProduct) throw new Error("The retained canonical fixtures lack rich product media.");
    primary = structuredClone(richProduct);
  }
  if (scenario === "sparse") {
    primary.title = { en: "Arc Studs · archive image", fi: "Kaari-nappikorvakorut · arkistokuva" };
  }
  const related = Array.from({ length: Math.min(relatedCount, 5) }, (_, index) => ({
    ...structuredClone(fixture.aggregate.catalogue.products[index % 2]),
    id: `product_lumo_related_${index + 1}`,
    sku: `LUMO-RELATED-${index + 1}`,
    title: { en: `Lumo companion ${index + 1}`, fi: `Lumo-parituote ${index + 1}` },
    images: fixture.aggregate.catalogue.products[index % 2].images.map((image, imageIndex) => ({
      ...image,
      id: `media_lumo_related_${index + 1}_${imageIndex + 1}`,
    })),
  }));
  return catalogueDisplayModelSchema.parse({
    ...fixture.aggregate.catalogue,
    products: [primary, ...related],
    collections: fixture.aggregate.catalogue.collections.map((collection) => ({
      ...collection,
      productIds: [primary.id, ...related.map(({ id }) => id)],
    })),
  });
}

export default async function P10B11PdpProofPage({
  searchParams,
}: {
  searchParams: Promise<{
    evidence?: string;
    direction?: string;
    profile?: string;
    related?: string;
    scenario?: string;
  }>;
}) {
  const query = await searchParams;
  const parsed = commercialPdpProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "pdp-standard-commerce";
  const profile = getCommercialPdpProfile(profileId)!;
  const authority = profile.profile!.commercialProductDetail!;
  const directionId = proofDirections.includes(query.direction as (typeof proofDirections)[number])
    ? (query.direction as (typeof proofDirections)[number])
    : directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const scenario = scenarios.includes(query.scenario as Scenario)
    ? (query.scenario as Scenario)
    : "complex";
  const relatedCount = Math.max(0, Math.min(5, Number(query.related ?? "1") || 0));
  const catalogue = proofCatalogue(fixture, scenario, relatedCount);
  const product = catalogue.products[0];
  const catalogueProductIds = catalogue.products.map(({ id }) => id);
  const sourceDraft = structuredClone(fixture.planningInput.draft);
  const draftWithProduct = storefrontSnapshotSchema.parse({
    ...sourceDraft,
    pages: sourceDraft.pages.map((page) => ({
      ...page,
      ...(page.type === "product" ? { title: product.title } : {}),
      sections: page.sections.map((section) => {
        const content: Record<string, unknown> = { ...section.content };
        if (Array.isArray(content.productIds)) content.productIds = catalogueProductIds;
        if (
          page.type === "product" &&
          ["productGallery", "productInfo", "productOptions"].includes(section.component)
        ) {
          content.productId = product.id;
        }
        return { ...section, content };
      }),
    })),
  });
  const draft = applyCommercialSharedFrame(draftWithProduct, authority.defaultSharedFrameProfileId);
  const planningInput = { ...fixture.planningInput, catalogue, draft };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    pdpProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const materialized = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  const supportingEvidence = {
    source: "merchant-approved" as const,
    authorityId: fixture.brief.id,
    revision: String(fixture.brief.revision),
    status: "approved" as const,
    approvalAuthorityId: fixture.brief.approval.actorId!,
    approvalFingerprint: fixture.brief.approvedEvidenceFingerprint!,
  };
  const snapshot = storefrontSnapshotSchema.parse({
    ...materialized,
    pages: materialized.pages.map((page) =>
      page.type !== "product"
        ? page
        : {
            ...page,
            sections: page.sections.map((section) => {
              if (section.component !== "dynamicProductDetail") return section;
              const content: Record<string, unknown> = {
                ...section.content,
                productId: product.id,
                relatedProductIds: catalogue.products
                  .slice(1, relatedCount + 1)
                  .map(({ id }) => id),
              };
              if (profileId === "pdp-high-consideration" && query.evidence !== "none") {
                content.supportingHeading = { en: "About this studio", fi: "Tietoa studiosta" };
                content.supportingBody = {
                  en: fixture.brief.businessIdentity.shortDescription,
                  fi: fixture.brief.businessIdentity.shortDescription,
                };
                content.supportingEvidence = supportingEvidence;
              }
              if (query.evidence === "none") {
                delete content.supportingHeading;
                delete content.supportingBody;
                content.trustItems = [];
              }
              return { ...section, content };
            }),
          },
    ),
  });
  const productPage = snapshot.pages.find((page) => page.type === "product")!;
  const materialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "product",
  )!;
  return (
    <P10B11PdpProofClient
      aggregate={{ ...fixture.aggregate, catalogue }}
      materializationFingerprint={materialization.fingerprint}
      productId={product.id}
      productPage={productPage}
      profileId={profileId}
      profileVersion={profile.profile!.version}
      proofScenario={scenario}
      responsiveArchitecture={authority.responsiveArchitecture}
      snapshot={snapshot}
      snapshotFingerprint={canonicalStorefrontContentFingerprint(snapshot)}
      structuralFingerprint={authority.structuralFingerprint}
      supportingEvidence={
        profileId === "pdp-high-consideration" && query.evidence !== "none"
          ? supportingEvidence
          : undefined
      }
    />
  );
}
