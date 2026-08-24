export const P10B18D_LIVE_ACCEPTANCE_MODEL = "gpt-5.6-sol" as const;
export const P10B18D_LIVE_ACCEPTANCE_TIMEOUT_MS = 120_000 as const;
export const P10B18D_LIVE_ACCEPTANCE_MAX_CALLS = 6 as const;
export const P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION = 3 as const;
export const P10B18D_ACCEPTANCE_PROJECT_ID =
  "project_p10b16p04_aurum_commercial_acceptance" as const;
export const P10B18D_ACCEPTANCE_LOCALE = "en" as const;
export const P10B18D_ACCEPTANCE_TOKEN_HEADER = "x-veskify-p10b-16p-04-acceptance-token" as const;
export const P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY =
  "VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN" as const;
export const P10B18D_MOCK_MODEL = "mocked-p10b-16p-04-design-intent-v2" as const;
export const P10B18D_ACCEPTANCE_CONTEXTS = Object.freeze({
  collection: Object.freeze({
    collectionId: "collection_everyday",
    collectionSlug: "everyday-icons",
  }),
  simpleProduct: Object.freeze({
    productId: "product_sisu_automatic_watch",
    productSlug: "sisu-automatic-watch",
  }),
  configurableProduct: Object.freeze({
    productId: "product_aurora_ring_585",
    productSlug: "aurora-ring-585",
  }),
});

const p10b18dIntentDimensionKeys = [
  "locale",
  "mood",
  "composition",
  "commercialPriority",
  "avoidance",
] as const;

export const p10b18dLockedConcepts = [
  {
    id: "concept-1-dark-gallery-luxury",
    ordinal: 1,
    title: "Dark gallery luxury",
    prompt: [
      "Design this jewellery storefront as a dramatic, gallery-like luxury experience.",
      "Use a dark, refined mood, asymmetric editorial composition, generous negative",
      "space and strong imagery. Keep the buying path clear and make the products feel",
      "rare and valuable. Avoid the familiar centered boutique layout.",
    ].join("\n"),
    intentDimensions: {
      locale: "en",
      mood: "dark-refined-luxury",
      composition: "asymmetric-gallery-editorial",
      commercialPriority: "rare-value-with-clear-buying-path",
      avoidance: "centered-boutique",
    },
  },
  {
    id: "concept-2-bold-youthful-campaign",
    ordinal: 2,
    title: "Bold youthful campaign",
    prompt: [
      "Reimagine this same jewellery store for a younger, fashion-forward audience.",
      "Make it bright, energetic and campaign-led, with confident typography, bold",
      "visual blocks and products appearing early. Keep it polished and easy to shop.",
      "The structure should feel completely different from a traditional luxury",
      "jewellery site.",
    ].join("\n"),
    intentDimensions: {
      locale: "en",
      mood: "bright-youthful-energetic",
      composition: "campaign-led-visual-blocks",
      commercialPriority: "products-early-easy-shopping",
      avoidance: "traditional-luxury-structure",
    },
  },
  {
    id: "concept-3-technical-configurable-commerce",
    ordinal: 3,
    title: "Technical configurable commerce",
    prompt: [
      "Create a precise, contemporary storefront that treats rings and watches as",
      "considered, configurable products. Prioritize comparison, specifications,",
      "options and decision support. Use a compact, structured visual hierarchy and",
      "clear navigation. Avoid lifestyle-heavy storytelling and oversized decorative",
      "sections.",
    ].join("\n"),
    intentDimensions: {
      locale: "en",
      mood: "precise-contemporary",
      composition: "compact-structured",
      commercialPriority: "comparison-options-decision-support",
      avoidance: "lifestyle-storytelling-and-oversized-decoration",
    },
  },
  {
    id: "concept-4-warm-nordic-story",
    ordinal: 4,
    title: "Warm Nordic story",
    prompt: [
      "Create a warm Nordic storefront that feels tactile, calm and human. Lead with",
      "the brand story and materials, then guide customers naturally into collections",
      "and products. Use soft hierarchy, balanced whitespace and editorial imagery",
      "while keeping the store commercially strong.",
    ].join("\n"),
    intentDimensions: {
      locale: "en",
      mood: "warm-tactile-calm-human",
      composition: "soft-story-led-editorial",
      commercialPriority: "story-to-collections-and-products",
      avoidance: "no-explicit-avoidance",
    },
  },
  {
    id: "concept-5-restrained-product-first",
    ordinal: 5,
    title: "Restrained product-first",
    prompt: [
      "Make the storefront extremely clear, restrained and product-first. Use imagery",
      "selectively, bring products, price and availability into view quickly, and",
      "remove unnecessary visual noise. It should feel intentionally designed rather",
      "than empty or generic.",
    ].join("\n"),
    intentDimensions: {
      locale: "en",
      mood: "restrained-intentional",
      composition: "selective-imagery-product-first",
      commercialPriority: "product-price-availability-early",
      avoidance: "visual-noise-empty-generic",
    },
  },
  {
    id: "concept-6-finnish-bold-asymmetric",
    ordinal: 6,
    title: "Finnish bold asymmetric",
    prompt: [
      "Suunnittele t\u00e4st\u00e4 korukaupasta rohkea, moderni ja ep\u00e4symmetrinen verkkokauppa,",
      "joka tuntuu selv\u00e4sti erilaiselta kuin perinteinen luksus- tai lifestyle-kauppa.",
      "Nosta tuotteet nopeasti esiin, k\u00e4yt\u00e4 vahvaa typografista hierarkiaa ja selkeit\u00e4",
      "v\u00e4ripintoja, mutta pid\u00e4 ostaminen helppona. V\u00e4lt\u00e4 geneerist\u00e4 keskitetty\u00e4",
      "asettelua ja turhaa tyhj\u00e4\u00e4 tilaa.",
    ].join("\n"),
    intentDimensions: {
      locale: "fi",
      mood: "bold-modern",
      composition: "asymmetric-typographic-colour-blocks",
      commercialPriority: "products-early-easy-purchase",
      avoidance: "traditional-luxury-lifestyle-centered-empty",
    },
  },
] as const;

