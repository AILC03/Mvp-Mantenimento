import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { loadWorkbench, persistWorkbench } from "../requests";
import { workshop } from "../../../shared/src/workshop";
import { workshopFixture } from "../testing/workshop-fixture";

test("el alta contextual de responsable no envía accidentalmente la orden contenedora", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  await user.selectOptions(screen.getByLabelText(/^Unidad \(/), "BUS015");
  await user.click(
    screen.getByRole("button", { name: "Agregar correctivo libre" }),
  );
  await user.type(screen.getByLabelText("Instrucciones"), "Ajustar la puerta");
  await user.click(
    screen.getByRole("button", { name: "Agregar nuevo responsable" }),
  );
  await user.type(screen.getByLabelText("Nombre *"), "Persona contextual");
  await user.type(screen.getByLabelText("Puesto *"), "Electricista");
  await user.click(screen.getByRole("button", { name: "Guardar empleado" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(loadWorkbench().orders).toHaveLength(0);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const person = workshop(loadWorkbench()).employees[0];
  expect(person.name).toBe("Persona contextual");
  expect(screen.getByLabelText("Responsable de la orden")).toHaveValue(
    person.id,
  );
  expect(screen.getByLabelText("Instrucciones")).toHaveValue(
    "Ajustar la puerta",
  );
});

test("el directorio admite edición y baja lógica sin eliminar referencias previas", async () => {
  persistWorkbench({ orders: [], requests: [], workshop: workshopFixture() });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Personal del taller" }));
  await user.click(screen.getByRole("button", { name: "Editar / desactivar" }));
  await user.clear(screen.getByLabelText("Puesto *"));
  await user.type(screen.getByLabelText("Puesto *"), "Mecánico especialista");
  await user.click(screen.getByRole("checkbox", { name: "Activo" }));
  await user.click(screen.getByRole("button", { name: "Guardar empleado" }));
  expect(workshop(loadWorkbench()).employees[0]).toMatchObject({
    id: "employee-test",
    active: false,
    position: "Mecánico especialista",
  });
  expect(screen.getByText("Inactivo")).toBeInTheDocument();
});
