import { useState, type FormEvent } from "react";
import {
  BusFront,
  Check,
  ClipboardList,
  Eye,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  currency,
  vehicleTypeLabel,
  type CatalogService,
  type Product,
  type Vehicle,
} from "../data";
import {
  addStockEntry,
  reviewFrequency,
  saveProduct,
  saveReview,
  saveService,
  saveVehicle,
  stock,
  type Catalogs,
  type CatalogSection,
  type EntryInput,
  type ReviewAspect,
  type ReviewType,
} from "../catalogs";
import { Modal } from "./Modal";
import { MaterialPicker } from "./MaterialPicker";
import { QuantityStepper } from "./QuantityStepper";

export type CommitCatalogs = (
  update: (data: Catalogs) => Catalogs,
  message: string,
) => string | null | Promise<string | null>;
const text = (data: FormData, key: string) => String(data.get(key) ?? "");
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const titles = {
  materials: "Artículos de almacén",
  vehicles: "Unidades",
  services: "Tipos de servicio",
  reviews: "Tipos de revisión",
};
const addLabels = {
  materials: "Nuevo artículo",
  vehicles: "Nueva unidad",
  services: "Nuevo tipo de servicio",
  reviews: "Nuevo tipo de revisión",
};

function FormError({ message }: { message: string }) {
  return message ? (
    <div className="notice error" role="alert">
      {message}
    </div>
  ) : null;
}
function FormActions({
  onCancel,
  label = "Guardar",
}: {
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="modal-actions">
      <button type="button" className="button secondary" onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" className="button primary">
        <Check size={16} />
        {label}
      </button>
    </div>
  );
}

