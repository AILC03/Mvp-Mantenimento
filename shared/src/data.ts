import { validServiceQuantity } from "./quantities";

export type Vehicle = {
  id: string;
  fleetNumber: string;
  // Claves históricas: bus = Autobús; truck = Sprinter de pasajeros (no carga).
  type: "bus" | "truck";
  brand: string;
  model: string;
  plate: string;
  vin: string;
  year: number | null;
  odometer: number;
  note: string;
};
export const vehicleTypeLabel = (type: Vehicle["type"]) =>
  type === "truck" ? "Sprinter" : "Autobús";

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: "L" | "pza";
  cost: number;
  // Opcional para registros previos; null = sin mínimo/máximo configurado.
  minStock?: number | null;
  maxStock?: number | null;
  entries: StockEntry[];
};
// Catálogos ampliados (empleados, proveedores y piezas con número de parte).
export type Employee = {
  id: string;
  name: string;
  position: string;
  phone: string;
  active?: boolean;
};
export type Provider = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  kind?: "service" | "material" | "both";
};
export type VehiclePart = {
  id: string;
  partNumber: string;
  name: string;
  note: string;
  // Compatibilidad con una o más unidades del catálogo.
  compatibleVehicleIds: string[];
};
// Pieza solicitada en una orden: no descuenta almacén ni exige existencias.
export type PartMaterial = {
  id: string;
  partId: string;
  partNumber: string;
  name: string;
  quantity: number;
};
export type ResponsibleRef = {
  kind: "taller" | "externo";
  refId: string;
  name: string;
};
export type StockEntry = {
  id: string;
  quantity: number;
  unitCost: number;
  occurredOn: string;
  supplier: string;
  receiptReference: string;
  createdAt: string;
};
export type CatalogService = {
  id: string;
  name: string;
  category: string;
  hours: number;
  description: string;
  materials: { productId: string; quantity: number }[];
  compatibleVehicleIds: string[];
};
export const buses: Vehicle[] = [
  {
    id: "BUS015",
    fleetNumber: "BUS015",
    type: "bus",
    brand: "Volvo",
    vin: "",
    model: "Volvo 9800",
    plate: "DEMO-015",
    year: 2022,
    odometer: 184520,
    note: "Golpe superficial en defensa trasera. Incidencia conocida; no determina por sí sola la disponibilidad técnica.",
  },
  {
    id: "BUS008",
    fleetNumber: "BUS008",
    type: "bus",
    brand: "Irizar",
    vin: "",
    model: "Irizar i8",
    plate: "DEMO-008",
    year: 2021,
    odometer: 236810,
    note: "Desgaste en tapicería de asiento 12. Pendiente de evaluación del mecánico.",
  },
  {
    id: "BUS023",
    fleetNumber: "BUS023",
    type: "bus",
    brand: "Mercedes-Benz",
    vin: "",
    model: "Mercedes-Benz Marcopolo",
    plate: "DEMO-023",
    year: 2023,
    odometer: 98340,
    note: "Sin incidencias en estos datos de demostración.",
  },
];

export const technicians = [
  "Carlos Méndez · Mecánico",
  "Luis Ramírez · Electricista",
  "Jorge Soto · Carrocero",
];
export const products: Product[] = [
  {
    id: "oil",
    sku: "ACE-001",
    name: "Aceite de motor 15W-40",
    description: "",
    unit: "L",
    cost: 115,
    entries: [],
  },
  {
    id: "filter",
    sku: "FIL-001",
    name: "Filtro de aceite",
    description: "",
    unit: "pza",
    cost: 480,
    entries: [],
  },
  {
    id: "air",
    sku: "FIL-002",
    name: "Filtro de aire",
    description: "",
    unit: "pza",
    cost: 850,
    entries: [],
  },
  {
    id: "fluid",
    sku: "LIQ-001",
    name: "Líquido de frenos",
    description: "",
    unit: "L",
    cost: 180,
    entries: [],
  },
];

export const catalog: CatalogService[] = [
  {
    id: "oil-change",
    compatibleVehicleIds: [],
    name: "CAF · Cambio de aceite y filtro",
    category: "Motor",
    hours: 2,
    description: "Drenar aceite, sustituir filtro y verificar nivel y fugas.",
    materials: [
      { productId: "oil", quantity: 28 },
      { productId: "filter", quantity: 1 },
    ],
  },
  {
    id: "brakes",
    compatibleVehicleIds: [],
    name: "Diagnóstico y reparación de frenos",
    category: "Frenos",
    hours: 1.5,
    description:
      "Revisar desgaste, conexiones y funcionamiento. Registrar diagnóstico.",
    materials: [],
  },
  {
    id: "electric",
    compatibleVehicleIds: [],
    name: "Diagnóstico eléctrico",
    category: "Electricidad",
    hours: 1,
    description: "Inspeccionar iluminación y conexiones; documentar anomalías.",
    materials: [],
  },
  {
    id: "body",
    compatibleVehicleIds: [],
    name: "Reparación de carrocería",
    category: "Carrocería",
    hours: 3,
    description: "Evaluar daño y definir intervención antes de ejecutar.",
    materials: [],
  },
  {
    id: "air-filter",
    compatibleVehicleIds: [],
    name: "Cambio de filtro de aire",
    category: "Motor",
    hours: 0.5,
    description: "Sustituir filtro y revisar alojamiento y sellos.",
    materials: [{ productId: "air", quantity: 1 }],
  },
];

