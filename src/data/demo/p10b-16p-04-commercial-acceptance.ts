import {
  createApprovedGenerationAssetContextFingerprint,
  approvedGenerationAssetContextSchema,
} from "@/application/ai-storefront-generation";
import { executeCoordinatedDirection } from "@/application/bounded-storefront-synthesis";
import {
  ContentSupportFactAuthorityError,
  type ContentSupportFactAuthority,
} from "@/application/content-support-pages";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import {
  type PageFactEvidenceAuthority,
  PageFactEvidenceAuthorityError,
  storefrontSiteMapDecisionSchema,
  type StorefrontSiteMapDecision,
} from "@/application/storefront-site-map";
import {
  createWholeStorefrontRecipeContext,
  wholeStorefrontPlanningInputSchema,
  type ApprovedAssetPresentation,
} from "@/application/whole-storefront-generation-plan";
import { validateRegisteredSnapshot, veskifyComponentDefinitionsV2 } from "@/components/registry";
import { aurumNordicBusinessProfile, aurumNordicSeed } from "@/data/seed/aurum-nordic";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemSchema } from "@/domain/design-system";
import { projectSchema } from "@/domain/project";
import {
  storefrontSourceEvidenceMaterialSchema,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import type { LocalizedText } from "@/domain/shared";
import {
  PAGE_FAMILY_AUTHORITY_VERSION,
  SITE_MAP_SHARED_FRAME,
  approvedAssetPlacementOperationSchema,
  canonicalValueFingerprint,
  createContentSupportFactDocument,
  pageFactEvidenceRequestSchema,
  storefrontSnapshotSchema,
  type ContentSupportPageFamilyId,
  type PageFactEvidenceReference,
  type PageFactEvidenceRequest,
  type PageFamilyId,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

export const P10B16P04_COMMERCIAL_PROJECT_ID =
  "project_p10b16p04_aurum_commercial_acceptance" as const;
export const P10B16P04_COMMERCIAL_CATALOGUE_ID =
  "catalogue_p10b16p04_aurum_commercial_acceptance" as const;
export const P10B16P04_COMMERCIAL_DRAFT_ID = "snapshot_p10b16p04_aurum_commercial_draft" as const;
export const P10B16P04_COMMERCIAL_PUBLISHED_ID =
  "snapshot_p10b16p04_aurum_commercial_published" as const;
export const P10B16P04_COMMERCIAL_LOCALE = "en" as const;

export const P10B16P04_COMMERCIAL_CONTEXTS = Object.freeze({
  collection: Object.freeze({
    collectionId: "collection_everyday",
    collectionSlug: "everyday-icons",
    canonicalProductCount: 4,
  }),
  simpleProduct: Object.freeze({
    productId: "product_sisu_automatic_watch",
    productSlug: "sisu-automatic-watch",
  }),
  configurableProduct: Object.freeze({
    productId: "product_aurora_ring_585",
    productSlug: "aurora-ring-585",
  }),
  highConsiderationProduct: null,
});

const FIXTURE_ID = "p10b16p04j-aurum-fictional-commercial-visual-acceptance";
const FIXED_TIME = "2026-08-14T09:00:00.000Z";
const RAW_HOME_PAGE_ID = "page_p10b16p04_aurum_raw_home";
const BRIEF_ID = "brief_p10b16p04_aurum_commercial_acceptance";
const SOURCE_ID = "source_p10b16p04_aurum_repository_fixture";
const SOURCE_URL = "https://aurum.example/p10b-16p-04j/";
const IDENTITY_EVIDENCE_ID = "evidence_p10b16p04_aurum_identity";
const ABOUT_EVIDENCE_ID = "evidence_p10b16p04_aurum_about";
const ASSET_REVIEW_FINGERPRINT = "asset-review-p10b16p04-aurum-commercial-v1";
const APPROVAL_ACTOR_ID = "product_owner_p10b16p04j";
const ASSET_REVISION = "1:p10b16p04j-approved";

const localized = (en: string, fi: string) => ({ en, fi });

const aboutPayload = {
  familyId: "about" as const,
  title: localized("About Aurum Nordic", "Tietoa Aurum Nordicista"),
  introduction: localized(
    "Nordic jewellery and watches shaped by clarity, warm materials and lasting character.",
    "Pohjoismaisia koruja ja kelloja, joissa selkeys, lämpimät materiaalit ja kestävä luonne kohtaavat.",
  ),
  blocks: [
    {
      kind: "paragraph" as const,
      id: "northern-light-story",
      body: localized(
        "Jewellery and watches shaped by Nordic clarity and warm materials.",
        "Pohjoismaisen selkeitä koruja ja kelloja lämpimistä materiaaleista.",
      ),
    },
    {
      kind: "paragraph" as const,
      id: "material-stories",
      body: localized(
        "New pieces, material stories and quiet inspiration.",
        "Uutuuksia, materiaalitarinoita ja rauhallista inspiraatiota.",
      ),
    },
  ],
  story: {
    eyebrow: localized("Aurum Nordic", "Aurum Nordic"),
    heading: localized("Quiet forms, lasting meaning", "Hiljaisia muotoja, kestävää merkitystä"),
    body: localized(
      "Jewellery and watches shaped by Nordic clarity and warm materials.",
      "Pohjoismaisen selkeitä koruja ja kelloja lämpimistä materiaaleista.",
    ),
    steps: [
      {
        id: "helsinki-origin",
        title: localized("Helsinki", "Helsinki"),
        description: localized("Designed in Finland", "Suunniteltu Suomessa"),
      },
    ],
  },
  campaign: {
    eyebrow: localized("Winter light", "Talven valo"),
    heading: localized("Light, held close", "Valo lähelläsi"),
    description: localized(
      "Discover white gold and silver pieces inspired by winter light.",
      "Löydä talven valosta inspiroituneet valkokulta- ja hopeakorut.",
    ),
    actionLabel: localized("View the edit", "Katso valikoima"),
  },
};

const approvedAssetDefinitions = [
  {
    assetId: "asset_p10b16p04_aurum_hero",
    candidateRole: "hero" as const,
    role: "heroDesktop" as const,
    fileUrl: "/seed-assets/aurora-ring.svg",
    sourceUrl: `${SOURCE_URL}seed-assets/aurora-ring.svg`,
    materialFingerprint: "760c534fc97a4686f57c575534c0debed386701100b2dc9b4a4a088f275c5c77",
    purpose: "Approved fictional Aurum product-led hero presentation.",
    alt: localized("Aurora yellow-gold diamond ring", "Aurora-keltakultainen timanttisormus"),
  },
  {
    assetId: "asset_p10b16p04_aurum_collection",
    candidateRole: "collection" as const,
    role: "collectionImage" as const,
    fileUrl: "/seed-assets/lumi-halo-ring.svg",
    sourceUrl: `${SOURCE_URL}seed-assets/lumi-halo-ring.svg`,
    materialFingerprint: "0412e6adc72567de1f1bbd0a206b31edff928a3a649387a91413758935503737",
    purpose: "Approved fictional Aurum collection-discovery presentation.",
    alt: localized("Lumi white-gold halo ring", "Lumi-valkokultainen halosormus"),
  },
  {
    assetId: "asset_p10b16p04_aurum_editorial",
    candidateRole: "editorial" as const,
    role: "editorialImage" as const,
    fileUrl: "/seed-assets/aava-necklace.svg",
    sourceUrl: `${SOURCE_URL}seed-assets/aava-necklace.svg`,
    materialFingerprint: "ca09620254bd8821899d215447825818b32295763efc75bd042de1889aad83a9",
    purpose: "Approved fictional Aurum editorial and brand-story presentation.",
    alt: localized("Aava sterling-silver necklace", "Aava-sterlinghopeakaulakoru"),
  },
] as const;

const neutralBrandSystem = brandSystemSchema.parse({
  colors: {
    primary: "#202020",
    secondary: "#4A4A4A",
    accent: "#666666",
    background: "#FFFFFF",
    surface: "#FFFFFF",
    text: "#111111",
    mutedText: "#595959",
    border: "#D8D8D8",
  },
  typography: {
    headingFont: "system-sans",
    bodyFont: "system-sans",
    baseSize: 16,
    scaleRatio: 1.125,
    headingWeight: 500,
    bodyWeight: 400,
  },
  shape: { radius: "square" },
  spacing: { density: "balanced" },
  imagery: { style: "product-focused" },
  voice: {
    formality: "balanced",
    detail: "concise",
    positioning: "accessible",
    warmth: "neutral",
    energy: "direct",
  },
});

function localizedValue(value: LocalizedText, fallback: string): { en: string; fi: string } {
  const canonicalFallback = value.en ?? value.fi ?? fallback;
  return { en: value.en ?? canonicalFallback, fi: value.fi ?? canonicalFallback };
}

/**
 * Product-owner-approved, test-only display exclusion for one known seed note. The rule is exact
 * and fail-closed so the generic commerce renderer never infers presentation permission from text.
 */
export const P10B16P04_CATALOGUE_DISPLAY_EXCLUSION = Object.freeze({
  contractVersion: "p10b16p04j-display-exclusion-v1",
  productId: "product_lumi_halo_ring",
  fieldPath: "attributes.stoneClarity",
  expectedSourceValueFingerprint:
    "v1_16_455bab77dcec0c9eef6f1584e8a2e129c2631ddd61196feeef84b82ff4ad70fe",
  disposition: "internal-evidence-only",
  approvalEvidenceFingerprint: "p10b16p04j-product-owner-approved-aurum-fixture-2026-08-14",
} as const);

export function createP10B16P04ApprovedCatalogue(
  source: CatalogueDisplayModel = aurumNordicSeed.catalogue,
): CatalogueDisplayModel {
  const catalogue = structuredClone(source);
  const product = catalogue.products.find(
    ({ id }) => id === P10B16P04_CATALOGUE_DISPLAY_EXCLUSION.productId,
  );
  const sourceValue = product?.attributes.stoneClarity;
  if (
    !product ||
    Array.isArray(sourceValue) ||
    typeof sourceValue !== "string" ||
    canonicalValueFingerprint(sourceValue) !==
      P10B16P04_CATALOGUE_DISPLAY_EXCLUSION.expectedSourceValueFingerprint
  ) {
    throw new Error("The approved Aurum display exclusion no longer matches its exact source.");
  }
  delete product.attributes.stoneClarity;
  return catalogueDisplayModelSchema.parse({
    ...catalogue,
    id: P10B16P04_COMMERCIAL_CATALOGUE_ID,
  });
}

function neutralFrameBridgeSections() {
  const brandName = "Aurum Nordic";
  return [
    {
      id: "section_p10b16p04j_neutral_frame_header",
      component: "header" as const,
      variant: "centered",
      visible: true,
      content: { brandName },
      props: { showSearch: true, showCart: true },
    },
    {
      id: "section_p10b16p04j_neutral_frame_footer",
      component: "footer" as const,
      variant: "columns",
      visible: true,
      content: {
        brandName,
        contact: localized("Helsinki, Finland", "Helsinki, Suomi"),
        policyLabel: localized("Policies", "Käytännöt"),
        copyright: localized("© 2026 Aurum Nordic", "© 2026 Aurum Nordic"),
      },
      props: { showPolicies: false },
    },
  ];
}

function createRawSnapshot(
  id: typeof P10B16P04_COMMERCIAL_DRAFT_ID | typeof P10B16P04_COMMERCIAL_PUBLISHED_ID,
  createdBy: "user" | "system",
): StorefrontSnapshot {
  return storefrontSnapshotSchema.parse({
    id,
    projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
    revision: 0,
    brandSystem: neutralBrandSystem,
    navigation: { primary: [], footer: [] },
    pages: [
      {
        id: RAW_HOME_PAGE_ID,
        type: "home",
        slug: "/",
        title: localized("Aurum Nordic", "Aurum Nordic"),
        seo: {
          title: localized("Aurum Nordic", "Aurum Nordic"),
          metaDescription: localized(
            "Nordic jewellery and watches with lasting character.",
            "Pohjoismaisia koruja ja kelloja, joissa on kestävää luonnetta.",
          ),
        },
        sections: neutralFrameBridgeSections(),
      },
    ],
    contentSupportFactDocuments: [],
    catalogueRef: P10B16P04_COMMERCIAL_CATALOGUE_ID,
    createdAt: FIXED_TIME,
    createdBy,
  });
}

function createProjectAggregate(catalogue: CatalogueDisplayModel): ProjectAggregate {
  const project = projectSchema.parse({
    id: P10B16P04_COMMERCIAL_PROJECT_ID,
    name: "Aurum Nordic",
    mode: "salesDemo",
    industry: "jewellery",
    primaryLocale: P10B16P04_COMMERCIAL_LOCALE,
    enabledLocales: ["en", "fi"],
    businessProfile: {
      ...structuredClone(aurumNordicBusinessProfile),
      sourceReferences: [SOURCE_URL],
    },
    publishedSnapshotId: P10B16P04_COMMERCIAL_PUBLISHED_ID,
    draftSnapshotId: P10B16P04_COMMERCIAL_DRAFT_ID,
    revision: 0,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  });
  return validateProjectAggregate({
    project,
    catalogue,
    snapshots: [
      createRawSnapshot(P10B16P04_COMMERCIAL_DRAFT_ID, "user"),
      createRawSnapshot(P10B16P04_COMMERCIAL_PUBLISHED_ID, "system"),
    ],
  });
}

function createApprovedBrief(catalogue: CatalogueDisplayModel) {
  const materialEvidence = storefrontSourceEvidenceMaterialSchema.parse({
    sourceReferences: [
      {
        id: SOURCE_ID,
        sourceType: "deterministic-fixture",
        url: SOURCE_URL,
        normalizedOrigin: new URL(SOURCE_URL).origin,
        requestedLocale: P10B16P04_COMMERCIAL_LOCALE,
        discoveredAt: FIXED_TIME,
        allowedDiscoveryPolicy: {
          mode: "deterministic",
          maxPages: 1,
          maxAssets: approvedAssetDefinitions.length,
          followSameOriginOnly: true,
        },
        status: "complete",
        warnings: [],
        failure: null,
      },
    ],
    evidence: [
      {
        id: IDENTITY_EVIDENCE_ID,
        kind: "page-identity",
        provenance: {
          sourceReferenceId: SOURCE_ID,
          sourceUrl: SOURCE_URL,
          documentUrl: SOURCE_URL,
          observedAt: FIXED_TIME,
          extractionLocation: `${FIXTURE_ID}:product-owner-approved-fictional-input`,
        },
        sourceUrl: SOURCE_URL,
        confidence: 1,
        observedValue: {
          businessName: "Aurum Nordic",
          classification: "fictional-production-disabled-visual-acceptance-fixture",
        },
        extractionMethod: "p10b16p04j-approved-fictional-fixture",
        locale: P10B16P04_COMMERCIAL_LOCALE,
        warnings: [],
        uncertainty: { isUncertain: false, reason: null },
      },
      {
        id: ABOUT_EVIDENCE_ID,
        kind: "marketing-copy-candidate",
        provenance: {
          sourceReferenceId: SOURCE_ID,
          sourceUrl: SOURCE_URL,
          documentUrl: SOURCE_URL,
          observedAt: FIXED_TIME,
          extractionLocation: `${FIXTURE_ID}:approved-bilingual-merchant-content`,
        },
        sourceUrl: SOURCE_URL,
        confidence: 1,
        observedValue: aboutPayload,
        extractionMethod: "p10b16p04j-approved-fictional-fixture",
        locale: null,
        warnings: [],
        uncertainty: { isUncertain: false, reason: null },
      },
    ],
    assetCandidates: approvedAssetDefinitions.map((asset) => ({
      id: asset.assetId,
      role: asset.candidateRole,
      source: { kind: "source-url" as const, url: asset.sourceUrl },
      dimensions: { width: 800, height: 800 },
      mediaType: "image/svg+xml",
      provenance: {
        sourceReferenceId: SOURCE_ID,
        sourceUrl: asset.sourceUrl,
        documentUrl: SOURCE_URL,
        observedAt: FIXED_TIME,
        extractionLocation: `${FIXTURE_ID}:repository-owned-seed-media`,
      },
      confidence: 1,
      proposedReusePurpose: asset.purpose,
      licensingUsageConfirmation: "confirmed" as const,
      warnings: [],
      uncertainty: { isUncertain: false, reason: null },
      fingerprint: { algorithm: "sha256" as const, value: asset.materialFingerprint },
      duplicateOfAssetId: null,
    })),
    reconciliation: null,
  });
  const pending = createStorefrontDesignBrief({
    id: BRIEF_ID,
    now: FIXED_TIME,
    businessIdentity: {
      businessName: "Aurum Nordic",
      shortDescription:
        "A Nordic jewellery and watch presentation with restrained warmth and clear product discovery.",
      industry: "jewellery",
      targetCustomer: aurumNordicBusinessProfile.audience,
      primaryMarket: aurumNordicBusinessProfile.market,
      secondaryMarkets: [],
    },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    sourceReferenceIds: [SOURCE_ID],
    sourceEvidenceIds: [IDENTITY_EVIDENCE_ID, ABOUT_EVIDENCE_ID],
    materialEvidence,
    canonicalCommerceProjectionRef: catalogue.id,
    approvedReusableAssetIds: approvedAssetDefinitions.map(({ assetId }) => assetId),
    approvedAssetAssignments: approvedAssetDefinitions.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      revision: ASSET_REVISION,
      fingerprint: asset.materialFingerprint,
    })),
    assetReviewFingerprint: ASSET_REVIEW_FINGERPRINT,
    pagePlan: { pageTypes: ["home", "collection", "product", "about"] },
    navigationDirection: [
      "Use the current home, collection, product, About and utility route authority.",
    ],
    homepageGoals: [
      "Use approved product-led media for a restrained editorial introduction.",
      "Continue from brand story into canonical product discovery.",
    ],
    collectionPageGoals: [
      "Preserve canonical collection membership and order while presenting complete product cards.",
    ],
    productPageGoals: [
      "Present every canonical option and current commerce fact without inventing claims.",
    ],
    visualPriorities: [
      "Use generous hierarchy, restrained surfaces and product-led editorial media.",
    ],
    contentAssumptions: [
      "No approved logo asset is available; use the exact merchant name as a text fallback.",
      "No product currently meets the registered four-option-group high-consideration threshold.",
    ],
    unresolvedItems: [],
    materialUnresolvedBlockers: [],
    excludedClaims: [
      "Do not invent delivery, returns, guarantees, certifications or operational checkout claims.",
      "Do not render fixture, verification, placeholder or internal authority terminology.",
    ],
    generationPermissions: {
      allowMarketingCopy: false,
      allowAssetReuse: true,
      allowGeneratedImagery: false,
    },
    approvedBrandDirection: {
      logoAssetRef: null,
      supportingImageAssetRefs: approvedAssetDefinitions.map((asset) => ({
        id: asset.assetId,
        label: asset.purpose,
      })),
      preferredBrandColours: [],
      typographyDirection: "serif-led",
      visualStyleDirection: "editorial",
      imageryDirection: "product-focused",
      toneKeywords: ["elegant", "warm"],
    },
  });
  return {
    brief: approveStorefrontDesignBrief(pending, {
      actorId: APPROVAL_ACTOR_ID,
      approvedAt: FIXED_TIME,
    }),
    sourceEvidenceMaterial: materialEvidence,
  };
}

