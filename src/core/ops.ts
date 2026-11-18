/**
 * Every mutation is one op (plan section 10, phase 1): the doc-commons tree ops
 * plus `set_style` and `set_page`. `checkOp` names why an op is refused;
 * `applyOp` refuses (returns the SAME state) whatever `checkOp` refuses, so the
 * UI, the bridge and a server all enforce one rule set.
 */
import { treeReducer } from "@particle-academy/fancy-doc-commons";
import { BUILTIN_TYPES, type BlockKind, type BlockStyle, type BuilderNode, type BuilderOp, type EditorState, type Page } from "./types";
import { HOST_PREFIX, hostType, isHost, kindOf } from "./model";
import { isForbiddenKey } from "./safe";

/** The only keys a style patch may set (an agent's JSON reaches here through the bridge). */
const STYLE_KEYS = new Set(["align", "size", "color", "spaceBefore", "spaceAfter"]);
/** The only keys a page patch may set. */
const PAGE_KEYS = new Set(["size", "orientation", "margins", "accent", "header", "footer", "firstHeader", "firstFooter"]);

const tree = treeReducer<BuilderNode>();
const KNOWN = new Set<string>([...BUILTIN_TYPES, "repeat"]);

function label(node: BuilderNode, kinds: readonly BlockKind[] | undefined): string {
  return kindOf(node, kinds)?.label ?? node.type;
}

function placementProblem(state: EditorState, node: BuilderNode, parent: string | null, kinds: readonly BlockKind[] | undefined): string | null {
  if (parent === null) return null;
  const group = state.tree.nodes[parent];
  if (!group) return `No block ${parent}.`;
  if (group.type !== "repeat") return "Blocks can only be placed at the top level or inside a repeat.";
  if (node.type === "repeat") return "A repeat cannot hold a repeat.";
  const kind = kindOf(node, kinds);
  if (kind && kind.allowInRepeat === false) return `${kind.label} is not allowed in a repeat: its output must appear exactly once.`;
  return null;
}

/** Why `op` cannot apply, or null when it can. */
export function checkOp(state: EditorState, op: BuilderOp, kinds?: readonly BlockKind[]): string | null {
  switch (op.t) {
    case "insert": {
      const n = op.node;
      if (state.tree.nodes[n.id]) return `A block with id ${n.id} already exists.`;
      if (n.type === "raw") return "Raw blocks come only from opening a template; they cannot be added.";
      if (!KNOWN.has(n.type) && !n.type.startsWith(HOST_PREFIX)) return `Unknown block type "${n.type}".`;
      if (isHost(n)) {
        const kind = kindOf(n, kinds);
        if (!kind) return `Unknown block kind "${n.type.slice(HOST_PREFIX.length)}".`;
        if (kind.required === "once" && Object.values(state.tree.nodes).some((x) => x.type === hostType(kind.kind))) {
          return `${kind.label} is required exactly once and is already in the template.`;
        }
      }
      return placementProblem(state, n, n.parent, kinds);
    }
    case "remove": {
      const n = state.tree.nodes[op.id];
      if (!n) return `No block ${op.id}.`;
      if (kindOf(n, kinds)?.required === "once") return `${label(n, kinds)} is required: it can be moved and styled, never removed.`;
      if (n.type === "repeat") {
        for (const child of Object.values(state.tree.nodes)) {
          if (child.parent === n.id && kindOf(child, kinds)?.required === "once") {
            return `This repeat holds ${label(child, kinds)}, which is required. Move it out first.`;
          }
        }
      }
      return null;
    }
    case "move": {
      const n = state.tree.nodes[op.id];
      if (!n) return `No block ${op.id}.`;
      return placementProblem(state, n, op.parent, kinds);
    }
    case "set_props": {
      const n = state.tree.nodes[op.id];
      if (!n) return `No block ${op.id}.`;
      if (n.type === "raw") return "This block was kept exactly as imported and is read-only.";
      return null;
    }
    case "set_style": {
      const n = state.tree.nodes[op.id];
      if (!n) return `No block ${op.id}.`;
      if (n.type === "raw") return "This block was kept exactly as imported and is read-only.";
      return null;
    }
    case "set_page":
      return null;
  }
}

function mergeStyle(prev: BlockStyle | undefined, patch: BlockStyle): BlockStyle | undefined {
  const next: Record<string, unknown> = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (!STYLE_KEYS.has(k)) continue;
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return Object.keys(next).length ? (next as BlockStyle) : undefined;
}

function mergePage(prev: Page, patch: Partial<Page>): Page {
  const next = { ...prev } as Page & Record<string, unknown>;
  let extra = prev.extra ? { ...prev.extra } : undefined;
  let implicit = prev.implicit ? [...prev.implicit] : undefined;
  for (const [k, v] of Object.entries(patch)) {
    if (k === "extra" || k === "implicit") continue;
    if (!PAGE_KEYS.has(k) || isForbiddenKey(k)) continue;
    if (v === undefined) delete next[k];
    else next[k] = v;
    // Editing a key the builder imported but did not own hands it to the builder.
    if (extra && Object.hasOwn(extra, k)) delete extra[k];
    if (implicit) implicit = implicit.filter((x) => x !== k);
  }
  if (Object.hasOwn(patch, "extra")) extra = patch.extra;
  if (Object.hasOwn(patch, "implicit")) implicit = patch.implicit;
  if (extra && Object.keys(extra).length) next.extra = extra;
  else delete next.extra;
  if (implicit && implicit.length) next.implicit = implicit;
  else delete next.implicit;
  return next;
}

/** Apply one op. A refused op returns the same state object. */
export function applyOp(state: EditorState, op: BuilderOp, kinds?: readonly BlockKind[]): EditorState {
  if (checkOp(state, op, kinds) !== null) return state;
  switch (op.t) {
    case "set_style": {
      const n = state.tree.nodes[op.id]!;
      const style = mergeStyle(n.style, op.patch);
      const next: BuilderNode = { ...n };
      if (style) next.style = style;
      else delete next.style;
      return { ...state, tree: { nodes: { ...state.tree.nodes, [op.id]: next } } };
    }
    case "set_page":
      return { ...state, page: mergePage(state.page, op.patch) };
    default:
      return { ...state, tree: tree.reduce(state.tree, op) };
  }
}

/** The ops that undo `op`, computed against the state BEFORE it applies. */
export function invertOp(state: EditorState, op: BuilderOp): BuilderOp[] {
  switch (op.t) {
    case "set_style": {
      const n = state.tree.nodes[op.id];
      if (!n) return [];
      const prev: BlockStyle = {};
      for (const k of Object.keys(op.patch) as Array<keyof BlockStyle>) {
        (prev as Record<string, unknown>)[k] = n.style?.[k];
      }
      return [{ t: "set_style", id: op.id, patch: prev }];
    }
    case "set_page": {
      const prev: Partial<Page> = {};
      for (const k of Object.keys(op.patch) as Array<keyof Page>) {
        (prev as Record<string, unknown>)[k] = state.page[k];
      }
      prev.extra = state.page.extra;
      prev.implicit = state.page.implicit;
      return [{ t: "set_page", patch: prev }];
    }
    default:
      return tree.invert(state.tree, op) as BuilderOp[];
  }
}
