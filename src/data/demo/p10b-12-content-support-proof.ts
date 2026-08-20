import { migrateApprovedPresentationArtDirection } from "@/application/responsive-image-authority";
import { getCommercialContentSupportProfile } from "@/application/storefront-templates";
import { contentSupportDefinition } from "@/components/registry/content-support";
import { aurumNordicSeed } from "@/data/seed";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import type { LocalizedText } from "@/domain/shared";
import {
  applyCommercialSharedFrame,
  approvedAssetPlacementOperationSchema,
  approvedAssetPresentationSchema,
  contentSupportPageFamilyIdSchema,
  createContentSupportFactDocument,
  pageModelSchema,
  type ContentSupportFactDocument,
  type ContentSupportPageFamilyId,
  type StorefrontSnapshot,
} from "@/domain/storefront";

const text = (en: string, fi: string): LocalizedText => ({ en, fi });

export type P10B12CampaignActionAuthority = "paired" | "absent" | "label-only";

const familyTitles: Readonly<Record<ContentSupportPageFamilyId, LocalizedText>> = {
  about: text("Made for northern light", "Pohjoisen valoon tehty"),
  contact: text("Talk with our studio", "Ota yhteyttä studioomme"),
  "store-locations": text("Visit Aurum Nordic", "Vieraile Aurum Nordicissa"),
  faq: text("Questions, answered clearly", "Kysymykset ja selkeät vastaukset"),
  "shipping-information": text("Delivery with care", "Huolellinen toimitus"),
  "returns-information": text("Returns without uncertainty", "Palautukset ilman epävarmuutta"),
  "policy-legal": text("Terms and privacy", "Ehdot ja tietosuoja"),
  "generic-content": text("Notes from the studio", "Muistiinpanoja studiolta"),
  "campaign-editorial": text("The midnight collection", "Keskiyön mallisto"),
};

function storyFacts(sparse: boolean) {
  return {
    heading: text("From sketchbook to keepsake", "Luonnoksesta muistoksi"),
    body: text(
      sparse
        ? "Aurum Nordic began with a small Helsinki workbench and a belief that everyday jewellery should carry meaning."
        : "Aurum Nordic began with a small Helsinki workbench. We shape quiet, lasting pieces around northern light, useful detail and the moments people choose to remember.",
      sparse
        ? "Aurum Nordic sai alkunsa pienellä helsinkiläisellä työpöydällä ja ajatuksesta, että arkikorujen kuuluu kantaa merkitystä."
        : "Aurum Nordic sai alkunsa pienellä helsinkiläisellä työpöydällä. Muotoilemme rauhallisia ja kestäviä koruja pohjoisen valon, toimivien yksityiskohtien ja muistettavien hetkien ympärille.",
    ),
    steps: sparse
      ? [
          {
            id: "workbench",
            title: text("Begin with purpose", "Aloita tarkoituksesta"),
            description: text(
              "Each piece starts with the moment it should serve.",
              "Jokainen koru alkaa hetkestä, jota sen tulee palvella.",
            ),
          },
        ]
      : [
          {
            id: "listen",
            title: text("Listen", "Kuuntele"),
            description: text(
              "We begin with the wearer, the occasion and the desired everyday rhythm.",
              "Aloitamme käyttäjästä, tilanteesta ja toivotusta arjen rytmistä.",
            ),
          },
          {
            id: "shape",
            title: text("Shape", "Muotoile"),
            description: text(
              "Proportion, surface and setting are refined together at the studio.",
              "Mittasuhteet, pinta ja istutus viimeistellään yhdessä studiolla.",
            ),
          },
          {
            id: "finish",
            title: text("Finish", "Viimeistele"),
            description: text(
              "The final piece is checked by hand before it leaves our workbench.",
              "Valmis koru tarkistetaan käsin ennen kuin se lähtee työpöydältämme.",
            ),
          },
        ],
  };
}

