import { z } from "zod";
import {
  semanticStorefrontDesignIntentV1MaterialSchema,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignIntentValidationContext,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent/semantic-contract";
import {
  validateSemanticStorefrontDesignIntentV1,
  validateSemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent/semantic-validation";
import {
  PromptedStorefrontDesignIntentError,
  type PromptedStorefrontDesignIntentSafeDiagnostic,
} from "@/application/prompted-storefront-design-intent/contract";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  assertOpenAiStrictSchemaCompatibility,
  assertOpenAiStrictSchemaIsClosed,
  canonicalizeOpenAiStrictSchemaReferences,
  createOpenAiStrictJsonSchema,
  type OpenAiStrictSchemaMetrics,
} from "./strict-output-contract";

export type SemanticStorefrontDesignIntentV1WireAuthority = Readonly<{
  schema: Readonly<Record<string, unknown>>;
  schemaFingerprint: string;
  metrics: OpenAiStrictSchemaMetrics;
}>;

function schemaObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PromptedStorefrontDesignIntentError("strict-schema-invalid");
  }
  return value as Record<string, unknown>;
}

function resolveSchemaReference(
  root: Record<string, unknown>,
  input: unknown,
): Record<string, unknown> {
  let current = schemaObject(input);
  const visited = new Set<string>();
  while (typeof current.$ref === "string") {
    const reference = current.$ref;
    if (!reference.startsWith("#/$defs/") || visited.has(reference)) {
      throw new PromptedStorefrontDesignIntentError("strict-schema-invalid");
    }
    visited.add(reference);
    current = schemaObject(schemaObject(root.$defs)[reference.slice("#/$defs/".length)]);
  }
  return current;
}

function constrainDriverValues(
  root: Record<string, unknown>,
  path: string,
  values: readonly string[],
): void {
  const segments = path.split(".");
  let current = root;
  segments.forEach((segment, index) => {
    const resolved = resolveSchemaReference(root, current);
    const properties = schemaObject(resolved.properties);
    if (!(segment in properties)) {
      throw new PromptedStorefrontDesignIntentError("strict-schema-invalid");
    }
    if (index === segments.length - 1) {
      properties[segment] = { type: "string", enum: [...values] };
    } else {
      current = schemaObject(properties[segment]);
    }
  });
}

function schemaPropertyKeys(schema: unknown): ReadonlySet<string> {
  const keys = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.properties === "object" && record.properties !== null) {
      Object.keys(record.properties).forEach((key) => keys.add(key));
    }
    Object.values(record).forEach(visit);
  };
  visit(schema);
  return keys;
}

function safeSchemaDiagnostic(
  error: z.ZodError,
  schema: unknown,
): PromptedStorefrontDesignIntentSafeDiagnostic {
  const allowed = schemaPropertyKeys(schema);
  const path = (segments: PropertyKey[]) =>
    segments.length === 0
      ? "$"
      : segments
          .map((segment) =>
            typeof segment === "number"
              ? "[]"
              : typeof segment === "string" && allowed.has(segment)
                ? segment
                : "?",
          )
          .join(".")
          .slice(0, 240);
  const material = {
    kind: "schema-validation" as const,
    issueCount: error.issues.length,
    issueCodes: [...new Set(error.issues.map(({ code }) => code))].sort().slice(0, 20),
    issuePaths: [...new Set(error.issues.map(({ path: issuePath }) => path(issuePath)))]
      .sort()
      .slice(0, 20),
  };
  return Object.freeze({
    ...material,
    fingerprint: `semantic-wire-schema-diagnostic-${canonicalValueFingerprint(material)}`,
  });
}

export function createSemanticStorefrontDesignIntentV1WireAuthority(
  requestInput: SemanticStorefrontDesignRequestV1,
): SemanticStorefrontDesignIntentV1WireAuthority {
  const request = validateSemanticStorefrontDesignRequestV1(requestInput);
  const generated = z.toJSONSchema(semanticStorefrontDesignIntentV1MaterialSchema, {
    target: "draft-7",
    unrepresentable: "throw",
    reused: "ref",
  });
  const schema = structuredClone(
    canonicalizeOpenAiStrictSchemaReferences(createOpenAiStrictJsonSchema(generated)),
  );
  for (const field of request.semanticInfluenceAuthority.fields) {
    const selectable = field.relationships.some(
      ({ mode }) => mode === "direct" || mode === "compound-driver",
    );
    constrainDriverValues(
      schema,
      field.path,
      selectable ? field.supportedValues : field.supportedValues.slice(0, 1),
    );
  }
  assertOpenAiStrictSchemaIsClosed(schema);
  const metrics = assertOpenAiStrictSchemaCompatibility(schema);
  return Object.freeze({
    schema: Object.freeze(schema),
    schemaFingerprint: `openai-semantic-schema-${canonicalValueFingerprint(schema)}`,
    metrics,
  });
}

export function decodeSemanticStorefrontDesignIntentV1Wire(input: {
  wireIntent: unknown;
  request: SemanticStorefrontDesignRequestV1;
  validation: SemanticStorefrontDesignIntentValidationContext;
  expectedSchemaFingerprint: string;
}): Readonly<{
  intent: SemanticStorefrontDesignIntentV1;
  wireIntentFingerprint: string;
  schemaFingerprint: string;
}> {
  const authority = createSemanticStorefrontDesignIntentV1WireAuthority(input.request);
  if (authority.schemaFingerprint !== input.expectedSchemaFingerprint) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const wire = z
    .fromJSONSchema(authority.schema, { defaultTarget: "draft-2020-12" })
    .safeParse(input.wireIntent);
  if (!wire.success) {
    throw new PromptedStorefrontDesignIntentError(
      "strict-schema-invalid",
      safeSchemaDiagnostic(wire.error, authority.schema),
    );
  }
  const intent = validateSemanticStorefrontDesignIntentV1({
    request: input.request,
    validation: input.validation,
    intent: wire.data,
  });
  return Object.freeze({
    intent,
    wireIntentFingerprint: `semantic-storefront-wire-intent-${canonicalValueFingerprint(
      wire.data,
    )}`,
    schemaFingerprint: authority.schemaFingerprint,
  });
}
