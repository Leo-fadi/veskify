import { brandSystemSchema, type BrandSystem } from "@/domain/design-system";
import { storefrontDesignBriefSchema, type StorefrontDesignBrief } from "@/domain/design-brief";
import {
  canonicalValueString,
  pageModelSchema,
  sectionInstanceSchema,
  storefrontSnapshotSchema,
  type PageModel,
  type PageType,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { type Locale } from "@/domain/shared";
import {
  getComponentDefinition,
  validateRegisteredSnapshot,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { getTemplateById, getTemplatePagePlan } from "./registry";
import {
  createStorefrontTemplateSelectionBriefFingerprint,
  evaluateStorefrontTemplateCandidates,
} from "./selection-planner";
import {
  type StorefrontTemplateSelectionPlan,
  validateStorefrontTemplateSelectionPlan,
} from "./selection-contract";
import type { StorefrontTemplatePagePlan, StorefrontTemplateSlot } from "./contract";
import { materializeExecutablePageBlueprint } from "./profile-materializer";
import {
  cloneInitialStorefrontGenerationPlan,
  initialStorefrontGenerationPlanSchema,
  initialStorefrontMaterializationInputSchema,
  type InitialStorefrontGenerationPlan,
  type InitialStorefrontMaterializationInput,
  type InitialStorefrontOmission,
  type InitialStorefrontProvenance,
} from "./materializer-contract";

const requiredPageTypes = ["home", "collection", "product"] as const satisfies readonly PageType[];

type GenerationMessage = { code: string; message: string };

export class InitialStorefrontMaterializationError extends Error {
  readonly code: "invalid-input" | "invalid-generated-storefront";
  readonly causeValue: unknown;

  constructor(
    code: InitialStorefrontMaterializationError["code"],
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "InitialStorefrontMaterializationError";
    this.code = code;
    this.causeValue = cause;
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createInitialPageId(projectId: string, pageType: PageType): string {
  return `page_${stableHash(`${projectId}:${pageType}`)}`;
}

export function createInitialSectionId(pageId: string, slotId: string): string {
  return `section_${stableHash(`${pageId}:${slotId}`)}`;
}

function createInitialGenerationPlanId(input: InitialStorefrontMaterializationInput): string {
  return `generation_${stableHash(
    canonicalValueString({
      brief: input.brief,
      templateSelectionPlan: input.templateSelectionPlan,
      brandSystem: input.brandSystem,
      projectId: input.projectId,
      snapshotId: input.snapshotId,
      catalogueRef: input.catalogueRef,
      createdAt: input.createdAt,
    }),
  )}`;
}

function message(code: string, text: string): GenerationMessage {
  return { code, message: text };
}

function localizedWithPrimary(
  fallback: { en?: string; fi?: string },
  value: string,
  primaryLocale: Locale,
): { en?: string; fi?: string } {
  if (!value.trim()) return { ...fallback };
  return { [primaryLocale]: value.trim() };
}

function primaryLocale(brief: StorefrontDesignBrief): Locale {
  return brief.languagePlan.primaryLanguage ?? brief.languagePlan.selectedLanguages[0] ?? "en";
}

function pageTitle(pageType: PageType, brief: StorefrontDesignBrief): { en: string; fi: string } {
  const businessName = brief.businessIdentity.businessName.trim();
  if (pageType === "home" && businessName) {
    return localizedWithPrimary(
      { en: "Storefront", fi: "Kauppa" },
      businessName,
      primaryLocale(brief),
    ) as { en: string; fi: string };
  }
  if (pageType === "collection") return { en: "Shop", fi: "Kauppa" };
  if (pageType === "product") return { en: "Featured product", fi: "Esittelytuote" };
  return { en: "Storefront", fi: "Kauppa" };
}

function pageSeo(pageType: PageType, brief: StorefrontDesignBrief) {
  const title = pageTitle(pageType, brief);
  const description =
    pageType === "home" && brief.businessIdentity.shortDescription.trim()
      ? localizedWithPrimary(
          {
            en: "A considered storefront for everyday discovery.",
            fi: "Harkittu kauppa jokapäiväiseen löytämiseen.",
          },
          brief.businessIdentity.shortDescription,
          primaryLocale(brief),
        )
      : pageType === "collection"
        ? { en: "Explore the collection.", fi: "Tutustu mallistoon." }
        : { en: "Discover the featured product.", fi: "Tutustu esittelytuotteeseen." };
  return { title, metaDescription: description };
}

function shouldOmitSlot(slot: StorefrontTemplateSlot, brief: StorefrontDesignBrief): boolean {
  if (slot.omitWhen === "when-not-requested") return true;
  if (slot.omitWhen === "when-logo-is-unavailable") return !brief.brandDirection.logoAssetRef;
  if (slot.omitWhen === "when-imagery-is-unavailable") {
    return brief.brandDirection.supportingImageAssetRefs.length === 0;
  }
  if (slot.omitWhen === "when-catalogue-is-empty") {
    return brief.catalogueContext === "empty-catalogue";
  }
  return false;
}

function shouldOmitEmptyCatalogueSection(
  sectionType: string,
  brief: StorefrontDesignBrief,
): boolean {
  return (
    brief.catalogueContext === "empty-catalogue" &&
    [
      "featuredCategories",
      "productGrid",
      "collectionHeader",
      "filterBar",
      "productGallery",
      "productInfo",
      "productOptions",
      "relatedProducts",
    ].includes(sectionType)
  );
}

function applyInitialContentPolicy(
  section: SectionInstance,
  brief: StorefrontDesignBrief,
  collectionSlug: string,
): SectionInstance {
  const next = structuredClone(section);
  const locale = primaryLocale(brief);
  const businessName = brief.businessIdentity.businessName.trim();
  const shortDescription = brief.businessIdentity.shortDescription.trim();

  if (next.component === "header" || next.component === "footer") {
    if (businessName) next.content.brandName = businessName;
  }
  if (next.component === "hero") {
    const content = next.content as {
      eyebrow: { en?: string; fi?: string };
      title: { en?: string; fi?: string };
      body: { en?: string; fi?: string };
      cta: Record<string, unknown>;
    };
    if (businessName) content.eyebrow = localizedWithPrimary(content.eyebrow, businessName, locale);
    if (businessName) content.title = localizedWithPrimary(content.title, businessName, locale);
    if (shortDescription)
      content.body = localizedWithPrimary(content.body, shortDescription, locale);
    content.cta = { ...content.cta, href: collectionSlug };
  }
  if (next.component === "brandStory") {
    const content = next.content as {
      heading: { en?: string; fi?: string };
      body: { en?: string; fi?: string };
    };
    if (businessName) content.heading = localizedWithPrimary(content.heading, businessName, locale);
    if (shortDescription)
      content.body = localizedWithPrimary(content.body, shortDescription, locale);
  }
  return next;
}

function materializeSection(
  pageType: PageType,
  slot: StorefrontTemplateSlot,
  brief: StorefrontDesignBrief,
  collectionSlug: string,
  omissions: InitialStorefrontOmission[],
): SectionInstance | null {
  const omitForEmptyCatalogue = shouldOmitEmptyCatalogueSection(slot.sectionType, brief);
  if (shouldOmitSlot(slot, brief) || omitForEmptyCatalogue) {
    if (slot.required && !omitForEmptyCatalogue) {
      throw new InitialStorefrontMaterializationError(
        "invalid-generated-storefront",
        `Required slot ${slot.id} (${slot.sectionType}) cannot be omitted on ${pageType}.`,
      );
    }
    omissions.push({
      pageType,
      slotId: slot.id,
      sectionType: slot.sectionType,
      condition: omitForEmptyCatalogue ? "when-catalogue-is-empty" : slot.omitWhen,
    });
    return null;
  }

  let definition;
  try {
    definition = getComponentDefinition(slot.sectionType);
  } catch (cause) {
    throw new InitialStorefrontMaterializationError(
      "invalid-generated-storefront",
      `Cannot materialize ${pageType}/${slot.id}: registered component ${slot.sectionType} is unavailable.`,
      cause,
    );
  }
  if (!definition.allowedPageTypes.includes(pageType)) {
    throw new InitialStorefrontMaterializationError(
      "invalid-generated-storefront",
      `Component ${slot.sectionType} is not allowed on ${pageType} pages.`,
    );
  }
  if (
    !definition.variants.includes(slot.defaultVariant) ||
    !slot.allowedVariants.includes(slot.defaultVariant)
  ) {
    throw new InitialStorefrontMaterializationError(
      "invalid-generated-storefront",
      `Slot ${slot.id} requires unsupported variant ${slot.defaultVariant}.`,
    );
  }

  const section = applyInitialContentPolicy(
    {
      id: createInitialSectionId(`page_${pageType}`, slot.id),
      component: slot.sectionType,
      variant: slot.defaultVariant,
      visible: true,
      content: structuredClone(definition.defaultContent),
      props: structuredClone(definition.defaultProps),
    },
    brief,
    collectionSlug,
  );
  try {
    return sectionInstanceSchema.parse(definition.validate(section, pageType));
  } catch (cause) {
    throw new InitialStorefrontMaterializationError(
      "invalid-generated-storefront",
      `Cannot materialize ${pageType}/${slot.id} (${slot.sectionType}) from registered defaults.`,
      cause,
    );
  }
}

function validateSelectionPreconditions(
  brief: StorefrontDesignBrief,
  selection: StorefrontTemplateSelectionPlan,
  currentEvaluation: ReturnType<typeof evaluateStorefrontTemplateCandidates>,
): GenerationMessage[] {
  const blockers: GenerationMessage[] = [];
  if (selection.status === "blocked") {
    blockers.push(message("blocked-template-selection", "The template selection is blocked."));
  }
  if (!selection.selectedTemplateId) {
    blockers.push(
      message("missing-selected-template", "The template selection has no selected template."),
    );
  }
  if (brief.id !== selection.briefId) {
    blockers.push(message("brief-id-mismatch", "The brief does not match the template selection."));
  }
  const currentFingerprint = createStorefrontTemplateSelectionBriefFingerprint(brief);
  if (selection.briefFingerprint !== currentFingerprint) {
    blockers.push(
      message(
        "stale-template-selection",
        "The template selection no longer matches the current design brief. Run template selection again.",
      ),
    );
  }
  for (const blocker of currentEvaluation.blockers) {
    blockers.push(message(blocker.code, blocker.message));
  }
  const template = selection.selectedTemplateId
    ? getTemplateById(selection.selectedTemplateId)
    : undefined;
  if (!template && selection.selectedTemplateId) {
    blockers.push(
      message(
        "missing-selected-template",
        `Template ${selection.selectedTemplateId} was not found.`,
      ),
    );
  }
  if (!template || !selection.selectedTemplateId) return blockers;

  const currentCandidate = currentEvaluation.candidates.find(
    (candidate) => candidate.templateId === selection.selectedTemplateId,
  );
  if (!currentCandidate?.compatible) {
    blockers.push(
      message(
        "incompatible-selected-template",
        `Template ${selection.selectedTemplateId} is not compatible with the current design brief.`,
      ),
    );
  }

  for (const pageType of requiredPageTypes) {
    const resolved = selection.resolvedPagePlans.find((plan) => plan.pageType === pageType);
    const registered = getTemplatePagePlan(template.id, pageType);
    if (!resolved) {
      blockers.push(
        message(
          `missing-${pageType}-plan`,
          `The selected template has no resolved ${pageType} page plan.`,
        ),
      );
    } else if (!registered || canonicalValueString(resolved) !== canonicalValueString(registered)) {
      blockers.push(
        message(
          `inconsistent-${pageType}-plan`,
          `The resolved ${pageType} plan does not belong to ${template.id}.`,
        ),
      );
    }
  }
  return blockers;
}

function createNavigation(pageIds: Record<"home" | "collection" | "product", string>) {
  return {
    primary: [
      {
        id: "nav_home",
        label: { en: "Home", fi: "Etusivu" },
        target: { type: "page" as const, pageId: pageIds.home },
      },
      {
        id: "nav_shop",
        label: { en: "Shop", fi: "Kauppa" },
        target: { type: "page" as const, pageId: pageIds.collection },
      },
    ],
    footer: [],
  };
}

function createPage(
  projectId: string,
  pagePlan: StorefrontTemplatePagePlan,
  brief: StorefrontDesignBrief,
  omissions: InitialStorefrontOmission[],
): PageModel {
  const pageId = createInitialPageId(projectId, pagePlan.pageType);
  const slug =
    pagePlan.pageType === "home"
      ? "/"
      : pagePlan.pageType === "collection"
        ? "/collections/all"
        : "/products/featured";
  const sections = pagePlan.slots
    .map((slot) =>
      materializeSection(pagePlan.pageType, slot, brief, "/collections/all", omissions),
    )
    .filter((section): section is SectionInstance => section !== null)
    .map((section) => ({
      ...section,
      id: createInitialSectionId(
        pageId,
        pagePlan.slots.find((slot) => slot.sectionType === section.component)?.id ??
          section.component,
      ),
    }));
  return pageModelSchema.parse({
    id: pageId,
    type: pagePlan.pageType,
    slug,
    title: pageTitle(pagePlan.pageType, brief),
    seo: pageSeo(pagePlan.pageType, brief),
    sections,
  });
}

function createBlockedPlan(
  input: InitialStorefrontMaterializationInput,
  blockers: GenerationMessage[],
  provenance: InitialStorefrontProvenance,
): InitialStorefrontGenerationPlan {
  return cloneInitialStorefrontGenerationPlan(
    initialStorefrontGenerationPlanSchema.parse({
      schemaVersion: 1,
      id: createInitialGenerationPlanId(input),
      briefId: input.brief.id,
      templateSelectionPlanId: input.templateSelectionPlan.id,
      selectedTemplateId: input.templateSelectionPlan.selectedTemplateId,
      projectId: input.projectId,
      snapshotId: input.snapshotId,
      catalogueRef: input.catalogueRef,
      status: "blocked",
      generatedSnapshot: null,
      generatedPageIds: [],
      assumptions: ["No project, snapshot, page, or section is persisted by this materializer."],
      warnings: [...input.templateSelectionPlan.warnings],
      blockers,
      provenance,
    }),
  );
}

export function materializeInitialStorefront(
  input: InitialStorefrontMaterializationInput,
): InitialStorefrontGenerationPlan {
  let parsed: InitialStorefrontMaterializationInput;
  try {
    parsed = initialStorefrontMaterializationInputSchema.parse(input);
  } catch (cause) {
    throw new InitialStorefrontMaterializationError(
      "invalid-input",
      "Initial storefront materialization input is invalid.",
      cause,
    );
  }
  const brief = storefrontDesignBriefSchema.parse(parsed.brief);
  const selection = validateStorefrontTemplateSelectionPlan(parsed.templateSelectionPlan);
  const brandSystem: BrandSystem = brandSystemSchema.parse(parsed.brandSystem);
  const provenance: InitialStorefrontProvenance = {
    pageSource: "approved-template-selection",
    sectionSource: "registered-component-defaults",
    contentSource: "controlled-defaults-with-primary-locale-brief-overrides",
    brandSystemSource: "supplied-canonical-brand-system",
    omissions: [],
    profileMaterializations: [],
  };
  const currentEvaluation = evaluateStorefrontTemplateCandidates(brief);
  const blockers = validateSelectionPreconditions(brief, selection, currentEvaluation);
  if (blockers.length > 0)
    return createBlockedPlan(
      { ...parsed, brief, templateSelectionPlan: selection, brandSystem },
      blockers,
      provenance,
    );

  let pages: PageModel[];
  let snapshot: StorefrontSnapshot;
  try {
    pages = requiredPageTypes.map((pageType) => {
      const pagePlan = selection.resolvedPagePlans.find((plan) => plan.pageType === pageType)!;
      const profile = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
      });
      provenance.profileMaterializations.push({
        pageType,
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        fingerprint: profile.fingerprint,
      });
      return createPage(parsed.projectId, pagePlan, brief, provenance.omissions);
    });
    const pageIds = Object.fromEntries(pages.map((page) => [page.type, page.id])) as Record<
      "home" | "collection" | "product",
      string
    >;
    snapshot = storefrontSnapshotSchema.parse({
      id: parsed.snapshotId,
      projectId: parsed.projectId,
      revision: 0,
      brandSystem: structuredClone(brandSystem),
      navigation: createNavigation(pageIds),
      pages,
      catalogueRef: parsed.catalogueRef,
      createdAt: parsed.createdAt,
      createdBy: "agent",
    });
    validateRegisteredSnapshot(snapshot);
  } catch (cause) {
    const error =
      cause instanceof InitialStorefrontMaterializationError
        ? cause
        : new InitialStorefrontMaterializationError(
            "invalid-generated-storefront",
            "The generated storefront failed registered-component validation.",
            cause,
          );
    return createBlockedPlan(
      { ...parsed, brief, templateSelectionPlan: selection, brandSystem },
      [message("section-materialization-failed", error.message)],
      provenance,
    );
  }
  const warnings = [
    ...selection.warnings,
    ...provenance.omissions.map((omission) =>
      message(
        "optional-slot-omitted",
        `${omission.pageType}/${omission.slotId} omitted by ${omission.condition}.`,
      ),
    ),
  ];
  const plan = {
    schemaVersion: 1,
    id: createInitialGenerationPlanId({
      ...parsed,
      brief,
      templateSelectionPlan: selection,
      brandSystem,
    }),
    briefId: brief.id,
    templateSelectionPlanId: selection.id,
    selectedTemplateId: selection.selectedTemplateId,
    projectId: parsed.projectId,
    snapshotId: parsed.snapshotId,
    catalogueRef: parsed.catalogueRef,
    status: warnings.length > 0 ? "ready-with-warnings" : "ready",
    generatedSnapshot: snapshot,
    generatedPageIds: pages.map((page) => page.id),
    assumptions: [
      "Registered component defaults provide controlled presentation content and references.",
      "Merchant-authored copy is applied only in the brief primary locale; no translation is invented.",
      "Each registered PageBlueprint profile is materialized once before canonical sections are created.",
      "No project, snapshot, page, or section is persisted by this materializer.",
    ],
    warnings,
    blockers: [],
    provenance,
  };
  return deepFreeze(structuredClone(initialStorefrontGenerationPlanSchema.parse(plan)));
}

export function cloneMaterializedInitialStorefront(
  input: InitialStorefrontGenerationPlan,
): InitialStorefrontGenerationPlan {
  return cloneInitialStorefrontGenerationPlan(input);
}
