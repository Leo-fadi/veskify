import { describe, expect, it, vi } from "vitest";
import {
  designOperationSchema,
  InMemoryDesignProposalStore,
} from "@/application/design-operations";
import {
  DesignSkillRegistry,
  addCampaignSectionSkill,
  applyLuxuryStyleSkill,
  applyMinimalNordicStyleSkill,
  classifyDesignRequest,
  createDesignPlan,
  createDeterministicDesignProvider,
  createProposalFromDesignPlan,
  designSkillDefinitionSchema,
  designSkillRegistry,
  deterministicDesignProvider,
  executeDesignPlan,
  improveHeroSkill,
  type DesignPlannerInput,
  type DesignSkillDefinition,
} from "@/application/design-skills";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const productPage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "product")!;
const displayContext = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

const input = (
  merchantRequest: string,
  overrides: Partial<DesignPlannerInput> = {},
): DesignPlannerInput => ({
  merchantRequest,
  activeLocale: "en",
  page: structuredClone(homepage),
  pageType: "home",
  brandSystem: structuredClone(aurumNordicSeed.draftSnapshot.brandSystem),
  displayContext: structuredClone(displayContext),
  ...overrides,
});

const section = (page: typeof homepage, component: string) =>
  page.sections.find((item) => item.component === component)!;

describe("controlled design skill contract and registry", () => {
  it("validates every initial canonical skill definition", () => {
    for (const skill of [
      applyLuxuryStyleSkill,
      applyMinimalNordicStyleSkill,
      addCampaignSectionSkill,
      improveHeroSkill,
    ]) {
      expect(designSkillDefinitionSchema.parse(skill).id).toBe(skill.id);
      expect(skill.protectedPaths).toEqual(
        expect.arrayContaining([
          "catalogue.products.*.id",
          "catalogue.products.*.sku",
          "catalogue.products.*.price",
          "catalogue.products.*.stockStatus",
          "catalogue.products.*.images",
          "payment.configuration",
          "shipping.configuration",
          "tax.configuration",
          "checkout.operationalBehaviour",
        ]),
      );
    }
  });

  it("rejects duplicate skill IDs", () => {
    expect(() => new DesignSkillRegistry([improveHeroSkill, improveHeroSkill])).toThrow(
      /Duplicate design skill ID/,
    );
  });

  it("retrieves by ID and filters by intent, PageType and scope", () => {
    expect(designSkillRegistry.get("applyLuxuryStyle").version).toBe("1.0.0");
    expect(designSkillRegistry.listByIntent("luxuryStyle").map((skill) => skill.id)).toEqual([
      "applyLuxuryStyle",
      "improveHero",
    ]);
    expect(
      designSkillRegistry.filterByPageTypeAndScope("home", "page").map((skill) => skill.id),
    ).toEqual(["applyLuxuryStyle", "applyMinimalNordicStyle", "addCampaignSection"]);
    expect(designSkillRegistry.filterByPageTypeAndScope("product", "page")).toEqual([]);
  });
});

describe("deterministic EN/FI intent classification", () => {
  it.each([
    ["Make the homepage feel more luxurious.", "luxuryStyle", "en"],
    ["Add a campaign section.", "campaignSection", "en"],
    ["Make the layout more minimal.", "minimalNordicStyle", "en"],
    ["Improve the hero.", "heroImprovement", "en"],
    ["Tee etusivusta ylellisempi.", "luxuryStyle", "fi"],
    ["Lisää kampanjaosio.", "campaignSection", "fi"],
    ["Tee asettelusta pelkistetympi.", "minimalNordicStyle", "fi"],
    ["Paranna hero-osiota.", "heroImprovement", "fi"],
  ])("classifies %s", (request, intent, locale) => {
    const result = classifyDesignRequest(request);
    expect(result).toMatchObject({
      normalizedIntent: intent,
      locale,
      confidence: 1,
      requiresClarification: false,
      unsupportedReason: null,
    });
  });

  it("returns a controlled unsupported result for unknown requests", () => {
    const result = classifyDesignRequest("Build an animated custom checkout script.", "en");
    expect(result.normalizedIntent).toBeNull();
    expect(result.selectedSkillIds).toEqual([]);
    expect(result.unsupportedReason?.en).toContain("approved design capability");
  });

  it("requires clarification for conflicting ambiguous directions", () => {
    const result = classifyDesignRequest("Make it luxurious and minimal.", "en");
    expect(result).toMatchObject({
      normalizedIntent: null,
      requiresClarification: true,
      selectedSkillIds: [],
    });
    expect(result.clarifications).toHaveLength(1);
  });
});

