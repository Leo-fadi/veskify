import "server-only";

import {
  SourceDiscoveryApplicationError,
  type SourceDiscoveryAdapter,
  type SourceDiscoveryAdapterInput,
} from "@/application/source-discovery";
import {
  assetCandidateSchema,
  sourceDiscoveryResultSchema,
  sourceEvidenceSchema,
  sourceReferenceSchema,
  sourceWarningSchema,
  type AssetCandidate,
  type EvidenceKind,
  type SourceDiscoveryResult,
  type SourceEvidence,
  type SourceWarning,
} from "@/domain/source-discovery";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { NodePublicSourceNetwork } from "./node-public-source-network.server";
import { extractPublicHtml, type PublicHtmlAssetCandidate } from "./public-source-html";
import {
  PublicSourceNetworkError,
  type PublicSourceNetwork,
  type PublicSourceNetworkResponse,
} from "./public-source-network";
import {
  assertPublicResolvedAddresses,
  publicSourceHostname,
  validatePublicSourceUrl,
} from "./public-source-security";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const defaultTimeoutMs = 8_000;
const defaultMaxRedirects = 3;
const defaultMaxResponseBytes = 512 * 1024;

export type PublicSourceDiscoveryAdapterOptions = Readonly<{
  network?: PublicSourceNetwork;
  now?: () => string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
}>;

function optionInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < minimum || candidate > maximum) {
    throw new SourceDiscoveryApplicationError(
      "invalid-contract",
      "The public-source discovery limits are invalid.",
    );
  }
  return candidate;
}

function scopedId(prefix: "evidence" | "asset", sourceId: string, identity: unknown): string {
  const fingerprint = canonicalValueFingerprint({ sourceId, identity });
  return `${prefix}_public_${fingerprint.slice(-32)}`;
}

function abortError(
  signal: AbortSignal | undefined,
  timedOut: boolean,
): SourceDiscoveryApplicationError {
  return timedOut
    ? new SourceDiscoveryApplicationError(
        "timeout",
        "The storefront took too long to respond. Try again or continue without source discovery.",
      )
    : new SourceDiscoveryApplicationError(
        signal?.aborted ? "cancelled" : "unavailable-source",
        signal?.aborted
          ? "Storefront discovery was cancelled. Your reviewed progress is unchanged."
          : "The storefront source could not be reached safely.",
      );
}

function mediaTypeFor(url: URL): string | null {
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".ico")) return "image/x-icon";
  return null;
}

function evidence(input: {
  sourceId: string;
  documentUrl: string;
  observedAt: string;
  kind: EvidenceKind;
  observedValue: unknown;
  extractionLocation: string;
  confidence: number;
  locale: "en" | "fi" | null;
  uncertain?: string;
}): SourceEvidence {
  return sourceEvidenceSchema.parse({
    id: scopedId("evidence", input.sourceId, {
      kind: input.kind,
      observedValue: input.observedValue,
      extractionLocation: input.extractionLocation,
    }),
    kind: input.kind,
    provenance: {
      sourceReferenceId: input.sourceId,
      sourceUrl: input.documentUrl,
      documentUrl: input.documentUrl,
      observedAt: input.observedAt,
      extractionLocation: input.extractionLocation,
    },
    sourceUrl: input.documentUrl,
    confidence: input.confidence,
    observedValue: input.observedValue,
    extractionMethod: "bounded-public-html-metadata",
    locale: input.locale,
    warnings: [],
    uncertainty: input.uncertain
      ? { isUncertain: true, reason: input.uncertain }
      : { isUncertain: false, reason: null },
  });
}

function sourceWarning(code: SourceWarning["code"], message: string): SourceWarning {
  return sourceWarningSchema.parse({ code, message });
}

function pageIdentityValue(input: {
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  declaredLanguage: string | null;
  canonicalUrl: string | null;
}): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      finalFetchedUrl: input.finalUrl,
      documentTitle: input.title,
      metaDescription: input.metaDescription,
      openGraphTitle: input.openGraphTitle,
      openGraphDescription: input.openGraphDescription,
      declaredLanguage: input.declaredLanguage,
      canonicalUrl: input.canonicalUrl,
    }).filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

