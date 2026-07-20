import { z } from "zod";
import {
  type AIProvider,
  type AiProviderResponse,
  AiProviderUnavailableError,
  AiProviderValidationError,
  requestAiProposal,
} from "@/application/ai-provider";
import {
  AiProposalRequestBuildError,
  aiProposalGenerationCommandSchema,
  buildAiOperationRequest,
  editorProposalTargetSchema,
} from "@/application/ai-proposal-generation";
import { createStorefrontRenderContext } from "@/components/registry";
import { idSchema, localeSchema } from "@/domain/shared";
import { canonicalValueString } from "@/domain/storefront";
import {
  ProjectNotFoundError,
  RepositoryValidationError,
  type ProjectRepository,
} from "@/services/storage";

export const serverAiProposalIntentSchema = z
  .object({
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    target: editorProposalTargetSchema,
    activeLocale: localeSchema,
    merchantInstruction: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const authoritativeAiProposalContextSchema = z
  .object({
    projectId: aiProposalGenerationCommandSchema.shape.projectId,
    draftSnapshotId: aiProposalGenerationCommandSchema.shape.draftSnapshotId,
    draftRevision: aiProposalGenerationCommandSchema.shape.draftRevision,
    page: aiProposalGenerationCommandSchema.shape.page,
    target: aiProposalGenerationCommandSchema.shape.target,
    activeLocale: aiProposalGenerationCommandSchema.shape.activeLocale,
    enabledLocales: aiProposalGenerationCommandSchema.shape.enabledLocales,
    brandSystem: aiProposalGenerationCommandSchema.shape.brandSystem,
    displayContext: aiProposalGenerationCommandSchema.shape.displayContext,
    importedContent: aiProposalGenerationCommandSchema.shape.importedContent,
  })
  .strict()
  .superRefine((context, refinement) => {
    if (!context.enabledLocales.includes(context.activeLocale)) {
      refinement.addIssue({
        code: "custom",
        path: ["activeLocale"],
        message: "The active locale must be enabled for the storefront.",
      });
    }
    if (new Set(context.enabledLocales).size !== context.enabledLocales.length) {
      refinement.addIssue({
        code: "custom",
        path: ["enabledLocales"],
        message: "Enabled storefront locales must be unique.",
      });
    }
  });

export type ServerAiProposalIntent = z.infer<typeof serverAiProposalIntentSchema>;
export type AuthoritativeAiProposalContext = z.infer<typeof authoritativeAiProposalContextSchema>;

export interface ServerAiProposalAuthorityResolver {
  resolve(
    intent: ServerAiProposalIntent,
    request: Request,
  ): Promise<AuthoritativeAiProposalContext>;
}

export interface ServerAiProjectAuthorizer {
  assertAuthorized(request: Request, projectId: string): Promise<void>;
}

export class ServerAiAuthorityError extends Error {
  constructor(readonly code: "unauthorized" | "unavailable" | "identityMismatch") {
    super("The authoritative storefront context is unavailable.");
    this.name = "ServerAiAuthorityError";
  }
}

export function createProjectRepositoryAiAuthorityResolver({
  repository,
  authorizer,
}: {
  repository: ProjectRepository;
  authorizer: ServerAiProjectAuthorizer;
}): ServerAiProposalAuthorityResolver {
  return {
    async resolve(intent, request) {
      try {
        await authorizer.assertAuthorized(request, intent.projectId);
      } catch (error) {
        if (error instanceof ServerAiAuthorityError) throw error;
        throw new ServerAiAuthorityError("unavailable");
      }

      let aggregate: Awaited<ReturnType<ProjectRepository["get"]>>;
      try {
        aggregate = await repository.get(intent.projectId);
      } catch (error) {
        if (error instanceof ProjectNotFoundError || error instanceof RepositoryValidationError) {
          throw new ServerAiAuthorityError("identityMismatch");
        }
        throw new ServerAiAuthorityError("unavailable");
      }

      try {
        const draft = aggregate.snapshots.find(
          (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
        );
        if (
          !draft ||
          draft.id !== intent.draftSnapshotId ||
          draft.revision !== intent.draftRevision ||
          !aggregate.project.enabledLocales.includes(intent.activeLocale)
        ) {
          throw new ServerAiAuthorityError("identityMismatch");
        }
        const page = draft.pages.find((candidate) => candidate.id === intent.target.pageId);
        const targetSectionId =
          intent.target.type === "section" ? intent.target.sectionId : undefined;
        if (
          !page ||
          (targetSectionId !== undefined &&
            !page.sections.some((section) => section.id === targetSectionId))
        ) {
          throw new ServerAiAuthorityError("identityMismatch");
        }
        return authoritativeAiProposalContextSchema.parse({
          projectId: aggregate.project.id,
          draftSnapshotId: draft.id,
          draftRevision: draft.revision,
          page,
          target: intent.target,
          activeLocale: intent.activeLocale,
          enabledLocales: aggregate.project.enabledLocales,
          brandSystem: draft.brandSystem,
          displayContext: createStorefrontRenderContext({
            activeLocale: intent.activeLocale,
            primaryLocale: aggregate.project.primaryLocale,
            catalogue: aggregate.catalogue,
            snapshot: draft,
          }),
          importedContent: [],
        });
      } catch (error) {
        if (error instanceof ServerAiAuthorityError) throw error;
        if (error instanceof z.ZodError || error instanceof RepositoryValidationError) {
          throw new ServerAiAuthorityError("identityMismatch");
        }
        throw new ServerAiAuthorityError("unavailable");
      }
    },
  };
}

function authoritativeIdentityMatches(
  intent: ServerAiProposalIntent,
  context: AuthoritativeAiProposalContext,
) {
  return (
    intent.projectId === context.projectId &&
    intent.draftSnapshotId === context.draftSnapshotId &&
    intent.draftRevision === context.draftRevision &&
    intent.activeLocale === context.activeLocale &&
    canonicalValueString(intent.target) === canonicalValueString(context.target)
  );
}

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

function publicProviderResponse(proposal: AiProviderResponse) {
  return proposal;
}

export function createServerAiProposalHandler({
  authority,
  selectProvider,
}: {
  authority: ServerAiProposalAuthorityResolver;
  selectProvider: () => AIProvider;
}) {
  return async function POST(request: Request): Promise<Response> {
    let intent: ServerAiProposalIntent;
    try {
      intent = serverAiProposalIntentSchema.parse(await request.json());
    } catch {
      return json(400, { ok: false, failure: { category: "validationRejected" } });
    }

    try {
      let authorityContext: AuthoritativeAiProposalContext;
      try {
        authorityContext = await authority.resolve(intent, request);
      } catch (error) {
        if (error instanceof ServerAiAuthorityError) throw error;
        throw new ServerAiAuthorityError("unavailable");
      }
      const resolvedContext = authoritativeAiProposalContextSchema.safeParse(authorityContext);
      if (!resolvedContext.success) throw new ServerAiAuthorityError("identityMismatch");
      const context = resolvedContext.data;
      if (!authoritativeIdentityMatches(intent, context)) {
        throw new ServerAiAuthorityError("identityMismatch");
      }
      const provider = selectProvider();
      const canonicalRequest = buildAiOperationRequest({
        ...context,
        merchantInstruction: intent.merchantInstruction,
        provider,
      });
      const result = await requestAiProposal(provider, canonicalRequest, {
        signal: request.signal,
      });
      const proposal: AiProviderResponse = {
        providerRequestId: result.proposal.providerRequestId,
        providerId: result.proposal.providerId,
        operations: result.proposal.operations,
        diagnostics: result.proposal.diagnostics,
        ...(result.proposal.explanation ? { explanation: result.proposal.explanation } : {}),
        metadata: result.proposal.metadata,
      };
      return json(200, { ok: true, proposal: publicProviderResponse(proposal) });
    } catch (error) {
      if (error instanceof ServerAiAuthorityError) {
        if (error.code === "unauthorized") {
          return json(401, {
            ok: false,
            failure: { category: "unauthorized", retryable: false },
          });
        }
        if (error.code === "unavailable") {
          return json(503, {
            ok: false,
            failure: { category: "authorityUnavailable", retryable: true },
          });
        }
        return json(409, {
          ok: false,
          failure: { category: "validationRejected", retryable: false },
        });
      }
      if (error instanceof AiProposalRequestBuildError) {
        if (error.code === "target-mismatch") {
          return json(409, {
            ok: false,
            failure: { category: "validationRejected", retryable: false },
          });
        }
        return json(400, {
          ok: false,
          failure: {
            category:
              error.code === "unsupported-request" ? "unsupportedRequest" : "validationRejected",
            retryable: false,
          },
        });
      }
      if (error instanceof AiProviderValidationError) {
        return json(422, { ok: false, failure: { category: error.category } });
      }
      if (error instanceof AiProviderUnavailableError) {
        return json(503, { ok: false, failure: { category: error.category } });
      }
      return json(503, {
        ok: false,
        failure: { category: "unexpectedProviderFailure" },
      });
    }
  };
}

export const unavailableServerAiAuthority: ServerAiProposalAuthorityResolver = {
  resolve: () => Promise.reject(new ServerAiAuthorityError("unavailable")),
};
