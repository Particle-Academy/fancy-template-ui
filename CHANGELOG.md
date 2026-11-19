# Changelog

All notable changes to `@particle-academy/fancy-template-ui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0.** Breaking changes land in MINOR releases until 1.0.0. The version
> number is not yet a compatibility promise, so read this file before upgrading
> a minor.

## [Unreleased]

### Changed

- CI: re-pin org third-party allowlist to 2614224

## [0.1.0] - 2026-11-18

The first release. Owner-approved 2026-11-18 (q_52d2323e, q_b83ac35f).

### Security

- **No prototype pollution through a path or a patch** (CodeQL
  js/prototype-pollution-utility and js/prototype-polluting-assignment, found
  before any release). A field token, list token or item token that is not a
  plain dotted name, or that names `__proto__`, `constructor` or `prototype` in
  any segment, is never offered: `compile` reports it as `FIELD_UNKNOWN` and
  declares nothing, and `sampleData` skips it. Style and page patches (an
  agent's JSON, through the bridge) set only their known keys. An imported
  document's keys are copied as own data properties, so a `__proto__` key in a
  template stays data. `tests/pollution.test.ts` holds every path.

### Fixed

- **A cleared field no longer starts with a line break.** contentEditable keeps a
  lone `<br>` as the placeholder of an empty line; it was read as a typed break,
  so a heading cleared and then given a field chip compiled to a line-break run
  before the field. Breaks at a block's edges are dropped; breaks between content
  are kept. Found by the lab benchmark `template-builder-v1`.

### Added

- **`./core`**, React-free: the builder's source model (a fancy-doc-commons
  `DocTree` of blocks and repeat groups, plus page settings), `compile` to a
  fancy-template envelope (`writer: "fine-print"`, the source under `editor`),
  `openTemplate` (imports a template with no `editor`, keeping anything it
  cannot map as a read-only raw block, byte for byte; reports drift between
  `editor` and `document`), the op reducer with `checkOp` / `applyOp` /
  `invertOp`, and the host block-kind contract (`defineKind`, `required: "once"`,
  `allowInRepeat`).
- **`<TemplateBuilder>`** and its parts, each usable alone: `BlockList`
  (react-fancy `ReorderableGrid`, pointer and keyboard reorder; add and remove,
  with required-once kinds never offered twice and never removable),
  `BlockSettings` (heading, rich text, image, table, divider, spacer, page break,
  repeating section, host kinds' own Settings), `PageSettings` (paper, margins,
  accent, header and footer bands with field and page-number chips),
  `FieldPicker` (fields as chips from the host list; nobody types braces),
  `TemplatePreview` (exact pages from the host's `renderPreview`, the default
  when supplied; a draft view through `renderDraft`, labelled "page breaks may
  differ") and `PendingChanges` (staged agent edits, accepted only by a person).
  Drift between `editor` and `document` is shown and never resolved silently.
  Stable `data-ftb-*` handles on every interactive element; `onActivity` for
  every mutation; undo and redo.
- `applyOnAccept={false}` for proposals from agent-integrations
  `registerTemplateBridge`: Accept calls `onAccept`, where the host calls
  `bridge.confirm(p.id)`, and the op lands once, through the bridge.
- The draft view takes a render prop rather than importing last-word-ui, so
  last-word-ui is not a peer: pass `renderDraft={(doc) => <DocViewer document={doc} />}`.
