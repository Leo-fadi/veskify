import type { Locale } from "@/domain/shared";

export const storefrontStudioModuleItems = [
  ["overview", "Overview", "Yleiskatsaus"],
  ["setup", "Setup", "Määritykset"],
  ["editor", "Editor", "Editori"],
  ["preview", "Preview", "Esikatselu"],
  ["publishing", "Publishing", "Julkaiseminen"],
  ["history", "History", "Historia"],
] as const;

export type StorefrontStudioModuleId = (typeof storefrontStudioModuleItems)[number][0];

export const storefrontShellCopy = {
  en: {
    home: "Vesko home",
    studio: "Storefront Studio",
    projects: "Projects",
    account: "Account",
    globalNavigation: "Global navigation",
    editorNavigation: "Editor navigation",
    modules: "Storefront Studio modules",
  },
  fi: {
    home: "Vesko-etusivu",
    studio: "Storefront Studio",
    projects: "Projektit",
    account: "Tili",
    globalNavigation: "Yleinen navigointi",
    editorNavigation: "Editorin navigointi",
    modules: "Storefront Studion moduulit",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export const editorCopy = {
  en: {
    navigation: {
      currentPage: "Current page",
      storefrontPage: "Storefront page",
      storefrontPageHint: "Homepage, collection and product pages use their approved sections.",
      viewSelectedPage: "View selected page",
      pagesAndSections: "Pages & sections",
    },
    status: {
      draft: "Draft status",
      publish: "Publish status",
      history: "Edit history",
      saved: "Saved",
      saving: "Saving draft",
      unsaved: "Unsaved changes",
      noUnsaved: "No unsaved changes",
      draftDifferent: "Draft differs from published",
      readyToPublish: "Ready to publish",
      published: "Published",
      storedDraftDiffers: "The stored draft differs from the published storefront.",
      sessionNotice: "Changes stay in this editor session until saved.",
    },
    actions: {
      undo: "Undo",
      redo: "Redo",
      preview: "Preview storefront",
      saveDraft: "Save draft",
      savingDraft: "Saving draft…",
      publish: "Publish changes",
      more: "More",
      openPreview: "Open preview",
      undoTitle: "Undo (Ctrl or Command + Z)",
      redoTitle: "Redo (Ctrl or Command + Shift + Z)",
    },
    tools: {
      label: "Editor tools",
      design: "Design",
      designControls: "Design controls",
      assistant: "AI assistant",
    },
    section: {
      actions: "Selected section actions",
      options: "Section options",
      selected: "Selected section",
      visible: "Visible",
      hidden: "Hidden",
      duplicate: "Duplicate",
      hide: "Hide",
      show: "Show",
    },
    feedback: {
      saving: "Saving your draft… Please wait before making more changes.",
      saved: "Draft saved successfully.",
      saveValidation: "This draft could not be validated. Your changes are still here for review.",
      saveStorage: "The draft could not be saved. Check your browser storage and try again.",
      saveStale:
        "A newer draft was saved elsewhere. Reload before saving; your current changes are still here.",
      saveAttention: "Some changes need attention before this draft can be saved.",
    },
  },
  fi: {
    navigation: {
      currentPage: "Nykyinen sivu",
      storefrontPage: "Kauppasivuston sivu",
      storefrontPageHint: "Etusivu-, kokoelma- ja tuotesivuilla käytetään hyväksyttyjä osioita.",
      viewSelectedPage: "Näytä valittu sivu",
      pagesAndSections: "Sivut ja osiot",
    },
    status: {
      draft: "Luonnoksen tila",
      publish: "Julkaisun tila",
      history: "Muokkaushistoria",
      saved: "Tallennettu",
      saving: "Tallennetaan luonnosta",
      unsaved: "Tallentamattomia muutoksia",
      noUnsaved: "Ei tallentamattomia muutoksia",
      draftDifferent: "Luonnos eroaa julkaistusta",
      readyToPublish: "Valmis julkaistavaksi",
      published: "Julkaistu",
      storedDraftDiffers: "Tallennettu luonnos eroaa julkaistusta verkkokaupasta.",
      sessionNotice: "Muutokset pysyvät tässä muokkausistunnossa, kunnes ne tallennetaan.",
    },
    actions: {
      undo: "Kumoa",
      redo: "Tee uudelleen",
      preview: "Esikatsele kauppaa",
      saveDraft: "Tallenna luonnos",
      savingDraft: "Tallennetaan luonnosta…",
      publish: "Julkaise muutokset",
      more: "Lisää",
      openPreview: "Avaa esikatselu",
      undoTitle: "Kumoa (Ctrl tai Komento + Z)",
      redoTitle: "Tee uudelleen (Ctrl tai Komento + Vaihto + Z)",
    },
    tools: {
      label: "Muokkaustyökalut",
      design: "Suunnittelu",
      designControls: "Suunnittelusäätimet",
      assistant: "Suunnitteluavustaja",
    },
    section: {
      actions: "Valitun osion toiminnot",
      options: "Osion toiminnot",
      selected: "Valittu osio",
      visible: "Näkyvä",
      hidden: "Piilotettu",
      duplicate: "Monista",
      hide: "Piilota",
      show: "Näytä",
    },
    feedback: {
      saving: "Luonnosta tallennetaan… Odota ennen uusien muutosten tekemistä.",
      saved: "Luonnos tallennettiin.",
      saveValidation: "Luonnosta ei voitu tarkistaa. Muutoksesi ovat edelleen tarkistettavina.",
      saveStorage:
        "Luonnosta ei voitu tallentaa. Tarkista selaimen tallennustila ja yritä uudelleen.",
      saveStale:
        "Uudempi luonnos tallennettiin muualla. Lataa sivu uudelleen ennen tallentamista; nykyiset muutoksesi ovat edelleen täällä.",
      saveAttention: "Jotkin muutokset vaativat huomiota ennen luonnoksen tallentamista.",
    },
  },
} as const satisfies Record<Locale, unknown>;
