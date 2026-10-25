// Único acceso al almacenamiento antiguo en producción. Solo se ejecuta por
// acción explícita de exportación/importación, nunca para operar la aplicación.
import {
  defaultCatalogs,
  loadCatalogs,
  CATALOGS_KEY,
} from "../../shared/src/catalogs";
import { loadWorkbench, WORKBENCH_KEY } from "../../shared/src/requests";
import { loadTripCases, TRIP_CASES_KEY } from "../../shared/src/trip-reviews";
import type { OperationsState } from "../../shared/src/operations";
const keys = [
  CATALOGS_KEY,
  WORKBENCH_KEY,
  TRIP_CASES_KEY,
  "real-ejecutivo.demo.orders.v1",
];
export function readLegacy() {
  const originals = Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  );
  if (!Object.values(originals).some(Boolean))
    throw new Error("No hay registros operativos antiguos en este navegador.");
  const state: OperationsState = {
    catalogs: originals[CATALOGS_KEY]
      ? loadCatalogs(originals[CATALOGS_KEY])
      : defaultCatalogs(),
    workbench: loadWorkbench(
      originals[WORKBENCH_KEY] ??
        JSON.stringify({
          orders: JSON.parse(
            originals["real-ejecutivo.demo.orders.v1"] ?? "[]",
          ) as unknown,
          requests: [],
        }),
    ),
    trips: loadTripCases(originals[TRIP_CASES_KEY]),
  };
  const drafts: Record<string, unknown> = {};
  for (let n = 0; n < localStorage.length; n++) {
    const key = localStorage.key(n);
    if (key?.startsWith("real-ejecutivo.demo.draft.v1"))
      drafts[key] = localStorage.getItem(key);
  }
  return { state, originals, drafts };
}
export function removeImportedLegacy(originals: Record<string, string | null>) {
  for (const key of keys)
    if (localStorage.getItem(key) !== originals[key])
      throw new Error(
        "Los datos locales cambiaron desde la revisión. No se eliminó nada.",
      );
  for (const key of keys) localStorage.removeItem(key);
}
export function readLegacyDraft(userId: string) {
  return localStorage.getItem(`real-ejecutivo.demo.draft.v1.${userId}`);
}
export function removeLegacyDraft(userId: string, original: string) {
  const key = `real-ejecutivo.demo.draft.v1.${userId}`;
  if (localStorage.getItem(key) !== original)
    throw new Error("El borrador local cambió. No se eliminó.");
  localStorage.removeItem(key);
}
export function downloadBackup(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `real-ejecutivo-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
