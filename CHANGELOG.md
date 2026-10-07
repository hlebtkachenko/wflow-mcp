# Changelog

## 2.0.0 — 2026-10-07

Breaking:
- Remove `wf_document_comment_add` and `wf_document_comment_delete` (the API has no such endpoints)
- `wf_document_with_files` takes `files[]` (`fileName`, `contentBase64`, `contentType`), `typeId`, `invoiceType` and uploads multipart/form-data
- `wf_user_save` takes `login`, `hasFullAccess`, `roles`, `teams`, `documentTypes` (the API's UserUpdate)
- `wf_webhook_save` takes `actions` as an array of event names; `wf_document_type_save` `kind`/`invoiceType` are enums
- Node.js 22+

Fixes:
- `wf_users`, `wf_roles`, `wf_teams`, `wf_document_types`, `wf_approval_templates` no longer report "No ... found" for non-empty lists; they take `page`, `pageSize`, `search`
- `wf_documents_queue` lists the document IDs the queue returns; `wf_document_tags`, `wf_document_comments`, `wf_document_events`, `wf_my_organizations` show the fields the API returns
- `wf_storage_file_move` / `wf_storage_file_rename` send `folderId` / `name` as query params
- `wf_document_type_delete` calls the published path; `wf_document_metadata` set sends a JSON string
- Writes that time out are not retried; the tool reports an unknown outcome
- Write tools show the returned ID, or none on 204, instead of "ID: —"
- Explicit annotations; overwrite, remove and clear modes and `wf_api_raw` are destructive
- Describe JSON-string params; `wf_document_export` exposes `parameters` and `markAsExported`

Added:
- `id` on document type, approval template, webhook and property definition saves (update); `folderId` on restore; `typeId` on the export queue; `success`/`message` on task processed
- `WFLOW_API_URL`, `WFLOW_TOKEN_URL`
- node:test suite and `npm run check:contract` against the OpenAPI spec
- MCP SDK 1.32, zod 4, TypeScript 7

## 1.1.0 — 2026-03-15

- Add MCP tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Add `wf_document_comment_add` and `wf_document_comment_delete` tools
- Extract `parseJsonParam()` utility — consistent JSON error handling across all tools
- Redact sensitive fields in `wf_integration_api_client` response
- Remove binary upload/download stub tools (not usable via MCP text protocol)
- Fix inconsistent null checking in `wf_document_save`
- Remove dead retry code in HTTP client
- Add GitHub Actions CI workflow

## 1.0.0 — 2026-03-15

- Initial release
- 78 tools covering all wflow API endpoints
- OAuth2 client credentials authentication with token refresh lock
- Response caching with configurable TTL and size limit (500 entries)
- Retry with exponential backoff on 429 / timeouts
- Path injection prevention with org name validation
- Markdown-formatted output
