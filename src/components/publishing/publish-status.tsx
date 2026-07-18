import type { ReactNode } from "react";
import type { Locale } from "@/domain/shared";

export type PublishingCopy = {
  localeName: string;
  title: string;
  savedDraftOnly: string;
  reviewPublish: string;
  reviewLatest: string;
  preparing: string;
  publishStorefront: string;
  publishing: string;
  cancel: string;
  editor: string;
  versionHistory: string;
  publishedStorefront: string;
  affectedPages: string;
  draftRevision: string;
  publishedRevision: string;
  noChangesTitle: string;
  noChangesMessage: string;
  confirmationTitle: string;
  confirmationWarning: string;
  confirmationPublishedUntil: string;
  successTitle: string;
  successMessage: (revision: number) => string;
  successDraft: string;
};

const copy: Record<Locale, PublishingCopy> = {
  en: {
    localeName: "English",
    title: "Publish storefront",
    savedDraftOnly:
      "Only the last saved draft can be published. Changes still open in the editor are not included.",
    reviewPublish: "Review publish",
    reviewLatest: "Review latest draft",
    preparing: "Reviewing your saved draft…",
    publishStorefront: "Publish storefront",
    publishing: "Publishing storefront…",
    cancel: "Cancel and return to editor",
    editor: "Back to editor",
    versionHistory: "Version history",
    publishedStorefront: "View published storefront",
    affectedPages: "Affected pages",
    draftRevision: "Saved draft revision",
    publishedRevision: "Current published revision",
    noChangesTitle: "No saved changes to publish",
    noChangesMessage:
      "Your saved draft already matches the published storefront. Save a change in the editor before reviewing again.",
    confirmationTitle: "Confirm publication",
    confirmationWarning: "Publishing updates the live storefront for this project.",
    confirmationPublishedUntil: "The current storefront stays published until you confirm below.",
    successTitle: "Storefront published successfully",
    successMessage: (revision) => `Your storefront is now published as revision ${revision}.`,
    successDraft: "A matching clean saved draft is ready for your next edits.",
  },
  fi: {
    localeName: "Suomi",
    title: "Julkaise verkkokauppa",
    savedDraftOnly:
      "Vain viimeksi tallennettu luonnos voidaan julkaista. Editorissa vielä tallentamattomat muutokset eivät tule mukaan.",
    reviewPublish: "Tarkista julkaisu",
    reviewLatest: "Tarkista uusin luonnos",
    preparing: "Tarkistetaan tallennettua luonnosta…",
    publishStorefront: "Julkaise verkkokauppa",
    publishing: "Julkaistaan verkkokauppaa…",
    cancel: "Peruuta ja palaa editoriin",
    editor: "Palaa editoriin",
    versionHistory: "Versiohistoria",
    publishedStorefront: "Näytä julkaistu verkkokauppa",
    affectedPages: "Sivut, joihin muutos vaikuttaa",
    draftRevision: "Tallennetun luonnoksen versio",
    publishedRevision: "Nykyinen julkaistu versio",
    noChangesTitle: "Ei tallennettuja julkaistavia muutoksia",
    noChangesMessage:
      "Tallennettu luonnoksesi vastaa jo julkaistua verkkokauppaa. Tallenna muutos editorissa ennen uutta tarkistusta.",
    confirmationTitle: "Vahvista julkaisu",
    confirmationWarning: "Julkaisu päivittää tämän projektin näkyvän verkkokaupan.",
    confirmationPublishedUntil:
      "Nykyinen verkkokauppa pysyy julkaistuna, kunnes vahvistat julkaisun alla.",
    successTitle: "Verkkokauppa julkaistiin onnistuneesti",
    successMessage: (revision) => `Verkkokauppasi on nyt julkaistu versiona ${revision}.`,
    successDraft:
      "Samaa sisältöä vastaava puhdas tallennettu luonnos on valmiina seuraavia muutoksia varten.",
  },
};

export function publishingCopy(locale: Locale): PublishingCopy {
  return copy[locale];
}

export function PublishStatus({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section aria-live="polite" className="publish-status" role="status">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
