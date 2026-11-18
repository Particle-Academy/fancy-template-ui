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
