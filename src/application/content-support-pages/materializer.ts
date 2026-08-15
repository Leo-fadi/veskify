import {
  approvedGenerationAssetContextSchema,
  type ApprovedGenerationAssetContext,
} from "@/application/ai-storefront-generation/approved-asset-context";
import {
  getCommercialContentSupportProfile,
  materializeExecutablePageBlueprint,
  validateExecutablePageBlueprintRealization,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import {
  approvedAssetPlacementOperationSchema,
  approvedAssetPresentationSchema,
  canonicalValueFingerprint,
  canonicalValueString,
  contentSupportPageFamilyIdSchema,
  pageFactEvidenceRequestSchema,
  pageModelSchema,
  storefrontSnapshotSchema,
  type ApprovedAssetPlacementOperation,
  type ApprovedAssetPresentation,
  type ContentSupportFactDocument,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ContentSupportFactAuthority } from "./fact-authority";

export const contentSupportPageMaterializationErrorCodes = [
  "missing-page-family",
  "unsupported-profile",
  "profile-family-mismatch",
  "missing-approved-fact",
  "ambiguous-approved-asset",
  "stale-approved-asset",
  "incompatible-approved-asset",
  "invalid-realization",
] as const;
export type ContentSupportPageMaterializationErrorCode =
  (typeof contentSupportPageMaterializationErrorCodes)[number];

export class ContentSupportPageMaterializationError extends Error {
  constructor(
    readonly code: ContentSupportPageMaterializationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContentSupportPageMaterializationError";
  }
}

export type ContentSupportPageMaterialization = Readonly<{
  page: PageModel;
  factDocument: ContentSupportFactDocument;
  factDocumentId: string;
  profileFingerprint: string;
  fingerprint: string;
}>;

export type ContentSupportApprovedAssetAuthority = Readonly<{
  context: ApprovedGenerationAssetContext;
  presentations: readonly ApprovedAssetPresentation[];
  placements: readonly ApprovedAssetPlacementOperation[];
}>;

type ResolvedContentSupportMedia = Readonly<{
  placements: readonly ApprovedAssetPlacementOperation[];
  presentations: readonly ApprovedAssetPresentation[];
}>;

const noContentSupportMedia: ResolvedContentSupportMedia = Object.freeze({
  placements: [],
  presentations: [],
});

function resolveContentSupportMedia(
  input: Readonly<{
    pageId: string;
    sectionId: string;
    component: string;
    variant: string;
    fact: ContentSupportFactDocument;
    approvedAssetAuthority?: ContentSupportApprovedAssetAuthority;
  }>,
): ResolvedContentSupportMedia {
  if (!input.approvedAssetAuthority) return noContentSupportMedia;
  const definition = veskifyComponentDefinitionsV2.find(
    (candidate) => candidate.type === input.component,
  );
  const variant = definition?.commercialAnatomy?.variants.find(
    (candidate) => candidate.variantId === input.variant,
  );
  const placedSlotIds = new Set(
    variant?.structure.assetPlacements.map(({ slotId }) => slotId) ?? [],
  );
  const mediaSlot = definition?.assetSlots.find(
    (candidate) =>
      placedSlotIds.has(candidate.id) && candidate.acceptedRoles.includes("editorialImage"),
  );
  if (!definition || !variant || !mediaSlot) return noContentSupportMedia;

  const exactPlacements = input.approvedAssetAuthority.placements.filter(
    (placement) =>
      placement.pageId === input.pageId &&
      placement.componentId === input.sectionId &&
      placement.componentType === input.component &&
      placement.assetSlotId === mediaSlot.id,
  );
  if (exactPlacements.length === 0) return noContentSupportMedia;
  if (exactPlacements.length !== 1) {
    throw new ContentSupportPageMaterializationError(
      "ambiguous-approved-asset",
      "Content/support media requires one exact approved placement.",
    );
  }
  const placement = exactPlacements[0];
  if (!placement || !mediaSlot.acceptedRoles.includes(placement.role)) {
    throw new ContentSupportPageMaterializationError(
      "incompatible-approved-asset",
      "Content/support media is incompatible with its registered placement slot.",
    );
  }

  const parsedContext = approvedGenerationAssetContextSchema.safeParse(
    structuredClone(input.approvedAssetAuthority.context),
  );
  if (!parsedContext.success) {
    throw new ContentSupportPageMaterializationError(
      "stale-approved-asset",
      "Content/support media does not match the current approved evidence authority.",
    );
  }
  if (
    input.fact.evidence.approvalAuthorityId !== parsedContext.data.briefId ||
    input.fact.evidence.approvalFingerprint !== parsedContext.data.approvedEvidenceFingerprint
  ) {
    throw new ContentSupportPageMaterializationError(
      "stale-approved-asset",
      "Content/support media does not match the current approved evidence authority.",
    );
  }
  const candidates = parsedContext.data.assets.filter(
    (asset) =>
      asset.assetId === placement.assetId &&
      asset.role === placement.role &&
      asset.revision === placement.assetRevision &&
      asset.materialFingerprint === placement.materialFingerprint &&
      asset.sourceReferenceId === placement.sourceReferenceId,
  );
  if (candidates.length !== 1) {
    throw new ContentSupportPageMaterializationError(
      "stale-approved-asset",
      "The exact content/support placement no longer matches current approved asset authority.",
    );
  }
  const asset = candidates[0];
  if (!asset) return noContentSupportMedia;
  const presentations = input.approvedAssetAuthority.presentations.filter(
    (candidate) => candidate.assetId === asset.assetId,
  );
  if (presentations.length !== 1) {
    throw new ContentSupportPageMaterializationError(
      "stale-approved-asset",
      "The approved content/support asset has no exact current presentation authority.",
    );
  }
  const parsedPresentation = approvedAssetPresentationSchema.safeParse(
    structuredClone(presentations[0]),
  );
  const presentation = parsedPresentation.success ? parsedPresentation.data : null;
  if (
    !presentation ||
    presentation.assetId !== asset.assetId ||
    presentation.asset.id !== asset.assetId ||
    presentation.role !== asset.role ||
    presentation.revision !== asset.revision ||
    presentation.materialFingerprint !== asset.materialFingerprint ||
    presentation.asset.decorative !== asset.presentation.decorative ||
    canonicalValueString(presentation.asset.alt ?? null) !== canonicalValueString(asset.alt)
  ) {
    throw new ContentSupportPageMaterializationError(
      "stale-approved-asset",
      "The content/support asset presentation does not match current approved authority.",
    );
  }
  if (presentation.role !== "editorialImage") {
    throw new ContentSupportPageMaterializationError(
      "incompatible-approved-asset",
      "Content/support media must use the registered editorial-image role.",
    );
  }
  const exactPlacement = approvedAssetPlacementOperationSchema.parse(structuredClone(placement));
  return Object.freeze({
    placements: [exactPlacement],
    presentations: [presentation],
  });
}

/**
 * Materializes one registered PageBlueprint into the existing canonical page.
 * It never creates a parallel content tree: the page keeps its P10B-05 family,
 * route, navigation, locale and approved-evidence authority.
 */
export function materializeContentSupportPage(
  input: Readonly<{
    page: unknown;
    factAuthority: ContentSupportFactAuthority;
    approvedAssetAuthority?: ContentSupportApprovedAssetAuthority;
  }>,
): ContentSupportPageMaterialization {
  const page = pageModelSchema.parse(structuredClone(input.page));
  const pageFamily = page.pageFamily;
  if (!pageFamily) {
    throw new ContentSupportPageMaterializationError(
      "missing-page-family",
      "Content/support materialization requires canonical P10B-05 page-family authority.",
    );
  }
  const familyId = contentSupportPageFamilyIdSchema.safeParse(pageFamily.familyId);
  if (!familyId.success) {
    throw new ContentSupportPageMaterializationError(
      "profile-family-mismatch",
      `Page family ${pageFamily.familyId} is outside the P10B-12 content/support authority.`,
    );
  }
  const plan = getCommercialContentSupportProfile(pageFamily.profileId);
  const authority = plan?.profile?.commercialContentSupport;
  if (!plan || !authority || pageFamily.profileVersion !== plan.profile?.version) {
    throw new ContentSupportPageMaterializationError(
      "unsupported-profile",
      "The canonical page does not select a registered P10B-12 content/support profile.",
    );
  }
  if (!authority.pageFamilyIds.includes(familyId.data)) {
    throw new ContentSupportPageMaterializationError(
      "profile-family-mismatch",
      `Profile ${pageFamily.profileId} is not registered for ${pageFamily.familyId}.`,
    );
  }
  const evidence = pageFamily.evidenceReferences[0];
  if (!evidence) {
    throw new ContentSupportPageMaterializationError(
      "missing-approved-fact",
      `Content/support page ${page.id} has no approved fact reference.`,
    );
  }
  const fact = input.factAuthority.resolve({
    familyId: familyId.data,
    reference: pageFactEvidenceRequestSchema.parse({
      source: evidence.source,
      authorityId: evidence.authorityId,
      revision: evidence.revision,
    }),
  });
  const executable = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["localizedContent"],
  });
  const slot = executable.slots[0];
  if (!slot || slot.component !== "contentSupport") {
    throw new ContentSupportPageMaterializationError(
      "invalid-realization",
      "A P10B-12 profile must resolve exactly one registered content/support section.",
    );
  }
  if (
    slot.variant === "aboutProcess" &&
    (!fact.payload.story || fact.payload.story.steps.length === 0)
  ) {
    throw new ContentSupportPageMaterializationError(
      "invalid-realization",
      "The approved about/process composition requires at least one approved process step.",
    );
  }
  if (slot.variant === "genericEditorial" && !fact.payload.story) {
    throw new ContentSupportPageMaterializationError(
      "invalid-realization",
      "The approved generic editorial composition requires approved story facts.",
    );
  }
  const sectionId = `section_${canonicalValueFingerprint({ pageId: page.id, slotId: slot.slotId }).slice(-24)}`;
  const media = resolveContentSupportMedia({
    pageId: page.id,
    sectionId,
    component: slot.component,
    variant: slot.variant,
    fact,
    ...(input.approvedAssetAuthority
      ? { approvedAssetAuthority: input.approvedAssetAuthority }
      : {}),
  });
  const realized = pageModelSchema.parse({
    ...page,
    sections: [
      {
        id: sectionId,
        component: slot.component,
        variant: slot.variant,
        visible: true,
        content: { factDocumentId: fact.id },
        props: { readingWidth: "standard", textAlignment: "left" },
        styleOverrides: { surface: "default" },
        approvedAssetPlacements: media.placements,
        approvedAssetPresentations: media.presentations,
      },
    ],
  });
  try {
    validateExecutablePageBlueprintRealization({
      pagePlan: plan,
      materialization: executable,
      componentDefinitions: veskifyComponentDefinitionsV2,
      sections: realized.sections.map(({ component, variant }) => ({ component, variant })),
    });
  } catch {
    throw new ContentSupportPageMaterializationError(
      "invalid-realization",
      "The content/support section failed its canonical executable PageBlueprint realization.",
    );
  }
  const material = {
    page: realized,
    factDocument: fact,
    factDocumentId: fact.id,
    profileFingerprint: authority.structuralFingerprint,
  };
  return Object.freeze({
    ...material,
    fingerprint: `content-support-page-${canonicalValueFingerprint(material)}`,
  });
}

