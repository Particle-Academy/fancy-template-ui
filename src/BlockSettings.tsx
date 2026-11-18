import { useCallback, type ComponentType, type ReactNode } from "react";
import { Button, Callout, Card, ColorPicker, Input, NumberField, Select, Switch, Text } from "@particle-academy/react-fancy";
import { useBuilder, type FieldOption } from "./context";
import { RichTextField } from "./RichTextField";
import { htmlToParas, htmlToRuns, parasToHtml, runsToHtml } from "./runs-html";
import { BUILTIN_LABELS } from "./BlockList";
import { kindOf } from "./core/model";
import type { BlockStyle, BuilderNode, DividerProps, FieldDef, HeadingProps, ImageProps, JsonObject, RepeatProps, RichRun, SpacerProps, TableProps, TextProps } from "./core/types";

const ALIGN_OPTIONS = [
  { value: "", label: "Default" },
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
];

function num(v: number | null): number | undefined {
  return v === null || Number.isNaN(v) ? undefined : v;
}

function StyleControls({ node, allowed }: { node: BuilderNode; allowed: Array<keyof BlockStyle> }) {
  const { dispatch, readOnly } = useBuilder();
  const s = node.style ?? {};
  const set = (patch: BlockStyle) => dispatch({ t: "set_style", id: node.id, patch });
  if (allowed.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3" data-ftb-style={node.id}>
      {allowed.includes("align") && (
        <Select
          label="Alignment"
          list={ALIGN_OPTIONS}
          value={s.align ?? ""}
          disabled={readOnly}
          data-ftb-style-align=""
          onValueChange={(v) => set({ align: (v || undefined) as BlockStyle["align"] })}
        />
      )}
      {allowed.includes("size") && (
        <NumberField label="Size (pt)" min={4} max={96} step={0.5} value={s.size ?? null} disabled={readOnly} onValueChange={(v) => set({ size: num(v) })} />
      )}
      {allowed.includes("color") && (
        <div className="flex items-end gap-2">
          <ColorPicker
            label="Colour"
            value={s.color && s.color !== "accent" ? s.color : ""}
            disabled={readOnly}
            onChange={(c) => set({ color: c || undefined })}
          />
          <Button type="button" size="xs" variant="ghost" disabled={readOnly} onClick={() => set({ color: "accent" })}>
            Use accent
          </Button>
        </div>
      )}
      {allowed.includes("spaceBefore") && (
        <NumberField label="Space before (pt)" min={0} max={200} value={s.spaceBefore ?? null} disabled={readOnly} onValueChange={(v) => set({ spaceBefore: num(v) })} />
      )}
      {allowed.includes("spaceAfter") && (
        <NumberField label="Space after (pt)" min={0} max={200} value={s.spaceAfter ?? null} disabled={readOnly} onValueChange={(v) => set({ spaceAfter: num(v) })} />
      )}
    </div>
  );
}

const ALL_STYLE: Array<keyof BlockStyle> = ["align", "size", "color", "spaceBefore", "spaceAfter"];

function useRunsCanon() {
  const { labelOf } = useBuilder();
  const paraCanon = useCallback((html: string) => parasToHtml(htmlToParas(html), labelOf), [labelOf]);
  const runCanon = useCallback((html: string) => runsToHtml(htmlToRuns(html), labelOf), [labelOf]);
  return { paraCanon, runCanon };
}

function textFields(options: FieldOption[]): FieldOption[] {
  return options.filter((o) => o.type !== "image");
}

function HeadingSettings({ node }: { node: BuilderNode }) {
  const { dispatch, fieldOptions, labelOf, readOnly } = useBuilder();
  const { runCanon } = useRunsCanon();
  const p = node.props as unknown as HeadingProps;
  return (
    <>
      <Select
        label="Level"
        list={[1, 2, 3, 4, 5, 6].map((l) => ({ value: String(l), label: `Heading ${l}` }))}
        value={String(p.level)}
        disabled={readOnly}
        onValueChange={(v) => dispatch({ t: "set_props", id: node.id, patch: { level: Number(v) } })}
      />
      <RichTextField
        handle={`${node.id}:runs`}
        html={runsToHtml(p.runs ?? [], labelOf)}
        canonical={runCanon}
        options={textFields(fieldOptions(node.id))}
        disabled={readOnly}
        maxHeight={90}
        onHtmlChange={(html) => dispatch({ t: "set_props", id: node.id, patch: { runs: htmlToRuns(html) } })}
      />
    </>
  );
}

function TextSettings({ node }: { node: BuilderNode }) {
  const { dispatch, fieldOptions, labelOf, readOnly } = useBuilder();
  const { paraCanon } = useRunsCanon();
  const p = node.props as unknown as TextProps;
  return (
    <RichTextField
      handle={`${node.id}:paras`}
      html={parasToHtml(p.paras ?? [], labelOf)}
      canonical={paraCanon}
      options={textFields(fieldOptions(node.id))}
      lists
      disabled={readOnly}
      placeholder="Write here. Use Insert field for data."
      onHtmlChange={(html) => dispatch({ t: "set_props", id: node.id, patch: { paras: htmlToParas(html) } })}
    />
  );
}

