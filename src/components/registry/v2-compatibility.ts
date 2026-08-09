import { z } from "zod";
import type { PageType } from "@/domain/storefront";
import {
  boundedParameterDefinitions,
  createLegacyComponentDesignCompatibility,
  type ComponentDefinitionV2,
  type EditablePresentationField,
  validateComponentDefinitionV2,
} from "@/domain/component-platform";
import { withCurrentComponentCommercialAnatomy } from "./commercial-anatomy";

type V1EditorFieldMetadata = {
  source: "content" | "props";
  control: "text" | "textarea" | "select";
  label: string;
  localized?: boolean;
};

export type InspectableComponentDefinitionV1 = {
  type: string;
  label: string;
  allowedPageTypes: readonly PageType[];
  variants: readonly string[];
  defaultVariant: string;
  contentSchema: z.ZodType;
  propsSchema: z.ZodType;
  editorFields: Readonly<Record<string, V1EditorFieldMetadata>>;
  protectedFields: { readOnlyPaths: readonly string[] };
};

const finnishLabels: Readonly<Record<string, string>> = {
  "Announcement bar": "Ilmoituspalkki",
  Header: "Ylätunniste",
  Hero: "Pääosio",
  "Featured categories": "Esitellyt kategoriat",
  "Product grid": "Tuoteruudukko",
  "Campaign banner": "Kampanjanosto",
  "Brand story": "Bränditarina",
  Benefits: "Hyödyt",
  Newsletter: "Uutiskirje",
  Footer: "Alatunniste",
  "Collection header": "Malliston otsake",
  Filters: "Suodattimet",
  "Product gallery": "Tuotegalleria",
  "Product information": "Tuotetiedot",
  "Product options": "Tuotevalinnat",
  "Image and text": "Kuva ja teksti",
  "Related products": "Liittyvät tuotteet",
  "Section background": "Osion tausta",
  "Spacing density": "Väljyys",
  "Typography preset": "Typografian tyyli",
  "Shape treatment": "Muotojen tyyli",
  "Content alignment": "Sisällön tasaus",
  "CTA presentation": "Toimintopainikkeen tyyli",
};

