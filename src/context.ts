import { createContext, useContext } from "react";
import type { BlockKind, BuilderOp, EditorState, FieldDef, ListDef, Problem } from "./core/types";

export interface FieldOption {
  token: string;
  label: string;
  /** "Item" fields inside a repeat, else the host's own. */
  group: string;
  type?: FieldDef["type"];
}

export interface BuilderContextValue {
  state: EditorState;
  /** Apply one op. Returns the refusal reason, or null when it applied. */
  dispatch(op: BuilderOp): string | null;
  kinds: readonly BlockKind[];
  fields: readonly FieldDef[];
  lists: readonly ListDef[];
  /** Field options for a block (item fields included inside a repeat). */
  fieldOptions(nodeId: string | null): FieldOption[];
  labelOf(token: string): string;
  problemsFor(nodeId: string): Problem[];
  selected: string | null;
  select(id: string | null): void;
  readOnly: boolean;
  pickImage?: () => Promise<{ dataUrl: string; widthPx?: number; heightPx?: number; name?: string } | null>;
}

export const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("fancy-template-ui parts must be rendered inside <TemplateBuilder> (or a BuilderContext provider).");
  return ctx;
}
