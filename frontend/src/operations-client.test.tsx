import { beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperationsWorkspace } from "./OperationsWorkspace";
import { defaultCatalogs } from "./catalogs";
import { setDomainStorage } from "../../shared/src/storage";
import { applyCommand, type Command } from "../../shared/src/operations";
import { testUsers } from "./testing/WorkbenchHarness";
import {
  currentSnapshot,
  startOperations,
  executeCommand,
  type Snapshot,
} from "./operations-client";

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
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, options?: RequestInit) => {
      if (options?.body) {
        const { revision, command } = JSON.parse(String(options.body)) as {
          revision: number;
          command: Command;
        };
        if (revision !== server.revision)
          return {
            ok: false,
            status: 409,
            json: async () => ({
              message: "Recarga los datos; otro usuario guardó cambios.",
            }),
          } as Response;
        const next = applyCommand(
          server,
          testUsers.admin,
          command,
          server.revision + 1,
        );
        server = {
          ...next,
          revision: server.revision + 1,
          imported: false,
          draft: command.type === "draft.save" ? command.form : server.draft,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => structuredClone(server),
      } as Response;
    }),
  );
});

test("loads and saves through the API even when browser storage is unavailable", async () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Browser storage forbidden");
  });
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Browser storage forbidden");
    });
  const user = userEvent.setup();
  render(
    <OperationsWorkspace user={testUsers.admin} onLogout={async () => {}} />,
  );
  await screen.findByRole("heading", {
    name: "Solicitudes de servicio",
    level: 1,
  });
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.click(screen.getByRole("button", { name: "Nueva unidad" }));
  await user.type(screen.getByLabelText(/Número económico/), "SERVER-001");
  await user.type(screen.getByLabelText(/Odómetro/), "100");
  await user.click(
    screen.getByRole("button", { name: "Guardar" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    server.catalogs.vehicles.some((v) => v.fleetNumber === "SERVER-001"),
  ).toBe(true);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

test("a failed save leaves the form open and does not mutate the memory snapshot or browser storage", async () => {
  const user = userEvent.setup();
  render(
    <OperationsWorkspace user={testUsers.admin} onLogout={async () => {}} />,
  );
  await screen.findByRole("heading", {
    name: "Solicitudes de servicio",
    level: 1,
  });
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.click(screen.getByRole("button", { name: "Nueva unidad" }));
  await user.type(screen.getByLabelText(/Número económico/), "NOT-SAVED");
  await user.type(screen.getByLabelText(/Odómetro/), "100");
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Offline"));
  const before = currentSnapshot();
  await user.click(
    screen.getByRole("button", { name: "Guardar" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo conectar al servidor",
  );
  expect(screen.getByLabelText(/Número económico/)).toHaveValue("NOT-SAVED");
  expect(currentSnapshot()).toBe(before);
  expect(
    server.catalogs.vehicles.some((v) => v.fleetNumber === "NOT-SAVED"),
  ).toBe(false);
});

test("stale saves are rejected and a fresh session recovers the draft from the server", async () => {
  await startOperations();
  const form = {
    busId: "BUS015",
    priority: "Normal" as const,
    reason: "Borrador privado",
    scheduledDate: "",
    odometer: "100",
    services: [],
  };
  await executeCommand({ type: "draft.save", form });
  await startOperations();
  expect(currentSnapshot()?.draft?.reason).toBe("Borrador privado");
  server.revision++;
  const before = currentSnapshot();
  await expect(
    executeCommand({ type: "draft.save", form: { ...form, reason: "Stale" } }),
  ).rejects.toThrow("Recarga");
  expect(currentSnapshot()).toBe(before);
  expect(server.draft?.reason).toBe("Borrador privado");
});
