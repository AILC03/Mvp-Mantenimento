import {
  buses,
  catalog,
  products,
  type Vehicle,
  type Product,
  type StockEntry,
  type CatalogService,
  type Employee,
  type Provider,
  type VehiclePart,
} from "./data";
import { validServiceQuantity } from "./quantities";
import { domainStorage } from "./storage";

export type ReviewAspect = { id: string; text: string };
export type ReviewType = {
  id: string;
  name: string;
  description: string;
  frequency: "days" | "yearly" | "trip";
  intervalDays: number | null;
  aspects: ReviewAspect[];
  version: number;
};
export type Catalogs = {
  version: 1;
  vehicles: Vehicle[];
  products: Product[];
  services: CatalogService[];
  reviews: ReviewType[];
  // Ausentes en snapshots antiguos: se completan al cargar (ver normalizeCatalogs).
  employees: Employee[];
  providers: Provider[];
  vehicleParts: VehiclePart[];
};
export type CatalogSection =
  | "materials"
  | "vehicles"
  | "services"
  | "reviews"
  | "employees"
  | "providers"
  | "parts";
export const CATALOGS_KEY = "real-ejecutivo.demo.catalogs.v1";
export const defaultCatalogs = (): Catalogs =>
  normalizeCatalogs(
    structuredClone({
      version: 1,
      vehicles: buses,
      products,
      services: catalog,
      employees: [],
      providers: [],
      vehicleParts: [],
      reviews: [
        {
          id: "general",
          name: "Revisión general",
          description: "",
          frequency: "days",
          intervalDays: 30,
          aspects: [],
          version: 1,
        },
        {
          id: "emergency",
          name: "Salidas de emergencia",
          description: "",
          frequency: "days",
          intervalDays: 90,
          aspects: [],
          version: 1,
        },
        {
          id: "annual",
          name: "Revisión anual",
          description: "",
          frequency: "yearly",
          intervalDays: null,
          aspects: [],
          version: 1,
        },
        {
          id: "trip",
          name: "Revisión de viaje",
          description: "",
          frequency: "trip",
          intervalDays: null,
          aspects: [],
          version: 1,
        },
      ],
    }),
  );

const normalized = (value: string) => value.trim().toLocaleUpperCase("es-MX");
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const texts = (value: Record<string, unknown>, fields: string[]) =>
  fields.every((field) => typeof value[field] === "string");

