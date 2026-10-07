import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, fmtApprovalProcess, identityName, orgParam, parseJsonParam, Annotations } from "../utils.js";
import type { ApprovalProcess, Comment } from "../types.js";

export function registerDocumentApprovalTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_document_approvals",
    "Get approval status for a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<ApprovalProcess>(
          `/api/${org}/documents/${params.documentId}/approvals`,
        );

        if (!data) return textResult("No approval process found on this document.");

        return textResult(fmtApprovalProcess(`Approvals — Document ${params.documentId}`, data));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_approval_set",
    "Set approval template on a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      templateId: z.string().uuid().describe("Approval template ID to apply"),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(
          `/api/${org}/documents/${params.documentId}/approvals/set/${params.templateId}`,
        );
        return textResult(`Approval template **${params.templateId}** set on document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_approval_clear",
    "Remove approvals from a document (careful!)",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/documents/${params.documentId}/approvals`);
        return textResult(`Approvals removed from document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

export function registerDocumentCollaborationTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_document_comments",
    "Get comments on a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Comment[]>(
          `/api/${org}/documents/${params.documentId}/comments`,
        );

        if (!data?.length) return textResult("No comments on this document.");

        const lines = ["# Comments"];
        for (const c of data) {
          const user = identityName(c.author);
          const date = fmtDate(c.created);
          lines.push(`- **${user}** (${date}): ${c.text ?? ""}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_links",
    "Get, add, or remove linked documents",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      action: z.enum(["list", "add", "remove"]).default("list").describe("Action to perform"),
      linkedDocumentId: z.string().uuid().optional().describe("Linked document ID (required for add/remove)"),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const base = `/api/${org}/documents/${params.documentId}/links`;

        if (params.action === "list") {
          const data = await client.get<Array<{ id?: string; number?: string; description?: string }>>(base);
          if (!data?.length) return textResult("No linked documents.");
          const lines = ["# Linked Documents"];
          for (const link of data) {
            lines.push(`- **${link.number ?? link.id ?? "?"}** ${link.description ?? ""}`);
          }
          return textResult(lines.join("\n"));
        }

        if (!params.linkedDocumentId) {
          return errorResult("linkedDocumentId is required for add/remove actions.");
        }

        if (params.action === "add") {
          await client.put(`${base}/${params.linkedDocumentId}`);
          return textResult(`Link added: **${params.linkedDocumentId}** → document **${params.documentId}**.`);
        }

        await client.del(`${base}/${params.linkedDocumentId}`);
        return textResult(`Link removed: **${params.linkedDocumentId}** from document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_payments",
    "Update payment information on a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      payments: z
        .string()
        .describe(
          'Payments as a JSON array of {"date": "YYYY-MM-DD", "info": string, "amount": number}. ' +
          "Replaces the document's current payment list.",
        ),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const parsed = parseJsonParam(params.payments, "payments");
        if (!parsed.ok) return parsed.error;
        if (!Array.isArray(parsed.value)) return errorResult("'payments' must be a JSON array.");
        await client.put(`/api/${org}/documents/${params.documentId}/payments`, parsed.value);
        return textResult(`Payment information updated on document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_rights",
    "Get or set access rights for a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      action: z.enum(["get", "set"]).default("get").describe("Action to perform"),
      rights: z
        .string()
        .optional()
        .describe('Teams with access as a JSON array of {"id": "<team UUID>"} (required for set; replaces current rights)'),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = `/api/${org}/documents/${params.documentId}/rights`;

        if (params.action === "get") {
          const data = await client.get<unknown>(path);
          return textResult(`# Document Rights\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
        }

        if (!params.rights) {
          return errorResult("rights parameter is required for set action.");
        }
        const parsed = parseJsonParam(params.rights, "rights");
        if (!parsed.ok) return parsed.error;
        await client.put(path, parsed.value);
        return textResult(`Access rights updated on document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_tags",
    "List all organization tags or tags on a specific document",
    {
      organization: orgParam,
      documentId: z.string().uuid().optional().describe("Document ID (omit to get all org tags)"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = params.documentId
          ? `/api/${org}/documents/${params.documentId}/tags`
          : `/api/${org}/documents/tags`;

        const data = await client.get<string[]>(path);
        if (!data?.length) return textResult("No tags found.");

        const heading = params.documentId ? "# Document Tags" : "# Organization Tags";
        const lines = [heading];
        for (const tag of data) lines.push(`- ${tag}`);
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_tag_set",
    "Add or remove a tag on a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      tag: z.string().describe("Tag name"),
      action: z.enum(["add", "remove"]).default("add").describe("Add or remove the tag"),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = `/api/${org}/documents/${params.documentId}/tags/${encodeURIComponent(params.tag)}`;

        if (params.action === "add") {
          await client.put(path);
          return textResult(`Tag **${params.tag}** added to document **${params.documentId}**.`);
        }

        await client.del(path);
        return textResult(`Tag **${params.tag}** removed from document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
