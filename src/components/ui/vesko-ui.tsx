import Image from "next/image";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import styles from "./vesko-ui.module.css";

const moduleItems = [
  ["overview", "Overview", "Yleiskatsaus"],
  ["setup", "Setup", "Asetukset"],
  ["editor", "Editor", "Editori"],
  ["preview", "Preview", "Esikatselu"],
  ["publishing", "Publishing", "Julkaiseminen"],
  ["history", "History", "Historia"],
] as const;

type ModuleId = (typeof moduleItems)[number][0];
type Locale = "en" | "fi";

function join(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
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
}: {
  items: ReadonlyArray<{ href: string; id: string; label: string; active?: boolean }>;
  label?: string;
}) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          className={styles.tab}
          href={item.href}
          key={item.id}
        >
          {item.label}
        </Link>
      ))}
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

export function Drawer({
  children,
  closeLabel = "Close",
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  closeLabel?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className={styles.drawerBackdrop} role="presentation">
      <aside aria-label={title} aria-modal="true" className={styles.drawer} role="dialog">
        <div className={styles.drawerHeader}>
          <strong>{title}</strong>
          <Button onClick={onClose} variant="quiet">
            {closeLabel}
          </Button>
        </div>
        {children}
      </aside>
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
  showModuleNav = Boolean(projectId),
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
  showModuleNav?: boolean;
}) {
  const isFinnish = locale === "fi";
  const labels = {
    home: isFinnish ? "Vesko-etusivu" : "Vesko home",
    studio: isFinnish ? "Storefront Studio" : "Storefront Studio",
    projects: isFinnish ? "Projektit" : "Projects",
    account: isFinnish ? "Tili" : "Account",
  };
  const projectPath = projectId ? `/projects/${projectId}` : "/projects/new";

  return (
    <div className={styles.shell}>
      <header className={styles.globalBar}>
        <Link aria-label={labels.home} className={styles.brand} href="/">
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
        <nav aria-label="Global navigation" className={styles.platformNav}>
          <Link aria-current={!projectId ? "page" : undefined} href="/">
            {labels.home}
          </Link>
          <Link aria-current={projectId ? "page" : undefined} href={projectPath}>
            {labels.studio}
          </Link>
          <Link href="/projects/new">{labels.projects}</Link>
          <Link href="/">{labels.account}</Link>
        </nav>
      </header>
      <div className={styles.shellBody}>
        <div className={styles.moduleHeader}>
          <div
            aria-label={projectId ? "Editor navigation" : undefined}
            className={styles.moduleIdentity}
            role={projectId ? "navigation" : undefined}
          >
            <span className={styles.breadcrumb}>{labels.studio}</span>
            {projectName ? <span>{projectName}</span> : null}
            <strong>{moduleName}</strong>
            {pageLabel ? <span className={styles.breadcrumb}>{pageLabel}</span> : null}
            {pageTitle ? <h1 className={styles.pageTitle}>{pageTitle}</h1> : null}
          </div>
          {headerActions ? <div className={styles.headerActions}>{headerActions}</div> : null}
        </div>
        {showModuleNav && projectId ? (
          <Tabs
            items={moduleItems.map(([id, en, fi]) => ({
              active: activeModule === id,
              href:
                id === "overview"
                  ? `/projects/${projectId}`
                  : id === "setup"
                    ? "/projects/new"
                    : id === "preview"
                      ? `/projects/${projectId}`
                      : id === "publishing"
                        ? `/projects/${projectId}/publish`
                        : `/projects/${projectId}/${id === "editor" ? "editor" : id}`,
              id,
              label: isFinnish ? fi : en,
            }))}
            label={isFinnish ? "Storefront Studio -moduulit" : "Storefront Studio modules"}
          />
        ) : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export type { ModuleId };
