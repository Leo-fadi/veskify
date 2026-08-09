import { describe, expect, it } from "vitest";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { homepageFeaturedProductsPropsSchema } from "@/components/registry";
import { dynamicCollectionCommercePropsSchema } from "@/components/registry/dynamic-collection-commerce";
import {
  canonicalProductCardAuthority,
  requireCanonicalProductCardAnatomy,
} from "@/domain/product-card";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  p905aCurrentEvidenceReferences,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";

describe("P10B-08 product-card generation and publication reachability", () => {
  it("preserves canonical card selection through plan, proposal, snapshot, save/reload and publish", async () => {
    const generated = await generateP905aScenario("modernTechnical");
    const anatomyId = generated.plan.designSystemSelection.collectionPresentation.cardVariant;
    expect(anatomyId).toBe("compact");
    expect(requireCanonicalProductCardAnatomy(anatomyId, "collectionResults").id).toBe(anatomyId);

    const plannedHomepage = generated.plan.pagePlans
      .flatMap(({ components }) => components)
      .find(
        (component) =>
          "instance" in component && component.instance.component === "homepageFeaturedProducts",
      );
    if (!plannedHomepage || !("instance" in plannedHomepage)) {
      throw new Error("The generated homepage product-card selection is missing.");
    }
    expect(
      homepageFeaturedProductsPropsSchema.parse(plannedHomepage.instance.props).cardVariant,
    ).toBe(anatomyId);

    const proposed = generated.compiledProposal.proposedStorefront;
    const proposedHomeCard = proposed.pages
      .flatMap(({ components }) => components)
      .find(({ component }) => component === "homepageFeaturedProducts");
    const proposedCollectionCard = proposed.pages
      .flatMap(({ components }) => components)
      .find(({ component }) => component === "dynamicCollectionCommerce");
    expect(homepageFeaturedProductsPropsSchema.parse(proposedHomeCard?.props).cardVariant).toBe(
      anatomyId,
    );
    expect(
      dynamicCollectionCommercePropsSchema.parse(proposedCollectionCard?.props).cardVariant,
    ).toBe(anatomyId);

    const accepted = createP905aAcceptanceCoordinator(generated).accept();
    if (accepted.state !== "accepted") throw new Error("Product-card proposal was not accepted.");
    const saved = await saveAndResolveP905aPreview({
      generated,
      accepted: accepted.activeDraft,
    });
    const reloadedHomeCard = saved.preview.pages
      .flatMap(({ sections }) => sections)
      .find(({ component }) => component === "homepageFeaturedProducts");
    const reloadedCollectionCard = saved.preview.pages
      .flatMap(({ sections }) => sections)
      .find(({ component }) => component === "dynamicCollectionCommerce");
    expect(homepageFeaturedProductsPropsSchema.parse(reloadedHomeCard?.props).cardVariant).toBe(
      anatomyId,
    );
    expect(
      dynamicCollectionCommercePropsSchema.parse(reloadedCollectionCard?.props).cardVariant,
    ).toBe(anatomyId);

    const compilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: saved.saved.aggregate,
        snapshot: saved.preview,
        sourceAuthority: { kind: "manual" },
        currentEvidenceReferences: p905aCurrentEvidenceReferences(generated),
      }),
    );
    expect(compilation.receipt.productCardAuthorityFingerprint).toBe(
      canonicalProductCardAuthority.fingerprint,
    );
    expect(
      dynamicCollectionCommercePropsSchema.parse(
        compilation.result.pages
          .flatMap(({ page }) => page.sections)
          .find(({ component }) => component === "dynamicCollectionCommerce")?.props,
      ).cardVariant,
    ).toBe(anatomyId);
    const staleInput = createCurrentPublishCompilerInput({
      aggregate: saved.saved.aggregate,
      snapshot: saved.preview,
      sourceAuthority: { kind: "manual" },
      currentEvidenceReferences: p905aCurrentEvidenceReferences(generated),
    });
    staleInput.authority.productCardAuthorityFingerprint = "stale-product-card-authority";
    expect(() => compileStorefrontPublication(staleInput)).toThrow(
      expect.objectContaining({ code: "stale-product-card-authority" }),
    );
  }, 30_000);
});
