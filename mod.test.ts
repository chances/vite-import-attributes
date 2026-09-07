import { assertEquals } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { fromFileUrl, join } from "@std/path";
import * as esModuleLexer from "es-module-lexer";
// deno-lint-ignore no-import-prefix no-unversioned-import
import * as vite from "npm:vite";

import vitePluginImportAttributes, {
  transformImportAttributes,
} from "./mod.ts";

const __dirname = fromFileUrl(new URL(".", import.meta.url));

beforeAll(async () => {
  await esModuleLexer.init;
});

describe("transformImportAttributes", () => {
  it("type text", () => {
    const input = `import css from "./style.css" with { type: "text" };`;
    assertEquals(
      transformImportAttributes(input)?.toString(),
      `import css from "./style.css?raw";`,
    );
  });

  it("type css", () => {
    const input = `import css from "./style.scss" with { type: "css" };`;
    assertEquals(
      transformImportAttributes(input)?.toString(),
      `import css from "./style.scss?inline";`,
    );
  });

  it("other attributes", () => {
    const input =
      `import { Counter } from "./counter" with { island: "client-only" };`;
    assertEquals(
      transformImportAttributes(input)?.toString(),
      `import { Counter } from "./counter?__attributes=%7B%22island%22%3A%22client-only%22%7D";`,
    );
  });

  it("dynamic import", () => {
    const input = `import("./counter", { with: { island: "client-only" } });`;
    assertEquals(
      transformImportAttributes(input)?.toString(),
      `import("./counter?__attributes=%7B%22island%22%3A%22client-only%22%7D");`,
    );
  });
});

describe("e2e", () => {
  const config: vite.InlineConfig = {
    root: join(__dirname, "./fixtures"),
    configFile: false,
    plugins: [vitePluginImportAttributes()],
  };

  it("dev", async () => {
    const server = await vite.createServer(config);
    try {
      const mod = await server.ssrLoadModule("/entry.ts");
      assertEquals(typeof mod.default, "string");
      assertEquals(mod.default.includes("color: blue"), true);
    } finally {
      await server.close();
    }
  });

  it("resolves bare/aliased specifiers without losing the query", async () => {
    // Simulates a resolver (like @deno/vite-plugin's resolveId, which
    // round-trips a resolved import-map entry through `fileURLToPath`) that
    // resolves a bare specifier to a plain file path with no query string.
    // vitePluginImportAttributes() must resolve the specifier itself first
    // (via its "pre" resolveId hook) so the "?raw" marker it appended isn't
    // dropped before this plugin ever sees the id.
    const server = await vite.createServer({
      root: join(__dirname, "./fixtures"),
      configFile: false,
      plugins: [
        vitePluginImportAttributes(),
        {
          name: "query-dropping-resolver",
          resolveId(id) {
            if (id.startsWith("styles/")) {
              return join(__dirname, "./fixtures/main.css");
            }
          },
        },
      ],
    });
    try {
      const mod = await server.ssrLoadModule("/entry-aliased.ts");
      assertEquals(typeof mod.default, "string");
      assertEquals(mod.default.includes("color: blue"), true);
    } finally {
      await server.close();
    }
  });
});
