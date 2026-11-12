import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { IncidentSummary } from "../../../shared/src/unit-records";
import { Modal } from "./Modal";

export function TripIncidents({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [incidents, setIncidents] = useState<IncidentSummary[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setIncidents(null);
    setError("");
    void fetch(
      `/api/operations/trips/${encodeURIComponent(tripId)}/incidents`,
      { credentials: "include", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "No se pudieron consultar las incidencias. Intenta nuevamente.",
          );
        const result = (await response.json()) as {
          incidents: IncidentSummary[];
        };
        if (!Array.isArray(result.incidents))
          throw new Error("Respuesta incompatible.");
        if (!controller.signal.aborted) setIncidents(result.incidents);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo consultar.");
      });
    return () => controller.abort();
  }, [open, tripId]);
  const visible = incidents?.filter((item) => item.resolved === resolved);
  return (
    <section
      className="unit-records"
      aria-label="Consulta de incidencias de la unidad"
    >
      <button
        type="button"
        className="button secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setResolved(false);
          setOpen(true);
        }}
      >
        Estado de la unidad
      </button>
      {open &&
        createPortal(
          <Modal title="Estado de la unidad" onClose={() => setOpen(false)}>
            <p>
              Consulta de la unidad de este viaje. No modifica tus respuestas ni
              resuelve fallas.
            </p>
            <label>
              <input
                type="checkbox"
                checked={resolved}
                onChange={(e) => setResolved(e.target.checked)}
              />{" "}
              Consultar resueltas
            </label>
            {error && <p role="alert">{error}</p>}
            {!incidents && !error && (
              <p role="status">Consultando incidencias…</p>
            )}
            {visible?.length === 0 && (
              <p>
                Sin incidencias {resolved ? "resueltas" : "activas"} en esta
                unidad.
              </p>
            )}
            {visible?.map((item) => (
              <article className="order-service-detail" key={item.id}>
                <h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setSelected(selected === item.id ? null : item.id)
                    }
                  >
                    {item.title}
                  </button>
                </h3>
                {selected === item.id && (
                  <section aria-label="Detalle del golpe o falla">
                    <p>{item.description || item.title}</p>
                    <p>
                      {item.origin} · {item.date} ·{" "}
                      {item.resolved ? "Resuelta" : "Pendiente"}
                    </p>
                  </section>
                )}
                <small>
                  {item.date} · {item.origin} ·{" "}
                  {item.resolved ? "Resuelta" : "Activa"}
                </small>
              </article>
            ))}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setOpen(false)}
              >
                Cerrar consulta de incidencias
              </button>
            </div>
          </Modal>,
          document.getElementById("main-content") ?? document.body,
        )}
    </section>
  );
}
