import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_ID_SET,
  extractAuthoritativeRequirementDefinitions,
  extractRequirementIds,
} from "./documentation-validation-helpers.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdd = readFileSync(join(repositoryRoot, "docs", "VESKIFY_SDD.md"), "utf8").replaceAll(
  "\r\n",
  "\n",
);
const definitions = extractAuthoritativeRequirementDefinitions(sdd);
const failures = [];

for (const identifier of EXPECTED_REQUIREMENT_ID_SET) {
  const count = definitions.get(identifier) ?? 0;
  if (count !== 1)
    failures.push(`${identifier}: expected one authoritative definition, found ${count}`);
}
for (const identifier of definitions.keys()) {
  if (!EXPECTED_REQUIREMENT_ID_SET.has(identifier)) {
    failures.push(`${identifier}: unexpected authoritative definition`);
  }
}

const collectMarkdownFiles = (relativeDirectory) =>
  readdirSync(join(repositoryRoot, relativeDirectory), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return collectMarkdownFiles(relativePath);
      return entry.isFile() && entry.name.endsWith(".md") ? [relativePath] : [];
    });

const referenceFiles = ["README.md", "AGENTS.md", ...collectMarkdownFiles("docs")];
const dangling = [];
for (const relativePath of referenceFiles) {
  const markdown = readFileSync(join(repositoryRoot, relativePath), "utf8");
  for (const identifier of extractRequirementIds(markdown)) {
    if (Number.parseInt(identifier.split("-")[1], 10) < 101) continue;
    if (!definitions.has(identifier)) dangling.push(`${relativePath}:${identifier}`);
  }
}
failures.push(...dangling.map((reference) => `dangling retained reference ${reference}`));

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Requirement traceability passed (FR ${EXPECTED_REQUIREMENT_IDS.functional.length}, NFR ${EXPECTED_REQUIREMENT_IDS.nonFunctional.length}, AC ${EXPECTED_REQUIREMENT_IDS.acceptance.length}, dangling 0).\n`,
  );
}