function approvedAssetContext(brief: StorefrontDesignBriefContract) {
  const input = {
    briefId: brief.id,
    briefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: brief.assetReviewFingerprint,
    assets: approvedAssetDefinitions.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      sourceReferenceId: SOURCE_ID,
      revision: ASSET_REVISION,
      materialFingerprint: asset.materialFingerprint,
      provenance: { location: "other-safe-source-location" as const, observedAt: FIXED_TIME },
      alt: asset.alt,
      presentation: {
        decorative: false,
        mediaType: "image/svg+xml",
        responsiveCrops: [],
      },
      approval: {
        actorId: APPROVAL_ACTOR_ID,
        actorReference: "p10b16p04j-product-owner-approval",
      },
    })),
  };
  return approvedGenerationAssetContextSchema.parse({
    ...input,
    fingerprint: createApprovedGenerationAssetContextFingerprint(input),
  });
}

function createAboutAuthority(brief: StorefrontDesignBriefContract) {
  if (!brief.approvedEvidenceFingerprint || !brief.approval.actorId) {
    throw new Error("The commercial acceptance brief must be authoritatively approved.");
  }
  const reference: PageFactEvidenceReference = {
    source: "approved-source-evidence",
    authorityId: ABOUT_EVIDENCE_ID,
    revision: String(brief.revision),
    status: "approved",
    approvalAuthorityId: brief.id,
    approvalFingerprint: brief.approvedEvidenceFingerprint,
  };
  const document = createContentSupportFactDocument({ evidence: reference, payload: aboutPayload });
  const pageEvidenceAuthority: PageFactEvidenceAuthority = Object.freeze({
    resolve({
      reference: input,
      familyId,
    }: {
      reference: PageFactEvidenceRequest;
      familyId: PageFamilyId;
    }) {
      const request = pageFactEvidenceRequestSchema.parse(input);
      if (familyId !== "about" || request.authorityId !== reference.authorityId) {
        throw new PageFactEvidenceAuthorityError(
          "unknown-evidence-authority",
          "No approved P10B-16P-04J evidence exists for the requested page family.",
        );
      }
      if (request.source !== reference.source) {
        throw new PageFactEvidenceAuthorityError(
          "evidence-source-mismatch",
          "The P10B-16P-04J evidence source does not match current authority.",
        );
      }
      if (request.revision !== reference.revision) {
        throw new PageFactEvidenceAuthorityError(
          "stale-evidence-revision",
          "The P10B-16P-04J evidence revision is stale.",
        );
      }
      return structuredClone(reference);
    },
  });
  const contentFactAuthority: ContentSupportFactAuthority = Object.freeze({
    resolve({
      familyId,
      reference: input,
    }: Readonly<{
      familyId: ContentSupportPageFamilyId;
      reference: PageFactEvidenceRequest;
    }>) {
      const request = pageFactEvidenceRequestSchema.parse(input);
      if (familyId !== "about") {
        throw new ContentSupportFactAuthorityError(
          "unsupported-content-family",
          "Only the approved Aurum About fact is available in P10B-16P-04J.",
        );
      }
      if (request.authorityId !== document.id) {
        throw new ContentSupportFactAuthorityError(
          "unknown-evidence-authority",
          "The requested P10B-16P-04J content fact does not exist.",
        );
      }
      if (request.revision !== document.evidence.revision) {
        throw new ContentSupportFactAuthorityError(
          "stale-evidence-revision",
          "The requested P10B-16P-04J content fact is stale.",
        );
      }
      return structuredClone(document);
    },
  });
  return Object.freeze({ reference, document, pageEvidenceAuthority, contentFactAuthority });
}

