const protectedStorefrontClaimPatterns = [
  /(?:[$€£¥]\s*\d|\b\d+(?:[.,]\d{1,2})?\s*(?:[$€£¥]|EUR|USD|GBP|SEK|NOK|DKK))/i,
  /\b\d+(?:[.,]\d{1,2})?\s*(?:euros?|dollars?|pounds?|kron(?:a|or|er)?)\b/i,
  /\b(?:costs?|priced at|price of)\s+\d+(?:[.,]\d{1,2})?\b/i,
  /\b(?:half|quarter)[- ]price\b/i,
  /\b\d+(?:[.,]\d+)?\s*%\s*(?:off|discount)\b/i,
  /\b(?:in stock|out of stock|available now|limited stock|only \d+ left)\b/i,
  /\bready to ship\b/i,
  /\b(?:free shipping|same[- ]day delivery|next[- ]day delivery|ships? within|delivery (?:within|in) \d+|guaranteed delivery)\b/i,
  /\b(?:ships?|shipping|delivery)\b.{0,24}\b(?:in|within|takes?)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:business\s+)?(?:hours?|days?|weeks?)\b/i,
  /\b(?:certified|certification|compliant|compliance|warranty|warranties|guaranteed)\b/i,
  /\b(?:asset|product|collection|variant|sku)[:_][a-z0-9][a-z0-9_-]{2,}\b/i,
  /\bsku\s*(?:[:#=_-]\s*|\s+)(?=[a-z0-9_-]{3,}\b)(?=[a-z0-9_-]*(?:\d|-))[a-z0-9][a-z0-9_-]{2,}\b/i,
  /\b\d+(?:[.,]\d{1,2})?\s*(?:euroa?|dollaria|puntaa|kruunua)(?![\p{L}\p{N}_])/iu,
  /\b(?:maksaa|hinta on|hintaan)\s+\d+(?:[.,]\d{1,2})?\b/iu,
  /\b(?:varastossa|loppu varastosta|saatavilla nyt|vain \d+ jäljellä)(?![\p{L}\p{N}_])/iu,
  /\b(?:ilmainen toimitus|taattu toimitus)\b/iu,
  /\b(?:toimitetaan|toimitus)\b.{0,28}\b(?:tunnissa|päivässä|viikossa)(?![\p{L}\p{N}_])/iu,
  /\b(?:takuu|sertifioitu|sertifiointi|vaatimustenmukainen)\b/iu,
  /\b\d+(?:[.,]\d+)?\s*%\s*(?:alennus|pois)\b/iu,
] as const;

/**
 * Detects provider-authored commerce, policy, service, certification, and
 * canonical-identity claims that cannot be grounded by the transient concept
 * prose. Registered capability references are validated separately.
 */
export function containsProtectedStorefrontClaimContent(value: unknown): boolean {
  if (typeof value === "string") {
    return protectedStorefrontClaimPatterns.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(containsProtectedStorefrontClaimContent);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsProtectedStorefrontClaimContent);
  }
  return false;
}
