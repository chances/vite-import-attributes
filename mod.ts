import * as esModuleLexer from "es-module-lexer";
import MagicString from "magic-string";
// deno-lint-ignore no-import-prefix no-unversioned-import
import { createFilter, type Plugin } from "npm:vite";

export default function vitePluginImportAttributes(pluginOptions?: {
  include: string | RegExp | (string | RegExp)[];
  exclude?: string | RegExp | (string | RegExp)[];
}): Plugin[] {
  const filter = createFilter(
    pluginOptions?.include,
    pluginOptions?.exclude ?? /\/node_modules\//,
  );
  return [
    {
      name: "import-attributes",
      // Must resolve bare/aliased specifiers (e.g. Deno import-map entries
      // like "design/broadsheet.css") before @deno/vite-plugin's resolveId
      // does: its resolution path round-trips through `fileURLToPath`, which
      // reads only the URL's pathname and silently drops our `?raw` /
      // `?__attributes=` query, so the raw-text marker never survives.
      enforce: "pre",
      async config() {
        await esModuleLexer.init;
      },
      async resolveId(id, importer) {
        const queryIndex = id.indexOf("?");
        if (queryIndex === -1) return;
        const base = id.slice(0, queryIndex);
        const query = id.slice(queryIndex);
        if (query !== "?raw" && !query.startsWith(`?${KEY}=`)) return;
        if (
          base.startsWith(".") || base.startsWith("/") || base.startsWith("\0")
        ) return;
        if (!filter(base)) return;

        const resolved = await this.resolve(base, importer, { skipSelf: true });
        if (!resolved || resolved.id.startsWith("\0")) return;
        return resolved.id + query;
      },
      transform(code, id) {
        if (!filter(id)) return;
        if (id.match(/\.css(?:\?|$)/)) return;
        if (!code.includes("with")) return;

        const transformed = transformImportAttributes(code);
        if (transformed) {
          return {
            code: transformed.toString(),
          };
        }
      },
    },
  ];
}

const KEY = "__attributes";

export function transformImportAttributes(
  code: string,
): MagicString | undefined {
  const parsed = esModuleLexer.parse(code);
  let output: MagicString | undefined;
  for (const importSpecifier of parsed[0]) {
    let { e: moduleEnd, se: statementEnd, a: attributeIndex } = importSpecifier;
    if (attributeIndex > -1) {
      // tweak end for dynamic import
      const isDynamicImport = code[statementEnd - 1] === ")";
      if (isDynamicImport) {
        moduleEnd--;
        statementEnd--;
      }
      let attributesCode = code.slice(attributeIndex, statementEnd);
      // For static imports, skip the "with" keyword; for dynamic imports, keep the full object
      if (!isDynamicImport && attributesCode.trimStart().startsWith("with ")) {
        attributesCode = attributesCode.replace(/^\s*with\s+/, "");
      }
      let attributes = evalValue(attributesCode);
      if (isDynamicImport) {
        attributes = attributes.with;
      }
      output ??= new MagicString(code);

      // Handle type: "text" specially — convert to ?raw
      if (attributes.type === "text") {
        output.appendLeft(moduleEnd, "?raw");
      } else {
        output.appendLeft(
          moduleEnd,
          "?" +
            new URLSearchParams({
              [KEY]: JSON.stringify(attributes),
            }),
        );
      }
      output.remove(moduleEnd + 1, statementEnd);
    }
  }
  return output;
}

export type ImportAttributesMeta = {
  rawId: string;
  attributes: Record<string, unknown>;
};

export function parseImportAttributes(id: string): ImportAttributesMeta {
  const { filename, query } = parseIdQuery(id);
  if (query[KEY]) {
    const attributes = JSON.parse(query[KEY]);
    delete query[KEY];
    const rawId = filename! + new URLSearchParams(query);
    return { rawId, attributes };
  }
  return { rawId: id, attributes: {} };
}

function parseIdQuery(id: string): {
  filename: string | undefined;
  query: Record<string, string>;
} {
  if (!id.includes("?")) return { filename: id, query: {} };
  const [filename, rawQuery] = id.split(`?`, 2) as [string, string];
  const query = Object.fromEntries(new URLSearchParams(rawQuery));
  return { filename, query };
}

// https://github.com/vitejs/vite/blob/ea9aed7ebcb7f4be542bd2a384cbcb5a1e7b31bd/packages/vite/src/node/utils.ts#L1469-L1475
// deno-lint-ignore no-explicit-any
function evalValue<T = any>(rawValue: string): T {
  const fn = new Function(`
    var console, exports, global, module, process, require
    return (\n${rawValue}\n)
  `);
  return fn();
}
