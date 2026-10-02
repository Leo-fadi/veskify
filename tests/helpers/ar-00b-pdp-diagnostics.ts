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

const knownPdpProfiles = new Set([
  "pdp-standard-commerce",
  "pdp-high-consideration",
  "pdp-gallery-led",
  "pdp-variant-led",
]);
const knownUtilityProfiles = new Set([
  "commerce-utility-cart",
  "commerce-utility-no-results",
  "commerce-utility-error",
  "commerce-utility-not-found",
]);
const manifestPaths = [
  ".next/dev/server/app-paths-manifest.json",
  ".next/dev/routes-manifest.json",
] as const;
const maximumExcerptLength = 240;
const maximumManifestBytes = 64 * 1024;
const maximumProcessEntries = 512;
const maximumNextCandidates = 32;
const maximumFileDescriptors = 256;
const lastDiagnostic = new WeakMap<Page, RouteDiagnostic>();
const expectedPdpManifestKey = "/p10b-11-pdp-proof/page";
const expectedPdpManifestTarget = "app/p10b-11-pdp-proof/page.js";

export type ManifestResult = "ABSENT" | "ESCAPE" | "INVALID" | "OK" | "TOO_LARGE";
export type RouteManifestExpectation = {
  readonly key: string;
  readonly target?: string;
};
export type RouteManifestDiagnostic = Array<{
  bytes?: number;
  keys?: string[];
  path: string;
  results?: ReadonlyArray<{ key: string; target: "EXPECTED" | "UNEXPECTED" | "ABSENT" }>;
  result: ManifestResult;
  sha256?: string;
}>;
export type ServerTarget = { readonly cwd: string; readonly id: string; readonly port: number };
export type PdpServerDiagnostic =
  | { platform: string; result: "UNKNOWN" }
  | { id?: string; port: number; result: "NOT_LISTENING" | "TRUNCATED" | "UNKNOWN" }
  | { id?: string; inode: string; port: number; result: "UNOWNED" }
  | {
      id?: string;
      inode: string;
      pid: number;
      port: number;
      process: string;
      result: "FOREIGN";
      startTicks: string;
    }
  | {
      cwd: string;
      id?: string;
      inode: string;
      pid: number;
      port: number;
      process: string;
      result: "OWNED";
      startTicks: string;
    };
export type RouteDiagnostic = {
  requestedUrl: string;
  finalUrl: string;
  configuredRuntimeMode: string;
  response: null | { status: number; resourceType: string; url: string };
  beforeRoutes: RouteManifestDiagnostic;
  afterRoutes: RouteManifestDiagnostic;
  server: PdpServerDiagnostic;
  failureExcerpt?: string;
  presentation?: "BRANDED_UTILITY_NOT_FOUND" | "GENERIC_HTTP_ERROR";
};
export type PdpRouteDiagnostic = RouteDiagnostic;

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function contained(root: string, path: string) {
  const relation = relative(root, path);
  return relation !== "" && !relation.startsWith("..") && !relation.includes("../");
}

function safeManifest(
  root: string,
  relativePath: string,
  expectations: readonly RouteManifestExpectation[],
) {
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
      const results = relativePath.endsWith("app-paths-manifest.json")
        ? expectations.map(({ key, target }) => {
            const observed = parsed[key];
            return {
              key,
              target:
                typeof observed !== "string"
                  ? "ABSENT"
                  : target === undefined || observed === target
                    ? "EXPECTED"
                    : "UNEXPECTED",
            } as const;
          })
        : undefined;
      return {
        path: relativePath,
        result: "OK" as const,
        bytes: source.byteLength,
        sha256: sha256(source),
        keys: expectations
          .filter(({ key }) => Object.hasOwn(parsed, key))
          .map(({ key }) => key)
          .sort(),
        ...(results ? { results } : {}),
      };
    } finally {
      closeSync(fd);
    }
  } catch {
    return { path: relativePath, result: "INVALID" as const };
  }
}

export function collectRouteManifest(
  root: string,
  expectations: readonly RouteManifestExpectation[],
): RouteManifestDiagnostic {
  return manifestPaths.map((path) => safeManifest(root, path, expectations));
}

