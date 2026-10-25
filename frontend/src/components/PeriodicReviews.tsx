import { useState } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import type { AuthUser } from "../auth";
import { reviewFrequency, type Catalogs } from "../catalogs";
import type { Workbench } from "../requests";
import type { TripAnswer } from "../trip-reviews";
import { fleetRecords, recordPeriodicReview, remainingDays } from "../fleet";
import { dateToday } from "../orders";
import type { CommitWorkbench } from "./OrdersView";
import { Modal } from "./Modal";

export function PeriodicReviews({
  user,
  data,
  catalogs,
  onCommit,
}: {
  user: AuthUser;
  data: Workbench;
  catalogs: Catalogs;
  onCommit: CommitWorkbench;
}) {
  const [busId, setBusId] = useState(catalogs.vehicles[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const reviews = catalogs.reviews.filter(
    (template) => template.frequency !== "trip",
  );
  return (
    <section className="card requested-reviews">
      <div className="section-heading">
        <span className="step-number">
          <ClipboardCheck size={18} />
        </span>
        <div>
          <h2>Realizar revisiones periódicas</h2>
          <p>
            No hay asignaciones. Puedes realizarlas en cualquier momento; al
            guardarlas se reinicia el contador desde su fecha de realización.
          </p>
        </div>
      </div>
      <label className="field">
        Unidad a revisar
        <select
          value={busId}
          onChange={(event) => setBusId(event.target.value)}
        >
          {catalogs.vehicles.map((vehicle) => (
            <option value={vehicle.id} key={vehicle.id}>
              {vehicle.fleetNumber} · {vehicle.model}
            </option>
          ))}
        </select>
      </label>
      {reviews.map((template) => {
        const last = fleetRecords(data)
          .reviewJobs.filter(
            (job) =>
              job.busId === busId &&
              job.template.id === template.id &&
              job.completion,
          )
          .sort((a, b) =>
            b.completion!.date.localeCompare(a.completion!.date),
          )[0];
        const days =
          last && template.intervalDays
            ? remainingDays(last.completion!.date, template.intervalDays)
            : null;
        return (
          <article className="saved-order" key={template.id}>
            <div>
              <strong>
                {template.name} · {reviewFrequency(template)}
              </strong>
              <p>
                {!last
                  ? "Sin realización registrada. Puedes realizar la primera revisión."
                  : days === null
                    ? `Última revisión: ${last.completion!.date}`
                    : days < 0
                      ? `Vencida hace ${Math.abs(days)} días. Puedes realizarla igualmente.`
                      : days === 0
                        ? "Vence hoy; no se bloquea su realización."
                        : `Faltan ${days} días. También puedes realizarla antes.`}
              </p>
              {!template.aspects.length && (
                <small>
                  Admin debe definir los aspectos de este tipo antes de
                  capturarlo.
                </small>
              )}
            </div>
            <button
              className="button primary"
              disabled={!template.aspects.length || !busId}
              onClick={() => setTemplateId(template.id)}
            >
              Realizar revisión
            </button>
          </article>
        );
      })}
      {templateId && (
        <Modal
          title="Realizar revisión periódica"
          onClose={() => setTemplateId("")}
        >
          <PeriodicReviewForm
            user={user}
            catalogs={catalogs}
            busId={busId}
            templateId={templateId}
            onCommit={onCommit}
            onDone={() => setTemplateId("")}
          />
        </Modal>
      )}
    </section>
  );
}

export function PeriodicReviewForm({
  user,
  catalogs,
  busId,
  templateId,
  onCommit,
  onDone,
}: {
  user: AuthUser;
  catalogs: Catalogs;
  busId: string;
  templateId?: string;
  onCommit: CommitWorkbench;
  onDone: () => void;
}) {
  const choices = catalogs.reviews.filter(
    (template) => template.frequency !== "trip" && template.aspects.length > 0,
  );
  const [selectedId, setSelectedId] = useState(
    templateId ?? choices[0]?.id ?? "",
  );
  const [answers, setAnswers] = useState<Record<string, TripAnswer>>({});
  const [error, setError] = useState("");
  const selected = choices.find((template) => template.id === selectedId);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!selected) return;
        const fields = new FormData(event.currentTarget);
        const failure = await onCommit(
          (latest) =>
            recordPeriodicReview(latest, user, busId, selected, {
              date: String(fields.get("date")),
              answers,
              notes: String(fields.get("notes") ?? ""),
            }),
          "Revisión realizada. El próximo vencimiento se calcula desde esta fecha; no hay asignaciones ni bloqueo por estar vencida.",
        );
        if (failure) setError(failure);
        else onDone();
      }}
    >
      <p className="modal-description">
        {catalogs.vehicles.find((vehicle) => vehicle.id === busId)?.fleetNumber}
        . Puedes realizarla antes o después del vencimiento. No se modifica el
        tipo de revisión.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!selected ? (
        <p className="modal-note">
          Admin debe definir primero los aspectos de las revisiones periódicas
          en Tipos de revisión.
        </p>
      ) : (
        <>
          <label className="field">
            Revisión existente
            <select
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setAnswers({});
              }}
            >
              {choices.map((template) => (
                <option value={template.id} key={template.id}>
                  {template.name} · {reviewFrequency(template)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fecha de realización
            <input
              name="date"
              required
              type="date"
              max={dateToday()}
              defaultValue={dateToday()}
            />
          </label>
          <div className="review-answer-list">
            {selected.aspects.map((aspect) => (
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
                        name={`periodic-${aspect.id}`}
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
              </fieldset>
            ))}
          </div>
          <label className="field">
            Observaciones
            <textarea name="notes" rows={3} maxLength={2000} />
          </label>
          <div className="modal-actions">
            <button className="button primary" type="submit">
              Guardar revisión realizada
            </button>
          </div>
        </>
      )}
    </form>
  );
}
