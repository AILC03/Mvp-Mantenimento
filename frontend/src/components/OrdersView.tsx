import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Eye,
  Package,
  Pause,
  Play,
  Plus,
  Printer,
} from "lucide-react";
import type { AuthUser } from "../auth";
import {
  currency,
  materialTotal,
  type Product,
  type SavedOrder,
} from "../data";
import type { Catalogs } from "../catalogs";
import type { Workbench } from "../requests";
import {
  actualMaterialCost,
  availableStock,
  changeOrder,
  confirmMaterials,
  dateToday,
  finishOrder,
  managesOrders,
  managesStock,
  orderMaterials,
  orderCategory,
  materialsPendingConfirmation,
  type OrderCategory,
} from "../orders";
import { Modal } from "./Modal";

export type CommitWorkbench = (
  change: (latest: Workbench) => Workbench,
  message: string,
) => string | null | Promise<string | null>;
export function OrdersView({
  user,
  data,
  catalogs,
  onCommit,
  onNewOrder,
  onResumeDraft,
  initialOrderId,
}: {
  user: AuthUser;
  data: Workbench;
  catalogs: Catalogs;
  onCommit: CommitWorkbench;
  onNewOrder: () => void;
  onResumeDraft?: () => void;
  initialOrderId?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialOrderId ?? "");
  const [category, setCategory] = useState<OrderCategory>("pending");
  const [dialog, setDialog] = useState<"pause" | "finish" | "materials" | null>(
    null,
  );
  const [error, setError] = useState("");
  const order = data.orders.find((item) => item.id === selectedId);
  const canExecute = managesOrders(user);
  const visibleOrders = data.orders.filter(
    (item) => orderCategory(item) === category,
  );
  useEffect(
    () => () => {
      document.body.classList.remove("printing-requisition");
    },
    [],
  );
  async function act(
    change: (latest: Workbench) => Workbench,
    message: string,
  ) {
    const failure = await onCommit(change, message);
    setError(failure ?? "");
    if (!failure) setDialog(null);
    return !failure;
  }
  function print() {
    document.body.classList.add("printing-requisition");
    const cleanup = () =>
      document.body.classList.remove("printing-requisition");
    window.addEventListener("afterprint", cleanup, { once: true });
    try {
      window.print();
    } catch {
      cleanup();
      setError("No se pudo abrir la impresión.");
    }
  }
  if (!order)
    return (
      <section className="card orders-view">
        <div className="section-heading">
          <div>
            <h2>Órdenes de trabajo</h2>
            <p>
              {user.role === "WAREHOUSE_CLERK"
                ? "Consulta lo requerido y confirma entregas y devoluciones."
                : "Las órdenes del mecánico no necesitan liberación de otra persona."}
            </p>
          </div>
          {canExecute && (
            <div className="order-list-actions">
              {onResumeDraft && (
                <button className="button secondary" onClick={onResumeDraft}>
                  Retomar orden en edición
                </button>
              )}
              <button className="button primary" onClick={onNewOrder}>
                <Plus size={16} />
                Nueva orden
              </button>
            </div>
          )}
        </div>
        <div
          className="order-category-tabs"
          role="group"
          aria-label="Categorías de órdenes"
        >
          {(
            [
              ["pending", "Pendientes"],
              ["working", "En proceso"],
              ["finished", "Finalizadas"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={category === value}
              className={category === value ? "selected" : ""}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {!visibleOrders.length ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">
              <Package size={32} />
            </span>
            <h3>No hay órdenes en esta categoría</h3>
          </div>
        ) : (
          visibleOrders.map((item) => (
            <article className="saved-order" key={item.id}>
              <div>
                <button
                  className="order-title-button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setError("");
                  }}
                >
                  {item.number}
                </button>
                <p>
                  {catalogs.vehicles.find(
                    (vehicle) => vehicle.id === item.form.busId,
                  )?.fleetNumber ?? item.form.busId}{" "}
                  ·{" "}
                  {item.form.services.map((service) => service.name).join(", ")}
                </p>
                <small>
                  {item.form.services.length} servicios · {item.form.priority}
                </small>
              </div>
              <span className="badge neutral">
                {item.status === "Pendiente de liberación"
                  ? "Lista para iniciar"
                  : item.status}
              </span>
              <button
                className="button secondary"
                onClick={() => {
                  setSelectedId(item.id);
                  setError("");
                }}
              >
                <Eye size={15} />
                Ver detalles
              </button>
            </article>
          ))
        )}
      </section>
    );
  const vehicle = catalogs.vehicles.find(
    (item) => item.id === order.form.busId,
  );
  const source = data.requests.find(
    (item) => item.id === order.form.sourceRequestId,
  );
  const rows = orderMaterials(order);
  return (
    <>
      <section className="card order-detail">
        <div className="section-heading">
          <div>
            <button
              className="text-button"
              onClick={() => {
                setSelectedId("");
                setCategory(orderCategory(order));
                setError("");
              }}
            >
              <ArrowLeft size={14} />
              Volver a órdenes
            </button>
            <h2>{order.number}</h2>
            <p>
              {vehicle?.fleetNumber} · {vehicle?.model} · Creada{" "}
              {new Date(order.createdAt).toLocaleString("es-MX")}
            </p>
          </div>
          <span className="badge neutral">
            {order.status === "Pendiente de liberación"
              ? "Lista para iniciar"
              : order.status}
          </span>
        </div>
        {error && !dialog && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="order-actions">
          <button className="button secondary" onClick={print}>
            <Printer size={16} />
            Imprimir requisición
          </button>
          {canExecute &&
            ["Lista para iniciar", "Pendiente de liberación"].includes(
              order.status,
            ) && (
              <button
                className="button primary"
                onClick={() =>
                  act(
                    (latest) => changeOrder(latest, user, order.id, "start"),
                    "Orden iniciada sin requerir liberación adicional.",
                  )
                }
              >
                <Play size={15} />
                Iniciar orden
              </button>
            )}
          {canExecute && order.status === "En proceso" && (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  setDialog("pause");
                  setError("");
                }}
              >
                <Pause size={15} />
                Pausar orden
              </button>
              <button
                className="button primary"
                disabled={materialsPendingConfirmation(order).length > 0}
                title={
                  materialsPendingConfirmation(order).length
                    ? "Falta la entrega confirmada por almacén."
                    : undefined
                }
                onClick={() => {
                  setDialog("finish");
                  setError("");
                }}
              >
                <Check size={15} />
                Terminar orden
              </button>
            </>
          )}
          {canExecute && order.status === "Pausada" && (
            <button
              className="button primary"
              onClick={() =>
                act(
                  (latest) => changeOrder(latest, user, order.id, "resume"),
                  "Orden reanudada.",
                )
              }
            >
              <Play size={15} />
              Reanudar orden
            </button>
          )}
          {managesStock(user) && rows.length > 0 && (
            <button
              className="button primary"
              onClick={() => {
                setDialog("materials");
                setError("");
              }}
            >
              <Package size={16} />
              Dar salida a materiales
            </button>
          )}
        </div>
        {canExecute &&
          order.status === "En proceso" &&
          materialsPendingConfirmation(order).length > 0 && (
            <div className="notice error" role="status">
              Para finalizar, almacén debe confirmar la entrega de:{" "}
              {materialsPendingConfirmation(order)
                .map(
                  (row) =>
                    catalogs.products.find(
                      (product) => product.id === row.productId,
                    )?.name ?? row.productId,
                )
                .join(", ")}
              . Puede entregar la misma cantidad estimada.
            </div>
          )}
        <dl className="preview-details">
          <div>
            <dt>Unidad</dt>
            <dd>{vehicle?.fleetNumber ?? order.form.busId}</dd>
          </div>
          <div>
            <dt>Prioridad</dt>
            <dd>{order.form.priority}</dd>
          </div>
          <div>
            <dt>Programación</dt>
            <dd>{order.form.scheduledDate || "Sin fecha"}</dd>
          </div>
          <div>
            <dt>Odómetro inicial</dt>
            <dd>{order.form.odometer} km</dd>
          </div>
          <div>
            <dt>Solicitud</dt>
            <dd>{source?.number ?? "Orden manual"}</dd>
          </div>
          <div>
            <dt>Observaciones</dt>
            <dd>{order.form.reason || "Sin observaciones"}</dd>
          </div>
        </dl>
        {source && (
          <details className="history-details">
            <summary>Ver reporte original</summary>
            <h3>{source.title}</h3>
            <p>{source.description}</p>
            <small>
              {source.driverName} ·{" "}
              {new Date(source.createdAt).toLocaleString("es-MX")}
            </small>
          </details>
        )}
        <h3>Servicios e instrucciones</h3>
        {order.form.services.map((service) => (
          <article className="order-service-detail" key={service.id}>
            <h3>{service.name}</h3>
            <p>
              {service.assignee || "Sin responsable individual"} ·{" "}
              {service.hours} horas estimadas · {service.category}
            </p>
            <p>{service.instructions || "Sin instrucciones adicionales"}</p>
            {order.completion && (
              <div className="modal-note">
                {order.completion.performedServiceIds.includes(service.id)
                  ? "Realizado"
                  : `Pendiente: ${order.completion.unperformedReasons[service.id] || "No ejecutado"}`}
              </div>
            )}
          </article>
        ))}
        <h3>Materiales de la orden</h3>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Materiales de la orden, tabla desplazable"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Unidad</th>
                <th>Estimada</th>
                <th>Entregada</th>
                <th>Devuelta</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const product = catalogs.products.find(
                  (item) => item.id === row.productId,
                );
                return (
                  <tr key={row.productId}>
                    <td>{product?.name ?? row.productId}</td>
                    <td>{product?.unit}</td>
                    <td>{row.estimated}</td>
                    <td>{row.delivered}</td>
                    <td>{row.returned}</td>
                    <td>{row.delivered - row.returned}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cost-pair">
          <span>
            Estimación de materiales{" "}
            <strong>
              {currency(materialTotal(order.form.services, catalogs.products))}
            </strong>
          </span>
          <span>
            Salidas netas confirmadas{" "}
            <strong>{currency(actualMaterialCost(order))}</strong>
          </span>
        </div>
        <p className="section-footnote">
          No incluye mano de obra ni otros gastos. Las entregas/devueltas son
          acumuladas y solo almacén/admin las confirma.
        </p>
        {order.completion && (
          <div className="modal-note">
            <Check size={17} />
            <div>
              <strong>
                Orden finalizada · {order.completion.date} ·{" "}
                {order.completion.odometer} km
              </strong>
              <p>{order.completion.notes || "Sin observaciones adicionales"}</p>
              <small>
                {order.completion.actorName}. Finalizar no autoriza circulación
                ni resuelve automáticamente incidencias.
              </small>
            </div>
          </div>
        )}
        <h3>Historial de la orden</h3>
        <div className="activity-list">
          {(order.events ?? []).map((event) => (
            <div key={event.id}>
              <strong>{event.action}</strong>
              <p>{event.notes}</p>
              <small>
                {event.actorName} · {new Date(event.at).toLocaleString("es-MX")}
              </small>
            </div>
          ))}
          {(order.materialConfirmations ?? []).map((event) => (
            <div key={event.id}>
              <strong>Materiales confirmados</strong>
              {event.lines.map((line) => (
                <p key={line.productId}>
                  {line.name}: entregado +{line.delivered}, devuelto +
                  {line.returned} {line.unit}
                </p>
              ))}
              <p>{event.notes}</p>
              <small>
                {event.actorName} · {new Date(event.at).toLocaleString("es-MX")}
              </small>
            </div>
          ))}
        </div>
      </section>
      {createPortal(
        <section className="requisition-sheet">
          <h1>Real Ejecutivo · Requisición de materiales</h1>
          <p>Orden: {order.number}</p>
          <p>
            Unidad: {vehicle?.fleetNumber} · Fecha de impresión: {dateToday()}
          </p>
          <p>
            Solicita: {user.name} · Solicitud de origen:{" "}
            {source?.number ?? "Orden manual"}
          </p>
          <table>
            <thead>
              <tr>
                <th>Código / artículo</th>
                <th>Unidad</th>
                <th>Estimada</th>
                <th>Entregada</th>
                <th>Devuelta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const product = catalogs.products.find(
                  (item) => item.id === row.productId,
                );
                return (
                  <tr key={row.productId}>
                    <td>
                      {product?.sku} · {product?.name ?? row.productId}
                    </td>
                    <td>{product?.unit}</td>
                    <td>{row.estimated}</td>
                    <td>{row.delivered || ""}</td>
                    <td>{row.returned || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>Materiales sujetos a entrega física y confirmación de almacén.</p>
          <div className="signature-lines">
            <span>Solicita: __________________</span>
            <span>Entrega: __________________</span>
            <span>Recibe: __________________</span>
          </div>
        </section>,
        document.body,
      )}
      {dialog === "pause" && (
        <Modal title="Pausar orden" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              act(
                (latest) =>
                  changeOrder(
                    latest,
                    user,
                    order.id,
                    "pause",
                    String(
                      new FormData(event.currentTarget).get("notes") ?? "",
                    ),
                  ),
                "Orden pausada con su motivo.",
              );
            }}
          >
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <label className="field">
              Motivo de pausa *
              <textarea name="notes" required maxLength={2000} rows={4} />
            </label>
            <div className="modal-actions">
              <button className="button primary" type="submit">
                Confirmar pausa
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "finish" && (
        <Modal title="Terminar orden" onClose={() => setDialog(null)}>
          <FinishForm
            order={order}
            error={error}
            onFinish={async (input) => {
              const completed = await act(
                (latest) => finishOrder(latest, user, order.id, input),
                "Orden finalizada. Los servicios no realizados permanecen pendientes en el historial.",
              );
              if (completed) {
                setCategory("finished");
                setSelectedId("");
              }
            }}
          />
        </Modal>
      )}
      {dialog === "materials" && (
        <Modal title="Dar salida a materiales" onClose={() => setDialog(null)}>
          <MaterialsForm
            order={order}
            products={catalogs.products}
            orders={data.orders}
            error={error}
            onConfirm={(totals, notes) =>
              act(
                (latest) =>
                  confirmMaterials(
                    latest,
                    catalogs.products,
                    user,
                    order.id,
                    totals,
                    notes,
                  ),
                "Materiales confirmados. Se actualizó la existencia sin doble descuento.",
              )
            }
          />
        </Modal>
      )}
    </>
  );
}

function FinishForm({
  order,
  error,
  onFinish,
}: {
  order: SavedOrder;
  error: string;
  onFinish: (input: Parameters<typeof finishOrder>[3]) => void;
}) {
  const [performed, setPerformed] = useState<string[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        onFinish({
          date: String(fields.get("date")),
          odometer: Number(fields.get("odometer")),
          performedServiceIds: performed,
          unperformedReasons: reasons,
          notes: String(fields.get("notes") ?? ""),
        });
      }}
    >
      <p className="modal-description">
        Marca solamente servicios realmente realizados. CAF solo se registra si
        fue ejecutado; cerrar la orden no cancela lo pendiente.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="field-grid">
        <label className="field">
          Fecha de ejecución
          <input
            name="date"
            type="date"
            required
            max={dateToday()}
            defaultValue={dateToday()}
          />
        </label>
        <label className="field">
          Odómetro al terminar
          <input
            name="odometer"
            type="number"
            required
            min="0"
            step="1"
            defaultValue={order.form.odometer}
          />
        </label>
      </div>
      <div className="completion-services">
        {order.form.services.map((service) => (
          <div key={service.id}>
            <label>
              <input
                type="checkbox"
                checked={performed.includes(service.id)}
                onChange={(event) =>
                  setPerformed(
                    event.target.checked
                      ? [...performed, service.id]
                      : performed.filter((id) => id !== service.id),
                  )
                }
              />
              {service.name}
            </label>
            {!performed.includes(service.id) && (
              <label className="field">
                Motivo de no realización
                <input
                  required
                  aria-label={`Motivo pendiente ${service.name}`}
                  maxLength={2000}
                  value={reasons[service.id] ?? ""}
                  onChange={(event) =>
                    setReasons({ ...reasons, [service.id]: event.target.value })
                  }
                />
              </label>
            )}
          </div>
        ))}
      </div>
      <label className="field">
        Trabajo y observaciones finales
        <textarea name="notes" maxLength={2000} rows={3} />
      </label>
      <div className="modal-actions">
        <button type="submit" className="button primary">
          Confirmar finalización
        </button>
      </div>
    </form>
  );
}

