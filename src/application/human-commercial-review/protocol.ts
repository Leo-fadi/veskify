import {
  type GoldenStoreEvaluationRun,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
} from "@/application/golden-store-evaluation";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  HUMAN_COMMERCIAL_REVIEW_PROTOCOL_VERSION,
  HumanCommercialReviewProtocolError,
  humanCommercialReviewCriterionDefinitions,
  humanCommercialReviewInputSchema,
  humanCommercialReviewRecordSchema,
  type HumanCommercialReviewAuthority,
  type HumanCommercialReviewInput,
  type HumanCommercialReviewRecord,
} from "./contract";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function coverageKey(value: {
  lifecycle: string;
  surface: string;
  locale: string;
  viewport: number;
}): string {
  return [value.lifecycle, value.surface, value.locale, value.viewport].join(":");
}

type AuthorityFingerprintPayload = Omit<HumanCommercialReviewAuthority, "fingerprint">;

/**
 * Keeps authority hashing deterministic even when independently supplied lifecycle
 * or profile arrays arrive in a different, but equivalent, order.
 */
function normalizedAuthorityFingerprintPayload(
  authority: AuthorityFingerprintPayload,
): AuthorityFingerprintPayload {
  return {
    evaluationId: authority.evaluationId,
    evaluationFingerprint: authority.evaluationFingerprint,
    fixture: structuredClone(authority.fixture),
    canonicalSnapshot: structuredClone(authority.canonicalSnapshot),
    proposalPreviewSnapshotFingerprint: authority.proposalPreviewSnapshotFingerprint,
    manifest: structuredClone(authority.manifest),
    pageBlueprintProfiles: authority.pageBlueprintProfiles
      .map((profile) => structuredClone(profile))
      .sort((left, right) =>
        `${left.profileId}:${left.profileVersion}`.localeCompare(
          `${right.profileId}:${right.profileVersion}`,
        ),
      ),
    lifecycle: authority.lifecycle
      .map((entry) => structuredClone(entry))
      .sort((left, right) => left.state.localeCompare(right.state)),
    rendererScenarioFingerprint: authority.rendererScenarioFingerprint,
    brandSystemFingerprint: authority.brandSystemFingerprint,
  };
}

function authorityFingerprint(authority: AuthorityFingerprintPayload): string {
  return canonicalValueFingerprint(normalizedAuthorityFingerprintPayload(authority));
}

/** Derives review authority from P10A-07A rather than accepting a parallel authority model. */
export function createHumanCommercialReviewAuthority(
  evaluation: GoldenStoreEvaluationRun,
): HumanCommercialReviewAuthority {
  const lifecycle = evaluation.lifecycle.map((entry) => ({
    state: entry.state,
    revision: entry.revision,
    snapshotFingerprint: entry.snapshotFingerprint,
    navigationFingerprint: entry.navigationFingerprint,
    protectedCommerceFingerprint: entry.protectedCommerceFingerprint,
    approvedAssetFingerprint: entry.approvedAssetFingerprint,
  }));
  const pageBlueprintProfiles = evaluation.pageBlueprintMaterializations
    .map((entry) => ({
      profileId: entry.profileId,
      profileVersion: entry.profileVersion,
      materializationFingerprint: entry.fingerprint,
    }))
    .sort((left, right) => left.profileId.localeCompare(right.profileId));
  const authority: AuthorityFingerprintPayload = {
    evaluationId: evaluation.evaluationId,
    evaluationFingerprint: evaluation.fingerprint,
    fixture: structuredClone(evaluation.fixture),
    canonicalSnapshot: {
      snapshotId: evaluation.canonicalBaseline.snapshotId,
      revision: evaluation.canonicalBaseline.revision,
      snapshotFingerprint: evaluation.canonicalBaseline.snapshotFingerprint,
    },
    proposalPreviewSnapshotFingerprint: evaluation.lifecycle.find(
      (entry) => entry.state === "proposal-preview",
    )!.snapshotFingerprint,
    manifest: structuredClone(evaluation.manifest),
    pageBlueprintProfiles,
    lifecycle,
    rendererScenarioFingerprint: canonicalValueFingerprint(
      evaluation.scenarios.map((scenario) => ({
        lifecycle: scenario.lifecycle,
        surface: scenario.surface,
        locale: scenario.locale,
        viewport: scenario.viewport,
        profileId: scenario.profileId,
        rendererOutputFingerprint: scenario.rendererOutputFingerprint,
      })),
    ),
    brandSystemFingerprint: evaluation.structuralQualitySignals.brandSystemFingerprint,
  };
  return deepFreeze({ ...authority, fingerprint: authorityFingerprint(authority) });
}

