import { localeSchema, type Locale } from "@/domain/shared";
import {
  STOREFRONT_SEARCH_DEFAULT_PAGE_SIZE,
  STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
  StorefrontSearchError,
  storefrontSearchRequestV1Schema,
  type StorefrontSearchFilterSelectionV1,
  type StorefrontSearchRequestV1,
  type StorefrontSearchSort,
} from "./contract";
import { normalizeStorefrontSearchFilters } from "./query";

export const STOREFRONT_SEARCH_SAFE_SESSION_PARAMETER_NAMES = [
  "p9-05b-session",
  "p10b-16p-04-proposal",
  "p10b-16p-04-utility",
] as const;

export const P10B16P04_SEARCH_UTILITY_CONTEXTS = ["empty", "populated"] as const;
export type P10B16P04SearchUtilityContext = (typeof P10B16P04_SEARCH_UTILITY_CONTEXTS)[number];

type SafeSessionParameterName = (typeof STOREFRONT_SEARCH_SAFE_SESSION_PARAMETER_NAMES)[number];

export type StorefrontSearchHiddenInput = Readonly<{ name: string; value: string }>;

export function isP10B16P04SearchUtilityContext(
  value: string,
): value is P10B16P04SearchUtilityContext {
  return P10B16P04_SEARCH_UTILITY_CONTEXTS.some((candidate) => candidate === value);
}

function routeTarget(routePath: string): {
  action: string;
  safeSessionInputs: StorefrontSearchHiddenInput[];
} {
  if (!routePath.startsWith("/") || routePath.startsWith("//") || routePath.includes("#")) {
    throw new StorefrontSearchError(
      "invalid-request",
      "Search routes must be local absolute paths.",
    );
  }
  if (/%(?![0-9A-Fa-f]{2})/u.test(routePath)) {
    throw new StorefrontSearchError(
      "invalid-request",
      "The search route contains malformed encoding.",
    );
  }
  const target = new URL(routePath, "https://veskify.invalid");
  const safeSessionInputs: StorefrontSearchHiddenInput[] = [];
  for (const name of STOREFRONT_SEARCH_SAFE_SESSION_PARAMETER_NAMES) {
    const values = target.searchParams.getAll(name);
    if (values.length > 1 || values.some((value) => value.length === 0 || value.length > 500)) {
      throw new StorefrontSearchError(
        "invalid-request",
        `The preserved search session parameter ${name} is invalid.`,
      );
    }
    if (
      name === "p10b-16p-04-utility" &&
      values[0] !== undefined &&
      !isP10B16P04SearchUtilityContext(values[0])
    ) {
      throw new StorefrontSearchError(
        "invalid-request",
        "The preserved search utility context is invalid.",
      );
    }
    if (values[0] !== undefined) safeSessionInputs.push({ name, value: values[0] });
  }
  return { action: target.pathname, safeSessionInputs };
}

export function splitStorefrontSearchFormTarget({
  routePath,
  locale,
}: {
  routePath: string;
  locale: Locale;
}): Readonly<{ action: string; hiddenInputs: readonly StorefrontSearchHiddenInput[] }> {
  const target = routeTarget(routePath);
  return {
    action: target.action,
    hiddenInputs: [
      ...target.safeSessionInputs,
      { name: "locale", value: localeSchema.parse(locale) },
    ],
  };
}

function addFilters(
  parameters: URLSearchParams,
  filters: readonly StorefrontSearchFilterSelectionV1[],
): void {
  for (const filter of normalizeStorefrontSearchFilters(filters)) {
    for (const value of filter.values) parameters.append(`filter.${filter.field}`, value);
  }
}

export function buildStorefrontSearchUrl({
  routePath,
  rawQuery,
  locale,
  page = 1,
  pageSize = STOREFRONT_SEARCH_DEFAULT_PAGE_SIZE,
  sort = "relevance",
  filters = [],
}: {
  routePath: string;
  rawQuery: string;
  locale: Locale;
  page?: number;
  pageSize?: StorefrontSearchRequestV1["pageSize"];
  sort?: StorefrontSearchSort;
  filters?: readonly StorefrontSearchFilterSelectionV1[];
}): string {
  const target = routeTarget(routePath);
  const request = storefrontSearchRequestV1Schema.parse({
    contractVersion: STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
    rawQuery,
    locale,
    page,
    pageSize,
    sort,
    filters,
  });
  const parameters = new URLSearchParams();
  for (const { name, value } of target.safeSessionInputs) parameters.append(name, value);
  if (request.rawQuery !== "") parameters.set("q", request.rawQuery);
  parameters.set("locale", request.locale);
  if (request.page !== 1) parameters.set("page", String(request.page));
  if (request.pageSize !== STOREFRONT_SEARCH_DEFAULT_PAGE_SIZE) {
    parameters.set("pageSize", String(request.pageSize));
  }
  if (request.sort !== "relevance") parameters.set("sort", request.sort);
  addFilters(parameters, request.filters);
  const query = parameters.toString();
  return query === "" ? target.action : `${target.action}?${query}`;
}

export function safeSearchSessionParameterName(name: string): name is SafeSessionParameterName {
  return STOREFRONT_SEARCH_SAFE_SESSION_PARAMETER_NAMES.some((candidate) => candidate === name);
}
