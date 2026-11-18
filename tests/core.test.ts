import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inspect, render } from "@particle-academy/fancy-template";
import {
  addBlock,
  applyOp,
  checkOp,
  compile,
  createState,
  defineKind,
  emptyState,
  fieldToken,
  openTemplate,
  orderedBlocks,
  type BlockKind,
  type BuilderNode,
  type EditorState,
  type FieldDef,
  type ListDef,
} from "../src/core";

const fields: FieldDef[] = [
  { label: "Customer name", token: "customer.name", sample: "Ada Lovelace" },
  { label: "Quote number", token: "quote.number", sample: "Q-1001" },
  { label: "Logo", token: "logo", type: "image" },
];
const lists: ListDef[] = [
  {
    label: "Line items",
    token: "lines",
    itemFields: [
      { label: "Title", token: "title", sample: "Engine" },
      { label: "Body", token: "body", sample: "One analytical engine." },
    ],
    sample: [{ title: "Engine", body: "One." }],
  },
];

const totals: BlockKind<{ label: string }> = defineKind({
  kind: "acme:totals",
  label: "Totals",
  schema: { type: "object", properties: { label: { type: "string", maxLength: 40 } }, required: ["label"] },
  defaults: { label: "Total" },
  required: "once",
  render: (props) => [{ type: "paragraph", align: "right", runs: [{ text: props.label, bold: true }] }],
});
const sig: BlockKind<{ signer: string }> = defineKind({
  kind: "acme:sig",
  label: "Signature",
  schema: { type: "object", properties: { signer: { type: "string" } } },
  defaults: { signer: "client" },
  allowInRepeat: false,
  render: (p) => [{ type: "paragraph", runs: [{ text: `Signed by ${p.signer}` }] }],
});
const ctx = { fields, lists, kinds: [totals, sig] as BlockKind[] };

function build(steps: (s: EditorState) => EditorState): EditorState {
  return steps(emptyState());
}

function docOf(s: EditorState) {
  const out = compile(s, ctx);
  expect(out.problems).toEqual([]);
  const result = inspect(out.template);
  expect(result.issues).toEqual([]);
  return out.template;
}

