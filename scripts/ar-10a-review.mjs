import { createHash, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, realpath, statfs, readdir } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { loadavg, freemem, totalmem } from "node:os";

const repository = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = resolve(repository, "../veskify-batch-runs/BATCH-19/AR-10A");
const [mode, option, argument] = process.argv.slice(2);
if (
  !["trace", "diagnostic", "about-diagnostic", "full", "production"].includes(mode) ||
  option !== "--output" ||
  !argument
)
  throw new Error(
    "Usage: node scripts/ar-10a-review.mjs trace|diagnostic|about-diagnostic|full|production --output <new assigned directory>",
  );
const output = resolve(argument),
  child = relative(root, output);
if (!child || child.startsWith("..") || isAbsolute(child)) throw new Error("Unassigned output");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const record = (path, value) =>
  writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
async function productionPackaging() {
  const build = join(repository, ".next");
  if ((await realpath(build)) !== build) throw new Error("Symlinked build output");
  const fixture = "tests/fixtures/ar-10a/original-aggregate.json";
  for (const path of [join(repository, fixture), join(build, "BUILD_ID")])
    if ((await realpath(path)) !== path) throw new Error("Symlinked packaging identity");
  const fixtureHash = "355a1ab4188ea6e30e711ab84d3ba8ecbd853cab26fe6e8dbda4d6cf27b6bc5d";
  const markers = [fixture, "ar-10a/original-aggregate", "VESKIFY_AR10A_OFFLINE_REPLAY"];
  const manifests = [],
    clientArtifacts = [],
    retainedFixtureEntries = [];
  let traceCount = 0,
    clientManifestCount = 0;
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Unexpected link in compiled evidence");
      if (entry.isDirectory()) {
        await scan(path);
        continue;
      }
      const name = relative(build, path);
      const trace = name.endsWith(".nft.json");
      const clientManifest = name.endsWith("client-reference-manifest.js");
      const clientChunk = name.startsWith("static/") && name.endsWith(".js");
      if (!trace && !clientManifest && !clientChunk) continue;
      const bytes = await readFile(path),
        text = bytes.toString("utf8");
      const identity = { path: name, bytes: bytes.length, sha256: sha(bytes) };
      if (trace) {
        traceCount++;
        manifests.push(identity);
        const value = JSON.parse(text);
        if (!Array.isArray(value.files) || value.files.some((item) => typeof item !== "string"))
          throw new Error("Malformed NFT file list");
        for (const originalEntry of value.files) {
          if (!/ar-10a|original-aggregate/i.test(originalEntry)) continue;
          const resolved = resolve(path, "..", originalEntry);
          if (resolved !== join(repository, fixture) || (await realpath(resolved)) !== resolved)
            throw new Error("Unexpected fixture-related trace artifact");
          const bytes = await readFile(resolved);
          if (sha(bytes) !== fixtureHash) throw new Error("Changed retained fixture");
          retainedFixtureEntries.push({
            trace: name,
            originalEntry,
            resolved,
            bytes: bytes.length,
            sha256: sha(bytes),
          });
        }
      } else {
        if (clientManifest) clientManifestCount++;
        const matchingMarkers = markers.filter((marker) => text.includes(marker));
        clientArtifacts.push({
          ...identity,
          kind: clientManifest ? "client-reference" : "client-js",
          matchingMarkers,
        });
        if (matchingMarkers.length) throw new Error("Replay fixture registered in client output");
      }
    }
  }
  await scan(join(build, "server"));
  await scan(join(build, "static"));
  if (
    !traceCount ||
    !clientManifestCount ||
    !clientArtifacts.some((entry) => entry.kind === "client-js")
  )
    throw new Error("Incomplete compiled packaging evidence");
  if (sha(await readFile(join(repository, fixture))) !== fixtureHash)
    throw new Error("Changed source fixture");
  return {
    buildId: (await readFile(join(build, "BUILD_ID"), "utf8")).trim(),
    fixture: { path: fixture, sha256: fixtureHash },
    traceCount,
    clientManifestCount,
    manifests,
    clientArtifacts,
    retainedFixtureEntries,
    clientStatus:
      "No exact replay-path/flag markers in all current client-reference manifests and static JavaScript; server-only source and runtime guard are separate checks.",
    serverStatus: retainedFixtureEntries.length
      ? "Identity-verified fixture source retained in NFT packaging."
      : "No fixture-related NFT entry found in the collected build traces; this does not prove arbitrary execution impossible.",
  };
}
const branch = execFileSync("git", ["branch", "--show-current"], {
  cwd: repository,
  encoding: "utf8",
}).trim();
if (branch !== "codex/ar-10a-feedback-led-visual-realization") throw new Error("Wrong branch");
for (const directory of [repository, root, resolve(output, "..")])
  if ((await realpath(directory)) !== directory) throw new Error("Symlinked task directory");
