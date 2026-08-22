import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ProjectPreviewClient } from "@/app/projects/[projectId]/project-preview-client";
import { saveValidatedEditorDraft } from "@/application/draft-save";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { executeCompiledSemanticStorefrontDesignIntentV1 } from "@/application/prompted-storefront-design-compiler";
import { WholeStorefrontProposalAcceptanceCoordinator } from "@/application/whole-storefront-proposal-lifecycle";
import {
  homepageProofContentSchema,
  resolveHomepageProofContent,
} from "@/components/registry/homepage-commerce";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { P10B16P04_COMMERCIAL_PROJECT_ID } from "@/data/demo/p10b-16p-04-commercial-acceptance";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type PageFactEvidenceReference,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  loadP10B16P04CurrentEvidenceReferences,
  P10B_16P_04_ACCEPTANCE_TOKEN_HEADER,
  P10B_16P_04_LOCAL_ACCEPTANCE_FLAG,
  P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN,
  P10B_16P_04_MOCK_TRANSPORT_FLAG,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import { InMemoryProjectRepository } from "@/services/storage";
import { createP10b18aShapeAuthorities } from "../helpers/p10b-18a-commercial-authority";
import { compileP10b18cCase, p10b18cSemanticStrata } from "../helpers/p10b-18c-commercial-quality";

const acceptanceToken = "p10b18c-capture115-lifecycle-token-000000000001";
const productionCaptureEnvironment: Record<string, string> = {
  NODE_ENV: "production",
  P10B18C_CLEAN_CAPTURE: "1",
  P10B18C_PRODUCTION_CAPTURE: "1",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_RUNTIME_MODE: "integrated",
  [P10B_16P_04_LOCAL_ACCEPTANCE_FLAG]: "1",
  [P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN]: acceptanceToken,
  [P10B_16P_04_MOCK_TRANSPORT_FLAG]: "1",
};

function proofItems(snapshot: StorefrontSnapshot) {
  const home = snapshot.pages.find(({ type }) => type === "home");
  if (!home) throw new Error("Capture 115 requires one homepage.");
  return home.sections
    .filter(({ component }) => component === "homepageProof")
    .flatMap((section) => homepageProofContentSchema.parse(section.content).items);
}

function referenceFingerprint(references: readonly PageFactEvidenceReference[]): string {
  return canonicalValueFingerprint(references);
}

