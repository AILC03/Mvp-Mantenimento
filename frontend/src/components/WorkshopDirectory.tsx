import { useState } from "react";
import { createPortal } from "react-dom";
import type { AuthUser } from "../auth";
import type { Workbench } from "../requests";
import {
  changeWorkshop,
  workshop,
  type Supplier,
  type Employee,
  type WorkshopChange,
} from "../../../shared/src/workshop";
import { track } from "../operations-client";
import type { CommitWorkbench } from "./OrdersView";
import { Modal } from "./Modal";

export function saveWorkshop(
  data: Workbench,
  user: AuthUser,
  change: WorkshopChange,
  vehicleIds: string[],
) {
  return track(changeWorkshop(data, user, change, vehicleIds), {
    type: "workshop.save",
    change,
  });
}
export function DirectoryForm({
  kind,
  value,
  user,
  onCommit,
  onDone,
  servicesOnly = false,
}: {
  kind: "supplier" | "employee";
  value?: Supplier | Employee;
  user: AuthUser;
  onCommit: CommitWorkbench;
  onDone: (id: string) => void;
  servicesOnly?: boolean;
}) {
  const [error, setError] = useState("");
  const [supplierKind, setSupplierKind] = useState(
    (value as Supplier)?.kind ?? "service",
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const f = new FormData(e.currentTarget);
        const text = (key: string) => String(f.get(key) ?? "").trim();
        const id = value?.id ?? crypto.randomUUID();
        const common = {
          id,
          name: text("name"),
          phone: text("phone"),
          active: f.get("active") === "on",
        };
        const change: WorkshopChange =
          kind === "employee"
            ? {
                entity: "employee",
                value: { ...common, position: text("position") },
              }
            : {
                entity: "supplier",
                value: {
                  ...common,
                  kind: supplierKind,
                  service: text("service"),
                  location: text("location"),
                  officePhone: text("officePhone"),
                  email: text("email"),
                  notes: text("notes"),
                },
              };
        const failure = await onCommit(
          (data) => saveWorkshop(data, user, change, []),
          "Directorio actualizado.",
        );
        setError(failure ?? "");
        if (!failure) onDone(id);
      }}
    >
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="field-grid">
        <label className="field full">
          Nombre *
          <input
            name="name"
            required
            maxLength={150}
            defaultValue={value?.name}
          />
        </label>
        {kind === "employee" ? (
          <label className="field">
            Puesto *
            <input
              name="position"
              required
              maxLength={150}
              defaultValue={(value as Employee)?.position}
            />
          </label>
        ) : (
          <>
            <fieldset className="field full">
              <legend>Tipo de proveedor</legend>
              {(["service", "materials"] as const).map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="supplierKind"
                    disabled={servicesOnly && k === "materials"}
                    checked={supplierKind === k}
                    onChange={() => setSupplierKind(k)}
                  />
                  {k === "service" ? "Servicios" : "Materiales"}
                </label>
              ))}
            </fieldset>
            {supplierKind === "service" && (
              <label className="field full">
                Servicio que proporciona *
                <input
                  name="service"
                  required
                  maxLength={150}
                  defaultValue={(value as Supplier)?.service}
                />
              </label>
            )}
            <label className="field full">
              Ubicación (opcional)
              <input
                name="location"
                maxLength={150}
                defaultValue={(value as Supplier)?.location}
              />
            </label>
            <label className="field">
              Teléfono de oficina (opcional)
              <input
                name="officePhone"
                type="tel"
                maxLength={150}
                defaultValue={(value as Supplier)?.officePhone}
              />
            </label>
            <label className="field">
              Correo (opcional)
              <input
                name="email"
                type="email"
                maxLength={150}
                defaultValue={(value as Supplier)?.email}
              />
            </label>
            <label className="field full">
              Comentarios adicionales
              <textarea
                name="notes"
                maxLength={4000}
                defaultValue={(value as Supplier)?.notes}
              />
            </label>
          </>
        )}
        <label className="field">
          Teléfono {kind === "supplier" ? "*" : "(opcional)"}
          <input
            name="phone"
            type="tel"
            required={kind === "supplier"}
            maxLength={150}
            defaultValue={value?.phone}
          />
        </label>
        <label>
          <input
            name="active"
            type="checkbox"
            defaultChecked={value?.active ?? true}
          />{" "}
          Activo
        </label>
      </div>
      <div className="modal-actions">
        <button className="button primary">
          Guardar {kind === "supplier" ? "proveedor" : "empleado"}
        </button>
      </div>
    </form>
  );
}
export function WorkshopDirectory({
  kind,
  user,
  data,
  onCommit,
}: {
  kind: "supplier" | "employee";
  user: AuthUser;
  data: Workbench;
  onCommit: CommitWorkbench;
}) {
  const [editing, setEditing] = useState<
    Supplier | Employee | null | undefined
  >();
  const rows =
    kind === "supplier" ? workshop(data).suppliers : workshop(data).employees;
  return (
    <section className="card">
      <div className="section-heading">
        <h2>{kind === "supplier" ? "Proveedores" : "Personal del taller"}</h2>
        <button className="button primary" onClick={() => setEditing(null)}>
          Agregar {kind === "supplier" ? "proveedor" : "empleado"}
        </button>
      </div>
      <p>
        Directorio sin cuentas de acceso. Desactiva registros utilizados para
        conservar el historial.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Servicio / puesto</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>
                  {"position" in v
                    ? v.position
                    : v.kind === "service"
                      ? v.service
                      : "Materiales"}
                </td>
                <td>{v.phone}</td>
                <td>{v.active ? "Activo" : "Inactivo"}</td>
                <td>
                  <button className="text-button" onClick={() => setEditing(v)}>
                    Editar / desactivar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>Sin registros.</p>}
      </div>
      {editing !== undefined && (
        <Modal
          title={kind === "supplier" ? "Proveedor" : "Empleado del taller"}
          onClose={() => setEditing(undefined)}
        >
          <DirectoryForm
            kind={kind}
            value={editing ?? undefined}
            user={user}
            onCommit={onCommit}
            onDone={() => setEditing(undefined)}
          />
        </Modal>
      )}
    </section>
  );
}
export function ResponsiblePicker({
  value,
  onChange,
  user,
  data,
  onCommit,
}: {
  value?: { kind: "employee" | "supplier"; id: string; name: string };
  onChange: (v: {
    kind: "employee" | "supplier";
    id: string;
    name: string;
  }) => void;
  user: AuthUser;
  data: Workbench;
  onCommit: CommitWorkbench;
}) {
  const [kind, setKind] = useState<"employee" | "supplier">(
    value?.kind ?? "employee",
  );
  const [adding, setAdding] = useState(false);
  const rows =
    kind === "employee"
      ? workshop(data).employees
      : workshop(data).suppliers.filter((v) => v.kind === "service");
  return (
    <div className="field full">
      <fieldset>
        <legend>Responsable de toda la orden *</legend>
        {(["employee", "supplier"] as const).map((k) => (
          <label key={k}>
            <input
              type="radio"
              name="responsibleKind"
              checked={kind === k}
              onChange={() => {
                setKind(k);
                onChange({ kind: k, id: "", name: "" });
              }}
            />
            {k === "employee"
              ? "Personal del taller"
              : "Proveedor de servicios"}
          </label>
        ))}
      </fieldset>
      <select
        aria-label="Responsable de la orden"
        value={value?.kind === kind ? value.id : ""}
        onChange={(e) => {
          const p = rows.find((v) => v.id === e.target.value);
          onChange({ kind, id: p?.id ?? "", name: p?.name ?? "" });
        }}
      >
        <option value="">Selecciona responsable</option>
        {rows
          .filter((v) => v.active)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {"position" in v ? ` · ${v.position}` : ""}
            </option>
          ))}
      </select>
      <button
        type="button"
        className="text-button"
        onClick={() => setAdding(true)}
      >
        Agregar nuevo responsable
      </button>
      {adding &&
        createPortal(
          <Modal
            title={
              kind === "employee"
                ? "Nuevo empleado del taller"
                : "Nuevo proveedor de servicios"
            }
            onClose={() => setAdding(false)}
          >
            <DirectoryForm
              kind={kind}
              servicesOnly
              user={user}
              onCommit={onCommit}
              onDone={(id) => {
                setAdding(false);
                onChange({ kind, id, name: "" });
              }}
            />
          </Modal>,
          document.body,
        )}
    </div>
  );
}
