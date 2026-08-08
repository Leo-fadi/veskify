import { describe, expect, it } from "vitest";
import {
  materializeStorefrontSiteMap,
  type SiteMapMaterializationError,
  type StorefrontSiteMapDecision,
} from "@/application/storefront-site-map";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import {
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import { validateRegisteredSnapshot, veskifyComponentDefinitionsV2 } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import {
  canonicalStorefrontSiteMapFingerprint,
  canonicalValueString,
  listPageFamilyDefinitions,
  type PageFamilyValidationError,
  validateCanonicalStorefrontSiteMap,
  validatePageFamilyRegistry,
  type PageFamilyId,
} from "@/domain/storefront";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const localized = (en: string, fi: string) => ({ en, fi });
const evidence = [
  {
    source: "merchant-approved" as const,
    authorityId: "approved_facts_1",
    revision: "1",
    status: "approved" as const,
  },
];

const profileByFamily: Readonly<Record<PageFamilyId, string>> = {
  home: "blueprint-site-map-home-baseline",
  collection: "blueprint-site-map-collection-baseline",
  "search-results": "blueprint-site-map-search-baseline",
  "product-detail": "blueprint-site-map-product-baseline",
  about: "blueprint-site-map-content-baseline",
  contact: "blueprint-site-map-content-baseline",
  "store-locations": "blueprint-site-map-content-baseline",
  faq: "blueprint-site-map-content-baseline",
  "shipping-information": "blueprint-site-map-content-baseline",
  "returns-information": "blueprint-site-map-content-baseline",
  "policy-legal": "blueprint-site-map-content-baseline",
  "generic-content": "blueprint-site-map-content-baseline",
  "campaign-editorial": "blueprint-site-map-campaign-baseline",
  cart: "blueprint-site-map-cart-baseline",
  checkout: "blueprint-site-map-checkout-baseline",
  "no-results": "blueprint-site-map-state-baseline",
  "empty-state": "blueprint-site-map-state-baseline",
  "error-state": "blueprint-site-map-state-baseline",
  "not-found": "blueprint-site-map-state-baseline",
};

const routeByFamily: Readonly<Record<PageFamilyId, string>> = {
  home: "/",
  collection: "/collections/rings",
  "search-results": "/search",
  "product-detail": "/products/aurora-ring-585",
  about: "/pages/about",
  contact: "/pages/contact",
  "store-locations": "/pages/locations",
  faq: "/pages/faq",
  "shipping-information": "/pages/shipping",
  "returns-information": "/pages/returns",
  "policy-legal": "/pages/privacy",
  "generic-content": "/pages/journal",
  "campaign-editorial": "/campaigns/summer",
  cart: "/cart",
  checkout: "/checkout",
  "no-results": "/states/no-results",
  "empty-state": "/states/empty",
  "error-state": "/states/error",
  "not-found": "/404",
};

const titles: Readonly<Record<PageFamilyId, readonly [string, string]>> = {
  home: ["Home", "Etusivu"],
  collection: ["Rings", "Sormukset"],
  "search-results": ["Search", "Haku"],
  "product-detail": ["Aurora Ring", "Aurora-sormus"],
  about: ["About", "Tietoa meistä"],
  contact: ["Contact", "Yhteystiedot"],
  "store-locations": ["Locations", "Myymälät"],
  faq: ["FAQ", "Usein kysyttyä"],
  "shipping-information": ["Shipping", "Toimitus"],
  "returns-information": ["Returns", "Palautukset"],
  "policy-legal": ["Privacy", "Tietosuoja"],
  "generic-content": ["Journal", "Julkaisut"],
  "campaign-editorial": ["Summer edit", "Kesän valinnat"],
  cart: ["Cart", "Ostoskori"],
  checkout: ["Checkout", "Kassa"],
  "no-results": ["No results", "Ei tuloksia"],
  "empty-state": ["Nothing here yet", "Ei vielä sisältöä"],
  "error-state": ["Something went wrong", "Jokin meni vikaan"],
  "not-found": ["Page not found", "Sivua ei löytynyt"],
};

function commerceContext(familyId: PageFamilyId) {
  if (familyId === "collection") {
    return { kind: "collection" as const, collectionId: "collection_rings" };
  }
  if (familyId === "product-detail") {
    return { kind: "product" as const, productId: "product_aurora_ring_585" };
  }
  if (familyId === "search-results") return { kind: "search" as const };
  return { kind: "none" as const };
}

function decision(): StorefrontSiteMapDecision {
  const definitions = listPageFamilyDefinitions();
  return {
    schemaVersion: 1,
    projectId: aurumNordicSeed.project.id,
    localeCoverage: ["en", "fi"],
    sharedFrame: { id: "blueprint-shared-storefront-frame", version: "1.0.0" },
    pages: definitions.map((definition, index) => {
      const [en, fi] = titles[definition.id];
      const navigation =
        definition.id === "home"
          ? [{ area: "primary" as const, order: 0, label: localized(en, fi) }]
          : definition.id === "collection"
            ? [{ area: "primary" as const, order: 1, label: localized(en, fi) }]
            : definition.id === "search-results"
              ? [{ area: "primary" as const, order: 2, label: localized(en, fi) }]
              : definition.id === "campaign-editorial"
                ? [{ area: "primary" as const, order: 3, label: localized(en, fi) }]
                : definition.id === "product-detail" ||
                    [
                      "about",
                      "contact",
                      "faq",
                      "shipping-information",
                      "returns-information",
                      "policy-legal",
                    ].includes(definition.id)
                  ? [{ area: "footer" as const, order: index, label: localized(en, fi) }]
                  : [];
      const existingPageId =
        definition.id === "home"
          ? "page_home"
          : definition.id === "collection"
            ? "page_collection_rings"
            : definition.id === "product-detail"
              ? "page_product_aurora"
              : undefined;
      const parentKey =
        definition.id === "store-locations"
          ? "contact"
          : definition.id === "generic-content"
            ? "about"
            : undefined;
      return {
        key: definition.id,
        familyId: definition.id,
        familyVersion: "1.0.0",
        route: routeByFamily[definition.id],
        required: true,
        profile: { id: profileByFamily[definition.id], version: "1.0.0" },
        localeCoverage: ["en", "fi"],
        title: localized(en, fi),
        seo: {
          title: localized(en, fi),
          metaDescription: localized(`${en} information.`, `${fi} — lisätiedot.`),
        },
        commerceContext: commerceContext(definition.id),
        navigation,
        ...(parentKey ? { parentKey } : {}),
        ...(existingPageId ? { existingPageId } : {}),
        evidenceReferences:
          definition.evidenceRequirement === "approved-facts" ? structuredClone(evidence) : [],
      };
    }),
  };
}

function materialize(input = decision()) {
  return materializeStorefrontSiteMap({
    decision: input,
    baseSnapshot: structuredClone(aurumNordicSeed.draftSnapshot),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
  });
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected the action to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as SiteMapMaterializationError | PageFamilyValidationError).code).toBe(code);
  }
}

