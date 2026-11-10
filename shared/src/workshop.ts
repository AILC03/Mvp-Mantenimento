import type { AuthUser } from "./auth";
import type { Workbench } from "./requests";
import { managesOrders, validPastDate } from "./orders";
import { validMoney } from "./unit-records";

export type Supplier = {
  id: string;
  name: string;
  kind: "service" | "materials";
  service: string;
  location: string;
  phone: string;
  officePhone: string;
  email: string;
  notes: string;
  active: boolean;
};
export type Employee = {
  id: string;
  name: string;
  position: string;
  phone: string;
  active: boolean;
};
export type Part = {
  id: string;
  identifier: string;
  name: string;
  supplierId: string;
  cost: number;
  notes: string;
  vehicleIds: string[];
  active: boolean;
};
export type UnitArticle = {
  id: string;
  busId: string;
  name: string;
  category: "Herramienta" | "Producto de limpieza" | "Inventario";
  quantity: number;
  active: boolean;
};
export type ArticleMovement = {
  id: string;
  articleId: string;
  busId: string;
  name: string;
  before: number;
  after: number;
  reason: string;
  at: string;
  actorId: string;
  actorName: string;
  tripId?: string;
  stage?: "pre" | "post";
  driverId?: string;
};
export type HistoricalRepair = {
  id: string;
  busId: string;
  date: string;
  description: string;
  provider: string;
  cost: number | null;
  odometer: number | null;
  notes: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
};
export type Workshop = {
  suppliers: Supplier[];
  employees: Employee[];
  parts: Part[];
  articles: UnitArticle[];
  articleMovements: ArticleMovement[];
  historicalRepairs: HistoricalRepair[];
};
export const emptyWorkshop = (): Workshop => ({
  suppliers: [],
  employees: [],
  parts: [],
  articles: [],
  articleMovements: [],
  historicalRepairs: [],
});
export const workshop = (data: Workbench) => data.workshop ?? emptyWorkshop();
export type WorkshopChange =
  | { entity: "supplier"; value: Supplier }
  | { entity: "employee"; value: Employee }
  | { entity: "part"; value: Part }
  | { entity: "article"; value: UnitArticle; reason: string }
  | {
      entity: "historical";
      value: Omit<HistoricalRepair, "recordedAt" | "actorId" | "actorName">;
    };
const required = (v: string, max = 150) =>
  typeof v === "string" && !!v.trim() && v.length <= max;
