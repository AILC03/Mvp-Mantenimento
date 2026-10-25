import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { AuthUser } from "../auth";
import type { Catalogs } from "../catalogs";
import { currency, materialTotal, type Vehicle } from "../data";
import {
  addDamage,
  correctCaf,
  currentOdometer,
  fleetRecords,
  lastCaf,
  remainingDays,
  resolveIncident,
  vehicleIncidents,
  type IncidentView,
} from "../fleet";
import { actualMaterialCost, dateToday } from "../orders";
import type { Workbench } from "../requests";
import { loadTripCases, tripStatus } from "../trip-reviews";
import type { CommitWorkbench } from "./OrdersView";
import { Modal } from "./Modal";
import { PeriodicReviewForm } from "./PeriodicReviews";
import {
  emptyHistoryFilters,
  filterHistory,
  historyDate,
  type HistoryRow,
} from "../vehicle-history";

export function VehicleHistory({
  vehicle,
  user,
  data,
  catalogs,
  onCommit,
  onBack,
  onOpenOrder,
}: {
  vehicle: Vehicle;
  user: AuthUser;
  data: Workbench;
  catalogs: Catalogs;
  onCommit: CommitWorkbench;
  onBack: () => void;
  onOpenOrder: (id: string) => void;
}) {
  const [tripLoad] = useState(() => {
    try {
      return { cases: loadTripCases(), error: "" };
    } catch (error) {
      return {
        cases: [],
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron leer los checklists.",
      };
    }
  });
  const [dialog, setDialog] = useState<
    "caf" | "damage" | "request" | "resolve" | null
  >(null);
  const [incident, setIncident] = useState<IncidentView | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [historyFilters, setHistoryFilters] = useState(emptyHistoryFilters);
  const fleet = fleetRecords(data);
  const orders = data.orders.filter((order) => order.form.busId === vehicle.id);
  const baseline = lastCaf(vehicle.id, data);
  const odometer = currentOdometer(vehicle, data);
  const remaining = baseline ? 15000 - (odometer - baseline.odometer) : null;
  const incidents = vehicleIncidents(vehicle.id, data, tripLoad.cases);
  const jobs = fleet.reviewJobs.filter((job) => job.busId === vehicle.id);
  const timeline: HistoryRow<ReactNode>[] = [];
  for (const order of orders) {
    timeline.push({
      id: `order:${order.id}`,
      category: "Servicios",
      status:
        order.status === "Pendiente de liberación"
          ? "Lista para iniciar"
          : order.status,
      types: order.form.services.map((service) => service.name),
      actor:
        order.completion?.actorName ?? order.createdBy?.name ?? "No registrado",
      date: order.completion?.date,
      at: order.completion?.recordedAt ?? order.createdAt,
      title: `Orden ${order.number} · ${order.status}`,
      body: (
        <>
          <p>
            {order.form.services.map((service) => service.name).join(" · ")}
          </p>
          <p>
            Estimado:{" "}
            {currency(materialTotal(order.form.services, catalogs.products))}.
            Salidas netas: {currency(actualMaterialCost(order))}.
          </p>
          {order.completion && (
            <p>
              Ejecutado {order.completion.date} · {order.completion.odometer}{" "}
              km. {order.completion.notes}
            </p>
          )}
          {order.completion &&
            order.form.services
              .filter(
                (service) =>
                  !order.completion!.performedServiceIds.includes(service.id),
              )
              .map((service) => (
                <p className="pending-text" key={service.id}>
                  Pendiente: {service.name} ·{" "}
                  {order.completion!.unperformedReasons[service.id]}
                </p>
              ))}
          <button className="text-button" onClick={() => onOpenOrder(order.id)}>
            Ver orden completa
          </button>
        </>
      ),
    });
    for (const confirmation of order.materialConfirmations ?? [])
      timeline.push({
        id: confirmation.id,
        category: "Materiales",
        status: "Confirmada",
        types: ["Entrega y devolución"],
        actor: confirmation.actorName,
        at: confirmation.at,
        title: `Materiales · ${order.number}`,
        body: (
          <>
            {confirmation.lines.map((line) => (
              <p key={line.productId}>
                {line.name}: entregado +{line.delivered}, devuelto +
                {line.returned} {line.unit} · {currency(line.unitCost)} /{" "}
                {line.unit}
              </p>
            ))}
            <small>
              {confirmation.actorName} · {confirmation.notes}
            </small>
          </>
        ),
      });
  }
  for (const request of data.requests.filter(
    (item) => item.busId === vehicle.id,
  ))
    timeline.push({
      id: `request:${request.id}`,
      category: "Solicitudes",
      status:
        request.status === "pending"
          ? "Pendiente"
          : request.status === "rejected"
            ? "Rechazada"
            : "Con orden",
      types: ["Solicitud de servicio"],
      actor: request.driverName,
      at: request.createdAt,
      title: `${request.number} · ${request.status === "pending" ? "Solicitud pendiente" : request.status === "rejected" ? "Solicitud rechazada" : "Solicitud con orden"}`,
      body: (
        <>
          <h4>{request.title}</h4>
          <p>{request.description}</p>
          <small>
            {request.driverName}. Asociación al viaje, no atribución de
            responsabilidad.
          </small>
          {request.status === "rejected" && (
            <p>Motivo: {request.rejectionReason}</p>
          )}
        </>
      ),
    });
  for (const item of tripLoad.cases.filter(
    (value) => value.busId === vehicle.id,
  ))
    timeline.push({
      id: `trip:${item.id}`,
      category: "Revisiones",
      status: tripStatus(item),
      types: ["Pre/Post trip", item.template?.name ?? "Formato no definido"],
      actor: item.closedBy?.name ?? item.driverName,
      at:
        item.closedAt ??
        item.post?.submittedAt ??
        item.pre?.submittedAt ??
        item.createdAt,
      title: `${item.number} · ${item.template?.name ?? "Revisión de viaje"} · ${tripStatus(item)}`,
      body: (
        <>
          <p>
            Ida {item.departureDate} · Regreso {item.returnDate} ·{" "}
            {item.driverName}
          </p>
          <details className="history-details">
            <summary>Ver ambas revisiones y sus aspectos</summary>
            {(["pre", "post"] as const).map((stage) => (
              <section key={stage}>
                <h4>{stage} trip</h4>
                {item[stage] ? (
                  <>
                    {item.template?.aspects.map((aspect) => (
                      <p key={aspect.id}>
                        {aspect.text}:{" "}
                        <strong>
                          {item[stage]!.answers[aspect.id] === "fault"
                            ? "Con falla"
                            : "Bien"}
                        </strong>
                      </p>
                    ))}
                    <p>{item[stage]!.notes}</p>
                    <small>
                      {new Date(item[stage]!.submittedAt).toLocaleString(
                        "es-MX",
                      )}
                    </small>
                  </>
                ) : (
                  <p>Sin realizar</p>
                )}
              </section>
            ))}
            {item.closedBy && (
              <p>
                Cerrado por {item.closedBy.name}: {item.closingNotes}
              </p>
            )}
          </details>
        </>
      ),
    });
  for (const job of jobs)
    timeline.push({
      id: `job:${job.id}`,
      category: "Revisiones",
      status: job.completion ? "Realizada" : "Registro previo pendiente",
      types: [job.template.name],
      actor: job.completion?.actorName ?? job.requestedByName,
      date: job.completion?.date,
      at: job.completion?.recordedAt ?? job.requestedAt,
      title: `${job.template.name} · ${job.completion ? "Realizada" : "Solicitada / pendiente"}`,
      body: (
        <>
          <p>
            {job.selfInitiated
              ? `Revisión realizada libremente por ${job.completion?.actorName ?? job.requestedByName}, sin asignación.`
              : `Registro previo: ${job.requestedByName} · ${job.requestNotes}`}
          </p>
          {job.completion && (
            <>
              <p>
                Realizada {job.completion.date} por {job.completion.actorName} ·{" "}
                {job.completion.notes}
              </p>
              <details className="history-details">
                <summary>Ver evaluación</summary>
                {job.template.aspects.map((aspect) => (
                  <p key={aspect.id}>
                    {aspect.text}:{" "}
                    {job.completion!.answers[aspect.id] === "fault"
                      ? "Con falla"
                      : "Bien"}
                  </p>
                ))}
              </details>
            </>
          )}
        </>
      ),
    });
  for (const correction of fleet.cafCorrections.filter(
    (item) => item.busId === vehicle.id,
  ))
    timeline.push({
      id: correction.id,
      category: "Ajustes CAF",
      status: "Registrada",
      types: ["Corrección extraordinaria CAF"],
      actor: correction.actorName,
      at: correction.at,
      title: "Corrección extraordinaria del último CAF",
      body: (
        <>
          <p>
            Antes:{" "}
            {correction.before
              ? `${correction.before.date} · ${correction.before.odometer} km`
              : "Sin registro"}
            .
          </p>
          <p>
            Después: {correction.after.date} · {correction.after.odometer} km.
          </p>
          <p>Motivo: {correction.reason}</p>
          <small>{correction.actorName}</small>
        </>
      ),
    });
  for (const damage of fleet.damages.filter(
    (item) => item.busId === vehicle.id,
  ))
    timeline.push({
      id: damage.id,
      category: "Incidencias",
      status: incidents.find(
        (incident) => incident.sourceId === `damage:${damage.id}`,
      )?.resolution
        ? "Reparada"
        : "No reparada",
      types: [damage.kind],
      actor: damage.actorName,
      date: damage.date,
      at: damage.recordedAt,
      title: `${damage.kind} registrado · ${damage.area}`,
      body: (
        <>
          <p>{damage.description}</p>
          <small>
            Fecha del reporte {damage.date} · {damage.actorName}
          </small>
        </>
      ),
    });
  for (const resolution of fleet.resolutions.filter(
    (item) => item.busId === vehicle.id,
  ))
    timeline.push({
      id: resolution.id,
      category: "Reparaciones",
      status: "Reparada",
      types: ["Confirmación de reparación"],
      actor: resolution.actorName,
      at: resolution.at,
      title: "Reparación confirmada",
      body: (
        <>
          <p>
            {
              incidents.find((item) => item.sourceId === resolution.sourceId)
                ?.title
            }
          </p>
          <p>{resolution.notes}</p>
          <small>
            {resolution.actorName}
            {resolution.orderId
              ? ` · ${orders.find((order) => order.id === resolution.orderId)?.number}`
              : ""}
          </small>
        </>
      ),
    });
  for (const item of incidents.filter(
    (incident) => !incident.sourceId.startsWith("damage:"),
  )) {
    const parts = item.sourceId.split(":");
    const trip = tripLoad.cases.find((value) => value.id === parts[1]);
    const job = jobs.find((value) => value.id === parts[1]);
    timeline.push({
      id: `incident:${item.sourceId}`,
      at: item.date,
      category: "Incidencias",
      status: item.resolution ? "Reparada" : "No reparada",
      types: [trip?.template?.name ?? job?.template.name ?? item.source],
      actor: trip?.driverName ?? job?.completion?.actorName ?? "No registrado",
      title: `${item.source} · ${item.title}`,
      body: (
        <>
          <p>{item.notes}</p>
          <p>
            {item.resolution
              ? `Reparada: ${item.resolution.notes} · ${item.resolution.actorName}`
              : "No reparada. Cerrar la revisión no resuelve esta observación."}
          </p>
        </>
      ),
    });
  }
  const categoryRows = timeline.filter(
    (row) =>
      historyFilters.category === "all" ||
      row.category === historyFilters.category,
  );
  const historyStatuses = [
    ...new Set(categoryRows.map((row) => row.status)),
  ].sort();
  const historyTypes = [
    ...new Set(categoryRows.flatMap((row) => row.types)),
  ].sort();
  const visibleHistory = filterHistory(timeline, historyFilters);
  function open(kind: NonNullable<typeof dialog>) {
    setDialog(kind);
    setError("");
  }
  async function commit(
    change: (latest: Workbench) => Workbench,
    message: string,
  ) {
    const failure = await onCommit(change, message);
    setError(failure ?? "");
    if (!failure) setDialog(null);
  }
  return (
    <>
      <section className="card vehicle-dossier">
        <div className="section-heading">
          <div>
            <button className="text-button" onClick={onBack}>
              <ArrowLeft size={14} />
              Volver a unidades
            </button>
            <h2>{vehicle.fleetNumber} · Historial de la unidad</h2>
            <p>
              {vehicle.brand} · {vehicle.model} · {vehicle.plate} ·{" "}
              {odometer.toLocaleString("es-MX")} km registrados
            </p>
          </div>
          <span className="badge neutral">
            Condición técnica no autorizada por esta vista
          </span>
        </div>
        {tripLoad.error && (
          <div className="notice error" role="alert">
            {tripLoad.error}
          </div>
        )}
        <p className="modal-description">
          Se muestra el historial registrado en el servidor. No hay datos
          históricos externos cargados ni telemetría; los faltantes aparecen
          como «Sin registro».
        </p>
        <div className="due-grid">
          <div>
            <span>CAF · Cada 15,000 km</span>
            <strong>
              {remaining === null
                ? "Sin registro del último CAF"
                : remaining < 0
                  ? `Vencido por ${Math.abs(remaining).toLocaleString("es-MX")} km`
                  : remaining === 0
                    ? "Corresponde ahora"
                    : `Faltan ${remaining.toLocaleString("es-MX")} km`}
            </strong>
            <small>
              {baseline
                ? `${baseline.date} · ${baseline.odometer.toLocaleString("es-MX")} km · ${baseline.reference}`
                : "Admin puede registrar una corrección extraordinaria con motivo."}
            </small>
          </div>
          {(["general", "emergency"] as const).map((type) => {
            const last = jobs
              .filter((job) => job.template.id === type && job.completion)
              .sort((a, b) =>
                b.completion!.date.localeCompare(a.completion!.date),
              )[0];
            const interval =
              catalogs.reviews.find((item) => item.id === type)?.intervalDays ??
              (type === "general" ? 45 : 90);
            const days = last
              ? remainingDays(last.completion!.date, interval)
              : null;
            return (
              <div key={type}>
                <span>
                  {type === "general"
                    ? "Revisión general"
                    : "Salidas de emergencia"}{" "}
                  · {interval} días
                </span>
                <strong>
                  {days === null
                    ? "Sin revisión realizada registrada"
                    : days < 0
                      ? `Vencida hace ${Math.abs(days)} días`
                      : days === 0
                        ? "Corresponde hoy"
                        : `Faltan ${days} días`}
                </strong>
                <small>
                  {last
                    ? `Última: ${last.completion!.date}`
                    : "No se calcula un vencimiento inventado."}
                </small>
              </div>
            );
          })}
        </div>
        <div className="order-actions">
          <button className="button secondary" onClick={() => open("damage")}>
            <Plus size={15} />
            Registrar golpe o incidencia
          </button>
          {user.role === "ADMIN" && (
            <>
              <button className="button secondary" onClick={() => open("caf")}>
                Corrección extraordinaria de CAF
              </button>
            </>
          )}
          <button className="button primary" onClick={() => open("request")}>
            <ClipboardCheck size={16} />
            Realizar revisión
          </button>
        </div>
        <div className="legacy-note">
          <strong>Observaciones actuales de la ficha</strong>
          <p>{vehicle.note || "Sin observaciones de ficha."}</p>
          <small>
            Este texto heredado no se cambia automáticamente al reparar una
            incidencia.
          </small>
        </div>
        <h3>Golpes e incidencias: reparadas y no reparadas</h3>
        <div className="request-filters">
          {[
            ["all", "Todas"],
            ["open", "No reparadas"],
            ["repaired", "Reparadas"],
          ].map(([value, label]) => (
            <button
              className={filter === value ? "selected" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {!incidents.length && (
          <p className="no-results">
            No hay incidencias estructuradas registradas. Consulta también las
            observaciones heredadas de la ficha.
          </p>
        )}
        {incidents
          .filter(
            (item) =>
              filter === "all" ||
              (filter === "repaired"
                ? Boolean(item.resolution)
                : !item.resolution),
          )
          .map((item) => (
            <article className="incident-card" key={item.sourceId}>
              <div>
                <span
                  className={`badge ${item.resolution ? "green" : "amber"}`}
                >
                  {item.resolution ? "Reparada" : "No reparada"}
                </span>
                <small>
                  {item.source} · {item.date}
                </small>
              </div>
              <h4>{item.title}</h4>
              <p>{item.notes}</p>
              {item.resolution ? (
                <div className="modal-note">
                  <Check size={16} />
                  <div>
                    <p>{item.resolution.notes}</p>
                    <small>
                      {item.resolution.actorName} ·{" "}
                      {new Date(item.resolution.at).toLocaleString("es-MX")}
                    </small>
                  </div>
                </div>
              ) : (
                <button
                  className="text-button"
                  onClick={() => {
                    setIncident(item);
                    open("resolve");
                  }}
                >
                  Confirmar reparación
                </button>
              )}
            </article>
          ))}
        <h3>Historial completo disponible</h3>
        <div className="history-filters">
          <label className="field">
            Categoría del historial
            <select
              value={historyFilters.category}
              onChange={(event) =>
                setHistoryFilters({
                  ...historyFilters,
                  category: event.target.value,
                  status: "all",
                  type: "all",
                })
              }
            >
              <option value="all">Todas las categorías</option>
              {(
                [
                  "Servicios",
                  "Revisiones",
                  "Solicitudes",
                  "Materiales",
                  "Incidencias",
                  "Reparaciones",
                  "Ajustes CAF",
                ] as const
              ).map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Estado de revisión o servicio
            <select
              value={historyFilters.status}
              onChange={(event) =>
                setHistoryFilters({
                  ...historyFilters,
                  status: event.target.value,
                })
              }
            >
              <option value="all">Todos los estados</option>
              {historyStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Tipo de revisión o servicio
            <select
              value={historyFilters.type}
              onChange={(event) =>
                setHistoryFilters({
                  ...historyFilters,
                  type: event.target.value,
                })
              }
            >
              <option value="all">Todos los tipos</option>
              {historyTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Fecha desde
            <input
              type="date"
              value={historyFilters.from}
              onChange={(event) =>
                setHistoryFilters({
                  ...historyFilters,
                  from: event.target.value,
                })
              }
            />
          </label>
          <label className="field">
            Fecha hasta
            <input
              type="date"
              value={historyFilters.to}
              onChange={(event) =>
                setHistoryFilters({ ...historyFilters, to: event.target.value })
              }
            />
          </label>
          <label className="field">
            Buscar en el historial
            <input
              placeholder="Referencia, revisión, servicio o responsable"
              value={historyFilters.query}
              onChange={(event) =>
                setHistoryFilters({
                  ...historyFilters,
                  query: event.target.value,
                })
              }
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() => setHistoryFilters(emptyHistoryFilters())}
          >
            Limpiar filtros
          </button>
        </div>
        {historyFilters.from &&
          historyFilters.to &&
          historyFilters.from > historyFilters.to && (
            <p className="notice error" role="alert">
              La fecha inicial no puede ser posterior a la fecha final.
            </p>
          )}
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={`Historial de ${vehicle.fleetNumber}, tabla desplazable`}
        >
          <table className="data-table history-table">
            <caption>Historial de {vehicle.fleetNumber}</caption>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Revisión / servicio</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Responsable</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {visibleHistory.map((item) => (
                <tr key={item.id}>
                  <td>{historyDate(item) || "Fecha no disponible"}</td>
                  <td>{item.category}</td>
                  <td>{item.types.join(" · ")}</td>
                  <td>
                    <span className="badge neutral">{item.status}</span>
                  </td>
                  <td>{item.title}</td>
                  <td>{item.actor}</td>
                  <td>
                    <details className="history-table-details">
                      <summary>Ver detalles</summary>
                      {item.body}
                    </details>
                  </td>
                </tr>
              ))}
              {!visibleHistory.length && (
                <tr>
                  <td colSpan={7}>
                    {timeline.length
                      ? "No hay registros que coincidan con los filtros."
                      : "Sin registros históricos en este entorno."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="safety-note">
          <ShieldCheck size={18} />
          <p>
            Una falla se conserva como no reparada hasta que mecánico/admin
            confirme su reparación. Cerrar un caso u orden no la resuelve
            automáticamente ni autoriza circulación.
          </p>
        </div>
      </section>
      {dialog === "caf" && (
        <Modal
          title="Corrección extraordinaria del último CAF"
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              commit(
                (latest) =>
                  correctCaf(latest, user, vehicle, {
                    date: String(fields.get("date")),
                    odometer: Number(fields.get("odometer")),
                    reason: String(fields.get("reason") ?? ""),
                    confirmed: fields.get("confirmed") === "on",
                  }),
                "Corrección extraordinaria registrada con valor anterior, nuevo valor y motivo.",
              );
            }}
          >
            <p className="modal-description">
              No modifica ni elimina las órdenes históricas. Se agrega una
              entrada de auditoría solo para este autobús.
            </p>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="field-grid">
              <label className="field">
                Fecha del último CAF
                <input
                  name="date"
                  required
                  type="date"
                  max={dateToday()}
                  defaultValue={baseline?.date ?? ""}
                />
              </label>
              <label className="field">
                Kilometraje del último CAF
                <input
                  name="odometer"
                  required
                  type="number"
                  min="0"
                  max={odometer}
                  step="1"
                  defaultValue={baseline?.odometer ?? ""}
                />
              </label>
              <label className="field full">
                Motivo extraordinario *
                <textarea name="reason" required maxLength={2000} rows={3} />
              </label>
            </div>
            <label className="confirmation-check">
              <input name="confirmed" type="checkbox" required />
              Confirmo que es una corrección extraordinaria, no un servicio
              realizado ahora.
            </label>
            <div className="modal-actions">
              <button className="button primary" type="submit">
                Registrar corrección con historial
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "request" && (
        <Modal
          title="Realizar revisión periódica"
          onClose={() => setDialog(null)}
        >
          <PeriodicReviewForm
            user={user}
            catalogs={catalogs}
            busId={vehicle.id}
            onCommit={onCommit}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}
      {dialog === "damage" && (
        <Modal
          title="Registrar golpe o incidencia"
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              commit(
                (latest) =>
                  addDamage(latest, user, vehicle.id, {
                    kind: String(fields.get("kind")) as "Golpe" | "Incidencia",
                    area: String(fields.get("area") ?? ""),
                    description: String(fields.get("description") ?? ""),
                    date: String(fields.get("date")),
                  }),
                "Incidencia registrada sin atribuir responsabilidad automáticamente.",
              );
            }}
          >
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="field-grid">
              <label className="field">
                Tipo
                <select name="kind">
                  <option>Golpe</option>
                  <option>Incidencia</option>
                </select>
              </label>
              <label className="field">
                Fecha
                <input
                  name="date"
                  required
                  type="date"
                  max={dateToday()}
                  defaultValue={dateToday()}
                />
              </label>
              <label className="field full">
                Parte afectada
                <input name="area" required maxLength={150} />
              </label>
              <label className="field full">
                Descripción
                <textarea
                  name="description"
                  required
                  maxLength={2000}
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="submit" className="button primary">
                Guardar incidencia
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "resolve" && incident && (
        <Modal
          title="Confirmar reparación de incidencia"
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              commit(
                (latest) =>
                  resolveIncident(
                    latest,
                    user,
                    incident,
                    String(fields.get("notes") ?? ""),
                    String(fields.get("order") ?? ""),
                  ),
                "Reparación confirmada. El reporte original y su historial se conservan.",
              );
            }}
          >
            <p className="modal-description">
              {incident.title} · {incident.source}
            </p>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <label className="field">
              Reparación realizada *
              <textarea name="notes" required maxLength={2000} rows={3} />
            </label>
            <label className="field">
              Orden finalizada relacionada (opcional)
              <select name="order" defaultValue="">
                <option value="">Sin vincular a una orden</option>
                {orders
                  .filter((order) => order.status === "Finalizada")
                  .map((order) => (
                    <option value={order.id} key={order.id}>
                      {order.number}
                    </option>
                  ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="submit" className="button primary">
                Confirmar que está reparada
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