describe("compile: built-in blocks", () => {
  it("compiles a heading with accent colour by default and per-block style", () => {
    const s = build((s) =>
      addBlock(s, { type: "heading", props: { level: 1, runs: [{ text: "Quote " }, { field: "quote.number" }] }, style: { align: "center", size: 24 } }),
    );
    const t = docOf(s);
    expect(t.document.blocks).toEqual([
      {
        type: "heading",
        level: 1,
        align: "center",
        runs: [
          { text: "Quote ", size: 24, color: "#1F4E79" },
          { text: "{{ quote.number }}", size: 24, color: "#1F4E79" },
        ],
      },
    ]);
  });

  it("compiles rich text to paragraphs and lists, with bold/italic/underline", () => {
    const s = build((s) =>
      addBlock(s, {
        type: "text",
        props: {
          paras: [
            { type: "paragraph", runs: [{ text: "Dear " }, { field: "customer.name", bold: true }, { text: "," }] },
            { type: "list", ordered: true, items: [[{ text: "One", italic: true }], [{ text: "Two", underline: true }]] },
          ],
        },
        style: { spaceAfter: 12 },
      }),
    );
    const t = docOf(s);
    expect(t.document.blocks).toEqual([
      { type: "paragraph", spaceAfter: 12, runs: [{ text: "Dear " }, { text: "{{ customer.name }}", bold: true }, { text: "," }] },
      { type: "list", ordered: true, items: [{ runs: [{ text: "One", italic: true }] }, { runs: [{ text: "Two", underline: true }] }] },
    ]);
  });

  it("compiles image, table, divider, spacer and page break", () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const s = build((s) => {
      s = addBlock(s, { type: "image", props: { src: png, widthPx: 120, heightPx: 40, alt: "Logo" } });
      s = addBlock(s, { type: "image", props: { field: "logo", widthPx: 96 } });
      s = addBlock(s, {
        type: "table",
        props: { header: true, widths: [70, 30], rows: [[[{ text: "Item" }], [{ text: "Amount" }]], [[{ field: "quote.number" }], [{ text: "1" }]]] },
      });
      s = addBlock(s, { type: "divider", props: { weight: 1 } });
      s = addBlock(s, { type: "spacer", props: { height: 24 } });
      s = addBlock(s, { type: "pageBreak", props: {} });
      return s;
    });
    const t = docOf(s);
    expect(t.document.blocks).toEqual([
      { type: "image", src: png, widthPx: 120, heightPx: 40, alt: "Logo" },
      { type: "image", src: "{{ logo }}", widthPx: 96 },
      {
        type: "table",
        widths: [70, 30],
        rows: [
          { header: true, cells: [{ blocks: [{ type: "paragraph", runs: [{ text: "Item" }] }] }, { blocks: [{ type: "paragraph", runs: [{ text: "Amount" }] }] }] },
          { cells: [{ blocks: [{ type: "paragraph", runs: [{ text: "{{ quote.number }}" }] }] }, { blocks: [{ type: "paragraph", runs: [{ text: "1" }] }] }] },
        ],
      },
      { type: "paragraph", runs: [], spaceBefore: 0, spaceAfter: 8, borders: { bottom: { style: "single", width: 1, color: "#1F4E79" } } },
      { type: "paragraph", runs: [], spaceBefore: 0, spaceAfter: 24 },
      { type: "pageBreak" },
    ]);
    expect(t.variables.logo).toEqual({ type: "image", required: true, description: "Logo" });
  });

  it("compiles page settings with a letterhead band, field chips and page-number chips", () => {
    let s = emptyState();
    s = applyOp(s, {
      t: "set_page",
      patch: {
        size: "a4",
        accent: "#AA3300",
        margins: { top: 90, right: 60, bottom: 72, left: 60 },
        header: { left: [{ text: "Acme Ltd" }], right: [{ text: "Quote " }, { field: "quote.number" }] },
        footer: { center: [{ text: "Page " }, { page: "page" }, { text: " of " }, { page: "pages" }] },
      },
    }, ctx.kinds);
    s = addBlock(s, { type: "heading", props: { level: 1, runs: [{ text: "Hi" }] } });
    const t = docOf(s);
    expect(t.document.page).toEqual({
      size: "a4",
      orientation: "portrait",
      margins: { top: 90, right: 60, bottom: 72, left: 60 },
      header: { left: "Acme Ltd", right: "Quote {{ quote.number }}" },
      footer: { center: "Page {page} of {pages}" },
    });
    expect(t.document.blocks[0].runs[0].color).toBe("#AA3300");
  });

  it("declares only the fields actually used, nested by path, with samples as examples", () => {
    const s = build((s) => addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: "customer.name" }] }] } }));
    const t = docOf(s);
    expect(t.variables).toEqual({
      customer: { type: "object", required: true, properties: { name: { type: "string", required: true, description: "Customer name", example: "Ada Lovelace" } } },
    });
  });

  it("keeps braces typed as text literal: they never become a token", () => {
    const s = build((s) => addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ text: "Use {{ secret }} here" }] }] } }));
    const t = docOf(s);
    const doc = render(t, {});
    expect(doc.blocks[0].runs[0].text).toBe("Use {{ secret }} here");
  });

  it("refuses a field the host did not offer", () => {
    const s = build((s) => addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: "password" }] }] } }));
    const out = compile(s, ctx);
    expect(out.problems.map((p) => p.code)).toContain("FIELD_UNKNOWN");
    expect(JSON.stringify(out.template.document)).not.toContain("password");
  });

  it("writes the builder's source under the editor key", () => {
    const s = build((s) => addBlock(s, { type: "pageBreak", props: {} }));
    const t = docOf(s);
    expect(t.fancyTemplate).toBe(1);
    expect(t.writer).toBe("fine-print");
    expect(t.editor.kind).toBe("fancy-template-ui");
    expect(t.editor.version).toBe(1);
    expect(t.editor.tree).toEqual(s.tree);
  });
});

