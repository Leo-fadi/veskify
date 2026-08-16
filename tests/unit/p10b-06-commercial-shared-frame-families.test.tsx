import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  compileCommercialSharedFrameProposal,
  compileCommercialSharedFrameSelection,
  createCommercialSharedFrameProposal,
  currentCommercialSharedFrameSelection,
} from "@/application/commercial-shared-frame";
import { confirmPublish, preparePublish } from "@/application/publishing";
import {
  compiledPublicationResultSchema,
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing/publish-compiler";
import {
  createStorefrontRenderContext,
  validateRegisteredSnapshot,
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import { validateComponentDefinitionV2 } from "@/domain/component-platform";
import { brandSystemToCssVariables } from "@/domain/design-system";
import {
  CommercialSharedFrameError,
  canonicalStorefrontContentFingerprint,
  commercialSharedFrameProfiles,
  validateCommercialSharedFrameSnapshot,
} from "@/domain/storefront";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";
import { renderPuckCanvasRoot } from "@/integrations/puck/config";

function compile(profileId: (typeof commercialSharedFrameProfiles)[number]["id"]) {
  return compileCommercialSharedFrameSelection({
    snapshot: aurumNordicSeed.draftSnapshot,
    catalogue: aurumNordicSeed.catalogue,
    selection: currentCommercialSharedFrameSelection(profileId),
  });
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof CommercialSharedFrameError) return error.code;
    throw error;
  }
  throw new Error("Expected shared-frame validation to fail.");
}

function emptyPage(
  source: (typeof aurumNordicSeed.draftSnapshot.pages)[number],
  input: { id: string; slug: string; type: "collection" | "content" | "cart" },
) {
  return {
    ...structuredClone(source),
    ...input,
    title: { en: input.type === "cart" ? "Cart" : "About" },
    seo: {
      title: { en: input.type === "cart" ? "Cart" : "About" },
      metaDescription: { en: "Canonical page presentation." },
    },
    sections: [],
  };
}

