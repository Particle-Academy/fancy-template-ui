import { useCallback } from "react";
import { Card, ColorPicker, NumberField, Select, Switch, Text } from "@particle-academy/react-fancy";
import { useBuilder, type FieldOption } from "./context";
import { RichTextField } from "./RichTextField";
import { bandToHtml, htmlToBand, PAGE_TOKEN, PAGES_TOKEN } from "./runs-html";
import type { Band, Page } from "./core/types";

const PAGE_LABELS = { page: "Page number", pages: "Page count" };
const PAGE_CHIPS: FieldOption[] = [
  { token: PAGE_TOKEN, label: PAGE_LABELS.page, group: "Page" },
  { token: PAGES_TOKEN, label: PAGE_LABELS.pages, group: "Page" },
];

type BandKey = "header" | "footer" | "firstHeader" | "firstFooter";

function BandEditor({ which, title }: { which: BandKey; title: string }) {
  const { state, dispatch, fieldOptions, labelOf, readOnly } = useBuilder();
  const band = state.page[which] ?? {};
  const options = fieldOptions(null).filter((o) => o.type !== "image");
  const canon = useCallback(
    (html: string) => bandToHtml(htmlToBand(html), labelOf, PAGE_LABELS),
    [labelOf],
  );
  const setSlot = (slot: keyof Band, html: string) => {
    const next: Band = { ...band, [slot]: htmlToBand(html) };
    for (const k of ["left", "center", "right"] as const) if (!next[k]) delete next[k];
    dispatch({ t: "set_page", patch: { [which]: Object.keys(next).length ? next : undefined } });
  };
  return (
    <div data-ftb-band={which}>
      <Text size="sm" weight="medium">{title}</Text>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {(["left", "center", "right"] as const).map((slot) => (
          <RichTextField
            key={slot}
            handle={`band:${which}:${slot}`}
            html={bandToHtml(band[slot], labelOf, PAGE_LABELS)}
            canonical={canon}
            options={options}
            extra={PAGE_CHIPS}
            disabled={readOnly}
            maxHeight={60}
            placeholder={slot === "left" ? "Left" : slot === "center" ? "Centre" : "Right"}
            onHtmlChange={(html) => setSlot(slot, html)}
          />
        ))}
      </div>
    </div>
  );
}

export interface PageSettingsProps {
  className?: string;
}

/** Paper, margins, accent colour, and the header and footer bands (a letterhead). */
export function PageSettings({ className }: PageSettingsProps) {
  const { state, dispatch, readOnly } = useBuilder();
  const page = state.page;
  const set = (patch: Partial<Page>) => dispatch({ t: "set_page", patch });
  const firstDifferent = page.firstHeader !== undefined || page.firstFooter !== undefined;
  return (
    <Card className={className} padding="md" data-ftb-page="">
      <Card.Header>
        <span className="font-semibold">Page</span>
      </Card.Header>
      <Card.Body>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Paper"
              list={[
                { value: "letter", label: "Letter" },
                { value: "a4", label: "A4" },
                { value: "legal", label: "Legal" },
              ]}
              value={page.size}
              disabled={readOnly}
              data-ftb-page-size=""
              onValueChange={(v) => set({ size: v as Page["size"] })}
            />
            <Select
              label="Orientation"
              list={[
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ]}
              value={page.orientation}
              disabled={readOnly}
              onValueChange={(v) => set({ orientation: v as Page["orientation"] })}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <NumberField
                key={side}
                label={`${side[0]!.toUpperCase()}${side.slice(1)} (pt)`}
                min={0}
                max={300}
                value={page.margins[side]}
                disabled={readOnly}
                onValueChange={(v) => set({ margins: { ...page.margins, [side]: v ?? 0 } })}
              />
            ))}
          </div>
          <ColorPicker label="Accent colour" value={page.accent} disabled={readOnly} onChange={(c) => /^#[0-9A-Fa-f]{6}$/.test(c) && set({ accent: c })} />
          <BandEditor which="header" title="Header" />
          <BandEditor which="footer" title="Footer" />
          <Switch
            label="Different first page"
            checked={firstDifferent}
            disabled={readOnly}
            onCheckedChange={(on) =>
              set(on ? { firstHeader: page.header ?? {}, firstFooter: page.footer ?? {} } : { firstHeader: undefined, firstFooter: undefined })
            }
          />
          {firstDifferent && (
            <>
              <BandEditor which="firstHeader" title="First page header" />
              <BandEditor which="firstFooter" title="First page footer" />
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
