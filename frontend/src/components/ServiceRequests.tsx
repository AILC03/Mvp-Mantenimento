import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BusFront,
  ClipboardList,
  Clock3,
  FileText,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { type SavedOrder, type Vehicle } from "../data";
import { reviewFrequency, type ReviewType } from "../catalogs";
import {
  emptyRequest,
  validateRequest,
  type DemoRole,
  type RequestInput,
  type ServiceRequest,
} from "../requests";
import { Modal } from "./Modal";

const labels = {
  pending: "Pendiente de revisión",
  rejected: "Rechazada",
  converted: "Orden creada",
};
const dateLabel = (date: string) =>
  new Date(date).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });

type Props = {
  showPeriodicReviews?: boolean;
  driver: { id: string; name: string };
  vehicles: Vehicle[];
  reviews: ReviewType[];
  role: DemoRole;
  requests: ServiceRequest[];
  orders: SavedOrder[];
  onSend: (input: RequestInput) => boolean | Promise<boolean>;
  onConvert: (request: ServiceRequest) => void;
  onReject: (
    id: string,
    reason: string,
  ) => string | null | Promise<string | null>;
  onNewOrder: () => void;
};

export function ServiceRequests({
  showPeriodicReviews = true,
  driver,
  vehicles: buses,
  reviews,
  role,
  requests,
  orders,
  onSend,
  onConvert,
  onReject,
  onNewOrder,
}: Props) {
  const [input, setInput] = useState<RequestInput>(emptyRequest);
  const [errors, setErrors] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | ServiceRequest["status"]>(
    "pending",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const selected = requests.find((request) => request.id === selectedId);
  const visible = requests.filter(
    (request) =>
      (role !== "driver" || request.driverId === driver.id) &&
      (filter === "all" || request.status === filter),
  );
  const ownRequests = requests.filter(
    (request) => role !== "driver" || request.driverId === driver.id,
  );

  async function send(event: FormEvent) {
    event.preventDefault();
    const validation = validateRequest(input, buses);
    setErrors(validation);
    if (!validation.length && (await onSend(input))) {
      setInput(emptyRequest());
      setFilter("pending");
    }
  }

  function review(request: ServiceRequest) {
    setSelectedId(request.id);
    setReason("");
    setReviewError("");
  }

  return (
    <div
      className={`requests-layout ${role === "driver" ? "requests-layout--driver" : ""}`}
    >
      {role === "driver" && (
        <section className="card request-composer">
          <div className="section-heading">
            <span className="step-number">
              <MessageSquare size={17} />
            </span>
            <div>
              <h2>Reportar una solicitud de servicio</h2>
              <p>Cuéntale al mecánico qué necesita atención en tu unidad.</p>
            </div>
          </div>
          <div className="request-author">
            <span className="avatar">
              {driver.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </span>
            <div>
              <strong>{driver.name}</strong>
              <small>Chofer · Sesión autenticada</small>
            </div>
            <ShieldCheck size={18} />
          </div>
          <form onSubmit={send} noValidate>
            {errors.length > 0 && (
              <div className="notice error" role="alert">
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="field-grid">
              <label className="field full">
                Unidad del reporte <span className="required">*</span>
                <select
                  required
                  value={input.busId}
                  onChange={(event) =>
                    setInput({ ...input, busId: event.target.value })
                  }
                >
                  <option value="">Selecciona la unidad</option>
                  {buses.map((bus) => (
                    <option value={bus.id} key={bus.id}>
                      {bus.fleetNumber} ·{" "}
                      {bus.type === "truck" ? "Camión" : "Autobús"} ·{" "}
                      {bus.model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full">
                Asunto <span className="required">*</span>
                <input
                  required
                  maxLength={120}
                  placeholder="Ej. Ruido al frenar en la unidad"
                  value={input.title}
                  onChange={(event) =>
                    setInput({ ...input, title: event.target.value })
                  }
                />
              </label>
              <label className="field full">
                ¿Qué ocurrió? <span className="required">*</span>
                <textarea
                  required
                  maxLength={2000}
                  rows={5}
                  placeholder="Describe lo que notaste, cuándo sucede y dónde se presenta. No necesitas hacer un diagnóstico."
                  value={input.description}
                  onChange={(event) =>
                    setInput({ ...input, description: event.target.value })
                  }
                />
                <small>
                  Esta solicitud es independiente del checklist de viaje.
                </small>
              </label>
              <label className="field full">
                Kilometraje observado{" "}
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Opcional"
                  value={input.odometer}
                  onChange={(event) =>
                    setInput({ ...input, odometer: event.target.value })
                  }
                />
                <small>Si no conoces la lectura actual, déjala vacía.</small>
              </label>
            </div>
            <div className="request-submit">
              <p>Se enviará a la bandeja del mecánico principal.</p>
              <button type="submit" className="button primary">
                <Send size={15} /> Enviar solicitud
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card request-inbox">
        <div className="section-heading">
          <span className="inbox-section-icon" aria-hidden="true">
            <MessageSquare size={22} />
          </span>
          <div>
            <h2>
              {role === "driver" ? "Mis solicitudes" : "Bandeja de solicitudes"}{" "}
              <span className="count-pill">{ownRequests.length}</span>
            </h2>
            <p>
              {role === "driver"
                ? "Consulta el resultado de tus reportes."
                : "Revisa cada reporte antes de crear una orden o rechazarlo."}
            </p>
          </div>
          {role === "mechanic" && (
            <button
              type="button"
              className="button primary"
              onClick={onNewOrder}
            >
              <Plus size={15} /> Nueva orden
            </button>
          )}
        </div>
        <div
          className="request-filters"
          role="group"
          aria-label="Filtrar solicitudes"
        >
          {(
            [
              ["pending", "Pendientes"],
              ["converted", "Con orden"],
              ["rejected", "Rechazadas"],
              ["all", "Todas"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? "selected" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>
                {
                  ownRequests.filter(
                    (request) => value === "all" || request.status === value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="request-empty-symbol" aria-hidden="true">
              <MessageSquare size={32} />
            </span>
            <h3>
              {filter === "pending"
                ? "Sin solicitudes pendientes"
                : "Sin solicitudes en este estado"}
            </h3>
            <p>
              {role === "mechanic"
                ? "Los reportes del chofer aparecerán aquí para revisión."
                : "Puedes enviar un reporte usando el formulario."}
            </p>
          </div>
        ) : (
          <div className="request-list">
            {visible.map((request) => (
              <article className="request-item" key={request.id}>
                <div className="request-item-top">
                  <span
                    className={`badge ${request.status === "pending" ? "amber" : request.status === "rejected" ? "red" : "green"}`}
                  >
                    {labels[request.status]}
                  </span>
                  <small>{request.number}</small>
                </div>
                <h3>{request.title}</h3>
                <div className="request-meta">
                  <span>
                    <BusFront size={13} />
                    {buses.find((bus) => bus.id === request.busId)
                      ?.fleetNumber ?? request.busId}
                  </span>
                  <span>{request.driverName}</span>
                  <span>
                    <Clock3 size={12} />
                    {dateLabel(request.createdAt)}
                  </span>
                </div>
                <p className="request-description">{request.description}</p>
                {request.status === "rejected" && (
                  <div className="rejection-note">
                    <strong>Motivo del rechazo</strong>
                    <p>{request.rejectionReason}</p>
                  </div>
                )}
                {request.status === "converted" && (
                  <div className="converted-note">
                    <ClipboardList size={15} />
                    <span>
                      Orden vinculada:{" "}
                      <strong>
                        {orders.find((order) => order.id === request.orderId)
                          ?.number ??
                          request.orderNumber ??
                          "Orden registrada"}
                      </strong>
                    </span>
                  </div>
                )}
                <div className="request-item-bottom">
                  <span>
                    {request.odometer
                      ? `${Number(request.odometer).toLocaleString("es-MX")} km reportados`
                      : "Sin kilometraje reportado"}
                  </span>
                  {role === "mechanic" && request.status === "pending" && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => review(request)}
                    >
                      Revisar solicitud <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {role === "mechanic" && showPeriodicReviews && (
        <section className="card review-roadmap">
          <div className="section-heading">
            <span className="step-number">
              <ClipboardList size={17} />
            </span>
            <div>
              <h2>Revisiones periódicas</h2>
              <p>
                Separadas de CAF. Admin configura los aspectos; el mecánico las
                realiza en «Revisiones».
              </p>
            </div>
            <span className="badge neutral">Disponibles en Revisiones</span>
          </div>
          <div className="review-schedule">
            {reviews.map((review) => (
              <div key={review.name}>
                <strong>{review.name}</strong>
                <span>
                  <Clock3 size={13} />
                  {reviewFrequency(review)}
                </span>
              </div>
            ))}
          </div>
          <p className="section-footnote">
            Consulta los contadores por unidad en Revisiones o en su historial.
            No hay asignaciones ni bloqueo por vencimiento.
          </p>
        </section>
      )}
      <div className="safety-note request-safety">
        <ShieldCheck size={20} />
        <div>
          <strong>
            Un reporte no autoriza ni restringe por sí solo la circulación.
          </strong>
          <p>
            Ante una falla que pueda afectar la seguridad, utiliza también el
            protocolo de comunicación de la empresa. Este prototipo no envía
            notificaciones reales.
          </p>
        </div>
      </div>

      {selected && role === "mechanic" && (
        <Modal
          title="Revisar solicitud de servicio"
          onClose={() => setSelectedId(null)}
        >
          <div className="request-review-source">
            <span className="badge amber">{labels[selected.status]}</span>
            <small>
              {selected.number} ·{" "}
              {buses.find((bus) => bus.id === selected.busId)?.fleetNumber ??
                selected.busId}
            </small>
            <h3>{selected.title}</h3>
            <p>{selected.description}</p>
            <div className="request-meta">
              <span>{selected.driverName}</span>
              <span>{dateLabel(selected.createdAt)}</span>
            </div>
          </div>
          {selected.status === "pending" && (
            <>
              <div className="review-convert">
                <span className="service-icon">
                  <FileText size={21} />
                </span>
                <div>
                  <strong>Convertir el reporte en una orden</strong>
                  <p>
                    Revisa los datos, agrega servicios y materiales. La
                    solicitud seguirá pendiente hasta crear la orden.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    onConvert(selected);
                    setSelectedId(null);
                  }}
                >
                  Preparar orden <ArrowRight size={15} />
                </button>
              </div>
              <div className="review-reject">
                <h3>¿No corresponde atenderla?</h3>
                <label className="field">
                  Motivo del rechazo
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explica al chofer por qué se rechaza esta solicitud."
                  />
                </label>
                {reviewError && (
                  <p className="review-error" role="alert">
                    {reviewError}
                  </p>
                )}
                <button
                  className="button danger"
                  onClick={async () => {
                    const error = await onReject(selected.id, reason);
                    if (error) setReviewError(error);
                    else setSelectedId(null);
                  }}
                >
                  <X size={15} /> Rechazar solicitud
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
