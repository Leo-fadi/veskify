import { describe, expect, it } from "vitest";
import type { AiOperationPermissionGrant } from "@/application/ai-provider";
import {
  aiStorefrontProjectionSchema,
  aiStorefrontProposalSchema,
  canonicalizeAiStorefrontTarget,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontTargetFingerprint,
  validateAiStorefrontOperations,
  validateAiStorefrontProposal,
  type AiStorefrontOperation,
  type AiStorefrontTarget,
} from "@/application/ai-storefront";
import { aurumNordicSeed } from "@/data/seed";
import type { PageModel, SectionInstance } from "@/domain/storefront";

const snapshot = aurumNordicSeed.draftSnapshot;
const homePage = snapshot.pages.find((page) => page.type === "home")!;
const collectionPage = snapshot.pages.find((page) => page.type === "collection")!;
const campaign = homePage.sections.find((section) => section.component === "campaignBanner")!;
const productGrid = homePage.sections.find((section) => section.component === "productGrid")!;
const benefits = homePage.sections.find((section) => section.component === "benefitIcons")!;

function storefrontContext() {
  return {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    enabledLocales: ["en", "fi"] as const,
    activeLocale: "en" as const,
    storefront: {
      pageOrder: snapshot.pages.map((page) => page.id),
      pages: structuredClone(snapshot.pages),
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
    },
  };
}

function storefrontTarget({
  pages,
  sections = [],
  designSystem = false,
}: {
  pages: readonly PageModel[];
  sections?: ReadonlyArray<{ pageId: string; sectionId: string }>;
  designSystem?: boolean;
}): AiStorefrontTarget {
  return canonicalizeAiStorefrontTarget({
    scope: "storefront",
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    affectedPageIds: pages.map((page) => page.id),
    affectedSectionTargets: sections,
    designSystemTarget: designSystem
      ? { kind: "storefrontDesignSystem", projectId: aurumNordicSeed.project.id }
      : null,
    enabledLocales: ["fi", "en"],
    activeLocale: "en",
  });
}

function existingSectionGrant(
  page: PageModel,
  section: SectionInstance,
  operationTypes: AiOperationPermissionGrant["operationTypes"],
): AiOperationPermissionGrant {
  return {
    skillId: "reviewExistingSection",
    skillVersion: "1.0.0",
    skillScope: "section",
    operationTypes,
    target: {
      kind: "existingSection",
      pageId: page.id,
      sectionId: section.id,
      componentType: section.component,
    },
  };
}

function introducedSectionGrant(
  page: PageModel,
  sectionId: string,
  componentType: string,
  operationTypes: AiOperationPermissionGrant["operationTypes"],
): AiOperationPermissionGrant {
  return {
    skillId: "reviewIntroducedSection",
    skillVersion: "1.0.0",
    skillScope: "page",
    operationTypes,
    target: { kind: "introducedSection", pageId: page.id, sectionId, componentType },
  };
}

function pageGrant(page: PageModel): AiOperationPermissionGrant {
  return {
    skillId: "reviewPage",
    skillVersion: "1.0.0",
    skillScope: "page",
    operationTypes: ["REORDER_SECTIONS"],
    target: { kind: "page", pageId: page.id },
  };
}

function sectionOperation(
  page: PageModel,
  sectionId: string,
  operation: AiStorefrontOperation["operation"],
  order = 0,
): AiStorefrontOperation {
  return {
    order,
    target: { kind: "section", pageId: page.id, sectionId },
    operation,
  };
}

function pageOperation(page: PageModel, sectionIds: string[], order = 0): AiStorefrontOperation {
  return {
    order,
    target: { kind: "page", pageId: page.id },
    operation: { type: "REORDER_SECTIONS", sectionIds },
  };
}

function swap<T>(values: readonly T[], left: number, right: number): T[] {
  const next = [...values];
  [next[left], next[right]] = [next[right], next[left]];
  return next;
}

