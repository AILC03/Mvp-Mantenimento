import type { AuthUser } from "./auth";
import {
  addExternalService,
  decideCirculation,
  type ExternalServiceInput,
  type CirculationStatus,
  type UnitInventoryCount,
  recordTripInventory,
} from "./unit-records";
import {
  defaultCatalogs,
  saveVehicle,
  saveProduct,
  saveService,
  saveReview,
  addStockEntry,
  saveEmployee,
  saveProvider,
  saveVehiclePart,
  normalizeCatalogs,
  type Catalogs,
} from "./catalogs";
import {
  isOrderForm,
  validateOrder,
  type OrderForm,
  type SavedOrder,
} from "./data";
import {
  convertRequest,
  rejectRequest,
  validateRequest,
  type Workbench,
  type RequestInput,
} from "./requests";
import { changeOrder, finishOrder, confirmMaterials } from "./orders";
import {
  correctCaf,
  recordPeriodicReview,
  addDamage,
  resolveIncident,
  vehicleIncidents,
  addPastRepair,
} from "./fleet";
import {
  startTripCase,
  submitTripInspection,
  closeTripCase,
  type TripCase,
  type TripAnswer,
} from "./trip-reviews";

export type OperationsState = {
  catalogs: Catalogs;
  workbench: Workbench;
  trips: TripCase[];
};
export type Command =
  | {
      type: "repair.record";
      vehicleId: string;
      input: Parameters<typeof addPastRepair>[3];
    }
  | { type: "inventory.save"; vehicleId: string; counts: UnitInventoryCount[] }
  | {
      type: "employee.save";
      input: Parameters<typeof saveEmployee>[1];
      id?: string;
      clientId: string;
    }
  | {
      type: "provider.save";
      input: Parameters<typeof saveProvider>[1];
      id?: string;
      clientId: string;
    }
  | {
      type: "part.save";
      input: Parameters<typeof saveVehiclePart>[1];
      id?: string;
      clientId: string;
    }
  | { type: "external.record"; vehicleId: string; input: ExternalServiceInput }
  | { type: "circulation.decide"; vehicleId: string; status: CirculationStatus }
  | {
      type: "vehicle.save";
      input: Parameters<typeof saveVehicle>[1];
      id?: string;
      clientId: string;
    }
  | {
      type: "product.save";
      input: Parameters<typeof saveProduct>[1];
      initial: Parameters<typeof saveProduct>[2];
      id?: string;
      clientId: string;
    }
  | {
      type: "stock.add";
      id: string;
      input: Parameters<typeof addStockEntry>[2];
    }
  | {
      type: "service.save";
      input: Parameters<typeof saveService>[1];
      id?: string;
      clientId: string;
    }
  | {
      type: "review.save";
      input: Parameters<typeof saveReview>[1];
      id?: string;
      clientId: string;
    }
  | { type: "request.create"; input: RequestInput; clientId: string }
  | { type: "request.reject"; id: string; reason: string }
  | { type: "order.create"; form: OrderForm; clientId: string }
  | {
      type: "order.change";
      id: string;
      action: "start" | "pause" | "resume";
      notes: string;
    }
  | {
      type: "order.finish";
      id: string;
      input: Parameters<typeof finishOrder>[3];
    }
  | {
      type: "materials.confirm";
      id: string;
      totals: Parameters<typeof confirmMaterials>[4];
      notes: string;
    }
  | {
      type: "caf.correct";
      vehicleId: string;
      input: Parameters<typeof correctCaf>[3];
    }
  | {
      type: "review.record";
      vehicleId: string;
      templateId: string;
      input: Parameters<typeof recordPeriodicReview>[4];
    }
  | {
      type: "damage.add";
      vehicleId: string;
      input: Parameters<typeof addDamage>[3];
    }
  | {
      type: "incident.resolve";
      vehicleId: string;
      sourceId: string;
      notes: string;
      orderId: string;
    }
  | {
      type: "trip.start";
      input: Parameters<typeof startTripCase>[2];
      clientId: string;
    }
  | {
      type: "trip.submit";
      id: string;
      stage: "pre" | "post";
      answers: Record<string, TripAnswer>;
      notes: string;
      templateId?: string;
      inventory?: UnitInventoryCount[];
    }
  | { type: "trip.close"; id: string; notes: string }
  | { type: "draft.save"; form: OrderForm };

