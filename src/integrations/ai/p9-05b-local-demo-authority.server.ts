import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";

import {
  buildAiStorefrontProviderRequestForSupportedCapability,
  aiStorefrontProviderResponseSchema,
  resolveStorefrontGenerationScope,
  type AiStorefrontProviderRequest,
  type AiStorefrontProviderResponse,
} from "@/application/ai-storefront-generation";
import { projectAiStorefrontSnapshot } from "@/application/ai-storefront";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  P9_05A_FIXED_TIME,
  P9_05A_PROJECT_ID,
  createP905aFreshMerchantFixture,
} from "@/data/demo/p9-05a-fresh-store-generation";
import { brandStoryDefinition } from "@/components/registry/homepage";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  createStandaloneServerWholeStorefrontPlanningAuthority,
  ServerWholeStorefrontAuthorityError,
  type AuthoritativeWholeStorefrontPlanningContextSource,
  type ServerWholeStorefrontPlanningAuthority,
} from "./whole-storefront-runtime-authority";

export const P9_05B_LOCAL_DEMO_FLAG = "VESKIFY_P9_05B_LOCAL_DEMO";
export const P9_05B_LOCAL_DEMO_TOKEN = "VESKIFY_P9_05B_LOCAL_DEMO_TOKEN";
export const P9_05B_LOCAL_DEMO_NAMESPACE = "p9-05b-lumo-local-server";
const P10A_04C_LOCAL_DEMO_FLAG = "VESKIFY_P10A_04C_LOCAL_DEMO";

type DemoEnvironment = Readonly<Record<string, string | undefined>>;

type DemoState = {
  repository: InMemoryProjectRepository;
  savedAggregate: ProjectAggregate;
  baselineFingerprint: string;
  synchronization: Promise<void>;
  session: {
    id: string;
    authoritativeRevision: number;
    generationRevision: number | null;
    proposal: AiStorefrontProviderResponse | null;
  };
};

export type P905bLocalDemoSynchronizationFailure =
  "unauthorized" | "stale" | "invalid" | "protectedCommerce";

export class P905bLocalDemoSynchronizationError extends Error {
  constructor(readonly code: P905bLocalDemoSynchronizationFailure) {
    super("The P9-05B local demo state cannot be synchronized.");
    this.name = "P905bLocalDemoSynchronizationError";
  }
}

declare global {
  var __veskifyP905bLocalDemoState: DemoState | undefined;
}

const identity = {
  tenantId: "tenant_lumo_p9_05b_local",
  userId: "merchant_lumo_owner",
  merchantId: "merchant_lumo",
  organizationId: "organization_lumo",
  storeId: "store_lumo",
} as const;

export function isP905bLocalDemoConfigured(environment: DemoEnvironment = process.env) {
  return (
    environment.NODE_ENV !== "production" &&
    environment.VESKIFY_RUNTIME_MODE === "integrated" &&
    environment[P9_05B_LOCAL_DEMO_FLAG] === "1"
  );
}

function fixture(environment: DemoEnvironment = process.env) {
  const source = createP905aFreshMerchantFixture("warmApproachable");
  if (environment[P10A_04C_LOCAL_DEMO_FLAG] !== "1") return source;
  const approvedEditorialAsset = source.assetContext.assets.find(
    (asset) => asset.role === "editorialImage",
  );
  if (!approvedEditorialAsset)
    throw new Error("P10A-04C requires an approved editorial fixture asset.");
  const approvedBrandStoryContent = Object.fromEntries(
    Object.entries(brandStoryDefinition.defaultContent).filter(([key]) => key !== "media"),
  );
  source.aggregate = validateProjectAggregate({
    ...source.aggregate,
    snapshots: source.aggregate.snapshots.map((snapshot) => ({
      ...snapshot,
      pages: snapshot.pages.map((page) =>
        page.type !== "home"
          ? page
          : {
              ...page,
              sections: [
                ...page.sections.slice(0, -1),
                {
                  id: "section_lumo_p10a_04c_campaign_story",
                  component: "brandStory",
                  variant: brandStoryDefinition.defaultVariant,
                  visible: true,
                  content: {
                    ...structuredClone(approvedBrandStoryContent),
                    approvedAssetId: approvedEditorialAsset.assetId,
                  },
                  props: structuredClone(brandStoryDefinition.defaultProps),
                },
                page.sections.at(-1)!,
              ],
            },
      ),
    })),
  });
  return source;
}

