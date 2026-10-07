import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WflowClient } from "../wflow-client.js";
import { textResult, errorResult, fmtDate, fmtAmount, orgParam, parseJsonParam, Annotations, savedText, identityName } from "../utils.js";
import { INVOICE_TYPES } from "./config.js";
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
    Annotations.read,
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
    Annotations.read,
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
      type: z.object({ id: z.string().uuid() }).optional().describe("Document type"),
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
    Annotations.upsert,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const q: Record<string, string> = {};
        if (params.externalId) q.externalId = params.externalId;
        if (params.ignoreLock != null) q.ignoreLock = String(params.ignoreLock);
        if (params.setAsFilled != null) q.setAsFilled = String(params.setAsFilled);

        const body: Record<string, unknown> = {};
        if (params.id !== undefined) body.id = params.id;
        if (params.type) body.type = params.type;
        if (params.number !== undefined) body.number = params.number;
        if (params.internalCode !== undefined) body.internalCode = params.internalCode;
        if (params.variableSymbol !== undefined) body.variableSymbol = params.variableSymbol;
        if (params.constantSymbol !== undefined) body.constantSymbol = params.constantSymbol;
        if (params.specificSymbol !== undefined) body.specificSymbol = params.specificSymbol;
        if (params.issueDate !== undefined) body.issueDate = params.issueDate;
        if (params.dueDate !== undefined) body.dueDate = params.dueDate;
        if (params.vatDate !== undefined) body.vatDate = params.vatDate;
        if (params.totalAmount != null) body.totalAmount = params.totalAmount;
        if (params.currency !== undefined) body.currency = params.currency;
        if (params.partnerIC !== undefined) body.partnerIC = params.partnerIC;
        if (params.partnerVAT !== undefined) body.partnerVAT = params.partnerVAT;
        if (params.partnerName !== undefined) body.partnerName = params.partnerName;
        if (params.partnerAddress !== undefined) body.partnerAddress = params.partnerAddress;
        if (params.description !== undefined) body.description = params.description;

        const result = await client.put<unknown>(
          `/api/${org}/documents`,
          body,
          Object.keys(q).length > 0 ? q : undefined,
        );

        const verb = params.id ? "updated" : "created";
        return textResult(savedText(`Document ${verb}.`, result));
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
    Annotations.destroy,
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
    "Create a document from uploaded files (PDF, ISDOC, images); wflow extracts the data. " +
      "Pass each file's content base64-encoded.",
    {
      organization: orgParam,
      files: z
        .array(z.object({
          fileName: z.string().min(1).describe("File name with extension (e.g. invoice.pdf)"),
          contentBase64: z.string().min(1).describe("File content, base64-encoded"),
          contentType: z.string().optional().describe("MIME type (default application/octet-stream)"),
        }))
        .min(1)
        .describe("Files to upload as the document's attachments"),
      typeId: z.string().uuid().optional().describe("Document type ID"),
      invoiceType: z.enum(INVOICE_TYPES).optional().describe("Invoice type"),
    },
    Annotations.create,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const form = new FormData();
        for (const f of params.files) {
          const bytes = Buffer.from(f.contentBase64, "base64");
          if (!bytes.length) return errorResult(`File '${f.fileName}' has empty or invalid base64 content.`);
          form.append(
            "uploadedFiles",
            new Blob([bytes], { type: f.contentType ?? "application/octet-stream" }),
            f.fileName,
          );
        }
        const q: Record<string, string> = {};
        if (params.typeId) q.typeId = params.typeId;
        if (params.invoiceType) q.invoiceType = params.invoiceType;
        const result = await client.postForm<unknown>(`/api/${org}/documents/withfiles`, form, q);
        return textResult(savedText(`Document created from ${params.files.length} file(s).`, result));
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
      metadata: z.string().optional().describe("Metadata text to store (for set action); sent as-is, typically a JSON document serialized to a string"),
    },
    Annotations.replace,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const path = `/api/${org}/documents/${params.documentId}/metadata`;

        if (params.action === "set") {
          if (!params.metadata) return errorResult("metadata is required for set action.");
          // The endpoint's body schema is a JSON string, not an object.
          await client.put(path, params.metadata);
          return textResult(`Metadata updated for document ${params.documentId}.`);
        }

        const result = await client.get<unknown>(path);
        if (result === undefined) return textResult(`No metadata stored for ${params.documentId}.`);
        return textResult(`# Metadata for ${params.documentId}\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
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
    Annotations.update,
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
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const events = await client.get<DocumentEvent[]>(
          `/api/${org}/documents/${params.documentId}/events`,
        );

        if (!events?.length) return textResult("No events found.");

        const lines = [`# Events for ${params.documentId}`, ""];
        for (const ev of events) {
          const who = ev.identity ? identityName(ev.identity) : "system";
          lines.push(
            `- **${fmtDate(ev.created)}** [${ev.type ?? "?"}] by ${who}` +
            (ev.info ? ` — ${ev.info}` : ""),
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
      filter: z
        .string()
        .optional()
        .describe(
          'Filter as a JSON object (StructuredFilter): {"search": string, "sort": string, ' +
          '"filters": [{"column": string, "filters": [...]}], "propertyFilters": [{"key": string, "operator": string, "value": any}], ' +
          '"validationType": [string]}. All fields optional.',
        ),
      parameters: z.string().optional().describe("Format-specific export parameters (passed as the 'parameters' query value)"),
      markAsExported: z.boolean().optional().describe("Mark the exported documents as exported (default false)"),
    },
    Annotations.update,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        let body: unknown;
        if (params.filter) {
          const parsed = parseJsonParam(params.filter, "filter");
          if (!parsed.ok) return parsed.error;
          body = parsed.value;
        }

        const q: Record<string, string> = {};
        if (params.parameters) q.parameters = params.parameters;
        if (params.markAsExported != null) q.markAsExported = String(params.markAsExported);
        const result = await client.post<unknown>(
          `/api/${org}/documents/export/${encodeURIComponent(params.format)}`,
          body,
          q,
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
    "List IDs of documents ready for export or extraction (use wf_document for details)",
    {
      organization: orgParam,
      queue: z.enum(["export", "extract"]).describe("Which queue to check"),
      typeId: z.string().uuid().optional().describe("Export queue only: limit to this document type"),
    },
    Annotations.read,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);
        const endpoint =
          params.queue === "export"
            ? `/api/${org}/documents/toexport`
            : `/api/${org}/documents/toextract`;
        const q: Record<string, string> = {};
        if (params.queue === "export" && params.typeId) q.typeId = params.typeId;

        const ids = await client.get<string[]>(endpoint, q);
        if (!ids?.length) return textResult(`No documents in ${params.queue} queue.`);

        const lines = [`# ${params.queue} queue (${ids.length} documents)`, ""];
        for (const id of ids) lines.push(`- ${id}`);
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
      success: z.boolean().optional().describe("processed only: whether the task succeeded"),
      message: z.string().optional().describe("processed only: result message"),
    },
    Annotations.create,
    async (params) => {
      try {
        const org = client.resolveOrg(params.organization);

        const safeTaskType = encodeURIComponent(params.taskType);
        if (params.action === "processed") {
          const q: Record<string, string> = {};
          if (params.success != null) q.success = String(params.success);
          if (params.message) q.message = params.message;
          await client.put(
            `/api/${org}/documents/${params.documentId}/task/${safeTaskType}/processed`,
            undefined,
            q,
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
