import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Callout, ResizablePanels, Tabs, type PdfPageSource } from "@particle-academy/react-fancy";
import type { Proposal } from "@particle-academy/fancy-doc-commons";
import { BuilderContext, type BuilderContextValue, type FieldOption } from "./context";
import { BlockList } from "./BlockList";
import { BlockSettings } from "./BlockSettings";
import { PageSettings } from "./PageSettings";
import { PendingChanges } from "./PendingChanges";
import { TemplatePreview, type PreviewMode } from "./TemplatePreview";
import { sampleData } from "./samples";
import { ITEM_ALIAS, compile } from "./core/compile";
import { openTemplate } from "./core/open";
import { applyOp, checkOp, invertOp } from "./core/ops";
import type { BlockKind, BuilderOp, EditorState, FieldDef, JsonObject, ListDef, Problem, RepeatProps, TemplateEnvelope } from "./core/types";

/** One builder mutation, for presence, undo and coaching layers. */
export interface TemplateActivity {
  surface: string;
  type: "op" | "accept" | "reject" | "undo" | "redo" | "resolve-drift";
  op?: BuilderOp;
  proposalId?: string;
  actor: { kind: "human" | "agent"; id?: string; name?: string };
  ts: number;
}

export interface TemplateBuilderProps {
  /** The fancy-template envelope. `undefined` starts an empty template. */
  value: TemplateEnvelope | Record<string, unknown> | undefined;
  /** Always the full next envelope, compiled. */
  onChange(template: TemplateEnvelope): void;
  fields?: FieldDef[];
  lists?: ListDef[];
  kinds?: BlockKind[];
  pickImage?: BuilderContextValue["pickImage"];
  renderPreview?: (template: TemplateEnvelope, data: JsonObject) => Promise<PdfPageSource>;
  renderDraft?: (document: JsonObject) => ReactNode;
  /** A real record to preview with; else each field's sample. */
  previewData?: JsonObject;
  previewMode?: PreviewMode;
  onPreviewModeChange?: (mode: PreviewMode) => void;
  /** Staged agent edits (from the `tpl_*` bridge). Only a person accepts them. */
  pending?: readonly Proposal<BuilderOp>[];
  /** Called after the builder applied an accepted proposal and emitted onChange. */
  onAccept?: (proposal: Proposal<BuilderOp>) => void;
  onReject?: (proposal: Proposal<BuilderOp>) => void;
  onActivity?: (activity: TemplateActivity) => void;
  /** Controlled selection (the selected block id). */
  selected?: string | null;
  onSelectedChange?: (id: string | null) => void;
  readOnly?: boolean;
  /** Stable surface id, on the root as `data-ftb-builder` and on every activity. */
  surfaceId?: string;
  className?: string;
}

const EMPTY_TEMPLATE = { fancyTemplate: 1, writer: "fine-print", variables: {}, document: { blocks: [] } };

/**
 * The document builder: block list, settings, preview. Controlled: `value` is
 * one fancy-template envelope and every change emits the next one, compiled.
 */
