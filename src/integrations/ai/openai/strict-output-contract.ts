export const openAiUnsupportedStrictSchemaKeywords = [
  "$schema",
  "allOf",
  "contains",
  "const",
  "contentEncoding",
  "contentMediaType",
  "default",
  "dependencies",
  "dependentRequired",
  "dependentSchemas",
  "else",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "if",
  "maxContains",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minContains",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "not",
  "oneOf",
  "pattern",
  "patternProperties",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
  "uniqueItems",
] as const;

const unsupportedStrictSchemaKeywords = new Set<string>(openAiUnsupportedStrictSchemaKeywords);

export const openAiStrictSchemaLimits = Object.freeze({
  maximumObjectProperties: 5_000,
  maximumNestingDepth: 10,
  maximumCountedStringCharacters: 120_000,
  maximumEnumValues: 1_000,
  largeEnumValueThreshold: 250,
  maximumLargeEnumStringCharacters: 15_000,
});

export type OpenAiStrictSchemaCompatibilityIssue = Readonly<{
  code:
    | "array-items-missing"
    | "counted-string-limit"
    | "empty-schema"
    | "enum-limit"
    | "invalid-ref"
    | "invalid-schema-node"
    | "large-enum-string-limit"
    | "legacy-definitions"
    | "nesting-depth-limit"
    | "object-not-closed"
    | "object-property-limit"
    | "required-properties-mismatch"
    | "root-any-of"
    | "root-not-object"
    | "unresolved-ref"
    | "unsupported-keyword";
  path: string;
}>;

export type OpenAiStrictSchemaMetrics = Readonly<{
  serializedCharacters: number;
  serializedBytes: number;
  conservativeEstimatedTokens: number;
  objectPropertyCount: number;
  maximumNestingDepth: number;
  countedStringCharacters: number;
  enumValueCount: number;
  maximumEnumValueCount: number;
  enumStringCharacters: number;
  maximumEnumStringCharacters: number;
  definitionCount: number;
  referenceCount: number;
  keywords: readonly string[];
}>;

export type OpenAiStrictSchemaCompatibilityReport = Readonly<{
  supported: boolean;
  metrics: OpenAiStrictSchemaMetrics;
  issues: readonly OpenAiStrictSchemaCompatibilityIssue[];
}>;

export class OpenAiStrictSchemaCompatibilityError extends Error {
  readonly report: OpenAiStrictSchemaCompatibilityReport;

  constructor(report: OpenAiStrictSchemaCompatibilityReport) {
    super(
      `OpenAI strict schema is incompatible: ${[
        ...new Set(report.issues.map(({ code }) => code)),
      ].join(",")}`,
    );
    this.name = "OpenAiStrictSchemaCompatibilityError";
    this.report = report;
  }
}

const supportedStrictSchemaKeywords = new Set([
  "$defs",
  "$ref",
  "additionalProperties",
  "anyOf",
  "const",
  "description",
  "enum",
  "items",
  "properties",
  "required",
  "title",
  "type",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type StrictSchemaValueContext = "schema" | "named-schema-map" | "literal";

function canonicalizeOpenAiStrictSchemaReferenceValue(
  value: unknown,
  context: StrictSchemaValueContext = "schema",
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeOpenAiStrictSchemaReferenceValue(entry, context));
  }
  if (!isRecord(value)) return value;
  if (context === "literal") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        canonicalizeOpenAiStrictSchemaReferenceValue(child, "literal"),
      ]),
    );
  }
  if (context === "named-schema-map") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        canonicalizeOpenAiStrictSchemaReferenceValue(child, "schema"),
      ]),
    );
  }
  if (Object.hasOwn(value, "definitions") && Object.hasOwn(value, "$defs")) {
    throw new Error("OpenAI strict schema cannot contain definitions and $defs together.");
  }
  const canonical: Record<string, unknown> = {};
  for (const [sourceKey, child] of Object.entries(value)) {
    const key = sourceKey === "definitions" ? "$defs" : sourceKey;
    const childContext: StrictSchemaValueContext =
      key === "properties" || key === "$defs"
        ? "named-schema-map"
        : key === "enum" || key === "const"
          ? "literal"
          : "schema";
    canonical[key] =
      key === "$ref" && typeof child === "string" && child.startsWith("#/definitions/")
        ? `#/$defs/${child.slice("#/definitions/".length)}`
        : canonicalizeOpenAiStrictSchemaReferenceValue(child, childContext);
  }
  return canonical;
}

