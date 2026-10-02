import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import type { Dirent } from "node:fs";

import type { Page, Response, TestInfo } from "@playwright/test";

const knownProfiles = new Set([
  "pdp-standard-commerce",
  "pdp-high-consideration",
  "pdp-gallery-led",
  "pdp-variant-led",
]);
const manifestPaths = [
  ".next/dev/server/app-paths-manifest.json",
  ".next/dev/routes-manifest.json",
] as const;
const maximumExcerptLength = 240;
const maximumManifestBytes = 64 * 1024;
const maximumProcesses = 128;
const maximumFileDescriptors = 256;
const lastDiagnostic = new WeakMap<Page, PdpRouteDiagnostic>();
const expectedPdpManifestKey = "/p10b-11-pdp-proof/page";
const expectedPdpManifestTarget = "app/p10b-11-pdp-proof/page.js";

type ManifestResult = "ABSENT" | "ESCAPE" | "INVALID" | "OK" | "TOO_LARGE";
type RouteManifestDiagnostic = Array<{
  bytes?: number;
  keys?: string[];
  path: string;
  pdpTarget?: string;
  result: ManifestResult;
  sha256?: string;
}>;

export type PdpRouteDiagnostic = {
  requestedUrl: string;
  finalUrl: string;
  configuredRuntimeMode: string;
  response: null | { status: number; resourceType: string; url: string };
  beforeRoutes: RouteManifestDiagnostic;
  afterRoutes: RouteManifestDiagnostic;
  server: PdpServerDiagnostic;
  failureExcerpt?: string;
};

export type PdpServerDiagnostic =
  | { platform: string; result: "UNKNOWN" }
  | { port: number; result: "NOT_LISTENING" | "TRUNCATED" | "UNKNOWN" }
  | { inode: string; port: number; result: "UNOWNED" }
  | { cwd: string; inode: string; pid: number; port: number; process: string; result: "OWNED" };

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function contained(root: string, path: string) {
  const relation = relative(root, path);
  return relation !== "" && !relation.startsWith("..") && !relation.includes("../");
}

function safeManifest(root: string, relativePath: string) {
  const repository = resolve(root);
  const path = resolve(repository, relativePath);
  if (!contained(repository, path) || !existsSync(path))
    return { path: relativePath, result: "ABSENT" as const };
  let current = repository;
  try {
    for (const component of relativePath.split("/")) {
      current = resolve(current, component);
      if (lstatSync(current).isSymbolicLink())
        return { path: relativePath, result: "ESCAPE" as const };
    }
    const before = lstatSync(path);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = fstatSync(fd);
      const after = lstatSync(path);
      if (
        !opened.isFile() ||
        before.dev !== opened.dev ||
        before.ino !== opened.ino ||
        after.dev !== opened.dev ||
        after.ino !== opened.ino
      )
        return { path: relativePath, result: "ESCAPE" as const };
      if (opened.size > maximumManifestBytes)
        return { path: relativePath, bytes: opened.size, result: "TOO_LARGE" as const };
      const source = readFileSync(fd);
      const parsed = JSON.parse(source.toString()) as Record<string, unknown>;
      const target = parsed[expectedPdpManifestKey];
      return {
        path: relativePath,
        result: "OK" as const,
        bytes: source.byteLength,
        sha256: sha256(source),
        keys: Object.keys(parsed)
          .filter((key) => key === expectedPdpManifestKey || key === "/_not-found")
          .sort(),
        ...(relativePath.endsWith("app-paths-manifest.json")
          ? { pdpTarget: target === expectedPdpManifestTarget ? "EXPECTED" : "UNEXPECTED" }
          : {}),
      };
    } finally {
      closeSync(fd);
    }
  } catch {
    return { path: relativePath, result: "INVALID" as const };
  }
}

export function collectPdpRouteManifest(root: string): RouteManifestDiagnostic {
  return manifestPaths.map((path) => safeManifest(root, path));
}

function listeningInodes(port: number, procRoot: string) {
  const portHex = port.toString(16).toUpperCase().padStart(4, "0");
  const inodes: string[] = [];
  for (const path of ["net/tcp", "net/tcp6"]) {
    try {
      for (const line of readFileSync(resolve(procRoot, path), "utf8").split("\n").slice(1)) {
        const columns = line.trim().split(/\s+/u);
        if (
          columns.length >= 10 &&
          columns[3] === "0A" &&
          columns[1]?.endsWith(`:${portHex}`) &&
          columns[9]
        )
          inodes.push(columns[9]);
      }
    } catch {
      return { inodes: [], readable: false };
    }
  }
  return { inodes, readable: true };
}

