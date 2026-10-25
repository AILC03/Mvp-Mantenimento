import { useEffect, useState, useSyncExternalStore } from "react";
import Workbench from "./Workbench";
import {
  executeCommand,
  importOperations,
  isSaving,
  startOperations,
  stopOperations,
  subscribeSaving,
} from "./operations-client";
import {
  downloadBackup,
  readLegacy,
  readLegacyDraft,
  removeImportedLegacy,
  removeLegacyDraft,
} from "./legacy-import";
import { isOrderForm } from "./data";
import type { AuthUser } from "./auth";

export function OperationsWorkspace(props: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  signingOut?: boolean;
  authNotice?: string;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [panel, setPanel] = useState(false);
  const [legacy, setLegacy] = useState<ReturnType<typeof readLegacy> | null>(
    null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [imported, setImported] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = useSyncExternalStore(subscribeSaving, isSaving);
  useEffect(() => {
    const controller = new AbortController();
    void startOperations(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la operación.",
          );
      });
    return () => {
      controller.abort();
      stopOperations();
    };
  }, [props.user.id]);
  async function reload() {
    if (
      ready &&
      !window.confirm(
        "Recargar descartará los cambios no guardados del formulario. ¿Continuar?",
      )
    )
      return;
    setError("");
    try {
      await startOperations();
      setReady(true);
      setEpoch((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo recargar.");
    }
  }
  async function importLocal() {
    if (!legacy || !confirmed) return;
    setError("");
    try {
      await importOperations(legacy.state);
      setImported(true);
      setEpoch((n) => n + 1);
      setNotice(
        "Importación confirmada por el servidor. Los actores históricos se conservan como datos de origen, no como identidades verificadas. Los borradores deben trasladarse por usuario.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar.");
    }
  }
  async function importDraft() {
    try {
      const raw = readLegacyDraft(props.user.id);
      if (!raw)
        throw new Error(
          "No hay un borrador antiguo vinculado a tu usuario real. Los borradores demo no se atribuyen automáticamente.",
        );
      const form: unknown = JSON.parse(raw);
      if (!isOrderForm(form))
        throw new Error("El borrador no tiene un formato compatible.");
      if (
        !window.confirm(
          "¿Respaldar y trasladar tu borrador antiguo al servidor? Reemplazará únicamente tu borrador actual.",
        )
      )
        return;
      downloadBackup({ userId: props.user.id, draft: form });
      await executeCommand({ type: "draft.save", form });
      removeLegacyDraft(props.user.id, raw);
      setNotice(
        "Tu borrador se guardó en PostgreSQL y se retiró su copia local.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo importar el borrador.",
      );
    }
  }
  return (
    <>
      {!ready ? (
        <div className="session-check">
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <p role="status">Cargando datos desde PostgreSQL…</p>
          )}
          {error && (
            <button className="button primary" onClick={() => void reload()}>
              Reintentar carga
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => void props.onLogout()}
          >
            Cerrar sesión
          </button>
        </div>
      ) : (
        <div aria-busy={busy} inert={busy}>
          <Workbench key={`${props.user.id}-${epoch}`} {...props} />
        </div>
      )}
      {busy && (
        <div className="operations-saving" role="status">
          Guardando en el servidor… No cierres esta ventana.
        </div>
      )}
      {ready && (
        <aside className="server-tools" aria-label="Conexión y migración">
          <button
            type="button"
            onClick={() => setPanel(!panel)}
            aria-expanded={panel}
            aria-controls="server-tools-panel"
          >
            PostgreSQL · {busy ? "Guardando" : "Datos del servidor"} · Opciones
          </button>
          {panel && (
            <div id="server-tools-panel">
              <h2>Datos en el servidor</h2>
              <p>
                La operación y los borradores se guardan en PostgreSQL. No hay
                modo de guardado local.
              </p>
              <button onClick={() => void reload()} disabled={busy}>
                Recargar datos compartidos
              </button>
              {(props.user.role === "ADMIN" ||
                props.user.role === "LEAD_MECHANIC") && (
                <button onClick={() => void importDraft()} disabled={busy}>
                  Trasladar mi borrador antiguo
                </button>
              )}
              {props.user.role === "ADMIN" && (
                <>
                  <h3>Importación del prototipo anterior</h3>
                  <p>
                    Solo se permite sobre una operación todavía vacía. Se
                    conservan los IDs y vínculos; no se reemplazan registros
                    existentes.
                  </p>
                  <button
                    onClick={() => {
                      try {
                        const value = readLegacy();
                        setLegacy(value);
                        setImported(false);
                        setConfirmed(false);
                        downloadBackup({
                          ...value.state,
                          legacyDrafts: value.drafts,
                        });
                        setError("");
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "No se pudo leer el respaldo.",
                        );
                      }
                    }}
                  >
                    Revisar y descargar respaldo local
                  </button>
                  {legacy && (
                    <>
                      <p>
                        {legacy.state.catalogs.vehicles.length} unidades ·{" "}
                        {legacy.state.catalogs.products.length} artículos ·{" "}
                        {legacy.state.workbench.orders.length} órdenes ·{" "}
                        {legacy.state.workbench.requests.length} solicitudes ·{" "}
                        {legacy.state.trips.length} viajes.{" "}
                        {Object.keys(legacy.drafts).length} borradores
                        conservados en el respaldo.
                      </p>
                      <label>
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />{" "}
                        Revisé el respaldo descargado y confirmo importar los
                        registros históricos sin atribuirlos a usuarios reales.
                      </label>
                      <button
                        disabled={!confirmed || busy || imported}
                        onClick={() => void importLocal()}
                      >
                        Confirmar importación a PostgreSQL
                      </button>
                      {imported && (
                        <button
                          onClick={() => {
                            try {
                              if (
                                !window.confirm(
                                  "¿Retirar del navegador los registros operativos ya importados? Los borradores de otros usuarios no se borrarán.",
                                )
                              )
                                return;
                              removeImportedLegacy(legacy.originals);
                              setLegacy(null);
                              setNotice(
                                "Copias operativas locales retiradas. Conserva tu archivo de respaldo.",
                              );
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "No se pudo retirar la copia.",
                              );
                            }
                          }}
                        >
                          Retirar copias locales ya importadas
                        </button>
                      )}
                    </>
                  )}
                  <p>
                    Si había datos de prueba y no quieres importarlos, no
                    confirmes la importación. No se borrarán automáticamente.
                  </p>
                </>
              )}
              {notice && <p role="status">{notice}</p>}
            </div>
          )}
        </aside>
      )}
      {ready && error && (
        <div className="operations-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Cerrar aviso</button>
        </div>
      )}
    </>
  );
}
