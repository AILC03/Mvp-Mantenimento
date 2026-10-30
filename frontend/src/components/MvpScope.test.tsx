import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { testUsers } from "../testing/WorkbenchHarness";
import { defaultCatalogs, persistCatalogs } from "../catalogs";
import { persistWorkbench, loadWorkbench } from "../requests";
import { persistTripCases, startTripCase } from "../trip-reviews";
import { emptyForm, type SavedOrder } from "../data";
import { CirculationSummary, UnitRecords } from "./UnitRecords";
import { TripIncidents } from "./TripIncidents";

test("consulta vacía y error de red explícitos, sin simular guardado", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ incidents: [] }),
    } as Response)
    .mockRejectedValueOnce(new TypeError("Sin red"));
  render(<TripIncidents tripId="own-trip" />);
  await user.click(
    screen.getByRole("button", { name: "Ver incidencias de la unidad" }),
  );
  expect(
    await screen.findByText("Sin incidencias activas en esta unidad."),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Cerrar consulta de incidencias" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Ver incidencias de la unidad" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Sin red");
});

test("fallo de guardado externo conserva campos y no anuncia éxito", async () => {
  const user = userEvent.setup();
  const commit = vi
    .fn()
    .mockResolvedValue("Servidor no disponible; no se guardó.");
  render(
    <UnitRecords
      vehicle={defaultCatalogs().vehicles[0]}
      user={testUsers.mechanic}
      data={{ orders: [], requests: [] }}
      onCommit={commit}
    />,
  );
  await user.click(
    screen.getByRole("button", {
      name: "Registrar servicio externo/carretera",
    }),
  );
  await user.type(
    screen.getByLabelText("Servicio realizado"),
    "Trabajo pendiente de guardar",
  );
  await user.type(
    screen.getByLabelText("Prestador (empresa/persona)"),
    "Prestador",
  );
  await user.click(
    screen.getByRole("button", { name: "Guardar servicio externo" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("no se guardó");
  expect(screen.getByLabelText("Servicio realizado")).toHaveValue(
    "Trabajo pendiente de guardar",
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test.each(["pre", "post"] as const)(
  "consulta incidencias durante %s conserva respuestas y notas, sin resolver ni nuevas respuestas",
  async (stage) => {
    const catalogs = defaultCatalogs();
    const template = catalogs.reviews.find((r) => r.id === "trip")!;
    template.aspects = [{ id: "a", text: "Puerta" }];
    persistCatalogs(catalogs);
    const cases = startTripCase(
      [],
      testUsers.driver,
      {
        busId: "BUS015",
        departureDate: "2026-11-01",
        returnDate: "2026-11-02",
      },
      catalogs.vehicles,
    );
    if (stage === "post") {
      cases[0].template = template;
      cases[0].pre = {
        answers: { a: "good" },
        notes: "",
        submittedAt: "2026-01-01",
        submittedBy: testUsers.driver.id,
      };
    }
    persistTripCases(cases);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        incidents: [
          {
            id: "active",
            title: "Puerta dañada",
            description: "Reporte previo",
            origin: "Golpe",
            date: "2026-01-01",
            resolved: false,
          },
          {
            id: "resolved",
            title: "Freno reparado",
            description: "",
            origin: "Revisión",
            date: "2026-01-02",
            resolved: true,
          },
        ],
      }),
    } as Response);
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(
      screen.getByLabelText("Perfil de demostración"),
      "driver",
    );
    await user.click(screen.getByRole("button", { name: "Revisiones" }));
    await user.click(
      screen.getByRole("button", { name: `Realizar ${stage} trip` }),
    );
    await user.click(screen.getByRole("radio", { name: "Con falla" }));
    await user.type(
      screen.getByLabelText("Observaciones de la revisión"),
      "Mi captura pendiente",
    );
    await user.click(
      screen.getByRole("button", { name: "Ver incidencias de la unidad" }),
    );
    expect(await screen.findByText("Puerta dañada")).toBeInTheDocument();
    const consultation = screen.getByRole("dialog", {
      name: "Incidencias de la unidad",
    });
    expect(consultation.closest("form")).toBeNull();
    expect(screen.queryByText("Freno reparado")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Consultar resueltas"));
    expect(screen.getByText("Freno reparado")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Resolver/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await user.click(
      screen.getByRole("button", { name: "Cerrar consulta de incidencias" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Incidencias de la unidad" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Observaciones de la revisión")).toHaveValue(
      "Mi captura pendiente",
    );
    expect(screen.getByRole("radio", { name: "Con falla" })).toBeChecked();
    expect(fetch).toHaveBeenCalledWith(
      `/api/operations/trips/${cases[0].id}/incidents`,
      expect.objectContaining({ credentials: "include" }),
    );
  },
);

test("registro externo y decisiones persisten al remontar, historial aislado y cancelar no decide", async () => {
  persistCatalogs(defaultCatalogs());
  persistWorkbench({ orders: [], requests: [] });
  const user = userEvent.setup();
  const view = render(<App />);
  async function openUnit() {
    await user.click(screen.getByRole("button", { name: "Unidades" }));
    await user.click(
      screen.getByRole("button", { name: "BUS015 · Ver historial" }),
    );
  }
  await openUnit();
  expect(
    screen.getByRole("heading", { name: "Circulación: Sin evaluar" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Decidir circulación" }));
  await user.selectOptions(
    screen.getByLabelText("Decisión de circulación"),
    "authorized",
  );
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(loadWorkbench().circulationDecisions).toBeUndefined();
  await user.click(
    screen.getByRole("button", {
      name: "Registrar servicio externo/carretera",
    }),
  );
  await user.type(
    screen.getByLabelText("Servicio realizado"),
    "Reparación física externa",
  );
  await user.type(
    screen.getByLabelText("Prestador (empresa/persona)"),
    "Empresa de prueba",
  );
  fireEvent.change(screen.getByLabelText("Costo de materiales (MXN)"), {
    target: { value: "10.25" },
  });
  fireEvent.change(screen.getByLabelText("Costo de mano de obra (MXN)"), {
    target: { value: "5" },
  });
  await user.click(
    screen.getByRole("button", { name: "Guardar servicio externo" }),
  );
  expect(loadWorkbench().externalServices?.[0]).toMatchObject({
    busId: "BUS015",
    materialsCost: 10.25,
    laborCost: 5,
  });
  for (const status of ["authorized", "unauthorized"]) {
    await user.click(
      screen.getByRole("button", { name: "Decidir circulación" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Decisión de circulación"),
      status,
    );
    await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  }
  view.unmount();
  render(<App />);
  await openUnit();
  expect(
    screen.getByRole("heading", { name: "Circulación: No autorizado" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Total:.*15.25/)).toBeInTheDocument();
  expect(loadWorkbench().circulationDecisions).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Volver a unidades" }));
  await user.click(
    screen.getByRole("button", { name: "BUS008 · Ver historial" }),
  );
  expect(screen.queryByText(/Empresa de prueba/)).not.toBeInTheDocument();
});

test("resumen solo aparece al pulsar su botón y separa no autorizados de sin evaluar", async () => {
  const vehicles = defaultCatalogs().vehicles;
  render(
    <CirculationSummary
      vehicles={[
        ...vehicles,
        {
          ...vehicles[0],
          id: "truck",
          type: "truck",
          fleetNumber: "SPR-EXISTENTE",
        },
      ]}
      data={{
        orders: [],
        requests: [],
        circulationDecisions: [
          {
            id: "1",
            busId: vehicles[0].id,
            status: "unauthorized",
            actorId: "a",
            actorName: "A",
            recordedAt: "2026-01-01",
          },
          {
            id: "2",
            busId: vehicles[1].id,
            status: "authorized",
            actorId: "a",
            actorName: "A",
            recordedAt: "2026-01-01",
          },
        ],
      }}
    />,
  );
  expect(
    screen.queryByRole("heading", { name: "No autorizados" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Sin evaluar" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(vehicles[0].fleetNumber)).not.toBeInTheDocument();
  expect(screen.queryByText(vehicles[1].fleetNumber)).not.toBeInTheDocument();
  expect(screen.queryByText("SPR-EXISTENTE")).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: "Resumen del estado de circulación de las unidades",
    }),
  );
  const photo = within(screen.getByRole("dialog"));
  expect(
    photo.getByRole("heading", { name: "Sin evaluar" }),
  ).toBeInTheDocument();
  expect(
    photo.getByRole("heading", { name: "No autorizados" }),
  ).toBeInTheDocument();
  expect(photo.getByText(vehicles[0].fleetNumber)).toBeInTheDocument();
  expect(photo.getByText("SPR-EXISTENTE")).toBeInTheDocument();
  expect(photo.getByText(/Sprinter/)).toBeInTheDocument();
  expect(photo.queryByText(vehicles[1].fleetNumber)).not.toBeInTheDocument();
  await user.click(photo.getByRole("button", { name: "Cerrar ventana" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "No autorizados" }),
  ).not.toBeInTheDocument();
});

test("imprime orden física e impide odómetro inferior conservando formulario", async () => {
  const order: SavedOrder = {
    id: "o",
    number: "OT-FISICA",
    createdAt: "2026-01-01",
    status: "En proceso",
    form: {
      ...emptyForm(),
      busId: "BUS015",
      odometer: "1000",
      services: [
        {
          id: "s",
          catalogId: "oil-change",
          name: "Trabajo eléctrico",
          hours: 1,
          category: "Eléctrico",
          assignee: "Técnico sin cuenta",
          instructions: "Revisar cableado",
          materials: [],
        },
      ],
    },
  };
  persistWorkbench({ orders: [order], requests: [] });
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "En proceso" }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  const before = loadWorkbench();
  await user.click(
    screen.getByRole("button", { name: "Imprimir orden de trabajo" }),
  );
  const sheet = document.querySelector(".requisition-sheet")!;
  expect(sheet).toHaveTextContent("Orden de trabajo");
  expect(sheet).toHaveTextContent("Técnico sin cuenta");
  expect(sheet).toHaveTextContent("Revisar cableado");
  expect(sheet).toHaveTextContent("BUS015");
  expect(
    within(sheet as HTMLElement).queryByRole("button"),
  ).not.toBeInTheDocument();
  expect(print).toHaveBeenCalledOnce();
  fireEvent(window, new Event("afterprint"));
  expect(loadWorkbench()).toEqual(before);
  await user.click(screen.getByRole("button", { name: "Terminar orden" }));
  await user.click(screen.getByRole("checkbox", { name: "Trabajo eléctrico" }));
  fireEvent.change(screen.getByLabelText("Odómetro al terminar"), {
    target: { value: "1" },
  });
  await user.click(
    screen.getByRole("button", { name: "Confirmar finalización" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("apertura");
  expect(screen.getByLabelText("Odómetro al terminar")).toHaveValue(1);
  expect(
    screen.getByRole("checkbox", { name: "Trabajo eléctrico" }),
  ).toBeChecked();
  expect(loadWorkbench().orders[0].status).toBe("En proceso");
});
