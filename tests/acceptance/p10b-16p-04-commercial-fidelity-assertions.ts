import { expect, type Locator, type Page } from "@playwright/test";
import type {
  P10B16P04CommercialEvidenceWidth,
  P10B16P04EvidenceIdentity,
  P10B16P04SafeSelection,
} from "./p10b-16p-04-visual-evidence";

export type SafeSelection = P10B16P04SafeSelection;

export type CommercialSurface = Readonly<{
  id:
    | "home"
    | "collection"
    | "simple-pdp"
    | "configurable-pdp"
    | "about"
    | "cart-empty"
    | "cart-populated";
  kind: P10B16P04EvidenceIdentity["representativeContext"]["kind"];
  route: string;
  contextId: string;
  profile: (selection: SafeSelection) => string;
  archetype?: (
    selection: SafeSelection,
  ) => SafeSelection["dynamicCommerce"]["selectedArchetypes"][keyof SafeSelection["dynamicCommerce"]["selectedArchetypes"]];
  selectInStudio: (page: Page, selection: SafeSelection) => Promise<void>;
}>;

function exactProfileId(value: string): string {
  return value.split("@")[0] ?? value;
}

function profileSelectionForSurface(selection: SafeSelection, surface: CommercialSurface) {
  const profileId = exactProfileId(surface.profile(selection));
  const selected = selection.pageProfileSelections.find(
    (candidate) => candidate.profileId === profileId,
  );
  if (!selected) throw new Error(`No exact PageBlueprint selection exists for ${surface.id}.`);
  return selected;
}

export function assertSelectedPremiumAuthority(selection: SafeSelection): void {
  expect(selection.directionId).toBe("premiumEditorial");
  expect(selection.sharedFrame.profileId).toBe("editorial-masthead");
  expect(selection.designDnaNonColour).toMatchObject({
    typography: {
      pairing: "serif-led",
      scale: { posture: "expressive", ratio: 1.333 },
      roles: {
        display: { font: "georgia" },
        heading: { font: "georgia" },
        body: { font: "inter" },
      },
    },
    spacing: {
      scale: "generous",
      sectionRhythm: "expansive",
      pageGutter: "generous",
      gridGap: "open",
      cardInset: "generous",
    },
    surfaces: {
      posture: "layered",
      border: "subtle",
      radius: "subtle",
      elevation: "raised",
    },
    controls: {
      primaryAction: "solid",
      height: "prominent",
      density: "spacious",
      shape: "subtle",
      emphasis: "balanced",
    },
    density: {
      posture: "spacious",
      navigation: "spacious",
      content: "spacious",
      commerce: "balanced",
    },
    media: {
      posture: "editorial",
      ratio: "portrait",
      crop: "editorial",
      overlay: "gradient",
      prominence: "leading",
    },
  });
  expect(["story-led", "campaign-led"]).toContain(selection.postures.narrative);
  expect(selection.postures).toMatchObject({
    merchandising: "curated",
    artDirection: "immersive",
  });
  expect(selection.semanticResolution).toMatchObject({
    finalCandidateCount: 1,
    substitutedSemanticPaths: [],
  });
  expect(selection.semanticResolution.initialCandidateCount).toBeGreaterThan(1);
  expect(selection.semanticResolution.acceptedSemanticPaths).toEqual(
    expect.arrayContaining([
      "commercialPosture",
      "globalVisualIntent.density",
      "sharedFrameIntent.navigationPosture",
      "homepageIntent.storyCatalogueBalance",
      "collectionIntent.discoveryPosture",
      "pdpIntent.configurableProductPosture",
      "responsiveAndArtDirectionIntent.mobileHierarchy",
      "responsiveAndArtDirectionIntent.imageProminence",
    ]),
  );
  expect(selection.responsiveArtDirection.responsiveMode).toBe(selection.postures.responsive);
  expect(selection.responsiveArtDirection.responsiveCapabilityKeys).toContain(
    selection.postures.responsive,
  );
  expect(selection.responsiveArtDirection.artDirectionCapabilityKeys).toContain(
    selection.postures.artDirection,
  );
  expect(selection.componentChoices.length).toBeGreaterThan(0);
  expect(selection.productCardAnatomyIds.length).toBeGreaterThan(0);
  const profileIds = new Set(selection.pageProfileSelections.map(({ profileId }) => profileId));
  for (const profileId of Object.values(selection.profiles))
    expect(profileIds).toContain(profileId);
  for (const profile of [
    ...selection.staticContentSupportSelections,
    ...selection.utilityPresentationSelections,
  ]) {
    expect(profileIds).toContain(exactProfileId(profile));
  }
  const homepage = selection.pageProfileSelections.find(
    ({ profileId }) => profileId === selection.profiles.homepage,
  );
  expect(homepage?.narrativeRoles).toEqual(selection.narrative.homepageRoleSequence);
}

