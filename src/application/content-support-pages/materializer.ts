import {
  getCommercialContentSupportProfile,
  materializeExecutablePageBlueprint,
  validateExecutablePageBlueprintRealization,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import {
  canonicalValueFingerprint,
  contentSupportPageFamilyIdSchema,
  pageFactEvidenceRequestSchema,
  pageModelSchema,
  storefrontSnapshotSchema,
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

/**
 * Materializes one registered PageBlueprint into the existing canonical page.
 * It never creates a parallel content tree: the page keeps its P10B-05 family,
 * route, navigation, locale and approved-evidence authority.
 */
export function materializeContentSupportPage(
  input: Readonly<{
    page: unknown;
    factAuthority: ContentSupportFactAuthority;
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
  const realized = pageModelSchema.parse({
    ...page,
    sections: [
      {
        id: `section_${canonicalValueFingerprint({ pageId: page.id, slotId: slot.slotId }).slice(-24)}`,
        component: slot.component,
        variant: slot.variant,
        visible: true,
        content: { factDocumentId: fact.id },
        props: { readingWidth: "standard", textAlignment: "left" },
        styleOverrides: { contentWidth: "standard" },
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
