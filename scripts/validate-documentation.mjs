import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_ID_SET,
  extractAuthoritativeRequirementDefinitions,
  extractRequirementIds,
  hasStaleActiveP10AStatusClaim,
  isAffirmativeMerchantEditorP10AClaim,
} from "./documentation-validation-helpers.mjs";
import { extractMarkdownLinks, isSafeHyperlinkTarget } from "./markdown-docx-export.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activeMarkdownFiles = [
  "README.md",
  "AGENTS.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/CODEX_TASK_TEMPLATE.md",
  ".github/pull_request_template.md",
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
  "docs/P10A_PHASE_CLOSURE.md",
  "docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md",
  "docs/P10B_18_COMMERCIAL_QUALITY_AUDIT.md",
  "docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md",
  "docs/P10B_02_PARAMETRIC_BRAND_SYSTEM.md",
  "docs/P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md",
  "docs/P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md",
  "docs/P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md",
  "docs/P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md",
  "docs/P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md",
  "docs/P10B_12_CONTENT_AND_SUPPORT_PAGE_FAMILIES.md",
  "docs/P10B_11_COMMERCIAL_PDP_PROFILE_LIBRARY.md",
  "docs/P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md",
  "docs/P10B_14_PREMIUM_EDITORIAL_COMPLETE_STOREFRONT_VERTICAL_SLICE.md",
  "docs/P10B_15_BOUNDED_STOREFRONT_SYNTHESIS_AND_NARRATIVE_ENGINE.md",
  "docs/P10B_16_COORDINATED_DIRECTIONS_AND_DIVERSITY_CONTROL.md",
  "docs/P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md",
  "docs/P10B_16P_03_STUDIO_PROMPT_GENERATION_JOURNEY.md",
  "docs/P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md",
  "docs/VESKO_OPENAPI_CONTRACT_AUDIT.md",
  "docs/VESKO_VESKIFY_INTEGRATION_MATRIX.md",
  "docs/P10B_01_STOREFRONT_DESIGN_SYSTEM_CAPABILITY_AUDIT.md",
  "docs/COMMERCIAL_STOREFRONT_DESIGN_VOCABULARY_SPEC.md",
  "docs/COMMERCIAL_DESIGN_SYSTEM_ROADMAP_SYNCHRONIZATION.md",
  "docs/ADR-001-PUCK_EDITOR_FOUNDATION.md",
  "docs/adr/README.md",
  "docs/adr/ADR-002_CONTROLLED_DESIGN_AGENT.md",
  "docs/adr/ADR-003_URL_FIRST_DISCOVERY_AND_RECONCILIATION.md",
  "docs/adr/ADR-004_DYNAMIC_COMMERCE_BOUND_COMPONENTS.md",
  "docs/archive/README.md",
];
const failures = [];

const readRepositoryFile = (relativePath) =>
  readFileSync(join(repositoryRoot, relativePath), "utf8").replaceAll("\r\n", "\n");

const contents = new Map(
  activeMarkdownFiles.map((relativePath) => [relativePath, readRepositoryFile(relativePath)]),
);

const checkRelativeLinks = (relativePath, markdown) => {
  const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes("${")) {
      continue;
    }
    const withoutAnchor = target.split("#", 1)[0];
    if (!withoutAnchor) continue;
    const resolved = resolve(
      dirname(join(repositoryRoot, relativePath)),
      decodeURIComponent(withoutAnchor),
    );
    if (!existsSync(resolved)) {
      failures.push(`${relativePath}: missing relative link target ${target}`);
    }
  }
};

const collectMarkdownFiles = (relativeDirectory) =>
  readdirSync(join(repositoryRoot, relativeDirectory), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return collectMarkdownFiles(relativePath);
      return entry.isFile() && entry.name.endsWith(".md") ? [relativePath] : [];
    });

for (const [relativePath, markdown] of contents) checkRelativeLinks(relativePath, markdown);

const requireText = (relativePath, required) => {
  const markdown = contents.get(relativePath);
  for (const text of required) {
    if (!markdown.includes(text)) failures.push(`${relativePath}: missing required text: ${text}`);
  }
};

const requirePattern = (relativePath, required) => {
  const markdown = contents.get(relativePath);
  for (const pattern of required) {
    if (!pattern.test(markdown))
      failures.push(`${relativePath}: missing required pattern: ${String(pattern)}`);
  }
};

const rejectText = (relativePath, rejected) => {
  const markdown = contents.get(relativePath);
  for (const text of rejected) {
    if (markdown.includes(text)) failures.push(`${relativePath}: contains rejected text: ${text}`);
  }
};

const phaseOrder = [
  "P10A — Grounded orchestration and publishing closure",
  "P10B — Commercial Storefront Generation System v1",
  "P10C — Storefront Studio Editing Experience v1",
  "P10D — Advanced media and registered interactive presentation",
  "P11 — Vesko Integration Readiness and Reference Adapter",
  "P12 — Production hardening and pilot operations",
];

for (const relativePath of [
  "README.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
]) {
  const markdown = contents.get(relativePath);
  let previousIndex = -1;
  for (const phase of phaseOrder) {
    const index = markdown.indexOf(phase, previousIndex + 1);
    if (index < 0) failures.push(`${relativePath}: missing phase ${phase}`);
    if (index <= previousIndex) failures.push(`${relativePath}: invalid phase order at ${phase}`);
    previousIndex = index;
  }
}

requireText("README.md", [
  "The overall product is **Partial**. Phase 9 is closed by product-owner handoff",
  "P10A grounded\norchestration and publishing is **Baseline / closed**",
  "P10B Commercial Storefront Generation System\nv1 is **Partial / active**",
  "P10B-16P-05B repository/historical-authority cleanup are Baseline",
  "Parent P10B-18B is\nBaseline/complete",
  "P10B-18D is a Baseline diagnostic with live commercial quality rejected",
  "Canonical `/search` execution is Baseline",
  "P10B-19 PRE is Baseline",
  "DEVX-01A through DEVX-01G are Baseline, and DEVX-01 is Baseline / closed",
  "P10B-19A-01 = Baseline",
  "P10B-19A-02 = Baseline",
  "P10B-19A-03 = Baseline",
  "P10B-19A-04 = Baseline",
  "P10B-19A-05 = Baseline",
  "P10B-19A-06 = Baseline",
  "P10B-19A-07 = Baseline",
  "P10B-19A-08A = Baseline",
  "P10B-19A-08B = Baseline",
  "P10B-19A-08C = Baseline",
  "P10B-19A-08 = Baseline / closed",
  "P10B-19A-09A = Baseline",
  "P10B-19A-09B = Baseline",
  "P10B-19A-09C = Baseline",
  "P10B-19A-09 = Baseline / closed",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "legacy-v1:premium-editorial",
  "legacy-v1:modern-technical",
  "legacy-v1:minimal-commerce",
  "readable-unattributed",
  "disposition `none`",
  "canonical-read-defaults",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "36 of 36",
  "P10B-19A-09C composes the current publication compiler",
  "manual source authority",
  "transient historical-draft",
  "three direct compilations",
  "three preparations",
  "three\nisolated atomic publication confirmations",
  "active compiled-artifact and version integrity",
  "36 of 36 published renderer observations",
  "36 of 36 normalized Preview/published structural",
  "external-publication calls remain zero",
  "structural-storefront-deterministic-selection-request-v1_<canonical-length>_<sha256>",
  "structural-storefront-selected-complete-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-deterministic-selection-v1_<canonical-length>_<sha256>",
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "docs/VESKIFY_SDD_v1.3.0.docx",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx",
  "docs/VESKO_OPENAPI_CONTRACT_AUDIT.md",
  "docs/VESKO_VESKIFY_INTEGRATION_MATRIX.md",
  "No Vesko staging or production evidence\nexists.",
]);

requireText("AGENTS.md", [
  "**Version:** 1.3.0",
  "docs/VESKIFY_SDD_v1.3.0.docx",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "### 8.4 Contract-driven sprint protocol",
  "Commit\nand push only after an independent verifier `PASS`",
]);

