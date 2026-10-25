import { defaultCatalogs } from "./catalogs";
import { emptyForm, type SavedOrder } from "./data";
import {
  actualMaterialCost,
  dateToday,
  availableStock,
  changeOrder,
  confirmMaterials,
  finishOrder,
} from "./orders";
import {
  addDamage,
  correctCaf,
  fleetRecords,
  lastCaf,
  recordPeriodicReview,
  remainingDays,
  resolveIncident,
  vehicleIncidents,
} from "./fleet";
import { loadWorkbench, persistWorkbench, type Workbench } from "./requests";
import { testUsers } from "./testing/WorkbenchHarness";

const catalogs = defaultCatalogs();
const order: SavedOrder = {
  id: "order-1",
  number: "OT-001",
  createdAt: "2026-01-01T12:00:00Z",
  status: "Lista para iniciar",
  form: {
    ...emptyForm(),
    busId: "BUS015",
    odometer: "100000",
    services: [
      {
        id: "s1",
        catalogId: "oil-change",
        name: "CAF",
        category: "Motor",
        hours: 2,
        assignee: "",
        instructions: "",
        materials: [
          { id: "m1", productId: "oil", quantity: 10, unitCost: 100 },
        ],
      },
    ],
  },
};
const source: Workbench = { orders: [order], requests: [] };
const withConfirmedMaterials = (data: Workbench) =>
  confirmMaterials(
    data,
    [
      {
        ...catalogs.products[0],
        entries: [
          {
            id: "stock",
            quantity: 50,
            unitCost: 100,
            occurredOn: "2026-01-01",
            supplier: "",
            receiptReference: "",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    ],
    testUsers.warehouse,
    order.id,
    [{ productId: "oil", delivered: 10, returned: 0 }],
  );

test("mechanic executes without another release and records pause, resume and completion", () => {
  expect(() =>
    changeOrder(source, testUsers.warehouse, order.id, "start"),
  ).toThrow("Solo mecánico");
  const started = changeOrder(source, testUsers.mechanic, order.id, "start");
  expect(started.orders[0].status).toBe("En proceso");
  expect(() =>
    changeOrder(started, testUsers.mechanic, order.id, "pause", ""),
  ).toThrow("motivo");
  const paused = changeOrder(
    started,
    testUsers.mechanic,
    order.id,
    "pause",
    "Esperando material",
  );
  expect(paused.orders[0].status).toBe("Pausada");
  const resumed = changeOrder(paused, testUsers.mechanic, order.id, "resume");
  const finished = finishOrder(
    withConfirmedMaterials(resumed),
    testUsers.mechanic,
    order.id,
    {
      date: "2026-01-01",
      odometer: 100000,
      performedServiceIds: ["s1"],
      unperformedReasons: {},
      notes: "CAF realizado",
    },
  );
  expect(finished.orders[0].status).toBe("Finalizada");
  expect(lastCaf("BUS015", finished)?.odometer).toBe(100000);
  persistWorkbench(finished);
  expect(loadWorkbench().orders[0].status).toBe("Finalizada");
});

test("closing with CAF unperformed keeps it pending and does not reset its baseline", () => {
  const started = withConfirmedMaterials(
    changeOrder(source, testUsers.mechanic, order.id, "start"),
  );
  expect(() =>
    finishOrder(started, testUsers.mechanic, order.id, {
      date: "2026-01-01",
      odometer: 100000,
      performedServiceIds: [],
      unperformedReasons: {},
      notes: "",
    }),
  ).toThrow("Explica");
  const finished = finishOrder(started, testUsers.mechanic, order.id, {
    date: "2026-01-01",
    odometer: 100000,
    performedServiceIds: [],
    unperformedReasons: { s1: "Falta de material" },
    notes: "",
  });
  expect(lastCaf("BUS015", finished)).toBeNull();
  expect(finished.orders[0].completion?.unperformedReasons.s1).toBe(
    "Falta de material",
  );
});

test("completion requires confirmed delivery, accepts the estimated quantity and allows material-free orders", () => {
  const started = changeOrder(source, testUsers.mechanic, order.id, "start");
  const input = {
    date: "2026-01-01",
    odometer: 100000,
    performedServiceIds: ["s1"],
    unperformedReasons: {},
    notes: "",
  };
  expect(() =>
    finishOrder(started, testUsers.mechanic, order.id, input),
  ).toThrow("almacén debe confirmar");
  expect(
    finishOrder(
      withConfirmedMaterials(started),
      testUsers.mechanic,
      order.id,
      input,
    ).orders[0].status,
  ).toBe("Finalizada");
  const withoutMaterials = {
    ...started,
    orders: started.orders.map((item) => ({
      ...item,
      form: {
        ...item.form,
        services: item.form.services.map((service) => ({
          ...service,
          materials: [],
        })),
      },
    })),
  };
  expect(
    finishOrder(withoutMaterials, testUsers.mechanic, order.id, input).orders[0]
      .status,
  ).toBe("Finalizada");
});

test("warehouse applies only deltas and returns never create negative stock or duplicate discounts", () => {
  const product = {
    ...catalogs.products[0],
    cost: 100,
    entries: [
      {
        id: "e1",
        quantity: 20,
        unitCost: 100,
        occurredOn: "2026-01-01",
        supplier: "",
        receiptReference: "",
        createdAt: "2026-01-01T12:00:00Z",
      },
    ],
  };
  expect(() =>
    confirmMaterials(source, [product], testUsers.mechanic, order.id, [
      { productId: "oil", delivered: 10, returned: 0 },
    ]),
  ).toThrow("Solo almacén");
  const delivered = confirmMaterials(
    source,
    [product],
    testUsers.warehouse,
    order.id,
    [{ productId: "oil", delivered: 10, returned: 0 }],
  );
  expect(availableStock(product, delivered.orders)).toBe(10);
  expect(() =>
    confirmMaterials(delivered, [product], testUsers.warehouse, order.id, [
      { productId: "oil", delivered: 10, returned: 0 },
    ]),
  ).toThrow("No hay cambios");
  const returned = confirmMaterials(
    delivered,
    [{ ...product, cost: 999 }],
    testUsers.warehouse,
    order.id,
    [{ productId: "oil", delivered: 10, returned: 3 }],
  );
  expect(availableStock(product, returned.orders)).toBe(13);
  expect(actualMaterialCost(returned.orders[0])).toBe(700);
  expect(() =>
    confirmMaterials(returned, [product], testUsers.warehouse, order.id, [
      { productId: "oil", delivered: 50, returned: 3 },
    ]),
  ).toThrow("insuficiente");
  expect(() =>
    confirmMaterials(returned, [product], testUsers.warehouse, order.id, [
      { productId: "oil", delivered: 10, returned: 11 },
    ]),
  ).toThrow("devolver");
});

test("only admin corrects last CAF, recording before and after without modifying orders", () => {
  const vehicle = catalogs.vehicles[0];
  const first = correctCaf(source, testUsers.admin, vehicle, {
    date: "2026-01-01",
    odometer: 100000,
    reason: "Carga inicial extraordinaria",
    confirmed: true,
  });
  expect(() =>
    correctCaf(first, testUsers.mechanic, vehicle, {
      date: "2026-01-02",
      odometer: 110000,
      reason: "Cambio",
      confirmed: true,
    }),
  ).toThrow("administrador");
  const second = correctCaf(first, testUsers.admin, vehicle, {
    date: "2026-01-02",
    odometer: 110000,
    reason: "Corrección de registro",
    confirmed: true,
  });
  expect(fleetRecords(second).cafCorrections).toHaveLength(2);
  expect(fleetRecords(second).cafCorrections[1].before?.odometer).toBe(100000);
  expect(second.orders).toEqual(source.orders);
});

test("mechanic freely performs reviews without assignments or editing the type", () => {
  const template = {
    ...catalogs.reviews[0],
    aspects: [{ id: "a1", text: "Aspecto indicado por operación" }],
  };
  expect(() =>
    recordPeriodicReview(source, testUsers.warehouse, "BUS015", template, {
      date: "2026-01-01",
      answers: { a1: "good" },
      notes: "",
    }),
  ).toThrow("Solo mecánico");
  const performed = recordPeriodicReview(
    source,
    testUsers.mechanic,
    "BUS015",
    template,
    {
      date: "2026-01-01",
      answers: { a1: "fault" },
      notes: "Falla encontrada",
    },
  );
  expect(fleetRecords(performed).reviewJobs[0].completion?.actorId).toBe(
    testUsers.mechanic.id,
  );
  const incidents = vehicleIncidents("BUS015", performed, []);
  expect(incidents).toHaveLength(1);
  const repaired = resolveIncident(
    performed,
    testUsers.mechanic,
    incidents[0],
    "Reparación efectuada",
    "",
  );
  expect(vehicleIncidents("BUS015", repaired, [])[0].resolution?.notes).toBe(
    "Reparación efectuada",
  );
  expect(template.aspects[0].text).toBe("Aspecto indicado por operación");
  const again = recordPeriodicReview(
    performed,
    testUsers.mechanic,
    "BUS015",
    template,
    {
      date: "2026-01-01",
      answers: { a1: "good" },
      notes: "Nueva realización sin asignación",
    },
  );
  expect(fleetRecords(again).reviewJobs).toHaveLength(2);
  expect(fleetRecords(again).reviewJobs[0].selfInitiated).toBe(true);
});

test("damage and repairs preserve their source and history", () => {
  const damaged = addDamage(source, testUsers.mechanic, "BUS015", {
    kind: "Golpe",
    area: "Defensa",
    description: "Daño visible",
    date: "2026-01-01",
  });
  const incident = vehicleIncidents("BUS015", damaged, [])[0];
  const repaired = resolveIncident(
    damaged,
    testUsers.mechanic,
    incident,
    "Defensa reparada",
    "",
  );
  expect(fleetRecords(repaired).damages).toHaveLength(1);
  expect(fleetRecords(repaired).resolutions).toHaveLength(1);
  persistWorkbench(repaired);
  expect(fleetRecords(loadWorkbench()).resolutions).toHaveLength(1);
});

test("periodic revisions may be overdue or early; every realization starts a new 45-day counter", () => {
  const template = {
    ...catalogs.reviews[0],
    aspects: [{ id: "a1", text: "Aspecto de operación" }],
  };
  const old = recordPeriodicReview(
    source,
    testUsers.mechanic,
    "BUS015",
    template,
    { date: "2026-01-01", answers: { a1: "good" }, notes: "" },
  );
  expect(remainingDays("2026-01-01", 45)).toBeLessThan(0);
  const current = recordPeriodicReview(
    old,
    testUsers.mechanic,
    "BUS015",
    template,
    { date: dateToday(), answers: { a1: "good" }, notes: "" },
  );
  expect(
    remainingDays(fleetRecords(current).reviewJobs[0].completion!.date, 45),
  ).toBe(45);
  expect(
    recordPeriodicReview(current, testUsers.mechanic, "BUS015", template, {
      date: dateToday(),
      answers: { a1: "good" },
      notes: "Realizada antes de vencer",
    }).fleet?.reviewJobs,
  ).toHaveLength(3);
});
