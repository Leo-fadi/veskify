import type {
  StorefrontGenerationReview,
  StorefrontGenerationReviewDiagnostic,
  StorefrontGenerationReviewFact,
  StorefrontGenerationReviewSection,
} from "@/application/storefront-generation-review/contract";

export type ReviewLocale = "en" | "fi";
type LocalizedCopy = Readonly<Record<ReviewLocale, string>>;

export type MerchantDiagnostic = Readonly<{
  key: string;
  title: string;
  message: string;
  tone: "blocker" | "warning" | "note";
}>;

export type MerchantFact = Readonly<{ key: string; label: string; value: string }>;

const copy = (en: string, fi: string): LocalizedCopy => ({ en, fi });

const diagnosticCopy: Record<
  string,
  Readonly<{
    title: LocalizedCopy;
    message: LocalizedCopy;
    tone?: MerchantDiagnostic["tone"];
    grouped?: boolean;
  }>
> = {
  EXISTING_CATALOGUE_REFERENCE_UNRESOLVED: {
    title: copy("Connect your catalogue", "Yhdistä tuoteluettelosi"),
    message: copy(
      "We could not connect the selected Vesko catalogue yet. Choose another catalogue plan or connect it before creating the project.",
      "Valittua Vesko-tuoteluetteloa ei voitu vielä yhdistää. Valitse toinen tuoteluettelosuunnitelma tai yhdistä luettelo ennen projektin luomista.",
    ),
  },
  OPTIONAL_CAPABILITY_UNAVAILABLE: {
    title: copy("Optional storefront content", "Valinnainen verkkokaupan sisältö"),
    message: copy(
      "Optional content was not provided, so the storefront will use a polished default.",
      "Valinnaista sisältöä ei annettu, joten verkkokauppa käyttää viimeisteltyä oletusta.",
    ),
  },
  EMPTY_CATALOGUE_MERCHANDISING: {
    title: copy("Products can be added later", "Tuotteet voi lisätä myöhemmin"),
    message: copy(
      "Product areas will show a clear empty state until catalogue items are added.",
      "Tuotealueilla näytetään selkeä tyhjä tila, kunnes tuoteluetteloon lisätään tuotteita.",
    ),
    tone: "note",
    grouped: true,
  },
  DEMO_CATALOGUE_CONTENT: {
    title: copy("Demo products are included", "Demotuotteet ovat mukana"),
    message: copy(
      "The storefront will use controlled demo products until your own catalogue is connected.",
      "Verkkokauppa käyttää hallittuja demotuotteita, kunnes oma tuoteluettelosi yhdistetään.",
    ),
    grouped: true,
  },
  "optional-slot-omitted": {
    title: copy("Optional sections", "Valinnaiset osiot"),
    message: copy(
      "Optional sections that were not requested or did not have content were left out of the first version.",
      "Ensimmäisestä versiosta jätettiin pois valinnaiset osiot, joita ei pyydetty tai joille ei ollut sisältöä.",
    ),
    tone: "note",
  },
  "preferred-colour-low-contrast": {
    title: copy("Accessible brand colours", "Saavutettavat brändivärit"),
    message: copy(
      "A preferred colour was moved to a supporting role to keep text and controls easy to read.",
      "Toivottu väri siirrettiin tukevaksi väriksi, jotta teksti ja hallintaelementit säilyvät helppolukuisina.",
    ),
    grouped: true,
  },
  "accessibility-colour-adjustment": {
    title: copy("Readable colour contrast", "Luettava värikontrasti"),
    message: copy(
      "Text and surface colours were adjusted to keep the storefront easy to read.",
      "Tekstin ja pintojen värejä säädettiin, jotta verkkokauppa säilyy helppolukuisena.",
    ),
    grouped: true,
  },
  "missing-creation-context": {
    title: copy("Choose how to start", "Valitse aloitustapa"),
    message: copy(
      "Choose whether this is a new storefront, a redesign or a demo.",
      "Valitse, onko kyseessä uusi verkkokauppa, uudistus vai demo.",
    ),
  },
  "missing-industry": {
    title: copy("Add your industry", "Lisää toimiala"),
    message: copy(
      "Choose your business industry so we can prepare a suitable storefront.",
      "Valitse yrityksesi toimiala, jotta voimme valmistella sopivan verkkokaupan.",
    ),
  },
  "missing-home-page": {
    title: copy("Add the homepage", "Lisää etusivu"),
    message: copy("Keep the required homepage selected.", "Pidä vaadittu etusivu valittuna."),
  },
  "missing-collection-page": {
    title: copy("Add the collection page", "Lisää kokoelmasivu"),
    message: copy(
      "Keep the required collection page selected.",
      "Pidä vaadittu kokoelmasivu valittuna.",
    ),
  },
  "missing-product-page": {
    title: copy("Add the product page", "Lisää tuotesivu"),
    message: copy("Keep the required product page selected.", "Pidä vaadittu tuotesivu valittuna."),
  },
  "missing-catalogue-context": {
    title: copy("Choose a catalogue plan", "Valitse tuoteluettelosuunnitelma"),
    message: copy(
      "Choose an existing, demo or empty catalogue plan.",
      "Valitse olemassa oleva, demo- tai tyhjä tuoteluettelosuunnitelma.",
    ),
  },
  "unknown-template-override": {
    title: copy("Choose another storefront layout", "Valitse toinen verkkokaupan asettelu"),
    message: copy(
      "Your preferred layout is not available. Return to the previous choices and select another option.",
      "Toivomaasi asettelua ei ole saatavilla. Palaa aiempiin valintoihin ja valitse toinen vaihtoehto.",
    ),
  },
  "incompatible-template-override": {
    title: copy("Choose a compatible layout", "Valitse yhteensopiva asettelu"),
    message: copy(
      "The preferred layout does not support the current storefront plan.",
      "Toivottu asettelu ei tue nykyistä verkkokauppasuunnitelmaa.",
    ),
  },
  "no-compatible-template": {
    title: copy("Adjust the storefront plan", "Muokkaa verkkokauppasuunnitelmaa"),
    message: copy(
      "No available layout supports all current choices yet.",
      "Mikään saatavilla oleva asettelu ei vielä tue kaikkia nykyisiä valintoja.",
    ),
  },
  TEMPLATE_NOT_FOUND: {
    title: copy("Storefront layout unavailable", "Verkkokaupan asettelu ei ole saatavilla"),
    message: copy(
      "The selected layout is no longer available. Choose another layout.",
      "Valittu asettelu ei ole enää saatavilla. Valitse toinen asettelu.",
    ),
  },
  UNSUPPORTED_CATALOGUE_CONTEXT: {
    title: copy("Choose another catalogue plan", "Valitse toinen tuoteluettelosuunnitelma"),
    message: copy(
      "The selected layout does not support this catalogue plan.",
      "Valittu asettelu ei tue tätä tuoteluettelosuunnitelmaa.",
    ),
  },
  UNSUPPORTED_REQUESTED_PAGE: {
    title: copy("Choose a supported page", "Valitse tuettu sivu"),
    message: copy(
      "The selected layout does not support one of the requested pages.",
      "Valittu asettelu ei tue yhtä pyydetyistä sivuista.",
    ),
  },
  MISSING_REQUIRED_CAPABILITY: {
    title: copy("Complete the required choices", "Täydennä vaaditut valinnat"),
    message: copy(
      "The selected layout needs information that is still missing from the plan.",
      "Valittu asettelu tarvitsee tietoja, jotka puuttuvat vielä suunnitelmasta.",
    ),
  },
  "blocked-template-selection": {
    title: copy("Storefront layout needs attention", "Verkkokaupan asettelu vaatii huomiota"),
    message: copy(
      "Resolve the layout choices before creating the project.",
      "Ratkaise asetteluvalinnat ennen projektin luomista.",
    ),
  },
  "missing-selected-template": {
    title: copy("Choose a storefront layout", "Valitse verkkokaupan asettelu"),
    message: copy(
      "A storefront layout must be selected before creation.",
      "Verkkokaupan asettelu on valittava ennen luomista.",
    ),
  },
  "section-materialization-failed": {
    title: copy("Storefront preview needs attention", "Verkkokaupan esikatselu vaatii huomiota"),
    message: copy(
      "We could not prepare every planned section. Review the plan and try again.",
      "Kaikkia suunniteltuja osioita ei voitu valmistella. Tarkista suunnitelma ja yritä uudelleen.",
    ),
  },
};

