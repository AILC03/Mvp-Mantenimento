import { emptyWorkshop } from "../../../shared/src/workshop";
export function workshopFixture() {
  const w = emptyWorkshop();
  w.employees = [
    {
      id: "employee-test",
      name: "Carlos Méndez · Mecánico",
      position: "Mecánico",
      phone: "",
      active: true,
    },
  ];
  w.suppliers = [
    {
      id: "supplier-test",
      name: "Empresa de prueba",
      kind: "service",
      service: "Mecánica",
      location: "",
      phone: "123",
      officePhone: "",
      email: "",
      notes: "",
      active: true,
    },
  ];
  return w;
}
