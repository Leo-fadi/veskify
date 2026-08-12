export type BoundedParameterRuntimeProjectionAuthority = Readonly<{
  component: string;
  parameterId: string;
  target: "props" | "styleOverrides";
  targetField: string;
  allowedValues?: readonly (string | number)[];
  numericRange?: Readonly<{ minimum: number; maximum: number }>;
}>;

export type BoundedParameterRuntimeProjection = Readonly<{
  props: Readonly<Record<string, string | number>>;
  styleOverrides: Readonly<Record<string, string | number>>;
}>;

const columnAuthority = (
  component: string,
  minimum: number,
  maximum: number,
): BoundedParameterRuntimeProjectionAuthority =>
  Object.freeze({
    component,
    parameterId: "columnCount",
    target: "props" as const,
    targetField: "columns",
    numericRange: Object.freeze({ minimum, maximum }),
  });

const projectionAuthorities = Object.freeze([
  columnAuthority("homepageFeaturedCollections", 2, 4),
  columnAuthority("homepageFeaturedProducts", 2, 4),
  columnAuthority("homepageCollectionNavigation", 2, 4),
  columnAuthority("homepageTrust", 1, 4),
  columnAuthority("homepageProof", 1, 3),
  Object.freeze({
    component: "homepageHero",
    parameterId: "mediaPlacement",
    target: "props",
    targetField: "mediaPosition",
    allowedValues: Object.freeze(["background"]),
  }),
  Object.freeze({
    component: "homepagePromotion",
    parameterId: "mediaPlacement",
    target: "props",
    targetField: "mediaPosition",
    allowedValues: Object.freeze(["background"]),
  }),
] satisfies readonly BoundedParameterRuntimeProjectionAuthority[]);

export function getBoundedParameterRuntimeProjectionAuthority(
  component: string,
  parameterId: string,
): BoundedParameterRuntimeProjectionAuthority | null {
  return (
    projectionAuthorities.find(
      (authority) => authority.component === component && authority.parameterId === parameterId,
    ) ?? null
  );
}

function valueIsAuthorized(
  authority: BoundedParameterRuntimeProjectionAuthority,
  value: string | number,
): boolean {
  if (authority.allowedValues) return authority.allowedValues.includes(value);
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    authority.numericRange !== undefined &&
    value >= authority.numericRange.minimum &&
    value <= authority.numericRange.maximum
  );
}

/**
 * Projects registered bounded parameter values into exact renderer fields.
 * `null` means at least one component/value pair has no lossless current
 * projection and must fail closed at the caller's typed boundary.
 */
export function projectBoundedParametersToComponentRuntime(
  component: string,
  boundedParameters: Readonly<Record<string, string | number>>,
): BoundedParameterRuntimeProjection | null {
  const props: Record<string, string | number> = {};
  const styleOverrides: Record<string, string | number> = {};
  for (const [parameterId, value] of Object.entries(boundedParameters).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const authority = getBoundedParameterRuntimeProjectionAuthority(component, parameterId);
    if (!authority || !valueIsAuthorized(authority, value)) return null;
    const target = authority.target === "props" ? props : styleOverrides;
    target[authority.targetField] = value;
  }
  return Object.freeze({
    props: Object.freeze(props),
    styleOverrides: Object.freeze(styleOverrides),
  });
}