export function assertSelectedModernTechnicalAuthority(selection: SafeSelection): void {
  expect(selection.directionId).toBe("modernTechnical");
  expect(selection.sharedFrame.profileId).toBe("compact-technical");
  expect([
    "homepage-commerce-led-discovery",
    "homepage-collection-gateway",
    "homepage-high-consideration",
    "homepage-minimal-brand-commerce",
  ]).toContain(selection.profiles.homepage);
  expect([
    "collection-catalogue-comparison",
    "collection-dense-search",
    "collection-editorial-discovery",
  ]).toContain(selection.profiles.collection);
  expect(["pdp-variant-led", "pdp-standard-commerce", "pdp-high-consideration"]).toContain(
    selection.profiles.productDetail,
  );
  expect(selection.designDnaNonColour).toMatchObject({
    typography: { pairing: "sans-led" },
    spacing: { scale: "compact" },
    controls: { density: "compact" },
    media: { posture: "product-led" },
  });
  expect(["discovery-led", "catalogue-dense", "considered-purchase"]).toContain(
    selection.postures.narrative,
  );
  expect(["discovery", "dense", "considered"]).toContain(selection.postures.merchandising);
  expect(["compact", "balanced"]).toContain(selection.postures.informationDensity);
  expect(["contained", "editorial"]).toContain(selection.postures.artDirection);
  expect(["commerce-first", "balanced"]).toContain(selection.postures.responsive);
  expect(selection.semanticResolution.finalCandidateCount).toBe(1);
  expect(selection.semanticResolution.initialCandidateCount).toBeGreaterThan(1);
  expect(selection.semanticResolution.acceptedSemanticPaths).toEqual(
    expect.arrayContaining([
      "commercialPosture",
      "globalVisualIntent.density",
      "homepageIntent.storyCatalogueBalance",
      "responsiveAndArtDirectionIntent.mobileHierarchy",
      "responsiveAndArtDirectionIntent.imageProminence",
    ]),
  );
  expect(selection.semanticResolution.substitutedSemanticPaths).toContain(
    "sharedFrameIntent.navigationPosture",
  );
  for (const substitutedPath of selection.semanticResolution.substitutedSemanticPaths) {
    expect([
      "sharedFrameIntent.navigationPosture",
      "collectionIntent.discoveryPosture",
      "pdpIntent.configurableProductPosture",
    ]).toContain(substitutedPath);
  }
  expect(selection.responsiveArtDirection.responsiveMode).toBe(selection.postures.responsive);
  expect(selection.componentChoices.length).toBeGreaterThan(0);
  expect(selection.productCardAnatomyIds.length).toBeGreaterThan(0);
  const profileIds = new Set(selection.pageProfileSelections.map(({ profileId }) => profileId));
  for (const profileId of Object.values(selection.profiles)) {
    expect(profileIds).toContain(profileId);
  }
  for (const profile of [
    ...selection.staticContentSupportSelections,
    ...selection.utilityPresentationSelections,
  ]) {
    expect(profileIds).toContain(exactProfileId(profile));
  }
  const homepage = selection.pageProfileSelections.find(
    ({ profileId }) => profileId === selection.profiles.homepage,
  );
  expect(homepage?.narrativeRoles).toEqual(selection.narrative.homepageRoleSequence);
}

export function assertSelectedMinimalCommerceAuthority(selection: SafeSelection): void {
  expect(selection.directionId).toBe("warmApproachable");
  expect(selection.sharedFrame.profileId).toBe("centered-minimal");
  expect([
    "homepage-minimal-brand-commerce",
    "homepage-high-consideration",
    "homepage-editorial-storytelling",
  ]).toContain(selection.profiles.homepage);
  expect(["collection-editorial-discovery", "collection-dense-search"]).toContain(
    selection.profiles.collection,
  );
  expect(["pdp-standard-commerce", "pdp-high-consideration"]).toContain(
    selection.profiles.productDetail,
  );
  expect(selection.designDnaNonColour).toMatchObject({
    typography: { pairing: "serif-led" },
    spacing: { scale: "balanced" },
    controls: { density: "balanced" },
    media: { posture: "restrained" },
  });
  expect(["restrained", "discovery-led", "considered-purchase"]).toContain(
    selection.postures.narrative,
  );
  expect(["restrained", "discovery", "considered"]).toContain(selection.postures.merchandising);
  expect(["balanced", "airy"]).toContain(selection.postures.informationDensity);
  expect(["contained", "editorial"]).toContain(selection.postures.artDirection);
  expect(["balanced", "commerce-first"]).toContain(selection.postures.responsive);
  expect(selection.semanticResolution.finalCandidateCount).toBe(1);
  expect(selection.semanticResolution.initialCandidateCount).toBeGreaterThan(1);
  expect(selection.semanticResolution.acceptedSemanticPaths).toEqual(
    expect.arrayContaining([
      "commercialPosture",
      "globalVisualIntent.density",
      "sharedFrameIntent.navigationPosture",
      "homepageIntent.storyCatalogueBalance",
      "responsiveAndArtDirectionIntent.imageProminence",
    ]),
  );
  expect(selection.semanticResolution.substitutedSemanticPaths).toContain(
    "responsiveAndArtDirectionIntent.mobileHierarchy",
  );
  for (const substitutedPath of selection.semanticResolution.substitutedSemanticPaths) {
    expect([
      "collectionIntent.discoveryPosture",
      "pdpIntent.configurableProductPosture",
      "responsiveAndArtDirectionIntent.mobileHierarchy",
    ]).toContain(substitutedPath);
  }
  expect(selection.responsiveArtDirection.responsiveMode).toBe(selection.postures.responsive);
  expect(selection.componentChoices.length).toBeGreaterThan(0);
  expect(selection.productCardAnatomyIds.length).toBeGreaterThan(0);
  const profileIds = new Set(selection.pageProfileSelections.map(({ profileId }) => profileId));
  for (const profileId of Object.values(selection.profiles)) {
    expect(profileIds).toContain(profileId);
  }
  for (const profile of [
    ...selection.staticContentSupportSelections,
    ...selection.utilityPresentationSelections,
  ]) {
    expect(profileIds).toContain(exactProfileId(profile));
  }
  const homepage = selection.pageProfileSelections.find(
    ({ profileId }) => profileId === selection.profiles.homepage,
  );
  expect(homepage?.narrativeRoles).toEqual(selection.narrative.homepageRoleSequence);
}