// Validar el formato almacenado sin descartar silenciosamente altas existentes.
export function loadCatalogs(
  raw?: string | null,
  projection = false,
): Catalogs {
  const stored =
    raw === undefined ? domainStorage().getItem(CATALOGS_KEY) : raw;
  if (!stored) return defaultCatalogs();
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Los catálogos locales no se pueden leer. No se sobrescribieron los datos.",
    );
  }
  const valid =
    record(value) &&
    value.version === 1 &&
    Array.isArray(value.vehicles) &&
    value.vehicles.every(
      (item) =>
        record(item) &&
        texts(item, [
          "id",
          "fleetNumber",
          "brand",
          "model",
          "plate",
          "vin",
          "note",
        ]) &&
        ["bus", "truck"].includes(String(item.type)) &&
        finite(item.odometer) &&
        (item.year === null || finite(item.year)),
    ) &&
    Array.isArray(value.products) &&
    value.products.every(
      (item) =>
        record(item) &&
        texts(item, ["id", "sku", "name", "description"]) &&
        ["pza", "L"].includes(String(item.unit)) &&
        finite(item.cost) &&
        (item.minStock === undefined ||
          item.minStock === null ||
          (finite(item.minStock) && item.minStock >= 0)) &&
        (item.maxStock === undefined ||
          item.maxStock === null ||
          (finite(item.maxStock) && item.maxStock >= 0)) &&
        Array.isArray(item.entries) &&
        item.entries.every(
          (entry) =>
            record(entry) &&
            texts(entry, [
              "id",
              "occurredOn",
              "supplier",
              "receiptReference",
              "createdAt",
            ]) &&
            finite(entry.quantity) &&
            finite(entry.unitCost),
        ),
    ) &&
    Array.isArray(value.services) &&
    value.services.every(
      (item) =>
        record(item) &&
        texts(item, ["id", "name", "category", "description"]) &&
        finite(item.hours) &&
        Array.isArray(item.compatibleVehicleIds) &&
        item.compatibleVehicleIds.every((id) => typeof id === "string") &&
        Array.isArray(item.materials) &&
        item.materials.every(
          (material) =>
            record(material) &&
            typeof material.productId === "string" &&
            finite(material.quantity),
        ),
    ) &&
    (value.services.filter((item) => item.id === "oil-change").length === 1 ||
      (projection && value.services.length === 0)) &&
    Array.isArray(value.reviews) &&
    value.reviews.every(
      (item) =>
        record(item) &&
        texts(item, ["id", "name", "description"]) &&
        ["days", "yearly", "trip"].includes(String(item.frequency)) &&
        (item.intervalDays === null || finite(item.intervalDays)) &&
        finite(item.version) &&
        Array.isArray(item.aspects) &&
        item.aspects.every(
          (aspect) => record(aspect) && texts(aspect, ["id", "text"]),
        ),
    ) &&
    (value.employees === undefined ||
      (Array.isArray(value.employees) &&
        value.employees.every(
          (item) =>
            record(item) && texts(item, ["id", "name", "position", "phone"]),
        ))) &&
    (value.providers === undefined ||
      (Array.isArray(value.providers) &&
        value.providers.every(
          (item) =>
            record(item) && texts(item, ["id", "name", "contact", "phone"]),
        ))) &&
    (value.vehicleParts === undefined ||
      (Array.isArray(value.vehicleParts) &&
        value.vehicleParts.every(
          (item) =>
            record(item) &&
            texts(item, ["id", "partNumber", "name", "note"]) &&
            Array.isArray(item.compatibleVehicleIds) &&
            item.compatibleVehicleIds.every(
              (vehicleId) => typeof vehicleId === "string",
            ),
        )));
  if (!valid)
    throw new Error(
      "Los catálogos locales tienen un formato incompatible. No se sobrescribieron los datos.",
    );
  // Completar catálogos ampliados, VINs generados y la revisión general a 30 días.
  const data = normalizeCatalogs(value as Catalogs);
  const uniqueIds = (items: { id: string }[]) =>
    new Set(items.map((item) => item.id)).size === items.length;
  const referencesValid =
    [
      data.vehicles,
      data.products,
      data.services,
      data.reviews,
      data.employees,
      data.providers,
      data.vehicleParts,
    ].every(uniqueIds) &&
    data.vehicles.every(
      (vehicle) =>
        Number.isSafeInteger(vehicle.odometer) && vehicle.odometer >= 0,
    ) &&
    data.products.every(
      (product) =>
        product.cost >= 0 &&
        product.entries.every(
          (entry) =>
            entry.quantity > 0 &&
            entry.unitCost >= 0 &&
            (product.unit !== "pza" || Number.isInteger(entry.quantity)),
        ),
    ) &&
    data.services.every(
      (service) =>
        service.hours > 0 &&
        service.compatibleVehicleIds.every((id) =>
          data.vehicles.some((vehicle) => vehicle.id === id),
        ) &&
        service.materials.every((material) => {
          const product = data.products.find(
            (item) => item.id === material.productId,
          );
          return (
            product &&
            material.quantity > 0 &&
            (product.unit !== "pza" || Number.isInteger(material.quantity))
          );
        }),
    ) &&
    data.reviews.every(
      (review) =>
        uniqueIds(review.aspects) &&
        (review.frequency !== "days" ||
          (Number.isSafeInteger(review.intervalDays) &&
            review.intervalDays! > 0)),
    );
  if (!referencesValid)
    throw new Error(
      "Los catálogos locales contienen referencias o cantidades incompatibles. No se sobrescribieron los datos.",
    );
  for (const employee of data.employees)
    saveEmployee(data, employee, employee.id);
  for (const provider of data.providers)
    saveProvider(data, provider, provider.id);
  for (const part of data.vehicleParts) saveVehiclePart(data, part, part.id);
  for (const product of data.products)
    saveProduct(
      data,
      product,
      {
        quantity: 0,
        unitCost: product.cost,
        occurredOn: "",
        supplier: "",
        receiptReference: "",
      },
      product.id,
    );
  return data;
}

export function persistCatalogs(value: Catalogs): void {
  domainStorage().setItem(CATALOGS_KEY, JSON.stringify(value));
}

