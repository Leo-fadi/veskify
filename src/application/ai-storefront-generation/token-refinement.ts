import { assertNoExecutableContent } from "@/application/design-skills";
import { type BrandSystem, type FontToken } from "@/domain/design-system";
import {
  applyRegisteredTokenRefinement,
  registeredTokenRefinementPlanSchema,
  type RegisteredTokenRefinementPlan,
} from "@/application/storefront-design-system";
import {
  BrandPaletteInstructionError,
  containsProtectedCommerceMutation,
  planExactBrandPalette,
} from "./brand-palette";

export {
  applyRegisteredTokenRefinement,
  registeredTokenRefinementPlanSchema,
  type RegisteredTokenRefinementPlan,
};

const tokenIntentPattern =
  /#[0-9a-f]{6}\b|\b(?:palette|colou?rs?|primary|secondary|accent|background|surface|muted\s+text|border|typography|fonts?|heading|headings|body\s+(?:font|type|text)|spacing|density|compact|dense|spacious|airy|balanced)\b|\b(?:väripaletti|värit?|ensisijainen|toissijainen|korostusväri|tausta|pinta|vaimennettu\s+teksti|reunus|typografia|fontit?|otsikko|leipäteksti|välistys|tiheys|kompakti|tiivis|väljä|ilmava|tasapainoinen)\b/iu;
const structuralMutationPattern =
  /\b(?:rebuild|redesign|reorder|replace|add|remove|change|modify|alter|muuta|uudista|järjestä|lisää|poista|korvaa)\b[^.!?]{0,100}\b(?:layout|page\s+structure|sections?|components?|recipes?|variants?|hero|collection\s+(?:layout|presentation)|product-detail\s+(?:layout|presentation)|asettelu|sivurakenne|osiot?|komponentit?|reseptit?|variantit?)\b/iu;

const fontAliases: ReadonlyArray<{
  token: FontToken;
  pattern: RegExp;
}> = [
  { token: "system-sans", pattern: /system[\s-]+sans|järjestelmän groteski/iu },
  { token: "system-serif", pattern: /system[\s-]+serif|järjestelmän antiikva/iu },
  { token: "georgia", pattern: /\bgeorgia\b/iu },
  { token: "inter", pattern: /\binter\b/iu },
];

const headingRolePattern = /headings?|heading\s+font|otsikot?|otsikkofontti/iu;
const bodyRolePattern = /body\s+(?:font|type|copy|text)|bodyfont|leipäteksti|leipätekstifontti/iu;

function fontNearRole(instruction: string, rolePattern: RegExp): FontToken | null {
  const candidates: Array<{ token: FontToken; distance: number; priority: number }> = [];
  for (const alias of fontAliases) {
    const roleThenFont = new RegExp(
      `(?:${rolePattern.source})[^.!?]{0,48}(?:${alias.pattern.source})`,
      "iu",
    );
    const fontThenRole = new RegExp(
      `(?:${alias.pattern.source})[^.!?]{0,48}(?:${rolePattern.source})`,
      "iu",
    );
    const roleThenMatch = roleThenFont.exec(instruction);
    const fontThenMatch = fontThenRole.exec(instruction);
    if (roleThenMatch) {
      candidates.push({ token: alias.token, distance: roleThenMatch[0].length, priority: 1 });
    }
    if (fontThenMatch) {
      candidates.push({ token: alias.token, distance: fontThenMatch[0].length, priority: 0 });
    }
  }
  return (
    candidates.sort(
      (left, right) => left.priority - right.priority || left.distance - right.distance,
    )[0]?.token ?? null
  );
}

