#!/usr/bin/env node

import { GovernanceError, fail } from "./lib/task-governance/errors.js";
import {
  createContractReport,
  createIdentityReport,
  createVerificationReport,
  loadAndValidateContract,
  loadVerifierVerdict,
} from "./lib/task-governance/index.js";
import { emitReport } from "./lib/task-governance/report.js";

const parseArguments = (argv) => {
  const values = argv.filter((value) => value !== "--");
  const command = values.shift();
  if (!["contract", "identity", "verify"].includes(command)) {
    fail("usage", "Expected command contract, identity or verify.", { exitCode: 64 });
  }
  const options = {};
  while (values.length > 0) {
    const key = values.shift();
    if (!["--contract", "--expected-file-sha256", "--verdict", "--output"].includes(key)) {
      fail("usage", `Unknown option ${key ?? "<missing>"}.`, { exitCode: 64 });
    }
    const value = values.shift();
    if (!value || value.startsWith("--"))
      fail("usage", `Missing value for ${key}.`, { exitCode: 64 });
    if (Object.hasOwn(options, key)) fail("usage", `Duplicate option ${key}.`, { exitCode: 64 });
    options[key] = value;
  }
  if (!options["--contract"] || !options["--expected-file-sha256"]) {
    fail("usage", "--contract and --expected-file-sha256 are required.", { exitCode: 64 });
  }
  if (command === "verify" && !options["--verdict"]) {
    fail("usage", "verify requires --verdict.", { exitCode: 64 });
  }
  if (command !== "verify" && options["--verdict"]) {
    fail("usage", "--verdict is valid only for verify.", { exitCode: 64 });
  }
  return { command, options };
};

let outputPath;
let command = "unknown";
try {
  const parsed = parseArguments(process.argv.slice(2));
  command = parsed.command;
  outputPath = parsed.options["--output"];
  const contractRecord = loadAndValidateContract({
    contractPath: parsed.options["--contract"],
    expectedFileSha256: parsed.options["--expected-file-sha256"],
  });
  const report =
    command === "contract"
      ? createContractReport(contractRecord)
      : command === "identity"
        ? createIdentityReport(contractRecord)
        : createVerificationReport(
            contractRecord,
            loadVerifierVerdict(parsed.options["--verdict"]),
          );
  emitReport(report, outputPath);
  process.exitCode = report.result === "PASS" ? 0 : report.result === "BLOCKED" ? 2 : 1;
} catch (error) {
  const safeError =
    error instanceof GovernanceError
      ? error
      : new GovernanceError("internal-error", "Unexpected governance verifier failure.");
  const report = {
    schemaVersion: "1.0.0",
    command,
    result: safeError.exitCode === 2 ? "BLOCKED" : "FAIL",
    error: {
      code: safeError.code,
      message: safeError.message,
      details: safeError.details,
    },
  };
  try {
    emitReport(report, outputPath);
  } catch {
    process.stderr.write("task-governance: output-error: Unable to write bounded report.\n");
  }
  process.stderr.write(`task-governance: ${safeError.code}: ${safeError.message}\n`);
  process.exitCode = safeError.exitCode;
}
