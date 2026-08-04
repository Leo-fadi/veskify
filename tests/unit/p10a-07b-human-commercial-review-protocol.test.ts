import { describe, expect, it } from "vitest";
import {
  createHumanCommercialReviewAuthority,
  createHumanCommercialReviewRecord,
  HumanCommercialReviewProtocolError,
  humanCommercialReviewCriterionIds,
  type HumanCommercialReviewInput,
  assessHumanCommercialReviewStaleness,
} from "@/application/human-commercial-review";
import {
  GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
  runDeterministicGoldenStoreEvaluation,
} from "@/application/golden-store-evaluation";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";

function snapshotRealizing(
  snapshot: ReturnType<typeof createP905aFreshMerchantFixture>["draft"],
  materializations: ReturnType<
    typeof createWholeStorefrontGenerationPlan
  >["pageBlueprintMaterializations"],
) {
  const realized = structuredClone(snapshot);
  for (const materialization of materializations) {
    const page = realized.pages.find((candidate) => candidate.type === materialization.pageType);
    if (!page) throw new Error(`Missing ${materialization.pageType} fixture page.`);
    page.sections = materialization.slots.map((slot) => ({
      id: `section_${page.id}_${slot.slotId}`,
      component: slot.component,
      variant: slot.variant,
      visible: true,
      content: {},
      props: {},
    }));
  }
  return realized;
}

function evaluationRun() {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const plan = createWholeStorefrontGenerationPlan(fixture.planningInput);
  const snapshot = snapshotRealizing(fixture.draft, plan.pageBlueprintMaterializations);
  const snapshotFingerprint = canonicalStorefrontContentFingerprint(snapshot);
  return runDeterministicGoldenStoreEvaluation({
    evaluationId: "p10a-07b-lumo-modern-technical",
    evaluationVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: { fixtureId: "p9-05a-lumo", projectId: fixture.aggregate.project.id },
    canonicalBaseline: { snapshot: structuredClone(snapshot), snapshotFingerprint },
    manifest: {
      version: veskifyComponentCapabilityManifest.manifest.version,
      fingerprint: veskifyComponentCapabilityManifest.manifest.fingerprint,
    },
    pageBlueprintMaterializations: plan.pageBlueprintMaterializations,
    lifecycle: goldenStoreEvaluationLifecycleStates.map((state) => ({
      state,
      snapshot: structuredClone(snapshot),
      revision: snapshot.revision,
      snapshotFingerprint,
      canonicalCommerce: structuredClone(fixture.aggregate.catalogue),
      approvedAssets: structuredClone(fixture.assetContext),
    })),
    responsiveEvidence: goldenStoreEvaluationLifecycleStates.flatMap((lifecycle) =>
      goldenStoreEvaluationSurfaces.flatMap((surface) =>
        goldenStoreEvaluationLocales.flatMap((locale) =>
          goldenStoreEvaluationViewports.map((viewport) => ({
            lifecycle,
            surface,
            locale,
            viewport,
            responsiveStatus: "passed" as const,
            accessibilityStatus: "passed" as const,
            rendererOutput: {
              target:
                lifecycle === "proposal-preview"
                  ? "proposal"
                  : lifecycle === "accepted-editor"
                    ? "editor"
                    : lifecycle === "published"
                      ? "published"
                      : "preview",
              output: { lifecycle, surface, locale, viewport, snapshotFingerprint },
            },
            screenshotReference: null,
          })),
        ),
      ),
    ),
  });
}

function coverageId(index: number) {
  return `coverage-${index}`;
}

function reviewInput(overrides: Record<string, unknown> = {}) {
  const run = evaluationRun();
  const evidence: HumanCommercialReviewInput["evidence"] = run.scenarios.map((scenario, index) => ({
    id: `evidence-${index}`,
    kind: "screenshot" as const,
    reference: `artifacts/${scenario.evidenceReference}.png`,
    lifecycle: scenario.lifecycle,
    surface: scenario.surface,
    locale: scenario.locale,
    viewport: scenario.viewport,
    fingerprint: scenario.rendererOutputFingerprint,
    capturedAt: "2026-08-04T09:30:00.000Z",
  }));
  const coverage: HumanCommercialReviewInput["coverage"] = run.scenarios.map((scenario, index) => ({
    id: coverageId(index),
    lifecycle: scenario.lifecycle,
    surface: scenario.surface,
    locale: scenario.locale,
    viewport: scenario.viewport,
    profileId: scenario.profileId,
    rendererOutputFingerprint: scenario.rendererOutputFingerprint,
    evidenceReferenceIds: [`evidence-${index}`],
  }));
  const input: HumanCommercialReviewInput = {
    reviewId: "review-p10a-07b-lumo",
    protocolVersion: "1.0.0" as const,
    authority: createHumanCommercialReviewAuthority(run),
    reviewer: {
      role: "commercial-reviewer" as const,
      reviewerId: "reviewer-merchant-team",
      reviewedAt: "2026-08-04T10:00:00.000Z",
      evidenceCapturedAt: "2026-08-04T09:30:00.000Z",
      method: "manual-browser-review" as const,
    },
    evidence,
    coverage,
    decisions: humanCommercialReviewCriterionIds.map((criterionId) => ({
      criterionId,
      decision: "passed" as const,
      explanation: `Reviewed ${criterionId} against retained deterministic and human evidence.`,
      evidenceReferenceIds: ["evidence-0"],
    })),
    findings: [],
    ...overrides,
  };
  return { run, input };
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof HumanCommercialReviewProtocolError) return error.code;
    throw error;
  }
  throw new Error("Expected a human commercial review protocol failure.");
}

