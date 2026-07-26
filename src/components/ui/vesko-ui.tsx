import Image from "next/image";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import styles from "./vesko-ui.module.css";
import {
  storefrontShellCopy,
  storefrontStudioModuleItems,
  type StorefrontStudioModuleId,
} from "./storefront-studio-copy";

type ModuleId = StorefrontStudioModuleId;
type Locale = "en" | "fi";

function join(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function PlatformNavContent({
  destination,
  label,
}: {
  destination: "home" | "studio" | "projects" | "account";
  label: string;
}) {
  return (
    <>
      <svg aria-hidden="true" className={styles.platformNavIcon} fill="none" viewBox="0 0 24 24">
        {destination === "home" ? (
          <path d="M3.5 10.5 12 3l8.5 7.5V21h-6v-6h-5v6h-6V10.5Z" />
        ) : destination === "studio" ? (
          <>
            <rect height="16" rx="2" width="18" x="3" y="4" />
            <path d="M8 4v16M8 9h13" />
          </>
        ) : destination === "projects" ? (
          <path d="M3 7.5h7l2-2h9v14H3v-12Z" />
        ) : (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
          </>
        )}
      </svg>
      <span className={styles.platformNavLabel}>{label}</span>
    </>
  );
}

export function Button({
  children,
  className,
  disabled = false,
  href,
  onClick,
  type = "button",
  variant = "primary",
  ...props
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  [key: string]: unknown;
}) {
  const variantClass =
    variant === "primary"
      ? styles.buttonPrimary
      : variant === "secondary"
        ? styles.buttonSecondary
        : variant === "danger"
          ? styles.buttonDanger
          : styles.buttonQuiet;
  const classNames = join(styles.button, variantClass, className);

  if (href) {
    return (
      <Link
        aria-disabled={disabled || undefined}
        className={classNames}
        href={href}
        onClick={disabled ? (event) => event.preventDefault() : onClick}
        {...props}
      >
        {children}
      </Link>
    );
  }

  return (
    <button className={classNames} disabled={disabled} onClick={onClick} type={type} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <section className={join(styles.card, className)} {...props}>
      {children}
    </section>
  );
}

export function StatusPill({
  ariaLabel,
  label,
  live = false,
  status,
}: {
  ariaLabel?: string;
  label: string;
  live?: boolean;
  status:
    | "saved"
    | "unsaved"
    | "draft-different"
    | "ready-to-publish"
    | "published"
    | "saving"
    | "failed";
}) {
  return (
    <span
      aria-label={ariaLabel}
      aria-live={live ? "polite" : undefined}
      className={styles.statusPill}
      data-status={status}
      role={live ? "status" : undefined}
    >
      {label}
    </span>
  );
}

export function Field({
  children,
  error,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  id?: string;
  label: string;
}) {
  const hintId = id && hint ? `${id}-hint` : undefined;
  const errorId = id && error ? `${id}-error` : undefined;
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className={styles.fieldHint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Tabs({
  items,
  label = "Sections",
  onSelect,
}: {
  items: ReadonlyArray<{
    active?: boolean;
    disabled?: boolean;
    href?: string;
    id: string;
    label: string;
  }>;
  label?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {items.map((item) =>
        item.disabled ? (
          <span
            aria-disabled="true"
            className={join(styles.tab, styles.tabDisabled)}
            key={item.id}
            role="link"
          >
            {item.label}
          </span>
        ) : onSelect ? (
          <button
            aria-current={item.active ? "page" : undefined}
            className={styles.tab}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ) : (
          <Link
            aria-current={item.active ? "page" : undefined}
            className={styles.tab}
            href={item.href ?? "#"}
            key={item.id}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function Notice({
  children,
  className,
  live = false,
  role,
  variant = "info",
}: {
  children: ReactNode;
  className?: string;
  live?: boolean;
  role?: "status" | "alert";
  variant?: "info" | "warning" | "danger" | "success";
}) {
  return (
    <div
      aria-live={live ? "polite" : undefined}
      className={join(styles.notice, className)}
      data-variant={variant}
      role={role ?? (live ? "status" : undefined)}
    >
      {children}
    </div>
  );
}

export function AppShell({
  activeModule,
  children,
  headerActions,
  locale = "en",
  moduleName = "Storefront Studio",
  pageLabel,
  pageTitle,
  projectId,
  projectName,
  onHomeNavigate,
  homeNavigationDisabled = false,
  editorMode = false,
  showModuleNav = Boolean(projectId),
  showModuleIdentity = true,
}: {
  activeModule?: ModuleId;
  children: ReactNode;
  headerActions?: ReactNode;
  locale?: Locale;
  moduleName?: string;
  pageLabel?: string;
  pageTitle?: ReactNode;
  projectId?: string;
  projectName?: string;
  onHomeNavigate?: (event: MouseEvent<HTMLElement>) => void;
  homeNavigationDisabled?: boolean;
  editorMode?: boolean;
  showModuleNav?: boolean;
  showModuleIdentity?: boolean;
}) {
  const labels = storefrontShellCopy[locale];
  const projectPath = projectId ? `/projects/${projectId}` : "/projects/new";

  return (
    <div className={join(styles.shell, editorMode && styles.editorShell)}>
      <header className={styles.globalBar}>
        <Link
          aria-disabled={homeNavigationDisabled || undefined}
          aria-label={labels.home}
          className={styles.brand}
          href="/"
          onClick={onHomeNavigate}
        >
          <Image
            alt="Vesko"
            className={styles.brandMark}
            height={32}
            priority
            src="/vesko-logo.png"
            width={32}
          />
          <span className={styles.brandName}>Vesko</span>
        </Link>
        <nav aria-label={labels.globalNavigation} className={styles.platformNav}>
          <Link
            aria-current={!projectId ? "page" : undefined}
            aria-disabled={homeNavigationDisabled || undefined}
            href="/"
            onClick={onHomeNavigate}
          >
            <PlatformNavContent destination="home" label={labels.home} />
          </Link>
          <Link aria-current={projectId ? "page" : undefined} href={projectPath}>
            <PlatformNavContent destination="studio" label={labels.studio} />
          </Link>
          <Link href="/projects/new">
            <PlatformNavContent destination="projects" label={labels.projects} />
          </Link>
          <Link
            aria-disabled={homeNavigationDisabled || undefined}
            href="/"
            onClick={onHomeNavigate}
          >
            <PlatformNavContent destination="account" label={labels.account} />
          </Link>
        </nav>
      </header>
      <div className={styles.shellBody}>
        {(showModuleIdentity || headerActions) && (
          <div className={styles.moduleHeader}>
            {showModuleIdentity ? (
              <div
                aria-label={projectId ? labels.editorNavigation : undefined}
                className={styles.moduleIdentity}
                role={projectId ? "navigation" : undefined}
              >
                <span className={styles.breadcrumb}>{labels.studio}</span>
                {projectName ? <span>{projectName}</span> : null}
                <strong>{moduleName}</strong>
                {pageLabel ? <span className={styles.breadcrumb}>{pageLabel}</span> : null}
                {pageTitle ? <h1 className={styles.pageTitle}>{pageTitle}</h1> : null}
              </div>
            ) : null}
            {headerActions ? <div className={styles.headerActions}>{headerActions}</div> : null}
          </div>
        )}
        {showModuleNav ? (
          <Tabs
            items={storefrontStudioModuleItems
              .filter(([id]) => projectId || id === "setup")
              .map(([id, en, fi]) => ({
                active: activeModule === id,
                disabled: id === "setup" && Boolean(projectId),
                href:
                  id === "setup"
                    ? projectId
                      ? undefined
                      : "/projects/new"
                    : id === "overview"
                      ? `/projects/${projectId}`
                      : id === "preview"
                        ? `/projects/${projectId}`
                        : id === "publishing"
                          ? `/projects/${projectId}/publish`
                          : `/projects/${projectId}/${id === "editor" ? "editor" : id}`,
                id,
                label: locale === "fi" ? fi : en,
              }))}
            label={labels.modules}
          />
        ) : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export type { ModuleId };
