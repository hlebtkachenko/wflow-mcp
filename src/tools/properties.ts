import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult } from "../utils.js";
import type { PropertyDefinition, Property } from "../types.js";

function fmtDefinition(d: PropertyDefinition): string {
  const flags: string[] = [];
  if (d.show) flags.push("visible");
  if (d.editable) flags.push("editable");
  const meta = flags.length ? ` (${flags.join(", ")})` : "";
  return `- **${d.name ?? "unnamed"}** — type: ${d.type ?? "?"}, order: ${d.order ?? "?"}${meta}`;
}

function fmtProperty(p: Property): string {
  return `- **${p.name ?? p.definitionId ?? "?"}** = ${p.value ?? ""}`;
}

export function registerDocumentPropertyTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_doc_property_definitions",
    "List custom property definitions for documents",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<PropertyDefinition[]>(
          `/api/${org}/documents/properties/definitions`,
        );

        if (!data?.length) return textResult("No document property definitions found.");

        const lines = ["# Document Property Definitions"];
        for (const d of data) lines.push(fmtDefinition(d));
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_doc_property_definition_save",
    "Create or update a document property definition",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      name: z.string().describe("Property name"),
      type: z.string().describe("Property type (e.g. text, number, date, select)"),
      order: z.number().int().optional().describe("Display order"),
      show: z.boolean().optional().describe("Whether to show the property"),
      editable: z.boolean().optional().describe("Whether the property is editable"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { name: params.name, type: params.type };
        if (params.order != null) body.order = params.order;
        if (params.show != null) body.show = params.show;
        if (params.editable != null) body.editable = params.editable;

        await client.put(`/api/${org}/documents/properties/definition`, body);
        return textResult(`Document property definition **${params.name}** saved.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_doc_property_definition_delete",
    "Delete a document property definition",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      definitionId: z.string().describe("Property definition ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/documents/properties/definition/${params.definitionId}`);
        return textResult(`Document property definition **${params.definitionId}** deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_properties",
    "Get or set custom properties on a document",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      documentId: z.string().uuid().describe("Document ID"),
      action: z.enum(["get", "set"]).default("get").describe("Action to perform"),
      properties: z.string().optional().describe("JSON string array of {definitionId, value} (required for set)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = `/api/${org}/documents/${params.documentId}/properties`;

        if (params.action === "get") {
          const data = await client.get<Property[]>(path);
          if (!data?.length) return textResult("No custom properties on this document.");
          const lines = ["# Document Properties"];
          for (const p of data) lines.push(fmtProperty(p));
          return textResult(lines.join("\n"));
        }

        if (!params.properties) {
          return errorResult("properties parameter is required for set action.");
        }
        let body: unknown;
        try {
          body = JSON.parse(params.properties);
        } catch {
          return errorResult("Invalid JSON in properties parameter.");
        }
        await client.put(path, body);
        return textResult(`Custom properties updated on document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_property_delete",
    "Delete a custom property from a document",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      documentId: z.string().uuid().describe("Document ID"),
      propertyId: z.string().describe("Property ID to delete"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(
          `/api/${org}/documents/${params.documentId}/properties/${params.propertyId}`,
        );
        return textResult(`Property **${params.propertyId}** deleted from document **${params.documentId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

export function registerFilePropertyTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_file_property_definitions",
    "List custom property definitions for storage files",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const data = await client.get<PropertyDefinition[]>(
          `/api/${org}/storage/files/properties/definitions`,
        );

        if (!data?.length) return textResult("No file property definitions found.");

        const lines = ["# File Property Definitions"];
        for (const d of data) lines.push(fmtDefinition(d));
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_file_property_definition_save",
    "Create or update a file property definition",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      name: z.string().describe("Property name"),
      type: z.string().describe("Property type (e.g. text, number, date, select)"),
      order: z.number().int().optional().describe("Display order"),
      show: z.boolean().optional().describe("Whether to show the property"),
      editable: z.boolean().optional().describe("Whether the property is editable"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const body: Record<string, unknown> = { name: params.name, type: params.type };
        if (params.order != null) body.order = params.order;
        if (params.show != null) body.show = params.show;
        if (params.editable != null) body.editable = params.editable;

        await client.put(`/api/${org}/storage/files/properties/definition`, body);
        return textResult(`File property definition **${params.name}** saved.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_file_property_definition_delete",
    "Delete a file property definition",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      definitionId: z.string().describe("Property definition ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/storage/files/properties/definition/${params.definitionId}`);
        return textResult(`File property definition **${params.definitionId}** deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_file_properties",
    "Get or set custom properties on a storage file",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      fileId: z.string().uuid().describe("Storage file ID"),
      action: z.enum(["get", "set"]).default("get").describe("Action to perform"),
      properties: z.string().optional().describe("JSON string array of {definitionId, value} (required for set)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = `/api/${org}/storage/files/${params.fileId}/properties`;

        if (params.action === "get") {
          const data = await client.get<Property[]>(path);
          if (!data?.length) return textResult("No custom properties on this file.");
          const lines = ["# File Properties"];
          for (const p of data) lines.push(fmtProperty(p));
          return textResult(lines.join("\n"));
        }

        if (!params.properties) {
          return errorResult("properties parameter is required for set action.");
        }
        let body: unknown;
        try {
          body = JSON.parse(params.properties);
        } catch {
          return errorResult("Invalid JSON in properties parameter.");
        }
        await client.put(path, body);
        return textResult(`Custom properties updated on file **${params.fileId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_file_property_delete",
    "Delete a custom property from a storage file",
    {
      organization: z.string().optional().describe("Organization workspace name (uses default if omitted)"),
      fileId: z.string().uuid().describe("Storage file ID"),
      propertyId: z.string().describe("Property ID to delete"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(
          `/api/${org}/storage/files/${params.fileId}/properties/${params.propertyId}`,
        );
        return textResult(`Property **${params.propertyId}** deleted from file **${params.fileId}**.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
