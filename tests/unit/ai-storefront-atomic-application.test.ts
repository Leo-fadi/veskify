import { describe, expect, it } from "vitest";
import type { AiOperationPermissionGrant } from "@/application/ai-provider";
import {
  acceptedSnapshotPublishReceiptFingerprint,
  assertAcceptedSnapshotReceiptCurrent,
  type AcceptedSnapshotCurrentAuthority,
  type AcceptedSnapshotPublishReceipt,
} from "@/application/accepted-snapshot-publishing";
import {
  CanonicalStorefrontHistory,
  StorefrontProposalAcceptanceCoordinator,
  compositeStorefrontHistoryTransactionSchema,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontTargetFingerprint,
  deriveCompositeStorefrontHistoryTransaction,
  executeAiStorefrontProposal,
  projectAiStorefrontSnapshot,
  type AiStorefrontOperation,
  type AiStorefrontProposal,
  type AiStorefrontTarget,
} from "@/application/ai-storefront";
import { CanonicalEditorHistory, type CanonicalPageValidator } from "@/application/editor-history";
import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import { validateRegisteredPage, validateRegisteredSnapshot } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

const draft = structuredClone(aurumNordicSeed.draftSnapshot);
const storedDraft = structuredClone(aurumNordicSeed.draftSnapshot);
const published = structuredClone(aurumNordicSeed.publishedSnapshot);
const catalogue = structuredClone(aurumNordicSeed.catalogue);
const homePage = draft.pages.find((page) => page.type === "home")!;
const collectionPage = draft.pages.find((page) => page.type === "collection")!;
const productPage = draft.pages.find((page) => page.type === "product")!;
const campaign = homePage.sections.find((section) => section.component === "campaignBanner")!;

function swap<T>(values: readonly T[], left: number, right: number) {
  const next = [...values];
  [next[left], next[right]] = [next[right], next[left]];
  return next;
}

function applicationContext(activeDraft: StorefrontSnapshot = draft) {
  return {
    activeDraft: structuredClone(activeDraft),
    catalogue: structuredClone(catalogue),
    enabledLocales: ["en", "fi"] as const,
    activeLocale: "en" as const,
    primaryLocale: "en" as const,
  };
}

function proposalContext(activeDraft: StorefrontSnapshot = draft) {
  return {
    projectId: activeDraft.projectId,
    draftSnapshotId: activeDraft.id,
    draftRevision: activeDraft.revision,
    enabledLocales: ["en", "fi"] as const,
    activeLocale: "en" as const,
    storefront: projectAiStorefrontSnapshot(activeDraft),
  };
}

function existingGrant(
  page: PageModel,
  sectionId: string,
  componentType: string,
  operationTypes: AiOperationPermissionGrant["operationTypes"],
): AiOperationPermissionGrant {
  return {
    skillId: "storefrontExistingSection",
    skillVersion: "1.0.0",
    skillScope: "section",
    operationTypes,
    target: { kind: "existingSection", pageId: page.id, sectionId, componentType },
  };
}

function pageGrant(page: PageModel): AiOperationPermissionGrant {
  return {
    skillId: "storefrontPageComposition",
    skillVersion: "1.0.0",
    skillScope: "page",
    operationTypes: ["REORDER_SECTIONS"],
    target: { kind: "page", pageId: page.id },
  };
}

function designGrant(
  operationTypes: AiOperationPermissionGrant["operationTypes"],
): AiOperationPermissionGrant {
  return {
    skillId: "storefrontDesignSystem",
    skillVersion: "1.0.0",
    skillScope: "brand",
    operationTypes,
    target: { kind: "storefrontDesignSystem", projectId: draft.projectId },
  };
}

function buildProposal({
  operations,
  grants,
  target,
  proposed,
  affectedDesignState = null,
  id = "storefront_proposal_c05c0001",
}: {
  operations: AiStorefrontOperation[];
  grants: AiOperationPermissionGrant[];
  target: AiStorefrontTarget;
  proposed: StorefrontSnapshot;
  affectedDesignState?: AiStorefrontProposal["affectedDesignState"];
  id?: string;
}): AiStorefrontProposal {
  const context = proposalContext();
  return {
    id,
    requestId: "request_storefront_atomic_application",
    projectId: target.projectId,
    draftSnapshotId: target.draftSnapshotId,
    draftRevision: target.draftRevision,
    target,
    originalStorefront: projectAiStorefrontSnapshot(draft),
    proposedStorefront: projectAiStorefrontSnapshot(proposed),
    affectedPages: target.affectedPageIds.map((pageId) =>
      structuredClone(draft.pages.find((page) => page.id === pageId)!),
    ),
    affectedDesignState,
    permissionGrants: grants,
    targetFingerprint: createAiStorefrontTargetFingerprint(context, target),
    permissionFingerprint: createAiStorefrontPermissionFingerprint(grants, target, context),
    operations,
    summary: { en: "Apply the coordinated storefront proposal.", fi: "Ota ehdotus käyttöön." },
    validation: { valid: true, errors: [] },
    status: "pending",
  };
}

