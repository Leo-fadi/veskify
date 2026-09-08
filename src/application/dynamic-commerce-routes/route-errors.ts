export const dynamicCommerceRouteAuthorityErrorCodes = [
  "missing-authority",
  "stale-authority",
  "unknown-route",
  "unknown-commerce-identity",
  "unknown-archetype",
  "stale-profile",
  "incompatible-shared-frame",
  "invalid-presentation",
] as const;

export type DynamicCommerceRouteAuthorityErrorCode =
  (typeof dynamicCommerceRouteAuthorityErrorCodes)[number];

export class DynamicCommerceRouteAuthorityError extends Error {
  constructor(
    readonly code: DynamicCommerceRouteAuthorityErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DynamicCommerceRouteAuthorityError";
  }
}
