"use client";

import {
  validateStorefrontGenerationReview,
  type StorefrontGenerationReview,
} from "@/application/storefront-generation-review/contract";
import styles from "./storefront-generation-review-panel.module.css";

type Locale = "en" | "fi";

export type StorefrontGenerationReviewPanelProps = {
  review: StorefrontGenerationReview;
  locale: Locale;
  busy?: boolean;
  errorMessage?: string | null;
  onBack: () => void;
  onConfirmCreate: () => void;
};

const statusLabels: Record<Locale, Record<StorefrontGenerationReview["status"], string>> = {
  en: { ready: "Ready", "ready-with-warnings": "Ready with notes", blocked: "Needs attention" },
  fi: { ready: "Valmis", "ready-with-warnings": "Valmis huomioilla", blocked: "Vaatii huomiota" },
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

const pageTypeLabels: Record<Locale, Record<string, string>> = {
  en: {
    home: "Home",
    collection: "Collection",
    product: "Product",
    content: "Content",
    cart: "Cart",
    checkout: "Checkout",
    landing: "Landing page",
  },
  fi: {
    home: "Etusivu",
    collection: "Kokoelma",
    product: "Tuote",
    content: "Sisältösivu",
    cart: "Ostoskori",
    checkout: "Kassasivu",
    landing: "Kampanjasivu",
  },
};

const languageLabels: Record<Locale, Record<string, string>> = {
  en: { en: "English", fi: "Finnish" },
  fi: { en: "englanti", fi: "suomi" },
};

const catalogueLabels: Record<Locale, Record<string, string>> = {
  en: {
    "existing-vesko-catalogue": "Existing Vesko catalogue",
    "controlled-demo-catalogue": "Demo catalogue",
    "empty-catalogue": "Empty catalogue",
  },
  fi: {
    "existing-vesko-catalogue": "Olemassa oleva Vesko-tuoteluettelo",
    "controlled-demo-catalogue": "Demotuoteluettelo",
    "empty-catalogue": "Tyhjä tuoteluettelo",
  },
};

const copy = {
  en: {
    back: "Back",
    create: "Create storefront project",
    creating: "Creating project…",
    resolve: "Resolve the items requiring attention before creating the project.",
    assumptionsEmpty: "No additional assumptions are required.",
    warningsEmpty: "No warnings were reported.",
    blockersEmpty: "There are no blockers.",
    pagesEmpty: "No storefront pages were materialized.",
    primary: "Primary language",
    sections: "sections",
    visible: "visible",
    hidden: "hidden",
    warningIntro: "Review these notes before continuing.",
    blockerIntro: "Resolve these items before creating the project.",
    notSpecified: "Not specified",
  },
  fi: {
    back: "Takaisin",
    create: "Luo verkkokauppaprojekti",
    creating: "Luodaan projektia…",
    resolve: "Ratkaise huomiota vaativat kohdat ennen projektin luomista.",
    assumptionsEmpty: "Muita oletuksia ei tarvita.",
    warningsEmpty: "Huomautuksia ei ilmoitettu.",
    blockersEmpty: "Estäviä tekijöitä ei ole.",
    pagesEmpty: "Kaupan sivuja ei muodostettu.",
    primary: "Pääkieli",
    sections: "osiota",
    visible: "näkyvää",
    hidden: "piilotettua",
    warningIntro: "Tarkista nämä huomautukset ennen jatkamista.",
    blockerIntro: "Ratkaise nämä kohdat ennen projektin luomista.",
    notSpecified: "Ei määritetty",
  },
} as const;

function humanize(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  return (
    <main className={styles.panel} aria-busy={busy} aria-labelledby="generation-review-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Veskify</p>
        <h1 id="generation-review-title">{canonicalReview.title[locale]}</h1>
        <p className={styles.summary}>{canonicalReview.summary[locale]}</p>
        <p
          className={`${styles.overallStatus} ${styles[`status-${canonicalReview.status}`]}`}
          role="status"
        >
          {statusLabels[locale][canonicalReview.status]}
        </p>
      </header>

      {errorMessage ? (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className={styles.sections}>
        {canonicalReview.sections.map((reviewSection) => (
          <section
            className={styles.section}
            key={reviewSection.id}
            aria-labelledby={`review-section-${reviewSection.id}`}
          >
            <div className={styles.sectionHeader}>
              <div>
                <h2 id={`review-section-${reviewSection.id}`}>{reviewSection.heading[locale]}</h2>
                <p>{reviewSection.summary[locale]}</p>
              </div>
              <span
                className={`${styles.sectionStatus} ${styles[`section-${reviewSection.status}`]}`}
              >
                {sectionStatusLabels[locale][reviewSection.status]}
              </span>
            </div>

            {reviewSection.id === "storefront-pages" ? (
              canonicalReview.pageSummaries.length ? (
                <div className={styles.pageList}>
                  {canonicalReview.pageSummaries.map((page) => (
                    <article className={styles.pageCard} key={page.id}>
                      <h3>{pageTypeLabels[locale][page.type] ?? humanize(page.type)}</h3>
                      <p>{page.path}</p>
                      <p>
                        {page.totalSectionCount} {text.sections} · {page.visibleSectionCount}{" "}
                        {text.visible} · {page.hiddenSectionCount} {text.hidden}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>{text.pagesEmpty}</p>
              )
            ) : reviewSection.id === "languages" ? (
              <ul className={styles.factList}>
                {canonicalReview.languagePlan.selectedLanguages.map((language) => (
                  <li key={language}>
                    {languageLabels[locale][language] ?? humanize(language)}
                    {canonicalReview.languagePlan.primaryLanguage === language
                      ? ` — ${text.primary}`
                      : ""}
                  </li>
                ))}
                {!canonicalReview.languagePlan.selectedLanguages.length ? (
                  <li>{text.notSpecified}</li>
                ) : null}
              </ul>
            ) : reviewSection.id === "catalogue" ? (
              <p className={styles.catalogueValue}>
                {canonicalReview.catalogueContext
                  ? catalogueLabels[locale][canonicalReview.catalogueContext]
                  : text.notSpecified}
              </p>
            ) : reviewSection.id === "assumptions" ? (
              canonicalReview.assumptions.length ? (
                <ul className={styles.factList}>
                  {canonicalReview.assumptions.map((assumption, index) => (
                    <li key={`${index}-${assumption.en}`}>{assumption[locale]}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>{text.assumptionsEmpty}</p>
              )
            ) : reviewSection.id === "warnings" ? (
              canonicalReview.warnings.length ? (
                <>
                  <p className={styles.supportingCopy}>{text.warningIntro}</p>
                  <DiagnosticList
                    diagnostics={canonicalReview.warnings}
                    locale={locale}
                    tone="warning"
                  />
                </>
              ) : (
                <p className={styles.empty}>{text.warningsEmpty}</p>
              )
            ) : reviewSection.id === "blockers" ? (
              canonicalReview.blockers.length ? (
                <>
                  <p className={styles.supportingCopy}>{text.blockerIntro}</p>
                  <DiagnosticList
                    diagnostics={canonicalReview.blockers}
                    locale={locale}
                    tone="blocked"
                  />
                </>
              ) : (
                <p className={styles.empty}>{text.blockersEmpty}</p>
              )
            ) : reviewSection.facts.filter((item) => !["brief-id", "foundation"].includes(item.id))
                .length ? (
              <dl className={styles.facts}>
                {reviewSection.facts
                  .filter((item) => !["brief-id", "foundation"].includes(item.id))
                  .map((item) => (
                    <div key={item.id}>
                      <dt>{item.label[locale]}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
              </dl>
            ) : null}
          </section>
        ))}
      </div>

      {!canonicalReview.canCreateProject && !busy ? (
        <p className={styles.disabledCopy}>{text.resolve}</p>
      ) : null}
      <footer className={styles.actions}>
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
          {busy ? text.creating : text.create}
        </button>
      </footer>
    </main>
  );
}

function DiagnosticList({
  diagnostics,
  locale,
  tone,
}: {
  diagnostics: StorefrontGenerationReview["warnings"];
  locale: Locale;
  tone: "warning" | "blocked";
}) {
  return (
    <ul className={`${styles.diagnosticList} ${styles[`diagnostic-${tone}`]}`}>
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.stage}-${diagnostic.code}-${index}`}>
          <strong>{diagnostic.context[locale]}</strong>
          <span>{diagnostic.message}</span>
        </li>
      ))}
    </ul>
  );
}