export type Material = {
  id: string;
  productId: string;
  quantity: number;
  unitCost?: number;
};
export type OrderService = {
  id: string;
  catalogId: string;
  name: string;
  category: string;
  hours: number;
  assignee: string;
  instructions: string;
  materials: Material[];
};
export type OrderForm = {
  busId: string;
  sourceRequestId?: string;
  sourceIncidentId?: string;
  priority: "Normal" | "Alta" | "Urgente";
  reason: string;
  scheduledDate: string;
  odometer: string;
  services: OrderService[];
  // Opcionales para órdenes previas a esta ampliación.
  responsible?: ResponsibleRef | null;
  estimatedEndDate?: string;
  partMaterials?: PartMaterial[];
};
export type OrderStatus =
  | "Pendiente de liberación"
  | "Lista para iniciar"
  | "En proceso"
  | "Pausada"
  | "Finalizada";
export type OrderEvent = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action:
    | "Creada"
    | "Iniciada"
    | "Pausada"
    | "Reanudada"
    | "Finalizada"
    | "Ajuste de materiales";
  notes: string;
};
export type MaterialConfirmation = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  notes: string;
  lines: {
    productId: string;
    name: string;
    sku: string;
    unit: Product["unit"];
    delivered: number;
    returned: number;
    unitCost: number;
  }[];
};
export type SavedOrder = {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  createdBy?: { id: string; name: string };
  events?: OrderEvent[];
  materialConfirmations?: MaterialConfirmation[];
  completion?: {
    date: string;
    odometer: number;
    performedServiceIds: string[];
    unperformedReasons: Record<string, string>;
    notes: string;
    actorId: string;
    actorName: string;
    recordedAt: string;
  };
  form: OrderForm;
};

export const emptyForm = (): OrderForm => ({
  busId: "",
  priority: "Normal",
  reason: "",
  scheduledDate: "",
  estimatedEndDate: new Date().toLocaleDateString("en-CA"),
  odometer: "",
  services: [],
});

export function isOrderForm(value: unknown): value is OrderForm {
  if (!value || typeof value !== "object") return false;
  const form = value as Record<string, unknown>;
  const responsible = form.responsible;
  const validResponsible =
    responsible === undefined ||
    responsible === null ||
    (typeof responsible === "object" &&
      ["taller", "externo"].includes(
        String((responsible as Record<string, unknown>).kind),
      ) &&
      typeof (responsible as Record<string, unknown>).refId === "string" &&
      typeof (responsible as Record<string, unknown>).name === "string");
  const validParts =
    form.partMaterials === undefined ||
    (Array.isArray(form.partMaterials) &&
      form.partMaterials.every((part: unknown) => {
        if (!part || typeof part !== "object") return false;
        const row = part as Record<string, unknown>;
        return (
          [row.id, row.partId, row.partNumber, row.name].every(
            (field) => typeof field === "string" && field.length > 0,
          ) &&
          typeof row.quantity === "number" &&
          Number.isFinite(row.quantity) &&
          row.quantity > 0 &&
          Number.isInteger(row.quantity)
        );
      }));
  return (
    typeof form.busId === "string" &&
    typeof form.reason === "string" &&
    typeof form.odometer === "string" &&
    typeof form.scheduledDate === "string" &&
    (form.sourceRequestId === undefined ||
      typeof form.sourceRequestId === "string") &&
    (form.sourceIncidentId === undefined ||
      typeof form.sourceIncidentId === "string") &&
    (form.estimatedEndDate === undefined ||
      typeof form.estimatedEndDate === "string") &&
    validResponsible &&
    validParts &&
    ["Normal", "Alta", "Urgente"].includes(String(form.priority)) &&
    Array.isArray(form.services) &&
    form.services.every((service: unknown) => {
      if (!service || typeof service !== "object") return false;
      const item = service as Record<string, unknown>;
      return (
        [
          "id",
          "catalogId",
          "name",
          "category",
          "assignee",
          "instructions",
        ].every((key) => typeof item[key] === "string") &&
        typeof item.hours === "number" &&
        Number.isFinite(item.hours) &&
        Array.isArray(item.materials) &&
        item.materials.every((material: unknown) => {
          if (!material || typeof material !== "object") return false;
          const row = material as Record<string, unknown>;
          return (
            typeof row.id === "string" &&
            typeof row.productId === "string" &&
            (row.unitCost === undefined ||
              (typeof row.unitCost === "number" &&
                Number.isFinite(row.unitCost) &&
                row.unitCost >= 0)) &&
            typeof row.quantity === "number" &&
            Number.isFinite(row.quantity)
          );
        })
      );
    })
  );
}

