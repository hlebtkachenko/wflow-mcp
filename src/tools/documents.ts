import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, fmtAmount, orgParam } from "../utils.js";
import type {
  DocumentBaseCollection,
  Document,
  DocumentEvent,
} from "../types.js";

export function registerDocumentTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_documents",
    "List documents with optional filtering and pagination",
    {
      organization: orgParam,
      query: z.string().optional().describe("Search query string"),
      sort: z.string().optional().describe("Sort field (e.g. issueDate, dueDate, totalAmount)"),
      page: z.number().int().optional().default(1).describe("Page number"),
      pageSize: z.number().int().optional().default(20).describe("Items per page"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const q: Record<string, string> = {
          page: String(params.page),
          pageSize: String(params.pageSize),
        };
        if (params.query) q.query = params.query;
        if (params.sort) q.sort = params.sort;

        const data = await client.get<DocumentBaseCollection>(`/api/${org}/documents`, q);
        const items = data.items ?? [];

        if (!items.length) return textResult("No documents found.");

        const lines = [
          `# Documents (page ${data.page ?? 1} of ${data.totalPages ?? 1}, ${data.totalItems ?? 0} total)`,
          "",
        ];
        for (const doc of items) {
          const status = doc.flowStatus?.name ?? "";
          lines.push(
            `- **${doc.number ?? "—"}** ${doc.partnerName ?? "unknown"}: ` +
            `${fmtAmount(doc.totalAmount, doc.currency)} | ` +
            `issued ${fmtDate(doc.issueDate)} → due ${fmtDate(doc.dueDate)}` +
            (doc.tag ? ` | tag: ${doc.tag}` : "") +
            (status ? ` | status: ${status}` : "") +
            ` (id: ${doc.id})`,
          );
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document",
    "Get detailed document by ID",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const doc = await client.get<Document>(`/api/${org}/documents/${params.documentId}`);

        const lines = [
          `# Document ${doc.number ?? doc.id}`,
          "",
          `- **ID** ${doc.id}`,
          `- **Number** ${doc.number ?? "—"}`,
          `- **Internal code** ${doc.internalCode ?? "—"}`,
          `- **Type** ${doc.type?.name ?? "—"}`,
          `- **Status** ${doc.flowStatus?.name ?? "—"}`,
          "",
          "## Dates",
          `- **Issue date** ${fmtDate(doc.issueDate)}`,
          `- **Due date** ${fmtDate(doc.dueDate)}`,
          `- **VAT date** ${fmtDate(doc.vatDate)}`,
          `- **Accept date** ${fmtDate(doc.acceptDate)}`,
          `- **Valid from** ${fmtDate(doc.validFrom)}`,
          `- **Valid to** ${fmtDate(doc.validTo)}`,
          "",
          "## Amounts",
          `- **Total** ${fmtAmount(doc.totalAmount, doc.currency)}`,
          `- **Tax exclusive** ${fmtAmount(doc.taxExclusiveAmount, doc.currency)}`,
          `- **Rounding** ${fmtAmount(doc.roundingAmount, doc.currency)}`,
          `- **Total FC** ${fmtAmount(doc.totalAmountFC)}`,
          `- **Advance** ${fmtAmount(doc.advanceAmount, doc.currency)}`,
          `- **Exchange rate** ${doc.exchangeRate ?? "—"}`,
          "",
          "## Symbols",
          `- **Variable** ${doc.variableSymbol ?? "—"}`,
          `- **Constant** ${doc.constantSymbol ?? "—"}`,
          `- **Specific** ${doc.specificSymbol ?? "—"}`,
          "",
          "## Partner",
          `- **Name** ${doc.partnerName ?? doc.partner?.name ?? "—"}`,
          `- **IČ** ${doc.partnerIC ?? doc.partner?.ic ?? "—"}`,
          `- **DIČ** ${doc.partnerVAT ?? doc.partner?.vat ?? "—"}`,
          `- **Address** ${doc.partnerAddress ?? "—"}`,
          `- **Email** ${doc.partnerEmail ?? "—"}`,
          "",
          "## Bank",
          `- **Account** ${doc.accountNo ?? "—"} / ${doc.bankCode ?? "—"}`,
          `- **IBAN** ${doc.iban ?? "—"}`,
          `- **BIC** ${doc.bic ?? "—"}`,
        ];

        if (doc.description) {
          lines.push("", "## Description", doc.description);
        }
        if (doc.orderNo) {
          lines.push("", `- **Order No** ${doc.orderNo}`);
        }

        if (doc.lines?.length) {
          lines.push("", "## Lines");
          for (const ln of doc.lines) {
            lines.push(
              `- ${ln.description ?? "—"}: ${ln.quantity ?? 0} × ${fmtAmount(ln.unitPrice)} = ${fmtAmount(ln.totalPrice)}` +
              (ln.vatRate != null ? ` (VAT ${ln.vatRate}%)` : "") +
              (ln.unit ? ` [${ln.unit}]` : ""),
            );
          }
        }

        if (doc.vats?.length) {
          lines.push("", "## VAT summary");
          for (const v of doc.vats) {
            lines.push(
              `- **${v.vatRate ?? 0}%** base ${fmtAmount(v.taxExclusiveAmount)} → VAT ${fmtAmount(v.vatAmount)} → total ${fmtAmount(v.taxInclusiveAmount)}`,
            );
          }
        }

        if (doc.files?.length) {
          lines.push("", "## Files");
          for (const f of doc.files) {
            lines.push(`- ${f.name ?? "unnamed"} (${f.contentType ?? "?"}, ${fmtDate(f.created)}) id: ${f.id}`);
          }
        }

        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_save",
    "Create or update a document",
    {
      organization: orgParam,
      id: z.string().uuid().optional().describe("Document ID (for update)"),
      type: z.object({ id: z.string() }).optional().describe("Document type"),
      number: z.string().optional().describe("Document number"),
      internalCode: z.string().optional().describe("Internal code"),
      variableSymbol: z.string().optional().describe("Variable symbol"),
      constantSymbol: z.string().optional().describe("Constant symbol"),
      specificSymbol: z.string().optional().describe("Specific symbol"),
      issueDate: z.string().optional().describe("Issue date (YYYY-MM-DD)"),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      vatDate: z.string().optional().describe("VAT date (YYYY-MM-DD)"),
      totalAmount: z.number().optional().describe("Total amount"),
      currency: z.string().optional().describe("Currency code (CZK, EUR, …)"),
      partnerIC: z.string().optional().describe("Partner IČ"),
      partnerVAT: z.string().optional().describe("Partner DIČ"),
      partnerName: z.string().optional().describe("Partner name"),
      partnerAddress: z.string().optional().describe("Partner address"),
      description: z.string().optional().describe("Description / note"),
      externalId: z.string().optional().describe("External system ID (query param)"),
      ignoreLock: z.boolean().optional().describe("Ignore document lock"),
      setAsFilled: z.boolean().optional().describe("Mark as filled after save"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const q: Record<string, string> = {};
        if (params.externalId) q.externalId = params.externalId;
        if (params.ignoreLock != null) q.ignoreLock = String(params.ignoreLock);
        if (params.setAsFilled != null) q.setAsFilled = String(params.setAsFilled);

        const body: Record<string, unknown> = {};
        if (params.id) body.id = params.id;
        if (params.type) body.type = params.type;
        if (params.number) body.number = params.number;
        if (params.internalCode) body.internalCode = params.internalCode;
        if (params.variableSymbol) body.variableSymbol = params.variableSymbol;
        if (params.constantSymbol) body.constantSymbol = params.constantSymbol;
        if (params.specificSymbol) body.specificSymbol = params.specificSymbol;
        if (params.issueDate) body.issueDate = params.issueDate;
        if (params.dueDate) body.dueDate = params.dueDate;
        if (params.vatDate) body.vatDate = params.vatDate;
        if (params.totalAmount != null) body.totalAmount = params.totalAmount;
        if (params.currency) body.currency = params.currency;
        if (params.partnerIC) body.partnerIC = params.partnerIC;
        if (params.partnerVAT) body.partnerVAT = params.partnerVAT;
        if (params.partnerName) body.partnerName = params.partnerName;
        if (params.partnerAddress) body.partnerAddress = params.partnerAddress;
        if (params.description) body.description = params.description;

        const result = await client.put<{ id?: string }>(
          `/api/${org}/documents`,
          body,
          Object.keys(q).length > 0 ? q : undefined,
        );

        const verb = params.id ? "updated" : "created";
        return textResult(`Document ${verb}. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_delete",
    "Delete a document (careful!)",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID to delete"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.del(`/api/${org}/documents/${params.documentId}`);
        return textResult(`Document ${params.documentId} deleted.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_with_files",
    "Create a document with attached files",
    {
      organization: orgParam,
      document: z.string().describe("JSON string of document data"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        let docBody: Record<string, unknown>;
        try {
          docBody = JSON.parse(params.document) as Record<string, unknown>;
        } catch {
          return errorResult("Invalid JSON in 'document' parameter.");
        }
        const result = await client.post<{ id?: string }>(
          `/api/${org}/documents/withfiles`,
          docBody,
        );
        return textResult(`Document created with files. ID: ${result?.id ?? "—"}`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_metadata",
    "Get or update document metadata",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      action: z.enum(["get", "set"]).default("get").describe("Get or set metadata"),
      metadata: z.string().optional().describe("JSON string of metadata (for set action)"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = `/api/${org}/documents/${params.documentId}/metadata`;

        if (params.action === "set") {
          if (!params.metadata) return errorResult("metadata is required for set action.");
          let body: unknown;
          try {
            body = JSON.parse(params.metadata);
          } catch {
            return errorResult("Invalid JSON in 'metadata' parameter.");
          }
          await client.put(path, body);
          return textResult(`Metadata updated for document ${params.documentId}.`);
        }

        const result = await client.get<Record<string, unknown>>(path);
        const lines = [`# Metadata for ${params.documentId}`, ""];
        for (const [key, val] of Object.entries(result)) {
          lines.push(`- **${key}** ${String(val)}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_lock",
    "Lock or unlock a document",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      lock: z.boolean().describe("true to lock, false to unlock"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        await client.put(
          `/api/${org}/documents/${params.documentId}/lock/${params.lock}`,
        );
        const verb = params.lock ? "locked" : "unlocked";
        return textResult(`Document ${params.documentId} ${verb}.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_events",
    "Get document event history",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const events = await client.get<DocumentEvent[]>(
          `/api/${org}/documents/${params.documentId}/events`,
        );

        if (!events?.length) return textResult("No events found.");

        const lines = [`# Events for ${params.documentId}`, ""];
        for (const ev of events) {
          const who = ev.user?.identity
            ? `${ev.user.identity.firstName ?? ""} ${ev.user.identity.lastName ?? ""}`.trim()
            : "system";
          lines.push(
            `- **${fmtDate(ev.created)}** [${ev.eventType ?? "?"}] by ${who}` +
            (ev.description ? ` — ${ev.description}` : ""),
          );
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_export",
    "Export documents in specified format",
    {
      organization: orgParam,
      format: z.string().describe("Export format (e.g. xml, csv)"),
      filter: z.string().optional().describe("JSON string of filter body"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        let body: unknown;
        if (params.filter) {
          try {
            body = JSON.parse(params.filter);
          } catch {
            return errorResult("Invalid JSON in 'filter' parameter.");
          }
        }

        const result = await client.post<unknown>(
          `/api/${org}/documents/export/${encodeURIComponent(params.format)}`,
          body,
        );

        return textResult(
          `# Export (${params.format})\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}

export function registerDocumentQueueTools(server: McpServer, client: WflowClient): void {
  server.tool(
    "wf_documents_queue",
    "List documents ready for export or extraction",
    {
      organization: orgParam,
      queue: z.enum(["export", "extract"]).describe("Which queue to check"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const endpoint =
          params.queue === "export"
            ? `/api/${org}/documents/toexport`
            : `/api/${org}/documents/toextract`;

        const items = await client.get<DocumentBaseCollection>(endpoint);
        const docs = items.items ?? [];

        if (!docs.length) return textResult(`No documents in ${params.queue} queue.`);

        const lines = [`# ${params.queue} queue (${docs.length} documents)`, ""];
        for (const doc of docs) {
          lines.push(
            `- **${doc.number ?? "—"}** ${doc.partnerName ?? "?"}: ` +
            `${fmtAmount(doc.totalAmount, doc.currency)} | ${fmtDate(doc.issueDate)}` +
            ` (id: ${doc.id})`,
          );
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "wf_document_task",
    "Create or mark document task as processed",
    {
      organization: orgParam,
      documentId: z.string().uuid().describe("Document ID"),
      taskType: z.string().describe("Task type identifier"),
      action: z.enum(["create", "processed"]).default("create").describe("Create task or mark as processed"),
    },
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);

        const safeTaskType = encodeURIComponent(params.taskType);
        if (params.action === "processed") {
          await client.put(
            `/api/${org}/documents/${params.documentId}/task/${safeTaskType}/processed`,
          );
          return textResult(`Task '${params.taskType}' marked as processed for document ${params.documentId}.`);
        }

        await client.post(
          `/api/${org}/documents/${params.documentId}/task/${safeTaskType}`,
        );
        return textResult(`Task '${params.taskType}' created for document ${params.documentId}.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
