// @vitest-environment node

import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectPdpRouteManifest,
  gotoPdpWithDiagnostics,
  gotoUtilityWithDiagnostics,
  inspectPdpServer,
  latestPdpDiagnostic,
  safePdpFailureExcerpt,
} from "../helpers/ar-00b-pdp-diagnostics";

const roots: string[] = [];
const repositoryRoot = resolve(import.meta.dirname, "../..");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ar-00b-pdp-diagnostic-"));
  roots.push(root);
  mkdirSync(join(root, ".next/dev/server"), { recursive: true });
  return root;
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("AR-00B PDP diagnostic boundaries", () => {
  it("retains separate reporter lifecycle and first-failure records without raw error data", async () => {
    const root = fixture();
    vi.stubEnv("VESKIFY_AR00B_GROUP02_DIAGNOSTIC_ROOT", root);
    vi.stubEnv("VESKIFY_AR00B_GROUP02_SUITE_ID", "p10b-13");
    vi.stubEnv("VESKIFY_AR00B_GROUP02_REPOSITORY_ROOT", root);
    vi.resetModules();
    const { default: Reporter } = await import("../helpers/ar-00b-group-02-diagnostic-reporter");
    const reporter = new Reporter();
    reporter.onConfigure();
    reporter.onBegin();
    reporter.onStdErr("Failed compilation: secret-canary-do-not-retain");
    reporter.onError();
    reporter.onError();
    reporter.onEnd();
    for (const [name, phase] of [
      ["pre-setup", "PRE_SETUP"],
      ["live-window", "LIVE_WINDOW"],
      ["first-failure", "FIRST_FAILURE"],
      ["post-plugin-teardown", "POST_PLUGIN_TEARDOWN"],
    ]) {
      const source = readFileSync(join(root, "p10b-13", `${name}.json`), "utf8");
      const record = JSON.parse(source) as Record<string, unknown>;
      expect(record.phase).toBe(phase);
      expect(record.suiteId).toBe("p10b-13");
      expect(record.diagnosticAvailability).toBe("AVAILABLE");
      expect(source).not.toContain("secret-canary");
    }
  });

  it("records known regular manifests and exact PDP mapping", () => {
    const root = fixture();
    writeFileSync(
      join(root, ".next/dev/server/app-paths-manifest.json"),
      JSON.stringify({
        "/p10b-11-pdp-proof/page": "app/p10b-11-pdp-proof/page.js",
        "/_not-found": "app/not",
      }),
    );
    writeFileSync(join(root, ".next/dev/routes-manifest.json"), JSON.stringify({ version: 3 }));
    const manifests = collectPdpRouteManifest(root);
    expect(manifests).toHaveLength(2);
    expect(manifests[0]?.result).toBe("OK");
    expect(manifests[0]?.keys).toEqual(["/_not-found", "/p10b-11-pdp-proof/page"]);
    expect(manifests[0]?.results).toContainEqual({
      key: "/p10b-11-pdp-proof/page",
      target: "EXPECTED",
    });
    expect(manifests[1]?.result).toBe("OK");
    expect(manifests[1]?.keys).toEqual([]);
  });

  it("labels malformed, symlinked, and oversized manifests without reading them", () => {
    const root = fixture();
    const path = join(root, ".next/dev/server/app-paths-manifest.json");
    writeFileSync(path, "not-json");
    expect(collectPdpRouteManifest(root)[0]).toMatchObject({ result: "INVALID" });
    writeFileSync(path, "{}");
    symlinkSync(path, join(root, ".next/dev/routes-manifest.json"));
    expect(collectPdpRouteManifest(root)[1]).toMatchObject({ result: "ESCAPE" });
    writeFileSync(path, "x".repeat(64 * 1024 + 1));
    expect(collectPdpRouteManifest(root)[0]).toMatchObject({ result: "TOO_LARGE" });
  });

  it("uses synthetic Linux socket ownership only with matching cwd and socket inode", () => {
    const root = fixture();
    const proc = join(root, "proc");
    const pid = join(proc, "123");
    mkdirSync(join(pid, "fd"), { recursive: true });
    mkdirSync(join(proc, "net"), { recursive: true });
    writeFileSync(
      join(proc, "net/tcp"),
      "sl local rem st tx rx tr tm retr uid timeout inode\n 0: 0100007F:0C1C 00000000:0000 0A 0 0 0 0 0 77\n",
    );
    writeFileSync(join(proc, "net/tcp6"), "sl local rem st tx rx tr tm retr uid timeout inode\n");
    writeFileSync(join(pid, "comm"), "next-server (v1\n");
    writeFileSync(
      join(pid, "stat"),
      "123 (next-server) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 77 0",
    );
    symlinkSync(root, join(pid, "cwd"));
    symlinkSync("socket:[77]", join(pid, "fd", "4"));
    expect(inspectPdpServer(3100, root, proc)).toMatchObject({
      result: "OWNED",
      inode: "77",
      pid: 123,
      cwd: root,
      startTicks: "77",
    });
    rmSync(join(pid, "fd", "4"));
    expect(inspectPdpServer(3100, root, proc)).toMatchObject({ result: "UNOWNED", inode: "77" });
    symlinkSync("socket:[77]", join(pid, "fd", "4"));
    const foreign = join(root, "foreign");
    mkdirSync(foreign);
    rmSync(join(pid, "cwd"));
    symlinkSync(foreign, join(pid, "cwd"));
    expect(inspectPdpServer(3100, root, proc)).toMatchObject({
      result: "FOREIGN",
      inode: "77",
      startTicks: "77",
    });
  });

  it("redacts visible failure text instead of retaining raw page content", () => {
    const excerpt = safePdpFailureExcerpt("404: Not Found", "secret-token=never-retain");
    expect(excerpt).toBe("visible-http-404");
    expect(excerpt).not.toContain("secret-token");
    expect(safePdpFailureExcerpt("unexpected", "details")).toBe("UNRECOGNIZED");
  });

  it("retains one navigation diagnostic for 200, 404, and the original navigation error", async () => {
    const root = fixture();
    const response = (status: number) => ({
      status: () => status,
      url: () => "http://127.0.0.1:3100/p10b-11-pdp-proof?profile=pdp-standard-commerce",
      request: () => ({ resourceType: () => "document" }),
    });
    const pageFor = (result: ReturnType<typeof response> | Error) => {
      const goto = vi.fn(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
      );
      return {
        goto,
        url: () => "http://127.0.0.1:3100/p10b-11-pdp-proof?profile=pdp-standard-commerce",
        title: () => Promise.resolve("404 Not Found"),
        locator: () => ({ allTextContents: () => Promise.resolve(["secret=redacted"]) }),
      };
    };
    const page200 = pageFor(response(200));
    await expect(
      gotoPdpWithDiagnostics(
        page200 as never,
        "/p10b-11-pdp-proof?profile=pdp-standard-commerce",
        root,
        3100,
        "CONFIGURED:standalone",
      ),
    ).resolves.toMatchObject({ response: { status: 200 } });
    expect(page200.goto).toHaveBeenCalledTimes(1);
    const page404 = pageFor(response(404));
    await expect(
      gotoPdpWithDiagnostics(
        page404 as never,
        "/p10b-11-pdp-proof?profile=pdp-standard-commerce",
        root,
        3100,
        "CONFIGURED:standalone",
      ),
    ).resolves.toMatchObject({ failureExcerpt: "visible-http-404" });
    const original = new Error("original navigation failure");
    const pageThrow = pageFor(original);
    await expect(
      gotoPdpWithDiagnostics(
        pageThrow as never,
        "/p10b-11-pdp-proof?profile=pdp-standard-commerce",
        root,
        3100,
        "CONFIGURED:standalone",
      ),
    ).rejects.toBe(original);
    expect(pageThrow.goto).toHaveBeenCalledTimes(1);
    expect(latestPdpDiagnostic(pageThrow as never)).toMatchObject({
      response: null,
      failureExcerpt: "visible-http-404",
    });
  });

  it("reports unknown access and only truncates bounded Next candidates", () => {
    const root = fixture();
    const proc = join(root, "proc");
    mkdirSync(proc);
    expect(inspectPdpServer(3100, root, proc)).toMatchObject({ result: "UNKNOWN" });
    mkdirSync(join(proc, "net"));
    writeFileSync(join(proc, "net/tcp"), "h\n 0: 0100007F:0C1C 0:0 0A 0 0 0 0 0 77\n");
    writeFileSync(join(proc, "net/tcp6"), "h\n");
    for (let index = 0; index < 129; index += 1) {
      const pid = join(proc, String(index));
      mkdirSync(pid);
      writeFileSync(join(pid, "comm"), "other-process\n");
    }
    expect(inspectPdpServer(3100, root, proc)).toMatchObject({ result: "UNOWNED" });
    for (let index = 129; index < 162; index += 1) {
      const pid = join(proc, String(index));
      mkdirSync(pid);
      mkdirSync(join(pid, "fd"));
      symlinkSync(root, join(pid, "cwd"));
      writeFileSync(join(pid, "comm"), "next-server\n");
    }
    expect(inspectPdpServer(3100, root, proc)).toMatchObject({ result: "TRUNCATED" });
  });

  it("labels branded utility not-found separately from a generic HTTP 404", async () => {
    const root = fixture();
    const response = {
      status: () => 200,
      url: () => "http://127.0.0.1:3100/p10b-13-utility-proof?profile=commerce-utility-not-found",
      request: () => ({ resourceType: () => "document" }),
    };
    const branded = {
      goto: vi.fn(() => Promise.resolve(response)),
      url: () => response.url(),
      title: () => Promise.resolve("Commerce utility"),
      locator: () => ({
        allTextContents: () => Promise.resolve([]),
        count: () => Promise.resolve(1),
      }),
    };
    await expect(
      gotoUtilityWithDiagnostics(
        branded as never,
        "/p10b-13-utility-proof?profile=commerce-utility-not-found",
        root,
        3100,
        "CONFIGURED:standalone",
      ),
    ).resolves.toMatchObject({ presentation: "BRANDED_UTILITY_NOT_FOUND" });
  });

  it("keeps PDP server, trace, case, and artifact instrumentation bounded", () => {
    const base = readFileSync(join(repositoryRoot, "playwright.config.ts"), "utf8");
    const config = readFileSync(join(repositoryRoot, "playwright.p10b-11.config.ts"), "utf8");
    const spec = readFileSync(
      join(repositoryRoot, "tests/e2e/p10b-11-commercial-pdp-profile-library.spec.ts"),
      "utf8",
    );
    const workflow = readFileSync(join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
    expect(config).toContain('outputDir: ".ci-pdp-diagnostics"');
    expect(config).toContain('trace: { mode: "retain-on-failure", sources: false }');
    expect(config).toContain('stdout: "pipe"');
    expect(config).toContain('stderr: "pipe"');
    for (const invariant of ["command:", "url:", "timeout:", "workers:"]) {
      expect(config).not.toContain(invariant);
      expect(base).toContain(invariant);
    }
    expect(spec.match(/retains governed PDP commerce/g) ?? []).toHaveLength(1);
    expect(workflow).toContain(
      "name: group-02-browser-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.groupId }}",
    );
    expect(workflow).toContain(".ci-group02-diagnostics/${{ matrix.groupId }}");
    expect(workflow).toContain(".ci-pdp-diagnostics");
    expect(workflow).toContain(".ci-playwright-groups/${{ matrix.groupId }}/blobs");
    expect(workflow).toContain("include-hidden-files: true");
    expect(workflow).toContain("if-no-files-found: error");
    expect(workflow).toContain("retention-days: 14");
    expect(workflow).toContain("matrix.groupId == 'group-02'");
    const runner = readFileSync(join(repositoryRoot, "scripts/playwright-ci.mjs"), "utf8");
    const reporter = readFileSync(
      join(repositoryRoot, "tests/helpers/ar-00b-group-02-diagnostic-reporter.ts"),
      "utf8",
    );
    expect(runner).toContain("--reporter=blob,${GROUP02_DIAGNOSTIC_REPORTER}");
    expect(runner).toContain('".ci-group02-diagnostics"');
    for (const configPath of [
      "playwright.config.ts",
      "playwright.p10a-08d-02.config.ts",
      "playwright.p10b-17.config.ts",
      "playwright.p10b-18a.config.ts",
    ]) {
      const source = readFileSync(join(repositoryRoot, configPath), "utf8");
      expect(source).toContain("VESKIFY_AR00B_GROUP02_DIAGNOSTICS");
      expect(source).toContain('stdout: "pipe"');
      expect(source).toContain('stderr: "pipe"');
    }
    for (const suiteId of ["p10a-08d-02", "p10b-09", "p10b-11", "p10b-13", "p10b-17", "p10b-18a"])
      expect(reporter).toContain(`"${suiteId}"`);
    expect(reporter).toContain('this.write("pre-setup"');
    expect(reporter).toContain('this.write("post-plugin-teardown"');
    expect(reporter).toContain("POST_PLUGIN_TEARDOWN");
    expect(reporter).toContain('"/projects/[projectId]/editor/page"');
    expect(reporter).toContain('"/projects/[projectId]/products/[productSlug]/page"');
    expect(reporter).toContain("id: target.id");
  });
});
