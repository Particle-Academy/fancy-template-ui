// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Proposal } from "@particle-academy/fancy-doc-commons";
import {
  TemplateBuilder,
  addBlock,
  compile,
  createState,
  defineKind,
  emptyState,
  htmlToParas,
  orderedBlocks,
  parasToHtml,
  type BlockKind,
  type BuilderOp,
  type FieldDef,
  type ListDef,
  type TemplateEnvelope,
} from "../src";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fields: FieldDef[] = [
  { label: "Customer name", token: "customer.name", sample: "Ada" },
  { label: "Logo", token: "logo", type: "image" },
];
const lists: ListDef[] = [{ label: "Lines", token: "lines", itemFields: [{ label: "Title", token: "title", sample: "T" }] }];
const totals = defineKind({
  kind: "acme:totals",
  label: "Totals",
  schema: { type: "object", properties: { label: { type: "string" } } },
  defaults: { label: "Total" },
  required: "once",
  render: (p) => [{ type: "paragraph", runs: [{ text: String(p.label) }] }],
}) as BlockKind;
const kinds = [totals];

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  document.body.innerHTML = "";
});

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  cleanups.push(() => act(() => root.unmount()));
  return host;
}

/** A controlled host, as an app would write it. */
function Host(props: { initial?: TemplateEnvelope; onChange?: (t: TemplateEnvelope) => void; extra?: Record<string, unknown> }) {
  const [value, setValue] = useState<TemplateEnvelope | undefined>(props.initial);
  return (
    <TemplateBuilder
      value={value}
      onChange={(t) => {
        setValue(t);
        props.onChange?.(t);
      }}
      fields={fields}
      lists={lists}
      kinds={kinds}
      renderDraft={(doc) => <pre data-testid="draft">{JSON.stringify(doc)}</pre>}
      {...props.extra}
    />
  );
}

function q<T extends Element = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`no element ${sel}`);
  return el;
}

function click(el: Element) {
  act(() => {
    (el as HTMLElement).click();
  });
}

function addViaMenu(type: string, parent = "root") {
  click(q(`[data-ftb-add-trigger="${parent}"]`));
  const item = q(`[data-ftb-add="${type}"]`);
  click(item.closest("button,[role=menuitem]") ?? item);
}