const variantLabels: Readonly<Record<string, { en: string; fi: string }>> = {
  singleLine: { en: "Single line", fi: "Yksi rivi" },
  rotating: { en: "Rotating messages", fi: "Vaihtuvat viestit" },
  minimal: { en: "Minimal", fi: "Pelkistetty" },
  bold: { en: "Bold", fi: "Näyttävä" },
  centered: { en: "Centred", fi: "Keskitetty" },
  split: { en: "Split layout", fi: "Jaettu asettelu" },
  compact: { en: "Compact", fi: "Kompakti" },
  transparent: { en: "Transparent", fi: "Läpinäkyvä" },
  editorial: { en: "Editorial", fi: "Toimituksellinen" },
  fullBleed: { en: "Full bleed", fi: "Reunasta reunaan" },
  asymmetric: { en: "Asymmetric", fi: "Epäsymmetrinen" },
  restrained: { en: "Restrained", fi: "Hillitty" },
  grid: { en: "Grid", fi: "Ruudukko" },
  editorialCards: { en: "Editorial cards", fi: "Toimitukselliset kortit" },
  carousel: { en: "Carousel", fi: "Karuselli" },
  imageLed: { en: "Image-led", fi: "Kuvavetoinen" },
  standard: { en: "Standard", fi: "Tavallinen" },
  gallery: { en: "Gallery", fi: "Galleria" },
  balanced: { en: "Balanced", fi: "Tasapainoinen" },
  galleryDominant: { en: "Gallery dominant", fi: "Galleria etusijalla" },
  editorialSplit: { en: "Editorial split", fi: "Toimituksellinen jako" },
  fullBleedOverlay: { en: "Full-bleed overlay", fi: "Kokonainen kuva peittotekstillä" },
  campaignMerchandising: { en: "Campaign merchandising", fi: "Kampanjan tuotteistus" },
  overlay: { en: "Overlay", fi: "Päällekkäinen" },
  row: { en: "Row", fi: "Rivi" },
  imageOverlay: { en: "Image overlay", fi: "Teksti kuvan päällä" },
  timeline: { en: "Timeline", fi: "Aikajana" },
  founder: { en: "Founder story", fi: "Perustajan tarina" },
  threeColumn: { en: "Three columns", fi: "Kolme palstaa" },
  fourColumn: { en: "Four columns", fi: "Neljä palstaa" },
  cards: { en: "Cards", fi: "Kortit" },
  inline: { en: "Inline", fi: "Sisällön yhteydessä" },
  card: { en: "Card", fi: "Kortti" },
  fullWidth: { en: "Full width", fi: "Koko leveys" },
  columns: { en: "Columns", fi: "Palstat" },
  expanded: { en: "Expanded", fi: "Laaja" },
  dark: { en: "Dark", fi: "Tumma" },
  horizontal: { en: "Horizontal", fi: "Vaakasuuntainen" },
  premium: { en: "Premium", fi: "Premium" },
  thumbnails: { en: "Thumbnails", fi: "Pikkukuvat" },
  buttons: { en: "Buttons", fi: "Painikkeet" },
  imageLeft: { en: "Image left", fi: "Kuva vasemmalla" },
  imageRight: { en: "Image right", fi: "Kuva oikealla" },
  stacked: { en: "Stacked", fi: "Päällekkäinen" },
  imageText: { en: "Image and text", fi: "Kuva ja teksti" },
  brandStory: { en: "Brand story", fi: "Bränditarina" },
  craftProcess: { en: "Craft and process", fi: "Valmistus ja prosessi" },
  lookbookGallery: { en: "Lookbook gallery", fi: "Lookbook-galleria" },
  continuationCta: { en: "Continuation", fi: "Jatko" },
  quoteSpotlight: { en: "Quote spotlight", fi: "Lainausnosto" },
  proofGrid: { en: "Proof grid", fi: "Näyttöruudukko" },
  serviceAssurance: { en: "Service assurance", fi: "Palvelulupaus" },
  aboutStory: { en: "About story", fi: "Tarina meistä" },
  aboutProcess: { en: "About process", fi: "Prosessimme" },
  contactChannels: { en: "Contact channels", fi: "Yhteydenottokanavat" },
  contactDirectory: { en: "Contact directory", fi: "Yhteystiedot" },
  locationDirectory: { en: "Location directory", fi: "Toimipisteet" },
  locationAppointments: { en: "Location appointments", fi: "Ajanvaraus toimipisteessä" },
  faqDisclosure: { en: "FAQ disclosure", fi: "Usein kysytyt kysymykset" },
  faqTopicGuide: { en: "FAQ topic guide", fi: "Ohjeaiheiden usein kysytyt kysymykset" },
  serviceDetails: { en: "Service details", fi: "Palvelutiedot" },
  policyReading: { en: "Policy reading", fi: "Ehtojen lukeminen" },
  genericReading: { en: "Reading content", fi: "Luettava sisältö" },
  genericEditorial: { en: "Editorial content", fi: "Toimituksellinen sisältö" },
  campaignEditorial: { en: "Editorial campaign", fi: "Toimituksellinen kampanja" },
  campaignImageLed: { en: "Image-led campaign", fi: "Kuvavetoinen kampanja" },
  campaignStory: { en: "Campaign story", fi: "Kampanjatarina" },
};

function localizedLabel(value: string) {
  return { en: value, fi: finnishLabels[value] ?? value };
}

function localizedVariantLabel(value: string) {
  const label = variantLabels[value];
  if (!label) throw new Error(`Missing merchant-facing label for registered variant ${value}.`);
  return label;
}