function createState(environment: DemoEnvironment): DemoState {
  const source = fixture(environment);
  return {
    repository: new InMemoryProjectRepository([structuredClone(source.aggregate)]),
    savedAggregate: structuredClone(source.aggregate),
    baselineFingerprint: canonicalValueFingerprint(source.aggregate),
    synchronization: Promise.resolve(),
    session: {
      id: randomBytes(32).toString("base64url"),
      authoritativeRevision: source.aggregate.project.revision,
      generationRevision: null,
      proposal: null,
    },
  };
}

function redactedSessionIdentity(sessionId: string): string {
  return `${sessionId.slice(0, 6)}…`;
}

function recordDiagnostic(input: {
  event:
    | "proposal_claimed"
    | "proposal_released"
    | "proposal_recorded"
    | "synchronized"
    | "synchronization_failed";
  sessionId: string;
  authoritativeRevision: number;
  expectedRevision?: number;
  category?: P905bLocalDemoSynchronizationFailure;
}) {
  console.info("p9-05b-local-demo", {
    event: input.event,
    session: redactedSessionIdentity(input.sessionId),
    authoritativeRevision: input.authoritativeRevision,
    ...(input.expectedRevision === undefined ? {} : { expectedRevision: input.expectedRevision }),
    ...(input.category === undefined ? {} : { category: input.category }),
  });
}

export function configuredP905bLocalDemoToken(
  environment: DemoEnvironment = process.env,
): string | null {
  const token = environment[P9_05B_LOCAL_DEMO_TOKEN];
  return token && Buffer.byteLength(token) >= 32 ? token : null;
}

export function sameP905bLocalDemoSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function state(environment: DemoEnvironment): DemoState {
  if (!isP905bLocalDemoConfigured(environment)) {
    throw new Error("The P9-05B local demo authority is not configured.");
  }
  globalThis.__veskifyP905bLocalDemoState ??= createState(environment);
  return globalThis.__veskifyP905bLocalDemoState;
}

function contextSource(
  environment: DemoEnvironment,
): AuthoritativeWholeStorefrontPlanningContextSource {
  return {
    load: () => {
      const source = fixture(environment);
      return {
        brief: structuredClone(source.brief),
        componentDefinitions: structuredClone(source.planningInput.componentDefinitions),
        approvedAssetContext: structuredClone(source.assetContext),
        approvedAssetPresentations: structuredClone(source.assetPresentations),
      };
    },
  };
}

function authorityFor(current: DemoState, environment: DemoEnvironment) {
  return createStandaloneServerWholeStorefrontPlanningAuthority({
    repository: current.repository,
    identity,
    contextSource: contextSource(environment),
  });
}

function requestSessionId(httpRequest: Request): string | null {
  const sessionId = httpRequest.headers.get("x-veskify-p9-05b-session");
  return sessionId && sessionId.length >= 32 ? sessionId : null;
}

function assertCurrentSession(current: DemoState, sessionId: string | null) {
  if (!sessionId || !sameP905bLocalDemoSecret(sessionId, current.session.id)) {
    throw new ServerWholeStorefrontAuthorityError("unauthorized");
  }
}

export function createP905bLocalDemoAuthority(
  environment: DemoEnvironment = process.env,
): ServerWholeStorefrontPlanningAuthority {
  return {
    async resolve(request, httpRequest) {
      const current = state(environment);
      const sessionId = requestSessionId(httpRequest);
      assertCurrentSession(current, sessionId);
      const resolved = await authorityFor(current, environment).resolve(request, httpRequest);
      return {
        ...resolved,
        claimProposal: () => {
          claimP905bLocalDemoGeneration({
            projectId: request.target.projectId,
            sessionId: sessionId!,
            environment,
          });
        },
        releaseProposal: () => {
          releaseP905bLocalDemoGeneration({
            projectId: request.target.projectId,
            sessionId: sessionId!,
            environment,
          });
        },
        recordValidatedProposal: (proposal) => {
          recordP905bLocalDemoProposal({
            projectId: request.target.projectId,
            sessionId: sessionId!,
            proposal,
            environment,
          });
        },
      };
    },
  };
}

