import { describe, expect, it } from "vitest";
import { listCompatibleCoordinatedDirectionSelectionNarrowings } from "@/application/bounded-storefront-synthesis";
import { validateCurrentDynamicCommercePresentationAuthority } from "@/application/dynamic-commerce-routes";
import { createPromptedStorefrontDesignRequestV2 } from "@/application/prompted-storefront-design-intent";
import {
  P10B16P03_PROJECT_ID,
  createP10B16P03RawKarvonenStudioFixture,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { createRawKarvonenStorefrontFixture } from "@/data/demo/raw-karvonen-storefront-fixture";
import { canonicalValueString } from "@/domain/storefront";

describe("P10B-16P-03 raw normal-Studio fixture", () => {
  it("retains only raw presentation plus exact compact dynamic-commerce authority", () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();

    expect(fixture.aggregate.project.id).toBe(P10B16P03_PROJECT_ID);
    expect(fixture.rawDraft.pages).toHaveLength(1);
    expect(fixture.rawDraft.pages[0]).toMatchObject({ type: "home", slug: "/" });
    expect(fixture.rawDraft.pages[0]?.sections.map(({ component }) => component)).toEqual([
      "header",
      "footer",
    ]);
    expect(fixture.rawDraft.pages[0]?.pageFamily).toBeUndefined();
    expect(fixture.rawDraft.sharedFrame).toBeUndefined();
    expect(fixture.rawDraft.brandSystem.designDna).toBeUndefined();
    expect(fixture.rawDraft.brandSystem.visualSystem).toBeUndefined();
    expect(fixture.rawDraft.navigation).toEqual({ primary: [], footer: [] });
    expect(fixture.rawDraft.dynamicCommercePresentation?.routeInventory).toHaveLength(20);
    expect(fixture.planningInput.approvedAssetContext).toBeNull();
    expect(fixture.approvedAssetPresentations).toEqual([]);
    expect(() =>
      validateCurrentDynamicCommercePresentationAuthority(fixture.rawDraft),
    ).not.toThrow();
  });

  it("reuses the exact raw Karvonen merchant, commerce, evidence and materialization authorities", () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();
    const source = createRawKarvonenStorefrontFixture();

    expect(canonicalValueString(fixture.aggregate.project)).toBe(
      canonicalValueString(source.aggregate.project),
    );
    expect(canonicalValueString(fixture.aggregate.catalogue)).toBe(
      canonicalValueString(source.aggregate.catalogue),
    );
    expect(fixture.brief).toEqual(source.brief);
    expect(fixture.siteMapDecision).toEqual(source.siteMapDecision);
    expect(fixture.approvedEvidenceReferences).toEqual(source.approvedEvidenceReferences);
    const aboutReference = fixture.approvedEvidenceReferences.find(
      ({ source: evidenceSource }) => evidenceSource === "approved-source-evidence",
    )!;
    const aboutRequest = {
      source: aboutReference.source,
      authorityId: aboutReference.authorityId,
      revision: aboutReference.revision,
    };
    const contentRequest = {
      source: source.aboutFactDocument.evidence.source,
      authorityId: source.aboutFactDocument.evidence.authorityId,
      revision: source.aboutFactDocument.evidence.revision,
    };
    expect(
      fixture.pageEvidenceAuthority.resolve({ reference: aboutRequest, familyId: "about" }),
    ).toEqual(source.pageEvidenceAuthority.resolve({ reference: aboutRequest, familyId: "about" }));
    expect(
      fixture.contentFactAuthority.resolve({
        familyId: "about",
        reference: contentRequest,
      }),
    ).toEqual(
      source.contentFactAuthority.resolve({
        familyId: "about",
        reference: contentRequest,
      }),
    );
  });

  it("is directly eligible for current prompted compilation without preselecting a storefront", () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();
    const prompt =
      "Create a refined premium jewellery storefront with strong editorial storytelling.";
    const request = createPromptedStorefrontDesignRequestV2({
      merchantPrompt: prompt,
      project: fixture.aggregate.project,
      draft: fixture.rawDraft,
      catalogue: fixture.aggregate.catalogue,
      approvedBrief: fixture.brief,
      approvedAssetContext: fixture.planningInput.approvedAssetContext,
    });
    const compatible = listCompatibleCoordinatedDirectionSelectionNarrowings({
      planningInput: fixture.executionPlanningInput,
      siteMapDecision: fixture.siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
    });

    expect(request.request.merchantPrompt).toBe(prompt);
    expect(request.request.currentAuthority.dynamicCommercePresentationFingerprint).toBe(
      fixture.rawDraft.dynamicCommercePresentation?.authorityFingerprint,
    );
    expect(compatible.length).toBeGreaterThan(0);
    expect(canonicalValueString(fixture.planningInput.draft)).toBe(
      canonicalValueString(fixture.rawDraft),
    );
    expect(canonicalValueString(fixture.executionPlanningInput.draft)).toBe(
      canonicalValueString(fixture.rawDraft),
    );
    expect(fixture.executionPlanningInput.draft.pages).toHaveLength(1);
    expect(
      fixture.executionPlanningInput.draft.pages[0]?.sections.map(({ component }) => component),
    ).toEqual(["header", "footer"]);
    expect(fixture.executionPlanningInput.draft.sharedFrame).toBeUndefined();
    expect(fixture.executionPlanningInput.draft.brandSystem.designDna).toBeUndefined();
  });

  it("returns isolated byte-identical aggregates for server and browser consumers", () => {
    const first = createP10B16P03RawKarvonenStudioFixture();
    const second = createP10B16P03RawKarvonenStudioFixture();
    const expected = canonicalValueString(first.aggregate);

    first.aggregate.project.name = "Local mutation";
    first.rawDraft.pages[0].title.en = "Local mutation";

    expect(canonicalValueString(second.aggregate)).toBe(expected);
    expect(second.aggregate.project.name).not.toBe("Local mutation");
    expect(second.rawDraft.pages[0]?.title.en).not.toBe("Local mutation");
  });
});