function payload(
  familyId: ContentSupportPageFamilyId,
  options: Readonly<{ sparse: boolean; campaignActionLabel?: LocalizedText }>,
) {
  const title = familyTitles[familyId];
  if (familyId === "about") {
    return {
      familyId,
      title,
      introduction: text(
        "Independent design, careful making and pieces intended to stay in use.",
        "Itsenäistä suunnittelua, huolellista valmistusta ja käyttöön tarkoitettuja koruja.",
      ),
      blocks: [
        {
          kind: "paragraph" as const,
          id: "values",
          heading: text("Quiet confidence", "Rauhallinen varmuus"),
          body: text(
            "We value honest materials, balanced proportions and service that leaves room for considered decisions.",
            "Arvostamme rehellisiä materiaaleja, tasapainoisia mittasuhteita ja harkinnalle tilaa antavaa palvelua.",
          ),
        },
      ],
      story: storyFacts(options.sparse),
    };
  }
  if (familyId === "generic-content") {
    return {
      familyId,
      title,
      introduction: text(
        "A short studio reading on form, light and objects made for daily rituals.",
        "Lyhyt studioteksti muodosta, valosta ja arjen rituaaleihin tehdyistä esineistä.",
      ),
      blocks: [
        {
          kind: "paragraph" as const,
          id: "observation",
          heading: text("Observe first", "Havainnoi ensin"),
          body: text(
            "The smallest shifts in edge, weight and reflection can change how a piece feels throughout the day.",
            "Pienet muutokset reunassa, painossa ja heijastuksessa voivat muuttaa korun tuntua päivän aikana.",
          ),
        },
        {
          kind: "paragraph" as const,
          id: "daily-use",
          heading: text("Return to use", "Palaa käyttöön"),
          body: text(
            "Editorial ideas return to one practical question: will this be a pleasure to wear often?",
            "Toimitukselliset ajatukset palaavat yhteen käytännön kysymykseen: onko tätä ilo käyttää usein?",
          ),
        },
      ],
      story: storyFacts(options.sparse),
    };
  }
  if (familyId === "contact") {
    return {
      familyId,
      title,
      introduction: text(
        "Choose the channel that fits your question. Our studio replies during opening hours.",
        "Valitse kysymykseesi sopiva kanava. Studiomme vastaa aukioloaikoina.",
      ),
      blocks: [
        {
          kind: "contact-channel" as const,
          id: "studio-email",
          channel: "email" as const,
          label: text("Studio and product advice", "Studio ja tuoteneuvonta"),
          value: "studio@aurum.example",
        },
        {
          kind: "contact-channel" as const,
          id: "orders-email",
          channel: "email" as const,
          label: text("Orders and delivery", "Tilaukset ja toimitus"),
          value: "orders@aurum.example",
        },
        {
          kind: "contact-channel" as const,
          id: "studio-phone",
          channel: "phone" as const,
          label: text("Call the Helsinki studio", "Soita Helsingin studiolle"),
          value: "+358 9 123 4567",
        },
      ],
    };
  }
  if (familyId === "store-locations") {
    return {
      familyId,
      title,
      introduction: text(
        "Find current addresses and opening hours before your visit.",
        "Tarkista ajantasaiset osoitteet ja aukioloajat ennen vierailua.",
      ),
      blocks: [
        {
          kind: "location" as const,
          id: "helsinki-studio",
          name: text("Helsinki studio", "Helsingin studio"),
          addressLines: [
            text("Pohjoisesplanadi 21", "Pohjoisesplanadi 21"),
            text("00100 Helsinki", "00100 Helsinki"),
          ],
          openingHours: [text("Mon–Fri 10–18", "Ma–Pe 10–18"), text("Sat 11–16", "La 11–16")],
        },
        {
          kind: "location" as const,
          id: "turku-showroom",
          name: text("Turku showroom", "Turun näyttelytila"),
          addressLines: [text("Linnankatu 8", "Linnankatu 8"), text("20100 Turku", "20100 Turku")],
          openingHours: [text("Thu–Fri 12–18", "To–Pe 12–18")],
        },
      ],
    };
  }
  if (familyId === "faq") {
    return {
      familyId,
      title,
      introduction: text(
        "Direct answers based on our currently approved service information.",
        "Suorat vastaukset perustuvat voimassa oleviin palvelutietoihimme.",
      ),
      blocks: [
        {
          kind: "faq" as const,
          id: "dispatch",
          question: text("When will my order be dispatched?", "Milloin tilaukseni lähetetään?"),
          answer: text(
            "Available pieces leave the studio within two business days.",
            "Saatavilla olevat korut lähtevät studiolta kahden arkipäivän kuluessa.",
          ),
        },
        {
          kind: "faq" as const,
          id: "gift-wrap",
          question: text("Is gift wrapping available?", "Onko lahjapaketointi saatavilla?"),
          answer: text(
            "Every order includes our standard presentation box.",
            "Jokainen tilaus sisältää vakiomuotoisen korurasian.",
          ),
        },
        {
          kind: "faq" as const,
          id: "care",
          question: text("How should I store my jewellery?", "Miten koruja kannattaa säilyttää?"),
          answer: text(
            "Store pieces dry and separately to reduce surface wear.",
            "Säilytä korut kuivina ja erillään pintakulumisen vähentämiseksi.",
          ),
        },
      ],
    };
  }
  if (familyId === "campaign-editorial") {
    return {
      familyId,
      title,
      introduction: text(
        "A study in deep reflections and precise, wearable lines.",
        "Tutkielma syvistä heijastuksista ja tarkoista, käytettävistä linjoista.",
      ),
      blocks: [],
      story: {
        heading: text("After the city turns quiet", "Kun kaupunki hiljenee"),
        body: text(
          "The collection moves from the first blue hour through polished surfaces to a final point of light.",
          "Mallisto kulkee ensimmäisestä sinisestä hetkestä kiillotettujen pintojen kautta viimeiseen valopisteeseen.",
        ),
        steps: [
          {
            id: "blue-hour",
            title: text("Blue hour", "Sininen hetki"),
            description: text(
              "Soft geometry begins the sequence.",
              "Pehmeä geometria aloittaa sarjan.",
            ),
          },
          {
            id: "reflection",
            title: text("Reflection", "Heijastus"),
            description: text(
              "Polished edges hold the changing light.",
              "Kiillotetut reunat kantavat muuttuvaa valoa.",
            ),
          },
          {
            id: "afterglow",
            title: text("Afterglow", "Jälkihehku"),
            description: text(
              "A small bright detail closes the story.",
              "Pieni kirkas yksityiskohta päättää tarinan.",
            ),
          },
        ],
      },
      campaign: {
        eyebrow: text("Limited studio edition", "Studion rajattu erä"),
        heading: text("Meet midnight in a new light", "Näe keskiyö uudessa valossa"),
        description: text(
          "Sculptural forms, dark polish and a measured flash of silver define the Midnight collection.",
          "Veistokselliset muodot, tumma kiilto ja harkittu hopean välähdys määrittävät Keskiyö-malliston.",
        ),
        ...(options.campaignActionLabel ? { actionLabel: options.campaignActionLabel } : {}),
      },
    };
  }
  const serviceCopy =
    familyId === "shipping-information"
      ? [
          [
            "Dispatch",
            "Lähetys",
            "Available pieces leave our Helsinki studio within two business days.",
            "Saatavilla olevat korut lähtevät Helsingin studiolta kahden arkipäivän kuluessa.",
          ],
          [
            "Tracking",
            "Seuranta",
            "A tracking link is sent after the parcel is handed to the carrier.",
            "Seurantalinkki lähetetään, kun paketti on luovutettu kuljetukseen.",
          ],
          [
            "Packaging",
            "Pakkaus",
            "Pieces travel in a protective presentation box.",
            "Korut kulkevat suojaavassa korurasiassa.",
          ],
        ]
      : familyId === "returns-information"
        ? [
            [
              "Start a return",
              "Aloita palautus",
              "Contact order support before sending an item back.",
              "Ota yhteyttä tilaustukeen ennen tuotteen lähettämistä takaisin.",
            ],
            [
              "Pack securely",
              "Pakkaa turvallisesti",
              "Use the original protective box when it is available.",
              "Käytä alkuperäistä suojarasiaa, kun se on saatavilla.",
            ],
            [
              "Review",
              "Tarkistus",
              "Returned pieces are reviewed after they reach the studio.",
              "Palautetut korut tarkistetaan niiden saavuttua studiolle.",
            ],
          ]
        : [
            [
              "Scope",
              "Soveltamisala",
              "These terms apply to purchases made through this storefront.",
              "Näitä ehtoja sovelletaan tämän verkkokaupan kautta tehtyihin ostoksiin.",
            ],
            [
              "Personal data",
              "Henkilötiedot",
              "Order details are used to fulfil the purchase and provide requested support.",
              "Tilaustietoja käytetään ostoksen toimittamiseen ja pyydetyn tuen tarjoamiseen.",
            ],
            [
              "Contact",
              "Yhteystiedot",
              "Questions about these terms can be sent to the approved studio email address.",
              "Näitä ehtoja koskevat kysymykset voi lähettää studion hyväksyttyyn sähköpostiosoitteeseen.",
            ],
          ];
  return {
    familyId,
    title,
    introduction: text(
      familyId === "policy-legal"
        ? "Read the current terms in full before relying on them."
        : "The practical details below reflect our current approved service information.",
      familyId === "policy-legal"
        ? "Lue voimassa olevat ehdot kokonaan ennen niihin tukeutumista."
        : "Alla olevat käytännön tiedot perustuvat voimassa oleviin hyväksyttyihin palvelutietoihin.",
    ),
    blocks: serviceCopy.map(([headingEn, headingFi, bodyEn, bodyFi], index) => ({
      kind: "policy-section" as const,
      id: ["service-one", "service-two", "service-three"][index],
      heading: text(headingEn, headingFi),
      body: text(bodyEn, bodyFi),
    })),
  };
}

