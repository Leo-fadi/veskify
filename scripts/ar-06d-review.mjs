import { createHash, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createServer, createConnection } from "node:net";
import { mkdir, readFile, writeFile, lstat, realpath, statfs, readdir } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repository = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = resolve(repository, "../veskify-batch-runs/BATCH-18/AR-06D");
const [mode, outputOption, outputArgument] = process.argv.slice(2);
if (!["mock", "live", "inspect"].includes(mode) || outputOption !== "--output" || !outputArgument) {
  throw new Error(
    "Usage: node scripts/ar-06d-review.mjs mock|live|inspect --output <new persistent directory>",
  );
}
const output = resolve(outputArgument);
const child = relative(root, output);
if (!child || child.startsWith("..") || isAbsolute(child))
  throw new Error("Output must be inside the assigned AR-06D root");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const json = async (path, value) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
const socketPath = join(root, "live-review.sock");

async function plainDirectory(path) {
  if ((await realpath(path)) !== path || !(await lstat(path)).isDirectory())
    throw new Error("Directory must not traverse symlinks");
}
async function freezeInputs() {
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repository, encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (path) =>
        path &&
        (/^(src\/|public\/|patches\/|tests\/helpers\/|tests\/e2e\/storefront-(geometry|accessibility)\.ts$|tests\/acceptance\/ar-06d-generated-storefront-review\.spec\.ts$)/.test(
          path,
        ) ||
          /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|next\.config\.[^/]+|postcss\.config\.mjs|tsconfig\.json|playwright\.ar-06d\.config\.ts|scripts\/ar-06d-review\.mjs)$/.test(
            path,
          )),
    );
  const records = [];
  for (const path of [...new Set(files)].sort())
    records.push({ path, sha256: sha(await readFile(join(repository, path))) });
  records.push({
    path: "node_modules/.modules.yaml",
    sha256: sha(await readFile(join(repository, "node_modules/.modules.yaml"))),
  });
  return {
    records,
    sourceFingerprint: sha(JSON.stringify(records)),
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
  };
}
async function freePort() {
  const server = createServer();
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const port = server.address().port;
  await new Promise((accept) => server.close(accept));
  return port;
}
function sanitizedLog(stream, log, token) {
  let pending = "";
  stream.setEncoding("utf8");
  const redact = (value) =>
    value.replaceAll(token, "[redacted]").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
  stream.on("data", (chunk) => {
    pending += chunk;
    let newline;
    while ((newline = pending.indexOf("\n")) >= 0) {
      log.write(redact(pending.slice(0, newline + 1)));
      pending = pending.slice(newline + 1);
    }
  });
  stream.on("end", () => {
    if (pending) log.write(redact(pending));
  });
}
async function runCheck(environment, directory) {
  const log = await import("node:fs").then(({ createWriteStream }) =>
    createWriteStream(join(directory, "browser.log"), { flags: "wx", mode: 0o600 }),
  );
  const child = spawn(
    "pnpm",
    ["exec", "playwright", "test", "--config", "playwright.ar-06d.config.ts"],
    {
      cwd: repository,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  sanitizedLog(child.stdout, log, environment.AR06D_ACCEPTANCE_TOKEN);
  sanitizedLog(child.stderr, log, environment.AR06D_ACCEPTANCE_TOKEN);
  const code = await new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("close", (code) => accept(code ?? 1));
  });
  await new Promise((accept) => log.end(accept));
  await json(join(directory, "browser-result.json"), {
    exitCode: code,
    completedAt: new Date().toISOString(),
  });
  return code;
}
async function reserveBrowser(directory, identity) {
  const counters = join(root, "browser-executions");
  await mkdir(counters, { recursive: true });
  await plainDirectory(counters);
  const entries = (await readdir(counters)).filter((name) => /^attempt-\d{2}\.json$/.test(name));
  const number = entries.length + 1;
  if (number > 10) throw new Error("Browser invocation allowance exhausted");
  await json(join(counters, `attempt-${String(number).padStart(2, "0")}.json`), {
    invocation: number,
    mode,
    output: directory,
    reservedAt: new Date().toISOString(),
    ...identity,
  });
}

