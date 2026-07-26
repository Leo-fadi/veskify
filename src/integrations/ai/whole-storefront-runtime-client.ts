"use client";

import {
  aiStorefrontProviderResponseSchema,
  type AiStorefrontProviderRequest,
  type StorefrontAIProvider,
} from "@/application/ai-storefront-generation";

export class ServerWholeStorefrontPlanningClient implements StorefrontAIProvider {
  readonly id = "server-whole-storefront-planning";
  readonly assetReferenceCapability = "structuredApprovedAssets" as const;

  async proposeStorefront(request: AiStorefrontProviderRequest): Promise<unknown> {
    const response = await fetch("/api/ai/whole-storefront-proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const body: unknown = await response.json().catch(() => null);
    const parsed = aiStorefrontProviderResponseSchema.safeParse(
      body && typeof body === "object" && "ok" in body && body.ok === true
        ? (body as unknown as { proposal: unknown }).proposal
        : null,
    );
    if (!response.ok || !parsed.success) {
      throw new Error("The storefront planning service is unavailable.");
    }
    return parsed.data;
  }
}

export function createServerWholeStorefrontPlanningClient() {
  return new ServerWholeStorefrontPlanningClient();
}