function typographyForInstruction(
  instruction: string,
  current: BrandSystem["typography"],
): BrandSystem["typography"] | null {
  const normalized = instruction.normalize("NFC").toLocaleLowerCase();
  const hasTypographyIntent =
    /\b(?:typography|fonts?|headings?|body\s+(?:font|type|text)|typografia|fontit?|otsikot?|leipäteksti)\b/iu.test(
      normalized,
    );
  if (!hasTypographyIntent) return null;

  let headingFont = fontNearRole(normalized, headingRolePattern);
  let bodyFont = fontNearRole(normalized, bodyRolePattern);
  if (
    /(?:high[\s-]+contrast\s+editorial\s+serif|editorial\s+contrast|toimituksellinen\s+kontrasti)/iu.test(
      normalized,
    )
  ) {
    headingFont = "system-serif";
    bodyFont ??= "system-sans";
  } else if (/refined serif|hienostunut antiikva/iu.test(normalized)) {
    headingFont ??= "georgia";
    bodyFont ??= "inter";
  } else if (
    /modern sans|clean sans(?:-serif)?|moderni groteski|selkeä\p{L}* groteski\p{L}*/iu.test(
      normalized,
    )
  ) {
    headingFont ??= "system-sans";
    bodyFont ??= "system-sans";
  } else if (/technical(?: and)? functional|tekninen ja käytännöllinen/iu.test(normalized)) {
    headingFont ??= "inter";
    bodyFont ??= "system-sans";
  } else if (/warm approachable|lämmin ja helposti lähestyttävä/iu.test(normalized)) {
    headingFont ??= "georgia";
    bodyFont ??= "system-sans";
  }
  if (/elegant serif|elegantti antiikva/iu.test(normalized)) {
    headingFont = "georgia";
  }
  if (/clean(?:\s+modern)?\s+sans(?:-serif)?|selkeä\p{L}* groteski\p{L}*/iu.test(normalized)) {
    bodyFont = "system-sans";
  }
  if (headingFont === null && bodyFont === null) {
    throw new BrandPaletteInstructionError(
      "Choose approved heading and body typography tokens for this refinement.",
    );
  }
  const actionableHeadingWeight = normalized.replace(
    /\b(?:do\s+not|don't|avoid|without|älä\s+käytä|vältä|ilman)\b[^.!?]{0,48}\b(?:bold|strong|lihavoit\p{L}*|vahvo\p{L}*)\b[^.!?]{0,32}\b(?:headings?|otsiko\p{L}*)\b/giu,
    "",
  );
  const boldHeadings =
    /\b(?:bold|strong)\b[^.!?]{0,32}\bheadings?\b|\bheadings?\b[^.!?]{0,32}\b(?:bold|strong)\b/iu.test(
      actionableHeadingWeight,
    );
  return {
    ...structuredClone(current),
    ...(headingFont === null ? {} : { headingFont }),
    ...(bodyFont === null ? {} : { bodyFont }),
    ...(boldHeadings ? { headingWeight: 700 as const } : {}),
  };
}

function spacingForInstruction(instruction: string): BrandSystem["spacing"] | null {
  const normalized = instruction.normalize("NFC").toLocaleLowerCase();
  const mentionsSpacing = /\b(?:spacing|density|välistys|tiheys)\b/iu.test(normalized);
  const preservationOnly =
    /\b(?:preserve|keep|leave)\b[^.!?]{0,160}\b(?:spacing|density)\b/iu.test(normalized) ||
    /\bdo not change\b[^.!?]{0,80}\b(?:spacing|density)\b/iu.test(normalized) ||
    /\b(?:säilytä|pidä|jätä)\b[^.!?]{0,160}\b(?:välistys|tiheys)\b/iu.test(normalized) ||
    /\bälä muuta\b[^.!?]{0,80}\b(?:välistys|tiheys)\b/iu.test(normalized);
  const densityMatches = [
    ...normalized.matchAll(
      /\b(compact|dense|kompakti|tiivis|spacious|airy|väljä|ilmava|balanced|standard|tasapainoinen|normaali)\b/giu,
    ),
  ];
  const explicitDensity = densityMatches
    .map((match) => {
      const before = normalized.slice(Math.max(0, (match.index ?? 0) - 100), match.index);
      const around = normalized.slice(
        Math.max(0, (match.index ?? 0) - 40),
        Math.min(normalized.length, (match.index ?? 0) + match[0].length + 40),
      );
      const actionable =
        /\b(?:use|make|set|apply|change(?:\s+to)?|adjust(?:\s+to)?|käytä|tee|aseta|muuta|säädä)\b[^.!?]{0,80}$/iu.test(
          before,
        ) &&
        (/\b(?:spacing|density|välistys|tiheys)\b/iu.test(around) ||
          !/\b(?:headings?|otsikot?)\b/iu.test(around));
      return actionable ? match[1] : undefined;
    })
    .filter((value): value is string => value !== undefined)
    .at(-1);
  if (explicitDensity !== undefined) {
    if (/^(?:compact|dense|kompakti|tiivis)$/iu.test(explicitDensity))
      return { density: "compact" };
    if (/^(?:spacious|airy|väljä|ilmava)$/iu.test(explicitDensity)) return { density: "airy" };
    return { density: "balanced" };
  }
  if (!mentionsSpacing || preservationOnly) return null;
  throw new BrandPaletteInstructionError(
    "Choose compact, balanced, or spacious spacing for this refinement.",
  );
}

function paletteInstructionForSemanticRequest(instruction: string): string {
  const requestsWarmNaturalPalette =
    /\b(?:warmer|warm|natural|approachable|lämmin|lämpimämpi|luonnollinen|lähestyttävä)\b/iu.test(
      instruction,
    ) &&
    /\b(?:palette|colou?rs?|väripaletti|värit?)\b/iu.test(instruction) &&
    !/#[0-9a-f]{6}\b/iu.test(instruction);
  if (!requestsWarmNaturalPalette) return instruction;
  return [
    instruction,
    "Use primary terracotta, secondary sage, accent soft gold, background warm off-white,",
    "surface white, text charcoal, muted text charcoal, and border beige.",
  ].join(" ");
}

export function planRegisteredTokenRefinement(
  instruction: string,
  currentBrandSystem: BrandSystem,
): RegisteredTokenRefinementPlan | null {
  if (!tokenIntentPattern.test(instruction) || structuralMutationPattern.test(instruction)) {
    return null;
  }
  if (containsProtectedCommerceMutation(instruction)) {
    throw new BrandPaletteInstructionError(
      "Protected commerce data cannot be changed by a storefront token refinement.",
    );
  }
  try {
    assertNoExecutableContent(instruction);
  } catch {
    throw new BrandPaletteInstructionError(
      "Token refinements must use ordinary colour, typography, and spacing instructions.",
    );
  }
  const palette = planExactBrandPalette(
    paletteInstructionForSemanticRequest(instruction),
    currentBrandSystem.colors,
    {
      allowTokenCompanions: true,
    },
  );
  const typography = typographyForInstruction(instruction, currentBrandSystem.typography);
  const spacing = spacingForInstruction(instruction);
  if (palette === null && typography === null && spacing === null) return null;
  return registeredTokenRefinementPlanSchema.parse({
    palette,
    typography,
    spacing,
    preservePageStructure: true,
    preserveComponentVariants: true,
    preserveApprovedAssets: true,
    preserveCanonicalCommerce: true,
  });
}
