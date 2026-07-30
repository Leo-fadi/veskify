import type { z } from "zod";
import { assertNoExecutableContent } from "@/application/design-skills/registry";
import {
  brandSystemSchema,
  contrastRatio,
  standardTextContrastMinimum,
  type BrandSystem,
} from "@/domain/design-system";
import type { localizedTextSchema } from "@/domain/shared";
import {
  brandColourTokenSchema,
  exactBrandPalettePlanSchema,
  type BrandColourToken,
  type ExactBrandPalettePlan,
} from "@/application/storefront-design-system/brand-palette-contract";

export {
  brandColourTokenSchema,
  exactBrandPalettePlanSchema,
  type BrandColourToken,
  type ExactBrandPalettePlan,
};

export class BrandPaletteInstructionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandPaletteInstructionError";
  }
}

const tokenOrder = brandColourTokenSchema.options;
const tokenIndex = new Map(tokenOrder.map((token, index) => [token, index]));
const paletteIntentPattern = /\b(?:brand\s+)?(?:palette|colou?rs?|hex)\b|#[a-z0-9]/i;
const existingPalettePattern = /\b(?:existing|current)\s+(?:brand\s+)?palette\b/i;
const unsupportedGradientPattern = /\b(?:linear|radial|conic)?-?gradient\b|\bgradient\s*\(/i;
const mutationVerbPattern =
  "(?:add|create|insert|make|simplify|compact|expand|redesign|rebuild|move|reorder|hide|show|change|update|replace|rewrite|remove|delete|edit|set|increase|decrease|adjust|modify|alter|raise|lower|lisää|luo|tee|muuta|päivitä|korvaa|poista|aseta|korota|nosta|vähennä|laske|säädä)";
const wordBoundary = "[^\\p{L}\\p{N}_]";
const protectedMutationPattern = new RegExp(
  `(?:^|${wordBoundary})${mutationVerbPattern}(?=$|${wordBoundary})[^.!?]{0,80}(?:^|${wordBoundary})(?:prices?|sku|stock|inventory|availability|products?(?!\\s+(?:imagery|images?|presentation|details?|discovery|cards?|grid|gallery|layout))|variants?|option\\s+values?|payments?|shipping|tax|orders?|hin(?:n|t)\\p{L}*|tuotte\\p{L}*|tuote|varasto\\p{L}*|saatavu\\p{L}*|variant\\p{L}*|valinta-arvo\\p{L}*|maksu\\p{L}*|toimitu\\p{L}*|vero\\p{L}*|tilau\\p{L}*)(?=$|${wordBoundary})`,
  "iu",
);
const broaderMutationPattern = new RegExp(
  `(?:^|${wordBoundary})${mutationVerbPattern}(?=$|${wordBoundary})[^.!?]{0,80}(?:^|${wordBoundary})(?:layout|typography|fonts?|images?|imagery|copy|content|sections?|structure|navigation|footer|page\\s+composition)(?=$|${wordBoundary})`,
  "iu",
);
const preservationClausePatterns = [
  /\b(?:keep|preserve|leave|retain)\b[^.!?]{0,240}\b(?:unchanged|same|intact|as\s+is)\b/gi,
  /\b(?:do\s+not|don't|without)\s+(?:change|changing|update|updating|replace|replacing|edit|editing|remove|removing|reorder|reordering|alter|altering)\b[^.!?]{0,240}\b(?:layout|typography|fonts?|images?|imagery|copy|content|products?|prices?|sku|stock|inventory|variants?|sections?|structure|navigation|footer|page\s+composition)\b[^.!?]*/gi,
];

const tokenAliases: ReadonlyArray<{
  token: BrandColourToken;
  pattern: RegExp;
  normalized: readonly string[];
}> = [
  { token: "mutedText", pattern: /\bmuted[\s_-]*text\b/i, normalized: ["mutedtext"] },
  { token: "primary", pattern: /\bprimary\b/i, normalized: ["primary"] },
  { token: "secondary", pattern: /\bsecondary\b/i, normalized: ["secondary"] },
  { token: "accent", pattern: /\baccents?\b/i, normalized: ["accent", "accents"] },
  { token: "background", pattern: /\bbackgrounds?\b/i, normalized: ["background"] },
  { token: "surface", pattern: /\bsurfaces?\b/i, normalized: ["surface"] },
  { token: "text", pattern: /\btext\b/i, normalized: ["text"] },
  { token: "border", pattern: /\bborders?\b/i, normalized: ["border", "borders"] },
];

const roleLabelPatternSource =
  "(?:muted[\\s_-]*text|primary|secondary|accents?|backgrounds?|surfaces?|text|borders?)";
const roleConjunctionPattern = new RegExp(
  `\\band\\s+(?=${roleLabelPatternSource}\\b(?:\\s*(?::|=))?)`,
  "gi",
);
const assignmentNamePattern = /["']?(muted(?:[\s_-]+text)|[a-zA-Z][a-zA-Z0-9_-]*)["']?\s*(?::|=)/gi;

const knownAssignmentNames = new Set([
  ...tokenAliases.flatMap(({ normalized }) => normalized),
  "palette",
  "color",
  "colors",
  "colour",
  "colours",
]);

const namedColours: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\bdeep[\s-]+forest[\s-]+green\b/gi, value: "#173F35" },
  { pattern: /\bforest[\s-]+green\b/gi, value: "#1F4D3B" },
  { pattern: /\bmuted[\s-]+sage\b/gi, value: "#82917B" },
  { pattern: /\bsage(?:[\s-]+green)?\b/gi, value: "#8A9A82" },
  { pattern: /\bwarm[\s-]+off[\s-]+white\b/gi, value: "#F7F2E8" },
  { pattern: /\boff[\s-]+white\b/gi, value: "#FAF8F2" },
  { pattern: /\brestrained[\s-]+soft[\s-]+gold\b/gi, value: "#C2A35A" },
  { pattern: /\bsoft[\s-]+gold\b/gi, value: "#C2A35A" },
  { pattern: /\bmuted[\s-]+gold\b/gi, value: "#B99A58" },
  { pattern: /\bcharcoal\b/gi, value: "#292D2B" },
  { pattern: /\bburgundy\b/gi, value: "#6D1F35" },
  { pattern: /\bterracotta\b/gi, value: "#B45F45" },
  { pattern: /\bnavy(?:[\s-]+blue)?\b/gi, value: "#1F2A44" },
  { pattern: /\bcream\b/gi, value: "#FFF4D6" },
  { pattern: /\bbeige\b/gi, value: "#D8C8B0" },
  { pattern: /\bgold\b/gi, value: "#B8913D" },
  { pattern: /\bblack\b/gi, value: "#111111" },
  { pattern: /\bwhite\b/gi, value: "#FFFFFF" },
  { pattern: /\bgr[ae]y\b/gi, value: "#777777" },
  { pattern: /\bred\b/gi, value: "#A52A2A" },
  { pattern: /\bgreen\b/gi, value: "#2F6B4F" },
  { pattern: /\bblue\b/gi, value: "#315A7D" },
];

type ColourOccurrence = {
  index: number;
  end: number;
  value: string;
  source: "hex" | "named";
};

function canonicalHex(value: string): string {
  return value.toUpperCase();
}

function findHexColours(instruction: string): ColourOccurrence[] {
  const matches = [...instruction.matchAll(/#[a-zA-Z0-9_-]+/g)];
  return matches.map((match) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(match[0])) {
      throw new BrandPaletteInstructionError("Use six-digit hexadecimal colours such as #173F35.");
    }
    return {
      index: match.index,
      end: match.index + match[0].length,
      value: canonicalHex(match[0]),
      source: "hex" as const,
    };
  });
}

function findNamedColours(instruction: string): ColourOccurrence[] {
  const candidates = namedColours.flatMap(({ pattern, value }) =>
    [...instruction.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => ({
      index: match.index,
      end: match.index + match[0].length,
      value,
      source: "named" as const,
    })),
  );
  candidates.sort(
    (left, right) => left.index - right.index || right.end - right.index - (left.end - left.index),
  );
  const selected: ColourOccurrence[] = [];
  for (const candidate of candidates) {
    if (selected.some((item) => candidate.index < item.end && candidate.end > item.index)) continue;
    selected.push(candidate);
  }
  return selected.sort((left, right) => left.index - right.index);
}

function segmentAround(instruction: string, occurrence: ColourOccurrence) {
  let left =
    Math.max(
      instruction.lastIndexOf(",", occurrence.index - 1),
      instruction.lastIndexOf(";", occurrence.index - 1),
    ) + 1;
  const rightCandidates = [
    instruction.indexOf(",", occurrence.end),
    instruction.indexOf(";", occurrence.end),
    instruction.indexOf(".", occurrence.end),
  ].filter((index) => index >= 0);
  for (const match of instruction.matchAll(roleConjunctionPattern)) {
    if (match.index < occurrence.index) {
      left = Math.max(left, match.index + match[0].length);
    } else if (match.index >= occurrence.end) {
      rightCandidates.push(match.index);
    }
  }
  const right = rightCandidates.length > 0 ? Math.min(...rightCandidates) : instruction.length;
  return instruction.slice(left, right);
}

function rolesForOccurrence(instruction: string, occurrence: ColourOccurrence): BrandColourToken[] {
  const segment = segmentAround(instruction, occurrence);
  const sentenceEnd = instruction.indexOf(".", occurrence.end);
  const followingClause = instruction.slice(
    occurrence.index,
    sentenceEnd === -1 ? instruction.length : sentenceEnd,
  );
  // “Primary text” names two canonical targets: the primary action token and
  // the readable text token. Other qualified labels retain their established
  // single-token meanings: “secondary accents” is the secondary token, and
  // “borders and secondary surfaces” assigns the explicitly named border and
  // surface targets together.
  if (/\bprimary\s+text\b/i.test(segment)) return ["primary", "text"];
  if (/\bsecondary\s+accents?\b/i.test(segment)) return ["secondary"];
  if (/^#[0-9a-f]{6}\s+for\s+borders?\s+and\s+secondary\s+surfaces?\b/i.test(followingClause)) {
    return ["border", "surface"];
  }
  const token = tokenAliases.find(({ pattern }) => pattern.test(segment))?.token;
  return token === undefined ? [] : [token];
}

function positionalRoles(count: number): readonly BrandColourToken[] | undefined {
  if (count === 1) return ["primary"];
  if (count === 2) return ["primary", "secondary"];
  if (count === 3) return ["primary", "secondary", "accent"];
  if (count === 5) return ["primary", "secondary", "background", "text", "accent"];
  if (count === tokenOrder.length) return tokenOrder;
  return undefined;
}

function assertKnownAssignments(instruction: string, occurrences: readonly ColourOccurrence[]) {
  for (const match of instruction.matchAll(assignmentNamePattern)) {
    const assignmentEnd = match.index + match[0].length;
    const assignedColour = occurrences.find(
      (occurrence) =>
        occurrence.index >= assignmentEnd &&
        /^\s*(?:(?:a|an|the)\s+)?$/i.test(instruction.slice(assignmentEnd, occurrence.index)),
    );
    if (!assignedColour) continue;
    const normalized = match[1].replace(/[\s_-]/g, "").toLocaleLowerCase();
    if (!knownAssignmentNames.has(normalized)) {
      throw new BrandPaletteInstructionError(
        `The colour token “${match[1]}” is not an approved brand token.`,
      );
    }
  }
}

function requestedPalette(
  instruction: string,
  current: BrandSystem["colors"],
  occurrences: readonly ColourOccurrence[],
) {
  const positional = positionalRoles(occurrences.length);
  const assigned = new Map<BrandColourToken, string>();
  occurrences.forEach((occurrence, index) => {
    const tokens = rolesForOccurrence(instruction, occurrence);
    const assignedTokens = tokens.length === 0 ? [positional?.[index]] : tokens;
    if (assignedTokens[0] === undefined) {
      throw new BrandPaletteInstructionError(
        "Label each supplied colour with an approved role: primary, secondary, accent, background, surface, text, muted text, or border.",
      );
    }
    assignedTokens.forEach((token) => {
      if (token === undefined) return;
      const existing = assigned.get(token);
      if (existing !== undefined) {
        throw new BrandPaletteInstructionError(
          `Supply only one value for the ${token} colour token.`,
        );
      }
      assigned.set(token, occurrence.value);
    });
  });
  const colors = { ...current };
  assigned.forEach((value, token) => {
    colors[token] = value;
  });
  return {
    colors: brandSystemSchema.shape.colors.parse(colors),
    requestedTokens: [...assigned.keys()].sort(
      (left, right) => tokenIndex.get(left)! - tokenIndex.get(right)!,
    ),
  };
}

function minimumTextContrast(color: string, colors: BrandSystem["colors"]) {
  return Math.min(contrastRatio(color, colors.background), contrastRatio(color, colors.surface));
}

function readableTextReplacement(colors: BrandSystem["colors"]) {
  const candidates = ["#111111", "#FFFFFF"] as const;
  const ranked = candidates
    .map((candidate) => ({ candidate, contrast: minimumTextContrast(candidate, colors) }))
    .sort((left, right) => right.contrast - left.contrast);
  if (ranked[0].contrast < standardTextContrastMinimum) {
    throw new BrandPaletteInstructionError(
      "The requested background and surface colours cannot share one readable text colour.",
    );
  }
  return ranked[0].candidate;
}

function ensureReadableText(colorsInput: BrandSystem["colors"]) {
  const colors = structuredClone(colorsInput);
  const correctedTokens: BrandColourToken[] = [];
  const warnings: Array<z.infer<typeof localizedTextSchema>> = [];
  for (const token of ["text", "mutedText"] as const) {
    if (minimumTextContrast(colors[token], colors) >= standardTextContrastMinimum) continue;
    const replacement = readableTextReplacement(colors);
    colors[token] = replacement;
    correctedTokens.push(token);
    warnings.push({
      en: `The requested ${token === "mutedText" ? "muted text" : "text"} colour did not meet readable contrast and was adjusted to ${replacement}; the other requested palette colours were preserved.`,
      fi: `Pyydetty ${token === "mutedText" ? "vaimennettu tekstiväri" : "tekstiväri"} ei täyttänyt luettavan kontrastin vaatimusta, joten se korjattiin arvoon ${replacement}; muut pyydetyt palettivärit säilytettiin.`,
    });
  }
  return { colors: brandSystemSchema.shape.colors.parse(colors), correctedTokens, warnings };
}

function actionableMutationInstruction(instruction: string): string {
  return preservationClausePatterns.reduce(
    (value, pattern) => value.replace(pattern, ""),
    instruction,
  );
}

export function containsProtectedCommerceMutation(instruction: string): boolean {
  return protectedMutationPattern.test(actionableMutationInstruction(instruction));
}

function assertSafeInstruction(
  instruction: string,
  options: { allowTokenCompanions?: boolean } = {},
) {
  try {
    assertNoExecutableContent(instruction);
  } catch {
    throw new BrandPaletteInstructionError(
      "Brand palette requests must use colour names or six-digit hex values, not CSS or code.",
    );
  }
  if (unsupportedGradientPattern.test(instruction)) {
    throw new BrandPaletteInstructionError(
      "Gradients are not supported by the canonical brand colour tokens.",
    );
  }
  if (/[{}]/.test(instruction)) {
    throw new BrandPaletteInstructionError(
      "Use ordinary colour instructions rather than a style object.",
    );
  }
  const actionable = options.allowTokenCompanions
    ? actionableMutationInstruction(instruction).replace(
        new RegExp(
          `(?:^|${wordBoundary})${mutationVerbPattern}(?=$|${wordBoundary})[^.!?]{0,80}(?:^|${wordBoundary})(?:typography|fonts?|spacing|density)(?=$|${wordBoundary})`,
          "giu",
        ),
        "",
      )
    : actionableMutationInstruction(instruction);
  if (containsProtectedCommerceMutation(instruction)) {
    throw new BrandPaletteInstructionError(
      "This request mixes colour changes with protected commerce changes. Submit the colour palette separately; protected commerce data cannot be changed by a brand-palette proposal.",
    );
  }
  if (broaderMutationPattern.test(actionable)) {
    throw new BrandPaletteInstructionError(
      "This request mixes colour changes with unsupported layout, typography, imagery, content, navigation, or structure changes. Submit the colour palette as a separate reviewed request.",
    );
  }
}

export function planExactBrandPalette(
  instruction: string,
  currentColorsInput: BrandSystem["colors"],
  options: { allowTokenCompanions?: boolean } = {},
): ExactBrandPalettePlan | null {
  const hex = findHexColours(instruction);
  const named = findNamedColours(instruction);
  const occurrences = [...hex, ...named].sort((left, right) => left.index - right.index);
  const hasRoleLabelledNamedColour =
    named.length > 0 && tokenAliases.some(({ pattern }) => pattern.test(instruction));
  const hasAssignedNamedColour =
    named.length > 0 &&
    [...instruction.matchAll(assignmentNamePattern)].some((match) => {
      const assignmentEnd = match.index + match[0].length;
      return named.some(
        (occurrence) =>
          occurrence.index >= assignmentEnd &&
          /^\s*(?:(?:a|an|the)\s+)?$/i.test(instruction.slice(assignmentEnd, occurrence.index)),
      );
    });
  if (
    !paletteIntentPattern.test(instruction) &&
    !hasRoleLabelledNamedColour &&
    !hasAssignedNamedColour
  ) {
    return null;
  }
  const current = brandSystemSchema.shape.colors.parse(structuredClone(currentColorsInput));
  assertSafeInstruction(instruction, options);
  assertKnownAssignments(instruction, occurrences);
  if (occurrences.length === 0) {
    if (!existingPalettePattern.test(instruction)) {
      throw new BrandPaletteInstructionError(
        "Name the requested colours or provide valid six-digit hex values.",
      );
    }
    return exactBrandPalettePlanSchema.parse({
      colors: current,
      requestedTokens: tokenOrder,
      correctedTokens: [],
      warnings: [],
      source: "existing",
    });
  }
  const requested = requestedPalette(instruction, current, occurrences);
  const readable = ensureReadableText(requested.colors);
  return exactBrandPalettePlanSchema.parse({
    colors: readable.colors,
    requestedTokens: requested.requestedTokens,
    correctedTokens: readable.correctedTokens,
    warnings: readable.warnings,
    source: hex.length > 0 && named.length > 0 ? "mixed" : hex.length > 0 ? "hex" : "named",
  });
}
