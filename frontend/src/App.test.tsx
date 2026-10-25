import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./testing/WorkbenchHarness";
import {
  catalog,
  emptyForm,
  materialTotal,
  maintenanceLabel,
  validateOrder,
  type OrderService,
} from "./data";
import { WORKBENCH_KEY } from "./requests";

async function openOrderEditor() {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Nueva orden" }));
}

test("requires bus, odometer and at least one service; manual orders do not need a request", () => {
  expect(validateOrder(emptyForm())).toHaveLength(3);
});

test("calculates estimated materials without a labor cost", () => {
  const item = catalog[0];
  const service: OrderService = {
    ...item,
    id: "test",
    catalogId: item.id,
    assignee: "",
    instructions: "",
    materials: item.materials.map((material, index) => ({
      ...material,
      id: String(index),
    })),
  };
  expect(materialTotal([service])).toBe(3700);
});

test("shows validation without creating an order", async () => {
  const user = userEvent.setup();
  await openOrderEditor();
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Agrega al menos un servicio.",
  );
  expect(localStorage.getItem(WORKBENCH_KEY)).toBeNull();
});

test("creates a demo order with a service and estimated materials", async () => {
  const user = userEvent.setup();
  await openOrderEditor();
  await user.selectOptions(screen.getByLabelText(/^Unidad/), "BUS015");
  await user.type(
    screen.getByLabelText(/^Observaciones de la orden/),
    "Servicio por kilometraje",
  );
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /Cambio de aceite y filtro/ }),
  );
  await user.selectOptions(
    screen.getByLabelText(/^Responsable/),
    "Carlos Méndez · Mecánico",
  );
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Órdenes de trabajo",
  );
  expect(screen.getByText("Lista para iniciar")).toBeInTheDocument();
  const saved = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!).orders;
  expect(saved[0].form.services[0].materials).toHaveLength(2);
  expect(saved[0].number).toMatch(/^DEMO-BUS015-/);
});

test("saves and restores a partial local draft", async () => {
  const user = userEvent.setup();
  await openOrderEditor();
  await user.type(
    screen.getByLabelText(/^Observaciones de la orden/),
    "Borrador de taller",
  );
  await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await user.clear(screen.getByLabelText(/^Observaciones de la orden/));
  await user.click(screen.getByRole("button", { name: /Recuperar borrador/ }));
  expect(screen.getByLabelText(/^Observaciones de la orden/)).toHaveValue(
    "Borrador de taller",
  );
});

test("rejects corrupted draft data without replacing the current form", async () => {
  const user = userEvent.setup();
  localStorage.setItem(
    "real-ejecutivo.demo.draft.v1.mechanic-demo",
    JSON.stringify({ reason: "invalid", type: "Preventivo", services: [] }),
  );
  await openOrderEditor();
  await user.click(screen.getByRole("button", { name: /Recuperar borrador/ }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No hay un borrador compatible",
  );
  expect(screen.getByLabelText(/^Observaciones de la orden/)).toHaveValue("");
});

test("rejects zero quantities and negative odometers", () => {
  const item = catalog[0];
  const service: OrderService = {
    ...item,
    id: "test",
    catalogId: item.id,
    assignee: "",
    instructions: "",
    materials: [{ id: "m1", productId: "oil", quantity: 0 }],
  };
  const errors = validateOrder({
    ...emptyForm(),
    busId: "BUS015",
    reason: "Prueba",
    odometer: "-1",
    services: [service],
  });
  expect(errors).toHaveLength(2);
});

test("reports unavailable local storage without claiming a successful save", async () => {
  const user = userEvent.setup();
  await openOrderEditor();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No se pudo guardar el borrador",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("classifies only CAF as preventive and derives the classification", () => {
  const service = (index: number): OrderService => ({
    ...catalog[index],
    id: String(index),
    catalogId: catalog[index].id,
    assignee: "",
    instructions: "",
    materials: [],
  });
  expect(maintenanceLabel([service(0)])).toBe("Preventivo · CAF");
  expect(maintenanceLabel([service(1)])).toBe("Correctivo");
  expect(maintenanceLabel([service(0), service(1)])).toBe("CAF + correctivos");
});

async function sendDriverRequest(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  await user.selectOptions(
    screen.getByLabelText(/^Unidad del reporte/),
    "BUS015",
  );
  await user.type(screen.getByLabelText(/^Asunto/), "Ruido al frenar");
  await user.type(
    screen.getByLabelText(/^¿Qué ocurrió/),
    "Se escucha ruido en la rueda delantera al frenar.",
  );
  await user.type(screen.getByLabelText(/^Kilometraje observado/), "184600");
  await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
}

test("driver sends a request and mechanic creates a linked order", async () => {
  const user = userEvent.setup();
  render(<App />);
  await sendDriverRequest(user);
  expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Revisar solicitud" }),
  ).not.toBeInTheDocument();
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "mechanic",
  );
  await user.click(screen.getByRole("button", { name: "Revisar solicitud" }));
  await user.click(screen.getByRole("button", { name: "Preparar orden" }));
  expect(screen.getByLabelText(/^Unidad/)).toBeDisabled();
  const source = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!).requests[0];
  expect(screen.getByLabelText("Identificador de la solicitud")).toHaveValue(
    source.id,
  );
  expect(
    screen.queryByLabelText(/^Motivo de la orden/),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ver reporte" }));
  expect(
    screen.getByText("Se escucha ruido en la rueda delantera al frenar."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cerrar ventana" }));
  expect(
    JSON.parse(localStorage.getItem(WORKBENCH_KEY)!).requests[0].status,
  ).toBe("pending");
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /Diagnóstico y reparación de frenos/ }),
  );
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  const saved = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!);
  expect(saved.requests[0].status).toBe("converted");
  expect(saved.requests[0].orderId).toBe(saved.orders[0].id);
  expect(saved.orders[0].form.sourceRequestId).toBe(saved.requests[0].id);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  await user.click(screen.getByRole("button", { name: /Con orden/ }));
  expect(screen.getByText("Orden creada")).toBeInTheDocument();
  expect(screen.getByText(saved.orders[0].number)).toBeInTheDocument();
});

