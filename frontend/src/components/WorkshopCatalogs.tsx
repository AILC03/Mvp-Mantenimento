import { useState, type FormEvent } from "react";
import {
  saveEmployee,
  saveProvider,
  saveVehiclePart,
  type Catalogs,
} from "../catalogs";
import { track } from "../operations-client";
import type { CommitCatalogs } from "./CatalogManager";
import { Modal } from "./Modal";

export function WorkshopCatalogs({
  section,
  data,
  onCommit,
  canEdit,
}: {
  section: "employees" | "providers" | "parts";
  data: Catalogs;
  onCommit: CommitCatalogs;
  canEdit: boolean;
}) {
  const [editor, setEditor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const list =
    section === "employees"
      ? data.employees
      : section === "providers"
        ? data.providers
        : data.vehicleParts;
  const selected = list.find((item) => item.id === editor);
  const title =
    section === "employees"
      ? "Empleado"
      : section === "providers"
        ? "Proveedor"
        : "Pieza";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const text = (key: string) => String(fields.get(key) ?? "");
    const id = selected?.id;
    setSaving(true);
    try {
      const failure = await onCommit((current) => {
        if (section === "employees") {
          const input = {
            name: text("name"),
            position: text("position"),
            phone: text("phone"),
            active: fields.get("active") === "on",
          };
          const employees = saveEmployee(current, input, id);
          return track(
            { ...current, employees },
            {
              type: "employee.save",
              input,
              id,
              clientId: id ?? employees.at(-1)!.id,
            },
          );
        }
        if (section === "providers") {
          const input = {
            name: text("name"),
            contact: text("contact"),
            phone: text("phone"),
            kind: text("providerKind") as "service" | "material" | "both",
          };
          const providers = saveProvider(current, input, id);
          return track(
            { ...current, providers },
            {
              type: "provider.save",
              input,
              id,
              clientId: id ?? providers.at(-1)!.id,
            },
          );
        }
        const input = {
          name: text("name"),
          partNumber: text("partNumber"),
          note: text("note"),
          compatibleVehicleIds: fields.getAll("vehicles").map(String),
        };
        const vehicleParts = saveVehiclePart(current, input, id);
        return track(
          { ...current, vehicleParts },
          {
            type: "part.save",
            input,
            id,
            clientId: id ?? vehicleParts.at(-1)!.id,
          },
        );
      }, `${title} guardado.`);
      setError(failure ?? "");
      if (!failure) setEditor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="card">
      {canEdit && (
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setEditor("");
          }}
        >
          Agregar {title.toLowerCase()}
        </button>
      )}
      {!list.length && <p>No hay registros en este catálogo.</p>}
      {list.map((item) => (
        <article className="catalog-row" key={item.id}>
          <h3>{item.name}</h3>
          {"position" in item && (
            <p>
              {item.position} · {item.phone}
            </p>
          )}
          {"position" in item && item.active === false && (
            <p>Empleado dado de baja (historial conservado).</p>
          )}
          {"contact" in item && (
            <p>
              {item.contact} · {item.phone}
            </p>
          )}
          {"partNumber" in item && (
            <p>
              N.º de parte: {item.partNumber} ·{" "}
              {item.compatibleVehicleIds
                .map(
                  (id) => data.vehicles.find((v) => v.id === id)?.fleetNumber,
                )
                .join(", ")}
            </p>
          )}
          {canEdit && (
            <button
              className="button secondary"
              onClick={() => {
                setError("");
                setEditor(item.id);
              }}
            >
              Editar {item.name}
            </button>
          )}
        </article>
      ))}
      {editor !== null && (
        <Modal
          title={`${selected ? "Editar" : "Agregar"} ${title.toLowerCase()}`}
          onClose={() => {
            if (!saving) setEditor(null);
          }}
        >
          <form onSubmit={(event) => void submit(event)}>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <label className="field">
              Nombre
              <input
                name="name"
                required
                maxLength={150}
                defaultValue={selected?.name ?? ""}
              />
            </label>
            {section === "employees" && (
              <label className="field">
                Puesto o especialidad
                <input
                  name="position"
                  required
                  maxLength={150}
                  defaultValue={
                    selected && "position" in selected ? selected.position : ""
                  }
                />
              </label>
            )}
            {section === "employees" && (
              <label className="field">
                <span>
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={
                      !selected ||
                      !("active" in selected) ||
                      selected.active !== false
                    }
                  />{" "}
                  Empleado activo (desmarcar para dar de baja sin borrar
                  historial)
                </span>
              </label>
            )}
            {section === "providers" && (
              <label className="field">
                Contacto
                <input
                  name="contact"
                  maxLength={150}
                  defaultValue={
                    selected && "contact" in selected ? selected.contact : ""
                  }
                />
              </label>
            )}
            {section === "providers" && (
              <label className="field">
                Tipo de proveedor
                <select
                  name="providerKind"
                  defaultValue={
                    selected && "kind" in selected ? selected.kind : "both"
                  }
                >
                  <option value="both">Servicios y materiales</option>
                  <option value="service">Servicios</option>
                  <option value="material">Materiales</option>
                </select>
              </label>
            )}
            {section !== "parts" && (
              <label className="field">
                Teléfono
                <input
                  name="phone"
                  maxLength={50}
                  defaultValue={
                    selected && "phone" in selected ? selected.phone : ""
                  }
                />
              </label>
            )}
            {section === "parts" && (
              <>
                <label className="field">
                  Número de parte
                  <input
                    name="partNumber"
                    required
                    maxLength={60}
                    defaultValue={
                      selected && "partNumber" in selected
                        ? selected.partNumber
                        : ""
                    }
                  />
                </label>
                <label className="field">
                  Notas
                  <textarea
                    name="note"
                    maxLength={1000}
                    defaultValue={
                      selected && "note" in selected ? selected.note : ""
                    }
                  />
                </label>
                <fieldset>
                  <legend>Unidades compatibles (al menos una)</legend>
                  {data.vehicles.map((v) => (
                    <label className="field" key={v.id}>
                      <span>
                        <input
                          type="checkbox"
                          name="vehicles"
                          value={v.id}
                          defaultChecked={Boolean(
                            selected &&
                            "compatibleVehicleIds" in selected &&
                            selected.compatibleVehicleIds.includes(v.id),
                          )}
                        />{" "}
                        {v.fleetNumber} · {v.model}
                      </span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            <p>
              Los cambios no modifican los datos capturados en órdenes
              anteriores.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