export function emptyOperations(): OperationsState {
  const catalogs = defaultCatalogs();
  // Definiciones del producto, no vehículos ni existencias de demostración.
  catalogs.vehicles = [];
  catalogs.products = [];
  catalogs.services = catalogs.services
    .filter((s) => s.id === "oil-change")
    .map((s) => ({ ...s, materials: [], compatibleVehicleIds: [] }));
  return { catalogs, workbench: { orders: [], requests: [] }, trips: [] };
}
export function permitted(user: AuthUser, type: Command["type"]): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "DRIVER")
    return [
      "request.create",
      "trip.start",
      "trip.submit",
      "damage.add",
      "external.record",
      "provider.save",
    ].includes(type);
  if (user.role === "WAREHOUSE_CLERK")
    return [
      "product.save",
      "stock.add",
      "materials.confirm",
      "provider.save",
    ].includes(type);
  if (user.role === "LEAD_MECHANIC")
    return [
      "service.save",
      "employee.save",
      "provider.save",
      "part.save",
      "inventory.save",
      "repair.record",
      "request.reject",
      "order.create",
      "order.change",
      "order.finish",
      "review.record",
      "damage.add",
      "incident.resolve",
      "trip.close",
      "draft.save",
      "external.record",
      "circulation.decide",
    ].includes(type);
  return false;
}
export function applyCommand(
  state: OperationsState,
  user: AuthUser,
  command: Command,
  sequence: number,
): OperationsState {
  if (!permitted(user, command.type))
    throw new Error("Tu perfil no puede realizar esta operación.");
  const next = structuredClone(state);
  next.catalogs = normalizeCatalogs(next.catalogs);
  const c = next.catalogs;
  const vehicle = (id: string) => {
    const value = c.vehicles.find((v) => v.id === id);
    if (!value) throw new Error("La unidad no existe.");
    return value;
  };
  const identify = <T extends { id: string }>(
    list: T[],
    id: string | undefined,
    clientId: string,
  ) => {
    if (!id) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          clientId,
        )
      )
        throw new Error("El identificador de alta no es válido.");
      if (list.slice(0, -1).some((v) => v.id === clientId))
        throw new Error("El identificador ya existe.");
      list[list.length - 1].id = clientId;
    }
  };
  switch (command.type) {
    case "repair.record":
      vehicle(command.vehicleId);
      next.workbench = addPastRepair(
        next.workbench,
        user,
        command.vehicleId,
        command.input,
      );
      break;
    case "inventory.save": {
      vehicle(command.vehicleId);
      if (
        next.trips.some(
          (trip) =>
            trip.busId === command.vehicleId && trip.pre && !trip.closedAt,
        )
      )
        throw new Error(
          "No se puede reconfigurar inventario durante un viaje con pre trip enviada.",
        );
      const checked = recordTripInventory(
        next.workbench,
        user,
        {
          id: "configuration",
          number: "Configuración",
          busId: command.vehicleId,
        },
        "pre",
        command.counts,
        c.products,
      );
      next.workbench = checked;
      break;
    }
    case "employee.save":
      next.catalogs.employees = saveEmployee(c, command.input, command.id);
      identify(next.catalogs.employees, command.id, command.clientId);
      break;
    case "provider.save":
      if (user.role === "DRIVER" && command.id)
        throw new Error(
          "El chofer solo puede dar de alta un prestador, no editar proveedores existentes.",
        );
      next.catalogs.providers = saveProvider(c, command.input, command.id);
      identify(next.catalogs.providers, command.id, command.clientId);
      break;
    case "part.save":
      next.catalogs.vehicleParts = saveVehiclePart(
        c,
        command.input,
        command.id,
      );
      identify(next.catalogs.vehicleParts, command.id, command.clientId);
      break;
    case "external.record":
      vehicle(command.vehicleId);
      next.workbench = addExternalService(
        next.workbench,
        user,
        command.vehicleId,
        command.input,
      );
      break;
    case "circulation.decide":
      vehicle(command.vehicleId);
      next.workbench = decideCirculation(
        next.workbench,
        user,
        command.vehicleId,
        command.status,
      );
      break;
    case "vehicle.save":
      next.catalogs = saveVehicle(c, command.input, command.id);
      identify(next.catalogs.vehicles, command.id, command.clientId);
      break;
    case "product.save":
      next.catalogs = saveProduct(
        c,
        command.input,
        command.initial,
        command.id,
      );
      identify(next.catalogs.products, command.id, command.clientId);
      break;
    case "stock.add":
      next.catalogs = addStockEntry(c, command.id, command.input);
      break;
    case "service.save":
      next.catalogs = saveService(c, command.input, command.id);
      identify(next.catalogs.services, command.id, command.clientId);
      break;
    case "review.save":
      next.catalogs = saveReview(c, command.input, command.id);
      identify(next.catalogs.reviews, command.id, command.clientId);
      break;
    case "request.create": {
      if (user.role !== "DRIVER")
        throw new Error("Solo chofer registra solicitudes.");
      const errors = validateRequest(command.input, c.vehicles);
      if (errors.length) throw new Error(errors.join(" "));
      if (next.workbench.requests.some((r) => r.id === command.clientId))
        throw new Error("La solicitud ya existe.");
      next.workbench.requests.unshift({
        ...command.input,
        title: command.input.title.trim(),
        description: command.input.description.trim(),
        id: command.clientId,
        number: `SOL-${sequence}`,
        driverId: user.id,
        driverName: user.name,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      break;
    }
    case "request.reject":
      next.workbench = rejectRequest(
        next.workbench,
        command.id,
        command.reason,
        user.id,
      );
      break;
    case "order.create": {
      if (!isOrderForm(command.form))
        throw new Error("Formato de orden inválido.");
      if (
        command.form.sourceIncidentId &&
        !vehicleIncidents(command.form.busId, next.workbench, next.trips).some(
          (i) => i.sourceId === command.form.sourceIncidentId && !i.resolution,
        )
      )
        throw new Error("La falla de origen no está activa en esta unidad.");
      const responsible = command.form.responsible;
      if (responsible) {
        const people =
          responsible.kind === "taller" ? c.employees : c.providers;
        if (
          !people.some(
            (person) =>
              person.id === responsible.refId &&
              person.name === responsible.name &&
              (!("active" in person) || person.active !== false) &&
              (!("kind" in person) || person.kind !== "material"),
          )
        )
          throw new Error(
            "El responsable ya no coincide con el catálogo vigente.",
          );
      }
      const parts = command.form.partMaterials ?? [];
      if (
        new Set(parts.map((p) => p.partId)).size !== parts.length ||
        new Set(parts.map((p) => p.id)).size !== parts.length
      )
        throw new Error("No repitas piezas en la orden.");
      for (const part of parts) {
        const definition = c.vehicleParts.find((p) => p.id === part.partId);
        if (
          !definition ||
          !definition.compatibleVehicleIds.includes(command.form.busId) ||
          definition.name !== part.name ||
          definition.partNumber !== part.partNumber
        )
          throw new Error(
            "Revisa la compatibilidad y los datos de las piezas.",
          );
      }
      const errors = validateOrder(
        command.form,
        c.vehicles,
        c.products,
        c.services,
      );
      if (errors.length) throw new Error(errors.join(" "));
      if (
        new Set(command.form.services.map((s) => s.id)).size !==
          command.form.services.length ||
        new Set(
          command.form.services
            .filter((s) => s.catalogId)
            .map((s) => s.catalogId),
        ).size !== command.form.services.filter((s) => s.catalogId).length
      )
        throw new Error("No repitas identificadores o servicios en una orden.");
      for (const service of command.form.services)
        if (
          new Set(service.materials.map((m) => m.productId)).size !==
            service.materials.length ||
          new Set(service.materials.map((m) => m.id)).size !==
            service.materials.length
        )
          throw new Error("No repitas materiales en un servicio.");
      if (next.workbench.orders.some((o) => o.id === command.clientId))
        throw new Error("La orden ya existe.");
      const now = new Date().toISOString();
      const order: SavedOrder = {
        id: command.clientId,
        number: `OT-${sequence}`,
        status: "Lista para iniciar",
        createdAt: now,
        createdBy: { id: user.id, name: user.name },
        events: [
          {
            id: crypto.randomUUID(),
            at: now,
            actorId: user.id,
            actorName: user.name,
            action: "Creada",
            notes: "Lista para iniciar sin liberación adicional.",
          },
        ],
        form: {
          ...command.form,
          services: command.form.services.map((s) => ({
            ...s,
            materials: s.materials.map((m) => ({
              ...m,
              unitCost: c.products.find((p) => p.id === m.productId)!.cost,
            })),
          })),
        },
      };
      next.workbench = convertRequest(next.workbench, order, user.id);
      break;
    }
    case "order.change":
      next.workbench = changeOrder(
        next.workbench,
        user,
        command.id,
        command.action,
        command.notes,
      );
      break;
    case "order.finish":
      next.workbench = finishOrder(
        next.workbench,
        user,
        command.id,
        command.input,
      );
      break;
    case "materials.confirm":
      next.workbench = confirmMaterials(
        next.workbench,
        c.products,
        user,
        command.id,
        command.totals,
        command.notes,
      );
      break;
    case "caf.correct":
      next.workbench = correctCaf(
        next.workbench,
        user,
        vehicle(command.vehicleId),
        command.input,
      );
      break;
    case "review.record": {
      vehicle(command.vehicleId);
      const template = c.reviews.find((r) => r.id === command.templateId);
      if (!template) throw new Error("La revisión no existe.");
      next.workbench = recordPeriodicReview(
        next.workbench,
        user,
        command.vehicleId,
        template,
        command.input,
      );
      break;
    }
    case "damage.add":
      vehicle(command.vehicleId);
      next.workbench = addDamage(
        next.workbench,
        user,
        command.vehicleId,
        command.input,
      );
      break;
    case "incident.resolve": {
      const incident = vehicleIncidents(
        vehicle(command.vehicleId).id,
        next.workbench,
        next.trips,
      ).find((i) => i.sourceId === command.sourceId);
      if (!incident) throw new Error("La incidencia no existe.");
      next.workbench = resolveIncident(
        next.workbench,
        user,
        incident,
        command.notes,
        command.orderId,
      );
      break;
    }
    case "trip.start":
      next.trips = startTripCase(next.trips, user, command.input, c.vehicles);
      if (state.trips.some((t) => t.id === command.clientId))
        throw new Error("El caso ya existe.");
      next.trips[0].id = command.clientId;
      next.trips[0].number = `REV-${sequence}`;
      break;
    case "trip.submit":
      next.trips = submitTripInspection(
        next.trips,
        user,
        command.id,
        command.stage,
        command.answers,
        command.notes,
        c.reviews.find((r) => r.id === command.templateId),
        command.inventory,
      );
      {
        const trip = next.trips.find((t) => t.id === command.id)!;
        const configured = next.workbench.unitInventories?.find(
          (i) => i.busId === trip.busId,
        );
        if (configured?.items.length && !command.inventory)
          throw new Error("Cuenta los artículos del inventario de la unidad.");
        if (command.inventory) {
          const expected = configured?.items ?? [];
          if (
            command.inventory.length !== expected.length ||
            expected.some(
              (row) =>
                !command.inventory!.some((r) => r.productId === row.productId),
            )
          )
            throw new Error(
              "Cuenta todos los artículos configurados, sin agregar artículos ajenos al inventario.",
            );
          next.workbench = recordTripInventory(
            next.workbench,
            user,
            trip,
            command.stage,
            command.inventory,
            c.products,
          );
        }
      }
      break;
    case "trip.close":
      next.trips = closeTripCase(next.trips, user, command.id, command.notes);
      break;
    case "draft.save":
      if (!isOrderForm(command.form))
        throw new Error("El borrador no es válido.");
      break;
  }
  return next;
}
