import {
  emptyHistoryFilters,
  filterHistory,
  type HistoryRow,
} from "./vehicle-history";
import { nextQuantity, validServiceQuantity } from "./quantities";
import { orderCategory } from "./orders";
import { emptyForm, type SavedOrder } from "./data";

test("history combines category, service/review type, status and an inclusive execution-date range", () => {
  const rows: HistoryRow<null>[] = [
    {
      id: "1",
      at: "2026-02-20T12:00:00Z",
      date: "2026-01-15",
      category: "Revisiones",
      status: "Realizada",
      types: ["General"],
      actor: "Mecánico",
      title: "Revisión general",
      body: null,
    },
    {
      id: "2",
      at: "2026-01-15T12:00:00Z",
      category: "Servicios",
      status: "Finalizada",
      types: ["CAF"],
      actor: "Mecánico",
      title: "Orden CAF",
      body: null,
    },
  ];
  expect(
    filterHistory(rows, {
      ...emptyHistoryFilters(),
      category: "Revisiones",
      type: "General",
      status: "Realizada",
      from: "2026-01-15",
      to: "2026-01-15",
    }).map((row) => row.id),
  ).toEqual(["1"]);
  expect(
    filterHistory(rows, {
      ...emptyHistoryFilters(),
      query: "mecanico",
      category: "Servicios",
    }).map((row) => row.id),
  ).toEqual(["2"]);
  expect(
    filterHistory(rows, {
      ...emptyHistoryFilters(),
      from: "2026-02-01",
      to: "2026-01-01",
    }),
  ).toEqual([]);
});

test("quantity buttons advance pieces by one and litres by half, without floating point drift", () => {
  expect(nextQuantity(1, "pza", 1)).toBe(2);
  expect(nextQuantity(2, "pza", -1)).toBe(1);
  expect(nextQuantity(1, "L", 1)).toBe(1.5);
  expect(nextQuantity(1.5, "L", -1)).toBe(1);
  expect(nextQuantity(0.5, "L", -1)).toBe(0.5);
  expect(validServiceQuantity(1.25, "L")).toBe(false);
  expect(validServiceQuantity(1.5, "L")).toBe(true);
  expect(validServiceQuantity(1.5, "pza")).toBe(false);
});

test("work order categories are exclusive; paused work belongs to in-process and completed work only to finished", () => {
  const order: SavedOrder = {
    id: "1",
    number: "OT",
    createdAt: "",
    form: emptyForm(),
    status: "Lista para iniciar",
  };
  expect(orderCategory(order)).toBe("pending");
  expect(orderCategory({ ...order, status: "En proceso" })).toBe("working");
  expect(orderCategory({ ...order, status: "Pausada" })).toBe("working");
  expect(orderCategory({ ...order, status: "Finalizada" })).toBe("finished");
});
