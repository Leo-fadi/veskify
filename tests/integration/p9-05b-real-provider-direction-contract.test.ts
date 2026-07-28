// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildWholeStorefrontPlanningProviderRequest,
  requestWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan";
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

const directions: P905aDirectionId[] = ["premiumEditorial", "modernTechnical", "warmApproachable"];

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
        directionId: this.directionId,
      }),
    });
  }
}

function planningInput() {
  return createP905aFreshMerchantFixture("warmApproachable").planningInput;
}

describe("P9-05B real-provider direction contract", () => {
  it("uses the merchant request to choose a registered direction without sending a final plan", async () => {
    const input = planningInput();
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

  it("materializes distinct registered homepage, collection, PDP, and design-system choices", async () => {
    const input = planningInput();
    const plans = await Promise.all(
      directions.map(async (directionId) => {
        const transport = new DirectionTransport(directionId);
        const provider = new OpenAiWholeStorefrontPlanningProvider({
          responses: transport,
          model: "mocked-p9-05b-model",
          timeoutMs: 1_000,
        });
        return requestWholeStorefrontGenerationPlan({
          provider,
          input,
          currentInput: () => input,
          merchantInstruction: `Select the ${directionId} direction for the approved Lumo storefront.`,
        });
      }),
    );

    expect(new Set(plans.map((plan) => plan.designSystemSelection.homepageRecipeId)).size).toBe(3);
    expect(new Set(plans.map((plan) => plan.designSystemSelection.productCardFamilyId)).size).toBe(
      3,
    );
    expect(
      new Set(plans.map((plan) => plan.designSystemSelection.typographyDirectionId)).size,
    ).toBe(3);
    expect(new Set(plans.map((plan) => plan.designSystemSelection.spacingDensity)).size).toBe(3);
    expect(
      new Set(
        plans.map((plan) => JSON.stringify(plan.designSystemSelection.collectionPresentation)),
      ).size,
    ).toBe(3);
    expect(
      new Set(plans.map((plan) => JSON.stringify(plan.designSystemSelection.productPresentation)))
        .size,
    ).toBe(3);
    plans.forEach((plan) => {
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
