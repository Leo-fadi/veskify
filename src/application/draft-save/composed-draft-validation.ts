import type { StorefrontCompositionAuthorityResolver } from "@/application/storefront-templates/bind-storefront-composition";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { composedPageRealizationSupport } from "@/components/storefront/composed-page-realization";
import { validateComposedStorefrontContent } from "@/components/storefront/composed-storefront-validation";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import type { StorefrontSnapshot } from "@/domain/storefront";
import {
  DraftConflictError,
  RepositoryValidationError,
  type DraftBaseIdentity,
  type ComposedStaticDraftAuthorityMaterial,
  type ProjectAggregate,
} from "@/services/storage/project-repository";

export function composedDraftContextFingerprint(
  aggregate: Pick<ProjectAggregate, "project" | "catalogue">,
) {
  return canonicalValueFingerprint({ project: aggregate.project, catalogue: aggregate.catalogue });
}
function freeze<T>(value: T, active = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    if (active.has(value)) throw new RepositoryValidationError("Cyclic draft authority.");
    active.add(value);
    Object.values(value as Record<string, unknown>).forEach((child) => {
      freeze(child, active);
    });
    active.delete(value);
    Object.freeze(value);
  }
  return value;
}

/** Concrete operations only: callers cannot register a validator or choose executable support. */
export function createComposedStaticDraftOperations(
  source: readonly ComposedStaticDraftAuthorityMaterial[],
) {
  const retained = freeze(structuredClone(source));
  const authorities = new Map(retained.map((row) => [row.owner.id, row]));
  if (
    !retained.length ||
    authorities.size !== retained.length ||
    retained.some((row) => row.owner.kind !== "static-page" || !row.owner.id)
  )
    throw new RepositoryValidationError("Missing, duplicate or non-static draft authority.");
  const resolver: StorefrontCompositionAuthorityResolver = ({ owner }) => {
    const row = authorities.get(owner.id);
    if (owner.kind !== "static-page" || !row)
      throw new RepositoryValidationError("Composed draft owner is not trusted.");
    return {
      candidate: row.candidate,
      componentDefinitions: veskifyComponentDefinitionsV2,
      support: composedPageRealizationSupport,
      requiredAssetRoleCapacityEvidence: row.requiredAssetRoleCapacityEvidence,
    };
  };
  return Object.freeze({
    validateSnapshot(
      input: unknown,
      aggregate: Pick<ProjectAggregate, "project" | "catalogue">,
    ): StorefrontSnapshot {
      const { snapshot } = validateComposedStorefrontContent({
        snapshot: input,
        catalogue: aggregate.catalogue,
        activeLocale: aggregate.project.primaryLocale,
        primaryLocale: aggregate.project.primaryLocale,
        enabledLocales: aggregate.project.enabledLocales,
        resolveAuthority: resolver,
        evidenceReferences: [],
      });
      if (
        snapshot.projectId !== aggregate.project.id ||
        snapshot.catalogueRef !== aggregate.catalogue.id
      )
        throw new RepositoryValidationError("Composed draft project/catalogue mismatch.");
      return snapshot;
    },
    assertSave(
      input: StorefrontSnapshot,
      current: StorefrontSnapshot,
      aggregate: ProjectAggregate,
      expected?: DraftBaseIdentity,
    ) {
      if (
        ![input, ...aggregate.snapshots].some(
          (snapshot) => "compositionExtensionVersion" in snapshot,
        )
      )
        return;
      if (!("compositionExtensionVersion" in input) || input.id === current.id)
        throw new RepositoryValidationError(
          "Composed save requires a new composed draft identity.",
        );
      if (
        !expected ||
        expected.id !== current.id ||
        expected.revision !== current.revision ||
        expected.snapshotFingerprint !== canonicalValueFingerprint(current) ||
        expected.contextFingerprint !== composedDraftContextFingerprint(aggregate)
      )
        throw new DraftConflictError(aggregate.project.id, expected ?? current, current);
    },
  });
}