function MaterialsForm({
  order,
  products,
  orders,
  error,
  onConfirm,
}: {
  order: SavedOrder;
  products: Product[];
  orders: SavedOrder[];
  error: string;
  onConfirm: (
    totals: { productId: string; delivered: number; returned: number }[],
    notes: string,
  ) => void;
}) {
  const current = orderMaterials(order);
  const [totals, setTotals] = useState(
    current.map((row) => ({
      productId: row.productId,
      delivered: row.delivered,
      returned: row.returned,
    })),
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(
      totals,
      String(new FormData(event.currentTarget).get("notes") ?? ""),
    );
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        Captura cantidades acumuladas físicamente entregadas y devueltas. Al
        confirmar solo se aplica la diferencia respecto a capturas anteriores.
        Las cantidades estimadas son de consulta.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Entregas y devoluciones, tabla desplazable"
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Material / disponible</th>
              <th>Estimada</th>
              <th>Entregada total</th>
              <th>Devuelta total</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((row, index) => {
              const product = products.find(
                (item) => item.id === row.productId,
              );
              const original = current.find(
                (item) => item.productId === row.productId,
              )!;
              return (
                <tr key={row.productId}>
                  <td>
                    {product?.name ?? row.productId}
                    <small>
                      {product ? availableStock(product, orders) : "?"}{" "}
                      {product?.unit} disponibles
                    </small>
                  </td>
                  <td>{original.estimated}</td>
                  {(["delivered", "returned"] as const).map((field) => (
                    <td key={field}>
                      <input
                        aria-label={`${field === "delivered" ? "Entregada" : "Devuelta"} ${product?.name}`}
                        type="number"
                        required
                        min={original[field]}
                        step={product?.unit === "pza" ? "1" : "0.001"}
                        value={Number.isFinite(row[field]) ? row[field] : ""}
                        onChange={(event) =>
                          setTotals(
                            totals.map((value, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...value,
                                    [field]:
                                      event.target.value === ""
                                        ? NaN
                                        : Number(event.target.value),
                                  }
                                : value,
                            ),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="field">
        Observaciones de entrega o devolución
        <textarea name="notes" maxLength={2000} rows={2} />
      </label>
      <p className="section-footnote">
        No se permiten existencias negativas ni devolver más de lo entregado. Si
        no hay stock, registra primero una entrada real en Artículos de almacén.
      </p>
      <div className="modal-actions">
        <button type="submit" className="button primary">
          Confirmar materiales
        </button>
      </div>
    </form>
  );
}
