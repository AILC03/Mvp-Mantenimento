import type { AuthUser } from "./auth";
import type { Product, SavedOrder } from "./data";
import type { Workbench } from "./requests";

export const managesOrders = (user: AuthUser) =>
  user.role === "ADMIN" || user.role === "LEAD_MECHANIC";
export const managesStock = (user: AuthUser) =>
  user.role === "ADMIN" || user.role === "WAREHOUSE_CLERK";
export const dateToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export function validPastDate(value: string): boolean {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= dateToday()
  );
}

export function orderMaterials(order: SavedOrder) {
  const rows = new Map<
    string,
    {
      productId: string;
      estimated: number;
      delivered: number;
      returned: number;
    }
  >();
  for (const service of order.form.services)
    for (const material of service.materials) {
      const old = rows.get(material.productId) ?? {
        productId: material.productId,
        estimated: 0,
        delivered: 0,
        returned: 0,
      };
      old.estimated += material.quantity;
      rows.set(material.productId, old);
    }
  for (const confirmation of order.materialConfirmations ?? [])
    for (const line of confirmation.lines) {
      const row = rows.get(line.productId) ?? {
        productId: line.productId,
        estimated: 0,
        delivered: 0,
        returned: 0,
      };
      row.delivered += line.delivered;
      row.returned += line.returned;
      rows.set(line.productId, row);
    }
  return [...rows.values()];
}

export type OrderCategory = "pending" | "working" | "finished";
export function orderCategory(order: SavedOrder): OrderCategory {
  return order.status === "Finalizada"
    ? "finished"
    : order.status === "En proceso" || order.status === "Pausada"
      ? "working"
      : "pending";
}
export const materialsPendingConfirmation = (order: SavedOrder) =>
  orderMaterials(order).filter(
    (row) => row.estimated > 0 && row.delivered - row.returned <= 1e-9,
  );

export function availableStock(product: Product, orders: SavedOrder[]): number {
  const entries = product.entries.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  );
  const net = orders.reduce(
    (sum, order) =>
      sum +
      (order.materialConfirmations ?? []).reduce(
        (amount, confirmation) =>
          amount +
          confirmation.lines
            .filter((line) => line.productId === product.id)
            .reduce((value, line) => value + line.delivered - line.returned, 0),
        0,
      ),
    0,
  );
  return Math.round((entries - net) * 1e6) / 1e6;
}
export const actualMaterialCost = (order: SavedOrder) =>
  (order.materialConfirmations ?? []).reduce(
    (sum, confirmation) =>
      sum +
      confirmation.lines.reduce(
        (value, line) =>
          value + (line.delivered - line.returned) * line.unitCost,
        0,
      ),
    0,
  );

export function validOrderMetadata(order: SavedOrder): boolean {
  const text = (value: unknown) => typeof value === "string";
  const number = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (
    order.events !== undefined &&
    (!Array.isArray(order.events) ||
      order.events.some(
        (event) =>
          !event ||
          ![
            event.id,
            event.at,
            event.actorId,
            event.actorName,
            event.notes,
          ].every(text) ||
          ![
            "Creada",
            "Iniciada",
            "Pausada",
            "Reanudada",
            "Finalizada",
          ].includes(event.action),
      ))
  )
    return false;
  if (order.materialConfirmations !== undefined) {
    if (
      !Array.isArray(order.materialConfirmations) ||
      new Set(order.materialConfirmations.map((event) => event?.id)).size !==
        order.materialConfirmations.length
    )
      return false;
    for (const event of order.materialConfirmations) {
      if (
        !event ||
        ![
          event.id,
          event.at,
          event.actorId,
          event.actorName,
          event.notes,
        ].every(text) ||
        !Array.isArray(event.lines) ||
        new Set(event.lines.map((line) => line?.productId)).size !==
          event.lines.length
      )
        return false;
      if (
        event.lines.some(
          (line) =>
            !line ||
            ![line.productId, line.name, line.sku].every(text) ||
            !["pza", "L"].includes(line.unit) ||
            ![line.delivered, line.returned, line.unitCost].every(number) ||
            (line.unit === "pza" &&
              (!Number.isInteger(line.delivered) ||
                !Number.isInteger(line.returned))),
        )
      )
        return false;
    }
    if (
      orderMaterials(order).some((row) => row.returned > row.delivered + 1e-6)
    )
      return false;
  }
  const completion = order.completion;
  if (
    completion !== undefined &&
    (!completion ||
      ![
        completion.date,
        completion.recordedAt,
        completion.actorId,
        completion.actorName,
        completion.notes,
      ].every(text) ||
      !Number.isSafeInteger(completion.odometer) ||
      completion.odometer < 0 ||
      !Array.isArray(completion.performedServiceIds) ||
      completion.performedServiceIds.some(
        (id) => !order.form.services.some((service) => service.id === id),
      ) ||
      !completion.unperformedReasons ||
      typeof completion.unperformedReasons !== "object")
  )
    return false;
  return true;
}

