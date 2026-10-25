# Acceso y usuarios de prueba

**Actualización:** 25 de octubre de 2026. Autenticación y operación integradas con PostgreSQL. Catálogos, solicitudes, órdenes, almacén, revisiones y borradores privados usan la API; no se guardan en localStorage.

## Usuarios solicitados

Son **nombres de usuario**, no direcciones de correo; no agregar `@` ni cambiar la sintaxis.

| Usuario | Rol backend | Vista inicial |
|---|---|---|
| `mecanico.prueba.com` | `LEAD_MECHANIC` | Solicitudes y gestión del taller |
| `almacen.prueba.com` | `WAREHOUSE_CLERK` | Artículos y entradas de almacén |
| `chofer01.prueba.com` | `DRIVER` | Reportar y consultar sus solicitudes |
| `admin.prueba.com` | `ADMIN` | Gestión general del prototipo |

**Contraseña inicial de las cuatro cuentas: `PRUEBA123`. Exclusivamente para pruebas locales.** Cambiar o retirar estas cuentas antes de producción.

## Preparar y ejecutar

Iniciar Docker Desktop. En instalación nueva ejecutar primero `npm ci` desde `shared/`. Desde `backend/`, con `.env` ya configurado (ver [arranque inicial](../../README.md)):

```powershell
npm ci
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run db:seed:demo
npm run start:dev
```

En otra terminal desde `frontend/`:

```powershell
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173/`. Vite redirige `/api` al backend `127.0.0.1:3000`. No hay inicio de sesión local alternativo si backend/PostgreSQL no están disponibles. No iniciar con `vite preview` sin configurar también la redirección `/api`.

El seed crea solo las cuentas que no existen y no sobrescribe contraseñas, roles ni estados de cuentas existentes. Se rechaza con `NODE_ENV=production`; nunca se ejecuta automáticamente al arrancar. Las cuentas quedaron creadas y verificadas en esta entrega. No hay todavía interfaz de registro, cambio de contraseña o recuperación.

## Autenticación implementada

- Campo `username` único separado del correo opcional. Se normaliza a minúsculas y se recortan espacios de los extremos; la contraseña no se transforma.
- Contraseñas derivadas con `scrypt`, sal aleatoria por usuario y comparación de tiempo constante. No se almacenan en texto plano.
- Sesión opaca aleatoria de 256 bits. PostgreSQL conserva solo el hash SHA-256 del token, usuario y expiración.
- Cookie `re_session`, `HttpOnly`, `SameSite=Strict`, ruta `/api`, duración de 8 horas; `Secure` cuando `NODE_ENV=production`.
- La API comprueba expiración y que el usuario siga activo en cada consulta autenticada. Los roles se leen del usuario en la base de datos, no de valores enviados por el formulario.
- Logout revoca la sesión en base de datos y elimina la cookie. El frontend no guarda tokens ni contraseñas en `localStorage`.
- Límite de 10 intentos por IP/minuto para login, con contadores en memoria del proceso. No es un limitador distribuido.
- Login y logout requieren `Origin` permitido. `FRONTEND_ORIGINS` es una lista separada por comas; predeterminado `http://127.0.0.1:5173,http://localhost:5173`.
- Endpoints de autenticación con `Cache-Control: no-store`. No se devuelve el hash de contraseña ni el token en JSON.

## API

| Método y ruta | Acceso |
|---|---|
| `POST /api/auth/login` | JSON `{ "username": "…", "password": "…" }`, origen permitido |
| `GET /api/auth/me` | Sesión activa; devuelve usuario público y expiración |
| `POST /api/auth/logout` | Origen permitido; cierre idempotente, respuesta 204 |
| `GET /api/auth/users` | Solo administrador; listado sin contraseñas ni hashes |
| `GET /health` | Salud del proceso HTTP; no implica verificación de negocio |

Para clientes HTTP no navegador, enviar también `Origin: http://127.0.0.1:5173` en login/logout y conservar la cookie. El frontend de desarrollo usa el mismo origen mediante proxy; no se habilitó CORS abierto.

`AuthGuard` y `RolesGuard` quedan disponibles para proteger futuros endpoints. Un usuario autenticado sin rol administrador recibe 403 al intentar listar usuarios. Enviar `role: ADMIN` en login no modifica el rol real.

## Migración de cuentas anteriores

La migración agrega `username` obligatorio y vuelve opcional `email`. Si ya hubiera cuentas previas sin username, reciben `legacy-<UUID>` para conservarlas sin colisiones. No se borran datos ni se cambian sus contraseñas. No se garantiza compatibilidad con formatos de hash ajenos a esta implementación.

## Interfaz y alcance de permisos

Se retiró el selector de perfiles demo de la aplicación real. La pantalla inicial y las acciones visibles se obtienen del usuario autenticado. Almacén accede a artículos y entradas; el chofer a sus reportes; mecánico y administrador a gestión del prototipo. La distribución definitiva de permisos administrativos y operativos deberá validarse con el cliente.

Los reportes nuevos guardan el ID real del chofer; revisiones de solicitudes guardan el ID real de quien decide. Los borradores nuevos se separan por ID de usuario. Los borradores antiguos y reportes vinculados a identidades demo no se atribuyen automáticamente a cuentas reales: requieren una migración revisada, no un cambio silencioso de propietario.

**Límite importante:** los comandos operativos ya validan permisos, reglas y revisión en servidor. Los cambios de otros usuarios se consultan al recargar; no hay actualización en vivo. Los datos antiguos solo se trasladan mediante respaldo y confirmación, sin reasignar actores demo. Ver [migración y arquitectura vigente](../proyecto/backend-operacion-etapa-02.md). Sigue siendo un MVP no preparado para producción.

El selector de identidades usado para pruebas unitarias existe únicamente en `src/testing/WorkbenchHarness.tsx`, importado por los tests, nunca por el punto de entrada de producción.

## Verificación

Pruebas automatizadas: hashing, login, roles, cookie, perfil, logout, sesión expirada, cuentas inactivas, credenciales erróneas, origen inválido, rate limit y flujos de interfaz. Las pruebas HTTP automatizadas sustituyen Prisma por un doble de prueba; adicionalmente se verificó el ciclo login → perfil → permisos → logout → rechazo de cookie revocada de **las cuatro cuentas contra PostgreSQL real**, a través del proxy Vite.

También se comprobó en navegador que la cuenta de almacén recibe su vista correspondiente, que no hay selector de rol y que la cookie no es visible para JavaScript.

## Antes de producción

HTTPS y `Secure`, origen público exacto, proxy de confianza configurado explícitamente, secretos/credenciales únicos, política de contraseñas, recuperación y cambio de contraseña, auditoría, protección adicional de intentos, respaldos y revisión de dependencias. Persisten avisos de dependencias del backend documentados previamente; no se ejecutaron actualizaciones mayores forzadas. El MVP no se declara listo para producción.