function parseInput(input: unknown): HumanCommercialReviewInput {
  try {
    return humanCommercialReviewInputSchema.parse(input);
  } catch (cause) {
    throw new HumanCommercialReviewProtocolError(
      "invalid-input",
      "Human commercial review input must be a complete runtime-valid record.",
      cause,
    );
  }
}

function parseRecord(input: unknown): HumanCommercialReviewRecord {
  try {
    return humanCommercialReviewRecordSchema.parse(input);
  } catch (cause) {
    throw new HumanCommercialReviewProtocolError(
      "invalid-input",
      "Human commercial review record must be a complete runtime-valid retained record.",
      cause,
    );
  }
}

function assertAuthority(
  supplied: HumanCommercialReviewAuthority,
  current: HumanCommercialReviewAuthority,
): void {
  assertAuthorityFingerprintIntegrity(supplied);
  assertAuthorityFingerprintIntegrity(current);
  if (
    canonicalValueString(normalizedAuthorityFingerprintPayload(supplied)) !==
    canonicalValueString(normalizedAuthorityFingerprintPayload(current))
  ) {
    throw new HumanCommercialReviewProtocolError(
      "stale-authority",
      "Human commercial review authority is stale against the current deterministic evaluation.",
    );
  }
}

function assertAuthorityFingerprintIntegrity(authority: HumanCommercialReviewAuthority): void {
  if (authority.fingerprint !== authorityFingerprint(authority)) {
    throw new HumanCommercialReviewProtocolError(
      "invalid-input",
      "Human commercial review authority fingerprint must match every retained authority field.",
    );
  }
}

function assertChronology(input: HumanCommercialReviewInput): void {
  const reviewedAt = Date.parse(input.reviewer.reviewedAt);
  const capturedAt = input.reviewer.evidenceCapturedAt;
  const evidenceAfterReview = input.evidence.some(
    (reference) => reference.capturedAt !== null && Date.parse(reference.capturedAt) > reviewedAt,
  );
  if ((capturedAt !== null && Date.parse(capturedAt) > reviewedAt) || evidenceAfterReview) {
    throw new HumanCommercialReviewProtocolError(
      "invalid-input",
      "Human commercial review evidence cannot be captured after the retained review time.",
    );
  }
}

function assertCoverage(
  input: HumanCommercialReviewInput,
  evaluation: GoldenStoreEvaluationRun,
): void {
  const expected = new Map(
    evaluation.scenarios.map((scenario) => [coverageKey(scenario), scenario]),
  );
  const actual = new Map<string, (typeof input.coverage)[number]>();
  for (const coverage of input.coverage) {
    const key = coverageKey(coverage);
    if (actual.has(key)) {
      throw new HumanCommercialReviewProtocolError(
        "incomplete-coverage",
        `Human commercial review duplicates ${key}.`,
      );
    }
    const scenario = expected.get(key);
    if (
      !scenario ||
      scenario.profileId !== coverage.profileId ||
      scenario.rendererOutputFingerprint !== coverage.rendererOutputFingerprint
    ) {
      throw new HumanCommercialReviewProtocolError(
        "stale-authority",
        `Human commercial review coverage is not current for ${key}.`,
      );
    }
    actual.set(key, coverage);
  }
  if (actual.size !== expected.size) {
    throw new HumanCommercialReviewProtocolError(
      "incomplete-coverage",
      "Human commercial review must retain every required P10A-07A scenario exactly once.",
    );
  }
  for (const state of goldenStoreEvaluationLifecycleStates) {
    for (const surface of goldenStoreEvaluationSurfaces) {
      for (const locale of goldenStoreEvaluationLocales) {
        for (const viewport of goldenStoreEvaluationViewports) {
          if (!actual.has(coverageKey({ lifecycle: state, surface, locale, viewport }))) {
            throw new HumanCommercialReviewProtocolError(
              "incomplete-coverage",
              "Human commercial review is missing required lifecycle, surface, locale, or viewport coverage.",
            );
          }
        }
      }
    }
  }
}

