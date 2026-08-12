import {
  createPromptedStorefrontDesignRequestV2,
  promptedStorefrontDesignIntentFingerprint,
  validatePromptedStorefrontDesignIntentV2,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type PromptedStorefrontDesignIntentProvider,
} from "@/application/prompted-storefront-design-intent";
import { createWholeStorefrontGenerationTarget } from "@/application/whole-storefront-generation-plan";
import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import type { PageFactEvidenceAuthority } from "@/application/storefront-site-map";
import type { ApprovedAssetPresentation } from "@/application/whole-storefront-generation-plan";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  PromptedStorefrontDesignCompilerError,
  type CompiledPromptedStorefrontDesignDecisionV2,
} from "./contract";
import {
  compilePromptedStorefrontDesignIntentV2,
  type CompilePromptedStorefrontDesignIntentV2Input,
} from "./compiler";
import {
  executeCompiledPromptedStorefrontDesignDecisionV2,
  type ExecuteCompiledPromptedStorefrontDesignDecisionV2Input,
  type ExecutedPromptedStorefrontDesignDecisionV2,
} from "./executor";

/**
 * Exact current application authority required both before and after the
 * provider response. It deliberately contains the existing authorities rather
 * than a new persistent generation plan.
 */
export type PromptedStorefrontDesignCompilationAuthority = Readonly<{
  requestInput: CreatePromptedStorefrontDesignRequestV2Input;
  compatibilityInput: CompilePromptedStorefrontDesignIntentV2Input["compatibilityInput"];
  pageEvidenceAuthority: PageFactEvidenceAuthority;
  contentFactAuthority: ContentSupportFactAuthority;
  approvedAssetPresentations: readonly ApprovedAssetPresentation[];
}>;

type CompiledDecisionExecutor = (
  input: ExecuteCompiledPromptedStorefrontDesignDecisionV2Input,
) => ExecutedPromptedStorefrontDesignDecisionV2;

export type RunPromptedStorefrontDesignCompilationInput = Readonly<{
  provider: PromptedStorefrontDesignIntentProvider;
  /** Reloads the authoritative project, snapshot, capability, evidence, asset and commerce state. */
  loadCurrentAuthority: () => PromptedStorefrontDesignCompilationAuthority;
  maximumCandidateEvaluations?: number;
  /** Test-only seam that instruments the one permitted complete materialization. */
  executeCompiledDecision?: CompiledDecisionExecutor;
}>;

export type PromptedStorefrontDesignCompilationEvidence = Readonly<{
  providerId: string;
  modelId: string | null;
  requestFingerprint: string;
  promptFingerprint: string;
  providerIntentFingerprint: string;
  compiledDecisionFingerprint: string;
  synthesisFingerprint: string;
  structuralFingerprint: string;
  candidateSnapshotFingerprint: string;
  currentAuthorityFingerprints: readonly string[];
  protectedCommerceBeforeFingerprint: string;
  protectedCommerceAfterFingerprint: string;
  protectedMediaBeforeFingerprint: string;
  protectedMediaAfterFingerprint: string;
  materializationCount: 1;
}>;

export type PromptedStorefrontDesignCompilationResult = Readonly<{
  compiledDecision: CompiledPromptedStorefrontDesignDecisionV2;
  execution: ExecutedPromptedStorefrontDesignDecisionV2;
  evidence: PromptedStorefrontDesignCompilationEvidence;
}>;

function stale(message: string): never {
  throw new PromptedStorefrontDesignCompilerError("stale-authority", message);
}

function assertSameAuthority(
  before: ReturnType<typeof createPromptedStorefrontDesignRequestV2>,
  after: ReturnType<typeof createPromptedStorefrontDesignRequestV2>,
): void {
  if (
    before.request.requestFingerprint !== after.request.requestFingerprint ||
    canonicalValueString(before.request.currentAuthority) !==
      canonicalValueString(after.request.currentAuthority) ||
    before.capabilityAuthority.projection.fingerprint !==
      after.capabilityAuthority.projection.fingerprint
  ) {
    stale("Current storefront authority changed after the provider response.");
  }
}

function protectedMediaAuthorityFingerprint(
  input: CreatePromptedStorefrontDesignRequestV2Input,
  catalogueRef: string,
): string {
  return `protected-product-media-${canonicalValueFingerprint({
    catalogueRef,
    products: input.catalogue.products
      .map(({ id, images }) => ({ id, images }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  })}`;
}

