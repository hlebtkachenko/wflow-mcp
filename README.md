# wflow MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

MCP server for [wflow](https://www.wflow.com) — Czech accounting automation platform for document management, expense tracking, approvals, storage, and organizational workflows.

80 tools across 10 categories covering the entire wflow API. OAuth2 client credentials authentication, response caching with configurable TTL, retry with exponential backoff, and actionable error messages.

## Requirements

- Node.js 20+
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
| `WFLOW_MAX_RETRIES` | No | `3` | Max retries on 429 / timeout |

## Tools

### Documents (11 tools)

| Tool | Description |
|------|-------------|
| `wf_documents` | List documents with optional filtering and pagination |
| `wf_document` | Get detailed document by ID |
| `wf_document_save` | Create or update a document |
| `wf_document_delete` | Delete a document (careful!) |
| `wf_document_with_files` | Create a document with attached files |
| `wf_document_metadata` | Get or update document metadata |
| `wf_document_lock` | Lock or unlock a document |
| `wf_document_events` | Get document event history |
| `wf_document_export` | Export documents in specified format |
| `wf_documents_queue` | List documents ready for export or extraction |
| `wf_document_task` | Create or mark document task as processed |

### Document Files (5 tools)

| Tool | Description |
|------|-------------|
| `wf_document_files` | List files attached to a document |
| `wf_document_file_download` | Download a document file |
| `wf_document_file_upload` | Upload a file to a document |
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
| `wf_document_tags` | List tags (organization-level or per document) |
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

### Storage Files (9 tools)

| Tool | Description |
|------|-------------|
| `wf_storage_files` | List storage files with filtering |
| `wf_storage_file` | Get storage file details by ID |
| `wf_storage_file_upload` | Upload a file to storage |
| `wf_storage_file_download` | Download a storage file |
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
| `wf_storage_rights` | Get or set access rights for a file or folder |

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
| `wf_user_save` | Create or update a user |
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

## Rate Limit Handling

When the API returns HTTP 429, the server waits using the `Retry-After` header value or exponential backoff, then retries automatically up to `WFLOW_MAX_RETRIES` times.

## Security

- OAuth2 tokens are refreshed automatically and never logged
- API credentials are read from environment variables only — never stored on disk
- All API paths are validated against injection patterns (`..`, `#`)
- Error messages are truncated to 500 characters to prevent data leaks
- Zod validates every tool parameter before API calls
- Docker image runs as non-root `node` user
- 30-second timeout on all HTTP requests

## Architecture

```
src/
  index.ts              — Entry point, env vars, server setup
  wflow-client.ts       — HTTP client with OAuth2, retry, caching
  cache.ts              — TTL-based in-memory response cache
  utils.ts              — textResult / errorResult MCP helpers
  types.ts              — Shared TypeScript interfaces
  tools/
    documents.ts        — Document CRUD and lifecycle (11 tools)
    document-files.ts   — Document file operations (5 tools)
    document-extras.ts  — Approvals, comments, links, rights (9 tools)
    properties.ts       — Custom property definitions and values (10 tools)
    storage.ts          — Storage files, folders, rights (14 tools)
    registers.ts        — All 24 register types (3 tools)
    organization.ts     — Org, users, roles, teams (15 tools)
    config.ts           — Doc types, approval templates, webhooks (12 tools)
    api.ts              — Raw API escape hatch (1 tool)
```

## Tech Stack

- TypeScript 5 with strict mode
- Node.js 22 (ESM, native `fetch`)
- MCP SDK `@modelcontextprotocol/sdk`
- Zod for parameter validation
- OAuth2 client credentials flow

## API Reference

- [wflow API Documentation](https://developers.wflow.com)
- [wflow Swagger UI](https://api.wflow.com/index.html)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

## License

[MIT](LICENSE)
