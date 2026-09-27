// @vitest-environment node

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const checker = readFileSync(
  fileURLToPath(new URL("../../scripts/check-storefront-build-budgets.mjs", import.meta.url)),
);
const routes = [
  { route: "home", page: "projects/[projectId]", raw: 1_602_000, gzip: 450_000 },
  {
    route: "content-utility",
    page: "projects/[projectId]/[...storefrontPath]",
    raw: 1_602_000,
    gzip: 450_000,
  },
  { route: "search", page: "projects/[projectId]/search", raw: 1_660_000, gzip: 475_000 },
  {
    route: "collection",
    page: "projects/[projectId]/collections/[collectionSlug]",
    raw: 1_653_000,
    gzip: 475_000,
  },
  {
    route: "product",
    page: "projects/[projectId]/products/[productSlug]",
    raw: 1_653_000,
    gzip: 475_000,
  },
  { route: "editor", page: "projects/[projectId]/editor", raw: 2_850_000, gzip: 825_000 },
] as const;
const fixtures: string[] = [];
const shared = Buffer.from("/* shared */");
const sharedChunk = "static/chunks/shared.js";
function put(root: string, path: string, value: string | Buffer) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ar06c-budget-"));
  fixtures.push(root);
  put(root, "scripts/check-storefront-build-budgets.mjs", checker);
  put(
    root,
    ".next/build-manifest.json",
    JSON.stringify({ polyfillFiles: [sharedChunk], rootMainFiles: [sharedChunk] }),
  );
  put(root, ".next/" + sharedChunk, shared);
  for (const item of routes) {
    const key = `/${item.page}/page`;
    const manifest = {
      clientModules: {
        synthetic: { chunks: ["1", sharedChunk, `static/chunks/${item.route}.js`] },
      },
    };
    put(
      root,
      `.next/server/app/${item.page}/page_client-reference-manifest.js`,
      `globalThis.__RSC_MANIFEST[${JSON.stringify(key)}]=${JSON.stringify(manifest)};`,
    );
    put(root, `.next/static/chunks/${item.route}.js`, Buffer.alloc(32, 97));
  }
  return root;
}
function check(root: string) {
  const result = spawnSync(process.execPath, ["scripts/check-storefront-build-budgets.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH, NODE_ENV: "test" },
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}
afterEach(() => {
  for (const path of fixtures.splice(0)) rmSync(path, { recursive: true });
});

describe("AR-06C explicitly approved bundle policy", () => {
  it.each(routes)(
    "accepts $route exactly at its raw ceiling and rejects one byte above",
    (item) => {
      const root = fixture();
      const path = `.next/static/chunks/${item.route}.js`;
      put(root, path, Buffer.alloc(item.raw - shared.length, 97));
      const accepted = check(root);
      expect(accepted.status).toBe(0);
      expect(accepted.stderr).toBe("");
      expect(accepted.stdout.match(/PASS/gu)).toHaveLength(6);
      put(root, path, Buffer.alloc(item.raw - shared.length + 1, 97));
      const rejected = check(root);
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toBe(
        `${item.route} raw client chunks are ${item.raw + 1} bytes; ceiling ${item.raw}\n`,
      );
    },
  );

  it.each(routes)("retains the $route gzip ceiling while raw usage is below its limit", (item) => {
    const root = fixture();
    const bytes = Buffer.alloc(item.gzip + 1024);
    let state = 0x12345678;
    for (let index = 0; index < bytes.length; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      bytes[index] = state & 255;
    }
    const actualGzip = gzipSync(bytes, { level: 9 }).length + gzipSync(shared, { level: 9 }).length;
    expect(actualGzip).toBeGreaterThan(item.gzip);
    expect(bytes.length + shared.length).toBeLessThan(item.raw);
    put(root, `.next/static/chunks/${item.route}.js`, bytes);
    const result = check(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      `${item.route} gzip client chunks are ${actualGzip} bytes; ceiling ${item.gzip}\n`,
    );
  });

  it.each([
    ".next/build-manifest.json",
    ".next/server/app/projects/[projectId]/page_client-reference-manifest.js",
    ".next/static/chunks/home.js",
  ])("rejects missing required artifact %s", (path) => {
    const root = fixture();
    rmSync(join(root, path));
    const result = check(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing");
    expect(result.stdout).not.toContain("budgets passed");
  });
});
