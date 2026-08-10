import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createStorefrontDesignBriefContentSupportFactAuthority,
  materializeContentSupportPage,
  materializeContentSupportSnapshot,
} from "@/application/content-support-pages";
import {
  createStorefrontDesignBriefPageFactEvidenceAuthority,
  materializeStorefrontSiteMap,
} from "@/application/storefront-site-map";
import {
  listCommercialContentSupportProfiles,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  createStorefrontRenderContext,
  validateRegisteredPage,
  validateRegisteredSnapshot,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { aurumNordicSeed } from "@/data/seed";
import { createIdleUrlBriefWorkflow, urlBriefWorkflowSchema } from "@/domain/onboarding";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import {
  reconciliationResultSchema,
  sourceDiscoveryResultSchema,
  sourceEvidenceSchema,
  sourceReferenceSchema,
  type EvidenceKind,
} from "@/domain/source-discovery";
import {
  canonicalStorefrontContentFingerprint,
  listPageFamilyDefinitions,
  pageModelSchema,
  storefrontSnapshotSchema,
  type ContentSupportPageFamilyId,
  type PageFamilyId,
} from "@/domain/storefront";
import type { StorefrontSiteMapDecision } from "@/application/storefront-site-map";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const now = "2026-08-09T18:00:00.000Z";
const localized = (en: string, fi: string) => ({ en, fi });

const profileByFamily: Readonly<Record<ContentSupportPageFamilyId, string>> = {
  about: "content-about-story",
  contact: "content-contact-directory",
  "store-locations": "content-location-directory",
  faq: "content-faq-topic-guide",
  "shipping-information": "content-service-details",
  "returns-information": "content-service-details",
  "policy-legal": "content-policy-reading",
  "campaign-editorial": "landing-campaign-image-led",
  "generic-content": "content-generic-editorial",
};

function payload(familyId: ContentSupportPageFamilyId) {
  const title = localized(`${familyId} title`, `${familyId} otsikko`);
  const introduction = localized("Approved information only.", "Vain hyväksyttyä tietoa.");
  switch (familyId) {
    case "about":
      return {
        familyId,
        title,
        introduction,
        blocks: [
          {
            kind: "paragraph" as const,
            id: "origin",
            body: localized("A source-confirmed origin.", "Lähteessä vahvistettu alku."),
          },
        ],
        story: {
          eyebrow: localized("Approved story", "Hyväksytty tarina"),
          heading: localized("A source-confirmed origin", "Lähteessä vahvistettu alku"),
          body: localized(
            "This wording comes from approved evidence.",
            "Tämä teksti tulee hyväksytystä evidenssistä.",
          ),
          steps: [],
        },
      };
    case "contact":
      return {
        familyId,
        title,
        introduction,
        blocks: [
          {
            kind: "contact-channel" as const,
            id: "support-email",
            channel: "email" as const,
            label: localized("Email", "Sähköposti"),
            value: "support@merchant.example",
          },
        ],
      };
    case "store-locations":
      return {
        familyId,
        title,
        introduction,
        blocks: [
          {
            kind: "location" as const,
            id: "helsinki-store",
            name: localized("Helsinki store", "Helsingin myymälä"),
            addressLines: [localized("Evidence Street 1", "Evidenssikatu 1")],
            openingHours: [localized("Mon–Fri 10–18", "Ma–Pe 10–18")],
          },
        ],
      };
    case "faq":
      return {
        familyId,
        title,
        introduction,
        blocks: [
          {
            kind: "faq" as const,
            id: "faq-care",
            question: localized("How do I get support?", "Miten saan tukea?"),
            answer: localized(
              "Use the approved contact channel.",
              "Käytä hyväksyttyä yhteydenottokanavaa.",
            ),
          },
        ],
      };
    case "shipping-information":
    case "returns-information":
    case "policy-legal":
      return {
        familyId,
        title,
        introduction,
        blocks: [
          {
            kind: "policy-section" as const,
            id: "approved-policy",
            heading: localized("Approved terms", "Hyväksytyt ehdot"),
            body: localized(
              "This bounded statement is sourced from approved evidence.",
              "Tämä rajattu väite perustuu hyväksyttyyn evidenssiin.",
            ),
          },
        ],
      };
    case "campaign-editorial":
      return {
        familyId,
        title,
        introduction,
        blocks: [],
        campaign: {
          eyebrow: localized("Approved campaign", "Hyväksytty kampanja"),
          heading: localized("A source-confirmed campaign", "Lähteessä vahvistettu kampanja"),
          description: localized(
            "Campaign copy from approved evidence.",
            "Kampanjateksti hyväksytystä evidenssistä.",
          ),
          actionLabel: localized("Explore", "Tutustu"),
        },
      };
    case "generic-content":
      return {
        familyId,
        title,
        introduction,
        blocks: [
          {
            kind: "paragraph" as const,
            id: "journal-note",
            body: localized(
              "A bounded approved journal note.",
              "Rajattu hyväksytty julkaisumerkintä.",
            ),
          },
        ],
        story: {
          heading: localized("Approved journal note", "Hyväksytty julkaisumerkintä"),
          body: localized(
            "Editorial content from evidence.",
            "Toimituksellinen sisältö evidenssistä.",
          ),
          steps: [],
        },
      };
  }
}

function approvedWorkflow(
  familyId: ContentSupportPageFamilyId,
  value: unknown = payload(familyId),
) {
  const source = sourceReferenceSchema.parse({
    id: `source_${familyId.replaceAll("-", "_")}`,
    sourceType: "deterministic-fixture",
    url: "https://merchant.example/approved-content",
    normalizedOrigin: "https://merchant.example",
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 5,
      maxAssets: 10,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
  const evidenceKind: EvidenceKind =
    familyId === "campaign-editorial" ? "marketing-copy-candidate" : "merchant-brand-fact";
  const evidence = sourceEvidenceSchema.parse({
    id: `evidence_${familyId.replaceAll("-", "_")}`,
    kind: evidenceKind,
    provenance: {
      sourceReferenceId: source.id,
      sourceUrl: source.url,
      observedAt: now,
      extractionLocation: "approved deterministic P10B-12 fact",
    },
    sourceUrl: source.url,
    confidence: 1,
    observedValue: value,
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
  });
  const discovery = sourceDiscoveryResultSchema.parse({
    source,
    evidence: [evidence],
    assetCandidates: [],
    warnings: [],
  });
  const reconciliation = reconciliationResultSchema.parse({
    sourceReferenceId: source.id,
    canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
    decisions: [],
    unresolvedConflictIds: [],
    missingInformationIds: [],
  });
  const materialEvidence = {
    sourceReferences: [source],
    evidence: [evidence],
    assetCandidates: [],
    reconciliation,
  };
  const brief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: `brief_${familyId.replaceAll("-", "_")}`,
      now,
      businessIdentity: { businessName: "Approved Merchant" },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      sourceReferenceIds: [source.id],
      sourceEvidenceIds: [evidence.id],
      materialEvidence,
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      approvedBrandDirection: {
        logoAssetRef: null,
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#132a24"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "product-focused",
        toneKeywords: ["warm"],
      },
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      unresolvedItems: [],
      materialUnresolvedBlockers: [],
    }),
    { actorId: "merchant_owner", approvedAt: now },
  );
  const idle = createIdleUrlBriefWorkflow({ id: `workflow_${familyId.replaceAll("-", "_")}`, now });
  return urlBriefWorkflowSchema.parse({
    ...idle,
    status: "approved",
    lastSafeState: "approved",
    sourceReferences: [source],
    currentSourceReferenceId: source.id,
    discoveryResult: discovery,
    reconciliation,
    briefRevisions: [brief],
    currentBriefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint,
  });
}

