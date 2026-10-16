// @vitest-environment node
import { readFileSync, realpathSync } from "node:fs";
import type * as Fs from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof Fs>();
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    realpathSync: vi.fn(actual.realpathSync),
  };
});
import {
  loadP10B16P04ProposalPreviewAuthority,
  inspectP10B16P04RealStudioAcceptance,
  resetP10B16P04RealStudioAcceptanceStateForTests,
  P10B_16P_04_ACCEPTANCE_TOKEN_HEADER,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";

const token = "ar10a-unit-only-synthetic-token-at-least-32-bytes";
const fingerprint = "v1_50184_0784a748aa03ccbb5e081601548c20c63070658d24a5e3fa5344ef6093da9061";
const projectId = "project_p10b16p04_aurum_commercial_acceptance";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
  VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: token,
  VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
  VESKIFY_AR10A_OFFLINE_REPLAY: "1",
};
const headers = () =>
  new Headers({ host: "localhost:3188", [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: token });
const load = (changes: Record<string, string> = {}, other = {}) =>
  loadP10B16P04ProposalPreviewAuthority({
    projectId,
    candidateFingerprint: fingerprint,
    httpHeaders: headers(),
    environment: { ...environment, ...changes },
    ...other,
  });
const disabledAuthorities: Record<string, string>[] = [
  { NODE_ENV: "production" },
  { VESKIFY_RUNTIME_MODE: "standalone" },
  { VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "0" },
  { VESKIFY_AR10A_OFFLINE_REPLAY: "0" },
  { VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "0" },
  { VESKIFY_AR06D_LIVE_REVIEW: "1" },
  { VESKIFY_AI_PROVIDER: "deterministic" },
];
beforeEach(() => {
  resetP10B16P04RealStudioAcceptanceStateForTests();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(readFileSync).mockReset();
  vi.mocked(realpathSync).mockReset();
});
beforeEach(async () => {
  const actual = await vi.importActual<typeof Fs>("node:fs");
  vi.mocked(readFileSync).mockImplementation(actual.readFileSync);
  vi.mocked(realpathSync).mockImplementation(actual.realpathSync);
});

describe("AR-10A pinned offline renderer input", () => {
  it("returns the complete unchanged generated aggregate without mutation, transport or live-map insertion", async () => {
    const original: unknown = JSON.parse(
      await readFile("tests/fixtures/ar-10a/original-aggregate.json", "utf8"),
    );
    const aggregate = load()!;
    expect(aggregate).toEqual(original);
    expect(canonicalValueFingerprint(aggregate)).toBe(
      "v1_80868_81c32c3a086af857e8815787a2da67c4b28abe6ca8203878748db62640eaeb99",
    );
    const draft = aggregate.snapshots.find((s) => s.id === aggregate.project.draftSnapshotId)!;
    expect(canonicalStorefrontContentFingerprint(draft)).toBe(fingerprint);
    expect(canonicalValueFingerprint(aggregate.catalogue)).toBe(
      "v1_8176_3fed8c5f58e1fda958bd46886e603c82ed9cbc9dfc177305018cb412f58c0916",
    );
    expect(aggregate.project.enabledLocales).toEqual(["en", "fi"]);
    expect(draft.dynamicCommercePresentation!.routeInventory).toHaveLength(9);
    aggregate.snapshots.splice(0, 1);
    expect(load()).toEqual(original);
    expect(load({ VESKIFY_AR10A_OFFLINE_REPLAY: "0" })).toBeUndefined();
    expect(inspectP10B16P04RealStudioAcceptance(environment).providerCallCount).toBe(0);
  });
  it.each(disabledAuthorities)(
    "rejects disabled/mixed authority before reading the fixture: %j",
    (changes) => {
      expect(load(changes)).toBeUndefined();
      expect(readFileSync).not.toHaveBeenCalled();
    },
  );
  it("rejects actual production regardless of caller-supplied test environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(load()).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });
  it.each(["", "example.com", "localhost.evil.test", "localhost:3188@evil.test"])(
    "rejects non-loopback host %s before file access",
    (host) => {
      const h = headers();
      h.set("host", host);
      expect(load({}, { httpHeaders: h })).toBeUndefined();
      expect(readFileSync).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "wrong"])("requires real header authority", (value) => {
    const h = new Headers({ host: "localhost:3188" });
    if (value !== undefined) h.set(P10B_16P_04_ACCEPTANCE_TOKEN_HEADER, value);
    expect(load({}, { httpHeaders: h })).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });
  it.each([{ projectId: "other" }, { candidateFingerprint: "unknown" }])(
    "rejects wrong owner or candidate before file access: %j",
    (other) => {
      expect(load({}, other)).toBeUndefined();
      expect(readFileSync).not.toHaveBeenCalled();
    },
  );
  it.each([Buffer.from("{}"), Buffer.from("not json")])(
    "rejects changed or invalid archive bytes",
    (bytes) => {
      vi.mocked(readFileSync).mockReturnValue(bytes);
      expect(load()).toBeUndefined();
    },
  );
  it("rejects missing archive and an archive symlink without substituting a seed", () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(load()).toBeUndefined();
    vi.clearAllMocks();
    vi.mocked(realpathSync).mockReturnValue("/unapproved/fixture.json");
    expect(load()).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
