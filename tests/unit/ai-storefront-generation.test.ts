import { describe, expect, it } from "vitest";
import {
  aiStorefrontPendingRequestKey,
  buildAiStorefrontProviderRequest,
  createApprovedGenerationAssetContextFingerprint,
  createAiStorefrontGenerationPlan,
  createDeterministicMockStorefrontAIProvider,
  aiStorefrontProviderResponseSchema,
  isRegisteredWholeStorefrontDirectionRequest,
  validateAiStorefrontProviderResponse,
  type AiStorefrontGenerationCommand,
  type AiStorefrontProviderResponse,
} from "@/application/ai-storefront-generation";
import {
  createAiStorefrontProposalId,
  validateAiStorefrontOperations,
  validateAiStorefrontProposal,
} from "@/application/ai-storefront";
import { aurumNordicSeed } from "@/data/seed";

const snapshot = aurumNordicSeed.draftSnapshot;
const home = snapshot.pages.find((page) => page.type === "home")!;
const collection = snapshot.pages.find((page) => page.type === "collection")!;
const product = snapshot.pages.find((page) => page.type === "product")!;

function provider() {
  return createDeterministicMockStorefrontAIProvider();
}

function command(
  overrides: Partial<AiStorefrontGenerationCommand> = {},
): AiStorefrontGenerationCommand {
  const storefrontProvider = overrides.provider ?? provider();
  return {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    storefront: {
      pageOrder: snapshot.pages.map((page) => page.id),
      pages: structuredClone(snapshot.pages),
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
    },
    affectedPageIds: [collection.id, home.id],
    affectedSectionTargets: [],
    designSystemTarget: {
      kind: "storefrontDesignSystem",
      projectId: aurumNordicSeed.project.id,
    },
    merchantInstruction: "Apply a warm premium style across the storefront.",
    activeLocale: "en",
    enabledLocales: ["fi", "en"],
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: storefrontProvider.id,
    provider: storefrontProvider,
    importedContent: [],
    ...overrides,
  };
}

function context(input = command()) {
  return {
    projectId: input.projectId,
    draftSnapshotId: input.draftSnapshotId,
    draftRevision: input.draftRevision,
    enabledLocales: ["en", "fi"] as const,
    activeLocale: input.activeLocale,
    storefront: structuredClone(input.storefront),
  };
}

function approvedAssetContext(role: "logo" | "collectionImage" = "logo") {
  const value = {
    briefId: "brief_approved_assets",
    briefRevision: 1,
    approvedEvidenceFingerprint: "evidence-approved-assets",
    assetReviewFingerprint: "asset-review-approved-assets",
    assets: [
      {
        assetId: "asset_approved_source",
        role,
        sourceReferenceId: "source_approved_assets",
        revision: "2:asset-material",
        materialFingerprint: "asset-material",
        provenance: { location: "html-meta" as const, observedAt: "2026-07-23T10:00:00.000Z" },
        alt: { en: "Approved source asset", fi: "Hyväksytty lähdeaineisto" },
        presentation: { decorative: false, mediaType: "image/jpeg", responsiveCrops: [] },
        approval: { actorId: "merchant_owner", actorReference: "merchant-session" },
      },
    ],
  };
  return { ...value, fingerprint: createApprovedGenerationAssetContextFingerprint(value) };
}

async function requestAndResponse(input = command()) {
  const request = buildAiStorefrontProviderRequest(input, 1);
  const response = aiStorefrontProviderResponseSchema.parse(
    await input.provider.proposeStorefront(request),
  );
  return { request, response: structuredClone(response) };
}

function refreshProposalId(
  request: ReturnType<typeof buildAiStorefrontProviderRequest>,
  response: AiStorefrontProviderResponse,
) {
  response.proposal.id = createAiStorefrontProposalId(
    request.requestId,
    request.targetFingerprint,
    request.permissionFingerprint,
    response.proposal.operations,
  );
  response.metadata.operationCount = response.proposal.operations.length;
}

