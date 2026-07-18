import type { BrandDirection, GenerationPreferences } from "@/domain/design-brief";

/** Controlled O-05 choices. These are input options, not a second persisted model. */
export const visualDirectionToneKeywords = [
  "warm",
  "calm",
  "friendly",
  "formal",
  "premium",
  "accessible",
  "direct",
  "inspiring",
  "concise",
  "storytelling",
  "playful",
  "natural",
] as const;

export type VisualDirectionToneKeyword = (typeof visualDirectionToneKeywords)[number];

export type VisualDirectionDraft = Readonly<{
  visualStyleDirection: BrandDirection["visualStyleDirection"];
  typographyDirection: BrandDirection["typographyDirection"];
  imageryDirection: BrandDirection["imageryDirection"];
  toneKeywords: readonly string[];
  generationPreferences: GenerationPreferences;
}>;

export const defaultVisualDirectionPreferences: GenerationPreferences = {
  visualDensity: "balanced",
  contentEmphasis: "balanced",
  merchandisingEmphasis: "balanced",
  sectionRichness: "balanced",
  accessibilityPreference: "standard",
};

export const emptyVisualDirectionDraft: VisualDirectionDraft = {
  visualStyleDirection: null,
  typographyDirection: null,
  imageryDirection: null,
  toneKeywords: [],
  generationPreferences: defaultVisualDirectionPreferences,
};

export function isVisualDirectionToneKeyword(value: string): value is VisualDirectionToneKeyword {
  return (visualDirectionToneKeywords as readonly string[]).includes(value);
}
