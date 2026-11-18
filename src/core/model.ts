/**
 * Creating and reading the source model: the empty state, node factories,
 * ordered walks, and the host-kind registry helpers.
 */
import { appendOrder, childrenOf, fractionalKey, roots } from "@particle-academy/fancy-doc-commons";
import { validateSchema } from "./schema";
import type { BlockKind, BlockStyle, BuilderNode, EditorState, JsonObject, Page } from "./types";

export const DEFAULT_ACCENT = "#1F4E79";
export const HOST_PREFIX = "host:";
const KIND_NAME = /^[a-z0-9-]+:[a-z0-9-]+$/;

export function defaultPage(): Page {
  return {
    size: "letter",
    orientation: "portrait",
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
    accent: DEFAULT_ACCENT,
  };
}

export function emptyState(): EditorState {
  return { kind: "fancy-template-ui", version: 1, tree: { nodes: {} }, page: defaultPage() };
}

let counter = 0;
/** A fresh node id. Unique within a session; ids only need to be unique per template. */
export function newId(): string {
  counter = (counter + 1) % 1679616;
  return `b_${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}${Math.random().toString(36).slice(2, 6)}`;
}

/** Validate and return a host block kind. Throws on a malformed one: a host bug, caught at startup. */
export function defineKind<P extends JsonObject>(kind: BlockKind<P>): BlockKind<P> {
  if (!KIND_NAME.test(kind.kind)) {
    throw new Error(`Block kind "${kind.kind}" must be namespaced, like "acme:totals" (/^[a-z0-9-]+:[a-z0-9-]+$/).`);
  }
  if (typeof kind.render !== "function") throw new Error(`Block kind "${kind.kind}" has no render function.`);
  const errors = validateSchema(kind.defaults, kind.schema);
  if (errors.length > 0) throw new Error(`Block kind "${kind.kind}": its defaults fail its own schema (${errors[0]}).`);
  return kind;
}

export function hostType(kind: string): string {
  return `${HOST_PREFIX}${kind}`;
}

/** The kind a node belongs to, or undefined for built-ins and unknown kinds. */
export function kindOf(node: BuilderNode, kinds: readonly BlockKind[] | undefined): BlockKind | undefined {
  if (!node.type.startsWith(HOST_PREFIX)) return undefined;
  const name = node.type.slice(HOST_PREFIX.length);
  return kinds?.find((k) => k.kind === name);
}

export function isHost(node: BuilderNode): boolean {
  return node.type.startsWith(HOST_PREFIX);
}

/** Top-level blocks and groups, in order. */
export function orderedBlocks(state: EditorState): BuilderNode[] {
  return roots(state.tree);
}

/** A group's blocks, in order. */
export function groupBlocks(state: EditorState, groupId: string): BuilderNode[] {
  return childrenOf(state.tree, groupId);
}

export interface NewBlock {
  type: string;
  props: Record<string, unknown>;
  style?: BlockStyle;
}

export interface Placement {
  /** A repeat group's id, or null/undefined for the top level. */
  parent?: string | null;
  /** Insert at this index among the parent's children. @default the end */
  index?: number;
}

/** An order key for position `index` among `parent`'s children. */
export function orderAt(state: EditorState, parent: string | null, index: number | undefined, excludeId?: string): string {
  const sibs = childrenOf(state.tree, parent).filter((n) => n.id !== excludeId);
  if (index === undefined || index >= sibs.length) {
    return sibs.length ? fractionalKey(sibs[sibs.length - 1]!.order, null) : appendOrder(state.tree, parent);
  }
  const i = Math.max(0, index);
  const before = i > 0 ? sibs[i - 1]!.order : null;
  return fractionalKey(before, sibs[i]!.order);
}

export function makeNode(state: EditorState, block: NewBlock, at: Placement = {}): BuilderNode {
  const parent = at.parent ?? null;
  const node: BuilderNode = { id: newId(), type: block.type, parent, order: orderAt(state, parent, at.index), props: block.props };
  if (block.style && Object.keys(block.style).length > 0) node.style = block.style;
  return node;
}

/** Insert a block without checks. The UI and the bridge go through `applyOp`, which checks. */
export function addBlock(state: EditorState, block: NewBlock, at: Placement = {}): EditorState {
  const node = makeNode(state, block, at);
  return { ...state, tree: { nodes: { ...state.tree.nodes, [node.id]: node } } };
}

/** A new block of a host kind, with its defaults. */
export function hostBlock(kind: BlockKind): NewBlock {
  return { type: hostType(kind.kind), props: structuredClone(kind.defaults) as Record<string, unknown> };
}

/** Append every `required: "once"` kind the state lacks. Returns the labels added. */
export function ensureRequired(state: EditorState, kinds: readonly BlockKind[] | undefined): { state: EditorState; added: string[] } {
  const added: string[] = [];
  let s = state;
  for (const kind of kinds ?? []) {
    if (kind.required !== "once") continue;
    const present = Object.values(s.tree.nodes).some((n) => n.type === hostType(kind.kind));
    if (!present) {
      s = addBlock(s, hostBlock(kind));
      added.push(kind.label);
    }
  }
  return { state: s, added };
}

/** An empty template holding `blocks`, then every required-once kind. */
export function createState(blocks: NewBlock[] = [], kinds?: readonly BlockKind[]): EditorState {
  let s = emptyState();
  for (const b of blocks) s = addBlock(s, b);
  return ensureRequired(s, kinds).state;
}
