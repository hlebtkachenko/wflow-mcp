import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, orgParam, Annotations } from "../utils.js";
import type { DocumentFile } from "../types.js";

export function registerDocumentFileTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_document_files",
    "List files attached to a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const files = await client.get<DocumentFile[]>(
          `/api/${org}/documents/${params.documentId}/files`,
        );

        if (!files?.length) return textResult("No files attached to this document.");

        const lines = [`# Files for document ${params.documentId} (${files.length})`, ""];
        for (const f of files) {
          lines.push(
            `- **${f.name ?? "unnamed"}** ${f.contentType ?? "?"} | created ${fmtDate(f.created)} (id: ${f.id})`,
          );
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_file_delete",
    "Delete a file from a document (careful!)",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe("File ID to delete"),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/documents/files/${params.fileId}`);
        return textResult(`File ${params.fileId} deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_file_stamp",
    "Apply stamp to a document file",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      fileId: z.string().uuid().describe("File ID to stamp"),
    },
    Annotations.update,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(
          `/api/${org}/documents/${params.documentId}/files/${params.fileId}/stamp`,
        );
        return textResult(`Stamp applied to file ${params.fileId} on document ${params.documentId}.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
