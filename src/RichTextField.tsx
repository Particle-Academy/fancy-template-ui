import { useEffect, useRef, useState } from "react";
import { Button, Command, Editor, useEditor } from "@particle-academy/react-fancy";
import type { FieldOption } from "./context";

export interface FieldPickerProps {
  options: FieldOption[];
  onPick(option: FieldOption): void;
  /** Extra chips that are not fields, such as page numbers in a band. */
  extra?: FieldOption[];
  label?: string;
  disabled?: boolean;
}

/**
 * "Insert field": a react-fancy Command palette over the host's field list.
 * Only offered tokens can be picked, so nobody types braces.
 */
export function FieldPicker({ options, onPick, extra = [], label = "Insert field", disabled }: FieldPickerProps) {
  const [open, setOpen] = useState(false);
  const all = [...options, ...extra];
  const groups = [...new Set(all.map((o) => o.group))];
  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        icon="braces"
        disabled={disabled || all.length === 0}
        data-ftb-field-picker=""
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Command open={open} onClose={() => setOpen(false)}>
        <Command.Input placeholder="Search fields" />
        <Command.List>
          <Command.Empty>No field matches.</Command.Empty>
          {groups.map((g) => (
            <Command.Group key={g} heading={g}>
              {all
                .filter((o) => o.group === g)
                .map((o) => (
                  <Command.Item
                    key={o.token}
                    value={`${o.label} ${o.token}`}
                    onSelect={() => {
                      setOpen(false);
                      onPick(o);
                    }}
                  >
                    <span data-ftb-field={o.token}>{o.label}</span>
                  </Command.Item>
                ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </>
  );
}

function InsertField({ options, extra, disabled }: { options: FieldOption[]; extra?: FieldOption[]; disabled?: boolean }) {
  const editor = useEditor();
  return (
    <FieldPicker
      options={options}
      extra={extra}
      disabled={disabled}
      onPick={(o) => editor.insertToken({ id: o.token, label: o.label })}
    />
  );
}

const FORMAT_ACTIONS = [
  { label: "Bold", command: "bold", icon: "B" },
  { label: "Italic", command: "italic", icon: "I" },
  { label: "Underline", command: "underline", icon: "U" },
];
const LIST_ACTIONS = [
  { label: "Bulleted list", command: "insertUnorderedList", icon: "•" },
  { label: "Numbered list", command: "insertOrderedList", icon: "1." },
];

function Toolbar({ lists, options, extra, disabled }: { lists: boolean; options: FieldOption[]; extra?: FieldOption[]; disabled?: boolean }) {
  const editor = useEditor();
  const actions = lists ? [...FORMAT_ACTIONS, ...LIST_ACTIONS] : FORMAT_ACTIONS;
  return (
    <Editor.Toolbar>
      {actions.map((a) => (
        <Button
          key={a.command}
          type="button"
          size="xs"
          variant="ghost"
          aria-label={a.label}
          title={a.label}
          data-ftb-format={a.command}
          disabled={disabled}
          onClick={() => editor.exec(a.command)}
        >
          {a.icon}
        </Button>
      ))}
      <Editor.Toolbar.Separator />
      <InsertField options={options} extra={extra} disabled={disabled} />
    </Editor.Toolbar>
  );
}

export interface RichTextFieldProps {
  /** HTML the model produced (from `parasToHtml` / `runsToHtml`). */
  html: string;
  /** Called with the Editor's HTML on every change. */
  onHtmlChange(html: string): void;
  /** Normalises HTML to the model and back, so an echo is recognised as one. */
  canonical(html: string): string;
  options: FieldOption[];
  extra?: FieldOption[];
  lists?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** A stable handle for this field. */
  handle: string;
  maxHeight?: number;
}

/**
 * The react-fancy Editor over model runs. Holds the Editor's own HTML locally
 * and re-seeds only when the model changed from OUTSIDE (an agent's edit, a
 * different block), so typing never fights the caret.
 */
export function RichTextField({ html, onHtmlChange, canonical, options, extra, lists = false, placeholder, disabled, handle, maxHeight = 220 }: RichTextFieldProps) {
  const [local, setLocal] = useState(html);
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    if (lastSent.current !== null && canonical(lastSent.current) === canonical(html)) return;
    setLocal(html);
    lastSent.current = null;
  }, [html, canonical]);
  return (
    <div data-ftb-rich={handle}>
      <Editor
        value={local}
        outputFormat="html"
        valueFormat="html"
        placeholder={placeholder}
        mode={disabled ? "view" : "edit"}
        onChange={(next) => {
          setLocal(next);
          lastSent.current = next;
          onHtmlChange(next);
        }}
      >
        <Toolbar lists={lists} options={options} extra={extra} disabled={disabled} />
        <Editor.Content maxHeight={maxHeight} />
      </Editor>
    </div>
  );
}
