import type { AuthUser } from "./auth";
import type { Workbench } from "./requests";
import { managesOrders, validPastDate } from "./orders";

export type IncidentSummary = {
  id: string;
  title: string;
  description: string;
  date: string;
  origin: string;
  resolved: boolean;
};

export type ExternalServiceInput = {
  providerId?: string;
  orderId?: string;
  kind: "external" | "roadside";
  date: string;
  description: string;
  provider: string;
  materialsCost: number;
  laborCost: number;
  notes: string;
};
export type ExternalService = ExternalServiceInput & {
  id: string;
  busId: string;
  actorId: string;
  actorName: string;
  recordedAt: string;
};
export type CirculationStatus = "authorized" | "unauthorized" | "unevaluated";
export type CirculationDecision = {
  orderId?: string;
  reason?: string;
  id: string;
  busId: string;
  status: CirculationStatus;
  actorId: string;
  actorName: string;
  recordedAt: string;
};
export const circulationLabels: Record<CirculationStatus, string> = {
  authorized: "Autorizado",
  unauthorized: "No autorizado",
  unevaluated: "Sin evaluar",
};
export const validMoney = (n: number) =>
  Number.isFinite(n) &&
  n >= 0 &&
  n <= 1e9 &&
  Math.abs(n * 100 - Math.round(n * 100)) < 0.00001;
export const externalTotal = (record: ExternalServiceInput) =>
  (Math.round(record.materialsCost * 100) +
    Math.round(record.laborCost * 100)) /
  100;
export function validateExternal(input: ExternalServiceInput) {
  if (
    !["external", "roadside"].includes(input.kind) ||
    !validPastDate(input.date) ||
    !input.description.trim() ||
    input.description.length > 4000 ||
    !input.provider.trim() ||
    input.provider.length > 150 ||
    input.notes.length > 4000 ||
    !validMoney(input.materialsCost) ||
    !validMoney(input.laborCost)
  )
    throw new Error(
      "Revisa fecha no futura, servicio, prestador e importes no negativos de hasta dos decimales.",
    );
}
export function addExternalService(
  data: Workbench,
  user: AuthUser,
  busId: string,
  input: ExternalServiceInput,
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo admin o mecánico registra servicios externos.");
  validateExternal(input);
  if (input.providerId)
    input = {
      ...input,
      provider:
        data.workshop?.suppliers.find((v) => v.id === input.providerId)?.name ??
        input.provider,
    };
  if (
    input.providerId &&
    !data.workshop?.suppliers.some(
      (v) => v.id === input.providerId && v.kind === "service" && v.active,
    )
  )
    throw new Error("Selecciona un proveedor de servicios activo.");
  if (input.orderId) {
    const order = data.orders.find(
      (v) => v.id === input.orderId && v.form.busId === busId,
    );
    if (
      !order ||
      order.form.assignee?.kind !== "supplier" ||
      order.form.assignee.id !== input.providerId
    )
      throw new Error(
        "El proveedor debe coincidir con el responsable externo de la orden de esta unidad.",
      );
    if (data.externalServices?.some((v) => v.orderId === input.orderId))
      throw new Error(
        "Esta orden ya tiene un servicio externo con costos registrados.",
      );
  }
  return {
    ...data,
    externalServices: [
      {
        ...input,
        description: input.description.trim(),
        provider: input.provider.trim(),
        notes: input.notes.trim(),
        id: crypto.randomUUID(),
        busId,
        actorId: user.id,
        actorName: user.name,
        recordedAt: new Date().toISOString(),
      },
      ...(data.externalServices ?? []),
    ],
  };
}
export function decideCirculation(
  data: Workbench,
  user: AuthUser,
  busId: string,
  status: CirculationStatus,
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo admin o mecánico decide circulación.");
  if (!Object.hasOwn(circulationLabels, status))
    throw new Error("Estado de circulación inválido.");
  if (
    status !== "unauthorized" &&
    data.orders.some(
      (v) =>
        v.form.busId === busId &&
        v.status !== "Finalizada" &&
        v.status !== "Pausada",
    )
  )
    throw new Error(
      "Hay órdenes abiertas no pausadas. Pausa o termina todas antes de autorizar circulación.",
    );
  return {
    ...data,
    circulationDecisions: [
      {
        id: crypto.randomUUID(),
        busId,
        status,
        actorId: user.id,
        actorName: user.name,
        recordedAt: new Date().toISOString(),
      },
      ...(data.circulationDecisions ?? []),
    ],
  };
}
export const latestCirculation = (data: Workbench, busId: string) =>
  data.circulationDecisions?.find((item) => item.busId === busId);

export function blockForOrder(
  data: Workbench,
  user: AuthUser,
  busId: string,
  orderId: string,
): Workbench {
  const previous = latestCirculation(data, busId);
  if (previous?.status === "unauthorized" && previous.orderId === orderId)
    return data;
  const next = decideCirculation(data, user, busId, "unauthorized");
  next.circulationDecisions![0].orderId = orderId;
  next.circulationDecisions![0].reason = "Orden abierta o reanudada";
  return next;
}

// Campos opcionales para snapshots anteriores; si están presentes, no perderlos al cargar.
export function validateUnitRecords(
  data: Record<string, unknown>,
): Pick<Workbench, "externalServices" | "circulationDecisions"> {
  const externalServices = data.externalServices as
    ExternalService[] | undefined;
  const circulationDecisions = data.circulationDecisions as
    CirculationDecision[] | undefined;
  const metadata = (item: ExternalService | CirculationDecision) =>
    item &&
    [item.id, item.busId, item.actorId, item.actorName, item.recordedAt].every(
      (v) => typeof v === "string" && v.length > 0,
    );
  if (externalServices !== undefined) {
    if (!Array.isArray(externalServices))
      throw new Error("Servicios externos inválidos.");
    for (const item of externalServices) {
      if (
        !metadata(item) ||
        typeof item.description !== "string" ||
        typeof item.provider !== "string" ||
        typeof item.notes !== "string"
      )
        throw new Error("Servicio externo inválido.");
      validateExternal(item);
    }
  }
  if (
    circulationDecisions !== undefined &&
    (!Array.isArray(circulationDecisions) ||
      circulationDecisions.some(
        (item) =>
          !metadata(item) || !Object.hasOwn(circulationLabels, item.status),
      ))
  )
    throw new Error("Historial de circulación inválido.");
  return {
    ...(externalServices === undefined ? {} : { externalServices }),
    ...(circulationDecisions === undefined ? {} : { circulationDecisions }),
  };
}