function canonicalPage(
  familyId: ContentSupportPageFamilyId,
  workflow = approvedWorkflow(familyId),
) {
  const sourceAuthority = createStorefrontDesignBriefPageFactEvidenceAuthority(workflow);
  const evidenceId = `evidence_${familyId.replaceAll("-", "_")}`;
  const evidence = sourceAuthority.resolve({
    familyId,
    reference: { source: "approved-source-evidence", authorityId: evidenceId, revision: "1" },
  });
  const isCampaign = familyId === "campaign-editorial";
  return pageModelSchema.parse({
    id: `page_${familyId.replaceAll("-", "_")}`,
    type: isCampaign ? "landing" : "content",
    slug: isCampaign ? "/campaigns/approved" : `/pages/${familyId}`,
    title: localized(`${familyId} title`, `${familyId} otsikko`),
    seo: {
      title: localized(`${familyId} title`, `${familyId} otsikko`),
      metaDescription: localized("Approved content", "Hyväksytty sisältö"),
    },
    pageFamily: {
      familyId,
      familyVersion: "1.0.0",
      profileId: profileByFamily[familyId],
      profileVersion: "1.0.0",
      localeCoverage: ["en", "fi"],
      sharedFrameId: "blueprint-shared-storefront-frame",
      sharedFrameVersion: "1.0.0",
      commerceContext: { kind: "none" },
      commerceOperationAuthority: "read-only-presentation",
      navigationAreas: ["footer"],
      evidenceReferences: [evidence],
    },
    sections: [],
  });
}