/** Canonicalizes only provider-wire reference vocabulary; it never changes the local schema. */
export function canonicalizeOpenAiStrictSchemaReferences(schema: unknown): Record<string, unknown> {
  const canonical = canonicalizeOpenAiStrictSchemaReferenceValue(schema);
  if (!isRecord(canonical)) throw new Error("OpenAI structured output requires an object schema.");
  return canonical;
}

function sanitizeOpenAiStrictSchemaValue(
  value: unknown,
  context: StrictSchemaValueContext = "schema",
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeOpenAiStrictSchemaValue(entry, context));
  }
  if (!isRecord(value)) return value;

  if (context === "literal") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sanitizeOpenAiStrictSchemaValue(child, "literal"),
      ]),
    );
  }

  if (context === "named-schema-map") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sanitizeOpenAiStrictSchemaValue(child, "schema"),
      ]),
    );
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (unsupportedStrictSchemaKeywords.has(key)) continue;
    const childContext: StrictSchemaValueContext =
      key === "properties" || key === "definitions" || key === "$defs"
        ? "named-schema-map"
        : key === "enum"
          ? "literal"
          : "schema";
    sanitized[key] = sanitizeOpenAiStrictSchemaValue(child, childContext);
  }
  if (Object.hasOwn(value, "const") && sanitized.enum === undefined) {
    sanitized.enum = [sanitizeOpenAiStrictSchemaValue(value.const, "literal")];
  }

  if (sanitized.type === "object" && isRecord(sanitized.properties)) {
    sanitized.required = Object.keys(sanitized.properties);
    sanitized.additionalProperties = false;
  }
  return sanitized;
}

export function createOpenAiStrictJsonSchema(schema: unknown): Record<string, unknown> {
  const sanitized = sanitizeOpenAiStrictSchemaValue(schema);
  if (!isRecord(sanitized)) throw new Error("OpenAI structured output requires an object schema.");
  return sanitized;
}

export function assertOpenAiStrictSchemaIsClosed(schema: unknown): void {
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    if (value.type === "object" && value.additionalProperties !== false) {
      throw new Error(
        "OpenAI structured output object schemas must set additionalProperties to false.",
      );
    }
    Object.values(value).forEach(visit);
  };
  visit(schema);
}

function escapedSchemaPathSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function resolveJsonPointer(root: Record<string, unknown>, reference: string): unknown {
  if (reference === "#") return root;
  if (!reference.startsWith("#/")) return undefined;
  return reference
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((node, segment) => (isRecord(node) ? node[segment] : undefined), root);
}

function resolveLocalSchemaReference(root: Record<string, unknown>, reference: string): unknown {
  return reference === "#" || reference.startsWith("#/$defs/")
    ? resolveJsonPointer(root, reference)
    : undefined;
}

function resolveSchemaReferenceForMetrics(
  root: Record<string, unknown>,
  reference: string,
): unknown {
  return reference === "#" ||
    reference.startsWith("#/$defs/") ||
    reference.startsWith("#/definitions/")
    ? resolveJsonPointer(root, reference)
    : undefined;
}

function schemaIncludesType(schema: Record<string, unknown>, type: string): boolean {
  return schema.type === type || (Array.isArray(schema.type) && schema.type.includes(type));
}