function serializableObjectContract(schema: z.ZodType) {
  return z.toJSONSchema(schema);
}

function editableFieldFromV1(
  path: string,
  field: V1EditorFieldMetadata,
): EditablePresentationField {
  return {
    path,
    label: localizedLabel(field.label),
    source: field.source,
    control:
      field.control === "textarea" ? "textarea" : field.control === "select" ? "select" : "text",
    localized: field.localized ?? false,
  };
}

function legacyContentDesignCompatibility(family: "content" | "navigation" | "service") {
  const compatibility = createLegacyComponentDesignCompatibility();
  return {
    ...compatibility,
    boundedParameterIds: boundedParameterDefinitions
      .filter((parameter) => parameter.compatibleComponentFamilies.includes(family))
      .map((parameter) => parameter.id),
  };
}

export function adaptV1ComponentDefinitionToV2(
  definition: InspectableComponentDefinitionV1,
): ComponentDefinitionV2 {
  return validateComponentDefinitionV2(
    withCurrentComponentCommercialAnatomy({
      type: definition.type,
      version: { major: 1, minor: 0, patch: 0 },
      title: localizedLabel(definition.label),
      merchantDescription: {
        en: `${definition.label} storefront section.`,
        fi: `${localizedLabel(definition.label).fi} kaupan osio.`,
      },
      family:
        definition.type === "header"
          ? "navigation"
          : definition.type === "footer"
            ? "service"
            : "content",
      supportedPageTypes: [...definition.allowedPageTypes],
      variants: definition.variants.map((variant) => ({
        id: variant,
        title: localizedVariantLabel(variant),
      })),
      defaultVariant: definition.defaultVariant,
      industryTags: [],
      contentSchema: serializableObjectContract(definition.contentSchema),
      propsSchema: serializableObjectContract(definition.propsSchema),
      styleOverridesSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      contentSlots: [],
      commerceBindingSlots: [],
      assetSlots:
        definition.type === "brandStory"
          ? [
              {
                id: "brandStoryMedia",
                title: { en: "Brand story media", fi: "Bränditarinan media" },
                acceptedRoles: ["editorialImage", "logo"],
                required: false,
                minItems: 0,
                maxItems: 1,
              },
            ]
          : [],
      editablePresentationFields: Object.entries(definition.editorFields).map(([path, field]) =>
        editableFieldFromV1(path, field),
      ),
      protectedFields: { readOnlyPaths: [...definition.protectedFields.readOnlyPaths] },
      responsiveRules: [
        {
          breakpoints: ["mobile", "tablet", "desktop", "wide"],
          allowHorizontalOverflow: false,
          notes: {
            en: "Existing registered renderer with responsive behaviour at all supported widths.",
            fi: "Nykyinen rekisteröity renderöinti mukautuu kaikilla tuetuilla leveyksillä.",
          },
        },
      ],
      accessibilityRequirements: {
        keyboard: "Retain the existing registered renderer keyboard behaviour.",
        semantics: "Retain the existing registered renderer semantic structure.",
        labels: "Retain the existing registered renderer labels and alt text rules.",
        focus: "Retain the existing registered renderer focus behaviour.",
      },
      designCompatibility: legacyContentDesignCompatibility(
        definition.type === "header"
          ? "navigation"
          : definition.type === "footer"
            ? "service"
            : "content",
      ),
      migration: {
        policy: "compatible",
        previousVersions: [],
        migrations: [],
      },
      renderer: {
        adapterId: "veskifyV1Registry",
        exportName: definition.type,
        supportedTargets: ["editor", "preview", "published"],
      },
    }),
  );
}

export function adaptV1ComponentRegistryToV2(
  registry: Readonly<Record<string, InspectableComponentDefinitionV1>>,
): ComponentDefinitionV2[] {
  return Object.values(registry).map((definition) => adaptV1ComponentDefinitionToV2(definition));
}