function materialized(familyId: ContentSupportPageFamilyId) {
  const workflow = approvedWorkflow(familyId);
  const factAuthority = createStorefrontDesignBriefContentSupportFactAuthority(workflow);
  const page = canonicalPage(familyId, workflow);
  const result = materializeContentSupportPage({ page, factAuthority });
  if (!page.pageFamily)
    throw new Error("The canonical content/support test page must retain page-family authority.");
  const evidence = page.pageFamily.evidenceReferences[0];
  const document = factAuthority.resolve({
    familyId,
    reference: {
      source: evidence.source,
      authorityId: evidence.authorityId,
      revision: evidence.revision,
    },
  });
  const snapshot = {
    navigation: { primary: [], footer: [] },
    pages: [result.page],
    brandSystem: aurumNordicSeed.draftSnapshot.brandSystem,
    contentSupportFactDocuments: [document],
  };
  const context = createStorefrontRenderContext({
    activeLocale: "en",
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue: aurumNordicSeed.catalogue,
    snapshot,
    evidenceReferences: page.pageFamily.evidenceReferences,
  });
  return { page, result, document, context };
}

const routeByFamily: Readonly<Record<PageFamilyId, string>> = {
  home: "/",
  collection: "/collections/rings",
  "search-results": "/search",
  "product-detail": "/products/aurora-ring-585",
  about: "/pages/about",
  contact: "/pages/contact",
  "store-locations": "/pages/locations",
  faq: "/pages/faq",
  "shipping-information": "/pages/shipping",
  "returns-information": "/pages/returns",
  "policy-legal": "/pages/privacy",
  "generic-content": "/pages/journal",
  "campaign-editorial": "/campaigns/approved",
  cart: "/cart",
  checkout: "/checkout",
  "no-results": "/states/no-results",
  "empty-state": "/states/empty",
  "error-state": "/states/error",
  "not-found": "/404",
};

const baselineProfileByFamily: Readonly<Record<PageFamilyId, string>> = {
  home: "blueprint-site-map-home-baseline",
  collection: "blueprint-site-map-collection-baseline",
  "search-results": "blueprint-site-map-search-baseline",
  "product-detail": "blueprint-site-map-product-baseline",
  about: "content-about-story",
  contact: "blueprint-site-map-content-baseline",
  "store-locations": "blueprint-site-map-content-baseline",
  faq: "blueprint-site-map-content-baseline",
  "shipping-information": "blueprint-site-map-content-baseline",
  "returns-information": "blueprint-site-map-content-baseline",
  "policy-legal": "blueprint-site-map-content-baseline",
  "generic-content": "blueprint-site-map-content-baseline",
  "campaign-editorial": "blueprint-site-map-campaign-baseline",
  cart: "blueprint-site-map-cart-baseline",
  checkout: "blueprint-site-map-checkout-baseline",
  "no-results": "blueprint-site-map-state-baseline",
  "empty-state": "blueprint-site-map-state-baseline",
  "error-state": "blueprint-site-map-state-baseline",
  "not-found": "blueprint-site-map-state-baseline",
};