export async function assertExactSurfaceAuthority(input: {
  root: Locator;
  selection: SafeSelection;
  surface: CommercialSurface;
}): Promise<void> {
  const { root, selection, surface } = input;
  await expect(root.locator('[data-frame-region="header"]')).toHaveAttribute(
    "data-frame-profile",
    selection.sharedFrame.profileId,
  );
  await expect(root.locator('[data-frame-region="footer"]')).toHaveAttribute(
    "data-frame-profile",
    selection.sharedFrame.profileId,
  );
  if (surface.kind === "collection" || surface.kind === "product") {
    const archetype = surface.archetype?.(selection);
    if (!archetype) throw new Error(`${surface.id} has no exact dynamic-archetype evidence.`);
    const rendered = root.locator(`[data-component="${archetype.component}"]`);
    await expect(rendered).toHaveCount(1);
    await expect(rendered).toHaveAttribute("data-variant", archetype.variant);
    const cards = root.locator("[data-card-anatomy]");
    for (const card of await cards.all()) {
      const anatomy = await card.getAttribute("data-card-anatomy");
      expect(anatomy).toBe(archetype.anatomyId);
    }
    return;
  }
  const pageSelection = profileSelectionForSurface(selection, surface);
  const expectedChoices = selection.componentChoices.filter(
    ({ pageKey, component }) =>
      pageKey === pageSelection.pageKey && component !== "header" && component !== "footer",
  );
  expect(expectedChoices.length, `${surface.id} exact component authority`).toBeGreaterThan(0);
  for (const choice of expectedChoices) {
    if (choice.component === "commerceUtility") {
      await expect(root.locator("[data-utility-state]")).not.toHaveCount(0);
      continue;
    }
    await expect(
      root.locator(`[data-component="${choice.component}"][data-variant="${choice.variant}"]`),
      `${surface.id} must render ${choice.component}/${choice.variant}`,
    ).not.toHaveCount(0);
  }
  const expectedSequence = expectedChoices
    .filter(({ component }) => component !== "commerceUtility")
    .map(({ component, variant }) => ({ component, variant }));
  const expectedPairs = new Set(
    expectedSequence.map(({ component, variant }) => `${component}:${variant}`),
  );
  const observedSequence = (
    await root.locator("[data-component][data-variant]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        component: node.getAttribute("data-component") ?? "",
        variant: node.getAttribute("data-variant") ?? "",
      })),
    )
  ).filter(({ component, variant }) => expectedPairs.has(`${component}:${variant}`));
  expect(observedSequence, `${surface.id} exact component sequence`).toEqual(expectedSequence);

  const cards = root.locator("[data-card-anatomy]");
  for (const card of await cards.all()) {
    const anatomy = await card.getAttribute("data-card-anatomy");
    expect(selection.productCardAnatomyIds).toContain(anatomy);
  }
}

function fontFamilyPattern(font: string): RegExp {
  switch (font) {
    case "georgia":
    case "system-serif":
      return /Georgia|Cambria|Times|serif/i;
    case "inter":
      return /Inter|Arial|sans-serif/i;
    case "system-sans":
      return /system-ui|BlinkMacSystemFont|Segoe UI|sans-serif/i;
    default:
      throw new Error(`The selected approved font token ${font} is unavailable.`);
  }
}