function twoPageProposal() {
  const collectionIds = collectionPage.sections.map((section) => section.id);
  const reorderedIds = swap(collectionIds, 1, 2);
  const target: AiStorefrontTarget = {
    scope: "storefront",
    projectId: draft.projectId,
    draftSnapshotId: draft.id,
    draftRevision: draft.revision,
    affectedPageIds: [collectionPage.id, homePage.id].sort(),
    affectedSectionTargets: [{ pageId: homePage.id, sectionId: campaign.id }],
    designSystemTarget: null,
    enabledLocales: ["en", "fi"],
    activeLocale: "en",
  };
  const grants = [
    existingGrant(homePage, campaign.id, campaign.component, ["CHANGE_SECTION_VARIANT"]),
    pageGrant(collectionPage),
  ];
  const operations: AiStorefrontOperation[] = [
    {
      order: 0,
      target: { kind: "section", pageId: homePage.id, sectionId: campaign.id },
      operation: {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: campaign.id,
        variant: "minimal",
      },
    },
    {
      order: 1,
      target: { kind: "page", pageId: collectionPage.id },
      operation: { type: "REORDER_SECTIONS", sectionIds: reorderedIds },
    },
  ];
  const proposed = structuredClone(draft);
  proposed.pages[proposed.pages.findIndex((page) => page.id === homePage.id)] =
    validateDesignOperationAgainstPage(homePage, operations[0].operation);
  proposed.pages[proposed.pages.findIndex((page) => page.id === collectionPage.id)] =
    validateDesignOperationAgainstPage(collectionPage, operations[1].operation);
  return buildProposal({ operations, grants, target, proposed });
}

function designSystemProposal({
  includeColors = true,
  includeTypography = true,
}: {
  includeColors?: boolean;
  includeTypography?: boolean;
} = {}) {
  const base = twoPageProposal();
  const colors = { ...draft.brandSystem.colors, primary: "#78512F", accent: "#C6943F" };
  const typography = {
    ...draft.brandSystem.typography,
    headingFont: "system-serif" as const,
    bodyFont: "system-sans" as const,
    scaleRatio: 1.333,
  };
  const target: AiStorefrontTarget = {
    ...base.target,
    designSystemTarget: { kind: "storefrontDesignSystem", projectId: draft.projectId },
  };
  const globalOperationTypes: AiOperationPermissionGrant["operationTypes"] = [];
  const operations: AiStorefrontOperation[] = [...base.operations];
  if (includeColors) {
    globalOperationTypes.push("APPLY_APPROVED_BRAND_COLOURS");
    operations.push({
      order: operations.length,
      target: { kind: "storefrontDesignSystem", projectId: draft.projectId },
      operation: { type: "APPLY_APPROVED_BRAND_COLOURS", colors },
    });
  }
  if (includeTypography) {
    globalOperationTypes.push("APPLY_APPROVED_BRAND_TYPOGRAPHY");
    operations.push({
      order: operations.length,
      target: { kind: "storefrontDesignSystem", projectId: draft.projectId },
      operation: { type: "APPLY_APPROVED_BRAND_TYPOGRAPHY", typography },
    });
  }
  const grants = [...base.permissionGrants, designGrant(globalOperationTypes)];
  const proposed = structuredClone(draft);
  proposed.pages = structuredClone(base.proposedStorefront.pages);
  const affectedDesignState: NonNullable<AiStorefrontProposal["affectedDesignState"]> = {};
  if (includeColors) {
    proposed.brandSystem.colors = colors;
    affectedDesignState.colors = colors;
  }
  if (includeTypography) {
    proposed.brandSystem.typography = typography;
    affectedDesignState.typography = typography;
  }
  return buildProposal({
    operations,
    grants,
    target,
    proposed,
    affectedDesignState,
    id: "storefront_proposal_c05c0002",
  });
}

function globalColourOperation(proposal: AiStorefrontProposal) {
  const operation = proposal.operations.find(
    (candidate) => candidate.operation.type === "APPLY_APPROVED_BRAND_COLOURS",
  );
  if (!operation || operation.operation.type !== "APPLY_APPROVED_BRAND_COLOURS") {
    throw new Error("Expected a global colour operation.");
  }
  return operation.operation;
}

