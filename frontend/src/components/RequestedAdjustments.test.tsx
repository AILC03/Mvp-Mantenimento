import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { testUsers } from "../testing/WorkbenchHarness";
import { defaultCatalogs, persistCatalogs, CATALOGS_KEY } from "../catalogs";
import { emptyForm, type SavedOrder } from "../data";
import { recordPeriodicReview } from "../fleet";
import { loadWorkbench, persistWorkbench } from "../requests";
import {
  closeTripCase,
  persistTripCases,
  startTripCase,
  submitTripInspection,
} from "../trip-reviews";

test("sidebar work orders and requests have no counters and a service quantity has correctly-sized steps", async () => {
  const user = userEvent.setup();
  render(<App />);
  const nav = screen.getByRole("navigation", { name: "Navegación principal" });
  expect(
    within(nav)
      .getByRole("button", { name: "Solicitudes de servicio" })
      .querySelector(".nav-count"),
  ).toBeNull();
  expect(
    within(nav)
      .getByRole("button", { name: "Órdenes de trabajo" })
      .querySelector(".nav-count"),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Tipos de servicio" }));
  await user.click(
    screen.getByRole("button", { name: "Nuevo tipo de servicio" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar material necesario" }),
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Seleccionar Filtro de aceite" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar selección (1)" }),
  );
  const quantity = screen.getByLabelText("Cantidad prevista 1");
  expect(quantity).toHaveAttribute("step", "1");
  await user.click(
    screen.getByRole("button", { name: "Aumentar Cantidad prevista 1" }),
  );
  expect(quantity).toHaveValue(2);
  await user.click(screen.getByRole("button", { name: "Cambiar artículo" }));
  await user.click(
    screen.getByRole("radio", { name: "Seleccionar Aceite de motor 15W-40" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Usar artículo seleccionado" }),
  );
  expect(quantity).toHaveAttribute("step", "0.5");
  await user.click(
    screen.getByRole("button", { name: "Aumentar Cantidad prevista 1" }),
  );
  expect(quantity).toHaveValue(2.5);
});

test("warehouse entry shows and preserves five litres at 100 MXN per litre as a 500 MXN entry", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "warehouse",
  );
  await user.click(screen.getByRole("button", { name: "Nuevo artículo" }));
  await user.type(screen.getByLabelText(/^Código del artículo/), "PRECIO-500");
  await user.type(
    screen.getByLabelText(/^Nombre del artículo/),
    "Material de ejemplo",
  );
  await user.selectOptions(screen.getByLabelText(/^Unidad de medida/), "L");
  await user.clear(screen.getByLabelText(/^Cantidad inicial/));
  await user.type(screen.getByLabelText(/^Cantidad inicial/), "5");
  await user.clear(screen.getByLabelText(/^Costo unitario/));
  await user.type(screen.getByLabelText(/^Costo unitario/), "100");
  expect(screen.getByLabelText("Valor total de la entrada")).toHaveTextContent(
    "$500.00",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const article = JSON.parse(localStorage.getItem(CATALOGS_KEY)!).products.at(
    -1,
  );
  expect(article.entries[0]).toEqual(
    expect.objectContaining({ quantity: 5, unitCost: 100 }),
  );
  expect(article.entries[0].quantity * article.entries[0].unitCost).toBe(500);
});

test("work cannot finish before warehouse confirms materials; equal-to-estimated delivery unlocks completion", async () => {
  const catalogs = defaultCatalogs();
  catalogs.products[0].entries = [
    {
      id: "e1",
      quantity: 20,
      unitCost: 100,
      occurredOn: "2026-01-01",
      supplier: "",
      receiptReference: "",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];
  persistCatalogs(catalogs);
  const order: SavedOrder = {
    id: "o1",
    number: "OT-BLOQUEO",
    status: "Lista para iniciar",
    createdAt: new Date().toISOString(),
    form: {
      ...emptyForm(),
      busId: "BUS015",
      odometer: "180000",
      services: [
        {
          id: "s1",
          catalogId: "oil-change",
          name: "CAF de prueba",
          category: "Motor",
          hours: 1,
          assignee: "",
          instructions: "",
          materials: [
            { id: "m1", productId: "oil", quantity: 5, unitCost: 100 },
          ],
        },
      ],
    },
  };
  persistWorkbench({ orders: [order], requests: [] });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  await user.click(screen.getByRole("button", { name: "Iniciar orden" }));
  expect(screen.getByRole("button", { name: "Terminar orden" })).toBeDisabled();
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "warehouse",
  );
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "En proceso" }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  await user.click(
    screen.getByRole("button", { name: "Dar salida a materiales" }),
  );
  await user.clear(screen.getByLabelText("Entregada Aceite de motor 15W-40"));
  await user.type(
    screen.getByLabelText("Entregada Aceite de motor 15W-40"),
    "5",
  );
  await user.click(
    screen.getByRole("button", { name: "Confirmar materiales" }),
  );
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "mechanic",
  );
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "En proceso" }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  expect(screen.getByRole("button", { name: "Terminar orden" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Terminar orden" }));
  await user.click(screen.getByRole("checkbox", { name: "CAF de prueba" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar finalización" }),
  );
  expect(loadWorkbench().orders[0].status).toBe("Finalizada");
  expect(screen.getByRole("button", { name: "Finalizadas" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("vehicle history is a filterable table and a closed pre/post case retains its review type", async () => {
  const catalogs = defaultCatalogs();
  const general = {
    ...catalogs.reviews[0],
    aspects: [{ id: "general-aspect", text: "Aspecto general" }],
  };
  const tripTemplate = {
    ...catalogs.reviews.find((item) => item.id === "trip")!,
    name: "Formato de viaje personalizado",
    aspects: [{ id: "trip-aspect", text: "Aspecto del viaje" }],
  };
  let cases = startTripCase(
    [],
    testUsers.driver,
    { busId: "BUS015", departureDate: "2026-01-01", returnDate: "2026-01-02" },
    catalogs.vehicles,
  );
  const id = cases[0].id;
  cases = submitTripInspection(
    cases,
    testUsers.driver,
    id,
    "pre",
    { "trip-aspect": "good" },
    "",
    tripTemplate,
  );
  cases = submitTripInspection(
    cases,
    testUsers.driver,
    id,
    "post",
    { "trip-aspect": "good" },
    "",
  );
  persistTripCases(
    closeTripCase(cases, testUsers.mechanic, id, "Caso cerrado"),
  );
  persistWorkbench(
    recordPeriodicReview(
      { orders: [], requests: [] },
      testUsers.mechanic,
      "BUS015",
      general,
      { date: "2026-01-01", answers: { "general-aspect": "good" }, notes: "" },
    ),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.click(
    screen.getByRole("button", { name: "BUS015 · Ver historial" }),
  );
  const table = screen.getByRole("table", { name: "Historial de BUS015" });
  await user.selectOptions(
    screen.getByLabelText("Categoría del historial"),
    "Revisiones",
  );
  await user.selectOptions(
    screen.getByLabelText("Estado de revisión o servicio"),
    "Cierre de caso",
  );
  await user.selectOptions(
    screen.getByLabelText("Tipo de revisión o servicio"),
    "Formato de viaje personalizado",
  );
  expect(
    within(table).getByRole("row", {
      name: /Formato de viaje personalizado.*Cierre de caso/,
    }),
  ).toBeInTheDocument();
  await user.selectOptions(
    screen.getByLabelText("Estado de revisión o servicio"),
    "all",
  );
  await user.selectOptions(
    screen.getByLabelText("Tipo de revisión o servicio"),
    "Revisión general",
  );
  fireEvent.change(screen.getByLabelText("Fecha desde"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Fecha hasta"), {
    target: { value: "2026-01-01" },
  });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(
    within(table).getByText("Revisión general", { exact: true }),
  ).toBeInTheDocument();
});
