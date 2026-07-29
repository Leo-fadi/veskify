import { canonicalValueFingerprint } from "@/domain/storefront";

export const DESIGN_DIVERSITY_VIEWPORTS = [375, 768, 1024, 1440] as const;
export const DESIGN_DIVERSITY_LOCALES = ["en", "fi"] as const;
export const DESIGN_DIVERSITY_PAGE_TYPES = ["home", "collection", "product"] as const;
export const DESIGN_DIVERSITY_CONTENT_CASES = [
  "oneCollection",
  "multipleCollections",
  "smallProductCount",
  "largeProductCount",
  "missingOptionalMedia",
] as const;

export type DesignDirectionId = "premiumEditorial" | "modernTechnical" | "warmApproachable";
export type DiversityViewport = (typeof DESIGN_DIVERSITY_VIEWPORTS)[number];
export type DiversityLocale = (typeof DESIGN_DIVERSITY_LOCALES)[number];
export type DiversityPageType = (typeof DESIGN_DIVERSITY_PAGE_TYPES)[number];
export type DiversityContentCaseId = (typeof DESIGN_DIVERSITY_CONTENT_CASES)[number];

type DirectionIdentity = { recipeId: string; tokenIdentity: string };
type PageStructure = DirectionIdentity & {
  directionId: string;
  sections: readonly string[];
  composition: string;
};
type LocaleEvidence = { merchantVisibleText: string; leakage: readonly string[] };
type ResponsiveResult = {
  horizontalOverflow: boolean;
  clipping: boolean;
  overlap: boolean;
  invalidEmptySpace: boolean;
  layoutProbePassed: boolean;
  screenshotReview: "passed" | "failed" | "notRequired";
  manualReview: "passed" | "failed" | "notRequired";
};
type AssetOwner = { kind: "product" | "collection" | "storefront"; id?: string };
type ApprovedAsset = {
  assetId: string;
  role: string;
  owner: AssetOwner;
  provenance: string;
};
type AssetUse = {
  assetId: string;
  approvedRole: string;
  actualRole: string;
  approvedOwner: AssetOwner;
  bindingTarget: AssetOwner;
  provenance: string;
};

export type DesignDiversityFixture = {
  directionId: string;
  selectedDirection: DirectionIdentity;
  pages: {
    home: PageStructure & {
      hero: string;
      navigation: string;
      collectionDiscovery: string;
      productCards: string;
      storyTrustCampaign: string;
    };
    collection: PageStructure & { discovery: string; structure: string; productCard: string };
    product: PageStructure & { gallery: string; information: string; options: string };
  };
  designSystem: {
    colours: string;
    typography: string;
    spacingDensity: string;
    shapeRadius: string;
    borderSurfaceElevation: string;
    imageTreatment: string;
  };
  responsive: Record<DiversityViewport, Record<DiversityPageType, ResponsiveResult>>;
  localePresentation: Record<DiversityLocale, Record<DiversityPageType, LocaleEvidence>>;
  forbiddenLocaleTerms: readonly string[];
  contentCases: readonly {
    id: DiversityContentCaseId;
    unexplainedEmptyAreas: number;
  }[];
  protectedCommerce: unknown;
  approvedAssets: readonly ApprovedAsset[];
  assetUses: readonly AssetUse[];
};

export type DiversityFailure = {
  pair?: readonly [string, string];
  code: string;
  message: string;
};

export type ScreenshotMatrixEntry = {
  directionId: string;
  pageType: DiversityPageType;
  locale: DiversityLocale;
  viewport: DiversityViewport;
  contentCaseId: DiversityContentCaseId;
  snapshotName: string;
};

export type DiversityEvaluation = {
  pass: boolean;
  failures: readonly DiversityFailure[];
  fingerprints: Readonly<Record<string, string>>;
  screenshotMatrix: readonly ScreenshotMatrixEntry[];
};

const EXPECTED_DIRECTIONS = ["premiumEditorial", "modernTechnical", "warmApproachable"] as const;
const NON_COLOUR_GROUPS = [
  "typography",
  "spacingDensity",
  "shapeRadius",
  "borderSurfaceElevation",
  "imageTreatment",
] as const;
const INTERNAL_LOCALE_PATTERN =
  /(?:puck|component|recipe|provider|fixture|[a-z]+(?:Recipe|Component)\b)/i;
