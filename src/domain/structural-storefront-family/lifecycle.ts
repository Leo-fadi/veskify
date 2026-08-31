import { z } from "zod";
import {
  structuralStorefrontFamilyIdSchema,
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontFamilyVersionSchema,
  type StructuralStorefrontFamilyIdentityV1,
} from "./identity";

export const structuralStorefrontFamilyLifecycleStates = Object.freeze([
  "candidate",
  "active",
  "deprecated",
] as const);
export const structuralStorefrontFamilyLifecycleStateSchema = z.enum(
  structuralStorefrontFamilyLifecycleStates,
);
export type StructuralStorefrontFamilyLifecycleState = z.infer<
  typeof structuralStorefrontFamilyLifecycleStateSchema
>;

export const STRUCTURAL_STOREFRONT_FAMILY_INITIAL_LIFECYCLE_STATE = "candidate" as const;

export type StructuralStorefrontFamilyLifecycleTransitionPolicy = Readonly<{
  from: StructuralStorefrontFamilyLifecycleState;
  to: StructuralStorefrontFamilyLifecycleState;
  activationAuthorityRequirement: "future-governed-activation-required" | "none";
}>;

export const structuralStorefrontFamilyLifecycleTransitionPolicies: readonly StructuralStorefrontFamilyLifecycleTransitionPolicy[] =
  Object.freeze([
    Object.freeze({
      from: "candidate",
      to: "active",
      activationAuthorityRequirement: "future-governed-activation-required",
    }),
    Object.freeze({
      from: "candidate",
      to: "deprecated",
      activationAuthorityRequirement: "none",
    }),
    Object.freeze({
      from: "active",
      to: "deprecated",
      activationAuthorityRequirement: "none",
    }),
  ]);

export type StructuralStorefrontFamilyLifecycleSubject = Readonly<
  StructuralStorefrontFamilyIdentityV1 & {
    lifecycleState: StructuralStorefrontFamilyLifecycleState;
  }
>;

const lifecycleSubjectSchema = z
  .object({
    familyId: structuralStorefrontFamilyIdSchema,
    familyVersion: structuralStorefrontFamilyVersionSchema,
    lifecycleState: structuralStorefrontFamilyLifecycleStateSchema,
  })
  .strict()
  .readonly();

const lifecycleTransitionInputSchema = z
  .object({
    from: lifecycleSubjectSchema,
    to: lifecycleSubjectSchema,
  })
  .strict()
  .readonly();

export type StructuralStorefrontFamilyLifecycleErrorCode =
  "identity-change-forbidden" | "invalid-lifecycle-transition";

export class StructuralStorefrontFamilyLifecycleError extends Error {
  constructor(
    readonly code: StructuralStorefrontFamilyLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StructuralStorefrontFamilyLifecycleError";
  }
}

const transitionPolicyByKey = new Map(
  structuralStorefrontFamilyLifecycleTransitionPolicies.map((policy) => [
    `${policy.from}->${policy.to}`,
    policy,
  ]),
);

const identityOnly = (
  subject: StructuralStorefrontFamilyLifecycleSubject,
): StructuralStorefrontFamilyIdentityV1 => ({
  familyId: subject.familyId,
  familyVersion: subject.familyVersion,
});

export function resolveStructuralStorefrontFamilyLifecycleTransition(
  input: unknown,
): StructuralStorefrontFamilyLifecycleTransitionPolicy {
  const transition = lifecycleTransitionInputSchema.parse(input);
  const fromIdentityKey = structuralStorefrontFamilyIdentityKey(identityOnly(transition.from));
  const toIdentityKey = structuralStorefrontFamilyIdentityKey(identityOnly(transition.to));

  if (fromIdentityKey !== toIdentityKey) {
    throw new StructuralStorefrontFamilyLifecycleError(
      "identity-change-forbidden",
      `Lifecycle transition cannot change Structural Storefront Family identity from ${fromIdentityKey} to ${toIdentityKey}.`,
    );
  }

  const policy = transitionPolicyByKey.get(
    `${transition.from.lifecycleState}->${transition.to.lifecycleState}`,
  );
  if (!policy) {
    throw new StructuralStorefrontFamilyLifecycleError(
      "invalid-lifecycle-transition",
      `Invalid Structural Storefront Family lifecycle transition: ${transition.from.lifecycleState}->${transition.to.lifecycleState}.`,
    );
  }

  return policy;
}

export function isStructuralStorefrontFamilySelectable(state: unknown): boolean {
  return structuralStorefrontFamilyLifecycleStateSchema.parse(state) === "active";
}