function ImageSettings({ node }: { node: BuilderNode }) {
  const { dispatch, fieldOptions, readOnly, pickImage } = useBuilder();
  const p = node.props as unknown as ImageProps;
  const images = fieldOptions(node.id).filter((o) => o.type === "image");
  const set = (patch: Partial<ImageProps>) => dispatch({ t: "set_props", id: node.id, patch: patch as Record<string, unknown> });
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        {pickImage && (
          <Button
            type="button"
            size="sm"
            icon="image"
            disabled={readOnly}
            data-ftb-pick-image={node.id}
            onClick={async () => {
              const picked = await pickImage();
              if (!picked) return;
              if (!/^data:image\/(png|jpe?g);base64,/.test(picked.dataUrl)) return;
              set({ src: picked.dataUrl, field: undefined, widthPx: picked.widthPx ?? p.widthPx, heightPx: picked.heightPx, name: picked.name });
            }}
          >
            {p.src ? "Replace picture" : "Choose picture"}
          </Button>
        )}
        {images.length > 0 && (
          <Select
            label="Or from data"
            placeholder="A fixed picture"
            list={[{ value: "", label: "A fixed picture" }, ...images.map((o) => ({ value: o.token, label: o.label }))]}
            value={p.field ?? ""}
            disabled={readOnly}
            onValueChange={(v) => set(v ? { field: v, src: undefined } : { field: undefined })}
          />
        )}
      </div>
      {p.name && !p.field && <Text size="xs" color="muted">{p.name}</Text>}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Width (px)" min={1} max={2000} value={p.widthPx ?? null} disabled={readOnly} onValueChange={(v) => set({ widthPx: num(v) })} />
        <NumberField label="Height (px)" min={1} max={2000} value={p.heightPx ?? null} disabled={readOnly} onValueChange={(v) => set({ heightPx: num(v) })} />
      </div>
      <Input label="Alt text" value={p.alt ?? ""} disabled={readOnly} onValueChange={(v) => set({ alt: v || undefined })} />
      <Text size="xs" color="muted">PNG or JPEG. Images are placed at the left; the writer has no image alignment.</Text>
    </>
  );
}

