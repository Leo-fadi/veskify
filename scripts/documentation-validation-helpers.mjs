const requirementRange = (prefix, start, end) =>
  Array.from({ length: end - start + 1 }, (_, index) => `${prefix}-${start + index}`);

export const EXPECTED_REQUIREMENT_IDS = {
  functional: requirementRange("FR", 101, 124),
  nonFunctional: requirementRange("NFR", 101, 110),
  acceptance: requirementRange("AC", 101, 138),
};

export const EXPECTED_REQUIREMENT_ID_SET = new Set(Object.values(EXPECTED_REQUIREMENT_IDS).flat());

export const extractRequirementIds = (markdown) => {
  const identifiers = new Set();
  const rangePattern = /\b(FR|NFR|AC)-(\d+)\s*(?:through|[–—-])\s*(?:(FR|NFR|AC)-)?(\d+)\b/g;

  for (const match of markdown.matchAll(rangePattern)) {
    const [, startPrefix, startValue, explicitEndPrefix, endValue] = match;
    const endPrefix = explicitEndPrefix ?? startPrefix;
    if (startPrefix !== endPrefix) continue;
    const start = Number.parseInt(startValue, 10);
    const end = Number.parseInt(endValue, 10);
    if (end < start || end - start > 500) continue;
    for (let value = start; value <= end; value += 1) {
      identifiers.add(`${startPrefix}-${value}`);
    }
  }

  for (const match of markdown.matchAll(/\b(?:FR|NFR|AC)-\d+\b/g)) {
    identifiers.add(match[0]);
  }

  return identifiers;
};

export const extractAuthoritativeRequirementDefinitions = (sddMarkdown) => {
  const counts = new Map();
  const definitionPattern = /^\|\s+\*\*((?:FR|NFR|AC)-\d+)\*\*\s+\|/gm;
  for (const match of sddMarkdown.matchAll(definitionPattern)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  return counts;
};

const affirmativeMerchantEditorP10APatterns = [
  /\bmerchant(?:-facing)? editor(?: wiring| controls)?\s+(?:is|remains)\s+(?:an?\s+)?p10a closure requirement\b/i,
  /\bmerchant(?:-facing)? editor(?: wiring| controls)?\s+belongs to\s+p10a(?: closure)?\b/i,
  /\bp10a\s+(?:must|needs? to|is required to)\s+(?:wire|provide|implement|expose|connect)\s+(?:the\s+)?merchant(?:-facing)?\s+(?:editor|ui)(?:\s+controls|\s+wiring)?(?:\s+before\s+(?:it\s+)?clos(?:e|ing))?\b/i,
];

export const isAffirmativeMerchantEditorP10AClaim = (text) =>
  affirmativeMerchantEditorP10APatterns.some((pattern) => pattern.test(text));