export async function assertMaterialConsumption(input: {
  root: Locator;
  surface: CommercialSurface;
  selection: SafeSelection;
}): Promise<void> {
  const material = await input.root.evaluate((candidate) => {
    const root = candidate as HTMLElement;
    const px = (value: string) => Number.parseFloat(value) || 0;
    const styleOf = (selector: string) => {
      const node = root.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        borderWidth: style.borderWidth,
        boxShadow: style.boxShadow,
        display: style.display,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        gap: style.gap,
        minHeight: style.minHeight,
        objectFit: style.objectFit,
        paddingBlock: px(style.paddingTop) + px(style.paddingBottom),
      };
    };
    const computed = getComputedStyle(root);
    return {
      variables: {
        designDnaVersion: computed.getPropertyValue("--brand-design-dna-version").trim(),
        designDnaFingerprint: computed.getPropertyValue("--brand-design-dna-fingerprint").trim(),
        fontDisplay: computed.getPropertyValue("--brand-font-display").trim(),
        fontHeading: computed.getPropertyValue("--brand-font-heading").trim(),
        fontBody: computed.getPropertyValue("--brand-font-body").trim(),
        typeScaleRatio: computed.getPropertyValue("--brand-type-scale-ratio").trim(),
        sectionRhythm: computed.getPropertyValue("--brand-section-rhythm").trim(),
        pageGutter: computed.getPropertyValue("--brand-page-gutter").trim(),
        gridGap: computed.getPropertyValue("--brand-grid-gap").trim(),
        cardInset: computed.getPropertyValue("--brand-card-inset").trim(),
        elevation: computed.getPropertyValue("--brand-elevation-shadow").trim(),
        controlHeight: computed.getPropertyValue("--brand-control-height").trim(),
        density: computed.getPropertyValue("--brand-density-global").trim(),
        mediaCrop: computed.getPropertyValue("--brand-media-crop").trim(),
        mediaOverlay: computed.getPropertyValue("--brand-media-overlay-opacity").trim(),
        mediaProminence: computed.getPropertyValue("--brand-media-prominence").trim(),
      },
      frame: styleOf('[data-frame-region="header"]'),
      frameInner: styleOf('[data-frame-region="header"] [data-desktop-composition]'),
      brand: styleOf('[data-frame-region="header"] .store-brand'),
      hero: styleOf('[data-component="homepageHero"]'),
      editorial: styleOf('[data-component="homepageEditorial"]'),
      card: styleOf("[data-card-anatomy]"),
      cardImage: styleOf("[data-card-anatomy] img"),
      collection: styleOf('[data-component="dynamicCollectionCommerce"] > header'),
      productDetail: styleOf('[data-layout-region="product-purchase-hierarchy"]'),
      purchaseAction: styleOf('[aria-label="Purchase action"] button'),
    };
  });
  expect(material.variables).toMatchObject({
    designDnaVersion: "1.0.0",
    typeScaleRatio: String(input.selection.designDnaNonColour.typography.scale.ratio),
  });
  expect(material.variables.designDnaFingerprint).not.toBe("");
  expect(material.variables.fontDisplay).toMatch(
    fontFamilyPattern(input.selection.designDnaNonColour.typography.roles.display.font),
  );
  expect(material.variables.fontHeading).toMatch(
    fontFamilyPattern(input.selection.designDnaNonColour.typography.roles.heading.font),
  );
  expect(material.variables.fontBody).toMatch(
    fontFamilyPattern(input.selection.designDnaNonColour.typography.roles.body.font),
  );
  for (const key of [
    "sectionRhythm",
    "pageGutter",
    "gridGap",
    "cardInset",
    "elevation",
    "controlHeight",
    "density",
    "mediaCrop",
    "mediaOverlay",
    "mediaProminence",
  ] as const) {
    expect(material.variables[key], `${input.surface.id} consumes ${key}`).not.toBe("");
  }
  expect(material.frame?.boxShadow).not.toBe("");
  expect(material.frameInner?.paddingBlock).toBeGreaterThan(0);
  expect(material.brand?.fontFamily).toMatch(
    fontFamilyPattern(input.selection.designDnaNonColour.typography.roles.display.font),
  );
  if (input.surface.id === "home") {
    if (material.hero) {
      expect(material.hero.paddingBlock).toBeGreaterThan(0);
      expect(material.hero.backgroundColor).not.toBe("");
    }
    if (material.editorial) expect(material.editorial.display).not.toBe("none");
    if (material.cardImage) expect(material.cardImage.objectFit).toBe("contain");
    if (input.selection.directionId === "premiumEditorial") {
      expect(material.card?.boxShadow).not.toBe("none");
    }
  }
  if (input.surface.id === "collection") {
    expect(material.collection?.paddingBlock).toBeGreaterThan(0);
    expect(material.card?.borderRadius).not.toBe("");
    expect(material.cardImage?.objectFit).toBe("contain");
  }
  if (input.surface.id === "simple-pdp" || input.surface.id === "configurable-pdp") {
    expect(material.productDetail?.paddingBlock).toBeGreaterThan(0);
    expect(material.purchaseAction?.minHeight).not.toBe("0px");
    expect(material.purchaseAction?.minHeight).not.toBe("auto");
    expect(material.purchaseAction?.borderRadius).not.toBe("");
  }
}

const commercialEvidence = Object.freeze({
  locale: "en" as const,
  collection: Object.freeze({
    approvedCampaignAssetId: "asset_p10b16p04_aurum_editorial",
    canonicalProductCount: 4,
    canonicalProductIds: Object.freeze([
      "product_aava_necklace_925",
      "product_sisu_automatic_watch",
      "product_kajo_earrings_585",
      "product_meri_bracelet_925",
    ]),
  }),
});
const forbiddenCustomerCopy =
  /\b(?:verify live|requires verification|not captured|canonical products?|protected authority|commerce archetypes?|runtime commerce routes?|checkout authority|developer|acceptance fixture|draft placeholder|review before publishing)\b/iu;
