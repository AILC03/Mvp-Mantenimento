import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";
import { defaultCatalogs } from "../catalogs";
import { setDomainStorage } from "../../../shared/src/storage";
import { applyCommand, type Command } from "../../../shared/src/operations";
import { startOperations, type Snapshot } from "../operations-client";
import { testUsers } from "../testing/WorkbenchHarness";
import { TripReviews } from "./TripReviews";

let server: Snapshot;
beforeEach(() => {
  const memory = new Map<string, string>();
  setDomainStorage({
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  });
  server = {
    catalogs: defaultCatalogs(),
    workbench: { orders: [], requests: [] },
    trips: [],
    revision: 0,
    imported: false,
    draft: null,
  };
  // Proyección normal del chofer: no hacen falta productos, servicios ni expedientes.
  server.catalogs.products = [];
  server.catalogs.services = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
    if (options?.body) {
      const body = JSON.parse(String(options.body)) as {
        command: Command;
        revision: number;
      };
      expect(body.revision).toBe(server.revision);
      const next = applyCommand(
        server,
        testUsers.driver,
        body.command,
        server.revision + 1,
      );
      server = {
        ...next,
        revision: server.revision + 1,
        imported: false,
        draft: null,
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => structuredClone(server),
    } as Response;
  });
});

test("abrir un caso carga ambas categorías y crea el viaje de una Sprinter con clave truck sin recargar", async () => {
  const initial = await startOperations();
  const user = userEvent.setup();
  render(
    <TripReviews
      user={testUsers.driver}
      vehicles={initial.catalogs.vehicles}
      templates={initial.catalogs.reviews}
    />,
  );
  const bus = {
    ...server.catalogs.vehicles[0],
    id: "new-bus",
    fleetNumber: "BUS-NUEVO",
    model: "Modelo nuevo",
    plate: "PLACA-NUEVA",
  };
  const truck = {
    ...bus,
    id: "truck",
    fleetNumber: "CAM-NUEVO",
    type: "truck" as const,
  };
  server.catalogs.vehicles = [bus, truck];
  server.revision = 3;
  await user.click(
    screen.getByRole("button", { name: "Iniciar caso de revisión" }),
  );
  const select = await screen.findByRole("combobox", {
    name: /Unidad del viaje/,
  });
  await screen.findByRole("option", { name: /BUS-NUEVO.*PLACA-NUEVA/ });
  expect(
    within(select).queryByRole("option", { name: /BUS015/ }),
  ).not.toBeInTheDocument();
  expect(
    within(select).getByRole("option", { name: /CAM-NUEVO.*Sprinter/ }),
  ).toBeInTheDocument();
  await user.selectOptions(select, truck.id);
  fireEvent.change(screen.getByLabelText(/Fecha de ida/), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText(/Fecha de regreso/), {
    target: { value: "2026-11-02" },
  });
  await user.click(screen.getByRole("button", { name: /^Iniciar caso$/ }));
  expect(server.trips[0]).toMatchObject({
    busId: truck.id,
    fleetNumber: truck.fleetNumber,
    driverId: testUsers.driver.id,
  });
  expect(
    await screen.findByRole("button", { name: /Realizar pre trip/ }),
  ).toBeInTheDocument();
});

test("fallo de carga muestra error, no ofrece opciones obsoletas y reintenta sin perder fechas", async () => {
  const initial = await startOperations();
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Sin red"));
  const user = userEvent.setup();
  render(
    <TripReviews
      user={testUsers.driver}
      vehicles={initial.catalogs.vehicles}
      templates={initial.catalogs.reviews}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Iniciar caso de revisión" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo conectar",
  );
  expect(
    screen.getByRole("combobox", { name: /Unidad del viaje/ }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Fecha de ida/), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText(/Fecha de regreso/), {
    target: { value: "2026-11-02" },
  });
  await user.click(
    screen.getByRole("button", { name: "Reintentar carga de unidades" }),
  );
  expect(
    await screen.findByRole("option", { name: /BUS015/ }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/Fecha de ida/)).toHaveValue("2026-11-01");
  expect(screen.getByLabelText(/Fecha de regreso/)).toHaveValue("2026-11-02");
  expect(
    screen.getByRole("combobox", { name: /Unidad del viaje/ }),
  ).not.toBeDisabled();
});

test("catálogo vacío muestra una explicación en lugar de una lista engañosa", async () => {
  await startOperations();
  server.catalogs.vehicles = [];
  const user = userEvent.setup();
  render(
    <TripReviews
      user={testUsers.driver}
      vehicles={[]}
      templates={server.catalogs.reviews}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Iniciar caso de revisión" }),
  );
  expect(
    await screen.findByText(
      /No hay unidades registradas para iniciar un viaje/,
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Iniciar caso$/ })).toBeDisabled();
});
