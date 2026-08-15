import "server-only";

import {
  createMerchantProjectAuthorization,
  createStandaloneMerchantProjectContextPort,
  type MerchantProjectAuthorization,
} from "@/application/merchant-project-context";
import type { PromptedStorefrontDesignCompilationAuthority } from "@/application/prompted-storefront-design-compiler";
import type { PromptedStorefrontStudioGenerationRequest } from "@/application/prompted-storefront-studio";
import {
  P10B16P03_PROJECT_ID,
  createP10B16P03RawKarvonenStudioFixture,
  type P10B16P03RawKarvonenStudioFixture,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { InMemoryProjectRepository, ProjectNotFoundError } from "@/services/storage";
import {
  canonicalStorefrontContentFingerprint,
  type PageFactEvidenceReference,
} from "@/domain/storefront";
import { ServerWholeStorefrontAuthorityError } from "./whole-storefront-runtime-authority";

export type ServerPromptedStorefrontStudioContext = Readonly<{
  authorization: MerchantProjectAuthorization;
  loadCurrentAuthority: () =>
    | PromptedStorefrontDesignCompilationAuthority
    | Promise<PromptedStorefrontDesignCompilationAuthority>;
}>;

export interface ServerPromptedStorefrontStudioAuthority {
  resolve(
    request: PromptedStorefrontStudioGenerationRequest,
    httpRequest: Request,
  ): Promise<ServerPromptedStorefrontStudioContext>;
}

const standaloneIdentity = Object.freeze({
  tenantId: "tenant_standalone",
  userId: "user_standalone",
  merchantId: "merchant_standalone",
  organizationId: "organization_standalone",
  storeId: "store_standalone",
});

export type PromptedStorefrontStudioLocalIdentity = Readonly<{
  tenantId: string;
  userId: string;
  merchantId: string;
  organizationId: string;
  storeId: string;
}>;

/**
 * Trusted server fixture shape shared by the normal P03 raw project and bounded
 * non-production acceptance compositions. The fixture owns canonical project,
 * catalogue, evidence and asset authority; no browser-supplied generation
 * authority enters this boundary.
 */
export type PromptedStorefrontStudioFixture = Pick<
  P10B16P03RawKarvonenStudioFixture,
  | "aggregate"
  | "brief"
  | "planningInput"
  | "siteMapDecision"
  | "approvedEvidenceReferences"
  | "pageEvidenceAuthority"
  | "contentFactAuthority"
  | "approvedAssetPresentations"
>;

function compilationAuthority(
  fixture: PromptedStorefrontStudioFixture,
  merchantPrompt: string,
): PromptedStorefrontDesignCompilationAuthority {
  return Object.freeze({
    requestInput: {
      merchantPrompt,
      project: structuredClone(fixture.aggregate.project),
      draft: structuredClone(fixture.planningInput.draft),
      catalogue: structuredClone(fixture.planningInput.catalogue),
      approvedBrief: structuredClone(fixture.brief),
      approvedAssetContext:
        fixture.planningInput.approvedAssetContext === null
          ? null
          : structuredClone(fixture.planningInput.approvedAssetContext),
    },
    compatibilityInput: {
      planningInput: structuredClone(fixture.planningInput),
      siteMapDecision: structuredClone(fixture.siteMapDecision),
      approvedEvidenceReferences: structuredClone(fixture.approvedEvidenceReferences),
    },
    pageEvidenceAuthority: fixture.pageEvidenceAuthority,
    contentFactAuthority: fixture.contentFactAuthority,
    approvedAssetPresentations: structuredClone(fixture.approvedAssetPresentations),
  });
}

/**
 * Local P03 authority for the dedicated raw Karvonen project. The fixture is
 * loaded afresh both before and after the provider call; browser-supplied
 * catalogue, evidence, assets, capability projections or snapshots never
 * enter this boundary.
 */
export function createP10B16P03ServerPromptedStorefrontStudioAuthority({
  loadFixture = createP10B16P03RawKarvonenStudioFixture,
  projectId = P10B16P03_PROJECT_ID,
  identity = standaloneIdentity,
}: {
  loadFixture?: () => PromptedStorefrontStudioFixture | Promise<PromptedStorefrontStudioFixture>;
  /** Exact project identity owned by the supplied trusted fixture. */
  projectId?: string;
  /**
   * A non-production composition may supply an already authenticated local identity while still
   * reusing the exact P03 fixture-backed project and current-authority checks.
   */
  identity?: PromptedStorefrontStudioLocalIdentity;
} = {}): ServerPromptedStorefrontStudioAuthority {
  return Object.freeze({
    async resolve(request: PromptedStorefrontStudioGenerationRequest) {
      const initial = await loadFixture();
      if (request.projectId !== projectId || initial.aggregate.project.id !== projectId) {
        throw new ServerWholeStorefrontAuthorityError("invalid");
      }
      const repository = new InMemoryProjectRepository([initial.aggregate]);
      let aggregate: Awaited<ReturnType<typeof repository.get>>;
      try {
        aggregate = await repository.get(request.projectId);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          throw new ServerWholeStorefrontAuthorityError("invalid");
        }
        throw new ServerWholeStorefrontAuthorityError("unavailable");
      }
      const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
      if (
        !draft ||
        request.draftSnapshotId !== aggregate.project.draftSnapshotId ||
        request.draftSnapshotId !== draft.id ||
        request.draftRevision !== draft.revision
      ) {
        throw new ServerWholeStorefrontAuthorityError("project-draft-mismatch");
      }
      if (!aggregate.project.enabledLocales.includes(request.activeLocale)) {
        throw new ServerWholeStorefrontAuthorityError("unsupported-locale");
      }
      const context = await createStandaloneMerchantProjectContextPort({
        projectRepository: repository,
        ...identity,
      }).load({
        tenantId: identity.tenantId,
        storefrontProjectId: aggregate.project.id,
      });
      return {
        authorization: createMerchantProjectAuthorization(context),
        loadCurrentAuthority: async () => {
          const current = await loadFixture();
          const currentDraft = current.aggregate.snapshots.find(
            ({ id }) => id === current.aggregate.project.draftSnapshotId,
          );
          if (
            current.aggregate.project.id !== projectId ||
            current.aggregate.project.id !== request.projectId ||
            current.aggregate.project.draftSnapshotId !== request.draftSnapshotId ||
            currentDraft?.revision !== request.draftRevision ||
            !current.aggregate.project.enabledLocales.includes(request.activeLocale)
          ) {
            throw new ServerWholeStorefrontAuthorityError("stale");
          }
          return compilationAuthority(current, request.merchantPrompt);
        },
      };
    },
  });
}