export function CatalogManager({
  section,
  data,
  onCommit,
  canEdit = true,
  onOpenVehicle,
  stockBalances,
}: {
  section: CatalogSection;
  data: Catalogs;
  onCommit: CommitCatalogs;
  canEdit?: boolean;
  onOpenVehicle?: (vehicle: Vehicle) => void;
  stockBalances?: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [editor, setEditor] = useState<{
    kind: CatalogSection | "entry" | "history" | "preview";
    id?: string;
  } | null>(null);
  const matches = (value: string) =>
    value.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  const close = () => setEditor(null);
  const selectedProduct = data.products.find((item) => item.id === editor?.id);
  const count =
    section === "materials"
      ? data.products.length
      : section === "vehicles"
        ? data.vehicles.length
        : section === "services"
          ? data.services.length
          : data.reviews.length;
  return (
    <>
      <section className="card catalog-management">
        <div className="section-heading">
          <div>
            <h2>
              {titles[section]} <span className="count-pill">{count}</span>
            </h2>
            <p>
              {section === "materials"
                ? "Sin categorías por ahora. Artículos medidos en piezas o litros."
                : section === "vehicles"
                  ? "Una ficha por unidad: Autobús o Sprinter de pasajeros."
                  : section === "services"
                    ? "CAF es el único preventivo. Define instrucciones y materiales necesarios."
                    : "Define la periodicidad y escribe los aspectos que se van a evaluar."}
            </p>
          </div>
          {canEdit && (
            <button
              className="button primary"
              onClick={() => setEditor({ kind: section })}
            >
              <Plus size={16} />
              {addLabels[section]}
            </button>
          )}
        </div>
        <div className="catalog-controls">
          <div className="input-icon search-field">
            <Search size={17} />
            <input
              aria-label={`Buscar en ${titles[section]}`}
              placeholder="Buscar en el catálogo…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {section === "vehicles" && (
            <select
              aria-label="Filtrar tipo de unidad"
              value={vehicleFilter}
              onChange={(event) => setVehicleFilter(event.target.value)}
            >
              <option value="all">Todas las unidades</option>
              <option value="bus">Autobuses</option>
              <option value="truck">Sprinter</option>
            </select>
          )}
        </div>
        <div className="catalog-records">
          {section === "materials" &&
            data.products
              .filter((item) => matches(`${item.sku} ${item.name}`))
              .map((product) => (
                <article className="catalog-record" key={product.id}>
                  <span className="service-icon">
                    <Package size={21} />
                  </span>
                  <div className="catalog-record-info">
                    <small>
                      {product.sku} ·{" "}
                      {product.unit === "pza" ? "Pieza" : "Litro"}
                    </small>
                    <h3>{product.name}</h3>
                    <p>{product.description || "Sin descripción adicional"}</p>
                    <div className="catalog-metrics">
                      <span>
                        Existencia calculada:{" "}
                        <strong>
                          {(
                            stockBalances?.[product.id] ?? stock(product)
                          ).toLocaleString("es-MX", {
                            maximumFractionDigits: 3,
                          })}{" "}
                          {product.unit}
                        </strong>
                      </span>
                      <span>
                        Último costo: <strong>{currency(product.cost)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="catalog-record-actions">
                    <button
                      className="text-button"
                      onClick={() =>
                        setEditor({ kind: "entry", id: product.id })
                      }
                    >
                      <Plus size={14} />
                      Registrar entrada
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        setEditor({ kind: "history", id: product.id })
                      }
                    >
                      <Eye size={14} />
                      Historial
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Editar artículo ${product.name}`}
                      onClick={() =>
                        setEditor({ kind: "materials", id: product.id })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </article>
              ))}
          {section === "vehicles" &&
            data.vehicles
              .filter(
                (item) =>
                  matches(
                    `${item.fleetNumber} ${item.brand} ${item.model} ${item.plate}`,
                  ) &&
                  (vehicleFilter === "all" || item.type === vehicleFilter),
              )
              .map((vehicle) => (
                <article className="catalog-record" key={vehicle.id}>
                  <span className="service-icon">
                    <BusFront size={23} />
                  </span>
                  <div className="catalog-record-info">
                    <small>
                      {vehicleTypeLabel(vehicle.type).toLocaleUpperCase("es")} ·{" "}
                      {vehicle.plate || "Sin placas capturadas"}
                    </small>
                    <h3>
                      {onOpenVehicle ? (
                        <button
                          className="order-title-button"
                          onClick={() => onOpenVehicle(vehicle)}
                        >
                          {vehicle.fleetNumber} · Ver historial
                        </button>
                      ) : (
                        vehicle.fleetNumber
                      )}
                    </h3>
                    <p>
                      {vehicle.brand} ·{" "}
                      {vehicle.model || "Modelo sin especificar"}{" "}
                      {vehicle.year ? `· ${vehicle.year}` : ""}
                    </p>
                    <div className="catalog-metrics">
                      <span>{vehicle.odometer.toLocaleString("es-MX")} km</span>
                      <span>VIN: {vehicle.vin || "Sin capturar"}</span>
                    </div>
                  </div>
                  <span className="badge neutral">
                    Condición técnica sin verificar
                  </span>
                  {canEdit && (
                    <button
                      className="icon-button"
                      aria-label={`Editar unidad ${vehicle.fleetNumber}`}
                      onClick={() =>
                        setEditor({ kind: "vehicles", id: vehicle.id })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </article>
              ))}
          {section === "services" &&
            data.services
              .filter((item) => matches(`${item.name} ${item.category}`))
              .map((service) => (
                <article className="catalog-record" key={service.id}>
                  <span className="service-icon">
                    <Wrench size={21} />
                  </span>
                  <div className="catalog-record-info">
                    <small>
                      {service.category || "Sin categoría"} · {service.hours} h
                      estimadas
                    </small>
                    <h3>{service.name}</h3>
                    <p>
                      {service.description || "Sin instrucciones adicionales"}
                    </p>
                    <div className="catalog-metrics">
                      <span>
                        {service.materials.length} artículos previstos
                      </span>
                      <span>
                        {service.compatibleVehicleIds.length
                          ? `${service.compatibleVehicleIds.length} unidades compatibles`
                          : "Todas las unidades"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge ${service.id === "oil-change" ? "green" : "neutral"}`}
                  >
                    {service.id === "oil-change"
                      ? "Único preventivo · CAF"
                      : "Correctivo"}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Editar servicio ${service.name}`}
                    onClick={() =>
                      setEditor({ kind: "services", id: service.id })
                    }
                  >
                    <Pencil size={16} />
                  </button>
                </article>
              ))}
          {section === "reviews" &&
            data.reviews
              .filter((item) => matches(item.name))
              .map((review) => (
                <article className="catalog-record" key={review.id}>
                  <span className="service-icon">
                    <ClipboardList size={21} />
                  </span>
                  <div className="catalog-record-info">
                    <small>
                      {reviewFrequency(review)} · Versión {review.version}
                    </small>
                    <h3>{review.name}</h3>
                    <p>
                      {review.aspects.length
                        ? `${review.aspects.length} aspectos · Bien / Con falla`
                        : "Sin aspectos definidos. Agrega los que indique la operación."}
                    </p>
                  </div>
                  <div className="catalog-record-actions">
                    <button
                      className="text-button"
                      disabled={!review.aspects.length}
                      onClick={() =>
                        setEditor({ kind: "preview", id: review.id })
                      }
                    >
                      <Eye size={14} />
                      Probar formato
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Editar revisión ${review.name}`}
                      onClick={() =>
                        setEditor({ kind: "reviews", id: review.id })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </article>
              ))}
        </div>
        <p className="section-footnote">
          {section === "materials"
            ? "Existencia = entradas menos entregas confirmadas más devoluciones. Movimientos guardados en el servidor; valoración contable avanzada pendiente."
            : section === "reviews"
              ? "Las plantillas no generan revisiones realizadas ni autorizan circulación. Las opciones Bien / Con falla son excluyentes."
              : "Altas y cambios confirmados por el servidor. Los permisos se validan antes de guardar en PostgreSQL."}
        </p>
      </section>
      {editor?.kind === "materials" && (
        <Modal
          title={editor.id ? "Editar artículo" : "Nuevo artículo de almacén"}
          onClose={close}
        >
          <ProductEditor
            product={selectedProduct}
            onCommit={onCommit}
            onDone={close}
          />
        </Modal>
      )}
      {editor?.kind === "entry" && selectedProduct && (
        <Modal title={`Entrada · ${selectedProduct.name}`} onClose={close}>
          <EntryEditor
            product={selectedProduct}
            onCommit={onCommit}
            onDone={close}
          />
        </Modal>
      )}
      {editor?.kind === "history" && selectedProduct && (
        <Modal title={`Entradas · ${selectedProduct.name}`} onClose={close}>
          <p className="modal-description">
            Fechas efectivas y de captura. Se conserva el costo unitario de cada
            entrada. Referencias de comprobante, sin archivos adjuntos.
          </p>
          {!selectedProduct.entries.length && (
            <p className="no-results">
              Aún no hay entradas registradas para este artículo.
            </p>
          )}
          {[...selectedProduct.entries].reverse().map((entry) => (
            <div className="stock-history" key={entry.id}>
              <strong>
                {entry.quantity} {selectedProduct.unit} ·{" "}
                {currency(entry.unitCost)} por {selectedProduct.unit}
              </strong>
              <span>
                Fecha de entrada: {entry.occurredOn} · Total:{" "}
                {currency(entry.quantity * entry.unitCost)}
              </span>
              <span>
                Proveedor: {entry.supplier || "Sin capturar"} · Comprobante:{" "}
                {entry.receiptReference || "Sin referencia"}
              </span>
              <small>
                Captura: {new Date(entry.createdAt).toLocaleString("es-MX")}
              </small>
            </div>
          ))}
        </Modal>
      )}
      {editor?.kind === "vehicles" && (
        <Modal
          title={editor.id ? "Editar unidad" : "Nueva unidad"}
          onClose={close}
        >
          <VehicleEditor
            vehicle={data.vehicles.find((item) => item.id === editor.id)}
            onCommit={onCommit}
            onDone={close}
          />
        </Modal>
      )}
      {editor?.kind === "services" && (
        <Modal
          title={
            editor.id ? "Editar tipo de servicio" : "Nuevo tipo de servicio"
          }
          onClose={close}
        >
          <ServiceEditor
            service={data.services.find((item) => item.id === editor.id)}
            data={data}
            onCommit={onCommit}
            onDone={close}
          />
        </Modal>
      )}
      {editor?.kind === "reviews" && (
        <Modal
          title={
            editor.id ? "Editar tipo de revisión" : "Nuevo tipo de revisión"
          }
          onClose={close}
        >
          <ReviewEditor
            review={data.reviews.find((item) => item.id === editor.id)}
            onCommit={onCommit}
            onDone={close}
          />
        </Modal>
      )}
      {editor?.kind === "preview" && (
        <ReviewPreview
          review={data.reviews.find((item) => item.id === editor.id)!}
          onClose={close}
        />
      )}
    </>
  );
}

