/**
 * Source model to fancy-template envelope (plan section 5.3). `document` is
 * regenerated from the tree on every change, so a server never needs the
 * builder to render; `editor` carries the tree so the builder can reopen it.
 *
 * Field tokens are written only where the fine-print profile allows them: run
 * text, band slots, image `src` (a whole token) and `alt`. Literal `{{` typed by
 * a person is escaped, so text a person types never becomes a token.
 */
import { inspect } from "@particle-academy/fancy-template";
import { childrenOf, roots } from "@particle-academy/fancy-doc-commons";
import { HOST_PREFIX, kindOf } from "./model";
import { validateSchema } from "./schema";
import { isSafePath, setOwn } from "./safe";
import type {
  Band,
  BandPart,
  BlockKind,
  BlockStyle,
  BuilderNode,
  CompileContext,
  DividerProps,
  EditorState,
  FieldDef,
  HeadingProps,
  ImageProps,
  Json,
  JsonObject,
  ListDef,
  Page,
  Problem,
  RepeatProps,
  RichRun,
  SpacerProps,
  TableProps,
  TemplateEnvelope,
  TextProps,
} from "./types";

export const ITEM_ALIAS = "item";

export function fieldToken(token: string): string {
  return `{{ ${token} }}`;
}

/** Literal text: every `{{` becomes the string-literal token that renders it. */
export function escapeText(text: string): string {
  return text.replace(/\{\{/g, '{{ "{{" }}');
}

export interface CompileResult {
  template: TemplateEnvelope;
  problems: Problem[];
}

interface Scope {
  /** The repeat's list, when compiling inside one. */
  list?: ListDef;
}

class Compiler {
  readonly problems: Problem[] = [];
  /** Host fields used, by token. */
  readonly usedFields = new Map<string, FieldDef>();
  /** Lists used, by token, with the item fields used. */
  readonly usedLists = new Map<string, { list: ListDef; items: Map<string, FieldDef> }>();
  private readonly fields: Map<string, FieldDef>;
  private readonly lists: Map<string, ListDef>;
  private readonly declared: JsonObject;
  readonly caches = new Map<string, Json[]>();

  constructor(
    private readonly state: EditorState,
    private readonly ctx: CompileContext,
  ) {
    // A token that is not a plain dotted name (or names a prototype key) is
    // never offered, so it can never reach a declaration path.
    this.fields = new Map((ctx.fields ?? []).filter((f) => isSafePath(f.token)).map((f) => [f.token, f]));
    this.lists = new Map(
      (ctx.lists ?? [])
        .filter((l) => isSafePath(l.token) && !l.token.includes("."))
        .map((l) => [l.token, { ...l, itemFields: l.itemFields.filter((f) => isSafePath(f.token)) }]),
    );
    this.declared = state.variables ?? {};
  }

  get accent(): string {
    return this.state.page.accent;
  }

  private color(c: string | undefined): string | undefined {
    return c === "accent" ? this.accent : c;
  }

  /** The token text for a field chip, or null (with a problem) when it is not offered. */
  token(field: string, scope: Scope, node?: string): string | null {
    if (!isSafePath(field)) {
      this.problems.push({ code: "FIELD_UNKNOWN", message: `"${field}" is not a field name.`, ...(node ? { node } : {}) });
      return null;
    }
    if (scope.list && field.startsWith(`${ITEM_ALIAS}.`)) {
      const rel = field.slice(ITEM_ALIAS.length + 1);
      const def = scope.list.itemFields.find((f) => f.token === rel);
      if (def) {
        this.usedLists.get(scope.list.token)!.items.set(rel, def);
        return fieldToken(field);
      }
    }
    const def = this.fields.get(field);
    if (def) {
      this.usedFields.set(field, def);
      return fieldToken(field);
    }
    if (this.isDeclared(field)) return fieldToken(field);
    this.problems.push({ code: "FIELD_UNKNOWN", message: `The field "${field}" is not one the host offers.`, ...(node ? { node } : {}) });
    return null;
  }

  /** A path the kept (imported) declarations already cover. */
  private isDeclared(path: string): boolean {
    if (!isSafePath(path)) return false;
    const [head, ...rest] = path.split(".");
    if (!Object.hasOwn(this.declared, head!)) return false;
    let decl = this.declared[head!] as JsonObject | undefined;
    for (const seg of rest) {
      if (!decl || decl.type !== "object") return false;
      const props = decl.properties as JsonObject | undefined;
      decl = props && Object.hasOwn(props, seg) ? (props[seg] as JsonObject) : undefined;
    }
    return decl !== undefined;
  }

  runs(runs: RichRun[], style: BlockStyle | undefined, scope: Scope, node: string, defaultColor?: string): JsonObject[] {
    const out: JsonObject[] = [];
    const color = this.color(style?.color) ?? defaultColor;
    for (const r of runs) {
      let text: string;
      if (r.field !== undefined) {
        const t = this.token(r.field, scope, node);
        if (t === null) continue;
        text = t;
      } else {
        text = escapeText(r.text ?? "");
      }
      const run: JsonObject = { text };
      if (r.bold) run.bold = true;
      if (r.italic) run.italic = true;
      if (r.underline) run.underline = true;
      if (style?.size !== undefined) run.size = style.size;
      if (color !== undefined) run.color = color;
      out.push(run);
    }
    return out;
  }

  private paraStyle(block: JsonObject, style: BlockStyle | undefined): JsonObject {
    if (style?.align) block.align = style.align;
    if (style?.spaceBefore !== undefined) block.spaceBefore = style.spaceBefore;
    if (style?.spaceAfter !== undefined) block.spaceAfter = style.spaceAfter;
    return block;
  }

  block(node: BuilderNode, scope: Scope): Json[] {
    const p = node.props;
    const style = node.style;
    switch (node.type) {
      case "heading": {
        const h = p as unknown as HeadingProps;
        const b: JsonObject = { type: "heading", level: h.level };
        this.paraStyle(b, style);
        b.runs = this.runs(h.runs ?? [], style, scope, node.id, this.accent);
        return [b];
      }
      case "text": {
        const t = p as unknown as TextProps;
        return (t.paras ?? []).map((para) => {
          if (para.type === "list") {
            const b: JsonObject = { type: "list" };
            if (para.ordered) b.ordered = true;
            b.items = para.items.map((item) => ({ runs: this.runs(item, style, scope, node.id) }));
            return b;
          }
          const b: JsonObject = { type: "paragraph" };
          this.paraStyle(b, style);
          b.runs = this.runs(para.runs, style, scope, node.id);
          return b;
        });
      }
      case "image": {
        const im = p as unknown as ImageProps;
        let src: string | null = null;
        if (im.field) src = this.token(im.field, scope, node.id);
        else if (im.src) src = im.src;
        if (src === null) {
          if (!im.field) this.problems.push({ code: "IMAGE_EMPTY", message: "This image has no picture yet.", node: node.id });
          return [];
        }
        const b: JsonObject = { type: "image", src };
        if (im.widthPx !== undefined) b.widthPx = im.widthPx;
        if (im.heightPx !== undefined) b.heightPx = im.heightPx;
        if (im.alt !== undefined) b.alt = escapeText(im.alt);
        return [b];
      }
      case "table": {
        const t = p as unknown as TableProps;
        const b: JsonObject = { type: "table" };
        if (t.widths && t.widths.length) b.widths = t.widths;
        b.rows = (t.rows ?? []).map((row, r) => {
          const out: JsonObject = {};
          if (r === 0 && t.header) out.header = true;
          out.cells = row.map((cell) => ({
            blocks: [{ type: "paragraph", runs: this.runs(cell, style, scope, node.id) }],
          }));
          return out;
        });
        return [b];
      }
      case "divider": {
        const d = p as unknown as DividerProps;
        return [
          {
            type: "paragraph",
            runs: [],
            spaceBefore: style?.spaceBefore ?? 0,
            spaceAfter: style?.spaceAfter ?? 8,
            borders: { bottom: { style: "single", width: d.weight ?? 0.75, color: this.color(d.color) ?? this.accent } },
          },
        ];
      }
      case "spacer": {
        const sp = p as unknown as SpacerProps;
        return [{ type: "paragraph", runs: [], spaceBefore: 0, spaceAfter: sp.height }];
      }
      case "pageBreak":
        return [{ type: "pageBreak" }];
      case "raw":
        return [structuredClone((p as { block: Json }).block)];
      case "repeat":
        return this.repeat(node);
      default:
        if (node.type.startsWith(HOST_PREFIX)) return this.host(node, scope);
        this.problems.push({ code: "KIND_UNKNOWN", message: `Unknown block type "${node.type}".`, node: node.id });
        return [];
    }
  }

  /** A list from the host, else one synthesised from a kept (imported) array declaration. */
  private listFor(token: string): ListDef | undefined {
    const host = this.lists.get(token);
    if (host) return host;
    const decl = Object.hasOwn(this.declared, token) ? (this.declared[token] as JsonObject) : undefined;
    const items = decl?.type === "array" ? (decl.items as JsonObject | undefined) : undefined;
    if (!items || items.type !== "object") return undefined;
    const props = (items.properties ?? {}) as JsonObject;
    const list: ListDef = {
      label: token,
      token,
      itemFields: Object.keys(props).map((k) => ({ label: k, token: k })),
    };
    this.keptLists.add(token);
    return list;
  }

  /** Lists whose declaration was kept from an import, so it is never rewritten. */
  readonly keptLists = new Set<string>();

  private repeat(node: BuilderNode): Json[] {
    const rp = node.props as unknown as RepeatProps;
    const list = this.listFor(rp.list);
    if (!list) {
      this.problems.push({ code: "LIST_UNKNOWN", message: `The list "${rp.list}" is not one the host offers.`, node: node.id });
      return [];
    }
    if (!this.usedLists.has(list.token)) this.usedLists.set(list.token, { list, items: new Map() });
    const value: Json[] = [];
    if (rp.pageEach) value.push({ $if: "!$first", type: "pageBreak" });
    for (const child of childrenOf(this.state.tree, node.id)) value.push(...this.block(child, { list }));
    return [{ $each: list.token, $as: ITEM_ALIAS, $spread: true, $value: value }];
  }

  private host(node: BuilderNode, scope: Scope): Json[] {
    const kind = kindOf(node, this.ctx.kinds);
    const cached = node.cache ?? [];
    if (!kind) {
      this.problems.push({
        code: "KIND_UNKNOWN",
        message: `"${node.type.slice(HOST_PREFIX.length)}" is not registered here. It is kept, locked, exactly as last compiled.`,
        node: node.id,
      });
      return structuredClone(cached);
    }
    const errors = validateSchema(node.props, kind.schema);
    if (errors.length > 0) {
      this.problems.push({ code: "KIND_PROPS", message: `${kind.label}: ${errors[0]}`, node: node.id });
      return structuredClone(cached);
    }
    let out: Json[];
    try {
      out = kind.render(node.props as JsonObject, {
        page: this.state.page,
        accent: this.accent,
        fieldToken: (t: string) => this.token(t, scope, node.id) ?? "",
      });
      if (!Array.isArray(out)) throw new Error("render must return an array of blocks");
      out = JSON.parse(JSON.stringify(out)) as Json[];
    } catch (e) {
      this.problems.push({ code: "KIND_RENDER", message: `${kind.label}: ${(e as Error).message}`, node: node.id });
      return structuredClone(cached);
    }
    this.caches.set(node.id, out);
    return out;
  }

  bandSlot(parts: BandPart[] | undefined): string | undefined {
    if (!parts || parts.length === 0) return undefined;
    let s = "";
    for (const part of parts) {
      if ("field" in part) s += this.token(part.field, {}) ?? "";
      else if ("page" in part) s += part.page === "pages" ? "{pages}" : "{page}";
      else s += escapeText(part.text);
    }
    return s === "" ? undefined : s;
  }

  band(b: Band | undefined): JsonObject | undefined {
    if (!b) return undefined;
    const out: JsonObject = {};
    for (const slot of ["left", "center", "right"] as const) {
      const v = this.bandSlot(b[slot]);
      if (v !== undefined) out[slot] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }

  page(page: Page): JsonObject {
    const implicit = new Set(page.implicit ?? []);
    const out: JsonObject = {};
    if (!implicit.has("size")) out.size = page.size;
    if (!implicit.has("orientation")) out.orientation = page.orientation;
    if (!implicit.has("margins")) out.margins = { ...page.margins };
    for (const key of ["header", "footer", "firstHeader", "firstFooter"] as const) {
      const b = this.band(page[key]);
      if (b) out[key] = b;
    }
    return { ...out, ...(page.extra ?? {}) };
  }

  variables(): JsonObject {
    const out: JsonObject = structuredClone(this.state.variables ?? {});
    for (const [token, def] of this.usedFields) {
      const path = token.split(".");
      let target = out;
      for (let i = 0; i < path.length - 1; i++) {
        const seg = path[i]!;
        let decl = Object.hasOwn(target, seg) ? (target[seg] as JsonObject) : undefined;
        if (!decl || decl.type !== "object") {
          if (decl) {
            this.problems.push({ code: "VARIABLE_CONFLICT", message: `"${seg}" is both a field and a group of fields.` });
          }
          decl = { type: "object", required: true, properties: {} };
          target[seg] = decl;
        }
        target = decl.properties as JsonObject;
      }
      target[path[path.length - 1]!] = declaration(def);
    }
    for (const [token, { list, items }] of this.usedLists) {
      if (this.keptLists.has(token)) continue;
      const properties: JsonObject = {};
      for (const [rel, def] of items) properties[rel] = declaration(def);
      const decl: JsonObject = { type: "array", required: true, description: list.label };
      if (list.sample !== undefined) decl.example = list.sample as Json;
      if (list.maxItems !== undefined) decl.maxItems = list.maxItems;
      decl.items = { type: "object", properties };
      out[token] = decl;
    }
    return out;
  }
}

function declaration(def: FieldDef): JsonObject {
  const type = def.type ?? "string";
  const required = def.required ?? true;
  const d: JsonObject = { type, required };
  if (def.label) d.description = def.description ?? def.label;
  if (def.maxLength !== undefined) d.maxLength = def.maxLength;
  if (def.sample !== undefined) d.example = def.sample;
  // An absent optional string renders as empty rather than failing the render.
  if (!required && type === "string") d.default = "";
  return d;
}

/** Compile the source model to a fancy-template envelope, with every problem found. */
export function compile(state: EditorState, ctx: CompileContext = {}): CompileResult {
  const c = new Compiler(state, ctx);
  const blocks: Json[] = [];
  const owners: Array<{ id: string; children?: string[] }> = [];
  for (const node of roots(state.tree)) {
    const out = c.block(node, {});
    const children = node.type === "repeat" ? childrenOf(state.tree, node.id).map((n) => n.id) : undefined;
    for (const b of out) {
      blocks.push(b);
      owners.push(children ? { id: node.id, children } : { id: node.id });
    }
  }
  const page = c.page(state.page);
  const variables = c.variables();

  // Document: keep the imported key order; page and blocks sit where they were.
  const document: JsonObject = {};
  const extra = state.docExtra ?? {};
  let placedPage = false;
  let placedBlocks = false;
  for (const [k, v] of Object.entries(extra)) {
    if (k === "page") {
      if (Object.keys(page).length) document.page = page;
      placedPage = true;
    } else if (k === "blocks") {
      document.blocks = blocks;
      placedBlocks = true;
    } else {
      setOwn(document, k, v);
    }
  }
  if (!placedPage && Object.keys(page).length) document.page = page;
  if (!placedBlocks) {
    if (placedPage) document.blocks = blocks;
    else {
      // Page before blocks when neither was placed by an imported order.
      delete document.blocks;
      document.blocks = blocks;
    }
  }

  // The editor source, with each host block's last good output cached on it.
  const nodes = { ...state.tree.nodes };
  for (const [id, cache] of c.caches) nodes[id] = { ...nodes[id]!, cache };
  const editor: EditorState = { ...state, tree: { nodes } };

  const template: TemplateEnvelope = { fancyTemplate: 1, writer: "fine-print", variables } as TemplateEnvelope;
  if (state.description !== undefined) template.description = state.description;
  template.editor = editor;
  template.document = document;

  // The backstop: everything the builder writes must pass inspect.
  const problems = [...c.problems];
  for (const issue of inspect(template).issues) {
    const m = /^\/document\/blocks\/(\d+)(?:\/\$value\/(\d+))?/.exec(issue.path);
    let node: string | undefined;
    if (m) {
      const owner = owners[Number(m[1])];
      node = owner?.id;
      if (owner?.children && m[2] !== undefined) {
        // $value[0] is the guarded page break when the group has a page each.
        const group = state.tree.nodes[owner.id]!.props as unknown as RepeatProps;
        const idx = Number(m[2]) - (group.pageEach ? 1 : 0);
        node = owner.children[idx] ?? owner.id;
      }
    }
    problems.push({ code: "TEMPLATE", message: `${issue.code} at ${issue.path}`, path: issue.path, ...(node ? { node } : {}) });
  }
  return { template, problems };
}

export type { BlockKind };
