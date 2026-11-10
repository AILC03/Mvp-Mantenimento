import type { AuthUser } from "./auth";
import {
  addExternalService,
  decideCirculation,
  blockForOrder,
  type ExternalServiceInput,
  type CirculationStatus,
} from "./unit-records";
import {
  defaultCatalogs,
  saveVehicle,
  saveProduct,
  saveService,
  saveReview,
  addStockEntry,
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
import {
  changeOrder,
  finishOrder,
  confirmMaterials,
  dateToday,
} from "./orders";
import {
  correctCaf,
  recordPeriodicReview,
  addDamage,
  resolveIncident,
  vehicleIncidents,
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
import { changeWorkshop, workshop, type WorkshopChange } from "./workshop";
export type Command =
  | { type: "workshop.save"; change: WorkshopChange }
  | {
      type: "parts.confirm";
      id: string;
      lines: {
        partId: string;
        received: number;
        delivered: number;
        returned: number;
      }[];
      notes: string;
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
      articleCounts?: Record<string, number>;
      faultActions?: Record<string, "report" | "request" | "damage">;
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
    return ["request.create", "trip.start", "trip.submit"].includes(type);
  if (user.role === "WAREHOUSE_CLERK")
    return [
      "product.save",
      "stock.add",
      "materials.confirm",
      "parts.confirm",
    ].includes(type);
  if (user.role === "LEAD_MECHANIC")
    return [
      "service.save",
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
      "workshop.save",
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
  command = structuredClone(command);
  const next = structuredClone(state);
  next.catalogs.reviews = next.catalogs.reviews.map((r) =>
    r.id === "general" && r.intervalDays === 45
      ? { ...r, intervalDays: 30, version: r.version + 1 }
      : r,
  );
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
    case "workshop.save":
      next.workbench = changeWorkshop(
        next.workbench,
        user,
        command.change,
        c.vehicles.map((v) => v.id),
      );
      break;
    case "parts.confirm": {
      const order = next.workbench.orders.find((v) => v.id === command.id);
      if (!order || order.status === "Finalizada")
        throw new Error("Orden no disponible para movimientos de piezas.");
      if (
        !command.lines.length ||
        new Set(command.lines.map((v) => v.partId)).size !==
          command.lines.length
      )
        throw new Error("Revisa las piezas.");
      for (const line of command.lines) {
        if (
          !order.form.orderedParts?.some((v) => v.partId === line.partId) ||
          [line.received, line.delivered, line.returned].some(
            (v) => !Number.isSafeInteger(v) || v < 0,
          )
        )
          throw new Error("Pieza o cantidad inválida.");
        const previous =
          order.partConfirmations
            ?.flatMap((v) => v.lines)
            .filter((v) => v.partId === line.partId) ?? [];
        const sum = (key: "received" | "delivered" | "returned") =>
          previous.reduce((n, v) => n + v[key], 0) + line[key];
        if (
          sum("returned") > sum("delivered") ||
          sum("delivered") - sum("returned") > sum("received")
        )
          throw new Error(
            "Registra recepción antes de entregar y no devuelvas más de lo entregado.",
          );
      }
      if (!command.lines.some((v) => v.received || v.delivered || v.returned))
        throw new Error("Sin movimientos.");
      order.partConfirmations = [
        ...(order.partConfirmations ?? []),
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          actorId: user.id,
          actorName: user.name,
          notes: command.notes,
          lines: command.lines,
        },
      ];
      break;
    }
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
      if (command.input.reportKind) {
        vehicle(command.input.busId);
        next.workbench = addDamage(next.workbench, user, command.input.busId, {
          kind: command.input.reportKind,
          area: command.input.title,
          description: command.input.description,
          date: dateToday(),
        });
        if (command.input.createServiceRequest === false) break;
      }
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
      const errors = validateOrder(
        command.form,
        c.vehicles,
        c.products,
        c.services,
      );
      if (errors.length) throw new Error(errors.join(" "));
      const assignee = command.form.assignee;
      if (!assignee)
        throw new Error("Selecciona un responsable para toda la orden.");
      const directory = workshop(next.workbench);
      const person =
        assignee.kind === "employee"
          ? directory.employees.find((v) => v.id === assignee.id && v.active)
          : directory.suppliers.find(
              (v) => v.id === assignee.id && v.active && v.kind === "service",
            );
      if (!person) throw new Error("Responsable inexistente o inactivo.");
      command.form.assignee = { ...assignee, name: person.name };
      if (command.form.estimatedCompletion) {
        const date = new Date(`${command.form.estimatedCompletion}T12:00:00Z`);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(command.form.estimatedCompletion) ||
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== command.form.estimatedCompletion
        )
          throw new Error("Fecha estimada inválida.");
      }
      for (const p of command.form.orderedParts ?? []) {
        const part = directory.parts.find(
          (v) =>
            v.id === p.partId &&
            v.active &&
            v.vehicleIds.includes(command.form.busId),
        );
        if (!part || !Number.isSafeInteger(p.quantity) || p.quantity <= 0)
          throw new Error("Revisa piezas por pedido y compatibilidad.");
        p.name = part.name;
        p.identifier = part.identifier;
        p.unitCost = part.cost;
        p.supplier = directory.suppliers.find(
          (v) => v.id === part.supplierId,
        )!.name;
      }
      if (
        new Set(command.form.orderedParts?.map((p) => p.partId)).size !==
        (command.form.orderedParts?.length ?? 0)
      )
        throw new Error("No repitas piezas por pedido.");
      for (const s of command.form.services) {
        const definition = c.services.find((v) => v.id === s.catalogId);
        if (definition) {
          s.maintenanceType =
            definition.maintenanceType ??
            (definition.id === "oil-change" ? "preventive" : "corrective");
          s.freeText = false;
        } else if (!s.freeText || !s.catalogId.startsWith("free:"))
          throw new Error("Servicio inexistente.");
      }
      if (
        new Set(command.form.services.map((s) => s.id)).size !==
          command.form.services.length ||
        new Set(command.form.services.map((s) => s.catalogId)).size !==
          command.form.services.length
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
      next.workbench = blockForOrder(
        next.workbench,
        user,
        order.form.busId,
        order.id,
      );
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
      );
      {
        const trip = next.trips.find((v) => v.id === command.id)!;
        const w = structuredClone(workshop(next.workbench));
        const articles = w.articles.filter(
          (v) => v.busId === trip.busId && v.active,
        );
        const counts = command.articleCounts ?? {};
        if (
          articles.some(
            (v) => !Number.isSafeInteger(counts[v.id]) || counts[v.id] < 0,
          ) ||
          Object.keys(counts).some((id) => !articles.some((v) => v.id === id))
        )
          throw new Error(
            "Revisa todos los contadores de artículos de la unidad.",
          );
        const snapshots = articles.map((a) => ({
          articleId: a.id,
          name: a.name,
          category: a.category,
          before: a.quantity,
          quantity: counts[a.id],
        }));
        for (const a of articles)
          if (a.quantity !== counts[a.id]) {
            if (!command.notes.trim())
              throw new Error(
                "Explica los faltantes o recuperaciones de artículos.",
              );
            w.articleMovements.push({
              id: crypto.randomUUID(),
              articleId: a.id,
              busId: trip.busId,
              name: a.name,
              before: a.quantity,
              after: counts[a.id],
              reason: command.notes,
              at: new Date().toISOString(),
              actorId: user.id,
              actorName: user.name,
              tripId: trip.id,
              stage: command.stage,
              driverId: trip.driverId,
            });
            a.quantity = counts[a.id];
          }
        trip[command.stage]!.articles = snapshots;
        trip[command.stage]!.faultKinds = Object.fromEntries(
          Object.entries(command.faultActions ?? {})
            .filter(([id]) => command.answers[id] === "fault")
            .map(([id, action]) => [
              id,
              action === "damage" ? "Golpe" : "Falla",
            ]),
        );
        next.workbench.workshop = w;
        for (const [aspectId, action] of Object.entries(
          command.faultActions ?? {},
        )) {
          const aspect = trip.template!.aspects.find((v) => v.id === aspectId);
          if (!aspect || command.answers[aspectId] !== "fault")
            throw new Error(
              "El reporte debe corresponder a un aspecto con falla.",
            );
          if (action === "request")
            next.workbench.requests.unshift({
              id: crypto.randomUUID(),
              busId: trip.busId,
              title: aspect.text.slice(0, 120),
              description: command.notes,
              odometer: "",
              number: `SOL-${sequence}-${next.workbench.requests.length}`,
              driverId: user.id,
              driverName: user.name,
              createdAt: new Date().toISOString(),
              status: "pending",
              sourceIncidentId: `trip:${trip.id}:${command.stage}:${aspectId}`,
            });
          // El aspecto fallido ya es un reporte persistente en vehicleIncidents; no duplicarlo.
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
