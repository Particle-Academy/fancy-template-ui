/**
 * Rich runs <-> the react-fancy Editor's HTML. The Editor edits HTML; the model
 * holds last-word runs (plan section 5.1), so this is the only place that
 * parses markup, and it parses only what it wrote: paragraphs, lists, bold,
 * italic, underline and field chips. Anything else is reduced to its text.
 */
import { editorTokenHtml } from "@particle-academy/react-fancy";
import type { BandPart, RichRun, TextPara } from "./core/types";

const TOKEN_ATTR = "data-react-fancy-editor-token";
/** Page-number chips in a band carry these ids; they are not fields. */
export const PAGE_TOKEN = "$page";
export const PAGES_TOKEN = "$pages";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type LabelOf = (token: string) => string;

export function runsToHtml(runs: RichRun[], labelOf: LabelOf): string {
  return runs
    .map((r) => {
      let inner = r.field !== undefined ? editorTokenHtml({ id: r.field, label: labelOf(r.field) }) : esc(r.text ?? "").replace(/\n/g, "<br>");
      if (r.underline) inner = `<u>${inner}</u>`;
      if (r.italic) inner = `<em>${inner}</em>`;
      if (r.bold) inner = `<strong>${inner}</strong>`;
      return inner;
    })
    .join("");
}

export function parasToHtml(paras: TextPara[], labelOf: LabelOf): string {
  return paras
    .map((p) => {
      if (p.type === "list") {
        const tag = p.ordered ? "ol" : "ul";
        return `<${tag}>${p.items.map((it) => `<li>${runsToHtml(it, labelOf)}</li>`).join("")}</${tag}>`;
      }
      return `<p>${runsToHtml(p.runs, labelOf)}</p>`;
    })
    .join("");
}

interface Marks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function sameMarks(a: RichRun, b: Marks): boolean {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
}

function pushText(out: RichRun[], text: string, marks: Marks): void {
  if (text === "") return;
  const last = out[out.length - 1];
  if (last && last.text !== undefined && sameMarks(last, marks)) {
    last.text += text;
    return;
  }
  const run: RichRun = { text };
  if (marks.bold) run.bold = true;
  if (marks.italic) run.italic = true;
  if (marks.underline) run.underline = true;
  out.push(run);
}

function inline(node: Node, marks: Marks, out: RichRun[]): void {
  if (node.nodeType === 3) {
    pushText(out, (node.textContent ?? "").replace(/ /g, " "), marks);
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (el.hasAttribute(TOKEN_ATTR)) {
    const run: RichRun = { field: el.getAttribute(TOKEN_ATTR) ?? "" };
    if (marks.bold) run.bold = true;
    if (marks.italic) run.italic = true;
    if (marks.underline) run.underline = true;
    out.push(run);
    return;
  }
  const tag = el.tagName.toLowerCase();
  if (tag === "br") {
    pushText(out, "\n", marks);
    return;
  }
  const next: Marks = { ...marks };
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italic = true;
  if (tag === "u") next.underline = true;
  el.childNodes.forEach((c) => inline(c, next, out));
}

function trimTrailingBreak(runs: RichRun[]): RichRun[] {
  const last = runs[runs.length - 1];
  if (last?.text !== undefined && last.text.endsWith("\n")) {
    last.text = last.text.slice(0, -1);
    if (last.text === "") runs.pop();
  }
  return runs;
}

function parse(html: string): HTMLElement {
  const box = document.createElement("div");
  // Parsed into an inert template first, so nothing in it runs or loads.
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  box.appendChild(tpl.content.cloneNode(true));
  return box;
}

/** The Editor's HTML back to paragraphs and lists. */
export function htmlToParas(html: string): TextPara[] {
  const root = parse(html);
  const paras: TextPara[] = [];
  let loose: RichRun[] = [];
  const flush = () => {
    if (loose.length) paras.push({ type: "paragraph", runs: trimTrailingBreak(loose) });
    loose = [];
  };
  root.childNodes.forEach((n) => {
    if (n.nodeType === 1) {
      const tag = (n as Element).tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        flush();
        const items: RichRun[][] = [];
        (n as Element).querySelectorAll(":scope > li").forEach((li) => {
          const runs: RichRun[] = [];
          li.childNodes.forEach((c) => inline(c, {}, runs));
          items.push(trimTrailingBreak(runs));
        });
        const para: TextPara = { type: "list", items };
        if (tag === "ol") para.ordered = true;
        paras.push(para);
        return;
      }
      if (/^(p|div|h[1-6]|blockquote|pre)$/.test(tag)) {
        flush();
        const runs: RichRun[] = [];
        n.childNodes.forEach((c) => inline(c, {}, runs));
        paras.push({ type: "paragraph", runs: trimTrailingBreak(runs) });
        return;
      }
    }
    inline(n, {}, loose);
  });
  flush();
  return paras;
}

/** One line of runs (a heading, a table cell): every paragraph joined by a line break. */
export function htmlToRuns(html: string): RichRun[] {
  const out: RichRun[] = [];
  htmlToParas(html).forEach((p, i) => {
    const runs = p.type === "list" ? p.items.flat() : p.runs;
    if (i > 0) pushText(out, "\n", {});
    for (const r of runs) {
      if (r.field !== undefined) out.push({ ...r });
      else pushText(out, r.text ?? "", r);
    }
  });
  return out;
}

/** A band slot to Editor HTML: page-number parts become chips too. */
export function bandToHtml(parts: BandPart[] | undefined, labelOf: LabelOf, pageLabels: { page: string; pages: string }): string {
  if (!parts) return "";
  return parts
    .map((p) => {
      if ("field" in p) return editorTokenHtml({ id: p.field, label: labelOf(p.field) });
      if ("page" in p) {
        return editorTokenHtml(p.page === "pages" ? { id: PAGES_TOKEN, label: pageLabels.pages } : { id: PAGE_TOKEN, label: pageLabels.page });
      }
      return esc(p.text);
    })
    .join("");
}

export function htmlToBand(html: string): BandPart[] | undefined {
  const parts: BandPart[] = [];
  for (const r of htmlToRuns(html)) {
    if (r.field === PAGE_TOKEN) parts.push({ page: "page" });
    else if (r.field === PAGES_TOKEN) parts.push({ page: "pages" });
    else if (r.field !== undefined) parts.push({ field: r.field });
    else if (r.text) parts.push({ text: r.text.replace(/\n/g, " ") });
  }
  return parts.length ? parts : undefined;
}