function fallbackDiagnostic(
  diagnostic: StorefrontGenerationReviewDiagnostic,
  locale: ReviewLocale,
  tone: MerchantDiagnostic["tone"],
): Pick<MerchantDiagnostic, "title" | "message"> {
  const stage =
    diagnostic.stage === "brand-foundation"
      ? copy("Brand direction", "Brändisuunta")
      : diagnostic.stage === "template-selection"
        ? copy("Storefront layout", "Verkkokaupan asettelu")
        : copy("Storefront pages", "Verkkokaupan sivut");
  const message =
    tone === "blocker"
      ? copy(
          "Review this item before creating the storefront project.",
          "Tarkista tämä kohta ennen verkkokauppaprojektin luomista.",
        )
      : tone === "warning"
        ? copy(
            "The storefront is ready, but this choice is worth reviewing.",
            "Verkkokauppa on valmis, mutta tämä valinta kannattaa tarkistaa.",
          )
        : copy(
            "A safe default was used for this part of the storefront.",
            "Tässä verkkokaupan osassa käytettiin turvallista oletusta.",
          );
  return { title: stage[locale], message: message[locale] };
}

function diagnosticTone(
  diagnostic: StorefrontGenerationReviewDiagnostic,
): MerchantDiagnostic["tone"] {
  const mapped = diagnosticCopy[diagnostic.code];
  if (mapped?.tone) return mapped.tone;
  if (diagnostic.severity === "blocker") return "blocker";
  if (diagnostic.severity === "warning") return "warning";
  return "note";
}