const realDate = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

export function validateOrder(
  form: OrderForm,
  vehicles: Vehicle[] = buses,
  articles: Product[] = products,
  services: CatalogService[] = catalog,
): string[] {
  const errors: string[] = [];
  if (!vehicles.some((bus) => bus.id === form.busId))
    errors.push("Selecciona una unidad.");
  if (form.reason.trim().length > 2000)
    errors.push(
      "Las observaciones de la orden admiten hasta 2000 caracteres. El reporte original se conserva.",
    );
  if (
    !form.odometer.trim() ||
    !Number.isSafeInteger(Number(form.odometer)) ||
    Number(form.odometer) < 0
  )
    errors.push("Ingresa un kilometraje entero igual o mayor a cero.");
  if (!form.services.length) errors.push("Agrega al menos un servicio.");
  if (
    form.services.some(
      (service) => !Number.isFinite(service.hours) || service.hours <= 0,
    )
  )
    errors.push("El tiempo estimado de cada servicio debe ser mayor a cero.");
  // Servicios correctivos de texto libre: sin definición de catálogo.
  if (
    form.services.some(
      (service) =>
        service.catalogId === "" &&
        (!service.name.trim() ||
          service.name.trim().length > 150 ||
          !service.category.trim() ||
          service.category.trim().length > 150),
    )
  )
    errors.push(
      "Cada servicio correctivo de texto libre necesita nombre y categoría (máximo 150 caracteres).",
    );
  if (
    form.services.some(
      (s) =>
        s.catalogId === "" &&
        /\bCAF\b|CAMBIO\s+DE\s+ACEITE\s+Y\s+FILTRO/i.test(s.name),
    )
  )
    errors.push("Para CAF utiliza el servicio preventivo del catálogo.");
  if (
    form.services.some((service) =>
      service.materials.some(
        (material) =>
          !articles.some((product) => product.id === material.productId) ||
          (articles.find((product) => product.id === material.productId)
            ?.unit === "pza" &&
            !Number.isInteger(material.quantity)) ||
          !validServiceQuantity(
            material.quantity,
            articles.find((product) => product.id === material.productId)
              ?.unit ?? "pza",
          ),
      ),
    )
  )
    errors.push("Revisa los productos y cantidades de los materiales.");
  if (
    form.services.some((service) => {
      if (service.catalogId === "") return false;
      const definition = services.find((item) => item.id === service.catalogId);
      return (
        !definition ||
        (definition.compatibleVehicleIds.length > 0 &&
          !definition.compatibleVehicleIds.includes(form.busId))
      );
    })
  )
    errors.push(
      "Revisa la compatibilidad de los servicios con la unidad seleccionada.",
    );
  if (form.estimatedEndDate === undefined || !form.estimatedEndDate.trim())
    errors.push("Indica la fecha estimada de término del trabajo.");
  else if (!realDate(form.estimatedEndDate))
    errors.push("La fecha estimada de término no es una fecha válida.");
  else if (
    form.scheduledDate.trim() &&
    realDate(form.scheduledDate) &&
    form.estimatedEndDate < form.scheduledDate
  )
    errors.push(
      "La fecha estimada de término no puede ser anterior a la fecha programada.",
    );
  if (form.responsible != null) {
    if (!["taller", "externo"].includes(form.responsible.kind))
      errors.push("Selecciona un responsable de taller o externo.");
    if (!form.responsible.name.trim())
      errors.push("Selecciona el responsable del trabajo.");
  }
  if (
    form.partMaterials?.some(
      (part) =>
        !part.partId ||
        !part.name.trim() ||
        !Number.isInteger(part.quantity) ||
        part.quantity <= 0,
    )
  )
    errors.push(
      "Revisa las piezas solicitadas: cantidad entera mayor a cero por pieza.",
    );
  return errors;
}

export function maintenanceLabel(services: OrderService[]): string {
  if (!services.length) return "Por definir";
  const hasCaf = services.some((service) => service.catalogId === "oil-change");
  const hasCorrective = services.some(
    (service) => service.catalogId !== "oil-change",
  );
  return hasCaf && hasCorrective
    ? "CAF + correctivos"
    : hasCaf
      ? "Preventivo · CAF"
      : "Correctivo";
}

export const scheduledReviews = [
  { name: "Revisión general", frequency: "Cada 30 días" },
  { name: "Salidas de emergencia", frequency: "Cada 90 días" },
  { name: "Revisión anual", frequency: "Anual" },
  { name: "Revisión de viaje", frequency: "Cada viaje" },
];

export function materialTotal(
  services: OrderService[],
  articles: Product[] = products,
): number {
  return services.reduce(
    (total, service) =>
      total +
      service.materials.reduce(
        (sum, material) =>
          sum +
          (material.unitCost ??
            articles.find((product) => product.id === material.productId)
              ?.cost ??
            0) *
            (Number.isFinite(material.quantity) ? material.quantity : 0),
        0,
      ),
    0,
  );
}

export const currency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );
