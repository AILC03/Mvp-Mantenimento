// Exclusivo para pruebas de los flujos locales. Nunca se importa desde main.tsx/App.tsx.
import { useState } from "react";
import Workbench from "../Workbench";
import type { AuthUser } from "../auth";

export const testUsers: Record<string, AuthUser> = {
  mechanic: {
    id: "mechanic-demo",
    username: "mecanico.prueba.com",
    name: "Mecánico de prueba",
    role: "LEAD_MECHANIC",
  },
  driver: {
    id: "driver-demo",
    username: "chofer01.prueba.com",
    name: "Chofer 01 de prueba",
    role: "DRIVER",
  },
  warehouse: {
    id: "warehouse-demo",
    username: "almacen.prueba.com",
    name: "Almacén de prueba",
    role: "WAREHOUSE_CLERK",
  },
  admin: {
    id: "admin-demo",
    username: "admin.prueba.com",
    name: "Administrador de prueba",
    role: "ADMIN",
  },
};

export default function WorkbenchHarness() {
  const [role, setRole] = useState("mechanic");
  return (
    <>
      <select
        aria-label="Perfil de demostración"
        value={role}
        onChange={(event) => setRole(event.target.value)}
      >
        {Object.keys(testUsers).map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <Workbench key={role} user={testUsers[role]} onLogout={async () => {}} />
    </>
  );
}
