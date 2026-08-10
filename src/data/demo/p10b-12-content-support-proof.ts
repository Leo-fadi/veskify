import { getCommercialContentSupportProfile } from "@/application/storefront-templates";
import { aurumNordicSeed } from "@/data/seed";
import {
  applyCommercialSharedFrame,
  contentSupportPageFamilyIdSchema,
  createContentSupportFactDocument,
  pageModelSchema,
  type ContentSupportFactDocument,
  type ContentSupportPageFamilyId,
  type StorefrontSnapshot,
} from "@/domain/storefront";

const text = (en: string, fi: string) => ({ en, fi });

function payload(familyId: ContentSupportPageFamilyId) {
  const title = text(`${familyId} approved title`, `${familyId} hyväksytty otsikko`);
  const introduction = text(
    "This deterministic browser proof contains only approved fixture facts.",
    "Tämä deterministinen selaintodiste sisältää vain hyväksyttyjä fixture-faktoja.",
  );
  if (familyId === "about" || familyId === "generic-content") {
    return {
      familyId,
      title,
      introduction,
      blocks: [],
      story: {
        heading: text("An approved story", "Hyväksytty tarina"),
        body: text(
          "A bounded story from approved evidence.",
          "Rajattu tarina hyväksytystä evidenssistä.",
        ),
        steps: [
          {
            id: "approved-step",
            title: text("Approved process", "Hyväksytty prosessi"),
            description: text(
              "A bounded source-confirmed step.",
              "Rajattu lähteessä vahvistettu vaihe.",
            ),
          },
        ],
      },
    };
  }
  if (familyId === "contact") {
    return {
      familyId,
      title,
      introduction,
      blocks: [
        {
          kind: "contact-channel" as const,
          id: "support-email",
          channel: "email" as const,
          label: text("Email", "Sähköposti"),
          value: "support@merchant.example",
        },
      ],
    };
  }
  if (familyId === "store-locations") {
    return {
      familyId,
      title,
      introduction,
      blocks: [
        {
          kind: "location" as const,
          id: "approved-location",
          name: text("Approved location", "Hyväksytty sijainti"),
          addressLines: [text("Evidence Street 1", "Evidenssikatu 1")],
          openingHours: [text("Mon–Fri 10–18", "Ma–Pe 10–18")],
        },
      ],
    };
  }
  if (familyId === "faq") {
    return {
      familyId,
      title,
      introduction,
      blocks: [
        {
          kind: "faq" as const,
          id: "approved-faq",
          question: text("Approved question", "Hyväksytty kysymys"),
          answer: text("Approved answer", "Hyväksytty vastaus"),
        },
      ],
    };
  }
  if (familyId === "campaign-editorial") {
    return {
      familyId,
      title,
      introduction,
      blocks: [],
      campaign: {
        heading: text("Approved campaign", "Hyväksytty kampanja"),
        description: text(
          "Campaign copy from approved evidence.",
          "Kampanjateksti hyväksytystä evidenssistä.",
        ),
      },
    };
  }
  return {
    familyId,
    title,
    introduction,
    blocks: [
      {
        kind: "policy-section" as const,
        id: "approved-policy",
        heading: text("Approved terms", "Hyväksytyt ehdot"),
        body: text("A bounded approved policy fact.", "Rajattu hyväksytty käytäntöfakta."),
      },
    ],
  };
}

export type P10B12ContentSupportProof = Readonly<{
  snapshot: StorefrontSnapshot;
  pageId: string;
  document: ContentSupportFactDocument;
  profileId: string;
  structuralFingerprint: string;
}>;

/** Deterministic browser-only proof fixture; source-workflow resolution is covered by unit tests. */
export function createP10B12ContentSupportProof(
  input: Readonly<{
    familyId: ContentSupportPageFamilyId;
    profileId: string;
  }>,
): P10B12ContentSupportProof {
  const familyId = contentSupportPageFamilyIdSchema.parse(input.familyId);
  const plan = getCommercialContentSupportProfile(input.profileId);
  const authority = plan?.profile?.commercialContentSupport;
  const slot = plan?.slots[0];
  if (!plan || !authority || !slot || !authority.pageFamilyIds.includes(familyId)) {
    throw new Error("The browser proof requires a registered matching P10B-12 profile.");
  }
  const evidence = {
    source: "approved-source-evidence" as const,
    authorityId: `evidence_p10b12_${familyId.replaceAll("-", "_")}`,
    revision: "1",
    status: "approved" as const,
    approvalAuthorityId: "brief_p10b12_browser_proof",
    approvalFingerprint: "p10b12-browser-proof-approved-evidence",
  };
  const document = createContentSupportFactDocument({ evidence, payload: payload(familyId) });
  const pageId = `page_p10b12_${familyId.replaceAll("-", "_")}`;
  const page = pageModelSchema.parse({
    id: pageId,
    type: plan.pageType,
    slug: familyId === "campaign-editorial" ? "/campaigns/approved" : `/pages/${familyId}`,
    title: payload(familyId).title,
    seo: {
      title: payload(familyId).title,
      metaDescription: text("Approved browser proof.", "Hyväksytty selaintodiste."),
    },
    pageFamily: {
      familyId,
      familyVersion: "1.0.0",
      profileId: plan.profile!.id,
      profileVersion: plan.profile!.version,
      localeCoverage: ["en", "fi"],
      sharedFrameId: "blueprint-shared-storefront-frame",
      sharedFrameVersion: "1.0.0",
      commerceContext: { kind: "none" },
      commerceOperationAuthority: "read-only-presentation",
      navigationAreas: ["footer"],
      evidenceReferences: [evidence],
    },
    sections: [
      {
        id: "section_p10b12_content_support",
        component: "contentSupport",
        variant: slot.defaultVariant,
        visible: true,
        content: { factDocumentId: document.id },
        props: { readingWidth: "standard", textAlignment: "left" },
        styleOverrides: { contentWidth: "standard" },
      },
    ],
  });
  const snapshot = applyCommercialSharedFrame(
    {
      ...structuredClone(aurumNordicSeed.draftSnapshot),
      pages: [...structuredClone(aurumNordicSeed.draftSnapshot.pages), page],
      contentSupportFactDocuments: [document],
    },
    authority.defaultSharedFrameProfileId,
  );
  return Object.freeze({
    snapshot,
    pageId,
    document,
    profileId: plan.profile!.id,
    structuralFingerprint: authority.structuralFingerprint,
  });
}