describe("P10B-05 site-map and page-family authority", () => {
  it("registers every required family with deterministic versioned authority", () => {
    const first = validatePageFamilyRegistry();
    const second = validatePageFamilyRegistry();
    expect(first.map(({ id }) => id)).toEqual(Object.keys(profileByFamily));
    expect(first).toHaveLength(19);
    expect(first.every(({ version }) => version === "1.0.0")).toBe(true);
    expect(canonicalValueString(first)).toBe(canonicalValueString(second));
  });

  it("materializes every minimum page-family PageBlueprint through live authority", () => {
    for (const profileId of new Set(Object.values(profileByFamily))) {
      const pagePlan = getExecutablePageBlueprintProfile(profileId)!;
      const result = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: [],
      });
      expect(result.profileId).toBe(profileId);
      expect(result.profileVersion).toBe("1.0.0");
      expect(result.slots).toEqual([]);
    }
  });

  it("materializes a complete canonical page set with routes, navigation, parents, locales and shared frame", () => {
    const result = materialize();
    expect(result.snapshot.pages).toHaveLength(19);
    expect(result.omittedPages).toEqual([]);
    expect(result.snapshot.pages.map((page) => page.pageFamily!.familyId)).toEqual(
      listPageFamilyDefinitions().map(({ id }) => id),
    );
    expect(result.snapshot.pages.find((page) => page.pageFamily!.familyId === "home")?.slug).toBe(
      "/",
    );
    expect(
      result.snapshot.pages.find((page) => page.pageFamily!.familyId === "store-locations")
        ?.pageFamily?.parentPageId,
    ).toBe(result.snapshot.pages.find((page) => page.pageFamily!.familyId === "contact")?.id);
    expect(() =>
      validateCanonicalStorefrontSiteMap(result.snapshot, {
        catalogue: aurumNordicSeed.catalogue,
        enabledLocales: ["en", "fi"],
      }),
    ).not.toThrow();
  });

  it("is deterministic and does not mutate its decision or base snapshot", () => {
    const input = decision();
    const base = structuredClone(aurumNordicSeed.draftSnapshot);
    const beforeInput = structuredClone(input);
    const beforeBase = structuredClone(base);
    const first = materializeStorefrontSiteMap({
      decision: input,
      baseSnapshot: base,
      catalogue: aurumNordicSeed.catalogue,
    });
    const second = materializeStorefrontSiteMap({
      decision: structuredClone(input),
      baseSnapshot: structuredClone(base),
      catalogue: aurumNordicSeed.catalogue,
    });
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toBe(canonicalStorefrontSiteMapFingerprint(first.snapshot));
    expect(input).toEqual(beforeInput);
    expect(base).toEqual(beforeBase);
  });

  it("preserves existing home, collection and PDP composition and protected commerce bindings", () => {
    const result = materialize();
    for (const pageId of ["page_home", "page_collection_rings", "page_product_aurora"]) {
      expect(result.snapshot.pages.find(({ id }) => id === pageId)?.sections).toEqual(
        aurumNordicSeed.draftSnapshot.pages.find(({ id }) => id === pageId)?.sections,
      );
    }
    const collection = result.snapshot.pages.find(({ id }) => id === "page_collection_rings")!;
    const product = result.snapshot.pages.find(({ id }) => id === "page_product_aurora")!;
    expect(collection.pageFamily?.commerceContext).toEqual({
      kind: "collection",
      collectionId: "collection_rings",
    });
    expect(product.pageFamily?.commerceContext).toEqual({
      kind: "product",
      productId: "product_aurora_ring_585",
    });
  });

  it("enforces duplicate routes, homepage/root uniqueness and canonical namespaces", () => {
    const duplicateRoute = decision();
    duplicateRoute.pages[1].route = "/";
    expectCode(() => materialize(duplicateRoute), "duplicate-route");

    const withoutHome = decision();
    withoutHome.pages = withoutHome.pages.filter(({ familyId }) => familyId !== "home");
    expectCode(() => materialize(withoutHome), "missing-homepage");

    const duplicateHome = structuredClone(materialize().snapshot);
    duplicateHome.pages.push({
      ...structuredClone(duplicateHome.pages[0]),
      id: "page_duplicate_home",
    });
    expectCode(() => validateCanonicalStorefrontSiteMap(duplicateHome), "duplicate-homepage");

    const namespace = decision();
    namespace.pages.find(({ familyId }) => familyId === "generic-content")!.route =
      "/products/not-content";
    expectCode(() => materialize(namespace), "conflicting-route-namespace");

    const mismatch = decision();
    mismatch.pages.find(({ familyId }) => familyId === "collection")!.route =
      "/collections/rings/more";
    expectCode(() => materialize(mismatch), "route-family-mismatch");
  });

  it("rejects unsafe routes and unsupported page families", () => {
    const unsafe = decision();
    unsafe.pages[1].route = "https://example.test/collections/rings";
    expectCode(() => materialize(unsafe), "unsafe-route");

    const unknown = decision() as unknown as { pages: Array<Record<string, unknown>> };
    unknown.pages[1].familyId = "generated-page";
    expectCode(() => materialize(unknown as never), "unsupported-page-family");
  });

  it("rejects orphan navigation, missing targets and invalid parent relationships", () => {
    const orphan = structuredClone(materialize().snapshot);
    orphan.navigation.primary = orphan.navigation.primary.filter(
      (item) => item.target.type !== "page" || item.target.pageId !== "page_home",
    );
    expectCode(() => validateCanonicalStorefrontSiteMap(orphan), "orphan-navigation");

    const missingTarget = structuredClone(materialize().snapshot);
    missingTarget.navigation.primary[0].target = {
      type: "page",
      pageId: "page_missing_target",
    };
    expectCode(
      () => validateCanonicalStorefrontSiteMap(missingTarget),
      "navigation-target-missing",
    );

    const invalidParent = decision();
    invalidParent.pages.find(({ familyId }) => familyId === "store-locations")!.parentKey =
      "missing_parent";
    expectCode(() => materialize(invalidParent), "invalid-parent");
  });

  it("requires valid collection/product contexts and preserves utility presentation-only authority", () => {
    const collection = decision();
    collection.pages.find(({ familyId }) => familyId === "collection")!.commerceContext = {
      kind: "none",
    };
    expectCode(() => materialize(collection), "invalid-commerce-context");

    const product = decision();
    product.pages.find(({ familyId }) => familyId === "product-detail")!.commerceContext = {
      kind: "none",
    };
    expectCode(() => materialize(product), "invalid-commerce-context");

    const utility = structuredClone(materialize().snapshot);
    utility.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "checkout",
    )!.pageFamily!.commerceOperationAuthority = "read-only-presentation";
    expectCode(() => validateCanonicalStorefrontSiteMap(utility), "commerce-authority-violation");
  });

  it("omits unsupported optional factual pages and fails required ones", () => {
    const optional = decision();
    const optionalShipping = optional.pages.find(
      ({ familyId }) => familyId === "shipping-information",
    )!;
    optionalShipping.required = false;
    optionalShipping.evidenceReferences = [];
    const omitted = materialize(optional);
    expect(omitted.omittedPages).toEqual([
      {
        key: "shipping-information",
        familyId: "shipping-information",
        reason: "missing-approved-evidence",
      },
    ]);
    expect(
      omitted.snapshot.pages.some(
        ({ pageFamily }) => pageFamily?.familyId === "shipping-information",
      ),
    ).toBe(false);

    const required = decision();
    required.pages.find(({ familyId }) => familyId === "returns-information")!.evidenceReferences =
      [];
    expectCode(() => materialize(required), "missing-evidence");
  });

  it("rejects incomplete EN/FI coverage and stale profile references", () => {
    const locale = decision();
    locale.pages.find(({ familyId }) => familyId === "faq")!.title = { en: "FAQ" };
    expectCode(() => materialize(locale), "invalid-locale-coverage");

    const stale = decision();
    stale.pages.find(({ familyId }) => familyId === "faq")!.profile.version = "2.0.0";
    expectCode(() => materialize(stale), "stale-profile-reference");
  });

  it("survives repository save/reload and deterministic compile/publish projection", async () => {
    const result = materialize();
    const aggregate: ProjectAggregate = {
      project: structuredClone(aurumNordicSeed.project),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      snapshots: [
        structuredClone(aurumNordicSeed.publishedSnapshot),
        structuredClone(aurumNordicSeed.draftSnapshot),
      ],
    };
    const repository = new InMemoryProjectRepository([aggregate]);
    await repository.saveDraft(result.snapshot.projectId, result.snapshot, {
      id: aurumNordicSeed.draftSnapshot.id,
      revision: aurumNordicSeed.draftSnapshot.revision,
    });
    const reloaded = await repository.get(result.snapshot.projectId);
    const draft = reloaded.snapshots.find(({ id }) => id === reloaded.project.draftSnapshotId)!;
    expect(draft).toEqual(result.snapshot);

    const compilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: reloaded,
        snapshot: draft,
        sourceAuthority: { kind: "manual" },
      }),
    );
    expect(compilation.result.pages.map(({ page }) => page)).toEqual(result.snapshot.pages);
    expect(compilation.result.sharedFrame.navigation).toEqual(result.snapshot.navigation);
    expect(compilation.result.rendererTarget).toBe("published");
  });

  it("keeps legacy P10A home/collection/PDP snapshots valid without implicit migration", () => {
    const legacy = structuredClone(aurumNordicSeed.draftSnapshot);
    expect(legacy.pages.every((page) => page.pageFamily === undefined)).toBe(true);
    expect(validateRegisteredSnapshot(legacy, aurumNordicSeed.catalogue, "en", "en")).toEqual(
      legacy,
    );
  });
});