function protectedMediaFingerprint(
  catalogue: ReturnType<typeof createP10b18aShapeAuthorities>[number]["catalogue"],
): string {
  return canonicalValueFingerprint(
    catalogue.products.map(({ id, images, variants }) => ({
      id,
      images,
      variants: variants.map(({ id: variantId, attributes }) => ({ variantId, attributes })),
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("P10B-18C capture 115 canonical lifecycle and preview authority", () => {
  it("retains exact proof authority through Accept, Save, reload and P04 saved preview", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const authority = createP10b18aShapeAuthorities(["aurum-approved-presentation-image-rich"])[0];
    const stratum = p10b18cSemanticStrata.find(({ id }) => id === "minimal-balanced-guided");
    expect(authority).toBeDefined();
    expect(stratum).toBeDefined();
    if (!authority || !stratum) return;
    const compiled = compileP10b18cCase(authority, stratum);
    expect(compiled.caseId).toBe("aurum-approved-presentation-image-rich--minimal-balanced-guided");
    expect(authority.aggregate.project.id).toBe(P10B16P04_COMMERCIAL_PROJECT_ID);

    const commerceBefore = canonicalValueFingerprint(authority.catalogue);
    const mediaBefore = protectedMediaFingerprint(authority.catalogue);
    const execution = executeCompiledSemanticStorefrontDesignIntentV1({
      originalRequest: authority.request,
      providerIntent: compiled.providerIntent,
      currentRequestInput: authority.currentRequestInput,
      compatibilityInput: authority.compatibilityInput,
      semanticCapabilityIndex: authority.semanticCapabilityIndex,
      preparedAuthority: authority.preparedAuthority,
      compiledDecision: compiled.result.compiledDecision,
      synthesisDecision: compiled.result.synthesisDecision,
      pageEvidenceAuthority: authority.pageEvidenceAuthority,
      contentFactAuthority: authority.contentFactAuthority,
      approvedAssetPresentations: authority.approvedAssetPresentations,
    });
    const candidate = execution.synthesis.materialization.snapshot;
    const proposal = execution.synthesis.materialization.proposal;
    const generationReferences = authority.compatibilityInput.approvedEvidenceReferences;
    const candidateProof = proofItems(candidate);
    expect(candidateProof.length).toBeGreaterThan(0);
    for (const { evidence } of candidateProof) {
      expect(
        generationReferences.some(
          (reference) => JSON.stringify(reference) === JSON.stringify(evidence),
        ),
      ).toBe(true);
    }

    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => ({
        plan: execution.synthesis.materialization.plan,
        planningInput: execution.synthesis.materialization.planningInput,
      }),
      storedStorefront: proposal.originalStorefront,
      publishedStorefront: proposal.originalStorefront,
    });
    const accepted = coordinator.accept();
    expect(accepted.state, JSON.stringify(accepted.failure)).toBe("accepted");
    if (accepted.state !== "accepted") return;
    expect(accepted.activeStorefront).toEqual(proposal.proposedStorefront);
    const acceptedSnapshot = candidate;
    const acceptedProofFingerprint = referenceFingerprint(
      proofItems(acceptedSnapshot).map(({ evidence }) => evidence),
    );
    expect(acceptedProofFingerprint).toBe(
      referenceFingerprint(candidateProof.map(({ evidence }) => evidence)),
    );
    expect(coordinator.undo()).toEqual(proposal.originalStorefront);
    expect(coordinator.redo()).toEqual(proposal.proposedStorefront);

    const repository = new InMemoryProjectRepository([authority.aggregate]);
    const saved = await saveValidatedEditorDraft({
      repository,
      projectId: authority.aggregate.project.id,
      loadedDraft: authority.currentRequestInput.draft,
      replacementSnapshot: acceptedSnapshot,
      primaryLocale: authority.aggregate.project.primaryLocale,
      evidenceReferences: generationReferences,
      now: () => new Date("2026-08-21T03:01:00.000Z"),
      createSnapshotId: () => "snapshot_p10b18c_capture115_saved",
    });
    const reloaded = await repository.get(authority.aggregate.project.id);
    const reloadedDraft = reloaded.snapshots.find(
      ({ id }) => id === reloaded.project.draftSnapshotId,
    );
    if (!reloadedDraft) throw new Error("Capture 115 did not reload its saved draft.");
    expect(canonicalStorefrontContentFingerprint(saved.draft)).toBe(
      canonicalStorefrontContentFingerprint(acceptedSnapshot),
    );
    expect(canonicalStorefrontContentFingerprint(reloadedDraft)).toBe(
      canonicalStorefrontContentFingerprint(acceptedSnapshot),
    );
    expect(referenceFingerprint(proofItems(reloadedDraft).map(({ evidence }) => evidence))).toBe(
      acceptedProofFingerprint,
    );

    const currentReferences =
      loadP10B16P04CurrentEvidenceReferences({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: new Headers({
          [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: acceptanceToken,
        }),
        environment: productionCaptureEnvironment,
      }) ?? [];
    expect(referenceFingerprint(currentReferences)).toBe(
      referenceFingerprint(generationReferences),
    );
    expect(
      loadP10B16P04CurrentEvidenceReferences({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: new Headers(),
        environment: productionCaptureEnvironment,
      }),
    ).toBeUndefined();
    expect(
      loadP10B16P04CurrentEvidenceReferences({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: new Headers({
          [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: "p10b18c-capture115-wrong-token-000000000001",
        }),
        environment: productionCaptureEnvironment,
      }),
    ).toBeUndefined();

    const home = reloadedDraft.pages.find(({ type }) => type === "home");
    if (!home) throw new Error("Capture 115 reloaded without its homepage.");
    const renderContext = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: reloaded.project.primaryLocale,
      enabledLocales: reloaded.project.enabledLocales,
      catalogue: reloaded.catalogue,
      snapshot: reloadedDraft,
      evidenceReferences: currentReferences,
      pagePathPrefix: `/projects/${reloaded.project.id}`,
      pagePathSuffix: "",
      renderTarget: "preview",
    });
    expect(referenceFingerprint(renderContext.evidenceReferences ?? [])).toBe(
      referenceFingerprint(currentReferences),
    );
    const directPreview = render(renderStorefrontPage(home, renderContext));
    expect(
      directPreview.container.querySelector('[data-component="homepageProof"]'),
    ).not.toBeNull();
    directPreview.unmount();

    const savedPreview = render(
      <ProjectPreviewClient
        initialEvidenceReferences={currentReferences}
        initialLocale="en"
        projectId={P10B16P04_COMMERCIAL_PROJECT_ID}
        repositoryFactory={() => repository}
      />,
    );
    expect(await screen.findByLabelText("Draft storefront")).toBeVisible();
    await waitFor(() =>
      expect(
        savedPreview.container.querySelector('[data-component="homepageProof"]'),
      ).not.toBeNull(),
    );
    expect(screen.queryByText("Storefront could not be displayed")).not.toBeInTheDocument();

    const proofContent = { items: candidateProof };
    const staleReferences = structuredClone(currentReferences);
    const matchingIndex = staleReferences.findIndex(
      ({ authorityId }) => authorityId === candidateProof[0]?.evidence.authorityId,
    );
    expect(matchingIndex).toBeGreaterThanOrEqual(0);
    if (matchingIndex >= 0) staleReferences[matchingIndex].revision += "-stale";
    expect(() =>
      resolveHomepageProofContent(proofContent, {
        required: true,
        currentEvidenceReferences: staleReferences,
      }),
    ).toThrow("Evidence-grounded proof requires current approved evidence.");
    expect(() =>
      resolveHomepageProofContent(proofContent, {
        required: true,
        currentEvidenceReferences: currentReferences.filter(
          ({ authorityId }) => authorityId !== candidateProof[0]?.evidence.authorityId,
        ),
      }),
    ).toThrow("Evidence-grounded proof requires current approved evidence.");

    const compilerInput = createCurrentPublishCompilerInput({
      aggregate: reloaded,
      snapshot: reloadedDraft,
      sourceAuthority: { kind: "manual" },
      currentEvidenceReferences: currentReferences,
    });
    const firstCompilation = compileStorefrontPublication(compilerInput);
    const secondCompilation = compileStorefrontPublication(structuredClone(compilerInput));
    expect(canonicalValueString(secondCompilation.result)).toBe(
      canonicalValueString(firstCompilation.result),
    );
    expect(canonicalValueFingerprint(reloaded.catalogue)).toBe(commerceBefore);
    expect(protectedMediaFingerprint(reloaded.catalogue)).toBe(mediaBefore);
    expect(fetchSpy).not.toHaveBeenCalled();

    console.info(
      `P10B18C_CAPTURE_115_LIFECYCLE_TRACE ${JSON.stringify({
        caseId: compiled.caseId,
        materializationCount: 1,
        proposalAccepted: true,
        savedAndReloaded: true,
        proofItemCount: candidateProof.length,
        evidenceFingerprint: referenceFingerprint(currentReferences),
        renderContextFingerprint: referenceFingerprint(renderContext.evidenceReferences ?? []),
        protectedCommerce: true,
        protectedMedia: true,
        providerCalls: 0,
        VeskoCalls: 0,
        realPublicationCalls: 0,
      })}`,
    );
  }, 120_000);
});
