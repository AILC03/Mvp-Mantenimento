import type { Catalogs } from "../catalogs";
import type { SavedOrder } from "../data";
import type { Workbench } from "../requests";
import { currency, materialTotal } from "../data";
import { actualMaterialCost, orderMaterials } from "../orders";
import { externalTotal } from "../unit-records";

export function CompleteOrder({
  order,
  catalogs,
  data,
}: {
  order: SavedOrder;
  catalogs: Catalogs;
  data: Workbench;
}) {
  const vehicle = catalogs.vehicles.find((v) => v.id === order.form.busId);
  const source = data.requests.find((v) => v.id === order.form.sourceRequestId);
  return (
    <div className="complete-order">
      <h3>
        {order.number} · {order.status}
      </h3>
      <p>
        {vehicle?.fleetNumber} · {vehicle?.brand} {vehicle?.model} ·{" "}
        {vehicle?.plate} · VIN: {vehicle?.vin || "Sin registro"}
      </p>
      <p>
        Creada: {new Date(order.createdAt).toLocaleString("es-MX")} ·{" "}
        {order.createdBy?.name}
      </p>
      <p>
        Responsable:{" "}
        {order.form.assignee?.name || "Asignación histórica por servicio"} ·
        Prioridad: {order.form.priority}
      </p>
      <p>
        Programada: {order.form.scheduledDate || "Sin fecha"} · Estimada de
        terminación: {order.form.estimatedCompletion || "Sin fecha"} · Apertura:{" "}
        {order.form.odometer} km
      </p>
      <p>{order.form.reason}</p>
      {order.form.sourceRequestId && (
        <p>
          Solicitud:{" "}
          {data.requests.find((v) => v.id === order.form.sourceRequestId)
            ?.number ?? order.form.sourceRequestId}
        </p>
      )}
      {source && (
        <p>
          Reporte original: {source.title} · {source.description} · Reportó:{" "}
          {source.driverName}
        </p>
      )}
      {order.form.services.map((s) => (
        <section key={s.id}>
          <h4>{s.name}</h4>
          <p>
            {s.category} · {s.hours} horas{" "}
            {order.form.assignee ? "" : `· ${s.assignee}`}
          </p>
          <p>{s.instructions}</p>
          {s.materials.map((material) => {
            const product = catalogs.products.find(
              (v) => v.id === material.productId,
            );
            return (
              <p key={material.id}>
                Material previsto: {product?.sku} ·{" "}
                {product?.name ?? material.productId} · {material.quantity}{" "}
                {product?.unit} ×{" "}
                {currency(material.unitCost ?? product?.cost ?? 0)}
              </p>
            );
          })}
          {order.completion && (
            <p>
              {order.completion.performedServiceIds.includes(s.id)
                ? "Realizado"
                : `Pendiente: ${order.completion.unperformedReasons[s.id]}`}
            </p>
          )}
        </section>
      ))}
      <h4>Materiales de almacén</h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>Artículo</th>
            <th>Estimado</th>
            <th>Entregado</th>
            <th>Devuelto</th>
            <th>Neto</th>
          </tr>
        </thead>
        <tbody>
          {!orderMaterials(order).length && (
            <tr>
              <td colSpan={5}>Sin materiales de almacén requeridos.</td>
            </tr>
          )}
          {orderMaterials(order).map((r) => (
            <tr key={r.productId}>
              <td>
                {catalogs.products.find((v) => v.id === r.productId)?.name ??
                  order.materialConfirmations
                    ?.flatMap((v) => v.lines)
                    .find((v) => v.productId === r.productId)?.name ??
                  r.productId}
              </td>
              <td>{r.estimated}</td>
              <td>{r.delivered}</td>
              <td>{r.returned}</td>
              <td>{r.delivered - r.returned}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(order.form.orderedParts ?? []).length > 0 && (
        <>
          <h4>Piezas por pedido (fuera del stock)</h4>
          {order.form.orderedParts!.map((p) => (
            <p key={p.partId}>
              {p.identifier} · {p.name} · {p.supplier} · {p.quantity} ×{" "}
              {currency(p.unitCost)}
            </p>
          ))}
          {order.partConfirmations?.map((c) => (
            <p key={c.id}>
              {new Date(c.at).toLocaleString("es-MX")} · {c.actorName}:{" "}
              {c.lines
                .map(
                  (l) =>
                    `${order.form.orderedParts?.find((p) => p.partId === l.partId)?.identifier}: recibido ${l.received}, entregado ${l.delivered}, devuelto ${l.returned}`,
                )
                .join(" · ")}{" "}
              · {c.notes}
            </p>
          ))}
        </>
      )}
      <p>
        Estimado de materiales de almacén:{" "}
        {currency(materialTotal(order.form.services, catalogs.products))} ·
        Costo de salidas netas de almacén: {currency(actualMaterialCost(order))}
      </p>
      {(data.externalServices ?? [])
        .filter((v) => v.orderId === order.id)
        .map((v) => (
          <p key={v.id}>
            Servicio externo: {v.provider} · {v.description} · Materiales{" "}
            {currency(v.materialsCost)} · Mano de obra {currency(v.laborCost)} ·
            Total {currency(externalTotal(v))} (único registro de costo externo)
            {" · "}
            {v.date} · {v.actorName} · {v.notes}
          </p>
        ))}
      {order.completion && (
        <p>
          Terminada: {order.completion.date} · {order.completion.odometer} km ·{" "}
          {order.completion.actorName} · {order.completion.notes}
        </p>
      )}
      <h4>Movimientos y seguimiento</h4>
      {order.events?.map((v) => (
        <p key={v.id}>
          {new Date(v.at).toLocaleString("es-MX")} · {v.action} · {v.actorName}{" "}
          · {v.notes}
        </p>
      ))}
      {order.materialConfirmations?.map((v) => (
        <p key={v.id}>
          {new Date(v.at).toLocaleString("es-MX")} · {v.actorName} ·{" "}
          {v.correction ? "Corrección de devolución" : "Materiales"}:{" "}
          {v.lines
            .map(
              (l) =>
                `${l.name}: entrega ${l.delivered}, devolución ${l.returned}, costo ${currency(l.unitCost)}`,
            )
            .join(" · ")}{" "}
          · {v.notes}
        </p>
      ))}
    </div>
  );
}
