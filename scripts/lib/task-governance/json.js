import { createHash } from "node:crypto";

import { fail, requireCondition } from "./errors.js";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export const compareCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const assertPairedSurrogates = (value, label = "JSON string") => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      requireCondition(
        next >= 0xdc00 && next <= 0xdfff,
        "json-unpaired-surrogate",
        `${label} contains an unpaired high surrogate.`,
      );
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("json-unpaired-surrogate", `${label} contains an unpaired low surrogate.`);
    }
  }
};

class StrictJsonParser {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    requireCondition(
      this.index === this.source.length,
      "json-trailing-content",
      `Unexpected JSON content at offset ${this.index}.`,
    );
    return value;
  }

  skipWhitespace() {
    while (
      /\s/u.test(this.source[this.index] ?? "") &&
      /[\t\n\r ]/u.test(this.source[this.index])
    ) {
      this.index += 1;
    }
  }

  parseValue() {
    const character = this.source[this.index];
    if (character === "{") return this.parseObject();
    if (character === "[") return this.parseArray();
    if (character === '"') return this.parseString();
    if (character === "t") return this.parseKeyword("true", true);
    if (character === "f") return this.parseKeyword("false", false);
    if (character === "n") return this.parseKeyword("null", null);
    if (character === "-" || (character >= "0" && character <= "9")) return this.parseNumber();
    fail("json-invalid-token", `Invalid JSON token at offset ${this.index}.`);
  }

  parseObject() {
    this.index += 1;
    this.skipWhitespace();
    const result = {};
    const keys = new Set();
    if (this.source[this.index] === "}") {
      this.index += 1;
      return result;
    }
    while (this.index < this.source.length) {
      requireCondition(
        this.source[this.index] === '"',
        "json-object-key",
        `Expected an object key at offset ${this.index}.`,
      );
      const key = this.parseString();
      requireCondition(
        !keys.has(key),
        "json-duplicate-key",
        `Duplicate JSON object key at offset ${this.index}.`,
      );
      keys.add(key);
      this.skipWhitespace();
      requireCondition(
        this.source[this.index] === ":",
        "json-object-colon",
        `Expected ':' at offset ${this.index}.`,
      );
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue();
      this.skipWhitespace();
      if (this.source[this.index] === "}") {
        this.index += 1;
        return result;
      }
      requireCondition(
        this.source[this.index] === ",",
        "json-object-separator",
        `Expected ',' at offset ${this.index}.`,
      );
      this.index += 1;
      this.skipWhitespace();
    }
    fail("json-unclosed-object", "JSON object is not closed.");
  }

  parseArray() {
    this.index += 1;
    this.skipWhitespace();
    const result = [];
    if (this.source[this.index] === "]") {
      this.index += 1;
      return result;
    }
    while (this.index < this.source.length) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.source[this.index] === "]") {
        this.index += 1;
        return result;
      }
      requireCondition(
        this.source[this.index] === ",",
        "json-array-separator",
        `Expected ',' at offset ${this.index}.`,
      );
      this.index += 1;
      this.skipWhitespace();
    }
    fail("json-unclosed-array", "JSON array is not closed.");
  }

  parseString() {
    this.index += 1;
    let result = "";
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      this.index += 1;
      if (character === '"') {
        assertPairedSurrogates(result);
        return result;
      }
      requireCondition(
        character.charCodeAt(0) >= 0x20,
        "json-unescaped-control",
        `Unescaped control character at offset ${this.index - 1}.`,
      );
      if (character !== "\\") {
        result += character;
        continue;
      }
      requireCondition(
        this.index < this.source.length,
        "json-invalid-escape",
        "JSON string ends after an escape marker.",
      );
      const escape = this.source[this.index];
      this.index += 1;
      const simpleEscapes = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      if (Object.hasOwn(simpleEscapes, escape)) {
        result += simpleEscapes[escape];
        continue;
      }
      requireCondition(
        escape === "u",
        "json-invalid-escape",
        `Invalid JSON escape at offset ${this.index - 1}.`,
      );
      const hex = this.source.slice(this.index, this.index + 4);
      requireCondition(
        /^[0-9a-fA-F]{4}$/u.test(hex),
        "json-invalid-unicode-escape",
        `Invalid Unicode escape at offset ${this.index}.`,
      );
      result += String.fromCharCode(Number.parseInt(hex, 16));
      this.index += 4;
    }
    fail("json-unclosed-string", "JSON string is not closed.");
  }

  parseKeyword(keyword, value) {
    requireCondition(
      this.source.slice(this.index, this.index + keyword.length) === keyword,
      "json-invalid-token",
      `Invalid JSON token at offset ${this.index}.`,
    );
    this.index += keyword.length;
    return value;
  }

  parseNumber() {
    const match = this.source
      .slice(this.index)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    requireCondition(match, "json-invalid-number", `Invalid number at offset ${this.index}.`);
    const token = match[0];
    this.index += token.length;
    const value = Number(token);
    requireCondition(
      Number.isFinite(value),
      "json-non-finite-number",
      `Number at offset ${this.index - token.length} is outside finite IEEE-754 authority.`,
    );
    return value;
  }
}

export const decodeJsonUtf8 = (buffer) => {
  try {
    return utf8Decoder.decode(buffer);
  } catch {
    fail("json-invalid-utf8", "JSON input is not valid UTF-8.");
  }
};

export const parseStrictJson = (source) => new StrictJsonParser(source).parse();

export const parseStrictJsonBuffer = (buffer) => parseStrictJson(decodeJsonUtf8(buffer));

export const canonicalizeJson = (value) => {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") {
    assertPairedSurrogates(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    requireCondition(
      Number.isFinite(value),
      "jcs-non-finite-number",
      "JCS input contains a non-finite number.",
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  requireCondition(
    typeof value === "object" && value !== null,
    "jcs-unsupported-value",
    "JCS input contains an unsupported value.",
  );
  const prototype = Object.getPrototypeOf(value);
  requireCondition(
    prototype === Object.prototype || prototype === null,
    "jcs-unsupported-object",
    "JCS input must contain only ordinary JSON objects.",
  );
  return `{${Object.keys(value)
    .sort(compareCodeUnits)
    .map((key) => {
      assertPairedSurrogates(key, "JSON object key");
      return `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`;
    })
    .join(",")}}`;
};

export const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");

export const fingerprintJson = (domain, value) =>
  `${domain}_${sha256Hex(`${domain}\n${canonicalizeJson(value)}`)}`;

const sortForReport = (value) => {
  if (Array.isArray(value)) return value.map(sortForReport);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareCodeUnits)
        .map((key) => [key, sortForReport(value[key])]),
    );
  }
  return value;
};

export const stableJsonText = (value) => `${JSON.stringify(sortForReport(value), null, 2)}\n`;