export function inspectOpenAiStrictSchemaCompatibility(
  schema: unknown,
): OpenAiStrictSchemaCompatibilityReport {
  const issues: OpenAiStrictSchemaCompatibilityIssue[] = [];
  const keywords = new Set<string>();
  let objectPropertyCount = 0;
  let countedStringCharacters = 0;
  let enumValueCount = 0;
  let maximumEnumValueCount = 0;
  let enumStringCharacters = 0;
  let maximumEnumStringCharacters = 0;
  let definitionCount = 0;
  let referenceCount = 0;

  const addIssue = (code: OpenAiStrictSchemaCompatibilityIssue["code"], path: string) => {
    issues.push({ code, path });
  };

  const root = isRecord(schema) ? schema : null;
  if (!root) {
    addIssue("invalid-schema-node", "$");
  } else {
    if (!schemaIncludesType(root, "object")) addIssue("root-not-object", "$");
    if (Object.hasOwn(root, "anyOf")) addIssue("root-any-of", "$.anyOf");
  }

  const visit = (value: unknown, path: string): void => {
    if (!isRecord(value)) {
      addIssue("invalid-schema-node", path);
      return;
    }
    if (Object.keys(value).length === 0) addIssue("empty-schema", path);

    for (const key of Object.keys(value)) {
      keywords.add(key);
      if (key === "definitions") {
        addIssue("legacy-definitions", `${path}.definitions`);
      } else if (!supportedStrictSchemaKeywords.has(key)) {
        addIssue("unsupported-keyword", `${path}.${key}`);
      }
    }

    const properties = value.properties;
    if (schemaIncludesType(value, "object")) {
      if (value.additionalProperties !== false) addIssue("object-not-closed", path);
      const propertyNames = isRecord(properties) ? Object.keys(properties) : [];
      const required = Array.isArray(value.required)
        ? value.required.filter((entry): entry is string => typeof entry === "string")
        : [];
      if (
        !isRecord(properties) ||
        !Array.isArray(value.required) ||
        required.length !== value.required.length ||
        new Set(required).size !== required.length ||
        required.length !== propertyNames.length ||
        propertyNames.some((property) => !required.includes(property)) ||
        required.some((property) => !propertyNames.includes(property))
      ) {
        addIssue("required-properties-mismatch", path);
      }
    }
    if (isRecord(properties)) {
      const entries = Object.entries(properties);
      objectPropertyCount += entries.length;
      countedStringCharacters += entries.reduce((total, [name]) => total + name.length, 0);
      for (const [name, child] of entries) {
        visit(child, `${path}.properties.${escapedSchemaPathSegment(name)}`);
      }
    }

    for (const definitionsKey of ["$defs", "definitions"] as const) {
      const definitions = value[definitionsKey];
      if (!isRecord(definitions)) continue;
      const entries = Object.entries(definitions);
      definitionCount += entries.length;
      countedStringCharacters += entries.reduce((total, [name]) => total + name.length, 0);
      for (const [name, child] of entries) {
        visit(child, `${path}.${definitionsKey}.${escapedSchemaPathSegment(name)}`);
      }
    }

    if (schemaIncludesType(value, "array") && !isRecord(value.items)) {
      addIssue("array-items-missing", path);
    }
    if (isRecord(value.items)) visit(value.items, `${path}.items`);
    if (Array.isArray(value.anyOf)) {
      value.anyOf.forEach((child, index) => visit(child, `${path}.anyOf[${index}]`));
    }

    if (Array.isArray(value.enum)) {
      const enumValues = value.enum as unknown[];
      const stringCharacters = enumValues.reduce<number>(
        (total, entry) => total + (typeof entry === "string" ? entry.length : 0),
        0,
      );
      enumValueCount += enumValues.length;
      maximumEnumValueCount = Math.max(maximumEnumValueCount, enumValues.length);
      enumStringCharacters += stringCharacters;
      maximumEnumStringCharacters = Math.max(maximumEnumStringCharacters, stringCharacters);
      countedStringCharacters += stringCharacters;
      if (
        enumValues.length > openAiStrictSchemaLimits.largeEnumValueThreshold &&
        stringCharacters > openAiStrictSchemaLimits.maximumLargeEnumStringCharacters
      ) {
        addIssue("large-enum-string-limit", `${path}.enum`);
      }
    }
    if (typeof value.const === "string") countedStringCharacters += value.const.length;

    if (Object.hasOwn(value, "$ref")) {
      referenceCount += 1;
      if (
        typeof value.$ref !== "string" ||
        (value.$ref !== "#" && !value.$ref.startsWith("#/$defs/"))
      ) {
        addIssue("invalid-ref", `${path}.$ref`);
      } else if (!root || resolveLocalSchemaReference(root, value.$ref) === undefined) {
        addIssue("unresolved-ref", `${path}.$ref`);
      }
    }
  };
  if (root) visit(root, "$");

  const logicalDepth = (
    value: unknown,
    depth: number,
    activeReferences: ReadonlySet<string>,
  ): number => {
    if (!isRecord(value)) return depth;
    const nextDepth =
      schemaIncludesType(value, "object") || schemaIncludesType(value, "array") ? depth + 1 : depth;
    let maximum = nextDepth;
    if (typeof value.$ref === "string" && root && !activeReferences.has(value.$ref)) {
      const resolved = resolveSchemaReferenceForMetrics(root, value.$ref);
      if (resolved !== undefined) {
        maximum = Math.max(
          maximum,
          logicalDepth(resolved, nextDepth, new Set([...activeReferences, value.$ref])),
        );
      }
    }
    if (isRecord(value.properties)) {
      for (const child of Object.values(value.properties)) {
        maximum = Math.max(maximum, logicalDepth(child, nextDepth, activeReferences));
      }
    }
    if (isRecord(value.items)) {
      maximum = Math.max(maximum, logicalDepth(value.items, nextDepth, activeReferences));
    }
    if (Array.isArray(value.anyOf)) {
      for (const child of value.anyOf) {
        maximum = Math.max(maximum, logicalDepth(child, nextDepth, activeReferences));
      }
    }
    return maximum;
  };
  const maximumNestingDepth = root ? logicalDepth(root, 0, new Set()) : 0;
  const serialized = JSON.stringify(schema);

  if (objectPropertyCount > openAiStrictSchemaLimits.maximumObjectProperties) {
    addIssue("object-property-limit", "$");
  }
  if (maximumNestingDepth > openAiStrictSchemaLimits.maximumNestingDepth) {
    addIssue("nesting-depth-limit", "$");
  }
  if (countedStringCharacters > openAiStrictSchemaLimits.maximumCountedStringCharacters) {
    addIssue("counted-string-limit", "$");
  }
  if (enumValueCount > openAiStrictSchemaLimits.maximumEnumValues) {
    addIssue("enum-limit", "$");
  }

  const deduplicatedIssues = [
    ...new Map(issues.map((issue) => [`${issue.code}:${issue.path}`, issue])).values(),
  ].sort((left, right) => `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`));
  const metrics = Object.freeze({
    serializedCharacters: serialized.length,
    serializedBytes: Buffer.byteLength(serialized),
    conservativeEstimatedTokens: Math.ceil(serialized.length / 4),
    objectPropertyCount,
    maximumNestingDepth,
    countedStringCharacters,
    enumValueCount,
    maximumEnumValueCount,
    enumStringCharacters,
    maximumEnumStringCharacters,
    definitionCount,
    referenceCount,
    keywords: Object.freeze([...keywords].sort()),
  });
  return Object.freeze({
    supported: deduplicatedIssues.length === 0,
    metrics,
    issues: Object.freeze(deduplicatedIssues),
  });
}

export function assertOpenAiStrictSchemaCompatibility(schema: unknown): OpenAiStrictSchemaMetrics {
  const report = inspectOpenAiStrictSchemaCompatibility(schema);
  if (!report.supported) throw new OpenAiStrictSchemaCompatibilityError(report);
  return report.metrics;
}

export type OpenAiResponsesRequest = Readonly<{
  model: string;
  instructions: string;
  input: string;
  store: false;
  max_output_tokens: number;
  text: Readonly<{
    verbosity: "low";
    format: Readonly<{
      type: "json_schema";
      name: string;
      description: string;
      strict: true;
      schema: Record<string, unknown>;
    }>;
  }>;
}>;

export type OpenAiResponseRequestOptions = Readonly<{
  maxRetries: 0;
  timeout: number;
  signal?: AbortSignal;
}>;

export interface OpenAiResponsesTransport {
  create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions): Promise<unknown>;
}
