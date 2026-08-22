// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { homepageProofContentSchema } from "@/components/registry/homepage-commerce";
import {
  P10B16P04_COMMERCIAL_PROJECT_ID,
  createP10B16P04RawAurumCommercialFixture,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { canonicalValueFingerprint, type PageFactEvidenceReference } from "@/domain/storefront";
import {
  isP10B16P04RealStudioAcceptanceConfigured,
  loadP10B16P04CurrentEvidenceReferences,
  P10B_16P_04_ACCEPTANCE_TOKEN_HEADER,
  P10B_16P_04_LOCAL_ACCEPTANCE_FLAG,
  P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN,
  P10B_16P_04_MOCK_TRANSPORT_FLAG,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import { createP10b18aShapeAuthorities } from "../helpers/p10b-18a-commercial-authority";
import {
  compileP10b18cCase,
  materializeP10b18cCase,
  p10b18cSemanticStrata,
} from "../helpers/p10b-18c-commercial-quality";

const capture115CaseId = "aurum-approved-presentation-image-rich--minimal-balanced-guided";
const diagnosticToken = "p10b18c-capture115-diagnostic-token-000000000001";
const productionCaptureEnvironment = {
  NODE_ENV: "production",
  P10B18C_PRODUCTION_CAPTURE: "1",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  [P10B_16P_04_LOCAL_ACCEPTANCE_FLAG]: "1",
  [P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN]: diagnosticToken,
  [P10B_16P_04_MOCK_TRANSPORT_FLAG]: "1",
} as const;

function referenceFingerprint(references: readonly PageFactEvidenceReference[]): string {
  return canonicalValueFingerprint(references);
}

function safeReference(reference: PageFactEvidenceReference) {
  return {
    source: reference.source,
    authorityId: reference.authorityId,
    revision: reference.revision,
    currentnessFingerprint: canonicalValueFingerprint({
      status: reference.status,
      approvalAuthorityId: reference.approvalAuthorityId,
      approvalFingerprint: reference.approvalFingerprint,
    }),
    evidenceReferenceFingerprint: canonicalValueFingerprint(reference),
  };
}

function classifyReference(
  reference: PageFactEvidenceReference,
  current: readonly PageFactEvidenceReference[],
) {
  if (current.length === 0) return "current-reference-set-empty" as const;
  const authority = current.find(({ authorityId }) => authorityId === reference.authorityId);
  if (!authority) return "authority-ID-mismatch" as const;
  if (authority.source !== reference.source) return "source-mismatch" as const;
  if (authority.revision !== reference.revision) return "revision-mismatch" as const;
  if (JSON.stringify(authority) !== JSON.stringify(reference))
    return "fingerprint-mismatch" as const;
  return "exact-current-match" as const;
}

function proofItems(snapshot: ReturnType<typeof materializeP10b18cCase>["snapshot"]) {
  const home = snapshot.pages.find(({ type }) => type === "home");
  if (!home) throw new Error("Capture 115 requires one homepage.");
  return home.sections
    .filter(({ component }) => component === "homepageProof")
    .flatMap((section) => {
      const content = homepageProofContentSchema.parse(section.content);
      return content.items.map((item) => ({
        sectionId: section.id,
        proofVariant: section.variant,
        proofItemId: item.id,
        evidence: item.evidence,
      }));
    });
}

describe("P10B-18C capture 115 evidence chain", () => {
  it("classifies the exact generated, saved and P04 page-authority reference chain", () => {
    const authority = createP10b18aShapeAuthorities(["aurum-approved-presentation-image-rich"])[0];
    const stratum = p10b18cSemanticStrata.find(({ id }) => id === "minimal-balanced-guided");
    expect(authority).toBeDefined();
    expect(stratum).toBeDefined();
    if (!authority || !stratum) return;
    const store = materializeP10b18cCase(compileP10b18cCase(authority, stratum));
    expect(store.compiled.caseId).toBe(capture115CaseId);

    const generationReferences =
      store.compiled.authority.compatibilityInput.approvedEvidenceReferences;
    const generatedItems = proofItems(store.snapshot);
    const saved = store.aggregate.snapshots.find(
      ({ id }) => id === store.aggregate.project.draftSnapshotId,
    );
    expect(saved).toBeDefined();
    if (!saved) return;
    const savedItems = proofItems(saved);

    const configured = isP10B16P04RealStudioAcceptanceConfigured(productionCaptureEnvironment);
    const loadedReferences =
      loadP10B16P04CurrentEvidenceReferences({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: new Headers({
          [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: diagnosticToken,
        }),
        environment: productionCaptureEnvironment,
      }) ?? [];
    const fixtureReferences = createP10B16P04RawAurumCommercialFixture().approvedEvidenceReferences;

    const generationMatches = generatedItems.every(
      ({ evidence }) => classifyReference(evidence, generationReferences) === "exact-current-match",
    );
    const savedReferencesSurvive =
      canonicalValueFingerprint(generatedItems.map(({ evidence }) => evidence)) ===
      canonicalValueFingerprint(savedItems.map(({ evidence }) => evidence));
    const loaderMatchesGeneration =
      referenceFingerprint(loadedReferences) === referenceFingerprint(generationReferences);
    const fixtureMatchesGeneration =
      referenceFingerprint(fixtureReferences) === referenceFingerprint(generationReferences);
    const rootClass = !generationMatches
      ? "E"
      : !loaderMatchesGeneration || !fixtureMatchesGeneration
        ? "C"
        : !savedReferencesSurvive
          ? "D"
          : "F";

    const safeTrace = {
      caseId: capture115CaseId,
      projectIdMatched: store.aggregate.project.id === P10B16P04_COMMERCIAL_PROJECT_ID,
      productionCaptureConjunctionValid: configured,
      tokenPresent: true,
      tokenAuthorized: loadedReferences.length > 0,
      generatedProofItems: generatedItems.map(({ evidence, ...item }) => ({
        ...item,
        ...safeReference(evidence),
        resolution: classifyReference(evidence, generationReferences),
      })),
      generationAuthority: {
        approvedReferenceCount: generationReferences.length,
        matchingAuthorityIds: generationReferences.map(({ authorityId }) => authorityId).sort(),
        aggregateFingerprint: referenceFingerprint(generationReferences),
        everyProofItemExactBeforeMaterialization: generationMatches,
      },
      savedSnapshot: {
        proofReferenceCount: savedItems.length,
        referencesSurvive: savedReferencesSurvive,
        aggregateFingerprint: canonicalValueFingerprint(savedItems.map(({ evidence }) => evidence)),
      },
      pageAuthority: {
        configured,
        returnedReferenceCount: loadedReferences.length,
        aggregateFingerprint: referenceFingerprint(loadedReferences),
        matchesGeneration: loaderMatchesGeneration,
      },
      fixtureAuthority: {
        returnedReferenceCount: fixtureReferences.length,
        aggregateFingerprint: referenceFingerprint(fixtureReferences),
        matchesGeneration: fixtureMatchesGeneration,
      },
      rootClass,
    };
    console.info(`P10B18C_CAPTURE_115_SAFE_TRACE ${JSON.stringify(safeTrace)}`);

    expect(configured).toBe(true);
    expect(loadedReferences.length).toBeGreaterThan(0);
    expect(generatedItems.length).toBeGreaterThan(0);
    expect(["C", "D", "E", "F"]).toContain(rootClass);
  });
});
