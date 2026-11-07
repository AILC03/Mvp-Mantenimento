import type { AuthUser } from "./auth";
import type { Product } from "./data";
import { validServiceQuantity } from "./quantities";
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
  id: string;
  busId: string;
  status: CirculationStatus;
  actorId: string;
  actorName: string;
  recordedAt: string;
};
// Inventario por unidad: independiente del almacén (no toca existencias).
export type UnitInventoryCount = { productId: string; quantity: number };
export type UnitInventoryMovement = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  productId: string;
  name: string;
  sku: string;
  unit: Product["unit"];
  quantity: number;
  reason: string;
  tripId: string;
};
export type UnitInventory = {
  busId: string;
  items: UnitInventoryCount[];
  movements: UnitInventoryMovement[];
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
  if (!managesOrders(user) && user.role !== "DRIVER")
    throw new Error(
      "Solo admin, mecánico o chofer registra servicios externos.",
    );
  validateExternal(input);
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
  // Bloqueo derivado: una orden en curso impide autorizar circulación.
  const blocking = ordersInCourse(data, busId);
  if (status === "authorized" && blocking)
    throw new Error(
      `Hay una orden en curso (${blocking.number}) para esta unidad: no puede autorizarse la circulación hasta terminarla.`,
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

// Órdenes iniciadas y no finalizadas: derivan el bloqueo de circulación.
export const ordersInCourse = (data: Workbench, busId: string) =>
  data.orders.find(
    (order) =>
      order.form.busId === busId &&
      (order.status === "En proceso" || order.status === "Pausada"),
  ) ?? null;

export type CirculationState = {
  decision: CirculationDecision | null;
  blockingOrder: ReturnType<typeof ordersInCourse>;
  effective: CirculationStatus;
};
// Estado vigente: el bloqueo por orden en curso prevalece sobre la decisión.
export function circulationState(
  data: Workbench,
  busId: string,
): CirculationState {
  const decision = latestCirculation(data, busId) ?? null;
  const blockingOrder = ordersInCourse(data, busId);
  return {
    decision,
    blockingOrder,
    effective: blockingOrder
      ? "unauthorized"
      : (decision?.status ?? "unevaluated"),
  };
}

// Campos opcionales para snapshots anteriores; si están presentes, no perderlos al cargar.
export function validateUnitRecords(
  data: Record<string, unknown>,
): Pick<
  Workbench,
  "externalServices" | "circulationDecisions" | "unitInventories"
> {
  const externalServices = data.externalServices as
    ExternalService[] | undefined;
  const circulationDecisions = data.circulationDecisions as
    CirculationDecision[] | undefined;
  const unitInventories = data.unitInventories as UnitInventory[] | undefined;
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
  if (unitInventories !== undefined) {
    if (!Array.isArray(unitInventories))
      throw new Error("Inventario por unidad inválido.");
    if (
      new Set(unitInventories.map((item) => item?.busId)).size !==
      unitInventories.length
    )
      throw new Error("Hay inventarios duplicados para una unidad.");
    for (const item of unitInventories) {
      if (
        !item ||
        typeof item.busId !== "string" ||
        !item.busId ||
        !Array.isArray(item.items) ||
        !Array.isArray(item.movements) ||
        new Set(item.items.map((row) => row?.productId)).size !==
          item.items.length ||
        item.items.some(
          (row) =>
            !row ||
            typeof row.productId !== "string" ||
            !row.productId ||
            !Number.isFinite(row.quantity) ||
            row.quantity < 0,
        ) ||
        new Set(item.movements.map((row) => row?.id)).size !==
          item.movements.length ||
        item.movements.some(
          (row) =>
            !row ||
            ![
              row.id,
              row.at,
              row.actorId,
              row.actorName,
              row.productId,
              row.name,
              row.sku,
              row.reason,
              row.tripId,
            ].every((v) => typeof v === "string" && v.length > 0) ||
            !["pza", "L"].includes(row.unit) ||
            !Number.isFinite(row.quantity) ||
            row.quantity <= 0,
        )
      )
        throw new Error("Inventario por unidad inválido.");
    }
  }
  return {
    ...(externalServices === undefined ? {} : { externalServices }),
    ...(circulationDecisions === undefined ? {} : { circulationDecisions }),
    ...(unitInventories === undefined ? {} : { unitInventories }),
  };
}

// Carga (pre) y descuento con registro (post) del inventario por unidad.
export function recordTripInventory(
  data: Workbench,
  user: AuthUser,
  trip: { id: string; number: string; busId: string },
  stage: "pre" | "post",
  counts: UnitInventoryCount[],
  products: Product[],
): Workbench {
  if (!Array.isArray(counts) || counts.length > 300)
    throw new Error("El inventario admite hasta 300 artículos.");
  const seen = new Set<string>();
  for (const row of counts) {
    if (
      !row ||
      typeof row.productId !== "string" ||
      !row.productId ||
      typeof row.quantity !== "number" ||
      !Number.isFinite(row.quantity) ||
      row.quantity < 0
    )
      throw new Error("Revisa las cantidades del inventario.");
    if (seen.has(row.productId))
      throw new Error("No repitas artículos en el inventario.");
    seen.add(row.productId);
    const product = products.find((item) => item.id === row.productId);
    if (!product)
      throw new Error(
        "Un artículo del inventario ya no existe en el catálogo.",
      );
    if (row.quantity !== 0 && !validServiceQuantity(row.quantity, product.unit))
      throw new Error(
        `Cantidad inválida de ${product.name}: piezas enteras y litros en incrementos de 0.5.`,
      );
  }
  const list = data.unitInventories ?? [];
  const existing = list.find((item) => item.busId === trip.busId);
  const items = counts.map((row) => ({ ...row }));
  let movements = existing?.movements ?? [];
  if (stage === "post" || trip.id !== "configuration") {
    const previous = existing?.items ?? [];
    const missing = previous.filter((row) => !seen.has(row.productId));
    if (missing.length)
      throw new Error(
        `Falta contar en el post trip: ${missing
          .map(
            (row) =>
              products.find((product) => product.id === row.productId)?.name ??
              row.productId,
          )
          .join(", ")}.`,
      );
    const now = new Date().toISOString();
    const discounts = previous.flatMap((row) => {
      const current = counts.find((item) => item.productId === row.productId);
      if (!current || current.quantity >= row.quantity) return [];
      const product = products.find((item) => item.id === row.productId);
      if (!product) return [];
      return [
        {
          id: crypto.randomUUID(),
          at: now,
          actorId: user.id,
          actorName: user.name,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity: Math.round((row.quantity - current.quantity) * 1e6) / 1e6,
          reason: `Descuento registrado en ${stage} trip del caso ${trip.number}`,
          tripId: trip.id,
        },
      ];
    });
    movements = [...discounts, ...movements];
  }
  const inventory: UnitInventory = { busId: trip.busId, items, movements };
  return {
    ...data,
    unitInventories: existing
      ? list.map((item) => (item.busId === trip.busId ? inventory : item))
      : [...list, inventory],
  };
}
