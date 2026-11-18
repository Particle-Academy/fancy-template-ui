import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Callout, Card, PdfViewer, Tabs, Text, type PdfPageSource } from "@particle-academy/react-fancy";
import { render, validateData } from "@particle-academy/fancy-template";
import type { JsonObject, TemplateEnvelope } from "./core/types";

export type PreviewMode = "exact" | "draft";

export interface TemplatePreviewProps {
  template: TemplateEnvelope;
  data: JsonObject;
  /**
   * EXACT mode: the host renders with `Template::render` + fine-print
   * `Agent::toBytes()` and serves page images (fine-print's `PageImages`).
   * Those pages ARE fine-print's, so the preview is page for page.
   */
  renderPreview?: (template: TemplateEnvelope, data: JsonObject) => Promise<PdfPageSource>;
  /**
   * DRAFT mode: draws the rendered document in the browser, e.g. last-word-ui's
   * `<DocViewer document={doc} />`. Fast, but its page breaks may differ.
   */
  renderDraft?: (document: JsonObject) => ReactNode;
  mode?: PreviewMode;
  defaultMode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
  /** Debounce before asking the host for exact pages. @default 600 */
  debounceMs?: number;
  className?: string;
}

/** The paged preview: exact (host pages) by default when available, draft labelled as approximate. */
export function TemplatePreview({
  template,
  data,
  renderPreview,
  renderDraft,
  mode: modeProp,
  defaultMode,
  onModeChange,
  debounceMs = 600,
  className,
}: TemplatePreviewProps) {
  const available: PreviewMode[] = [...(renderPreview ? (["exact"] as const) : []), ...(renderDraft ? (["draft"] as const) : [])];
  const [modeLocal, setModeLocal] = useState<PreviewMode>(defaultMode ?? available[0] ?? "exact");
  const mode = modeProp ?? (available.includes(modeLocal) ? modeLocal : available[0] ?? "exact");
  const setMode = (m: PreviewMode) => {
    setModeLocal(m);
    onModeChange?.(m);
  };

  const dataErrors = useMemo(() => validateData(template, data), [template, data]);
  const draft = useMemo(() => {
    if (mode !== "draft" || dataErrors.length) return null;
    try {
      return { doc: render(template, data) as JsonObject, error: null as string | null };
    } catch (e) {
      return { doc: null, error: (e as Error).message };
    }
  }, [mode, template, data, dataErrors]);

  // Exact: debounce, keep the previous pages until new ones arrive.
  const [pages, setPages] = useState<PdfPageSource | null>(null);
  const [exactError, setExactError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (mode !== "exact" || !renderPreview || dataErrors.length) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setBusy(true);
      renderPreview(template, data).then(
        (src) => {
          if (mine !== seq.current) return;
          setPages(src);
          setExactError(null);
          setBusy(false);
        },
        (e: unknown) => {
          if (mine !== seq.current) return;
          setExactError(e instanceof Error ? e.message : String(e));
          setBusy(false);
        },
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [mode, renderPreview, template, data, dataErrors, debounceMs]);

  let body: ReactNode;
  if (available.length === 0) {
    body = <Text size="sm" color="muted">No preview: the host supplies neither renderPreview nor renderDraft.</Text>;
  } else if (dataErrors.length) {
    body = (
      <Callout color="amber" data-ftb-preview-data-errors="">
        The preview data does not fit the template: {dataErrors.map((e) => `${e.code} at ${e.path || "(root)"}`).join(", ")}.
      </Callout>
    );
  } else if (mode === "exact") {
    body = (
      <>
        {exactError && <Callout color="red" data-ftb-preview-error="">{exactError}</Callout>}
        {pages ? <PdfViewer pages={pages} /> : <Text size="sm" color="muted">Rendering the pages...</Text>}
      </>
    );
  } else {
    body = draft?.error ? (
      <Callout color="red" data-ftb-preview-error="">{draft.error}</Callout>
    ) : draft?.doc && renderDraft ? (
      renderDraft(draft.doc)
    ) : null;
  }

  return (
    <Card className={className} padding="md" data-ftb-preview="" data-mode={mode} data-busy={busy ? "" : undefined}>
      <Card.Header>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Preview</span>
          {available.length > 1 ? (
            <Tabs activeTab={mode} onTabChange={(t) => setMode(t as PreviewMode)}>
              <Tabs.List>
                <Tabs.Tab value="exact">Exact</Tabs.Tab>
                <Tabs.Tab value="draft">Draft view</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          ) : null}
          {mode === "draft" && (
            <Badge size="sm" color="amber" data-ftb-draft-warning="">
              Draft view: page breaks may differ
            </Badge>
          )}
        </div>
      </Card.Header>
      <Card.Body>{body}</Card.Body>
    </Card>
  );
}