test("mechanic must enter a rejection reason and driver can read it", async () => {
  const user = userEvent.setup();
  render(<App />);
  await sendDriverRequest(user);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "mechanic",
  );
  await user.click(screen.getByRole("button", { name: "Revisar solicitud" }));
  await user.click(screen.getByRole("button", { name: "Rechazar solicitud" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Escribe el motivo del rechazo",
  );
  await user.type(
    screen.getByLabelText("Motivo del rechazo"),
    "Reporte duplicado; ya existe un trabajo para esta falla.",
  );
  await user.click(screen.getByRole("button", { name: "Rechazar solicitud" }));
  const saved = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!);
  expect(saved.orders).toHaveLength(0);
  expect(saved.requests[0].status).toBe("rejected");
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  await user.click(screen.getByRole("button", { name: /Rechazadas/ }));
  expect(
    screen.getByText(
      "Reporte duplicado; ya existe un trabajo para esta falla.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Preparar orden" }),
  ).not.toBeInTheDocument();
});

test("failed conversion does not mark the request as attended", async () => {
  const user = userEvent.setup();
  render(<App />);
  await sendDriverRequest(user);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "mechanic",
  );
  await user.click(screen.getByRole("button", { name: "Revisar solicitud" }));
  await user.click(screen.getByRole("button", { name: "Preparar orden" }));
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /Diagnóstico y reparación de frenos/ }),
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No se pudo guardar la orden",
  );
  const saved = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!);
  expect(saved.requests[0].status).toBe("pending");
  expect(saved.orders).toHaveLength(0);
});

test("CAF materials can be edited, removed and added before saving", async () => {
  const user = userEvent.setup();
  await openOrderEditor();
  await user.selectOptions(screen.getByLabelText(/^Unidad/), "BUS015");
  await user.type(
    screen.getByLabelText(/^Observaciones de la orden/),
    "Servicio CAF",
  );
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /CAF · Cambio de aceite y filtro/ }),
  );
  const quantity = screen.getByLabelText("Cantidad de Aceite de motor 15W-40");
  await user.clear(quantity);
  await user.type(quantity, "30");
  await user.click(
    screen.getByRole("button", { name: "Eliminar material Filtro de aceite" }),
  );
  await user.click(screen.getByRole("button", { name: "Agregar material" }));
  await user.click(
    screen.getByRole("checkbox", { name: "Seleccionar Filtro de aire" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar selección (1)" }),
  );
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  const saved = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!);
  expect(saved.orders[0].form.services[0].materials).toEqual([
    expect.objectContaining({ productId: "oil", quantity: 30 }),
    expect.objectContaining({ productId: "air", quantity: 1 }),
  ]);
});