function optionalCapabilityCopy(
  message: string,
  locale: ReviewLocale,
): Pick<MerchantDiagnostic, "title" | "message"> | null {
  if (/without logo-available/i.test(message)) {
    return {
      title: copy("Logo can be added later", "Logon voi lisätä myöhemmin")[locale],
      message: copy(
        "A polished text-based brand treatment will be used until you add a logo.",
        "Viimeisteltyä tekstipohjaista brändi-ilmettä käytetään, kunnes lisäät logon.",
      )[locale],
    };
  }
  if (/without supporting-imagery-available/i.test(message)) {
    return {
      title: copy("Supporting imagery", "Tukikuvat")[locale],
      message: copy(
        "The storefront will use its recommended image treatment until supporting images are added.",
        "Verkkokauppa käyttää suositeltua kuvatyyliä, kunnes tukikuvia lisätään.",
      )[locale],
    };
  }
  if (/without catalogue-available/i.test(message)) {
    return {
      title: copy("Catalogue content", "Tuoteluettelon sisältö")[locale],
      message: copy(
        "Product areas will use the selected catalogue plan until your own catalogue is connected.",
        "Tuotealueet käyttävät valittua tuoteluettelosuunnitelmaa, kunnes oma tuoteluettelosi yhdistetään.",
      )[locale],
    };
  }
  return null;
}

function optionalSlotCopy(
  message: string,
  locale: ReviewLocale,
): Pick<MerchantDiagnostic, "title" | "message"> | null {
  const mappings = [
    {
      match: /home\/announcement/i,
      value: copy("Announcement bar", "Ilmoituspalkki"),
      message: copy(
        "The announcement bar was not added because it was not selected.",
        "Ilmoituspalkkia ei lisätty, koska sitä ei valittu.",
      ),
    },
    {
      match: /home\/newsletter/i,
      value: copy("Newsletter section", "Uutiskirjeosio"),
      message: copy(
        "The newsletter section was not added because it was not selected.",
        "Uutiskirjeosiota ei lisätty, koska sitä ei valittu.",
      ),
    },
    {
      match: /product\/product-options/i,
      value: copy("Product options", "Tuotevalinnat"),
      message: copy(
        "Product options were not added because they were not requested.",
        "Tuotevalintoja ei lisätty, koska niitä ei pyydetty.",
      ),
    },
  ] as const;
  const mapping = mappings.find(({ match }) => match.test(message));
  return mapping ? { title: mapping.value[locale], message: mapping.message[locale] } : null;
}

