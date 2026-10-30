import { buses, isOrderForm, type SavedOrder, type Vehicle } from "./data";
import { validFleetRecords, type FleetRecords } from "./fleet";
import { validOrderMetadata } from "./orders";
import { domainStorage } from "./storage";
import {
  validateUnitRecords,
  type ExternalService,
  type CirculationDecision,
} from "./unit-records";

export const DRIVER = { id: "driver-demo", name: "José Hernández" };
export const MECHANIC = { id: "mechanic-demo", name: "Mecánico principal" };
export type DemoRole = "mechanic" | "driver";
export type RequestInput = {
  busId: string;
  title: string;
  description: string;
  odometer: string;
};
export type ServiceRequest = RequestInput & {
  id: string;
  number: string;
  driverId: string;
  driverName: string;
  createdAt: string;
  orderNumber?: string;
} & (
    | {
        status: "pending";
        reviewedAt?: never;
        reviewedBy?: never;
        rejectionReason?: never;
        orderId?: never;
      }
    | {
        status: "rejected";
        reviewedAt: string;
        reviewedBy: string;
        rejectionReason: string;
        orderId?: never;
      }
    | {
        status: "converted";
        reviewedAt: string;
        reviewedBy: string;
        orderId: string;
        rejectionReason?: never;
      }
  );

export type Workbench = {
  orders: SavedOrder[];
  requests: ServiceRequest[];
  fleet?: FleetRecords;
  externalServices?: ExternalService[];
  circulationDecisions?: CirculationDecision[];
};
export const WORKBENCH_KEY = "real-ejecutivo.demo.workbench.v2";

export const emptyRequest = (): RequestInput => ({
  busId: "",
  title: "",
  description: "",
  odometer: "",
});

export function validateRequest(
  input: RequestInput,
  vehicles: Vehicle[] | null = buses,
): string[] {
  const errors: string[] = [];
  if (
    !input.busId.trim() ||
    (vehicles && !vehicles.some((bus) => bus.id === input.busId))
  )
    errors.push("Selecciona la unidad del reporte.");
  if (!input.title.trim() || input.title.trim().length > 120)
    errors.push("Escribe un asunto de hasta 120 caracteres.");
  if (!input.description.trim() || input.description.trim().length > 2000)
    errors.push("Describe lo ocurrido en un máximo de 2000 caracteres.");
  if (
    input.odometer !== "" &&
    (!Number.isSafeInteger(Number(input.odometer)) ||
      Number(input.odometer) < 0 ||
      !input.odometer.trim())
  )
    errors.push(
      "El kilometraje debe ser un entero igual o mayor a cero, o quedar vacío.",
    );
  return errors;
}

function isServiceRequest(value: unknown): value is ServiceRequest {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (
    ![
      "id",
      "number",
      "driverId",
      "driverName",
      "createdAt",
      "busId",
      "title",
      "description",
      "odometer",
    ].every((key) => typeof item[key] === "string")
  )
    return false;
  if (validateRequest(item as RequestInput, null).length) return false;
  if (item.status === "pending") return true;
  if (
    typeof item.reviewedAt !== "string" ||
    typeof item.reviewedBy !== "string"
  )
    return false;
  return item.status === "rejected"
    ? typeof item.rejectionReason === "string" &&
        Boolean(item.rejectionReason.trim())
    : item.status === "converted" && typeof item.orderId === "string";
}

export function loadWorkbench(raw?: string | null): Workbench {
  try {
    const stored =
      raw === undefined ? domainStorage().getItem(WORKBENCH_KEY) : raw;
    const value: unknown = stored
      ? JSON.parse(stored)
      : {
          orders: JSON.parse(
            domainStorage().getItem("real-ejecutivo.demo.orders.v1") ?? "[]",
          ),
          requests: [],
        };
    if (!value || typeof value !== "object")
      throw new Error("Formato inválido.");
    const data = value as Record<string, unknown>;
    if (!Array.isArray(data.orders) || !Array.isArray(data.requests))
      throw new Error("Colecciones inválidas.");
    const result: Workbench = {
      ...validateUnitRecords(data),
      orders: Array.isArray(data.orders)
        ? data.orders.filter((item): item is SavedOrder =>
            Boolean(
              item &&
              typeof item.id === "string" &&
              typeof item.number === "string" &&
              [
                "Pendiente de liberación",
                "Lista para iniciar",
                "En proceso",
                "Pausada",
                "Finalizada",
              ].includes(String(item.status)) &&
              isOrderForm(item.form) &&
              validOrderMetadata(item as SavedOrder),
            ),
          )
        : [],
      requests: Array.isArray(data.requests)
        ? data.requests.filter(isServiceRequest)
        : [],
      fleet:
        data.fleet === undefined ? undefined : validFleetRecords(data.fleet),
    };
    if (
      result.orders.length !== data.orders.length ||
      result.requests.length !== data.requests.length
    )
      throw new Error("Registros incompatibles.");
    return result;
  } catch {
    throw new Error(
      "No se pudo leer el registro operativo local. No se sobrescribieron los datos.",
    );
  }
}

// Actualiza la caché síncrona de interfaz/pruebas. La persistencia real y el
// vínculo orden/solicitud se confirman transaccionalmente en OperationsService.
export function persistWorkbench(value: Workbench): void {
  domainStorage().setItem(WORKBENCH_KEY, JSON.stringify(value));
}

export function convertRequest(
  workbench: Workbench,
  order: SavedOrder,
  reviewedBy = MECHANIC.id,
): Workbench {
  const sourceId = order.form.sourceRequestId;
  if (!sourceId) return { ...workbench, orders: [order, ...workbench.orders] };
  const source = workbench.requests.find((request) => request.id === sourceId);
  if (
    !source ||
    source.status !== "pending" ||
    source.busId !== order.form.busId
  )
    throw new Error(
      "La solicitud ya fue atendida o no corresponde a la unidad. Revisa la bandeja antes de continuar.",
    );
  return {
    ...workbench,
    orders: [order, ...workbench.orders],
    requests: workbench.requests.map((request) =>
      request.id === sourceId && request.status === "pending"
        ? {
            ...request,
            status: "converted",
            orderId: order.id,
            reviewedAt: order.createdAt,
            reviewedBy,
          }
        : request,
    ),
  };
}

export function rejectRequest(
  workbench: Workbench,
  id: string,
  reason: string,
  reviewedBy = MECHANIC.id,
): Workbench {
  const source = workbench.requests.find((request) => request.id === id);
  if (!source || source.status !== "pending")
    throw new Error("La solicitud ya no está pendiente de revisión.");
  if (!reason.trim() || reason.trim().length > 2000)
    throw new Error("Escribe el motivo del rechazo (máximo 2000 caracteres).");
  return {
    ...workbench,
    requests: workbench.requests.map((request) =>
      request.id === id && request.status === "pending"
        ? {
            ...request,
            status: "rejected",
            rejectionReason: reason.trim(),
            reviewedAt: new Date().toISOString(),
            reviewedBy,
          }
        : request,
    ),
  };
}
