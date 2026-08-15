import {
  SEMANTIC_INFLUENCE_AUTHORITY_V1,
  semanticInfluenceAuthorityFingerprint,
  semanticInfluenceAuthoritySchema,
  type SemanticInfluenceAuthority,
  type SemanticInfluenceAuthorityMaterial,
  type SemanticProviderDriverPath,
} from "@/application/prompted-storefront-design-intent/semantic-contract";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  semanticExactInfluenceAxisIds,
  uniqueSemanticValues,
  type SemanticExactInfluenceAxisId,
  type SemanticExactInfluenceAxisMap,
  type SemanticFeatureMap,
} from "./semantic-capability-features";
export const SEMANTIC_INFLUENCE_AUTHORITY_VERSION = SEMANTIC_INFLUENCE_AUTHORITY_V1;
export type SemanticInfluenceMode =
  SemanticInfluenceAuthority["fields"][number]["relationships"][number]["mode"];
export type SemanticInfluenceReasonCode =
  SemanticInfluenceAuthority["fields"][number]["relationships"][number]["reasonCode"];
export type SemanticInfluenceRelationship =
  SemanticInfluenceAuthority["fields"][number]["relationships"][number];
export type SemanticInfluenceFieldAuthority = SemanticInfluenceAuthority["fields"][number];
export type { SemanticInfluenceAuthority };
export type SemanticInfluenceAuthoritySample = Readonly<{
  semanticFeatures: SemanticFeatureMap;
  exactAxes: SemanticExactInfluenceAxisMap;
}>;
type DriverSpecification = Readonly<{
  path: SemanticProviderDriverPath;
  primaryAxis: SemanticExactInfluenceAxisId;
  derivedAxes: readonly SemanticExactInfluenceAxisId[];
  compound: boolean;
}>;
function driver(
  path: SemanticProviderDriverPath,
  primaryAxis: SemanticExactInfluenceAxisId,
  derivedAxes: readonly SemanticExactInfluenceAxisId[] = [],
  compound = false,
): DriverSpecification {
  return { path, primaryAxis, derivedAxes, compound };
}
const driverSpecifications = [
  driver("commercialPosture", "direction-package", ["design-dna", "typography"], true),
  driver("globalVisualIntent.density", "information-density-posture", ["spacing-density"]),
  driver("sharedFrameIntent.navigationPosture", "shared-frame"),
  driver("homepageIntent.storyCatalogueBalance", "narrative-posture", ["homepage-profile"], true),
  driver(
    "collectionIntent.discoveryPosture",
    "collection-profile",
    ["merchandising-posture"],
    true,
  ),
  driver("pdpIntent.configurableProductPosture", "pdp-profile", [], true),
  driver("responsiveAndArtDirectionIntent.mobileHierarchy", "responsive-mode"),
  driver("responsiveAndArtDirectionIntent.imageProminence", "art-direction-posture"),
] as const;
function signature(values: readonly string[]): string {
  return uniqueSemanticValues(values).join("\u001f");
}