describe("repeating sections", () => {
  function quote(pageEach: boolean): EditorState {
    let s = emptyState();
    s = addBlock(s, { type: "repeat", props: { list: "lines", pageEach } });
    const group = orderedBlocks(s)[0]!.id;
    s = addBlock(s, { type: "heading", props: { level: 2, runs: [{ field: "item.title" }] } }, { parent: group });
    s = addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: "item.body" }] }] } }, { parent: group });
    return s;
  }

  it("compiles to a $spread with a guarded page break and declares the list", () => {
    const t = docOf(quote(true));
    expect(t.document.blocks[0]).toMatchObject({ $each: "lines", $as: "item", $spread: true });
    expect(t.document.blocks[0].$value[0]).toEqual({ $if: "!$first", type: "pageBreak" });
    expect(t.variables.lines).toEqual({
      type: "array",
      required: true,
      description: "Line items",
      example: [{ title: "Engine", body: "One." }],
      items: {
        type: "object",
        properties: {
          title: { type: "string", required: true, description: "Title", example: "Engine" },
          body: { type: "string", required: true, description: "Body", example: "One analytical engine." },
        },
      },
    });
  });

  it("three items with a page each give exactly two page breaks, in order b1 b2 per item", () => {
    const t = docOf(quote(true));
    const doc = render(t, { lines: [{ title: "A", body: "a" }, { title: "B", body: "b" }, { title: "C", body: "c" }] });
    const shape = (doc.blocks as Array<{ type: string; runs?: Array<{ text: string }> }>).map((b) =>
      b.type === "pageBreak" ? "|" : b.runs![0]!.text,
    );
    expect(shape).toEqual(["A", "a", "|", "B", "b", "|", "C", "c"]);
  });

  it("zero items give nothing", () => {
    const doc = render(docOf(quote(true)), { lines: [] });
    expect(doc.blocks).toEqual([]);
  });

  it("without a page each, items flow on", () => {
    const doc = render(docOf(quote(false)), { lines: [{ title: "A", body: "a" }, { title: "B", body: "b" }] });
    expect((doc.blocks as unknown[]).length).toBe(4);
  });

  it("refuses a repeat inside a repeat, and a kind that is not allowed in a repeat", () => {
    const s = quote(true);
    const group = orderedBlocks(s)[0]!.id;
    const nested = { t: "insert" as const, node: node("repeat", { list: "lines", pageEach: false }, group) };
    expect(checkOp(s, nested, ctx.kinds)).toMatch(/repeat/i);
    const sigIn = { t: "insert" as const, node: node("host:acme:sig", { signer: "x" }, group) };
    expect(checkOp(s, sigIn, ctx.kinds)).toMatch(/not allowed in a repeat/i);
  });

  it("an item field outside its repeat is refused", () => {
    const s = build((s) => addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: "item.title" }] }] } }));
    expect(compile(s, ctx).problems.map((p) => p.code)).toContain("FIELD_UNKNOWN");
  });
});

function node(type: string, props: Record<string, unknown>, parent: string | null = null): BuilderNode {
  return { id: `n_test_${type}_${Math.random().toString(36).slice(2, 8)}`, type, parent, order: "z", props };
}

