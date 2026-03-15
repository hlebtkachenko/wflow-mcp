import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, orgParam } from "../utils.js";
import type { DocumentFile } from "../types.js";

export function registerDocumentFileTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_document_files",
    "List files attached to a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
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
    "wf_document_file_download",
    "Download a document file",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      fileId: z.string().uuid().optional().describe("Specific file ID to download"),
      main: z.boolean().optional().default(false).describe("Download the main file instead"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);

        if (!params.fileId && !params.main) {
          return errorResult("Provide either fileId or set main=true.");
        }

        const path = params.main
          ? `/api/${org}/documents/${params.documentId}/files/main/download`
          : `/api/${org}/documents/files/${params.fileId}/download`;

        return errorResult(
          `Binary file download from ${path} is not supported via MCP text protocol. ` +
          "Use the wflow web UI or a direct API call to download the actual file.",
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_file_upload",
    "Upload a file to a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        return errorResult(
          `Binary file upload to /api/${org}/documents/${params.documentId}/files/upload is not supported via MCP text protocol. ` +
          "Use the wflow web UI or a direct API call with multipart/form-data.",
        );
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
