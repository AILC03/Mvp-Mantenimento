import { useState } from "react";
import type { AuthUser } from "../auth";
import type { Catalogs } from "../catalogs";
import type { Workbench } from "../requests";
import {
  workshop,
  type Part,
  type UnitArticle,
  type WorkshopChange,
} from "../../../shared/src/workshop";
import { saveWorkshop } from "./WorkshopDirectory";
import { dateToday } from "../orders";
import type { CommitWorkbench } from "./OrdersView";
import { Modal } from "./Modal";

export function UnitEquipment({
  busId,
  data,
  user,
  catalogs,
  onCommit,
}: {
  busId: string;
  data: Workbench;
  user: AuthUser;
  catalogs: Catalogs;
  onCommit: CommitWorkbench;
}) {
  const [dialog, setDialog] = useState<
    "part" | "article" | "historical" | null
  >(null);
  const [part, setPart] = useState<Part>();
  const [article, setArticle] = useState<UnitArticle>();
  const [error, setError] = useState("");
  const w = workshop(data);
  async function save(change: WorkshopChange) {
    const fail = await onCommit(
      (latest) =>
        saveWorkshop(
          latest,
          user,
          change,
          catalogs.vehicles.map((v) => v.id),
        ),
      "Registro de la unidad guardado con historial.",
    );
    setError(fail ?? "");
    if (!fail) setDialog(null);
  }
  return (
    <section className="unit-records">
      <h3>Piezas compatibles y artículos de la unidad</h3>
      <p>
        Independientes del stock de almacén. Las piezas por pedido pueden
        agregarse a una orden.
      </p>
      <div className="order-actions">
        <button
          className="button secondary"
          onClick={() => {
            setPart(undefined);
            setError("");
            setDialog("part");
          }}
        >
          Agregar pieza compatible
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setArticle(undefined);
            setError("");
            setDialog("article");
          }}
        >
          Agregar artículo de la unidad
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setDialog("historical");
          }}
        >
          Agregar reparación anterior al software
        </button>
      </div>
      <h4>Piezas / números de parte</h4>
      {w.parts
        .filter((v) => v.vehicleIds.includes(busId))
        .map((v) => (
          <p key={v.id}>
            {v.identifier} · {v.name} ·{" "}
            {w.suppliers.find((s) => s.id === v.supplierId)?.name} · $
            {v.cost.toFixed(2)} · {v.active ? "Activa" : "Inactiva"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setPart(v);
                setError("");
                setDialog("part");
              }}
            >
              Editar
            </button>
          </p>
        ))}
      <h4>Herramientas, limpieza e inventario</h4>
      {w.articles
        .filter((v) => v.busId === busId)
        .map((v) => (
          <p key={v.id}>
            {v.name} · {v.category} · Cantidad: {v.quantity} ·{" "}
            {v.active ? "Activo" : "Inactivo"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setArticle(v);
                setError("");
                setDialog("article");
              }}
            >
              Editar / registrar movimiento
            </button>
          </p>
        ))}
      {dialog && (
        <Modal
          title={
            dialog === "part"
              ? "Pieza compatible"
              : dialog === "article"
                ? "Artículo de la unidad"
                : "Antecedente histórico"
          }
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const t = (k: string) => String(f.get(k) ?? "");
              if (dialog === "part")
                void save({
                  entity: "part",
                  value: {
                    id: part?.id ?? crypto.randomUUID(),
                    identifier: t("identifier"),
                    name: t("name"),
                    supplierId: t("supplierId"),
                    cost: Number(t("cost")),
                    notes: t("notes"),
                    vehicleIds: f.getAll("vehicleIds").map(String),
                    active: f.get("active") === "on",
                  },
                });
              else if (dialog === "article")
                void save({
                  entity: "article",
                  value: {
                    id: article?.id ?? crypto.randomUUID(),
                    busId,
                    name: t("name"),
                    category: t("category") as UnitArticle["category"],
                    quantity: Number(t("quantity")),
                    active: f.get("active") === "on",
                  },
                  reason: t("reason"),
                });
              else
                void save({
                  entity: "historical",
                  value: {
                    id: crypto.randomUUID(),
                    busId,
                    date: t("date"),
                    description: t("description"),
                    provider: t("provider"),
                    cost: t("cost") === "" ? null : Number(t("cost")),
                    odometer:
                      t("odometer") === "" ? null : Number(t("odometer")),
                    notes: t("notes"),
                  },
                });
            }}
          >
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="field-grid">
              {dialog !== "historical" && (
                <label className="field full">
                  Nombre *
                  <input
                    name="name"
                    required
                    maxLength={150}
                    defaultValue={
                      dialog === "part" ? part?.name : article?.name
                    }
                  />
                </label>
              )}
              {dialog === "part" && (
                <>
                  <label className="field">
                    Número de parte / identificador *
                    <input
                      name="identifier"
                      required
                      maxLength={150}
                      defaultValue={part?.identifier}
                    />
                  </label>
                  <label className="field">
                    Proveedor de materiales *
                    <select
                      name="supplierId"
                      required
                      defaultValue={part?.supplierId ?? ""}
                    >
                      <option value="">Selecciona proveedor</option>
                      {w.suppliers
                        .filter(
                          (v) =>
                            v.kind === "materials" &&
                            (v.active || v.id === part?.supplierId),
                        )
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <fieldset className="field full">
                    <legend>Unidades compatibles *</legend>
                    {catalogs.vehicles.map((v) => (
                      <label key={v.id}>
                        <input
                          type="checkbox"
                          name="vehicleIds"
                          value={v.id}
                          defaultChecked={
                            part
                              ? part.vehicleIds.includes(v.id)
                              : v.id === busId
                          }
                        />
                        {v.fleetNumber}
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              {dialog === "article" && (
                <>
                  <label className="field">
                    Categoría
                    <select
                      name="category"
                      defaultValue={article?.category ?? "Inventario"}
                    >
                      <option>Herramienta</option>
                      <option>Producto de limpieza</option>
                      <option>Inventario</option>
                    </select>
                  </label>
                  <label className="field">
                    Cantidad *
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      step="1"
                      required
                      defaultValue={article?.quantity ?? 1}
                    />
                  </label>
                  <label className="field full">
                    Motivo del alta, faltante o recuperación *
                    <textarea name="reason" required maxLength={2000} />
                  </label>
                </>
              )}
              {dialog === "historical" && (
                <>
                  <p>
                    Antecedente previo al software: no modifica stock,
                    circulación ni último CAF.
                  </p>
                  <label className="field">
                    Fecha de reparación *
                    <input name="date" type="date" required max={dateToday()} />
                  </label>
                  <label className="field full">
                    Trabajo realizado *
                    <textarea name="description" required maxLength={4000} />
                  </label>
                  <label className="field">
                    Prestador / responsable (opcional)
                    <input name="provider" maxLength={150} />
                  </label>
                  <label className="field">
                    Odómetro (opcional)
                    <input name="odometer" type="number" min="0" step="1" />
                  </label>
                </>
              )}
              {dialog !== "article" && (
                <>
                  <label className="field">
                    {dialog === "part"
                      ? "Costo de referencia *"
                      : "Costo histórico (opcional)"}{" "}
                    (MXN)
                    <input
                      name="cost"
                      type="number"
                      min="0"
                      max="1000000000"
                      step="0.01"
                      required={dialog === "part"}
                      defaultValue={dialog === "part" ? (part?.cost ?? "") : ""}
                    />
                  </label>
                  <label className="field full">
                    Observaciones
                    <textarea
                      name="notes"
                      maxLength={4000}
                      defaultValue={dialog === "part" ? part?.notes : ""}
                    />
                  </label>
                </>
              )}
              {dialog !== "historical" && (
                <label>
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={
                      (dialog === "part" ? part?.active : article?.active) ??
                      true
                    }
                  />{" "}
                  Activo
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button className="button primary">Guardar registro</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