export function TemplateBuilder({
  value,
  onChange,
  fields = [],
  lists = [],
  kinds = [],
  pickImage,
  renderPreview,
  renderDraft,
  previewData,
  previewMode,
  onPreviewModeChange,
  pending = [],
  onAccept,
  onReject,
  onActivity,
  selected: selectedProp,
  onSelectedChange,
  readOnly = false,
  surfaceId = "template-builder",
  className,
}: TemplateBuilderProps) {
  const ctx = useMemo(() => ({ kinds, fields, lists }), [kinds, fields, lists]);
  const opened = useMemo(() => openTemplate(value ?? EMPTY_TEMPLATE, ctx), [value, ctx]);
  const [driftChoice, setDriftChoice] = useState<null | "builder" | "document">(null);
  const drifting = opened.drift && driftChoice === null;
  const state: EditorState = opened.drift && driftChoice === "document" && opened.fromDocument ? opened.fromDocument : opened.state;
  const compiled = useMemo(() => compile(state, ctx), [state, ctx]);

  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : selectedLocal;
  const select = useCallback(
    (id: string | null) => {
      setSelectedLocal(id);
      onSelectedChange?.(id);
    },
    [onSelectedChange],
  );

  const undo = useRef<BuilderOp[][]>([]);
  const redo = useRef<BuilderOp[][]>([]);
  const [, bump] = useState(0);

  const emit = useCallback(
    (next: EditorState) => onChange(compile(next, ctx).template),
    [onChange, ctx],
  );

  const activity = useCallback(
    (a: Omit<TemplateActivity, "surface" | "ts" | "actor"> & { actor?: TemplateActivity["actor"] }) =>
      onActivity?.({ surface: surfaceId, ts: Date.now(), actor: a.actor ?? { kind: "human" }, ...a }),
    [onActivity, surfaceId],
  );

  const run = useCallback(
    (op: BuilderOp, record = true): string | null => {
      if (readOnly) return "The builder is read-only.";
      if (drifting) return "Choose which version to keep first.";
      const reason = checkOp(state, op, kinds);
      if (reason) return reason;
      const inverse = invertOp(state, op);
      const next = applyOp(state, op, kinds);
      if (record) {
        undo.current.push(inverse);
        redo.current = [];
        bump((n) => n + 1);
      }
      emit(next);
      return null;
    },
    [readOnly, drifting, state, kinds, emit],
  );

  const dispatch = useCallback(
    (op: BuilderOp) => {
      const reason = run(op);
      if (!reason) activity({ type: "op", op });
      return reason;
    },
    [run, activity],
  );

  const replay = (from: typeof undo, to: typeof undo, type: "undo" | "redo") => {
    const ops = from.current.pop();
    if (!ops) return;
    let s = state;
    const back: BuilderOp[] = [];
    for (const op of ops) {
      back.unshift(...invertOp(s, op));
      s = applyOp(s, op, kinds);
    }
    to.current.push(back);
    bump((n) => n + 1);
    emit(s);
    activity({ type });
  };

  const fieldOptions = useCallback(
    (nodeId: string | null): FieldOption[] => {
      const out: FieldOption[] = fields.map((f) => ({ token: f.token, label: f.label, group: "Fields", type: f.type }));
      const node = nodeId ? state.tree.nodes[nodeId] : undefined;
      const group = node?.type === "repeat" ? node : node?.parent ? state.tree.nodes[node.parent] : undefined;
      if (group?.type === "repeat") {
        const list = lists.find((l) => l.token === (group.props as unknown as RepeatProps).list);
        if (list) {
          out.unshift(
            ...list.itemFields.map((f) => ({ token: `${ITEM_ALIAS}.${f.token}`, label: `${list.label}: ${f.label}`, group: "Each item", type: f.type })),
          );
        }
      }
      return out;
    },
    [fields, lists, state],
  );

  const labelOf = useCallback(
    (token: string) => {
      const f = fields.find((x) => x.token === token);
      if (f) return f.label;
      if (token.startsWith(`${ITEM_ALIAS}.`)) {
        const rel = token.slice(ITEM_ALIAS.length + 1);
        for (const l of lists) {
          const it = l.itemFields.find((x) => x.token === rel);
          if (it) return `${l.label}: ${it.label}`;
        }
      }
      return lists.find((l) => l.token === token)?.label ?? token;
    },
    [fields, lists],
  );

  const problemsByNode = useMemo(() => {
    const m = new Map<string, Problem[]>();
    for (const p of compiled.problems) if (p.node) m.set(p.node, [...(m.get(p.node) ?? []), p]);
    return m;
  }, [compiled.problems]);
  const looseProblems = compiled.problems.filter((p) => !p.node);

  const contextValue: BuilderContextValue = {
    state,
    dispatch,
    kinds,
    fields,
    lists,
    fieldOptions,
    labelOf,
    problemsFor: (id) => problemsByNode.get(id) ?? [],
    selected,
    select,
    readOnly: readOnly || drifting,
    pickImage,
  };

  const data = useMemo(() => previewData ?? sampleData(fields, lists), [previewData, fields, lists]);

  return (
    <BuilderContext.Provider value={contextValue}>
      <div className={className} data-ftb-builder={surfaceId} data-read-only={readOnly ? "" : undefined}>
        {drifting && (
          <Callout color="amber" className="mb-3" data-ftb-drift="">
            <div className="flex flex-col gap-2">
              <span>
                This template&apos;s document was changed outside the builder after it was last saved, so the two no longer match. Choose which to keep.
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  data-ftb-drift-keep="document"
                  onClick={() => {
                    setDriftChoice("document");
                    if (opened.fromDocument) emit(opened.fromDocument);
                    activity({ type: "resolve-drift" });
                  }}
                >
                  Keep the document
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-ftb-drift-keep="builder"
                  onClick={() => {
                    setDriftChoice("builder");
                    emit(opened.state);
                    activity({ type: "resolve-drift" });
                  }}
                >
                  Keep the builder&apos;s version
                </Button>
              </div>
            </div>
          </Callout>
        )}
        {opened.notices
          .filter((n) => !n.startsWith("The document was edited"))
          .map((n) => (
            <Callout key={n} color="blue" className="mb-3" data-ftb-notice="">
              {n}
            </Callout>
          ))}
        {looseProblems.length > 0 && (
          <Callout color="red" className="mb-3" data-ftb-problems="">
            {looseProblems.map((p) => p.message).join(" ")}
          </Callout>
        )}
        <div className="mb-2 flex gap-2">
          <Button type="button" size="xs" variant="ghost" icon="undo-2" disabled={readOnly || undo.current.length === 0} data-ftb-undo="" onClick={() => replay(undo, redo, "undo")}>
            Undo
          </Button>
          <Button type="button" size="xs" variant="ghost" icon="redo-2" disabled={readOnly || redo.current.length === 0} data-ftb-redo="" onClick={() => replay(redo, undo, "redo")}>
            Redo
          </Button>
        </div>
        <PendingChanges
          className="mb-3"
          pending={pending}
          onAccept={(p) => {
            const reason = run(p.op);
            if (reason) return;
            activity({ type: "accept", op: p.op, proposalId: p.id, actor: p.actor ?? { kind: "agent" } });
            onAccept?.(p);
          }}
          onReject={(p) => {
            activity({ type: "reject", op: p.op, proposalId: p.id });
            onReject?.(p);
          }}
        />
        <ResizablePanels defaultValue={30} min={20} max={50} label="Resize the block list">
          <BlockList className="p-1" />
          <ResizablePanels defaultValue={50} min={25} max={75} label="Resize the settings">
            <div className="p-1">
              <Tabs defaultTab="block">
                <Tabs.List>
                  <Tabs.Tab value="block">Block</Tabs.Tab>
                  <Tabs.Tab value="page">Page</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panels>
                  <Tabs.Panel value="block">
                    <BlockSettings />
                  </Tabs.Panel>
                  <Tabs.Panel value="page">
                    <PageSettings />
                  </Tabs.Panel>
                </Tabs.Panels>
              </Tabs>
            </div>
            <TemplatePreview
              className="m-1"
              template={compiled.template}
              data={data}
              renderPreview={renderPreview}
              renderDraft={renderDraft}
              mode={previewMode}
              onModeChange={onPreviewModeChange}
            />
          </ResizablePanels>
        </ResizablePanels>
      </div>
    </BuilderContext.Provider>
  );
}