function page(input: StorefrontSiteMapDecision["pages"][number]) {
  return input;
}

function routeSlug(productId: string): string {
  return productId.replace(/^product_/u, "").replaceAll("_", "-");
}

function createSiteMapDecision(
  catalogue: CatalogueDisplayModel,
  aboutReference: PageFactEvidenceReference,
): StorefrontSiteMapDecision {
  const localeCoverage = ["en", "fi"] as const;
  const common = {
    familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
    profileVersion: "1.0.0" as const,
    localeCoverage: [...localeCoverage],
  };
  const metadata = (
    title: { en: string; fi: string },
    description: { en: string; fi: string },
  ) => ({
    title,
    seo: { title, metaDescription: description },
  });
  const collectionKeys = new Map(
    catalogue.collections.map(({ id, slug }) => [id, `p10b16p04j-collection-${slug}`]),
  );
  const parentKeyByProductId = new Map<string, string>();
  for (const collection of catalogue.collections) {
    for (const productId of collection.productIds) {
      if (!parentKeyByProductId.has(productId)) {
        parentKeyByProductId.set(productId, collectionKeys.get(collection.id)!);
      }
    }
  }
  const home = page({
    key: "p10b16p04j-home",
    familyId: "home",
    familyVersion: common.familyVersion,
    route: "/",
    required: true,
    profile: { id: "blueprint-site-map-home-baseline", version: common.profileVersion },
    localeCoverage: common.localeCoverage,
    ...metadata(
      localized("Home", "Etusivu"),
      localized(
        "Nordic jewellery and watches with lasting character.",
        "Pohjoismaisia koruja ja kelloja, joissa on kestävää luonnetta.",
      ),
    ),
    commerceContext: { kind: "none" },
    navigation: [{ area: "primary", order: 0, label: localized("Home", "Etusivu") }],
    existingPageId: RAW_HOME_PAGE_ID,
    evidenceReferences: [],
  });
  const collectionPages = catalogue.collections.map((collection, index) => {
    const title = localizedValue(collection.title, collection.id);
    const description = localizedValue(collection.description, title.en);
    return page({
      key: collectionKeys.get(collection.id)!,
      familyId: "collection",
      familyVersion: common.familyVersion,
      route: `/collections/${collection.slug}`,
      required: true,
      profile: { id: "blueprint-site-map-collection-baseline", version: common.profileVersion },
      localeCoverage: common.localeCoverage,
      ...metadata(title, description),
      commerceContext: { kind: "collection", collectionId: collection.id },
      navigation: [{ area: "primary", order: index + 1, label: title }],
      evidenceReferences: [],
    });
  });
  const search = page({
    key: "p10b16p04j-search",
    familyId: "search-results",
    familyVersion: common.familyVersion,
    route: "/search",
    required: true,
    profile: { id: "blueprint-site-map-search-baseline", version: common.profileVersion },
    localeCoverage: common.localeCoverage,
    ...metadata(localized("Search", "Haku"), localized("Search", "Haku")),
    commerceContext: { kind: "search" },
    navigation: [
      {
        area: "primary",
        order: collectionPages.length + 1,
        label: localized("Search", "Haku"),
      },
    ],
    evidenceReferences: [],
  });
  const productPages = catalogue.products.map((product) => {
    const title = localizedValue(product.title, product.id);
    const description = localizedValue(product.description ?? product.title, title.en);
    const parentKey = parentKeyByProductId.get(product.id);
    return page({
      key: `p10b16p04j-${routeSlug(product.id)}`,
      familyId: "product-detail",
      familyVersion: common.familyVersion,
      route: `/products/${routeSlug(product.id)}`,
      required: true,
      profile: { id: "blueprint-site-map-product-baseline", version: common.profileVersion },
      localeCoverage: common.localeCoverage,
      ...metadata(title, description),
      commerceContext: { kind: "product", productId: product.id },
      navigation: [],
      ...(parentKey ? { parentKey } : {}),
      evidenceReferences: [],
    });
  });
  const utilityPages = (
    [
      ["cart", "/cart", "commerce-utility-cart", "Cart", "Ostoskori"],
      ["checkout", "/checkout", "commerce-utility-checkout", "Checkout", "Kassa"],
      [
        "no-results",
        "/states/no-results",
        "commerce-utility-no-results",
        "No results",
        "Ei tuloksia",
      ],
      ["empty-state", "/states/empty", "commerce-utility-empty", "Empty", "Tyhjä"],
      ["error-state", "/states/error", "commerce-utility-error", "Error", "Virhe"],
      ["not-found", "/404", "commerce-utility-not-found", "Not found", "Ei löytynyt"],
    ] as const
  ).map(([familyId, route, profileId, en, fi]) =>
    page({
      key: `p10b16p04j-${familyId}`,
      familyId,
      familyVersion: common.familyVersion,
      route,
      required: true,
      profile: { id: profileId, version: common.profileVersion },
      localeCoverage: common.localeCoverage,
      ...metadata(localized(en, fi), localized(en, fi)),
      commerceContext: { kind: "none" },
      navigation: [],
      evidenceReferences: [],
    }),
  );
  const about = page({
    key: "p10b16p04j-about",
    familyId: "about",
    familyVersion: common.familyVersion,
    route: "/pages/about",
    required: true,
    profile: { id: "content-about-story", version: common.profileVersion },
    localeCoverage: common.localeCoverage,
    ...metadata(aboutPayload.title, aboutPayload.introduction),
    commerceContext: { kind: "none" },
    navigation: [{ area: "footer", order: 0, label: localized("About", "Meistä") }],
    evidenceReferences: [
      {
        source: aboutReference.source,
        authorityId: aboutReference.authorityId,
        revision: aboutReference.revision,
      },
    ],
  });
  return storefrontSiteMapDecisionSchema.parse({
    schemaVersion: 1,
    projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
    localeCoverage: [...localeCoverage],
    sharedFrame: SITE_MAP_SHARED_FRAME,
    pages: [home, ...collectionPages, search, ...productPages, ...utilityPages, about],
  });
}

