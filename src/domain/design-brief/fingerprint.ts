import { canonicalValueString } from "@/domain/storefront";
import { storefrontDesignBriefSchema, type StorefrontDesignBrief } from "./storefront-design-brief";

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprints every validated canonical brief field for source-version binding. */
export function createStorefrontDesignBriefFingerprint(input: StorefrontDesignBrief): string {
  const brief = storefrontDesignBriefSchema.parse(input);
  return `brief-v1_${stableHash(canonicalValueString(brief))}`;
}
