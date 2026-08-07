import assert from "node:assert/strict";

import {
  EXPECTED_REQUIREMENT_IDS,
  extractAuthoritativeRequirementDefinitions,
  extractRequirementIds,
  isAffirmativeMerchantEditorP10AClaim,
} from "./documentation-validation-helpers.mjs";
import { renderInlineMarkdownForCheck } from "./markdown-docx-export.mjs";

const linkFixture =
  "Plain **bold**, *italic* and `code`; [external](https://example.com/docs), [relative](../docs/ROADMAP.md), [external again](https://example.com/docs).";
const firstLinkRender = renderInlineMarkdownForCheck(linkFixture);
const secondLinkRender = renderInlineMarkdownForCheck(linkFixture);

assert.deepEqual(secondLinkRender, firstLinkRender, "hyperlink output must be deterministic");
assert.deepEqual(firstLinkRender.relationships, [
  { id: "rIdHyperlink1", target: "https://example.com/docs" },
  { id: "rIdHyperlink2", target: "../docs/ROADMAP.md" },
]);
assert.equal((firstLinkRender.xml.match(/r:id="rIdHyperlink1"/g) ?? []).length, 2);
assert.equal((firstLinkRender.xml.match(/r:id="rIdHyperlink2"/g) ?? []).length, 1);
assert.match(firstLinkRender.relationshipsXml, /Target="https:\/\/example\.com\/docs"/);
assert.match(firstLinkRender.relationshipsXml, /Target="\.\.\/docs\/ROADMAP\.md"/);
assert.match(firstLinkRender.xml, />Plain <\/w:t>/);
assert.match(firstLinkRender.xml, /<w:b\/>/);
assert.match(firstLinkRender.xml, /<w:i\/>/);
assert.match(firstLinkRender.xml, /Consolas/);

const unsafeLinkRender = renderInlineMarkdownForCheck("[unsafe](javascript:payload)");
assert.equal(unsafeLinkRender.relationships.length, 0);
assert.doesNotMatch(unsafeLinkRender.xml, /<w:hyperlink/);
assert.match(unsafeLinkRender.xml, /unsafe \(javascript:payload\)/);

assert.equal(
  isAffirmativeMerchantEditorP10AClaim("The merchant editor is a P10A closure requirement."),
  true,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("Merchant editor wiring belongs to P10A closure."),
  true,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("P10A must wire merchant editor controls before closing."),
  true,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("The merchant editor is not a P10A closure requirement."),
  false,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("Merchant-facing editor wiring belongs to P10C."),
  false,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim(
    "P10A internal governed execution does not require merchant UI wiring.",
  ),
  false,
);

const rangeFixture = "FR-119–122; NFR-101 through NFR-103; AC-105-107; AC-138.";
assert.deepEqual([...extractRequirementIds(rangeFixture)].sort(), [
  "AC-105",
  "AC-106",
  "AC-107",
  "AC-138",
  "FR-119",
  "FR-120",
  "FR-121",
  "FR-122",
  "NFR-101",
  "NFR-102",
  "NFR-103",
]);

const definitionFixture =
  "| **FR-101** | Functional | Meaning | Owner | Retained unchanged | Authority |\n" +
  "| **FR-101** | Functional | Duplicate | Owner | Retained unchanged | Authority |";
assert.equal(extractAuthoritativeRequirementDefinitions(definitionFixture).get("FR-101"), 2);
assert.deepEqual(
  Object.values(EXPECTED_REQUIREMENT_IDS).map((identifiers) => identifiers.length),
  [24, 10, 38],
);

process.stdout.write(
  "Documentation tooling self-check passed (hyperlinks, deterministic relationships, requirement ranges/duplicates, and P10A/P10C negation fixtures).\n",
);