function snapshotWithDynamicAuthority(
  snapshot: StorefrontSnapshot,
  dynamicCommercePresentation: NonNullable<StorefrontSnapshot["dynamicCommercePresentation"]>,
) {
  return storefrontSnapshotSchema.parse({
    ...structuredClone(snapshot),
    dynamicCommercePresentation: structuredClone(dynamicCommercePresentation),
  });
}

function buildFixture() {
  const catalogue = createP10B16P04ApprovedCatalogue();
  const initialAggregate = createProjectAggregate(catalogue);
  const initialRawDraft = initialAggregate.snapshots.find(
    ({ id }) => id === P10B16P04_COMMERCIAL_DRAFT_ID,
  )!;
  const initialPublished = initialAggregate.snapshots.find(
    ({ id }) => id === P10B16P04_COMMERCIAL_PUBLISHED_ID,
  )!;
  const { brief, sourceEvidenceMaterial } = createApprovedBrief(catalogue);
  const assetContext = approvedAssetContext(brief);
  const aboutAuthority = createAboutAuthority(brief);
  const siteMapDecision = createSiteMapDecision(catalogue, aboutAuthority.reference);
  const aboutPageDecision = siteMapDecision.pages.find(({ familyId }) => familyId === "about");
  const editorialAsset = assetContext.assets.find(({ role }) => role === "editorialImage");
  if (!aboutPageDecision || !editorialAsset) {
    throw new Error("P10B-16P-04J requires one About page and approved editorial asset.");
  }
  const aboutPageId = `page_${canonicalValueFingerprint({
    projectId: siteMapDecision.projectId,
    familyId: aboutPageDecision.familyId,
    route: aboutPageDecision.route,
  }).slice(-24)}`;
  const aboutSectionId = `section_${canonicalValueFingerprint({
    pageId: aboutPageId,
    slotId: "approved-content-support",
  }).slice(-24)}`;
  const requiredAssetPlacements = [
    approvedAssetPlacementOperationSchema.parse({
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: aboutPageId,
      componentId: aboutSectionId,
      componentType: "contentSupport",
      assetSlotId: "contentSupportMedia",
      assetId: editorialAsset.assetId,
      role: editorialAsset.role,
      assetRevision: editorialAsset.revision,
      materialFingerprint: editorialAsset.materialFingerprint,
      sourceReferenceId: editorialAsset.sourceReferenceId,
      sourceProvenanceKind: "sourceDiscovered",
      required: false,
    }),
  ];
  const initialPlanningInput = wholeStorefrontPlanningInputSchema.parse({
    brief,
    project: {
      id: initialAggregate.project.id,
      revision: initialAggregate.project.revision,
      enabledLocales: initialAggregate.project.enabledLocales,
    },
    draft: initialRawDraft,
    catalogue,
    componentDefinitions: structuredClone(veskifyComponentDefinitionsV2),
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: assetContext,
    requiredAssetPlacements,
  });
  const approvedAssetPresentations: ApprovedAssetPresentation[] = assetContext.assets.map(
    (asset) => {
      const definition = approvedAssetDefinitions.find(({ assetId }) => assetId === asset.assetId);
      if (!definition) throw new Error(`Missing approved Aurum asset ${asset.assetId}.`);
      return {
        assetId: asset.assetId,
        role: asset.role,
        revision: asset.revision,
        materialFingerprint: asset.materialFingerprint,
        asset: {
          id: asset.assetId,
          url: definition.fileUrl,
          alt: asset.alt ?? undefined,
          decorative: asset.presentation.decorative,
        },
      };
    },
  );
  const approvedBriefReference: PageFactEvidenceReference = {
    source: "merchant-approved",
    authorityId: brief.id,
    revision: String(brief.revision),
    status: "approved",
    approvalAuthorityId: brief.approval.actorId!,
    approvalFingerprint: brief.approvedEvidenceFingerprint!,
  };
  const approvedEvidenceReferences = [approvedBriefReference, aboutAuthority.reference];
  const authoritySource = executeCoordinatedDirection({
    planningInput: initialPlanningInput,
    siteMapDecision,
    approvedEvidenceReferences,
    pageEvidenceAuthority: aboutAuthority.pageEvidenceAuthority,
    contentFactAuthority: aboutAuthority.contentFactAuthority,
    approvedAssetPresentations,
    directionRequest: {
      directionId: "minimal-commerce",
      deterministicSeed: "p10b16p04j-raw-dynamic-commerce-authority-v1",
    },
  });
  const dynamicCommercePresentation =
    authoritySource.synthesis.materialization.snapshot.dynamicCommercePresentation;
  if (!dynamicCommercePresentation) {
    throw new Error("P10B-16P-04J requires current dynamic-commerce authority.");
  }
  const rawDraft = snapshotWithDynamicAuthority(initialRawDraft, dynamicCommercePresentation);
  const published = snapshotWithDynamicAuthority(initialPublished, dynamicCommercePresentation);
  validateRegisteredSnapshot(rawDraft, catalogue, "en", "en", ["en", "fi"]);
  validateRegisteredSnapshot(published, catalogue, "en", "en", ["en", "fi"]);
  const aggregate = validateProjectAggregate({
    project: structuredClone(initialAggregate.project),
    catalogue: structuredClone(catalogue),
    snapshots: [rawDraft, published],
  });
  const planningInput = wholeStorefrontPlanningInputSchema.parse({
    ...structuredClone(initialPlanningInput),
    draft: structuredClone(rawDraft),
  });
  return Object.freeze({
    fixtureId: FIXTURE_ID,
    aggregate,
    rawDraft: structuredClone(rawDraft),
    brief: structuredClone(brief),
    sourceEvidenceMaterial: structuredClone(sourceEvidenceMaterial),
    planningInput,
    executionPlanningInput: structuredClone(planningInput),
    siteMapDecision: structuredClone(siteMapDecision),
    approvedEvidenceReferences: structuredClone(approvedEvidenceReferences),
    pageEvidenceAuthority: aboutAuthority.pageEvidenceAuthority,
    contentFactAuthority: aboutAuthority.contentFactAuthority,
    approvedAssetPresentations: structuredClone(approvedAssetPresentations),
    aboutFactDocument: structuredClone(aboutAuthority.document),
  });
}