function EntryFields({
  product,
  unit: initialUnit = "pza",
}: {
  product?: Product;
  unit?: Product["unit"];
}) {
  const unit = product?.unit ?? initialUnit;
  const [quantity, setQuantity] = useState(product ? "" : "0");
  const [unitCost, setUnitCost] = useState(String(product?.cost ?? 0));
  const total = Number(quantity) * Number(unitCost);
  return (
    <>
      <label className="field">
        Cantidad {product ? `(${product.unit})` : "inicial"}
        <input
          name="quantity"
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
          min={product ? (unit === "pza" ? "1" : "0.001") : "0"}
          step={unit === "pza" ? "1" : "0.001"}
        />
      </label>
      <label className="field">
        Costo unitario (MXN por {unit === "L" ? "litro" : "pieza"})
        <input
          name="unitCost"
          type="number"
          value={unitCost}
          onChange={(event) => setUnitCost(event.target.value)}
          min="0"
          step="0.01"
          required
        />
        <small>
          Precio de una sola {unit === "L" ? "unidad de litro" : "pieza"}, no el
          importe total.
        </small>
      </label>
      <div className="entry-total field full">
        <span>Valor total de esta entrada</span>
        <output aria-label="Valor total de la entrada">
          {Number.isFinite(total) && total >= 0
            ? currency(total)
            : "Revisa cantidad y costo"}
        </output>
        <small>
          {quantity || "0"} {unit} ×{" "}
          {Number.isFinite(Number(unitCost)) ? currency(Number(unitCost)) : "—"}{" "}
          por {unit} ={" "}
          {Number.isFinite(total) && total >= 0 ? currency(total) : "—"}. Se
          conservan cantidad y costo unitario en el historial.
        </small>
      </div>
      <label className="field">
        Fecha de entrada
        <input name="occurredOn" type="date" defaultValue={today()} required />
      </label>
      <label className="field">
        Proveedor
        <input
          name="supplier"
          maxLength={150}
          placeholder="Nombre del proveedor (opcional)"
        />
      </label>
      <label className="field full">
        Referencia del comprobante
        <input
          name="receiptReference"
          maxLength={200}
          placeholder="Folio de factura o ticket (opcional)"
        />
        <small>
          Solo referencia de texto. Adjuntar archivos se implementará después.
        </small>
      </label>
    </>
  );
}
function entryInput(fields: FormData): EntryInput {
  return {
    quantity: Number(text(fields, "quantity")),
    unitCost: Number(text(fields, "unitCost")),
    occurredOn: text(fields, "occurredOn"),
    supplier: text(fields, "supplier"),
    receiptReference: text(fields, "receiptReference"),
  };
}

