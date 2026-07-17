import { describe, expect, it } from "vitest";
import {
  createLuxuryCampaignHomepageProposal,
  InMemoryDesignProposalStore,
} from "@/application/design-operations";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});
const campaign = homepage.sections.find((section) => section.component === "campaignBanner")!;

describe("in-memory deterministic design proposal lifecycle", () => {
  it("creates and inspects a validated bilingual proposal without leaking mutable state", () => {
    const store = new InMemoryDesignProposalStore();
    const proposal = store.create({
      originalPage: homepage,
      operations: [
        {
          type: "CHANGE_SECTION_VARIANT",
          sectionId: campaign.id,
          variant: "minimal",
        },
      ],
      context,
    });
    expect(proposal.id).toMatch(/^proposal_[a-f0-9]{8}$/);
    expect(proposal.validation).toEqual({ valid: true, errors: [] });
    expect(proposal.summary.en).toContain("1 deterministic design changes");
    expect(proposal.summary.fi).toContain("1 determinististä designmuutosta");
    proposal.proposedPage.sections.length = 0;
    expect(store.inspect(proposal.id).proposedPage.sections).not.toHaveLength(0);
  });

  it("never overwrites an existing lifecycle record with the same deterministic ID", () => {
    const store = new InMemoryDesignProposalStore();
    const input = {
      originalPage: homepage,
      operations: [{ type: "CHANGE_BACKGROUND", sectionId: campaign.id, background: "accent" }],
      context,
      identity: "session_same:attempt:1",
    } as const;
    const first = store.create(input);
    expect(() => store.create(input)).toThrow(/Duplicate design proposal ID/);
    expect(store.inspect(first.id)).toEqual(first);
  });

  it("accepts the validated proposed page", () => {
    const store = new InMemoryDesignProposalStore();
    const proposal = store.create({
      originalPage: homepage,
      operations: [{ type: "CHANGE_BACKGROUND", sectionId: campaign.id, background: "accent" }],
      context,
    });
    const accepted = store.accept(proposal.id);
    expect(accepted.sections.find((section) => section.id === campaign.id)!.props.background).toBe(
      "accent",
    );
    expect(store.inspect(proposal.id).status).toBe("accepted");
    expect(() => store.accept(proposal.id)).toThrow(/already accepted/);
  });

  it("rejects to an unchanged clone of the original page", () => {
    const store = new InMemoryDesignProposalStore();
    const before = structuredClone(homepage);
    const proposal = store.create({
      originalPage: homepage,
      operations: [{ type: "CHANGE_DENSITY", sectionId: campaign.id, density: "compact" }],
      context,
    });
    const rejected = store.reject(proposal.id);
    expect(rejected).toEqual(before);
    expect(rejected).not.toBe(homepage);
    expect(homepage).toEqual(before);
    expect(store.inspect(proposal.id).status).toBe("rejected");
  });

  it("rejects invalid operation payloads and protected commerce edits before storage", () => {
    const store = new InMemoryDesignProposalStore();
    expect(() =>
      store.create({
        originalPage: homepage,
        operations: [{ type: "CHANGE_BACKGROUND", sectionId: campaign.id, background: "neon" }],
        context,
      }),
    ).toThrow();
    const grid = homepage.sections.find((section) => section.component === "productGrid")!;
    expect(() =>
      store.create({
        originalPage: homepage,
        operations: [
          {
            type: "CHANGE_LOCALIZED_SECTION_TEXT",
            sectionId: grid.id,
            field: "productIds",
            locale: "en",
            value: "product_fake",
          },
        ],
        context,
      }),
    ).toThrow(/not approved localized/);
  });

  it("creates the deterministic luxury campaign command example", () => {
    const first = createLuxuryCampaignHomepageProposal(homepage, context);
    const second = createLuxuryCampaignHomepageProposal(homepage, context);
    expect(first).toEqual(second);
    expect(first.summary).toEqual({
      en: "Make the homepage feel more luxurious and add a campaign section.",
      fi: "Tee etusivusta ylellisempi ja lisää kampanjaosio.",
    });
    expect(first.operations).toContainEqual(
      expect.objectContaining({
        type: "ADD_APPROVED_SECTION",
        component: "campaignBanner",
        variant: "imageOverlay",
      }),
    );
    const added = first.proposedPage.sections.find(
      (section) => section.id === "section_home_campaign_luxury_proposal",
    )!;
    expect(added.variant).toBe("imageOverlay");
    expect(added.props).toMatchObject({
      background: "secondary",
      typography: "serif",
      density: "spacious",
      shape: "soft",
      alignment: "center",
      ctaPresentation: "secondary",
    });
  });
});
