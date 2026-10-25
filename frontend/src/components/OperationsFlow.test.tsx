import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { defaultCatalogs, persistCatalogs } from "../catalogs";
import { emptyForm, type SavedOrder } from "../data";
import { loadWorkbench, persistWorkbench } from "../requests";
import { recordPeriodicReview, fleetRecords, remainingDays } from "../fleet";
import { testUsers } from "../testing/WorkbenchHarness";
import { confirmMaterials } from "../orders";

const order: SavedOrder = {
  id: "ot1",
  number: "OT-PRUEBA",
  createdAt: "2026-01-01T12:00:00Z",
  status: "Lista para iniciar",
  form: {
    ...emptyForm(),
    busId: "BUS015",
    odometer: "180000",
    services: [
      {
        id: "caf1",
        catalogId: "oil-change",
        name: "Servicio CAF",
        category: "Motor",
        hours: 2,
        instructions: "Instrucciones de prueba",
        assignee: "Mecánico",
        materials: [{ id: "m1", productId: "oil", quantity: 5, unitCost: 115 }],
      },
    ],
  },
};

test("mechanic cannot edit vehicles or review types and admin no longer has the periodic overview", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(
    screen.queryByRole("button", { name: "Artículos de almacén" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Tipos de revisión" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  expect(
    screen.queryByRole("button", { name: "Nueva unidad" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Editar unidad/ }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "BUS015 · Ver historial" }),
  );
  expect(screen.getByText("Sin registro del último CAF")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Corrección extraordinaria de CAF" }),
  ).not.toBeInTheDocument();
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "admin",
  );
  expect(
    screen.queryByRole("heading", { name: "Revisiones periódicas" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Tipos de revisión" }),
  ).toBeInTheDocument();
});

test("order details print a requisition and allow start, pause, resume and finish without release", async () => {
  const catalogs = defaultCatalogs();
  catalogs.products[0].entries = [
    {
      id: "e1",
      quantity: 20,
      unitCost: 115,
      occurredOn: "2026-01-01",
      supplier: "",
      receiptReference: "",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];
  persistCatalogs(catalogs);
  persistWorkbench(
    confirmMaterials(
      { orders: [order], requests: [] },
      catalogs.products,
      testUsers.warehouse,
      order.id,
      [{ productId: "oil", delivered: 5, returned: 0 }],
    ),
  );
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Órdenes de trabajo/ }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  expect(screen.getByText("Instrucciones de prueba")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Imprimir requisición" }),
  );
  expect(print).toHaveBeenCalledOnce();
  expect(document.querySelector(".requisition-sheet")).toHaveTextContent(
    "OT-PRUEBA",
  );
  fireEvent(window, new Event("afterprint"));
  await user.click(screen.getByRole("button", { name: "Iniciar orden" }));
  await user.click(screen.getByRole("button", { name: "Pausar orden" }));
  await user.type(
    screen.getByLabelText(/^Motivo de pausa/),
    "Esperando materiales",
  );
  await user.click(screen.getByRole("button", { name: "Confirmar pausa" }));
  expect(loadWorkbench().orders[0].status).toBe("Pausada");
  await user.click(screen.getByRole("button", { name: "Reanudar orden" }));
  await user.click(screen.getByRole("button", { name: "Terminar orden" }));
  await user.click(screen.getByRole("checkbox", { name: "Servicio CAF" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar finalización" }),
  );
  expect(loadWorkbench().orders[0].status).toBe("Finalizada");
  expect(loadWorkbench().orders[0].completion?.performedServiceIds).toEqual([
    "caf1",
  ]);
  expect(screen.getByRole("button", { name: "Finalizadas" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Pendientes" }));
  expect(
    screen.queryByRole("button", { name: "OT-PRUEBA" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Finalizadas" }));
  expect(screen.getByRole("button", { name: "OT-PRUEBA" })).toBeInTheDocument();
});

test("warehouse sees required materials and confirming delivery and returns updates the warehouse view", async () => {
  const catalogs = defaultCatalogs();
  catalogs.products[0].entries = [
    {
      id: "e1",
      quantity: 20,
      unitCost: 115,
      occurredOn: "2026-01-01",
      supplier: "Proveedor",
      receiptReference: "",
      createdAt: "2026-01-01T12:00:00Z",
    },
  ];
  persistCatalogs(catalogs);
  persistWorkbench({ orders: [order], requests: [] });
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "warehouse",
  );
  await user.click(screen.getByRole("button", { name: /Órdenes de trabajo/ }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  expect(
    screen.queryByRole("button", { name: "Iniciar orden" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Dar salida a materiales" }),
  );
  const delivered = screen.getByLabelText("Entregada Aceite de motor 15W-40");
  await user.clear(delivered);
  await user.type(delivered, "5");
  const returned = screen.getByLabelText("Devuelta Aceite de motor 15W-40");
  await user.clear(returned);
  await user.type(returned, "1");
  await user.click(
    screen.getByRole("button", { name: "Confirmar materiales" }),
  );
  expect(loadWorkbench().orders[0].materialConfirmations?.[0].lines[0]).toEqual(
    expect.objectContaining({ delivered: 5, returned: 1 }),
  );
  await user.click(
    screen.getByRole("button", { name: "Artículos de almacén" }),
  );
  expect(screen.getByText("16 L")).toBeInTheDocument();
});

test("mechanic performs a past-due review without assignment and the counter restarts at 45 days", async () => {
  const catalogs = defaultCatalogs();
  catalogs.reviews[0].aspects = [
    { id: "a1", text: "Aspecto real definido por admin" },
  ];
  persistCatalogs(catalogs);
  persistWorkbench(
    recordPeriodicReview(
      { orders: [], requests: [] },
      testUsers.mechanic,
      "BUS015",
      catalogs.reviews[0],
      {
        date: "2026-01-01",
        answers: { a1: "good" },
        notes: "Registro anterior",
      },
    ),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Revisiones" }));
  expect(
    screen.getByText(/Vencida hace.*Puedes realizarla igualmente/),
  ).toBeInTheDocument();
  const button = screen
    .getAllByRole("button", { name: "Realizar revisión" })
    .find((item) => !(item as HTMLButtonElement).disabled)!;
  await user.click(button);
  await user.click(screen.getByRole("radio", { name: "Bien" }));
  await user.click(
    screen.getByRole("button", { name: "Guardar revisión realizada" }),
  );
  expect(
    screen.getByText("Faltan 45 días. También puedes realizarla antes."),
  ).toBeInTheDocument();
  const last = fleetRecords(loadWorkbench()).reviewJobs[0];
  expect(last.selfInitiated).toBe(true);
  expect(remainingDays(last.completion!.date, 45)).toBe(45);
  expect(
    screen.queryByRole("button", { name: /Solicitar revisión/ }),
  ).not.toBeInTheDocument();
});
