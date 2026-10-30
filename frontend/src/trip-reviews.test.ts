import { defaultCatalogs, type ReviewType } from "./catalogs";
import {
  closeTripCase,
  loadTripCases,
  persistTripCases,
  startTripCase,
  submitTripInspection,
  tripStatus,
} from "./trip-reviews";
import { testUsers } from "./testing/WorkbenchHarness";

const data = defaultCatalogs();
const template: ReviewType = {
  ...data.reviews.find((item) => item.id === "trip")!,
  aspects: [{ id: "a1", text: "Aspecto definido por operación" }],
};
const input = {
  busId: "BUS015",
  departureDate: "2026-11-01",
  returnDate: "2026-11-02",
};

test("opens a bus case with valid dates and prevents a second open case", () => {
  const cases = startTripCase([], testUsers.driver, input, data.vehicles);
  expect(tripStatus(cases[0])).toBe("Pre trip pendiente");
  expect(() =>
    startTripCase(
      cases,
      { ...testUsers.driver, id: "other" },
      input,
      data.vehicles,
    ),
  ).toThrow("ya tiene un caso abierto");
  expect(() =>
    startTripCase(
      [],
      testUsers.driver,
      { ...input, returnDate: "2026-10-01" },
      data.vehicles,
    ),
  ).toThrow("regreso");
  const sprinter = { ...data.vehicles[0], id: "TRUCK", type: "truck" as const };
  const sprinterCases = startTripCase(
    [],
    testUsers.driver,
    { ...input, busId: sprinter.id },
    [sprinter],
  );
  expect(sprinterCases[0].busId).toBe(sprinter.id);
  expect(() =>
    startTripCase(
      sprinterCases,
      testUsers.driver,
      { ...input, busId: sprinter.id },
      [sprinter],
    ),
  ).toThrow("ya tiene un caso abierto");
  expect(() =>
    startTripCase([], testUsers.driver, { ...input, busId: "missing" }, [
      sprinter,
    ]),
  ).toThrow("unidad");
});

test("only both complete captures send the case to review and there is one closing result", () => {
  const created = startTripCase([], testUsers.driver, input, data.vehicles);
  const id = created[0].id;
  expect(() => closeTripCase(created, testUsers.mechanic, id, "")).toThrow(
    "ambas revisiones",
  );
  expect(() =>
    submitTripInspection(
      created,
      testUsers.driver,
      id,
      "post",
      { a1: "good" },
      "",
      template,
    ),
  ).toThrow("primero");
  expect(() =>
    submitTripInspection(
      created,
      testUsers.driver,
      id,
      "pre",
      {},
      "",
      template,
    ),
  ).toThrow("todos los aspectos");
  const pre = submitTripInspection(
    created,
    testUsers.driver,
    id,
    "pre",
    { a1: "fault" },
    "Observación del chofer",
    template,
  );
  expect(tripStatus(pre[0])).toBe("Post trip pendiente");
  expect(() =>
    submitTripInspection(
      pre,
      testUsers.driver,
      id,
      "pre",
      { a1: "good" },
      "",
      template,
    ),
  ).toThrow("ya fue enviada");
  const post = submitTripInspection(
    pre,
    testUsers.driver,
    id,
    "post",
    { a1: "good" },
    "Observación post",
    { ...template, version: 99 },
  );
  expect(post[0].template?.version).toBe(1);
  expect(tripStatus(post[0])).toBe("Pendiente de revisión");
  expect(() => closeTripCase(post, testUsers.driver, id, "")).toThrow(
    "Solo el mecánico",
  );
  expect(() => closeTripCase(post, testUsers.warehouse, id, "")).toThrow(
    "Solo el mecánico",
  );
  const closed = closeTripCase(post, testUsers.admin, id, "Revisado");
  expect(tripStatus(closed[0])).toBe("Cierre de caso");
  expect(closed[0].pre?.answers.a1).toBe("fault");
  expect(closed[0].closedBy?.id).toBe(testUsers.admin.id);
  expect(() => closeTripCase(closed, testUsers.mechanic, id, "")).toThrow(
    "pendiente",
  );
  persistTripCases(closed);
  expect(loadTripCases()[0].closingNotes).toBe("Revisado");
  expect(
    startTripCase(closed, testUsers.driver, input, data.vehicles),
  ).toHaveLength(2);
});

test("the same driver captures both stages; templates are copied rather than modified", () => {
  const created = startTripCase([], testUsers.driver, input, data.vehicles);
  expect(() =>
    submitTripInspection(
      created,
      { ...testUsers.driver, id: "other" },
      created[0].id,
      "pre",
      { a1: "good" },
      "",
      template,
    ),
  ).toThrow("chofer del caso");
  const definition = structuredClone(template);
  const pre = submitTripInspection(
    created,
    testUsers.driver,
    created[0].id,
    "pre",
    { a1: "good" },
    "",
    definition,
  );
  definition.aspects[0].text = "Cambio posterior";
  expect(pre[0].template?.aspects[0].text).toBe(
    "Aspecto definido por operación",
  );
});