export async function inspectP905bLocalDemo(environment: DemoEnvironment = process.env) {
  const current = state(environment);
  const aggregate = await current.repository.get(P9_05A_PROJECT_ID);
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  );
  const published = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
  );
  if (!draft || !published) throw new Error("The P9-05B demo baseline is incomplete.");
  return {
    namespace: P9_05B_LOCAL_DEMO_NAMESPACE,
    projectId: aggregate.project.id,
    editorRoute: `/projects/${aggregate.project.id}/editor`,
    baselineFingerprint: current.baselineFingerprint,
    aggregateFingerprint: canonicalValueFingerprint(aggregate),
    draftFingerprint: canonicalValueFingerprint(draft),
    publishedFingerprint: canonicalValueFingerprint(published),
    historyCount: aggregate.snapshotHistoryMetadata?.length ?? 0,
    authoritativeRevision: current.session.authoritativeRevision,
  };
}

export async function resetP905bLocalDemo(environment: DemoEnvironment = process.env) {
  return resetP905bLocalDemoProject(P9_05A_PROJECT_ID, environment);
}

export async function resetP905bLocalDemoProject(
  projectId: string,
  environment: DemoEnvironment = process.env,
) {
  if (!isP905bLocalDemoConfigured(environment)) {
    throw new Error("The P9-05B local demo reset is not configured.");
  }
  if (projectId !== P9_05A_PROJECT_ID) {
    throw new Error("The P9-05B local demo reset cannot target another project.");
  }
  globalThis.__veskifyP905bLocalDemoState = createState(environment);
  return inspectP905bLocalDemo(environment);
}

export function p905bLocalDemoSession(environment: DemoEnvironment = process.env): {
  projectId: string;
  sessionId: string;
} {
  const current = state(environment);
  return { projectId: P9_05A_PROJECT_ID, sessionId: current.session.id };
}

export function claimP905bLocalDemoGeneration(input: {
  projectId: string;
  sessionId: string;
  environment?: DemoEnvironment;
}): void {
  const current = state(input.environment ?? process.env);
  if (
    input.projectId !== P9_05A_PROJECT_ID ||
    !sameP905bLocalDemoSecret(input.sessionId, current.session.id)
  ) {
    throw new ServerWholeStorefrontAuthorityError("unauthorized");
  }
  if (current.session.generationRevision === current.session.authoritativeRevision) {
    throw new ServerWholeStorefrontAuthorityError("stale");
  }
  current.session.generationRevision = current.session.authoritativeRevision;
  recordDiagnostic({
    event: "proposal_claimed",
    sessionId: input.sessionId,
    authoritativeRevision: current.session.authoritativeRevision,
  });
}

export function releaseP905bLocalDemoGeneration(input: {
  projectId: string;
  sessionId: string;
  environment?: DemoEnvironment;
}): void {
  const current = state(input.environment ?? process.env);
  if (
    input.projectId !== P9_05A_PROJECT_ID ||
    !sameP905bLocalDemoSecret(input.sessionId, current.session.id)
  ) {
    return;
  }
  if (
    current.session.proposal === null &&
    current.session.generationRevision === current.session.authoritativeRevision
  ) {
    current.session.generationRevision = null;
    recordDiagnostic({
      event: "proposal_released",
      sessionId: input.sessionId,
      authoritativeRevision: current.session.authoritativeRevision,
    });
  }
}

export function recordP905bLocalDemoProposal(input: {
  projectId: string;
  sessionId: string;
  proposal: unknown;
  environment?: DemoEnvironment;
}): { editorRoute: string } {
  const current = state(input.environment ?? process.env);
  if (
    input.projectId !== P9_05A_PROJECT_ID ||
    !sameP905bLocalDemoSecret(input.sessionId, current.session.id) ||
    current.session.generationRevision !== current.session.authoritativeRevision
  ) {
    throw new ServerWholeStorefrontAuthorityError("stale");
  }
  const proposal = aiStorefrontProviderResponseSchema.parse(input.proposal);
  if (proposal.proposal.projectId !== P9_05A_PROJECT_ID) {
    throw new Error("The P9-05B local demo proposal targets another project.");
  }
  current.session.proposal = structuredClone(proposal);
  recordDiagnostic({
    event: "proposal_recorded",
    sessionId: input.sessionId,
    authoritativeRevision: current.session.authoritativeRevision,
  });
  return {
    editorRoute: `/projects/${P9_05A_PROJECT_ID}/editor?p9-05b-session=${encodeURIComponent(current.session.id)}`,
  };
}