const unexpectedFinnishInterfaceCopy =
  /\b(?:Ostoskori|Ostoskorisi|Valitse tuotevaihtoehdot|Ostotoiminto|Päänavigaatio|Mobiilinavigaatio|Alatunnisteen navigaatio|Lisätiedot|Hinta|Varastossa|Loppu varastosta)\b/iu;

async function assertProductGridGeometry(input: {
  cards: Locator;
  expectedColumns: number;
  expectedRows: number;
  label: string;
}): Promise<void> {
  const geometry = await input.cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { height: box.height, left: box.left, top: box.top, width: box.width };
    }),
  );
  const distinct = (values: readonly number[]) =>
    values.reduce<number[]>((groups, value) => {
      if (!groups.some((candidate) => Math.abs(candidate - value) <= 3)) groups.push(value);
      return groups;
    }, []);
  expect(distinct(geometry.map(({ left }) => left)), `${input.label} columns`).toHaveLength(
    input.expectedColumns,
  );
  expect(distinct(geometry.map(({ top }) => top)), `${input.label} rows`).toHaveLength(
    input.expectedRows,
  );
  if (input.expectedColumns > 1) {
    expect(
      Math.max(...geometry.map(({ height }) => height)) -
        Math.min(...geometry.map(({ height }) => height)),
      `${input.label} equal card heights`,
    ).toBeLessThanOrEqual(3);
  }
  expect(Math.min(...geometry.map(({ width }) => width))).toBeGreaterThan(0);
}

const collectionPresentationModes = new Set([
  "editorialCollectionSpread",
  "comparisonRail",
  "campaignLeadIn",
  "denseSearchToolbar",
  "legacyCollection",
]);

function requiredResponsiveTokens(value: string | null, attribute: string): ReadonlySet<string> {
  if (value === null) throw new Error(`Collection grid authority is missing ${attribute}.`);
  const tokens = value.trim() === "" ? [] : value.trim().split(/\s+/u);
  if (
    tokens.some((token) => !/^[a-z][A-Za-z0-9]*$/u.test(token)) ||
    new Set(tokens).size !== tokens.length
  ) {
    throw new Error(`Collection grid authority has invalid ${attribute}.`);
  }
  return new Set(tokens);
}

async function expectedCollectionGridGeometry(input: {
  collection: Locator;
  productGrid: Locator;
  productCount: number;
  width: P10B16P04CommercialEvidenceWidth;
}): Promise<Readonly<{ columns: number; rows: number }>> {
  const [presentationMode, tabletValue, desktopValue, wideValue, countValue] = await Promise.all([
    input.collection.getAttribute("data-presentation-mode"),
    input.collection.getAttribute("data-responsive-tablet"),
    input.collection.getAttribute("data-responsive-desktop"),
    input.productGrid.getAttribute("data-wide-grid-columns"),
    input.productGrid.getAttribute("data-product-count"),
  ]);
  if (!presentationMode || !collectionPresentationModes.has(presentationMode)) {
    throw new Error("Collection grid authority has an invalid presentation mode.");
  }
  const tablet = requiredResponsiveTokens(tabletValue, "data-responsive-tablet");
  const desktop = requiredResponsiveTokens(desktopValue, "data-responsive-desktop");
  const wideColumns = Number(wideValue);
  const renderedProductCount = Number(countValue);
  if (
    wideValue === null ||
    !/^[1-4]$/u.test(wideValue) ||
    !Number.isInteger(wideColumns) ||
    wideColumns > input.productCount
  ) {
    throw new Error("Collection grid authority has invalid declared wide columns.");
  }
  if (
    countValue === null ||
    !/^[1-9]\d*$/u.test(countValue) ||
    !Number.isInteger(renderedProductCount) ||
    renderedProductCount !== input.productCount
  ) {
    throw new Error("Collection grid authority has an invalid rendered product count.");
  }

  const comparisonOrDenseReflow = (tokens: ReadonlySet<string>) =>
    tokens.has("comparisonGridReflow") || tokens.has("denseGridReflow");
  let columns = 1;
  if (input.width >= 1280) {
    columns = wideColumns;
  } else if (input.width >= 1024) {
    const presentationUsesDesktopSpread =
      presentationMode === "editorialCollectionSpread" || presentationMode === "campaignLeadIn";
    if (presentationUsesDesktopSpread || comparisonOrDenseReflow(desktop)) {
      columns = Math.min(3, input.productCount);
    }
  } else if (input.width >= 768 && comparisonOrDenseReflow(tablet)) {
    columns = Math.min(2, input.productCount);
  }
  return { columns, rows: Math.ceil(input.productCount / columns) };
}

