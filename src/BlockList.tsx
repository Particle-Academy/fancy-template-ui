import { useState } from "react";
import { Badge, Button, Callout, Card, Dropdown, ReorderableGrid, Text } from "@particle-academy/react-fancy";
import { childrenOf } from "@particle-academy/fancy-doc-commons";
import { useBuilder } from "./context";
import { hostBlock, hostType, kindOf, makeNode, orderAt } from "./core/model";
import { checkOp } from "./core/ops";
import type { BuilderNode, HeadingProps, RepeatProps, TextProps } from "./core/types";

export const BUILTIN_LABELS: Record<string, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  table: "Table",
  divider: "Divider",
  spacer: "Spacer",
  pageBreak: "Page break",
  repeat: "Repeating section",
  raw: "Kept as written",
};

/** Default props for a new built-in block. */
export function defaultsFor(type: string): Record<string, unknown> {
  switch (type) {
    case "heading":
      return { level: 2, runs: [{ text: "Heading" }] };
    case "text":
      return { paras: [{ type: "paragraph", runs: [{ text: "" }] }] };
    case "image":
      return { widthPx: 160 };
    case "table":
      return { header: true, rows: [[[{ text: "Item" }], [{ text: "Amount" }]], [[{ text: "" }], [{ text: "" }]]] };
    case "divider":
      return {};
    case "spacer":
      return { height: 18 };
    case "repeat":
      return { list: "", pageEach: false };
    default:
      return {};
  }
}

function summary(node: BuilderNode, labelOf: (t: string) => string): string {
  const runsText = (runs: Array<{ text?: string; field?: string }>) =>
    runs.map((r) => (r.field !== undefined ? `[${labelOf(r.field)}]` : r.text ?? "")).join("").slice(0, 60);
  switch (node.type) {
    case "heading":
      return runsText((node.props as unknown as HeadingProps).runs ?? []);
    case "text": {
      const first = (node.props as unknown as TextProps).paras?.[0];
      if (!first) return "";
      return runsText(first.type === "list" ? first.items[0] ?? [] : first.runs);
    }
    case "repeat": {
      const p = node.props as unknown as RepeatProps;
      return p.list ? `per ${labelOf(p.list)}${p.pageEach ? ", a page each" : ""}` : "no list chosen";
    }
    default:
      return "";
  }
}

interface AddMenuProps {
  parent: string | null;
}

function AddMenu({ parent }: AddMenuProps) {
  const { state, dispatch, kinds, readOnly, select } = useBuilder();
  const [refusal, setRefusal] = useState<string | null>(null);
  const builtins = ["heading", "text", "image", "table", "divider", "spacer", "pageBreak", ...(parent === null ? ["repeat"] : [])];
  const add = (type: string) => {
    const kind = type.startsWith("host:") ? kinds.find((k) => hostType(k.kind) === type) : undefined;
    const block = kind ? hostBlock(kind) : { type, props: defaultsFor(type) };
    const node = makeNode(state, block, { parent });
    const reason = dispatch({ t: "insert", node });
    setRefusal(reason);
    if (!reason) select(node.id);
  };
  const isAvailable = (type: string) => {
    const probe = makeNode(state, { type, props: {} }, { parent });
    return checkOp(state, { t: "insert", node: probe }, kinds) === null;
  };
  return (
    <div data-ftb-add-menu={parent ?? "root"}>
      <Dropdown>
        <Dropdown.Trigger>
          <Button type="button" size="sm" icon="plus" disabled={readOnly} data-ftb-add-trigger={parent ?? "root"}>
            {parent ? "Add to section" : "Add block"}
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Items>
          {builtins.map((t) => (
            <Dropdown.Item key={t} onClick={() => add(t)}>
              <span data-ftb-add={t}>{BUILTIN_LABELS[t]}</span>
            </Dropdown.Item>
          ))}
          {kinds
            .filter((k) => isAvailable(hostType(k.kind)))
            .map((k) => (
              <Dropdown.Item key={k.kind} onClick={() => add(hostType(k.kind))}>
                <span data-ftb-add={hostType(k.kind)}>{k.label}</span>
              </Dropdown.Item>
            ))}
        </Dropdown.Items>
      </Dropdown>
      {refusal && (
        <Callout color="amber" className="mt-2" data-ftb-refusal="">
          {refusal}
        </Callout>
      )}
    </div>
  );
}

