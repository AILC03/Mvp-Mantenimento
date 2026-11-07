import { useState } from "react";
import type { Catalogs } from "../catalogs";
import type { AuthUser } from "../auth";
import { managesOrders } from "../orders";
import type { Workbench } from "../requests";
import { applyCommand } from "../../../shared/src/operations";
import { track } from "../operations-client";
import type { CommitWorkbench } from "./OrdersView";

export function UnitInventory({
  vehicleId,
  catalogs,
  user,
  data,
  onCommit,
}: {
  vehicleId: string;
  catalogs: Catalogs;
  user: AuthUser;
  data: Workbench;
  onCommit: CommitWorkbench;
}) {
  const current = data.unitInventories?.find((i) => i.busId === vehicleId);
  const [editing, setEditing] = useState(false);
  const [counts, setCounts] = useState(current?.items ?? []);
  const [error, setError] = useState("");
  return (
    <section className="card">
      <h2>Inventario de la unidad</h2>
      <p>
        Independiente del almacén: no genera salidas ni entradas de existencias.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!editing ? (
        <>
          <ul>
            {(current?.items ?? []).map((row) => (
              <li key={row.productId}>
                {catalogs.products.find((p) => p.id === row.productId)?.name ??
                  row.productId}
                : {row.quantity}
              </li>
            ))}
          </ul>
          {managesOrders(user) && (
            <button
              className="button secondary"
              onClick={() => {
                setCounts(current?.items ?? []);
                setEditing(true);
              }}
            >
              Configurar artículos de la unidad
            </button>
          )}
        </>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const command = {
              type: "inventory.save" as const,
              vehicleId,
              counts,
            };
            const failure = await onCommit(
              (workbench) =>
                track(
                  applyCommand(
                    { catalogs, workbench, trips: [] },
                    user,
                    command,
                    0,
                  ).workbench,
                  command,
                ),
              "Inventario de unidad guardado sin modificar almacén.",
            );
            setError(failure ?? "");
            if (!failure) setEditing(false);
          }}
        >
          <label className="field">
            Agregar artículo
            <select
              value=""
              onChange={(event) =>
                setCounts([
                  ...counts,
                  { productId: event.target.value, quantity: 0 },
                ])
              }
            >
              <option value="">Selecciona un artículo</option>
              {catalogs.products
                .filter((p) => !counts.some((r) => r.productId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          {counts.map((row) => {
            const product = catalogs.products.find(
              (p) => p.id === row.productId,
            );
            return (
              <div key={row.productId}>
                <label className="field">
                  {product?.name}
                  <input
                    type="number"
                    required
                    min="0"
                    step={product?.unit === "L" ? "0.5" : "1"}
                    value={Number.isFinite(row.quantity) ? row.quantity : ""}
                    onChange={(e) =>
                      setCounts(
                        counts.map((r) =>
                          r.productId === row.productId
                            ? {
                                ...r,
                                quantity:
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    setCounts(
                      counts.filter((r) => r.productId !== row.productId),
                    )
                  }
                >
                  Quitar {product?.name}
                </button>
              </div>
            );
          })}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
            <button className="button primary">
              Guardar inventario de unidad
            </button>
          </div>
        </form>
      )}
      {(current?.movements ?? []).map((m) => (
        <p key={m.id}>
          {m.at.slice(0, 10)} · {m.name}: −{m.quantity} {m.unit} · {m.reason} ·{" "}
          {m.actorName}
        </p>
      ))}
    </section>
  );
}
