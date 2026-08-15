// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildWholeStorefrontPlanningProviderRequest,
  requestWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import { canonicalValueString } from "@/domain/storefront";
import {
  OpenAiWholeStorefrontPlanningProvider,
  type OpenAiResponseRequestOptions,
  type OpenAiResponsesRequest,
} from "@/integrations/ai/openai";
import {
  createP905aFreshMerchantFixture,
  p905aDirectionScenarios,
  type P905aDirectionId,
} from "@/data/demo/p9-05a-fresh-store-generation";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenarioFromSelectedDirection,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";

const directions: P905aDirectionId[] = ["premiumEditorial", "modernTechnical", "warmApproachable"];
const sharedFixture = createP905aFreshMerchantFixture("warmApproachable");
const sharedPlanningInput = sharedFixture.planningInput;
const registeredPlans = directions.map((directionId) =>
  buildWholeStorefrontPlanningProviderRequest(
    sharedPlanningInput,
    `Select the ${directionId} direction for the approved Lumo storefront.`,
  ).planForDirection(directionId),
);

class DirectionTransport {
  readonly calls: Array<{
    request: OpenAiResponsesRequest;
    options: OpenAiResponseRequestOptions;
  }> = [];

  constructor(private readonly directionId: P905aDirectionId) {}

  create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) {
    this.calls.push({ request, options });
    const input = JSON.parse(request.input) as { requestFingerprint: string };
    return Promise.resolve({
      id: `resp_${this.directionId}`,
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "structured" }] }],
      output_text: JSON.stringify({
        requestFingerprint: input.requestFingerprint,
        selectionId: this.directionId,
      }),
    });
  }
}

describe("P9-05B real-provider direction contract", () => {
  it("uses the merchant request to choose a registered direction without sending a final plan", async () => {
    const input = sharedPlanningInput;
    const request = buildWholeStorefrontPlanningProviderRequest(
      input,
      "Create a modern technical storefront for Lumo Atelier with efficient product comparison.",
    );
    const transport = new DirectionTransport("modernTechnical");
    const provider = new OpenAiWholeStorefrontPlanningProvider({
      responses: transport,
      model: "mocked-p9-05b-model",
      timeoutMs: 1_000,
    });

    const plan = await requestWholeStorefrontGenerationPlan({
      provider,
      input,
      currentInput: () => input,
      merchantInstruction: request.merchantInstruction,
    });

    expect(plan.designSystemSelection.directionId).toBe("modernTechnical");
    expect(plan.designSystemSelection.homepageRecipeId).toBe("homeModernCommerce");
    expect(plan.designSystemSelection.collectionPresentation.variant).toBe("compact");
    expect(plan.designSystemSelection.productPresentation.variant).toBe("compact");
    const providerInput = transport.calls[0]?.request.input ?? "";
    expect(providerInput).toContain("modern technical storefront");
    expect(providerInput).toContain("directionOptions");
    expect(providerInput).not.toContain("expectedPlan");
    expect(providerInput).not.toContain(request.expectedPlan.fingerprint);
  });

  it.each(directions)(
    "preserves the provider-selected %s direction through compile, accept, Undo, and Redo",
    async (directionId) => {
      const generated = await generateP905aScenarioFromSelectedDirection(
        directionId,
        "warmApproachable",
      );
      const expectedBrandSystem = registeredBrandSystemForDirection(
        generated.fixture.draft.brandSystem,
        generated.planningInput.recipeContext.designSystem,
        directionId,
      );

      expect(generated.plan.designSystemSelection.directionId).toBe(directionId);
      expect(generated.compiledProposal.preconditions.planFingerprint).toBe(
        generated.plan.fingerprint,
      );
      expect(generated.compiledProposal.operations).toContainEqual(
        expect.objectContaining({
          operation: {
            type: "APPLY_REGISTERED_BRAND_SYSTEM",
            directionId,
            brandSystem: expectedBrandSystem,
            designSystemNarrowing: {
              spacingDensity: generated.plan.designSystemSelection.spacingDensity,
              surfaceDepth: generated.plan.designSystemSelection.surfaceDepth,
            },
          },
        }),
      );
      expect(generated.proposal.proposedStorefront.brandSystem).toEqual(expectedBrandSystem);

      const coordinator = createP905aAcceptanceCoordinator(generated);
      const accepted = coordinator.accept();
      expect(accepted.failure).toBeNull();
      expect(accepted.activeDraft.brandSystem).toEqual(expectedBrandSystem);
      expect(coordinator.undo()).toEqual(generated.fixture.draft);
      expect(coordinator.redo()).toEqual(accepted.activeDraft);
      const saved = await saveAndResolveP905aPreview({
        generated,
        accepted: accepted.activeDraft,
      });
      expect(saved.preview.brandSystem).toEqual(expectedBrandSystem);
      expect(
        saved.saved.aggregate.snapshots.find(
          (snapshot) => snapshot.id === saved.saved.aggregate.project.publishedSnapshotId,
        ),
      ).toEqual(generated.fixture.published);
      expect(canonicalValueString(accepted.activeDraft.brandSystem)).not.toBe(
        canonicalValueString(generated.fixture.draft.brandSystem),
      );
    },
    15_000,
  );

  it("materializes distinct registered homepage, collection, PDP, and design-system choices", () => {
    expect(
      new Set(registeredPlans.map((plan) => plan.designSystemSelection.homepageRecipeId)).size,
    ).toBe(3);
    expect(
      new Set(registeredPlans.map((plan) => plan.designSystemSelection.productCardFamilyId)).size,
    ).toBe(3);
    expect(
      new Set(registeredPlans.map((plan) => plan.designSystemSelection.typographyDirectionId)).size,
    ).toBe(3);
    expect(
      new Set(registeredPlans.map((plan) => plan.designSystemSelection.spacingDensity)).size,
    ).toBe(3);
    expect(
      new Set(
        registeredPlans.map((plan) =>
          JSON.stringify(plan.designSystemSelection.collectionPresentation),
        ),
      ).size,
    ).toBe(3);
    expect(
      new Set(
        registeredPlans.map((plan) =>
          JSON.stringify(plan.designSystemSelection.productPresentation),
        ),
      ).size,
    ).toBe(3);
    registeredPlans.forEach((plan) => {
      const expected = p905aDirectionScenarios[plan.designSystemSelection.directionId].expected;
      expect(plan.designSystemSelection).toMatchObject({
        homepageRecipeId: expected.homepageRecipeId,
        productCardFamilyId: expected.productCardFamilyId,
        collectionPresentation: expected.collectionPresentation,
        productPresentation: expected.productPresentation,
      });
    });
  });
});