function BlockRow({ node, handleProps }: { node: BuilderNode; handleProps?: Record<string, string> }) {
  const builder = useBuilder();
  const { state, dispatch, kinds, selected, select, labelOf, problemsFor, readOnly } = builder;
  const kind = kindOf(node, kinds);
  const label = kind?.label ?? (node.type.startsWith("host:") ? `${node.type.slice(5)} (not registered)` : BUILTIN_LABELS[node.type] ?? node.type);
  const removal = checkOp(state, { t: "remove", id: node.id }, kinds);
  const problems = problemsFor(node.id);
  const isSelected = selected === node.id;
  const [refusal, setRefusal] = useState<string | null>(null);
  return (
    <Card
      variant={isSelected ? "elevated" : "outlined"}
      padding="sm"
      highlight={isSelected}
      data-ftb-block={node.id}
      data-ftb-type={node.type}
      data-selected={isSelected ? "" : undefined}
    >
      <div className="flex items-center gap-2">
        <span {...handleProps} className="cursor-grab select-none px-1 text-[color:var(--fancy-text-muted,var(--color-zinc-500))]" aria-hidden="true">
          ⋮⋮
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-w-0 flex-1 justify-start text-left"
          data-ftb-select={node.id}
          onClick={() => select(node.id)}
        >
          <span className="font-medium">{label}</span>
          <Text as="span" size="xs" color="muted" className="ml-2 truncate">
            {summary(node, labelOf)}
          </Text>
        </Button>
        {kind?.required === "once" && <Badge size="sm" color="blue">Required</Badge>}
        {node.type === "raw" && <Badge size="sm" color="zinc">Read-only</Badge>}
        {problems.length > 0 && (
          <Badge size="sm" color="red" data-ftb-problem={node.id} title={problems.map((p) => p.message).join("\n")}>
            {problems.length} problem{problems.length > 1 ? "s" : ""}
          </Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon="trash-2"
          aria-label={`Remove ${label}`}
          title={removal ?? `Remove ${label}`}
          disabled={readOnly || removal !== null}
          data-ftb-remove={node.id}
          onClick={() => {
            const reason = dispatch({ t: "remove", id: node.id });
            setRefusal(reason);
            if (!reason && isSelected) select(null);
          }}
        />
      </div>
      {refusal && <Callout color="amber" className="mt-2">{refusal}</Callout>}
      {node.type === "repeat" && (
        <div className="mt-2 border-l-2 border-[color:var(--fancy-border,var(--color-zinc-200))] pl-3 dark:border-[color:var(--fancy-border-dark,var(--color-zinc-700))]">
          <BlockGrid parent={node.id} />
          <div className="mt-2">
            <AddMenu parent={node.id} />
          </div>
        </div>
      )}
    </Card>
  );
}

/** The single id whose removal makes the two orders equal: the block that moved. */
export function movedId(before: string[], after: string[]): string | null {
  if (before.length !== after.length || before.join("\u0000") === after.join("\u0000")) return null;
  for (const id of before) {
    const a = before.filter((x) => x !== id).join("\u0000");
    const b = after.filter((x) => x !== id).join("\u0000");
    if (a === b) return id;
  }
  return null;
}

function BlockGrid({ parent }: { parent: string | null }) {
  const { state, dispatch, readOnly, labelOf } = useBuilder();
  const nodes = childrenOf(state.tree, parent);
  if (nodes.length === 0) {
    return (
      <Text size="sm" color="muted" data-ftb-empty={parent ?? "root"}>
        {parent ? "Nothing repeats yet. Add the blocks each item gets." : "No blocks yet."}
      </Text>
    );
  }
  return (
    <ReorderableGrid
      columns={1}
      gap="sm"
      items={nodes}
      value={nodes.map((n) => n.id)}
      disabled={readOnly}
      label={parent ? "Blocks in this section" : "Blocks"}
      getItemLabel={(n) => `${BUILTIN_LABELS[n.type] ?? n.type} ${summary(n, labelOf)}`.trim()}
      data-ftb-list={parent ?? "root"}
      onReorder={(ids) => {
        // One move op for the block whose position changed.
        const moved = movedId(nodes.map((n) => n.id), ids);
        if (!moved) return;
        const target = ids.indexOf(moved);
        dispatch({ t: "move", id: moved, parent, order: orderAt(state, parent, target, moved) });
      }}
      renderItem={(n, s) => <BlockRow node={n} handleProps={s.handleProps as Record<string, string> | undefined} />}
    />
  );
}

export interface BlockListProps {
  className?: string;
}

/** The block list: add, drag (pointer or keyboard) to reorder, remove. */
export function BlockList({ className }: BlockListProps) {
  return (
    <div className={className} data-ftb-block-list="">
      <BlockGrid parent={null} />
      <div className="mt-3">
        <AddMenu parent={null} />
      </div>
    </div>
  );
}