function TableSettings({ node }: { node: BuilderNode }) {
  const { dispatch, fieldOptions, labelOf, readOnly } = useBuilder();
  const { runCanon } = useRunsCanon();
  const p = node.props as unknown as TableProps;
  const rows = p.rows ?? [];
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const set = (patch: Partial<TableProps>) => dispatch({ t: "set_props", id: node.id, patch: patch as Record<string, unknown> });
  const setCell = (r: number, c: number, runs: RichRun[]) => set({ rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? runs : cell)) : row)) });
  const options = textFields(fieldOptions(node.id));
  return (
    <>
      <Switch label="First row is a header" checked={!!p.header} disabled={readOnly} onCheckedChange={(v) => set({ header: v })} />
      <div className="flex flex-col gap-2" data-ftb-table={node.id}>
        {rows.map((row, r) => (
          <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {row.map((cell, c) => (
              <RichTextField
                key={c}
                handle={`${node.id}:cell:${r}:${c}`}
                html={runsToHtml(cell, labelOf)}
                canonical={runCanon}
                options={options}
                disabled={readOnly}
                maxHeight={80}
                onHtmlChange={(html) => setCell(r, c, htmlToRuns(html))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="xs" disabled={readOnly} data-ftb-table-add-row={node.id} onClick={() => set({ rows: [...rows, Array.from({ length: cols }, () => [])] })}>Add row</Button>
        <Button type="button" size="xs" disabled={readOnly || rows.length <= 1} onClick={() => set({ rows: rows.slice(0, -1) })}>Remove last row</Button>
        <Button type="button" size="xs" disabled={readOnly} data-ftb-table-add-col={node.id} onClick={() => set({ rows: rows.map((row) => [...row, []]), widths: undefined })}>Add column</Button>
        <Button type="button" size="xs" disabled={readOnly || cols <= 1} onClick={() => set({ rows: rows.map((row) => row.slice(0, -1)), widths: undefined })}>Remove last column</Button>
      </div>
    </>
  );
}

function DividerSettings({ node }: { node: BuilderNode }) {
  const { dispatch, readOnly } = useBuilder();
  const p = node.props as unknown as DividerProps;
  const set = (patch: Partial<DividerProps>) => dispatch({ t: "set_props", id: node.id, patch: patch as Record<string, unknown> });
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Weight (pt)" min={0.25} max={12} step={0.25} value={p.weight ?? 0.75} disabled={readOnly} onValueChange={(v) => set({ weight: num(v) })} />
      <ColorPicker label="Colour (default: accent)" value={p.color ?? ""} disabled={readOnly} onChange={(c) => set({ color: c || undefined })} />
    </div>
  );
}

function SpacerSettings({ node }: { node: BuilderNode }) {
  const { dispatch, readOnly } = useBuilder();
  const p = node.props as unknown as SpacerProps;
  return (
    <NumberField label="Height (pt)" min={0} max={400} value={p.height} disabled={readOnly} onValueChange={(v) => dispatch({ t: "set_props", id: node.id, patch: { height: num(v) ?? 0 } })} />
  );
}

function RepeatSettings({ node }: { node: BuilderNode }) {
  const { dispatch, lists, readOnly } = useBuilder();
  const p = node.props as unknown as RepeatProps;
  return (
    <>
      <Select
        label="Repeat for each"
        placeholder="Choose a list"
        list={lists.map((l) => ({ value: l.token, label: l.label }))}
        value={p.list}
        disabled={readOnly}
        data-ftb-repeat-list={node.id}
        onValueChange={(v) => dispatch({ t: "set_props", id: node.id, patch: { list: v } })}
      />
      <Switch
        label="Start each item on a new page"
        checked={p.pageEach}
        disabled={readOnly}
        data-ftb-repeat-page-each={node.id}
        onCheckedChange={(v) => dispatch({ t: "set_props", id: node.id, patch: { pageEach: v } })}
      />
      <Text size="xs" color="muted">Inside this section, Insert field also offers each item&apos;s fields.</Text>
    </>
  );
}

/** Props a host kind's Settings component receives. */
export interface KindSettingsProps<P extends JsonObject = JsonObject> {
  value: P;
  onChange(props: P): void;
  fields: FieldDef[];
  disabled?: boolean;
}

function HostSettings({ node }: { node: BuilderNode }) {
  const { dispatch, kinds, fields, readOnly } = useBuilder();
  const kind = kindOf(node, kinds);
  if (!kind) {
    return (
      <Callout color="amber">
        This block&apos;s kind is not registered here, so it is locked. It keeps its settings and prints exactly as it was last saved.
      </Callout>
    );
  }
  const Settings = kind.Settings as ComponentType<KindSettingsProps> | undefined;
  return (
    <div data-ftb-settings={kind.kind}>
      {Settings ? (
        <Settings
          value={node.props as JsonObject}
          fields={[...fields]}
          disabled={readOnly}
          onChange={(next) => {
            // Replace the props whole: keys the panel dropped are cleared.
            const patch: Record<string, unknown> = { ...next };
            for (const k of Object.keys(node.props)) if (!(k in next)) patch[k] = undefined;
            dispatch({ t: "set_props", id: node.id, patch });
          }}
        />
      ) : (
        <Text size="sm" color="muted">{kind.label} has no settings.</Text>
      )}
    </div>
  );
}

export interface BlockSettingsProps {
  className?: string;
}

/** Settings for the selected block, wrapped in a react-fancy Card. */
export function BlockSettings({ className }: BlockSettingsProps) {
  const { state, selected, kinds, problemsFor } = useBuilder();
  const node = selected ? state.tree.nodes[selected] : undefined;
  if (!node) {
    return (
      <Card className={className} padding="md" data-ftb-settings-empty="">
        <Text size="sm" color="muted">Select a block to change it.</Text>
      </Card>
    );
  }
  const kind = kindOf(node, kinds);
  const label = kind?.label ?? BUILTIN_LABELS[node.type] ?? node.type;
  const problems = problemsFor(node.id);
  let body: ReactNode = null;
  let style: Array<keyof BlockStyle> = [];
  switch (node.type) {
    case "heading":
      body = <HeadingSettings node={node} />;
      style = ALL_STYLE;
      break;
    case "text":
      body = <TextSettings node={node} />;
      style = ALL_STYLE;
      break;
    case "image":
      body = <ImageSettings node={node} />;
      break;
    case "table":
      body = <TableSettings node={node} />;
      style = ["size", "color"];
      break;
    case "divider":
      body = <DividerSettings node={node} />;
      style = ["spaceBefore", "spaceAfter"];
      break;
    case "spacer":
      body = <SpacerSettings node={node} />;
      break;
    case "pageBreak":
      body = <Text size="sm" color="muted">Everything after this starts on a new page.</Text>;
      break;
    case "repeat":
      body = <RepeatSettings node={node} />;
      break;
    case "raw":
      body = (
        <Callout color="zinc">
          This part of the template was written outside the builder and has no matching block. It is kept exactly as written and prints unchanged.
        </Callout>
      );
      break;
    default:
      body = <HostSettings node={node} />;
      style = kind?.styleable ?? [];
  }
  return (
    <Card className={className} padding="md" data-ftb-block-settings={node.id}>
      <Card.Header>
        <span className="font-semibold">{label}</span>
      </Card.Header>
      <Card.Body>
        <div className="flex flex-col gap-3">
          {problems.map((p, i) => (
            <Callout key={i} color="red" data-ftb-problem-detail={node.id}>
              {p.message}
            </Callout>
          ))}
          {body}
          <StyleControls node={node} allowed={style} />
        </div>
      </Card.Body>
    </Card>
  );
}
