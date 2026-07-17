import { describe, expect, it } from "vitest";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import {
  acceptCurrentDesignProposal,
  canonicalPagesEqual,
  proposalChangeLabels,
  requestDeterministicHomepageProposal,
} from "@/app/projects/[projectId]/editor/deterministic-proposal-requests";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const collection = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "collection")!;
const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: aurumNordicSeed.project.primaryLocale,
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
  pagePathPrefix: "/projects/project_aurum_nordic",
});

function request(value: string) {
  return requestDeterministicHomepageProposal({
    request: value,
    page: homepage,
    context,
    store: new InMemoryDesignProposalStore(),
  });
}

describe("P2-05 deterministic proposal requests", () => {
  it.each([
    ["Make the homepage feel more luxurious.", "luxury"],
    ["Add a campaign section.", "campaign"],
    ["Make the layout more minimal.", "minimal"],
  ] as const)("maps only the supported request %s", (prompt, kind) => {
    const result = request(prompt);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.kind).toBe(kind);
    expect(result.proposal.validation).toEqual({ valid: true, errors: [] });
    expect(result.proposal.originalPage).toEqual(homepage);
    expect(result.proposal.proposedPage).not.toBe(homepage);
  });

  it("adds one deterministic campaign section and preserves required composition", () => {
    const result = request("Add a campaign section.");
    if (result.status !== "ready") throw new Error("Expected a campaign proposal.");
    expect(result.proposal.proposedPage.sections).toHaveLength(homepage.sections.length + 1);
    expect(result.proposal.proposedPage.sections.at(-1)?.component).toBe("footer");
    expect(
      result.proposal.proposedPage.sections.filter((item) => item.component === "header"),
    ).toHaveLength(1);
    expect(
      result.proposal.proposedPage.sections.filter((item) => item.component === "footer"),
    ).toHaveLength(1);
  });

  it("returns a helpful unsupported state without changing the page", () => {
    const before = structuredClone(homepage);
    expect(request("Create arbitrary code")).toEqual({
      status: "unsupported",
      message:
        "That request is not available in this demo yet. Try one of the example requests below.",
    });
    expect(homepage).toEqual(before);
  });

  it("rejects a homepage request on another page as invalid", () => {
    const result = requestDeterministicHomepageProposal({
      request: "Make the homepage feel more luxurious.",
      page: collection,
      context,
      store: new InMemoryDesignProposalStore(),
    });
    expect(result.status).toBe("invalid");
    expect(collection).toEqual(
      aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "collection"),
    );
  });

  it("preserves protected catalogue fields and unrelated pages", () => {
    const catalogueBefore = structuredClone(aurumNordicSeed.catalogue);
    const pagesBefore = structuredClone(aurumNordicSeed.draftSnapshot.pages);
    const result = request("Make the homepage feel more luxurious.");
    expect(result.status).toBe("ready");
    expect(aurumNordicSeed.catalogue).toEqual(catalogueBefore);
    expect(aurumNordicSeed.draftSnapshot.pages).toEqual(pagesBefore);
    for (const product of aurumNordicSeed.catalogue.products) {
      const protectedBefore = catalogueBefore.products.find((item) => item.id === product.id)!;
      expect({
        id: product.id,
        sku: product.sku,
        price: product.price,
        stockStatus: product.stockStatus,
        images: product.images,
      }).toEqual({
        id: protectedBefore.id,
        sku: protectedBefore.sku,
        price: protectedBefore.price,
        stockStatus: protectedBefore.stockStatus,
        images: protectedBefore.images,
      });
    }
  });

  it("provides ordered English and Finnish change labels", () => {
    const result = request("Add a campaign section.");
    if (result.status !== "ready") throw new Error("Expected a campaign proposal.");
    expect(result.proposal.summary.en).toContain("campaign section");
    expect(result.proposal.summary.fi).toContain("kampanjaosio");
    expect(proposalChangeLabels(result.proposal, "en")[0]).toBe("Add a campaign section");
    expect(proposalChangeLabels(result.proposal, "fi")[0]).toBe("Lisää kampanjaosio");
  });

  it("uses canonical value equality rather than object identity or property order", () => {
    const clone = structuredClone(homepage);
    const reorderedTitle = { fi: clone.title.fi, en: clone.title.en };
    clone.title = reorderedTitle;
    expect(clone).not.toBe(homepage);
    expect(canonicalPagesEqual(clone, homepage)).toBe(true);
    clone.title.en = "A newer canonical edit";
    expect(canonicalPagesEqual(clone, homepage)).toBe(false);
  });

  it("defensively rejects stale acceptance without consuming or applying the proposal", () => {
    const store = new InMemoryDesignProposalStore();
    const result = requestDeterministicHomepageProposal({
      request: "Make the homepage feel more luxurious.",
      page: homepage,
      context,
      store,
    });
    if (result.status !== "ready") throw new Error("Expected a luxury proposal.");
    const newerPage = structuredClone(homepage);
    newerPage.title.en = "A newer canonical edit";
    const before = structuredClone(newerPage);

    expect(
      acceptCurrentDesignProposal({
        currentPage: newerPage,
        proposal: result.proposal,
        store,
      }),
    ).toEqual({ status: "stale" });
    expect(newerPage).toEqual(before);
    expect(store.inspect(result.proposal.id).status).toBe("pending");
  });
});
