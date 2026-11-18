import type { FieldDef, Json, JsonObject, ListDef } from "./core/types";

/** A 1x1 PNG (the same bytes the goldens validate through fine-print), the stand-in for an image field with no sample. */
export const PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function stand(def: FieldDef): Json {
  if (def.sample !== undefined) return def.sample;
  switch (def.type) {
    case "image":
      return PLACEHOLDER_PNG;
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "date":
      return "2026-01-01";
    default:
      return `[${def.label}]`;
  }
}

function setPath(target: JsonObject, path: string, value: Json): void {
  const segs = path.split(".");
  let cur = target;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]!;
    if (typeof cur[s] !== "object" || cur[s] === null || Array.isArray(cur[s])) cur[s] = {};
    cur = cur[s] as JsonObject;
  }
  cur[segs[segs.length - 1]!] = value;
}

/** Preview data built from every field's and list's sample (plan section 7.4). */
export function sampleData(fields: readonly FieldDef[], lists: readonly ListDef[]): JsonObject {
  const data: JsonObject = {};
  for (const f of fields) setPath(data, f.token, stand(f));
  for (const l of lists) {
    if (l.sample) {
      setPath(data, l.token, l.sample);
      continue;
    }
    const item: JsonObject = {};
    for (const f of l.itemFields) setPath(item, f.token, stand(f));
    setPath(data, l.token, [item, { ...item }]);
  }
  return data;
}
