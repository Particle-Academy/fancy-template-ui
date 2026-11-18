/**
 * A small JSON Schema validator for host block-kind props: the subset a
 * settings panel needs (type, properties, required, additionalProperties: false,
 * items, enum, const, numeric and length bounds, pattern). Written here rather
 * than taking a validator dependency; an unsupported keyword is ignored, which
 * fails open, so a kind's `render` must still be defensive.
 */
import type { Json, JsonSchema } from "./types";

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function matchesType(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  return actual === t;
}

/** Every error as `"<path>: <reason>"`; empty when valid. */
export function validateSchema(value: unknown, schema: JsonSchema, path = ""): string[] {
  const errors: string[] = [];
  const at = path === "" ? "(root)" : path;
  const s = schema as Record<string, unknown>;

  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
    if (!types.some((t) => matchesType(value, t))) {
      return [`${at}: expected ${types.join(" or ")}`];
    }
  }
  if (Array.isArray(s.enum) && !(s.enum as Json[]).some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(`${at}: not one of the allowed values`);
  }
  if (s.const !== undefined && JSON.stringify(s.const) !== JSON.stringify(value)) {
    errors.push(`${at}: must be ${JSON.stringify(s.const)}`);
  }
  if (typeof value === "number") {
    if (typeof s.minimum === "number" && value < s.minimum) errors.push(`${at}: below ${s.minimum}`);
    if (typeof s.maximum === "number" && value > s.maximum) errors.push(`${at}: above ${s.maximum}`);
  }
  if (typeof value === "string") {
    const len = [...value].length;
    if (typeof s.minLength === "number" && len < s.minLength) errors.push(`${at}: shorter than ${s.minLength}`);
    if (typeof s.maxLength === "number" && len > s.maxLength) errors.push(`${at}: longer than ${s.maxLength}`);
    if (typeof s.pattern === "string" && !new RegExp(s.pattern, "u").test(value)) errors.push(`${at}: does not match the pattern`);
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === "number" && value.length < s.minItems) errors.push(`${at}: fewer than ${s.minItems} items`);
    if (typeof s.maxItems === "number" && value.length > s.maxItems) errors.push(`${at}: more than ${s.maxItems} items`);
    if (s.items && typeof s.items === "object") {
      value.forEach((item, i) => errors.push(...validateSchema(item, s.items as JsonSchema, `${path}/${i}`)));
    }
  }
  if (typeOf(value) === "object") {
    const obj = value as Record<string, unknown>;
    const props = (s.properties ?? {}) as Record<string, JsonSchema>;
    for (const key of (s.required as string[] | undefined) ?? []) {
      if (!Object.hasOwn(obj, key)) errors.push(`${path}/${key}: required`);
    }
    for (const [key, v] of Object.entries(obj)) {
      if (Object.hasOwn(props, key)) errors.push(...validateSchema(v, props[key]!, `${path}/${key}`));
      else if (s.additionalProperties === false) errors.push(`${path}/${key}: not allowed`);
    }
  }
  return errors;
}
