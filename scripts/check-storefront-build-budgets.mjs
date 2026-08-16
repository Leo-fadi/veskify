import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextRoot = join(repositoryRoot, ".next");

// These ceilings include each route's exact client-reference chunks plus the
// production build's shared polyfill/root-main first-load chunks. They retain
// bounded headroom over the recorded P10B-17 Webpack baseline.
const routeBudgets = Object.freeze([
  {
    route: "home",
    manifest: "server/app/projects/[projectId]/page_client-reference-manifest.js",
    manifestKey: "/projects/[projectId]/page",
    maximumRawBytes: 1_600_000,
    maximumGzipBytes: 450_000,
  },
  {
    route: "content-utility",
    manifest:
      "server/app/projects/[projectId]/[...storefrontPath]/page_client-reference-manifest.js",
    manifestKey: "/projects/[projectId]/[...storefrontPath]/page",
    maximumRawBytes: 1_600_000,
    maximumGzipBytes: 450_000,
  },
  {
    route: "search",
    manifest: "server/app/projects/[projectId]/search/page_client-reference-manifest.js",
    manifestKey: "/projects/[projectId]/search/page",
    maximumRawBytes: 1_650_000,
    maximumGzipBytes: 475_000,
  },
  {
    route: "collection",
    manifest:
      "server/app/projects/[projectId]/collections/[collectionSlug]/page_client-reference-manifest.js",
    manifestKey: "/projects/[projectId]/collections/[collectionSlug]/page",
    maximumRawBytes: 1_650_000,
    maximumGzipBytes: 475_000,
  },
  {
    route: "product",
    manifest:
      "server/app/projects/[projectId]/products/[productSlug]/page_client-reference-manifest.js",
    manifestKey: "/projects/[projectId]/products/[productSlug]/page",
    maximumRawBytes: 1_650_000,
    maximumGzipBytes: 475_000,
  },
  {
    route: "editor",
    manifest: "server/app/projects/[projectId]/editor/page_client-reference-manifest.js",
    manifestKey: "/projects/[projectId]/editor/page",
    maximumRawBytes: 2_850_000,
    maximumGzipBytes: 825_000,
  },
]);

function fail(message) {
  throw new Error(`Storefront build budget: ${message}`);
}

function requiredFile(path, description) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    fail(`missing ${description}: ${path}`);
  }
  if (!stats.isFile()) fail(`${description} is not a file: ${path}`);
  return readFileSync(path);
}

function assertClientChunkReference(reference, description) {
  if (typeof reference !== "string") fail(`${description} has a non-string chunk reference`);
  if (!/^static\/chunks\/[A-Za-z0-9%_./-]+\.js$/u.test(reference)) {
    fail(`${description} has an unsupported chunk reference: ${reference}`);
  }
  return reference;
}