export type P10B16P04RawAurumCommercialFixture = ReturnType<typeof buildFixture>;

let cachedFixture: P10B16P04RawAurumCommercialFixture | undefined;

export function createP10B16P04RawAurumCommercialFixture(): P10B16P04RawAurumCommercialFixture {
  cachedFixture ??= buildFixture();
  return Object.freeze({
    fixtureId: cachedFixture.fixtureId,
    aggregate: structuredClone(cachedFixture.aggregate),
    rawDraft: structuredClone(cachedFixture.rawDraft),
    brief: structuredClone(cachedFixture.brief),
    sourceEvidenceMaterial: structuredClone(cachedFixture.sourceEvidenceMaterial),
    planningInput: structuredClone(cachedFixture.planningInput),
    executionPlanningInput: structuredClone(cachedFixture.executionPlanningInput),
    siteMapDecision: structuredClone(cachedFixture.siteMapDecision),
    approvedEvidenceReferences: structuredClone(cachedFixture.approvedEvidenceReferences),
    pageEvidenceAuthority: cachedFixture.pageEvidenceAuthority,
    contentFactAuthority: cachedFixture.contentFactAuthority,
    approvedAssetPresentations: structuredClone(cachedFixture.approvedAssetPresentations),
    aboutFactDocument: structuredClone(cachedFixture.aboutFactDocument),
  });
}
