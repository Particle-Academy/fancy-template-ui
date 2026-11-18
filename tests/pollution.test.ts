/**
 * Prototype pollution (CodeQL js/prototype-pollution-utility and
 * js/prototype-polluting-assignment on src/samples.ts). Field tokens, list tokens,
 * sample paths, style and page patches (from an agent, through the bridge) and an
 * imported document's keys are all consumer-reachable, so none of them may name
 * __proto__, constructor or prototype into an assignment.
 */
import { afterEach, describe, expect, it } from "vitest";
import { addBlock, applyOp, compile, emptyState, openTemplate, type FieldDef, type ListDef } from "../src/core";
import { sampleData } from "../src/samples";

const HOSTILE = ["__proto__.polluted", "constructor.prototype.polluted", "prototype.polluted", "a.__proto__.polluted"];

function polluted(): boolean {
  return (
    ({} as Record<string, unknown>).polluted !== undefined ||
    Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")
  );
}

afterEach(() => {
  delete (Object.prototype as Record<string, unknown>).polluted;
});

describe("prototype pollution", () => {
  it.each(HOSTILE)("sampleData ignores a field token %s", (token) => {
    const fields: FieldDef[] = [{ label: "x", token, sample: "yes" }];
    const data = sampleData(fields, []);
    expect(polluted()).toBe(false);
    expect(JSON.stringify(data)).not.toContain("yes");
  });

  it.each(HOSTILE)("sampleData ignores a list token or item token %s", (token) => {
    const lists: ListDef[] = [
      { label: "l", token, itemFields: [{ label: "i", token: "t", sample: "yes" }] },
      { label: "l2", token: "ok", itemFields: [{ label: "i", token, sample: "yes" }] },
    ];
    sampleData([], lists);
    expect(polluted()).toBe(false);
  });

  it.each(HOSTILE)("compile refuses a host field token %s and declares nothing for it", (token) => {
    const s = addBlock(emptyState(), { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: token }] }] } });
    const out = compile(s, { fields: [{ label: "x", token }] });
    expect(polluted()).toBe(false);
    expect(out.problems.map((p) => p.code)).toContain("FIELD_UNKNOWN");
    expect(Object.keys(out.template.variables)).toEqual([]);
  });

  it("compile refuses an unsafe item token inside a repeat", () => {
    let s = addBlock(emptyState(), { type: "repeat", props: { list: "lines", pageEach: false } });
    const g = Object.values(s.tree.nodes)[0]!.id;
    s = addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: "item.__proto__" }] }] } }, { parent: g });
    const out = compile(s, { lists: [{ label: "Lines", token: "lines", itemFields: [{ label: "p", token: "__proto__" }] }] });
    expect(polluted()).toBe(false);
    expect(out.problems.map((p) => p.code)).toContain("FIELD_UNKNOWN");
  });

  it("a style patch from JSON cannot reach the prototype", () => {
    let s = addBlock(emptyState(), { type: "heading", props: { level: 1, runs: [{ text: "x" }] } });
    const id = Object.keys(s.tree.nodes)[0]!;
    s = applyOp(s, { t: "set_style", id, patch: JSON.parse('{"__proto__": {"polluted": 1}, "align": "center"}') });
    expect(polluted()).toBe(false);
    expect(Object.getPrototypeOf(s.tree.nodes[id]!.style)).toBe(Object.prototype);
    expect(s.tree.nodes[id]!.style).toEqual({ align: "center" });
  });

  it("a page patch from JSON cannot reach the prototype", () => {
    const s = applyOp(emptyState(), { t: "set_page", patch: JSON.parse('{"__proto__": {"polluted": 1}, "size": "a4"}') });
    expect(polluted()).toBe(false);
    expect(Object.getPrototypeOf(s.page)).toBe(Object.prototype);
    expect(s.page.size).toBe("a4");
  });

  it("opening a document whose page carries a __proto__ key keeps it as data, never as a prototype", () => {
    const template = JSON.parse(
      '{"fancyTemplate":1,"writer":"fine-print","variables":{},"document":{"__proto__":{"polluted":1},"page":{"__proto__":{"polluted":1},"size":"a4"},"blocks":[]}}',
    );
    const opened = openTemplate(template, {});
    const out = compile(opened.state, {});
    expect(polluted()).toBe(false);
    expect(Object.getPrototypeOf(out.template.document)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(out.template.document.page)).toBe(Object.prototype);
  });
});