await plainDirectory(root);
if (mode === "inspect") {
  // The live owner process supplies its in-memory authorization; no secret is stored or returned.
  const client = createConnection(socketPath);
  client.on("connect", () => client.write(`${JSON.stringify({ action: "inspect", output })}\n`));
  client.on("data", (data) => {
    const result = JSON.parse(data.toString());
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
    client.end();
  });
  client.on("error", () => {
    console.error("The original live review session is unavailable; do not regenerate.");
    process.exitCode = 1;
  });
} else {
  await plainDirectory(repository);
  const actualBranch = execFileSync("git", ["branch", "--show-current"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  if (actualBranch !== "codex/ar-06d-generated-storefront-review")
    throw new Error("Unexpected task branch");
  const inputs = await freezeInputs();
  let policySha256;
  if (mode === "live") {
    if (output !== join(root, "live-01")) throw new Error("Only one live output is authorized");
    const readiness = JSON.parse(
      await readFile(join(root, "independent-readiness-03/READY.json"), "utf8"),
    );
    if (
      readiness.status !== "READY_FOR_LIVE" ||
      readiness.sourceFingerprint !== inputs.sourceFingerprint
    )
      throw new Error("Matching independent live readiness is required");
    const policyBytes = await readFile(join(root, "spend-policy-01/policy.json"));
    policySha256 = sha(policyBytes);
    if (readiness.policySha256 !== policySha256) throw new Error("Unreviewed spending policy");
  }
  await plainDirectory(resolve(output, ".."));
  await mkdir(output, { mode: 0o700 });
  await json(join(output, "input-identity.json"), inputs);
  const disk = await statfs(output);
  const capacity = {
    availableBytes: disk.bavail * disk.bsize,
    additionalDevelopmentOutputBytes: 3 * 1024 ** 3,
    additionalBrowserAndCaptureBytes: 1024 ** 3,
    reserveBytes: 2 * 1024 ** 3,
    existingDependenciesAdditionalBytes: 0,
    requirementBytes: 6 * 1024 ** 3,
    rationale:
      "Original installed dependencies; one sequential Next development server and one browser. No export or production build in this stage. The BATCH-17 expanded-generated-retirement-01/PLAN.json measured 894971904 allocated bytes of original-checkout development payload (not a peak measurement). A conservative 3 GiB additional server/output estimate and 1 GiB browser/profile/36-PNG estimate allow additional compilation and temporary allocations. Reserve counted once.",
  };
  await json(join(output, "capacity.json"), capacity);
  if (capacity.availableBytes < capacity.requirementBytes)
    throw new Error("Insufficient measured capacity for this browser stage");
  const port = await freePort();
  const browserPort = await freePort();
  // Match the existing P04 Next request-origin authority, including its server URL normalization.
  const origin = `http://localhost:${port}`;
  const token = randomBytes(32).toString("hex");
  const environment = {
    ...process.env,
    NODE_ENV: "development",
    VESKIFY_RUNTIME_MODE: "integrated",
    VESKIFY_AI_PROVIDER: "openai",
    VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
    VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: token,
    VESKIFY_P10B_16P_04_MOCK_TRANSPORT: mode === "mock" ? "1" : "0",
    VESKIFY_OPENAI_MODEL: "gpt-5.6-sol",
    VESKIFY_OPENAI_TIMEOUT_MS: "120000",
    VESKIFY_AR06D_LIVE_REVIEW: mode === "live" ? "1" : "0",
    VESKIFY_AR06D_TASK_ROOT: root,
    VESKIFY_AR06D_SPEND_POLICY_PATH: join(root, "spend-policy-01/policy.json"),
    VESKIFY_AR06D_SPEND_POLICY_SHA256: policySha256 ?? "",
  };
  if (mode === "mock") {
    environment.OPENAI_API_KEY = "";
    delete environment.VESKIFY_AR06D_TASK_ROOT;
    delete environment.VESKIFY_AR06D_SPEND_POLICY_PATH;
    delete environment.VESKIFY_AR06D_SPEND_POLICY_SHA256;
  }
  const { createWriteStream } = await import("node:fs");
  const serverLog = createWriteStream(join(output, "server.log"), { flags: "wx", mode: 0o600 });
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    {
      cwd: repository,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  sanitizedLog(server.stdout, serverLog, token);
  sanitizedLog(server.stderr, serverLog, token);
  const serverClosed = new Promise((accept) => server.once("close", accept));
  async function stopOwnedServer() {
    if (server.exitCode === null) server.kill("SIGTERM");
    await serverClosed;
    await new Promise((accept) => serverLog.end(accept));
  }
  await json(join(output, "session.json"), {
    pid: process.pid,
    serverPid: server.pid,
    origin,
    startedAt: new Date().toISOString(),
    mode,
  });
  let context;
  try {
    const deadline = Date.now() + 120000;
    while (true) {
      if (server.exitCode !== null) throw new Error("Owned Next server exited before readiness");
      try {
        const response = await fetch(`${origin}/api/demo/p10b-16p-04`, {
          headers: { "x-veskify-p10b-16p-04-acceptance-token": token },
          signal: AbortSignal.timeout(10000),
        });
        if (response.status === 200) break;
        throw new Error(`P04 readiness rejected: ${response.status}`);
      } catch (error) {
        // Readiness retries only refused connections; never poll a failing application response.
        if (!(error instanceof TypeError) || Date.now() >= deadline) throw error;
        await new Promise((accept) => setTimeout(accept, 200));
      }
    }
    await reserveBrowser(output, { sourceFingerprint: inputs.sourceFingerprint });
    context = await chromium.launchPersistentContext(join(output, "browser-profile"), {
      headless: mode === "mock",
      args: [`--remote-debugging-port=${browserPort}`, "--remote-debugging-address=127.0.0.1"],
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const headers = Object.fromEntries(
        Object.entries(request.headers()).filter(
          ([key]) => key.toLowerCase() !== "x-veskify-p10b-16p-04-acceptance-token",
        ),
      );
      if (
        /(^|\.)(openai\.com|vesko\.fi)$/.test(url.hostname) ||
        (url.origin === origin &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
          !(request.method() === "POST" && url.pathname === "/__nextjs_disable_dev_indicator"))
      ) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue({
        headers:
          url.origin === origin
            ? { ...headers, "x-veskify-p10b-16p-04-acceptance-token": token }
            : headers,
      });
    });
    const browserEnv = {
      ...process.env,
      AR06D_MODE: mode,
      AR06D_OUTPUT_DIR: output,
      AR06D_ORIGIN: origin,
      AR06D_CDP_URL: `http://127.0.0.1:${browserPort}`,
      AR06D_ACCEPTANCE_TOKEN: token,
      AR06D_SOURCE_FINGERPRINT: inputs.sourceFingerprint,
    };
    for (const name of Object.keys(browserEnv))
      if (/^OPENAI_|VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN$/.test(name))
        delete browserEnv[name];
    const code = await runCheck(browserEnv, output);
    if (mode === "mock") {
      process.exitCode = code;
      await context.close();
      context = undefined;
      await stopOwnedServer();
    } else {
      console.log(
        JSON.stringify({
          mode,
          exitCode: code,
          output,
          sessionRetained: true,
          origin,
          note: "Same server/browser must remain running; no regeneration.",
        }),
      );
      let inspecting = false;
      const ipc = createServer((client) => {
        client.once("data", async (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (
              message.action !== "inspect" ||
              message.output !== join(root, "independent-final-01/browser") ||
              inspecting
            )
              throw new Error();
            inspecting = true;
            const current = await freezeInputs();
            if (current.sourceFingerprint !== inputs.sourceFingerprint)
              throw new Error("Reviewed runtime inputs changed");
            await mkdir(message.output, { recursive: false });
            await json(join(message.output, "input-identity.json"), current);
            await reserveBrowser(message.output, {
              mode: "inspect",
              sourceFingerprint: current.sourceFingerprint,
              phase: "independent-view",
            });
            const exitCode = await runCheck(
              { ...browserEnv, AR06D_MODE: "inspect", AR06D_OUTPUT_DIR: message.output },
              message.output,
            );
            client.end(JSON.stringify({ exitCode }));
          } catch {
            client.end(
              JSON.stringify({
                exitCode: 1,
                error: "Inspection assignment or input identity rejected",
              }),
            );
          }
        });
      });
      ipc.listen(socketPath);
      process.once("SIGTERM", async () => {
        ipc.close();
        await context.close();
        await stopOwnedServer();
      });
    }
  } catch (error) {
    if (context) await context.close();
    await stopOwnedServer();
    throw error;
  }
}
