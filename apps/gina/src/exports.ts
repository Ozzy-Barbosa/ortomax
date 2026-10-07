import type { FinanceState, Movement } from "./types";
export function download(
  content: string,
  filename: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function csvCell(value: string | number) {
  const text = String(value);
  const safe =
    /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportCsv(state: FinanceState, rows: Movement[]) {
  const table = [
    [
      "ID",
      "Fecha",
      "Tipo",
      "Fuente",
      "Cuenta",
      "Destino",
      "Categoría",
      "Importe MXN",
      "Concepto",
      "Estado",
    ],
    ...rows.map((m) => [
      m.id,
      m.date,
      m.type,
      state.sources.find((s) => s.id === m.sourceId)?.name ?? "",
      state.accounts.find((a) => a.id === m.accountId)?.name ?? "",
      state.accounts.find((a) => a.id === m.toAccountId)?.name ?? "",
      state.categories.find((c) => c.id === m.categoryId)?.name ?? "",
      (m.amountCents / 100).toFixed(2),
      m.note,
      m.voided ? "Anulado" : "Registrado",
    ]),
  ];
  return "\uFEFF" + table.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