function readyProposal({
  target = storefrontTarget({
    pages: [homePage],
    sections: [{ pageId: homePage.id, sectionId: campaign.id }],
  }),
  grants = [existingSectionGrant(homePage, campaign, ["CHANGE_SECTION_VARIANT"])],
  operations = [
    sectionOperation(homePage, campaign.id, {
      type: "CHANGE_SECTION_VARIANT",
      sectionId: campaign.id,
      variant: "minimal",
    }),
  ],
  proposedStorefront,
}: {
  target?: AiStorefrontTarget;
  grants?: AiOperationPermissionGrant[];
  operations?: AiStorefrontOperation[];
  proposedStorefront?: ReturnType<typeof storefrontContext>["storefront"];
} = {}) {
  const context = storefrontContext();
  const proposed = proposedStorefront ?? structuredClone(context.storefront);
  if (!proposedStorefront) {
    const section = proposed.pages
      .find((page) => page.id === homePage.id)!
      .sections.find((candidate) => candidate.id === campaign.id)!;
    section.variant = "minimal";
  }
  return {
    id: "storefront_proposal_deadbeef",
    requestId: "request_storefront_review",
    projectId: target.projectId,
    draftSnapshotId: target.draftSnapshotId,
    draftRevision: target.draftRevision,
    target,
    originalStorefront: structuredClone(context.storefront),
    proposedStorefront: proposed,
    affectedPages: target.affectedPageIds.map((pageId) =>
      structuredClone(context.storefront.pages.find((page) => page.id === pageId)!),
    ),
    affectedDesignState: null,
    permissionGrants: grants,
    targetFingerprint: createAiStorefrontTargetFingerprint(context, target),
    permissionFingerprint: createAiStorefrontPermissionFingerprint(grants, target, context),
    operations,
    summary: { en: "A validated storefront proposal." },
    validation: { valid: true, errors: [] as string[] },
    status: "pending" as const,
  };
}

describe("P4-05A target fingerprint review fixes", () => {
  it("includes the nullable design-system target without destabilizing equivalent ordering", () => {
    const withoutDesign = storefrontTarget({
      pages: [collectionPage, homePage],
      sections: [{ pageId: homePage.id, sectionId: campaign.id }],
    });
    const equivalent = canonicalizeAiStorefrontTarget({
      ...withoutDesign,
      affectedPageIds: [homePage.id, collectionPage.id],
      enabledLocales: ["fi", "en"],
    });
    const withDesign = storefrontTarget({
      pages: [homePage, collectionPage],
      sections: [{ pageId: homePage.id, sectionId: campaign.id }],
      designSystem: true,
    });
    const first = createAiStorefrontTargetFingerprint(storefrontContext(), withoutDesign);
    expect(createAiStorefrontTargetFingerprint(storefrontContext(), withoutDesign)).toBe(first);
    expect(createAiStorefrontTargetFingerprint(storefrontContext(), equivalent)).toBe(first);
    expect(createAiStorefrontTargetFingerprint(storefrontContext(), withDesign)).not.toBe(first);
    expect(
      createAiStorefrontTargetFingerprint(storefrontContext(), {
        ...withDesign,
        designSystemTarget: null,
      }),
    ).toBe(first);
  });
});

describe("P4-05A storefront projection identity review fixes", () => {
  it("accepts canonical globally unique section identities", () => {
    expect(aiStorefrontProjectionSchema.parse(storefrontContext().storefront).pages).toHaveLength(
      snapshot.pages.length,
    );
  });

  it("rejects a section identity reused on another page", () => {
    const projection = storefrontContext().storefront;
    projection.pages.find((page) => page.id === collectionPage.id)!.sections[1].id = campaign.id;
    expect(() => aiStorefrontProjectionSchema.parse(projection)).toThrow(/already used/i);
  });

  it("preserves the existing per-page duplicate section invariant", () => {
    const projection = storefrontContext().storefront;
    const page = projection.pages.find((candidate) => candidate.id === homePage.id)!;
    page.sections[1].id = page.sections[0].id;
    expect(() => aiStorefrontProjectionSchema.parse(projection)).toThrow(/unique within a page/i);
  });

  it("keeps target-bound section resolution unambiguous", () => {
    const target = storefrontTarget({
      pages: [homePage],
      sections: [{ pageId: homePage.id, sectionId: campaign.id }],
    });
    expect(
      validateAiStorefrontOperations(
        [
          sectionOperation(homePage, campaign.id, {
            type: "CHANGE_SECTION_VARIANT",
            sectionId: campaign.id,
            variant: "minimal",
          }),
        ],
        target,
        [existingSectionGrant(homePage, campaign, ["CHANGE_SECTION_VARIANT"])],
        storefrontContext(),
      ),
    ).toHaveLength(1);
  });
});

