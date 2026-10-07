import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, orgParam, parseJsonParam, Annotations, savedText, pageParams, pageQuery, pageHeading } from "../utils.js";
import type {
  Collection,
  DocumentType,
  ApprovalsTemplate,
  WebHookRegistration,
} from "../types.js";

const KINDS = ["IncomingInvoice", "OutgoingInvoice", "ExpenditureCashSlip", "SupplierOrder", "CustomerOrder", "Other", "Contract", "IncomeCashReceipt"] as const;
export const INVOICE_TYPES = ["TaxInvoice", "CreditNote", "DebitNote", "Proforma", "TaxInvoicePayment"] as const;
const WEBHOOK_ACTIONS = [
  "All", "DocumentReadyToExtract", "DocumentReadyToExport", "DocumentUpdated", "DocumentApprovalProcessFinished",
  "RegisterUpdated", "DocumentDeleted", "DocumentReadyToReview", "DocumentCreated", "DocumentReviewed",
] as const;

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

export function registerDocumentTypeTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_document_types",
    "List available document types",
    {
      organization: orgParam,
      ...pageParams,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Collection<DocumentType>>(`/api/${org}/documents/types`, pageQuery(params));
        const list = data?.items ?? [];
        if (!list.length) return textResult("No document types found.");
        const lines = [pageHeading("Document Types", data, list.length)];
        for (const dt of list) {
          const parts = [`**${dt.name ?? "—"}**`];
          if (dt.kind) parts.push(`kind: ${dt.kind}`);
          if (dt.invoiceType) parts.push(`invoice: ${dt.invoiceType}`);
          if (dt.id) parts.push(`id \`${dt.id}\``);
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
      organization: orgParam,
      id: z.string().uuid().optional().describe("Document type ID (for update; omit to create)"),
      name: z.string().describe("Document type name"),
      kind: z.enum(KINDS).optional().describe("Document kind"),
      invoiceType: z.enum(INVOICE_TYPES).optional().describe("Invoice type"),
    },
    Annotations.upsert,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.id) body.id = params.id;
        if (params.kind) body.kind = params.kind;
        if (params.invoiceType) body.invoiceType = params.invoiceType;
        const result = await client.put<unknown>(`/api/${org}/documents/types`, body);
        return textResult(savedText("Document type saved.", result));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_type_delete",
    "Delete a document type (careful!)",
    {
      organization: orgParam,
      typeId: z.string().uuid().describe("Document type ID"),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        // The spec declares this route literally as /documents/types/typeid:guid with typeId as a
        // query parameter; it looks like an unexpanded route template ({typeId:guid}) on wflow's side,
        // but we send exactly what the published contract says.
        await client.del(`/api/${org}/documents/types/typeid:guid`, { typeId: params.typeId });
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
      organization: orgParam,
      ...pageParams,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Collection<ApprovalsTemplate>>(`/api/${org}/approvalstemplates`, pageQuery(params));
        const list = data?.items ?? [];
        if (!list.length) return textResult("No approval templates found.");
        const lines = [pageHeading("Approval Templates", data, list.length)];
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
      organization: orgParam,
      templateId: z.string().uuid().describe("Approval template ID"),
    },
    Annotations.read,
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
      organization: orgParam,
      id: z.string().uuid().optional().describe("Template ID (for update; omit to create)"),
      name: z.string().describe("Template name"),
      teams: z
        .string()
        .optional()
        .describe('Approval steps as a JSON array of {"teamId": "<team UUID>", "level": <step number, 1-based>}'),
    },
    Annotations.upsert,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { name: params.name };
        if (params.id) body.id = params.id;
        if (params.teams) {
          const parsed = parseJsonParam(params.teams, "teams");
          if (!parsed.ok) return parsed.error;
          body.teams = parsed.value;
        }
        const result = await client.put<unknown>(`/api/${org}/approvalstemplates`, body);
        return textResult(savedText("Approval template saved.", result));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_approval_template_delete",
    "Delete an approval template (careful!)",
    {
      organization: orgParam,
      templateId: z.string().uuid().describe("Approval template ID"),
    },
    Annotations.destroy,
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
      organization: orgParam,
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const list = await client.get<WebHookRegistration[]>(`/api/${org}/webhookregistrations`);
        if (!list?.length) return textResult("No webhooks found.");
        const lines = [`# Webhooks (${list.length})`];
        for (const wh of list) {
          const actions = wh.actions?.join(", ") || "none";
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
      organization: orgParam,
      id: z.string().uuid().optional().describe("Registration ID (for update; omit to create)"),
      webHookUri: z.string().url().describe("Webhook callback URL"),
      description: z.string().optional().describe("Webhook description"),
      actions: z.array(z.enum(WEBHOOK_ACTIONS)).optional().describe("Events that trigger the webhook"),
    },
    Annotations.upsert,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { webHookUri: params.webHookUri };
        if (params.id) body.id = params.id;
        if (params.description) body.description = params.description;
        if (params.actions) body.actions = params.actions;
        const result = await client.put<unknown>(`/api/${org}/webhookregistrations`, body);
        return textResult(savedText("Webhook saved.", result));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_webhook_delete",
    "Delete a webhook registration",
    {
      organization: orgParam,
      registrationId: z.string().uuid().describe("Webhook registration ID"),
    },
    Annotations.destroy,
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
      organization: orgParam,
    },
    Annotations.update,
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
      organization: orgParam,
    },
    Annotations.create,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const result = await client.post<Record<string, unknown>>(`/api/${org}/integrations/apiclient`);
        const safe = { ...result };
        for (const key of Object.keys(safe)) {
          if (/secret|password|token/i.test(key)) safe[key] = "***REDACTED***";
        }
        return textResult(
          `# New API Client\n\n**Warning:** Sensitive fields have been redacted. ` +
          `Use wflow web UI to view full credentials.\n\n\`\`\`json\n${JSON.stringify(safe, null, 2)}\n\`\`\``,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
