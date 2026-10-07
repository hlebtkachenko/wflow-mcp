# wflow MCP Server

[![CI](https://github.com/hlebtkachenko/wflow-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/hlebtkachenko/wflow-mcp/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-7-blue)

MCP server for [wflow](https://www.wflow.com) — Czech accounting automation platform for document management, expense tracking, approvals, storage, and organizational workflows.

76 tools across 10 categories, checked against the official OpenAPI spec. OAuth2 client credentials authentication, response caching with configurable TTL, retries for rate limits and read timeouts, and actionable error messages.

## Requirements

- Node.js 22+
- wflow API credentials (OAuth2 client ID and secret) — request from [wflow support](https://www.wflow.com/kontakt) or create via the wflow admin panel

## Installation

```bash
git clone https://github.com/hlebtkachenko/wflow-mcp.git
cd wflow-mcp
npm ci
npm run build
```

## Docker

```bash
docker build -t wflow-mcp .
docker run -e WFLOW_CLIENT_ID=... -e WFLOW_CLIENT_SECRET=... -e WFLOW_ORGANIZATION=... wflow-mcp
```

## Configuration

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wflow": {
      "command": "node",
      "args": ["/absolute/path/to/wflow-mcp/dist/index.js"],
      "env": {
        "WFLOW_CLIENT_ID": "your-client-id",
        "WFLOW_CLIENT_SECRET": "your-client-secret",
        "WFLOW_ORGANIZATION": "your-org-name"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wflow": {
      "command": "node",
      "args": ["/absolute/path/to/wflow-mcp/dist/index.js"],
      "env": {
        "WFLOW_CLIENT_ID": "your-client-id",
        "WFLOW_CLIENT_SECRET": "your-client-secret",
        "WFLOW_ORGANIZATION": "your-org-name"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add wflow -- node /absolute/path/to/wflow-mcp/dist/index.js
```

Set environment variables before running:

```bash
export WFLOW_CLIENT_ID=your-client-id
export WFLOW_CLIENT_SECRET=your-client-secret
export WFLOW_ORGANIZATION=your-org-name
```

### Any MCP client (stdio)

```bash
WFLOW_CLIENT_ID=... WFLOW_CLIENT_SECRET=... WFLOW_ORGANIZATION=... node dist/index.js
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WFLOW_CLIENT_ID` | Yes | — | OAuth2 client ID |
| `WFLOW_CLIENT_SECRET` | Yes | — | OAuth2 client secret |
| `WFLOW_ORGANIZATION` | No | — | Default organization workspace name |
| `WFLOW_CACHE_TTL` | No | `120` | Cache TTL in seconds (0 to disable) |
| `WFLOW_MAX_RETRIES` | No | `3` | Max retries on 429, 401 (token refresh) and GET timeouts |
| `WFLOW_API_URL` | No | `https://api.wflow.com` | API base URL (tests point it at a fake server) |
| `WFLOW_TOKEN_URL` | No | `https://account.wflow.com/connect/token` | OAuth2 token endpoint |

## Tools

Annotations: read tools are `readOnlyHint`; tools that delete, overwrite a whole set (rights, register, properties, payments, metadata, approvals) or have a remove/clear mode are `destructiveHint`; `wf_api_raw` is destructive and `openWorldHint`.

File content is not transferred over MCP except for `wf_document_with_files`, which takes each file base64-encoded (`files[].contentBase64`) and uploads it as `multipart/form-data`.

### Documents (11 tools)

| Tool | Description |
|------|-------------|
| `wf_documents` | List documents with optional filtering and pagination |
| `wf_document` | Get detailed document by ID |
| `wf_document_save` | Create or update a document |
| `wf_document_delete` | Delete a document (careful!) |
| `wf_document_with_files` | Create a document from uploaded files (PDF, ISDOC, images); wflow extracts the data. Pass each file's content base64-encoded. |
| `wf_document_metadata` | Get or update document metadata |
| `wf_document_lock` | Lock or unlock a document |
| `wf_document_events` | Get document event history |
| `wf_document_export` | Export documents in specified format |
| `wf_documents_queue` | List IDs of documents ready for export or extraction (use wf_document for details) |
| `wf_document_task` | Create or mark document task as processed |

### Document Files (3 tools)

| Tool | Description |
|------|-------------|
| `wf_document_files` | List files attached to a document |
| `wf_document_file_delete` | Delete a file from a document (careful!) |
| `wf_document_file_stamp` | Apply stamp to a document file |

### Document Collaboration (9 tools)

| Tool | Description |
|------|-------------|
| `wf_document_approvals` | Get approval status for a document |
| `wf_document_approval_set` | Set approval template on a document |
| `wf_document_approval_clear` | Remove approvals from a document (careful!) |
| `wf_document_comments` | Get comments on a document |
| `wf_document_links` | Get, add, or remove linked documents |
| `wf_document_payments` | Update payment information on a document |
| `wf_document_rights` | Get or set access rights for a document |
| `wf_document_tags` | List all organization tags or tags on a specific document |
| `wf_document_tag_set` | Add or remove a tag on a document |

### Custom Properties (10 tools)

| Tool | Description |
|------|-------------|
| `wf_doc_property_definitions` | List custom property definitions for documents |
| `wf_doc_property_definition_save` | Create or update a document property definition |
| `wf_doc_property_definition_delete` | Delete a document property definition |
| `wf_document_properties` | Get or set custom properties on a document |
| `wf_document_property_delete` | Delete a custom property from a document |
| `wf_file_property_definitions` | List custom property definitions for storage files |
| `wf_file_property_definition_save` | Create or update a file property definition |
| `wf_file_property_definition_delete` | Delete a file property definition |
| `wf_file_properties` | Get or set custom properties on a storage file |
| `wf_file_property_delete` | Delete a custom property from a storage file |

### Storage Files (7 tools)

| Tool | Description |
|------|-------------|
| `wf_storage_files` | List storage files with filtering |
| `wf_storage_file` | Get storage file details by ID |
| `wf_storage_file_delete` | Delete a storage file (careful!) |
| `wf_storage_file_lock` | Lock or unlock a storage file |
| `wf_storage_file_move` | Move a storage file to another folder |
| `wf_storage_file_rename` | Rename a storage file |
| `wf_storage_file_restore` | Restore a deleted storage file |

### Storage Folders & Rights (5 tools)

| Tool | Description |
|------|-------------|
| `wf_storage_folders` | List folder children or get folder by ID |
| `wf_storage_folder_create` | Create a new storage folder |
| `wf_storage_folder_delete` | Delete a storage folder (careful!) |
| `wf_storage_file_approvals` | Get, set, or clear approvals on a storage file |
| `wf_storage_rights` | Get or set access rights for a storage file or folder |

### Registers (3 tools)

| Tool | Description |
|------|-------------|
| `wf_registers` | List register items by type (partners, employees, chart of accounts, etc.) |
| `wf_register_save` | Create or replace register items (full replacement) |
| `wf_register_update` | Partially update register items |

Supported register types: `accountingrules`, `activities`, `businesscases`, `businessitemcategories`, `businessitems`, `carddocumenttypes`, `cashdocumenttypes`, `cashregisters`, `chartofaccounts`, `contracts`, `costcenters`, `employees`, `locations`, `measureunits`, `organizationpersons`, `partnerpersons`, `partners`, `paymentmethods`, `projects`, `series`, `vatcontrolstatementlines`, `vatreturnlines`, `vatreversechargecodes`, `vehicles`.

### Organization & Access (15 tools)

| Tool | Description |
|------|-------------|
| `wf_organization` | Get organization details |
| `wf_my_organizations` | List organizations available to the current user |
| `wf_account` | Get current account information |
| `wf_users` | List users in the organization |
| `wf_user_info` | Get user details by ID |
| `wf_user_save` | Add a user to the organization or update an existing one, matched by login (e-mail). roles, teams and documentTypes replace the user's current assignments when given. |
| `wf_user_delete` | Remove a user from the organization (careful!) |
| `wf_roles` | List all roles in the organization |
| `wf_role_create` | Create a new role |
| `wf_role_update` | Update an existing role |
| `wf_role_delete` | Delete a role (careful!) |
| `wf_teams` | List all teams in the organization |
| `wf_team_create` | Create a new team |
| `wf_team_update` | Update an existing team |
| `wf_team_delete` | Delete a team (careful!) |

### Configuration (12 tools)

| Tool | Description |
|------|-------------|
| `wf_document_types` | List available document types |
| `wf_document_type_save` | Create or update a document type |
| `wf_document_type_delete` | Delete a document type (careful!) |
| `wf_approval_templates` | List approval templates |
| `wf_approval_template_info` | Get approval template details |
| `wf_approval_template_save` | Create or update an approval template |
| `wf_approval_template_delete` | Delete an approval template (careful!) |
| `wf_webhooks` | List webhook registrations |
| `wf_webhook_save` | Create or update a webhook registration |
| `wf_webhook_delete` | Delete a webhook registration |
| `wf_integration_allow` | Allow integration access for the organization |
| `wf_integration_api_client` | Create a new API client for integration |

### Raw API (1 tool)

| Tool | Description |
|------|-------------|
| `wf_api_raw` | Call any wflow API endpoint directly |

## Response Caching

GET responses are cached in-memory with a configurable TTL (default 120 seconds). Mutations (PUT, POST, PATCH, DELETE) automatically invalidate related cache entries. Set `WFLOW_CACHE_TTL=0` to disable caching.

## Retries

When the API returns HTTP 429, the server waits using the `Retry-After` header value or exponential backoff, then retries up to `WFLOW_MAX_RETRIES` times. A GET that times out is retried the same way. A write (POST, PUT, PATCH, DELETE) that times out is never repeated: the tool returns an "outcome unknown" error so the state can be checked with a read tool first.

## Security

- OAuth2 tokens are refreshed automatically and never logged
- API credentials are read from environment variables only — never stored on disk
- API paths containing `..` or `#` are rejected; organization names must match `[A-Za-z0-9_-]+`; IDs are validated as UUIDs
- `wf_integration_api_client` redacts the returned client secret
- Error details are truncated to 500 characters
- Zod validates every tool parameter before API calls
- Docker image runs as non-root `node` user
- 30-second timeout on all HTTP requests

## Development

```bash
npm ci
npm test                # build + node:test suite against a fake wflow API
npm run check:contract  # validate every tool's request against the OpenAPI spec
```

Layout and design: [ARCHITECTURE.md](ARCHITECTURE.md). Rules for contributors and agents: [AGENTS.md](AGENTS.md).

## Tech Stack

- TypeScript 7 with strict mode
- Node.js 22+ (ESM, native `fetch` and `FormData`)
- MCP SDK `@modelcontextprotocol/sdk`
- Zod for parameter validation
- OAuth2 client credentials flow

## API Reference

- [wflow API Documentation](https://developers.wflow.com)
- [wflow Swagger UI](https://api.wflow.com/index.html)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

## License

[MIT](LICENSE)
