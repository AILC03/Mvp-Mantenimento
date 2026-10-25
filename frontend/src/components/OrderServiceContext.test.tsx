import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { CATALOGS_KEY } from "../catalogs";
import { persistWorkbench } from "../requests";

test("creating a service from an order returns to that order with all its existing inputs", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  await user.selectOptions(screen.getByLabelText(/^Unidad \(/), "BUS015");
  await user.selectOptions(screen.getByLabelText("Prioridad"), "Urgente");
  await user.type(
    screen.getByLabelText(/^Observaciones de la orden/),
    "Conservar estas indicaciones",
  );
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /CAF · Cambio de aceite y filtro/ }),
  );
  await user.selectOptions(
    screen.getByLabelText("Responsable"),
    "Carlos Méndez · Mecánico",
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar otro servicio" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Crear nuevo servicio" }),
  );
  await user.type(
    screen.getByLabelText(/^Nombre del servicio/),
    "Servicio creado desde orden",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Nueva orden de mantenimiento",
  );
  expect(screen.getByLabelText(/^Unidad \(/)).toHaveValue("BUS015");
  expect(screen.getByLabelText("Prioridad")).toHaveValue("Urgente");
  expect(screen.getByLabelText(/^Observaciones de la orden/)).toHaveValue(
    "Conservar estas indicaciones",
  );
  expect(screen.getAllByLabelText("Responsable")[0]).toHaveValue(
    "Carlos Méndez · Mecánico",
  );
  expect(
    screen.getByRole("heading", { name: "Servicio creado desde orden" }),
  ).toBeInTheDocument();
});

test("direct catalog creation stays in the catalog even after an order creation context was cancelled", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  await user.selectOptions(screen.getByLabelText(/^Unidad \(/), "BUS015");
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Crear nuevo servicio" }),
  );
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByLabelText(/^Unidad \(/)).toHaveValue("BUS015");
  await user.click(screen.getByRole("button", { name: "Tipos de servicio" }));
  await user.click(
    screen.getByRole("button", { name: "Nuevo tipo de servicio" }),
  );
  await user.type(
    screen.getByLabelText(/^Nombre del servicio/),
    "Servicio del catálogo directo",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Tipos de servicio",
  );
  expect(
    JSON.parse(localStorage.getItem(CATALOGS_KEY)!).services.at(-1).name,
  ).toBe("Servicio del catálogo directo");
  await user.click(screen.getByRole("button", { name: /Órdenes de trabajo/ }));
  await user.click(
    screen.getByRole("button", { name: "Retomar orden en edición" }),
  );
  expect(
    screen.queryByRole("heading", { name: "Servicio del catálogo directo" }),
  ).not.toBeInTheDocument();
});

test("the request identifier and original report survive contextual service creation", async () => {
  persistWorkbench({
    orders: [],
    requests: [
      {
        id: "source-1",
        number: "SOL-DEMO-ORIGIN",
        busId: "BUS015",
        driverId: "driver-demo",
        driverName: "Chofer de prueba",
        title: "Reporte original",
        description: "Descripción original que no debe copiarse ni perderse.",
        odometer: "120000",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  await user.selectOptions(
    screen.getByLabelText("Identificador de la solicitud"),
    "source-1",
  );
  await user.click(
    screen.getByRole("button", { name: /Agregar primer servicio/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Crear nuevo servicio" }),
  );
  await user.type(
    screen.getByLabelText(/^Nombre del servicio/),
    "Servicio para solicitud",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.getByLabelText("Identificador de la solicitud")).toHaveValue(
    "source-1",
  );
  expect(screen.getByLabelText(/^Unidad \(/)).toHaveValue("BUS015");
  await user.click(screen.getByRole("button", { name: "Ver reporte" }));
  expect(
    screen.getByText("Descripción original que no debe copiarse ni perderse."),
  ).toBeInTheDocument();
});

test("cancelling a nested warehouse picker does not close or reset the service editor", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Tipos de servicio" }));
  await user.click(
    screen.getByRole("button", { name: "Nuevo tipo de servicio" }),
  );
  await user.type(
    screen.getByLabelText(/^Nombre del servicio/),
    "Servicio en edición",
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar material necesario" }),
  );
  const picker = screen.getByRole("dialog", {
    name: "Seleccionar materiales de almacén",
  });
  fireEvent(picker, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(
    screen.queryByRole("dialog", { name: "Seleccionar materiales de almacén" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: "Nuevo tipo de servicio" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nombre del servicio/)).toHaveValue(
    "Servicio en edición",
  );
});
