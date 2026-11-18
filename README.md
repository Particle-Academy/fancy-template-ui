# @particle-academy/fancy-template-ui

A visual **builder for paged document templates**: a block list (add, drag to
reorder, remove), the selected block's settings, and a paged preview that is
page for page what [fine-print](https://github.com/Particle-Academy/fine-print)
writes.

It edits ONE [fancy-template](https://github.com/Particle-Academy/fancy-template)
envelope, controlled (`value` / `onChange`, plain JSON). Rendering stays on your
server: `Template::render` then fine-print. The builder only writes the
template.

> **Pre-1.0.** Breaking changes land in MINOR releases until 1.0.0. Read
> `CHANGELOG.md` before upgrading a minor.

<!-- fancy-agents-note:start -->
> **For agents.** This package is not listed on the Fancy MCP catalog server
> yet. The server, `https://ui.particle.academy/mcp` (streamable HTTP, no API key; MCP id
> `fancy-ui`), lists the released Fancy packages with install commands and
> docs. How an agent installs and uses this package is in [AGENTS.md](https://github.com/Particle-Academy/fancy-template-ui/blob/main/AGENTS.md).
<!-- fancy-agents-note:end -->

## Install

```bash
npm install @particle-academy/fancy-template-ui @particle-academy/fancy-template @particle-academy/fancy-doc-commons @particle-academy/react-fancy
```

Everything is a peer; `dependencies` is empty.

## Use

```tsx
import { TemplateBuilder } from "@particle-academy/fancy-template-ui";

<TemplateBuilder
  value={template}
  onChange={setTemplate}
  fields={[{ label: "Customer name", token: "customer.name", sample: "Ada Lovelace" }]}
  lists={[{ label: "Line items", token: "lines", itemFields: [{ label: "Title", token: "title" }] }]}
  renderPreview={(template, data) => fetchPages(template, data)}
/>;
```

- **Blocks:** heading, rich text (bold, italic, underline, lists), image, table,
  divider, spacer, page break, and repeating sections (a group of blocks per
  list item, optionally a page each).
- **Fields** come from your list and are inserted as chips. Nobody types braces,
  and text a person types is never read as a field.
- **Page:** paper, orientation, margins, accent colour, and header and footer
  bands (a letterhead), with page-number chips.
- **Your own block kinds**, each with a settings panel and a renderer; a kind
  can be required exactly once.
- **Preview:** exact pages from your server by default; a fast draft view in
  the browser, labelled as approximate.
- **Agents** edit through `registerTemplateBridge` in
  `@particle-academy/agent-integrations`. Every agent edit waits for a person to
  accept it.

The React-free model, compiler and rules are at
`@particle-academy/fancy-template-ui/core`.

## License

MIT