export function collectPdpRouteManifest(root: string): RouteManifestDiagnostic {
  return collectRouteManifest(root, [
    { key: expectedPdpManifestKey, target: expectedPdpManifestTarget },
    { key: "/_not-found" },
  ]);
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

export function inspectNextServer(target: ServerTarget, procRoot = "/proc"): PdpServerDiagnostic {
  if (process.platform !== "linux" && procRoot === "/proc")
    return { platform: process.platform, result: "UNKNOWN" };
  const sockets = listeningInodes(target.port, procRoot);
  if (!sockets.readable) return { id: target.id, port: target.port, result: "UNKNOWN" };
  const inodes = sockets.inodes.filter((inode): inode is string => Boolean(inode));
  if (inodes.length === 0) return { id: target.id, port: target.port, result: "NOT_LISTENING" };
  const repository = resolve(target.cwd);
  let entries: Dirent[];
  try {
    entries = readdirSync(procRoot, { withFileTypes: true });
  } catch {
    return { id: target.id, port: target.port, result: "UNKNOWN" };
  }
  const numericEntries = entries.filter(
    (entry) => entry.isDirectory() && /^\d+$/u.test(entry.name),
  );
  if (numericEntries.length > maximumProcessEntries)
    return { id: target.id, port: target.port, result: "TRUNCATED" };
  let nextCandidates = 0;
  for (const entry of numericEntries) {
    const base = resolve(procRoot, entry.name);
    let processName: string;
    try {
      processName = readFileSync(resolve(base, "comm"), "utf8").trim();
    } catch {
      continue;
    }
    if (!/^next-server(?:\s|$)/u.test(processName)) continue;
    if (++nextCandidates > maximumNextCandidates)
      return { id: target.id, port: target.port, result: "TRUNCATED" };
    let cwd: string;
    try {
      cwd = resolve(readlinkSync(resolve(base, "cwd")));
    } catch {
      return { id: target.id, port: target.port, result: "UNKNOWN" };
    }
    const fdDirectory = resolve(base, "fd");
    let fds: string[];
    try {
      fds = readdirSync(fdDirectory);
    } catch {
      return { id: target.id, port: target.port, result: "UNKNOWN" };
    }
    if (fds.length > maximumFileDescriptors)
      return { id: target.id, port: target.port, result: "TRUNCATED" };
    for (const fd of fds) {
      try {
        const inode = readlinkSync(resolve(fdDirectory, fd)).match(/^socket:\[(\d+)\]$/u)?.[1];
        if (!inode || !inodes.includes(inode)) continue;
        const stat = readFileSync(resolve(base, "stat"), "utf8");
        const startTicks = stat.slice(stat.lastIndexOf(")") + 2).split(/\s+/u)[19];
        if (!startTicks || !/^\d+$/u.test(startTicks)) {
          return { id: target.id, port: target.port, result: "UNKNOWN" };
        }
        if (cwd !== repository)
          return {
            result: "FOREIGN",
            id: target.id,
            port: target.port,
            inode,
            pid: Number(entry.name),
            process: processName,
            startTicks,
          };
        return {
          result: "OWNED",
          id: target.id,
          port: target.port,
          inode,
          pid: Number(entry.name),
          process: processName,
          cwd: repository,
          startTicks,
        };
      } catch {
        return { id: target.id, port: target.port, result: "UNKNOWN" };
      }
    }
  }
  return { result: "UNOWNED", id: target.id, port: target.port, inode: inodes[0] };
}

export function inspectPdpServer(
  port: number,
  root: string,
  procRoot = "/proc",
): PdpServerDiagnostic {
  return inspectNextServer({ id: "pdp", port, cwd: root }, procRoot);
}

export function safePdpFailureExcerpt(title: string, visibleError: string) {
  const value = `${title}\n${visibleError}`.replace(/\s+/gu, " ").trim();
  const status = value.match(/\b(404|500)\b/u)?.[1];
  return status ? `visible-http-${status}` : value ? "UNRECOGNIZED" : undefined;
}

function safeRouteUrl(value: string, pathname: string, profiles: ReadonlySet<string>) {
  try {
    const url = new URL(value, "http://127.0.0.1");
    const profile = url.searchParams.get("profile");
    if (
      url.hostname === "127.0.0.1" &&
      url.pathname === pathname &&
      profile &&
      profiles.has(profile)
    )
      return `${pathname}?profile=${profile}`;
  } catch {
    // Redact unexpected URLs rather than retaining arbitrary query parameters.
  }
  return "REDACTED_UNEXPECTED_URL";
}

function currentFailureExcerpt(page: Page, response: Response | null) {
  if (response?.status() === 200) return Promise.resolve(undefined);
  return Promise.all([
    page.title().catch(() => ""),
    page
      .locator("h1, [role=alert]")
      .allTextContents()
      .then((items) => items.join(" "))
      .catch(() => ""),
  ]).then(
    ([title, visibleError]) =>
      safePdpFailureExcerpt(title, visibleError) ?? "navigation-failed-without-visible-error",
  );
}

async function gotoWithDiagnostics(
  page: Page,
  url: string,
  repositoryRoot: string,
  port: number,
  configuredRuntimeMode: string,
  pathname: string,
  profiles: ReadonlySet<string>,
  expectations: readonly RouteManifestExpectation[],
): Promise<RouteDiagnostic> {
  const beforeRoutes = collectRouteManifest(repositoryRoot, expectations);
  let response: Response | null = null;
  let navigationError: Error | undefined;
  try {
    response = await page.goto(url);
  } catch (error) {
    navigationError =
      error instanceof Error ? error : new Error("Navigation failed without an Error object");
  }
  const failureExcerpt = await currentFailureExcerpt(page, response);
  const diagnostic: RouteDiagnostic = {
    requestedUrl: safeRouteUrl(url, pathname, profiles),
    finalUrl: safeRouteUrl(page.url(), pathname, profiles),
    configuredRuntimeMode,
    response: response
      ? {
          status: response.status(),
          resourceType: response.request().resourceType(),
          url: safeRouteUrl(response.url(), pathname, profiles),
        }
      : null,
    beforeRoutes,
    afterRoutes: collectRouteManifest(repositoryRoot, expectations),
    server: inspectPdpServer(port, repositoryRoot),
    ...(failureExcerpt ? { failureExcerpt: failureExcerpt.slice(0, maximumExcerptLength) } : {}),
  };
  lastDiagnostic.set(page, diagnostic);
  if (navigationError) throw navigationError;
  return diagnostic;
}

export function latestPdpDiagnostic(page: Page) {
  return lastDiagnostic.get(page);
}

export function refreshPdpDiagnostic(page: Page, repositoryRoot: string, port: number) {
  const diagnostic = lastDiagnostic.get(page);
  if (!diagnostic) return undefined;
  const refreshed = {
    ...diagnostic,
    finalUrl: safeRouteUrl(page.url(), "/p10b-11-pdp-proof", knownPdpProfiles),
    afterRoutes: collectPdpRouteManifest(repositoryRoot),
    server: inspectPdpServer(port, repositoryRoot),
  };
  lastDiagnostic.set(page, refreshed);
  return refreshed;
}

export async function attachPdpDiagnostic(
  testInfo: TestInfo,
  name: string,
  diagnostic: RouteDiagnostic,
) {
  const path = testInfo.outputPath(`${name}.json`);
  writeFileSync(path, `${JSON.stringify(diagnostic)}\n`, { flag: "wx" });
  await testInfo.attach(name, { path, contentType: "application/json" });
}

export function gotoPdpWithDiagnostics(
  page: Page,
  url: string,
  repositoryRoot: string,
  port: number,
  configuredRuntimeMode: string,
) {
  return gotoWithDiagnostics(
    page,
    url,
    repositoryRoot,
    port,
    configuredRuntimeMode,
    "/p10b-11-pdp-proof",
    knownPdpProfiles,
    [{ key: expectedPdpManifestKey, target: expectedPdpManifestTarget }, { key: "/_not-found" }],
  );
}

export async function gotoUtilityWithDiagnostics(
  page: Page,
  url: string,
  repositoryRoot: string,
  port: number,
  configuredRuntimeMode: string,
) {
  const diagnostic = await gotoWithDiagnostics(
    page,
    url,
    repositoryRoot,
    port,
    configuredRuntimeMode,
    "/p10b-13-utility-proof",
    knownUtilityProfiles,
    [{ key: "/p10b-13-utility-proof/page" }, { key: "/_not-found" }],
  );
  const branded = await page
    .locator('[data-p10b-13-profile="commerce-utility-not-found"]')
    .count()
    .catch(() => 0);
  const presentation: RouteDiagnostic["presentation"] =
    branded === 1
      ? "BRANDED_UTILITY_NOT_FOUND"
      : diagnostic.response?.status === 404
        ? "GENERIC_HTTP_ERROR"
        : undefined;
  const result: RouteDiagnostic = presentation ? { ...diagnostic, presentation } : diagnostic;
  lastDiagnostic.set(page, result);
  return result;
}