export function inspectPdpServer(
  port: number,
  root: string,
  procRoot = "/proc",
): PdpServerDiagnostic {
  if (process.platform !== "linux" && procRoot === "/proc")
    return { platform: process.platform, result: "UNKNOWN" };
  const sockets = listeningInodes(port, procRoot);
  if (!sockets.readable) return { port, result: "UNKNOWN" };
  const inodes = sockets.inodes.filter((inode): inode is string => Boolean(inode));
  if (inodes.length === 0) return { port, result: "NOT_LISTENING" };
  const repository = resolve(root);
  let entries: Dirent[];
  try {
    entries = readdirSync(procRoot, { withFileTypes: true });
  } catch {
    return { port, result: "UNKNOWN" };
  }
  const numericEntries = entries.filter(
    (entry) => entry.isDirectory() && /^\d+$/u.test(entry.name),
  );
  if (numericEntries.length > maximumProcesses) return { port, result: "TRUNCATED" };
  for (const entry of numericEntries) {
    const base = resolve(procRoot, entry.name);
    try {
      const processName = readFileSync(resolve(base, "comm"), "utf8").trim();
      if (!/^next-server(?:\s|$)/u.test(processName)) continue;
      if (resolve(readlinkSync(resolve(base, "cwd"))) !== repository) continue;
      const fdDirectory = resolve(base, "fd");
      const fds = readdirSync(fdDirectory);
      if (fds.length > maximumFileDescriptors) return { port, result: "TRUNCATED" };
      let fdReadFailed = false;
      for (const fd of fds) {
        try {
          const inode = readlinkSync(resolve(fdDirectory, fd)).match(/^socket:\[(\d+)\]$/u)?.[1];
          if (inode && inodes.includes(inode))
            return {
              result: "OWNED",
              port,
              inode,
              pid: Number(entry.name),
              process: processName,
              cwd: repository,
            };
        } catch {
          fdReadFailed = true;
        }
      }
      if (fdReadFailed) return { port, result: "UNKNOWN" };
    } catch {
      return { port, result: "UNKNOWN" };
    }
  }
  return { result: "UNOWNED", port, inode: inodes[0] };
}

export function safePdpFailureExcerpt(title: string, visibleError: string) {
  const value = `${title}\n${visibleError}`.replace(/\s+/gu, " ").trim();
  const status = value.match(/\b(404|500)\b/u)?.[1];
  return status ? `visible-http-${status}` : value ? "UNRECOGNIZED" : undefined;
}

function safePdpUrl(value: string) {
  try {
    const url = new URL(value, "http://127.0.0.1");
    const profile = url.searchParams.get("profile");
    if (
      url.hostname === "127.0.0.1" &&
      url.pathname === "/p10b-11-pdp-proof" &&
      profile &&
      knownProfiles.has(profile)
    ) {
      return `/p10b-11-pdp-proof?profile=${profile}`;
    }
  } catch {
    // Redact unexpected URLs rather than retaining arbitrary query parameters.
  }
  return "REDACTED_UNEXPECTED_URL";
}

export function latestPdpDiagnostic(page: Page) {
  return lastDiagnostic.get(page);
}

export function refreshPdpDiagnostic(page: Page, repositoryRoot: string, port: number) {
  const diagnostic = lastDiagnostic.get(page);
  if (!diagnostic) return undefined;
  const refreshed = {
    ...diagnostic,
    finalUrl: safePdpUrl(page.url()),
    afterRoutes: collectPdpRouteManifest(repositoryRoot),
    server: inspectPdpServer(port, repositoryRoot),
  };
  lastDiagnostic.set(page, refreshed);
  return refreshed;
}

export async function attachPdpDiagnostic(
  testInfo: TestInfo,
  name: string,
  diagnostic: PdpRouteDiagnostic,
) {
  const path = testInfo.outputPath(`${name}.json`);
  writeFileSync(path, `${JSON.stringify(diagnostic)}\n`, { flag: "wx" });
  await testInfo.attach(name, { path, contentType: "application/json" });
}

export async function gotoPdpWithDiagnostics(
  page: Page,
  url: string,
  repositoryRoot: string,
  port: number,
  configuredRuntimeMode: string,
): Promise<PdpRouteDiagnostic> {
  const beforeRoutes = collectPdpRouteManifest(repositoryRoot);
  let response: Response | null = null;
  let navigationError: Error | undefined;
  try {
    response = await page.goto(url);
  } catch (error) {
    navigationError =
      error instanceof Error ? error : new Error("Navigation failed without an Error object");
  }
  const failureExcerpt =
    response?.status() === 200
      ? undefined
      : (safePdpFailureExcerpt(
          await page.title().catch(() => ""),
          await page
            .locator("h1, [role=alert]")
            .allTextContents()
            .then((items) => items.join(" "))
            .catch(() => ""),
        ) ?? "navigation-failed-without-visible-error");
  const diagnostic: PdpRouteDiagnostic = {
    requestedUrl: safePdpUrl(url),
    finalUrl: safePdpUrl(page.url()),
    configuredRuntimeMode,
    response: response
      ? {
          status: response.status(),
          resourceType: response.request().resourceType(),
          url: safePdpUrl(response.url()),
        }
      : null,
    beforeRoutes,
    afterRoutes: collectPdpRouteManifest(repositoryRoot),
    server: inspectPdpServer(port, repositoryRoot),
    ...(failureExcerpt ? { failureExcerpt: failureExcerpt.slice(0, maximumExcerptLength) } : {}),
  };
  lastDiagnostic.set(page, diagnostic);
  if (navigationError) throw navigationError;
  return diagnostic;
}
