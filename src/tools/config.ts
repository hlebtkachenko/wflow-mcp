import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult } from "../utils.js";
import type {
  DocumentType,
  ApprovalsTemplate,
  WebHookRegistration,
} from "../types.js";

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

export function registerDocumentTypeTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_document_types",
    "List available document types",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<DocumentType[]>(`/api/${org}/documents/types`);
        if (!list?.length) return textResult("No document types found.");
        const lines = [`# Document Types (${list.length})`];
        for (const dt of list) {
          const parts = [`**${dt.name ?? "—"}**`];
          if (dt.kind) parts.push(`kind: ${dt.kind}`);
          if (dt.invoiceType) parts.push(`invoice: ${dt.invoiceType}`);
          lines.push(`- ${parts.join(" — ")}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_type_save",
    "Create or update a document type",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      name: z.string().describe("Document type name"),
      kind: z.string().optional().describe("Document kind"),
      invoiceType: z.string().optional().describe("Invoice type"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.kind) body.kind = params.kind;
        if (params.invoiceType) body.invoiceType = params.invoiceType;
        const result = await client.put<DocumentType>(`/api/${org}/documents/types`, body);
        return textResult(`Document type saved. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_type_delete",
    "Delete a document type (careful!)",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      typeId: z.string().uuid().describe("Document type ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/documents/types/${params.typeId}`);
        return textResult(`Document type \`${params.typeId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Approval templates
// ---------------------------------------------------------------------------

export function registerApprovalTemplateTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_approval_templates",
    "List approval templates",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<ApprovalsTemplate[]>(`/api/${org}/approvalstemplates`);
        if (!list?.length) return textResult("No approval templates found.");
        const lines = [`# Approval Templates (${list.length})`];
        for (const t of list) {
          const empty = t.isEmpty ? " (empty)" : "";
          lines.push(`- **${t.name ?? "—"}**${empty} — id \`${t.id}\``);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_approval_template_info",
    "Get approval template details",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      templateId: z.string().uuid().describe("Approval template ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Record<string, unknown>>(
          `/api/${org}/approvalstemplates/${params.templateId}`,
        );
        return textResult(
          `# Approval Template\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_approval_template_save",
    "Create or update an approval template",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      name: z.string().describe("Template name"),
      teams: z.string().optional().describe("Team configuration as JSON string"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { name: params.name };
        if (params.teams) body.teams = JSON.parse(params.teams);
        const result = await client.put<ApprovalsTemplate>(`/api/${org}/approvalstemplates`, body);
        return textResult(`Approval template saved. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_approval_template_delete",
    "Delete an approval template (careful!)",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      templateId: z.string().uuid().describe("Approval template ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/approvalstemplates/${params.templateId}`);
        return textResult(`Approval template \`${params.templateId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export function registerWebhookTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_webhooks",
    "List webhook registrations",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<WebHookRegistration[]>(`/api/${org}/webhookregistrations`);
        if (!list?.length) return textResult("No webhooks found.");
        const lines = [`# Webhooks (${list.length})`];
        for (const wh of list) {
          const actions = wh.actions?.map((a) => a.action).join(", ") ?? "none";
          lines.push(`- **${wh.webHookUri ?? "—"}** — ${wh.description ?? "no description"} [${actions}]`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_webhook_save",
    "Create or update a webhook registration",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      webHookUri: z.string().url().describe("Webhook callback URL"),
      description: z.string().optional().describe("Webhook description"),
      actions: z.string().optional().describe("JSON string array of action names"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { webHookUri: params.webHookUri };
        if (params.description) body.description = params.description;
        if (params.actions) {
          const parsed = JSON.parse(params.actions) as string[];
          body.actions = parsed.map((a) => ({ action: a }));
        }
        const result = await client.put<WebHookRegistration>(`/api/${org}/webhookregistrations`, body);
        return textResult(`Webhook saved. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_webhook_delete",
    "Delete a webhook registration",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      registrationId: z.string().uuid().describe("Webhook registration ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/webhookregistrations/${params.registrationId}`);
        return textResult(`Webhook \`${params.registrationId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export function registerIntegrationTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_integration_allow",
    "Allow integration access for the organization",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(`/api/${org}/integrations/allow`);
        return textResult("Integration access allowed.");
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_integration_api_client",
    "Create a new API client for integration",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const result = await client.post<Record<string, unknown>>(`/api/${org}/integrations/apiclient`);
        return textResult(
          `# New API Client\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