requireText("docs/VESKIFY_SDD.md", [
  "# Veskify Software Design Document v1.3.0",
  "| Verified baseline         | 4 September 2026, P10B-19A-10B1 Positive Cross-Authority Integration Matrix |",
  "Phase 9 is closed by product-owner handoff",
  "P10A grounded\norchestration and publishing is **Baseline / closed**",
  "P10B is now **Partial / active**",
  "Merchant-facing wiring is not a\nP10A closure requirement",
  "P10B is the first phase allowed to claim a commercially credible\ngeneration system",
  "The Vesko OpenAPI 3.0 contract has been obtained and audited",
  "Raw Puck payloads",
  "There is no Vesko staging or production evidence",
  "VESKIFY_SDD_v1.3.0.docx",
  "archive/VESKIFY_SDD_v1.2.2.docx",
  "P10B-18C and P10B-16P-05B are Baseline",
  "P10B-16P-05B is Baseline",
  "parent P10B-18B is\nBaseline/complete",
  "P10B-18D diagnostic baseline; live quality rejected",
  "P10B-19 PRE = Baseline",
  "### 10.31 P10B-19A-01 structural family identity and lifecycle authority",
  "### 10.32 P10B-19A-02 cross-page structural relationship authority",
  "### 10.33 P10B-19A-03 required page structures, region graph and PageBlueprint v2 dispatch authority",
  "### 10.34 P10B-19A-04 PageBlueprint v2 asset-role compatibility authority",
  "### 10.35 P10B-19A-05 PageBlueprint v2 responsive-rule authority",
  "### 10.36 P10B-19A-06 PageBlueprint v2 omission, substitution and fallback authority",
  "### 10.37 P10B-19A-07 inactive family registry and candidate fingerprint authority",
  "### 10.38 P10B-19A-08A normalized topology identity authority",
  "### 10.39 P10B-19A-08B candidate compatibility contract and evaluation authority",
  "### 10.40 P10B-19A-08C scoring-free deterministic candidate-selection authority",
  "### 10.41 P10B-19A-09A opaque legacy-v1 replay alias and compatibility reference authority",
  "### 10.42 P10B-19A-09B historical v1 snapshot read and render replay authority",
  "### 10.43 P10B-19A-09C historical v1 publication replay authority",
  "### 10.44 P10B-19A-10A retained-matrix inventory and baseline lock",
  "P10B-19A-01 = Baseline",
  "P10B-19A-02 = Baseline",
  "P10B-19A-03 = Baseline",
  "P10B-19A-04 = Baseline",
  "P10B-19A-05 = Baseline",
  "P10B-19A-06 = Baseline",
  "P10B-19A-07 = Baseline",
  "P10B-19A-08A = Baseline",
  "P10B-19A-08B = Baseline",
  "P10B-19A-08C = Baseline",
  "P10B-19A-08 = Baseline / closed",
  "P10B-19A-09A = Baseline",
  "P10B-19A-09B = Baseline",
  "P10B-19A-09C = Baseline",
  "P10B-19A-09 = Baseline / closed",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "tests/fixtures/p10b-19a-10a-retained-matrix-inventory.v1.json",
  "Seventy-six canonical production-authority paths",
  "p10b-19a-retained-matrix-inventory-v1_32375_1b97e7da8eebdcda779b51b91b2f540263c97e9d2b40950b7f002721b6a5eb7d",
  "legacy-v1:premium-editorial",
  "legacy-v1:modern-technical",
  "legacy-v1:minimal-commerce",
  "validateDirectionSelectionNarrowing",
  "boundedStorefrontSynthesisExactSelectionSchema",
  "readable-unattributed",
  "readable-explicit-replay-binding",
  "disposition `none` or `canonical-read-defaults`",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "seven present persisted selection",
  "absent selection fields as unverified",
  "All 36 of 36 observation fingerprints match the frozen exact-base baseline",
  "legacy-v1-historical-publication-replay-v1_<canonical-length>_<sha256>",
  "truthful `manual` source authority",
  "detached transient aggregate projection",
  "Three direct A-09C compilations match\nthree deterministic `preparePublish` compilations exactly",
  "Exactly three isolated `confirmPublish` executions",
  "adds exactly one compiled-publication version",
  "All 36 of 36 published renderer observations",
  "All 36 of 36 normalized Preview/published structural",
  "external\npublication calls are zero",
  "structural-storefront-deterministic-selection-request-v1_<canonical-length>_<sha256>",
  "structural-storefront-selected-complete-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-deterministic-selection-v1_<canonical-length>_<sha256>",
  "P10B-19A-07 = Planned / exact next",
  "P10B-19A-06 = Planned / exact next",
  "P10B-19A-05 = Planned / exact next",
  "page-blueprint-v2-contract.ts",
  "page-blueprint-version-dispatch.ts",
  "page-blueprint-v2-asset-role-contract.ts",
  "page-blueprint-v2-responsive-rule-contract.ts",
  "page-blueprint-v2-omission-substitution-fallback-contract.ts",
  "page-blueprint-v2-candidate-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-candidate-v1_<canonical-length>_<sha256>",
  'PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION = "1.0.0"',
  'STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION = "1.0.0"',
  'INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION = "1.0.0"',
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "deterministic duplicate PageBlueprint-topology and family-\ntopology clusters",
  "structural-storefront-capability-context-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-compatibility-profile-v1_<canonical-length>_<sha256>",
  "structural-storefront-candidate-compatibility-evaluation-v1_<canonical-length>_<sha256>",
  "directly-compatible`, `substitution-compatible`, `omission-compatible` and\n`incompatible`",
  "directly-compatible`, `conditionally-compatible` and `incompatible`",
  "production PageBlueprint candidate count, family-candidate count, compatibility-profile count",
  "lifecycle state to\nremain `candidate`",
  "exactly one profile entry for each of the six ordered A-02\npage-family roles",
  "sole exported production registry value has exactly empty `pageBlueprintCandidates` and\n`familyCandidates` arrays",
  "fingerprints prove exact canonical content integrity; they are explicitly not normalized\ntopology identities",
  "assetRoleValues",
  "`logo`, `heroDesktop`, `heroMobile`",
  "`contractSchemaVersion`, `blueprintId`, `blueprintVersion`, and\n`regionAssetRequirements`",
  "minimum at least one; an optional role has minimum exactly zero",
  "structural default reading order followed by canonical role order",
  "current-generation asset-role-contract consumer count all remain zero",
  "current-generation responsive-rule-contract consumer count all remain zero",
  "`mobile` at 375 px, `tablet` at 768 px",
  "`desktop` at 1024 px, and\n`wide` at 1440 px",
  "`preserve`, `compress`, `expand`, and `full-width`",
  "`pairs-with` permits `preserve` or `stack`",
  "`offsets` permits `preserve` or\n`remove-offset`",
  "`required-asset-role-cardinality-unsatisfied`",
  "`omit-region` and `fail-closed`",
  "blueprintSubstitutionCandidates",
  "`contains` permits `preserve` or `flatten`",
  "`spans` permits `preserve` or\n`reduce-span`",
  "`anchors` permits `preserve` or `linearize`",
  "contractSchemaVersion",
  "`precedes`, `pairs-with`, `offsets`,\n`contains`, `spans`, and `anchors`",
  "home`, `collection`, `search`, `product-detail`, `content-support`, and `utility",
  "frame-continuity`, `navigation-continuity",
  "Active family-record count, candidate\nregistry-record count, persisted relationship count, production-selected relationship count and\ncurrent-generation consumer count all remain zero",
  "editorial-offset",
  "restrained-gallery",
  "Active family-record count and candidate registry-record count both remain zero",
  "### 10.25 P10B-17 responsive, accessibility and performance closure",
  "### 10.20 P10B-16P-02B deterministic design-intent compiler",
  "### 10.22 P10B-16P-04 real Storefront Studio Design Intent acceptance",
  "### 10.23 P10B-16P-05A active production-path and compiler rationalisation",
  "### 10.29 P10B-16P-05B major repository and historical-authority cleanup",
]);

requireText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", [
  "| Baseline                    | 4 September 2026, P10B-19A-10B1 Positive Cross-Authority Integration Matrix",
]);

const currentSddStatus = contents.get("docs/VESKIFY_SDD.md");
if (
  currentSddStatus.indexOf(
    "### 10.42 P10B-19A-09B historical v1 snapshot read and render replay authority",
  ) <=
  currentSddStatus.indexOf(
    "### 10.41 P10B-19A-09A opaque legacy-v1 replay alias and compatibility reference authority",
  )
) {
  failures.push("docs/VESKIFY_SDD.md: P10B-19A-09B section must follow P10B-19A-09A");
}
if (
  currentSddStatus.indexOf("### 10.43 P10B-19A-09C historical v1 publication replay authority") <=
  currentSddStatus.indexOf(
    "### 10.42 P10B-19A-09B historical v1 snapshot read and render replay authority",
  )
) {
  failures.push("docs/VESKIFY_SDD.md: P10B-19A-09C section must follow P10B-19A-09B");
}
if (
  currentSddStatus.indexOf("### 10.44 P10B-19A-10A retained-matrix inventory and baseline lock") <=
  currentSddStatus.indexOf("### 10.43 P10B-19A-09C historical v1 publication replay authority")
) {
  failures.push("docs/VESKIFY_SDD.md: P10B-19A-10A section must follow P10B-19A-09C");
}
if (
  currentSddStatus.indexOf("### 10.45 P10B-19A-10B1 Positive Cross-Authority Integration Matrix") <=
  currentSddStatus.indexOf("### 10.44 P10B-19A-10A retained-matrix inventory and baseline lock")
) {
  failures.push("docs/VESKIFY_SDD.md: P10B-19A-10B1 section must follow P10B-19A-10A");
}

rejectText("docs/VESKIFY_SDD.md", [
  "24 August 2026, P10B-18D diagnostic complete; live commercial quality rejected",
  "P10B-19A is the exact next task",
  "P10B-19A = Planned / exact next",
  "P10B-19A next",
  "P10B-19A-05 is the exact next task",
]);

requireText("docs/VESKIFY_DEVELOPMENT_ROADMAP.md", [
  "**Active development phase:** P10B — Commercial Storefront Generation System v1 (**Partial**)",
  "4 September 2026, P10B-19A-10B1 Positive Cross-Authority Integration Matrix",
  "DEVX-01A through DEVX-01G are Baseline",
  "P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are **Baseline**",
  "P10B-19A-08 is **Baseline / closed**",
  "P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are Baseline",
  "parent P10B-19A-09 is **Baseline / closed**",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "P10B-19A-10A records the delivery-only A-10A/A-10B/A-10C decomposition",
  "### 1.1 DEVX-01 engineering-enablement sprint",
  "### 1.2 P10B-19A planned child sequence",
  "accepted P10B-18C and P10B-16P-05B are **Baseline**",
  "P10B-18D is complete only as a diagnostic baseline",
  "P10B-19 PRE is Baseline",
  "P10B-19A-08A establishes strict normalized PageBlueprint v2 and Structural Storefront Family",
  "P10B-19A-08B establishes schema-version `1.0.0` compatibility authority without selection",
  "P10B-19A-08C establishes strict schema-version `1.0.0` deterministic selection requests",
  "P10B-19A-09A establishes opaque legacy-v1 replay identity",
  "P10B-19A-09B establishes a strict read-only historical-v1 adapter",
  "P10B-19A-09C establishes bounded historical-v1 publication replay",
  "truthful `manual` source",
  "detached transient historical-draft projection",
  "three direct compilations, three preparations",
  "exactly three isolated atomic",
  "active compiled-artifact and added-version integrity",
  "36\nof 36 published renderer observations",
  "36 of 36 normalized Preview/published structural",
  "external-publication calls remain zero",
  "readable-unattributed",
  "normalization disposition `none`",
  "canonical-read-defaults",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "36 of 36",
  "legacy-v1:premium-editorial",
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "page-blueprint-v2-candidate-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-candidate-v1_<canonical-length>_<sha256>",
  "P10A owns internal governed initial/follow-up execution",
  "1 — Grammar",
  "2 — Parallel foundations",
  "5 — Early complete store",
  "7 — Deterministic closure",
  "8 — Historical cleanup",
  "9 — Live and intelligence",
  "The minimum pilot editor requires",
  "Full P10C exit requires",
  "P11-00 — Vesko OpenAPI audit",
]);

requireText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", [
  "## Overall phase checklist",
  "## P10A checklist",
  "## P10B checklist",
  "## P10C checklist",
  "## P11 checklist",
  "| ☑",
  "P11-00",
  "P10A_PHASE_CLOSURE.md",
  "100+ commercial quality and diversity gate",
  "Live AI commercial storefront acceptance",
  "Major repository and historical-authority cleanup",
]);

