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
