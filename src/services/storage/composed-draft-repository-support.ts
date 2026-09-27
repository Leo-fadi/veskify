import type { StorefrontSnapshot } from "@/domain/storefront/storefront";
import type { DraftBaseIdentity, ProjectAggregate } from "./project-repository";

/** Trusted material only; callers cannot supply executable validation callbacks. */
export type ComposedStaticDraftAuthorityMaterial = Readonly<{
  owner: Readonly<{ kind: "static-page"; id: string }>;
  candidate: unknown;
  requiredAssetRoleCapacityEvidence: unknown;
}>;

export type ComposedStaticDraftOperations = Readonly<{
  validateSnapshot: (
    input: unknown,
    aggregate: Pick<ProjectAggregate, "project" | "catalogue">,
  ) => StorefrontSnapshot;
  assertSave: (
    input: StorefrontSnapshot,
    current: StorefrontSnapshot,
    aggregate: ProjectAggregate,
    expected?: DraftBaseIdentity,
  ) => void;
}>;

export type ComposedStaticDraftCapability = Readonly<Record<never, never>>;
const operationsByCapability = new WeakMap<object, ComposedStaticDraftOperations>();

export async function createComposedStaticDraftCapability(
  authority: readonly ComposedStaticDraftAuthorityMaterial[],
): Promise<ComposedStaticDraftCapability> {
  const retained = structuredClone(authority);
  const { createComposedStaticDraftOperations } =
    await import("@/application/draft-save/composed-draft-validation");
  const token = Object.freeze({});
  operationsByCapability.set(token, createComposedStaticDraftOperations(retained));
  return token;
}

/** Lookup cannot mint a capability or install caller-supplied operations. */
export function lookupComposedStaticDraftOperations(
  capability: object,
): ComposedStaticDraftOperations | undefined {
  return operationsByCapability.get(capability);
}
