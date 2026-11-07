import { useState, type FormEvent } from "react";
import type { AuthUser } from "../auth";
import { vehicleTypeLabel, type Vehicle } from "../data";
import { addDamage } from "../fleet";
import { dateToday } from "../orders";
import type { Workbench } from "../requests";
import type { CommitWorkbench } from "./OrdersView";
import { UnitRecords } from "./UnitRecords";

export function DriverReports({
  mode,
  vehicles,
  user,
  data,
  onCommit,
}: {
  mode: "damage" | "external";
  vehicles: Vehicle[];
  user: AuthUser;
  data: Workbench;
  onCommit: CommitWorkbench;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (!vehicle) {
      setError("Selecciona una unidad.");
      return;
    }
    const input = {
      kind:
        fields.get("kind") === "Golpe"
          ? ("Golpe" as const)
          : ("Falla" as const),
      area: String(fields.get("area") ?? ""),
      description: String(fields.get("description") ?? ""),
      date: String(fields.get("date") ?? ""),
      responsible: String(fields.get("responsible") ?? ""),
    };
    setSaving(true);
    try {
      const failure = await onCommit(
        (current) => addDamage(current, user, vehicle.id, input),
        "Falla o golpe registrado directamente en la unidad. No requiere confirmación del mecánico.",
      );
      setError(failure ?? "");
      if (!failure) form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="card">
      <label className="field">
        Unidad (Autobús o Sprinter)
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
        >
          <option value="">Selecciona una unidad</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.fleetNumber} · {vehicleTypeLabel(v.type)}
            </option>
          ))}
        </select>
      </label>
      {mode === "external" ? (
        vehicle && (
          <UnitRecords
            key={vehicle.id}
            vehicle={vehicle}
            user={user}
            data={data}
            onCommit={onCommit}
          />
        )
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <p>
            El reporte queda registrado en la unidad, sin aprobación previa. El
            mecánico podrá atenderlo después.
          </p>
          <p>
            Fotos: integración pendiente para el software real; este MVP no
            adjunta imágenes.
          </p>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="field-grid">
            <label className="field">
              Tipo
              <select name="kind">
                <option>Falla</option>
                <option>Golpe</option>
              </select>
            </label>
            <label className="field">
              Fecha
              <input
                name="date"
                type="date"
                required
                max={dateToday()}
                defaultValue={dateToday()}
              />
            </label>
            <label className="field">
              Parte afectada
              <input name="area" required maxLength={150} />
            </label>
            <label className="field">
              Responsable del golpe o falla (si se conoce)
              <input name="responsible" maxLength={150} />
            </label>
            <label className="field full">
              Descripción
              <textarea name="description" required maxLength={4000} />
            </label>
          </div>
          <button className="button primary" disabled={!vehicle || saving}>
            {saving ? "Guardando…" : "Guardar reporte en la unidad"}
          </button>
        </form>
      )}
    </section>
  );
}
