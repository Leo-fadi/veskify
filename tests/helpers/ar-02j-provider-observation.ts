import { aurumNordicSeed } from "@/data/seed";
import {
  buildOpenAiProviderInput,
  openAiProviderInstructions,
} from "@/integrations/ai/openai/prompt";
import { getComponentDefinition, veskifyComponentRegistry } from "@/components/registry/registry";
import { createStorefrontRenderContext } from "@/components/registry/registry";
import { buildAiStorefrontProviderRequest } from "@/application/ai-storefront-generation/request-builder";
import { createDeterministicMockStorefrontAIProvider } from "@/application/ai-storefront-generation/mock-provider";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation/approved-asset-context";
import type {
  AiStorefrontGenerationCommand,
  StorefrontAIProvider,
} from "@/application/ai-storefront-generation/contract";
import type { AiOperationRequest } from "@/application/ai-provider/contract";
import {
  p9r07ExactDesignSystemRequest,
  p9r07FinnishDesignSystemRequest,
} from "../fixtures/p9r-07-design-system";
import { p905dExactTokenRefinementRequest } from "../fixtures/p9-05d-exact-token-refinement";

const snapshot = aurumNordicSeed.draftSnapshot;
const home = snapshot.pages.find((page) => page.type === "home")!;
const collection = snapshot.pages.find((page) => page.type === "collection")!;
const capture = (action: () => unknown) => {
  try {
    return { value: action() };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return {
      error: {
        name: error.name,
        message: error.message,
        ...("code" in error ? { code: error.code } : {}),
      },
    };
  }
};
export function providerObservationCommand(
  overrides: Partial<AiStorefrontGenerationCommand> = {},
): AiStorefrontGenerationCommand {
  const provider = overrides.provider ?? createDeterministicMockStorefrontAIProvider();
  return {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    storefront: {
      pageOrder: snapshot.pages.map((page) => page.id),
      pages: structuredClone(snapshot.pages),
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
    },
    affectedPageIds: [collection.id, home.id],
    affectedSectionTargets: [],
    designSystemTarget: {
      kind: "storefrontDesignSystem",
      projectId: aurumNordicSeed.project.id,
    },
    merchantInstruction: "Apply a warm premium style across the storefront.",
    activeLocale: "en",
    enabledLocales: ["fi", "en"],
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: provider.id,
    provider,
    importedContent: [],
    ...overrides,
  };
}
export function promptObservationRequest(
  component: string,
  locale: "en" | "fi",
  scope: "page" | "section",
  introduced = false,
): AiOperationRequest {
  const definition = Object.hasOwn(veskifyComponentRegistry, component)
    ? getComponentDefinition(component)
    : getComponentDefinition("hero");
  const section = {
    id: "section_observation",
    component,
    variant: definition.defaultVariant,
    visible: true,
    content: structuredClone(definition.defaultContent),
    props: structuredClone(definition.defaultProps),
  };
  const sectionId = introduced ? "section_introduced_observation" : section.id;
  const operationTypes = [
    "CHANGE_LOCALIZED_SECTION_TEXT",
    "CHANGE_SECTION_VARIANT",
    "CHANGE_BACKGROUND",
    "CHANGE_TYPOGRAPHY",
    "CHANGE_DENSITY",
    "CHANGE_SHAPE",
    "CHANGE_ALIGNMENT",
    "CHANGE_CTA_STYLE",
    "ADD_APPROVED_SECTION",
  ] as const;
  return {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    target: { pageId: home.id, ...(scope === "section" ? { sectionId } : {}) },
    instruction: "Improve the selected design.",
    allowedComponentTypes: [component],
    allowedOperationTypes: [...operationTypes],
    permissionGrants: [
      {
        skillId: "observationSkill",
        skillVersion: "1.0.0",
        skillScope: scope,
        operationTypes: [...operationTypes],
        target: {
          kind: introduced ? "introducedSection" : "existingSection",
          pageId: home.id,
          sectionId,
          componentType: component,
        },
      },
    ],
    locale,
    locales: ["en", "fi"],
    page: { ...structuredClone(home), sections: [section] },
    brandSystem: structuredClone(snapshot.brandSystem),
    displayContext: createStorefrontRenderContext({
      activeLocale: locale,
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot,
    }),
    scope,
    importedContent: [],
  };
}
export function observeProviderBoundaries() {
  const prompts: Record<string, unknown> = {};
  const descriptions = Object.fromEntries(
    Object.entries(veskifyComponentRegistry).map(([key, definition]) => [
      key,
      {
        type: definition.type,
        label: definition.label,
        variants: definition.variants,
        editorFields: definition.editorFields,
        protectedFields: definition.protectedFields,
      },
    ]),
  );
  for (const component of Object.keys(veskifyComponentRegistry)) {
    for (const locale of ["en", "fi"] as const)
      for (const scope of ["page", "section"] as const)
        for (const introduced of [false, true]) {
          const request = promptObservationRequest(component, locale, scope, introduced);
          const before = JSON.stringify(request);
          const observed = capture(() => buildOpenAiProviderInput(request));
          if ("error" in observed)
            throw new Error(
              `Invalid observation fixture ${component}/${locale}/${scope}/${introduced}: ${JSON.stringify(observed)}`,
            );
          if (JSON.stringify(request) !== before) throw new Error("Prompt mutated its input.");
          prompts[`${component}/${locale}/${scope}/${introduced}`] = observed;
        }
  }
  for (const component of ["constructor", "__proto__", "toString", "unknown-component"])
    prompts[`unknown/${component}`] = capture(() =>
      buildOpenAiProviderInput(promptObservationRequest(component, "en", "section")),
    );
  const optional = promptObservationRequest("hero", "en", "page");
  optional.page.sections[0].content = {};
  optional.page.sections[0].props = {};
  prompts["absent-optional"] = capture(() => buildOpenAiProviderInput(optional));
  const protectedInput = promptObservationRequest("productInfo", "fi", "page");
  Object.assign(protectedInput.page.sections[0].content, {
    price: 99,
    sku: "protected-sku",
    inventory: { stock: 20 },
    catalogue: { products: [{ price: 89 }] },
  });
  prompts["protected-nested"] = capture(() => buildOpenAiProviderInput(protectedInput));
  const pageGrant = promptObservationRequest("hero", "en", "page");
  pageGrant.permissionGrants = [
    {
      skillId: "pageObservation",
      skillVersion: "1.0.0",
      skillScope: "page",
      operationTypes: ["CHANGE_BACKGROUND"],
      target: { kind: "page", pageId: home.id },
    },
  ];
  prompts["page-grant"] = capture(() => buildOpenAiProviderInput(pageGrant));
  prompts["wrong-locale"] = capture(() =>
    buildOpenAiProviderInput({ ...pageGrant, locale: "fi", locales: ["en"] }),
  );
  prompts["strict-unknown-field"] = capture(() =>
    buildOpenAiProviderInput({ ...pageGrant, unexpected: true }),
  );
  const requests: Record<string, unknown> = {};
  const registeredProvider: StorefrontAIProvider = {
    id: "registered-observation-provider",
    generationCapabilities: [
      "approvedColorTypographyDirection",
      "registeredWholeStorefrontDirection",
    ],
    proposeStorefront: () => Promise.reject(new Error("Observation must not invoke a provider.")),
  };
  const inputs: Record<string, Partial<AiStorefrontGenerationCommand>> = {
    default: {},
    pageOnly: {
      designSystemTarget: null,
      merchantInstruction:
        "Use a minimal Nordic colour and typography direction on the selected pages.",
    },
    homepageScope: {
      requestedScope: "page",
      affectedPageIds: [home.id],
      designSystemTarget: null,
    },
    selectedSection: {
      affectedPageIds: [home.id],
      affectedSectionTargets: [
        {
          pageId: home.id,
          sectionId: home.sections.find((section) => section.component === "hero")!.id,
        },
      ],
      designSystemTarget: null,
    },
    englishExact: { merchantInstruction: p9r07ExactDesignSystemRequest },
    finnishExact: {
      merchantInstruction: p9r07FinnishDesignSystemRequest,
      activeLocale: "fi",
    },
    exactToken: { merchantInstruction: p905dExactTokenRefinementRequest },
    registeredPremium: {
      provider: registeredProvider,
      capability: "registeredWholeStorefrontDirection",
      merchantInstruction: "Make the entire storefront feel premium and editorial.",
    },
    registeredTechnical: {
      provider: registeredProvider,
      capability: "registeredWholeStorefrontDirection",
      merchantInstruction: "Use a modern technical design across the whole storefront.",
    },
    registeredWarm: {
      provider: registeredProvider,
      capability: "registeredWholeStorefrontDirection",
      merchantInstruction: "Use a warm approachable design across the whole storefront.",
    },
    missingPages: { affectedPageIds: ["page_missing"] },
    protectedCommerce: {
      merchantInstruction: "Change product prices and stock quantities.",
    },
    unsupportedLocale: { activeLocale: "fi", enabledLocales: ["en"] },
    noSections: { affectedPageIds: [] },
  };
  const assetContext = {
    briefId: "brief_approved_assets",
    briefRevision: 1,
    approvedEvidenceFingerprint: "evidence-approved-assets",
    assetReviewFingerprint: "asset-review-approved-assets",
    assets: [
      {
        assetId: "asset_approved_source",
        role: "logo" as const,
        sourceReferenceId: "source_approved_assets",
        revision: "2:asset-material",
        materialFingerprint: "asset-material",
        provenance: {
          location: "html-meta" as const,
          observedAt: "2026-07-23T10:00:00.000Z",
        },
        alt: { en: "Approved source asset", fi: "Hyväksytty lähdeaineisto" },
        presentation: {
          decorative: false,
          mediaType: "image/jpeg",
          responsiveCrops: [],
        },
        approval: {
          actorId: "merchant_owner",
          actorReference: "merchant-session",
        },
      },
    ],
  };
  const approvedAssetContext = {
    ...assetContext,
    fingerprint: createApprovedGenerationAssetContextFingerprint(assetContext),
  };
  inputs.approvedAssets = { approvedAssetContext };
  inputs.incapableAssetProvider = {
    approvedAssetContext,
    provider: registeredProvider,
  };
  inputs.staleAssets = {
    approvedAssetContext: { ...approvedAssetContext, fingerprint: "stale" },
  };
  for (const [name, overrides] of Object.entries(inputs)) {
    const command = providerObservationCommand(overrides);
    const before = JSON.stringify(command);
    requests[name] = capture(() => buildAiStorefrontProviderRequest(command, 7));
    if (JSON.stringify(command) !== before) throw new Error("Request builder mutated its input.");
  }
  const invalidVariant = providerObservationCommand();
  invalidVariant.storefront.pages
    .find((page) => page.id === home.id)!
    .sections.find((section) => section.component === "hero")!.variant = "unsupported-variant";
  requests.invalidExistingComponent = capture(() =>
    buildAiStorefrontProviderRequest(invalidVariant, 7),
  );
  return {
    registryKeys: Object.keys(veskifyComponentRegistry),
    descriptions,
    instructions: openAiProviderInstructions,
    prompts,
    requests,
  };
}
