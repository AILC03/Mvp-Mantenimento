import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { CATALOGS_KEY } from "../catalogs";
import { WORKBENCH_KEY } from "../requests";

test("a new truck is available to the driver and requests survive reload", async () => {
  const user = userEvent.setup();
  const app = render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "admin",
  );
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.click(screen.getByRole("button", { name: "Nueva unidad" }));
  await user.selectOptions(screen.getByLabelText(/^Tipo de unidad/), "truck");
  await user.type(screen.getByLabelText(/^Número económico/), "CAM777");
  await user.type(screen.getByLabelText(/^Odómetro \(km\)/), "5000");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const catalogs = JSON.parse(localStorage.getItem(CATALOGS_KEY)!);
  expect(catalogs.vehicles.at(-1).type).toBe("truck");
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  await user.selectOptions(
    screen.getByLabelText(/^Unidad del reporte/),
    catalogs.vehicles.at(-1).id,
  );
  await user.type(screen.getByLabelText(/^Asunto/), "Reporte del camión");
  await user.type(
    screen.getByLabelText(/^¿Qué ocurrió/),
    "Necesita atención del taller.",
  );
  await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
  expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
  app.unmount();
  render(<App />);
  expect(screen.getByText("Reporte del camión")).toBeInTheDocument();
  expect(screen.getByText("CAM777")).toBeInTheDocument();
});

test("a new warehouse article can be included in a new service and then in an order", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "admin",
  );
  await user.click(
    screen.getByRole("button", { name: "Artículos de almacén" }),
  );
  await user.click(screen.getByRole("button", { name: "Nuevo artículo" }));
  await user.type(screen.getByLabelText(/^Código del artículo/), "LIQ-777");
  await user.type(
    screen.getByLabelText(/^Nombre del artículo/),
    "Líquido de prueba",
  );
  await user.selectOptions(screen.getByLabelText(/^Unidad de medida/), "L");
  await user.clear(screen.getByLabelText(/^Cantidad inicial/));
  await user.type(screen.getByLabelText(/^Cantidad inicial/), "2.5");
  await user.clear(screen.getByLabelText(/^Costo unitario/));
  await user.type(screen.getByLabelText(/^Costo unitario/), "20");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const product = JSON.parse(localStorage.getItem(CATALOGS_KEY)!).products.at(
    -1,
  );
  expect(product.entries[0].quantity).toBe(2.5);
  await user.click(screen.getByRole("button", { name: "Tipos de servicio" }));
  await user.click(
    screen.getByRole("button", { name: "Nuevo tipo de servicio" }),
  );
  await user.type(
    screen.getByLabelText(/^Nombre del servicio/),
    "Servicio de prueba",
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar material necesario" }),
  );
  await user.type(
    screen.getByLabelText("Buscar material por nombre o código"),
    "Líquido de prueba",
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Seleccionar Líquido de prueba" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar selección (1)" }),
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.getByText("Servicio de prueba")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: /Solicitudes de servicio/ }),
  );
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  await user.selectOptions(screen.getByLabelText(/^Unidad \(/), "BUS015");
  await user.type(
    screen.getByLabelText(/^Observaciones de la orden/),
    "Prueba de catálogo",
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar primer servicio" }),
  );
  await user.click(screen.getByRole("button", { name: /Servicio de prueba/ }));
  expect(screen.getByLabelText("Cantidad de Líquido de prueba")).toHaveValue(1);
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  const order = JSON.parse(localStorage.getItem(WORKBENCH_KEY)!).orders[0];
  expect(order.form.services[0].materials[0]).toEqual(
    expect.objectContaining({
      productId: product.id,
      quantity: 1,
      unitCost: 20,
    }),
  );
});

test("review aspects are authored by the user and the two answer boxes are mutually exclusive", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "admin",
  );
  await user.click(screen.getByRole("button", { name: "Tipos de revisión" }));
  await user.click(
    screen.getByRole("button", { name: "Nuevo tipo de revisión" }),
  );
  await user.type(
    screen.getByLabelText(/^Nombre de la revisión/),
    "Revisión creada por usuario",
  );
  await user.selectOptions(screen.getByLabelText("Periodicidad"), "trip");
  await user.type(
    screen.getByLabelText("Aspecto 1"),
    "Aspecto definido en operación",
  );
  await user.click(screen.getByRole("button", { name: "Agregar aspecto" }));
  await user.type(
    screen.getByLabelText("Aspecto 2"),
    "Otro aspecto indicado por el usuario",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const article = screen
    .getByText("Revisión creada por usuario")
    .closest("article")!;
  await user.click(
    within(article).getByRole("button", { name: "Probar formato" }),
  );
  const aspect = screen.getByRole("group", {
    name: "Aspecto definido en operación",
  });
  const good = within(aspect).getByRole("radio", { name: "Bien" });
  const fault = within(aspect).getByRole("radio", { name: "Con falla" });
  await user.click(good);
  expect(good).toBeChecked();
  await user.click(fault);
  expect(fault).toBeChecked();
  expect(good).not.toBeChecked();
  const stored = JSON.parse(localStorage.getItem(CATALOGS_KEY)!);
  expect(stored.reviews.at(-1).aspects).toHaveLength(2);
  expect(stored.reviews.at(-1)).not.toHaveProperty("answers");
});
