import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  BusFront,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { login, type AuthSession } from "../auth";

export function Login({
  onLogin,
  initialError = "",
}: {
  onLogin: (session: AuthSession) => void;
  initialError?: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const missingUsername = submitted && !username.trim();
  const missingPassword = submitted && !password;
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    if (!username.trim() || !password) {
      setError("Escribe tu usuario y contraseña.");
      errorRef.current?.focus();
      return;
    }
    setPending(true);
    setError("");
    try {
      const authenticated = await login(username.trim(), password);
      setPassword("");
      onLogin(authenticated);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="login-page">
      <aside className="login-story" aria-label="Real Ejecutivo">
        <a className="brand" href="#">
          <span className="brand-symbol">
            <ArrowDownLeft size={31} strokeWidth={3} aria-hidden="true" />
          </span>
          <span>
            REAL EJECUTIVO<small>CONTROL DE MANTENIMIENTO</small>
          </span>
        </a>
        <div className="login-story-content">
          <span className="eyebrow">EL TALLER, CONECTADO</span>
          <h1>
            Cuidamos cada unidad.
            <br />
            <em>Seguimos en movimiento.</em>
          </h1>
          <p>
            Un solo espacio para organizar el mantenimiento, comunicar lo que
            necesita atención y preparar el trabajo de tu equipo.
          </p>
          <div className="login-fleet" aria-hidden="true">
            <BusFront size={108} strokeWidth={0.8} />
            <div className="fleet-line" />
          </div>
          <div className="login-story-bottom">
            <span>
              <ShieldCheck size={18} aria-hidden="true" /> Acceso por usuario y rol
            </span>
            <span>Real Ejecutivo · Mantenimiento de flota</span>
          </div>
        </div>
      </aside>
      <main className="login-main">
        <div className="login-card">
          <span className="login-key" aria-hidden="true">
            <KeyRound size={25} />
          </span>
          <div className="eyebrow">BIENVENIDO A TU ESPACIO</div>
          <h2>Inicia sesión</h2>
          <p className="login-description">
            Accede con el usuario asignado para tu operación.
          </p>
          <form onSubmit={submit} noValidate aria-busy={pending}>
            {(error || initialError) && (
              <div
                ref={errorRef}
                className="notice error login-error"
                role="alert"
                tabIndex={-1}
              >
                <div>
                  <strong>No se pudo iniciar sesión</strong>
                  <p>{error || initialError}</p>
                  {(missingUsername || missingPassword) && (
                    <ul>
                      {missingUsername && (
                        <li>
                          <a href="#login-username">
                            Escribe tu nombre de usuario.
                          </a>
                        </li>
                      )}
                      {missingPassword && (
                        <li>
                          <a href="#login-password">Escribe tu contraseña.</a>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            )}
            <div className="field-grid">
              <label className="field full">
                Nombre de usuario
                <div className="input-icon">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    id="login-username"
                    aria-invalid={missingUsername || undefined}
                    aria-describedby={
                      missingUsername
                        ? "login-username-help login-username-error"
                        : "login-username-help"
                    }
                    name="username"
                    aria-label="Nombre de usuario"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={80}
                    required
                    placeholder="Ej. mecanico.prueba.com"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={pending}
                  />
                </div>
                <small id="login-username-help">
                  Es un nombre de usuario, no una dirección de correo.
                </small>
                {missingUsername && (
                  <small
                    id="login-username-error"
                    className="login-field-error"
                  >
                    Escribe tu nombre de usuario.
                  </small>
                )}
              </label>
              <label className="field full">
                Contraseña
                <div className="input-icon password-input">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="login-password"
                    aria-invalid={missingPassword || undefined}
                    aria-describedby={
                      missingPassword ? "login-password-error" : undefined
                    }
                    name="password"
                    aria-label="Contraseña"
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    maxLength={128}
                    required
                    placeholder="Escribe tu contraseña"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
                {missingPassword && (
                  <small
                    id="login-password-error"
                    className="login-field-error"
                  >
                    Escribe tu contraseña.
                  </small>
                )}
              </label>
            </div>
            <button
              type="submit"
              className="button primary login-submit"
              disabled={pending}
            >
              {pending ? "Verificando acceso…" : "Entrar a mi espacio"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>
          <div className="login-security">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              Tu perfil lo determina el servidor. La sesión utiliza una cookie
              protegida; no se guarda una contraseña en el navegador.
            </p>
          </div>
          <div className="login-mvp-note">
            <span className="tiny-dot" />
            <span>MVP de pruebas · No utilizar con datos sensibles</span>
          </div>
        </div>
        <footer className="login-footer">
          REAL EJECUTIVO <span>/</span> Más control. Menos tiempo fuera de
          servicio.
        </footer>
      </main>
    </div>
  );
}