function responseContentType(response: PublicSourceNetworkResponse): string {
  return response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export class PublicSourceDiscoveryAdapter implements SourceDiscoveryAdapter {
  readonly id = "bounded-public-source-discovery";
  readonly #network: PublicSourceNetwork;
  readonly #now: () => string;
  readonly #timeoutMs: number;
  readonly #maxRedirects: number;
  readonly #maxResponseBytes: number;

  constructor(options: PublicSourceDiscoveryAdapterOptions = {}) {
    this.#network = options.network ?? new NodePublicSourceNetwork();
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#timeoutMs = optionInteger(options.timeoutMs, defaultTimeoutMs, 100, 60_000);
    this.#maxRedirects = optionInteger(options.maxRedirects, defaultMaxRedirects, 0, 10);
    this.#maxResponseBytes = optionInteger(
      options.maxResponseBytes,
      defaultMaxResponseBytes,
      1_024,
      5 * 1024 * 1024,
    );
  }

  async discover(input: SourceDiscoveryAdapterInput): Promise<SourceDiscoveryResult> {
    validatePublicSourceUrl(input.source.url);
    const source = sourceReferenceSchema.parse(input.source);
    if (source.allowedDiscoveryPolicy.mode !== "bounded-public") {
      throw new SourceDiscoveryApplicationError(
        "invalid-contract",
        "Public-source discovery requires the bounded public policy.",
      );
    }
    const timeoutController = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, this.#timeoutMs);
    const cancel = () => timeoutController.abort();
    input.signal?.addEventListener("abort", cancel, { once: true });

    try {
      const { response, finalUrl } = await this.#fetchDocument(source, timeoutController.signal);
      const observedAt = this.#now();
      const html = new TextDecoder("utf-8", { fatal: false }).decode(response.body);
      const extracted = extractPublicHtml(html);
      if (!extracted.hasRecognizedHtml) {
        throw new SourceDiscoveryApplicationError(
          "no-reusable-evidence",
          "The public page did not contain reusable HTML evidence.",
        );
      }
      const warnings: SourceWarning[] = [
        sourceWarning(
          "limited-pages",
          "Only one bounded public page was inspected; this is not a full-site crawl.",
        ),
      ];
      const declaredLocale = extracted.declaredLanguage?.split("-", 1)[0]?.toLowerCase();
      const locale = declaredLocale === "en" || declaredLocale === "fi" ? declaredLocale : null;
      if (locale === null) {
        warnings.push(
          sourceWarning(
            "missing-locale",
            "The page did not declare a supported English or Finnish language.",
          ),
        );
      }
      const canonicalUrl = await this.#safeCanonicalUrl(
        extracted.canonicalUrl,
        finalUrl,
        source.normalizedOrigin,
        timeoutController.signal,
        warnings,
      );
      const evidenceItems: SourceEvidence[] = [];
      if (
        extracted.title ||
        extracted.metaDescription ||
        extracted.openGraphTitle ||
        extracted.openGraphDescription ||
        extracted.declaredLanguage ||
        canonicalUrl
      ) {
        evidenceItems.push(
          evidence({
            sourceId: source.id,
            documentUrl: finalUrl.toString(),
            observedAt,
            kind: "page-identity",
            observedValue: pageIdentityValue({
              finalUrl: finalUrl.toString(),
              title: extracted.title,
              metaDescription: extracted.metaDescription,
              openGraphTitle: extracted.openGraphTitle,
              openGraphDescription: extracted.openGraphDescription,
              declaredLanguage: extracted.declaredLanguage,
              canonicalUrl,
            }),
            extractionLocation: "document head metadata",
            confidence: 0.95,
            locale,
          }),
        );
      }
      for (const brandName of extracted.brandNameCandidates) {
        evidenceItems.push(
          evidence({
            sourceId: source.id,
            documentUrl: finalUrl.toString(),
            observedAt,
            kind: "merchant-brand-fact",
            observedValue: brandName,
            extractionLocation: "Open Graph site name or visible primary heading",
            confidence: extracted.openGraphSiteName === brandName ? 0.88 : 0.65,
            locale,
            uncertain:
              extracted.openGraphSiteName === brandName
                ? undefined
                : "Confirm that the visible heading is the merchant brand name.",
          }),
        );
      }
      for (const copy of extracted.marketingCopyCandidates) {
        evidenceItems.push(
          evidence({
            sourceId: source.id,
            documentUrl: finalUrl.toString(),
            observedAt,
            kind: "marketing-copy-candidate",
            observedValue: copy,
            extractionLocation: "description metadata or visible heading/body copy",
            confidence: 0.72,
            locale,
            uncertain: "Review public marketing copy before reusing it.",
          }),
        );
      }
      if (extracted.themeColour) {
        evidenceItems.push(
          evidence({
            sourceId: source.id,
            documentUrl: finalUrl.toString(),
            observedAt,
            kind: "colour-signal",
            observedValue: extracted.themeColour,
            extractionLocation: "head meta[name=theme-color]",
            confidence: 0.82,
            locale: null,
          }),
        );
      }
      const assets = await this.#assetCandidates(
        source,
        finalUrl,
        extracted.assets,
        observedAt,
        timeoutController.signal,
        warnings,
      );
      for (const asset of assets) {
        evidenceItems.push(
          evidence({
            sourceId: source.id,
            documentUrl: finalUrl.toString(),
            observedAt,
            kind: asset.role === "logo" ? "logo-candidate" : "reusable-asset",
            observedValue: { assetId: asset.id, role: asset.role },
            extractionLocation: asset.provenance.extractionLocation,
            confidence: asset.confidence,
            locale: null,
            uncertain: "Merchant approval is required before this public asset can be reused.",
          }),
        );
      }
      if (evidenceItems.length === 0 && assets.length === 0) {
        throw new SourceDiscoveryApplicationError(
          "no-reusable-evidence",
          "The public page did not contain reusable storefront evidence.",
        );
      }
      const completedSource = sourceReferenceSchema.parse({
        ...source,
        status: warnings.length > 0 ? "partial" : "complete",
        warnings,
        failure: null,
      });
      return sourceDiscoveryResultSchema.parse({
        source: completedSource,
        evidence: evidenceItems,
        assetCandidates: assets,
        warnings,
      });
    } catch (error) {
      if (error instanceof SourceDiscoveryApplicationError) throw error;
      if (error instanceof PublicSourceNetworkError && error.reason === "response-too-large") {
        throw new SourceDiscoveryApplicationError(
          "blocked-source",
          "The storefront page is larger than the safe discovery limit.",
        );
      }
      if (
        timeoutController.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw abortError(input.signal, timedOut);
      }
      throw new SourceDiscoveryApplicationError(
        "unavailable-source",
        "The storefront source could not be reached safely.",
      );
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", cancel);
    }
  }

  async #fetchDocument(
    source: SourceDiscoveryAdapterInput["source"],
    signal: AbortSignal,
  ): Promise<{ response: PublicSourceNetworkResponse; finalUrl: URL }> {
    let currentUrl = validatePublicSourceUrl(source.url);
    const visited = new Set<string>();
    for (let redirectCount = 0; ; redirectCount += 1) {
      if (visited.has(currentUrl.toString())) {
        throw new SourceDiscoveryApplicationError(
          "blocked-source",
          "The storefront returned an unsafe redirect loop.",
        );
      }
      visited.add(currentUrl.toString());
      const addresses = await this.#network.resolve(publicSourceHostname(currentUrl), signal);
      assertPublicResolvedAddresses(addresses.map((address) => address.address));
      const response = await this.#network.request({
        url: currentUrl,
        resolvedAddresses: addresses,
        headers: {
          accept: "text/html, application/xhtml+xml;q=0.9",
          "accept-language": `${source.requestedLocale}, en;q=0.8`,
          "cache-control": "no-cache",
          "user-agent": "VeskifyPublicSourceDiscovery/1.0",
        },
        maxBytes: this.#maxResponseBytes,
        signal,
      });
      if (response.body.byteLength > this.#maxResponseBytes) {
        throw new PublicSourceNetworkError(
          "response-too-large",
          "The public source response exceeds the configured size limit.",
        );
      }
      if (redirectStatuses.has(response.status)) {
        if (redirectCount >= this.#maxRedirects) {
          throw new SourceDiscoveryApplicationError(
            "blocked-source",
            "The storefront exceeded the safe redirect limit.",
          );
        }
        const location = response.headers.location;
        if (!location) {
          throw new SourceDiscoveryApplicationError(
            "unavailable-source",
            "The storefront returned an incomplete redirect response.",
          );
        }
        const target = validatePublicSourceUrl(new URL(location, currentUrl).toString());
        if (
          source.allowedDiscoveryPolicy.followSameOriginOnly &&
          target.origin !== source.normalizedOrigin
        ) {
          throw new SourceDiscoveryApplicationError(
            "blocked-source",
            "The storefront redirected to a different site that cannot be inspected safely.",
          );
        }
        currentUrl = target;
        continue;
      }
      if ([401, 403, 451].includes(response.status)) {
        throw new SourceDiscoveryApplicationError(
          "blocked-source",
          "The storefront does not permit public-source discovery.",
        );
      }
      if (response.status < 200 || response.status >= 300) {
        throw new SourceDiscoveryApplicationError(
          "unavailable-source",
          "The storefront page is currently unavailable.",
        );
      }
      const robotsPolicy = response.headers["x-robots-tag"]?.toLowerCase() ?? "";
      if (/\b(?:none|noindex)\b/.test(robotsPolicy)) {
        throw new SourceDiscoveryApplicationError(
          "blocked-source",
          "The storefront declares that this page must not be indexed or reused.",
        );
      }
      const contentEncoding = response.headers["content-encoding"]?.toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw new SourceDiscoveryApplicationError(
          "blocked-source",
          "The storefront returned a content encoding that cannot be inspected safely.",
        );
      }
      const contentType = responseContentType(response);
      if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
        throw new SourceDiscoveryApplicationError(
          "blocked-source",
          "The storefront did not return a supported HTML document.",
        );
      }
      if (response.body.byteLength === 0) {
        throw new SourceDiscoveryApplicationError(
          "no-reusable-evidence",
          "The storefront returned an empty public page.",
        );
      }
      return { response, finalUrl: currentUrl };
    }
  }

  async #safeCanonicalUrl(
    rawUrl: string | null,
    documentUrl: URL,
    requestedOrigin: string,
    signal: AbortSignal,
    warnings: SourceWarning[],
  ): Promise<string | null> {
    if (!rawUrl) return null;
    try {
      const url = validatePublicSourceUrl(new URL(rawUrl, documentUrl).toString());
      if (url.origin !== requestedOrigin) {
        warnings.push(
          sourceWarning(
            "uncertain-evidence",
            "A cross-origin canonical URL was omitted from source evidence.",
          ),
        );
        return null;
      }
      const addresses = await this.#network.resolve(publicSourceHostname(url), signal);
      assertPublicResolvedAddresses(addresses.map((address) => address.address));
      return url.toString();
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      warnings.push(
        sourceWarning("uncertain-evidence", "An unsafe canonical URL was omitted from evidence."),
      );
      return null;
    }
  }

  async #assetCandidates(
    source: SourceDiscoveryAdapterInput["source"],
    documentUrl: URL,
    candidates: readonly PublicHtmlAssetCandidate[],
    observedAt: string,
    signal: AbortSignal,
    warnings: SourceWarning[],
  ): Promise<AssetCandidate[]> {
    const assets: AssetCandidate[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (assets.length >= source.allowedDiscoveryPolicy.maxAssets) {
        warnings.push(
          sourceWarning("limited-assets", "Additional public asset candidates were omitted."),
        );
        break;
      }
      try {
        const url = validatePublicSourceUrl(new URL(candidate.url, documentUrl).toString());
        if (url.origin !== source.normalizedOrigin) {
          warnings.push(
            sourceWarning(
              "unreusable-asset",
              "A cross-origin public asset candidate was omitted pending a dedicated media policy.",
            ),
          );
          continue;
        }
        if (seen.has(url.toString())) continue;
        const addresses = await this.#network.resolve(publicSourceHostname(url), signal);
        assertPublicResolvedAddresses(addresses.map((address) => address.address));
        seen.add(url.toString());
        const role = candidate.kind === "open-graph-image" ? "hero" : "logo";
        const confidence = candidate.kind === "logo" ? 0.82 : 0.62;
        assets.push(
          assetCandidateSchema.parse({
            id: scopedId("asset", source.id, { url: url.toString(), role }),
            role,
            source: { kind: "source-url", url: url.toString() },
            dimensions: null,
            mediaType: mediaTypeFor(url),
            provenance: {
              sourceReferenceId: source.id,
              sourceUrl: url.toString(),
              documentUrl: documentUrl.toString(),
              observedAt,
              extractionLocation: candidate.extractionLocation,
            },
            confidence,
            proposedReusePurpose:
              role === "logo"
                ? "Review as a merchant logo or site icon before reuse."
                : "Review as a possible storefront hero image before reuse.",
            licensingUsageConfirmation: "pending",
            warnings: [],
            uncertainty: {
              isUncertain: true,
              reason: "Ownership, licensing and merchant approval must be confirmed before reuse.",
            },
            fingerprint: null,
            duplicateOfAssetId: null,
          }),
        );
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
        warnings.push(
          sourceWarning("unreusable-asset", "An unsafe public asset candidate was omitted."),
        );
      }
    }
    return assets;
  }
}

export function createPublicSourceDiscoveryAdapter(
  options: PublicSourceDiscoveryAdapterOptions = {},
): SourceDiscoveryAdapter {
  return new PublicSourceDiscoveryAdapter(options);
}