function protectedRouteInventory(snapshot: StorefrontSnapshot) {
  return [...(snapshot.dynamicCommercePresentation?.routeInventory ?? [])]
    .map((route) => structuredClone(route))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function protectedAuthorityFingerprints(
  input: PromptedStorefrontDesignCompilationAuthority,
  catalogueRef = input.requestInput.draft.catalogueRef,
) {
  const canonicalCommerceAuthorityFingerprint = createWholeStorefrontGenerationTarget(
    input.compatibilityInput.planningInput,
  ).canonicalCommerceFingerprint;
  return {
    commerce: `protected-commerce-${canonicalValueFingerprint(
      canonicalCommerceAuthorityFingerprint,
    )}`,
    media: protectedMediaAuthorityFingerprint(input.requestInput, catalogueRef),
    canonicalCommerceAuthorityFingerprint,
  };
}

function assertMaterializedProtectedAuthority(
  authority: PromptedStorefrontDesignCompilationAuthority,
  execution: ExecutedPromptedStorefrontDesignDecisionV2,
) {
  const expected = protectedAuthorityFingerprints(authority);
  const materialization = execution.synthesis.materialization;
  const proposal = materialization.proposal;
  const runtime = proposal.proposedStorefront;
  const snapshot = materialization.snapshot;
  if (
    materialization.plan.target.canonicalCommerceFingerprint !==
      expected.canonicalCommerceAuthorityFingerprint ||
    proposal.preconditions.canonicalCommerceFingerprint !==
      expected.canonicalCommerceAuthorityFingerprint ||
    runtime.canonicalCommerceFingerprint !== expected.canonicalCommerceAuthorityFingerprint ||
    snapshot.catalogueRef !== authority.requestInput.draft.catalogueRef ||
    canonicalValueString(protectedRouteInventory(snapshot)) !==
      canonicalValueString(protectedRouteInventory(authority.requestInput.draft))
  ) {
    stale("The materialized storefront changed protected commerce authority.");
  }

  const products = new Set(authority.requestInput.catalogue.products.map(({ id }) => id));
  const collections = new Map(
    authority.requestInput.catalogue.collections.map((collection) => [
      collection.id,
      collection.productIds,
    ]),
  );
  for (const page of runtime.pages) {
    for (const component of page.components) {
      const primaryCollection = component.bindings.find(
        (binding) => binding.source === "collection" && binding.slotId === "primaryCollection",
      );
      for (const binding of component.bindings) {
        if (
          ["product", "productList", "collection", "collectionList"].includes(binding.source) &&
          binding.revision !== expected.canonicalCommerceAuthorityFingerprint
        ) {
          stale("A materialized commerce binding uses stale canonical authority.");
        }
        if (binding.source === "product" && !products.has(binding.productId)) {
          stale("A materialized product binding escaped canonical commerce authority.");
        }
        if (
          binding.source === "productList" &&
          binding.productIds.some((productId) => !products.has(productId))
        ) {
          stale("A materialized product-list binding escaped canonical commerce authority.");
        }
        if (binding.source === "collection" && !collections.has(binding.collectionId)) {
          stale("A materialized collection binding escaped canonical commerce authority.");
        }
        if (
          binding.source === "collectionList" &&
          binding.collectionIds.some((collectionId) => !collections.has(collectionId))
        ) {
          stale("A materialized collection-list binding escaped canonical commerce authority.");
        }
        if (
          binding.source === "productList" &&
          binding.slotId === "collectionProducts" &&
          primaryCollection?.source === "collection" &&
          canonicalValueString(binding.productIds) !==
            canonicalValueString(collections.get(primaryCollection.collectionId) ?? null)
        ) {
          stale("A materialized collection changed canonical ordered product membership.");
        }
      }
      if (
        component.assetAssignments.some(({ role }) =>
          ["productMainImage", "productAlternativeImage"].includes(role),
        )
      ) {
        stale("A materialized component replaced protected canonical product media.");
      }
    }
  }
  const snapshotSections = [
    ...(snapshot.sharedFrame
      ? [
          snapshot.sharedFrame.header,
          snapshot.sharedFrame.footer,
          ...(snapshot.sharedFrame.announcement ? [snapshot.sharedFrame.announcement] : []),
        ]
      : []),
    ...snapshot.pages.flatMap(({ sections }) => sections),
  ];
  if (
    snapshotSections.some(
      ({ approvedAssetPlacements }) =>
        approvedAssetPlacements?.some(({ role }) =>
          ["productMainImage", "productAlternativeImage"].includes(role),
        ) ?? false,
    )
  ) {
    stale("The materialized snapshot replaced protected canonical product media.");
  }
  return {
    commerce: `protected-commerce-${canonicalValueFingerprint(
      runtime.canonicalCommerceFingerprint,
    )}`,
    media: protectedMediaAuthorityFingerprint(authority.requestInput, snapshot.catalogueRef),
  };
}

/**
 * Provider-neutral, server-side post-response sequence. It has no Studio or
 * route wiring: P10B-16P-03 owns merchant-facing invocation. This function
 * never retries or falls back; it calls the injected provider once, refreshes
 * authority, and performs the one canonical synthesis materialization only
 * after a validated V2 intent and exact compiled decision exist.
 */
export async function runPromptedStorefrontDesignCompilation(
  input: RunPromptedStorefrontDesignCompilationInput,
): Promise<PromptedStorefrontDesignCompilationResult> {
  const before = input.loadCurrentAuthority();
  const initial = createPromptedStorefrontDesignRequestV2(before.requestInput);
  const protectedBefore = protectedAuthorityFingerprints(before);

  const providerIntent = await input.provider.createDesignIntent(initial.request, {
    capabilityAuthority: initial.capabilityAuthority,
    currentAuthority: () => initial.request.currentAuthority,
  });

  const refreshed = input.loadCurrentAuthority();
  const current = createPromptedStorefrontDesignRequestV2(refreshed.requestInput);
  assertSameAuthority(initial, current);
  const refreshedProtectedAuthority = protectedAuthorityFingerprints(refreshed);
  if (
    protectedBefore.commerce !== refreshedProtectedAuthority.commerce ||
    protectedBefore.media !== refreshedProtectedAuthority.media
  ) {
    stale(
      "Protected commerce or canonical product-media authority changed after the provider response.",
    );
  }

  const { intentFingerprint, ...providerIntentMaterial } = providerIntent;
  if (intentFingerprint !== promptedStorefrontDesignIntentFingerprint(providerIntentMaterial)) {
    throw new PromptedStorefrontDesignCompilerError(
      "invalid-input",
      "The provider intent fingerprint is stale.",
    );
  }
  const validatedIntent = validatePromptedStorefrontDesignIntentV2({
    request: current.request,
    capabilityAuthority: current.capabilityAuthority,
    currentAuthority: current.request.currentAuthority,
    intent: providerIntentMaterial,
  });
  const compileInput: CompilePromptedStorefrontDesignIntentV2Input = {
    originalRequest: initial.request,
    providerIntent: validatedIntent,
    currentRequestInput: refreshed.requestInput,
    compatibilityInput: refreshed.compatibilityInput,
    ...(input.maximumCandidateEvaluations === undefined
      ? {}
      : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
  };
  const compiledDecision = compilePromptedStorefrontDesignIntentV2(compileInput);
  const execute =
    input.executeCompiledDecision ?? executeCompiledPromptedStorefrontDesignDecisionV2;
  const execution = execute({
    ...compileInput,
    compiledDecision,
    pageEvidenceAuthority: refreshed.pageEvidenceAuthority,
    contentFactAuthority: refreshed.contentFactAuthority,
    approvedAssetPresentations: refreshed.approvedAssetPresentations,
  });
  const candidate = execution.synthesis.materialization.snapshot;
  const protectedAfter = assertMaterializedProtectedAuthority(refreshed, execution);

  return Object.freeze({
    compiledDecision: structuredClone(compiledDecision),
    execution,
    evidence: Object.freeze({
      providerId: input.provider.id,
      modelId: input.provider.modelId,
      requestFingerprint: initial.request.requestFingerprint,
      promptFingerprint: initial.request.promptFingerprint,
      providerIntentFingerprint: validatedIntent.intentFingerprint,
      compiledDecisionFingerprint: compiledDecision.compiledDecisionFingerprint,
      synthesisFingerprint: execution.synthesis.decision.synthesisFingerprint,
      structuralFingerprint: compiledDecision.structuralFingerprint,
      candidateSnapshotFingerprint: canonicalStorefrontContentFingerprint(candidate),
      currentAuthorityFingerprints: [...compiledDecision.exactAuthorityFingerprints],
      protectedCommerceBeforeFingerprint: protectedBefore.commerce,
      protectedCommerceAfterFingerprint: protectedAfter.commerce,
      protectedMediaBeforeFingerprint: protectedBefore.media,
      protectedMediaAfterFingerprint: protectedAfter.media,
      materializationCount: 1,
    }),
  });
}