describe("host block kinds", () => {
  it("renders a host kind through its render function, validated against its schema", () => {
    const s = createState([], ctx.kinds);
    const t = docOf(s);
    expect(t.document.blocks).toEqual([{ type: "paragraph", align: "right", runs: [{ text: "Total", bold: true }] }]);
  });

  it("reports an invalid prop against the kind's schema on the block, not as a crash", () => {
    let s = createState([], ctx.kinds);
    const id = orderedBlocks(s)[0]!.id;
    s = applyOp(s, { t: "set_props", id, patch: { label: 5 } }, ctx.kinds);
    const out = compile(s, ctx);
    expect(out.problems).toEqual([expect.objectContaining({ code: "KIND_PROPS", node: id })]);
  });

  it("a kind whose render throws is reported on the block", () => {
    const bad = defineKind({ kind: "acme:bad", label: "Bad", schema: { type: "object" }, defaults: {}, render: () => { throw new Error("boom"); } });
    const s = addBlock(emptyState(), { type: "host:acme:bad", props: {} });
    const out = compile(s, { ...ctx, kinds: [...ctx.kinds, bad] });
    expect(out.problems.map((p) => p.code)).toContain("KIND_RENDER");
  });

  it("an unknown kind is kept as a locked block: settings and compiled output untouched", () => {
    const s = createState([], ctx.kinds);
    const t = compile(s, ctx).template;
    const reopened = openTemplate(t, { ...ctx, kinds: [] });
    expect(reopened.drift).toBe(false);
    const again = compile(reopened.state, { ...ctx, kinds: [] });
    expect(again.template.document).toEqual(t.document);
    expect(again.problems.map((p) => p.code)).toEqual(["KIND_UNKNOWN"]);
  });

  it("rejects a malformed kind name", () => {
    expect(() => defineKind({ ...totals, kind: "Totals" } as BlockKind)).toThrow(/namespaced/);
  });
});

describe("required exactly once", () => {
  it("is inserted at the end on load when missing, with a notice", () => {
    const opened = openTemplate(compile(addBlock(emptyState(), { type: "pageBreak", props: {} }), { ...ctx, kinds: [] }).template, ctx);
    const types = orderedBlocks(opened.state).map((n) => n.type);
    expect(types).toEqual(["pageBreak", "host:acme:totals"]);
    expect(opened.notices.join(" ")).toMatch(/Totals/);
  });

  it("cannot be removed and cannot be added twice, but can be moved and styled", () => {
    let s = createState([], ctx.kinds);
    const id = orderedBlocks(s)[0]!.id;
    expect(checkOp(s, { t: "remove", id }, ctx.kinds)).toMatch(/required/i);
    expect(applyOp(s, { t: "remove", id }, ctx.kinds)).toBe(s);
    const second = { t: "insert" as const, node: node("host:acme:totals", { label: "x" }) };
    expect(checkOp(s, second, ctx.kinds)).toMatch(/once/i);
    s = addBlock(s, { type: "pageBreak", props: {} });
    expect(checkOp(s, { t: "move", id, parent: null, order: "zz" }, ctx.kinds)).toBeNull();
    expect(checkOp(s, { t: "set_style", id, patch: { align: "center" } }, ctx.kinds)).toBeNull();
  });
});

describe("ops and undo", () => {
  it("every op has an exact inverse", async () => {
    const { invertOp } = await import("../src/core");
    let s = emptyState();
    s = addBlock(s, { type: "heading", props: { level: 1, runs: [{ text: "A" }] } });
    const id = orderedBlocks(s)[0]!.id;
    for (const op of [
      { t: "set_style" as const, id, patch: { color: "#112233" } },
      { t: "set_page" as const, patch: { accent: "#000000" } },
      { t: "set_props" as const, id, patch: { level: 2 } },
      { t: "remove" as const, id },
    ]) {
      const inv = invertOp(s, op);
      const after = applyOp(s, op, ctx.kinds);
      const back = inv.reduce((d, o) => applyOp(d, o, ctx.kinds), after);
      expect(compile(back, ctx).template.document).toEqual(compile(s, ctx).template.document);
    }
  });
});