requireText("docs/P10A_PHASE_CLOSURE.md", [
  "**Status:** Baseline / closed",
  "**Formal exit verdict: Baseline / closed.**",
  "**Next active development phase:** P10B — Commercial Storefront Generation System v1 (**Planned**)",
  "**Provider calls during closure:** zero",
]);

requireText("docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md", [
  "P10B-16P-05B are **Baseline**",
  "P10B-18D is a **Baseline diagnostic with live commercial quality",
  "P10B-19 PRE structural design intelligence architecture lock",
  "**Phase:** P10B — Commercial Storefront Generation System v1",
  "Veskify owns storefront creation",
  "Vesko owns operational commerce truth",
  "BrandSystem\n  → PageBlueprint profile\n  → component family / meaningful variant\n  → bounded validated instance override",
  "At least four materially distinct complete frame systems",
  "At least six meaningful compositions",
  "at least five meaningful anatomies",
  "Homepage: at least six materially different registered profiles",
  "Collection/search: at least four profiles",
  "PDP: at least four profiles",
  "at least 100 complete bounded storefront configurations",
  "P10B-02 and P10B-03 were delivered in parallel after P10B-01 with disjoint ownership",
]);

requireText("docs/P10B_18_COMMERCIAL_QUALITY_AUDIT.md", [
  "P10B-18A and P10B-18B-01/06/02/03/04/05 are Baseline",
  "P10B-18C is Baseline",
  "P10B-16P-05B are Baseline",
  "P10B-18D is `Baseline diagnostic / live commercial quality rejected`",
  "P10B-19 PRE is Baseline. P10B-19A is the exact next task",
  "### 15.3 Accepted product-owner checkpoint crosswalk",
]);

requireText("docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md", [
  "# P10B-19 Structural Design Intelligence Architecture",
  "**Status:** Baseline - accepted architecture lock",
  "A candidate definition is not a registered family",
  "**Total child tasks:** 73",
  "## 21. Acceptance criteria",
  "Production implementation begins only with P10B-19A after this task merges",
]);

requireText("docs/P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md", [
  "**Parent status: Baseline.** P10B-16P-02A, P10B-16P-02B, P10B-16P-03, and P10B-16P-04 are",
  "Before a V2 provider response, Veskify may read and validate capability knowledge only",
  "registered presentation authority / executable runtime unavailable",
  "hard merchant constraints, ranked soft preferences, optional suggestions and explicit avoidance",
  "P10B-16P-04 subsequently completed separately authorized live Design",
  "Provider and Vesko call count for both parts is zero",
  "## 9. Deterministic compilation and canonical materialization",
]);

const lockedP10BTasks = [
  ["P10B-01", "Commercial design grammar and compatibility vocabulary"],
  ["P10B-02", "Parametric BrandSystem / Design DNA"],
  ["P10B-03", "Component anatomy and meaningful variant contract"],
  ["P10B-04", "Responsive image and art-direction authority"],
  ["P10B-05", "Veskify site-map and page-family authority"],
  ["P10B-06", "Commercial shared-frame families"],
  ["P10B-07", "Hero, editorial, campaign and proof families"],
  ["P10B-08", "Canonical product-card and merchandising family"],
  ["P10B-09", "Commercial homepage profile library"],
  ["P10B-10", "Commercial collection and search profiles"],
  ["P10B-11", "Commercial PDP profile library"],
  ["P10B-12", "Content and support page families"],
  ["P10B-13", "Commerce utility presentation pages"],
  ["P10B-14", "Premium Editorial complete-storefront vertical slice"],
  ["P10B-15", "Bounded storefront synthesis and narrative engine"],
  ["P10B-16", "Coordinated directions and diversity control"],
  ["P10B-17", "Responsive, accessibility and performance closure"],
  ["P10B-18", "Commercial quality and scale gate"],
];

for (const relativePath of [
  "docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
]) {
  const markdown = contents.get(relativePath);
  for (const [taskId, title] of lockedP10BTasks) {
    if (!markdown.includes(`${taskId} — ${title}`)) {
      failures.push(`${relativePath}: missing locked task ${taskId} — ${title}`);
    }
  }
}

requireText("docs/DEVELOPMENT_GUIDE.md", [
  "Phase 9 is\nclosed by product-owner handoff, and P10A is **Baseline / closed**",
  "P10B-18C, P10B-16P-05B and P10B-19 PRE are **Baseline**",
  "parent P10B-18B is **Baseline / complete**",
  "P10B-18 and P10B remain **Partial**",
  "P10B-18D is a **Baseline diagnostic with live commercial quality rejected**",
  "P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are **Baseline**",
  "P10B-19A-08 is **Baseline / closed**",
  "P10B-19A-09A, P10B-19A-09B and P10B-19A-09C are\n**Baseline**",
  "parent P10B-19A-09 is **Baseline / closed**",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "### Contract-driven sprint authority",
  "### Verification policy",
  "### P10B-19A planned micro-pull-request map",
  "### DEVX-01 engineering-enablement sprint",
  "explicitly approved the original ten-parent delivery sequence in the immutable\nDEVX-01A contract",
  "DEVX-01A through DEVX-01G are Baseline",
  "P10B-19A-01 = Baseline",
  "P10B-19A-02 = Baseline",
  "P10B-19A-03 = Baseline",
  "P10B-19A-04 = Baseline",
  "P10B-19A-05 = Baseline",
  "P10B-19A-06 = Baseline",
  "P10B-19A-07 = Baseline",
  "P10B-19A-08A = Baseline",
  "P10B-19A-08B = Baseline",
  "P10B-19A-08C = Baseline",
  "P10B-19A-08 = Baseline / closed",
  "P10B-19A-09A = Baseline",
  "P10B-19A-09B = Baseline",
  "P10B-19A-09C = Baseline",
  "P10B-19A-09 = Baseline / closed",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "P10B-19A-10 is delivered through three bounded children",
  "P10B-19A-08A owns only normalized topology identity",
  "P10B-19A-08B owns only compatibility contracts and deterministic evaluation",
  "P10B-19A-08C owns strict schema-version `1.0.0` deterministic selection requests",
  "P10B-19A-09A owns only opaque legacy-v1 alias and replay-reference authority",
  "P10B-19A-09B owns strict read-only historical-v1 snapshot validation",
  "P10B-19A-09C owns bounded historical-v1 publication replay",
  "truthful `manual` source",
  "detached transient projection",
  "three direct compilations, three\npreparations",
  "exactly three isolated atomic confirmations",
  "active compiled\nartifact and added publication version",
  "36 of 36 published renderer observations",
  "36\nof 36 normalized Preview/published structural observations",
  "external-publication calls remain zero",
  "readable-unattributed",
  "normalization disposition `none`",
  "canonical-read-defaults",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "36 of 36",
  "legacy-v1:premium-editorial",
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "Completed P10A capability includes governed initial and follow-up\nexecution",
  "merchant-facing routing, clarification, scope controls,\nand normal-editor execution belong to P10C",
  "P10D remains advanced media, P11 remains Vesko\nintegration readiness, and P12 remains production hardening",
]);

requirePattern("README.md", [
  /24\s+explicit gates, 76 task-base production-source hashes, nine zero-count v2 inactivity assertions/u,
]);
requirePattern("docs/VESKIFY_SDD.md", [
  /Twenty-four\s+explicit\s+matrix entries/u,
  /A-10A does not prove complete\s+cross-authority integration/u,
  /A-10B1 does not close A-10B or P10B-19A/u,
  /only A-10C may close P10B-19A and\s+move exact-next status to P10B-19B-01/u,
]);
requirePattern("docs/VESKIFY_DEVELOPMENT_ROADMAP.md", [
  /A-08,\s+A-09 and A-10 have bounded A\/B\/C delivery subchildren/u,
  /A-08A\/A-08B\/A-08C,\s+A-09A\/A-09B\/A-09C and A-10A\/A-10B\/A-10C rows, including\s+A-10B1\/A-10B2 beneath A-10B, are nested delivery-only decompositions/u,
  /accepted architecture remains the 73-child granular plan/iu,
]);
requirePattern("docs/DEVELOPMENT_GUIDE.md", [
  /A-08A\/A-08B\/A-08C,\s+A-09A\/A-09B\/A-09C and A-10A\/A-10B\/A-10C rows, including\s+A-10B1\/A-10B2 beneath A-10B, are nested delivery-only decompositions/u,
]);
requirePattern("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", [
  /accepted architecture remains the 73-child granular plan/iu,
  /A-08A\/A-08B\/A-08C,\s+A-09A\/A-09B\/A-09C and A-10A\/A-10B\/A-10C rows, including\s+A-10B1\/A-10B2 beneath A-10B, are nested delivery-only decompositions/u,
]);
requirePattern("docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", [/73-child architecture plan/u]);

for (const relativePath of [
  "README.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
]) {
  requirePattern(relativePath, [
    /eight\s+PageBlueprint\s+v2\s+candidates/iu,
    /six\s+primary\s+and\s+two\s+product-detail\s+fallback/iu,
    /six\s+(?:Structural\s+Storefront\s+Family|family)\s+candidates/iu,
    /six\s+compatibility profiles/iu,
    /three\s+capability contexts/iu,
    /three\s+(?:normalized\s+)?family-topology\s+groups\s+of\s+two\s+(?:exact\s+)?identities/iu,
    /two-hop\s+product-detail\s+substitution/iu,
    /optional\s+content\/support omission/iu,
    /six\s+family-constrained receipts/iu,
    /three\s+sequential\s+(?:pairwise\s+)?topology-distinct receipts/iu,
    /A-09\s+(?:coexistence|coexists)/iu,
    /(?:24|twenty-four)[\s\S]{0,80}?(?:entries|gates)[\s\S]{0,180}?76[\s\S]{0,80}?(?:hashes|production-source)/iu,
    /126\/72/iu,
    /(?:zero production|no production code|production files changed remain zero)/iu,
    /(?:no current-generation or client-runtime|no v2\s+production record,\s+current-generation reachability,\s+client-runtime reachability)/iu,
  ]);
}

