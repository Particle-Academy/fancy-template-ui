/**
 * Guards against prototype pollution. Field tokens, list tokens, sample paths,
 * style and page patches (an agent's JSON, through the bridge) and an imported
 * document's keys are all consumer-reachable, so a key never reaches an
 * assignment as `__proto__`, `constructor` or `prototype` unchecked.
 */

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/** fancy-template's `name` grammar (SPEC section 5). */
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN.has(key);
}

/**
 * A dotted field path every segment of which is a fancy-template name and none a
 * prototype key. Anything else is refused as a field, a list or a sample path.
 */
export function isSafePath(path: string): boolean {
  if (typeof path !== "string" || path === "") return false;
  return path.split(".").every((seg) => NAME.test(seg) && !FORBIDDEN.has(seg));
}

/**
 * Set an own, enumerable data property, whatever the key. For copying keys that
 * are DATA (an imported document's), where a forbidden name must survive as a
 * plain property rather than be dropped or become a prototype.
 */
export function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}