describe("deterministic design plans", () => {
  it.each([
    ["without a selection", undefined],
    ["with the hero selected", section(homepage, "hero").id],
    ["with a non-hero selected", section(homepage, "productGrid").id],
  ])("creates a full luxury homepage plan %s", (_label, selectedSectionId) => {
    const plan = createDesignPlan(
      input("Make the homepage feel more luxurious.", { selectedSectionId }),
    );
    expect(plan.validation).toEqual({ valid: true, errors: [] });
    expect(plan.selectedSkills.map((skill) => skill.id)).toEqual([
      "applyLuxuryStyle",
      "improveHero",
    ]);
    expect(plan.affectedPageIds).toEqual([homepage.id]);
    expect(plan.affectedSectionIds).toContain(section(homepage, "hero").id);
    expect(
      plan.selectedSkills.find((skill) => skill.id === "improveHero")?.targetSectionIds,
    ).toEqual([section(homepage, "hero").id]);
  });

  it("creates campaign, minimal-layout and hero-only plans", () => {
    const campaign = createDesignPlan(input("Add a campaign section."));
    const minimal = createDesignPlan(input("Make the layout more minimal."));
    const hero = createDesignPlan(input("Improve the hero."));
    expect(campaign.selectedSkills.map((skill) => skill.id)).toEqual(["addCampaignSection"]);
    expect(campaign.affectedSectionIds).toEqual(["section_campaign_generated"]);
    expect(minimal.selectedSkills.map((skill) => skill.id)).toEqual(["applyMinimalNordicStyle"]);
    expect(hero.requestedScope).toBe("section");
    expect(hero.affectedSectionIds).toEqual([section(homepage, "hero").id]);
  });

  it("honours a selected hero and rejects a non-hero selected-section scope", () => {
    const heroId = section(homepage, "hero").id;
    const selected = createDesignPlan(input("Improve the hero.", { selectedSectionId: heroId }));
    expect(selected.validation.valid).toBe(true);
    expect(selected.selectedSkills[0].targetSectionIds).toEqual([heroId]);

    const invalid = createDesignPlan(
      input("Improve the hero.", { selectedSectionId: section(homepage, "productGrid").id }),
    );
    expect(invalid.validation.valid).toBe(false);
    expect(invalid.validation.errors).toContain(
      "Hero improvement requires an existing hero selection.",
    );
  });

  it("ignores a non-hero selection for a page-wide minimal plan", () => {
    const plan = createDesignPlan(
      input("Make the layout more minimal.", {
        selectedSectionId: section(homepage, "productGrid").id,
      }),
    );
    expect(plan.validation).toEqual({ valid: true, errors: [] });
    expect(plan.requestedScope).toBe("page");
    expect(plan.selectedSkills.map((skill) => skill.id)).toEqual(["applyMinimalNordicStyle"]);
    expect(plan.selectedSkills[0].targetSectionIds).toContain(section(homepage, "hero").id);
  });

  it("omits optional hero improvement from a luxury page without a hero", () => {
    const pageWithoutHero = structuredClone(homepage);
    pageWithoutHero.sections = pageWithoutHero.sections.filter((item) => item.component !== "hero");
    const plannerInput = input("Make the homepage feel more luxurious.", {
      page: pageWithoutHero,
      selectedSectionId: section(pageWithoutHero, "productGrid").id,
    });
    const plan = createDesignPlan(plannerInput);
    expect(plan.validation).toEqual({ valid: true, errors: [] });
    expect(plan.selectedSkills.map((skill) => skill.id)).toEqual(["applyLuxuryStyle"]);
    expect(plan.assumptions.map((assumption) => assumption.en)).toContain(
      "No hero section is present, so the optional hero improvement is omitted.",
    );
    expect(executeDesignPlan(plan, plannerInput).validation).toEqual({ valid: true, errors: [] });
  });

  it("rejects skills on an unsupported PageType", () => {
    const plan = createDesignPlan(
      input("Make the layout more minimal.", { page: productPage, pageType: "product" }),
    );
    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.errors).toContain(
      "Skill applyMinimalNordicStyle does not support product pages.",
    );
  });

  it("does not mutate its input and repeats deterministically", () => {
    const plannerInput = input("Make the homepage feel more luxurious.");
    const before = structuredClone(plannerInput);
    const first = createDesignPlan(plannerInput);
    const second = createDesignPlan(plannerInput);
    expect(first).toEqual(second);
    expect(plannerInput).toEqual(before);
  });
});

