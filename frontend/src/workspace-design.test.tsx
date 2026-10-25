import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Workbench from "./Workbench";
import { testUsers } from "./testing/WorkbenchHarness";
import { emptyForm } from "./data";
import { persistWorkbench } from "./requests";

test("order materials remain in a named keyboard-focusable table region", async () => {
  persistWorkbench({
    orders: [
      {
        id: "design-order",
        number: "OT-DESIGN",
        status: "Lista para iniciar",
        createdAt: new Date().toISOString(),
        form: {
          ...emptyForm(),
          busId: "BUS015",
          odometer: "184520",
          services: [],
        },
      },
    ],
    requests: [],
  });
  const user = userEvent.setup();
  render(<Workbench user={testUsers.mechanic} onLogout={async () => {}} />);
  await user.click(screen.getByRole("button", { name: "Órdenes de trabajo" }));
  await user.click(screen.getByRole("button", { name: "Ver detalles" }));
  const region = screen.getByRole("region", {
    name: "Materiales de la orden, tabla desplazable",
  });
  expect(region).toHaveAttribute("tabindex", "0");
  region.focus();
  expect(region).toHaveFocus();
  expect(region.querySelector("table")).toHaveClass("data-table");
});

test("vehicle history remains a table with a named keyboard-focusable scroll region", async () => {
  const user = userEvent.setup();
  render(<Workbench user={testUsers.admin} onLogout={async () => {}} />);
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.click(
    screen.getByRole("button", { name: /BUS015.*Ver historial/ }),
  );
  const region = screen.getByRole("region", {
    name: "Historial de BUS015, tabla desplazable",
  });
  expect(region).toHaveAttribute("tabindex", "0");
  expect(region.querySelector("table")).toHaveClass("history-table");
  expect(
    screen.getByRole("button", { name: "Limpiar filtros" }),
  ).toBeInTheDocument();
});