describe("P10B-06 commercial shared-frame families", () => {
  it("registers four structurally distinct complete frames, three mobile modes and four footers", () => {
    expect(commercialSharedFrameProfiles).toHaveLength(4);
    expect(new Set(commercialSharedFrameProfiles.map(({ id }) => id)).size).toBe(4);
    expect(
      new Set(
        commercialSharedFrameProfiles.map((profile) =>
          JSON.stringify({
            desktop: profile.desktopComposition,
            header: profile.headerVariant,
            footer: profile.footerVariant,
            mobile: profile.mobileNavigationMode,
            footerComposition: profile.footerComposition,
            regions: profile.semanticRegions,
          }),
        ),
      ).size,
    ).toBe(4);
    expect(
      new Set(
        commercialSharedFrameProfiles.map(({ mobileNavigationMode }) => mobileNavigationMode),
      ),
    ).toEqual(new Set(["drawer", "stacked-disclosure", "compact-overlay"]));
    expect(
      new Set(commercialSharedFrameProfiles.map(({ footerComposition }) => footerComposition)).size,
    ).toBe(4);

    const footerRegionOrders = commercialSharedFrameProfiles.map((profile) => {
      const result = compile(profile.id);
      const context = createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue: aurumNordicSeed.catalogue,
        snapshot: result.snapshot,
      });
      const markup = renderToStaticMarkup(
        renderStorefrontPage(
          result.snapshot.pages.find(({ type }) => type === "home")!,
          context,
        ),
      );
      return ["footer-brand", "footer-store-pages", "footer-information"]
        .map((region) => ({ region, index: markup.indexOf(`data-frame-region="${region}"`) }))
        .filter(({ index }) => index >= 0)
        .sort((left, right) => left.index - right.index)
        .map(({ region }) => region)
        .join(">");
    });
    expect(new Set(footerRegionOrders).size).toBe(4);
  });

  it("promotes exactly four meaningful header and footer anatomies to commercial-ready queries", () => {
    for (const profile of commercialSharedFrameProfiles) {
      const header = veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
        componentType: "header",
        variant: profile.headerVariant,
        expectedAnatomyIdentity: "header.commercialSharedFrameAnatomy",
        requireMeaningful: true,
      });
      const footer = veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
        componentType: "footer",
        variant: profile.footerVariant,
        expectedAnatomyIdentity: "footer.commercialSharedFrameAnatomy",
        requireMeaningful: true,
      });
      expect(header.variant.structuralClassification).toBe("meaningfulStructuralVariant");
      expect(footer.variant.structuralClassification).toBe("meaningfulStructuralVariant");
    }
  });

  it("materializes one canonical frame identity across every page without page-local chrome", () => {
    for (const profile of commercialSharedFrameProfiles) {
      const result = compile(profile.id);
      expect(result.snapshot.sharedFrame).toMatchObject({
        profileId: profile.id,
        profileVersion: profile.version,
        authorityFingerprint: profile.authorityFingerprint,
        header: { variant: profile.headerVariant },
        footer: { variant: profile.footerVariant },
      });
      expect(
        result.snapshot.pages.every((page) =>
          page.sections.every(
            (section) => !["announcementBar", "header", "footer"].includes(section.component),
          ),
        ),
      ).toBe(true);
      expect(result.snapshot.navigation).toEqual(aurumNordicSeed.draftSnapshot.navigation);
    }
  });

  it("renders the same frame authority for editor, preview and published targets", () => {
    const result = compile("commerce-utility");
    const homepage = result.snapshot.pages.find(({ type }) => type === "home")!;
    for (const target of ["editor", "preview", "published"] as const) {
      const context = createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue: aurumNordicSeed.catalogue,
        snapshot: result.snapshot,
        renderTarget: target,
      });
      const markup = renderToStaticMarkup(renderStorefrontPage(homepage, context));
      expect(markup).toContain('data-frame-profile="commerce-utility"');
      expect(markup).toContain('data-mobile-navigation-mode="stacked-disclosure"');
      expect(markup).toContain('data-footer-composition="service-navigation"');
    }

    const editorContext = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: result.snapshot,
      renderTarget: "editor",
    });
    const editorMarkup = renderToStaticMarkup(
      renderPuckCanvasRoot({
        children: <div data-editor-page-content={homepage.id} />,
        context: editorContext,
        brandSystem: result.snapshot.brandSystem,
      }),
    );
    expect(editorMarkup).toContain('data-veskify-canvas-root="true"');
    expect(editorMarkup).toContain('data-frame-profile="commerce-utility"');
  });

  it("uses exact enabled-locale authority and delegates switching to the host", () => {
    const result = compile("editorial-masthead");
    expect(result.snapshot.pages.every((page) => page.pageFamily === undefined)).toBe(true);
    const onLocaleChange = vi.fn();
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      onLocaleChange,
      catalogue: aurumNordicSeed.catalogue,
      snapshot: result.snapshot,
    });
    const homepage = result.snapshot.pages.find(({ type }) => type === "home")!;
    render(renderStorefrontPage(homepage, context));

    expect(screen.getAllByRole("button", { name: "FI" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "FI" })[0]);
    expect(onLocaleChange).toHaveBeenCalledOnce();
    expect(onLocaleChange).toHaveBeenCalledWith("fi");
    cleanup();
  });

  it("binds skip and current-page semantics from server-owned page authority", () => {
    const result = compile("editorial-masthead");
    const navigationItem = result.snapshot.navigation.primary.find(
      (item) => item.target.type === "page",
    );
    if (!navigationItem || navigationItem.target.type !== "page") {
      throw new Error("The frame fixture requires one canonical page navigation item.");
    }
    const currentPageId = navigationItem.target.pageId;
    const currentPage = result.snapshot.pages.find((page) => page.id === currentPageId);
    if (!currentPage) {
      throw new Error("The canonical navigation target must resolve to a snapshot page.");
    }
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: result.snapshot,
    });
    const markup = renderToStaticMarkup(renderStorefrontPage(currentPage, context));

    expect(markup).toContain('href="#storefront-main-content"');
    expect(markup).toContain('<main id="storefront-main-content" tabindex="-1">');
    expect(markup).toContain(`aria-current="page" href="${context.pagePaths[currentPage.id]}"`);
  });

  it("makes the page and non-dialog header regions inert while a modal menu is open", async () => {
    const result = compile("editorial-masthead");
    const homepage = result.snapshot.pages.find(({ type }) => type === "home")!;
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: result.snapshot,
    });
    const { container } = render(renderStorefrontPage(homepage, context));

    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Mobile navigation" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(container.querySelector("main")?.inert).toBe(true);
    expect(container.querySelector("footer")?.inert).toBe(true);
    expect(
      container.querySelector<HTMLElement>('[data-frame-region="desktop-header-layout"]')?.inert,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await Promise.resolve();
    expect(container.querySelector("main")?.inert).not.toBe(true);
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
    cleanup();
  });

  it("closes a trapping mobile menu and restores the document at the desktop breakpoint", async () => {
    const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(min-width: 64rem)",
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.add(listener),
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.delete(listener),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    try {
      const result = compile("editorial-masthead");
      const homepage = result.snapshot.pages.find(({ type }) => type === "home")!;
      const context = createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue: aurumNordicSeed.catalogue,
        snapshot: result.snapshot,
      });
      const { container } = render(renderStorefrontPage(homepage, context));

      fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
      expect(screen.getByRole("dialog", { name: "Mobile navigation" })).toBeVisible();
      expect(document.body.style.overflow).toBe("hidden");
      expect(container.querySelector("main")?.inert).toBe(true);

      act(() => {
        mediaListeners.forEach((listener) =>
          listener({ matches: true, media: "(min-width: 64rem)" } as MediaQueryListEvent),
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Mobile navigation" })).toBeNull();
        expect(document.body.style.overflow).toBe("");
        expect(container.querySelector("main")?.inert).not.toBe(true);
        expect(container.querySelector("footer")?.inert).not.toBe(true);
      });
      expect(
        container.querySelector<HTMLElement>('[data-frame-region="desktop-header-layout"] a'),
      ).toHaveFocus();
    } finally {
      cleanup();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("renders canonical footer contact and policy content without inventing legal facts", () => {
    const result = compile("compact-technical");
    const homepage = result.snapshot.pages.find(({ type }) => type === "home")!;
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: result.snapshot,
    });
    const markup = renderToStaticMarkup(renderStorefrontPage(homepage, context));
    const footerMarkup = markup.slice(markup.indexOf("<footer"));
    expect(footerMarkup).toContain("Helsinki · hello@aurumnordic.example");
    expect(footerMarkup).toContain("Delivery · Returns · Privacy");
    expect(footerMarkup).not.toContain("Draft placeholder");

    const withoutPolicies = structuredClone(result.snapshot);
    withoutPolicies.sharedFrame!.footer.props.showPolicies = false;
    const withoutPoliciesContext = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: withoutPolicies,
    });
    const withoutPoliciesMarkup = renderToStaticMarkup(
      renderStorefrontPage(homepage, withoutPoliciesContext),
    );
    expect(withoutPoliciesMarkup).toContain("Helsinki · hello@aurumnordic.example");
    expect(withoutPoliciesMarkup).not.toContain("Delivery · Returns · Privacy");
  });

  it("projects the registered centered and editorial frames across every required page family", () => {
    for (const profileId of ["centered-minimal", "editorial-masthead"] as const) {
      const snapshot = structuredClone(compile(profileId).snapshot);
      const source = snapshot.pages[0];
      snapshot.pages.push(
        emptyPage(source, { id: `page_about_${profileId}`, slug: "/pages/about", type: "content" }),
        emptyPage(source, { id: `page_cart_${profileId}`, slug: "/cart", type: "cart" }),
      );
      const context = createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue: aurumNordicSeed.catalogue,
        snapshot,
      });
      expect(new Set(snapshot.pages.map(({ type }) => type))).toEqual(
        new Set(["home", "collection", "product", "content", "cart"]),
      );
      for (const page of snapshot.pages) {
        const markup = renderToStaticMarkup(renderStorefrontPage(page, context));
        expect(markup).toContain(`data-frame-profile="${profileId}"`);
        expect(markup.match(/data-frame-region="header"/g)).toHaveLength(1);
        expect(markup.match(/data-frame-region="footer"/g)).toHaveLength(1);
      }
    }
  });

  it("uses canonical navigation only and cannot invent unavailable frame destinations", () => {
    const result = compile("editorial-masthead");
    const homepage = result.snapshot.pages.find(({ type }) => type === "home")!;
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: result.snapshot,
    });
    const markup = renderToStaticMarkup(renderStorefrontPage(homepage, context));
    for (const item of [
      ...result.snapshot.navigation.primary,
      ...result.snapshot.navigation.footer,
    ]) {
      expect(markup).toContain(item.label.en);
    }
    expect(markup).not.toContain('href="/search"');
    expect(markup).not.toContain('href="/cart"');
  });

  it("consumes editorial frame styling, localizes mobile controls and omits a lone service link", () => {
    const snapshot = structuredClone(compile("editorial-masthead").snapshot);
    snapshot.navigation.footer = snapshot.navigation.footer.slice(0, 1);
    const context = createStorefrontRenderContext({
      activeLocale: "fi",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: aurumNordicSeed.catalogue,
      snapshot,
    });
    const homepage = snapshot.pages.find(({ type }) => type === "home")!;
    const markup = renderToStaticMarkup(renderStorefrontPage(homepage, context));

    expect(markup).toContain("store-header");
    expect(markup).toContain("store-footer");
    expect(markup).toContain('data-header-variant="editorial"');
    expect(markup).toContain('data-footer-variant="editorial"');
    expect(markup).toContain('data-responsive-transformations="editorial-to-drawer');
    expect(markup).toContain(">Valikko</button>");
    expect(markup).not.toContain('data-frame-region="service-strip"');
  });

  it("projects search and cart utilities only from exact canonical page-family destinations", () => {
    const result = compile("commerce-utility");
    const snapshot = structuredClone(result.snapshot);
    const source = snapshot.pages[0];
    const authorityBase = {
      familyVersion: "1.0.0",
      profileVersion: "1.0.0",
      localeCoverage: ["en", "fi"] as ("en" | "fi")[],
      sharedFrameId: snapshot.sharedFrame!.id,
      sharedFrameVersion: "1.0.0",
      commerceOperationAuthority: "read-only-presentation" as const,
      navigationAreas: [] as ("primary" | "footer")[],
      evidenceReferences: [],
    };
    snapshot.pages.push(
      {
        ...emptyPage(source, {
          id: "page_search_frame_proof",
          slug: "/search",
          type: "collection",
        }),
        pageFamily: {
          ...authorityBase,
          familyId: "search-results",
          profileId: "blueprint-site-map-search-baseline",
          commerceContext: { kind: "search" },
        },
      },
      {
        ...emptyPage(source, { id: "page_cart_frame_proof", slug: "/cart", type: "cart" }),
        pageFamily: {
          ...authorityBase,
          familyId: "cart",
          profileId: "blueprint-site-map-cart-baseline",
          commerceContext: { kind: "none" },
        },
      },
    );
    const context = createStorefrontRenderContext({
      activeLocale: "fi",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: aurumNordicSeed.catalogue,
      snapshot,
    });
    const markup = renderToStaticMarkup(renderStorefrontPage(snapshot.pages[0], context));
    const searchPage = snapshot.pages.find(({ id }) => id === "page_search_frame_proof")!;
    const searchMarkup = renderToStaticMarkup(renderStorefrontPage(searchPage, context));
    expect(markup).toContain('role="search" action="/search" method="get"');
    expect(markup).not.toContain("data-current-search-page");
    expect(markup).toContain('aria-label="Hae tuotteita"');
    expect(markup).toContain(">Hae</button>");
    expect(markup).toContain('href="/cart"');
    expect(markup).toContain(">Ostoskori<");
    expect(markup.match(/data-frame-utility="cart"/g)).toHaveLength(2);
    expect(searchMarkup).toContain('data-current-search-page="true"');
  });

  it("projects the executable dynamic search route through the shared-frame search form", () => {
    const fixture = createP10B14PremiumEditorialFixture();
    const snapshot = fixture.slice.snapshot;
    expect(
      snapshot.dynamicCommercePresentation?.routeInventory.some(({ kind }) => kind === "search"),
    ).toBe(true);
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: fixture.fixture.aggregate.catalogue,
      snapshot,
      evidenceReferences: fixture.approvedEvidenceReferences,
    });
    const homepage = snapshot.pages.find(({ type }) => type === "home")!;
    const markup = renderToStaticMarkup(renderStorefrontPage(homepage, context));
    expect(markup).toContain('role="search" action="/search" method="get"');
    expect(markup).toContain('aria-label="Search products"');
    expect(markup).toContain(">Search</button>");
  });

  it("projects the legacy header search as a canonical GET form", () => {
    const snapshot = structuredClone(aurumNordicSeed.draftSnapshot);
    const source = snapshot.pages[0];
    snapshot.pages.push({
      ...emptyPage(source, {
        id: "page_static_search_frame_proof",
        slug: "/search",
        type: "collection",
      }),
      pageFamily: {
        familyId: "search-results",
        familyVersion: "1.0.0",
        profileId: "blueprint-site-map-search-baseline",
        profileVersion: "1.0.0",
        localeCoverage: ["en"],
        sharedFrameId: "shared-frame",
        sharedFrameVersion: "1.0.0",
        commerceContext: { kind: "search" },
        commerceOperationAuthority: "read-only-presentation",
        navigationAreas: [],
        evidenceReferences: [],
      },
    });
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot,
    });
    const markup = renderToStaticMarkup(renderStorefrontPage(source, context));
    expect(markup).toContain('role="search" action="/search" method="get"');
    expect(markup).toContain('aria-label="Search products"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain(">Search</button>");
  });

  it("compiles an exact bounded proposal and fails closed when its source snapshot is stale", () => {
    const proposal = createCommercialSharedFrameProposal(
      aurumNordicSeed.draftSnapshot,
      "centered-minimal",
    );
    const compiled = compileCommercialSharedFrameProposal({
      snapshot: aurumNordicSeed.draftSnapshot,
      catalogue: aurumNordicSeed.catalogue,
      proposal,
    });
    expect(compiled.snapshot.sharedFrame?.profileId).toBe("centered-minimal");

    const changed = structuredClone(aurumNordicSeed.draftSnapshot);
    changed.revision += 1;
    expect(() =>
      compileCommercialSharedFrameProposal({
        snapshot: changed,
        catalogue: aurumNordicSeed.catalogue,
        proposal,
      }),
    ).toThrow(/exact current snapshot/i);
    expect(changed.sharedFrame).toBeUndefined();
  });

  it("fails closed for stale selections, incompatible combinations and duplicated authority", () => {
    const stale = structuredClone(currentCommercialSharedFrameSelection("centered-minimal"));
    stale.authorityFingerprint = "stale";
    expect(() =>
      compileCommercialSharedFrameSelection({
        snapshot: aurumNordicSeed.draftSnapshot,
        catalogue: aurumNordicSeed.catalogue,
        selection: stale,
      }),
    ).toThrow(/current executable authority/i);

    const mismatch = structuredClone(compile("centered-minimal").snapshot);
    mismatch.sharedFrame!.footer.variant = "compact";
    expect(errorCode(() => validateCommercialSharedFrameSnapshot(mismatch))).toBe(
      "incompatible-frame-combination",
    );

    const duplicated = structuredClone(compile("centered-minimal").snapshot);
    duplicated.pages[0].sections.unshift(structuredClone(duplicated.sharedFrame!.header));
    duplicated.pages[0].sections[0].id = "duplicate_page_header";
    expect(errorCode(() => validateCommercialSharedFrameSnapshot(duplicated))).toBe(
      "duplicated-page-frame-authority",
    );

    const ambiguousLegacy = structuredClone(aurumNordicSeed.draftSnapshot);
    const collectionHeader = ambiguousLegacy.pages
      .find(({ type }) => type === "collection")!
      .sections.find(({ component }) => component === "header")!;
    collectionHeader.content = { ...collectionHeader.content, brandName: "Conflicting brand" };
    expect(
      errorCode(() =>
        compileCommercialSharedFrameSelection({
          snapshot: ambiguousLegacy,
          catalogue: aurumNordicSeed.catalogue,
          selection: currentCommercialSharedFrameSelection("centered-minimal"),
        }),
      ),
    ).toBe("ambiguous-legacy-frame-authority");
  });

  it("rejects cosmetic-only anatomy when it claims a meaningful frame difference", () => {
    const header = structuredClone(
      veskifyComponentDefinitionsV2.find(({ type }) => type === "header")!,
    );
    const anatomy = header.commercialAnatomy!;
    const centered = anatomy.variants.find(({ variantId }) => variantId === "centered")!;
    const transparent = anatomy.variants.find(({ variantId }) => variantId === "transparent")!;
    transparent.classification = "meaningfulStructuralVariant";
    transparent.materialDifferences = ["presentationMode"];
    transparent.structure = structuredClone(centered.structure);
    expect(() => validateComponentDefinitionV2(header)).toThrow(/does not realize/i);
  });

  it("keeps frame structure stable while two Design DNA identities change visual foundations", () => {
    const first = compile("compact-technical").snapshot;
    const second = structuredClone(first);
    second.brandSystem = structuredClone(karvonenSeed.draftSnapshot.brandSystem);
    expect(first.sharedFrame?.profileId).toBe(second.sharedFrame?.profileId);
    expect(first.sharedFrame?.header.variant).toBe(second.sharedFrame?.header.variant);
    expect(brandSystemToCssVariables(first.brandSystem)).not.toEqual(
      brandSystemToCssVariables(second.brandSystem),
    );
  });

  it("preserves the exact frame through save/reload and deterministic publication", async () => {
    const result = compile("editorial-masthead");
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
    expect(draft.sharedFrame).toEqual(result.snapshot.sharedFrame);

    const publication = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: reloaded,
        snapshot: draft,
        sourceAuthority: { kind: "manual" },
      }),
    );
    expect(publication.result.sharedFrame.frame).toEqual(result.snapshot.sharedFrame);
    expect(
      publication.result.sharedFrame.componentExecutions.map(({ componentType }) => componentType),
    ).toEqual(expect.arrayContaining(["header", "footer"]));

    const preparation = await preparePublish(result.snapshot.projectId, repository, {
      createPreparationId: () => "publish_preparation_p10b_06_shared_frame",
    });
    const confirmed = await confirmPublish(preparation, repository);
    expect(confirmed.publishedSnapshot.sharedFrame).toEqual(result.snapshot.sharedFrame);
    expect(
      (await repository.getActiveCompiledPublication(result.snapshot.projectId))?.version
        .publishedSnapshot.fingerprint,
    ).toBe(canonicalStorefrontContentFingerprint(confirmed.publishedSnapshot));
  });

  it("keeps legacy P9/P10A snapshots valid until deterministic frame migration is requested", () => {
    expect(aurumNordicSeed.draftSnapshot.sharedFrame).toBeUndefined();
    expect(
      validateRegisteredSnapshot(
        aurumNordicSeed.draftSnapshot,
        aurumNordicSeed.catalogue,
        "en",
        "en",
      ),
    ).toEqual(aurumNordicSeed.draftSnapshot);
    expect(compile("centered-minimal").snapshot.sharedFrame?.profileId).toBe("centered-minimal");

    const withoutAnnouncement = structuredClone(aurumNordicSeed.draftSnapshot);
    withoutAnnouncement.pages.forEach((page) => {
      page.sections.forEach((section) => {
        if (section.component === "announcementBar") section.visible = false;
      });
    });
    const migrated = compileCommercialSharedFrameSelection({
      snapshot: withoutAnnouncement,
      catalogue: aurumNordicSeed.catalogue,
      selection: currentCommercialSharedFrameSelection("centered-minimal"),
    });
    expect(migrated.snapshot.sharedFrame?.announcement).toBeUndefined();

    const legacyArtifact = structuredClone(
      compileStorefrontPublication(
        createCurrentPublishCompilerInput({
          aggregate: {
            project: structuredClone(aurumNordicSeed.project),
            catalogue: structuredClone(aurumNordicSeed.catalogue),
            snapshots: [structuredClone(aurumNordicSeed.draftSnapshot)],
          },
          snapshot: aurumNordicSeed.draftSnapshot,
          sourceAuthority: { kind: "manual" },
        }),
      ).result,
    ) as Record<string, unknown>;
    delete (legacyArtifact.sharedFrame as Record<string, unknown>).componentExecutions;
    expect(
      compiledPublicationResultSchema.parse(legacyArtifact).sharedFrame.componentExecutions,
    ).toEqual([]);
  });
});