function sharedFirstLoadClientChunks() {
  const path = join(nextRoot, "build-manifest.json");
  const source = requiredFile(path, "production build manifest").toString("utf8");
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch {
    fail("production build manifest is not valid JSON");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail("production build manifest payload is not an object");
  }
  if (!Array.isArray(manifest.polyfillFiles) || !Array.isArray(manifest.rootMainFiles)) {
    fail("production build manifest has no polyfill/root-main first-load authority");
  }
  const references = [...manifest.polyfillFiles, ...manifest.rootMainFiles];
  const collectTreeReferences = (value, location) => {
    if (typeof value === "string") {
      references.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => collectTreeReferences(entry, `${location}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) =>
        collectTreeReferences(entry, `${location}.${key}`),
      );
      return;
    }
    fail(`${location} contains unsupported first-load authority`);
  };
  if (manifest.rootMainFilesTree !== undefined) {
    collectTreeReferences(manifest.rootMainFilesTree, "rootMainFilesTree");
  }
  const chunks = new Set(
    references.map((reference) =>
      assertClientChunkReference(reference, "production shared first-load manifest"),
    ),
  );
  if (chunks.size === 0) fail("production build manifest references no shared first-load chunks");
  return [...chunks].sort((left, right) => left.localeCompare(right));
}

function parseClientReferenceManifest(route) {
  const path = join(nextRoot, route.manifest);
  const source = requiredFile(path, `${route.route} client-reference manifest`).toString("utf8");
  const marker = "globalThis.__RSC_MANIFEST[";
  const assignment = source.indexOf(marker);
  if (assignment < 0 || source.indexOf(marker, assignment + marker.length) >= 0) {
    fail(`${route.route} manifest must contain exactly one route assignment`);
  }
  const keyStart = assignment + marker.length;
  const assignmentEnd = source.indexOf("]=", keyStart);
  const finalSemicolon = source.lastIndexOf(";");
  if (assignmentEnd < 0 || finalSemicolon <= assignmentEnd) {
    fail(`${route.route} manifest assignment is malformed`);
  }
  if (source.slice(finalSemicolon + 1).trim() !== "") {
    fail(`${route.route} manifest contains unexpected trailing content`);
  }
  let manifestKey;
  let manifest;
  try {
    manifestKey = JSON.parse(source.slice(keyStart, assignmentEnd));
    manifest = JSON.parse(source.slice(assignmentEnd + 2, finalSemicolon));
  } catch {
    fail(`${route.route} manifest does not contain a JSON route payload`);
  }
  if (manifestKey !== route.manifestKey) {
    fail(`${route.route} manifest key is ${String(manifestKey)}, expected ${route.manifestKey}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail(`${route.route} manifest payload is not an object`);
  }
  const clientModules = manifest.clientModules;
  if (!clientModules || typeof clientModules !== "object" || Array.isArray(clientModules)) {
    fail(`${route.route} manifest has no clientModules authority`);
  }
  return clientModules;
}

function referencedClientChunks(route, clientModules) {
  const chunks = new Set();
  for (const [moduleId, clientModule] of Object.entries(clientModules)) {
    if (!clientModule || typeof clientModule !== "object" || Array.isArray(clientModule)) {
      fail(`${route.route} client module ${moduleId} is malformed`);
    }
    if (!Array.isArray(clientModule.chunks)) {
      fail(`${route.route} client module ${moduleId} has no chunk list`);
    }
    for (const reference of clientModule.chunks) {
      if (typeof reference !== "string") {
        fail(`${route.route} client module ${moduleId} has a non-string chunk reference`);
      }
      if (/^\d+$/u.test(reference)) continue;
      chunks.add(assertClientChunkReference(reference, `${route.route} client module ${moduleId}`));
    }
  }
  if (chunks.size === 0) fail(`${route.route} manifest references no client chunks`);
  return [...chunks].sort((left, right) => left.localeCompare(right));
}

function chunkMeasurements(route, chunks) {
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const chunk of chunks) {
    let decodedChunk;
    try {
      decodedChunk = decodeURIComponent(chunk);
    } catch {
      fail(`${route.route} chunk has invalid URL encoding`);
    }
    const path = resolve(nextRoot, decodedChunk);
    if (!path.startsWith(`${nextRoot}${sep}`)) {
      fail(`${route.route} chunk escapes the production build directory`);
    }
    const source = requiredFile(path, `${route.route} referenced client chunk ${chunk}`);
    const firstGzip = gzipSync(source, { level: 9 });
    const secondGzip = gzipSync(source, { level: 9 });
    if (!firstGzip.equals(secondGzip)) {
      fail(`${route.route} chunk ${chunk} did not gzip deterministically`);
    }
    rawBytes += source.byteLength;
    gzipBytes += firstGzip.byteLength;
  }
  return { rawBytes, gzipBytes };
}

function formatBytes(value) {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)} MB`
    : `${(value / 1_000).toFixed(2)} KB`;
}

const failures = [];
let sharedChunks = [];
try {
  sharedChunks = sharedFirstLoadClientChunks();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
for (const route of routeBudgets) {
  try {
    const clientModules = parseClientReferenceManifest(route);
    const routeChunks = referencedClientChunks(route, clientModules);
    const chunks = [...new Set([...sharedChunks, ...routeChunks])].sort((left, right) =>
      left.localeCompare(right),
    );
    if (sharedChunks.length === 0) fail(`${route.route} has no shared first-load chunk authority`);
    const { rawBytes, gzipBytes } = chunkMeasurements(route, chunks);
    const withinRawBudget = rawBytes <= route.maximumRawBytes;
    const withinGzipBudget = gzipBytes <= route.maximumGzipBytes;
    process.stdout.write(
      [
        route.route.padEnd(10),
        `modules=${String(Object.keys(clientModules).length).padStart(3)}`,
        `shared=${String(sharedChunks.length).padStart(2)}`,
        `chunks=${String(chunks.length).padStart(2)}`,
        `raw=${formatBytes(rawBytes)}/${formatBytes(route.maximumRawBytes)}`,
        `gzip=${formatBytes(gzipBytes)}/${formatBytes(route.maximumGzipBytes)}`,
        withinRawBudget && withinGzipBudget ? "PASS" : "FAIL",
      ].join("  ") + "\n",
    );
    if (!withinRawBudget) {
      failures.push(
        `${route.route} raw client chunks are ${rawBytes} bytes; ceiling ${route.maximumRawBytes}`,
      );
    }
    if (!withinGzipBudget) {
      failures.push(
        `${route.route} gzip client chunks are ${gzipBytes} bytes; ceiling ${route.maximumGzipBytes}`,
      );
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Storefront production client-chunk budgets passed.\n");
}