function ProductEditor({
  product,
  onCommit,
  onDone,
}: {
  product?: Product;
  onCommit: CommitCatalogs;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [unit, setUnit] = useState<Product["unit"]>(product?.unit ?? "pza");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const message = await onCommit(
      (data) =>
        saveProduct(
          data,
          {
            sku: text(fields, "sku"),
            name: text(fields, "name"),
            description: text(fields, "description"),
            unit: text(fields, "unit") as Product["unit"],
          },
          product
            ? {
                quantity: 0,
                unitCost: product.cost,
                occurredOn: "",
                supplier: "",
                receiptReference: "",
              }
            : entryInput(fields),
          product?.id,
        ),
      product
        ? "Artículo actualizado en PostgreSQL."
        : "Artículo registrado en PostgreSQL.",
    );
    if (message) setError(message);
    else onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        Por ahora no se utilizan categorías de artículos.
      </p>
      <FormError message={error} />
      <div className="field-grid">
        <label className="field">
          Código del artículo *
          <input
            name="sku"
            required
            maxLength={40}
            defaultValue={product?.sku}
            placeholder="Ej. REF-005"
          />
        </label>
        <label className="field">
          Unidad de medida *
          <select
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value as Product["unit"])}
            disabled={Boolean(product)}
          >
            <option value="pza">Pieza</option>
            <option value="L">Litro</option>
          </select>
          {product && <input type="hidden" name="unit" value={product.unit} />}
        </label>
        <label className="field full">
          Nombre del artículo *
          <input
            name="name"
            required
            maxLength={150}
            defaultValue={product?.name}
          />
        </label>
        <label className="field full">
          Descripción
          <textarea
            name="description"
            rows={2}
            maxLength={2000}
            defaultValue={product?.description}
          />
        </label>
      </div>
      {!product ? (
        <>
          <h3>Entrada inicial opcional</h3>
          <p className="modal-description">
            Cantidad 0 da de alta solo el artículo. Las entradas con cantidad
            conservan fecha, costo y proveedor.
          </p>
          <div className="field-grid">
            <EntryFields unit={unit} />
          </div>
        </>
      ) : (
        <p className="modal-note">
          La unidad queda fija para proteger cantidades históricas. Para sumar
          existencias o actualizar el último costo, registra una nueva entrada.
        </p>
      )}
      <FormActions onCancel={onDone} />
    </form>
  );
}