describe("initial deterministic skill execution", () => {
  it("applies luxury through approved variants and semantic existing-brand tokens", () => {
    const plannerInput = input("Make the homepage feel more luxurious.");
    const result = executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    expect(result.validation.valid).toBe(true);
    expect(result.proposedPage.themeOverride?.colors).toBeUndefined();
    expect(section(result.proposedPage, "header").variant).toBe("transparent");
    expect(section(result.proposedPage, "campaignBanner").props).toMatchObject({
      typography: "serif",
      density: "spacious",
    });
    expect(JSON.stringify(result.operations).toLowerCase()).not.toContain("#000000");
    expect(JSON.stringify(result.operations).toLowerCase()).not.toContain("gold");
  });

  it("does not roll back a page-wide luxury plan because a non-hero is selected", () => {
    const plannerInput = input("Make the homepage feel more luxurious.", {
      selectedSectionId: section(homepage, "productGrid").id,
    });
    const result = executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    expect(result.validation).toEqual({ valid: true, errors: [] });
    expect(result.failureReason).toBeNull();
    expect(section(result.proposedPage, "header").variant).toBe("transparent");
    expect(section(result.proposedPage, "hero").content.body).not.toEqual(
      section(homepage, "hero").content.body,
    );
  });

  it("applies a simplified minimal Nordic layout with controlled whitespace", () => {
    const plannerInput = input("Make the layout more minimal.");
    const result = executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    expect(result.validation.valid).toBe(true);
    expect(section(result.proposedPage, "campaignBanner").variant).toBe("minimal");
    expect(section(result.proposedPage, "brandStory").variant).toBe("minimal");
    expect(section(result.proposedPage, "campaignBanner").props).toMatchObject({
      typography: "sans",
      density: "spacious",
    });
  });

  it("adds only one registered campaign section and invents no commercial claims", () => {
    const plannerInput = input("Add a campaign section.");
    const beforeHeader = structuredClone(section(homepage, "header"));
    const beforeFooter = structuredClone(section(homepage, "footer"));
    const beforeStory = structuredClone(section(homepage, "brandStory"));
    const result = executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    const added = result.proposedPage.sections.find(
      (item) => item.id === "section_campaign_generated",
    )!;
    expect(result.validation.valid).toBe(true);
    expect(added.component).toBe("campaignBanner");
    expect(section(result.proposedPage, "header")).toEqual(beforeHeader);
    expect(section(result.proposedPage, "footer")).toEqual(beforeFooter);
    expect(section(result.proposedPage, "brandStory")).toEqual(beforeStory);
    expect(JSON.stringify(added.content)).not.toMatch(/%|€|\$|discount|free shipping|guarantee/i);
  });

  it("uses supplied campaign copy without interpreting it as commerce truth", () => {
    const plannerInput = input("Add a campaign section.", {
      campaign: {
        heading: { en: "Summer selection", fi: "Kesän valikoima" },
        body: { en: "Selected by the merchant.", fi: "Kauppiaan valitsema." },
      },
    });
    const result = executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    const added = result.proposedPage.sections.find(
      (item) => item.id === "section_campaign_generated",
    )!;
    expect(added.content.heading).toMatchObject({ en: "Summer selection" });
    expect(added.content.body).toMatchObject({ en: "Selected by the merchant." });
  });

  it("improves only the existing hero in the active locale", () => {
    const heroId = section(homepage, "hero").id;
    const plannerInput = input("Improve the hero.", { selectedSectionId: heroId });
    const result = executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    expect(result.validation.valid).toBe(true);
    for (const originalSection of homepage.sections.filter((item) => item.id !== heroId)) {
      expect(result.proposedPage.sections.find((item) => item.id === originalSection.id)).toEqual(
        originalSection,
      );
    }
    const originalHero = section(homepage, "hero");
    const proposedHero = section(result.proposedPage, "hero");
    expect(proposedHero.content.body).not.toEqual(originalHero.content.body);
    expect((proposedHero.content.body as { fi: string }).fi).toBe(
      (originalHero.content.body as { fi: string }).fi,
    );
  });

  it("does not mutate the page, catalogue media, product truth, or stored snapshots", () => {
    const plannerInput = input("Make the homepage feel more luxurious.");
    const pageBefore = structuredClone(plannerInput.page);
    const contextBefore = structuredClone(plannerInput.displayContext);
    const snapshotsBefore = structuredClone(aurumNordicSeed.draftSnapshot);
    executeDesignPlan(createDesignPlan(plannerInput), plannerInput);
    expect(plannerInput.page).toEqual(pageBefore);
    expect(plannerInput.displayContext).toEqual(contextBefore);
    expect(
      plannerInput.displayContext.catalogue.products.map((product) => ({
        id: product.id,
        sku: product.sku,
        price: product.price,
        stockStatus: product.stockStatus,
        images: product.images,
      })),
    ).toEqual(
      contextBefore.catalogue.products.map((product) => ({
        id: product.id,
        sku: product.sku,
        price: product.price,
        stockStatus: product.stockStatus,
        images: product.images,
      })),
    );
    expect(aurumNordicSeed.draftSnapshot).toEqual(snapshotsBefore);
  });

  it("returns identical plans, operations and pages for repeated execution", () => {
    const plannerInput = input("Make the homepage feel more luxurious.");
    const firstPlan = createDesignPlan(plannerInput);
    const secondPlan = createDesignPlan(plannerInput);
    expect(executeDesignPlan(firstPlan, plannerInput)).toEqual(
      executeDesignPlan(secondPlan, plannerInput),
    );
  });
});