describe("P4-05A exact page reorder review fixes", () => {
  const target = storefrontTarget({ pages: [homePage] });
  const grant = pageGrant(homePage);
  const currentIds = homePage.sections.map((section) => section.id);
  const campaignIndex = currentIds.indexOf(campaign.id);
  const storyIndex = currentIds.findIndex((id) => id.includes("story"));
  const validIds = swap(currentIds, campaignIndex, storyIndex);

  it("accepts a complete exact reorder", () => {
    expect(
      validateAiStorefrontOperations(
        [pageOperation(homePage, validIds)],
        target,
        [grant],
        storefrontContext(),
      ),
    ).toHaveLength(1);
  });

  it.each([
    ["missing section", currentIds.slice(0, -1)],
    ["duplicate section", [...currentIds.slice(0, -1), currentIds[0]]],
    ["unknown section", [...currentIds.slice(0, -1), "section_unknown_reorder"]],
    ["section from another page", [...currentIds.slice(0, -1), collectionPage.sections[1].id]],
    ["extra section", [...currentIds, "section_extra_reorder"]],
  ])("rejects %s in a reorder payload", (_label, sectionIds) => {
    expect(() =>
      validateAiStorefrontOperations(
        [pageOperation(homePage, sectionIds)],
        target,
        [grant],
        storefrontContext(),
      ),
    ).toThrow(/every section ID exactly once/i);
  });
});

