import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, orgParam, parseJsonParam, Annotations } from "../utils.js";
import type { Register } from "../types.js";

const REGISTER_TYPES = [
  "accountingrules",
  "activities",
  "businesscases",
  "businessitemcategories",
  "businessitems",
  "carddocumenttypes",
  "cashdocumenttypes",
  "cashregisters",
  "chartofaccounts",
  "contracts",
  "costcenters",
  "employees",
  "locations",
  "measureunits",
  "organizationpersons",
  "partnerpersons",
  "partners",
  "paymentmethods",
  "projects",
  "series",
  "vatcontrolstatementlines",
  "vatreturnlines",
  "vatreversechargecodes",
  "vehicles",
] as const;

const registerTypeSchema = z.enum(REGISTER_TYPES).describe("Register type");

export function registerRegisterTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_registers",
    "List register items by type (partners, employees, chart of accounts, etc.)",
    {
      organization: orgParam,
      registerType: registerTypeSchema,
      query: z.string().optional().describe("Filter query string"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const q: Record<string, string> = {};
        if (params.query) q.query = params.query;

        const items = await client.get<Register[]>(
          `/api/${org}/registers/${params.registerType}`,
          Object.keys(q).length > 0 ? q : undefined,
        );

        if (!items || items.length === 0) {
          return textResult(`No items found in register **${params.registerType}**.`);
        }

        const lines = items.map((r) => {
          const parts = [
            `- **${r.code ?? r.id ?? "?"}** ${r.description ?? ""}`.trimEnd(),
            r.isValid != null ? `  Valid: ${r.isValid ? "Yes" : "No"}` : null,
            r.externalId ? `  External ID: ${r.externalId}` : null,
            r.id ? `  ID: ${r.id}` : null,
          ];
          return parts.filter(Boolean).join("\n");
        });

        return textResult(
          `# Register: ${params.registerType} (${items.length} items)\n\n${lines.join("\n\n")}`,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_register_save",
    "Create or replace register items (full replacement)",
    {
      organization: orgParam,
      registerType: registerTypeSchema,
      items: z.string().describe("JSON string of register items array"),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);

        const parsed = parseJsonParam(params.items, "items");
        if (!parsed.ok) return parsed.error;
        if (!Array.isArray(parsed.value)) {
          return errorResult("'items' must be a JSON array.");
        }

        await client.put(`/api/${org}/registers/${params.registerType}`, parsed.value);
        return textResult(
          `Saved ${parsed.value.length} item(s) to register **${params.registerType}** (full replacement).`,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_register_update",
    "Partially update register items",
    {
      organization: orgParam,
      registerType: registerTypeSchema,
      items: z.string().describe("JSON string of partial register item updates"),
    },
    Annotations.update,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);

        const parsed = parseJsonParam(params.items, "items");
        if (!parsed.ok) return parsed.error;
        if (!Array.isArray(parsed.value)) {
          return errorResult("'items' must be a JSON array.");
        }

        await client.patch(`/api/${org}/registers/${params.registerType}`, parsed.value);
        return textResult(
          `Partially updated ${parsed.value.length} item(s) in register **${params.registerType}**.`,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
