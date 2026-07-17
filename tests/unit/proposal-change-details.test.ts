import { describe, expect, it } from "vitest";
import {
  createDeterministicDesignProvider,
  type DesignPlannerInput,
} from "@/application/design-skills";
import { proposalChangeDetails } from "@/app/projects/[projectId]/editor/proposal-change-details";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const displayContext = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

function input(merchantRequest: string): DesignPlannerInput {
  return {
    merchantRequest,
    activeLocale: "en",
    page: structuredClone(homepage),
    pageType: "home",
    brandSystem: structuredClone(aurumNordicSeed.draftSnapshot.brandSystem),
    displayContext: structuredClone(displayContext),
  };
}

describe("merchant proposal change details", () => {
  it("describes every operation in a multi-operation proposal with concrete values", () => {
    const proposal = createDeterministicDesignProvider().propose(
      input("Make the homepage feel more luxurious."),
    ).proposal;
    if (!proposal) throw new Error("Expected a luxury proposal.");

    const details = proposalChangeDetails(proposal, "en", "en");

    expect(details).toHaveLength(proposal.operations.length);
    expect(details.length).toBeGreaterThan(1);
    expect(details.join(" ")).toMatch(/background|typography|spacing|layout/i);
    expect(details.join(" ")).not.toMatch(/CHANGE_|APPLY_|section_home_/);
  });

  it("localizes campaign section and content details into Finnish", () => {
    const proposal = createDeterministicDesignProvider().propose(
      input("Add a campaign section."),
    ).proposal;
    if (!proposal) throw new Error("Expected a campaign proposal.");

    const details = proposalChangeDetails(proposal, "fi", "en");

    expect(details).toHaveLength(3);
    expect(details[0]).toMatch(/^Lisää osio/);
    expect(details[1]).toMatch(/^Päivitä osio/);
    expect(details[2]).toMatch(/^Päivitä osio/);
    expect(details.join(" ")).not.toMatch(/ADD_APPROVED|CHANGE_LOCALIZED/);
  });
});
