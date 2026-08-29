import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalizeJson, parseStrictJsonBuffer } from "./json.js";
import { fail } from "./errors.js";

export const taskContractSchemaPath = fileURLToPath(
  new URL("../../../docs/governance/task-contract.schema.v1.json", import.meta.url),
);
export const verifierVerdictSchemaPath = fileURLToPath(
  new URL("../../../docs/governance/verifier-verdict.schema.v1.json", import.meta.url),
);

const schemas = new Map();

const schemaAt = (path) => {
  if (!schemas.has(path)) schemas.set(path, parseStrictJsonBuffer(readFileSync(path)));
  return schemas.get(path);
};

const valueType = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
};

const matchesType = (value, expected) => {
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  return valueType(value) === expected;
};

const deepEqual = (left, right) => canonicalizeJson(left) === canonicalizeJson(right);

const resolvePointer = (rootSchema, reference) => {
  if (!reference.startsWith("#/"))
    fail("schema-reference", `Unsupported schema reference ${reference}.`);
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, part) => current?.[part], rootSchema);
};

const validateNode = (value, schema, rootSchema, instancePath) => {
  const errors = [];
  if (typeof schema === "boolean") {
    if (!schema) errors.push(`${instancePath}: rejected by false schema`);
    return errors;
  }
  if (schema.$ref) {
    const target = resolvePointer(rootSchema, schema.$ref);
    if (!target) return [`${instancePath}: unresolved schema reference ${schema.$ref}`];
    errors.push(...validateNode(value, target, rootSchema, instancePath));
  }
  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expectedTypes.some((expected) => matchesType(value, expected))) {
      errors.push(`${instancePath}: expected ${expectedTypes.join(" or ")}`);
      return errors;
    }
  }
  if (Object.hasOwn(schema, "const") && !deepEqual(value, schema.const)) {
    errors.push(`${instancePath}: does not equal the required constant`);
  }
  if (schema.enum && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(`${instancePath}: is not an allowed enum value`);
  }
  if (schema.allOf) {
    for (const child of schema.allOf)
      errors.push(...validateNode(value, child, rootSchema, instancePath));
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (child) => validateNode(value, child, rootSchema, instancePath).length === 0,
    ).length;
    if (matches !== 1) errors.push(`${instancePath}: must match exactly one oneOf branch`);
  }
  if (schema.if) {
    const conditionMatches = validateNode(value, schema.if, rootSchema, instancePath).length === 0;
    if (conditionMatches && schema.then) {
      errors.push(...validateNode(value, schema.then, rootSchema, instancePath));
    } else if (!conditionMatches && schema.else) {
      errors.push(...validateNode(value, schema.else, rootSchema, instancePath));
    }
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && [...value].length < schema.minLength) {
      errors.push(`${instancePath}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && [...value].length > schema.maxLength) {
      errors.push(`${instancePath}: longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push(`${instancePath}: does not match the required pattern`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${instancePath}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${instancePath}: above maximum ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${instancePath}: fewer than ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${instancePath}: more than ${schema.maxItems} items`);
    }
    if (schema.uniqueItems) {
      const identities = value.map(canonicalizeJson);
      if (new Set(identities).size !== identities.length)
        errors.push(`${instancePath}: items are not unique`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateNode(item, schema.items, rootSchema, `${instancePath}/${index}`));
      });
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required))
        errors.push(`${instancePath}: missing required property ${required}`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        errors.push(...validateNode(value[key], child, rootSchema, `${instancePath}/${key}`));
      }
    }
    const known = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) {
      if (known.has(key)) continue;
      if (schema.additionalProperties === false) {
        errors.push(`${instancePath}: additional property ${key} is not allowed`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(
          ...validateNode(
            value[key],
            schema.additionalProperties,
            rootSchema,
            `${instancePath}/${key}`,
          ),
        );
      }
    }
  }
  return errors;
};

export const validateAgainstSchema = (value, schema, label) => {
  const errors = validateNode(value, schema, schema, "$");
  if (errors.length > 0) {
    fail("schema-invalid", `${label} does not satisfy its canonical Draft 2020-12 schema.`, {
      details: errors,
    });
  }
  return value;
};

export const validateTaskContract = (value) =>
  validateAgainstSchema(value, schemaAt(taskContractSchemaPath), "Task contract");

export const validateVerifierVerdict = (value) =>
  validateAgainstSchema(value, schemaAt(verifierVerdictSchemaPath), "Verifier verdict");
