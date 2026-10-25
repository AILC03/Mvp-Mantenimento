export type UserRole =
  | "ADMIN"
  | "LEAD_MECHANIC"
  | "WAREHOUSE_CLERK"
  | "DRIVER"
  | "TECHNICIAN";
export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};
export type AuthSession = { user: AuthUser; expiresAt: string };
export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  LEAD_MECHANIC: "Mecánico principal",
  WAREHOUSE_CLERK: "Almacén",
  DRIVER: "Chofer",
  TECHNICIAN: "Técnico",
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "No se pudo conectar con el backend. Verifica que esté iniciado.",
      0,
    );
  }
  if (response.status === 204) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "El servidor no devolvió una respuesta válida. Verifica el backend.",
      response.status,
    );
  }
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "No se pudo completar la solicitud.";
    throw new ApiError(
      response.status === 429
        ? "Demasiados intentos. Espera un minuto y vuelve a intentar."
        : response.status >= 500
          ? "El servicio no está disponible. Intenta nuevamente."
          : message,
      response.status,
    );
  }
  return body;
}

function session(value: unknown): AuthSession {
  if (!value || typeof value !== "object")
    throw new ApiError("Respuesta de sesión inválida.", 0);
  const data = value as Partial<AuthSession>;
  if (
    !data.user ||
    typeof data.user.id !== "string" ||
    typeof data.user.username !== "string" ||
    typeof data.user.name !== "string" ||
    !Object.hasOwn(roleLabels, data.user.role) ||
    typeof data.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(data.expiresAt)) ||
    Date.parse(data.expiresAt) <= Date.now()
  )
    throw new ApiError("Respuesta de sesión inválida o expirada.", 0);
  return data as AuthSession;
}

export const getSession = async (signal?: AbortSignal): Promise<AuthSession> =>
  session(await request("me", { signal }));
export const login = async (
  username: string,
  password: string,
): Promise<AuthSession> =>
  session(
    await request("login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  );
export const logout = async (): Promise<void> => {
  await request("logout", { method: "POST" });
};
