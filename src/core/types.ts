/**
 * The builder's source model (plan section 5.1). React-free and JSON all the way
 * down, so a server, a bridge and the UI share one shape.
 */
import type { DocNode, DocTree } from "@particle-academy/fancy-doc-commons";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

/** A field the host offers. `token` is a dotted path (`customer.name`). */
export interface FieldDef {
  label: string;
  token: string;
  /** Shown in the draft preview and declared as the variable's `example`. */
  sample?: Json;
  /** fancy-template variable type. @default "string" */
  type?: "string" | "number" | "integer" | "boolean" | "date" | "image";
  /** @default true */
  required?: boolean;
  maxLength?: number;
  description?: string;
}

/** A list the host offers for a repeating section. Item field tokens are relative (`title`). */
export interface ListDef {
  label: string;
  token: string;
  itemFields: FieldDef[];
  sample?: JsonObject[];
  maxItems?: number;
}

export type Align = "left" | "center" | "right" | "justify";

/** Per-block style (plan section 5.1). `color` may be `"accent"`: the page accent. */
export interface BlockStyle {
  align?: Align;
  size?: number;
  color?: string;
  spaceBefore?: number;
  spaceAfter?: number;
}

/** A run of rich text: literal text, or a field chip. Never both. */
export interface RichRun {
  text?: string;
  field?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type TextPara =
  | { type: "paragraph"; runs: RichRun[] }
  | { type: "list"; ordered?: boolean; items: RichRun[][] };

export interface HeadingProps { level: number; runs: RichRun[] }
export interface TextProps { paras: TextPara[] }
export interface ImageProps { src?: string; field?: string; widthPx?: number; heightPx?: number; alt?: string; name?: string }
/** `rows[r][c]` is one cell's runs. v1 cells hold one paragraph (plan section 13 fallback). */
export interface TableProps { header?: boolean; widths?: number[]; rows: RichRun[][][] }
export interface DividerProps { color?: string; weight?: number }
export interface SpacerProps { height: number }
export interface RepeatProps { list: string; pageEach: boolean }
/** A block the importer could not map, kept byte-for-byte. Read-only in the UI. */
export interface RawProps { block: Json }

export const BUILTIN_TYPES = ["heading", "text", "image", "table", "divider", "spacer", "pageBreak"] as const;
export type BuiltinType = (typeof BUILTIN_TYPES)[number];

export interface BuilderNode extends DocNode<Record<string, unknown>> {
  style?: BlockStyle;
  /**
   * A host block's last good compiled output. Written by `compile`, so a template
   * reopened without the kind registered still renders exactly as it did.
   */
  cache?: Json[];
}

export type BuilderTree = DocTree<BuilderNode>;

/** One part of a band slot: text, a field chip, or a page-number chip. */
export type BandPart = { text: string } | { field: string } | { page: "page" | "pages" };

export interface Band {
  left?: BandPart[];
  center?: BandPart[];
  right?: BandPart[];
}

export interface Page {
  size: "letter" | "a4" | "legal";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  /** `#RRGGBB`. The model has no document accent, so it compiles into run colours. */
  accent: string;
  header?: Band;
  footer?: Band;
  firstHeader?: Band;
  firstFooter?: Band;
  /** Page keys the builder does not edit (background, border), kept as written. */
  extra?: JsonObject;
  /**
   * Keys an imported page did not write, so compile leaves them out and the
   * document stays byte-identical. Editing a key takes it off this list.
   */
  implicit?: Array<"size" | "orientation" | "margins">;
}

/** What the builder stores under the envelope's `editor` key. */
export interface EditorState {
  kind: "fancy-template-ui";
  version: 1;
  tree: BuilderTree;
  page: Page;
  /** Document keys the builder does not edit (title, defaultFont, meta), kept as written. */
  docExtra?: JsonObject;
  /** Declarations kept from an imported template (what its raw blocks read). */
  variables?: JsonObject;
  /** The envelope's `description`, kept as written. */
  description?: string;
}

export interface KindRenderContext {
  page: Page;
  accent: string;
  fieldToken(token: string): string;
}

/** A JSON Schema subset: type, properties, required, items, enum, bounds, pattern. */
export type JsonSchema = { [key: string]: Json };

/** A host block kind (plan section 6). */
export interface BlockKind<P extends JsonObject = JsonObject> {
  /** Namespaced: `/^[a-z0-9-]+:[a-z0-9-]+$/`, e.g. `fancy-sign:signature`. */
  kind: string;
  label: string;
  /** A react-fancy Icon name. */
  icon?: string;
  schema: JsonSchema;
  defaults: P;
  /** `"once"`: exactly once. Never removable, never added twice; movable and styleable. */
  required?: "once";
  /** @default true. `false` for anything whose output must be unique, like signing fields. */
  allowInRepeat?: boolean;
  /** Which style controls the settings panel offers. @default none */
  styleable?: Array<keyof BlockStyle>;
  /** Pure and synchronous. Returns last-word / fine-print blocks. */
  render(props: P, ctx: KindRenderContext): Json[];
  /** The settings panel. Typed loosely here so `./core` stays React-free. */
  Settings?: unknown;
}

export interface Problem {
  code: "FIELD_UNKNOWN" | "KIND_UNKNOWN" | "KIND_PROPS" | "KIND_RENDER" | "IMAGE_EMPTY" | "VARIABLE_CONFLICT" | "LIST_UNKNOWN" | "TEMPLATE";
  message: string;
  /** The node the problem belongs to, when there is one. */
  node?: string;
  /** A JSON Pointer into the template, for `TEMPLATE` problems from `inspect`. */
  path?: string;
}

export interface CompileContext {
  kinds?: BlockKind[];
  fields?: FieldDef[];
  lists?: ListDef[];
}

export type BuilderOp =
  | { t: "insert"; node: BuilderNode }
  | { t: "remove"; id: string }
  | { t: "move"; id: string; parent: string | null; order: string }
  | { t: "set_props"; id: string; patch: Record<string, unknown> }
  | { t: "set_style"; id: string; patch: BlockStyle }
  | { t: "set_page"; patch: Partial<Page> };

/** A compiled envelope. Typed loosely on purpose: it is plain JSON for a writer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateEnvelope = { fancyTemplate: 1; writer: "fine-print"; variables: Record<string, any>; editor: EditorState; document: Record<string, any> } & Record<string, any>;