export function validateWorkshop(value: unknown): Workshop {
  if (!value || typeof value !== "object")
    throw new Error("Datos de taller incompatibles.");
  const w = value as Workshop;
  for (const key of [
    "suppliers",
    "employees",
    "parts",
    "articles",
    "articleMovements",
    "historicalRepairs",
  ] as const) {
    if (
      !Array.isArray(w[key]) ||
      w[key].some((v) => !v || !required(v.id, 100)) ||
      new Set(w[key].map((v) => v.id)).size !== w[key].length
    )
      throw new Error("Registros de taller incompatibles.");
  }
  for (const list of [w.suppliers, w.employees, w.parts, w.articles])
    if (list.some((v) => typeof v.active !== "boolean"))
      throw new Error("Estado del directorio inválido.");
  if (
    w.articleMovements.some(
      (v) =>
        !required(v.articleId, 100) ||
        !required(v.busId, 100) ||
        !required(v.name) ||
        !required(v.reason, 2000) ||
        ![v.before, v.after].every((n) => Number.isSafeInteger(n) && n >= 0) ||
        !required(v.actorId, 100) ||
        !required(v.actorName) ||
        !Number.isFinite(Date.parse(v.at)),
    )
  )
    throw new Error("Movimientos de artículos inválidos.");
  if (
    w.suppliers.some(
      (v) =>
        !required(v.name) ||
        !["service", "materials"].includes(v.kind) ||
        !required(v.phone) ||
        (v.kind === "service" && !required(v.service)),
    ) ||
    w.employees.some((v) => !required(v.name) || !required(v.position)) ||
    w.parts.some(
      (v) =>
        !required(v.identifier) ||
        !required(v.name) ||
        !validMoney(v.cost) ||
        !Array.isArray(v.vehicleIds) ||
        !v.vehicleIds.length,
    ) ||
    w.articles.some(
      (v) =>
        !required(v.name) ||
        !Number.isSafeInteger(v.quantity) ||
        v.quantity < 0 ||
        !["Herramienta", "Producto de limpieza", "Inventario"].includes(
          v.category,
        ),
    ) ||
    w.historicalRepairs.some(
      (v) =>
        !validPastDate(v.date) ||
        !required(v.description, 4000) ||
        (v.cost !== null && !validMoney(v.cost)),
    )
  )
    throw new Error("Revisa los campos del taller.");
  return w;
}
export function changeWorkshop(
  data: Workbench,
  user: AuthUser,
  change: WorkshopChange,
  vehicleIds: string[],
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo admin o mecánico administra el taller.");
  const w = structuredClone(workshop(data));
  const v = change.value;
  if (!/^[a-zA-Z0-9:._-]{1,100}$/.test(v.id))
    throw new Error("Identificador inválido.");
  const upsert = <T extends { id: string }>(list: T[], value: T) => {
    const i = list.findIndex((v) => v.id === value.id);
    if (i < 0) list.push(value);
    else list[i] = value;
  };
  switch (change.entity) {
    case "supplier": {
      const s = change.value;
      const previous = w.suppliers.find((v) => v.id === s.id);
      if (
        previous &&
        previous.kind !== s.kind &&
        (w.parts.some((p) => p.supplierId === s.id) ||
          data.orders.some(
            (o) =>
              o.form.assignee?.kind === "supplier" &&
              o.form.assignee.id === s.id,
          ) ||
          data.externalServices?.some((v) => v.providerId === s.id))
      )
        throw new Error(
          "El tipo del proveedor utilizado en piezas u órdenes se conserva; registra otro proveedor para el otro tipo.",
        );
      if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
        throw new Error("Correo inválido.");
      if (
        w.suppliers.some(
          (x) =>
            x.id !== s.id &&
            x.name.trim().toUpperCase() === s.name.trim().toUpperCase(),
        )
      )
        throw new Error("Proveedor ya registrado.");
      upsert(w.suppliers, { ...s, name: s.name.trim() });
      break;
    }
    case "employee":
      upsert(w.employees, { ...change.value, name: change.value.name.trim() });
      break;
    case "part": {
      const p = change.value;
      if (
        !w.suppliers.some(
          (s) => s.id === p.supplierId && s.kind === "materials",
        ) ||
        p.vehicleIds.some((id) => !vehicleIds.includes(id))
      )
        throw new Error(
          "Revisa proveedor de materiales y unidades compatibles.",
        );
      if (
        w.parts.some(
          (x) =>
            x.id !== p.id &&
            x.identifier.trim().toUpperCase() ===
              p.identifier.trim().toUpperCase(),
        )
      )
        throw new Error("Número de parte ya registrado.");
      upsert(w.parts, p);
      break;
    }
    case "article": {
      const a = change.value;
      if (!vehicleIds.includes(a.busId)) throw new Error("Unidad inexistente.");
      const old = w.articles.find((v) => v.id === a.id);
      if (old && old.busId !== a.busId)
        throw new Error("No puedes mover el artículo a otra unidad.");
      if (!a.active && a.quantity !== 0)
        throw new Error("Registra cantidad cero antes de desactivar.");
      if (!old || old.quantity !== a.quantity) {
        if (!required(change.reason, 2000))
          throw new Error("Explica el alta, faltante o recuperación.");
        w.articleMovements.push({
          id: crypto.randomUUID(),
          articleId: a.id,
          busId: a.busId,
          name: a.name,
          before: old?.quantity ?? 0,
          after: a.quantity,
          reason: change.reason,
          at: new Date().toISOString(),
          actorId: user.id,
          actorName: user.name,
        });
      }
      upsert(w.articles, a);
      break;
    }
    case "historical": {
      const h = change.value;
      if (
        !vehicleIds.includes(h.busId) ||
        w.historicalRepairs.some((v) => v.id === h.id) ||
        (h.odometer !== null &&
          (!Number.isSafeInteger(h.odometer) || h.odometer < 0))
      )
        throw new Error("Antecedente inválido o ya registrado.");
      w.historicalRepairs.push({
        ...h,
        recordedAt: new Date().toISOString(),
        actorId: user.id,
        actorName: user.name,
      });
      break;
    }
  }
  validateWorkshop(w);
  return { ...data, workshop: w };
}
