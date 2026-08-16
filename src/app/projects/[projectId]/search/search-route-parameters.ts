import {
  STOREFRONT_SEARCH_DEFAULT_PAGE_SIZE,
  STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
  isP10B16P04SearchUtilityContext,
  storefrontSearchRequestV1Schema,
  type P10B16P04SearchUtilityContext,
  type StorefrontSearchRequestV1,
} from "@/application/storefront-search";
import type { Locale } from "@/domain/shared";

export type StorefrontSearchRouteParameters = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export type StorefrontSearchContextParameter =
  Readonly<{ valid: true; value?: string }> | Readonly<{ valid: false }>;

/** Strictly reads one optional opaque server-authority/session identity. */
export function parseStorefrontSearchContextParameter(
  parameters: StorefrontSearchRouteParameters,
  name: "p9-05b-session" | "p10b-16p-04-proposal" | "p10b-16p-04-utility",
): StorefrontSearchContextParameter {
  const value = parameters[name];
  if (value === undefined) return { valid: true };
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    return { valid: false };
  }
  return { valid: true, value };
}

export function parseStorefrontSearchUtilityContextParameter(
  parameters: StorefrontSearchRouteParameters,
): Readonly<{ valid: true; value?: P10B16P04SearchUtilityContext }> | Readonly<{ valid: false }> {
  const parsed = parseStorefrontSearchContextParameter(parameters, "p10b-16p-04-utility");
  if (!parsed.valid) return { valid: false };
  const value = parsed.value;
  if (value === undefined) return { valid: true };
  return isP10B16P04SearchUtilityContext(value) ? { valid: true, value } : { valid: false };
}

function single(parameters: StorefrontSearchRouteParameters, name: string): string | undefined {
  const value = parameters[name];
  return typeof value === "string" ? value : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return /^[1-9][0-9]*$/u.test(value) ? Number(value) : Number.NaN;
}

function filters(parameters: StorefrontSearchRouteParameters): unknown[] {
  return Object.entries(parameters).flatMap(([name, rawValues]) => {
    if (!name.startsWith("filter.")) return [];
    const field = name.slice("filter.".length);
    const values = typeof rawValues === "string" ? [rawValues] : [...(rawValues ?? [])];
    return [{ field, values }];
  });
}

/**
 * Converts decoded Next.js query parameters into the strict transient search request. Unknown
 * unrelated parameters are ignored; malformed supported parameters fail safely.
 */
export function parseStorefrontSearchRouteRequest({
  parameters,
  primaryLocale,
  enabledLocales,
}: {
  parameters: StorefrontSearchRouteParameters;
  primaryLocale: Locale;
  enabledLocales: readonly Locale[];
}): StorefrontSearchRequestV1 | undefined {
  if (["q", "locale", "page", "pageSize", "sort"].some((name) => Array.isArray(parameters[name]))) {
    return undefined;
  }
  const requestedLocale = single(parameters, "locale") ?? primaryLocale;
  if (!enabledLocales.some((locale) => locale === requestedLocale)) return undefined;
  const pageSize = positiveInteger(
    single(parameters, "pageSize"),
    STOREFRONT_SEARCH_DEFAULT_PAGE_SIZE,
  );
  const parsed = storefrontSearchRequestV1Schema.safeParse({
    contractVersion: STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
    rawQuery: single(parameters, "q") ?? "",
    locale: requestedLocale,
    page: positiveInteger(single(parameters, "page"), 1),
    pageSize,
    sort: single(parameters, "sort") ?? "relevance",
    filters: filters(parameters),
  });
  return parsed.success ? parsed.data : undefined;
}
