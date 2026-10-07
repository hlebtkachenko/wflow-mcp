import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, orgParam, parseJsonParam, Annotations } from "../utils.js";

export function registerApiTools(server: McpServer, client: WflowClient) {
  server.tool(
    "wf_api_raw",
    "Call any wflow API endpoint directly",
    {
      organization: orgParam,
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
        .default("GET")
        .describe("HTTP method"),
      path: z
        .string()
        .describe("API path starting with / (e.g. /api/myorg/documents)"),
      body: z
        .string()
        .optional()
        .describe("Request body as JSON string (parsed before sending)"),
    },
    Annotations.raw,
    async (params) => {
      try {
        let parsedBody: unknown;
        if (params.body) {
          const parsed = parseJsonParam(params.body, "body");
          if (!parsed.ok) return parsed.error;
          parsedBody = parsed.value;
        }
        const result = await client.request(params.method, params.path, parsedBody);
        if (result === undefined) return textResult("Done (no content).");
        return textResult(`\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
