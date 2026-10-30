export type HistoryCategory =
  | "Servicios"
  | "Servicios externos"
  | "Circulación"
  | "Revisiones"
  | "Solicitudes"
  | "Materiales"
  | "Incidencias"
  | "Reparaciones"
  | "Ajustes CAF";
export type HistoryRow<T> = {
  id: string;
  at: string;
  date?: string;
  category: HistoryCategory;
  status: string;
  types: string[];
  actor: string;
  title: string;
  body: T;
};
export type HistoryFilters = {
  category: string;
  status: string;
  type: string;
  from: string;
  to: string;
  query: string;
};
export const emptyHistoryFilters = (): HistoryFilters => ({
  category: "all",
  status: "all",
  type: "all",
  from: "",
  to: "",
  query: "",
});
export function historyDate(
  row: Pick<HistoryRow<unknown>, "date" | "at">,
): string {
  if (row.date) return row.date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(row.at)) return row.at;
  const date = new Date(row.at);
  return Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
}
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
export function filterHistory<T>(
  rows: HistoryRow<T>[],
  filters: HistoryFilters,
): HistoryRow<T>[] {
  if (filters.from && filters.to && filters.from > filters.to) return [];
  const query = normalized(filters.query);
  return rows
    .filter(
      (row) =>
        (filters.category === "all" || row.category === filters.category) &&
        (filters.status === "all" || row.status === filters.status) &&
        (filters.type === "all" || row.types.includes(filters.type)) &&
        (!filters.from || historyDate(row) >= filters.from) &&
        (!filters.to || historyDate(row) <= filters.to) &&
        (!query ||
          normalized(
            `${row.title} ${row.types.join(" ")} ${row.actor} ${row.status} ${row.category}`,
          ).includes(query)),
    )
    .sort(
      (a, b) =>
        historyDate(b).localeCompare(historyDate(a)) ||
        b.at.localeCompare(a.at),
    );
}
