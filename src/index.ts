import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WflowClient } from "./wflow-client.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

import { registerDocumentTools, registerDocumentQueueTools } from "./tools/documents.js";
import { registerDocumentFileTools } from "./tools/document-files.js";
import { registerDocumentApprovalTools, registerDocumentCollaborationTools } from "./tools/document-extras.js";
import { registerDocumentPropertyTools, registerFilePropertyTools } from "./tools/properties.js";
import { registerStorageFileTools, registerStorageFolderTools } from "./tools/storage.js";
import { registerRegisterTools } from "./tools/registers.js";
import { registerOrganizationTools, registerUserTools, registerRoleTeamTools } from "./tools/organization.js";
import { registerDocumentTypeTools, registerApprovalTemplateTools, registerWebhookTools, registerIntegrationTools } from "./tools/config.js";
import { registerApiTools } from "./tools/api.js";

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    process.stderr.write(`Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return val;
}

function env(name: string): string | undefined {
  return process.env[name] || undefined;
}

function optInt(name: string, fallback: number): number {
  const val = process.env[name];
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

const client = new WflowClient({
  clientId: required("WFLOW_CLIENT_ID"),
  clientSecret: required("WFLOW_CLIENT_SECRET"),
  organization: env("WFLOW_ORGANIZATION"),
  baseUrl: env("WFLOW_API_URL"),
  tokenUrl: env("WFLOW_TOKEN_URL"),
  cacheTtl: optInt("WFLOW_CACHE_TTL", 120),
  maxRetries: optInt("WFLOW_MAX_RETRIES", 3),
});

const server = new McpServer({ name: "wflow", version: pkg.version });

registerDocumentTools(server, client);
registerDocumentQueueTools(server, client);
registerDocumentFileTools(server, client);
registerDocumentApprovalTools(server, client);
registerDocumentCollaborationTools(server, client);
registerDocumentPropertyTools(server, client);
registerFilePropertyTools(server, client);
registerStorageFileTools(server, client);
registerStorageFolderTools(server, client);
registerRegisterTools(server, client);
registerOrganizationTools(server, client);
registerUserTools(server, client);
registerRoleTeamTools(server, client);
registerDocumentTypeTools(server, client);
registerApprovalTemplateTools(server, client);
registerWebhookTools(server, client);
registerIntegrationTools(server, client);
registerApiTools(server, client);

await server.connect(new StdioServerTransport());