for (const relativePath of [
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
]) {
  requireText(relativePath, [
    "P10B-19A-10B1 - Positive Cross-Authority Integration Matrix",
    "P10B-19A-10B2 - Fail-Closed Cross-Authority Failure Matrix and A-10B Closure",
  ]);
  requirePattern(relativePath, [
    /8\/6\/6\/3 candidate\/profile\/context authority/iu,
    /three\s+two-identity normalized topology groups/iu,
    /six\s+family-constrained receipts/iu,
    /three\s+sequential\s+topology-distinct\s+receipts/iu,
  ]);
}
requireText("docs/VESKIFY_DEVELOPMENT_ROADMAP.md", [
  "P10B-19A-10B1 - Positive Cross-Authority Integration Matrix",
  "P10B-19A-10B2 - Fail-Closed Cross-Authority Failure Matrix and A-10B Closure",
]);

requirePattern("docs/VESKIFY_SDD.md", [
  /A-10B is delivered through two dependency-ordered, delivery-only children[\s\S]{0,180}?accepted 73-child/iu,
]);
requirePattern("docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md", [
  /A-10B owns cross-authority integration through nested children\s+A-10B1 and A-10B2[\s\S]{0,240}?accepted 73-child architecture/iu,
]);
requirePattern("docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", [
  /A-10A\/A-10B\/A-10C, including A-10B1\/A-10B2 beneath A-10B, are nested delivery micro-PRs within accepted parent A-10/iu,
]);

requireText("docs/VESKIFY_SDD.md", [
  "### 10.45 P10B-19A-10B1 Positive Cross-Authority Integration Matrix",
  "p10b-19a-positive-cross-authority-integration-v1_23279_e195aad8126b74a9990d923a6ef08d82c637589919f362e8c5e90263092a002d",
  "907a4d48cab6dacd0bc46e0fb16d4eca2ca82c87d7f00b605ca53f3f112490f2",
  "2f181f551e7b44e5429f3b67cd4f381aaf98fcf996196af75d852e67b3d435ab",
]);
requireText("docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md", [
  "**Audit date:** 4 September 2026",
  "**Repository baseline:** P10B-19A-10B1 Positive Cross-Authority Integration Matrix",
  "p10b-19a-positive-cross-authority-integration-v1_23279_e195aad8126b74a9990d923a6ef08d82c637589919f362e8c5e90263092a002d",
  "907a4d48cab6dacd0bc46e0fb16d4eca2ca82c87d7f00b605ca53f3f112490f2",
  "2f181f551e7b44e5429f3b67cd4f381aaf98fcf996196af75d852e67b3d435ab",
]);
requireText("docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", [
  "**Audit date:** 4 September 2026",
  "**Repository baseline:** P10B-19A-10B1 Positive Cross-Authority Integration Matrix",
  "p10b-19a-positive-cross-authority-integration-v1_23279_e195aad8126b74a9990d923a6ef08d82c637589919f362e8c5e90263092a002d",
  "907a4d48cab6dacd0bc46e0fb16d4eca2ca82c87d7f00b605ca53f3f112490f2",
  "2f181f551e7b44e5429f3b67cd4f381aaf98fcf996196af75d852e67b3d435ab",
]);
for (const relativePath of [
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
]) {
  requirePattern(relativePath, [
    /P10B-19A-10B2\s+—\s+Fail-Closed\s+Cross-Authority\s+Failure\s+Matrix\s+and\s+A-10B\s+Closure/iu,
  ]);
}

for (const relativePath of [
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
]) {
  rejectText(relativePath, ["<BASELINE_FINGERPRINT>", "<FIXTURE_SHA256>", "<EXTERNAL_SHA256>"]);
  requireText(relativePath, [
    "Direct EN and direct FI each classify all eight PageBlueprint candidates and all six families as",
    "five PageBlueprints directly compatible, two\nsubstitution-compatible and one omission-compatible, with all six families conditionally",
    "tests/fixtures/p10b-19a-10b1-positive-cross-authority-integration.v1.json",
  ]);
}

const sddExporterSource = readRepositoryFile("scripts/export-sdd-docx.mjs");
for (const expected of [
  "Verified baseline: 4 September 2026",
  "P10B-19A-10B1 Positive Cross-Authority Integration Matrix",
]) {
  if (!sddExporterSource.includes(expected))
    failures.push(`scripts/export-sdd-docx.mjs: missing ${expected}`);
}
const trackerExporterSource = readRepositoryFile(
  "scripts/export-development-delivery-tracker-docx.mjs",
);
const trackerExporterBaseline =
  "Delivery status baseline: 4 September 2026, P10B-19A-10B1 Positive Cross-Authority Integration Matrix";
if (!trackerExporterSource.includes(trackerExporterBaseline))
  failures.push(
    `scripts/export-development-delivery-tracker-docx.mjs: missing ${trackerExporterBaseline}`,
  );

requireText("docs/CODEX_TASK_TEMPLATE.md", [
  "docs/governance/task-contract.template.v1.json",
  "## Immutable contract identity",
  "## Implementation approach decision",
  "## Scope budget",
  "Commit and push only after verifier `PASS`",
]);

requireText(".github/pull_request_template.md", [
  "## Immutable task contract",
  "## Independent verifier",
  "Exactly one automatic Codex GitHub review",
  "No rebase or force-push",
]);

requireText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", [
  "DEVX-01A - Sprint contract and independent verification protocol",
  "DEVX-01B - Mechanical contract and verifier-verdict enforcement",
  "DEVX-01C - CI timings, obsolete-run cancellation and Next build caching",
  "- [x] DEVX-01D - Parallel static, Vitest and production-build jobs",
  "- [x] DEVX-01E - Playwright timing inventory and balanced execution groups",
  "- [x] DEVX-01F - Playwright sharding/matrix, merged reports and stable required aggregator",
  "- [x] DEVX-01F2 - Contention-safe Vitest sharding",
  "- [x] DEVX-01G - Two-run performance acceptance and workflow closure",
  "DEVX-01 is Baseline / closed",
  "P10B-19A-01 = Baseline",
  "P10B-19A-02 = Baseline",
  "P10B-19A-03 = Baseline",
  "P10B-19A-04 = Baseline",
  "P10B-19A-05 = Baseline",
  "P10B-19A-06 = Baseline",
  "P10B-19A-07 = Baseline",
  "P10B-19A-08A = Baseline",
  "P10B-19A-08B = Baseline",
  "P10B-19A-08C = Baseline",
  "P10B-19A-08 = Baseline / closed",
  "P10B-19A-09A = Baseline",
  "P10B-19A-09B = Baseline",
  "P10B-19A-09C = Baseline",
  "P10B-19A-09 = Baseline / closed",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "P10B-19A-10A records the A-10A/A-10B/A-10C delivery decomposition",
  "P10B-19A-08A establishes strict normalized PageBlueprint v2 and Structural Storefront Family",
  "P10B-19A-08B establishes strict schema-version `1.0.0` compatibility contracts and deterministic",
  "P10B-19A-09A establishes one immutable populated registry for exactly",
  "P10B-19A-09B adds a strict read-only historical-v1 adapter",
  "P10B-19A-09C consumes the exact A-09B result and receipt",
  "truthful\n`manual` source authority",
  "detached transient draft",
  "three direct compilations, three preparations",
  "exactly three isolated atomic",
  "active compiled-artifact and added-version integrity",
  "36 of 36 published renderer observations",
  "36 of 36 normalized Preview/published",
  "external-publication calls are zero",
  "readable-unattributed",
  "normalization disposition `none`",
  "canonical-read-defaults",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "36 of 36",
  "legacy-v1:premium-editorial",
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "#### P10B-19A planned micro-pull-request map",
]);

for (const relativePath of [
  "README.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/DEVELOPMENT_GUIDE.md",
]) {
  rejectText(relativePath, [
    "P10B-19A-05 - Responsive-Rule Contract is the exact next implementation task",
    "P10B-19A-05 = exact next implementation task",
    "P10B-19A-06 - Omission, Substitution and Fallback Contract is the exact next implementation task",
    "P10B-19A-06 = exact next implementation task",
    "P10B-19A-07 - Inactive Family Registry and Candidate Fingerprints is the exact next implementation task",
    "P10B-19A-07 = exact next implementation task",
  ]);
}

rejectText("docs/DEVELOPMENT_GUIDE.md", [
  "DEVX-01D is the exact next engineering task",
  "DEVX-01G is the exact next engineering task",
]);
rejectText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", [
  "- [ ] DEVX-01D - Parallel static, Vitest and production-build jobs (**exact next engineering task**)",
  "- [ ] DEVX-01G - Two-run performance acceptance and workflow closure",
]);

requireText("docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md", [
  "P10B-18A is **Baseline**, accepted on 16 August 2026",
  "P10B-18B-01 is **Baseline**, accepted on 17 August 2026",
  "P10B-18B-06 is **Baseline**, accepted on 17 August 2026",
  "P10B-18B-05 closes bounded content/support/utility quality",
  "Parent P10B-18B is\n**Baseline / complete**; P10B-18C and P10B-16P-05B are **Baseline**",
  "P10B-18D is a Baseline diagnostic with live commercial quality rejected",
  "P10B-16P-05B is Baseline",
  "P10B-19 PRE is Baseline as an accepted architecture lock",
  "## P10B-19A-07 current-state baseline",
  "## P10B-19A-08A current-state baseline",
  "## P10B-19A-08B current-state baseline",
  "## P10B-19A-08C current-state baseline",
  "## P10B-19A-09A current-state baseline",
  "## P10B-19A-09B current-state baseline",
  "## P10B-19A-09C current-state baseline",
  "## P10B-19A-10A current-state baseline",
  "## P10B-19A-10B1 current-state baseline",
  "P10B-19A-01 through P10B-19A-07 and P10B-19A-08A through P10B-19A-08C are Baseline",
  "P10B-19A-08 is Baseline / closed",
  "P10B-19A-09A, P10B-19A-09B, P10B-19A-09C, P10B-19A-10A and P10B-19A-10B1 are Baseline",
  "parent P10B-19A-09 is Baseline / closed",
  "P10B-19A-10A = Baseline",
  "P10B-19A-10 = Partial",
  "P10B-19A-10B1 = Baseline",
  "P10B-19A-10B = Partial",
  "P10B-19A-10B2 = exact next implementation task",
  "P10B-19A-10C = Planned after P10B-19A-10B2",
  "P10B-19B-01 = Planned after P10B-19A-10C",
  "readable-unattributed",
  "readable-explicit-replay-binding",
  "normalization disposition is `none` or `canonical-read-defaults`",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "seven present persisted selection fields as verified",
  "seven absent selection fields",
  "36 of 36 bounded current-renderer observations",
  "truthful `manual` source authority",
  "detached transient aggregate projection",
  "exactly three isolated confirmations preserve atomic\npublication semantics",
  "All 36 of 36\npublished renderer observations",
  "all 36 of 36\nnormalized Preview/published structural observations",
  "external-publication calls are zero",
  "legacy-v1:premium-editorial",
  "page-blueprint-v2-candidate-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-candidate-v1_<canonical-length>_<sha256>",
  "PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION",
  "STRUCTURAL_STOREFRONT_FAMILY_NORMALIZED_TOPOLOGY_SCHEMA_VERSION",
  "INACTIVE_CANDIDATE_NORMALIZED_TOPOLOGY_INDEX_SCHEMA_VERSION",
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-capability-context-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-compatibility-profile-v1_<canonical-length>_<sha256>",
  "structural-storefront-candidate-compatibility-evaluation-v1_<canonical-length>_<sha256>",
]);

