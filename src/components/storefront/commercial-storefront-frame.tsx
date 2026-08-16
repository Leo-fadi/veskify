"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  storefrontMainContentId,
  type StorefrontRenderContext,
} from "@/components/registry/contract";
import { splitStorefrontSearchFormTarget } from "@/application/storefront-search";
import {
  commercialSharedFrameProfiles,
  resolveCommercialSharedFrameProfile,
  type CommercialSharedFrameProfile,
} from "@/domain/storefront";
import { resolveLocalizedText } from "@/domain/shared";
import styles from "./commercial-storefront-frame.module.css";

type HeaderVariant = "centered" | "split" | "compact" | "transparent" | "editorial";
type FooterVariant = "columns" | "expanded" | "editorial" | "compact" | "dark";

function localized(
  value: StorefrontRenderContext["navigation"]["primary"][number]["label"],
  context: StorefrontRenderContext,
) {
  return resolveLocalizedText(value, context.activeLocale, context.primaryLocale);
}

function navigationHref(
  item: StorefrontRenderContext["navigation"]["primary"][number],
  context: StorefrontRenderContext,
) {
  if (item.target.type === "external") return item.target.url;
  if (item.target.type === "page") return context.pagePaths[item.target.pageId] ?? "#";
  return context.pagePaths[item.target.routeId] ?? "#";
}

function isCurrentNavigationItem(
  item: StorefrontRenderContext["navigation"]["primary"][number],
  context: StorefrontRenderContext,
) {
  if (!context.currentPageId || item.target.type === "external") return false;
  return item.target.type === "page"
    ? item.target.pageId === context.currentPageId
    : item.target.routeId === context.currentPageId;
}

function fallbackByHeader(variant: HeaderVariant): CommercialSharedFrameProfile {
  const profileId =
    variant === "editorial" || variant === "transparent"
      ? "editorial-masthead"
      : variant === "split"
        ? "commerce-utility"
        : variant === "compact"
          ? "compact-technical"
          : "centered-minimal";
  return commercialSharedFrameProfiles.find((profile) => profile.id === profileId)!;
}

function fallbackByFooter(variant: FooterVariant): CommercialSharedFrameProfile {
  const profileId =
    variant === "editorial" || variant === "dark"
      ? "editorial-masthead"
      : variant === "expanded"
        ? "commerce-utility"
        : variant === "compact"
          ? "compact-technical"
          : "centered-minimal";
  return commercialSharedFrameProfiles.find((profile) => profile.id === profileId)!;
}

function profileFor(
  context: StorefrontRenderContext,
  variant: HeaderVariant | FooterVariant,
  region: "header" | "footer",
) {
  return context.sharedFrame
    ? resolveCommercialSharedFrameProfile(context.sharedFrame)
    : region === "header"
      ? fallbackByHeader(variant as HeaderVariant)
      : fallbackByFooter(variant as FooterVariant);
}

function frameDestination(context: StorefrontRenderContext, familyId: "search-results" | "cart") {
  const page = context.pages.find((candidate) => candidate.pageFamily?.familyId === familyId);
  if (page) return context.pagePaths[page.id];
  if (familyId !== "search-results") return undefined;
  const route = context.dynamicCommercePresentation?.routeInventory.find(
    (candidate) => candidate.kind === "search",
  );
  return route ? context.pagePaths[route.id] : undefined;
}

function isCurrentFrameDestination(
  context: StorefrontRenderContext,
  familyId: "search-results" | "cart",
) {
  if (!context.currentPageId) return false;
  const page = context.pages.find((candidate) => candidate.pageFamily?.familyId === familyId);
  if (page?.id === context.currentPageId) return true;
  if (familyId !== "search-results") return false;
  return context.dynamicCommercePresentation?.routeInventory.some(
    (candidate) => candidate.kind === "search" && candidate.id === context.currentPageId,
  );
}