describe("P4-05A introduced-section sequencing and registry review fixes", () => {
  const introducedId = "section_home_campaign_review";
  const target = storefrontTarget({
    pages: [homePage],
    sections: [{ pageId: homePage.id, sectionId: introducedId }],
  });
  const operationTypes: AiOperationPermissionGrant["operationTypes"] = [
    "ADD_APPROVED_SECTION",
    "CHANGE_LOCALIZED_SECTION_TEXT",
    "CHANGE_BACKGROUND",
    "CHANGE_DENSITY",
    "CHANGE_SECTION_VARIANT",
  ];
  const grant = introducedSectionGrant(homePage, introducedId, "campaignBanner", operationTypes);
  const add = sectionOperation(homePage, introducedId, {
    type: "ADD_APPROVED_SECTION",
    sectionId: introducedId,
    component: "campaignBanner",
    variant: "minimal",
  });
  const customize = [
    sectionOperation(
      homePage,
      introducedId,
      {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: introducedId,
        field: "heading",
        locale: "en",
        value: "A new campaign",
      },
      1,
    ),
    sectionOperation(
      homePage,
      introducedId,
      { type: "CHANGE_BACKGROUND", sectionId: introducedId, background: "surface" },
      2,
    ),
    sectionOperation(
      homePage,
      introducedId,
      { type: "CHANGE_DENSITY", sectionId: introducedId, density: "compact" },
      3,
    ),
    sectionOperation(
      homePage,
      introducedId,
      { type: "CHANGE_SECTION_VARIANT", sectionId: introducedId, variant: "imageOverlay" },
      4,
    ),
  ];

  it("accepts add-then-customize for a registered introduced component", () => {
    expect(
      validateAiStorefrontOperations([add, ...customize], target, [grant], storefrontContext()),
    ).toHaveLength(5);
  });

  it("rejects customization before introduction", () => {
    const early = { ...customize[0], order: 0 };
    expect(() =>
      validateAiStorefrontOperations(
        [early, { ...add, order: 1 }],
        target,
        [grant],
        storefrontContext(),
      ),
    ).toThrow(/unknown storefront section/i);
  });

  it("rejects duplicate introduction of the same section", () => {
    expect(() =>
      validateAiStorefrontOperations(
        [add, { ...add, order: 1 }],
        target,
        [grant],
        storefrontContext(),
      ),
    ).toThrow(/identity must be new|duplicate/i);
  });

  it("rejects introduction using an existing storefront section identity", () => {
    const existingTarget = storefrontTarget({
      pages: [homePage],
      sections: [{ pageId: homePage.id, sectionId: campaign.id }],
    });
    expect(() =>
      validateAiStorefrontOperations(
        [
          sectionOperation(homePage, campaign.id, {
            type: "ADD_APPROVED_SECTION",
            sectionId: campaign.id,
            component: "campaignBanner",
          }),
        ],
        existingTarget,
        [introducedSectionGrant(homePage, campaign.id, "campaignBanner", ["ADD_APPROVED_SECTION"])],
        storefrontContext(),
      ),
    ).toThrow(/reuse an existing|must be new/i);
  });

  it("rejects a follow-up operation not granted for the introduced section", () => {
    const addOnlyGrant = introducedSectionGrant(homePage, introducedId, "campaignBanner", [
      "ADD_APPROVED_SECTION",
    ]);
    expect(() =>
      validateAiStorefrontOperations(
        [add, customize[0]],
        target,
        [addOnlyGrant],
        storefrontContext(),
      ),
    ).toThrow(/permission grant/i);
  });

  it("rejects follow-up customization from another page", () => {
    expect(() =>
      validateAiStorefrontOperations(
        [
          add,
          sectionOperation(
            collectionPage,
            introducedId,
            {
              type: "CHANGE_LOCALIZED_SECTION_TEXT",
              sectionId: introducedId,
              field: "heading",
              locale: "en",
              value: "Wrong page",
            },
            1,
          ),
        ],
        target,
        [grant],
        storefrontContext(),
      ),
    ).toThrow(/affected page|declared storefront section|another page/i);
  });

  it("does not interchange existing and introduced section grants", () => {
    expect(() =>
      validateAiStorefrontOperations(
        [add],
        target,
        [
          {
            ...grant,
            target: { ...grant.target, kind: "existingSection" as const },
          },
        ],
        storefrontContext(),
      ),
    ).toThrow(/existing-section|unknown section/i);

    const existingTarget = storefrontTarget({
      pages: [homePage],
      sections: [{ pageId: homePage.id, sectionId: campaign.id }],
    });
    expect(() =>
      validateAiStorefrontOperations(
        [
          sectionOperation(homePage, campaign.id, {
            type: "CHANGE_SECTION_VARIANT",
            sectionId: campaign.id,
            variant: "minimal",
          }),
        ],
        existingTarget,
        [
          introducedSectionGrant(homePage, campaign.id, campaign.component, [
            "CHANGE_SECTION_VARIANT",
          ]),
        ],
        storefrontContext(),
      ),
    ).toThrow(/reuse an existing|permission/i);
  });

  it("rejects unknown, disallowed, mismatched, and invalid introduced components", () => {
    expect(() =>
      validateAiStorefrontOperations(
        [
          sectionOperation(homePage, introducedId, {
            type: "ADD_APPROVED_SECTION",
            sectionId: introducedId,
            component: "unknownWidget",
          }),
        ],
        target,
        [introducedSectionGrant(homePage, introducedId, "unknownWidget", ["ADD_APPROVED_SECTION"])],
        storefrontContext(),
      ),
    ).toThrow(/unknown component/i);

    expect(() =>
      validateAiStorefrontOperations(
        [add],
        target,
        [introducedSectionGrant(homePage, introducedId, "hero", ["ADD_APPROVED_SECTION"])],
        storefrontContext(),
      ),
    ).toThrow(/permission grant/i);

    expect(() =>
      validateAiStorefrontOperations(
        [
          sectionOperation(homePage, introducedId, {
            type: "ADD_APPROVED_SECTION",
            sectionId: introducedId,
            component: "campaignBanner",
            variant: "freeform",
          }),
        ],
        target,
        [grant],
        storefrontContext(),
      ),
    ).toThrow(/Unsupported campaignBanner variant/i);

    const wrongPageTarget = storefrontTarget({
      pages: [homePage],
      sections: [{ pageId: homePage.id, sectionId: introducedId }],
    });
    expect(() =>
      validateAiStorefrontOperations(
        [
          sectionOperation(homePage, introducedId, {
            type: "ADD_APPROVED_SECTION",
            sectionId: introducedId,
            component: "collectionHeader",
          }),
        ],
        wrongPageTarget,
        [
          introducedSectionGrant(homePage, introducedId, "collectionHeader", [
            "ADD_APPROVED_SECTION",
          ]),
        ],
        storefrontContext(),
      ),
    ).toThrow(/not allowed on home/i);
  });
});

