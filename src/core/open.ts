/**
 * Opening a template (plan section 5.2).
 *
 * - With an `editor` key: the builder's own source. If `document` was edited
 *   outside the builder since, `drift` is true and BOTH versions are returned;
 *   the caller asks the person. Never silently picks one.
 * - Without one (hand- or agent-written): `document` is imported into built-in
 *   blocks. A block is mapped only when compiling the mapped block reproduces it
 *   EXACTLY; anything else becomes a read-only raw block holding it verbatim, so
 *   opening and saving never loses or changes data.
 */
import { compile, escapeText, ITEM_ALIAS } from "./compile";
import { addBlock, defaultPage, emptyState, ensureRequired, groupBlocks, orderedBlocks, type NewBlock } from "./model";
import type {
  Band,
  BandPart,
  BlockStyle,
  CompileContext,
  EditorState,
  Json,
  JsonObject,
  Page,
  RichRun,
  TextPara,
} from "./types";

export interface OpenResult {
  /** The state to edit: the builder's source when present, else the import. */
  state: EditorState;
  /** True when `document` no longer matches what `editor` compiles to. */
  drift: boolean;
  /** On drift: the document imported as a state, for "keep the document". */
  fromDocument?: EditorState;
  /** Things the person should be told (a required block was added, ...). */
  notices: string[];
}

