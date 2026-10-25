import { useEffect, useState } from "react";
import { ApiError, getSession, logout, type AuthSession } from "./auth";
import { Login } from "./components/Login";
import { OperationsWorkspace } from "./OperationsWorkspace";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getSession(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSession(value);
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof ApiError && error.status === 401)
        )
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo comprobar la sesión.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!session) {
      document.title = "Iniciar sesión · Real Ejecutivo";
      return;
    }
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = window.setTimeout(
      () => {
        setSession(null);
        setError("Tu sesión ha expirado. Inicia sesión nuevamente.");
      },
      Math.max(remaining, 0),
    );
    return () => window.clearTimeout(timer);
  }, [session]);

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      await logout();
      setSession(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cerrar la sesión. Intenta nuevamente.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (checking)
    return (
      <div className="session-check" role="status">
        <span className="session-spinner" />
        Comprobando acceso…
      </div>
    );
  if (!session)
    return (
      <Login
        initialError={error}
        onLogin={(value) => {
          setError("");
          setSession(value);
        }}
      />
    );
  if (session.user.role === "TECHNICIAN")
    return (
      <div className="session-check">
        <p>El módulo de técnico está en preparación.</p>
        <button className="button secondary" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <OperationsWorkspace
      key={session.user.id}
      user={session.user}
      onLogout={signOut}
      signingOut={signingOut}
      authNotice={error}
    />
  );
}