describe("P4-05A component-specific operation review fixes", () => {
  function validateExisting(
    section: SectionInstance,
    operation: AiStorefrontOperation["operation"],
  ) {
    const target = storefrontTarget({
      pages: [homePage],
      sections: [{ pageId: homePage.id, sectionId: section.id }],
    });
    return validateAiStorefrontOperations(
      [sectionOperation(homePage, section.id, operation)],
      target,
      [existingSectionGrant(homePage, section, [operation.type])],
      storefrontContext(),
    );
  }

  it("accepts supported variants and localized fields", () => {
    expect(
      validateExisting(campaign, {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: campaign.id,
        variant: "minimal",
      }),
    ).toHaveLength(1);
    expect(
      validateExisting(campaign, {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: campaign.id,
        field: "heading",
        locale: "fi",
        value: "Uusi kampanja",
      }),
    ).toHaveLength(1);
  });

  it("rejects unsupported variants and unknown localized fields", () => {
    expect(() =>
      validateExisting(campaign, {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: campaign.id,
        variant: "freeform",
      }),
    ).toThrow(/Unsupported campaignBanner variant/i);
    expect(() =>
      validateExisting(campaign, {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: campaign.id,
        field: "unknownField",
        locale: "en",
        value: "Unsafe",
      }),
    ).toThrow(/not approved localized/i);
  });

  it("rejects protected catalogue fields and component-incompatible operations", () => {
    expect(() =>
      validateExisting(productGrid, {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: productGrid.id,
        field: "productIds",
        locale: "en",
        value: "product_fake",
      }),
    ).toThrow(/not approved localized/i);
    expect(() =>
      validateExisting(benefits, {
        type: "CHANGE_CTA_STYLE",
        sectionId: benefits.id,
        ctaPresentation: "text",
      }),
    ).toThrow();
  });

  it("rejects malformed background and spacing payloads", () => {
    for (const operation of [
      { type: "CHANGE_BACKGROUND", sectionId: campaign.id, background: "neon" },
      { type: "CHANGE_DENSITY", sectionId: campaign.id, density: "giant" },
    ]) {
      expect(() => validateExisting(campaign, operation as never)).toThrow();
    }
  });
});