function globalTypographyOperation(proposal: AiStorefrontProposal) {
  const operation = proposal.operations.find(
    (candidate) => candidate.operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY",
  );
  if (!operation || operation.operation.type !== "APPLY_APPROVED_BRAND_TYPOGRAPHY") {
    throw new Error("Expected a global typography operation.");
  }
  return operation.operation;
}

function threeOperationProposal() {
  const target: AiStorefrontTarget = {
    scope: "storefront",
    projectId: draft.projectId,
    draftSnapshotId: draft.id,
    draftRevision: draft.revision,
    affectedPageIds: [homePage.id],
    affectedSectionTargets: [{ pageId: homePage.id, sectionId: campaign.id }],
    designSystemTarget: null,
    enabledLocales: ["en", "fi"],
    activeLocale: "en",
  };
  const grants = [
    existingGrant(homePage, campaign.id, campaign.component, [
      "CHANGE_BACKGROUND",
      "CHANGE_DENSITY",
      "CHANGE_SECTION_VARIANT",
    ]),
  ];
  const operations: AiStorefrontOperation[] = [
    {
      order: 0,
      target: { kind: "section", pageId: homePage.id, sectionId: campaign.id },
      operation: { type: "CHANGE_BACKGROUND", sectionId: campaign.id, background: "surface" },
    },
    {
      order: 1,
      target: { kind: "section", pageId: homePage.id, sectionId: campaign.id },
      operation: { type: "CHANGE_DENSITY", sectionId: campaign.id, density: "compact" },
    },
    {
      order: 2,
      target: { kind: "section", pageId: homePage.id, sectionId: campaign.id },
      operation: {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: campaign.id,
        variant: "minimal",
      },
    },
  ];
  const proposed = structuredClone(draft);
  let page = structuredClone(homePage);
  for (const operation of operations) {
    page = validateDesignOperationAgainstPage(page, operation.operation);
  }
  proposed.pages[proposed.pages.findIndex((candidate) => candidate.id === homePage.id)] = page;
  return buildProposal({
    operations,
    grants,
    target,
    proposed,
    id: "storefront_proposal_c05c0003",
  });
}

function coordinator(
  proposal: AiStorefrontProposal = twoPageProposal(),
  activeDraft: StorefrontSnapshot = draft,
) {
  return new StorefrontProposalAcceptanceCoordinator({
    proposal,
    ...applicationContext(activeDraft),
    storedDraft,
    publishedSnapshot: published,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
    createTransactionId: () => "storefront_transaction_c05c0001",
  });
}

