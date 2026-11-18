/**
 * `@particle-academy/fancy-template-ui/core`: the React-free half. The source
 * model, the compiler to a fancy-template envelope, the importer, the op
 * reducer with its rules, and the host block-kind contract. Usable by a bridge
 * and on a server.
 */
export * from "./types";
export {
  DEFAULT_ACCENT,
  addBlock,
  createState,
  defaultPage,
  defineKind,
  emptyState,
  ensureRequired,
  groupBlocks,
  hostBlock,
  hostType,
  isHost,
  kindOf,
  makeNode,
  newId,
  orderAt,
  orderedBlocks,
  type NewBlock,
  type Placement,
} from "./model";
export { applyOp, checkOp, invertOp } from "./ops";
export { compile, escapeText, fieldToken, ITEM_ALIAS, type CompileResult } from "./compile";
export { importDocument, openTemplate, type OpenResult } from "./open";
export { validateSchema } from "./schema";
