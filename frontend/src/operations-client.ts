import { loadCatalogs, persistCatalogs } from "../../shared/src/catalogs";
import { loadWorkbench, persistWorkbench } from "../../shared/src/requests";
import { loadTripCases, persistTripCases } from "../../shared/src/trip-reviews";
import type { Command, OperationsState } from "../../shared/src/operations";
import { isOrderForm, type OrderForm } from "./data";
import { ApiError } from "./auth";

export type Snapshot = OperationsState & {
  revision: number;
  imported: boolean;
  draft: OrderForm | null;
};
let snapshot: Snapshot | null = null;
let enabled = false;
let busy = false;
const listeners = new Set<() => void>();
const commands = new WeakMap<object, Command>();
export function track<T extends object>(value: T, command: Command): T {
  commands.set(value, command);
  return value;
}
export const remoteEnabled = () => enabled;
export const currentSnapshot = () => snapshot;
export const isSaving = () => busy;
export function subscribeSaving(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function saving(value: boolean) {
  busy = value;
  listeners.forEach((fn) => fn());
}

async function api(
  path = "",
  body?: unknown,
  signal?: AbortSignal,
): Promise<Snapshot> {
  let response: Response;
  try {
    response = await fetch(`/api/operations${path}`, {
      method: body ? "POST" : "GET",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "No se pudo conectar al servidor. No se guardó en el navegador; tus datos del formulario se conservan.",
      0,
    );
  }
  let value: Snapshot & { message?: string };
  try {
    value = (await response.json()) as Snapshot & { message?: string };
  } catch {
    throw new ApiError(
      "El servidor no devolvió datos válidos. No se guardó una copia local.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      value?.message ?? "No se pudo guardar en el servidor.",
      response.status,
    );
  if (
    !value ||
    !Number.isSafeInteger(value.revision) ||
    !value.catalogs ||
    !value.workbench ||
    !Array.isArray(value.trips)
  )
    throw new ApiError("Respuesta operativa inválida.", 0);
  try {
    loadCatalogs(JSON.stringify(value.catalogs), true);
    loadWorkbench(JSON.stringify(value.workbench));
    loadTripCases(JSON.stringify(value.trips));
    if (value.draft !== null && !isOrderForm(value.draft))
      throw new Error("Borrador inválido.");
  } catch {
    throw new ApiError(
      "La respuesta operativa es incompatible. No se sustituyeron tus datos.",
      0,
    );
  }
  return value;
}
function install(value: Snapshot) {
  snapshot = value;
  persistCatalogs(value.catalogs);
  persistWorkbench(value.workbench);
  persistTripCases(value.trips);
}
export async function startOperations(signal?: AbortSignal) {
  const value = await api("", undefined, signal);
  if (!signal?.aborted) {
    enabled = true;
    install(value);
  }
  return value;
}
export function stopOperations() {
  enabled = false;
  snapshot = null;
  persistCatalogs({
    version: 1,
    vehicles: [],
    products: [],
    services: [],
    reviews: [],
  });
  persistWorkbench({ orders: [], requests: [] });
  persistTripCases([]);
}
export async function executeCommand(command: Command) {
  if (!snapshot || !enabled)
    throw new Error("La operación todavía no se ha cargado desde el servidor.");
  if (busy) throw new Error("Espera a que termine el guardado actual.");
  saving(true);
  try {
    const value = await api("/commands", {
      commandId: crypto.randomUUID(),
      revision: snapshot.revision,
      command,
    });
    install(value);
    return value;
  } finally {
    saving(false);
  }
}
export function persistTracked(
  value: object,
  localTestWrite: () => void,
): void | Promise<void> {
  if (!enabled) {
    localTestWrite();
    return;
  }
  const command = commands.get(value);
  if (!command)
    throw new Error(
      "No existe una operación de servidor para este cambio. No se guardó una copia local.",
    );
  return executeCommand(command).then(() => undefined);
}
export async function importOperations(value: OperationsState) {
  if (!snapshot) throw new Error("Primero carga la operación.");
  saving(true);
  try {
    const result = await api("/import", {
      ...value,
      commandId: crypto.randomUUID(),
      revision: snapshot.revision,
      confirmed: true,
    });
    install(result);
    return result;
  } finally {
    saving(false);
  }
}