describe("P4-05C transactional storefront executor", () => {
  it("applies a valid two-page proposal to one isolated complete snapshot", () => {
    const proposal = twoPageProposal();
    const before = structuredClone(draft);
    const result = executeAiStorefrontProposal({ proposal, ...applicationContext() });

    expect(draft).toEqual(before);
    expect(projectAiStorefrontSnapshot(result)).toEqual(proposal.proposedStorefront);
    expect(result.pages.find((page) => page.id === productPage.id)).toEqual(productPage);
    expect(result.pages.map((page) => page.id)).toEqual(draft.pages.map((page) => page.id));
    expect(result.navigation).toEqual(draft.navigation);
    expect(result.catalogueRef).toBe(draft.catalogueRef);
    expect(draft.dynamicCommercePresentation).toBeUndefined();
    expect(result.dynamicCommercePresentation).toBeUndefined();
  });

  it("never turns a page-scoped legacy proposal into an undisclosed whole-snapshot migration", () => {
    const proposal = threeOperationProposal();
    proposal.target.scope = "page";
    const context = proposalContext();
    proposal.targetFingerprint = createAiStorefrontTargetFingerprint(context, proposal.target);
    proposal.permissionFingerprint = createAiStorefrontPermissionFingerprint(
      proposal.permissionGrants,
      proposal.target,
      context,
    );
    const result = executeAiStorefrontProposal({ proposal, ...applicationContext() });

    expect(projectAiStorefrontSnapshot(result)).toEqual(proposal.proposedStorefront);
    expect(result.pages.map(({ id }) => id)).toEqual(draft.pages.map(({ id }) => id));
    expect(result.dynamicCommercePresentation).toBeUndefined();
  });

  it("rejects explicit canonical migration authority outside whole-storefront scope", () => {
    const proposal = threeOperationProposal();
    proposal.target.scope = "page";
    const legacyProjection = structuredClone(proposal.proposedStorefront);
    proposal.proposedStorefront.dynamicCommercePresentation = structuredClone(
      p10b16p01DynamicCommerceAggregate().snapshots.find(
        ({ id }) => id === p10b16p01DynamicCommerceAggregate().project.draftSnapshotId,
      )!.dynamicCommercePresentation!,
    );
    proposal.dynamicCommerceMigration = {
      kind: "canonicalDynamicCommerceMigration",
      contractVersion: "1.0.0",
      legacyProjectionFingerprint: canonicalValueFingerprint(legacyProjection),
      resultingProjectionFingerprint: canonicalValueFingerprint(proposal.proposedStorefront),
      resultingAuthorityFingerprint:
        proposal.proposedStorefront.dynamicCommercePresentation.authorityFingerprint,
    };
    const context = proposalContext();
    proposal.targetFingerprint = createAiStorefrontTargetFingerprint(context, proposal.target);
    proposal.permissionFingerprint = createAiStorefrontPermissionFingerprint(
      proposal.permissionGrants,
      proposal.target,
      context,
    );

    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow(
      /whole-storefront reviewed transition/i,
    );
  });

  it("applies multiple pages plus explicitly granted colour and typography state", () => {
    const proposal = designSystemProposal();
    expect(globalColourOperation(proposal)).toBeTruthy();
    expect(globalTypographyOperation(proposal)).toBeTruthy();
    const result = executeAiStorefrontProposal({ proposal, ...applicationContext() });
    expect(result.brandSystem.colors).toEqual(proposal.affectedDesignState?.colors);
    expect(result.brandSystem.typography).toEqual(proposal.affectedDesignState?.typography);
    expect(result.brandSystem.shape).toEqual(draft.brandSystem.shape);
    expect(result.brandSystem.spacing).toEqual(draft.brandSystem.spacing);
    expect(result.brandSystem.imagery).toEqual(draft.brandSystem.imagery);
    expect(result.brandSystem.voice).toEqual(draft.brandSystem.voice);
  });

  it.each([
    [
      "operation colours differ from affected design state",
      (proposal: AiStorefrontProposal) => {
        globalColourOperation(proposal).colors.primary = "#6A4428";
      },
    ],
    [
      "operation colours differ from the proposed storefront",
      (proposal: AiStorefrontProposal) => {
        proposal.proposedStorefront.brandSystem.colors.primary = "#6A4428";
      },
    ],
    [
      "affected design state colours differ from the proposed storefront",
      (proposal: AiStorefrontProposal) => {
        if (!proposal.affectedDesignState?.colors) {
          throw new Error("Expected affected storefront colours.");
        }
        proposal.affectedDesignState.colors.primary = "#6A4428";
      },
    ],
  ])("rejects when %s without mutating any lifecycle state", (_label, tamper) => {
    const proposal = designSystemProposal({ includeTypography: false });
    tamper(proposal);
    const value = coordinator(proposal);
    const before = value.inspect();

    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow(
      /must match exactly/i,
    );
    const rejected = value.accept();

    expect(rejected.state).toBe("failed");
    expect(rejected.proposal.status).toBe("pending");
    expect(rejected.activeDraft).toEqual(before.activeDraft);
    expect(rejected.storedDraft).toEqual(before.storedDraft);
    expect(rejected.publishedSnapshot).toEqual(before.publishedSnapshot);
    expect(value.inspectHistory()).toEqual({ past: [], future: [] });
  });

  it("accepts when the operation, affected design state, and proposed colours match", () => {
    const proposal = designSystemProposal({ includeTypography: false });
    const operationColors = globalColourOperation(proposal).colors;
    expect(canonicalValueString(operationColors)).toBe(
      canonicalValueString(proposal.affectedDesignState?.colors),
    );
    expect(canonicalValueString(operationColors)).toBe(
      canonicalValueString(proposal.proposedStorefront.brandSystem.colors),
    );

    const value = coordinator(proposal);
    const accepted = value.accept();

    expect(accepted.state).toBe("accepted");
    expect(accepted.activeDraft.brandSystem.colors).toEqual(operationColors);
    expect(value.inspectHistory().past).toHaveLength(1);
  });

  it("accepts when the typography operation, affected design state, and projection match", () => {
    const proposal = designSystemProposal({ includeColors: false });
    const operationTypography = globalTypographyOperation(proposal).typography;
    expect(canonicalValueString(operationTypography)).toBe(
      canonicalValueString(proposal.affectedDesignState?.typography),
    );
    expect(canonicalValueString(operationTypography)).toBe(
      canonicalValueString(proposal.proposedStorefront.brandSystem.typography),
    );

    const value = coordinator(proposal);
    const accepted = value.accept();

    expect(accepted.state).toBe("accepted");
    expect(accepted.activeDraft.brandSystem.typography).toEqual(operationTypography);
    expect(value.inspectHistory().past).toHaveLength(1);
  });

  it("accepts an explicit no-op typography operation when metadata and projection match", () => {
    const proposal = designSystemProposal({ includeColors: false });
    const typography = structuredClone(draft.brandSystem.typography);
    globalTypographyOperation(proposal).typography = typography;
    proposal.affectedDesignState = { typography };
    proposal.proposedStorefront.brandSystem.typography = typography;

    const resulting = executeAiStorefrontProposal({
      proposal,
      ...applicationContext(),
    });

    expect(resulting.brandSystem.typography).toEqual(draft.brandSystem.typography);
    expect(resulting.pages).toEqual(proposal.proposedStorefront.pages);
  });

  it("rejects typography metadata without an explicit typography operation", () => {
    const proposal = designSystemProposal({ includeTypography: false });
    const typography = {
      ...draft.brandSystem.typography,
      headingFont: "system-serif" as const,
      bodyFont: "system-sans" as const,
      scaleRatio: 1.333,
    };
    proposal.affectedDesignState = { ...proposal.affectedDesignState, typography };
    proposal.proposedStorefront.brandSystem.typography = typography;
    const value = coordinator(proposal);
    const before = value.inspect();

    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow(
      /Affected design state must match exactly/i,
    );
    const failed = value.accept();

    expect(failed.activeDraft).toEqual(before.activeDraft);
    expect(value.inspectHistory()).toEqual({ past: [], future: [] });
  });

  it("rejects typography changed only in the proposed storefront", () => {
    const proposal = designSystemProposal({ includeTypography: false });
    proposal.proposedStorefront.brandSystem.typography = {
      ...draft.brandSystem.typography,
      headingFont: "system-serif",
      bodyFont: "system-sans",
      scaleRatio: 1.333,
    };
    const value = coordinator(proposal);
    const before = value.inspect();

    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow(
      /must match exactly/i,
    );
    const failed = value.accept();

    expect(failed.activeDraft).toEqual(before.activeDraft);
    expect(value.inspectHistory()).toEqual({ past: [], future: [] });
  });

  it.each([0, 1, 2])("rolls back when operation %i is invalid", (operationIndex) => {
    const proposal = threeOperationProposal();
    proposal.operations[operationIndex] = {
      order: operationIndex,
      target: { kind: "section", pageId: homePage.id, sectionId: campaign.id },
      operation: {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: campaign.id,
        variant: "unregisteredVariant",
      },
    };
    const before = structuredClone(draft);
    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow();
    expect(draft).toEqual(before);
    const value = coordinator(proposal);
    const failed = value.accept();
    expect(failed.activeDraft).toEqual(before);
    expect(failed.proposal.status).toBe("pending");
    expect(value.inspectHistory()).toEqual({ past: [], future: [] });
  });

  it("requires affected design state to exactly describe the global design diff", () => {
    const missing = designSystemProposal();
    missing.affectedDesignState = null;
    expect(() =>
      executeAiStorefrontProposal({ proposal: missing, ...applicationContext() }),
    ).toThrow(/Affected design state/i);

    const unsupported = designSystemProposal();
    unsupported.proposedStorefront.brandSystem.shape = { radius: "pill" };
    expect(() =>
      executeAiStorefrontProposal({ proposal: unsupported, ...applicationContext() }),
    ).toThrow(/shape, spacing, imagery, or voice/i);
  });

  it.each([
    [
      "target",
      (proposal: AiStorefrontProposal) =>
        (proposal.targetFingerprint = "storefront-target-tampered"),
    ],
    [
      "permission",
      (proposal: AiStorefrontProposal) =>
        (proposal.permissionFingerprint = "storefront-permissions-tampered"),
    ],
  ])("rejects a %s fingerprint mismatch before mutation", (_label, tamper) => {
    const proposal = twoPageProposal();
    tamper(proposal);
    const before = structuredClone(draft);
    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow();
    expect(draft).toEqual(before);
  });

  it.each([
    ["draft revision", (proposal: AiStorefrontProposal) => (proposal.draftRevision += 1)],
    ["project", (proposal: AiStorefrontProposal) => (proposal.projectId = "project_wrong")],
  ])("rejects a stale %s identity before mutation", (_label, tamper) => {
    const proposal = twoPageProposal();
    tamper(proposal);
    expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow();
  });

  it("rejects failed, accepted, and rejected proposal envelopes", () => {
    for (const proposal of [
      { ...twoPageProposal(), validation: { valid: false, errors: ["failed"] } },
      { ...twoPageProposal(), status: "accepted" as const },
      { ...twoPageProposal(), status: "rejected" as const },
    ]) {
      expect(() => executeAiStorefrontProposal({ proposal, ...applicationContext() })).toThrow();
    }
  });
});