describe("open: import, round trip and drift", () => {
  it("import(compile(tree)) gives the same built-in tree back without an editor key", () => {
    let s = emptyState();
    s = addBlock(s, { type: "heading", props: { level: 2, runs: [{ text: "Hi" }] }, style: { align: "center" } });
    s = addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ text: "Dear " }, { field: "customer.name" }] }] } });
    s = addBlock(s, { type: "divider", props: {} });
    s = addBlock(s, { type: "spacer", props: { height: 12 } });
    s = addBlock(s, { type: "pageBreak", props: {} });
    const t = compile(s, ctx).template;
    const { editor: _drop, ...bare } = t;
    const plain = { fields, lists, kinds: [] };
    const opened = openTemplate(bare, plain);
    expect(orderedBlocks(opened.state).map((n) => [n.type, n.props, n.style ?? {}])).toEqual(
      orderedBlocks(s).map((n) => [n.type, n.props, n.style ?? {}]),
    );
    expect(compile(opened.state, plain).template.document).toEqual(t.document);
  });

  // Copied from fancy-template/examples (it does not ship them on npm), at
  // fancy-template 0.5.0. Every fine-print example belongs here.
  const examples = join(__dirname, "fixtures");
  const files = (() => {
    try {
      return readdirSync(examples).filter((f) => f.endsWith(".fine-print.json"));
    } catch {
      return [];
    }
  })();

  it.each(files.length ? files : ["(none shipped)"])("every fine-print example opens and saves a byte-identical document: %s", (f) => {
    if (f === "(none shipped)") return;
    const template = JSON.parse(readFileSync(join(examples, f), "utf8"));
    const opened = openTemplate(template, { kinds: [], fields: [], lists: [] });
    const out = compile(opened.state, { kinds: [], fields: [], lists: [] });
    expect(JSON.stringify(out.template.document)).toBe(JSON.stringify(template.document));
    expect(out.template.variables).toEqual(template.variables);
  });

  it("a hand-written fine-print template opens with unmappable blocks kept raw and exact", () => {
    const template = {
      fancyTemplate: 1,
      writer: "fine-print",
      variables: { n: { type: "string" } },
      document: {
        title: "T",
        defaultFont: "Times",
        page: { size: "letter", background: "#FDFAF3" },
        blocks: [
          { type: "quote", blocks: [{ type: "paragraph", runs: [{ text: "q" }] }] },
          { $if: "n", type: "paragraph", runs: [{ text: "{{ n }}" }] },
          { type: "paragraph", runs: [{ text: "a", font: "Courier" }] },
        ],
      },
    };
    const opened = openTemplate(template, ctx);
    expect(orderedBlocks(opened.state).map((n) => n.type)).toEqual(["raw", "raw", "raw", "host:acme:totals"]);
    const out = compile(opened.state, ctx);
    expect(out.template.variables).toEqual(template.variables);
    expect(out.template.document.blocks.slice(0, 3)).toEqual(template.document.blocks);
    expect(out.template.document.page).toEqual({ size: "letter", background: "#FDFAF3" });
    expect(out.template.document.title).toBe("T");
  });

  it("detects drift between editor and document and never silently picks one", () => {
    const s = addBlock(emptyState(), { type: "heading", props: { level: 1, runs: [{ text: "Builder" }] } });
    const t = compile(s, ctx).template;
    const edited = { ...t, document: { ...t.document, blocks: [{ type: "paragraph", runs: [{ text: "Hand edit" }] }] } };
    const opened = openTemplate(edited, { ...ctx, kinds: [] });
    expect(opened.drift).toBe(true);
    expect(compile(opened.state, { ...ctx, kinds: [] }).template.document.blocks[0].runs[0].text).toBe("Builder");
    expect(compile(opened.fromDocument!, { ...ctx, kinds: [] }).template.document.blocks).toEqual(edited.document.blocks);
  });
});

describe("fieldToken", () => {
  it("writes the canonical token", () => {
    expect(fieldToken("customer.name")).toBe("{{ customer.name }}");
  });
});