requireText("docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", [
  "P10B-18B-05 **Baseline / accepted 20 August 2026**",
  "P10B-18B **Baseline / complete** and P10B-18 **Partial**",
  "| P10B-18B-05 content/support/utility quality",
  "| P10B-18A commercial-authority audit",
  "| P10B-18B-01 Design DNA and shared frames",
  "## P10B-18B-06 accepted bounded-authority evidence",
  "## P10B-18B-02 accepted bounded homepage-quality evidence",
  "## P10B-18B-03 accepted bounded collection/search/card-quality evidence",
  "## P10B-18B-04 accepted evidence",
  "### P10B-18B-05 accepted evidence Baseline",
  "### P10B-18C durable deterministic commercial-quality evidence",
  "### P10B-16P-05B repository and historical-authority cleanup",
  "P10B-18D is a **Baseline diagnostic with live commercial quality rejected**",
  "Structural design intelligence architecture       | **Baseline**",
  "Structural Storefront Family / PageBlueprint v2   | **Partial**",
  "P10B-19A-01 through P10B-19A-07, P10B-19A-08A through P10B-19A-08C, P10B-19A-09A through P10B-19A-09C, P10B-19A-10A and P10B-19A-10B1 establish strict identities",
  "Retained matrix inventory and frozen baseline     | **Baseline**",
  "Positive Cross-Authority Integration Matrix       | **Baseline**",
  "P10B-19A-08A evidence is contract/schema plus deterministic unit proof",
  "P10B-19A-08B evidence is strict contract/schema plus deterministic adversarial unit proof",
  "P10B-19A-08C evidence is strict schema-version `1.0.0` contract/schema plus deterministic",
  "Opaque legacy-v1 replay alias/reference authority | **Baseline**",
  "P10B-19A-09A evidence is contract/schema plus deterministic adversarial unit proof",
  "Historical v1 snapshot read and render replay",
  "P10B-19A-09B evidence",
  "Historical v1 publication replay",
  "P10B-19A-09C evidence",
  "P10B-19A-10A evidence is one strict checked-in inventory",
  "and P10B-19A-10B1 are Baseline",
  "Parent P10B-19A-10B, P10B-19A-10 and P10B-19A remain Partial.",
  "P10B-19A-10B2 is Planned / exact\nnext",
  "p10b-19a-retained-matrix-inventory-v1_32375_1b97e7da8eebdcda779b51b91b2f540263c97e9d2b40950b7f002721b6a5eb7d",
  "readable-unattributed",
  "readable-explicit-replay-binding",
  "canonical-read-defaults",
  "legacy-v1-historical-snapshot-read-v1_<canonical-length>_<sha256>",
  "36 of 36",
  "truthful `manual` source authority",
  "detached transient historical-draft projection",
  "Exactly three isolated atomic confirmations add one\nversion",
  "All 36 of 36 published renderer observations",
  "all 36 of\n36 normalized Preview/published structural observations",
  "external-publication calls are zero",
  "legacy-v1:premium-editorial",
  "page-blueprint-v2-candidate-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-candidate-v1_<canonical-length>_<sha256>",
  "page-blueprint-v2-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-normalized-topology-v1_<canonical-length>_<sha256>",
  "structural-storefront-capability-context-v1_<canonical-length>_<sha256>",
  "structural-storefront-family-compatibility-profile-v1_<canonical-length>_<sha256>",
  "structural-storefront-candidate-compatibility-evaluation-v1_<canonical-length>_<sha256>",
]);

