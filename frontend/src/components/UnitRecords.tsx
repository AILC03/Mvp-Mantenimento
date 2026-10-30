import { useState } from "react";
import type { AuthUser } from "../auth";
import { vehicleTypeLabel, type Vehicle } from "../data";
import type { Workbench } from "../requests";
import { dateToday, managesOrders } from "../orders";
import {
  addExternalService,
  decideCirculation,
  latestCirculation,
  circulationLabels,
  type CirculationStatus,
  type ExternalServiceInput,
} from "../unit-records";
import type { CommitWorkbench } from "./OrdersView";
import { Modal } from "./Modal";

export function UnitRecords({
  vehicle,
  user,
  data,
  onCommit,
}: {
  vehicle: Vehicle;
  user: AuthUser;
  data: Workbench;
  onCommit: CommitWorkbench;
}) {
  const [dialog, setDialog] = useState<"external" | "circulation" | null>(null);
  const [status, setStatus] = useState<CirculationStatus>("unevaluated");
  const [error, setError] = useState("");
  const latest = latestCirculation(data, vehicle.id);
  async function commit(
    change: (data: Workbench) => Workbench,
    message: string,
  ) {
    try {
      const failure = await onCommit(change, message);
      setError(failure ?? "");
      if (!failure) setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }
  if (!managesOrders(user)) return null;
  return (
    <section
      className="unit-records"
      aria-label="Servicios externos y circulación"
    >
      <h3>Circulación: {circulationLabels[latest?.status ?? "unevaluated"]}</h3>
      {latest && (
        <p>
          {latest.actorName} ·{" "}
          {new Date(latest.recordedAt).toLocaleString("es-MX")}
        </p>
      )}
      <p>
        Solo cambia al guardar una decisión explícita. Terminar trabajos no
        autoriza circulación.
      </p>
      <div className="order-actions">
        <button
          className="button secondary"
          onClick={() => {
            setStatus(latest?.status ?? "unevaluated");
            setError("");
            setDialog("circulation");
          }}
        >
          Decidir circulación
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setDialog("external");
          }}
        >
          Registrar servicio externo/carretera
        </button>
      </div>
      {dialog === "circulation" && (
        <Modal
          title={`Circulación · ${vehicle.fleetNumber}`}
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void commit(
                (current) =>
                  decideCirculation(current, user, vehicle.id, status),
                "Decisión de circulación guardada.",
              );
            }}
          >
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <label className="field">
              Decisión de circulación
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CirculationStatus)}
              >
                {Object.entries(circulationLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Guardar agrega una decisión al historial. Cancelar no cambia el
              estado.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button className="button primary">Guardar decisión</button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "external" && (
        <Modal
          title={`Servicio externo/carretera · ${vehicle.fleetNumber}`}
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget);
              const input: ExternalServiceInput = {
                kind: String(
                  fields.get("kind"),
                ) as ExternalServiceInput["kind"],
                date: String(fields.get("date")),
                description: String(fields.get("description")),
                provider: String(fields.get("provider")),
                materialsCost: Number(fields.get("materialsCost")),
                laborCost: Number(fields.get("laborCost")),
                notes: String(fields.get("notes")),
              };
              void commit(
                (current) =>
                  addExternalService(current, user, vehicle.id, input),
                "Servicio externo registrado sin movimientos de inventario.",
              );
            }}
          >
            <p>
              No requiere orden ni checklist. No descuenta almacén, resuelve
              incidencias ni cambia circulación. Moneda: MXN.
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
                  <option value="external">Externo</option>
                  <option value="roadside">Carretera</option>
                </select>
              </label>
              <label className="field">
                Fecha del servicio
                <input
                  name="date"
                  type="date"
                  required
                  max={dateToday()}
                  defaultValue={dateToday()}
                />
              </label>
              <label className="field full">
                Servicio realizado
                <textarea name="description" required maxLength={4000} />
              </label>
              <label className="field full">
                Prestador (empresa/persona)
                <input name="provider" required maxLength={150} />
              </label>
              <label className="field">
                Costo de materiales (MXN)
                <input
                  name="materialsCost"
                  type="number"
                  required
                  min="0"
                  max="1000000000"
                  step="0.01"
                  defaultValue="0"
                />
              </label>
              <label className="field">
                Costo de mano de obra (MXN)
                <input
                  name="laborCost"
                  type="number"
                  required
                  min="0"
                  max="1000000000"
                  step="0.01"
                  defaultValue="0"
                />
              </label>
              <label className="field full">
                Notas opcionales
                <textarea name="notes" maxLength={4000} />
              </label>
            </div>
            <p>
              El total se calcula como materiales + mano de obra al consultar el
              registro.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button className="button primary">
                Guardar servicio externo
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function CirculationSummary({
  vehicles,
  data,
}: {
  vehicles: Vehicle[];
  data: Workbench;
}) {
  const [photo, setPhoto] = useState(false);
  const groups = (["unauthorized", "unevaluated"] as const).map((status) => {
    const buses = vehicles.filter(
      (v) =>
        (latestCirculation(data, v.id)?.status ?? "unevaluated") === status,
    );
    return (
      <section key={status}>
        <h3>{status === "unauthorized" ? "No autorizados" : "Sin evaluar"}</h3>
        {!buses.length && <p>Sin unidades en este grupo.</p>}
        {buses.map((v) => {
          const decision = latestCirculation(data, v.id);
          return (
            <div className="circulation-row" key={v.id}>
              <strong>{v.fleetNumber}</strong>
              <span>
                {[vehicleTypeLabel(v.type), v.brand, v.model, v.plate]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span>
                {circulationLabels[status]}
                {decision
                  ? ` · ${new Date(decision.recordedAt).toLocaleString("es-MX")}`
                  : ""}
              </span>
            </div>
          );
        })}
      </section>
    );
  });
  return (
    <section
      className="card circulation-summary"
      aria-label="Resumen administrativo de circulación"
    >
      <h2>Circulación de unidades</h2>
      <p>
        Para consulta y captura de pantalla manual. Sin mensajes automáticos.
      </p>
      <button className="button secondary" onClick={() => setPhoto(true)}>
        Resumen del estado de circulación de las unidades
      </button>
      {photo && (
        <Modal
          title="Circulación de unidades · Resumen para foto"
          onClose={() => setPhoto(false)}
        >
          <div className="circulation-photo">
            <p>
              Real Ejecutivo · Datos cargados del servidor. Compartir
              manualmente; recargar para consultar cambios ajenos.
            </p>
            {groups}
          </div>
        </Modal>
      )}
    </section>
  );
}
