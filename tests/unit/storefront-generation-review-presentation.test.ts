import { describe, expect, it } from "vitest";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import {
  presentAssumptions,
  presentCreationAttention,
  presentDiagnostics,
} from "@/components/onboarding/storefront-generation-review-presentation";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";

const createdAt = "2026-07-20T10:00:00.000Z";

function review(overrides: Record<string, unknown> = {}) {
  const brief = normalizeStorefrontDesignBriefInput({
    id: "brief_presentation_test",
    createdAt,
    updatedAt: createdAt,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "North Star Jewellery",
      shortDescription: "Exact merchant copy.",
      industry: "jewellery",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
    ...overrides,
  });
  const plan = generateGuidedStorefront({
    brief,
    projectId: "project_presentation_test",
    snapshotId: "snapshot_presentation_test",
    catalogueRef: "catalogue_presentation_test",
    createdAt,
  });
  return createStorefrontGenerationReview(plan, brief);
}

describe("storefront generation review presentation", () => {
  it("counts explicit blockers once when a blocked section carries the same diagnostic", () => {
    const currentReview = review({ catalogueContext: "existing-vesko-catalogue" });
    const attention = presentCreationAttention(currentReview, "en");

    expect(currentReview.blockers).toHaveLength(1);
    expect(currentReview.sections.find(({ id }) => id === "catalogue")?.status).toBe("blocked");
    expect(attention.blockers).toHaveLength(1);
    expect(attention.blockers[0]?.title).toBe("Connect your catalogue");
    expect(attention.hasUncountedAttention).toBe(false);
  });

  it("represents an incomplete language section without inventing eligibility rules", () => {
    const currentReview = review({ languagePlan: {} });
    const english = presentCreationAttention(currentReview, "en");
    const finnish = presentCreationAttention(currentReview, "fi");

    expect(currentReview.canCreateProject).toBe(false);
    expect(currentReview.blockers).toHaveLength(0);
    expect(english.blockers).toHaveLength(1);
    expect(english.blockers[0]).toMatchObject({
      title: "Choose storefront languages",
      message: "Select at least one storefront language and choose its primary language.",
    });
    expect(finnish.blockers[0]).toMatchObject({
      title: "Valitse verkkokaupan kielet",
      message: "Valitse vähintään yksi verkkokaupan kieli ja määritä sille pääkieli.",
    });
  });

  it("reports no attention items for a creatable review", () => {
    const attention = presentCreationAttention(review(), "en");
    expect(attention).toEqual({ blockers: [], hasUncountedAttention: false });
  });

  it("maps omitted optional sections to distinct merchant notes", () => {
    const diagnostics = presentDiagnostics(review(), "en");
    const notes = diagnostics.notes.map(({ message }) => message);

    expect(notes).toContain("The announcement bar was not added because it was not selected.");
    expect(notes).toContain("The newsletter section was not added because it was not selected.");
    expect(notes).toContain("Product options were not added because they were not requested.");
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("preserves the merchant-copy translation limitation in EN and FI", () => {
    const currentReview = review();
    const withTranslationLimitation = {
      ...currentReview,
      assumptions: [
        ...currentReview.assumptions,
        {
          en: "Merchant-authored copy is applied only in the brief primary locale; no translation is invented.",
          fi: "Merchant-authored copy is applied only in the brief primary locale; no translation is invented.",
        },
      ],
    };
    expect(presentAssumptions(withTranslationLimitation, "en")).toContain(
      "Merchant-provided text is kept in its original language and is not translated automatically.",
    );
    expect(presentAssumptions(withTranslationLimitation, "fi")).toContain(
      "Kauppiaan lisäämä teksti säilytetään alkuperäisellä kielellä, eikä sitä käännetä automaattisesti.",
    );
  });

  it("keeps distinct merchant-relevant limitations distinct", () => {
    const currentReview = review();
    const assumptions = {
      ...currentReview,
      assumptions: [
        {
          en: "Merchant-authored copy is applied only in the brief primary locale; no translation is invented.",
          fi: "Merchant-authored copy is applied only in the brief primary locale; no translation is invented.",
        },
        {
          en: "Localized copy uses a fallback when locale-specific copy is unavailable.",
          fi: "Localized copy uses a fallback when locale-specific copy is unavailable.",
        },
        {
          en: "Campaign copy requires merchant review before publication.",
          fi: "Campaign copy requires merchant review before publication.",
        },
      ],
    };
    const presented = presentAssumptions(assumptions, "en");

    expect(presented).toHaveLength(3);
    expect(new Set(presented).size).toBe(3);
    expect(presented).not.toContain(
      "A safe storefront default was used where no preference was provided.",
    );
    expect(presented).toContain("Campaign copy requires merchant review before publication.");
  });

  it("deduplicates repeated semantic assumptions after mapping", () => {
    const currentReview = review();
    const repeated = {
      ...currentReview,
      assumptions: [currentReview.assumptions[0], currentReview.assumptions[0]],
    };
    expect(presentAssumptions(repeated, "en")).toHaveLength(1);
  });

  it("uses the generic copy only for a genuine harmless default", () => {
    const currentReview = review();
    const harmless = {
      ...currentReview,
      assumptions: [
        {
          en: "A harmless default is used for an optional decorative preference.",
          fi: "A harmless default is used for an optional decorative preference.",
        },
      ],
    };
    expect(presentAssumptions(harmless, "en")).toEqual([
      "A safe storefront default was used where no preference was provided.",
    ]);
  });

  it("sanitizes unknown internal assumption identifiers", () => {
    const currentReview = review();
    const unknown = {
      ...currentReview,
      assumptions: [
        {
          en: "merchant-copy_not/translated",
          fi: "merchant-copy_not/translated",
        },
      ],
    };
    const presented = presentAssumptions(unknown, "en");
    expect(presented).toEqual(["Merchant copy not translated."]);
    expect(presented.join(" ")).not.toContain("merchant-copy_not/translated");
  });
});
