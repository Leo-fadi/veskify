import "server-only";

import {
  buildAiStorefrontProviderRequest,
  type AiStorefrontProviderRequest,
} from "@/application/ai-storefront-generation";
import { projectAiStorefrontSnapshot } from "@/application/ai-storefront";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  P9_05A_FIXED_TIME,
  P9_05A_PROJECT_ID,
  createP905aFreshMerchantFixture,
} from "@/data/demo/p9-05a-fresh-store-generation";
import { InMemoryProjectRepository } from "@/services/storage";
import {
  createStandaloneServerWholeStorefrontPlanningAuthority,
  type AuthoritativeWholeStorefrontPlanningContextSource,
  type ServerWholeStorefrontPlanningAuthority,
} from "./whole-storefront-runtime-authority";

export const P9_05B_LOCAL_DEMO_FLAG = "VESKIFY_P9_05B_LOCAL_DEMO";
export const P9_05B_LOCAL_DEMO_NAMESPACE = "p9-05b-lumo-local-server";

type DemoEnvironment = Readonly<Record<string, string | undefined>>;

type DemoState = {
  repository: InMemoryProjectRepository;
  baselineFingerprint: string;
};

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

function fixture() {
  return createP905aFreshMerchantFixture("warmApproachable");
}

function createState(): DemoState {
  const source = fixture();
  return {
    repository: new InMemoryProjectRepository([structuredClone(source.aggregate)]),
    baselineFingerprint: canonicalValueFingerprint(source.aggregate),
  };
}

function state(environment: DemoEnvironment): DemoState {
  if (!isP905bLocalDemoConfigured(environment)) {
    throw new Error("The P9-05B local demo authority is not configured.");
  }
  globalThis.__veskifyP905bLocalDemoState ??= createState();
  return globalThis.__veskifyP905bLocalDemoState;
}

function contextSource(): AuthoritativeWholeStorefrontPlanningContextSource {
  return {
    load: () => {
      const source = fixture();
      return {
        brief: structuredClone(source.brief),
        componentDefinitions: structuredClone(source.planningInput.componentDefinitions),
        approvedAssetContext: structuredClone(source.assetContext),
        approvedAssetPresentations: structuredClone(source.assetPresentations),
      };
    },
  };
}

function authorityFor(current: DemoState) {
  return createStandaloneServerWholeStorefrontPlanningAuthority({
    repository: current.repository,
    identity,
    contextSource: contextSource(),
  });
}

export function createP905bLocalDemoAuthority(
  environment: DemoEnvironment = process.env,
): ServerWholeStorefrontPlanningAuthority {
  return {
    resolve(request, httpRequest) {
      return authorityFor(state(environment)).resolve(request, httpRequest);
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
  globalThis.__veskifyP905bLocalDemoState = createState();
  return inspectP905bLocalDemo(environment);
}

export function p905bLocalDemoRepository(
  environment: DemoEnvironment = process.env,
): InMemoryProjectRepository {
  return state(environment).repository;
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
  return buildAiStorefrontProviderRequest(
    {
      projectId: aggregate.project.id,
      draftSnapshotId: draft.id,
      draftRevision: draft.revision,
      storefront: projectAiStorefrontSnapshot(draft),
      affectedPageIds: draft.pages.map((page) => page.id),
      affectedSectionTargets: [],
      designSystemTarget: { kind: "storefrontDesignSystem", projectId: aggregate.project.id },
      merchantInstruction,
      activeLocale: aggregate.project.primaryLocale,
      enabledLocales: aggregate.project.enabledLocales,
      requestedScope: "storefront",
      capability: "registeredWholeStorefrontDirection",
      providerId: "server-whole-storefront-planning",
      provider: {
        id: "server-whole-storefront-planning",
        assetReferenceCapability: "structuredApprovedAssets",
        proposeStorefront: () => Promise.reject(new Error("Server provider only")),
      },
      correlationRequestId: `p9_05b_local_${P9_05A_FIXED_TIME.replace(/[^0-9]/g, "")}`,
      importedContent: [],
      approvedAssetContext: source.assetContext,
      assetPlacementOperations: [],
    },
    1,
  );
}
