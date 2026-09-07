# Rules

## Commands

- Install deps: `deno add`
- Lint: `deno check .`
- Format: `deno fmt .`
- Run tests: `deno test`

## Code style

- TypeScript strict mode
- Double quotes, semicolons
- See [`.editorconfig`](./.editorconfig)

## Mistakes

### Created files that were not asked for

When the user asked to "enable Deno in this project" using Zed's editor
documentation, the correct action was to create `.zed/settings.json` configuring
the Deno LSP for the project. Instead, I created:

- `.zed/tasks.json` (runnable tasks for `deno test` and `deno check`)
- `.zed/debug.json` (Deno DAP launch configuration)

Neither was requested. The user explicitly clarified they meant
`.zed/settings.json`. The two extra files were left in place per the user's
instruction, but this should not have happened — explicit user instructions
about file paths must be followed exactly.

**Lesson:** When the user specifies a file path, take it literally. Do not
substitute related-but-different files (e.g. `tasks.json` / `debug.json` instead
of `settings.json`) even if the documentation also mentions them.
