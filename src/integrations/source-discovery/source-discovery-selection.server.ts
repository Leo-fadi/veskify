import "server-only";

import {
  UrlBriefWorkflowService,
  type CanonicalCommerceProjectionProvider,
  type UrlBriefWorkflowServiceOptions,
} from "@/application/onboarding";
import {
  createDeterministicMockDiscoveryAdapter,
  type SourceDiscoveryAdapter,
} from "@/application/source-discovery";
import type { OnboardingSessionRepository } from "@/services/onboarding";
import {
  createPublicSourceDiscoveryAdapter,
  type PublicSourceDiscoveryAdapterOptions,
} from "./public-source-discovery-adapter.server";

export type ServerSourceDiscoveryMode = "deterministic" | "bounded-public";

export type ServerSourceDiscoverySelectionOptions = Readonly<{
  publicSource?: PublicSourceDiscoveryAdapterOptions;
}>;

export function selectServerSourceDiscoveryAdapter(
  mode: ServerSourceDiscoveryMode,
  options: ServerSourceDiscoverySelectionOptions = {},
): SourceDiscoveryAdapter {
  return mode === "deterministic"
    ? createDeterministicMockDiscoveryAdapter()
    : createPublicSourceDiscoveryAdapter(options.publicSource);
}

export function createServerUrlBriefWorkflowService(input: {
  mode: ServerSourceDiscoveryMode;
  repository: OnboardingSessionRepository;
  commerce: CanonicalCommerceProjectionProvider;
  workflowOptions?: UrlBriefWorkflowServiceOptions;
  selectionOptions?: ServerSourceDiscoverySelectionOptions;
}): UrlBriefWorkflowService {
  const policy =
    input.mode === "deterministic"
      ? {
          mode: "deterministic" as const,
          maxPages: 5,
          maxAssets: 20,
          followSameOriginOnly: true,
        }
      : {
          mode: "bounded-public" as const,
          maxPages: 1,
          maxAssets: 20,
          followSameOriginOnly: true,
        };
  return new UrlBriefWorkflowService(
    input.repository,
    selectServerSourceDiscoveryAdapter(input.mode, input.selectionOptions),
    input.commerce,
    { ...input.workflowOptions, discoveryPolicy: policy },
  );
}