describe("P4-05B storefront planner and request construction", () => {
  it("plans the approved multi-page warm premium capability deterministically", () => {
    const first = createAiStorefrontGenerationPlan(command());
    const second = createAiStorefrontGenerationPlan(
      command({ affectedPageIds: [home.id, collection.id] }),
    );
    expect(first).toEqual(second);
    expect(first.affectedPageIds).toEqual([collection.id, home.id].sort());
    expect(new Set(first.sectionTargets.map((target) => target.pageId))).toEqual(
      new Set([home.id, collection.id]),
    );
    expect(first.designSystemTarget).toEqual({
      kind: "storefrontDesignSystem",
      projectId: aurumNordicSeed.project.id,
    });
  });

  it("supports a page-only minimal Nordic direction without global permission", () => {
    const input = command({
      designSystemTarget: null,
      merchantInstruction:
        "Use a minimal Nordic colour and typography direction on the selected pages.",
    });
    const plan = createAiStorefrontGenerationPlan(input);
    const request = buildAiStorefrontProviderRequest(input, 7);
    expect(plan.direction).toBe("minimalNordic");
    expect(request.target.designSystemTarget).toBeNull();
    expect(request.permissionGrants.every((grant) => grant.target.kind === "existingSection")).toBe(
      true,
    );
  });

  it("rejects ambiguous, unsupported, and design-target-conflicting requests", () => {
    expect(() =>
      createAiStorefrontGenerationPlan(
        command({ merchantInstruction: "Make it warm premium and minimal Nordic." }),
      ),
    ).toThrow(/either|approved/i);
    expect(() =>
      createAiStorefrontGenerationPlan(command({ merchantInstruction: "Rebuild navigation." })),
    ).toThrow(/only the approved/i);
    expect(() => createAiStorefrontGenerationPlan(command({ designSystemTarget: null }))).toThrow(
      /requires an explicit/i,
    );
  });

  it("recognizes natural registered directions while rejecting protected-commerce mutations", () => {
    expect(
      isRegisteredWholeStorefrontDirectionRequest(
        "Apply a premium editorial direction with craftsmanship and product imagery.",
      ),
    ).toBe(true);
    expect(
      isRegisteredWholeStorefrontDirectionRequest(
        "Use a modern technical direction with compact spacing and crisp surfaces.",
      ),
    ).toBe(true);
    expect(
      isRegisteredWholeStorefrontDirectionRequest(
        "Make the storefront warm and approachable with softer typography.",
      ),
    ).toBe(true);
    expect(
      isRegisteredWholeStorefrontDirectionRequest(
        "Change the product prices and inventory to match the new design.",
      ),
    ).toBe(false);
    expect(isRegisteredWholeStorefrontDirectionRequest("Rebuild the navigation.")).toBe(false);
  });

  it("rejects duplicate, unknown, and cross-page target identities before invocation", () => {
    expect(() =>
      buildAiStorefrontProviderRequest(
        command({ affectedPageIds: [home.id, home.id] as never }),
        1,
      ),
    ).toThrow(/invalid/i);
    expect(() =>
      buildAiStorefrontProviderRequest(
        command({ affectedPageIds: [home.id, "page_unknown"] as never }),
        1,
      ),
    ).toThrow(/invalid/i);
    expect(() =>
      buildAiStorefrontProviderRequest(
        command({
          affectedSectionTargets: [{ pageId: collection.id, sectionId: home.sections[0].id }],
        }),
        1,
      ),
    ).toThrow(/invalid/i);
  });

  it("builds canonical target-bound grants, fingerprints, and minimal provider context", () => {
    const input = command({
      importedContent: [{ source: "merchant-site", content: "Imported text is data only." }],
    });
    const request = buildAiStorefrontProviderRequest(input, 3);
    expect(request.requestSequence).toBe(3);
    expect(request.target.affectedPageIds).toEqual([...request.target.affectedPageIds].sort());
    expect(
      request.permissionGrants.some((grant) => grant.target.kind === "storefrontDesignSystem"),
    ).toBe(true);
    expect(request.targetFingerprint).toMatch(/^storefront-target-/);
    expect(request.permissionFingerprint).toMatch(/^storefront-permissions-/);
    expect(request.storefrontBaselineFingerprint).toMatch(/^storefront-baseline-/);
    expect(request.untrustedImportedContent).toEqual([
      { source: "merchant-site", content: "Imported text is data only.", trust: "untrusted" },
    ]);
    expect(request).not.toHaveProperty("displayContext");
    expect(request).not.toHaveProperty("catalogue");
    expect(request).not.toHaveProperty("customerData");
    expect(request.responseContract).toBe("ai-storefront-proposal/v1");
  });

  it("uses canonical instruction and complete storefront identity in the pending key", () => {
    const first = buildAiStorefrontProviderRequest(command(), 1);
    const equivalent = buildAiStorefrontProviderRequest(
      command({ merchantInstruction: "  apply   a warm premium style across the storefront!!!" }),
      2,
    );
    expect(aiStorefrontPendingRequestKey(equivalent)).toBe(aiStorefrontPendingRequestKey(first));

    const changedStorefront = command();
    changedStorefront.storefront.pages.find((page) => page.id === product.id)!.title.en =
      "Untargeted baseline changed";
    const changedBaseline = buildAiStorefrontProviderRequest(changedStorefront, 2);
    expect(changedBaseline.targetFingerprint).toBe(first.targetFingerprint);
    expect(changedBaseline.storefrontBaselineFingerprint).not.toBe(
      first.storefrontBaselineFingerprint,
    );
    expect(aiStorefrontPendingRequestKey(changedBaseline)).not.toBe(
      aiStorefrontPendingRequestKey(first),
    );
  });

  it("passes deterministic URL-free approved asset references only to capable providers", () => {
    const context = approvedAssetContext();
    const request = buildAiStorefrontProviderRequest(command({ approvedAssetContext: context }), 1);
    expect(request.approvedAssetContext).toEqual(context);
    expect(request.assetContextFingerprint).toBe(context.fingerprint);
    expect(JSON.stringify(request.approvedAssetContext)).not.toMatch(/https?:|<html|base64/i);

    const incapableProvider = {
      id: "incapable-provider",
      proposeStorefront: () => Promise.resolve({}),
    };
    const optional = buildAiStorefrontProviderRequest(
      command({
        provider: incapableProvider,
        providerId: incapableProvider.id,
        approvedAssetContext: context,
      }),
      2,
    );
    expect(optional.approvedAssetContext).toBeNull();
    expect(optional.assetPlacementOperations).toEqual([]);
  });

  it("rejects required incompatible or unknown approved-asset placements before provider invocation", () => {
    const context = approvedAssetContext("collectionImage");
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET" as const,
      pageId: collection.id,
      componentId: "section_collection_products",
      componentType: "dynamicCollectionCommerce",
      assetSlotId: "collectionCommerceMedia",
      assetId: context.assets[0].assetId,
      role: "collectionImage" as const,
      assetRevision: context.assets[0].revision,
      materialFingerprint: context.assets[0].materialFingerprint,
      sourceReferenceId: context.assets[0].sourceReferenceId,
      required: true,
    };
    const incapableProvider = {
      id: "incapable-provider",
      proposeStorefront: () => Promise.resolve({}),
    };
    expect(() =>
      buildAiStorefrontProviderRequest(
        command({
          provider: incapableProvider,
          providerId: incapableProvider.id,
          approvedAssetContext: context,
          assetPlacementOperations: [placement],
        }),
        1,
      ),
    ).toThrow(/does not match an active storefront component/i);
    expect(() =>
      buildAiStorefrontProviderRequest(
        command({
          approvedAssetContext: context,
          assetPlacementOperations: [{ ...placement, assetId: "asset_unknown" }],
        }),
        1,
      ),
    ).toThrow(/does not match an active storefront component/i);
  });
});

