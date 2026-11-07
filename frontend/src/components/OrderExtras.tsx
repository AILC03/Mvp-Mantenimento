import { useState } from "react";
import type { Catalogs } from "../catalogs";
import type { OrderForm } from "../data";

export function OrderExtras({
  form,
  catalogs,
  onChange,
  onQuickAdd,
}: {
  form: OrderForm;
  catalogs: Catalogs;
  onChange: (next: OrderForm) => void;
  onQuickAdd: (section: "employees" | "providers") => void;
}) {
  const [kind, setKind] = useState<"taller" | "externo">(
    form.responsible?.kind ?? "taller",
  );
  const people =
    kind === "taller"
      ? catalogs.employees.filter((e) => e.active !== false)
      : catalogs.providers.filter((p) => p.kind !== "material");
  const parts = form.partMaterials ?? [];
  return (
    <section className="card">
      <h2>Responsable de la orden</h2>
      <fieldset>
        <legend>Origen del responsable</legend>
        {(["taller", "externo"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="responsibleKind"
              checked={kind === value}
              onChange={() => {
                setKind(value);
                onChange({ ...form, responsible: null });
              }}
            />{" "}
            {value === "taller" ? "Taller" : "Externo"}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Responsable del trabajo
        <select
          value={form.responsible?.refId ?? ""}
          onChange={(e) => {
            const person = people.find((p) => p.id === e.target.value);
            onChange({
              ...form,
              responsible: person
                ? { kind, refId: person.id, name: person.name }
                : null,
            });
          }}
        >
          <option value="">Por asignar</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          onQuickAdd(kind === "taller" ? "employees" : "providers")
        }
      >
        Alta rápida de {kind === "taller" ? "empleado" : "proveedor"}
      </button>
      <h2>Piezas por número de parte</h2>
      <p>
        Se solicitan sin descontar almacén. No representan existencias ni costos
        confirmados.
      </p>
      <label className="field">
        Agregar pieza compatible
        <select
          value=""
          onChange={(e) => {
            const part = catalogs.vehicleParts.find(
              (p) => p.id === e.target.value,
            );
            if (part)
              onChange({
                ...form,
                partMaterials: [
                  ...parts,
                  {
                    id: crypto.randomUUID(),
                    partId: part.id,
                    partNumber: part.partNumber,
                    name: part.name,
                    quantity: 1,
                  },
                ],
              });
          }}
        >
          <option value="">Selecciona una pieza</option>
          {catalogs.vehicleParts
            .filter(
              (p) =>
                p.compatibleVehicleIds.includes(form.busId) &&
                !parts.some((row) => row.partId === p.id),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.partNumber} · {p.name}
              </option>
            ))}
        </select>
      </label>
      {parts.map((part) => (
        <div key={part.id}>
          <label className="field">
            {part.partNumber} · {part.name}
            <input
              type="number"
              min="1"
              step="1"
              aria-label={`Cantidad de pieza ${part.partNumber}`}
              value={Number.isFinite(part.quantity) ? part.quantity : ""}
              onChange={(e) =>
                onChange({
                  ...form,
                  partMaterials: parts.map((p) =>
                    p.id === part.id
                      ? {
                          ...p,
                          quantity:
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                        }
                      : p,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              onChange({
                ...form,
                partMaterials: parts.filter((p) => p.id !== part.id),
              })
            }
          >
            Quitar {part.partNumber}
          </button>
        </div>
      ))}
    </section>
  );
}