const tracker = contents.get("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
if ((tracker.match(/☑/g) ?? []).length !== 61) {
  failures.push("Delivery tracker must contain exactly sixty-one completed checkboxes");
}

const plannedP10bChecklistIds = [...tracker.matchAll(/^\| ☐\s+\| (P10B-\d{2})\s+\|/gm)].map(
  (match) => match[1],
);
const expectedPlannedP10bChecklistIds = lockedP10BTasks
  .map(([taskId]) => taskId)
  .filter(
    (taskId) =>
      ![
        "P10B-01",
        "P10B-02",
        "P10B-03",
        "P10B-04",
        "P10B-05",
        "P10B-06",
        "P10B-07",
        "P10B-08",
        "P10B-09",
        "P10B-10",
        "P10B-11",
        "P10B-12",
        "P10B-13",
        "P10B-14",
        "P10B-15",
        "P10B-16",
        "P10B-17",
      ].includes(taskId),
  );
if (
  !/^\| ☑\s+\| P10B-01\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-02\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-03\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-04\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-05\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-06\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-07\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-08\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-09\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-10\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-11\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-12\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-13\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-14\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-15\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-01\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-02\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-02A\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-02B\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-03\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-04\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-05A\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-06\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-17\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-18\s+\|[^\n]*\| \*\*Partial\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18A\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B-01\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B-06\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B-02\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B-03\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B-04\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18B-05\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18C\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-16P-05B\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-18D\s+\|[^\n]*\| \*\*Baseline diagnostic \/ quality rejected\*\*/m.test(
    tracker,
  ) ||
  !/^\| ☑\s+\| P10B-19 PRE\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19A\s+\|[^\n]*\| \*\*Partial\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-01\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-02\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-03\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-04\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-05\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-06\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-07\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-08\s+\|[^\n]*\| \*\*Baseline \/ closed\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-08A\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-08B\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-08C\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-09\s+\|[^\n]*\| \*\*Baseline \/ closed\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-09A\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-09B\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-09C\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19A-10\s+\|[^\n]*\| \*\*Partial\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-10A\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19A-10B\s+\|[^\n]*\| \*\*Partial\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-19A-10B1\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19A-10B2\s+\|[^\n]*\| \*\*Planned \/ exact next\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19A-10C\s+\|[^\n]*\| \*\*Planned\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19B-01\s+\|[^\n]*\| \*\*Planned\*\*/m.test(tracker) ||
  !/^\| ☐\s+\| P10B-19B-J\s+\|[^\n]*\| \*\*Planned\*\*/m.test(tracker) ||
  plannedP10bChecklistIds.length !== expectedPlannedP10bChecklistIds.length ||
  plannedP10bChecklistIds.some((taskId, index) => taskId !== expectedPlannedP10bChecklistIds[index])
) {
  failures.push(
    "Delivery tracker must preserve accepted Baselines through A-10A, mark A-10B1 Baseline, keep A-10B/A-10/P10B-19A Partial, make A-10B2 Planned / exact next, and keep A-10C/P10B-19B-01/P10B-19B-J Planned",
  );
}

if (
  !/^\| Baseline\s+\| P10B-19A-07\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-08\s+\| \*\*Baseline \/ closed\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-08A\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-08B\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-08C\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-09\s+\| \*\*Baseline \/ closed\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-09A\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-09B\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-09C\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Current\s+\| P10B-19A-10\s+\| \*\*Partial\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-10A\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Current\s+\| P10B-19A-10B\s+\| \*\*Partial\*\*/m.test(tracker) ||
  !/^\| Baseline\s+\| P10B-19A-10B1\s+\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| Next\s+\| P10B-19A-10B2\s+\| \*\*Planned \/ exact next\*\*/m.test(tracker) ||
  !/^\| Planned\s+\| P10B-19A-10C\s+\| \*\*Planned\*\*/m.test(tracker) ||
  !/^\| Planned\s+\| P10B-19B-01\s+\| \*\*Planned\*\*/m.test(tracker)
) {
  failures.push(
    "Delivery tracker current-state table must preserve accepted Baselines through A-10A, mark A-10B1 Baseline, keep A-10B/A-10 Partial, make A-10B2 Planned / exact next and keep A-10C/P10B-19B-01 Planned",
  );
}

if (
  !/^\| ☑\s+\| P10B-19A-10B1\s+\| Positive Cross-Authority Integration Matrix\s+\| \*\*Baseline\*\*[^\n]*\| P10B-19A-10A merged\s+\|[^\n]*8 PageBlueprint candidates; 6 family candidates; 6 profiles; 3 contexts; 3 topology groups × 2 identities; 6 direct and 3 sequential receipts; A-09\/A-10A unchanged; zero production/m.test(
    tracker,
  ) ||
  !/^\| ☐\s+\| P10B-19A-10B2\s+\| Fail-Closed Cross-Authority Failure Matrix and A-10B Closure\s+\| \*\*Planned \/ exact next\*\*[^\n]*\| P10B-19A-10B1 merged\s+\|/m.test(
    tracker,
  ) ||
  !/^\| ☐\s+\| P10B-19A-10C\s+\|[^\n]*\| \*\*Planned\*\*[^\n]*\| P10B-19A-10B2 merged\s+\|/m.test(
    tracker,
  ) ||
  !/^\| Baseline\s+\| P10B-19A-10B1\s+\| \*\*Baseline\*\*\s+\| Exact fixed-count positive matrix; A-09\/A-10A unchanged; zero production\s+\|/m.test(
    tracker,
  ) ||
  !/^\| Next\s+\| P10B-19A-10B2\s+\| \*\*Planned \/ exact next\*\*\s+\| Fail-closed cross-authority failure matrix and parent A-10B closure\s+\|/m.test(
    tracker,
  )
) {
  failures.push("Delivery tracker must retain exact A-10B1/A-10B2 dependency and evidence rows");
}

requireText("docs/P10B_16P_03_STUDIO_PROMPT_GENERATION_JOURNEY.md", [
  "**Status:** Baseline",
  "one registered structural operation with exact target permission and P02B source-proposal/lineage",
  "integrated request without injected authenticated tenant/project-backed current authority fails\nclosed before provider selection",
  "No real Design Intent V2 provider call occurred in P10B-16P-03 itself. Search execution remains\nunavailable",
  "P10B-16P-04 are\n**Baseline**. P10B remains **Partial**. P10B-17 and P10B-18 remain **Planned**",
]);

requireText("docs/P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md", [
  "**Status:** Baseline",
  "The complete P10B-16P-04 investigation and acceptance ledger contains **16 real OpenAI calls**",
  "Cumulative retries and fallbacks were\nzero. No Vesko call or publication occurred.",
  "## 7. P10B-16P-05B cleanup disposition",
  "## 8. Lean live-AI acceptance seam retained for P10B-18D",
  "Production always fails closed",
]);

requireText("docs/P10B_16_COORDINATED_DIRECTIONS_AND_DIVERSITY_CONTROL.md", [
  "**Status:** Baseline",
  "`premium-editorial`",
  "`modern-technical`",
  "`minimal-commerce`",
  "palette-only",
  "near-duplicate",
  "three complete outcomes per direction (nine total)",
  "**Provider calls:** zero",
]);

requireText("docs/P10B_14_PREMIUM_EDITORIAL_COMPLETE_STOREFRONT_VERTICAL_SLICE.md", [
  "**Status:** Baseline",
  "These 17 routes form one P10B-05 site map",
  "`centered-minimal`",
  "`homepage-editorial-storytelling`",
  "`collection-editorial-discovery`",
  "`collection-dense-search`",
  "`pdp-high-consideration`",
  "Its 160 current\nlifecycle/surface/locale/viewport coverage entries",
  "Provider calls:** Zero",
]);

requireText("docs/P10B_15_BOUNDED_STOREFRONT_SYNTHESIS_AND_NARRATIVE_ENGINE.md", [
  "**Baseline — 10 August 2026.**",
  "versioned bounded synthesis decision",
  "`StorefrontSnapshot` remains the sole editable and rendering aggregate",
  "`dense-request-narrowed`",
  "Editorial-heavy",
  "Commerce/discovery-heavy",
  "Restrained/minimal",
  "25-case deterministic matrix",
  "480\ncorrelated scenarios total",
  "P10B-16 now owns",
  "Provider calls: **zero**",
]);

requireText("docs/P10B_09_COMMERCIAL_HOMEPAGE_PROFILE_LIBRARY.md", [
  "**Status:** Baseline",
  "`homepage-editorial-storytelling`",
  "`homepage-commerce-led-discovery`",
  "`homepage-minimal-brand-commerce`",
  "`homepage-campaign-led`",
  "`homepage-collection-gateway`",
  "`homepage-high-consideration`",
  "25/25 passing",
]);

requireText("docs/P10B_12_CONTENT_AND_SUPPORT_PAGE_FAMILIES.md", [
  "**Status:** Baseline",
  "fifteen",
  "Callers cannot supply a factual body",
  "P10B-05 remains the sole owner",
  "P10B-06 shared frame",
  "P10B-07 editorial renderer",
  "Provider calls:** Zero",
  "61",
]);

requireText("docs/P10B_11_COMMERCIAL_PDP_PROFILE_LIBRARY.md", [
  "**Status:** Baseline",
  "`pdp-standard-commerce`",
  "`pdp-high-consideration`",
  "`pdp-gallery-led`",
  "`pdp-variant-led`",
  "`dynamicProductDetail`",
  "P10B-04 remains the only responsive product-media authority",
  "P10B-08 canonical product-card renderer",
  "375, 768, 1024 and 1440 px",
  "save/reload and publication preservation",
  "P10B-10, P10B-12 content/support, and P10B-13 utility presentation\nare Baseline; P10B-14 through P10B-18 remain Planned",
]);

requireText("docs/P10B_10_COMMERCIAL_COLLECTION_SEARCH_PROFILES.md", [
  "**Status:** Baseline",
  "`collection-editorial-discovery`",
  "`collection-catalogue-comparison`",
  "`collection-campaign-led-discovery`",
  "`collection-dense-search`",
  "Provider calls:** Zero",
  "P10B-13 remains responsible",
]);

requireText("docs/P10B_06_COMMERCIAL_SHARED_FRAME_FAMILIES.md", [
  "**Status:** **Baseline**",
  "`editorial-masthead`",
  "`commerce-utility`",
  "`centered-minimal`",
  "`compact-technical`",
  "Puck editor root / preview / published renderer",
  "Provider call",
]);

requireText("docs/P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md", [
  "**Status:** Baseline",
  "The versioned `1.0.0` registry contains 19 families",
  "does not persist a\nsecond page graph",
  "presentation-only",
  "repository save/reload",
  "Provider calls:** Zero",
]);

requireText("docs/P10B_07_HERO_EDITORIAL_CAMPAIGN_PROOF_FAMILIES.md", [
  "**Status:** Baseline",
  "Six meaningful hero anatomies",
  "Provider calls:** Zero",
  "P10B remains\nPartial",
]);

for (const relativePath of [
  "README.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/P10A_PHASE_CLOSURE.md",
  "docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md",
  "docs/adr/ADR-002_CONTROLLED_DESIGN_AGENT.md",
]) {
  if (contents.get(relativePath).includes("P10B — Commercial Storefront Design System v1")) {
    failures.push(`${relativePath}: stale active P10B phase name`);
  }
}
if (
  !/^\| ☑\s+\| P10A\s+\|/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-07C-03R/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-08B-02/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-08C-02B/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-08D-02/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-09/m.test(tracker) ||
  !/^\| ☑\s+\| P11-00/m.test(tracker)
) {
  failures.push(
    "Delivery tracker must mark P10A overall, every listed P10A closure task, and P11-00 as completed Baseline work",
  );
}

const staleActivePatterns = [
  [/((?<!archive\/)VESKIFY_SDD_v1\.2\.2\.docx)/, "top-level v1.2.2 active export"],
  [/Phase 9 remains active/i, "Phase 9 active claim"],
  [/Phase 9 —[^\n]*active/i, "Phase 9 active heading"],
  [/P10B[^\n]*Storefront Studio UX/i, "old P10B Studio ownership"],
  [/Phase 11[^\n]*merchant-operable granular editing/i, "old Phase 11 editing ownership"],
  [/Phase 12[^\n]*stable domains[^\n]*adapters/i, "old Phase 12 adapter ownership"],
  [/OpenAPI (?:contract )?(?:is )?missing/i, "missing OpenAPI claim"],
  [/raw Puck[^\n]*(?:is|as) canonical/i, "raw Puck canonical-persistence claim"],
  [/P10A closure record remains/i, "outstanding P10A closure-record claim"],
  [/P10A controlled acceptance remains blocked/i, "blocked P10A controlled-acceptance claim"],
  [/P10A-08C-02B is Planned/i, "planned compiled-publication closure claim"],
  [/P10A-08D-02 is Planned/i, "planned publication-evidence closure claim"],
];

for (const [relativePath, markdown] of contents) {
  if (relativePath === "docs/archive/README.md") continue;
  const currentClaimText = markdown
    .split("\n")
    .filter((line) => !/Former (?:Phase|later)/.test(line))
    .join("\n");
  if (hasStaleActiveP10AStatusClaim(currentClaimText)) {
    failures.push(`${relativePath}: stale active claim (P10A not-closed claim)`);
  }
  for (const [pattern, label] of staleActivePatterns) {
    if (pattern.test(currentClaimText)) {
      failures.push(`${relativePath}: stale active claim (${label})`);
    }
  }
  for (const line of currentClaimText.split("\n")) {
    if (isAffirmativeMerchantEditorP10AClaim(line)) {
      failures.push(`${relativePath}: stale active claim (merchant editor as P10A closure work)`);
    }
  }
}

const sdd = contents.get("docs/VESKIFY_SDD.md");
const authoritativeDefinitions = extractAuthoritativeRequirementDefinitions(sdd);
const definitionCounts = Object.fromEntries(
  Object.entries(EXPECTED_REQUIREMENT_IDS).map(([type, identifiers]) => [
    type,
    identifiers.filter((identifier) => authoritativeDefinitions.get(identifier) === 1).length,
  ]),
);

for (const identifier of EXPECTED_REQUIREMENT_ID_SET) {
  const count = authoritativeDefinitions.get(identifier) ?? 0;
  if (count !== 1) {
    failures.push(
      `docs/VESKIFY_SDD.md: ${identifier} must have exactly one authoritative definition; found ${count}`,
    );
  }
}
for (const identifier of authoritativeDefinitions.keys()) {
  if (!EXPECTED_REQUIREMENT_ID_SET.has(identifier)) {
    failures.push(`docs/VESKIFY_SDD.md: unexpected authoritative definition ${identifier}`);
  }
}

const allowedTraceabilityStatuses = new Set([
  "Retained unchanged",
  "Clarified",
  "Superseded by named v1.3.0 requirement; traceability alias retained",
  "Historical only",
]);
const traceabilityRows = [
  ...sdd.matchAll(
    /^\|\s+\*\*((?:FR|NFR|AC)-\d+)\*\*\s+\|\s+([^|]+)\|\s+([^|]+)\|\s+([^|]+)\|\s+\*\*([^|]+)\*\*\s+\|\s+([^|]+)\|$/gm,
  ),
];
for (const row of traceabilityRows) {
  const status = row[5].trim();
  if (!allowedTraceabilityStatuses.has(status)) {
    failures.push(`docs/VESKIFY_SDD.md: ${row[1]} has invalid traceability status ${status}`);
  }
}
if (traceabilityRows.length !== EXPECTED_REQUIREMENT_ID_SET.size) {
  failures.push(
    `docs/VESKIFY_SDD.md: expected ${EXPECTED_REQUIREMENT_ID_SET.size} complete traceability rows, found ${traceabilityRows.length}`,
  );
}

const requirementReferenceFiles = ["README.md", "AGENTS.md", ...collectMarkdownFiles("docs")];
const danglingRequirementReferences = [];
for (const relativePath of requirementReferenceFiles) {
  const markdown = readRepositoryFile(relativePath);
  for (const identifier of extractRequirementIds(markdown)) {
    const numericPart = Number.parseInt(identifier.split("-")[1], 10);
    if (numericPart < 101) continue;
    if (!authoritativeDefinitions.has(identifier)) {
      danglingRequirementReferences.push(`${relativePath}:${identifier}`);
    }
  }
}
for (const danglingReference of danglingRequirementReferences) {
  failures.push(`Dangling retained requirement reference ${danglingReference}`);
}

const exportsToValidate = [
  {
    source: "docs/VESKIFY_SDD.md",
    output: "docs/VESKIFY_SDD_v1.3.0.docx",
    script: "scripts/export-sdd-docx.mjs",
    requiredXml: [
      "Veskify Software Design Document",
      "w:footerReference",
      "w:tblHeader",
      '<w:pgSz w:w="12240" w:h="15840"/>',
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"',
      '<w:br w:type="page"/>',
      '<w:tblInd w:w="0" w:type="dxa"/>',
      "w:numPr",
      "w:hyperlink",
    ],
  },
  {
    source: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    output: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx",
    script: "scripts/export-development-delivery-tracker-docx.mjs",
    requiredXml: [
      "Veskify Development Delivery Tracker",
      'w:pgSz w:w="15840" w:h="12240" w:orient="landscape"',
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"',
      "w:footerReference",
      "w:tblHeader",
      '<w:br w:type="page"/>',
      '<w:tblInd w:w="0" w:type="dxa"/>',
      "w:numPr",
      "☑",
      "☐",
      "w:hyperlink",
    ],
  },
];

for (const { source, output, script, requiredXml } of exportsToValidate) {
  const outputPath = join(repositoryRoot, output);
  if (!existsSync(outputPath)) {
    failures.push(`Missing synchronized export ${output}`);
    continue;
  }

  try {
    execFileSync(process.execPath, [join(repositoryRoot, script), "--check"], { encoding: "utf8" });
  } catch {
    failures.push(`${output} does not match its deterministic Markdown export`);
  }

  try {
    execFileSync("/usr/bin/unzip", ["-tqq", outputPath], { encoding: "utf8" });
  } catch {
    failures.push(`${output} is not a structurally valid DOCX archive`);
  }

  const markdown = readRepositoryFile(source);
  const sourceHash = createHash("sha256").update(markdown).digest("hex");
  const customProperties = execFileSync(
    "/usr/bin/unzip",
    ["-p", outputPath, "docProps/custom.xml"],
    { encoding: "utf8" },
  );
  if (!customProperties.includes(sourceHash)) {
    failures.push(`${output}: source hash does not match ${source}`);
  }

  const documentXml = execFileSync("/usr/bin/unzip", ["-p", outputPath, "word/document.xml"], {
    encoding: "utf8",
  });
  for (const required of requiredXml) {
    if (!documentXml.includes(required))
      failures.push(`${output}: missing OOXML marker ${required}`);
  }
  const pageBreakCount = (documentXml.match(/<w:br w:type="page"\/>/g) ?? []).length;
  if (pageBreakCount < 1) {
    failures.push(`${output}: expected an explicit cover page break`);
  }
  if (/<w:t[^>]*>(?:#{1,4}|\*\*|```)/.test(documentXml)) {
    failures.push(`${output}: exposed Markdown syntax in rendered document content`);
  }

  const documentRelationshipsXml = execFileSync(
    "/usr/bin/unzip",
    ["-p", outputPath, "word/_rels/document.xml.rels"],
    { encoding: "utf8" },
  );
  const decodeXmlAttribute = (value) =>
    value
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  const hyperlinkRelationships = [
    ...documentRelationshipsXml.matchAll(
      /<Relationship Id="([^"]+)" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/hyperlink" Target="([^"]+)" TargetMode="External"\/>/g,
    ),
  ].map((match) => ({ id: match[1], target: decodeXmlAttribute(match[2]) }));
  const hyperlinkIds = [...documentXml.matchAll(/<w:hyperlink r:id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const markdownLinks = extractMarkdownLinks(markdown);
  const safeMarkdownLinks = markdownLinks.filter(({ target }) => isSafeHyperlinkTarget(target));
  const expectedTargets = [...new Set(safeMarkdownLinks.map(({ target }) => target))];
  const actualTargets = hyperlinkRelationships.map(({ target }) => target);
  if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) {
    failures.push(
      `${output}: hyperlink relationship targets/order do not match Markdown (${actualTargets.join(", ")})`,
    );
  }
  if (hyperlinkIds.length !== safeMarkdownLinks.length) {
    failures.push(
      `${output}: expected ${safeMarkdownLinks.length} hyperlink elements, found ${hyperlinkIds.length}`,
    );
  }
  const relationshipsById = new Map(hyperlinkRelationships.map(({ id, target }) => [id, target]));
  for (const hyperlinkId of hyperlinkIds) {
    if (!relationshipsById.has(hyperlinkId)) {
      failures.push(`${output}: unresolved hyperlink relationship ${hyperlinkId}`);
    }
  }
  for (const { id } of hyperlinkRelationships) {
    if (!hyperlinkIds.includes(id)) failures.push(`${output}: unused hyperlink relationship ${id}`);
  }

  const footerXml = execFileSync("/usr/bin/unzip", ["-p", outputPath, "word/footer1.xml"], {
    encoding: "utf8",
  });
  for (const field of ['w:instr=" PAGE "', 'w:instr=" NUMPAGES "', '<w:jc w:val="left"/>']) {
    if (!footerXml.includes(field)) failures.push(`${output}: missing footer field ${field}`);
  }
  const expectedFooterTabPosition = source.endsWith("VESKIFY_SDD.md") ? "9360" : "12960";
  if (!footerXml.includes(`<w:tab w:val="right" w:pos="${expectedFooterTabPosition}"/>`)) {
    failures.push(`${output}: footer tab must align to the exact writable page width`);
  }
}

