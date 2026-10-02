import { existsSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

import {
  collectRouteManifest,
  inspectNextServer,
  type RouteManifestExpectation,
  type ServerTarget,
} from "./ar-00b-pdp-diagnostics";

const root = process.env.VESKIFY_AR00B_GROUP02_DIAGNOSTIC_ROOT;
const suiteId = process.env.VESKIFY_AR00B_GROUP02_SUITE_ID;
const repositoryRoot = process.env.VESKIFY_AR00B_GROUP02_REPOSITORY_ROOT;
const maximumSignals = 24;
const GROUP02_SUITES = new Set([
  "p10a-08d-02",
  "p10b-09",
  "p10b-11",
  "p10b-13",
  "p10b-17",
  "p10b-18a",
]);

type TargetPlan = {
  readonly expectations: readonly RouteManifestExpectation[];
  readonly targets: readonly ServerTarget[];
};

function configuredPort(name: string, fallback: number) {
  const value = process.env[name];
  return value && /^\d{2,5}$/u.test(value) ? Number(value) : fallback;
}

function targetPlan(): TargetPlan {
  if (!repositoryRoot || !suiteId) return { expectations: [], targets: [] };
  const cwd = resolve(repositoryRoot);
  switch (suiteId) {
    case "p10a-08d-02":
      return {
        expectations: [{ key: "/page" }, { key: "/_not-found" }],
        targets: [{ id: "primary", port: configuredPort("PLAYWRIGHT_PORT", 3132), cwd }],
      };
    case "p10b-09":
      return {
        expectations: [{ key: "/p10b-09-homepage-proof/page" }, { key: "/_not-found" }],
        targets: [{ id: "primary", port: configuredPort("PLAYWRIGHT_PORT", 3100), cwd }],
      };
    case "p10b-11":
      return {
        expectations: [{ key: "/p10b-11-pdp-proof/page" }, { key: "/_not-found" }],
        targets: [{ id: "primary", port: configuredPort("PLAYWRIGHT_PORT", 3100), cwd }],
      };
    case "p10b-13":
      return {
        expectations: [{ key: "/p10b-13-utility-proof/page" }, { key: "/_not-found" }],
        targets: [{ id: "primary", port: configuredPort("PLAYWRIGHT_PORT", 3100), cwd }],
      };
    case "p10b-17":
      return {
        expectations: [
          { key: "/projects/[projectId]/editor/page" },
          { key: "/projects/[projectId]/page" },
          { key: "/projects/[projectId]/collections/[collectionSlug]/page" },
          { key: "/projects/[projectId]/search/page" },
          { key: "/projects/[projectId]/products/[productSlug]/page" },
          { key: "/projects/[projectId]/[...storefrontPath]/page" },
          { key: "/projects/[projectId]/published/search/page" },
        ],
        targets: [{ id: "primary", port: configuredPort("PLAYWRIGHT_PORT", 3140), cwd }],
      };
    case "p10b-18a": {
      const p04Cwd = process.env.VESKIFY_AR00B_GROUP02_P04_CWD;
      return {
        expectations: [
          { key: "/page" },
          { key: "/projects/[projectId]/page" },
          { key: "/projects/[projectId]/collections/[collectionSlug]/page" },
          { key: "/projects/[projectId]/products/[productSlug]/page" },
        ],
        targets: [
          { id: "standalone", port: configuredPort("PLAYWRIGHT_PORT", 3141), cwd },
          {
            id: "p04",
            port: configuredPort("P10B18A_P04_PLAYWRIGHT_PORT", 3142),
            cwd: p04Cwd ? resolve(p04Cwd) : cwd,
          },
        ],
      };
    }
    default:
      return { expectations: [], targets: [] };
  }
}

function within(parent: string, candidate: string) {
  const value = relative(parent, candidate);
  return value === "" || (!value.startsWith("..") && !value.includes("../"));
}

function category(chunk: string) {
  if (/\b(error|failed|exception)\b/iu.test(chunk)) return "SERVER_ERROR";
  if (/\b(?:compil\w*|build\w*)\b/iu.test(chunk)) return "SERVER_COMPILE";
  if (/\bready\b/iu.test(chunk)) return "SERVER_READY";
  if (/\bGET\s+\//u.test(chunk)) return "SERVER_ROUTE";
  return undefined;
}

export default class Group02DiagnosticReporter implements Reporter {
  private readonly signals: Array<{ channel: "stderr" | "stdout"; category: string }> = [];
  private firstFailure = false;
  private availability = "AVAILABLE";

  printsToStdio() {
    return false;
  }

  onConfigure() {
    this.write("pre-setup", { phase: "PRE_SETUP", ...this.snapshot() });
  }

  onBegin() {
    this.write("live-window", { phase: "LIVE_WINDOW", ...this.snapshot() });
  }

  onStdOut(chunk: string | Buffer) {
    this.record("stdout", chunk.toString());
  }

  onStdErr(chunk: string | Buffer) {
    this.record("stderr", chunk.toString());
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === test.expectedStatus) return;
    this.captureFirstFailure({
      test: test.titlePath().slice(-2),
      status: result.status,
      expectedStatus: test.expectedStatus,
    });
  }

  onError() {
    this.captureFirstFailure({ source: "REPORTER_ERROR" });
  }

  onEnd() {
    this.write("post-plugin-teardown", { phase: "POST_PLUGIN_TEARDOWN", ...this.snapshot() });
  }

  private captureFirstFailure(detail: Record<string, unknown>) {
    if (this.firstFailure) return;
    this.firstFailure = true;
    this.write("first-failure", { phase: "FIRST_FAILURE", ...detail, ...this.snapshot() });
  }

  private record(channel: "stderr" | "stdout", chunk: string) {
    const value = category(chunk);
    if (value && this.signals.length < maximumSignals)
      this.signals.push({ channel, category: value });
  }

  private snapshot() {
    const plan = targetPlan();
    return {
      suiteId: suiteId ?? "UNKNOWN",
      diagnosticAvailability: this.availability,
      signals: this.signals,
      manifests: plan.targets.map((target) => ({
        id: target.id,
        routes: collectRouteManifest(target.cwd, plan.expectations),
      })),
      servers: plan.targets.map((target) => inspectNextServer(target)),
    };
  }

  private write(name: string, body: Record<string, unknown>) {
    try {
      if (!root || !suiteId || !repositoryRoot || !GROUP02_SUITES.has(suiteId)) {
        this.availability = "UNAVAILABLE_CONFIGURATION";
        return;
      }
      const rootDirectory = resolve(root);
      const directory = resolve(rootDirectory, suiteId);
      if (!within(rootDirectory, directory) || !this.safeDirectory(rootDirectory, directory)) {
        this.availability = "UNAVAILABLE_PATH";
        return;
      }
      writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify(body)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
    } catch {
      this.availability = "UNAVAILABLE_WRITE";
    }
  }

  private safeDirectory(rootDirectory: string, directory: string) {
    try {
      if (!existsSync(rootDirectory) || lstatSync(rootDirectory).isSymbolicLink()) return false;
      let current = rootDirectory;
      for (const component of relative(rootDirectory, directory).split("/")) {
        if (!component) continue;
        current = resolve(current, component);
        if (existsSync(current) && lstatSync(current).isSymbolicLink()) return false;
      }
      mkdirSync(directory, { recursive: true });
      return lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink();
    } catch {
      return false;
    }
  }
}