describe("permission enforcement and transaction rollback", () => {
  const customRegistry = (replacement: DesignSkillDefinition) =>
    new DesignSkillRegistry([
      applyLuxuryStyleSkill,
      applyMinimalNordicStyleSkill,
      addCampaignSectionSkill,
      replacement,
    ]);

  it("rejects an undeclared operation before canonical execution", () => {
    const unsafe = {
      ...improveHeroSkill,
      allowedOperationTypes: ["CHANGE_SECTION_VARIANT"] as const,
      execute: ({ page }: Parameters<DesignSkillDefinition["execute"]>[0]) => [
        {
          type: "CHANGE_BACKGROUND",
          sectionId: section(page, "hero").id,
          background: "accent",
        },
      ],
    } satisfies DesignSkillDefinition;
    const registry = customRegistry(unsafe);
    const plannerInput = input("Improve the hero.");
    const result = executeDesignPlan(
      createDesignPlan(plannerInput, registry),
      plannerInput,
      registry,
    );
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors[0]).toMatch(/undeclared operation/);
    expect(result.proposedPage).toEqual(result.originalPage);
  });

  it("rejects protected commerce paths and executable content", () => {
    const protectedField = {
      ...improveHeroSkill,
      execute: ({ page }: Parameters<DesignSkillDefinition["execute"]>[0]) => [
        {
          type: "CHANGE_LOCALIZED_SECTION_TEXT",
          sectionId: section(page, "hero").id,
          field: "price",
          locale: "en",
          value: "99",
        },
      ],
    } satisfies DesignSkillDefinition;
    const executable = {
      ...improveHeroSkill,
      execute: ({ page }: Parameters<DesignSkillDefinition["execute"]>[0]) => [
        {
          type: "CHANGE_LOCALIZED_SECTION_TEXT",
          sectionId: section(page, "hero").id,
          field: "body",
          locale: "en",
          value: "<script>alert('x')</script>",
        },
      ],
    } satisfies DesignSkillDefinition;
    const plannerInput = input("Improve the hero.");
    const protectedRegistry = customRegistry(protectedField);
    const executableRegistry = customRegistry(executable);
    expect(
      executeDesignPlan(
        createDesignPlan(plannerInput, protectedRegistry),
        plannerInput,
        protectedRegistry,
      ).validation.errors[0],
    ).toMatch(/protected field price/);
    expect(
      executeDesignPlan(
        createDesignPlan(plannerInput, executableRegistry),
        plannerInput,
        executableRegistry,
      ).validation.errors[0],
    ).toMatch(/executable or embedded content/);
  });

  it("preserves required header/footer and rolls the whole transaction back", () => {
    const destructiveMinimal = {
      ...applyMinimalNordicStyleSkill,
      allowedComponentTypes: applyMinimalNordicStyleSkill.allowedComponentTypes,
      allowedOperationTypes: ["REMOVE_OPTIONAL_SECTION"],
      execute: ({ page }: Parameters<DesignSkillDefinition["execute"]>[0]) => [
        { type: "REMOVE_OPTIONAL_SECTION", sectionId: section(page, "header").id },
      ],
    } satisfies DesignSkillDefinition;
    const registry = new DesignSkillRegistry([
      applyLuxuryStyleSkill,
      destructiveMinimal,
      addCampaignSectionSkill,
      improveHeroSkill,
    ]);
    const plannerInput = input("Make the layout more minimal.");
    const result = executeDesignPlan(
      createDesignPlan(plannerInput, registry),
      plannerInput,
      registry,
    );
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors[0]).toMatch(/required header/);
    expect(result.proposedPage).toEqual(result.originalPage);
  });

  it("rolls back earlier skills when a later skill escapes its section scope", () => {
    const escapingHero = {
      ...improveHeroSkill,
      allowedComponentTypes: ["hero", "header"],
      allowedOperationTypes: ["REMOVE_OPTIONAL_SECTION"],
      outputSchema: designOperationSchema.array(),
      execute: ({ page }: Parameters<DesignSkillDefinition["execute"]>[0]) => [
        { type: "REMOVE_OPTIONAL_SECTION", sectionId: section(page, "header").id },
      ],
    } satisfies DesignSkillDefinition;
    const registry = customRegistry(escapingHero);
    const plannerInput = input("Make the homepage feel more luxurious.");
    const result = executeDesignPlan(
      createDesignPlan(plannerInput, registry),
      plannerInput,
      registry,
    );
    expect(result.validation.valid).toBe(false);
    expect(result.operations.length).toBeGreaterThan(0);
    expect(result.validation.errors[0]).toMatch(/planned section scope/);
    expect(result.proposedPage).toEqual(result.originalPage);
  });
});