function EntryEditor({
  product,
  onCommit,
  onDone,
}: {
  product: Product;
  onCommit: CommitCatalogs;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = entryInput(new FormData(event.currentTarget));
    const message = await onCommit(
      (data) => addStockEntry(data, product.id, input),
      "Entrada guardada con su costo histórico en PostgreSQL.",
    );
    if (message) setError(message);
    else onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        Código {product.sku} · Unidad:{" "}
        {product.unit === "pza"
          ? "pieza, cantidades enteras"
          : "litro, admite decimales"}
        .
      </p>
      <FormError message={error} />
      <div className="field-grid">
        <EntryFields product={product} />
      </div>
      <FormActions onCancel={onDone} label="Registrar entrada" />
    </form>
  );
}

function VehicleEditor({
  vehicle,
  onCommit,
  onDone,
}: {
  vehicle?: Vehicle;
  onCommit: CommitCatalogs;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const input: Omit<Vehicle, "id"> = {
      fleetNumber: text(fields, "fleetNumber"),
      type: text(fields, "type") as Vehicle["type"],
      brand: text(fields, "brand"),
      model: text(fields, "model"),
      plate: text(fields, "plate"),
      vin: text(fields, "vin"),
      year: text(fields, "year") ? Number(text(fields, "year")) : null,
      odometer: Number(text(fields, "odometer")),
      note: text(fields, "note"),
    };
    const message = await onCommit(
      (data) => saveVehicle(data, input, vehicle?.id),
      "Unidad guardada en PostgreSQL, sin autorización de circulación.",
    );
    if (message) setError(message);
    else onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        Autobús y Sprinter son unidades de pasajeros. Número económico, placas y
        VIN no deben duplicarse entre unidades.
      </p>
      <FormError message={error} />
      <div className="field-grid">
        <label className="field">
          Tipo de unidad *
          <select name="type" defaultValue={vehicle?.type ?? "bus"}>
            <option value="bus">Autobús</option>
            <option value="truck">Sprinter</option>
          </select>
        </label>
        <label className="field">
          Número económico *
          <input
            name="fleetNumber"
            maxLength={30}
            required
            defaultValue={vehicle?.fleetNumber}
            placeholder="Ej. CAM001"
          />
        </label>
        <label className="field">
          Marca
          <input name="brand" maxLength={80} defaultValue={vehicle?.brand} />
        </label>
        <label className="field">
          Modelo
          <input name="model" maxLength={80} defaultValue={vehicle?.model} />
        </label>
        <label className="field">
          Año
          <input
            name="year"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            defaultValue={vehicle?.year ?? ""}
          />
        </label>
        <label className="field">
          Placas
          <input name="plate" maxLength={30} defaultValue={vehicle?.plate} />
        </label>
        <label className="field full">
          VIN / número de serie
          <input
            name="vin"
            maxLength={17}
            minLength={17}
            defaultValue={vehicle?.vin}
          />
          <small>
            Opcional. Si se captura, debe tener 17 caracteres válidos.
          </small>
        </label>
        <label className="field">
          Odómetro (km) *
          <input
            name="odometer"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={vehicle?.odometer}
          />
        </label>
        <label className="field full">
          Observaciones
          <textarea
            name="note"
            maxLength={2000}
            rows={2}
            defaultValue={vehicle?.note}
          />
          <small>
            Estas observaciones no sustituyen las incidencias ni una decisión
            técnica.
          </small>
        </label>
      </div>
      <FormActions onCancel={onDone} />
    </form>
  );
}

