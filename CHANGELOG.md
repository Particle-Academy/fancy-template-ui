# Changelog

All notable changes to `@particle-academy/fancy-template-ui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0.** Breaking changes land in MINOR releases until 1.0.0. The version
> number is not yet a compatibility promise, so read this file before upgrading
> a minor.

## [Unreleased]

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
- The draft view takes a render prop rather than importing last-word-ui, so
  last-word-ui is not a peer: pass `renderDraft={(doc) => <DocViewer document={doc} />}`.
