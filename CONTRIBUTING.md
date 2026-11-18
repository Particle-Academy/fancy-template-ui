# Contributing to @particle-academy/fancy-template-ui

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

This file describes this repository's code only; process rules live in the
envelope's `RULES.md`. The design is `.ai/plans/document-builder.md` in the
envelope.

## Layout

- `src/core/` is React-free and must stay so (`./core` is used by agent bridges
  and on servers). `types.ts` the model; `model.ts` creating and reading it;
  `ops.ts` the reducer, `checkOp` (the ONE rule set: UI, bridge and server all
  call it) and exact inverses; `compile.ts` model to envelope; `open.ts`
  import, round trip and drift; `schema.ts` the small JSON Schema subset for
  kind props.
- `src/*.tsx` the surface, composed from react-fancy only (Fancy Exclusive).
  `runs-html.ts` is the only place that parses the Editor's HTML.

## Invariants (each has a test)

- **Every compiled template passes `inspect()`.** `compile` runs it and maps
  issues back to blocks. The golden quote also goes through fine-print's own
  validator and writer: `UPDATE_GOLDENS=1 npm test`, then
  `php scripts/validate-fine-print.php ../fine-print`. That script starts with a
  negative control, because `Agent::validate` returns a bare LIST and reading it
  as `{errors}` passes everything.
- **Opening never changes a document.** The importer maps a block only when
  compiling the mapped block reproduces it exactly; otherwise the block is kept
  raw. Do not "improve" a mapping without the round-trip test on
  `tests/fixtures/*.fine-print.json` (copied from fancy-template's examples,
  which are not on npm).
- **Literal text never becomes a token.** Run text and alt text go through
  `escapeText`; only `{field}` runs write `{{ token }}`.
- **A field the host did not offer cannot be compiled in**, even when pasted as
  a chip: it is dropped with a `FIELD_UNKNOWN` problem.
- **`applyOp` refuses exactly what `checkOp` refuses**, returning the same state
  object, so a caller can detect a refusal by identity.
- **The builder never resolves drift by itself**; the person chooses.

## Traps

- The Editor holds its own HTML. `RichTextField` re-seeds only when the model
  changed from outside (compared through `canonical`), or typing fights the
  caret.
- Order keys are fractional strings: `"a"` sorts AFTER `"V"`. Use `orderAt`.
- The Write tool decodes `\uXXXX` escapes into raw characters; a raw U+2028 in a
  regex literal is a parse error. Build such characters with
  `String.fromCharCode`.

## Commands

```bash
npm test       # vitest (core in node, surface in jsdom)
npm run lint   # tsc --noEmit && eslint .
npm run build  # tsup: . and ./core
```

## Changelog

Update `CHANGELOG.md` in the same commit as the change.