const archivedSddPath = join(repositoryRoot, "docs", "archive", "VESKIFY_SDD_v1.2.2.docx");
if (!existsSync(archivedSddPath)) {
  failures.push("Missing archived docs/archive/VESKIFY_SDD_v1.2.2.docx");
} else {
  try {
    execFileSync("/usr/bin/unzip", ["-tqq", archivedSddPath], { encoding: "utf8" });
  } catch {
    failures.push("Archived VESKIFY_SDD_v1.2.2.docx is not structurally valid");
  }
  const archivedHash = createHash("sha256").update(readFileSync(archivedSddPath)).digest("hex");
  if (archivedHash !== "27db7de65e0131dcdbba72adc765fe3716acadb2b150736e496789f7c24bbb25") {
    failures.push("Archived VESKIFY_SDD_v1.2.2.docx differs from the preserved historical export");
  }
}

const { readFileSync: readDevx01fStatusFile } = await import("node:fs");
const devx01fStatusDocuments = [
  "README.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
];
for (const devx01fStatusPath of devx01fStatusDocuments) {
  const content = readDevx01fStatusFile(devx01fStatusPath, "utf8");
  for (const authority of [
    "DEVX-01E = Baseline",
    "DEVX-01F = Baseline",
    "DEVX-01F2 = Baseline",
    "DEVX-01G = Baseline",
    "DEVX-01 = Baseline / closed",
    "P10B-19A-01 = Baseline",
    "P10B-19A-02 = Baseline",
    "P10B-19A-03 = Baseline",
    "P10B-19A-04 = Baseline",
    "P10B-19A-05 = Baseline",
    "P10B-19A-06 = Baseline",
    "P10B-19A-07 = Baseline",
    "P10B-19A-08A = Baseline",
    "P10B-19A-08B = Baseline",
    "P10B-19A-08C = Baseline",
    "P10B-19A-08 = Baseline / closed",
    "P10B-19A-09A = Baseline",
    "P10B-19A-09B = Baseline",
    "P10B-19A-09C = Baseline",
    "P10B-19A-09 = Baseline / closed",
    "P10B-19A-10A = Baseline",
    "P10B-19A-10 = Partial",
    "P10B-19A = Partial",
    "P10B-19A-10B1 = Baseline",
    "P10B-19A-10B = Partial",
    "P10B-19A-10B2 = exact next implementation task",
    "P10B-19A-10C = Planned after P10B-19A-10B2",
    "P10B-19B-01 = Planned after P10B-19A-10C",
  ]) {
    if (!content.includes(authority)) {
      throw new Error(`${devx01fStatusPath} must record ${authority}.`);
    }
  }
  for (const stale of [
    "DEVX-01E = exact next engineering task",
    "DEVX-01F = exact next engineering task",
    "DEVX-01F2 = exact next engineering task",
    "DEVX-01G = exact next engineering task",
    "DEVX-01 = open",
    "P10B-19A = next product-development sprint after DEVX-01",
    "P10B-19A = exact next product-development sprint",
    "P10B-19A-01 = exact next implementation task",
    "P10B-19A-02 = exact next implementation task",
    "P10B-19A-03 = exact next implementation task",
    "P10B-19A-04 = exact next implementation task",
    "P10B-19A-05 = exact next implementation task",
    "P10B-19A-06 = exact next implementation task",
    "P10B-19A-07 = exact next implementation task",
    "P10B-19A-08 = exact next implementation task",
    "P10B-19A-08A = exact next implementation task",
    "P10B-19A-08B = exact next implementation task",
    "P10B-19A-08C = exact next implementation task",
    "P10B-19A-09A = exact next implementation task",
    "P10B-19A-09B = exact next implementation task",
    "P10B-19A-09C = exact next implementation task",
    "P10B-19A-10 = Planned after P10B-19A-09C",
    "P10B-19A-10 = exact next implementation task",
    "P10B-19A-10A = exact next implementation task",
    "P10B-19A-10B1 = exact next implementation task",
    "P10B-19A-10B1 = Planned",
    "P10B-19A-10B2 = Baseline",
    "P10B-19A-10B2 = Baseline / closed",
    "P10B-19B-01 = exact next implementation task",
  ]) {
    if (content.includes(stale)) throw new Error(`${devx01fStatusPath} retains obsolete ${stale}.`);
  }
  if (/P10B-19A-10C = Planned after P10B-19A-10B(?=\s|[.,;:]|$)/u.test(content)) {
    throw new Error(
      `${devx01fStatusPath} retains obsolete P10B-19A-10C after P10B-19A-10B status.`,
    );
  }
  if (/P10B-19A-02\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-02 exact-next wording.`);
  }
  if (/P10B-19A-03\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-03 exact-next wording.`);
  }
  if (/P10B-19A-04\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-04 exact-next wording.`);
  }
  if (/P10B-19A-05\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-05 exact-next wording.`);
  }
  if (/P10B-19A-06\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-06 exact-next wording.`);
  }
  if (/P10B-19A-07\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-07 exact-next wording.`);
  }
  if (/P10B-19A-08B\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-08B exact-next wording.`);
  }
  if (/P10B-19A-08C\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-08C exact-next wording.`);
  }
  if (/P10B-19A-09A\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-09A exact-next wording.`);
  }
  if (/P10B-19A-09B\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-09B exact-next wording.`);
  }
  if (/P10B-19A-09C\s+(?:is|=)\s+(?:the\s+)?exact next(?: implementation)? task/iu.test(content)) {
    throw new Error(`${devx01fStatusPath} retains obsolete P10B-19A-09C exact-next wording.`);
  }
}