function completeSiteMapWithApprovedAbout(workflow: ReturnType<typeof approvedWorkflow>) {
  const pageAuthority = createStorefrontDesignBriefPageFactEvidenceAuthority(workflow);
  const aboutEvidence = pageAuthority.resolve({
    familyId: "about",
    reference: { source: "approved-source-evidence", authorityId: "evidence_about", revision: "1" },
  });
  const decision: StorefrontSiteMapDecision = {
    schemaVersion: 1,
    projectId: aurumNordicSeed.draftSnapshot.projectId,
    localeCoverage: ["en", "fi"],
    sharedFrame: { id: "blueprint-shared-storefront-frame", version: "1.0.0" },
    pages: listPageFamilyDefinitions().flatMap((definition, definitionIndex) => {
      const page = (
        familyId: PageFamilyId,
        route: string,
        commerceContext: StorefrontSiteMapDecision["pages"][number]["commerceContext"],
      ): StorefrontSiteMapDecision["pages"][number] => ({
        key: `p10b12-${familyId}-${route.split("/").filter(Boolean).join("-") || "root"}`,
        familyId,
        familyVersion: "1.0.0" as const,
        route,
        required: ![
          "contact",
          "store-locations",
          "faq",
          "shipping-information",
          "returns-information",
          "policy-legal",
          "generic-content",
          "campaign-editorial",
        ].includes(familyId),
        profile: { id: baselineProfileByFamily[familyId], version: "1.0.0" as const },
        localeCoverage: ["en", "fi"],
        title: localized(`${familyId} title`, `${familyId} otsikko`),
        seo: {
          title: localized(`${familyId} title`, `${familyId} otsikko`),
          metaDescription: localized("Approved page", "Hyväksytty sivu"),
        },
        commerceContext,
        navigation:
          familyId === "home" ||
          familyId === "collection" ||
          familyId === "search-results" ||
          familyId === "campaign-editorial"
            ? [
                {
                  area: "primary" as const,
                  order: definitionIndex,
                  label: localized(`${familyId} navigation`, `${familyId} navigointi`),
                },
              ]
            : familyId === "product-detail" ||
                [
                  "about",
                  "contact",
                  "faq",
                  "shipping-information",
                  "returns-information",
                  "policy-legal",
                ].includes(familyId)
              ? [
                  {
                    area: "footer" as const,
                    order: definitionIndex,
                    label: localized(`${familyId} navigation`, `${familyId} navigointi`),
                  },
                ]
              : [],
        ...(familyId === "store-locations" ? { parentKey: "contact" } : {}),
        ...(familyId === "generic-content" ? { parentKey: "about" } : {}),
        evidenceReferences:
          familyId === "about"
            ? [
                {
                  source: aboutEvidence.source,
                  authorityId: aboutEvidence.authorityId,
                  revision: aboutEvidence.revision,
                },
              ]
            : [],
      });
      if (definition.id === "collection") {
        return aurumNordicSeed.catalogue.collections.map((collection) =>
          page("collection", `/collections/${collection.slug}`, {
            kind: "collection",
            collectionId: collection.id,
          }),
        );
      }
      if (definition.id === "product-detail") {
        return aurumNordicSeed.catalogue.products.map((product, index) =>
          page("product-detail", `/products/product-${index + 1}`, {
            kind: "product",
            productId: product.id,
          }),
        );
      }
      return [
        page(
          definition.id,
          routeByFamily[definition.id],
          definition.id === "search-results" ? { kind: "search" } : { kind: "none" },
        ),
      ];
    }),
  };
  return materializeStorefrontSiteMap({
    decision,
    baseSnapshot: aurumNordicSeed.draftSnapshot,
    catalogue: aurumNordicSeed.catalogue,
    evidenceAuthority: pageAuthority,
  });
}