function addToPartition(map: Map<string, Set<string>>, key: string, value: string): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}
function partitions(
  samples: readonly SemanticInfluenceAuthoritySample[],
  path: SemanticProviderDriverPath,
  axis: SemanticExactInfluenceAxisId,
) {
  const semanticToExact = new Map<string, Set<string>>();
  const exactToSemantic = new Map<string, Set<string>>();
  for (const sample of samples) {
    const semantic = signature(sample.semanticFeatures[path] ?? []);
    const exact = sample.exactAxes[axis];
    addToPartition(semanticToExact, semantic, exact);
    addToPartition(exactToSemantic, exact, semantic);
  }
  return { semanticToExact, exactToSemantic };
}
function observedIndependence(
  samples: readonly SemanticInfluenceAuthoritySample[],
  specification: DriverSpecification,
): Readonly<{
  hasIndependentWitness: boolean;
  coupledExactAxisIds: readonly SemanticExactInfluenceAxisId[];
}> {
  const collateralAxes = semanticExactInfluenceAxisIds.filter(
    (axis) => axis !== specification.primaryAxis && !specification.derivedAxes.includes(axis),
  );
  const observed: SemanticExactInfluenceAxisId[][] = [];
  for (let leftIndex = 0; leftIndex < samples.length; leftIndex += 1) {
    const left = samples[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < samples.length; rightIndex += 1) {
      const right = samples[rightIndex];
      if (
        signature(left.semanticFeatures[specification.path] ?? []) ===
          signature(right.semanticFeatures[specification.path] ?? []) ||
        left.exactAxes[specification.primaryAxis] === right.exactAxes[specification.primaryAxis]
      ) {
        continue;
      }
      const changed = collateralAxes.filter(
        (axis) => left.exactAxes[axis] !== right.exactAxes[axis],
      );
      if (changed.length === 0) return { hasIndependentWitness: true, coupledExactAxisIds: [] };
      observed.push(changed);
    }
  }
  const closest = observed.sort(
    (left, right) =>
      left.length - right.length || left.join("\u001f").localeCompare(right.join("\u001f")),
  )[0];
  return { hasIndependentWitness: false, coupledExactAxisIds: [...(closest ?? [])].sort() };
}
function relationship(
  samples: readonly SemanticInfluenceAuthoritySample[],
  specification: DriverSpecification,
  axis: SemanticExactInfluenceAxisId,
  derived: boolean,
): SemanticInfluenceRelationship {
  const semanticValueCount = new Set(
    samples.map(({ semanticFeatures }) => signature(semanticFeatures[specification.path] ?? [])),
  ).size;
  const exactValueCount = new Set(samples.map(({ exactAxes }) => exactAxes[axis])).size;
  const result = (
    mode: SemanticInfluenceMode,
    reasonCode: SemanticInfluenceReasonCode,
    providerDriverPath: SemanticProviderDriverPath | null = null,
    coupledExactAxisIds: readonly SemanticExactInfluenceAxisId[] = [],
  ): SemanticInfluenceRelationship => ({
    exactAxisId: axis,
    mode,
    reasonCode,
    providerDriverPath,
    coupledExactAxisIds: [...coupledExactAxisIds],
    semanticValueCount,
    exactValueCount,
  });
  if (semanticValueCount <= 1 || exactValueCount <= 1) {
    return result("unavailable", "single-compatible-exact-value");
  }
  const partition = partitions(samples, specification.path, axis);
  const semanticDeterminesExact = [...partition.semanticToExact.values()].every(
    (values) => values.size === 1,
  );
  if (derived) {
    return semanticDeterminesExact
      ? result("derived", "derived-from-compound-axis", specification.path)
      : result("substitution-only", "correlated-candidate-substitution");
  }
  const exactDeterminesSemantic = [...partition.exactToSemantic.values()].every(
    (values) => values.size === 1,
  );
  if (!specification.compound && (!semanticDeterminesExact || !exactDeterminesSemantic)) {
    return result("substitution-only", "correlated-candidate-substitution");
  }
  const independence = observedIndependence(samples, specification);
  const compound = specification.compound || !independence.hasIndependentWitness;
  return compound
    ? result(
        "compound-driver",
        "coupled-axis-provider-driver",
        specification.path,
        independence.coupledExactAxisIds,
      )
    : result("direct", "independent-exact-axis", specification.path);
}

/** Derives bounded causal authority from current compatible metadata without materialization. */
export function deriveSemanticInfluenceAuthority(
  samples: readonly SemanticInfluenceAuthoritySample[],
): SemanticInfluenceAuthority {
  if (samples.length === 0) throw new Error("Semantic influence authority requires candidates.");
  const fields = driverSpecifications.map((specification) => {
    const material = {
      path: specification.path,
      supportedValues: Array.from(
        uniqueSemanticValues(
          samples.flatMap(({ semanticFeatures }) => semanticFeatures[specification.path] ?? []),
        ),
      ),
      relationships: [
        relationship(samples, specification, specification.primaryAxis, false),
        ...specification.derivedAxes.map((axis) =>
          relationship(samples, specification, axis, true),
        ),
      ],
    };
    return {
      ...material,
      fieldAuthorityFingerprint: `semantic-influence-field-${canonicalValueFingerprint(material)}`,
    };
  });
  const material: SemanticInfluenceAuthorityMaterial = {
    contractVersion: SEMANTIC_INFLUENCE_AUTHORITY_VERSION,
    sampleCount: samples.length,
    fields,
  };
  return semanticInfluenceAuthoritySchema.parse({
    ...material,
    authorityFingerprint: semanticInfluenceAuthorityFingerprint(material),
  });
}

export function semanticInfluenceFieldAuthority(
  authority: SemanticInfluenceAuthority,
  path: SemanticProviderDriverPath,
): SemanticInfluenceFieldAuthority {
  const field = authority.fields.find((candidate) => candidate.path === path);
  if (!field) throw new Error(`Semantic influence authority is missing ${path}.`);
  return field;
}

export function semanticFieldCanDriveSelection(field: SemanticInfluenceFieldAuthority): boolean {
  return field.relationships.some(({ mode }) => mode === "direct" || mode === "compound-driver");
}
