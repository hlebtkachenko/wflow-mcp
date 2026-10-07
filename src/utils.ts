import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

export function fmtDate(d?: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

export function fmtAmount(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "";
  const formatted = amount.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function fmtUserName(user?: { identity?: { firstName?: string; lastName?: string } }): string {
  if (!user?.identity) return "unknown";
  return [user.identity.firstName, user.identity.lastName].filter(Boolean).join(" ") || "unknown";
}

export function parseJsonParam(json: string, paramName: string): { ok: true; value: unknown } | { ok: false; error: ReturnType<typeof errorResult> } {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch {
    return { ok: false, error: errorResult(`Invalid JSON in '${paramName}' parameter.`) };
  }
}

export const orgParam = z
  .string()
  .optional()
  .describe("Organization workspace name (uses default if omitted)");

export const Annotations = {
  read: { readOnlyHint: true } satisfies ToolAnnotations,
  create: { readOnlyHint: false, destructiveHint: false, idempotentHint: false } satisfies ToolAnnotations,
  update: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } satisfies ToolAnnotations,
  upsert: { readOnlyHint: false, destructiveHint: false, idempotentHint: false } satisfies ToolAnnotations,
  /** Overwrites a whole set (rights, register, properties) or has a remove/clear mode. */
  replace: { readOnlyHint: false, destructiveHint: true, idempotentHint: true } satisfies ToolAnnotations,
  destroy: { readOnlyHint: false, destructiveHint: true, idempotentHint: true } satisfies ToolAnnotations,
  raw: { readOnlyHint: false, destructiveHint: true, openWorldHint: true } satisfies ToolAnnotations,
};

/** Write endpoints answer with the new ID as a JSON string, an object with `id`, or nothing (204). */
export function idOf(result: unknown): string | undefined {
  if (typeof result === "string" && result) return result;
  if (result && typeof result === "object" && typeof (result as { id?: unknown }).id === "string") {
    return (result as { id: string }).id;
  }
  return undefined;
}

export function savedText(what: string, result: unknown): string {
  const id = idOf(result);
  return id ? `${what} ID: ${id}` : what;
}

export function identityName(identity?: { fullName?: string | null; firstName?: string | null; lastName?: string | null; login?: string | null } | null): string {
  if (!identity) return "unknown";
  return identity.fullName || [identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.login || "unknown";
}

export function pageQuery(params: { page?: number; pageSize?: number; search?: string }): Record<string, string> {
  const q: Record<string, string> = {};
  if (params.page != null) q.page = String(params.page);
  if (params.pageSize != null) q.pageSize = String(params.pageSize);
  if (params.search) q.search = params.search;
  return q;
}

export const pageParams = {
  page: z.number().int().min(1).optional().describe("Page number (1-based)"),
  pageSize: z.number().int().min(1).optional().describe("Items per page"),
  search: z.string().optional().describe("Full-text search"),
};

export function pageHeading(title: string, data: { page?: number; pageSize?: number; totalItems?: number }, shown: number): string {
  const total = data.totalItems ?? shown;
  return `# ${title} (${shown} shown, ${total} total${data.page ? `, page ${data.page}` : ""})`;
}