export async function synchronizeP905bLocalDemoAggregate(input: {
  projectId: string;
  sessionId: string;
  expectedRevision: number;
  mode?: "active" | "saved";
  aggregate: unknown;
  environment?: DemoEnvironment;
}): Promise<{ authoritativeRevision: number; aggregateFingerprint: string }> {
  const current = state(input.environment ?? process.env);
  return serializeP905bLocalDemoSynchronization(current, async () => {
    const fail = (code: P905bLocalDemoSynchronizationFailure): never => {
      recordDiagnostic({
        event: "synchronization_failed",
        sessionId: input.sessionId,
        authoritativeRevision: current.session.authoritativeRevision,
        expectedRevision: input.expectedRevision,
        category: code,
      });
      throw new P905bLocalDemoSynchronizationError(code);
    };
    if (
      input.projectId !== P9_05A_PROJECT_ID ||
      !sameP905bLocalDemoSecret(input.sessionId, current.session.id)
    ) {
      return fail("unauthorized");
    }
    if (input.expectedRevision !== current.session.authoritativeRevision) return fail("stale");

    let aggregate: ProjectAggregate;
    try {
      aggregate = validateProjectAggregate(structuredClone(input.aggregate) as ProjectAggregate);
    } catch {
      return fail("invalid");
    }
    if (aggregate.project.id !== P9_05A_PROJECT_ID) return fail("unauthorized");
    const authoritative = await current.repository.get(P9_05A_PROJECT_ID);
    if (
      canonicalValueFingerprint(aggregate.catalogue) !==
      canonicalValueFingerprint(authoritative.catalogue)
    ) {
      return fail("protectedCommerce");
    }

    current.repository = new InMemoryProjectRepository([aggregate]);
    if (input.mode !== "active") current.savedAggregate = structuredClone(aggregate);
    // Project metadata does not advance for every draft persistence operation.
    // The local-demo authority therefore owns a separate monotonically increasing
    // revision, used only to bind the next proposal to this exact synchronized state.
    current.session.authoritativeRevision += 1;
    current.session.generationRevision = null;
    current.session.proposal = null;
    const aggregateFingerprint = canonicalValueFingerprint(aggregate);
    recordDiagnostic({
      event: "synchronized",
      sessionId: input.sessionId,
      authoritativeRevision: current.session.authoritativeRevision,
      expectedRevision: input.expectedRevision,
    });
    return { authoritativeRevision: current.session.authoritativeRevision, aggregateFingerprint };
  });
}

async function serializeP905bLocalDemoSynchronization<T>(
  current: DemoState,
  action: () => Promise<T>,
): Promise<T> {
  const previous = current.synchronization;
  let release: () => void;
  current.synchronization = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await action();
  } finally {
    release!();
  }
}

export async function loadP905bLocalDemoEditorSession(input: {
  projectId: string;
  sessionId: string;
  environment?: DemoEnvironment;
}): Promise<{
  aggregate: Awaited<ReturnType<InMemoryProjectRepository["get"]>>;
  proposal: AiStorefrontProviderResponse["proposal"] | null;
  sessionId: string;
  authoritativeRevision: number;
  baselineFingerprint: string;
} | null> {
  const current = state(input.environment ?? process.env);
  if (
    input.projectId !== P9_05A_PROJECT_ID ||
    !sameP905bLocalDemoSecret(input.sessionId, current.session.id)
  ) {
    return null;
  }
  const activeAggregate = await current.repository.get(P9_05A_PROJECT_ID);
  // Accepted but unsaved editor work deliberately stays out of the reload bridge.
  // A confirmed publish, however, advances the immutable published reference in
  // authoritative storage, so expose that server result even
  // if a long-lived route handler was created before the local session reset.
  const aggregate = structuredClone(
    activeAggregate.project.publishedSnapshotId !==
      current.savedAggregate.project.publishedSnapshotId
      ? activeAggregate
      : current.savedAggregate,
  );
  const proposal = current.session.proposal?.proposal ?? null;
  if (
    proposal !== null &&
    (proposal.projectId !== activeAggregate.project.id ||
      proposal.draftSnapshotId !== activeAggregate.project.draftSnapshotId)
  ) {
    return null;
  }
  return {
    aggregate: structuredClone(aggregate),
    proposal: structuredClone(proposal),
    sessionId: current.session.id,
    authoritativeRevision: current.session.authoritativeRevision,
    // This is the stable reset identity, not the mutable authoritative aggregate.
    // The browser uses it only to decide whether it must seed a new local-demo session.
    baselineFingerprint: current.baselineFingerprint,
  };
}

