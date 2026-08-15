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
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import { validateRegisteredSnapshot, veskifyComponentDefinitionsV2 } from "@/components/registry";
import { karvonenSeed } from "@/data/seed/karvonen";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemSchema } from "@/domain/design-system";
import { projectSchema } from "@/domain/project";
import {
  storefrontSourceEvidenceMaterialSchema,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import {
  PAGE_FAMILY_AUTHORITY_VERSION,
  SITE_MAP_SHARED_FRAME,
  createContentSupportFactDocument,
  pageFactEvidenceRequestSchema,
  storefrontSnapshotSchema,
  type ContentSupportFactDocument,
  type ContentSupportPageFamilyId,
  type PageFactEvidenceReference,
  type PageFactEvidenceRequest,
  type PageFamilyId,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  P10B16_RAW_KARVONEN_CATALOGUE_ID,
  P10B16_RAW_KARVONEN_DRAFT_ID,
  P10B16_RAW_KARVONEN_PROJECT_ID,
  P10B16_RAW_KARVONEN_PUBLISHED_ID,
} from "@/data/demo/p10b-16-raw-karvonen-identity";
import type { LocalizedText } from "@/domain/shared";
import type { ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

export const P10B16L_FIXTURE_ID = "p10b16l-karvonen-live-provider-acceptance";
export const P10B16L_PROJECT_ID = P10B16_RAW_KARVONEN_PROJECT_ID;
export const P10B16L_CATALOGUE_ID = P10B16_RAW_KARVONEN_CATALOGUE_ID;
export const P10B16L_DRAFT_ID = P10B16_RAW_KARVONEN_DRAFT_ID;
export const P10B16L_PUBLISHED_ID = P10B16_RAW_KARVONEN_PUBLISHED_ID;
export const P10B16L_BRIEF_ID = "brief_p10b16l_karvonen_raw";
export const P10B16L_RAW_HOME_PAGE_ID = "page_p10b16l_karvonen_raw_home";
/** Merchant-visible route count in the complete acceptance site map. */
export const P10B16L_CORE_PAGE_COUNT = 28;
/** Persisted static PageModels after compact dynamic-commerce migration. */
export const P10B16L_STATIC_DESIGN_PAGE_COUNT = 8;
export const P10B16L_DYNAMIC_ROUTE_COUNT = 20;
export const P10B16L_PREMIUM_EDITORIAL_COLLECTION_SEARCH_ARCHETYPE_COUNT = 3;
export const P10B16L_PREMIUM_EDITORIAL_PRODUCT_DETAIL_ARCHETYPE_COUNT = 4;
export const P10B16L_MAX_COLLECTION_SEARCH_ARCHETYPE_COUNT = 4;
export const P10B16L_MAX_PRODUCT_DETAIL_ARCHETYPE_COUNT = 5;

const FIXED_TIME = "2026-08-10T09:00:00.000Z";
const ABOUT_EVIDENCE_ID = "evidence_p10b16l_karvonen_about";

const baselineBrandSystem = brandSystemSchema.parse({
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

function localized(value: LocalizedText, fallback: string): { en: string; fi: string } {
  const canonicalFallback = value.fi ?? value.en ?? fallback;
  return {
    en: value.en ?? canonicalFallback,
    fi: value.fi ?? canonicalFallback,
  };
}

function projectLocalized(value: string): { en: string; fi: string } {
  return { en: value, fi: value };
}

function createCatalogue(): CatalogueDisplayModel {
  return catalogueDisplayModelSchema.parse({
    ...structuredClone(karvonenSeed.catalogue),
    id: P10B16L_CATALOGUE_ID,
  });
}

function createRawSnapshot(
  id: typeof P10B16L_DRAFT_ID | typeof P10B16L_PUBLISHED_ID,
  createdBy: "user" | "system",
): StorefrontSnapshot {
  const business = karvonenSeed.project.businessProfile;
  return storefrontSnapshotSchema.parse({
    id,
    projectId: P10B16L_PROJECT_ID,
    revision: 0,
    brandSystem: baselineBrandSystem,
    navigation: { primary: [], footer: [] },
    pages: [
      {
        id: P10B16L_RAW_HOME_PAGE_ID,
        type: "home",
        slug: "/",
        title: projectLocalized(business.name),
        seo: {
          title: projectLocalized(business.name),
          metaDescription: projectLocalized(business.description),
        },
        sections: [],
      },
    ],
    contentSupportFactDocuments: [],
    catalogueRef: P10B16L_CATALOGUE_ID,
    createdAt: FIXED_TIME,
    createdBy,
  });
}

/**
 * Supplies the two neutral legacy source sections required by the canonical shared-frame
 * promoter. Their registered default variants are replaced by the P10B-16 selected frame; this
 * prerequisite establishes no shared-frame, profile, direction, Design DNA or narrative choice.
 */
export function createP10B16LExecutionPlanningInput(
  rawPlanningInput: WholeStorefrontPlanningInput,
): WholeStorefrontPlanningInput {
  const raw = wholeStorefrontPlanningInputSchema.parse(structuredClone(rawPlanningInput));
  const rawHome = raw.draft.pages[0];
  if (
    raw.draft.pages.length !== 1 ||
    !rawHome ||
    rawHome.type !== "home" ||
    rawHome.sections.length !== 0 ||
    rawHome.pageFamily !== undefined ||
    raw.draft.sharedFrame !== undefined
  ) {
    throw new Error("P10B-16L execution preparation requires the exact raw reset snapshot.");
  }
  const brandName = karvonenSeed.project.businessProfile.name;
  const factualBrandName = projectLocalized(brandName);
  const preparedDraft = storefrontSnapshotSchema.parse({
    ...structuredClone(raw.draft),
    pages: [
      {
        ...structuredClone(rawHome),
        sections: [
          {
            id: "section_p10b16l_neutral_frame_header",
            component: "header",
            variant: "centered",
            visible: true,
            content: { brandName },
            props: { showSearch: true, showCart: true },
          },
          {
            id: "section_p10b16l_neutral_frame_footer",
            component: "footer",
            variant: "columns",
            visible: true,
            content: {
              brandName,
              contact: factualBrandName,
              policyLabel: factualBrandName,
              copyright: factualBrandName,
            },
            props: { showPolicies: false },
          },
        ],
      },
    ],
  });
  validateRegisteredSnapshot(preparedDraft, raw.catalogue, "fi", "fi", raw.project.enabledLocales);
  return wholeStorefrontPlanningInputSchema.parse({ ...raw, draft: preparedDraft });
}

function createAggregate(catalogue: CatalogueDisplayModel): ProjectAggregate {
  const publishedSnapshot = createRawSnapshot(P10B16L_PUBLISHED_ID, "system");
  const draftSnapshot = createRawSnapshot(P10B16L_DRAFT_ID, "user");
  const project = projectSchema.parse({
    ...structuredClone(karvonenSeed.project),
    id: P10B16L_PROJECT_ID,
    enabledLocales: ["en", "fi"],
    publishedSnapshotId: P10B16L_PUBLISHED_ID,
    draftSnapshotId: P10B16L_DRAFT_ID,
    revision: 0,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  });
  validateRegisteredSnapshot(publishedSnapshot, catalogue, "fi", "fi", ["en", "fi"]);
  validateRegisteredSnapshot(draftSnapshot, catalogue, "fi", "fi", ["en", "fi"]);
  return validateProjectAggregate({
    project,
    catalogue,
    snapshots: [publishedSnapshot, draftSnapshot],
  });
}

function createApprovedBrief(catalogue: CatalogueDisplayModel): StorefrontDesignBriefContract {
  const business = karvonenSeed.project.businessProfile;
  const materialEvidence = storefrontSourceEvidenceMaterialSchema.parse({
    sourceReferences: [],
    evidence: [],
    assetCandidates: [],
    reconciliation: null,
  });
  const pending = createStorefrontDesignBrief({
    id: P10B16L_BRIEF_ID,
    now: FIXED_TIME,
    businessIdentity: {
      businessName: business.name,
      shortDescription: business.description,
      industry: "jewellery",
      targetCustomer: business.audience,
      primaryMarket: business.market,
      secondaryMarkets: [],
    },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "fi" },
    sourceReferenceIds: [],
    sourceEvidenceIds: [],
    materialEvidence,
    canonicalCommerceProjectionRef: catalogue.id,
    // Minimal legacy brief vocabulary only; this is not a P10B coordinated-direction selection.
    approvedBrandDirection: {
      logoAssetRef: null,
      supportingImageAssetRefs: [],
      preferredBrandColours: [],
      typographyDirection: "sans-led",
      visualStyleDirection: "minimal",
      imageryDirection: "product-focused",
      toneKeywords: ["modern"],
    },
    approvedReusableAssetIds: [],
    approvedAssetAssignments: [],
    assetReviewFingerprint: null,
    pagePlan: { pageTypes: ["home", "collection", "product", "about"] },
    navigationDirection: [],
    homepageGoals: [],
    collectionPageGoals: [],
    productPageGoals: [],
    visualPriorities: [],
    contentAssumptions: [],
    unresolvedItems: [],
    materialUnresolvedBlockers: [],
    excludedClaims: [],
    generationPermissions: {
      allowMarketingCopy: false,
      allowAssetReuse: false,
      allowGeneratedImagery: false,
    },
  });
  return approveStorefrontDesignBrief(pending, {
    actorId: "merchant_p10b16l_karvonen",
    approvedAt: FIXED_TIME,
  });
}

function createAboutAuthority(brief: StorefrontDesignBriefContract): Readonly<{
  reference: PageFactEvidenceReference;
  document: ContentSupportFactDocument;
  pageEvidenceAuthority: PageFactEvidenceAuthority;
  contentFactAuthority: ContentSupportFactAuthority;
}> {
  const approvalFingerprint = brief.approvedEvidenceFingerprint;
  if (!approvalFingerprint || !brief.approval.actorId) {
    throw new Error("The P10B-16L fixture brief must be authoritatively approved.");
  }
  const business = karvonenSeed.project.businessProfile;
  const reference: PageFactEvidenceReference = {
    source: "approved-source-evidence",
    authorityId: ABOUT_EVIDENCE_ID,
    revision: String(brief.revision),
    status: "approved",
    approvalAuthorityId: brief.id,
    approvalFingerprint,
  };
  const exactName = projectLocalized(business.name);
  const exactDescription = projectLocalized(business.description);
  const document = createContentSupportFactDocument({
    evidence: reference,
    payload: {
      familyId: "about",
      title: exactName,
      introduction: exactDescription,
      blocks: [{ kind: "paragraph", id: "business-description", body: exactDescription }],
      story: {
        heading: exactName,
        body: exactDescription,
        steps: [],
      },
    },
  });
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
          "No approved P10B-16L evidence exists for the requested page family.",
        );
      }
      if (request.source !== reference.source) {
        throw new PageFactEvidenceAuthorityError(
          "evidence-source-mismatch",
          "The P10B-16L evidence source does not match current authority.",
        );
      }
      if (request.revision !== reference.revision) {
        throw new PageFactEvidenceAuthorityError(
          "stale-evidence-revision",
          "The P10B-16L evidence revision is stale.",
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
          "Only the evidence-backed Karvonen about fact is available.",
        );
      }
      if (request.authorityId !== document.id) {
        throw new ContentSupportFactAuthorityError(
          "unknown-evidence-authority",
          "The requested P10B-16L content fact does not exist.",
        );
      }
      if (request.revision !== document.evidence.revision) {
        throw new ContentSupportFactAuthorityError(
          "stale-evidence-revision",
          "The requested P10B-16L content fact is stale.",
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

function createSiteMapDecision(
  catalogue: CatalogueDisplayModel,
  aboutReference: PageFactEvidenceReference,
): StorefrontSiteMapDecision {
  const locales = ["en", "fi"] as const;
  const common = {
    familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
    profileVersion: "1.0.0" as const,
    localeCoverage: [...locales],
  };
  const metadata = (
    title: { en: string; fi: string },
    description: { en: string; fi: string },
  ) => ({
    title,
    seo: { title, metaDescription: description },
  });
  const collectionKeys = new Map(
    catalogue.collections.map((collection) => [
      collection.id,
      `p10b16l-collection-${collection.slug}`,
    ]),
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
    key: "p10b16l-home",
    familyId: "home",
    familyVersion: common.familyVersion,
    route: "/",
    required: true,
    profile: { id: "blueprint-site-map-home-baseline", version: common.profileVersion },
    localeCoverage: common.localeCoverage,
    ...metadata(
      projectLocalized(karvonenSeed.project.businessProfile.name),
      projectLocalized(karvonenSeed.project.businessProfile.description),
    ),
    commerceContext: { kind: "none" },
    navigation: [{ area: "primary", order: 0, label: { en: "Home", fi: "Etusivu" } }],
    existingPageId: P10B16L_RAW_HOME_PAGE_ID,
    evidenceReferences: [],
  });
  const collectionPages = catalogue.collections.map((collection, index) => {
    const title = localized(collection.title, collection.id);
    const description = localized(collection.description, title.fi);
    return page({
      key: collectionKeys.get(collection.id)!,
      familyId: "collection",
      familyVersion: common.familyVersion,
      route: `/collections/${collection.slug}`,
      required: true,
      profile: {
        id: "blueprint-site-map-collection-baseline",
        version: common.profileVersion,
      },
      localeCoverage: common.localeCoverage,
      ...metadata(title, description),
      commerceContext: { kind: "collection", collectionId: collection.id },
      navigation: [{ area: "primary", order: index + 1, label: title }],
      evidenceReferences: [],
    });
  });
  const search = page({
    key: "p10b16l-search",
    familyId: "search-results",
    familyVersion: common.familyVersion,
    route: "/search",
    required: true,
    profile: { id: "blueprint-site-map-search-baseline", version: common.profileVersion },
    localeCoverage: common.localeCoverage,
    ...metadata({ en: "Search", fi: "Haku" }, { en: "Search", fi: "Haku" }),
    commerceContext: { kind: "search" },
    navigation: [
      {
        area: "primary",
        order: collectionPages.length + 1,
        label: { en: "Search", fi: "Haku" },
      },
    ],
    evidenceReferences: [],
  });
  const productPages = catalogue.products.map((product) => {
    const title = localized(product.title, product.id);
    const description = localized(product.description ?? product.title, title.fi);
    const parentKey = parentKeyByProductId.get(product.id);
    return page({
      key: `p10b16l-${product.id.replaceAll("_", "-")}`,
      familyId: "product-detail",
      familyVersion: common.familyVersion,
      route: `/products/${product.id.replaceAll("_", "-")}`,
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
      key: `p10b16l-${familyId}`,
      familyId,
      familyVersion: common.familyVersion,
      route,
      required: true,
      profile: { id: profileId, version: common.profileVersion },
      localeCoverage: common.localeCoverage,
      ...metadata({ en, fi }, { en, fi }),
      commerceContext: { kind: "none" },
      navigation: [],
      evidenceReferences: [],
    }),
  );
  const aboutTitle = projectLocalized(karvonenSeed.project.businessProfile.name);
  const about = page({
    key: "p10b16l-about",
    familyId: "about",
    familyVersion: common.familyVersion,
    route: "/pages/about",
    // This acceptance fixture has exact approved About evidence, so the
    // complete-storefront acceptance page set must exercise it in every
    // coordinated direction rather than leaving it to an optional package.
    required: true,
    profile: { id: "content-about-story", version: common.profileVersion },
    localeCoverage: common.localeCoverage,
    ...metadata(aboutTitle, projectLocalized(karvonenSeed.project.businessProfile.description)),
    commerceContext: { kind: "none" },
    navigation: [{ area: "footer", order: 0, label: aboutTitle }],
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
    projectId: P10B16L_PROJECT_ID,
    localeCoverage: [...locales],
    sharedFrame: SITE_MAP_SHARED_FRAME,
    pages: [home, ...collectionPages, search, ...productPages, ...utilityPages, about],
  });
}

export type P10B16LRawKarvonenAcceptanceFixture = Readonly<{
  fixtureId: typeof P10B16L_FIXTURE_ID;
  aggregate: ProjectAggregate;
  rawDraft: StorefrontSnapshot;
  brief: StorefrontDesignBriefContract;
  planningInput: WholeStorefrontPlanningInput;
  executionPlanningInput: WholeStorefrontPlanningInput;
  siteMapDecision: StorefrontSiteMapDecision;
  approvedEvidenceReferences: readonly PageFactEvidenceReference[];
  pageEvidenceAuthority: PageFactEvidenceAuthority;
  contentFactAuthority: ContentSupportFactAuthority;
  approvedAssetPresentations: readonly ApprovedAssetPresentation[];
  aboutFactDocument: ContentSupportFactDocument;
}>;

/**
 * Deterministic raw Karvonen input for P10B-16L. It preserves canonical commerce/media while
 * intentionally supplying no preselected commercial frame, profile, section or Design DNA.
 */
export function createP10B16LRawKarvonenAcceptanceFixture(): P10B16LRawKarvonenAcceptanceFixture {
  const catalogue = createCatalogue();
  const aggregate = createAggregate(catalogue);
  const rawDraft = aggregate.snapshots.find(({ id }) => id === P10B16L_DRAFT_ID)!;
  const brief = createApprovedBrief(catalogue);
  const authority = createAboutAuthority(brief);
  const siteMapDecision = createSiteMapDecision(catalogue, authority.reference);
  const planningInput = wholeStorefrontPlanningInputSchema.parse({
    brief,
    project: {
      id: aggregate.project.id,
      revision: aggregate.project.revision,
      enabledLocales: aggregate.project.enabledLocales,
    },
    draft: rawDraft,
    catalogue,
    componentDefinitions: structuredClone(veskifyComponentDefinitionsV2),
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: null,
    requiredAssetPlacements: [],
  });
  const executionPlanningInput = createP10B16LExecutionPlanningInput(planningInput);
  const approvedBriefReference: PageFactEvidenceReference = {
    source: "merchant-approved",
    authorityId: brief.id,
    revision: String(brief.revision),
    status: "approved",
    approvalAuthorityId: brief.approval.actorId!,
    approvalFingerprint: brief.approvedEvidenceFingerprint!,
  };
  return Object.freeze({
    fixtureId: P10B16L_FIXTURE_ID,
    aggregate,
    rawDraft: structuredClone(rawDraft),
    brief,
    planningInput,
    executionPlanningInput,
    siteMapDecision,
    approvedEvidenceReferences: Object.freeze([approvedBriefReference, authority.reference]),
    pageEvidenceAuthority: authority.pageEvidenceAuthority,
    contentFactAuthority: authority.contentFactAuthority,
    approvedAssetPresentations: Object.freeze([]),
    aboutFactDocument: structuredClone(authority.document),
  });
}
