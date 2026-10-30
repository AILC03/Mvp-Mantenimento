import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { defaultCatalogs, persistCatalogs, loadCatalogs } from "../catalogs";
import { loadWorkbench, persistWorkbench } from "../requests";
import { loadTripCases } from "../trip-reviews";
import { emptyForm, type SavedOrder } from "../data";

test("Sprinter existente conserva historial e ID en filtros, selectores, pre/post, revisión, circulación e impreso", async () => {
  const catalogs = defaultCatalogs();
  const sprinter = {
    ...catalogs.vehicles[0],
    id: "legacy-truck-id",
    fleetNumber: "SPR-001",
    type: "truck" as const,
    model: "Sprinter",
    plate: "SPR-PLACA",
  };
  catalogs.vehicles.push(sprinter);
  catalogs.reviews.find((t) => t.id === "trip")!.aspects = [
    { id: "a", text: "Puerta de pasajeros" },
  ];
  catalogs.reviews.find((t) => t.id === "general")!.aspects = [
    { id: "g", text: "Revisión de pasajeros" },
  ];
  persistCatalogs(catalogs);
  const order: SavedOrder = {
    id: "old-order",
    number: "OT-SPR-ANTERIOR",
    createdAt: "2026-01-01",
    status: "En proceso",
    form: {
      ...emptyForm(),
      busId: sprinter.id,
      odometer: "1000",
      services: [
        {
          id: "s",
          catalogId: "oil-change",
          name: "CAF Sprinter",
          category: "Motor",
          hours: 1,
          instructions: "Inspeccionar Sprinter",
          assignee: "Responsable",
          materials: [],
        },
      ],
    },
  };
  const damage = {
    id: "old-damage",
    busId: sprinter.id,
    kind: "Golpe" as const,
    area: "Puerta",
    description: "Historial previo Sprinter",
    date: "2026-01-01",
    recordedAt: "2026-01-02",
    actorId: "historic",
    actorName: "Histórico",
  };
  persistWorkbench({
    orders: [order],
    requests: [],
    fleet: {
      damages: [damage],
      reviewJobs: [],
      resolutions: [],
      cafCorrections: [],
    },
  });
  const user = userEvent.setup();
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "admin",
  );
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.selectOptions(
    screen.getByLabelText("Filtrar tipo de unidad"),
    "truck",
  );
  expect(
    screen.queryByRole("button", { name: "BUS015 · Ver historial" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "SPR-001 · Ver historial" }),
  );
  expect(
    screen.getByText(/Puerta: Historial previo Sprinter/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Decidir circulación" }));
  await user.selectOptions(
    screen.getByLabelText("Decisión de circulación"),
    "unauthorized",
  );
  await user.click(screen.getByRole("button", { name: "Guardar decisión" }));
  await user.click(screen.getByRole("button", { name: "Volver a unidades" }));
  await user.click(
    screen.getByRole("button", {
      name: "Resumen del estado de circulación de las unidades",
    }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText("SPR-001"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).getByText(/Sprinter/),
  ).toBeInTheDocument();
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Cerrar ventana",
    }),
  );
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  expect(screen.getByRole("option", { name: /SPR-001.*Sprinter/ })).toHaveValue(
    sprinter.id,
  );
  await user.click(screen.getByRole("button", { name: "Revisiones" }));
  await user.click(
    screen.getByRole("button", { name: "Iniciar caso de revisión" }),
  );
  await user.selectOptions(
    screen.getByLabelText(/^Unidad del viaje/),
    sprinter.id,
  );
  fireEvent.change(screen.getByLabelText(/^Fecha de ida/), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText(/^Fecha de regreso/), {
    target: { value: "2026-11-02" },
  });
  await user.click(screen.getByRole("button", { name: /^Iniciar caso$/ }));
  for (const stage of ["pre", "post"] as const) {
    await user.click(
      screen.getByRole("button", { name: `Realizar ${stage} trip` }),
    );
    await user.click(screen.getByRole("radio", { name: "Bien" }));
    await user.click(
      screen.getByRole("button", { name: `Enviar revisión ${stage} trip` }),
    );
  }
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "mechanic",
  );
  await user.click(screen.getByRole("button", { name: "Revisiones" }));
  await user.click(screen.getByRole("button", { name: "Revisar y cerrar" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Cierre de caso",
    }),
  );
  expect(loadTripCases()[0]).toMatchObject({
    busId: sprinter.id,
    fleetNumber: sprinter.fleetNumber,
  });
  expect(loadTripCases()[0].closedAt).toBeTruthy();
  await user.selectOptions(
    screen.getByLabelText("Unidad a revisar"),
    sprinter.id,
  );
  expect(
    screen.getByRole("option", { name: /SPR-001.*Sprinter/ }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  expect(screen.getByRole("option", { name: /SPR-001.*Sprinter/ })).toHaveValue(
    sprinter.id,
  );
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "Ir al listado" }));
  await user.click(screen.getByRole("button", { name: "En proceso" }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  await user.click(
    screen.getByRole("button", { name: "Imprimir orden de trabajo" }),
  );
  expect(document.querySelector(".requisition-sheet")).toHaveTextContent(
    "Sprinter",
  );
  expect(document.querySelector(".requisition-sheet")).toHaveTextContent(
    "OT-SPR-ANTERIOR",
  );
  expect(print).toHaveBeenCalledOnce();
  fireEvent(window, new Event("afterprint"));
  expect(loadCatalogs().vehicles.find((v) => v.id === sprinter.id)).toEqual(
    sprinter,
  );
  expect(loadWorkbench().orders[0]).toEqual(order);
  expect(loadWorkbench().fleet?.damages[0]).toEqual(damage);
});
