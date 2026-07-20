"use client";

import { useRef } from "react";
import {
  validateStorefrontGenerationReview,
  type StorefrontGenerationReview,
  type StorefrontGenerationReviewSection,
} from "@/application/storefront-generation-review/contract";
import {
  cataloguePresentation,
  localizedPageType,
  presentAssumptions,
  presentDiagnostics,
  presentFacts,
  type MerchantDiagnostic,
  type ReviewLocale,
} from "./storefront-generation-review-presentation";
import styles from "./storefront-generation-review-panel.module.css";

type Locale = ReviewLocale;

export type StorefrontGenerationReviewPanelProps = {
  review: StorefrontGenerationReview;
  locale: Locale;
  busy?: boolean;
  errorMessage?: string | null;
  onBack: () => void;
  onConfirmCreate: () => void;
};

const sectionStatusLabels: Record<
  Locale,
  Record<StorefrontGenerationReview["sections"][number]["status"], string>
> = {
  en: {
    complete: "Complete",
    warning: "Note",
    blocked: "Needs attention",
    "not-applicable": "Not applicable",
  },
  fi: {
    complete: "Valmis",
    warning: "Huomio",
    blocked: "Vaatii huomiota",
    "not-applicable": "Ei koske tätä suunnitelmaa",
  },
};

const languageLabels: Record<Locale, Record<string, string>> = {
  en: { en: "English", fi: "Finnish" },
  fi: { en: "englanti", fi: "suomi" },
};

