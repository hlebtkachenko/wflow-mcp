# Architecture

## Structure

```
src/
  index.ts              Entry point: env config, tool registration, stdio transport
  wflow-client.ts       HTTP client: OAuth2 client credentials, JSON and multipart bodies, retries, GET cache
  cache.ts              TTL in-memory response cache (500 entries)
  utils.ts              Tool result helpers, annotations, paging params, ID extraction
  types.ts              Response shapes used for formatting
  tools/                One file per area; each registers its MCP tools
test/
  fake-wflow.mjs        Fake wflow API and OAuth endpoint, starts dist/ over stdio, records requests
  server.test.mjs       node:test suite: exact request per tool, regression tests
scripts/check-contract.mjs  Validates every tool's request against the OpenAPI spec
```

## Flow

```
MCP client --stdio--> tool handler --> WflowClient.request --HTTPS + Bearer--> api.wflow.com/api/{organization}/...
                           ^                                                         |
                           +------------- JSON (or empty on 204) <-------------------+
```

## Design notes

- **Spec is the contract.** `npm run check:contract` calls every tool in every mode (all fields, required fields only), captures the request at a fake server and checks path + method, declared query params, the JSON body against the requestBody schema (Ajv, `additionalProperties: false` enforced) and multipart field names.
- **Responses**: list endpoints for users, roles, teams, document types and approval templates return `{items, totalItems, page, pageSize}`; the export/extract queues return plain arrays of document IDs; write endpoints return the new ID as a JSON string or nothing (204). `idOf`/`savedText` in `utils.ts` handle all three.
- **Errors**: any non-2xx becomes a tool error (`isError`) with the ProblemDetails `detail`/`title` and a recovery hint.
- **Retries**: 429 (honours `Retry-After`) and 401 (credential refresh) are retried for every method; timeouts only for GET. A write that times out returns "outcome unknown" instead of being repeated.
- **Uploads**: `wf_document_with_files` decodes base64 file content and posts `multipart/form-data` (`uploadedFiles`). Other upload/download endpoints are not exposed.
- **Spec oddity**: document type delete is published as `DELETE /documents/types/typeid:guid?typeId=`; the tool sends exactly that.
- **Not in the API**: adding or deleting document comments.
