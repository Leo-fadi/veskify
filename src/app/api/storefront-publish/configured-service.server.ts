import "server-only";

import { join } from "node:path";
import {
  AuthoritativeMerchantPublishError,
  AuthoritativeMerchantPublishService,
  FileSystemMerchantPublishPreparationStore,
} from "@/application/publishing/authoritative-merchant-publish.server";
import { FileSystemAcceptedSnapshotPublishReceiptRepository } from "@/application/accepted-snapshot-publishing/index.server";
import { createStandaloneMerchantProjectContextPort } from "@/application/merchant-project-context";
import { createStandaloneAuthoritativePublishingAdapter } from "@/integrations/vesko-publishing";
import { P9_05A_PROJECT_ID } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  P9_05B_LOCAL_DEMO_NAMESPACE,
  createP905bLocalDemoAcceptedAiAuthoritySource,
  commitP905bLocalDemoPublishedAggregate,
  isP905bLocalDemoConfigured,
  p905bLocalDemoRepository,
  p905bLocalDemoSession,
  sameP905bLocalDemoSecret,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { standalonePublishingRevisionMapper } from "@/integrations/vesko-publishing";
import type { AuthoritativePublishingProjectRepository } from "@/services/storage";

const localDemoIdentity = {
  tenantId: "tenant_lumo_p9_05b_local",
  userId: "merchant_lumo_owner",
  merchantId: "merchant_lumo",
  organizationId: "organization_lumo",
  storeId: "store_lumo",
} as const;

function localDemoPublishingDirectory() {
  return join(process.cwd(), ".veskify", P9_05B_LOCAL_DEMO_NAMESPACE, "publish-authority");
}

function currentLocalDemoProjectRepository(
  environment: Readonly<Record<string, string | undefined>>,
): AuthoritativePublishingProjectRepository {
  return {
    list: () => p905bLocalDemoRepository(environment).list(),
    get: (projectId) => p905bLocalDemoRepository(environment).get(projectId),
    create: (aggregate) => p905bLocalDemoRepository(environment).create(aggregate),
    saveDraft: (projectId, snapshot, expectedBase) =>
      p905bLocalDemoRepository(environment).saveDraft(projectId, snapshot, expectedBase),
    publish: (projectId, expectation) =>
      p905bLocalDemoRepository(environment).publish(projectId, expectation),
    restore: (projectId, snapshotId, expectation) =>
      p905bLocalDemoRepository(environment).restore(projectId, snapshotId, expectation),
    getPublicationOperation: (identity) =>
      p905bLocalDemoRepository(environment).getPublicationOperation(identity),
    getActiveCompiledPublication: (projectId) =>
      p905bLocalDemoRepository(environment).getActiveCompiledPublication(projectId),
    getCompiledPublicationArtifact: (projectId, artifactId) =>
      p905bLocalDemoRepository(environment).getCompiledPublicationArtifact(projectId, artifactId),
    listPublishedStorefrontVersions: (projectId) =>
      p905bLocalDemoRepository(environment).listPublishedStorefrontVersions(projectId),
    restorePublishedStorefrontVersion: (projectId, versionId, expectation) =>
      p905bLocalDemoRepository(environment).restorePublishedStorefrontVersion(
        projectId,
        versionId,
        expectation,
      ),
  };
}

export function createConfiguredAuthoritativeMerchantPublishService(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthoritativeMerchantPublishService | null {
  if (!isP905bLocalDemoConfigured(environment)) return null;
  const projectRepository = currentLocalDemoProjectRepository(environment);
  const contextPort = createStandaloneMerchantProjectContextPort({
    projectRepository,
    ...localDemoIdentity,
  });
  const directory = localDemoPublishingDirectory();
  const preparationStore = new FileSystemMerchantPublishPreparationStore(
    join(directory, "publish-preparations"),
  );
  const receiptRepository = new FileSystemAcceptedSnapshotPublishReceiptRepository(
    join(directory, "accepted-snapshot-receipts"),
  );
  const currentAuthoritySource = createP905bLocalDemoAcceptedAiAuthoritySource(environment);
  const acceptedSnapshotAuthority = { receiptRepository, currentAuthoritySource };
  const publishingGateway = createStandaloneAuthoritativePublishingAdapter({
    projectRepository,
    contextPort,
    publishPreparations: {
      async load(preparationId) {
        return (await preparationStore.load(preparationId))?.preparation ?? null;
      },
    },
    acceptedSnapshotAuthority,
  });
  return new AuthoritativeMerchantPublishService({
    projectRepository,
    publishingGateway,
    authenticatedContext: {
      async resolve({ projectId, request }) {
        const sessionId = request.headers.get("x-veskify-p9-05b-session");
        const session = p905bLocalDemoSession(environment);
        if (
          projectId !== P9_05A_PROJECT_ID ||
          !sessionId ||
          !sameP905bLocalDemoSecret(sessionId, session.sessionId)
        ) {
          throw new AuthoritativeMerchantPublishError("authentication-required");
        }
        return contextPort.load({
          tenantId: localDemoIdentity.tenantId,
          storefrontProjectId: projectId,
        });
      },
    },
    preparationStore,
    revisionMapper: standalonePublishingRevisionMapper,
    acceptedAiAuthority: acceptedSnapshotAuthority,
    afterPublish: ({ projectId }) =>
      commitP905bLocalDemoPublishedAggregate({ projectId, environment }),
  });
}
