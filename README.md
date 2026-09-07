# Vite Import Attributes

A Vite plugin that transforms
[import attributes](https://github.com/tc39/proposal-import-attributes) into
Vite's native query-string syntax, so you can write modern `with { ... }`
imports today.

## What it does

Import attributes (formerly "import assertions") let you attach metadata to
module imports:

```ts
import css from "./style.css" with { type: "text" };
import data from "./schema.json" with { type: "json" };
import { Counter } from "./counter" with { island: "client-only" };
const mod = await import("./lazy", { with: { island: "client-only" } });
```

Vite doesn't understand those attributes yet. This plugin rewrites them into
Vite's existing query-string mechanism so they "just work":

- `{ type: "text" }` becomes `?raw`, matching Vite's built-in handling for raw
  text imports.
- Other attributes are serialized into a `?__attributes=<json>` query string
  that other plugins can read via `parseImportAttributes(id)`.
- Dynamic `import(..., { with: { ... } })` calls are rewritten the same way.

## Install

This is a [Deno](https://deno.com/) project; install it as a JSR or npm
dependency in your own project, or import directly:

```ts
// deno.json
{
  "imports": {
    "vite-import-attributes": "jsr:...",
    "vite": "npm:vite"
  }
}
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vitePluginImportAttributes from "vite-import-attributes";

export default defineConfig({
  plugins: [vitePluginImportAttributes()],
});
```

### Options

```ts
vitePluginImportAttributes({
  include: ["src/**/*"], // default: all files
  exclude: /\/node_modules\//, // default
});
```

### Reading attributes in your own plugin

The serialized attributes are available to other Vite plugins via the exported
helper:

```ts
import { parseImportAttributes } from "vite-import-attributes";

transform(_code, id) {
  const { rawId, attributes } = parseImportAttributes(id);
  if (attributes.island === "client-only") {
    // ...
  }
}
```

## Why a "pre" resolveId hook?

If you use Vite with a custom resolver (e.g.
[@deno/vite-plugin](https://github.com/denoland/vite-plugin-deno)) that resolves
bare or aliased specifiers, the resolver may drop the `?raw` / `?__attributes=`
query that this plugin appends. To prevent that, this plugin runs in
`enforce: "pre"` and resolves the base specifier itself first, then re-appends
the query. The bundled tests cover this case.

## Development

```sh
deno test      # run unit + e2e tests
deno check .   # typecheck
deno fmt .     # format
```

## License

MIT
