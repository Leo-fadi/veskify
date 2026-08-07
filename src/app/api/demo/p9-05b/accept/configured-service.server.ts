import "server-only";

import { join } from "node:path";
import { AuthoritativeAcceptedAiReceiptService } from "@/application/accepted-ai-receipt-wiring/index.server";
import { FileSystemAcceptedSnapshotPublishReceiptRepository } from "@/application/accepted-snapshot-publishing/index.server";
import {
  P9_05B_LOCAL_DEMO_NAMESPACE,
  createP905bLocalDemoAcceptedAiAuthoritySource,
  isP905bLocalDemoConfigured,
  p905bLocalDemoRepository,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

function receiptDirectory() {
  return join(
    process.cwd(),
    ".veskify",
    P9_05B_LOCAL_DEMO_NAMESPACE,
    "publish-authority",
    "accepted-snapshot-receipts",
  );
}

export function createConfiguredP905bAcceptedAiReceiptService(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthoritativeAcceptedAiReceiptService | null {
  if (!isP905bLocalDemoConfigured(environment)) return null;
  const projectRepository = p905bLocalDemoRepository(environment);
  return new AuthoritativeAcceptedAiReceiptService({
    projectRepository,
    receiptRepository: new FileSystemAcceptedSnapshotPublishReceiptRepository(receiptDirectory()),
    authoritySource: createP905bLocalDemoAcceptedAiAuthoritySource(environment),
  });
}