export function presentDiagnostics(
  review: StorefrontGenerationReview,
  locale: ReviewLocale,
): Readonly<{
  blockers: MerchantDiagnostic[];
  warnings: MerchantDiagnostic[];
  notes: MerchantDiagnostic[];
}> {
  const seen = new Set<string>();
  const presented: MerchantDiagnostic[] = [];

  review.sourceDiagnostics.forEach((diagnostic) => {
    const mapped = diagnosticCopy[diagnostic.code];
    const key = mapped?.grouped ? diagnostic.code : `${diagnostic.code}:${diagnostic.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    const tone = diagnosticTone(diagnostic);
    const fallback = fallbackDiagnostic(diagnostic, locale, tone);
    const capabilityCopy =
      diagnostic.code === "OPTIONAL_CAPABILITY_UNAVAILABLE"
        ? optionalCapabilityCopy(diagnostic.message, locale)
        : null;
    const slotCopy =
      diagnostic.code === "optional-slot-omitted"
        ? optionalSlotCopy(diagnostic.message, locale)
        : null;
    presented.push({
      key,
      tone,
      title: slotCopy?.title ?? capabilityCopy?.title ?? mapped?.title[locale] ?? fallback.title,
      message:
        slotCopy?.message ?? capabilityCopy?.message ?? mapped?.message[locale] ?? fallback.message,
    });
  });

  return {
    blockers: presented.filter(({ tone }) => tone === "blocker"),
    warnings: presented.filter(({ tone }) => tone === "warning"),
    notes: presented.filter(({ tone }) => tone === "note"),
  };
}

const blockedSectionCopy: Partial<
  Record<
    StorefrontGenerationReviewSection["id"],
    Readonly<{ title: LocalizedCopy; message: LocalizedCopy }>
  >
> = {
  languages: {
    title: copy("Choose storefront languages", "Valitse verkkokaupan kielet"),
    message: copy(
      "Select at least one storefront language and choose its primary language.",
      "Valitse vähintään yksi verkkokaupan kieli ja määritä sille pääkieli.",
    ),
  },
  business: {
    title: copy("Complete your business information", "Täydennä yrityksesi tiedot"),
    message: copy(
      "Complete the required business information before creating the project.",
      "Täydennä vaaditut yritystiedot ennen projektin luomista.",
    ),
  },
  "brand-foundation": {
    title: copy("Review the brand direction", "Tarkista brändisuunta"),
    message: copy(
      "The brand direction still contains an item that needs attention.",
      "Brändisuunnassa on vielä huomiota vaativa kohta.",
    ),
  },
  "storefront-template": {
    title: copy("Review the storefront layout", "Tarkista verkkokaupan asettelu"),
    message: copy(
      "The storefront layout still contains an item that needs attention.",
      "Verkkokaupan asettelussa on vielä huomiota vaativa kohta.",
    ),
  },
  "storefront-pages": {
    title: copy("Review the storefront pages", "Tarkista verkkokaupan sivut"),
    message: copy(
      "The planned storefront pages still contain an item that needs attention.",
      "Suunnitelluissa verkkokaupan sivuissa on vielä huomiota vaativa kohta.",
    ),
  },
  catalogue: {
    title: copy("Review the catalogue plan", "Tarkista tuoteluettelosuunnitelma"),
    message: copy(
      "The catalogue plan still contains an item that needs attention.",
      "Tuoteluettelosuunnitelmassa on vielä huomiota vaativa kohta.",
    ),
  },
};

export function presentCreationAttention(
  review: StorefrontGenerationReview,
  locale: ReviewLocale,
): Readonly<{ blockers: MerchantDiagnostic[]; hasUncountedAttention: boolean }> {
  const explicitBlockers = presentDiagnostics(review, locale).blockers;
  const explicitBlockerCodes = new Set(
    review.sourceDiagnostics
      .filter(({ severity }) => severity === "blocker")
      .map(({ code }) => code),
  );
  const sectionBlockers = review.sections
    .filter(
      (section) =>
        section.status === "blocked" &&
        !["assumptions", "warnings", "blockers"].includes(section.id) &&
        !section.diagnosticCodes.some((code) => explicitBlockerCodes.has(code)),
    )
    .map((section): MerchantDiagnostic => {
      const mapped = blockedSectionCopy[section.id];
      return {
        key: `blocked-section:${section.id}`,
        tone: "blocker",
        title: mapped?.title[locale] ?? section.heading[locale],
        message:
          mapped?.message[locale] ??
          copy(
            "Complete the required information in this section before creating the project.",
            "Täydennä tämän osion vaaditut tiedot ennen projektin luomista.",
          )[locale],
      };
    });
  const blockers = [...explicitBlockers, ...sectionBlockers];
  return {
    blockers,
    hasUncountedAttention: !review.canCreateProject && blockers.length === 0,
  };
}

const assumptionCopy: ReadonlyArray<Readonly<{ match: RegExp; value: LocalizedCopy }>> = [
  {
    match: /foundation was selected from the available business context/i,
    value: copy(
      "We selected a suitable visual foundation from your business information.",
      "Valitsimme yrityksesi tietojen perusteella sopivan visuaalisen perustan.",
    ),
  },
  {
    match: /preset typography was kept/i,
    value: copy(
      "The recommended font pairing is used because no typography preference was provided.",
      "Suositeltua fonttiparia käytetään, koska typografiatoivetta ei annettu.",
    ),
  },
  {
    match: /preset imagery direction was kept/i,
    value: copy(
      "The recommended image style is used because no imagery preference was provided.",
      "Suositeltua kuvatyyliä käytetään, koska kuvatoivetta ei annettu.",
    ),
  },
  {
    match: /preset colour roles were used/i,
    value: copy(
      "An accessible colour palette is used because no brand colours were provided.",
      "Saavutettavaa väripalettia käytetään, koska brändivärejä ei annettu.",
    ),
  },
  {
    match: /optional visual preferences use/i,
    value: copy(
      "Unspecified visual preferences use balanced defaults.",
      "Määrittämättömät visuaaliset valinnat käyttävät tasapainoisia oletuksia.",
    ),
  },
  {
    match: /template selection does not create/i,
    value: copy(
      "Your choices were reviewed before any storefront content was created.",
      "Valintasi tarkistettiin ennen verkkokaupan sisällön luomista.",
    ),
  },
  {
    match: /high contrast takes priority/i,
    value: copy(
      "Readability takes priority where high contrast is needed.",
      "Luettavuus on etusijalla kohdissa, joissa tarvitaan suurta kontrastia.",
    ),
  },
  {
    match: /registered component defaults provide controlled presentation content/i,
    value: copy(
      "Approved storefront components use controlled starter content that you can edit later.",
      "Hyväksytyt verkkokaupan osiot käyttävät hallittua aloitussisältöä, jota voit muokata myöhemmin.",
    ),
  },
  {
    match: /merchant-authored copy.*primary locale.*no translation/i,
    value: copy(
      "Merchant-provided text is kept in its original language and is not translated automatically.",
      "Kauppiaan lisäämä teksti säilytetään alkuperäisellä kielellä, eikä sitä käännetä automaattisesti.",
    ),
  },
  {
    match: /(?:localized|locale-specific).*copy.*(?:fallback|unavailable|missing)/i,
    value: copy(
      "When localized text is unavailable, the primary-language text is shown instead.",
      "Kun lokalisoitua tekstiä ei ole saatavilla, sen sijaan näytetään pääkielen teksti.",
    ),
  },
  {
    match: /(?:missing|unavailable).*locale-specific.*merchant.*content/i,
    value: copy(
      "Some merchant-provided content is not available in every selected language.",
      "Osa kauppiaan lisäämästä sisällöstä ei ole saatavilla kaikilla valituilla kielillä.",
    ),
  },
  {
    match: /no project, snapshot, page, or section is persisted/i,
    value: copy(
      "Reviewing this plan does not create or save the storefront project.",
      "Tämän suunnitelman tarkistaminen ei luo tai tallenna verkkokauppaprojektia.",
    ),
  },
];

const harmlessDefaultPattern =
  /\b(?:safe|harmless|controlled|recommended) default\b|\bdefault is used\b|\bno preference was provided\b/i;

function sanitizeAssumption(value: string): string {
  const normalized = value
    .replace(/\b[a-z0-9]+(?:[_/-][a-z0-9]+)+\b/gi, (token) => token.replace(/[_/-]+/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  const sentence = `${normalized.charAt(0).toLocaleUpperCase()}${normalized.slice(1)}`;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function presentUnknownAssumption(
  assumption: StorefrontGenerationReview["assumptions"][number],
  locale: ReviewLocale,
): string {
  if (harmlessDefaultPattern.test(assumption.en)) {
    return copy(
      "A safe storefront default was used where no preference was provided.",
      "Turvallista verkkokaupan oletusta käytettiin kohdassa, johon ei annettu toivetta.",
    )[locale];
  }
  const localized = assumption[locale] === assumption.en ? assumption.en : assumption[locale];
  const sanitized = sanitizeAssumption(localized);
  if (locale === "en" || assumption.fi !== assumption.en) {
    return sanitized || "A storefront plan limitation needs review.";
  }
  return sanitized
    ? `Tarkista tämä verkkokauppasuunnitelman rajoitus: ${sanitized}`
    : "Verkkokauppasuunnitelman rajoitus on tarkistettava.";
}

export function presentAssumptions(
  review: StorefrontGenerationReview,
  locale: ReviewLocale,
): string[] {
  const values = review.assumptions.map((assumption) => {
    const mapped = assumptionCopy.find(({ match }) => match.test(assumption.en));
    return mapped?.value[locale] ?? presentUnknownAssumption(assumption, locale);
  });
  return [...new Set(values)];
}

const pageTypeLabels: Record<ReviewLocale, Record<string, string>> = {
  en: {
    home: "Home",
    collection: "Collection",
    product: "Product",
    about: "About",
    contact: "Contact",
    faq: "FAQ",
    policy: "Policies",
    content: "Content",
  },
  fi: {
    home: "Etusivu",
    collection: "Kokoelma",
    product: "Tuote",
    about: "Tietoa meistä",
    contact: "Yhteystiedot",
    faq: "Usein kysytyt kysymykset",
    policy: "Ehdot",
    content: "Sisältösivu",
  },
};

const industryLabels: Record<ReviewLocale, Record<string, string>> = {
  en: {
    jewellery: "Jewellery",
    watches: "Watches",
    fashion: "Fashion",
    beauty: "Beauty",
    home: "Home and living",
    food: "Food and drink",
    services: "Services",
    electronics: "Electronics",
    sports: "Sports",
    health: "Health and wellness",
    other: "Other",
  },
  fi: {
    jewellery: "Korut",
    watches: "Kellot",
    fashion: "Muoti",
    beauty: "Kauneus",
    home: "Koti ja sisustus",
    food: "Ruoka ja juoma",
    services: "Palvelut",
    electronics: "Elektroniikka",
    sports: "Urheilu",
    health: "Terveys ja hyvinvointi",
    other: "Muu",
  },
};

const creationContextLabels: Record<ReviewLocale, Record<string, string>> = {
  en: {
    "new-storefront": "New storefront",
    "redesign-existing-storefront": "Redesign an existing storefront",
    "demo-storefront": "Demo storefront",
  },
  fi: {
    "new-storefront": "Uusi verkkokauppa",
    "redesign-existing-storefront": "Olemassa olevan verkkokaupan uudistus",
    "demo-storefront": "Demoverkkokauppa",
  },
};

const fontLabels: Record<string, LocalizedCopy> = {
  georgia: copy("Georgia", "Georgia"),
  inter: copy("Inter", "Inter"),
  "system-sans": copy("System sans-serif", "Järjestelmän groteski"),
  "system-serif": copy("System serif", "Järjestelmän antiikva"),
};

const imageryLabels: Record<string, LocalizedCopy> = {
  studio: copy("Studio photography", "Studiovalokuvaus"),
  lifestyle: copy("Lifestyle photography", "Lifestyle-valokuvaus"),
  editorial: copy("Editorial photography", "Toimituksellinen valokuvaus"),
  "product-focused": copy("Product-focused photography", "Tuotekeskeinen valokuvaus"),
  mixed: copy("Mixed photography", "Monipuolinen valokuvaus"),
};

const spacingLabels: Record<string, LocalizedCopy> = {
  airy: copy("Airy", "Ilmava"),
  balanced: copy("Balanced", "Tasapainoinen"),
  compact: copy("Compact", "Tiivis"),
};

const shapeLabels: Record<string, LocalizedCopy> = {
  square: copy("Square", "Kulmikas"),
  subtle: copy("Subtly rounded", "Hillitysti pyöristetty"),
  rounded: copy("Rounded", "Pyöristetty"),
  pill: copy("Pill-shaped", "Pillerimäinen"),
};

const voiceLabels: Record<string, LocalizedCopy> = {
  accessible: copy("Approachable", "Helposti lähestyttävä"),
  premium: copy("Premium", "Premium"),
  neutral: copy("Neutral", "Neutraali"),
  warm: copy("Warm", "Lämmin"),
  direct: copy("Direct", "Suora"),
  inspirational: copy("Inspirational", "Inspiroiva"),
  balanced: copy("Balanced", "Tasapainoinen"),
};

const templateLabels: Record<string, LocalizedCopy> = {
  "Brand-led editorial": copy("Brand-led editorial", "Brändivetoinen toimituksellinen"),
  "Clean balanced commerce": copy("Clean balanced commerce", "Selkeä tasapainoinen kauppa"),
  "Catalogue-forward commerce": copy("Catalogue-forward commerce", "Valikoimavetoinen kauppa"),
};

function pageList(value: string, locale: ReviewLocale): string {
  if (value === "Not available") return copy("Not available", "Ei saatavilla")[locale];
  return value
    .split(",")
    .map((item) => item.trim())
    .map((item) => pageTypeLabels[locale][item] ?? item)
    .join(", ");
}

function voiceValue(value: string, locale: ReviewLocale): string {
  const labels = value
    .split(",")
    .map((token) => token.trim())
    .map((token) => voiceLabels[token]?.[locale] ?? token);
  if (labels.length < 2) return labels[0] ?? value;
  const sentenceLabels = labels.map((label, index) =>
    index === 0 ? label : `${label.charAt(0).toLocaleLowerCase(locale)}${label.slice(1)}`,
  );
  const conjunction = locale === "fi" ? " ja " : " and ";
  return `${sentenceLabels.slice(0, -1).join(", ")}${conjunction}${sentenceLabels.at(-1)}`;
}

function simpleFact(fact: StorefrontGenerationReviewFact, locale: ReviewLocale): MerchantFact {
  return { key: fact.id, label: fact.label[locale], value: fact.value };
}

export function presentFacts(
  section: StorefrontGenerationReviewSection,
  locale: ReviewLocale,
): MerchantFact[] {
  return section.facts.flatMap((fact): MerchantFact[] => {
    if (["brief-id", "foundation", "catalogue-ref", "context"].includes(fact.id)) return [];
    if (section.id === "business" && fact.id === "creation-context") {
      return [
        {
          key: fact.id,
          label: copy("Starting point", "Lähtökohta")[locale],
          value:
            creationContextLabels[locale][fact.value] ??
            copy("Storefront setup", "Verkkokaupan luonti")[locale],
        },
      ];
    }
    if (section.id === "business" && fact.id === "industry") {
      return [
        { ...simpleFact(fact, locale), value: industryLabels[locale][fact.value] ?? fact.value },
      ];
    }
    if (section.id === "brand-foundation" && fact.id === "typography") {
      const [heading, body] = fact.value.split(" / ");
      return [
        {
          key: "heading-font",
          label: copy("Heading font", "Otsikkofontti")[locale],
          value: fontLabels[heading]?.[locale] ?? heading,
        },
        {
          key: "body-font",
          label: copy("Body font", "Leipätekstin fontti")[locale],
          value: fontLabels[body]?.[locale] ?? body,
        },
      ];
    }
    if (section.id === "brand-foundation" && fact.id === "imagery") {
      return [
        {
          key: fact.id,
          label: copy("Imagery", "Kuvatyyli")[locale],
          value: imageryLabels[fact.value]?.[locale] ?? fact.value,
        },
      ];
    }
    if (section.id === "brand-foundation" && fact.id === "spacing") {
      return [
        {
          key: fact.id,
          label: copy("Spacing", "Väljyys")[locale],
          value: spacingLabels[fact.value]?.[locale] ?? fact.value,
        },
      ];
    }
    if (section.id === "brand-foundation" && fact.id === "shape") {
      return [
        {
          key: fact.id,
          label: copy("Shape style", "Muotokieli")[locale],
          value: shapeLabels[fact.value]?.[locale] ?? fact.value,
        },
      ];
    }
    if (section.id === "brand-foundation" && fact.id === "voice") {
      return [
        {
          key: fact.id,
          label: copy("Brand voice", "Brändin äänensävy")[locale],
          value: voiceValue(fact.value, locale),
        },
      ];
    }
    if (section.id === "brand-foundation" && fact.id === "colour-direction") {
      const preferred = /preferred merchant colours/i.test(fact.value);
      return [
        {
          key: fact.id,
          label: copy("Colour approach", "Värien lähestymistapa")[locale],
          value: preferred
            ? copy("Your colours in accessible roles", "Omat värisi saavutettavissa rooleissa")[
                locale
              ]
            : copy("Recommended accessible palette", "Suositeltu saavutettava paletti")[locale],
        },
      ];
    }
    if (section.id === "storefront-template" && fact.id === "template") {
      return [
        { ...simpleFact(fact, locale), value: templateLabels[fact.value]?.[locale] ?? fact.value },
      ];
    }
    if (section.id === "storefront-template" && fact.id === "selection") {
      return [
        {
          key: fact.id,
          label: copy("How it was chosen", "Valintatapa")[locale],
          value:
            fact.value === "Merchant preference"
              ? copy("Your preference", "Oma valintasi")[locale]
              : copy("Recommended for your business", "Suositeltu yrityksellesi")[locale],
        },
      ];
    }
    if (
      section.id === "storefront-template" &&
      (fact.id === "required-pages" || fact.id === "requested-pages")
    ) {
      return [{ ...simpleFact(fact, locale), value: pageList(fact.value, locale) }];
    }
    return [simpleFact(fact, locale)];
  });
}

export function cataloguePresentation(
  review: StorefrontGenerationReview,
  locale: ReviewLocale,
): Readonly<{ heading: string; title: string; description: string }> {
  const context = review.catalogueContext;
  if (context === "existing-vesko-catalogue") {
    const blocker = presentDiagnostics(review, locale).blockers.find(({ key }) =>
      key.startsWith("EXISTING_CATALOGUE_REFERENCE_UNRESOLVED:"),
    );
    return {
      heading: copy("Catalogue plan", "Tuoteluettelosuunnitelma")[locale],
      title: copy("Existing Vesko catalogue", "Olemassa oleva Vesko-tuoteluettelo")[locale],
      description:
        blocker?.message ??
        copy(
          "Connect this catalogue before creating the project, or choose another catalogue plan.",
          "Yhdistä tämä tuoteluettelo ennen projektin luomista tai valitse toinen tuoteluettelosuunnitelma.",
        )[locale],
    };
  }
  if (context === "controlled-demo-catalogue") {
    return {
      heading: copy("Catalogue plan", "Tuoteluettelosuunnitelma")[locale],
      title: copy("Demo catalogue", "Demotuoteluettelo")[locale],
      description: copy(
        "Controlled demo products will make the first storefront ready to explore.",
        "Hallitut demotuotteet tekevät ensimmäisestä verkkokaupasta heti tutustuttavan.",
      )[locale],
    };
  }
  if (context === "empty-catalogue") {
    return {
      heading: copy("Catalogue plan", "Tuoteluettelosuunnitelma")[locale],
      title: copy("Start without products", "Aloita ilman tuotteita")[locale],
      description: copy(
        "The storefront will open with clear empty states, and products can be added later.",
        "Verkkokauppa avautuu selkeillä tyhjillä tiloilla, ja tuotteet voi lisätä myöhemmin.",
      )[locale],
    };
  }
  return {
    heading: copy("Catalogue plan", "Tuoteluettelosuunnitelma")[locale],
    title: copy("Catalogue not selected", "Tuoteluetteloa ei ole valittu")[locale],
    description: copy(
      "Choose how products should be provided for the storefront.",
      "Valitse, miten tuotteet tuodaan verkkokauppaan.",
    )[locale],
  };
}

export function localizedPageType(pageType: string, locale: ReviewLocale): string {
  return pageTypeLabels[locale][pageType] ?? copy("Storefront page", "Verkkokaupan sivu")[locale];
}
