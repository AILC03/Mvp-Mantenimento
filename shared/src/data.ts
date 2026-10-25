import { validServiceQuantity } from "./quantities";

export type Vehicle = {
  id: string;
  fleetNumber: string;
  type: "bus" | "truck";
  brand: string;
  model: string;
  plate: string;
  vin: string;
  year: number | null;
  odometer: number;
  note: string;
};
export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: "L" | "pza";
  cost: number;
  entries: StockEntry[];
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
  priority: "Normal" | "Alta" | "Urgente";
  reason: string;
  scheduledDate: string;
  odometer: string;
  services: OrderService[];
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
  action: "Creada" | "Iniciada" | "Pausada" | "Reanudada" | "Finalizada";
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
  odometer: "",
  services: [],
});

export function isOrderForm(value: unknown): value is OrderForm {
  if (!value || typeof value !== "object") return false;
  const form = value as Record<string, unknown>;
  return (
    typeof form.busId === "string" &&
    typeof form.reason === "string" &&
    typeof form.odometer === "string" &&
    typeof form.scheduledDate === "string" &&
    (form.sourceRequestId === undefined ||
      typeof form.sourceRequestId === "string") &&
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
  { name: "Revisión general", frequency: "Cada 45 días" },
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