describe("TemplateBuilder", () => {
  it("renders the three parts with stable handles, and a required kind is present from the start", () => {
    mount(<Host />);
    expect(q("[data-ftb-builder]").getAttribute("data-ftb-builder")).toBe("template-builder");
    expect(q("[data-ftb-block-list]")).toBeTruthy();
    expect(q("[data-ftb-preview]")).toBeTruthy();
    const rows = document.querySelectorAll("[data-ftb-block]");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-ftb-type")).toBe("host:acme:totals");
  });

  it("adds a block from the menu and emits a compiled envelope", () => {
    const onChange = vi.fn();
    mount(<Host onChange={onChange} />);
    addViaMenu("heading");
    const t = onChange.mock.calls.at(-1)![0] as TemplateEnvelope;
    expect(t.document.blocks.map((b: { type: string }) => b.type)).toEqual(["paragraph", "heading"]);
    expect(t.editor.kind).toBe("fancy-template-ui");
    expect(document.querySelectorAll("[data-ftb-block]")).toHaveLength(2);
  });

  it("never offers a second required-once kind, and its remove button is disabled", () => {
    mount(<Host />);
    click(q('[data-ftb-add-trigger="root"]'));
    expect(document.querySelector('[data-ftb-add="host:acme:totals"]')).toBeNull();
    const id = q('[data-ftb-type="host:acme:totals"]').getAttribute("data-ftb-block")!;
    expect(q<HTMLButtonElement>(`[data-ftb-remove="${id}"]`).disabled).toBe(true);
  });

  it("removes a block", () => {
    const onChange = vi.fn();
    const s = addBlock(createState([], kinds), { type: "pageBreak", props: {} });
    mount(<Host initial={compile(s, { kinds, fields, lists }).template} onChange={onChange} />);
    const id = q('[data-ftb-type="pageBreak"]').getAttribute("data-ftb-block")!;
    click(q(`[data-ftb-remove="${id}"]`));
    const t = onChange.mock.calls.at(-1)![0] as TemplateEnvelope;
    expect(t.document.blocks.map((b: { type: string }) => b.type)).toEqual(["paragraph"]);
  });

  it("inserts a field chip from the picker and compiles it to a token", () => {
    const onChange = vi.fn();
    const s = addBlock(createState([], kinds), { type: "text", props: { paras: [{ type: "paragraph", runs: [{ text: "Dear " }] }] } });
    mount(<Host initial={compile(s, { kinds, fields, lists }).template} onChange={onChange} />);
    const id = q('[data-ftb-type="text"]').getAttribute("data-ftb-block")!;
    click(q(`[data-ftb-select="${id}"]`));
    click(q("[data-ftb-field-picker]"));
    // Image fields are not offered in text.
    expect(document.querySelector('[data-ftb-field="logo"]')).toBeNull();
    const item = q('[data-ftb-field="customer.name"]');
    click(item.closest("[role=option],button,[data-react-fancy-command-item]") ?? item);
    const t = onChange.mock.calls.at(-1)![0] as TemplateEnvelope;
    const text = t.document.blocks.find((b: { type: string }) => b.type === "paragraph" && b.runs.length > 1);
    expect(text.runs.map((r: { text: string }) => r.text)).toEqual(["Dear ", "{{ customer.name }}"]);
    expect(t.variables.customer.properties.name.description).toBe("Customer name");
  });

  it("offers each item's fields inside a repeat", () => {
    let s = addBlock(createState([], kinds), { type: "repeat", props: { list: "lines", pageEach: true } });
    const group = orderedBlocks(s).find((n) => n.type === "repeat")!.id;
    s = addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [] }] } }, { parent: group });
    mount(<Host initial={compile(s, { kinds, fields, lists }).template} />);
    const id = q('[data-ftb-type="text"]').getAttribute("data-ftb-block")!;
    click(q(`[data-ftb-select="${id}"]`));
    click(q("[data-ftb-field-picker]"));
    expect(document.querySelector('[data-ftb-field="item.title"]')).toBeTruthy();
  });

  it("applies an accepted proposal, and a rejected one changes nothing", () => {
    const onChange = vi.fn();
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const s = createState([], kinds);
    const op: BuilderOp = { t: "insert", node: { id: "agent_1", type: "pageBreak", parent: null, order: "0", props: {} } };
    const pending: Proposal<BuilderOp>[] = [
      { id: "p1", op, actor: { kind: "agent", name: "Helper" } },
      { id: "p2", op: { t: "set_page", patch: { size: "a4" } } },
    ];
    mount(<Host initial={compile(s, { kinds }).template} onChange={onChange} extra={{ pending, onAccept, onReject }} />);
    expect(onChange).not.toHaveBeenCalled();
    click(q('[data-ftb-reject="p2"]'));
    expect(onReject).toHaveBeenCalledWith(pending[1]);
    expect(onChange).not.toHaveBeenCalled();
    click(q('[data-ftb-accept="p1"]'));
    expect(onAccept).toHaveBeenCalledWith(pending[0]);
    const t = onChange.mock.calls.at(-1)![0] as TemplateEnvelope;
    expect(t.document.blocks.map((b: { type: string }) => b.type)).toEqual(["pageBreak", "paragraph"]);
  });

  it("asks which version to keep on drift and never picks silently", () => {
    const onChange = vi.fn();
    const s = addBlock(emptyState(), { type: "heading", props: { level: 1, runs: [{ text: "Builder" }] } });
    const t = compile(s, {}).template;
    const edited = { ...t, document: { ...t.document, blocks: [{ type: "paragraph", runs: [{ text: "Hand" }] }] } } as TemplateEnvelope;
    mount(<Host initial={edited} onChange={onChange} extra={{ kinds: [] }} />);
    expect(q("[data-ftb-drift]")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    click(q('[data-ftb-drift-keep="document"]'));
    const out = onChange.mock.calls.at(-1)![0] as TemplateEnvelope;
    expect(out.document.blocks).toEqual(edited.document.blocks);
    expect(document.querySelector("[data-ftb-drift]")).toBeNull();
  });

  it("labels the draft view as approximate", () => {
    mount(<Host />);
    expect(q("[data-ftb-preview]").getAttribute("data-mode")).toBe("draft");
    expect(q("[data-ftb-draft-warning]").textContent).toMatch(/page breaks may differ/i);
    expect(q('[data-testid="draft"]').textContent).toContain("Total");
  });

  it("defaults to the exact preview when the host renders pages, debounced", async () => {
    vi.useFakeTimers();
    try {
      const renderPreview = vi.fn(async () => ({ count: 2, url: (p: number) => `/pages/${p}.png` }));
      mount(<Host extra={{ renderPreview }} />);
      expect(q("[data-ftb-preview]").getAttribute("data-mode")).toBe("exact");
      expect(renderPreview).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(650);
      });
      expect(renderPreview).toHaveBeenCalledTimes(1);
      const [template, data] = renderPreview.mock.calls[0]! as unknown as [TemplateEnvelope, Record<string, unknown>];
      expect(template.writer).toBe("fine-print");
      expect(data).toMatchObject({ customer: { name: "Ada" } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("read-only disables every mutation", () => {
    mount(<Host extra={{ readOnly: true }} />);
    expect(q<HTMLButtonElement>('[data-ftb-add-trigger="root"]').disabled).toBe(true);
  });
});

describe("runs <-> editor html", () => {
  it("round-trips paragraphs, lists, marks and chips", () => {
    const paras = [
      { type: "paragraph" as const, runs: [{ text: "Dear " }, { field: "customer.name", bold: true }, { text: " <b>x</b>", italic: true }] },
      { type: "list" as const, ordered: true, items: [[{ text: "One" }], [{ text: "Two", underline: true }]] },
    ];
    const html = parasToHtml(paras, (t) => t.toUpperCase());
    expect(htmlToParas(html)).toEqual(paras);
  });

  it("a pasted fake chip is still only a field id; compile refuses one the host does not offer", () => {
    const paras = htmlToParas('<p><span data-react-fancy-editor-token="password">x</span></p>');
    const s = addBlock(emptyState(), { type: "text", props: { paras } });
    const out = compile(s, { fields });
    expect(out.problems.map((p) => p.code)).toEqual(["FIELD_UNKNOWN"]);
    expect(JSON.stringify(out.template.document)).not.toContain("password");
  });
});