describe("P4-05C composite storefront history", () => {
  it("creates exactly one complete transaction and undoes/redoes every page and design token", () => {
    const value = coordinator(designSystemProposal());
    const before = value.inspect();
    const accepted = value.accept();
    expect(accepted.state).toBe("accepted");
    expect(value.inspectHistory().past).toHaveLength(1);
    expect(accepted.transaction?.originalAffectedPages).toHaveLength(2);
    expect(accepted.transaction?.resultingAffectedPages).toHaveLength(2);
    expect(accepted.transaction?.originalDesignSystem).toEqual(draft.brandSystem);
    expect(accepted.transaction?.resultingDesignSystem).toEqual(accepted.activeDraft.brandSystem);
    expect(accepted.transaction?.structuralTransition).toBeUndefined();
    expect(accepted.transaction?.unaffectedPages.map((page) => page.pageId)).toEqual([
      productPage.id,
    ]);
    expect(accepted.transaction?.unaffectedPages[0].fingerprint).toMatch(/^v1_/);

    const undone = value.undo();
    expect(undone).toEqual(before.activeDraft);
    expect(value.inspectHistory()).toMatchObject({ past: [], future: [accepted.transaction] });
    const redone = value.redo();
    expect(redone).toEqual(accepted.activeDraft);
    expect(value.inspectHistory().past).toHaveLength(1);
  });

  it("applies, undoes, and redoes exact dynamic-commerce mappings while stale history and receipts fail closed", () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const original = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    )!;
    const originalAuthority = original.dynamicCommercePresentation!;
    const { authorityFingerprint: _originalFingerprint, ...material } =
      structuredClone(originalAuthority);
    void _originalFingerprint;
    const alternateArchetype = structuredClone(material.collectionSearchArchetypes[0]);
    const remappedRoute = material.collectionRouteMappings[0];
    if (!alternateArchetype || !remappedRoute) {
      throw new Error("The dynamic-commerce history fixture is incomplete.");
    }
    alternateArchetype.id = "archetype_collection_history_alternate";
    alternateArchetype.componentPresentations[0].props.gridDensity = "spacious";
    const resultingAuthority = createDynamicCommercePresentationAuthority({
      ...material,
      authorityRevision: material.authorityRevision + 1,
      collectionSearchArchetypes: [...material.collectionSearchArchetypes, alternateArchetype],
      collectionRouteMappings: material.collectionRouteMappings.map((mapping) =>
        mapping.routeId === remappedRoute.routeId
          ? { ...mapping, archetypeId: alternateArchetype.id }
          : mapping,
      ),
    });
    const resulting = structuredClone(original);
    resulting.dynamicCommercePresentation = resultingAuthority;
    const proposal = twoPageProposal();
    proposal.id = "storefront_proposal_c05c0004";
    proposal.projectId = original.projectId;
    proposal.draftSnapshotId = original.id;
    proposal.draftRevision = original.revision;
    proposal.target = {
      ...proposal.target,
      projectId: original.projectId,
      draftSnapshotId: original.id,
      draftRevision: original.revision,
      affectedPageIds: [original.pages[0].id],
      affectedSectionTargets: [],
    };
    const transaction = deriveCompositeStorefrontHistoryTransaction({
      original,
      resulting,
      proposal,
      acceptedAt: "2026-08-11T14:00:00.000Z",
      transactionId: "storefront_transaction_dynamic_history",
    });

    expect(transaction.structuralTransition?.originalDynamicCommercePresentation).toEqual(
      originalAuthority,
    );
    expect(transaction.structuralTransition?.resultingDynamicCommercePresentation).toEqual(
      resultingAuthority,
    );
    expect(
      transaction.structuralTransition?.resultingDynamicCommercePresentation
        ?.collectionRouteMappings,
    ).toEqual(resultingAuthority.collectionRouteMappings);
    expect(resultingAuthority.authorityFingerprint).not.toBe(
      originalAuthority.authorityFingerprint,
    );

    const history = new CanonicalStorefrontHistory();
    history.initialize(original);
    expect(history.commit(transaction).dynamicCommercePresentation).toEqual(resultingAuthority);
    expect(history.undo()?.dynamicCommercePresentation).toEqual(originalAuthority);
    expect(history.redo()?.dynamicCommercePresentation).toEqual(resultingAuthority);

    const staleHistory = new CanonicalStorefrontHistory();
    staleHistory.initialize(resulting);
    expect(() => staleHistory.commit(transaction)).toThrow(/no longer matches/i);
    expect(staleHistory.inspectTransactions()).toEqual({ past: [], future: [] });

    const currentAuthority = {
      proposalId: proposal.id,
      proposalRevision: 1,
      proposalFingerprint: "proposal_dynamic_history",
      reviewRevision: 1,
      reviewFingerprint: "review_dynamic_history",
      acceptedRuntimeFingerprint: "runtime_dynamic_history",
      componentRegistryFingerprint: "registry_dynamic_history",
      manifest: null,
      packageRegistry: null,
      profileAuthorities: [],
      commerceFingerprint: "commerce_dynamic_history",
      approvedAssetFingerprint: null,
    } satisfies AcceptedSnapshotCurrentAuthority;
    const unsignedReceipt: Omit<AcceptedSnapshotPublishReceipt, "fingerprint"> = {
      id: "acceptance_receipt_dynamic_history",
      version: "1.0.0",
      projectId: original.projectId,
      draftId: original.id,
      proposalId: proposal.id,
      proposalRevision: currentAuthority.proposalRevision,
      proposalFingerprint: currentAuthority.proposalFingerprint,
      reviewRevision: currentAuthority.reviewRevision,
      reviewFingerprint: currentAuthority.reviewFingerprint,
      acceptedRuntimeFingerprint: currentAuthority.acceptedRuntimeFingerprint,
      acceptedSnapshotId: original.id,
      acceptedSnapshotFingerprint: canonicalStorefrontContentFingerprint(original),
      projectRevision: aggregate.project.revision,
      draftRevision: original.revision,
      componentRegistryFingerprint: currentAuthority.componentRegistryFingerprint,
      manifest: null,
      packageRegistry: null,
      profileAuthorities: [],
      commerceFingerprint: currentAuthority.commerceFingerprint,
      approvedAssetFingerprint: null,
      acceptanceActionId: "acceptance_action_dynamic_history",
      acceptedAt: "2026-08-11T14:00:00.000Z",
      sourceKind: "initialGeneration",
    };
    const receipt: AcceptedSnapshotPublishReceipt = {
      ...unsignedReceipt,
      fingerprint: acceptedSnapshotPublishReceiptFingerprint(unsignedReceipt),
    };
    const aggregateAfterRootMutation = structuredClone(aggregate);
    aggregateAfterRootMutation.snapshots = aggregateAfterRootMutation.snapshots.map((snapshot) =>
      snapshot.id === original.id ? resulting : snapshot,
    );
    expect(() =>
      assertAcceptedSnapshotReceiptCurrent(receipt, aggregateAfterRootMutation, currentAuthority),
    ).toThrow(expect.objectContaining({ code: "stale-current-snapshot" }));
  });

  it("rejects an invalid final storefront without committing partial history", () => {
    const proposal = twoPageProposal();
    const resulting = executeAiStorefrontProposal({ proposal, ...applicationContext() });
    const transaction = deriveCompositeStorefrontHistoryTransaction({
      original: draft,
      resulting,
      proposal,
      acceptedAt: "2026-07-20T12:00:00.000Z",
      transactionId: "storefront_transaction_invalid_final",
    });
    const invalidPage = structuredClone(transaction.resultingAffectedPages[0]);
    invalidPage.sections[0].id = productPage.sections[0].id;
    transaction.resultingAffectedPages[0] = invalidPage;
    const invalidResult = structuredClone(resulting);
    invalidResult.pages[invalidResult.pages.findIndex((page) => page.id === invalidPage.id)] =
      invalidPage;
    transaction.resultingStorefrontFingerprint =
      canonicalStorefrontContentFingerprint(invalidResult);
    expect(compositeStorefrontHistoryTransactionSchema.parse(transaction)).toBeTruthy();

    const history = new CanonicalStorefrontHistory({
      validateSnapshot: (snapshot) => validateRegisteredSnapshot(snapshot, catalogue, "en", "en"),
    });
    history.initialize(draft);
    expect(() => history.commit(transaction)).toThrow();
    expect(history.current()).toEqual(draft);
    expect(history.inspectTransactions()).toEqual({ past: [], future: [] });
  });
});