function assertReferences(input: HumanCommercialReviewInput): void {
  const evidence = new Set<string>();
  for (const reference of input.evidence) {
    if (evidence.has(reference.id)) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-input",
        "Evidence references must be unique.",
      );
    }
    evidence.add(reference.id);
  }
  const coverage = new Set<string>();
  for (const entry of input.coverage) {
    if (coverage.has(entry.id)) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-input",
        "Coverage identifiers must be unique.",
      );
    }
    coverage.add(entry.id);
    if (!entry.evidenceReferenceIds.every((id) => evidence.has(id))) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-input",
        "Coverage must reference retained evidence.",
      );
    }
  }
  for (const decision of input.decisions) {
    if (!decision.evidenceReferenceIds.every((id) => evidence.has(id))) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-decision",
        "Criterion decisions must reference retained evidence.",
      );
    }
  }
  for (const finding of input.findings) {
    if (
      !finding.affectedCoverageIds.every((id) => coverage.has(id)) ||
      !finding.evidenceReferenceIds.every((id) => evidence.has(id))
    ) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-finding",
        "Findings must reference retained coverage and evidence.",
      );
    }
  }
}

function isQualifyingVisualEvidence(
  reference: HumanCommercialReviewInput["evidence"][number],
  coverage: HumanCommercialReviewInput["coverage"][number],
): boolean {
  return (
    (reference.kind === "screenshot" || reference.kind === "browser-route") &&
    reference.lifecycle === coverage.lifecycle &&
    reference.surface === coverage.surface &&
    reference.locale === coverage.locale &&
    reference.viewport === coverage.viewport &&
    reference.fingerprint === coverage.rendererOutputFingerprint
  );
}

function assertVisualEvidence(input: HumanCommercialReviewInput): boolean {
  const evidenceById = new Map(input.evidence.map((reference) => [reference.id, reference]));
  for (const reference of input.evidence) {
    if (reference.kind !== "screenshot" && reference.kind !== "browser-route") continue;
    const bindsCurrentCoverage = input.coverage.some(
      (coverage) =>
        coverage.evidenceReferenceIds.includes(reference.id) &&
        isQualifyingVisualEvidence(reference, coverage),
    );
    if (!bindsCurrentCoverage) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-decision",
        "Screenshot and browser evidence must bind to a current reviewed scenario.",
      );
    }
  }
  return input.coverage.every((coverage) =>
    coverage.evidenceReferenceIds.some((id) => {
      const reference = evidenceById.get(id);
      return reference !== undefined && isQualifyingVisualEvidence(reference, coverage);
    }),
  );
}

function assertDecisions(
  input: HumanCommercialReviewInput,
): "passed" | "failed" | "blocked" | "incomplete" {
  const decisions = new Map(input.decisions.map((decision) => [decision.criterionId, decision]));
  if (decisions.size !== input.decisions.length) {
    throw new HumanCommercialReviewProtocolError(
      "invalid-decision",
      "Each commercial criterion may have one retained decision.",
    );
  }
  for (const definition of humanCommercialReviewCriterionDefinitions) {
    const decision = decisions.get(definition.id);
    if (!decision) return "incomplete";
    if (definition.required && decision.decision === "not-applicable") return "incomplete";
  }
  const values = [...decisions.values()];
  if (values.some((decision) => decision.decision === "blocked")) return "blocked";
  if (values.some((decision) => decision.decision === "failed")) return "failed";
  return "passed";
}

function findingIsResolvedOrAccepted(
  finding: HumanCommercialReviewInput["findings"][number],
): boolean {
  return finding.status === "resolved" || finding.disposition === "accepted-risk";
}

function hasUnresolvedBlocker(input: HumanCommercialReviewInput): boolean {
  return input.findings.some(
    (finding) => finding.severity === "blocker" && !findingIsResolvedOrAccepted(finding),
  );
}