function isObj(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Canonical JSON with sorted keys: equality of content, not of key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObj(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

const WHOLE_TOKEN = /^\{\{ ([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*) \}\}$/;
const ESCAPED_OPEN = '{{ "{{" }}';

function unescapeText(s: string): string | null {
  const plain = s.split(ESCAPED_OPEN).join("\u0000");
  if (plain.includes("{{")) return null;
  return plain.split("\u0000").join("{{");
}

/** Runs back to rich runs, lifting a uniform size/colour into the style. Null when not representable. */
function richRuns(runs: unknown, style: BlockStyle): RichRun[] | null {
  if (!Array.isArray(runs)) return null;
  const out: RichRun[] = [];
  let size: number | undefined;
  let color: string | undefined;
  runs.forEach((r, i) => {
    if (!isObj(r) || typeof r.text !== "string") throw new Skip();
    for (const k of Object.keys(r)) if (!["text", "bold", "italic", "underline", "size", "color"].includes(k)) throw new Skip();
    if (i === 0) {
      size = r.size as number | undefined;
      color = r.color as string | undefined;
    } else if (r.size !== size || r.color !== color) throw new Skip();
    const m = WHOLE_TOKEN.exec(r.text);
    const rr: RichRun = {};
    if (m) rr.field = m[1];
    else {
      const t = unescapeText(r.text);
      if (t === null) throw new Skip();
      rr.text = t;
    }
    if (r.bold === true) rr.bold = true;
    if (r.italic === true) rr.italic = true;
    if (r.underline === true) rr.underline = true;
    out.push(rr);
  });
  if (size !== undefined) style.size = size;
  if (color !== undefined) style.color = color;
  return out;
}

class Skip extends Error {}

function paraStyle(b: JsonObject, style: BlockStyle): void {
  if (typeof b.align === "string") style.align = b.align as BlockStyle["align"];
  if (typeof b.spaceBefore === "number") style.spaceBefore = b.spaceBefore;
  if (typeof b.spaceAfter === "number") style.spaceAfter = b.spaceAfter;
}

/** Candidate built-in blocks for one document block, most specific first. */
function candidates(b: JsonObject, accent: string): NewBlock[] {
  const out: NewBlock[] = [];
  const attempt = (fn: () => NewBlock | null) => {
    try {
      const c = fn();
      if (c) out.push(c);
    } catch (e) {
      if (!(e instanceof Skip)) throw e;
    }
  };
  switch (b.type) {
    case "heading":
      attempt(() => {
        const style: BlockStyle = {};
        paraStyle(b, style);
        const runs = richRuns(b.runs, style)!;
        if (style.color === accent) delete style.color;
        return { type: "heading", props: { level: b.level, runs }, style };
      });
      break;
    case "paragraph": {
      const runs = b.runs as unknown[];
      const borders = b.borders as JsonObject | undefined;
      if (Array.isArray(runs) && runs.length === 0 && isObj(borders) && isObj(borders.bottom)) {
        attempt(() => {
          const bottom = borders.bottom as JsonObject;
          const props: JsonObject = {};
          if (bottom.width !== 0.75) props.weight = bottom.width as number;
          if (bottom.color !== accent) props.color = bottom.color as string;
          const style: BlockStyle = {};
          if (b.spaceBefore !== 0) style.spaceBefore = b.spaceBefore as number;
          if (b.spaceAfter !== 8) style.spaceAfter = b.spaceAfter as number;
          return { type: "divider", props, style };
        });
      }
      if (Array.isArray(runs) && runs.length === 0 && typeof b.spaceAfter === "number") {
        attempt(() => ({ type: "spacer", props: { height: b.spaceAfter } }));
      }
      attempt(() => {
        const style: BlockStyle = {};
        paraStyle(b, style);
        const rr = richRuns(b.runs, style)!;
        return { type: "text", props: { paras: [{ type: "paragraph", runs: rr }] }, style };
      });
      break;
    }
    case "list":
      attempt(() => {
        const style: BlockStyle = {};
        const items = (b.items as unknown[]).map((it) => {
          if (!isObj(it) || it.children !== undefined) throw new Skip();
          return richRuns(it.runs, style)!;
        });
        const para: TextPara = { type: "list", items };
        if (b.ordered === true) para.ordered = true;
        return { type: "text", props: { paras: [para] }, style };
      });
      break;
    case "image":
      attempt(() => {
        const props: JsonObject = {};
        const m = typeof b.src === "string" ? WHOLE_TOKEN.exec(b.src) : null;
        if (m) props.field = m[1]!;
        else props.src = b.src as string;
        if (b.widthPx !== undefined) props.widthPx = b.widthPx as number;
        if (b.heightPx !== undefined) props.heightPx = b.heightPx as number;
        if (typeof b.alt === "string") {
          const alt = unescapeText(b.alt);
          if (alt === null) throw new Skip();
          props.alt = alt;
        }
        return { type: "image", props };
      });
      break;
    case "table":
      attempt(() => {
        const style: BlockStyle = {};
        const rows = (b.rows as unknown[]).map((row) => {
          if (!isObj(row)) throw new Skip();
          return (row.cells as unknown[]).map((cell) => {
            if (!isObj(cell) || !Array.isArray(cell.blocks) || cell.blocks.length !== 1) throw new Skip();
            const p = cell.blocks[0];
            if (!isObj(p) || p.type !== "paragraph") throw new Skip();
            return richRuns(p.runs, style)!;
          });
        });
        const first = (b.rows as JsonObject[])[0];
        const props: JsonObject = { header: first?.header === true, rows: rows as unknown as Json };
        if (Array.isArray(b.widths)) props.widths = b.widths;
        return { type: "table", props, style };
      });
      break;
    case "pageBreak":
      out.push({ type: "pageBreak", props: {} });
      break;
  }
  return out;
}

function compileOne(state: EditorState, block: NewBlock, ctx: CompileContext): unknown[] {
  const s = addBlock({ ...state, tree: { nodes: {} } }, block);
  return compile(s, ctx).template.document.blocks as unknown[];
}

/** Map one top-level document block onto the state. */
function importBlock(state: EditorState, b: unknown, ctx: CompileContext, parent: string | null): EditorState {
  if (isObj(b) && parent === null && b.$spread === true && b.$as === ITEM_ALIAS && typeof b.$each === "string" && Array.isArray(b.$value)) {
    const value = [...b.$value];
    let pageEach = false;
    const first = value[0];
    if (isObj(first) && first.type === "pageBreak" && first.$if === "!$first" && Object.keys(first).length === 2) {
      pageEach = true;
      value.shift();
    }
    let s = addBlock(state, { type: "repeat", props: { list: b.$each, pageEach } });
    const group = orderedBlocks(s).at(-1)!.id;
    for (const child of value) s = importBlock(s, child, ctx, group);
    // Keep the group only if it compiles back exactly; else the whole thing is raw.
    const probe: EditorState = { ...s, tree: { nodes: {} } };
    let p2 = addBlock(probe, { type: "repeat", props: { list: b.$each, pageEach } });
    const gid = orderedBlocks(p2)[0]!.id;
    for (const child of groupBlocks(s, group)) p2 = addBlock(p2, { type: child.type, props: child.props, style: child.style }, { parent: gid });
    if (canonical(compile(p2, ctx).template.document.blocks) === canonical([b])) return s;
    return addBlock(state, { type: "raw", props: { block: b } }, { parent });
  }
  if (isObj(b) && !Object.keys(b).some((k) => k.startsWith("$"))) {
    for (const c of candidates(b, state.page.accent)) {
      if (canonical(compileOne(state, c, ctx)) === canonical([b])) {
        const style = c.style && Object.keys(c.style).length ? c.style : undefined;
        return addBlock(state, { type: c.type, props: c.props, ...(style ? { style } : {}) }, { parent });
      }
    }
  }
  return addBlock(state, { type: "raw", props: { block: b as Json } }, { parent });
}

function bandParts(s: unknown): BandPart[] | null {
  if (typeof s !== "string") return null;
  const parts: BandPart[] = [];
  const re = /\{\{ ([A-Za-z_][A-Za-z0-9_.]*) \}\}|\{(page|pages)\}/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) });
    if (m[1]) parts.push({ field: m[1] });
    else parts.push({ page: m[2] as "page" | "pages" });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last) });
  for (const p of parts) if ("text" in p && (p.text.includes("{{") || escapeText(p.text) !== p.text)) return null;
  return parts;
}