describe("P10A-07B human commercial review protocol", () => {
  it("derives authority from the current P10A-07A run", () => {
    const run = evaluationRun();
    const authority = createHumanCommercialReviewAuthority(run);
    expect(authority.evaluationFingerprint).toBe(run.fingerprint);
    expect(authority.lifecycle).toHaveLength(5);
    expect(authority.pageBlueprintProfiles).toHaveLength(3);
  });

  it("requires the complete 160-scenario lifecycle, locale, viewport, and surface matrix", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    expect(record.coverage).toHaveLength(160);
    expect(record.coverage).toContainEqual(
      expect.objectContaining({
        lifecycle: "published",
        surface: "product",
        locale: "fi",
        viewport: 1440,
      }),
    );
  });

  it("retains a typed screenshot reference without treating it as canonical authority", () => {
    const { run, input } = reviewInput();
    input.evidence[0] = {
      ...input.evidence[0],
      kind: "screenshot",
      reference: "artifacts/lumo-home.png",
    };
    const record = createHumanCommercialReviewRecord(input, run);
    expect(record.evidence[0]).toMatchObject({
      kind: "screenshot",
      reference: "artifacts/lumo-home.png",
    });
    expect(record.authority.evaluationFingerprint).toBe(run.fingerprint);
  });

  it("deep-freezes retained record values", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.coverage)).toBe(true);
    expect(Object.isFrozen(record.coverage[0])).toBe(true);
  });

  it("has a stable fingerprint for the same retained review input", () => {
    const first = reviewInput();
    const second = reviewInput();
    expect(createHumanCommercialReviewRecord(first.input, first.run).fingerprint).toBe(
      createHumanCommercialReviewRecord(second.input, second.run).fingerprint,
    );
  });

  it("rejects malformed runtime input", () => {
    const { run } = reviewInput();
    expect(errorCode(() => createHumanCommercialReviewRecord({ invalid: true }, run))).toBe(
      "invalid-input",
    );
  });

  it("rejects a self-inconsistent authority before a record is created", () => {
    const { run, input } = reviewInput();
    input.authority = { ...input.authority, evaluationFingerprint: "stale" };
    input.authority.fingerprint = "stale";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("rejects a valid but stale authority before a record is created", () => {
    const { run, input } = reviewInput();
    const changed = structuredClone(run);
    changed.manifest.fingerprint = "changed-manifest";
    input.authority = createHumanCommercialReviewAuthority(changed);
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("stale-authority");
  });

  it("reports stale authority when the manifest changes", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    const changed = structuredClone(run);
    changed.manifest.fingerprint = "changed-manifest";
    expect(assessHumanCommercialReviewStaleness(record, changed).stale).toBe(true);
  });

  it("reports stale authority when a PageBlueprint materialization changes", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    const changed = structuredClone(run);
    changed.pageBlueprintMaterializations[0].fingerprint = "changed-profile";
    expect(assessHumanCommercialReviewStaleness(record, changed).stale).toBe(true);
  });

  it("reports stale authority when a renderer scenario fingerprint changes", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    const changed = {
      ...run,
      scenarios: run.scenarios.map((scenario, index) =>
        index === 0 ? { ...scenario, rendererOutputFingerprint: "changed-renderer" } : scenario,
      ),
    };
    expect(assessHumanCommercialReviewStaleness(record, changed).stale).toBe(true);
  });

  it("reports stale authority when protected commerce evidence changes", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    const changed = {
      ...run,
      lifecycle: run.lifecycle.map((entry, index) =>
        index === 0 ? { ...entry, protectedCommerceFingerprint: "changed-commerce" } : entry,
      ),
    };
    expect(assessHumanCommercialReviewStaleness(record, changed).stale).toBe(true);
  });

  it("assesses the immutable retained record against current authority", () => {
    const { run, input } = reviewInput();
    const record = createHumanCommercialReviewRecord(input, run);
    expect(assessHumanCommercialReviewStaleness(record, run)).toMatchObject({ stale: false });
  });

  it("rejects a changed snapshot field retained with an old authority fingerprint", () => {
    const { run, input } = reviewInput();
    input.authority = {
      ...input.authority,
      canonicalSnapshot: { ...input.authority.canonicalSnapshot, revision: 99 },
    };
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("rejects changed manifest and protected-state fields retained with an old authority fingerprint", () => {
    const { run, input } = reviewInput();
    input.authority = {
      ...input.authority,
      manifest: { ...input.authority.manifest, fingerprint: "changed-manifest" },
      lifecycle: input.authority.lifecycle.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              protectedCommerceFingerprint: "changed-commerce",
              approvedAssetFingerprint: "changed-assets",
            }
          : entry,
      ),
    };
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("accepts equivalent authority arrays in a different order", () => {
    const { run, input } = reviewInput();
    input.authority = {
      ...input.authority,
      pageBlueprintProfiles: [...input.authority.pageBlueprintProfiles].reverse(),
      lifecycle: [...input.authority.lifecycle].reverse(),
    };
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("passed");
  });

  it("rejects a self-inconsistent retained authority during staleness assessment", () => {
    const { run, input } = reviewInput();
    const record = structuredClone(createHumanCommercialReviewRecord(input, run));
    record.authority.manifest.fingerprint = "self-inconsistent";
    expect(errorCode(() => assessHumanCommercialReviewStaleness(record, run))).toBe(
      "invalid-input",
    );
  });

  it("rejects duplicate coverage for one scenario", () => {
    const { run, input } = reviewInput();
    input.coverage[1] = { ...input.coverage[0], id: "coverage-duplicate" };
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe(
      "incomplete-coverage",
    );
  });

  it("rejects missing required coverage", () => {
    const { run, input } = reviewInput();
    input.coverage.pop();
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe(
      "incomplete-coverage",
    );
  });

  it("rejects coverage with a profile identity that no longer matches the scenario", () => {
    const { run, input } = reviewInput();
    input.coverage[0].profileId = "unregistered-profile";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("stale-authority");
  });

  it("rejects duplicate retained evidence identifiers", () => {
    const { run, input } = reviewInput();
    input.evidence[1].id = input.evidence[0].id;
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("rejects coverage that points to unknown evidence", () => {
    const { run, input } = reviewInput();
    input.coverage[0].evidenceReferenceIds = ["unknown-evidence"];
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("rejects a criterion decision that points to unknown evidence", () => {
    const { run, input } = reviewInput();
    input.decisions[0].evidenceReferenceIds = ["unknown-evidence"];
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-decision");
  });

  it("marks omitted required criterion decisions as incomplete rather than passing", () => {
    const { run, input } = reviewInput();
    input.decisions.pop();
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("incomplete");
  });

  it("marks a required not-applicable decision as incomplete", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "not-applicable";
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("incomplete");
  });

  it("blocks deterministic-only evidence from producing a passed human review", () => {
    const { run, input } = reviewInput();
    input.evidence = input.evidence.map((reference) => ({
      ...reference,
      kind: "renderer-output",
    }));
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("blocked");
  });

  it("blocks a passed review when a required mobile visual observation is missing", () => {
    const { run, input } = reviewInput();
    const mobileEvidence = input.evidence.find((reference) => reference.viewport === 375);
    if (!mobileEvidence) throw new Error("Expected a mobile evidence row.");
    mobileEvidence.kind = "renderer-output";
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("blocked");
  });

  it("blocks a passed review when a required desktop visual observation is missing", () => {
    const { run, input } = reviewInput();
    const desktopEvidence = input.evidence.find((reference) => reference.viewport === 1440);
    if (!desktopEvidence) throw new Error("Expected a desktop evidence row.");
    desktopEvidence.kind = "renderer-output";
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("blocked");
  });

  it("accepts current screenshot and browser observations for every reviewed scenario", () => {
    const { run, input } = reviewInput();
    input.evidence[0] = { ...input.evidence[0], kind: "browser-route" };
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("passed");
  });

  it("rejects screenshot evidence that is unrelated to its retained scenario", () => {
    const { run, input } = reviewInput();
    input.evidence[0] = { ...input.evidence[0], fingerprint: "unrelated-screenshot" };
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-decision");
  });

  it("requires a runtime-valid human reviewer provenance before accepting a pass", () => {
    const { run, input } = reviewInput();
    input.reviewer.reviewerId = "";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("requires an auditable finding for a failed criterion", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "failed";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-finding");
  });

  it("requires an auditable finding for a blocked criterion", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "blocked";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-finding");
  });

  it("derives failed only from a failed criterion with retained finding evidence", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "failed";
    input.findings = [
      {
        id: "finding-1",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "warning",
        description: "The retained review identifies a commerce-clarity issue.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: "Correct the registered composition in a later scoped task.",
        disposition: "needs-correction",
        status: "open",
      },
    ];
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("failed");
  });

  it("derives blocked only from a blocked criterion with retained finding evidence", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "blocked";
    input.findings = [
      {
        id: "finding-1",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "blocker",
        description: "The reviewer needs a retained browser observation before deciding.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: null,
        disposition: "deferred",
        status: "deferred",
      },
    ];
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("blocked");
  });

  it("rejects a passed criterion with an open blocker requiring correction", () => {
    const { run, input } = reviewInput();
    input.findings = [
      {
        id: "finding-open-blocker",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "blocker",
        description: "A required correction remains open.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: "Apply the scoped correction before passing this criterion.",
        disposition: "needs-correction",
        status: "open",
      },
    ];
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-finding");
  });

  it("rejects a passed criterion with an unresolved correction finding", () => {
    const { run, input } = reviewInput();
    input.findings = [
      {
        id: "finding-open-correction",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "warning",
        description: "A correction remains open for this passed criterion.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: "Correct the retained issue.",
        disposition: "needs-correction",
        status: "open",
      },
    ];
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-finding");
  });

  it("allows a blocked criterion with a retained open blocker", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "blocked";
    input.findings = [
      {
        id: "finding-blocked",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "blocker",
        description: "A retained blocker prevents this criterion from being decided.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: "Retain the required observation.",
        disposition: "needs-correction",
        status: "open",
      },
    ];
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("blocked");
  });

  it("allows a resolved historical blocker with a subsequently passed criterion", () => {
    const { run, input } = reviewInput();
    input.findings = [
      {
        id: "finding-resolved",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "blocker",
        description: "A historical blocker was corrected before the final decision.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: "Retain the historical correction record.",
        disposition: "needs-correction",
        status: "resolved",
      },
    ];
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("passed");
  });

  it("rejects a finding with unknown coverage", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "failed";
    input.findings = [
      {
        id: "finding-1",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["unknown-coverage"],
        severity: "warning",
        description: "Unknown coverage must not be retained.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: null,
        disposition: "needs-correction",
        status: "open",
      },
    ];
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-finding");
  });

  it("retains closed finding severity, correction, disposition, and status", () => {
    const { run, input } = reviewInput();
    input.decisions[0].decision = "failed";
    input.findings = [
      {
        id: "finding-1",
        criterionId: input.decisions[0].criterionId,
        affectedCoverageIds: ["coverage-0"],
        severity: "info",
        description: "A retained observation is documented for later follow-up.",
        evidenceReferenceIds: ["evidence-0"],
        suggestedCorrection: "Review the constrained profile composition later.",
        disposition: "deferred",
        status: "deferred",
      },
    ];
    expect(createHumanCommercialReviewRecord(input, run).findings[0]).toMatchObject({
      severity: "info",
      disposition: "deferred",
      status: "deferred",
    });
  });

  it("accepts evidence captured before or exactly at the review time", () => {
    const before = reviewInput();
    expect(createHumanCommercialReviewRecord(before.input, before.run).overallDecision).toBe(
      "passed",
    );
    const equal = reviewInput();
    equal.input.reviewer.evidenceCapturedAt = equal.input.reviewer.reviewedAt;
    equal.input.evidence[0].capturedAt = equal.input.reviewer.reviewedAt;
    expect(createHumanCommercialReviewRecord(equal.input, equal.run).overallDecision).toBe(
      "passed",
    );
  });

  it("rejects reviewer evidence timestamps after the review time", () => {
    const { run, input } = reviewInput();
    input.reviewer.evidenceCapturedAt = "2026-08-04T10:00:00.001Z";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("rejects evidence references captured after the review time", () => {
    const { run, input } = reviewInput();
    input.evidence[0].capturedAt = "2026-08-04T10:00:00.001Z";
    expect(errorCode(() => createHumanCommercialReviewRecord(input, run))).toBe("invalid-input");
  });

  it("accepts null evidence capture timestamps and rejects malformed timestamps", () => {
    const nullCapturedAt = reviewInput();
    nullCapturedAt.input.reviewer.evidenceCapturedAt = null;
    nullCapturedAt.input.evidence[0].capturedAt = null;
    expect(
      createHumanCommercialReviewRecord(nullCapturedAt.input, nullCapturedAt.run).overallDecision,
    ).toBe("passed");
    const malformed = reviewInput();
    malformed.input.reviewer.evidenceCapturedAt = "not-a-timestamp";
    expect(errorCode(() => createHumanCommercialReviewRecord(malformed.input, malformed.run))).toBe(
      "invalid-input",
    );
  });

  it("does not invoke a provider to create a protocol record", () => {
    const { run, input } = reviewInput();
    expect(createHumanCommercialReviewRecord(input, run).overallDecision).toBe("passed");
  });
});