// Catálogos ampliados sin migración destructiva: se completan al leer.
// Los VIN faltantes de unidades existentes se inventan de forma determinista
// (mismo id ⇒ mismo VIN) para que servidor y navegador coincidan.
const VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // Sin I, O ni Q.
function generatedVin(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const bytes: number[] = [];
  for (let round = 0; bytes.length < 17; round++) {
    const source = `${seed}#${round}`;
    for (let i = 0; i < source.length; i++) {
      h1 = Math.imul(h1 ^ source.charCodeAt(i), 16777619) >>> 0;
      h2 =
        (Math.imul(h2 + source.charCodeAt(i) * (i + 1 + round), 2246822519) ^
          (h1 >>> 7)) >>>
        0;
    }
    bytes.push(
      h1 & 0xff,
      h2 & 0xff,
      (h1 >>> 8) & 0xff,
      (h2 >>> 8) & 0xff,
      (h1 >>> 16) & 0xff,
    );
  }
  return bytes
    .slice(0, 17)
    .map((byte) => VIN_ALPHABET[byte % VIN_ALPHABET.length])
    .join("");
}

export function normalizeCatalogs(data: Catalogs): Catalogs {
  const employees = data.employees === undefined ? [] : data.employees;
  const providers = data.providers === undefined ? [] : data.providers;
  const vehicleParts = data.vehicleParts === undefined ? [] : data.vehicleParts;
  const vehicles = data.vehicles;
  if (
    ![employees, providers, vehicleParts, vehicles, data.reviews].every(
      Array.isArray,
    )
  )
    throw new Error("Catálogos incompatibles; no se descartaron registros.");
  const used = new Set(
    vehicles
      .map((vehicle) =>
        String(vehicle.vin ?? "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );
  const withVin = vehicles.map((vehicle) => {
    const current = String(vehicle.vin ?? "")
      .trim()
      .toUpperCase();
    if (current)
      return current === vehicle.vin ? vehicle : { ...vehicle, vin: current };
    let candidate = generatedVin(vehicle.id);
    let salt = 0;
    while (used.has(candidate))
      candidate = generatedVin(`${vehicle.id}:${++salt}`);
    used.add(candidate);
    return { ...vehicle, vin: candidate };
  });
  const reviews = data.reviews;
  return {
    ...data,
    vehicles: withVin,
    employees,
    providers,
    vehicleParts,
    // Ajuste aprobado: la revisión general guardada pasa de 45 a 30 días.
    reviews: reviews.map((review) =>
      review.id === "general" &&
      review.frequency === "days" &&
      review.intervalDays === 45
        ? { ...review, intervalDays: 30, version: review.version + 1 }
        : review,
    ),
  };
}
export const stock = (product: Product) =>
  product.entries.reduce((sum, entry) => sum + entry.quantity, 0);
export const reviewFrequency = (review: ReviewType) =>
  review.frequency === "days"
    ? `Cada ${review.intervalDays} días`
    : review.frequency === "yearly"
      ? "Anual"
      : "Cada viaje";

export function saveVehicle(
  data: Catalogs,
  input: Omit<Vehicle, "id">,
  id?: string,
): Catalogs {
  const fleetNumber = normalized(input.fleetNumber);
  const plate = normalized(input.plate);
  const vin = normalized(input.vin);
  if (!fleetNumber || fleetNumber.length > 30)
    throw new Error("Escribe un número económico de hasta 30 caracteres.");
  if (!vin)
    throw new Error(
      "El VIN es obligatorio. Las unidades existentes conservan el VIN que se les generó.",
    );
  if (
    data.vehicles.some(
      (item) => item.id !== id && normalized(item.fleetNumber) === fleetNumber,
    )
  )
    throw new Error("El número económico ya está registrado en otra unidad.");
  if (
    plate &&
    data.vehicles.some(
      (item) => item.id !== id && normalized(item.plate) === plate,
    )
  )
    throw new Error("Las placas ya están registradas.");
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))
    throw new Error("El VIN debe tener 17 caracteres válidos, sin I, O ni Q.");
  if (
    data.vehicles.some((item) => item.id !== id && normalized(item.vin) === vin)
  )
    throw new Error("El VIN ya está registrado.");
  if (!["bus", "truck"].includes(input.type))
    throw new Error("Selecciona Autobús o Sprinter.");
  if (!Number.isSafeInteger(input.odometer) || input.odometer < 0)
    throw new Error("El odómetro debe ser un entero igual o mayor a cero.");
  if (
    input.year !== null &&
    (!Number.isInteger(input.year) ||
      input.year < 1900 ||
      input.year > new Date().getFullYear() + 1)
  )
    throw new Error("Revisa el año de la unidad.");
  const old = data.vehicles.find((item) => item.id === id);
  if (id && !old) throw new Error("La unidad ya no está disponible.");
  const vehicle: Vehicle = {
    ...input,
    id: old?.id ?? crypto.randomUUID(),
    fleetNumber,
    plate,
    vin,
    brand: input.brand.trim(),
    model: input.model.trim(),
    note: input.note.trim(),
  };
  return {
    ...data,
    vehicles: old
      ? data.vehicles.map((item) => (item.id === id ? vehicle : item))
      : [...data.vehicles, vehicle],
  };
}

export type EntryInput = Omit<StockEntry, "id" | "createdAt">;
function validateEntry(
  input: EntryInput,
  unit: Product["unit"],
  allowZero = false,
): void {
  if (
    !finite(input.quantity) ||
    input.quantity < 0 ||
    (!allowZero && input.quantity === 0) ||
    (unit === "pza" && !Number.isInteger(input.quantity))
  )
    throw new Error(
      "La cantidad debe ser positiva; las piezas deben ser enteras.",
    );
  if (
    !finite(input.unitCost) ||
    input.unitCost < 0 ||
    Math.abs(input.unitCost * 100 - Math.round(input.unitCost * 100)) > 0.000001
  )
    throw new Error(
      "El costo unitario debe ser no negativo y tener máximo dos decimales.",
    );
  const entryDate = new Date(`${input.occurredOn}T12:00:00Z`);
  if (
    input.quantity > 0 &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) ||
      !Number.isFinite(entryDate.getTime()) ||
      entryDate.toISOString().slice(0, 10) !== input.occurredOn)
  )
    throw new Error("Selecciona una fecha válida para la entrada.");
}