function importPage(raw: unknown, state: EditorState, ctx: CompileContext): Page {
  const page: Page = defaultPage();
  if (!isObj(raw)) {
    page.implicit = ["size", "orientation", "margins"];
    return page;
  }
  const implicit: Page["implicit"] = [];
  const extra: JsonObject = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "size" && (v === "letter" || v === "a4" || v === "legal")) page.size = v;
    else if (k === "orientation" && (v === "portrait" || v === "landscape")) page.orientation = v;
    else if (
      k === "margins" && isObj(v) &&
      ["top", "right", "bottom", "left"].every((s) => typeof v[s] === "number") && Object.keys(v).length === 4
    ) page.margins = v as Page["margins"];
    else if (["header", "footer", "firstHeader", "firstFooter"].includes(k) && isObj(v)) {
      const band: Band = {};
      let ok = Object.keys(v).every((s) => ["left", "center", "right"].includes(s));
      for (const slot of ["left", "center", "right"] as const) {
        if (v[slot] === undefined) continue;
        const parts = bandParts(v[slot]);
        if (!parts) ok = false;
        else band[slot] = parts;
      }
      if (ok) page[k as "header"] = band;
      else extra[k] = v;
    } else extra[k] = v;
  }
  for (const k of ["size", "orientation", "margins"] as const) if (!Object.hasOwn(raw, k)) implicit.push(k);
  if (implicit.length) page.implicit = implicit;
  if (Object.keys(extra).length) page.extra = extra;
  // Exactness check: if the mapped page does not compile back to the same
  // bytes (key order included), keep the whole page as written.
  const probe = compile({ ...state, tree: { nodes: {} }, page }, ctx).template.document.page;
  if (JSON.stringify(probe ?? {}) === JSON.stringify(raw)) return page;
  return { ...page, implicit: ["size", "orientation", "margins"], extra: structuredClone(raw), header: undefined, footer: undefined, firstHeader: undefined, firstFooter: undefined };
}

/** Import a template's `document` into a fresh state. */
export function importDocument(template: unknown, ctx: CompileContext = {}): EditorState {
  const t = isObj(template) ? template : {};
  const doc = isObj(t.document) ? t.document : {};
  let s = emptyState();
  if (isObj(t.variables) && Object.keys(t.variables).length) s.variables = structuredClone(t.variables);
  if (typeof t.description === "string") s.description = t.description;
  const docExtra: JsonObject = {};
  for (const [k, v] of Object.entries(doc)) docExtra[k] = k === "page" || k === "blocks" ? null : structuredClone(v);
  if (Object.keys(docExtra).some((k) => k !== "page" && k !== "blocks") || Object.keys(docExtra)[0] === "blocks") s.docExtra = docExtra;
  // Imported field tokens may name variables the host list does not, so
  // compile against the kept declarations as well (see Compiler.isDeclared).
  s.page = importPage(doc.page, s, ctx);
  for (const b of Array.isArray(doc.blocks) ? doc.blocks : []) s = importBlock(s, b, ctx, null);
  return s;
}

function isEditor(v: unknown): v is EditorState {
  return isObj(v) && v.kind === "fancy-template-ui" && v.version === 1 && isObj(v.tree) && isObj((v.tree as JsonObject).nodes) && isObj(v.page);
}

/** Open a template for editing. See the module comment. */
export function openTemplate(template: unknown, ctx: CompileContext = {}): OpenResult {
  const t = isObj(template) ? template : {};
  const notices: string[] = [];
  let state: EditorState;
  let drift = false;
  let fromDocument: EditorState | undefined;

  if (isEditor(t.editor)) {
    state = structuredClone(t.editor) as EditorState;
    const recompiled = compile(state, ctx).template.document;
    if (canonical(recompiled) !== canonical(t.document)) {
      drift = true;
      fromDocument = importDocument(template, ctx);
      notices.push("The document was edited outside the builder since it was last saved. Choose which version to keep.");
    }
  } else {
    state = importDocument(template, ctx);
  }

  const ensured = ensureRequired(state, ctx.kinds);
  state = ensured.state;
  for (const label of ensured.added) notices.push(`${label} is required, so it was added at the end.`);
  if (fromDocument) fromDocument = ensureRequired(fromDocument, ctx.kinds).state;
  return { state, drift, ...(fromDocument ? { fromDocument } : {}), notices };
}
