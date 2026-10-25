import { emptyForm, type SavedOrder } from "./data";
import {
  convertRequest,
  rejectRequest,
  validateRequest,
  type ServiceRequest,
  type Workbench,
} from "./requests";

const request: ServiceRequest = {
  id: "request-1",
  number: "SOL-DEMO-1",
  busId: "BUS015",
  title: "Ruido al frenar",
  description: "Ruido en rueda delantera",
  odometer: "",
  driverId: "driver-demo",
  driverName: "Chofer demo",
  status: "pending",
  createdAt: "2026-10-21T12:00:00Z",
};
const source: Workbench = { orders: [], requests: [request] };
const order: SavedOrder = {
  id: "order-1",
  number: "DEMO-1",
  status: "Pendiente de liberación",
  createdAt: "2026-10-21T13:00:00Z",
  form: { ...emptyForm(), busId: "BUS015", sourceRequestId: request.id },
};

test("a driver request requires a valid bus, title and description but not an odometer", () => {
  expect(validateRequest(request)).toEqual([]);
  expect(
    validateRequest({
      busId: "",
      title: " ",
      description: " ",
      odometer: "-1",
    }),
  ).toHaveLength(4);
});

test("a request cannot create two orders or be rejected after conversion", () => {
  const converted = convertRequest(source, order);
  expect(converted.requests[0].status).toBe("converted");
  expect(() => convertRequest(converted, { ...order, id: "order-2" })).toThrow(
    "ya fue atendida",
  );
  expect(() => rejectRequest(converted, request.id, "Otro motivo")).toThrow(
    "ya no está pendiente",
  );
  expect(source.requests[0].status).toBe("pending");
});

test("rejected requests cannot convert and a different bus cannot be substituted", () => {
  const rejected = rejectRequest(source, request.id, "Reporte duplicado");
  expect(() => convertRequest(rejected, order)).toThrow("ya fue atendida");
  expect(() =>
    convertRequest(source, {
      ...order,
      form: { ...order.form, busId: "BUS008" },
    }),
  ).toThrow("no corresponde");
});
