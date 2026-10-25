import type { AuthUser } from "./auth";
import type { ReviewType } from "./catalogs";
import type { Vehicle } from "./data";
import type { Workbench } from "./requests";
import type { TripCase, TripAnswer } from "./trip-reviews";
import { managesOrders, validPastDate } from "./orders";

export type ReviewJob = {
  selfInitiated?: boolean;
  id: string;
  busId: string;
  template: ReviewType;
  requestedAt: string;
  requestedBy: string;
  requestedByName: string;
  requestNotes: string;
  completion: null | {
    date: string;
    recordedAt: string;
    actorId: string;
    actorName: string;
    answers: Record<string, TripAnswer>;
    notes: string;
  };
};
export type Damage = {
  id: string;
  busId: string;
  kind: "Golpe" | "Incidencia";
  area: string;
  description: string;
  date: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
};
export type Resolution = {
  id: string;
  sourceId: string;
  busId: string;
  at: string;
  actorId: string;
  actorName: string;
  notes: string;
  orderId: string;
};
export type CafBaseline = {
  date: string;
  odometer: number;
  reference: string;
  recordedAt: string;
};
export type CafCorrection = {
  id: string;
  busId: string;
  before: CafBaseline | null;
  after: { date: string; odometer: number };
  at: string;
  actorId: string;
  actorName: string;
  reason: string;
};
export type FleetRecords = {
  reviewJobs: ReviewJob[];
  damages: Damage[];
  resolutions: Resolution[];
  cafCorrections: CafCorrection[];
};
export const emptyFleet = (): FleetRecords => ({
  reviewJobs: [],
  damages: [],
  resolutions: [],
  cafCorrections: [],
});
export const fleetRecords = (data: Workbench) => data.fleet ?? emptyFleet();

export function validFleetRecords(value: unknown): FleetRecords {
  if (!value || typeof value !== "object")
    throw new Error("Historial de flota incompatible.");
  const data = value as FleetRecords;
  if (
    !["reviewJobs", "damages", "resolutions", "cafCorrections"].every((key) =>
      Array.isArray((value as Record<string, unknown>)[key]),
    )
  )
    throw new Error("Historial de flota incompatible.");
  if (
    data.reviewJobs.some(
      (job) =>
        !job ||
        typeof job.id !== "string" ||
        typeof job.busId !== "string" ||
        !job.template ||
        !Array.isArray(job.template.aspects) ||
        !job.template.aspects.length,
    ) ||
    data.damages.some(
      (item) =>
        !item ||
        typeof item.id !== "string" ||
        typeof item.busId !== "string" ||
        typeof item.description !== "string",
    ) ||
    data.resolutions.some(
      (item) =>
        !item ||
        typeof item.sourceId !== "string" ||
        typeof item.busId !== "string",
    ) ||
    data.cafCorrections.some(
      (item) =>
        !item ||
        typeof item.busId !== "string" ||
        !item.after ||
        !Number.isSafeInteger(item.after.odometer),
    )
  )
    throw new Error("Historial de flota incompatible.");
  return data;
}

export function currentOdometer(vehicle: Vehicle, data: Workbench): number {
  return Math.max(
    vehicle.odometer,
    ...data.orders
      .filter((order) => order.form.busId === vehicle.id && order.completion)
      .map((order) => order.completion!.odometer),
  );
}
export function lastCaf(busId: string, data: Workbench): CafBaseline | null {
  const events: CafBaseline[] = [];
  for (const order of data.orders.filter(
    (item) =>
      item.form.busId === busId &&
      item.status === "Finalizada" &&
      item.completion,
  )) {
    if (
      order.form.services.some(
        (service) =>
          service.catalogId === "oil-change" &&
          order.completion!.performedServiceIds.includes(service.id),
      )
    )
      events.push({
        date: order.completion!.date,
        odometer: order.completion!.odometer,
        reference: order.number,
        recordedAt: order.completion!.recordedAt,
      });
  }
  const correction = [...fleetRecords(data).cafCorrections]
    .reverse()
    .filter((item) => item.busId === busId)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const eligible = correction
    ? events.filter(
        (event) =>
          event.recordedAt > correction.at &&
          event.date >= correction.after.date &&
          event.odometer >= correction.after.odometer,
      )
    : events;
  const last = eligible.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.odometer - a.odometer ||
      b.recordedAt.localeCompare(a.recordedAt),
  )[0];
  if (last) return last;
  return correction
    ? {
        ...correction.after,
        reference: `Corrección extraordinaria: ${correction.reason}`,
        recordedAt: correction.at,
      }
    : null;
}

export function correctCaf(
  data: Workbench,
  user: AuthUser,
  vehicle: Vehicle,
  input: { date: string; odometer: number; reason: string; confirmed: boolean },
): Workbench {
  if (user.role !== "ADMIN")
    throw new Error("Solo el administrador puede corregir el último CAF.");
  if (!input.confirmed || !input.reason.trim())
    throw new Error(
      "Confirma el carácter extraordinario y explica el motivo de la corrección.",
    );
  if (
    !validPastDate(input.date) ||
    !Number.isSafeInteger(input.odometer) ||
    input.odometer < 0 ||
    input.odometer > currentOdometer(vehicle, data)
  )
    throw new Error(
      "Revisa la fecha y el kilometraje del último CAF; no deben estar en el futuro.",
    );
  const fleet = fleetRecords(data);
  const event: CafCorrection = {
    id: crypto.randomUUID(),
    busId: vehicle.id,
    before: lastCaf(vehicle.id, data),
    after: { date: input.date, odometer: input.odometer },
    at: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    reason: input.reason.trim(),
  };
  return {
    ...data,
    fleet: { ...fleet, cafCorrections: [...fleet.cafCorrections, event] },
  };
}

