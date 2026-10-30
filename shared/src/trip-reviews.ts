import type { AuthUser } from "./auth";
import type { ReviewType } from "./catalogs";
import type { Vehicle } from "./data";
import { domainStorage } from "./storage";

export type TripAnswer = "good" | "fault";
export type TripInspection = {
  answers: Record<string, TripAnswer>;
  notes: string;
  submittedAt: string;
  submittedBy: string;
};
export type TripCase = {
  id: string;
  number: string;
  busId: string;
  fleetNumber: string;
  driverId: string;
  driverName: string;
  departureDate: string;
  returnDate: string;
  createdAt: string;
  template: ReviewType | null;
  pre: TripInspection | null;
  post: TripInspection | null;
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  closingNotes: string;
};
export const TRIP_CASES_KEY = "real-ejecutivo.demo.trip-cases.v1";
export const canCloseTrip = (user: AuthUser) =>
  user.role === "LEAD_MECHANIC" || user.role === "ADMIN";
export const tripStatus = (item: TripCase) =>
  item.closedAt
    ? "Cierre de caso"
    : item.pre && item.post
      ? "Pendiente de revisión"
      : item.pre
        ? "Post trip pendiente"
        : "Pre trip pendiente";

function validDate(value: string): boolean {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function loadTripCases(raw?: string | null): TripCase[] {
  const stored =
    raw === undefined ? domainStorage().getItem(TRIP_CASES_KEY) : raw;
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error();
    for (const value of parsed) {
      if (!value || typeof value !== "object") throw new Error();
      const item = value as TripCase;
      if (
        ![
          "id",
          "number",
          "busId",
          "fleetNumber",
          "driverId",
          "driverName",
          "departureDate",
          "returnDate",
          "createdAt",
          "closingNotes",
        ].every(
          (key) => typeof (value as Record<string, unknown>)[key] === "string",
        ) ||
        !validDate(item.departureDate) ||
        !validDate(item.returnDate) ||
        item.returnDate < item.departureDate
      )
        throw new Error();
      if (
        item.template !== null &&
        (!item.template ||
          item.template.frequency !== "trip" ||
          typeof item.template.name !== "string" ||
          !Array.isArray(item.template.aspects) ||
          !item.template.aspects.length ||
          !item.template.aspects.every(
            (aspect) =>
              typeof aspect.id === "string" &&
              typeof aspect.text === "string" &&
              aspect.text.trim(),
          ))
      )
        throw new Error();
      for (const stage of ["pre", "post"] as const) {
        const inspection = item[stage];
        if (
          inspection !== null &&
          (!inspection ||
            !item.template ||
            typeof inspection.notes !== "string" ||
            typeof inspection.submittedAt !== "string" ||
            inspection.submittedBy !== item.driverId ||
            !inspection.answers ||
            item.template.aspects.some(
              (aspect) =>
                !["good", "fault"].includes(inspection.answers[aspect.id]),
            ))
        )
          throw new Error();
      }
      if (item.post && !item.pre) throw new Error();
      if (
        (item.closedAt === null) !== (item.closedBy === null) ||
        (item.closedAt !== null &&
          (typeof item.closedAt !== "string" ||
            !item.pre ||
            !item.post ||
            !item.closedBy ||
            typeof item.closedBy.id !== "string" ||
            typeof item.closedBy.name !== "string"))
      )
        throw new Error();
    }
    return parsed as TripCase[];
  } catch {
    throw new Error(
      "No se pudieron leer los casos de revisión locales. No se sobrescribieron los datos.",
    );
  }
}

export function persistTripCases(cases: TripCase[]): void {
  domainStorage().setItem(TRIP_CASES_KEY, JSON.stringify(cases));
}

export function startTripCase(
  cases: TripCase[],
  user: AuthUser,
  input: { busId: string; departureDate: string; returnDate: string },
  vehicles: Vehicle[],
): TripCase[] {
  if (user.role !== "DRIVER")
    throw new Error("Solo el chofer inicia un caso de revisión de su viaje.");
  const bus = vehicles.find((vehicle) => vehicle.id === input.busId);
  if (!bus) throw new Error("Selecciona una unidad para el viaje.");
  if (
    !validDate(input.departureDate) ||
    !validDate(input.returnDate) ||
    input.returnDate < input.departureDate
  )
    throw new Error(
      "Captura fechas válidas; el regreso no puede ser anterior a la ida.",
    );
  if (cases.some((item) => item.busId === bus.id && !item.closedAt))
    throw new Error(
      "Esta unidad ya tiene un caso abierto. Debe cerrarse antes de iniciar otro.",
    );
  const id = crypto.randomUUID();
  const item: TripCase = {
    id,
    number: `REV-DEMO-${id.slice(0, 8).toUpperCase()}`,
    busId: bus.id,
    fleetNumber: bus.fleetNumber,
    driverId: user.id,
    driverName: user.name,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    createdAt: new Date().toISOString(),
    template: null,
    pre: null,
    post: null,
    closedAt: null,
    closedBy: null,
    closingNotes: "",
  };
  return [item, ...cases];
}

export function submitTripInspection(
  cases: TripCase[],
  user: AuthUser,
  caseId: string,
  stage: "pre" | "post",
  answers: Record<string, TripAnswer>,
  notes: string,
  template?: ReviewType,
): TripCase[] {
  const item = cases.find((value) => value.id === caseId);
  if (!item || user.role !== "DRIVER" || item.driverId !== user.id)
    throw new Error("Solo el chofer del caso puede capturar sus revisiones.");
  if (item.closedAt || item[stage])
    throw new Error("Esta revisión ya fue enviada o el caso está cerrado.");
  if (stage === "post" && !item.pre)
    throw new Error("Realiza primero la revisión pre trip.");
  const definition = item.template ?? template;
  if (
    !definition ||
    definition.frequency !== "trip" ||
    !definition.aspects.length
  )
    throw new Error(
      "El mecánico o administrador debe definir los aspectos de una revisión de viaje antes de capturarla.",
    );
  if (
    definition.aspects.some(
      (aspect) => !["good", "fault"].includes(answers[aspect.id]),
    )
  )
    throw new Error("Marca Bien o Con falla en todos los aspectos.");
  if (notes.length > 2000)
    throw new Error("Las observaciones admiten hasta 2000 caracteres.");
  const inspection: TripInspection = {
    answers: Object.fromEntries(
      definition.aspects.map((aspect) => [aspect.id, answers[aspect.id]]),
    ),
    notes: notes.trim(),
    submittedAt: new Date().toISOString(),
    submittedBy: user.id,
  };
  return cases.map((value) =>
    value.id === caseId
      ? { ...value, template: structuredClone(definition), [stage]: inspection }
      : value,
  );
}

export function closeTripCase(
  cases: TripCase[],
  user: AuthUser,
  caseId: string,
  notes: string,
): TripCase[] {
  if (!canCloseTrip(user))
    throw new Error(
      "Solo el mecánico principal o administrador puede cerrar el caso.",
    );
  const item = cases.find((value) => value.id === caseId);
  if (!item || item.closedAt || !item.pre || !item.post)
    throw new Error(
      "El caso debe tener ambas revisiones y estar pendiente de revisión para cerrarse.",
    );
  if (notes.length > 2000)
    throw new Error(
      "Las observaciones de cierre admiten hasta 2000 caracteres.",
    );
  return cases.map((value) =>
    value.id === caseId
      ? {
          ...value,
          closedAt: new Date().toISOString(),
          closedBy: { id: user.id, name: user.name },
          closingNotes: notes.trim(),
        }
      : value,
  );
}