function approvedMediaFor(input: {
  pageId: string;
  sectionId: string;
  variant: string;
  snapshot: StorefrontSnapshot;
}) {
  const sourcePresentation = approvedAssetPresentationSchema.parse({
    assetId: "asset_p10b12_campaign_editorial",
    role: "editorialImage",
    revision: "1:p10b18b05-approved",
    materialFingerprint: "p10b18b05-approved-aava-editorial-presentation-v1",
    asset: {
      id: "asset_p10b12_campaign_editorial",
      url: "/seed-assets/aava-necklace.svg",
      alt: text("Aava sterling-silver necklace", "Aava-sterlinghopeakaulakoru"),
      decorative: false,
    },
  });
  const placement = approvedAssetPlacementOperationSchema.parse({
    type: "PLACE_APPROVED_SOURCE_ASSET",
    pageId: input.pageId,
    componentId: input.sectionId,
    componentType: "contentSupport",
    assetSlotId: "contentSupportMedia",
    assetId: sourcePresentation.assetId,
    role: sourcePresentation.role,
    assetRevision: sourcePresentation.revision,
    materialFingerprint: sourcePresentation.materialFingerprint,
    sourceReferenceId: "source_p10b12_campaign_editorial",
    sourceProvenanceKind: "sourceDiscovered",
    placementContext: "page",
    placementPurpose: "content-support",
    reusePolicy: "bounded-editorial",
    affinity: "exact-role-exact-purpose",
    required: true,
  });
  const presentation = migrateApprovedPresentationArtDirection({
    presentation: structuredClone(sourcePresentation),
    placement,
    component: contentSupportDefinition,
    variant: input.variant,
    dna: resolveBrandSystemDesignDna(input.snapshot.brandSystem),
    provenanceKind: "sourceDiscovered",
  });
  return { placement, presentation };
}