describe("existing proposal lifecycle boundary", () => {
  it("converts a successful execution into the existing pending proposal model", () => {
    const plannerInput = input("Add a campaign section.");
    const plan = createDesignPlan(plannerInput);
    const execution = executeDesignPlan(plan, plannerInput);
    const store = new InMemoryDesignProposalStore();
    const proposal = createProposalFromDesignPlan(execution, plannerInput.displayContext, store);
    expect(proposal.status).toBe("pending");
    expect(proposal.originalPage).toEqual(homepage);
    expect(proposal.proposedPage).toEqual(execution.proposedPage);
    expect(store.reject(proposal.id)).toEqual(homepage);
  });

  it("retains default proposals for inspection without an external store", () => {
    const result = deterministicDesignProvider.propose(input("Improve the hero."));
    if (!result.proposal) throw new Error("Expected a pending hero proposal.");
    expect(deterministicDesignProvider.inspect(result.proposal.id)).toEqual(result.proposal);
  });

  it("accepts a default-provider proposal through the retained lifecycle", () => {
    const result = deterministicDesignProvider.propose(input("Make the layout more minimal."));
    if (!result.proposal) throw new Error("Expected a pending minimal proposal.");
    const proposal = result.proposal;
    expect(deterministicDesignProvider.accept(proposal.id)).toEqual(proposal.proposedPage);
    expect(deterministicDesignProvider.inspect(proposal.id).status).toBe("accepted");
    expect(() => deterministicDesignProvider.accept(proposal.id)).toThrow(/already accepted/);
  });

  it("rejects a default-provider proposal through the retained lifecycle", () => {
    const result = deterministicDesignProvider.propose(input("Add a campaign section."));
    if (!result.proposal) throw new Error("Expected a pending campaign proposal.");
    const proposal = result.proposal;
    expect(deterministicDesignProvider.reject(proposal.id)).toEqual(proposal.originalPage);
    expect(deterministicDesignProvider.inspect(proposal.id).status).toBe("rejected");
    expect(() => deterministicDesignProvider.reject(proposal.id)).toThrow(/already rejected/);
  });

  it("keeps multiple proposals addressable by ID", () => {
    const provider = createDeterministicDesignProvider();
    const hero = provider.propose(input("Improve the hero.")).proposal;
    const campaign = provider.propose(input("Add a campaign section.")).proposal;
    if (!hero || !campaign) throw new Error("Expected two pending proposals.");
    expect(hero.id).not.toBe(campaign.id);
    expect(provider.inspect(hero.id)).toEqual(hero);
    expect(provider.inspect(campaign.id)).toEqual(campaign);
  });

  it("preserves per-call injected proposal stores", () => {
    const provider = createDeterministicDesignProvider();
    const store = new InMemoryDesignProposalStore();
    const result = provider.propose(input("Improve the hero."), store);
    if (!result.proposal) throw new Error("Expected an injected-store proposal.");
    expect(provider.inspect(result.proposal.id, store)).toEqual(result.proposal);
    expect(provider.reject(result.proposal.id, store)).toEqual(result.proposal.originalPage);
  });

  it("isolates retained lifecycle state between provider instances", () => {
    const first = createDeterministicDesignProvider();
    const second = createDeterministicDesignProvider();
    const proposal = first.propose(input("Improve the hero.")).proposal;
    if (!proposal) throw new Error("Expected an isolated proposal.");
    expect(first.inspect(proposal.id)).toEqual(proposal);
    expect(() => second.inspect(proposal.id)).toThrow(/Unknown design proposal/);
  });

  it("does not create a proposal for invalid execution", () => {
    const store = new InMemoryDesignProposalStore();
    const create = vi.spyOn(store, "create");
    const provider = createDeterministicDesignProvider(store);
    const result = provider.propose(input("Create arbitrary checkout code."));
    expect(result.execution.validation.valid).toBe(false);
    expect(result.proposal).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