function assertFindings(input: HumanCommercialReviewInput): void {
  const ids = new Set<string>();
  const decisions = new Map(input.decisions.map((decision) => [decision.criterionId, decision]));
  for (const finding of input.findings) {
    if (ids.has(finding.id)) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-finding",
        "Finding identifiers must be unique.",
      );
    }
    ids.add(finding.id);
    if (
      (finding.disposition === "needs-correction" &&
        finding.status !== "open" &&
        finding.status !== "resolved") ||
      (finding.disposition === "accepted-risk" && finding.status !== "acknowledged") ||
      (finding.disposition === "not-reproducible" && finding.status !== "resolved") ||
      (finding.disposition === "deferred" && finding.status !== "deferred")
    ) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-finding",
        "Finding disposition and status must use the retained review vocabulary consistently.",
      );
    }
    const decision = decisions.get(finding.criterionId);
    if (
      decision?.decision === "passed" &&
      ((finding.disposition === "needs-correction" && finding.status === "open") ||
        (finding.severity === "blocker" && !findingIsResolvedOrAccepted(finding)))
    ) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-finding",
        "Passed criteria cannot retain unresolved corrections or blocker findings.",
      );
    }
  }
  for (const decision of decisions.values()) {
    if (
      (decision.decision === "failed" || decision.decision === "blocked") &&
      !input.findings.some((finding) => finding.criterionId === decision.criterionId)
    ) {
      throw new HumanCommercialReviewProtocolError(
        "invalid-finding",
        "Failed or blocked decisions require an auditable finding.",
      );
    }
  }
}

function deriveOverallDecision(
  input: HumanCommercialReviewInput,
  hasCompleteVisualEvidence: boolean,
): "passed" | "failed" | "blocked" | "incomplete" {
  const decisionState = assertDecisions(input);
  if (decisionState === "incomplete") return "incomplete";
  if (hasUnresolvedBlocker(input)) return "blocked";
  if (decisionState === "blocked") return "blocked";
  if (decisionState === "failed") return "failed";
  return hasCompleteVisualEvidence ? "passed" : "blocked";
}

/**
 * Creates an immutable human-review record. A protocol disposition has no ability
 * to mutate a draft, accept a proposal, publish a storefront, or contact a provider.
 */
export function createHumanCommercialReviewRecord(
  inputValue: unknown,
  evaluation: GoldenStoreEvaluationRun,
): HumanCommercialReviewRecord {
  const input = parseInput(inputValue);
  assertChronology(input);
  const currentAuthority = createHumanCommercialReviewAuthority(evaluation);
  assertAuthority(input.authority, currentAuthority);
  assertReferences(input);
  assertCoverage(input, evaluation);
  assertFindings(input);
  const hasCompleteVisualEvidence = assertVisualEvidence(input);
  const overallDecision = deriveOverallDecision(input, hasCompleteVisualEvidence);
  const record = {
    ...structuredClone(input),
    overallDecision,
    fingerprint: canonicalValueFingerprint({
      reviewId: input.reviewId,
      protocolVersion: HUMAN_COMMERCIAL_REVIEW_PROTOCOL_VERSION,
      authority: input.authority,
      reviewer: input.reviewer,
      evidence: input.evidence,
      coverage: input.coverage,
      decisions: input.decisions,
      findings: input.findings,
      overallDecision,
    }),
  } as const;
  return deepFreeze(record);
}

export function assessHumanCommercialReviewStaleness(
  recordValue: unknown,
  evaluation: GoldenStoreEvaluationRun,
): Readonly<{
  stale: boolean;
  currentAuthorityFingerprint: string;
  reviewedAuthorityFingerprint: string;
}> {
  const record = parseRecord(recordValue);
  assertChronology(record);
  assertAuthorityFingerprintIntegrity(record.authority);
  const current = createHumanCommercialReviewAuthority(evaluation);
  return deepFreeze({
    stale:
      canonicalValueString(normalizedAuthorityFingerprintPayload(record.authority)) !==
      canonicalValueString(normalizedAuthorityFingerprintPayload(current)),
    currentAuthorityFingerprint: current.fingerprint,
    reviewedAuthorityFingerprint: record.authority.fingerprint,
  });
}