async function assertCommercialFrame(root: Locator, width: number): Promise<void> {
  const geometry = await root.locator('[data-frame-region="header"]').evaluate((header) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0
      );
    };
    const box = (element: Element | null) => {
      if (!visible(element)) return null;
      const value = element.getBoundingClientRect();
      return { bottom: value.bottom, left: value.left, right: value.right, top: value.top };
    };
    const brand = [...header.querySelectorAll(".store-brand")].find(visible) ?? null;
    const desktop = header.querySelector('[data-frame-region="desktop-header-layout"]');
    const mobile = header.querySelector('[data-frame-region="mobile-header-layout"]');
    const navigation = box(
      desktop?.querySelector('[data-frame-region="primary-navigation"]') ?? null,
    );
    const utilities = box(desktop?.querySelector('[data-frame-region="utilities"]') ?? null);
    return {
      brandFontSize: brand ? Number.parseFloat(getComputedStyle(brand).fontSize) : 0,
      brandWidth: brand?.getBoundingClientRect().width ?? 0,
      desktopVisible: visible(desktop),
      headerHeight: header.getBoundingClientRect().height,
      mobileVisible: visible(mobile),
      navigationUtilityOverlap:
        navigation && utilities
          ? navigation.left < utilities.right &&
            navigation.right > utilities.left &&
            navigation.top < utilities.bottom &&
            navigation.bottom > utilities.top
          : false,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  expect(geometry.viewportWidth).toBe(width);
  expect(geometry.navigationUtilityOverlap).toBe(false);
  expect(geometry.brandWidth).toBeLessThanOrEqual(width * (width < 1024 ? 0.62 : 0.48));
  expect(geometry.brandFontSize).toBeLessThanOrEqual(width >= 1200 ? 52 : width >= 1024 ? 36 : 28);
  expect(geometry.headerHeight).toBeLessThanOrEqual(width < 1024 ? 112 : 240);
  expect(geometry.desktopVisible).toBe(width >= 1024);
  expect(geometry.mobileVisible).toBe(width < 1024);
}

async function assertCompleteCards(cards: Locator): Promise<void> {
  for (const card of await cards.all()) {
    await expect(card.locator('[data-card-region="heading"]')).toBeVisible();
    await expect(card.locator('[data-card-region="price"]')).toBeVisible();
    await expect(card.locator('[data-card-region="media"] img')).toBeVisible();
    await expect(card.locator('[data-card-region="actions"] button')).toBeVisible();
  }
}