export function p905bLocalDemoRepository(
  environment: DemoEnvironment = process.env,
): InMemoryProjectRepository {
  return state(environment).repository;
}

export async function loadP905bLocalDemoPublishedProjection(input: {
  projectId: string;
  sessionId: string;
  environment?: DemoEnvironment;
}): Promise<
  | (Pick<ProjectAggregate, "project" | "catalogue"> & {
      publishedSnapshot: ProjectAggregate["snapshots"][number];
    })
  | null
> {
  const current = state(input.environment ?? process.env);
  if (
    input.projectId !== P9_05A_PROJECT_ID ||
    !sameP905bLocalDemoSecret(input.sessionId, current.session.id)
  ) {
    return null;
  }
  const aggregate = await current.repository.get(P9_05A_PROJECT_ID);
  const publishedSnapshot = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
  );
  if (!publishedSnapshot) return null;
  return {
    project: structuredClone(aggregate.project),
    catalogue: structuredClone(aggregate.catalogue),
    publishedSnapshot: structuredClone(publishedSnapshot),
  };
}

/** Records the server-confirmed publish result as the next persisted local-demo bridge state. */
export async function commitP905bLocalDemoPublishedAggregate(input: {
  projectId: string;
  environment?: DemoEnvironment;
}): Promise<void> {
  const current = state(input.environment ?? process.env);
  if (input.projectId !== P9_05A_PROJECT_ID) {
    throw new Error("The P9-05B local demo publish result targets another project.");
  }
  current.savedAggregate = structuredClone(await current.repository.get(P9_05A_PROJECT_ID));
}

export async function buildP905bLocalDemoRequest(
  merchantInstruction: string,
  environment: DemoEnvironment = process.env,
): Promise<AiStorefrontProviderRequest> {
  const current = state(environment);
  const source = fixture();
  const aggregate = await current.repository.get(P9_05A_PROJECT_ID);
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  );
  if (!draft) throw new Error("The P9-05B local demo draft is unavailable.");
  const scope = resolveStorefrontGenerationScope(merchantInstruction, draft.pages);
  return buildAiStorefrontProviderRequestForSupportedCapability(
    {
      projectId: aggregate.project.id,
      draftSnapshotId: draft.id,
      draftRevision: draft.revision,
      storefront: projectAiStorefrontSnapshot(draft),
      affectedPageIds: [...scope.affectedPageIds],
      affectedSectionTargets: [],
      designSystemTarget: scope.includesSharedFrame
        ? { kind: "storefrontDesignSystem", projectId: aggregate.project.id }
        : null,
      merchantInstruction,
      activeLocale: aggregate.project.primaryLocale,
      enabledLocales: aggregate.project.enabledLocales,
      requestedScope: scope.kind === "homepage" ? "page" : "storefront",
      providerId: "server-whole-storefront-planning",
      provider: {
        id: "server-whole-storefront-planning",
        assetReferenceCapability: "structuredApprovedAssets",
        generationCapabilities: [
          "approvedColorTypographyDirection",
          "registeredWholeStorefrontDirection",
        ],
        proposeStorefront: () => Promise.reject(new Error("Server provider only")),
      },
      correlationRequestId: `p9_05b_local_${P9_05A_FIXED_TIME.replace(/[^0-9]/g, "")}`,
      importedContent: [],
      approvedAssetContext: source.assetContext,
      assetPlacementOperations: [],
    },
    1,
  ).request;
}
