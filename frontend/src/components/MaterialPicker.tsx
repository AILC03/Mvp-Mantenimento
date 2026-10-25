import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Package, Search } from "lucide-react";
import { currency, type Product } from "../data";
import { stock } from "../catalogs";
import { Modal } from "./Modal";

export const MATERIAL_PAGE_SIZE = 20;
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();

export function MaterialPicker({
  products,
  excludedIds,
  multiple = true,
  onConfirm,
  onClose,
  balances,
}: {
  products: Product[];
  excludedIds: string[];
  multiple?: boolean;
  onConfirm: (selected: Product[]) => void;
  onClose: () => void;
  balances?: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const excluded = new Set(excludedIds);
  const results = useMemo(() => {
    const words = normalizeSearch(deferredQuery).split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      const searchable = normalizeSearch(`${product.name} ${product.sku}`);
      return words.every((word) => searchable.includes(word));
    });
  }, [products, deferredQuery]);
  const pages = Math.max(1, Math.ceil(results.length / MATERIAL_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = results.slice(
    currentPage * MATERIAL_PAGE_SIZE,
    (currentPage + 1) * MATERIAL_PAGE_SIZE,
  );
  return (
    <Modal title="Seleccionar materiales de almacén" onClose={onClose}>
      <p className="modal-description">
        Busca por nombre o código. Solo se muestran {MATERIAL_PAGE_SIZE}{" "}
        artículos por página, sin cargar miles de opciones en un selector.
      </p>
      <div className="input-icon search-field">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Buscar material por nombre o código"
          placeholder="Ej. aceite, filtro, REF-005…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </div>
      <div className="picker-status">
        <span>{results.length.toLocaleString("es-MX")} resultados</span>
        <span>{selected.length} seleccionados</span>
      </div>
      <div
        className="warehouse-picker-list"
        aria-busy={query !== deferredQuery}
      >
        {visible.map((product) => {
          const alreadyAdded = excluded.has(product.id);
          const checked =
            (multiple && alreadyAdded) || selected.includes(product.id);
          return (
            <label
              className={`warehouse-picker-row ${checked ? "selected" : ""} ${alreadyAdded ? "already-added" : ""}`}
              key={product.id}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name="warehouse-selection"
                aria-label={`Seleccionar ${product.name}`}
                checked={checked}
                disabled={alreadyAdded}
                onChange={(event) =>
                  setSelected(
                    multiple
                      ? event.target.checked
                        ? [...selected, product.id]
                        : selected.filter((id) => id !== product.id)
                      : [product.id],
                  )
                }
              />
              <span className="service-icon">
                <Package size={18} />
              </span>
              <span className="picker-product">
                <strong>{product.name}</strong>
                <small>
                  {product.sku} · {product.unit === "pza" ? "Pieza" : "Litro"}
                </small>
                <small>
                  {balances ? "Disponible: " : "Entradas registradas: "}
                  {(balances?.[product.id] ?? stock(product)).toLocaleString(
                    "es-MX",
                    {
                      maximumFractionDigits: 3,
                    },
                  )}{" "}
                  {product.unit}
                </small>
              </span>
              <span className="picker-cost">
                {alreadyAdded ? "Agregado" : currency(product.cost)}
                <small>
                  {alreadyAdded
                    ? "Ajusta su cantidad en el servicio"
                    : `Referencia / ${product.unit}`}
                </small>
              </span>
            </label>
          );
        })}
        {!visible.length && (
          <div className="empty-state picker-empty">
            <Search size={28} />
            <h3>Sin resultados</h3>
            <p>Prueba otro nombre o código del almacén.</p>
          </div>
        )}
      </div>
      <div className="picker-pagination">
        <button
          type="button"
          className="button secondary"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          <ArrowLeft size={14} />
          Anterior
        </button>
        <span>
          Página {currentPage + 1} de {pages}
        </span>
        <button
          type="button"
          className="button secondary"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Siguiente
          <ArrowRight size={14} />
        </button>
      </div>
      <p className="section-footnote">
        Seleccionar materiales no reserva ni descuenta existencias. Se consulta
        el catálogo cargado del servidor; recarga para ver cambios de otros
        usuarios.
      </p>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancelar selección
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!selected.length}
          onClick={() =>
            onConfirm(
              products.filter(
                (product) =>
                  selected.includes(product.id) && !excluded.has(product.id),
              ),
            )
          }
        >
          <Check size={15} />
          {multiple
            ? `Agregar selección (${selected.length})`
            : "Usar artículo seleccionado"}
        </button>
      </div>
    </Modal>
  );
}
