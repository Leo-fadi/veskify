import "server-only";

import {
  PromptedStorefrontDesignIntentError,
  semanticStorefrontDesignIntentFingerprint,
  semanticStorefrontDesignIntentV1MaterialSchema,
  semanticStorefrontDesignIntentV1Schema,
  semanticStorefrontDesignRequestV1Schema,
  type SemanticStorefrontDesignIntentProvider,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignRequestV1,
  type SemanticProviderDriverPath,
} from "@/application/prompted-storefront-design-intent";

export const P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID =
  "p10b-16p-03-mock-prompted-storefront-design-v2" as const;
export const P10B16P03_MOCK_PROMPTED_STOREFRONT_MODEL_ID = "deterministic-p10b-16p-03-v1" as const;

export const p10b16p03MockPromptScenarios = [
  "premium-editorial",
  "modern-technical",
  "minimal-commerce",
] as const;
export type P10B16P03MockPromptScenario = (typeof p10b16p03MockPromptScenarios)[number];

const scenarioSignals = {
  "premium-editorial":
    "premium:5|editorial:5|story led:4|storytelling:3|story:2|refined:2|elegant:2|sophisticated:2|craftsmanship:2|expressive:1",
  "modern-technical":
    "modern:4|technical:5|information rich:4|catalogue led:4|catalog led:4|catalogue:3|catalog:3|precise:2|specification:2|comparison:2|product first:2|structured:1|dense:1",
  "minimal-commerce":
    "minimal commerce:8|minimal:5|conversion led:4|restrained:3|pared back:3|conversion:2|focused:2|quiet:2|direct:2|sparse:2|uncluttered:2",
} as const satisfies Record<P10B16P03MockPromptScenario, string>;