/**
 * Applies one P10B-12 page materialization to the only canonical editable aggregate.
 * The approved document lives beside its bound section in StorefrontSnapshot, so repository
 * save/reload and deterministic publication do not depend on a separate content store.
 */
export function materializeContentSupportSnapshot(
  input: Readonly<{
    snapshot: unknown;
    pageId: string;
    factAuthority: ContentSupportFactAuthority;
    approvedAssetAuthority?: ContentSupportApprovedAssetAuthority;
  }>,
): Readonly<{
  snapshot: StorefrontSnapshot;
  materialization: ContentSupportPageMaterialization;
}> {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(input.snapshot));
  const page = snapshot.pages.find((candidate) => candidate.id === input.pageId);
  if (!page) {
    throw new ContentSupportPageMaterializationError(
      "missing-page-family",
      `The canonical snapshot has no page ${input.pageId}.`,
    );
  }
  const materialization = materializeContentSupportPage({
    page,
    factAuthority: input.factAuthority,
    ...(input.approvedAssetAuthority
      ? { approvedAssetAuthority: input.approvedAssetAuthority }
      : {}),
  });
  const nextDocuments = [
    ...snapshot.contentSupportFactDocuments.filter(
      (document) => document.id !== materialization.factDocument.id,
    ),
    materialization.factDocument,
  ];
  const nextSnapshot = storefrontSnapshotSchema.parse({
    ...snapshot,
    pages: snapshot.pages.map((candidate) =>
      candidate.id === materialization.page.id ? materialization.page : candidate,
    ),
    contentSupportFactDocuments: nextDocuments,
  });
  return Object.freeze({ snapshot: nextSnapshot, materialization });
}