function ServiceEditor({
  service,
  data,
  onCommit,
  onDone,
  onCreated,
}: {
  service?: CatalogService;
  data: Catalogs;
  onCommit: CommitCatalogs;
  onDone: () => void;
  onCreated?: (service: CatalogService) => void;
}) {
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState(service?.materials ?? []);
  const [compatible, setCompatible] = useState(
    service?.compatibleVehicleIds ?? [],
  );
  const [picker, setPicker] = useState<
    { mode: "add" } | { mode: "replace"; index: number } | null
  >(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    let savedService: CatalogService | undefined;
    const message = await onCommit((latest) => {
      const next = saveService(
        latest,
        {
          name: text(fields, "name"),
          category: text(fields, "category"),
          hours: Number(text(fields, "hours")),
          description: text(fields, "description"),
          materials,
          compatibleVehicleIds: compatible,
        },
        service?.id,
      );
      savedService = service
        ? next.services.find((item) => item.id === service.id)
        : next.services.at(-1);
      return next;
    }, "Tipo de servicio guardado. Disponible para nuevas órdenes; no cambia las ya creadas.");
    if (message) setError(message);
    else if (onCreated && savedService) onCreated(savedService);
    else onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        {service?.id === "oil-change"
          ? "CAF es el único preventivo. Puedes ajustar instrucciones, tiempo, compatibilidad y materiales."
          : "Los nuevos servicios son correctivos. CAF ya está disponible como único preventivo."}
      </p>
      <FormError message={error} />
      <div className="field-grid">
        <label className="field full">
          Nombre del servicio *
          <input
            name="name"
            maxLength={150}
            required
            defaultValue={service?.name}
            readOnly={service?.id === "oil-change"}
          />
        </label>
        <label className="field">
          Categoría del servicio
          <input
            name="category"
            maxLength={80}
            defaultValue={service?.category}
            placeholder="Ej. Motor, frenos, electricidad"
          />
        </label>
        <label className="field">
          Tiempo estimado (horas) *
          <input
            name="hours"
            type="number"
            required
            min="0.25"
            step="0.25"
            defaultValue={service?.hours ?? 1}
          />
        </label>
        <label className="field full">
          Descripción e instrucciones
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={service?.description}
          />
        </label>
      </div>
      <h3>Materiales necesarios</h3>
      <div className="definition-materials">
        {materials.map((material, index) => (
          <div className="definition-material-row" key={index}>
            <label className="field material-definition-article">
              Artículo
              <input
                aria-label={`Artículo previsto ${index + 1}`}
                value={
                  data.products.find(
                    (product) => product.id === material.productId,
                  )?.name ?? "Artículo no disponible"
                }
                readOnly
              />
              <button
                type="button"
                className="text-button"
                onClick={() => setPicker({ mode: "replace", index })}
              >
                Cambiar artículo
              </button>
            </label>
            <div className="field material-definition-quantity">
              Cantidad
              <QuantityStepper
                label={`Cantidad prevista ${index + 1}`}
                unit={
                  data.products.find(
                    (product) => product.id === material.productId,
                  )?.unit ?? "pza"
                }
                value={material.quantity}
                onChange={(quantity) =>
                  setMaterials(
                    materials.map((item, row) =>
                      row === index ? { ...item, quantity } : item,
                    ),
                  )
                }
              />
              <small>
                {data.products.find(
                  (product) => product.id === material.productId,
                )?.unit === "L"
                  ? "Litros · pasos de 0.5"
                  : "Piezas · pasos de 1"}
              </small>
            </div>
            <button
              type="button"
              className="icon-button delete"
              aria-label={`Quitar material previsto ${index + 1}`}
              onClick={() =>
                setMaterials(materials.filter((_, row) => row !== index))
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="add-service"
        disabled={!data.products.length}
        onClick={() => setPicker({ mode: "add" })}
      >
        <Plus size={15} />
        Agregar material necesario
      </button>
      <h3>Compatibilidad de unidad</h3>
      <p className="modal-description">
        Sin selección = todas las unidades. Seleccionar unidades restringe el
        servicio a ellas.
      </p>
      <div className="compatibility-list">
        {data.vehicles.map((vehicle) => (
          <label key={vehicle.id}>
            <input
              type="checkbox"
              checked={compatible.includes(vehicle.id)}
              onChange={(event) =>
                setCompatible(
                  event.target.checked
                    ? [...compatible, vehicle.id]
                    : compatible.filter((id) => id !== vehicle.id),
                )
              }
            />
            {vehicle.fleetNumber} · {vehicleTypeLabel(vehicle.type)}
          </label>
        ))}
      </div>
      <FormActions onCancel={onDone} />
      {picker && (
        <MaterialPicker
          products={data.products}
          excludedIds={materials
            .filter(
              (_, index) => picker.mode !== "replace" || index !== picker.index,
            )
            .map((material) => material.productId)}
          multiple={picker.mode === "add"}
          onClose={() => setPicker(null)}
          onConfirm={(selection) => {
            if (picker.mode === "add")
              setMaterials([
                ...materials,
                ...selection
                  .filter(
                    (product) =>
                      !materials.some(
                        (material) => material.productId === product.id,
                      ),
                  )
                  .map((product) => ({ productId: product.id, quantity: 1 })),
              ]);
            else if (selection[0])
              setMaterials(
                materials.map((material, index) =>
                  index === picker.index
                    ? { ...material, productId: selection[0].id }
                    : material,
                ),
              );
            setPicker(null);
          }}
        />
      )}
    </form>
  );
}

export function ServiceCreationPage({
  data,
  onCommit,
  onCancel,
  onCreated,
}: {
  data: Catalogs;
  onCommit: CommitCatalogs;
  onCancel: () => void;
  onCreated: (service: CatalogService) => void;
}) {
  return (
    <section className="card contextual-service-page">
      <div className="section-heading">
        <div>
          <h2>Crear servicio para la orden en edición</h2>
          <p>
            Se conserva la orden. Al guardar regresarás a ella con este servicio
            agregado, si es compatible.
          </p>
        </div>
        <button type="button" className="button secondary" onClick={onCancel}>
          Volver a la orden
        </button>
      </div>
      <ServiceEditor
        data={data}
        onCommit={onCommit}
        onDone={onCancel}
        onCreated={onCreated}
      />
    </section>
  );
}

function ReviewEditor({
  review,
  onCommit,
  onDone,
}: {
  review?: ReviewType;
  onCommit: CommitCatalogs;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [frequency, setFrequency] = useState<ReviewType["frequency"]>(
    review?.frequency ?? "days",
  );
  const [aspects, setAspects] = useState<ReviewAspect[]>(
    review?.aspects.length
      ? review.aspects
      : [{ id: crypto.randomUUID(), text: "" }],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const message = await onCommit(
      (data) =>
        saveReview(
          data,
          {
            name: text(fields, "name"),
            description: text(fields, "description"),
            frequency,
            intervalDays:
              frequency === "days"
                ? Number(text(fields, "intervalDays"))
                : null,
            aspects,
          },
          review?.id,
        ),
      "Tipo de revisión guardado con sus aspectos. No se registró una revisión realizada.",
    );
    if (message) setError(message);
    else onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        Escribe los aspectos que indique la operación. Cada uno se evaluará como
        Bien o Con falla, nunca ambos.
      </p>
      <FormError message={error} />
      <div className="field-grid">
        <label className="field full">
          Nombre de la revisión *
          <input
            name="name"
            maxLength={150}
            required
            defaultValue={review?.name}
          />
        </label>
        <label className="field">
          Periodicidad
          <select
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as ReviewType["frequency"])
            }
          >
            <option value="days">Cada cierto número de días</option>
            <option value="yearly">Anual</option>
            <option value="trip">Cada viaje</option>
          </select>
        </label>
        {frequency === "days" && (
          <label className="field">
            Intervalo (días) *
            <input
              name="intervalDays"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={review?.intervalDays ?? ""}
            />
          </label>
        )}
        <label className="field full">
          Instrucciones de la revisión
          <textarea
            name="description"
            rows={2}
            maxLength={2000}
            defaultValue={review?.description}
          />
        </label>
      </div>
      <h3>Aspectos a evaluar</h3>
      <div className="aspect-editor-head">
        <span>Aspecto</span>
        <span>Bien</span>
        <span>Con falla</span>
        <span />
      </div>
      <div className="aspect-editor">
        {aspects.map((aspect, index) => (
          <div className="aspect-editor-row" key={aspect.id}>
            <input
              aria-label={`Aspecto ${index + 1}`}
              maxLength={300}
              required
              placeholder="Escribe qué se debe evaluar"
              value={aspect.text}
              onChange={(event) =>
                setAspects(
                  aspects.map((item) =>
                    item.id === aspect.id
                      ? { ...item, text: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <span
              className="checkbox-outline"
              aria-label="Opción Bien del formato"
            />
            <span
              className="checkbox-outline"
              aria-label="Opción Con falla del formato"
            />
            <button
              type="button"
              className="icon-button delete"
              aria-label={`Quitar aspecto ${index + 1}`}
              onClick={() =>
                setAspects(aspects.filter((item) => item.id !== aspect.id))
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="add-service"
        onClick={() =>
          setAspects([...aspects, { id: crypto.randomUUID(), text: "" }])
        }
      >
        <Plus size={15} />
        Agregar aspecto
      </button>
      <p className="modal-note">
        Aquí se define la plantilla. Después de guardar, usa «Probar formato»
        para marcar las opciones sin registrar una inspección real.
      </p>
      <FormActions onCancel={onDone} />
    </form>
  );
}

function ReviewPreview({
  review,
  onClose,
}: {
  review: ReviewType;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, "good" | "fault">>({});
  return (
    <Modal title={`Probar formato · ${review.name}`} onClose={onClose}>
      <p className="modal-description">
        Prueba sin guardar resultados. {reviewFrequency(review)} · Versión{" "}
        {review.version}. Cada aspecto admite solo una respuesta.
      </p>
      {review.description && (
        <p className="modal-description">{review.description}</p>
      )}
      <div className="review-answer-list">
        {review.aspects.map((aspect) => (
          <fieldset key={aspect.id} className="review-answer">
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
                    name={`answer-${aspect.id}`}
                    value={value}
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
      <div className="preview-total">
        <span>Aspectos respondidos</span>
        <strong>
          {Object.keys(answers).length} / {review.aspects.length}
        </strong>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={() => setAnswers({})}>
          Limpiar respuestas
        </button>
        <button className="button primary" onClick={onClose}>
          Cerrar prueba
        </button>
      </div>
    </Modal>
  );
}