/**
 * Resolves current P03 evidence from trusted server fixture authority for normal standalone Studio
 * rendering. Persisted fact-document references remain provenance only and never authorize their
 * own editor or preview rendering. Integrated mode must inject authenticated evidence authority.
 */
export function loadP10B16P03CurrentEvidenceReferences({
  projectId,
  environment = process.env,
}: {
  projectId: string;
  environment?: Readonly<Record<string, string | undefined>>;
}): Promise<readonly PageFactEvidenceReference[]> {
  if (environment.VESKIFY_RUNTIME_MODE !== "standalone" || projectId !== P10B16P03_PROJECT_ID) {
    return Promise.resolve([]);
  }
  return Promise.resolve(
    structuredClone(createP10B16P03RawKarvonenStudioFixture().approvedEvidenceReferences),
  );
}

/**
 * Identifies the one exact raw draft that may enter the P03 initial-generation path. The value is
 * derived from trusted standalone server authority and is only a client routing hint: the
 * generation endpoint independently reloads and verifies the same project, snapshot and revision.
 */
export function loadP10B16P03InitialDraftAuthority({
  projectId,
  environment = process.env,
}: {
  projectId: string;
  environment?: Readonly<Record<string, string | undefined>>;
}): Promise<
  | Readonly<{
      draftSnapshotId: string;
      draftRevision: number;
      contentFingerprint: string;
    }>
  | undefined
> {
  if (environment.VESKIFY_RUNTIME_MODE !== "standalone" || projectId !== P10B16P03_PROJECT_ID) {
    return Promise.resolve(undefined);
  }
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  return Promise.resolve(
    Object.freeze({
      draftSnapshotId: fixture.rawDraft.id,
      draftRevision: fixture.rawDraft.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(fixture.rawDraft),
    }),
  );
}

export const unavailableServerPromptedStorefrontStudioAuthority: ServerPromptedStorefrontStudioAuthority =
  Object.freeze({
    resolve: () =>
      Promise.reject(new ServerWholeStorefrontAuthorityError("authentication-unavailable")),
  });