export function addStockEntry(
  data: Catalogs,
  productId: string,
  input: EntryInput,
): Catalogs {
  const product = data.products.find((item) => item.id === productId);
  if (!product) throw new Error("El artículo no existe.");
  validateEntry(input, product.unit);
  const entry: StockEntry = {
    ...input,
    supplier: input.supplier.trim(),
    receiptReference: input.receiptReference.trim(),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  return {
    ...data,
    products: data.products.map((item) =>
      item.id === productId
        ? { ...item, cost: input.unitCost, entries: [...item.entries, entry] }
        : item,
    ),
  };
}

export function saveProduct(
  data: Catalogs,
  input: {
    sku: string;
    name: string;
    description: string;
    unit: Product["unit"];
    minStock?: number | null;
    maxStock?: number | null;
  },
  initial: EntryInput,
  id?: string,
): Catalogs {
  const sku = normalized(input.sku);
  const name = input.name.trim();
  if (!sku || !name || sku.length > 40 || name.length > 150)
    throw new Error(
      "Escribe un código (máximo 40 caracteres) y nombre (máximo 150).",
    );
  if (
    data.products.some((item) => item.id !== id && normalized(item.sku) === sku)
  )
    throw new Error("El código del artículo ya existe.");
  if (!["pza", "L"].includes(input.unit))
    throw new Error("La unidad debe ser pieza o litro.");
  const minStock = input.minStock ?? null;
  const maxStock = input.maxStock ?? null;
  for (const [label, value] of [
    ["El stock mínimo", minStock],
    ["El stock máximo", maxStock],
  ] as const) {
    if (
      value !== null &&
      (!finite(value) ||
        value < 0 ||
        (input.unit === "pza" && !Number.isInteger(value)))
    )
      throw new Error(
        `${label} debe ser igual o mayor a cero${input.unit === "pza" ? " en piezas enteras" : ""} (null para no usarlo).`,
      );
  }
  if (minStock !== null && maxStock !== null && minStock > maxStock)
    throw new Error("El stock mínimo no puede superar al stock máximo.");
  const old = data.products.find((item) => item.id === id);
  if (id && !old) throw new Error("El artículo ya no está disponible.");
  if (old && old.unit !== input.unit)
    throw new Error(
      "La unidad de medida no se cambia después del alta; crea otro artículo para no reinterpretar cantidades históricas.",
    );
  if (!old) validateEntry(initial, input.unit, true);
  const product: Product = {
    ...input,
    sku,
    name,
    description: input.description.trim(),
    minStock,
    maxStock,
    id: old?.id ?? crypto.randomUUID(),
    cost: old?.cost ?? initial.unitCost,
    entries: old?.entries ?? [],
  };
  const next = {
    ...data,
    products: old
      ? data.products.map((item) => (item.id === id ? product : item))
      : [...data.products, product],
  };
  return !old && initial.quantity > 0
    ? addStockEntry(next, product.id, initial)
    : next;
}

export function saveService(
  data: Catalogs,
  input: Omit<CatalogService, "id">,
  id?: string,
): Catalogs {
  if (!input.name.trim() || input.name.trim().length > 150)
    throw new Error("Escribe el nombre del servicio (máximo 150 caracteres).");
  if (
    data.services.some(
      (item) =>
        item.id !== id && normalized(item.name) === normalized(input.name),
    )
  )
    throw new Error("Ese tipo de servicio ya está registrado.");
  if (
    id !== "oil-change" &&
    /\bCAF\b|CAMBIO\s+DE\s+ACEITE\s+Y\s+FILTRO/i.test(input.name)
  )
    throw new Error(
      "CAF ya existe y es el único preventivo. Edita el servicio CAF en vez de duplicarlo.",
    );
  if (!finite(input.hours) || input.hours <= 0)
    throw new Error("El tiempo estimado debe ser mayor a cero.");
  if (
    input.compatibleVehicleIds.some(
      (value) => !data.vehicles.some((vehicle) => vehicle.id === value),
    )
  )
    throw new Error("Revisa las unidades compatibles.");
  for (const material of input.materials) {
    const product = data.products.find(
      (item) => item.id === material.productId,
    );
    if (!product || !validServiceQuantity(material.quantity, product.unit))
      throw new Error(
        "Revisa los materiales: piezas enteras y litros en incrementos de 0.5, siempre positivos.",
      );
  }
  if (
    new Set(input.materials.map((item) => item.productId)).size !==
    input.materials.length
  )
    throw new Error("No repitas un artículo: ajusta su cantidad.");
  const old = data.services.find((item) => item.id === id);
  if (id && !old) throw new Error("El servicio ya no está disponible.");
  const service: CatalogService = {
    ...input,
    id: old?.id ?? crypto.randomUUID(),
    name:
      id === "oil-change"
        ? "CAF · Cambio de aceite y filtro"
        : input.name.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
  };
  return {
    ...data,
    services: old
      ? data.services.map((item) => (item.id === id ? service : item))
      : [...data.services, service],
  };
}

export function saveReview(
  data: Catalogs,
  input: Omit<ReviewType, "id" | "version">,
  id?: string,
): Catalogs {
  if (!input.name.trim() || input.name.trim().length > 150)
    throw new Error("Escribe un nombre de revisión de hasta 150 caracteres.");
  if (
    data.reviews.some(
      (item) =>
        item.id !== id && normalized(item.name) === normalized(input.name),
    )
  )
    throw new Error("Ese tipo de revisión ya existe.");
  if (!["days", "yearly", "trip"].includes(input.frequency))
    throw new Error("Selecciona una periodicidad.");
  if (
    input.frequency === "days" &&
    (!Number.isSafeInteger(input.intervalDays) || input.intervalDays! <= 0)
  )
    throw new Error("Indica un intervalo positivo en días.");
  if (
    !input.aspects.length ||
    input.aspects.some(
      (aspect) => !aspect.text.trim() || aspect.text.trim().length > 300,
    )
  )
    throw new Error(
      "Agrega al menos un aspecto y completa cada texto (máximo 300 caracteres).",
    );
  if (
    new Set(input.aspects.map((aspect) => normalized(aspect.text))).size !==
    input.aspects.length
  )
    throw new Error("No repitas aspectos en una misma revisión.");
  const old = data.reviews.find((item) => item.id === id);
  if (id && !old) throw new Error("La revisión ya no está disponible.");
  const review: ReviewType = {
    ...input,
    id: old?.id ?? crypto.randomUUID(),
    version: (old?.version ?? 0) + 1,
    name: input.name.trim(),
    description: input.description.trim(),
    intervalDays: input.frequency === "days" ? input.intervalDays : null,
    aspects: input.aspects.map((aspect) => ({
      ...aspect,
      text: aspect.text.trim(),
    })),
  };
  return {
    ...data,
    reviews: old
      ? data.reviews.map((item) => (item.id === id ? review : item))
      : [...data.reviews, review],
  };
}

export type EmployeeInput = Omit<Employee, "id">;
export function saveEmployee(
  data: Catalogs,
  input: EmployeeInput,
  id?: string,
): Employee[] {
  const name = input.name.trim();
  const position = input.position.trim();
  if (!name || name.length > 150)
    throw new Error("Escribe el nombre del empleado (máximo 150 caracteres).");
  if (!position || position.length > 150)
    throw new Error(
      "Escribe el puesto o especialidad (máximo 150 caracteres).",
    );
  if (input.phone.length > 50)
    throw new Error("El teléfono admite hasta 50 caracteres.");
  if (input.active !== undefined && typeof input.active !== "boolean")
    throw new Error("Estado de empleado inválido.");
  if (
    data.employees.some(
      (item) =>
        item.id !== id &&
        normalized(item.name) === normalized(name) &&
        normalized(item.position) === normalized(position),
    )
  )
    throw new Error("Ese empleado ya está registrado con el mismo puesto.");
  const old = data.employees.find((item) => item.id === id);
  if (id && !old) throw new Error("El empleado ya no está disponible.");
  const employee: Employee = {
    id: old?.id ?? crypto.randomUUID(),
    name,
    position,
    phone: input.phone.trim(),
    active: input.active ?? old?.active ?? true,
  };
  return old
    ? data.employees.map((item) => (item.id === id ? employee : item))
    : [...data.employees, employee];
}

export type ProviderInput = Omit<Provider, "id">;
export function saveProvider(
  data: Catalogs,
  input: ProviderInput,
  id?: string,
): Provider[] {
  const name = input.name.trim();
  if (!name || name.length > 150)
    throw new Error("Escribe el nombre del proveedor (máximo 150 caracteres).");
  if (input.contact.length > 150 || input.phone.length > 50)
    throw new Error("Revisa el contacto (150) y el teléfono (50).");
  if (
    input.kind !== undefined &&
    !["service", "material", "both"].includes(input.kind)
  )
    throw new Error("Tipo de proveedor inválido.");
  if (
    data.providers.some(
      (item) => item.id !== id && normalized(item.name) === normalized(name),
    )
  )
    throw new Error("Ese proveedor ya está registrado.");
  const old = data.providers.find((item) => item.id === id);
  if (id && !old) throw new Error("El proveedor ya no está disponible.");
  const provider: Provider = {
    id: old?.id ?? crypto.randomUUID(),
    name,
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    kind: input.kind ?? old?.kind ?? "both",
  };
  return old
    ? data.providers.map((item) => (item.id === id ? provider : item))
    : [...data.providers, provider];
}

export type VehiclePartInput = Omit<VehiclePart, "id">;
export function saveVehiclePart(
  data: Catalogs,
  input: VehiclePartInput,
  id?: string,
): VehiclePart[] {
  const partNumber = input.partNumber.trim();
  const name = input.name.trim();
  if (!partNumber || partNumber.length > 60)
    throw new Error(
      "Escribe el número de parte (obligatorio, máximo 60 caracteres).",
    );
  if (!name || name.length > 150)
    throw new Error("Escribe el nombre de la pieza (máximo 150 caracteres).");
  if (input.note.length > 1000)
    throw new Error("Las notas admiten hasta 1000 caracteres.");
  if (!input.compatibleVehicleIds.length)
    throw new Error("Selecciona al menos una unidad compatible.");
  if (
    input.compatibleVehicleIds.some(
      (vehicleId) => !data.vehicles.some((vehicle) => vehicle.id === vehicleId),
    )
  )
    throw new Error("Revisa las unidades compatibles de la pieza.");
  if (
    new Set(input.compatibleVehicleIds).size !==
    input.compatibleVehicleIds.length
  )
    throw new Error("No repitas unidades compatibles.");
  if (
    data.vehicleParts.some(
      (item) =>
        item.id !== id &&
        normalized(item.partNumber) === normalized(partNumber),
    )
  )
    throw new Error("Ese número de parte ya está registrado.");
  const old = data.vehicleParts.find((item) => item.id === id);
  if (id && !old) throw new Error("La pieza ya no está disponible.");
  const part: VehiclePart = {
    id: old?.id ?? crypto.randomUUID(),
    partNumber,
    name,
    note: input.note.trim(),
    compatibleVehicleIds: [...input.compatibleVehicleIds],
  };
  return old
    ? data.vehicleParts.map((item) => (item.id === id ? part : item))
    : [...data.vehicleParts, part];
}