const copy = {
  en: {
    back: "Back",
    create: "Create storefront project",
    creating: "Creating project…",
    retry: "Try creating again",
    resolve: "Resolve the items requiring attention before creating the project.",
    ready: "Ready to create",
    readyDescription: "Your storefront plan is ready. Review the notes or create the project.",
    attention: "Needs attention",
    attentionDescription: "Resolve the blockers below before creating the project.",
    blockers: "Blockers",
    warnings: "Warnings",
    notes: "Defaults and notes",
    blocker: "blocker",
    blockersCount: "blockers",
    warning: "warning",
    warningsCount: "warnings",
    note: "note",
    notesCount: "notes",
    jumpToBlockers: "Jump to blockers",
    warningIntro: "These items do not prevent creation, but are worth reviewing.",
    blockerIntro: "These items must be resolved before creation.",
    notesIntro: "Safe defaults and optional omissions used for the first version.",
    pagesEmpty: "No storefront pages were prepared.",
    primary: "Primary language",
    sections: "sections",
    visible: "visible",
    hidden: "hidden",
    path: "Storefront path",
    detailsHint: "Show details",
    reviewSections: "Plan details",
  },
  fi: {
    back: "Takaisin",
    create: "Luo verkkokauppaprojekti",
    creating: "Luodaan projektia…",
    retry: "Yritä luomista uudelleen",
    resolve: "Ratkaise huomiota vaativat kohdat ennen projektin luomista.",
    ready: "Valmis luotavaksi",
    readyDescription: "Verkkokauppasuunnitelmasi on valmis. Tarkista huomiot tai luo projekti.",
    attention: "Vaatii huomiota",
    attentionDescription: "Ratkaise alla olevat estävät kohdat ennen projektin luomista.",
    blockers: "Estävät kohdat",
    warnings: "Varoitukset",
    notes: "Oletukset ja lisätiedot",
    blocker: "estävä kohta",
    blockersCount: "estävää kohtaa",
    warning: "varoitus",
    warningsCount: "varoitusta",
    note: "lisätieto",
    notesCount: "lisätietoa",
    jumpToBlockers: "Siirry estäviin kohtiin",
    warningIntro: "Nämä kohdat eivät estä luomista, mutta ne kannattaa tarkistaa.",
    blockerIntro: "Nämä kohdat on ratkaistava ennen luomista.",
    notesIntro: "Ensimmäisessä versiossa käytetyt turvalliset oletukset ja valinnaiset poisjätöt.",
    pagesEmpty: "Verkkokaupan sivuja ei valmisteltu.",
    primary: "Pääkieli",
    sections: "osiota",
    visible: "näkyvää",
    hidden: "piilotettua",
    path: "Verkkokaupan polku",
    detailsHint: "Näytä tiedot",
    reviewSections: "Suunnitelman tiedot",
  },
} as const;

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function StorefrontGenerationReviewPanel({
  review,
  locale,
  busy = false,
  errorMessage = null,
  onBack,
  onConfirmCreate,
}: StorefrontGenerationReviewPanelProps) {
  const canonicalReview = validateStorefrontGenerationReview(review);
  const text = copy[locale];
  const confirmDisabled = busy || !canonicalReview.canCreateProject;
  const diagnostics = presentDiagnostics(canonicalReview, locale);
  const assumptions = presentAssumptions(canonicalReview, locale);
  const noteCount = diagnostics.notes.length + assumptions.length;
  const blockersRef = useRef<HTMLElement>(null);
  const detailSections = canonicalReview.sections.filter(
    ({ id }) => !["assumptions", "warnings", "blockers"].includes(id),
  );

  const focusBlockers = () => {
    blockersRef.current?.focus();
    blockersRef.current?.scrollIntoView?.({ block: "start" });
  };

  return (
    <section className={styles.panel} aria-busy={busy} aria-labelledby="generation-review-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Veskify</p>
        <h2 id="generation-review-title">{canonicalReview.title[locale]}</h2>
        <p className={styles.summary}>{canonicalReview.summary[locale]}</p>
      </header>

      <section className={styles.readiness} aria-labelledby="readiness-title">
        <div className={styles.readinessMain} role="status">
          <span
            aria-hidden="true"
            className={`${styles.readinessIcon} ${
              canonicalReview.canCreateProject ? styles.readinessReady : styles.readinessBlocked
            }`}
          />
          <div>
            <h3 id="readiness-title">
              {canonicalReview.canCreateProject ? text.ready : text.attention}
            </h3>
            <p>
              {canonicalReview.canCreateProject ? text.readyDescription : text.attentionDescription}
            </p>
          </div>
        </div>
        <ul className={styles.readinessCounts} aria-label={text.reviewSections}>
          <li className={diagnostics.blockers.length ? styles.countBlocked : undefined}>
            {countLabel(diagnostics.blockers.length, text.blocker, text.blockersCount)}
          </li>
          <li className={diagnostics.warnings.length ? styles.countWarning : undefined}>
            {countLabel(diagnostics.warnings.length, text.warning, text.warningsCount)}
          </li>
          <li>{countLabel(noteCount, text.note, text.notesCount)}</li>
        </ul>
        {diagnostics.blockers.length ? (
          <button className={styles.jumpButton} onClick={focusBlockers} type="button">
            {text.jumpToBlockers}
          </button>
        ) : null}
      </section>

      {errorMessage ? (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      ) : null}
      {busy ? (
        <p aria-live="polite" className={styles.visuallyHidden} role="status">
          {text.creating}
        </p>
      ) : null}

      <div className={styles.diagnosticGroups}>
        {diagnostics.blockers.length ? (
          <section
            className={`${styles.diagnosticGroup} ${styles.blockerGroup}`}
            id="review-blockers"
            ref={blockersRef}
            tabIndex={-1}
            aria-labelledby="review-blockers-title"
          >
            <h3 id="review-blockers-title">{text.blockers}</h3>
            <p>{text.blockerIntro}</p>
            <DiagnosticList diagnostics={diagnostics.blockers} />
          </section>
        ) : null}

        {diagnostics.warnings.length ? (
          <section
            className={`${styles.diagnosticGroup} ${styles.warningGroup}`}
            aria-labelledby="review-warnings-title"
          >
            <h3 id="review-warnings-title">{text.warnings}</h3>
            <p>{text.warningIntro}</p>
            <DiagnosticList diagnostics={diagnostics.warnings} />
          </section>
        ) : null}

        {noteCount ? (
          <details className={`${styles.diagnosticGroup} ${styles.noteGroup}`}>
            <summary>
              <span>{text.notes}</span>
              <span className={styles.noteCount}>{noteCount}</span>
            </summary>
            <div className={styles.noteContent}>
              <p>{text.notesIntro}</p>
              {diagnostics.notes.length ? <DiagnosticList diagnostics={diagnostics.notes} /> : null}
              {assumptions.length ? (
                <ul className={styles.assumptionList}>
                  {assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      <div className={styles.sections} aria-label={text.reviewSections}>
        {detailSections.map((reviewSection) => (
          <ReviewSection
            key={reviewSection.id}
            locale={locale}
            review={canonicalReview}
            section={reviewSection}
          />
        ))}
      </div>

      <footer className={styles.actions}>
        <div>
          {!canonicalReview.canCreateProject && !busy ? (
            <p className={styles.disabledCopy}>{text.resolve}</p>
          ) : null}
        </div>
        <div className={styles.actionButtons}>
          <button type="button" className={styles.backButton} onClick={onBack} disabled={busy}>
            {text.back}
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirmCreate}
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled}
          >
            {busy ? text.creating : errorMessage ? text.retry : text.create}
          </button>
        </div>
      </footer>
    </section>
  );
}

function ReviewSection({
  locale,
  review,
  section,
}: {
  locale: Locale;
  review: StorefrontGenerationReview;
  section: StorefrontGenerationReviewSection;
}) {
  const text = copy[locale];
  const catalogue = section.id === "catalogue" ? cataloguePresentation(review, locale) : null;
  const heading = catalogue?.heading ?? section.heading[locale];
  const facts = presentFacts(section, locale);
  const open = section.status === "blocked" || section.status === "warning";

  return (
    <details className={styles.section} open={open}>
      <summary className={styles.sectionHeader}>
        <div>
          <h3 id={`review-section-${section.id}`}>{heading}</h3>
          <p>{catalogue?.title ?? section.summary[locale]}</p>
        </div>
        <span className={`${styles.sectionStatus} ${styles[`section-${section.status}`]}`}>
          {sectionStatusLabels[locale][section.status]}
        </span>
        <span className={styles.detailsHint}>{text.detailsHint}</span>
      </summary>
      <div className={styles.sectionContent}>
        {catalogue ? (
          <p className={styles.catalogueDescription}>{catalogue.description}</p>
        ) : section.id === "storefront-pages" ? (
          review.pageSummaries.length ? (
            <div className={styles.pageList}>
              {review.pageSummaries.map((page) => (
                <article className={styles.pageCard} key={page.id}>
                  <h4>{localizedPageType(page.type, locale)}</h4>
                  <p>
                    <span className={styles.visuallyHidden}>{text.path}: </span>
                    {page.path}
                  </p>
                  <p>
                    {page.totalSectionCount} {text.sections} · {page.visibleSectionCount}{" "}
                    {text.visible}
                    {page.hiddenSectionCount ? ` · ${page.hiddenSectionCount} ${text.hidden}` : ""}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{text.pagesEmpty}</p>
          )
        ) : section.id === "languages" ? (
          <ul className={styles.factList}>
            {review.languagePlan.selectedLanguages.map((language) => (
              <li key={language}>
                {languageLabels[locale][language]}
                {review.languagePlan.primaryLanguage === language ? ` — ${text.primary}` : ""}
              </li>
            ))}
          </ul>
        ) : facts.length ? (
          <dl className={styles.facts}>
            {facts.map((fact) => (
              <div key={fact.key}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </details>
  );
}

function DiagnosticList({ diagnostics }: { diagnostics: MerchantDiagnostic[] }) {
  return (
    <ul className={styles.diagnosticList}>
      {diagnostics.map((diagnostic) => (
        <li key={diagnostic.key}>
          <strong>{diagnostic.title}</strong>
          <span>{diagnostic.message}</span>
        </li>
      ))}
    </ul>
  );
}