export async function assertCommercialSurface(input: {
  root: Locator;
  surface: CommercialSurface;
  selection: SafeSelection;
  width: P10B16P04CommercialEvidenceWidth;
}): Promise<void> {
  const { root, surface, selection, width } = input;
  await expect(root).toBeVisible();
  await expect(root.locator('[data-frame-region="header"]')).toBeVisible();
  await expect(root.locator('[data-frame-region="footer"]')).toBeVisible();
  const storeBrands = root.locator('[data-frame-region="header"] .store-brand');
  expect(await storeBrands.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await storeBrands.count()); index += 1) {
    const storeBrand = storeBrands.nth(index);
    const hasBrandText = (await storeBrand.textContent())?.includes("Aurum Nordic") ?? false;
    const hasAccessibleLogo = (await storeBrand.locator('img[alt="Aurum Nordic"]').count()) > 0;
    expect(hasBrandText || hasAccessibleLogo).toBe(true);
  }
  await expect(root.locator('[data-frame-region="header"] nav a')).not.toHaveCount(0);
  await expect(root.locator('[data-frame-region="footer"] nav a')).not.toHaveCount(0);
  await assertCommercialFrame(root, width);
  const customerCopy = await root.innerText();
  expect(customerCopy).not.toMatch(forbiddenCustomerCopy);
  expect(customerCopy).not.toMatch(unexpectedFinnishInterfaceCopy);
  await expect(root.locator('img[src*="placeholder"]')).toHaveCount(0);
  expect(await root.evaluate((element) => element.ownerDocument.documentElement.lang)).toBe(
    commercialEvidence.locale,
  );
  for (const image of await root.locator("img").all()) {
    if (!(await image.isVisible())) continue;
    const media = await image.evaluate((candidate) => {
      const element = candidate as HTMLImageElement;
      const rectangle = element.getBoundingClientRect();
      let sourcePath = "invalid-image-source";
      try {
        sourcePath = decodeURIComponent(
          new URL(element.currentSrc || element.src, element.ownerDocument.baseURI).pathname,
        );
      } catch {
        // Retain only a bounded safe classification.
      }
      return {
        complete: element.complete,
        isVector: /\.svg$/i.test(sourcePath),
        naturalHeight: element.naturalHeight,
        naturalWidth: element.naturalWidth,
        renderedWidth: rectangle.width,
      };
    });
    expect(media.complete).toBe(true);
    expect(media.naturalHeight).toBeGreaterThan(0);
    expect(media.naturalWidth).toBeGreaterThan(0);
    if (
      !media.isVector &&
      (await image.locator("xpath=ancestor::*[@data-card-anatomy]").count()) > 0
    ) {
      expect(media.renderedWidth).toBeLessThanOrEqual(media.naturalWidth * 1.5);
    }
  }
  await assertExactSurfaceAuthority({ root, selection, surface });
  await assertMaterialConsumption({ root, selection, surface });

  if (surface.id === "home") {
    const sections = root.locator(
      '[data-component]:not([data-component="header"]):not([data-component="footer"])',
    );
    const homepageSelection = profileSelectionForSurface(selection, surface);
    const selectedSectionCount = selection.componentChoices.filter(
      ({ pageKey, component }) =>
        pageKey === homepageSelection.pageKey && component !== "header" && component !== "footer",
    ).length;
    expect(await sections.count()).toBeGreaterThanOrEqual(selectedSectionCount);
    for (const section of await sections.all()) {
      expect(
        `${(await section.innerText()).trim()}${await section.locator("img").count()}`,
      ).not.toBe("0");
      await expect(section).toHaveAttribute("data-surface", /^(?:plain|soft|contrast)$/);
    }
    if (selection.directionId === "premiumEditorial") {
      await expect(
        root.locator('[data-asset-id="asset_p10b16p04_aurum_hero"]').first(),
      ).toBeVisible();
      await expect(
        root.locator('[data-asset-id="asset_p10b16p04_aurum_editorial"]').first(),
      ).toBeVisible();
      await expect(root.getByRole("heading", { name: "Light, held close" })).toBeVisible();
      await expect(root.getByText("Quiet forms, lasting meaning")).toHaveCount(1);
      await expect(root.getByText("Designed in Finland")).toBeVisible();
      await expect(root.getByText("Explore Everyday icons")).toBeVisible();
    }
    const cards = root.locator("[data-card-anatomy]");
    const expectedProductCount = selection.homepageProductCount;
    expect(expectedProductCount).toBeGreaterThan(0);
    expect(expectedProductCount).toBeLessThanOrEqual(
      commercialEvidence.collection.canonicalProductCount,
    );
    await expect(cards).toHaveCount(expectedProductCount);
    await assertCompleteCards(cards);
    await assertProductGridGeometry({
      cards,
      expectedColumns:
        width >= 1024 ? expectedProductCount : width >= 768 ? Math.min(2, expectedProductCount) : 1,
      expectedRows:
        width >= 1024
          ? 1
          : width >= 768
            ? Math.ceil(expectedProductCount / Math.min(2, expectedProductCount))
            : expectedProductCount,
      label: `homepage products at ${width}px`,
    });
    const majorAssets = await root
      .locator(
        '[data-component="homepageHero"] [data-region="media"][data-asset-id], [data-component="homepagePromotion"] [data-region="media"][data-asset-id], [data-component="homepageEditorial"] [data-region="media"][data-asset-id]',
      )
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-asset-id")));
    expect(new Set(majorAssets).size).toBe(majorAssets.length);
    return;
  }

  if (surface.id === "collection") {
    const collection = root.locator('[data-component="dynamicCollectionCommerce"]');
    await expect(collection).toBeVisible();
    await expect(collection.locator("[data-product-count]")).toHaveAttribute(
      "data-product-count",
      String(commercialEvidence.collection.canonicalProductCount),
    );
    const productGrid = collection.locator("[data-wide-grid-columns][data-product-count]");
    await expect(productGrid).toHaveCount(1);
    const cards = productGrid.locator("[data-card-anatomy]");
    await expect(cards).toHaveCount(commercialEvidence.collection.canonicalProductCount);
    await assertCompleteCards(cards);
    expect(
      await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-product-id"))),
    ).toEqual(commercialEvidence.collection.canonicalProductIds);
    if (selection.dynamicCommerce.collectionArchetypeId.includes("campaign")) {
      await expect(
        collection.locator(
          `[data-layout-region="campaign-lead"][data-asset-id="${commercialEvidence.collection.approvedCampaignAssetId}"]`,
        ),
      ).toBeVisible();
    }
    const majorAssets = await collection
      .locator(
        ':scope > header [data-asset-id], [data-layout-region="campaign-lead"][data-asset-id]',
      )
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-asset-id")));
    expect(new Set(majorAssets).size).toBe(majorAssets.length);
    const filterToolbar = collection.locator('[data-layout-region="filters"]');
    await expect(filterToolbar).toHaveCount(1);
    const filterAuthority = await filterToolbar.evaluate((element) => ({
      eligibleCount: Number(element.getAttribute("data-eligible-filter-count")),
      initiallyExposedCount: Number(element.getAttribute("data-primary-filter-count")),
      open: element.querySelector("details")?.open ?? false,
      valueCounts: [...element.querySelectorAll("[data-filter-value-count]")].map((group) =>
        Number(group.getAttribute("data-filter-value-count")),
      ),
    }));
    expect(filterAuthority.open).toBe(false);
    expect(filterAuthority.initiallyExposedCount).toBeLessThanOrEqual(6);
    expect(filterAuthority.eligibleCount).toBeGreaterThanOrEqual(
      filterAuthority.initiallyExposedCount,
    );
    expect(filterAuthority.valueCounts).toHaveLength(filterAuthority.initiallyExposedCount);
    expect(filterAuthority.valueCounts.every((valueCount) => valueCount >= 2)).toBe(true);
    const expectedGrid = await expectedCollectionGridGeometry({
      collection,
      productGrid,
      productCount: commercialEvidence.collection.canonicalProductCount,
      width,
    });
    await assertProductGridGeometry({
      cards,
      expectedColumns: expectedGrid.columns,
      expectedRows: expectedGrid.rows,
      label: `collection products at ${width}px`,
    });
    return;
  }

  if (surface.id === "simple-pdp" || surface.id === "configurable-pdp") {
    const product = root.locator('[data-component="dynamicProductDetail"]');
    await expect(product.locator("h1")).toHaveText(
      surface.id === "simple-pdp" ? "Sisu Automatic Watch" : "Aurora Ring 585",
    );
    await expect(
      product
        .getByLabel(/^Product gallery$/)
        .locator("img")
        .first(),
    ).toBeVisible();
    await expect(product.getByRole("heading", { level: 2, name: "Specifications" })).toBeVisible();
    const relatedProducts = product.locator("[data-related-product-count]");
    await expect(relatedProducts).toHaveAttribute("data-related-product-count", /^[1-9]\d*$/u);
    await expect(
      relatedProducts.locator("xpath=..").getByRole("heading", { level: 2 }),
    ).toBeVisible();
    const relatedCards = relatedProducts.locator("[data-card-anatomy]");
    await assertCompleteCards(relatedCards);
    if (width < 768) {
      await expect(product).toHaveAttribute("data-responsive-mobile", /\S/u);
      const relatedCount = await relatedCards.count();
      await assertProductGridGeometry({
        cards: relatedCards,
        expectedColumns: 1,
        expectedRows: relatedCount,
        label: `${surface.id} related products at ${width}px`,
      });
    }
    const purchase = product.locator('[data-layout-region="product-purchase-hierarchy"]');
    await expect(purchase).toHaveCount(1);
    await expect(purchase.locator("h1")).toBeVisible();
    await expect(purchase.getByLabel(/^Price$/)).toContainText("€");
    await expect(purchase.getByText(/In stock|Available|Saatavilla/i).first()).toBeVisible();
    const purchaseAction = purchase.getByLabel(/^Purchase action$/);
    await expect(purchaseAction).toBeVisible();
    if (width < 768) {
      const actionAndDescription = await purchase.evaluate((element) => {
        const action = element.querySelector<HTMLElement>('[aria-label="Purchase action"]');
        const description = element.querySelector<HTMLElement>(
          '[data-product-region="description"]',
        );
        if (!action || !description) return null;
        const actionBox = action.getBoundingClientRect();
        const descriptionBox = description.getBoundingClientRect();
        return {
          separated:
            actionBox.top >= descriptionBox.bottom || actionBox.bottom <= descriptionBox.top,
        };
      });
      expect(actionAndDescription).toEqual({ separated: true });
    }
    const opening = await product.evaluate((element) => {
      const purchase = element.querySelector<HTMLElement>(
        '[data-layout-region="product-purchase-hierarchy"]',
      );
      const gallery = element.querySelector<HTMLElement>('[aria-label="Product gallery"]');
      if (!purchase || !gallery) return null;
      const rootTop = element.getBoundingClientRect().top;
      return {
        galleryTop: gallery.getBoundingClientRect().top - rootTop,
        purchaseTop: purchase.getBoundingClientRect().top - rootTop,
      };
    });
    expect(opening).not.toBeNull();
    if (!opening) throw new Error(`${surface.id} lacks one coherent opening region.`);
    expect(opening.purchaseTop).toBeLessThan(width < 768 ? 1_600 : 900);
    if (width >= 1024) expect(Math.abs(opening.purchaseTop - opening.galleryTop)).toBeLessThan(180);
    if (surface.id === "configurable-pdp") {
      await expect(product.locator("[data-option-group-count]")).toHaveAttribute(
        "data-option-group-count",
        "2",
      );
      await expect(product.getByRole("heading", { name: "Choose product options" })).toBeVisible();
    } else {
      await expect(product.locator("[data-option-group-count]")).toHaveCount(0);
    }
    return;
  }

  if (surface.id === "about") {
    await expect(root.getByRole("heading", { level: 1, name: "About Aurum Nordic" })).toBeVisible();
    await expect(root.getByText("Quiet forms, lasting meaning")).toBeVisible();
    await expect(root.locator('[data-component="contentSupport"]')).toHaveAttribute(
      "data-content-contribution-count",
      /^(?:[3-9]|[1-9]\d+)$/,
    );
    await expect(root.locator('[data-content-region="continuation"] a')).toBeVisible();
    return;
  }

  if (surface.id === "cart-empty") {
    await expect(root.getByText("Your cart is empty.")).toBeVisible();
    await expect(root.locator('[data-utility-state="cart-empty"] button')).toHaveCount(1);
    return;
  }

  const cart = root.locator('[data-utility-state="cart-populated"]');
  await expect(cart.getByRole("heading", { name: "Cart" })).toBeVisible();
  await expect(cart.locator("li img")).not.toHaveCount(0);
  await expect(cart.locator("li h2")).not.toHaveCount(0);
  await expect(cart.getByText(/Quantity:/)).not.toHaveCount(0);
  await expect(cart.locator("aside strong")).not.toHaveCount(0);
  await expect(cart.locator("aside button")).not.toHaveCount(0);
  await expect(cart.getByText("€690", { exact: true }).first()).toBeVisible();
  await expect(cart).not.toContainText("€690.00");
  await expect(cart.getByRole("button", { name: "Continue to checkout", exact: true })).toHaveCount(
    0,
  );
}