export function changeOrder(
  data: Workbench,
  user: AuthUser,
  id: string,
  action: "start" | "pause" | "resume",
  notes = "",
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo mecánico o administrador puede ejecutar la orden.");
  const order = data.orders.find((item) => item.id === id);
  if (!order) throw new Error("La orden no está disponible.");
  if (
    action === "start" &&
    !["Lista para iniciar", "Pendiente de liberación"].includes(order.status)
  )
    throw new Error("Esta orden ya no está lista para iniciar.");
  if (action === "pause" && (order.status !== "En proceso" || !notes.trim()))
    throw new Error(
      "La orden debe estar en proceso y la pausa requiere un motivo.",
    );
  if (action === "resume" && order.status !== "Pausada")
    throw new Error("La orden no está pausada.");
  const status = action === "pause" ? "Pausada" : "En proceso";
  const event = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    action:
      action === "start"
        ? ("Iniciada" as const)
        : action === "pause"
          ? ("Pausada" as const)
          : ("Reanudada" as const),
    notes: notes.trim(),
  };
  return {
    ...data,
    orders: data.orders.map((item) =>
      item.id === id
        ? { ...item, status, events: [...(item.events ?? []), event] }
        : item,
    ),
  };
}

export function finishOrder(
  data: Workbench,
  user: AuthUser,
  id: string,
  input: {
    date: string;
    odometer: number;
    performedServiceIds: string[];
    unperformedReasons: Record<string, string>;
    notes: string;
  },
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo mecánico o administrador puede terminar la orden.");
  const order = data.orders.find((item) => item.id === id);
  if (!order || order.status !== "En proceso")
    throw new Error("Inicia o reanuda la orden antes de terminarla.");
  if (materialsPendingConfirmation(order).length)
    throw new Error(
      "No puedes finalizar: almacén debe confirmar la entrega de cada material requerido. La entrega puede ser igual a la estimación.",
    );
  if (
    !validPastDate(input.date) ||
    !Number.isSafeInteger(input.odometer) ||
    input.odometer < 0
  )
    throw new Error("Revisa la fecha de ejecución y el odómetro.");
  if (input.odometer < Number(order.form.odometer))
    throw new Error(`El odómetro al terminar no puede ser menor al de apertura de esta orden (${order.form.odometer} km).`);
  if (
    input.performedServiceIds.some(
      (serviceId) =>
        !order.form.services.some((service) => service.id === serviceId),
    )
  )
    throw new Error("La selección contiene servicios ajenos a la orden.");
  if (
    order.form.services.some(
      (service) =>
        !input.performedServiceIds.includes(service.id) &&
        !input.unperformedReasons[service.id]?.trim(),
    )
  )
    throw new Error(
      "Explica cada servicio que no se realizó. Permanecerá como pendiente en el historial.",
    );
  const recordedAt = new Date().toISOString();
  const completion = {
    ...input,
    notes: input.notes.trim(),
    actorId: user.id,
    actorName: user.name,
    recordedAt,
  };
  return {
    ...data,
    orders: data.orders.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Finalizada",
            completion,
            events: [
              ...(item.events ?? []),
              {
                id: crypto.randomUUID(),
                at: recordedAt,
                actorId: user.id,
                actorName: user.name,
                action: "Finalizada",
                notes: input.notes.trim(),
              },
            ],
          }
        : item,
    ),
  };
}

export function confirmMaterials(
  data: Workbench,
  products: Product[],
  user: AuthUser,
  id: string,
  totals: { productId: string; delivered: number; returned: number }[],
  notes = "",
): Workbench {
  if (!managesStock(user))
    throw new Error("Solo almacén o administrador confirma materiales.");
  const order = data.orders.find((item) => item.id === id);
  if (!order) throw new Error("La orden no está disponible.");
  const current = orderMaterials(order);
  if (
    !current.length ||
    totals.length !== current.length ||
    new Set(totals.map((row) => row.productId)).size !== totals.length
  )
    throw new Error("Revisa todos los renglones de materiales de la orden.");
  const lines = totals
    .map((row) => {
      const previous = current.find((item) => item.productId === row.productId);
      const product = products.find((item) => item.id === row.productId);
      if (!previous || !product)
        throw new Error("Hay un artículo desconocido en la salida.");
      if (
        ![row.delivered, row.returned].every(
          (value) => Number.isFinite(value) && value >= 0,
        ) ||
        (product.unit === "pza" &&
          (!Number.isInteger(row.delivered) || !Number.isInteger(row.returned)))
      )
        throw new Error(
          "Usa cantidades no negativas; las piezas deben ser enteras.",
        );
      if (
        row.delivered < previous.delivered ||
        row.returned < previous.returned ||
        row.returned > row.delivered
      )
        throw new Error(
          "Las cantidades son acumuladas: no pueden disminuir, ni devolver más de lo entregado.",
        );
      const delivered = row.delivered - previous.delivered;
      const returned = row.returned - previous.returned;
      if (delivered - returned > availableStock(product, data.orders) + 1e-6)
        throw new Error(
          `Existencia insuficiente de ${product.name}. Registra la entrada real antes de confirmar.`,
        );
      const first = order.materialConfirmations
        ?.flatMap((confirmation) => confirmation.lines)
        .find((line) => line.productId === product.id && line.delivered > 0);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        delivered,
        returned,
        unitCost: first?.unitCost ?? product.cost,
      };
    })
    .filter((line) => line.delivered !== 0 || line.returned !== 0);
  if (!lines.length)
    throw new Error(
      "No hay cambios en las cantidades. No se descontó inventario otra vez.",
    );
  const confirmation = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    notes: notes.trim(),
    lines,
  };
  return {
    ...data,
    orders: data.orders.map((item) =>
      item.id === id
        ? {
            ...item,
            materialConfirmations: [
              ...(item.materialConfirmations ?? []),
              confirmation,
            ],
          }
        : item,
    ),
  };
}