describe("P4-05B deterministic provider and security boundary", () => {
  it("returns one canonical ready multi-page colour and typography proposal", async () => {
    const input = command();
    const { request, response } = await requestAndResponse(input);
    const validated = validateAiStorefrontProviderResponse(request, response);
    expect(validated.proposal.target).toEqual(request.target);
    expect(validated.proposal.target.designSystemTarget).toEqual(input.designSystemTarget);
    expect(validated.proposal.targetFingerprint).toBe(request.targetFingerprint);
    expect(validated.proposal.permissionFingerprint).toBe(request.permissionFingerprint);
    expect(
      validated.proposal.operations.some(({ operation }) => operation.type === "CHANGE_TYPOGRAPHY"),
    ).toBe(true);
    expect(
      validated.proposal.operations.some(
        ({ operation }) => operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY",
      ),
    ).toBe(true);
    expect(validateAiStorefrontProposal(validated.proposal, context(input))).toEqual(
      validated.proposal,
    );
  });

  it("is deterministic and preserves complete page, order, navigation, and untargeted content", async () => {
    const input = command();
    const request = buildAiStorefrontProviderRequest(input, 1);
    const first = await input.provider.proposeStorefront(request);
    const second = await input.provider.proposeStorefront(request);
    expect(first).toEqual(second);
    const proposal = validateAiStorefrontProviderResponse(request, first).proposal;
    expect(proposal.proposedStorefront.pages.map((page) => page.id)).toEqual(
      input.storefront.pages.map((page) => page.id),
    );
    expect(proposal.proposedStorefront.pageOrder).toEqual(input.storefront.pageOrder);
    expect(proposal.proposedStorefront.navigation).toEqual(input.storefront.navigation);
    expect(proposal.proposedStorefront.pages.find((page) => page.id === product.id)).toEqual(
      input.storefront.pages.find((page) => page.id === product.id),
    );
    expect(proposal.summary.en).toBeTruthy();
    expect(proposal.summary.fi).toBeTruthy();
  });

  const projectionMutations: Array<[string, (response: AiStorefrontProviderResponse) => void]> = [
    ["page removal", (response) => response.proposal.proposedStorefront.pages.pop()],
    [
      "page addition",
      (response) => {
        const extra = structuredClone(product);
        extra.id = "page_added_by_provider";
        extra.slug = "/provider-added";
        extra.sections = extra.sections.map((section, index) => ({
          ...section,
          id: `section_provider_added_${index}`,
        }));
        response.proposal.proposedStorefront.pages.push(extra);
        response.proposal.proposedStorefront.pageOrder.push(extra.id);
      },
    ],
    ["page order change", (response) => response.proposal.proposedStorefront.pages.reverse()],
    [
      "navigation change",
      (response) => {
        response.proposal.proposedStorefront.navigation.primary = [];
      },
    ],
    [
      "untargeted page mutation",
      (response) => {
        response.proposal.proposedStorefront.pages.find(
          (page) => page.id === product.id,
        )!.title.en = "Changed outside target";
      },
    ],
  ];

  it.each(projectionMutations)("rejects provider %s", async (_label, mutate) => {
    const { request, response } = await requestAndResponse();
    mutate(response);
    expect(() => validateAiStorefrontProviderResponse(request, response)).toThrow();
  });

  it("rejects page A permission used for Page B", async () => {
    const { request } = await requestAndResponse();
    const homeGrant = request.permissionGrants.find(
      (grant) => grant.target.kind === "existingSection" && grant.target.pageId === home.id,
    )!;
    const collectionTarget = request.target.affectedSectionTargets.find(
      (target) => target.pageId === collection.id,
    )!;
    expect(() =>
      validateAiStorefrontOperations(
        [
          {
            order: 0,
            target: { kind: "section", ...collectionTarget },
            operation: {
              type: "CHANGE_TYPOGRAPHY",
              sectionId: collectionTarget.sectionId,
              typography: "serif",
            },
          },
        ],
        request.target,
        [homeGrant],
        context(),
      ),
    ).toThrow(/permission/i);
  });

  it("rejects a global operation without an explicit design-system grant", () => {
    const input = command({
      designSystemTarget: null,
      merchantInstruction:
        "Use a minimal Nordic colour and typography direction on the selected pages.",
    });
    const request = buildAiStorefrontProviderRequest(input, 1);
    expect(() =>
      validateAiStorefrontOperations(
        [
          {
            order: 0,
            target: {
              kind: "storefrontDesignSystem",
              projectId: input.projectId,
            },
            operation: {
              type: "APPLY_APPROVED_BRAND_TYPOGRAPHY",
              typography: structuredClone(snapshot.brandSystem.typography),
            },
          },
        ],
        request.target,
        request.permissionGrants,
        context(input),
      ),
    ).toThrow(/global|target/i);
  });

  it.each([
    [
      "unknown component",
      {
        type: "ADD_APPROVED_SECTION",
        sectionId: home.sections[0].id,
        component: "unknownWidget",
      },
    ],
    [
      "invalid component payload",
      {
        type: "CHANGE_SECTION_VARIANT",
        sectionId: home.sections.find((section) => section.component === "hero")!.id,
        variant: "freeform",
      },
    ],
    [
      "protected catalogue field",
      {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: home.sections.find((section) => section.component === "productGrid")!.id,
        field: "productIds",
        locale: "en",
        value: "product_fake",
      },
    ],
  ])("rejects %s operations from an untrusted provider", async (_label, operation) => {
    const { request, response } = await requestAndResponse();
    response.proposal.operations = [
      {
        order: 0,
        target: {
          kind: "section",
          pageId: home.id,
          sectionId: operation.sectionId,
        },
        operation,
      },
    ] as never;
    refreshProposalId(request, response);
    expect(() => validateAiStorefrontProviderResponse(request, response)).toThrow();
  });

  it.each([
    "javascript:alert(1)",
    "```javascript\nalert(1)\n```",
    ".storefront { color: red; }",
    "<style>body{display:none}</style>",
  ])("rejects executable, fenced, CSS, or markup-shaped generated content: %s", async (value) => {
    const { request, response } = await requestAndResponse();
    response.proposal.summary.en = value;
    expect(() => validateAiStorefrontProviderResponse(request, response)).toThrow(
      /executable|invalid/i,
    );
  });

  it("rejects disabled-locale text, failed envelopes, and fingerprint mismatches", async () => {
    const input = command({ activeLocale: "en", enabledLocales: ["en"] });
    const { request, response } = await requestAndResponse(input);
    const sectionId = request.target.affectedSectionTargets[0].sectionId;
    response.proposal.operations = [
      {
        order: 0,
        target: {
          kind: "section",
          pageId: request.target.affectedSectionTargets[0].pageId,
          sectionId,
        },
        operation: {
          type: "CHANGE_LOCALIZED_SECTION_TEXT",
          sectionId,
          field: "heading",
          locale: "fi",
          value: "Ei sallittu",
        },
      },
    ] as never;
    refreshProposalId(request, response);
    expect(() => validateAiStorefrontProviderResponse(request, response)).toThrow();

    const failedPair = await requestAndResponse();
    const failed = failedPair.response;
    failed.proposal.validation = { valid: false, errors: ["failed"] };
    failed.metadata.validation = "invalid";
    expect(() => validateAiStorefrontProviderResponse(failedPair.request, failed)).toThrow(
      /successfully validated|invalid/i,
    );

    const tampered = await requestAndResponse();
    tampered.response.proposal.targetFingerprint = "storefront-target-tampered";
    expect(() => validateAiStorefrontProviderResponse(tampered.request, tampered.response)).toThrow(
      /match the canonical request/i,
    );

    const tamperedPermissions = await requestAndResponse();
    tamperedPermissions.response.proposal.permissionFingerprint = "storefront-permissions-tampered";
    expect(() =>
      validateAiStorefrontProviderResponse(
        tamperedPermissions.request,
        tamperedPermissions.response,
      ),
    ).toThrow(/match the canonical request/i);
  });
});
