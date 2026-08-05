import "server-only";

import { join } from "node:path";
import { FileSystemAcceptedSnapshotPublishReceiptRepository } from "@/application/accepted-snapshot-publishing/index.server";
import {
  AuthoritativeMerchantPublishError,
  AuthoritativeMerchantPublishService,
  FileSystemMerchantPublishPreparationStore,
  acceptedSnapshotCurrentAuthorityFromReceipt,
} from "@/application/publishing/authoritative-merchant-publish.server";
import { createStandaloneMerchantProjectContextPort } from "@/application/merchant-project-context";
import { createStandaloneAuthoritativePublishingAdapter } from "@/integrations/vesko-publishing";
import { P9_05A_PROJECT_ID } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  P9_05B_LOCAL_DEMO_NAMESPACE,
  isP905bLocalDemoConfigured,
  p905bLocalDemoRepository,
  p905bLocalDemoSession,
  sameP905bLocalDemoSecret,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { standalonePublishingRevisionMapper } from "@/integrations/vesko-publishing";

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

export function createConfiguredAuthoritativeMerchantPublishService(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthoritativeMerchantPublishService | null {
  if (!isP905bLocalDemoConfigured(environment)) return null;
  const projectRepository = p905bLocalDemoRepository(environment);
  const contextPort = createStandaloneMerchantProjectContextPort({
    projectRepository,
    ...localDemoIdentity,
  });
  const directory = localDemoPublishingDirectory();
  const receiptRepository = new FileSystemAcceptedSnapshotPublishReceiptRepository(
    join(directory, "accepted-snapshot-receipts"),
  );
  const preparationStore = new FileSystemMerchantPublishPreparationStore(
    join(directory, "publish-preparations"),
  );
  const acceptedSnapshotAuthority = {
    receiptRepository,
    currentAuthoritySource: {
      resolveCurrentAuthority: ({
        receipt,
      }: {
        receipt: Parameters<typeof acceptedSnapshotCurrentAuthorityFromReceipt>[0];
      }) => Promise.resolve(acceptedSnapshotCurrentAuthorityFromReceipt(receipt)),
    },
  };
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
  });
}