const paths = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { cwd: repository, encoding: "utf8" },
)
  .split("\0")
  .filter(
    (path) =>
      path &&
      (/^(src\/|public\/|patches\/|tests\/helpers\/|tests\/fixtures\/ar-10a\/|tests\/e2e\/storefront-(geometry|accessibility)\.ts$|tests\/acceptance\/ar-10a-visual-realization\.spec\.ts$)/.test(
        path,
      ) ||
        /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|next\.config\.[^/]+|postcss\.config\.mjs|tsconfig\.json|playwright\.ar-10a\.config\.ts|scripts\/ar-10a-review\.mjs|tests\/unit\/ar-10a-visual-realization\.test\.tsx)$/.test(
          path,
        )),
  );
async function freeze() {
  const records = [];
  for (const path of [...new Set([...paths, "node_modules/.modules.yaml"])].sort())
    records.push({ path, sha256: sha(await readFile(join(repository, path))) });
  return {
    records,
    sourceFingerprint: sha(JSON.stringify(records)),
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
  };
}
function processIds(args) {
  try {
    return execFileSync("lsof", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
  } catch (error) {
    if (error.status === 1 && !error.stdout?.length) return [];
    throw error;
  }
}
// Never start a second task server against the original checkout's output tree.
if (mode !== "production") {
  const rows = execFileSync("ps", ["-axo", "pid=,comm="], { encoding: "utf8" }).split("\n");
  for (const row of rows) {
    const match = /^\s*(\d+)\s+next-server/.exec(row);
    if (!match) continue;
    const cwd = execFileSync("lsof", ["-a", "-p", match[1], "-d", "cwd", "-Fn"], {
      encoding: "utf8",
    });
    if (cwd.split("\n").includes("n" + repository))
      throw new Error("Original-checkout server already active");
  }
  if (processIds(["-t", join(repository, ".next/dev/lock")]).length)
    throw new Error("Development output tree is already in use");
}
await mkdir(output, { mode: 0o700 });
const inputs = await freeze();
await record(join(output, "input-identity.json"), inputs);
const disk = await statfs(output);
const capacity = {
  availableBytes: disk.bavail * disk.bsize,
  existingDependenciesAdditionalBytes: 0,
  additionalServerOutputBytes: mode === "production" ? 0 : 3 * 1024 ** 3,
  additionalBrowserProfileCapturesBytes: mode === "production" ? 0 : 1024 ** 3,
  reserveBytes: 2 * 1024 ** 3,
  rationale:
    "Original installed dependencies, one sequential server and browser. Retained D browser estimate uses measured 894971904-byte dev output as a non-peak anchor, conservatively allows 3GiB fresh compilation/temp plus 1GiB profile/36 images. Production smoke uses already-built output without a browser. Reserve counted once; no export or later-build peak included.",
};
capacity.requirementBytes =
  capacity.additionalServerOutputBytes +
  capacity.additionalBrowserProfileCapturesBytes +
  capacity.reserveBytes;
await record(join(output, "capacity.json"), capacity);
if (capacity.availableBytes < capacity.requirementBytes)
  throw new Error("Insufficient capacity; no launch consumed");
async function port() {
  const server = createServer();
  await new Promise((yes, no) => {
    server.once("error", no);
    server.listen(0, "127.0.0.1", yes);
  });
  const value = server.address().port;
  await new Promise((yes) => server.close(yes));
  return value;
}
const serverPort = await port(),
  browserPort = await port(),
  origin = `http://localhost:${serverPort}`;
const token = randomBytes(32).toString("hex");
const environment = {
  ...process.env,
  NODE_ENV: mode === "production" ? "production" : "development",
  OPENAI_API_KEY: "",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
  VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: token,
  VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
  VESKIFY_AR06D_LIVE_REVIEW: "0",
  VESKIFY_AR10A_OFFLINE_REPLAY: "1",
};
for (const key of Object.keys(environment))
  if (/^VESKIFY_AR06D_(TASK_ROOT|SPEND_POLICY)/.test(key)) delete environment[key];
function logStream(stream, log, timedLog) {
  let pending = "";
  const redact = (value) =>
    value.replaceAll(token, "[redacted]").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
  stream.setEncoding("utf8");
  stream.on("data", (value) => {
    pending += value;
    let end;
    while ((end = pending.indexOf("\n")) >= 0) {
      const line = redact(pending.slice(0, end + 1));
      log.write(line);
      timedLog?.write(JSON.stringify({ at: new Date().toISOString(), line }) + "\n");
      pending = pending.slice(end + 1);
    }
  });
  stream.on("end", () => {
    if (pending) {
      const line = redact(pending);
      log.write(line);
      timedLog?.write(JSON.stringify({ at: new Date().toISOString(), line }) + "\n");
    }
  });
}
const serverLog = createWriteStream(join(output, "server.log"), { flags: "wx", mode: 0o600 });
const serverTimeline = createWriteStream(join(output, "server-timeline.jsonl"), {
  flags: "wx",
  mode: 0o600,
});
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    mode === "production" ? "start" : "dev",
    ...(mode === "production" ? [] : ["--webpack"]),
    "--hostname",
    "localhost",
    "--port",
    String(serverPort),
  ],
  { cwd: repository, env: environment, stdio: ["ignore", "pipe", "pipe"] },
);
logStream(server.stdout, serverLog, serverTimeline);
logStream(server.stderr, serverLog, serverTimeline);
const serverClosed = new Promise((yes) => server.once("close", yes));
const resourceSamples = [];
const sampleResources = () => {
  try {
    const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss=,%cpu=,comm="], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((line) => {
        const [pid, ppid, rssKiB, cpuPercent, ...command] = line.trim().split(/\s+/);
        return {
          pid: Number(pid),
          ppid: Number(ppid),
          rssKiB: Number(rssKiB),
          cpuPercent: Number(cpuPercent),
          command: command.join(" "),
        };
      });
    const owned = new Set([process.pid, server.pid]);
    for (let previous = -1; previous !== owned.size;) {
      previous = owned.size;
      for (const row of rows) if (owned.has(row.ppid)) owned.add(row.pid);
    }
    resourceSamples.push({
      at: new Date().toISOString(),
      load: loadavg(),
      freeMemoryBytes: freemem(),
      totalMemoryBytes: totalmem(),
      ownedProcesses: rows.filter((row) => owned.has(row.pid)),
    });
  } catch (error) {
    resourceSamples.push({ at: new Date().toISOString(), unavailable: String(error) });
  }
};
// Read-only samples of this invocation's process tree; no unrelated process
// command lines, environment, project paths or process-control actions.
let resourceInterval = ["diagnostic", "about-diagnostic", "full"].includes(mode)
  ? setInterval(sampleResources, 5000)
  : undefined;
