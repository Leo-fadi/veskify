import { z } from "zod";
import { assertNoExecutableContent } from "@/application/design-skills/registry";
import {
  brandSystemSchema,
  contrastRatio,
  standardTextContrastMinimum,
  type BrandSystem,
} from "@/domain/design-system";
import { localizedTextSchema } from "@/domain/shared";

export const brandColourTokenSchema = z.enum([
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "mutedText",
  "border",
]);

export const exactBrandPalettePlanSchema = z
  .object({
    colors: brandSystemSchema.shape.colors,
    requestedTokens: z.array(brandColourTokenSchema).min(1),
    correctedTokens: z.array(brandColourTokenSchema),
    warnings: z.array(localizedTextSchema),
    source: z.enum(["hex", "named", "mixed", "existing"]),
  })
  .strict();

export type BrandColourToken = z.infer<typeof brandColourTokenSchema>;
export type ExactBrandPalettePlan = z.infer<typeof exactBrandPalettePlanSchema>;

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
const protectedMutationPattern =
  /\b(?:change|update|set|replace|edit|increase|decrease|remove)\b[^.!?]{0,80}\b(?:prices?|sku|stock|inventory|products?|variants?|payments?|shipping|tax|orders?)\b/i;
const broaderMutationPattern =
  /\b(?:change|update|replace|rewrite|reorder|remove|edit)\b[^.!?]{0,80}\b(?:layout|typography|fonts?|images?|imagery|copy|content|products?|sections?|structure)\b/i;
const preservationClausePattern =
  /\b(?:keep|preserve|leave|retain)\b[^.!?]{0,240}\b(?:unchanged|same|intact|as\s+is)\b/gi;

const tokenAliases: ReadonlyArray<{
  token: BrandColourToken;
  pattern: RegExp;
  normalized: readonly string[];
}> = [
  { token: "mutedText", pattern: /\bmuted[\s_-]*text\b/i, normalized: ["mutedtext"] },
  { token: "primary", pattern: /\bprimary\b/i, normalized: ["primary"] },
  { token: "secondary", pattern: /\bsecondary\b/i, normalized: ["secondary"] },
  { token: "accent", pattern: /\baccents?\b/i, normalized: ["accent", "accents"] },
  { token: "background", pattern: /\bbackground\b/i, normalized: ["background"] },
  { token: "surface", pattern: /\bsurface\b/i, normalized: ["surface"] },
  { token: "text", pattern: /\btext\b/i, normalized: ["text"] },
  { token: "border", pattern: /\bborders?\b/i, normalized: ["border", "borders"] },
];

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
  const left = Math.max(
    instruction.lastIndexOf(",", occurrence.index - 1),
    instruction.lastIndexOf(";", occurrence.index - 1),
  );
  const rightCandidates = [
    instruction.indexOf(",", occurrence.end),
    instruction.indexOf(";", occurrence.end),
    instruction.indexOf(".", occurrence.end),
  ].filter((index) => index >= 0);
  const right = rightCandidates.length > 0 ? Math.min(...rightCandidates) : instruction.length;
  return instruction.slice(left + 1, right);
}

function roleForOccurrence(
  instruction: string,
  occurrence: ColourOccurrence,
): BrandColourToken | undefined {
  const segment = segmentAround(instruction, occurrence);
  return tokenAliases.find(({ pattern }) => pattern.test(segment))?.token;
}

function positionalRoles(count: number): readonly BrandColourToken[] | undefined {
  if (count === 1) return ["primary"];
  if (count === 2) return ["primary", "secondary"];
  if (count === 3) return ["primary", "secondary", "accent"];
  if (count === 5) return ["primary", "secondary", "background", "text", "accent"];
  if (count === tokenOrder.length) return tokenOrder;
  return undefined;
}

function assertKnownAssignments(instruction: string) {
  for (const match of instruction.matchAll(
    /["']?([a-zA-Z][a-zA-Z0-9_-]*)["']?\s*(?::|=)\s*#[a-zA-Z0-9_-]+/g,
  )) {
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
    const token = roleForOccurrence(instruction, occurrence) ?? positional?.[index];
    if (!token) {
      throw new BrandPaletteInstructionError(
        "Label each supplied colour with an approved role: primary, secondary, accent, background, surface, text, muted text, or border.",
      );
    }
    const existing = assigned.get(token);
    if (existing !== undefined && existing !== occurrence.value) {
      throw new BrandPaletteInstructionError(
        `Supply only one value for the ${token} colour token.`,
      );
    }
    assigned.set(token, occurrence.value);
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

function assertSafeInstruction(instruction: string) {
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
  const actionable = instruction.replace(preservationClausePattern, "");
  if (protectedMutationPattern.test(actionable)) {
    throw new BrandPaletteInstructionError(
      "Brand palette requests cannot modify products or protected commerce information.",
    );
  }
  if (broaderMutationPattern.test(actionable)) {
    throw new BrandPaletteInstructionError(
      "Submit layout, typography, imagery, content, or structure changes as a separate reviewed request.",
    );
  }
  assertKnownAssignments(instruction);
}

export function planExactBrandPalette(
  instruction: string,
  currentColorsInput: BrandSystem["colors"],
): ExactBrandPalettePlan | null {
  if (!paletteIntentPattern.test(instruction)) return null;
  const current = brandSystemSchema.shape.colors.parse(structuredClone(currentColorsInput));
  assertSafeInstruction(instruction);
  const hex = findHexColours(instruction);
  const named = findNamedColours(instruction);
  const occurrences = [...hex, ...named].sort((left, right) => left.index - right.index);
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
