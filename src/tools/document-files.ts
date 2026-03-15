import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate } from "../utils.js";
import type { DocumentFile } from "../types.js";

const orgParam = z
  .string()
  .optional()
  .describe("Organization workspace name (uses default if omitted)");

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

        let path: string;
        if (params.main) {
          path = `/api/${org}/documents/${params.documentId}/files/main/download`;
        } else {
          path = `/api/${org}/documents/files/${params.fileId}/download`;
        }

        const result = await client.get<Record<string, unknown>>(path);

        return textResult(
          `# File download\n` +
          `Binary file content was returned from the API. ` +
          `Use the wflow web UI to download the actual file.\n\n` +
          `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
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
        await client.put(`/api/${org}/documents/${params.documentId}/files/upload`);
        return textResult(
          `File upload endpoint called for document ${params.documentId}.\n\n` +
          `Note: binary file upload requires multipart form data which is not supported via MCP text tools. ` +
          `Use the wflow web UI or a direct API call for actual file uploads.`,
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
