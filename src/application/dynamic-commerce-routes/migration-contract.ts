import type { DynamicCommercePresentationAuthority, StorefrontSnapshot } from "@/domain/storefront";

export type DynamicCommerceMigrationDecision = Readonly<{
  code:
    | "missing-route-identity"
    | "missing-catalogue-identity"
    | "missing-profile-identity"
    | "unknown-profile"
    | "unknown-commerce-identity"
    | "invalid-route-namespace"
    | "route-family-component-mismatch"
    | "invalid-legacy-schema"
    | "unsupported-legacy-layout"
    | "conflicting-legacy-presentation"
    | "conflicting-product-type-mapping"
    | "dynamic-parent-reference";
  routeIds: readonly string[];
  message: string;
}>;

export type DynamicCommerceMigrationResult =
  | Readonly<{
      status: "current";
      snapshot: StorefrontSnapshot;
      authority: DynamicCommercePresentationAuthority;
    }>
  | Readonly<{
      status: "migrated";
      snapshot: StorefrontSnapshot;
      authority: DynamicCommercePresentationAuthority;
      migratedRouteCount: number;
    }>
  | Readonly<{
      status: "requires-decision";
      snapshot: StorefrontSnapshot;
      decisions: readonly DynamicCommerceMigrationDecision[];
    }>;

export class DynamicCommerceMigrationError extends Error {
  constructor(readonly decisions: readonly DynamicCommerceMigrationDecision[]) {
    super("Legacy dynamic-commerce pages require an explicit migration decision.");
    this.name = "DynamicCommerceMigrationError";
  }
}
