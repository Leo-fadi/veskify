import { resolveLocalizedText, type Locale } from "@/domain/shared";
import type { PublishChangeSummary } from "@/application/publishing";
import { merchantSectionTypeLabel } from "@/components/registry";
import { publishingCopy } from "./publish-status";

type PageReference = PublishChangeSummary["changedPages"][number];
type SectionReference = PublishChangeSummary["sectionsAdded"][number];

function pageNames(pages: readonly PageReference[], locale: Locale, primaryLocale: Locale): string {
  return pages
    .map((page) => resolveLocalizedText(page.title, locale, primaryLocale))
    .filter(Boolean)
    .join(", ");
}

function sectionNames(
  sections: readonly SectionReference[],
  locale: Locale,
  primaryLocale: Locale,
): string {
  return [
    ...new Set(
      sections.map((section) => {
        const sectionName = merchantSectionTypeLabel(section.component, locale);
        const pageName = resolveLocalizedText(section.pageTitle, locale, primaryLocale);
        return pageName ? `${sectionName} (${pageName})` : sectionName;
      }),
    ),
  ]
    .filter(Boolean)
    .join(", ");
}

export function merchantPublishChanges(
  summary: PublishChangeSummary,
  locale: Locale,
  primaryLocale: Locale,
): string[] {
  const fi = locale === "fi";
  const changes: string[] = [];
  const addedPages = pageNames(summary.pagesAdded, locale, primaryLocale);
  const removedPages = pageNames(summary.pagesRemoved, locale, primaryLocale);
  const addedSections = sectionNames(summary.sectionsAdded, locale, primaryLocale);
  const removedSections = sectionNames(summary.sectionsRemoved, locale, primaryLocale);
  const contentSections = sectionNames(summary.sectionContentChanges, locale, primaryLocale);
  const styledSections = sectionNames(
    [
      ...summary.sectionPropertyChanges,
      ...summary.sectionVariantChanges,
      ...summary.sectionVisibilityChanges,
      ...summary.sectionComponentChanges,
    ],
    locale,
    primaryLocale,
  );
  const themedPages = pageNames(summary.pageThemeOverrideChanges, locale, primaryLocale);
  const reorderedPages = pageNames(summary.sectionOrderChanges, locale, primaryLocale);

  if (addedPages)
    changes.push(fi ? `Lisätyt sivut: ${addedPages}.` : `Added pages: ${addedPages}.`);
  if (removedPages)
    changes.push(fi ? `Poistetut sivut: ${removedPages}.` : `Removed pages: ${removedPages}.`);
  if (summary.pageOrderChanged)
    changes.push(fi ? "Sivujen järjestystä muutettiin." : "Page order was updated.");
  if (addedSections)
    changes.push(fi ? `Lisätyt osiot: ${addedSections}.` : `Added sections: ${addedSections}.`);
  if (removedSections)
    changes.push(
      fi ? `Poistetut osiot: ${removedSections}.` : `Removed sections: ${removedSections}.`,
    );
  if (reorderedPages)
    changes.push(
      fi
        ? `Osioiden järjestystä muutettiin: ${reorderedPages}.`
        : `Section order was updated: ${reorderedPages}.`,
    );
  if (contentSections)
    changes.push(
      fi
        ? `Sisältöä päivitettiin osioissa: ${contentSections}.`
        : `Content was updated in: ${contentSections}.`,
    );
  if (styledSections)
    changes.push(
      fi
        ? `Ulkoasua päivitettiin osioissa: ${styledSections}.`
        : `Visual styling was updated in: ${styledSections}.`,
    );
  if (themedPages)
    changes.push(
      fi
        ? `Sivun yleisilmettä päivitettiin: ${themedPages}.`
        : `Page styling was updated: ${themedPages}.`,
    );
  if (summary.brandSystemChanges.length > 0)
    changes.push(
      fi
        ? "Brändin värejä, typografiaa tai muita tyylejä päivitettiin."
        : "Brand colours, typography, or other styling was updated.",
    );
  if (summary.navigationChanges.length > 0)
    changes.push(fi ? "Navigointia päivitettiin." : "Navigation was updated.");
  if (summary.pageMetadataChanges.length > 0)
    changes.push(fi ? "Sivun tietoja päivitettiin." : "Page details were updated.");

  return changes;
}

export function PublishChangeSummary({
  summary,
  locale,
  primaryLocale,
}: {
  summary: PublishChangeSummary;
  locale: Locale;
  primaryLocale: Locale;
}) {
  const text = publishingCopy(locale);
  const changes = merchantPublishChanges(summary, locale, primaryLocale);
  const affectedPages = pageNames(summary.changedPages, locale, primaryLocale);

  return (
    <section aria-labelledby="publish-change-summary" className="publish-change-summary">
      <h2 id="publish-change-summary">{locale === "fi" ? "Mitä muuttuu" : "What will change"}</h2>
      <p className="publish-change-summary__label">{text.affectedPages}</p>
      <p>{affectedPages || (locale === "fi" ? "Tallennettu verkkokauppa" : "Saved storefront")}</p>
      <ol>
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ol>
    </section>
  );
}
