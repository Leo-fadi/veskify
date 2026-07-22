import {
  createAiStorefrontProposalId,
  type AiStorefrontOperation,
} from "@/application/ai-storefront";
import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import {
  createExactBrandPaletteOperation,
  createStorefrontDesignSystemOperations,
  createStorefrontStyleOperations,
  type StorefrontStyleDirection,
} from "@/application/design-skills";
import {
  aiStorefrontProviderRequestSchema,
  aiStorefrontProviderResponseSchema,
  type AiStorefrontProviderRequest,
  type StorefrontAIProvider,
} from "./contract";

type MockStorefrontDirection = StorefrontStyleDirection | "exactBrandPalette";

function directionFromRequest(request: AiStorefrontProviderRequest): MockStorefrontDirection {
  const skillIds = new Set(request.permissionGrants.map((grant) => grant.skillId));
  if (skillIds.size !== 1)
    throw new Error("Storefront requests must use one approved style skill.");
  const skillId = [...skillIds][0];
  if (skillId === "applyWarmPremiumStorefrontStyle") return "warmPremium";
  if (skillId === "applyMinimalNordicStorefrontStyle") return "minimalNordic";
  if (skillId === "applyExactBrandPalette") return "exactBrandPalette";
  throw new Error("Unsupported storefront style skill.");
}

function proposalOperations(
  request: AiStorefrontProviderRequest,
  direction: MockStorefrontDirection,
): AiStorefrontOperation[] {
  const operations: AiStorefrontOperation[] = [];
  if (request.target.designSystemTarget !== null) {
    const designSystemOperations =
      direction === "exactBrandPalette"
        ? request.brandPalettePlan
          ? [createExactBrandPaletteOperation(request.brandPalettePlan.colors)]
          : []
        : createStorefrontDesignSystemOperations(direction);
    for (const operation of designSystemOperations) {
      operations.push({
        order: operations.length,
        target: request.target.designSystemTarget,
        operation,
      });
    }
  }
  if (direction === "exactBrandPalette") return operations;
  const targetSections = new Set(
    request.target.affectedSectionTargets.map((target) => `${target.pageId}:${target.sectionId}`),
  );
  for (const pageId of request.target.affectedPageIds) {
    const page = request.affectedPages.find((candidate) => candidate.id === pageId)!;
    for (const operation of createStorefrontStyleOperations(page, direction)) {
      if (!("sectionId" in operation)) continue;
      if (!targetSections.has(`${pageId}:${operation.sectionId}`)) continue;
      operations.push({
        order: operations.length,
        target: { kind: "section", pageId, sectionId: operation.sectionId },
        operation,
      });
    }
  }
  return operations;
}

function projectOperations(
  request: AiStorefrontProviderRequest,
  operations: readonly AiStorefrontOperation[],
) {
  const proposedStorefront = structuredClone(request.storefront);
  let affectedDesignState: {
    colors?: typeof proposedStorefront.brandSystem.colors;
    typography?: typeof proposedStorefront.brandSystem.typography;
  } | null = null;
  for (const envelope of operations) {
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_COLOURS") {
      proposedStorefront.brandSystem.colors = structuredClone(envelope.operation.colors);
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        colors: structuredClone(envelope.operation.colors),
      };
      continue;
    }
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY") {
      proposedStorefront.brandSystem.typography = structuredClone(envelope.operation.typography);
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        typography: structuredClone(envelope.operation.typography),
      };
      continue;
    }
    if (envelope.target.kind === "storefrontDesignSystem") {
      throw new Error("Unsupported global storefront operation.");
    }
    const pageId = envelope.target.pageId;
    const pageIndex = proposedStorefront.pages.findIndex((page) => page.id === pageId);
    proposedStorefront.pages[pageIndex] = validateDesignOperationAgainstPage(
      proposedStorefront.pages[pageIndex],
      envelope.operation,
    );
  }
  return { proposedStorefront, affectedDesignState };
}

export class DeterministicMockStorefrontAIProvider implements StorefrontAIProvider {
  readonly id = "deterministic-storefront-mock";

  proposeStorefront(requestInput: AiStorefrontProviderRequest) {
    const request = aiStorefrontProviderRequestSchema.parse(requestInput);
    const direction = directionFromRequest(request);
    const operations = proposalOperations(request, direction);
    const { proposedStorefront, affectedDesignState } = projectOperations(request, operations);
    const proposalId = createAiStorefrontProposalId(
      request.requestId,
      request.targetFingerprint,
      request.permissionFingerprint,
      operations,
    );
    const summary =
      direction === "exactBrandPalette"
        ? {
            en: [
              "Apply the validated merchant brand palette without changing typography, layout, imagery, content, products, or section structure.",
              ...(request.brandPalettePlan?.warnings.flatMap((warning) => warning.en ?? []) ?? []),
            ].join(" "),
            fi: [
              "Käytä kauppiaan validoitua brändiväripalettia muuttamatta typografiaa, asettelua, kuvia, sisältöä, tuotteita tai osiorakennetta.",
              ...(request.brandPalettePlan?.warnings.flatMap((warning) => warning.fi ?? []) ?? []),
            ].join(" "),
          }
        : direction === "warmPremium"
          ? {
              en: "Apply a consistent warm premium colour and typography direction across the selected storefront pages.",
              fi: "Käytä yhtenäistä lämmintä premium-väri- ja typografiailmettä valituilla kaupan sivuilla.",
            }
          : {
              en: "Apply a consistent minimal Nordic colour and typography direction across the selected storefront pages.",
              fi: "Käytä yhtenäistä pelkistettyä pohjoismaista väri- ja typografiailmettä valituilla kaupan sivuilla.",
            };
    return Promise.resolve(
      aiStorefrontProviderResponseSchema.parse({
        providerRequestId: request.requestId,
        providerId: this.id,
        proposal: {
          id: proposalId,
          requestId: request.requestId,
          projectId: request.target.projectId,
          draftSnapshotId: request.target.draftSnapshotId,
          draftRevision: request.target.draftRevision,
          target: request.target,
          originalStorefront: structuredClone(request.storefront),
          proposedStorefront,
          affectedPages: structuredClone(request.affectedPages),
          affectedDesignState,
          permissionGrants: structuredClone(request.permissionGrants),
          targetFingerprint: request.targetFingerprint,
          permissionFingerprint: request.permissionFingerprint,
          operations,
          summary,
          validation: { valid: true, errors: [] },
          status: "pending",
        },
        metadata: { operationCount: operations.length, durationMs: 0, validation: "valid" },
      }),
    );
  }
}

export function createDeterministicMockStorefrontAIProvider() {
  return new DeterministicMockStorefrontAIProvider();
}
