import {
  addStockEntry,
  CATALOGS_KEY,
  defaultCatalogs,
  loadCatalogs,
  persistCatalogs,
  saveProduct,
  saveReview,
  saveService,
  saveVehicle,
  stock,
} from "./catalogs";
import {
  emptyForm,
  isOrderForm,
  materialTotal,
  validateOrder,
  type OrderService,
} from "./data";

const entry = {
  quantity: 10,
  unitCost: 15.5,
  occurredOn: "2026-10-21",
  supplier: "Proveedor demo",
  receiptReference: "T-100",
};
test("articles support pieces or litres with historical entries and no categories", () => {
  const first = saveProduct(
    defaultCatalogs(),
    { sku: "agua-1", name: "Líquido demo", description: "", unit: "L" },
    { ...entry, quantity: 1.5 },
  );
  const product = first.products.at(-1)!;
  const second = addStockEntry(first, product.id, {
    ...entry,
    quantity: 2.25,
    unitCost: 18,
  });
  expect(stock(second.products.at(-1)!)).toBe(3.75);
  expect(second.products.at(-1)!.entries[0].unitCost).toBe(15.5);
  expect(second.products.at(-1)!.cost).toBe(18);
  expect(product).not.toHaveProperty("category");
  expect(() =>
    saveProduct(
      first,
      { sku: " AGUA-1 ", name: "Duplicado", description: "", unit: "L" },
      entry,
    ),
  ).toThrow("ya existe");
  expect(() =>
    saveProduct(
      first,
      { sku: "P-1", name: "Pieza", description: "", unit: "pza" },
      { ...entry, quantity: 1.5 },
    ),
  ).toThrow("enteras");
  expect(() =>
    addStockEntry(first, product.id, { ...entry, occurredOn: "2026-99-99" }),
  ).toThrow("fecha válida");
});

test("buses and trucks have distinct types, stable IDs and shared duplicate checks", () => {
  const data = defaultCatalogs();
  const input = {
    ...data.vehicles[0],
    fleetNumber: " CAM001 ",
    type: "truck" as const,
    plate: "TR-001",
    vin: "",
    odometer: 2000,
  };
  const next = saveVehicle(data, input);
  const truck = next.vehicles.at(-1)!;
  expect(truck.fleetNumber).toBe("CAM001");
  expect(truck.id).not.toBe("CAM001");
  expect(truck.type).toBe("truck");
  expect(() =>
    saveVehicle(next, { ...input, fleetNumber: "cam001", type: "bus" }),
  ).toThrow("ya está registrado");
  const edited = saveVehicle(
    next,
    { ...truck, model: "Nuevo modelo" },
    truck.id,
  );
  expect(edited.vehicles.at(-1)!.id).toBe(truck.id);
});

test("services keep CAF unique, allow necessary materials and check compatibility", () => {
  const data = defaultCatalogs();
  const serviceInput = {
    name: "Reparación de puerta",
    category: "Carrocería",
    description: "Ajustar cierre",
    hours: 1,
    materials: [{ productId: "filter", quantity: 2 }],
    compatibleVehicleIds: ["BUS015"],
  };
  const next = saveService(data, serviceInput);
  const service = next.services.at(-1)!;
  expect(() => saveService(next, { ...serviceInput, name: "CAF" })).toThrow(
    "único preventivo",
  );
  const edited = saveService(
    next,
    { ...next.services[0], materials: [{ productId: "oil", quantity: 30 }] },
    "oil-change",
  );
  expect(edited.services[0].materials).toEqual([
    { productId: "oil", quantity: 30 },
  ]);
  const orderService: OrderService = {
    id: "s1",
    catalogId: service.id,
    name: service.name,
    category: service.category,
    hours: 1,
    assignee: "",
    instructions: "",
    materials: [],
  };
  expect(
    validateOrder(
      {
        ...emptyForm(),
        busId: "BUS008",
        reason: "Prueba",
        odometer: "10",
        services: [orderService],
      },
      data.vehicles,
      data.products,
      next.services,
    ),
  ).toContain(
    "Revisa la compatibilidad de los servicios con la unidad seleccionada.",
  );
});

test("review types require user-authored, nonduplicate aspects and persist versions", () => {
  const input = {
    name: "Revisión de prueba",
    description: "",
    frequency: "days" as const,
    intervalDays: 45,
    aspects: [{ id: "a1", text: "Aspecto escrito por el usuario" }],
  };
  const first = saveReview(defaultCatalogs(), input);
  const review = first.reviews.at(-1)!;
  expect(review.aspects).toHaveLength(1);
  expect(() =>
    saveReview(first, { ...input, name: "Otra", aspects: [] }),
  ).toThrow("al menos un aspecto");
  expect(() =>
    saveReview(first, {
      ...input,
      name: "Otra",
      aspects: [
        input.aspects[0],
        { id: "a2", text: " ASPECTO ESCRITO POR EL USUARIO " },
      ],
    }),
  ).toThrow("No repitas");
  expect(
    saveReview(
      first,
      { ...input, frequency: "trip", intervalDays: null },
      review.id,
    ).reviews.at(-1)!.version,
  ).toBe(2);
  persistCatalogs(first);
  expect(loadCatalogs().reviews.at(-1)!.id).toBe(review.id);
});

test("corrupted catalog storage is preserved instead of overwritten", () => {
  localStorage.setItem(CATALOGS_KEY, "{invalid");
  expect(() => loadCatalogs()).toThrow("No se sobrescribieron");
  expect(localStorage.getItem(CATALOGS_KEY)).toBe("{invalid");
});

test("estimated order prices are snapshots and new article IDs survive draft validation", () => {
  const service: OrderService = {
    id: "s1",
    catalogId: "oil-change",
    name: "CAF",
    category: "Motor",
    hours: 1,
    assignee: "",
    instructions: "",
    materials: [
      { id: "m1", productId: "new-product", quantity: 2, unitCost: 100 },
    ],
  };
  expect(isOrderForm({ ...emptyForm(), services: [service] })).toBe(true);
  expect(materialTotal([service], [])).toBe(200);
});
