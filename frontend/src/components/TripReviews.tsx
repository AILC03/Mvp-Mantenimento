import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BusFront,
  CalendarDays,
  Check,
  ClipboardCheck,
  Eye,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { AuthUser } from "../auth";
import type { ReviewType } from "../catalogs";
import type { Vehicle } from "../data";
import {
  canCloseTrip,
  closeTripCase,
  loadTripCases,
  persistTripCases,
  startTripCase,
  submitTripInspection,
  tripStatus,
  type TripAnswer,
  type TripCase,
} from "../trip-reviews";
import { Modal } from "./Modal";

export function TripReviews({
  user,
  vehicles,
  templates,
}: {
  user: AuthUser;
  vehicles: Vehicle[];
  templates: ReviewType[];
}) {
  const [initial] = useState(() => {
    try {
      return { cases: loadTripCases(), error: "" };
    } catch (error) {
      return {
        cases: [],
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron leer los casos.",
      };
    }
  });
  const [cases, setCases] = useState(initial.cases);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"open" | "pending" | "closed" | "all">(
    canCloseTrip(user) ? "pending" : "open",
  );
  const [dialog, setDialog] = useState<{
    kind: "start" | "pre" | "post" | "detail";
    id?: string;
  } | null>(null);
  const [dialogError, setDialogError] = useState("");
  const selected = cases.find((item) => item.id === dialog?.id);
  const own = cases.filter(
    (item) => canCloseTrip(user) || item.driverId === user.id,
  );
  const visible = own.filter(
    (item) =>
      filter === "all" ||
      (filter === "closed"
        ? Boolean(item.closedAt)
        : filter === "pending"
          ? !item.closedAt && Boolean(item.pre && item.post)
          : !item.closedAt && !(item.pre && item.post)),
  );
  function open(kind: NonNullable<typeof dialog>["kind"], id?: string) {
    setDialog({ kind, id });
    setDialogError("");
  }
  async function commit(
    change: (latest: TripCase[]) => TripCase[],
    success: string,
  ): Promise<boolean> {
    try {
      const next = change(loadTripCases());
      await persistTripCases(next);
      setCases(loadTripCases());
      setError("");
      setMessage(success);
      setDialog(null);
      return true;
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "No se pudo guardar el caso.",
      );
      return false;
    }
  }
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (
      await commit(
        (latest) =>
          startTripCase(
            latest,
            user,
            {
              busId: String(fields.get("busId") ?? ""),
              departureDate: String(fields.get("departureDate") ?? ""),
              returnDate: String(fields.get("returnDate") ?? ""),
            },
            vehicles,
          ),
        "Caso iniciado. Completa pre y post trip para enviarlo a revisión.",
      )
    )
      setFilter("open");
  }
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      <section className="card trip-case-list">
        <div className="section-heading">
          <div>
            <h2>
              Casos de revisión de viaje{" "}
              <span className="count-pill">{own.length}</span>
            </h2>
            <p>
              Pre trip + post trip → revisión del mecánico o admin → Cierre de
              caso.
            </p>
          </div>
          {user.role === "DRIVER" && (
            <button className="button primary" onClick={() => open("start")}>
              <Plus size={16} />
              Iniciar caso de revisión
            </button>
          )}
        </div>
        <div
          className="request-filters"
          role="group"
          aria-label="Filtrar casos de revisión"
        >
          {(
            [
              ["open", "En captura"],
              ["pending", "Pendientes de revisión"],
              ["closed", "Cierre de caso"],
              ["all", "Todos"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {!visible.length ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">
              <ClipboardCheck size={32} />
            </span>
            <h3>Sin casos en este estado</h3>
            <p>
              {canCloseTrip(user)
                ? "Los casos llegan a pendientes cuando el chofer termina ambas revisiones."
                : "Inicia un caso con el autobús y las fechas de tu viaje."}
            </p>
          </div>
        ) : (
          <div className="request-list">
            {visible.map((item) => (
              <article className="request-item" key={item.id}>
                <div className="request-item-top">
                  <span
                    className={`badge ${item.closedAt ? "green" : item.pre && item.post ? "amber" : "neutral"}`}
                  >
                    {tripStatus(item)}
                  </span>
                  <small>{item.number}</small>
                </div>
                <h3>
                  <BusFront size={16} /> {item.fleetNumber} · {item.driverName}
                </h3>
                <div className="request-meta">
                  <span>
                    <CalendarDays size={13} />
                    Ida: {item.departureDate}
                  </span>
                  <span>Regreso: {item.returnDate}</span>
                </div>
                <div className="trip-stage-summary">
                  <span className={item.pre ? "complete" : ""}>
                    Pre trip {item.pre ? "· Realizada" : "· Pendiente"}
                  </span>
                  <span className={item.post ? "complete" : ""}>
                    Post trip {item.post ? "· Realizada" : "· Pendiente"}
                  </span>
                </div>
                <div className="request-item-bottom">
                  <button
                    className="text-button"
                    onClick={() => open("detail", item.id)}
                  >
                    <Eye size={15} />
                    Ver caso
                  </button>
                  {!item.closedAt &&
                    user.role === "DRIVER" &&
                    item.driverId === user.id &&
                    !item.post && (
                      <button
                        className="button primary"
                        onClick={() => open(item.pre ? "post" : "pre", item.id)}
                      >
                        Realizar {item.pre ? "post" : "pre"} trip{" "}
                        <ArrowRight size={15} />
                      </button>
                    )}
                  {!item.closedAt &&
                    item.pre &&
                    item.post &&
                    canCloseTrip(user) && (
                      <button
                        className="button primary"
                        onClick={() => open("detail", item.id)}
                      >
                        Revisar y cerrar <ArrowRight size={15} />
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="safety-note">
        <ShieldCheck size={19} />
        <div>
          <strong>El único resultado de cierre es «Cierre de caso».</strong>
          <p>
            No hay cierre negativo. Las fallas registradas se conservan; cerrar
            el caso no resuelve incidencias ni autoriza circulación. Los casos
            se guardan en PostgreSQL y se comparten entre los usuarios
            autorizados.
          </p>
        </div>
      </div>
      {dialog?.kind === "start" && (
        <Modal title="Iniciar caso de revisión" onClose={() => setDialog(null)}>
          <form onSubmit={start}>
            <p className="modal-description">
              El mismo chofer completa pre y post trip. Solo un caso abierto por
              autobús.
            </p>
            {dialogError && (
              <div className="notice error" role="alert">
                {dialogError}
              </div>
            )}
            <div className="field-grid">
              <label className="field full">
                Autobús del viaje *
                <select name="busId" required defaultValue="">
                  <option value="">Selecciona el autobús</option>
                  {vehicles
                    .filter((vehicle) => vehicle.type === "bus")
                    .map((vehicle) => (
                      <option value={vehicle.id} key={vehicle.id}>
                        {vehicle.fleetNumber} · {vehicle.model}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Fecha de ida *
                <input type="date" name="departureDate" required />
              </label>
              <label className="field">
                Fecha de regreso *
                <input type="date" name="returnDate" required />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="button primary">
                Iniciar caso
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (dialog?.kind === "pre" || dialog?.kind === "post") && (
        <Modal
          title={`Revisión ${dialog.kind} trip · ${selected.fleetNumber}`}
          onClose={() => setDialog(null)}
        >
          <TripInspectionForm
            item={selected}
            stage={dialog.kind}
            templates={templates}
            error={dialogError}
            onSubmit={async (answers, notes, template) => {
              const saved = await commit(
                (latest) =>
                  submitTripInspection(
                    latest,
                    user,
                    selected.id,
                    dialog.kind as "pre" | "post",
                    answers,
                    notes,
                    template,
                  ),
                dialog.kind === "post"
                  ? "Ambas revisiones están completas. Caso pendiente de revisión por mecánico o admin."
                  : "Pre trip enviada. El caso sigue en captura hasta realizar post trip.",
              );
              if (saved && dialog.kind === "post") setFilter("pending");
            }}
          />
        </Modal>
      )}
      {selected && dialog?.kind === "detail" && (
        <Modal
          title={`Caso ${selected.number}`}
          onClose={() => setDialog(null)}
        >
          <p className="modal-description">
            {selected.fleetNumber} · {selected.driverName}
            <br />
            Ida {selected.departureDate} · Regreso {selected.returnDate}
          </p>
          <span className="badge neutral">{tripStatus(selected)}</span>
          {selected.template && (
            <p className="modal-description">
              Formato: {selected.template.name} · Versión{" "}
              {selected.template.version}
            </p>
          )}
          {(["pre", "post"] as const).map((stage) => (
            <section className="trip-inspection-detail" key={stage}>
              <h3>{stage === "pre" ? "Pre trip" : "Post trip"}</h3>
              {selected[stage] ? (
                <>
                  <small>
                    {new Date(selected[stage].submittedAt).toLocaleString(
                      "es-MX",
                    )}
                  </small>
                  {selected.template?.aspects.map((aspect) => (
                    <div className="trip-result" key={aspect.id}>
                      <span>{aspect.text}</span>
                      <span
                        className={`badge ${selected[stage]!.answers[aspect.id] === "good" ? "green" : "red"}`}
                      >
                        {selected[stage]!.answers[aspect.id] === "good"
                          ? "Bien"
                          : "Con falla"}
                      </span>
                    </div>
                  ))}
                  <p className="request-description">
                    {selected[stage].notes || "Sin observaciones adicionales."}
                  </p>
                </>
              ) : (
                <p className="modal-description">Pendiente de realizar.</p>
              )}
            </section>
          ))}
          {dialogError && (
            <div className="notice error" role="alert">
              {dialogError}
            </div>
          )}
          {selected.closedAt ? (
            <div className="modal-note">
              <Check size={17} />
              <div>
                <strong>Cierre de caso</strong>
                <p>
                  Tipo de revisión: {selected.template?.name ?? "Pre/Post trip"}
                </p>
                <p>
                  {selected.closedBy?.name} ·{" "}
                  {new Date(selected.closedAt).toLocaleString("es-MX")}
                </p>
                <p>{selected.closingNotes}</p>
              </div>
            </div>
          ) : selected.pre && selected.post && canCloseTrip(user) ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                if (
                  await commit(
                    (latest) =>
                      closeTripCase(
                        latest,
                        user,
                        selected.id,
                        String(fields.get("closingNotes") ?? ""),
                      ),
                    "Cierre de caso registrado. Se conserva todo el historial pre y post trip.",
                  )
                )
                  setFilter("closed");
              }}
            >
              <label className="field">
                Observaciones de cierre (opcional)
                <textarea name="closingNotes" maxLength={2000} rows={3} />
              </label>
              <div className="modal-actions">
                <button type="submit" className="button primary">
                  <Check size={16} />
                  Cierre de caso
                </button>
              </div>
            </form>
          ) : (
            <p className="modal-note">
              {selected.pre && selected.post
                ? "Pendiente de revisión y cierre por mecánico o admin."
                : "Faltan revisiones. El caso todavía no puede cerrarse."}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function TripInspectionForm({
  item,
  stage,
  templates,
  error,
  onSubmit,
}: {
  item: TripCase;
  stage: "pre" | "post";
  templates: ReviewType[];
  error: string;
  onSubmit: (
    answers: Record<string, TripAnswer>,
    notes: string,
    template?: ReviewType,
  ) => void;
}) {
  const available = templates.filter(
    (template) => template.frequency === "trip" && template.aspects.length > 0,
  );
  const [templateId, setTemplateId] = useState(
    available.find((template) => template.id === "trip")?.id ??
      available[0]?.id ??
      "",
  );
  const [answers, setAnswers] = useState<Record<string, TripAnswer>>({});
  const [notes, setNotes] = useState("");
  const template =
    item.template ?? available.find((value) => value.id === templateId);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(answers, notes, template);
      }}
    >
      <p className="modal-description">
        Marca una sola opción por aspecto. Después de enviar no se modifica esta
        captura.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!item.template && available.length > 0 && (
        <label className="field">
          Formato de revisión de viaje
          <select
            value={templateId}
            onChange={(event) => {
              setTemplateId(event.target.value);
              setAnswers({});
            }}
          >
            {available.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name} · v{value.version}
              </option>
            ))}
          </select>
        </label>
      )}
      {!template ? (
        <div className="notice error" role="alert">
          El mecánico o administrador debe definir primero los aspectos en
          «Tipos de revisión», con periodicidad «Cada viaje». No se inventan
          puntos de verificación.
        </div>
      ) : (
        <>
          <p className="modal-description">
            {template.name} · Versión {template.version}. El formato se conserva
            igual para pre y post trip.
          </p>
          <div className="review-answer-list">
            {template.aspects.map((aspect) => (
              <fieldset className="review-answer" key={aspect.id}>
                <legend>{aspect.text}</legend>
                <div>
                  {(
                    [
                      ["good", "Bien"],
                      ["fault", "Con falla"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={answers[aspect.id] === value ? value : ""}
                    >
                      <input
                        type="radio"
                        name={`trip-answer-${aspect.id}`}
                        checked={answers[aspect.id] === value}
                        onChange={() =>
                          setAnswers({ ...answers, [aspect.id]: value })
                        }
                      />
                      <span className="answer-box">
                        {answers[aspect.id] === value && <Check size={13} />}
                      </span>
                      {label}
                    </label>
                  ))}
                </div>
                {stage === "post" && (
                  <small>
                    Pre trip:{" "}
                    {item.pre?.answers[aspect.id] === "good"
                      ? "Bien"
                      : "Con falla"}
                  </small>
                )}
              </fieldset>
            ))}
          </div>
          <label className="field trip-inspection-notes">
            Observaciones de la revisión
            <textarea
              maxLength={2000}
              value={notes}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="submit" className="button primary">
              Enviar revisión {stage} trip <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}
    </form>
  );
}
