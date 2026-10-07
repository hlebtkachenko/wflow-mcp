# AGENTS.md

MCP server for the wflow REST API (documents, storage, approvals, registers, organization). TypeScript, Node 22+, stdio transport. Layout and design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Commands

```bash
npm ci
npm run build           # tsc -> dist/
npm test                # build + node:test suite (fake wflow API, no credentials)
npm run check:contract  # validate every tool's request against the OpenAPI spec
```

## Rules

- Any change to a request a tool sends must pass `npm run check:contract`. Look up paths, query params and body schemas in the spec (`.spec-cache/swagger.json` after the first run, source https://api.wflow.com/swagger/v1/swagger.json), not in memory. Response shapes are there too (`*Collection` objects carry `items`).
- New tools: register in `src/index.ts`, add a request case to `test/server.test.mjs` (the suite fails for a tool without one), list it in the README tools table with the right section count.
- Annotations come from `Annotations` in `src/utils.ts`: anything that deletes, overwrites a whole set or has a remove/clear mode is `replace` or `destroy`.
- Writes are never retried on timeout; keep it that way (`src/wflow-client.ts`).
- Synthetic data only in tests and docs: no real company names, IČO, logins or documents. Use `12345678` as a placeholder IČO and `example.com` addresses.
- Never commit credentials; configuration is env-only (README lists the variables).
- No live API calls in tests or scripts.