export type P10B18DLockedConcept = (typeof p10b18dLockedConcepts)[number];
export type P10B18DLockedConceptId = P10B18DLockedConcept["id"];
export type P10B18DSessionId = "A" | "B";

export const p10b18dAcceptanceSessions = [
  {
    id: "A",
    conceptIds: [
      "concept-1-dark-gallery-luxury",
      "concept-2-bold-youthful-campaign",
      "concept-3-technical-configurable-commerce",
    ],
  },
  {
    id: "B",
    conceptIds: [
      "concept-4-warm-nordic-story",
      "concept-5-restrained-product-first",
      "concept-6-finnish-bold-asymmetric",
    ],
  },
] as const satisfies readonly Readonly<{
  id: P10B18DSessionId;
  conceptIds: readonly P10B18DLockedConceptId[];
}>[];

export function p10b18dConceptsForSession(
  sessionId: P10B18DSessionId,
): readonly P10B18DLockedConcept[] {
  const session = p10b18dAcceptanceSessions.find(({ id }) => id === sessionId);
  if (!session) throw new Error(`Unknown P10B-18D acceptance session: ${sessionId}.`);
  return session.conceptIds.map((conceptId) => {
    const concept = p10b18dLockedConcepts.find(({ id }) => id === conceptId);
    if (!concept) throw new Error(`Unknown P10B-18D acceptance concept: ${conceptId}.`);
    return concept;
  });
}

export function p10b18dConceptsForRunner(input: {
  sessionId: P10B18DSessionId;
  live: boolean;
  resumeAfterOrdinal?: number;
}): readonly P10B18DLockedConcept[] {
  if (!input.live) {
    if (input.resumeAfterOrdinal !== undefined) {
      throw new Error("The P10B-18D mocked runner smoke cannot resume a live call matrix.");
    }
    if (input.sessionId !== "A") {
      throw new Error("The P10B-18D mocked runner smoke is restricted to Session A Concept 1.");
    }
    return p10b18dConceptsForSession("A").slice(0, 1);
  }
  const concepts = p10b18dConceptsForSession(input.sessionId);
  if (input.resumeAfterOrdinal === undefined) return concepts;
  const completedIndex = concepts.findIndex(({ ordinal }) => ordinal === input.resumeAfterOrdinal);
  if (completedIndex < 0 || completedIndex >= concepts.length - 1) {
    throw new Error("The P10B-18D live resume ordinal is outside the remaining session matrix.");
  }
  return concepts.slice(completedIndex + 1);
}

export function p10b18dExpectedAcceptanceStatus(providerCallCount: number): "complete" | "ready" {
  if (
    !Number.isInteger(providerCallCount) ||
    providerCallCount < 1 ||
    providerCallCount > P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION
  ) {
    throw new Error("The P10B-18D runner call count is outside the acceptance budget.");
  }
  return providerCallCount === P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION ? "complete" : "ready";
}

export function p10b18dNaturalLanguageIntentDifferences() {
  return p10b18dLockedConcepts.flatMap((left, leftIndex) =>
    p10b18dLockedConcepts.slice(leftIndex + 1).map((right) => ({
      leftId: left.id,
      rightId: right.id,
      differingDimensions: p10b18dIntentDimensionKeys.filter(
        (key) => left.intentDimensions[key] !== right.intentDimensions[key],
      ),
    })),
  );
}
