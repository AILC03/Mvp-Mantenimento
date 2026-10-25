import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { Login } from "./components/Login";
import { testUsers } from "./testing/WorkbenchHarness";
import { afterEach, beforeEach, vi } from "vitest";
import { defaultCatalogs } from "./catalogs";
import { setDomainStorage } from "../../shared/src/storage";

const operations = () => ({
  catalogs: defaultCatalogs(),
  workbench: { orders: [], requests: [] },
  trips: [],
  revision: 0,
  imported: false,
  draft: null,
});

const response = (status: number, body: unknown = null) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;
const session = (role: string) => ({
  user: testUsers[role],
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
});

test("login focuses validation summary and links missing fields without calling the API", async () => {
  const user = userEvent.setup();
  render(<Login onLogin={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Entrar a mi espacio" }));
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(
    screen.getByRole("link", { name: "Escribe tu nombre de usuario." }),
  ).toHaveAttribute("href", "#login-username");
  expect(screen.getByLabelText("Nombre de usuario")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(fetch).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "text");
  expect(
    screen.getByRole("button", { name: "Ocultar contraseña" }),
  ).toHaveAttribute("aria-pressed", "true");
});
beforeEach(() => {
  const memory = new Map<string, string>();
  setDomainStorage({
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response(200, operations())),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

test.each([
  ["mechanic", "Solicitudes de servicio"],
  ["driver", "Solicitar un servicio"],
  ["warehouse", "Artículos de almacén"],
  ["admin", "Solicitudes de servicio"],
])(
  "logs in as %s using the backend role without a profile selector",
  async (role, heading) => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401, { message: "Inicia sesión." }))
      .mockResolvedValueOnce(response(200, session(role)));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Inicia sesión" });
    await user.type(
      screen.getByLabelText("Nombre de usuario"),
      testUsers[role].username,
    );
    await user.type(screen.getByLabelText("Contraseña"), "PRUEBA123");
    await user.click(
      screen.getByRole("button", { name: "Entrar a mi espacio" }),
    );
    expect(
      await screen.findByRole("heading", { name: heading, level: 1 }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          username: testUsers[role].username,
          password: "PRUEBA123",
        }),
      }),
    );
    expect(
      screen.queryByLabelText("Perfil de demostración"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(testUsers[role].username)).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    if (role === "warehouse" || role === "driver")
      expect(
        screen.queryByRole("button", { name: "Tipos de servicio" }),
      ).not.toBeInTheDocument();
  },
);

test("rejects an incorrect password without entering the workspace", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(
      response(401, { message: "Usuario o contraseña incorrectos." }),
    );
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Inicia sesión" });
  await user.type(
    screen.getByLabelText("Nombre de usuario"),
    "mecanico.prueba.com",
  );
  await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
  await user.click(screen.getByRole("button", { name: "Entrar a mi espacio" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Usuario o contraseña incorrectos.",
  );
  expect(
    screen.queryByRole("button", { name: "Cerrar sesión" }),
  ).not.toBeInTheDocument();
});

test("restores a server session and logout returns to login", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(response(200, session("mechanic")))
    .mockResolvedValueOnce(response(200, operations()))
    .mockResolvedValueOnce(response(204));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", {
    name: "Solicitudes de servicio",
    level: 1,
  });
  await user.click(
    await screen.findByRole("button", { name: "Cerrar sesión" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Inicia sesión" }),
  ).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/auth/logout",
    expect.objectContaining({ method: "POST", credentials: "include" }),
  );
});

test("backend outage never enables a local demo login", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("Network unavailable"));
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Inicia sesión" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No se pudo conectar con el backend",
  );
  expect(
    screen.queryByRole("button", { name: "Nueva orden" }),
  ).not.toBeInTheDocument();
});

test("an expired server session does not expose the workspace", async () => {
  vi.mocked(fetch).mockResolvedValue(
    response(200, {
      ...session("admin"),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }),
  );
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Inicia sesión" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("expirada");
});
