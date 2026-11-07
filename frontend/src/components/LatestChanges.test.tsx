import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { CATALOGS_KEY, defaultCatalogs, loadCatalogs } from "../catalogs";
import { loadWorkbench } from "../requests";

test("chofer registra falla directamente en la unidad sin solicitud pendiente y conserva el reporte al remontar", async () => {
  const user = userEvent.setup();
  const app = render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  await user.click(screen.getByRole("button", { name: "Reportar falla" }));
  await user.selectOptions(
    screen.getByLabelText("Unidad (Autobús o Sprinter)"),
    "BUS015",
  );
  await user.type(screen.getByLabelText("Parte afectada"), "Puerta");
  await user.type(
    screen.getByLabelText("Descripción"),
    "No cierra correctamente",
  );
  await user.type(
    screen.getByLabelText(/Responsable del golpe/),
    "Sin determinar",
  );
  await user.click(
    screen.getByRole("button", { name: "Guardar reporte en la unidad" }),
  );
  expect(loadWorkbench().fleet?.damages[0]).toMatchObject({
    kind: "Falla",
    busId: "BUS015",
    description: "No cierra correctamente",
    responsible: "Sin determinar",
  });
  expect(loadWorkbench().requests).toEqual([]);
  expect(screen.getByRole("status")).toHaveTextContent(
    "No requiere confirmación",
  );
  app.unmount();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Unidades" }));
  await user.click(
    screen.getByRole("button", { name: "BUS015 · Ver historial" }),
  );
  expect(
    screen.getByRole("button", { name: "Abrir orden por esta falla" }),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Abrir orden por esta falla" }),
  );
  expect(screen.getByLabelText("Descripción del correctivo")).toHaveValue(
    "Puerta: No cierra correctamente",
  );
  expect(loadWorkbench().fleet?.damages).toHaveLength(1);
});

test("alta y baja lógica de empleado se guardan sin cuentas ni pérdida del registro", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    screen.getByRole("button", { name: "Empleados del taller" }),
  );
  await user.click(screen.getByRole("button", { name: "Agregar empleado" }));
  await user.type(
    screen.getByLabelText("Nombre", { exact: true }),
    "Ana Prueba",
  );
  await user.type(screen.getByLabelText("Puesto o especialidad"), "Mecánica");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const id = loadCatalogs().employees[0].id;
  await user.click(screen.getByRole("button", { name: "Editar Ana Prueba" }));
  await user.click(screen.getByRole("checkbox", { name: /Empleado activo/ }));
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(loadCatalogs().employees[0]).toMatchObject({
    id,
    active: false,
    name: "Ana Prueba",
  });
  expect(screen.getByText(/Empleado dado de baja/)).toBeInTheDocument();
});

test("correctivo libre admite piezas compatibles y responsable de catálogo sin exigir existencias de almacén", async () => {
  const catalogs = defaultCatalogs();
  catalogs.employees = [
    {
      id: "employee-test",
      name: "Ana Prueba",
      position: "Mecánica",
      phone: "",
      active: true,
    },
  ];
  catalogs.vehicleParts = [
    {
      id: "part-test",
      name: "Faro especial",
      partNumber: "F-77",
      note: "",
      compatibleVehicleIds: ["BUS015"],
    },
  ];
  localStorage.setItem(CATALOGS_KEY, JSON.stringify(catalogs));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Nueva orden" }));
  await user.selectOptions(screen.getByLabelText(/^Unidad \(/), "BUS015");
  await user.selectOptions(
    screen.getByLabelText("Responsable del trabajo"),
    "employee-test",
  );
  await user.selectOptions(
    screen.getByLabelText("Agregar pieza compatible"),
    "part-test",
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar correctivo de texto libre" }),
  );
  await user.clear(screen.getByLabelText("Descripción del correctivo"));
  await user.type(
    screen.getByLabelText("Descripción del correctivo"),
    "Sustituir faro dañado",
  );
  await user.click(screen.getByRole("button", { name: /^Crear orden/ }));
  const order = loadWorkbench().orders[0];
  expect(order.form.responsible).toMatchObject({
    refId: "employee-test",
    name: "Ana Prueba",
    kind: "taller",
  });
  expect(order.form.partMaterials?.[0]).toMatchObject({
    partId: "part-test",
    partNumber: "F-77",
    quantity: 1,
  });
  expect(order.form.services[0]).toMatchObject({
    catalogId: "",
    name: "Sustituir faro dañado",
    materials: [],
  });
  expect(loadCatalogs().products).toEqual(catalogs.products);
});
