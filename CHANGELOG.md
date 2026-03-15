# Changelog

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