const REQUIRED_REGIONS: Record<DiversityPageType, readonly string[]> = {
  home: ["header", "hero", "footer"],
  collection: ["header", "productGrid", "footer"],
  product: ["header", "productDetail", "footer"],
};

function fingerprint(value: unknown): string {
  return canonicalValueFingerprint(value);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function sameOwner(left: AssetOwner, right: AssetOwner): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function pageDimensions(
  pageType: DiversityPageType,
  fixture: DesignDiversityFixture,
): readonly string[] {
  if (pageType === "home") {
    const page = fixture.pages.home;
    return [
      fingerprint(page.sections),
      normalize(page.hero),
      normalize(page.navigation),
      normalize(page.collectionDiscovery),
      normalize(page.productCards),
      normalize(page.storyTrustCampaign),
    ];
  }
  if (pageType === "collection") {
    const page = fixture.pages.collection;
    return [normalize(page.discovery), normalize(page.structure), normalize(page.productCard)];
  }
  const page = fixture.pages.product;
  return [normalize(page.gallery), normalize(page.information), normalize(page.options)];
}

function pairs<T>(values: readonly T[]): readonly (readonly [T, T])[] {
  return values.flatMap((left, index) =>
    values.slice(index + 1).map((right) => [left, right] as const),
  );
}

function add(
  failures: DiversityFailure[],
  code: string,
  message: string,
  pair?: readonly [string, string],
) {
  failures.push({ code, message, ...(pair ? { pair } : {}) });
}

export function createDesignDiversityScreenshotMatrix(
  fixtures: readonly DesignDiversityFixture[],
): readonly ScreenshotMatrixEntry[] {
  return fixtures.flatMap((fixture) =>
    DESIGN_DIVERSITY_CONTENT_CASES.flatMap((contentCaseId) =>
      DESIGN_DIVERSITY_PAGE_TYPES.flatMap((pageType) =>
        DESIGN_DIVERSITY_LOCALES.flatMap((locale) =>
          DESIGN_DIVERSITY_VIEWPORTS.map((viewport) => ({
            directionId: fixture.directionId,
            pageType,
            locale,
            viewport,
            contentCaseId,
            snapshotName: `${fixture.directionId}-${contentCaseId}-${pageType}-${locale}-${viewport}`,
          })),
        ),
      ),
    ),
  );
}

/** Test-only P9-04D acceptance gate over normalized generated-storefront evidence. */
export function evaluateDesignDiversity(
  fixtures: readonly DesignDiversityFixture[],
  canonicalCommerceBaseline: unknown,
): DiversityEvaluation {
  const failures: DiversityFailure[] = [];
  const byId = new Map<string, DesignDiversityFixture>();
  for (const fixture of fixtures) {
    if (!EXPECTED_DIRECTIONS.includes(fixture.directionId as DesignDirectionId)) {
      add(failures, "unknown-direction", `Unknown direction ${fixture.directionId}.`);
    } else if (byId.has(fixture.directionId)) {
      add(failures, "duplicate-direction", `Duplicate ${fixture.directionId} acceptance fixture.`);
    } else {
      byId.set(fixture.directionId, fixture);
    }
  }
  for (const directionId of EXPECTED_DIRECTIONS) {
    if (!byId.has(directionId))
      add(failures, "missing-direction", `Missing ${directionId} acceptance fixture.`);
  }

  const baselineFingerprint = fingerprint(canonicalCommerceBaseline);
  for (const fixture of byId.values()) {
    if (fingerprint(fixture.protectedCommerce) !== baselineFingerprint) {
      add(
        failures,
        "protected-commerce-changed",
        `${fixture.directionId} differs from the canonical commerce baseline.`,
      );
    }
    for (const pageType of DESIGN_DIVERSITY_PAGE_TYPES) {
      const page = fixture.pages[pageType];
      const requiredRegions = REQUIRED_REGIONS[pageType];
      if (
        !page.sections.length ||
        requiredRegions.some((region) => !page.sections.includes(region))
      ) {
        add(
          failures,
          "incomplete-page-structure",
          `${fixture.directionId} ${pageType} is incomplete.`,
        );
      }
      if (
        page.directionId !== fixture.directionId ||
        page.recipeId !== fixture.selectedDirection.recipeId ||
        page.tokenIdentity !== fixture.selectedDirection.tokenIdentity
      ) {
        add(
          failures,
          "incoherent-direction",
          `${fixture.directionId} ${pageType} does not match its selected direction identity.`,
        );
      }
      for (const locale of DESIGN_DIVERSITY_LOCALES) {
        const evidence = fixture.localePresentation[locale][pageType];
        if (
          !evidence.merchantVisibleText.trim() ||
          evidence.leakage.length > 0 ||
          INTERNAL_LOCALE_PATTERN.test(evidence.merchantVisibleText) ||
          fixture.forbiddenLocaleTerms.some((term) =>
            evidence.merchantVisibleText
              .toLocaleLowerCase("en-US")
              .includes(term.toLocaleLowerCase("en-US")),
          )
        ) {
          add(
            failures,
            "unsafe-locale-presentation",
            `${fixture.directionId} ${pageType} has unsafe ${locale} content.`,
          );
        }
      }
      for (const viewport of DESIGN_DIVERSITY_VIEWPORTS) {
        const result = fixture.responsive[viewport][pageType];
        if (
          result.horizontalOverflow ||
          result.clipping ||
          result.overlap ||
          result.invalidEmptySpace ||
          !result.layoutProbePassed ||
          result.screenshotReview === "failed" ||
          result.manualReview === "failed"
        ) {
          add(
            failures,
            "responsive-layout-failure",
            `${fixture.directionId} ${pageType} fails at ${viewport}px.`,
          );
        }
      }
    }
    const cases = new Map(fixture.contentCases.map((contentCase) => [contentCase.id, contentCase]));
    for (const requiredCase of DESIGN_DIVERSITY_CONTENT_CASES) {
      const contentCase = cases.get(requiredCase);
      if (!contentCase) {
        add(
          failures,
          "missing-content-count-case",
          `${fixture.directionId} is missing ${requiredCase}.`,
        );
      } else if (
        !Number.isFinite(contentCase.unexplainedEmptyAreas) ||
        !Number.isInteger(contentCase.unexplainedEmptyAreas) ||
        contentCase.unexplainedEmptyAreas < 0
      ) {
        add(
          failures,
          "invalid-empty-area-measurement",
          `${fixture.directionId} ${requiredCase} has an invalid empty-area measurement.`,
        );
      } else if (contentCase.unexplainedEmptyAreas > 0) {
        add(
          failures,
          "unexplained-empty-area",
          `${fixture.directionId} ${requiredCase} contains unexplained empty layout areas.`,
        );
      }
    }
    for (const use of fixture.assetUses) {
      const approved = fixture.approvedAssets.find((asset) => asset.assetId === use.assetId);
      if (!approved) {
        add(failures, "unapproved-asset", `${fixture.directionId} uses an unapproved asset.`);
      } else if (
        approved.role !== use.approvedRole ||
        approved.role !== use.actualRole ||
        !sameOwner(approved.owner, use.approvedOwner) ||
        !sameOwner(approved.owner, use.bindingTarget) ||
        approved.provenance !== use.provenance
      ) {
        add(
          failures,
          "invalid-asset-assignment",
          `${fixture.directionId} binds an asset outside its approved role, owner or provenance.`,
        );
      }
    }
  }

  const available = EXPECTED_DIRECTIONS.flatMap((id) => {
    const fixture = byId.get(id);
    return fixture ? [fixture] : [];
  });
  for (const [left, right] of pairs(available)) {
    const pair = [left.directionId, right.directionId] as const;
    for (const pageType of DESIGN_DIVERSITY_PAGE_TYPES) {
      const dimensions = pageDimensions(pageType, left);
      const compared = pageDimensions(pageType, right);
      if (dimensions.some((dimension, index) => dimension === compared[index])) {
        add(
          failures,
          `${pageType}-dimension-same`,
          `${pair.join(" and ")} share a required ${pageType} dimension.`,
          pair,
        );
      }
    }
    const changedGroups = NON_COLOUR_GROUPS.filter(
      (group) => normalize(left.designSystem[group]) !== normalize(right.designSystem[group]),
    );
    if (changedGroups.length < 2) {
      add(
        failures,
        "insufficient-non-colour-difference",
        `${pair.join(" and ")} differ in only ${changedGroups.length} non-colour design-system groups.`,
        pair,
      );
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    fingerprints: Object.fromEntries(
      available.map((fixture) => [
        fixture.directionId,
        fingerprint({
          pages: fixture.pages,
          designSystem: fixture.designSystem,
          responsive: fixture.responsive,
          localePresentation: fixture.localePresentation,
        }),
      ]),
    ),
    screenshotMatrix: createDesignDiversityScreenshotMatrix(available),
  };
}