describe("P10B-12 content and support page families", () => {
  it("registers bounded, structurally distinct profiles for every required family", () => {
    const profiles = listCommercialContentSupportProfiles();
    expect(profiles).toHaveLength(15);
    expect(
      new Set(
        profiles.map((profile) => profile.profile?.commercialContentSupport?.structuralSignature),
      ).size,
    ).toBe(15);
    expect(
      profiles.filter((profile) =>
        profile.profile?.commercialContentSupport?.pageFamilyIds.includes("about"),
      ),
    ).toHaveLength(2);
    expect(
      profiles.filter((profile) =>
        profile.profile?.commercialContentSupport?.pageFamilyIds.includes("contact"),
      ),
    ).toHaveLength(2);
    expect(
      profiles.filter((profile) =>
        profile.profile?.commercialContentSupport?.pageFamilyIds.includes("store-locations"),
      ),
    ).toHaveLength(2);
    expect(
      profiles.filter((profile) =>
        profile.profile?.commercialContentSupport?.pageFamilyIds.includes("faq"),
      ),
    ).toHaveLength(2);
    expect(
      profiles.filter((profile) =>
        profile.profile?.commercialContentSupport?.pageFamilyIds.includes("campaign-editorial"),
      ),
    ).toHaveLength(3);
    profiles.forEach((profile) =>
      expect(() =>
        materializeExecutablePageBlueprint({
          pagePlan: profile,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: ["localizedContent"],
        }),
      ).not.toThrow(),
    );
  });

  it("materializes only source-approved facts for every content/support family and keeps page authority intact", () => {
    const families: readonly ContentSupportPageFamilyId[] = [
      "about",
      "contact",
      "store-locations",
      "faq",
      "shipping-information",
      "returns-information",
      "policy-legal",
      "campaign-editorial",
      "generic-content",
    ];
    families.forEach((familyId) => {
      const resolved = materialized(familyId);
      expect(resolved.result.page.pageFamily).toEqual(resolved.page.pageFamily);
      expect(resolved.result.page.sections).toHaveLength(1);
      expect(resolved.result.page.sections[0]?.content).toEqual({
        factDocumentId: resolved.document.id,
      });
      expect(resolved.document.evidence).toEqual(resolved.page.pageFamily!.evidenceReferences[0]);
      expect(() => validateRegisteredPage(resolved.result.page, resolved.context)).not.toThrow();
      const html = renderToStaticMarkup(
        renderStorefrontPage(resolved.result.page, resolved.context),
      );
      expect(html).toMatch(/approved/i);
      expect(html).not.toContain("unapproved caller fact");
    });
  });

  it("uses existing P10B-07 editorial and promotion renderers while retaining P10B-12 fact binding", () => {
    const about = materialized("about");
    const campaign = materialized("campaign-editorial");
    expect(renderToStaticMarkup(renderStorefrontPage(about.result.page, about.context))).toContain(
      'data-component="homepageEditorial"',
    );
    expect(
      renderToStaticMarkup(renderStorefrontPage(campaign.result.page, campaign.context)),
    ).toContain('data-component="homepagePromotion"');
    expect(about.result.page.sections[0]?.component).toBe("contentSupport");
    expect(campaign.result.page.sections[0]?.content).toEqual({
      factDocumentId: campaign.document.id,
    });
  });

  it("fails closed for stale, revoked, malformed, omitted and cross-family fact declarations", () => {
    const workflow = approvedWorkflow("contact");
    const authority = createStorefrontDesignBriefContentSupportFactAuthority(workflow);
    expect(() =>
      authority.resolve({
        familyId: "contact",
        reference: {
          source: "approved-source-evidence",
          authorityId: "evidence_contact",
          revision: "2",
        },
      }),
    ).toThrow(/current brief revision/i);
    const revoked = { ...workflow, status: "idle" as const };
    expect(() =>
      createStorefrontDesignBriefContentSupportFactAuthority(revoked).resolve({
        familyId: "contact",
        reference: {
          source: "approved-source-evidence",
          authorityId: "evidence_contact",
          revision: "1",
        },
      }),
    ).toThrow(/not covered by a current approved brief/i);
    const malformed = approvedWorkflow("contact", {
      familyId: "contact",
      title: "caller supplied",
    });
    expect(() =>
      createStorefrontDesignBriefContentSupportFactAuthority(malformed).resolve({
        familyId: "contact",
        reference: {
          source: "approved-source-evidence",
          authorityId: "evidence_contact",
          revision: "1",
        },
      }),
    ).toThrow(/bounded P10B-12 fact payload/i);
    const noEvidence = canonicalPage("generic-content");
    noEvidence.pageFamily!.evidenceReferences = [];
    expect(() =>
      materializeContentSupportPage({ page: noEvidence, factAuthority: authority }),
    ).toThrow(/no approved fact reference/i);
    expect(() =>
      authority.resolve({
        familyId: "faq",
        reference: {
          source: "approved-source-evidence",
          authorityId: "evidence_contact",
          revision: "1",
        },
      }),
    ).toThrow(/belongs to contact, not faq/i);
  });

  it("rejects an editorial realization when approved facts omit its required story", () => {
    const workflow = approvedWorkflow("generic-content", {
      familyId: "generic-content",
      title: localized("Journal", "Päiväkirja"),
      introduction: localized("Approved reading", "Hyväksytty luettava"),
      blocks: [
        {
          kind: "paragraph",
          id: "approved-note",
          body: localized("Approved paragraph only.", "Vain hyväksytty kappale."),
        },
      ],
    });
    expect(() =>
      materializeContentSupportPage({
        page: canonicalPage("generic-content", workflow),
        factAuthority: createStorefrontDesignBriefContentSupportFactAuthority(workflow),
      }),
    ).toThrow(/generic editorial composition requires approved story facts/i);
  });

  it("uses only explicit current evidence for content/support validation", () => {
    const workflow = approvedWorkflow("about");
    const factAuthority = createStorefrontDesignBriefContentSupportFactAuthority(workflow);
    const siteMap = completeSiteMapWithApprovedAbout(workflow);
    const about = siteMap.snapshot.pages.find((page) => page.pageFamily?.familyId === "about")!;
    const materializedSnapshot = materializeContentSupportSnapshot({
      snapshot: siteMap.snapshot,
      pageId: about.id,
      factAuthority,
    });
    const evidence = about.pageFamily!.evidenceReferences;

    expect(() =>
      validateRegisteredSnapshot(
        materializedSnapshot.snapshot,
        aurumNordicSeed.catalogue,
        "en",
        "en",
        ["en", "fi"],
        [],
        materializedSnapshot.snapshot.contentSupportFactDocuments,
      ),
    ).toThrow(/fact evidence is not current/i);
    expect(() =>
      validateRegisteredSnapshot(
        materializedSnapshot.snapshot,
        aurumNordicSeed.catalogue,
        "en",
        "en",
        ["en", "fi"],
        evidence,
        materializedSnapshot.snapshot.contentSupportFactDocuments,
      ),
    ).not.toThrow();
    // Persistence may check snapshot structure without fabricating an external
    // approval context; render and publish validation must pass one explicitly.
    expect(() =>
      validateRegisteredSnapshot(
        materializedSnapshot.snapshot,
        aurumNordicSeed.catalogue,
        "en",
        "en",
      ),
    ).not.toThrow();
  });

  it("preserves legacy fingerprints while fingerprinting approved fact documents", () => {
    const legacyInput = structuredClone(aurumNordicSeed.draftSnapshot) as Record<string, unknown>;
    delete legacyInput.contentSupportFactDocuments;
    const legacy = storefrontSnapshotSchema.parse(legacyInput);
    const normalized = storefrontSnapshotSchema.parse({
      ...legacy,
      contentSupportFactDocuments: [],
    });
    expect(canonicalStorefrontContentFingerprint(normalized)).toBe(
      canonicalStorefrontContentFingerprint(legacy),
    );

    const workflow = approvedWorkflow("about");
    const siteMap = completeSiteMapWithApprovedAbout(workflow);
    const materializedSnapshot = materializeContentSupportSnapshot({
      snapshot: siteMap.snapshot,
      pageId: siteMap.snapshot.pages.find((page) => page.pageFamily?.familyId === "about")!.id,
      factAuthority: createStorefrontDesignBriefContentSupportFactAuthority(workflow),
    });
    const withoutDocuments = storefrontSnapshotSchema.parse({
      ...materializedSnapshot.snapshot,
      contentSupportFactDocuments: [],
    });
    expect(canonicalStorefrontContentFingerprint(materializedSnapshot.snapshot)).not.toBe(
      canonicalStorefrontContentFingerprint(withoutDocuments),
    );
  });

  it("uses canonical section surfaces in the V2 bridge and rendered output", () => {
    const resolved = materialized("faq");
    const section = resolved.result.page.sections[0];
    const accented = pageModelSchema.parse({
      ...resolved.result.page,
      sections: [
        {
          ...section,
          styleOverrides: { ...section.styleOverrides, surface: "accent" },
        },
      ],
    });
    expect(renderToStaticMarkup(renderStorefrontPage(accented, resolved.context))).toContain(
      'data-surface="accent"',
    );
    expect(() =>
      pageModelSchema.parse({
        ...resolved.result.page,
        sections: [{ ...section, styleOverrides: { surface: "plain" } }],
      }),
    ).toThrow();
  });

  it("persists the fact document through canonical repository save/reload", async () => {
    const workflow = approvedWorkflow("about");
    const factAuthority = createStorefrontDesignBriefContentSupportFactAuthority(workflow);
    const siteMap = completeSiteMapWithApprovedAbout(workflow);
    const about = siteMap.snapshot.pages.find((page) => page.pageFamily?.familyId === "about")!;
    const materializedSnapshot = materializeContentSupportSnapshot({
      snapshot: siteMap.snapshot,
      pageId: about.id,
      factAuthority,
    });
    const aggregate: ProjectAggregate = {
      project: structuredClone(aurumNordicSeed.project),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      snapshots: [
        structuredClone(aurumNordicSeed.publishedSnapshot),
        structuredClone(aurumNordicSeed.draftSnapshot),
      ],
    };
    const repository = new InMemoryProjectRepository([aggregate]);
    await repository.saveDraft(
      materializedSnapshot.snapshot.projectId,
      materializedSnapshot.snapshot,
      {
        id: aurumNordicSeed.draftSnapshot.id,
        revision: aurumNordicSeed.draftSnapshot.revision,
      },
    );
    const reloaded = await repository.get(materializedSnapshot.snapshot.projectId);
    const draft = reloaded.snapshots.find(({ id }) => id === reloaded.project.draftSnapshotId)!;
    const reloadedPage = draft.pages.find((page) => page.id === about.id)!;
    expect(draft.contentSupportFactDocuments).toEqual([
      materializedSnapshot.materialization.factDocument,
    ]);
    const reloadedContext = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: reloaded.catalogue,
      snapshot: draft,
      evidenceReferences: reloadedPage.pageFamily!.evidenceReferences,
    });
    expect(() => validateRegisteredPage(reloadedPage, reloadedContext)).not.toThrow();
    expect(reloadedPage.sections[0].content.factDocumentId).toBe(
      materializedSnapshot.materialization.factDocument.id,
    );
  });

  it("preserves the current approved fact document through the deterministic publish compiler", () => {
    const workflow = approvedWorkflow("about");
    const factAuthority = createStorefrontDesignBriefContentSupportFactAuthority(workflow);
    const siteMap = completeSiteMapWithApprovedAbout(workflow);
    const about = siteMap.snapshot.pages.find((page) => page.pageFamily?.familyId === "about")!;
    const materializedSnapshot = materializeContentSupportSnapshot({
      snapshot: siteMap.snapshot,
      pageId: about.id,
      factAuthority,
    });
    const snapshot = storefrontSnapshotSchema.parse(materializedSnapshot.snapshot);
    if (!materializedSnapshot.materialization.page.pageFamily)
      throw new Error("The materialized content/support page must retain page-family authority.");
    const evidence = materializedSnapshot.materialization.page.pageFamily.evidenceReferences[0];
    const compilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: {
          project: structuredClone(aurumNordicSeed.project),
          catalogue: structuredClone(aurumNordicSeed.catalogue),
          snapshots: [structuredClone(aurumNordicSeed.publishedSnapshot), snapshot],
        },
        snapshot,
        sourceAuthority: { kind: "manual" },
        currentEvidenceReferences: [evidence],
      }),
    );
    expect(compilation.result.contentSupportFactDocuments).toEqual(
      snapshot.contentSupportFactDocuments,
    );
    expect(
      compilation.result.pages.find((entry) => entry.page.id === about.id)?.page.sections[0]
        ?.content,
    ).toEqual({
      factDocumentId: materializedSnapshot.materialization.factDocument.id,
    });
  });
});
