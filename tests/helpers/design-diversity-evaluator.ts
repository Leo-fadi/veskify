import { canonicalValueFingerprint } from "@/domain/storefront";

export const DESIGN_DIVERSITY_VIEWPORTS = [375, 768, 1024, 1440] as const;
export const DESIGN_DIVERSITY_LOCALES = ["en", "fi"] as const;
export const DESIGN_DIVERSITY_PAGE_TYPES = ["home", "collection", "product"] as const;

export type DesignDirectionId = "premiumEditorial" | "modernTechnical" | "warmApproachable";
export type DiversityViewport = (typeof DESIGN_DIVERSITY_VIEWPORTS)[number];
export type DiversityLocale = (typeof DESIGN_DIVERSITY_LOCALES)[number];
export type DiversityPageType = (typeof DESIGN_DIVERSITY_PAGE_TYPES)[number];

type PageStructure = {
  directionId: DesignDirectionId;
  sections: readonly string[];
  composition: string;
};

export type DesignDiversityFixture = {
  directionId: DesignDirectionId;
  pages: {
    home: PageStructure & { hero: string; navigation: string };
    collection: PageStructure & { discovery: string; productCard: string };
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
  responsive: Record<DiversityViewport, Record<DiversityPageType, string>>;
  localePresentation: Record<DiversityLocale, Record<DiversityPageType, string>>;
  contentCases: readonly {
    id:
      | "oneCollection"
      | "multipleCollections"
      | "smallProductCount"
      | "largeProductCount"
      | "missingOptionalMedia";
    unexplainedEmptyAreas: number;
  }[];
  protectedCommerce: unknown;
  approvedAssetIds: readonly string[];
  usedAssetIds: readonly string[];
};

export type DiversityFailure = {
  pair?: readonly [DesignDirectionId, DesignDirectionId];
  code: string;
  message: string;
};

export type DiversityEvaluation = {
  pass: boolean;
  failures: readonly DiversityFailure[];
  fingerprints: Readonly<Record<DesignDirectionId, string>>;
  screenshotMatrix: readonly ScreenshotMatrixEntry[];
};

export type ScreenshotMatrixEntry = {
  directionId: DesignDirectionId;
  pageType: DiversityPageType;
  locale: DiversityLocale;
  viewport: DiversityViewport;
  snapshotName: string;
};

const REQUIRED_CONTENT_CASES = [
  "oneCollection",
  "multipleCollections",
  "smallProductCount",
  "largeProductCount",
  "missingOptionalMedia",
] as const;

const NON_COLOUR_GROUPS = [
  "typography",
  "spacingDensity",
  "shapeRadius",
  "borderSurfaceElevation",
  "imageTreatment",
] as const;

function exactFingerprint(value: unknown): string {
  return canonicalValueFingerprint(value);
}

function structuralMaterial(fixture: DesignDiversityFixture) {
  return {
    pages: fixture.pages,
    designSystem: fixture.designSystem,
    responsive: fixture.responsive,
    localePresentation: fixture.localePresentation,
  };
}

function pageFingerprint(page: PageStructure): string {
  const presentation = Object.fromEntries(
    Object.entries(page).filter(([key]) => key !== "directionId"),
  );
  return exactFingerprint(presentation);
}

function pairs<T>(values: readonly T[]): readonly (readonly [T, T])[] {
  return values.flatMap((left, index) =>
    values.slice(index + 1).map((right) => [left, right] as const),
  );
}

export function createDesignDiversityScreenshotMatrix(
  fixtures: readonly DesignDiversityFixture[],
): readonly ScreenshotMatrixEntry[] {
  return fixtures.flatMap((fixture) =>
    DESIGN_DIVERSITY_PAGE_TYPES.flatMap((pageType) =>
      DESIGN_DIVERSITY_LOCALES.flatMap((locale) =>
        DESIGN_DIVERSITY_VIEWPORTS.map((viewport) => ({
          directionId: fixture.directionId,
          pageType,
          locale,
          viewport,
          snapshotName: `${fixture.directionId}-${pageType}-${locale}-${viewport}`,
        })),
      ),
    ),
  );
}

/**
 * Test-only acceptance evaluator. It intentionally evaluates normalized facts rather than pixels:
 * the screenshot runner supplies the same direction/page/locale/viewport matrix for visual review.
 */
export function evaluateDesignDiversity(
  fixtures: readonly DesignDiversityFixture[],
): DiversityEvaluation {
  const failures: DiversityFailure[] = [];
  const byId = new Map(fixtures.map((fixture) => [fixture.directionId, fixture]));
  const expectedDirections: readonly DesignDirectionId[] = [
    "premiumEditorial",
    "modernTechnical",
    "warmApproachable",
  ];

  for (const directionId of expectedDirections) {
    const fixture = byId.get(directionId);
    if (!fixture) {
      failures.push({
        code: "missing-direction",
        message: `Missing ${directionId} acceptance fixture.`,
      });
      continue;
    }

    for (const pageType of DESIGN_DIVERSITY_PAGE_TYPES) {
      if (fixture.pages[pageType].directionId !== directionId) {
        failures.push({
          code: "incoherent-direction",
          message: `${directionId} ${pageType} does not use its storefront direction.`,
        });
      }
      for (const locale of DESIGN_DIVERSITY_LOCALES) {
        if (!fixture.localePresentation[locale][pageType].trim()) {
          failures.push({
            code: "missing-locale-presentation",
            message: `${directionId} ${pageType} has no ${locale} presentation.`,
          });
        }
      }
      for (const viewport of DESIGN_DIVERSITY_VIEWPORTS) {
        if (!fixture.responsive[viewport][pageType].trim()) {
          failures.push({
            code: "missing-responsive-presentation",
            message: `${directionId} ${pageType} has no ${viewport}px presentation.`,
          });
        }
      }
    }

    const cases = new Map(fixture.contentCases.map((contentCase) => [contentCase.id, contentCase]));
    for (const requiredCase of REQUIRED_CONTENT_CASES) {
      const contentCase = cases.get(requiredCase);
      if (!contentCase) {
        failures.push({
          code: "missing-content-count-case",
          message: `${directionId} is missing ${requiredCase}.`,
        });
      } else if (contentCase.unexplainedEmptyAreas > 0) {
        failures.push({
          code: "unexplained-empty-area",
          message: `${directionId} ${requiredCase} contains unexplained empty layout areas.`,
        });
      }
    }

    const approved = new Set(fixture.approvedAssetIds);
    if (fixture.usedAssetIds.some((assetId) => !approved.has(assetId))) {
      failures.push({
        code: "unapproved-asset",
        message: `${directionId} uses an asset outside the approved set.`,
      });
    }
  }

  const available = expectedDirections.flatMap((id) => {
    const fixture = byId.get(id);
    return fixture ? [fixture] : [];
  });
  const protectedFingerprint = available[0]
    ? exactFingerprint(available[0].protectedCommerce)
    : undefined;
  for (const fixture of available.slice(1)) {
    if (exactFingerprint(fixture.protectedCommerce) !== protectedFingerprint) {
      failures.push({
        code: "protected-commerce-changed",
        message: `${fixture.directionId} changed protected commerce truth.`,
      });
    }
  }

  for (const [left, right] of pairs(available)) {
    const pair = [left.directionId, right.directionId] as const;
    if (pageFingerprint(left.pages.home) === pageFingerprint(right.pages.home)) {
      failures.push({
        pair,
        code: "homepage-structure-same",
        message: `${pair.join(" and ")} have the same homepage structure.`,
      });
    }
    if (pageFingerprint(left.pages.collection) === pageFingerprint(right.pages.collection)) {
      failures.push({
        pair,
        code: "collection-presentation-same",
        message: `${pair.join(" and ")} have the same collection presentation.`,
      });
    }
    if (pageFingerprint(left.pages.product) === pageFingerprint(right.pages.product)) {
      failures.push({
        pair,
        code: "product-presentation-same",
        message: `${pair.join(" and ")} have the same PDP presentation.`,
      });
    }
    const changedNonColourGroups = NON_COLOUR_GROUPS.filter(
      (group) => left.designSystem[group] !== right.designSystem[group],
    );
    if (changedNonColourGroups.length < 2) {
      failures.push({
        pair,
        code: "insufficient-non-colour-difference",
        message: `${pair.join(" and ")} differ in only ${changedNonColourGroups.length} non-colour design-system groups.`,
      });
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    fingerprints: Object.fromEntries(
      available.map((fixture) => [
        fixture.directionId,
        exactFingerprint(structuralMaterial(fixture)),
      ]),
    ) as Record<DesignDirectionId, string>,
    screenshotMatrix: createDesignDiversityScreenshotMatrix(available),
  };
}