export function recordPeriodicReview(
  data: Workbench,
  user: AuthUser,
  busId: string,
  template: ReviewType,
  input: { date: string; answers: Record<string, TripAnswer>; notes: string },
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo mecánico o admin realiza revisiones periódicas.");
  if (template.frequency === "trip" || !template.aspects.length)
    throw new Error(
      "Configura primero los aspectos de una revisión periódica.",
    );
  const fleet = fleetRecords(data);
  if (
    !validPastDate(input.date) ||
    template.aspects.some(
      (aspect) => !["good", "fault"].includes(input.answers[aspect.id]),
    )
  )
    throw new Error("Selecciona una fecha válida y evalúa todos los aspectos.");
  const now = new Date().toISOString();
  const job: ReviewJob = {
    selfInitiated: true,
    id: crypto.randomUUID(),
    busId,
    template: structuredClone(template),
    requestedAt: now,
    requestedBy: user.id,
    requestedByName: user.name,
    requestNotes: "",
    completion: {
      ...input,
      notes: input.notes.trim(),
      answers: Object.fromEntries(
        template.aspects.map((aspect) => [aspect.id, input.answers[aspect.id]]),
      ),
      recordedAt: now,
      actorId: user.id,
      actorName: user.name,
    },
  };
  return {
    ...data,
    fleet: { ...fleet, reviewJobs: [job, ...fleet.reviewJobs] },
  };
}

export type IncidentView = {
  sourceId: string;
  busId: string;
  date: string;
  source: string;
  title: string;
  notes: string;
  resolution?: Resolution;
};
export function vehicleIncidents(
  busId: string,
  data: Workbench,
  cases: TripCase[],
): IncidentView[] {
  const fleet = fleetRecords(data);
  const rows: IncidentView[] = fleet.damages
    .filter((item) => item.busId === busId)
    .map((item) => ({
      sourceId: `damage:${item.id}`,
      busId,
      date: item.date,
      source: item.kind,
      title: `${item.area}: ${item.description}`,
      notes: `Registrado por ${item.actorName}`,
    }));
  for (const item of cases.filter(
    (value) => value.busId === busId && value.template,
  ))
    for (const stage of ["pre", "post"] as const) {
      const inspection = item[stage];
      if (inspection)
        for (const aspect of item.template!.aspects.filter(
          (value) => inspection.answers[value.id] === "fault",
        ))
          rows.push({
            sourceId: `trip:${item.id}:${stage}:${aspect.id}`,
            busId,
            date: inspection.submittedAt.slice(0, 10),
            source: `${item.number} · ${stage} trip`,
            title: aspect.text,
            notes: inspection.notes,
          });
    }
  for (const job of fleet.reviewJobs.filter(
    (value) => value.busId === busId && value.completion,
  ))
    for (const aspect of job.template.aspects.filter(
      (value) => job.completion!.answers[value.id] === "fault",
    ))
      rows.push({
        sourceId: `review:${job.id}:${aspect.id}`,
        busId,
        date: job.completion!.date,
        source: job.template.name,
        title: aspect.text,
        notes: job.completion!.notes,
      });
  return rows
    .map((row) => ({
      ...row,
      resolution: fleet.resolutions.find(
        (item) => item.sourceId === row.sourceId,
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function addDamage(
  data: Workbench,
  user: AuthUser,
  vehicleId: string,
  input: {
    kind: Damage["kind"];
    area: string;
    description: string;
    date: string;
  },
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo mecánico o admin registra incidencias de taller.");
  if (
    !input.area.trim() ||
    !input.description.trim() ||
    !validPastDate(input.date)
  )
    throw new Error("Completa parte afectada, descripción y fecha válida.");
  const fleet = fleetRecords(data);
  const damage: Damage = {
    ...input,
    id: crypto.randomUUID(),
    busId: vehicleId,
    recordedAt: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
  };
  return { ...data, fleet: { ...fleet, damages: [damage, ...fleet.damages] } };
}
export function resolveIncident(
  data: Workbench,
  user: AuthUser,
  incident: IncidentView,
  notes: string,
  orderId: string,
): Workbench {
  if (!managesOrders(user))
    throw new Error("Solo mecánico o admin confirma una reparación.");
  const fleet = fleetRecords(data);
  if (fleet.resolutions.some((item) => item.sourceId === incident.sourceId))
    throw new Error("La reparación ya está registrada.");
  if (!notes.trim()) throw new Error("Describe la reparación realizada.");
  if (
    orderId &&
    !data.orders.some(
      (order) =>
        order.id === orderId &&
        order.form.busId === incident.busId &&
        order.status === "Finalizada",
    )
  )
    throw new Error("Selecciona una orden finalizada de la misma unidad.");
  const resolution: Resolution = {
    id: crypto.randomUUID(),
    sourceId: incident.sourceId,
    busId: incident.busId,
    at: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    notes: notes.trim(),
    orderId,
  };
  return {
    ...data,
    fleet: { ...fleet, resolutions: [...fleet.resolutions, resolution] },
  };
}
export function remainingDays(date: string, interval: number): number {
  const now = new Date();
  const day = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) + interval * 86400000 - day) / 86400000,
  );
}