export function selectP10B16P03MockPromptScenario(
  merchantPrompt: string,
): P10B16P03MockPromptScenario {
  const prompt = ` ${merchantPrompt
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  const scores = p10b16p03MockPromptScenarios.map((scenario) => ({
    scenario,
    score: scenarioSignals[scenario].split("|").reduce((score, encoded) => {
      const separator = encoded.lastIndexOf(":");
      const signal = encoded.slice(0, separator);
      const weight = Number(encoded.slice(separator + 1));
      return score + (prompt.includes(` ${signal} `) ? weight : 0);
    }, 0),
  }));
  const highest = Math.max(...scores.map(({ score }) => score));
  return (
    scores.find(({ score }) => score === highest && score > 0)?.scenario ?? "premium-editorial"
  );
}

export type P10B16P03MockPromptFailure =
  | "provider-refusal"
  | "provider-timeout"
  | "provider-transport"
  | "malformed-output"
  | "strict-schema-invalid"
  | "unknown-capability"
  | "insufficient-material-intent"
  | "unsupported-hard-constraint";

const scenarioDesign = {
  "premium-editorial": {
    summary: "Refined editorial storytelling with calm, considered commerce.",
    commercialPosture: "premium-editorial",
    density: "low",
    navigationPosture: "editorial",
    storyCatalogueBalance: "story-first",
    discoveryPosture: "editorial",
    configurableProductPosture: "guided",
    mobileHierarchy: "story-led",
    imageProminence: "image-led",
  },
  "modern-technical": {
    summary: "Technical catalogue depth with precise comparison and decision support.",
    commercialPosture: "modern-technical",
    density: "high",
    navigationPosture: "catalogue",
    storyCatalogueBalance: "catalogue-first",
    discoveryPosture: "catalogue-comparison",
    configurableProductPosture: "technical",
    mobileHierarchy: "product-led",
    imageProminence: "balanced",
  },
  "minimal-commerce": {
    summary: "Restrained product discovery with low visual noise and direct commerce.",
    commercialPosture: "minimal-commerce",
    density: "balanced",
    navigationPosture: "minimal",
    storyCatalogueBalance: "balanced",
    discoveryPosture: "dense-search",
    configurableProductPosture: "standard",
    mobileHierarchy: "conversion-led",
    imageProminence: "restrained",
  },
} as const;

function supportedSemanticValue(
  request: SemanticStorefrontDesignRequestV1,
  path: SemanticProviderDriverPath,
  preferred: string,
): string {
  const field = request.semanticInfluenceAuthority.fields.find((entry) => entry.path === path);
  const selected = field?.supportedValues.includes(preferred)
    ? preferred
    : field?.supportedValues[0];
  if (!selected) {
    throw new PromptedStorefrontDesignIntentError("unknown-capability");
  }
  return selected;
}

function semanticMaterial(
  scenario: P10B16P03MockPromptScenario,
  request: SemanticStorefrontDesignRequestV1,
) {
  const design = scenarioDesign[scenario];
  return semanticStorefrontDesignIntentV1MaterialSchema.parse({
    contractVersion: "prompted-storefront-semantic-intent-v1",
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
    currentAuthorityFingerprint: request.currentAuthorityFingerprint,
    semanticAuthorityFingerprint: request.semanticAuthorityFingerprint,
    designConceptSummary: design.summary,
    commercialPosture: supportedSemanticValue(
      request,
      "commercialPosture",
      design.commercialPosture,
    ),
    globalVisualIntent: {
      density: supportedSemanticValue(request, "globalVisualIntent.density", design.density),
    },
    sharedFrameIntent: {
      navigationPosture: supportedSemanticValue(
        request,
        "sharedFrameIntent.navigationPosture",
        design.navigationPosture,
      ),
    },
    homepageIntent: {
      storyCatalogueBalance: supportedSemanticValue(
        request,
        "homepageIntent.storyCatalogueBalance",
        design.storyCatalogueBalance,
      ),
    },
    collectionIntent: {
      discoveryPosture: supportedSemanticValue(
        request,
        "collectionIntent.discoveryPosture",
        design.discoveryPosture,
      ),
    },
    pdpIntent: {
      configurableProductPosture: supportedSemanticValue(
        request,
        "pdpIntent.configurableProductPosture",
        design.configurableProductPosture,
      ),
    },
    responsiveAndArtDirectionIntent: {
      mobileHierarchy: supportedSemanticValue(
        request,
        "responsiveAndArtDirectionIntent.mobileHierarchy",
        design.mobileHierarchy,
      ),
      imageProminence: supportedSemanticValue(
        request,
        "responsiveAndArtDirectionIntent.imageProminence",
        design.imageProminence,
      ),
    },
  });
}

const failureCode = {
  "provider-refusal": "provider-refusal",
  "provider-timeout": "provider-timeout",
  "provider-transport": "provider-transport",
  "malformed-output": "malformed-output",
  "strict-schema-invalid": "strict-schema-invalid",
  "unknown-capability": "unknown-capability",
  "insufficient-material-intent": "invalid-request",
  "unsupported-hard-constraint": "unknown-capability",
} as const;

export function createP10B16P03MockPromptedStorefrontDesignIntentProvider(input: {
  scenario: P10B16P03MockPromptScenario;
  compatibilityInput?: unknown;
  failure?: P10B16P03MockPromptFailure;
  onRequest?: (request: SemanticStorefrontDesignRequestV1) => void;
}): SemanticStorefrontDesignIntentProvider {
  void input.compatibilityInput;
  return Object.freeze({
    id: P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
    modelId: P10B16P03_MOCK_PROMPTED_STOREFRONT_MODEL_ID,
    createDesignIntent(
      request: SemanticStorefrontDesignRequestV1,
      validation: Parameters<SemanticStorefrontDesignIntentProvider["createDesignIntent"]>[1],
    ): Promise<SemanticStorefrontDesignIntentV1> {
      return new Promise((resolve) => {
        input.onRequest?.(request);
        if (input.failure)
          throw new PromptedStorefrontDesignIntentError(failureCode[input.failure]);
        if (!semanticStorefrontDesignRequestV1Schema.safeParse(request).success) {
          throw new PromptedStorefrontDesignIntentError("invalid-request");
        }
        if (
          validation.currentAuthorityFingerprint() !== request.currentAuthorityFingerprint ||
          validation.semanticAuthorityFingerprint() !== request.semanticAuthorityFingerprint
        ) {
          throw new PromptedStorefrontDesignIntentError("stale-authority");
        }
        const material = semanticMaterial(input.scenario, request);
        resolve(
          semanticStorefrontDesignIntentV1Schema.parse({
            ...material,
            semanticIntentFingerprint: semanticStorefrontDesignIntentFingerprint(material),
          }),
        );
      });
    },
  });
}
