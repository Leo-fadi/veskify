import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { veskifyComponentRegistryV2 } from "@/components/registry/v2-registry";
import {
  resolveResponsiveExecutionAuthority,
  responsiveExecutionDataAttributes,
} from "@/components/storefront/responsive-execution";
import {
  contrastRatio,
  modernTechnicalDesignDna,
  premiumEditorialDesignDna,
  projectDesignDna,
} from "@/domain/design-system";

describe("P10B-17 responsive execution authority", () => {
  it("derives exact breakpoint execution from registered collection anatomy", () => {
    const anatomy = veskifyComponentRegistryV2.get("dynamicCollectionCommerce").commercialAnatomy!;
    const authority = resolveResponsiveExecutionAuthority(anatomy, "editorialDiscovery");

    expect(authority.transformationIds).toEqual([
      "editorialCollectionStack",
      "collectionFilterDisclosure",
    ]);
    expect(authority.mobile).toEqual(authority.transformationIds);
    expect(authority.tablet).toEqual(authority.transformationIds);
    expect(authority.desktop).toEqual([]);
    expect(responsiveExecutionDataAttributes(authority)).toMatchObject({
      "data-responsive-execution": "responsive-execution-v1",
      "data-responsive-mobile": "editorialCollectionStack collectionFilterDisclosure",
      "data-responsive-desktop": "",
    });
  });

  it("fails closed for a variant outside current registered authority", () => {
    const anatomy = veskifyComponentRegistryV2.get("dynamicProductDetail").commercialAnatomy!;
    expect(() => resolveResponsiveExecutionAuthority(anatomy, "invented-mobile-pdp")).toThrow(
      /registered variant/,
    );
  });

  it.each([premiumEditorialDesignDna, modernTechnicalDesignDna])(
    "projects paired focus edges from existing contrast-safe roles",
    (dna) => {
      const variables = projectDesignDna(dna).cssVariables;
      expect(
        contrastRatio(variables["--brand-focus-ring-inner"], variables["--brand-surface-page"]),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(variables["--brand-focus-ring-outer"], variables["--brand-surface-contrast"]),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it("gates support, utility and footer reflow by registered transformation IDs", () => {
    const contentCss = readFileSync("src/components/storefront/content-support.module.css", "utf8");
    const utilityCss = readFileSync(
      "src/components/storefront/commerce-utility.module.css",
      "utf8",
    );
    const frameCss = readFileSync(
      "src/components/storefront/commercial-storefront-frame.module.css",
      "utf8",
    );

    expect(contentCss).toContain('[data-responsive-transformations~="contentStack"] .factGrid');
    expect(contentCss).toContain('[data-responsive-transformations~="contactCondense"]');
    expect(utilityCss).toContain('.cart[data-responsive-transformations~="utilityStack"] .line');
    for (const transformationId of [
      "editorial-footer-stack",
      "service-footer-stack",
      "column-footer-stack",
      "compact-footer-wrap",
    ]) {
      expect(frameCss).toContain(`.footer[data-responsive-transformations~="${transformationId}"]`);
    }
  });
});
