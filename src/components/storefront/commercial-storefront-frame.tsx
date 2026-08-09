"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { StorefrontRenderContext } from "@/components/registry/contract";
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
  return item.target.type === "external"
    ? item.target.url
    : (context.pagePaths[item.target.pageId] ?? "#");
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
  return page ? context.pagePaths[page.id] : undefined;
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
        <a data-frame-utility="search" href={searchPath} onClick={onNavigate}>
          {context.activeLocale === "fi" ? "Haku" : "Search"}
        </a>
      ) : null}
      {showCart && cartPath ? (
        <a data-frame-utility="cart" href={cartPath} onClick={onNavigate}>
          {context.activeLocale === "fi" ? "Ostoskori" : "Cart"}
        </a>
      ) : null}
      <div aria-label={context.activeLocale === "fi" ? "Kielivalinta" : "Language"}>
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
        {context.navigation.primary.map((item) => (
          <li key={item.id}>
            <a href={navigationHref(item, context)} onClick={onNavigate}>
              {localized(item.label, context)}
            </a>
          </li>
        ))}
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
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const trapsFocus = profile.mobileNavigationMode !== "stacked-disclosure";

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    if (!trapsFocus) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, trapsFocus]);

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
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
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
  return (
    <header
      className={`${styles.header} ${className ?? ""}`}
      data-frame-profile={profile.id}
      data-frame-region="header"
      data-mobile-navigation-mode={profile.mobileNavigationMode}
      data-search-placement={profile.searchPlacement}
    >
      {profile.serviceStrip === "canonical-footer-navigation" &&
      context.navigation.footer.length > 0 ? (
        <nav
          aria-label={context.activeLocale === "fi" ? "Palvelulinkit" : "Service links"}
          className={styles.serviceStrip}
          data-frame-region="service-strip"
        >
          {context.navigation.footer.slice(0, 3).map((item) => (
            <a href={navigationHref(item, context)} key={item.id}>
              {localized(item.label, context)}
            </a>
          ))}
        </nav>
      ) : null}
      <div className={styles.desktopFrame} data-desktop-composition={profile.desktopComposition}>
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
      <div className={styles.mobileFrame}>
        <a className={`store-brand ${styles.brand}`} href={context.homePath ?? "/"}>
          {brandName}
        </a>
        <UtilityControls context={context} showCart={false} showSearch={showSearch} />
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
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <div
          aria-label={mobileLabel}
          aria-modal={trapsFocus || undefined}
          className={styles.mobilePanel}
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
      {items.map((item) => (
        <li key={item.id}>
          <a href={navigationHref(item, context)}>{localized(item.label, context)}</a>
        </li>
      ))}
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
      className={`${styles.footer} ${className ?? ""}`}
      data-footer-composition={profile.footerComposition}
      data-frame-profile={profile.id}
      data-frame-region="footer"
    >
      {regions}
    </footer>
  );
}
