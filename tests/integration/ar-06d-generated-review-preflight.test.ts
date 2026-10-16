// @vitest-environment node
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
vi.mock("server-only", () => ({}));
import { createP10B16P04WholeStorefrontProposalRouteHandler } from "@/app/api/ai/whole-storefront-proposals/p10b-16p-04-composition.server";
import { prepareCurrentSemanticStorefrontDesignCompilationAuthority } from "@/application/prompted-storefront-design-compiler/semantic-compiler";
import {
  promptedStorefrontStudioGenerationRequestSchema,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio/contract";
import { canonicalStorefrontContentFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  createP10B16P04RawAurumCommercialFixture,
  P10B16P04_COMMERCIAL_PROJECT_ID,
  P10B16P04_COMMERCIAL_DRAFT_ID,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { buildOpenAiPromptedStorefrontDesignIntentV2Request } from "@/integrations/ai/openai/prompted-storefront-design-intent-v2-provider.server";
import {
  createP10B16P04ServerPromptedStorefrontStudioAuthority,
  createP10B16P04PromptedStorefrontProviderSelector,
  inspectP10B16P04RealStudioAcceptance,
  loadP10B16P04ProposalPreviewAuthority,
  resetP10B16P04RealStudioAcceptanceStateForTests,
  P10B_16P_04_ACCEPTANCE_TOKEN_HEADER,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import { inspectAr06dGenerationEnvelope } from "@/integrations/ai/ar-06d-live-review-support.server";
import { ar06dApprovedMerchantPrompt } from "../helpers/ar-06d-review-input";
import { ar06dReadStoredAuthority } from "../helpers/ar-06d-review-browser";

describe("AR-06D read-only draft and publication observation", () => {
  const stores = [
    "projects",
    "catalogues",
    "snapshots",
    "snapshotProvenance",
    "snapshotHistoryMetadata",
    "publicationOperations",
    "compiledPublicationArtifacts",
    "publishedStorefrontVersions",
    "activePublishedStorefrontPointers",
  ];
  beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
  afterEach(() => vi.unstubAllGlobals());
  const open = (names = stores) =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("veskify", 5);
      request.onupgradeneeded = () =>
        names.forEach((name) => request.result.createObjectStore(name));
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
  it("does not create absent storage and rejects an incomplete schema", async () => {
    expect(Object.values(await ar06dReadStoredAuthority("review"))).toEqual(stores.map(() => []));
    expect(await indexedDB.databases()).toEqual([]);
    const database = await open(["projects", "snapshots", "snapshotHistoryMetadata"]);
    await expect(ar06dReadStoredAuthority("review")).rejects.toThrow(
      "complete current storage schema",
    );
    database.close();
  });
  it("includes catalogue, provenance and every publication store while excluding another project", async () => {
    const database = await open();
    const transaction = database.transaction(stores, "readwrite");
    stores.forEach((name) => {
      const row =
        name === "projects"
          ? { id: "review" }
          : name === "catalogues"
            ? { id: "catalogue", price: 123 }
            : name === "publicationOperations"
              ? { storefrontProjectId: "review", state: "pending" }
              : { projectId: "review", catalogueRef: "catalogue", revision: 1 };
      transaction.objectStore(name).put(row, "target");
      transaction
        .objectStore(name)
        .put({ projectId: "other", storefrontProjectId: "other", id: "other" }, "unrelated");
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = reject;
    });
    const before = await ar06dReadStoredAuthority("review");
    stores.forEach((name) => expect(before[name]).toHaveLength(1));
    const change = database.transaction("activePublishedStorefrontPointers", "readwrite");
    change
      .objectStore("activePublishedStorefrontPointers")
      .put({ projectId: "review", revision: 2 }, "target");
    await new Promise<void>((resolve, reject) => {
      change.oncomplete = () => resolve();
      change.onerror = reject;
    });
    expect(await ar06dReadStoredAuthority("review")).not.toEqual(before);
    database.close();
  });
});

const token = "ar06d-synthetic-preflight-token-not-live-0001";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
  VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: token,
  VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
};
const body = promptedStorefrontStudioGenerationRequestSchema.parse({
  operation: "promptedStorefrontDesignV2",
  contractVersion: "2.0.0",
  requestId: "ar06d-aurum-review-01",
  projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
  draftSnapshotId: P10B16P04_COMMERCIAL_DRAFT_ID,
  draftRevision: 0,
  activeLocale: "en",
  targetScope: "storefront",
  merchantPrompt: ar06dApprovedMerchantPrompt,
});
const headers = new Headers({
  "content-type": "application/json",
  origin: "http://localhost:3188",
  [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: token,
});
const submitted = () =>
  new Request("http://localhost:3188/api/ai/whole-storefront-proposals", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

describe("AR-06D exact prompt through existing canonical P04 authority (zero external calls)", () => {
  beforeEach(() => resetP10B16P04RealStudioAcceptanceStateForTests());

  it.each([
    { VESKIFY_AR06D_LIVE_REVIEW: "1", VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "0" },
    { VESKIFY_AR06D_LIVE_REVIEW: "1", VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1" },
    {
      VESKIFY_AR06D_LIVE_REVIEW: "0",
      VESKIFY_AR06D_TASK_ROOT: "/unreviewed",
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "0",
    },
  ])("rejects incomplete or mixed D runtime binding before provider selection: %j", (changes) => {
    const selector = createP10B16P04PromptedStorefrontProviderSelector({
      environment: { ...environment, ...changes },
    });
    expect(() => selector({ request: body, httpRequest: submitted() })).toThrow();
    expect(inspectP10B16P04RealStudioAcceptance(environment).providerCallCount).toBe(0);
  });

  it("prepares the exact real-model request before transport, without reserving or calling it", async () => {
    const authority = createP10B16P04ServerPromptedStorefrontStudioAuthority({ environment });
    const context = await authority.resolve(body, submitted());
    const current = await context.loadCurrentAuthority();
    const prepared = prepareCurrentSemanticStorefrontDesignCompilationAuthority({
      currentRequestInput: current.requestInput,
      compatibilityInput: current.compatibilityInput,
      semanticRequestAuthority: current.semanticRequestAuthority ?? {
        explicitConstraintAuthority: [],
        trustedExactHints: { directionPackageId: null, frameFamilyId: null },
      },
    });
    const envelope = buildOpenAiPromptedStorefrontDesignIntentV2Request(
      prepared.semanticRequest,
      "gpt-5.6-sol",
    );
    expect(JSON.parse(envelope.input) as unknown).toMatchObject({
      merchantPrompt: ar06dApprovedMerchantPrompt,
    });
    expect(envelope).toMatchObject({ model: "gpt-5.6-sol", store: false, max_output_tokens: 4000 });
    const inspected = inspectAr06dGenerationEnvelope(envelope, { maxRetries: 0, timeout: 120000 });
    const bytes = inspected.serialized;
    expect(inspected.frozen.service_tier).toBe("default");
    expect(Buffer.byteLength(bytes)).toBeLessThanOrEqual(524288);
    expect(inspectP10B16P04RealStudioAcceptance(environment)).toMatchObject({
      providerCallCount: 0,
      cases: [],
      status: "ready",
    });
    const identity = {
      schemaVersion: "ar-06d-offline-envelope-v1",
      kind: "offline-not-counted-or-dispatched",
      expectedRequestSha256: createHash("sha256").update(bytes).digest("hex"),
      requestBytes: Buffer.byteLength(bytes),
      model: envelope.model,
      maxOutputTokens: envelope.max_output_tokens,
      promptFingerprint: prepared.semanticRequest.promptFingerprint,
      currentAuthorityFingerprint: prepared.semanticRequest.currentAuthorityFingerprint,
      semanticAuthorityFingerprint: prepared.semanticRequest.semanticAuthorityFingerprint,
      externalCalls: 0,
      requiredLiveInitialState: { providerCallCount: 0, cases: [], status: "ready" },
    };
    const output = process.env.AR06D_PREFLIGHT_OUTPUT_DIR;
    if (output)
      writeFileSync(
        join(output, "request-envelope-identity.json"),
        `${JSON.stringify(identity, null, 2)}\n`,
        { flag: "wx" },
      );
  });

  it("compiles a pending mock proposal, retains its exact seven-surface authority and changes no draft/history/commerce", async () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const before = canonicalValueString(fixture.aggregate);
    const response = await createP10B16P04WholeStorefrontProposalRouteHandler({ environment })(
      submitted(),
    );
    const result = promptedStorefrontStudioGenerationResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Mock generation failed");
    expect(result.proposal.proposal.status).toBe("pending");
    expect(result.lineage).toMatchObject({
      modelId: "mocked-p10b-16p-04-design-intent-v2",
      providerCallCount: 1,
      retryCount: 0,
      materializationCount: 1,
    });
    expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
      result.lineage.protectedCommerceBeforeFingerprint,
    );
    expect(result.lineage.protectedMediaAfterFingerprint).toBe(
      result.lineage.protectedMediaBeforeFingerprint,
    );
    const arguments_ = {
      projectId: body.projectId,
      candidateFingerprint: result.lineage.candidateSnapshotFingerprint,
      httpHeaders: headers,
      environment,
    };
    const candidate = loadP10B16P04ProposalPreviewAuthority(arguments_);
    const draft = candidate?.snapshots.find(({ id }) => id === candidate.project.draftSnapshotId);
    if (!draft) throw new Error("Candidate was not retained");
    expect(canonicalStorefrontContentFingerprint(draft)).toBe(
      result.lineage.candidateSnapshotFingerprint,
    );
    for (const type of ["home", "content", "cart"])
      expect(draft.pages.some((page) => page.type === type)).toBe(true);
    expect(candidate?.project.enabledLocales).toEqual(expect.arrayContaining(["en", "fi"]));
    const inventory = draft.dynamicCommercePresentation?.routeInventory;
    expect(inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "collection" }),
        expect.objectContaining({ kind: "product", productId: "product_sisu_automatic_watch" }),
        expect.objectContaining({ kind: "product", productId: "product_aurora_ring_585" }),
      ]),
    );
    const inspection = inspectP10B16P04RealStudioAcceptance(environment);
    expect(inspection.selectedTransport.kind).toBe("mock");
    expect(inspection.cases).toHaveLength(1);
    expect(inspection.cases[0].selection.dynamicCommerce.searchExecution).toBe(
      "canonical-transient-query-results",
    );
    expect(canonicalValueString(fixture.aggregate)).toBe(before);
    expect(canonicalValueString(createP10B16P04RawAurumCommercialFixture().aggregate)).toBe(before);
    for (const httpHeaders of [
      new Headers(),
      new Headers({ [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: "wrong" }),
    ]) {
      expect(loadP10B16P04ProposalPreviewAuthority({ ...arguments_, httpHeaders })).toBeUndefined();
    }
    expect(
      loadP10B16P04ProposalPreviewAuthority({ ...arguments_, candidateFingerprint: "unknown" }),
    ).toBeUndefined();
    expect(
      loadP10B16P04ProposalPreviewAuthority({
        ...arguments_,
        environment: { ...environment, NODE_ENV: "production" },
      }),
    ).toBeUndefined();
  }, 60_000);
});