export function StorefrontSearchForm({
  context,
  routePath,
  onNavigate,
}: {
  context: StorefrontRenderContext;
  routePath: string;
  onNavigate?: () => void;
}) {
  const target = splitStorefrontSearchFormTarget({ routePath, locale: context.activeLocale });
  const label = context.activeLocale === "fi" ? "Hae tuotteita" : "Search products";
  return (
    <form
      action={target.action}
      className={styles.searchForm}
      data-frame-utility="search"
      method="get"
      onSubmit={onNavigate}
      role="search"
    >
      {target.hiddenInputs.map(({ name, value }) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <label>
        <span className={styles.searchLabel}>{label}</span>
        <input
          aria-label={label}
          defaultValue={context.searchQuery}
          maxLength={120}
          name="q"
          type="search"
        />
      </label>
      <button type="submit">{context.activeLocale === "fi" ? "Hae" : "Search"}</button>
    </form>
  );
}

function UtilityControls({
  context,
  showSearch,
  showCart,
  onNavigate,
}: {
  context: StorefrontRenderContext;
  showSearch: boolean;
  showCart: boolean;
  onNavigate?: () => void;
}) {
  const searchPath = frameDestination(context, "search-results");
  const cartPath = frameDestination(context, "cart");
  function selectLocale(locale: StorefrontRenderContext["activeLocale"]) {
    onNavigate?.();
    if (context.onLocaleChange) {
      context.onLocaleChange(locale);
      return;
    }
    const destination = new URL(window.location.href);
    destination.searchParams.set("locale", locale);
    window.location.assign(destination.toString());
  }
  return (
    <div className={styles.utilities} data-frame-region="utilities">
      {showSearch && searchPath ? (
        <StorefrontSearchForm context={context} onNavigate={onNavigate} routePath={searchPath} />
      ) : null}
      {showCart && cartPath ? (
        <a data-frame-utility="cart" href={cartPath} onClick={onNavigate}>
          {context.activeLocale === "fi" ? "Ostoskori" : "Cart"}
        </a>
      ) : null}
      <div aria-label={context.activeLocale === "fi" ? "Kielivalinta" : "Language"} role="group">
        {context.enabledLocales.map((locale) => (
          <button
            aria-pressed={locale === context.activeLocale}
            className={styles.localeButton}
            key={locale}
            onClick={() => selectLocale(locale)}
            type="button"
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrimaryNavigation({
  context,
  onNavigate,
  label,
}: {
  context: StorefrontRenderContext;
  onNavigate?: () => void;
  label: string;
}) {
  return (
    <nav aria-label={label} data-frame-region="primary-navigation">
      <ul>
        {context.navigation.primary.map((item) => {
          const href = navigationHref(item, context);
          return href ? (
            <li key={item.id}>
              <a
                aria-current={isCurrentNavigationItem(item, context) ? "page" : undefined}
                href={href}
                onClick={onNavigate}
              >
                {localized(item.label, context)}
              </a>
            </li>
          ) : null;
        })}
      </ul>
    </nav>
  );
}

export function CommercialStoreHeader({
  brandName,
  showSearch,
  showCart,
  context,
  className,
  variant,
}: {
  brandName: string;
  showSearch: boolean;
  showCart: boolean;
  context: StorefrontRenderContext;
  className?: string;
  variant: HeaderVariant;
}) {
  const profile = profileFor(context, variant, "header");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreDesktopFocusRef = useRef(false);
  const menuId = useId();
  const trapsFocus = profile.mobileNavigationMode !== "stacked-disclosure";

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button, input:not([type='hidden'])")?.focus();
    if (!trapsFocus) return;
    const previousOverflow = document.body.style.overflow;
    const inertPageSiblings = [...(headerRef.current?.parentElement?.children ?? [])].filter(
      (sibling): sibling is HTMLElement =>
        sibling instanceof HTMLElement && sibling !== headerRef.current,
    );
    const inertHeaderSiblings = [...(headerRef.current?.children ?? [])].filter(
      (sibling): sibling is HTMLElement =>
        sibling instanceof HTMLElement && sibling !== panelRef.current,
    );
    const inertElements = [...inertPageSiblings, ...inertHeaderSiblings];
    const previousInert = inertElements.map((element) => [element, element.inert] as const);
    document.body.style.overflow = "hidden";
    inertElements.forEach((element) => {
      element.inert = true;
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      previousInert.forEach(([element, inert]) => {
        element.inert = inert;
      });
    };
  }, [open, trapsFocus]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktopViewport = window.matchMedia("(min-width: 64rem)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setOpen((currentOpen) => {
        if (currentOpen) restoreDesktopFocusRef.current = true;
        return false;
      });
    };
    desktopViewport.addEventListener("change", closeAtDesktop);
    return () => desktopViewport.removeEventListener("change", closeAtDesktop);
  }, []);

  useEffect(() => {
    if (open || !restoreDesktopFocusRef.current) return;
    restoreDesktopFocusRef.current = false;
    headerRef.current
      ?.querySelector<HTMLElement>(
        '[data-frame-region="desktop-header-layout"] a, [data-frame-region="desktop-header-layout"] button, [data-frame-region="desktop-header-layout"] input',
      )
      ?.focus();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (!trapsFocus || event.key !== "Tab") return;
    const focusable = [
      ...(panelRef.current?.querySelectorAll<HTMLElement>(
        "a, button, input:not([type='hidden'])",
      ) ?? []),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const primaryLabel = context.activeLocale === "fi" ? "Päänavigaatio" : "Primary navigation";
  const mobileLabel = context.activeLocale === "fi" ? "Mobiilinavigaatio" : "Mobile navigation";
  const menuLabel = context.activeLocale === "fi" ? "Valikko" : "Menu";
  const closeLabel = context.activeLocale === "fi" ? "Sulje" : "Close";
  const currentSearchPage = isCurrentFrameDestination(context, "search-results");
  const serviceItems = context.navigation.footer.flatMap((item) => {
    const href = navigationHref(item, context);
    return href ? [{ href, item }] : [];
  });
  const hasSubstantiveServiceNavigation = serviceItems.length >= 2;
  return (
    <header
      className={`store-header ${styles.header} ${className ?? ""}`}
      data-frame-profile={profile.id}
      data-frame-region="header"
      data-header-variant={profile.headerVariant}
      data-mobile-navigation-mode={profile.mobileNavigationMode}
      data-responsive-transformations={profile.responsiveTransformationIds.join(" ")}
      data-current-search-page={currentSearchPage || undefined}
      data-search-placement={profile.searchPlacement}
      ref={headerRef}
    >
      <a className={styles.skipLink} href={`#${storefrontMainContentId}`}>
        {context.activeLocale === "fi" ? "Siirry pääsisältöön" : "Skip to main content"}
      </a>
      {profile.serviceStrip === "canonical-footer-navigation" && hasSubstantiveServiceNavigation ? (
        <nav
          aria-label={context.activeLocale === "fi" ? "Palvelulinkit" : "Service links"}
          className={styles.serviceStrip}
          data-frame-region="service-strip"
          data-service-link-count={serviceItems.length}
        >
          {serviceItems.slice(0, 3).map(({ href, item }) => (
            <a href={href} key={item.id}>
              {localized(item.label, context)}
            </a>
          ))}
        </nav>
      ) : null}
      <div
        className={styles.desktopFrame}
        data-desktop-composition={profile.desktopComposition}
        data-frame-region="desktop-header-layout"
      >
        <a
          aria-label={`${brandName} ${context.activeLocale === "fi" ? "etusivu" : "home"}`}
          className={`store-brand ${styles.brand}`}
          href={context.homePath ?? "/"}
        >
          {brandName}
        </a>
        <PrimaryNavigation context={context} label={primaryLabel} />
        <UtilityControls context={context} showCart={showCart} showSearch={showSearch} />
      </div>
      <div className={styles.mobileFrame} data-frame-region="mobile-header-layout">
        <a className={`store-brand ${styles.brand}`} href={context.homePath ?? "/"}>
          {brandName}
        </a>
        <UtilityControls context={context} showCart={showCart} showSearch={showSearch} />
        <button
          aria-controls={menuId}
          aria-expanded={open}
          aria-label={
            open
              ? context.activeLocale === "fi"
                ? "Sulje valikko"
                : "Close menu"
              : context.activeLocale === "fi"
                ? "Avaa valikko"
                : "Open menu"
          }
          className={styles.menuTrigger}
          onClick={() => (open ? closeMenu() : setOpen(true))}
          ref={triggerRef}
          type="button"
        >
          {open ? closeLabel : menuLabel}
        </button>
      </div>
      {open ? (
        <>
          {trapsFocus ? <div aria-hidden="true" className={styles.mobileBackdrop} /> : null}
          <div
            aria-label={mobileLabel}
            aria-modal={trapsFocus || undefined}
            className={styles.mobilePanel}
            data-frame-region="mobile-navigation"
            data-mobile-mode={profile.mobileNavigationMode}
            id={menuId}
            onKeyDown={handleMenuKeyDown}
            ref={panelRef}
            role={trapsFocus ? "dialog" : "region"}
          >
            <PrimaryNavigation context={context} label={mobileLabel} onNavigate={closeMenu} />
            <UtilityControls
              context={context}
              onNavigate={closeMenu}
              showCart={showCart}
              showSearch={showSearch}
            />
            <button className={styles.closeButton} onClick={closeMenu} type="button">
              {context.activeLocale === "fi" ? "Sulje" : "Close"}
            </button>
          </div>
        </>
      ) : null}
    </header>
  );
}

function NavigationList({
  items,
  context,
}: {
  items: StorefrontRenderContext["navigation"]["footer"];
  context: StorefrontRenderContext;
}) {
  return (
    <ul>
      {items.map((item) => {
        const href = navigationHref(item, context);
        return href ? (
          <li key={item.id}>
            <a
              aria-current={isCurrentNavigationItem(item, context) ? "page" : undefined}
              href={href}
            >
              {localized(item.label, context)}
            </a>
          </li>
        ) : null;
      })}
    </ul>
  );
}

export function CommercialStoreFooter({
  brandName,
  contact,
  policyLabel,
  copyright,
  showPolicies,
  context,
  className,
  variant,
}: {
  brandName: string;
  contact: { en?: string; fi?: string };
  policyLabel: { en?: string; fi?: string };
  copyright: { en?: string; fi?: string };
  showPolicies: boolean;
  context: StorefrontRenderContext;
  className?: string;
  variant: FooterVariant;
}) {
  const profile = profileFor(context, variant, "footer");
  const primary = context.navigation.primary;
  const footer = context.navigation.footer;
  const brandRegion = (
    <div className={styles.footerBrand} data-frame-region="footer-brand" key="brand">
      <a className="store-brand" href={context.homePath ?? "/"}>
        {brandName}
      </a>
      <p>{resolveLocalizedText(contact, context.activeLocale, context.primaryLocale)}</p>
      <p>{resolveLocalizedText(copyright, context.activeLocale, context.primaryLocale)}</p>
    </div>
  );
  const storePagesRegion = (
    <nav
      aria-label={context.activeLocale === "fi" ? "Kaupan sivut" : "Store pages"}
      data-frame-region="footer-store-pages"
      key="store-pages"
    >
      <h2>{context.activeLocale === "fi" ? "Kauppa" : "Shop"}</h2>
      <NavigationList context={context} items={primary} />
    </nav>
  );
  const informationRegion = (
    <nav
      aria-label={context.activeLocale === "fi" ? "Alatunnisteen navigaatio" : "Footer navigation"}
      data-frame-region="footer-information"
      key="information"
    >
      <h2>{context.activeLocale === "fi" ? "Lisätiedot" : "Information"}</h2>
      <NavigationList context={context} items={footer} />
      {showPolicies ? (
        <p className={styles.footerPolicy} data-frame-region="footer-policy">
          {resolveLocalizedText(policyLabel, context.activeLocale, context.primaryLocale)}
        </p>
      ) : null}
    </nav>
  );
  const regions =
    profile.footerComposition === "brand-editorial"
      ? [brandRegion, storePagesRegion, informationRegion]
      : profile.footerComposition === "service-navigation"
        ? [informationRegion, brandRegion, storePagesRegion]
        : profile.footerComposition === "navigation-columns"
          ? [storePagesRegion, informationRegion, brandRegion]
          : [brandRegion, informationRegion];
  return (
    <footer
      className={`store-footer ${styles.footer} ${className ?? ""}`}
      data-footer-composition={profile.footerComposition}
      data-footer-variant={profile.footerVariant}
      data-frame-profile={profile.id}
      data-frame-region="footer"
      data-responsive-transformations={profile.responsiveTransformationIds.join(" ")}
    >
      {regions}
    </footer>
  );
}