const currentP10b19StatusDocuments = [
  "README.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
];
const staleP10b19A08StatusPatterns = [
  /P10B-19A-08(?![A-C])\s*=\s*(?:Planned\s*\/\s*)?exact next(?: implementation)? task/iu,
  /P10B-19A-08(?![A-C])\s+is\s+(?:the\s+)?exact next(?: implementation)? task/iu,
  /P10B-19A-08(?![A-C])\s+-\s+Compatibility,\s+Deterministic\s+Selection\s+and\s+Normalized\s+Topology\s+Identity\s+is\s+the\s+exact\s+next/iu,
  /P10B-19A-08A\s*=\s*(?:Planned\s*\/\s*)?exact next(?: implementation)? task/iu,
  /P10B-19A-08A\s+is\s+(?:the\s+)?exact next(?: implementation)? task/iu,
  /P10B-19A-08B\s*=\s*(?:Planned\s*\/\s*)?exact next(?: implementation)? task/iu,
  /P10B-19A-08B\s+is\s+(?:the\s+)?exact next(?: implementation)? task/iu,
  /P10B-19A-08B\s+-\s+Candidate\s+Compatibility\s+Contract\s+and\s+Evaluation\s+is\s+(?:the\s+)?exact\s+next/iu,
  /P10B-19A-08C\s*=\s*(?:Planned\s*\/\s*)?exact next(?: implementation)? task/iu,
  /P10B-19A-08C\s+is\s+(?:the\s+)?exact next(?: implementation)? task/iu,
  /P10B-19A-08C\s+-\s+Deterministic\s+Candidate\s+Selection\s+is\s+(?:the\s+)?exact\s+next/iu,
  /P10B-19A-09\s+(?:is|=|remains)\s+(?:\*\*)?Planned(?:\*\*)?\s+after\s+P10B-19A-08C/iu,
  /P10B-19A-09A\s*=?\s*(?:is\s+)?(?:the\s+)?(?:Planned\s*\/\s*)?exact next(?: implementation)? task/iu,
  /P10B-19A-09A\s+is\s+(?:\*\*)?Planned(?:\*\*)?\s*\/\s*exact next/iu,
  /P10B-19A-09B\s*(?:=|is)?\s*(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next/iu,
  /\bA-09B\s+(?:is\s+)?(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next/iu,
  /P10B-19A-09C\s+(?:is|=|remains)\s+(?:\*\*)?Planned(?:\*\*)?\s+after\s+(?:P10B-19)?A-09B/iu,
  /P10B-19A-09C\s*(?:=|is)?\s*(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next(?: implementation)? task/iu,
  /\bA-09C\s+(?:is\s+)?(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next/iu,
  /P10B-19A-10\s+(?:is|=|remains)\s+(?:\*\*)?Planned(?:\*\*)?\s+after\s+(?:P10B-19)?A-09C/iu,
  /P10B-19A-10(?![A-C])\s*(?:=|is)?\s*(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next(?: implementation)? task/iu,
  /P10B-19A-10A\s*(?:=|is)?\s*(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next(?: implementation)? task/iu,
  /P10B-19A-10A\s+(?:is|=|remains)\s+(?:\*\*)?Planned(?:\*\*)?\s+after\s+(?:P10B-19)?A-09C/iu,
  /P10B-19A-10(?![A-C])\s+(?:is|=)\s+(?:\*\*)?Baseline/iu,
  /P10B-19A-10B(?![12])\s*(?:=|is)?\s*(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next(?: implementation)? task/iu,
  /P10B-19A-10B1\s+(?:is|=|remains)\s+(?:\*\*)?Planned/iu,
  /P10B-19A-10B1\s*(?:=|is)?\s*(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next(?: implementation)? task/iu,
  /P10B-19A-10B2\s+(?:is|=)\s+(?:\*\*)?Baseline(?:\s*\/\s*closed)?/iu,
  /P10B-19A-10B(?![12])\s+(?:is|=)\s+(?:\*\*)?Baseline(?:\s*\/\s*closed)?/iu,
  /P10B-19A-10C\s+(?:is|=)\s+(?:the\s+)?(?:\*\*)?(?:Planned\s*\/\s*)?exact next/iu,
  /P10B-19A-10C\s+(?:is|=|remains)\s+(?:\*\*)?Planned(?:\*\*)?\s+after\s+(?:P10B-19)?A-10B(?!2)/iu,
  /P10B-19B-01\s+(?:is|=)\s+(?:the\s+)?(?:\*\*)?(?:Planned\s*\/\s*)?exact next/iu,
  /\bA-10B(?![12])\s+(?:is|=)\s+(?:the\s+)?(?:\*\*)?(?:Planned(?:\*\*)?\s*\/\s*)?(?:\*\*)?exact next/iu,
  /\bA-10B(?![12])\s+(?:is|=)\s+(?:\*\*)?Baseline(?:\s*\/\s*(?:closed|complete))?/iu,
  /\bA-10B1\s+(?:is|=|remains)\s+(?:\*\*)?Planned/iu,
  /\bA-10B1\s+(?:is|=)\s+(?:the\s+)?(?:\*\*)?exact next/iu,
  /\bA-10B1\s+(?:is|=)\s+(?:\*\*)?Baseline\s*\/\s*(?:closed|complete)/iu,
  /\bA-10B2\s+(?:is|=)\s+(?:\*\*)?(?:Baseline|closed|complete)/iu,
  /\bA-10C\s+(?:is|=|remains)\s+(?:\*\*)?Planned(?:\*\*)?\s+after\s+A-10B(?!2)/iu,
  /\bA-10(?![A-C])\s+(?:is|=)\s+(?:the\s+)?exact next/iu,
  /\bA-10A\s+(?:is|=)\s+(?:the\s+)?exact next/iu,
];
for (const statusPath of currentP10b19StatusDocuments) {
  const currentStatusText = readDevx01fStatusFile(statusPath, "utf8")
    .split("\n")
    .filter((line) => !/^\| 1\.3\.0 /.test(line))
    .join("\n");
  for (const stalePattern of staleP10b19A08StatusPatterns) {
    if (stalePattern.test(currentStatusText)) {
      throw new Error(`${statusPath} retains stale P10B-19A next-task wording.`);
    }
  }
}

const devx01fTracker = readDevx01fStatusFile(
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "utf8",
);
if (!/\[x\] DEVX-01F[^\n]*Playwright sharding\/matrix/iu.test(devx01fTracker)) {
  throw new Error("Delivery tracker must mark DEVX-01F complete.");
}
if (!/\[x\] DEVX-01F2[^\n]*Contention-safe Vitest sharding/iu.test(devx01fTracker)) {
  throw new Error("Delivery tracker must mark DEVX-01F2 complete.");
}
if (!/\[x\] DEVX-01G[^\n]*Two-run performance acceptance/iu.test(devx01fTracker)) {
  throw new Error("Delivery tracker must mark DEVX-01G complete.");
}
if (!/\[x\] DEVX-01[^A-Z0-9][^\n]*Baseline \/ closed/iu.test(devx01fTracker)) {
  throw new Error("Delivery tracker must mark parent DEVX-01 Baseline / closed.");
}
for (const stalePattern of [
  /\[ \] DEVX-01F[^\n]*exact next/iu,
  /\[ \] DEVX-01F2[^\n]*exact next/iu,
  /\| DEVX-01F[^\n]*Planned/iu,
  /\| DEVX-01F2[^\n]*Planned/iu,
  /DEVX-01F is(?:\s+the)? exact next/iu,
  /DEVX-01F2 is(?:\s+the)? exact next/iu,
  /\[ \] DEVX-01G/iu,
  /\| DEVX-01G[^\n]*Planned/iu,
  /DEVX-01G is(?:\s+the)? exact next/iu,
  /P10B-19A (?:remains|is) the next product-development sprint after DEVX-01/iu,
  /P10B-19A begins only after DEVX-01 closes/iu,
]) {
  if (stalePattern.test(devx01fTracker)) {
    throw new Error(
      "Delivery tracker retains stale DEVX-01F status: " + String(stalePattern) + ".",
    );
  }
}
const devx01fGuide = readDevx01fStatusFile("docs/DEVELOPMENT_GUIDE.md", "utf8");
for (const authority of [
  "node scripts/playwright-ci.mjs audit",
  "PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY",
  "longest-processing-time",
  "scripts/playwright-ci-execution-plan.v1.json",
  "node scripts/playwright-ci.mjs audit-plan",
  "node scripts/playwright-ci.mjs run-group",
  "node scripts/playwright-ci.mjs validate-group-artifacts",
  "merge-reports",
]) {
  if (!devx01fGuide.includes(authority)) {
    throw new Error(`Development guide is missing DEVX-01F authority: ${authority}.`);
  }
}
for (const [path, pattern] of [
  ["docs/VESKIFY_DEVELOPMENT_ROADMAP.md", /\|\s*8\s*\|\s*DEVX-01G[^\n]*\|\s*\*\*Baseline\*\*/iu],
  ["docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", /\|\s*DEVX-01G[^\n]*\|\s*\*\*Baseline\*\*/iu],
]) {
  if (!pattern.test(readDevx01fStatusFile(path, "utf8"))) {
    throw new Error(`${path} must mark DEVX-01G Baseline.`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  const hashes = exportsToValidate.map(({ source }) =>
    createHash("sha256").update(readRepositoryFile(source)).digest("hex"),
  );
  process.stdout.write(
    `Documentation validation passed (${activeMarkdownFiles.length} active Markdown files; requirements FR ${definitionCounts.functional}, NFR ${definitionCounts.nonFunctional}, AC ${definitionCounts.acceptance}, dangling 0; synchronized SDD ${hashes[0]}; synchronized tracker ${hashes[1]}; archived v1.2.2 preserved).\n`,
  );
}
