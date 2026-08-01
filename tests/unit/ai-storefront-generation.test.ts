import { describe, expect, it } from "vitest";
import { p905dExactTokenRefinementRequest } from "../fixtures/p9-05d-exact-token-refinement";
import {
  p9r07ExactDesignSystemRequest,
  p9r07FinnishDesignSystemRequest,
} from "../fixtures/p9r-07-design-system";
import {
  aiStorefrontPendingRequestKey,
  buildAiStorefrontProviderRequest,
  buildAiStorefrontProviderRequestForSupportedCapability,
  classifyRegisteredWholeStorefrontDirectionRequest,
  containsProtectedCommerceMutation,
  createApprovedGenerationAssetContextFingerprint,
  createAiStorefrontGenerationPlan,
  createDeterministicMockStorefrontAIProvider,
  planExactBrandPalette,
  aiStorefrontProviderResponseSchema,
  isRegisteredWholeStorefrontDirectionRequest,
  planRegisteredTokenRefinement,
  validateAiStorefrontProviderResponse,
  type AiStorefrontGenerationCommand,
  type AiStorefrontProviderResponse,
  type StorefrontAIProvider,
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
const exactTokenOnlyRequest =
  "Change only the storefront colours and typography. Use #F6F1E8 for backgrounds, #2F3A32 for primary text and buttons, #A58F78 for secondary surfaces, and #D8C8B6 for borders. Use an elegant serif for headings and a clean sans-serif for body text. Preserve all layouts, sections, products and images.";

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

function commandWithoutCapability(
  overrides: Partial<AiStorefrontGenerationCommand> = {},
): Omit<AiStorefrontGenerationCommand, "capability"> {
  const result: Partial<AiStorefrontGenerationCommand> = command(overrides);
  delete result.capability;
  return result as Omit<AiStorefrontGenerationCommand, "capability">;
}

function registeredProvider(): StorefrontAIProvider {
  return {
    id: "registered-storefront-test-provider",
    generationCapabilities: [
      "approvedColorTypographyDirection",
      "registeredWholeStorefrontDirection",
    ],
    proposeStorefront: () => Promise.reject(new Error("Not invoked by request-building tests.")),
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
        "Apply a warm premium style across the storefront.",
      ),
    ).toBe(true);
    expect(
      isRegisteredWholeStorefrontDirectionRequest(
        "Change the product prices and inventory to match the new design.",
      ),
    ).toBe(false);
    expect(isRegisteredWholeStorefrontDirectionRequest("Rebuild the navigation.")).toBe(false);
  });

  it("preserves ambiguous legacy classification instead of selecting a registered fallback", () => {
    const provider = registeredProvider();
    expect(() =>
      buildAiStorefrontProviderRequestForSupportedCapability(
        commandWithoutCapability({
          provider,
          providerId: provider.id,
          merchantInstruction: "Make it warm premium and minimal Nordic.",
        }),
        1,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "ambiguous-request",
      }),
    );
    expect(
      classifyRegisteredWholeStorefrontDirectionRequest("Make it warm premium and minimal Nordic."),
    ).toEqual({ kind: "ambiguous" });
  });

  it("fails a mixed structural and global design-system request closed", () => {
    const provider = registeredProvider();
    const instruction =
      "Redesign the entire storefront in a modern technical direction and set the global palette to primary #B54708 and background #FFFFFF.";

    expect(
      classifyRegisteredWholeStorefrontDirectionRequest(instruction, snapshot.brandSystem),
    ).toEqual({ kind: "mixed" });
    expect(() =>
      buildAiStorefrontProviderRequestForSupportedCapability(
        commandWithoutCapability({
          provider,
          providerId: provider.id,
          merchantInstruction: instruction,
        }),
        1,
      ),
    ).toThrow(expect.objectContaining({ code: "ambiguous-request" }));
  });

  it("uses the registered capability for structural storefront directions", () => {
    const provider = registeredProvider();
    const requests = [
      "Apply the premium editorial direction with craftsmanship and product imagery.",
      "Use a minimal Nordic direction throughout the storefront.",
      "Redesign the storefront in a modern technical direction.",
    ].map((merchantInstruction, index) =>
      buildAiStorefrontProviderRequestForSupportedCapability(
        commandWithoutCapability({
          provider,
          providerId: provider.id,
          merchantInstruction,
        }),
        index + 1,
      ),
    );

    expect(requests.map(({ command: built }) => built.capability)).toEqual([
      "registeredWholeStorefrontDirection",
      "registeredWholeStorefrontDirection",
      "registeredWholeStorefrontDirection",
    ]);
    expect(requests.map(({ request }) => request.capability)).toEqual([
      "registeredWholeStorefrontDirection",
      "registeredWholeStorefrontDirection",
      "registeredWholeStorefrontDirection",
    ]);
  });

  it("builds exact palette and typography through approved design-system authority", () => {
    const storefrontProvider = registeredProvider();
    const { request, command: built } = buildAiStorefrontProviderRequestForSupportedCapability(
      commandWithoutCapability({
        provider: storefrontProvider,
        providerId: storefrontProvider.id,
        affectedPageIds: snapshot.pages.map((page) => page.id),
        merchantInstruction: exactTokenOnlyRequest,
      }),
      1,
    );
    const plan = createAiStorefrontGenerationPlan(built);

    expect(built.capability).toBe("approvedColorTypographyDirection");
    expect(plan.direction).toBe("registeredWholeStorefront");
    expect(plan.sectionTargets).toEqual([]);
    expect(plan.tokenRefinementPlan).toMatchObject({
      palette: {
        colors: {
          primary: "#2F3A32",
          secondary: "#A58F78",
          border: "#D8C8B6",
          background: "#F6F1E8",
        },
      },
      typography: { headingFont: "georgia", bodyFont: "system-sans" },
      preservePageStructure: true,
      preserveComponentVariants: true,
      preserveApprovedAssets: true,
      preserveCanonicalCommerce: true,
    });
    expect(request.capability).toBe("approvedColorTypographyDirection");
    expect(request.affectedSections).toEqual([]);
    expect(request.componentContracts).toEqual([]);
    expect(request.permissionGrants).toHaveLength(1);
    expect(request.permissionGrants[0]).toMatchObject({
      target: { kind: "storefrontDesignSystem" },
      operationTypes: ["APPLY_APPROVED_BRAND_COLOURS", "APPLY_APPROVED_BRAND_TYPOGRAPHY"],
    });
  });

  it.each([
    ["English", p9r07ExactDesignSystemRequest],
    ["Finnish", p9r07FinnishDesignSystemRequest],
  ])(
    "routes the P9R-07 %s request through exact global design-system authority",
    (_locale, instruction) => {
      const storefrontProvider = registeredProvider();
      const { request, command: built } = buildAiStorefrontProviderRequestForSupportedCapability(
        commandWithoutCapability({
          provider: storefrontProvider,
          providerId: storefrontProvider.id,
          affectedPageIds: snapshot.pages.map((page) => page.id),
          merchantInstruction: instruction,
        }),
        1,
      );
      const plan = createAiStorefrontGenerationPlan(built);

      expect(built.capability).toBe("approvedColorTypographyDirection");
      expect(request.capability).toBe("approvedColorTypographyDirection");
      expect(plan.sectionTargets).toEqual([]);
      expect(plan.tokenRefinementPlan).toMatchObject({
        spacing: null,
        preservePageStructure: true,
        preserveComponentVariants: true,
        preserveApprovedAssets: true,
        preserveCanonicalCommerce: true,
        typography: { headingFont: "system-sans", bodyFont: "system-sans" },
      });
      expect(request.permissionGrants).toEqual([
        expect.objectContaining({
          target: { kind: "storefrontDesignSystem", projectId: snapshot.projectId },
          operationTypes: ["APPLY_APPROVED_BRAND_COLOURS", "APPLY_APPROVED_BRAND_TYPOGRAPHY"],
        }),
      ]);
      expect(request.affectedSections).toEqual([]);
      expect(request.componentContracts).toEqual([]);
      expect(JSON.stringify(request.permissionGrants)).not.toMatch(
        /APPLY_REGISTERED_PAGE_SECTIONS|REORDER_SECTIONS/,
      );
    },
  );

  it("maps the live semantic palette and typography to accessible canonical tokens", () => {
    const plan = planRegisteredTokenRefinement(p9r07ExactDesignSystemRequest, snapshot.brandSystem);

    expect(plan).toMatchObject({
      palette: {
        colors: {
          primary: "#B54708",
          secondary: "#111111",
          accent: "#B54708",
          background: "#FFFFFF",
          surface: "#FFFFFF",
          text: "#111111",
          mutedText: "#111111",
          border: "#111111",
        },
      },
      typography: {
        headingFont: "system-sans",
        bodyFont: "system-sans",
        headingWeight: 700,
      },
      spacing: null,
    });
  });

  it("builds the exact P9-05D failed merchant request as one protected token-only refinement", () => {
    const storefrontProvider = registeredProvider();
    const { request } = buildAiStorefrontProviderRequestForSupportedCapability(
      commandWithoutCapability({
        provider: storefrontProvider,
        providerId: storefrontProvider.id,
        affectedPageIds: snapshot.pages.map((page) => page.id),
        merchantInstruction: p905dExactTokenRefinementRequest,
      }),
      1,
    );
    expect(request.tokenRefinementPlan).toMatchObject({
      preservePageStructure: true,
      preserveComponentVariants: true,
      preserveApprovedAssets: true,
      preserveCanonicalCommerce: true,
      spacing: null,
      typography: { headingFont: "system-serif", bodyFont: "system-sans" },
      palette: {
        colors: {
          primary: "#201A17",
          secondary: "#C9A27A",
          accent: "#6B2E3D",
          background: "#FFF8F0",
          surface: "#E7D8C8",
          text: "#201A17",
          border: "#E7D8C8",
        },
      },
    });
    expect(request.affectedSections).toEqual([]);
    expect(request.componentContracts).toEqual([]);
  });

  it.each([
    ["Preserve spacing.", null],
    ["Keep the existing spacing.", null],
    ["Do not change spacing.", null],
    ["Leave layout and spacing unchanged.", null],
    ["Preserve all layouts, sections, products, bindings, images, spacing and content.", null],
    ["Preserve the airy layout.", null],
    ["Keep the spacious composition.", null],
    ["Leave the compact layout unchanged.", null],
    ["Use compact spacing.", "compact"],
    ["Use balanced spacing.", "balanced"],
    ["Use spacious spacing.", "airy"],
    ["Make the storefront more compact.", "compact"],
    ["Do not preserve the current spacing; make it spacious.", "airy"],
  ])("handles spacing instruction %s", (instruction, density) => {
    const plan = planRegisteredTokenRefinement(instruction, snapshot.brandSystem);
    if (density === null) {
      expect(plan).toBeNull();
      return;
    }
    expect(plan?.spacing).toEqual({ density });
  });

  it.each(["Change the spacing.", "Adjust the density.", "Use different spacing."])(
    "rejects incomplete spacing mutation %s",
    (instruction) => {
      expect(() => planRegisteredTokenRefinement(instruction, snapshot.brandSystem)).toThrow(
        "Choose compact, balanced, or spacious spacing for this refinement.",
      );
    },
  );

  it("keeps editorial contrast as a complete registered typography pairing", () => {
    const current = {
      ...snapshot.brandSystem.typography,
      headingFont: "inter" as const,
      bodyFont: "georgia" as const,
    };
    const plan = planRegisteredTokenRefinement("Use editorial contrast typography.", {
      ...snapshot.brandSystem,
      typography: current,
    });
    expect(plan?.typography).toEqual({
      ...current,
      headingFont: "system-serif",
      bodyFont: "system-sans",
    });
  });

  it.each([
    [
      "Use Georgia for headings.",
      { headingFont: "georgia", bodyFont: snapshot.brandSystem.typography.bodyFont },
    ],
    [
      "Use Inter for body text.",
      { headingFont: snapshot.brandSystem.typography.headingFont, bodyFont: "inter" },
    ],
    [
      "Use Georgia for headings and Inter for body text.",
      { headingFont: "georgia", bodyFont: "inter" },
    ],
  ])("keeps explicit typography targets independent: %s", (instruction, expected) => {
    const plan = planRegisteredTokenRefinement(instruction, snapshot.brandSystem);
    expect(plan?.typography).toMatchObject(expected);
  });

  it("allows an explicit colour role to override an earlier grouped assignment", () => {
    expect(
      planExactBrandPalette(
        "Use #AA0000 for primary text and buttons, and #222222 for text.",
        snapshot.brandSystem.colors,
      )?.colors,
    ).toMatchObject({ primary: "#AA0000", text: "#222222" });
  });

  it("rejects conflicting equally specific colour assignments", () => {
    expect(() =>
      planExactBrandPalette(
        "Use #AA0000 for text and #222222 for text.",
        snapshot.brandSystem.colors,
      ),
    ).toThrow("Supply only one value for the text colour token.");
  });

  it.each([
    {
      name: "named semantic palette with typography",
      instruction:
        "Use primary deep forest green, secondary muted sage, accent soft gold, background warm off-white, surface white, text charcoal, muted text charcoal, and border beige. Use refined serif typography with Georgia headings and Inter body text. Preserve layouts, sections, products, and images.",
      expected: { palette: true, typography: true, spacing: false },
    },
    {
      name: "colour only",
      instruction:
        "Use primary forest green, secondary sage, accent soft gold, background warm off-white, surface white, text charcoal, muted text charcoal, and border beige. Preserve every page layout, section, product, image, and component variant.",
      expected: { palette: true, typography: false, spacing: false },
    },
    {
      name: "typography only",
      instruction:
        "Use Georgia for headings and Inter for body text across the storefront. Preserve every page layout, section, product, image, and component variant.",
      expected: { palette: false, typography: true, spacing: false },
    },
    {
      name: "spacing only",
      instruction:
        "Use compact spacing and density across the storefront. Preserve every page layout, section, product, image, and component variant.",
      expected: { palette: false, typography: false, spacing: true },
    },
  ])("supports $name without creating structural operations", ({ instruction, expected }) => {
    const storefrontProvider = registeredProvider();
    const { request, command: built } = buildAiStorefrontProviderRequestForSupportedCapability(
      commandWithoutCapability({
        provider: storefrontProvider,
        providerId: storefrontProvider.id,
        affectedPageIds: snapshot.pages.map((page) => page.id),
        merchantInstruction: instruction,
      }),
      1,
    );
    const plan = createAiStorefrontGenerationPlan(built);

    expect(Boolean(plan.tokenRefinementPlan?.palette) || plan.brandPalettePlan !== null).toBe(
      expected.palette,
    );
    expect(Boolean(plan.tokenRefinementPlan?.typography)).toBe(expected.typography);
    expect(Boolean(plan.tokenRefinementPlan?.spacing)).toBe(expected.spacing);
    expect(request.capability).toBe(
      expected.spacing ? "registeredWholeStorefrontDirection" : "approvedColorTypographyDirection",
    );
    expect(plan.sectionTargets).toEqual([]);
    expect(request.affectedPages.map((page) => page.id).sort()).toEqual(
      snapshot.pages.map((page) => page.id).sort(),
    );
    expect(request.affectedSections).toEqual([]);
  });

  it("gates registered fallback on explicit provider capability advertisement", () => {
    const unsupportedProvider = provider();
    expect(unsupportedProvider.generationCapabilities).toEqual([
      "approvedColorTypographyDirection",
    ]);
    expect(() =>
      buildAiStorefrontProviderRequestForSupportedCapability(
        commandWithoutCapability({
          provider: unsupportedProvider,
          providerId: unsupportedProvider.id,
          merchantInstruction:
            "Apply a premium editorial direction with craftsmanship and product imagery.",
        }),
        1,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "unsupported-request",
      }),
    );
  });

  it.each([
    "Increase every price and use a modern technical design.",
    "Decrease stock and use a premium editorial design.",
    "Adjust availability and make the storefront warm and approachable.",
    "Modify variant option values and use a modern technical design.",
    "Korota kaikkia hintoja ja käytä modernia teknistä ilmettä.",
    "Vähennä varastoa ja tee ilmeestä lämmin ja lähestyttävä.",
    "Säädä saatavuutta ja käytä ensiluokkaista editoriaalista ilmettä.",
    "Muuta varianttien valinta-arvoja ja käytä modernia teknistä ilmettä.",
  ])("rejects canonical protected-commerce mutation language: %s", (instruction) => {
    expect(containsProtectedCommerceMutation(instruction)).toBe(true);
    expect(classifyRegisteredWholeStorefrontDirectionRequest(instruction)).toEqual({
      kind: "protected-commerce",
    });

    const registered = registeredProvider();
    expect(() =>
      buildAiStorefrontProviderRequestForSupportedCapability(
        commandWithoutCapability({
          provider: registered,
          providerId: registered.id,
          merchantInstruction: instruction,
        }),
        1,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "unsupported-request",
      }),
    );
  });

  it("permits an explicit preservation clause alongside a registered composition request", () => {
    expect(
      containsProtectedCommerceMutation(
        "Redesign only the homepage as modern technical. Preserve all products, prices, stock, media bindings, routes, and approved assets.",
      ),
    ).toBe(false);
    expect(containsProtectedCommerceMutation("Change the product card component variants.")).toBe(
      false,
    );
    expect(containsProtectedCommerceMutation("Change variants and use a compact layout.")).toBe(
      true,
    );
  });

  it.each([
    "Keep products but increase prices. Use a modern technical layout.",
    "Preserve products and stock, but change availability. Use a modern technical layout.",
    "Pidä tuotteet mutta korota hintoja. Käytä modernia teknistä asettelua.",
    "Säilytä tuotteet ja varasto, mutta muuta saatavuutta. Käytä modernia teknistä asettelua.",
  ])("rejects protected mutations hidden inside preservation language: %s", (instruction) => {
    expect(containsProtectedCommerceMutation(instruction)).toBe(true);
    expect(classifyRegisteredWholeStorefrontDirectionRequest(instruction)).toEqual({
      kind: "protected-commerce",
    });
  });

  it.each([
    "Preserve products, prices and stock while redesigning product presentation.",
    "Säilytä tuotteet, hinnat ja varasto, kun uudistat tuotteiden esitystapaa.",
  ])("allows preservation-only commerce language: %s", (instruction) => {
    expect(containsProtectedCommerceMutation(instruction)).toBe(false);
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