export type P10B12ContentSupportProof = Readonly<{
  snapshot: StorefrontSnapshot;
  pageId: string;
  document: ContentSupportFactDocument;
  profileId: string;
  structuralFingerprint: string;
  approvedMedia: boolean;
  campaignActionAuthority: P10B12CampaignActionAuthority;
}>;

/** Deterministic browser-only proof fixture; source-workflow resolution is covered by unit tests. */
export function createP10B12ContentSupportProof(
  input: Readonly<{
    familyId: ContentSupportPageFamilyId;
    profileId: string;
    approvedMedia?: boolean;
    sparse?: boolean;
    campaignActionAuthority?: P10B12CampaignActionAuthority;
  }>,
): P10B12ContentSupportProof {
  const familyId = contentSupportPageFamilyIdSchema.parse(input.familyId);
  const plan = getCommercialContentSupportProfile(input.profileId);
  const authority = plan?.profile?.commercialContentSupport;
  const slot = plan?.slots[0];
  if (!plan || !authority || !slot || !authority.pageFamilyIds.includes(familyId)) {
    throw new Error("The browser proof requires a registered matching P10B-12 profile.");
  }
  const campaignActionAuthority = input.campaignActionAuthority ?? "absent";
  const navigationAction =
    aurumNordicSeed.draftSnapshot.navigation.primary[1] ??
    aurumNordicSeed.draftSnapshot.navigation.primary[0];
  if (campaignActionAuthority === "paired" && !navigationAction) {
    throw new Error("The paired campaign proof requires canonical navigation authority.");
  }
  const campaignActionLabel =
    campaignActionAuthority === "paired"
      ? navigationAction.label
      : campaignActionAuthority === "label-only"
        ? text("Discover the collection", "Tutustu mallistoon")
        : undefined;
  const factPayload = payload(familyId, {
    sparse: input.sparse ?? false,
    campaignActionLabel,
  });
  const evidence = {
    source: "approved-source-evidence" as const,
    authorityId: `evidence_p10b12_${familyId.replaceAll("-", "_")}`,
    revision: "1",
    status: "approved" as const,
    approvalAuthorityId: "brief_p10b12_browser_proof",
    approvalFingerprint: "p10b12-browser-proof-approved-evidence",
  };
  const document = createContentSupportFactDocument({ evidence, payload: factPayload });
  const pageId = `page_p10b12_${familyId.replaceAll("-", "_")}_${input.profileId.replaceAll("-", "_")}`;
  const sectionId = "section_p10b12_content_support";
  const rawSnapshot = structuredClone(aurumNordicSeed.draftSnapshot);
  const approvedMedia = input.approvedMedia ?? false;
  const media = approvedMedia
    ? approvedMediaFor({ pageId, sectionId, variant: slot.defaultVariant, snapshot: rawSnapshot })
    : null;
  const page = pageModelSchema.parse({
    id: pageId,
    type: plan.pageType,
    slug:
      familyId === "campaign-editorial" ? `/campaigns/${input.profileId}` : `/pages/${familyId}`,
    title: factPayload.title,
    seo: {
      title: factPayload.title,
      metaDescription: text(
        "Approved content and support information.",
        "Hyväksytty sisältö ja tukitieto.",
      ),
    },
    pageFamily: {
      familyId,
      familyVersion: "1.0.0",
      profileId: plan.profile!.id,
      profileVersion: plan.profile!.version,
      localeCoverage: ["en", "fi"],
      sharedFrameId: "blueprint-shared-storefront-frame",
      sharedFrameVersion: "1.0.0",
      commerceContext: { kind: "none" },
      commerceOperationAuthority: "read-only-presentation",
      navigationAreas: ["primary", "footer"],
      evidenceReferences: [evidence],
    },
    sections: [
      {
        id: sectionId,
        component: "contentSupport",
        variant: slot.defaultVariant,
        visible: true,
        content: { factDocumentId: document.id },
        props: { readingWidth: "standard", textAlignment: "left" },
        styleOverrides: { contentWidth: "standard" },
        ...(media
          ? {
              approvedAssetPlacements: [media.placement],
              approvedAssetPresentations: [media.presentation],
            }
          : {}),
      },
    ],
  });
  const snapshot = applyCommercialSharedFrame(
    {
      ...rawSnapshot,
      pages: [...rawSnapshot.pages, page],
      contentSupportFactDocuments: [document],
    },
    authority.defaultSharedFrameProfileId,
  );
  return Object.freeze({
    snapshot,
    pageId,
    document,
    profileId: plan.profile!.id,
    structuralFingerprint: authority.structuralFingerprint,
    approvedMedia,
    campaignActionAuthority,
  });
}