describe("P4-05C acceptance lifecycle and separation", () => {
  it("accepts once, creates one history transaction, and preserves stored/published/catalogue state", () => {
    const value = coordinator();
    const before = value.inspect();
    const catalogueBefore = structuredClone(catalogue);
    const accepted = value.accept();
    expect(accepted.state).toBe("accepted");
    expect(accepted.proposal.status).toBe("accepted");
    expect(accepted.activeDraft).not.toEqual(before.activeDraft);
    expect(accepted.storedDraft).toEqual(before.storedDraft);
    expect(accepted.publishedSnapshot).toEqual(before.publishedSnapshot);
    expect(catalogue).toEqual(catalogueBefore);
    expect(value.inspectHistory().past).toHaveLength(1);

    const duplicate = value.accept();
    expect(duplicate.state).toBe("accepted");
    expect(duplicate.failure?.code).toBe("duplicateAcceptance");
    expect(duplicate.activeDraft).toEqual(accepted.activeDraft);
    expect(value.inspectHistory().past).toHaveLength(1);
  });

  it("rejects and closes without mutation and cannot accept either terminal proposal", () => {
    for (const action of ["reject", "close"] as const) {
      const value = coordinator();
      const before = value.inspect();
      const terminal = value[action]();
      expect(terminal.state).toBe(action === "reject" ? "rejected" : "closed");
      expect(terminal.activeDraft).toEqual(before.activeDraft);
      expect(value.inspectHistory().past).toHaveLength(0);
      const blocked = value.accept();
      expect(blocked.failure?.code).toBe("terminalProposal");
      expect(blocked.activeDraft).toEqual(before.activeDraft);
    }
  });

  it("closes stale proposals without draft or history mutation", () => {
    const staleDraft = structuredClone(draft);
    staleDraft.pages[0].title = { ...staleDraft.pages[0].title, en: "New active title" };
    const value = coordinator(twoPageProposal(), staleDraft);
    const before = value.inspect();
    const result = value.accept();
    expect(result.state).toBe("stale");
    expect(result.proposal.status).toBe("rejected");
    expect(result.activeDraft).toEqual(before.activeDraft);
    expect(value.inspectHistory().past).toHaveLength(0);
    expect(value.accept().failure?.code).toBe("terminalProposal");
  });

  it("leaves one whole-storefront undo unit rather than page-local partial transactions", () => {
    const value = coordinator();
    const accepted = value.accept();
    expect(value.inspectHistory().past).toHaveLength(1);
    expect(value.undo()).toEqual(draft);
    expect(value.undo()).toBeUndefined();
    expect(value.redo()).toEqual(accepted.activeDraft);
    expect(value.redo()).toBeUndefined();
  });

  it("keeps existing page-level editor history compatible and independent", () => {
    const validator: CanonicalPageValidator = (page) => validateRegisteredPage(page);
    const pageHistory = new CanonicalEditorHistory({ validatePage: validator });
    pageHistory.initialize(homePage);
    const edited = structuredClone(homePage);
    edited.title = { ...edited.title, en: "Page history remains independent" };
    pageHistory.commit(edited, "Edit current page");
    expect(pageHistory.undo(homePage.id)).toEqual(homePage);
    expect(pageHistory.redo(homePage.id)).toEqual(edited);

    const storefront = coordinator();
    expect(storefront.accept().state).toBe("accepted");
    expect(pageHistory.current(homePage.id)).toEqual(edited);
  });

  it("preserves exact page order, navigation, unaffected content, and snapshot identity", () => {
    const accepted = coordinator().accept();
    expect(accepted.activeDraft.pages.map((page) => page.id)).toEqual(
      draft.pages.map((page) => page.id),
    );
    expect(accepted.activeDraft.navigation).toEqual(draft.navigation);
    expect(accepted.activeDraft.pages.find((page) => page.id === productPage.id)).toEqual(
      productPage,
    );
    expect({
      id: accepted.activeDraft.id,
      projectId: accepted.activeDraft.projectId,
      revision: accepted.activeDraft.revision,
      catalogueRef: accepted.activeDraft.catalogueRef,
    }).toEqual({
      id: draft.id,
      projectId: draft.projectId,
      revision: draft.revision,
      catalogueRef: draft.catalogueRef,
    });
  });

  it("keeps transaction snapshots detached from caller mutation", () => {
    const value = coordinator();
    const accepted = value.accept();
    accepted.activeDraft.pages[0].title.en = "Caller mutation";
    accepted.transaction!.originalAffectedPages.length = 0;
    const current = value.inspect();
    expect(current.activeDraft.pages[0].title.en).not.toBe("Caller mutation");
    expect(current.transaction?.originalAffectedPages).toHaveLength(2);
    expect(canonicalValueString(current.storedDraft)).toBe(canonicalValueString(storedDraft));
  });
});
