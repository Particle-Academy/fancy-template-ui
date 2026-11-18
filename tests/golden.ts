import {
  addBlock,
  applyOp,
  defineKind,
  emptyState,
  ensureRequired,
  orderedBlocks,
  type BlockKind,
  type CompileContext,
  type EditorState,
} from "../src/core";

/** A 1x1 PNG. */
export const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const totalsKind: BlockKind<{ label: string }> = defineKind({
  kind: "acme:totals",
  label: "Totals",
  schema: { type: "object", properties: { label: { type: "string", maxLength: 40 } }, required: ["label"] },
  defaults: { label: "Total" },
  required: "once",
  render: (props, ctx) => [
    {
      type: "paragraph",
      align: "right",
      runs: [{ text: `${props.label}: `, bold: true }, { text: ctx.fieldToken("quote.total"), bold: true, color: ctx.accent }],
    },
  ],
});

export const goldenContext: CompileContext = {
  kinds: [totalsKind as BlockKind],
  fields: [
    { label: "Customer name", token: "customer.name", sample: "Ada Lovelace" },
    { label: "Quote number", token: "quote.number", sample: "Q-1001" },
    { label: "Quote total", token: "quote.total", sample: "1,250.00" },
    { label: "Logo", token: "logo", type: "image" },
  ],
  lists: [
    {
      label: "Line items",
      token: "lines",
      itemFields: [
        { label: "Title", token: "title", sample: "Engine" },
        { label: "Body", token: "body", sample: "One analytical engine." },
        { label: "Amount", token: "amount", sample: "100.00" },
      ],
    },
  ],
};

export function goldenState(): EditorState {
  let s = emptyState();
  s = applyOp(s, {
    t: "set_page",
    patch: {
      size: "a4",
      accent: "#1F4E79",
      margins: { top: 96, right: 60, bottom: 72, left: 60 },
      header: { left: [{ text: "Acme Engines Ltd" }], right: [{ text: "Quote " }, { field: "quote.number" }] },
      footer: { center: [{ text: "Page " }, { page: "page" }, { text: " of " }, { page: "pages" }] },
    },
  });
  s = addBlock(s, { type: "image", props: { field: "logo", widthPx: 96 } });
  s = addBlock(s, { type: "image", props: { src: PNG, widthPx: 24, heightPx: 24, alt: "Seal" } });
  s = addBlock(s, { type: "heading", props: { level: 1, runs: [{ text: "Quote " }, { field: "quote.number" }] }, style: { align: "center", size: 22 } });
  s = addBlock(s, {
    type: "text",
    props: {
      paras: [
        { type: "paragraph", runs: [{ text: "Dear " }, { field: "customer.name", bold: true }, { text: ", thank you for {{ asking }}." }] },
        { type: "list", items: [[{ text: "Delivery in ", italic: true }, { text: "six weeks", bold: true }], [{ text: "Installation", underline: true }]] },
        { type: "list", ordered: true, items: [[{ text: "Sign" }], [{ text: "Return" }]] },
      ],
    },
    style: { spaceAfter: 10, color: "#333333" },
  });
  s = addBlock(s, { type: "divider", props: { weight: 1.5 } });
  s = addBlock(s, {
    type: "table",
    props: { header: true, widths: [70, 30], rows: [[[{ text: "Item" }], [{ text: "Amount" }]], [[{ text: "Survey" }], [{ text: "50.00" }]]] },
  });
  s = addBlock(s, { type: "spacer", props: { height: 18 } });
  s = addBlock(s, { type: "repeat", props: { list: "lines", pageEach: true } });
  const group = orderedBlocks(s).at(-1)!.id;
  s = addBlock(s, { type: "heading", props: { level: 2, runs: [{ field: "item.title" }] } }, { parent: group });
  s = addBlock(s, { type: "text", props: { paras: [{ type: "paragraph", runs: [{ field: "item.body" }, { text: " " }, { field: "item.amount", bold: true }] }] } }, { parent: group });
  s = addBlock(s, { type: "pageBreak", props: {} });
  return ensureRequired(s, goldenContext.kinds).state;
}

export function goldenData(items: number) {
  return {
    customer: { name: "Ada Lovelace" },
    quote: { number: "Q-1001", total: "1,250.00" },
    logo: PNG,
    lines: Array.from({ length: items }, (_, i) => ({ title: `Engine ${i + 1}`, body: `Part ${i + 1}.`, amount: `${(i + 1) * 100}.00` })),
  };
}