if (resourceInterval) sampleResources();
await record(join(output, "session.json"), {
  mode,
  origin,
  pid: process.pid,
  serverPid: server.pid,
  startedAt: new Date().toISOString(),
  label: "Offline re-render of BATCH-18 generated candidate; no new generation",
});
let context,
  stopped = false;
async function stopResourceSamples(destination) {
  if (!resourceInterval) return;
  clearInterval(resourceInterval);
  resourceInterval = undefined;
  sampleResources();
  await record(destination, resourceSamples);
}
async function stop() {
  if (stopped) return;
  stopped = true;
  await stopResourceSamples(join(output, "resource-samples.json"));
  if (context) await context.close();
  if (server.exitCode === null) server.kill("SIGTERM");
  await serverClosed;
  await new Promise((yes) => serverLog.end(yes));
  await new Promise((yes) => serverTimeline.end(yes));
}
process.once("SIGTERM", async () => {
  await stop();
  process.exit();
});
try {
  const deadline = Date.now() + 120000;
  while (true) {
    if (server.exitCode !== null) throw new Error("Server exited before readiness");
    try {
      const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10000) });
      if (response.status !== 200) throw new Error(`Readiness status ${response.status}`);
      break;
    } catch (error) {
      if (!(error instanceof TypeError) || Date.now() >= deadline) throw error;
      await new Promise((yes) => setTimeout(yes, 200)); // connection refusal only, never retry a route failure
    }
  }
  if (mode === "production") {
    await record(join(output, "production-packaging.json"), await productionPackaging());
    const url = new URL("/projects/project_p10b16p04_aurum_commercial_acceptance", origin);
    url.searchParams.set(
      "p10b-16p-04-proposal",
      "v1_50184_0784a748aa03ccbb5e081601548c20c63070658d24a5e3fa5344ef6093da9061",
    );
    const response = await fetch(url, {
      headers: { "x-veskify-p10b-16p-04-acceptance-token": token },
      signal: AbortSignal.timeout(30000),
    });
    await record(join(output, "production-guard.json"), {
      status: response.status,
      flagEnabled: true,
      validTokenSupplied: true,
      fixtureExecution:
        "Not inferred from HTTP status; source guard and trace evidence separately required",
    });
    if (response.status !== 404) throw new Error("Production replay was not rejected");
  } else {
    if (mode === "full") {
      const apiOutput = join(output, "api-readiness");
      await mkdir(apiOutput);
      const apiCounters = join(root, "api-readiness-executions");
      await mkdir(apiCounters, { recursive: true });
      const apiAttempt =
        (await readdir(apiCounters)).filter((p) => /^attempt-\d{2}\.json$/.test(p)).length + 1;
      if (apiAttempt > 2) throw new Error("API-only readiness allowance exhausted");
      sampleResources();
      const owned = resourceSamples.at(-1)?.ownedProcesses;
      if (!owned) throw new Error("Task server process ownership unavailable");
      const listeners = processIds(["-nP", "-t", "-iTCP:" + serverPort, "-sTCP:LISTEN"]);
      const lockHolders = processIds(["-t", join(repository, ".next/dev/lock")]);
      if (
        listeners.length !== 1 ||
        !owned.some((row) => row.pid === listeners[0]) ||
        !lockHolders.includes(listeners[0]) ||
        lockHolders.some((pid) => !owned.some((row) => row.pid === pid))
      )
        throw new Error("Server port/output tree ownership mismatch");
      const cwd = execFileSync("lsof", ["-a", "-p", String(listeners[0]), "-d", "cwd", "-Fn"], {
        encoding: "utf8",
      });
      if (
        !cwd.split("\n").includes("n" + repository) ||
        (await realpath(join(repository, ".next/dev"))) !== join(repository, ".next/dev")
      )
        throw new Error("Server workspace/output path mismatch");
      const serverIdentity = {
        runnerPid: process.pid,
        serverPid: server.pid,
        listenerPid: listeners[0],
        origin,
        workspace: repository,
        outputTree: join(repository, ".next/dev"),
        sourceFingerprint: inputs.sourceFingerprint,
      };
      await record(join(apiOutput, "server-identity.json"), serverIdentity);
      const apiEnv = {
        ...process.env,
        AR10A_MODE: "api-readiness",
        AR10A_OUTPUT_DIR: apiOutput,
        AR10A_ORIGIN: origin,
        AR10A_ACCEPTANCE_TOKEN: token,
      };
      for (const key of Object.keys(apiEnv))
        if (/^OPENAI_|^VESKIFY_|^AR10A_CDP_URL$/.test(key)) delete apiEnv[key];
      const apiArgv = [
        "exec",
        "playwright",
        "test",
        "--config",
        "playwright.ar-10a.config.ts",
        "--grep",
        "prepares the protected inspection endpoint without Chromium",
      ];
      await record(join(apiCounters, "attempt-" + String(apiAttempt).padStart(2, "0") + ".json"), {
        attempt: apiAttempt,
        output: apiOutput,
        startedAt: new Date().toISOString(),
        argv: ["pnpm", ...apiArgv],
        serverIdentity,
        browserLaunched: false,
      });
      const apiLog = createWriteStream(join(apiOutput, "check.log"), { flags: "wx", mode: 0o600 });
      let apiCode;
      try {
        const check = spawn("pnpm", apiArgv, {
          cwd: repository,
          env: apiEnv,
          stdio: ["ignore", "pipe", "pipe"],
        });
        logStream(check.stdout, apiLog);
        logStream(check.stderr, apiLog);
        apiCode = await new Promise((yes, no) => {
          check.once("error", no);
          check.once("close", (code) => yes(code ?? 1));
        });
      } finally {
        await new Promise((yes) => apiLog.end(yes));
        await record(join(apiOutput, "resource-samples.json"), resourceSamples);
        await record(join(apiOutput, "execution-result.json"), {
          exitCode: apiCode ?? null,
          completedAt: new Date().toISOString(),
          browserLaunched: false,
        });
      }
      if (apiCode !== 0) throw new Error("Protected API readiness failed; Chromium not launched");
      const proof = JSON.parse(await readFile(join(apiOutput, "api-readiness.json"), "utf8"));
      const current = await freeze();
      const currentListeners = processIds(["-nP", "-t", "-iTCP:" + serverPort, "-sTCP:LISTEN"]);
      if (
        !proof.passed ||
        proof.browserLaunched !== false ||
        server.exitCode !== null ||
        current.sourceFingerprint !== inputs.sourceFingerprint ||
        JSON.stringify(currentListeners) !== JSON.stringify(listeners)
      )
        throw new Error("Prepared server/input identity changed before browser handoff");
      await record(join(output, "prepared-server-handoff.json"), {
        ...serverIdentity,
        apiAttempt,
        preparedAt: new Date().toISOString(),
        sameServer: true,
        label:
          "Prepared-development-server visual proof; API readiness is not candidate identity, cold-start acceptance or a proven cause of the prior stall.",
      });
    }
    const counters = join(root, "browser-executions");
    await mkdir(counters, { recursive: true });
    const invocation =
      (await readdir(counters)).filter((p) => /^attempt-\d{2}\.json$/.test(p)).length + 1;
    if (invocation > 12) throw new Error("Browser allowance exhausted");
    await record(join(counters, `attempt-${String(invocation).padStart(2, "0")}.json`), {
      invocation,
      mode,
      output,
      sourceFingerprint: inputs.sourceFingerprint,
      reservedAt: new Date().toISOString(),
    });
    context = await chromium.launchPersistentContext(join(output, "browser-profile"), {
      headless: process.env.AR10A_KEEP_OPEN !== "1",
      args: [`--remote-debugging-port=${browserPort}`, "--remote-debugging-address=127.0.0.1"],
      viewport: { width: 1440, height: 1000 },
    });
    // The runner outlives the test worker. Keep owner navigation authorized only
    // on this owned loopback origin; never attach the token to external requests.
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        url.origin !== origin ||
        (!["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
          !(request.method() === "POST" && url.pathname === "/__nextjs_disable_dev_indicator"))
      ) {
        await route.abort("blockedbyclient");
        return;
      }
      const headers = Object.fromEntries(
        Object.entries(request.headers()).filter(
          ([key]) => key.toLowerCase() !== "x-veskify-p10b-16p-04-acceptance-token",
        ),
      );
      await route.continue({
        headers: { ...headers, "x-veskify-p10b-16p-04-acceptance-token": token },
      });
    });
    const browserEnv = {
      ...process.env,
      AR10A_MODE: mode,
      AR10A_OUTPUT_DIR: output,
      AR10A_ORIGIN: origin,
      AR10A_CDP_URL: `http://127.0.0.1:${browserPort}`,
      AR10A_ACCEPTANCE_TOKEN: token,
      AR10A_SOURCE_FINGERPRINT: inputs.sourceFingerprint,
      AR10A_SERVER_PREPARATION:
        mode === "full" ? "protected API prepared on same server" : "unprepared",
    };
    for (const key of Object.keys(browserEnv))
      if (/^OPENAI_|^VESKIFY_/.test(key)) delete browserEnv[key];
    const log = createWriteStream(join(output, "browser.log"), { flags: "wx", mode: 0o600 });
    const check = spawn(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        "--config",
        "playwright.ar-10a.config.ts",
        "--grep",
        "re-renders the pinned genuine candidate without generation or persistence",
      ],
      { cwd: repository, env: browserEnv, stdio: ["ignore", "pipe", "pipe"] },
    );
    logStream(check.stdout, log);
    logStream(check.stderr, log);
    let code = await new Promise((yes, no) => {
      check.once("error", no);
      check.once("close", (code) => yes(code ?? 1));
    });
    await new Promise((yes) => log.end(yes));
    if (code === 0 && mode === "full" && process.env.AR10A_KEEP_OPEN === "1") {
      // Validate actual owner navigation after the worker has exited, not merely
      // the last document it left open. This remains part of this invocation.
      const ownerPage = context.pages().find((page) => page.url().startsWith(origin));
      try {
        if (!ownerPage) throw new Error("Owner review page missing");
        const url = new URL("/projects/project_p10b16p04_aurum_commercial_acceptance", origin);
        url.searchParams.set(
          "p10b-16p-04-proposal",
          "v1_50184_0784a748aa03ccbb5e081601548c20c63070658d24a5e3fa5344ef6093da9061",
        );
        url.searchParams.set("locale", "en");
        const response = await ownerPage.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        if (response?.status() !== 200) throw new Error("Owner navigation rejected");
        await ownerPage.locator(".project-preview__storefront").waitFor({
          state: "visible",
          timeout: 30000,
        });
        await record(join(output, "owner-navigation.json"), {
          afterTestWorkerExit: true,
          status: response.status(),
          path: url.pathname,
          locale: "en",
          candidateFingerprint: url.searchParams.get("p10b-16p-04-proposal"),
          authorityLifetime: "Retained runner context; owned-origin read-only requests only",
        });
      } catch (error) {
        code = 1;
        await record(join(output, "owner-navigation-failure.json"), {
          afterTestWorkerExit: true,
          error: String(error).replaceAll(token, "[redacted]"),
        });
      }
    }
    await record(join(output, "browser-result.json"), {
      exitCode: code,
      invocation,
      completedAt: new Date().toISOString(),
    });
    await stopResourceSamples(join(output, "resource-samples.json"));
    process.exitCode = code;
  }
  const after = await freeze();
  await record(join(output, "inputs-after.json"), after);
  if (after.sourceFingerprint !== inputs.sourceFingerprint)
    throw new Error("Reviewed inputs changed during execution");
  if (process.env.AR10A_KEEP_OPEN === "1" && mode === "full" && !process.exitCode)
    console.log(
      JSON.stringify({
        output,
        origin,
        retainedForOwner: true,
        label: "Offline re-render of BATCH-18 generated candidate",
      }),
    );
  else await stop();
} catch (error) {
  await stop();
  throw error;
}