describe("P4-05A proposal fingerprint, preservation, and readiness review fixes", () => {
  it("accepts correct target and canonical permission fingerprints", () => {
    const proposal = readyProposal();
    expect(validateAiStorefrontProposal(proposal, storefrontContext())).toEqual(proposal);
    expect(
      createAiStorefrontPermissionFingerprint(
        [...proposal.permissionGrants].reverse(),
        proposal.target,
        storefrontContext(),
      ),
    ).toBe(proposal.permissionFingerprint);
  });

  it("rejects tampered target and permission fingerprints", () => {
    expect(() =>
      validateAiStorefrontProposal(
        { ...readyProposal(), targetFingerprint: "storefront-target-tampered" },
        storefrontContext(),
      ),
    ).toThrow(/target fingerprint/i);
    expect(() =>
      validateAiStorefrontProposal(
        { ...readyProposal(), permissionFingerprint: "storefront-permissions-tampered" },
        storefrontContext(),
      ),
    ).toThrow(/permission fingerprint/i);
  });

  it("invalidates fingerprints when design-system or section identity changes", () => {
    const designChanged = readyProposal();
    designChanged.target = {
      ...designChanged.target,
      designSystemTarget: {
        kind: "storefrontDesignSystem",
        projectId: aurumNordicSeed.project.id,
      },
    };
    expect(() => validateAiStorefrontProposal(designChanged, storefrontContext())).toThrow(
      /target fingerprint/i,
    );

    const sectionChanged = readyProposal();
    sectionChanged.target = {
      ...sectionChanged.target,
      affectedSectionTargets: [{ pageId: homePage.id, sectionId: productGrid.id }],
    };
    expect(() => validateAiStorefrontProposal(sectionChanged, storefrontContext())).toThrow(
      /target fingerprint/i,
    );
  });

  it("preserves the full page set and every untargeted page", () => {
    const omitted = readyProposal();
    omitted.proposedStorefront.pages = omitted.proposedStorefront.pages.filter(
      (page) => page.id !== collectionPage.id,
    );
    omitted.proposedStorefront.pageOrder = omitted.proposedStorefront.pageOrder.filter(
      (pageId) => pageId !== collectionPage.id,
    );
    expect(() => validateAiStorefrontProposal(omitted, storefrontContext())).toThrow();

    const added = readyProposal();
    const extraPage = structuredClone(collectionPage);
    extraPage.id = "page_extra_review";
    extraPage.slug = "/extra-review";
    extraPage.sections = extraPage.sections.map((section, index) => ({
      ...section,
      id: `section_extra_review_${index}`,
    }));
    added.proposedStorefront.pages.push(extraPage);
    added.proposedStorefront.pageOrder.push(extraPage.id);
    expect(() => validateAiStorefrontProposal(added, storefrontContext())).toThrow(/page/i);

    const changed = readyProposal();
    const untargeted = changed.proposedStorefront.pages.find(
      (page) => page.id === collectionPage.id,
    )!;
    untargeted.title = { ...untargeted.title, en: "Changed outside target" };
    expect(() => validateAiStorefrontProposal(changed, storefrontContext())).toThrow(
      /outside the declared storefront target/i,
    );

    const reordered = readyProposal();
    const untargetedSections = reordered.proposedStorefront.pages.find(
      (page) => page.id === collectionPage.id,
    )!.sections;
    reordered.proposedStorefront.pages.find((page) => page.id === collectionPage.id)!.sections =
      swap(untargetedSections, 1, 2);
    expect(() => validateAiStorefrontProposal(reordered, storefrontContext())).toThrow(
      /outside the declared storefront target/i,
    );

    expect(validateAiStorefrontProposal(readyProposal(), storefrontContext())).toBeTruthy();
  });

  it("allows multiple declared pages to change under target-bound operations", () => {
    const collectionIds = collectionPage.sections.map((section) => section.id);
    const reorderedCollectionIds = swap(collectionIds, 1, 2);
    const target = storefrontTarget({
      pages: [homePage, collectionPage],
      sections: [{ pageId: homePage.id, sectionId: campaign.id }],
    });
    const grants = [
      existingSectionGrant(homePage, campaign, ["CHANGE_SECTION_VARIANT"]),
      pageGrant(collectionPage),
    ];
    const operations = [
      sectionOperation(homePage, campaign.id, {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: campaign.id,
        variant: "minimal",
      }),
      pageOperation(collectionPage, reorderedCollectionIds, 1),
    ];
    const proposed = structuredClone(storefrontContext().storefront);
    proposed.pages
      .find((page) => page.id === homePage.id)!
      .sections.find((section) => section.id === campaign.id)!.variant = "minimal";
    const proposedCollection = proposed.pages.find((page) => page.id === collectionPage.id)!;
    const byId = new Map(proposedCollection.sections.map((section) => [section.id, section]));
    proposedCollection.sections = reorderedCollectionIds.map((id) => byId.get(id)!);
    const proposal = readyProposal({ target, grants, operations, proposedStorefront: proposed });
    expect(validateAiStorefrontProposal(proposal, storefrontContext())).toEqual(proposal);
  });

  it("keeps raw failure representation but blocks every failed ready state", () => {
    const valid = readyProposal();
    expect(aiStorefrontProposalSchema.parse(valid).validation).toEqual({ valid: true, errors: [] });
    expect(validateAiStorefrontProposal(valid, storefrontContext())).toBeTruthy();

    for (const validation of [
      { valid: false, errors: ["provider validation failed"] },
      { valid: false, errors: [] },
      { valid: true, errors: ["residual error"] },
    ]) {
      const failed = { ...readyProposal(), validation };
      expect(aiStorefrontProposalSchema.parse(failed).validation).toEqual(validation);
      expect(() => validateAiStorefrontProposal(failed, storefrontContext())).toThrow(
        /successfully validated/i,
      );
    }
  });
});
