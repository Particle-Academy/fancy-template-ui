# @particle-academy/fancy-template-ui

A visual **builder for paged document templates**: a block list (add, drag to
reorder, remove), the selected block's settings, and a paged preview that is
page for page what [fine-print](https://github.com/Particle-Academy/fine-print)
writes.

It edits ONE [fancy-template](https://github.com/Particle-Academy/fancy-template)
envelope, controlled (`value` / `onChange`, plain JSON). Rendering stays
`Template::render` plus fine-print's `Agent::toBytes()` on your server; the
builder only writes the template.

> **Pre-1.0.** Breaking changes land in MINOR releases until 1.0.0.

<!-- fancy-agents-note:start -->
> **For agents.** This package is not listed on the Fancy MCP catalog server
> yet. The server, `https://ui.particle.academy/mcp` (streamable HTTP, no API key; MCP id
> `fancy-ui`), lists the released Fancy packages with install commands and
> docs. How an agent installs and uses this package is in [AGENTS.md](https://github.com/Particle-Academy/fancy-template-ui/blob/main/AGENTS.md).
<!-- fancy-agents-note:end -->

## Status

In development. Not yet published.

## License

MIT
