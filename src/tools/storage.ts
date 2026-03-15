import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, fmtUserName, orgParam, parseJsonParam, Annotations } from "../utils.js";
import type {
  StorageFile,
  StorageFileCollection,
  StorageFolder,
  ApprovalProcess,
} from "../types.js";

const uuidDesc = (what: string) => `UUID of the ${what}`;

export function registerStorageFileTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_storage_files",
    "List storage files with filtering",
    {
      organization: orgParam,
      query: z.string().optional().describe("Search query to filter files"),
      page: z.number().int().default(1).describe("Page number"),
      pageSize: z.number().int().default(20).describe("Items per page"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const q: Record<string, string> = {
          page: String(params.page),
          pageSize: String(params.pageSize),
        };
        if (params.query) q.query = params.query;

        const data = await client.get<StorageFileCollection>(`/api/${org}/storage/files`, q);
        const items = data.items ?? [];

        if (items.length === 0) return textResult("No storage files found.");

        const lines = items.map((f) => {
          const parts = [
            `- **${f.name ?? "Unnamed"}**`,
            f.description ? `  Description: ${f.description}` : null,
            f.contentType ? `  Type: ${f.contentType}` : null,
            f.size != null ? `  Size: ${f.size} B` : null,
            `  Locked: ${f.locked ? "Yes" : "No"}`,
            f.created ? `  Created: ${fmtDate(f.created)}` : null,
            f.folder?.fullPath ? `  Folder: ${f.folder.fullPath}` : null,
            `  ID: ${f.id}`,
          ];
          return parts.filter(Boolean).join("\n");
        });

        return textResult(
          `# Storage Files (page ${data.page ?? params.page}/${data.totalPages ?? "?"}, total ${data.totalItems ?? "?"})\n\n${lines.join("\n\n")}`,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file",
    "Get storage file details by ID",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("storage file")),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const f = await client.get<StorageFile>(`/api/${org}/storage/files/${params.fileId}`);

        const lines = [
          `# ${f.name ?? "Unnamed File"}`,
          "",
          `- **ID** ${f.id}`,
          f.description ? `- **Description** ${f.description}` : null,
          f.contentType ? `- **Content Type** ${f.contentType}` : null,
          f.size != null ? `- **Size** ${f.size} B` : null,
          `- **Locked** ${f.locked ? "Yes" : "No"}`,
          f.created ? `- **Created** ${fmtDate(f.created)}` : null,
          f.updated ? `- **Updated** ${fmtDate(f.updated)}` : null,
          f.removed ? `- **Removed** ${fmtDate(f.removed)}` : null,
          f.approvalStatus?.name ? `- **Approval** ${f.approvalStatus.name}` : null,
          f.folder?.fullPath ? `- **Folder** ${f.folder.fullPath}` : null,
          f.folder?.id ? `- **Folder ID** ${f.folder.id}` : null,
        ];

        return textResult(lines.filter(Boolean).join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file_delete",
    "Delete a storage file (careful!)",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("file to delete")),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/storage/files/${params.fileId}`);
        return textResult(`File \`${params.fileId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file_lock",
    "Lock or unlock a storage file",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("file")),
      lock: z.boolean().describe("true to lock, false to unlock"),
    },
    Annotations.write,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(`/api/${org}/storage/files/${params.fileId}/lock/${params.lock}`);
        return textResult(`File \`${params.fileId}\` ${params.lock ? "locked" : "unlocked"}.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file_move",
    "Move a storage file to another folder",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("file to move")),
      folderId: z.string().uuid().describe(uuidDesc("target folder")),
    },
    Annotations.write,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(`/api/${org}/storage/files/${params.fileId}/move`, {
          folderId: params.folderId,
        });
        return textResult(`File \`${params.fileId}\` moved to folder \`${params.folderId}\`.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file_rename",
    "Rename a storage file",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("file to rename")),
      name: z.string().describe("New file name"),
    },
    Annotations.write,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(`/api/${org}/storage/files/${params.fileId}/rename`, {
          name: params.name,
        });
        return textResult(`File \`${params.fileId}\` renamed to **${params.name}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file_restore",
    "Restore a deleted storage file",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("file to restore")),
    },
    Annotations.write,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(`/api/${org}/storage/files/${params.fileId}/restore`);
        return textResult(`File \`${params.fileId}\` restored.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

export function registerStorageFolderTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_storage_folders",
    "List folder children or get folder by ID",
    {
      organization: orgParam,
      folderId: z.string().uuid().optional().describe("Folder UUID (omit for root children)"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);

        if (params.folderId) {
          const folder = await client.get<StorageFolder>(
            `/api/${org}/storage/folders/${params.folderId}`,
          );
          const lines = [
            `# Folder: ${folder.name ?? "Unnamed"}`,
            "",
            `- **ID** ${folder.id}`,
            folder.fullPath ? `- **Path** ${folder.fullPath}` : null,
            folder.parentId ? `- **Parent ID** ${folder.parentId}` : null,
            `- **Has Children** ${folder.hasChildren ? "Yes" : "No"}`,
          ];
          return textResult(lines.filter(Boolean).join("\n"));
        }

        const folders = await client.get<StorageFolder[]>(
          `/api/${org}/storage/folders/children`,
        );

        if (!folders || folders.length === 0) return textResult("No root folders found.");

        const lines = folders.map((f) => {
          const parts = [
            `- **${f.name ?? "Unnamed"}**`,
            f.fullPath ? `  Path: ${f.fullPath}` : null,
            `  Has Children: ${f.hasChildren ? "Yes" : "No"}`,
            f.id ? `  ID: ${f.id}` : null,
          ];
          return parts.filter(Boolean).join("\n");
        });

        return textResult(`# Root Folders\n\n${lines.join("\n\n")}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_folder_create",
    "Create a new storage folder",
    {
      organization: orgParam,
      name: z.string().describe("Folder name"),
      parentId: z.string().uuid().optional().describe("Parent folder UUID (omit for root)"),
    },
    Annotations.create,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, string> = { name: params.name };
        if (params.parentId) body.parentId = params.parentId;

        const folder = await client.put<StorageFolder>(`/api/${org}/storage/folders`, body);

        if (folder?.id) {
          return textResult(`Folder **${params.name}** created (ID: \`${folder.id}\`).`);
        }
        return textResult(`Folder **${params.name}** created.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_folder_delete",
    "Delete a storage folder (careful!)",
    {
      organization: orgParam,
      folderId: z.string().uuid().describe(uuidDesc("folder to delete")),
    },
    Annotations.destroy,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/storage/folders/${params.folderId}`);
        return textResult(`Folder \`${params.folderId}\` deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_file_approvals",
    "Get, set, or clear approvals on a storage file",
    {
      organization: orgParam,
      fileId: z.string().uuid().describe(uuidDesc("storage file")),
      action: z.enum(["get", "set", "clear"]).default("get").describe("Action: get/set/clear approvals"),
      templateId: z.string().uuid().optional().describe("Approval template UUID (required for 'set')"),
    },
    Annotations.write,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const base = `/api/${org}/storage/files/${params.fileId}/approvals`;

        if (params.action === "set") {
          if (!params.templateId) {
            return errorResult("templateId is required when action is 'set'.");
          }
          await client.put(`${base}/set/${params.templateId}`);
          return textResult(`Approval template \`${params.templateId}\` set on file \`${params.fileId}\`.`);
        }

        if (params.action === "clear") {
          await client.del(base);
          return textResult(`Approvals cleared on file \`${params.fileId}\`.`);
        }

        const data = await client.get<ApprovalProcess>(base);
        if (!data) return textResult("No approval process found on this file.");

        const lines = [`# Approvals — File \`${params.fileId}\``, ""];
        if (data.status) lines.push(`- **Status** ${data.status}`);

        if (data.items && data.items.length > 0) {
          lines.push("");
          for (const item of data.items) {
            const users = item.users?.map(fmtUserName).join(", ");
            lines.push(`- **Step ${item.order ?? "?"}** ${item.status ?? "unknown"} — ${users ?? "no users"}`);
          }
        }

        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_storage_rights",
    "Get or set access rights for a storage file or folder",
    {
      organization: orgParam,
      type: z.enum(["file", "folder"]).describe("Target type: file or folder"),
      id: z.string().uuid().describe("UUID of the file or folder"),
      action: z.enum(["get", "set"]).default("get").describe("Action: get or set rights"),
      rights: z.string().optional().describe("JSON string of rights array (required for 'set')"),
    },
    Annotations.write,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const segment = params.type === "file" ? "files" : "folders";
        const path = `/api/${org}/storage/${segment}/${params.id}/rights`;

        if (params.action === "set") {
          if (!params.rights) {
            return errorResult("rights JSON string is required when action is 'set'.");
          }
          const parsed = parseJsonParam(params.rights, "rights");
          if (!parsed.ok) return parsed.error;
          await client.put(path, parsed.value);
          return textResult(`Rights updated on ${params.type} \`${params.id}\`.`);
        }

        const data = await client.get<unknown[]>(path);
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return textResult(`No access rights defined on ${params.type} \`${params.id}\`.`);
        }
        return textResult(
          `# Access Rights — ${params.type} \`${params.id}\`\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
