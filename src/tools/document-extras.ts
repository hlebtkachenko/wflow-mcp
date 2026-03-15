import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, fmtUserName, orgParam } from "../utils.js";
import type { ApprovalProcess, Comment } from "../types.js";

export function registerDocumentApprovalTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_document_approvals",
    "Get approval status for a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<ApprovalProcess>(
          `/api/${org}/documents/${params.documentId}/approvals`,
        );

        if (!data) return textResult("No approval process found on this document.");

        const lines: string[] = [`# Approval Status`, `- **Status:** ${data.status ?? "unknown"}`];

        if (data.items?.length) {
          lines.push("", "## Steps");
          for (const item of data.items) {
            const users = item.users?.map(fmtUserName).join(", ") || "none";
            lines.push(`- **Step ${item.order ?? "?"}** — ${item.status ?? "pending"} (${users})`);
          }
        }

        return textResult(lines.join("\n"));
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
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<Comment[]>(
          `/api/${org}/documents/${params.documentId}/comments`,
        );

        if (!data?.length) return textResult("No comments on this document.");

        const lines = ["# Comments"];
        for (const c of data) {
          const user = fmtUserName(c.user);
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
      payments: z.string().describe("JSON string of payment data"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        let body: unknown;
        try {
          body = JSON.parse(params.payments);
        } catch {
          return errorResult("Invalid JSON in payments parameter.");
        }
        await client.put(`/api/${org}/documents/${params.documentId}/payments`, body);
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
      rights: z.string().optional().describe("JSON string of rights data (required for set)"),
    },
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
        let body: unknown;
        try {
          body = JSON.parse(params.rights);
        } catch {
          return errorResult("Invalid JSON in rights parameter.");
        }
        await client.put(path, body);
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
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = params.documentId
          ? `/api/${org}/documents/${params.documentId}/tags`
          : `/api/${org}/documents/tags`;

        const data = await client.get<Array<{ name?: string; id?: string }>>(path);
        if (!data?.length) return textResult("No tags found.");

        const heading = params.documentId ? "# Document Tags" : "# Organization Tags";
        const lines = [heading];
        for (const tag of data) {
          lines.push(`- ${tag.name ?? tag.id ?? "unnamed"}`);
        }
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
