# Real Ejecutivo — Backend

Proyecto independiente con NestJS 11, TypeScript y npm. Consume las reglas propias del paquete hermano `shared/`; no depende de React ni del servidor frontend.

## Operación integrada

**Clasificación vigente del 30/10:** Autobús y Sprinter de pasajeros comparten todos los flujos. Se conservan `bus`/`BUS` y `truck`/`TRUCK`; estos últimos significan Sprinter, no carga. La regla compartida de viaje ya no excluye `truck`. Sin cambios de IDs ni migraciones de valores; ver [compatibilidad y pruebas](../docs/proyecto/unidades-sprinter-2026-10-30.md).

**29/10/2026:** añadidos comandos `external.record`, `circulation.decide` y consulta mínima `GET /api/operations/trips/:id/incidents`. Campos opcionales del mismo JSONB, sin migraciones ni segunda fuente relacional. Admin/mecánico guardan externos y circulación; chofer solo consulta incidencias de un caso propio. Cierre validado contra apertura de esa orden, no contra lecturas posteriores. [Contrato, permisos y verificación](../docs/proyecto/entrega-alcance-mvp-2026-10-28.md).

Disponibles `/api/operations`, `/api/operations/commands` y `/api/operations/import`. Todos los módulos actuales y borradores usan PostgreSQL, con reglas compartidas, autorización, transacción, revisión e idempotencia. Persistencia del MVP en agregado JSONB versionado, borradores privados y auditoría; normalización por entidad pendiente. Ver [arquitectura, migración y límites](../docs/proyecto/backend-operacion-etapa-02.md). GET `/api/vehicles` usa la misma fuente; escrituras antiguas devuelven 410 para evitar divergencias.

## Requisitos

Node.js 22 LTS y npm. Base verificada con Node 22.14.0. Se utilizó el generador NestJS CLI 11.0.10 porque el generador 12 falló con la versión local de Node.

## Desarrollo

Primero iniciar Docker Desktop. En instalación nueva ejecutar `npm ci` también desde `shared/`. Desde backend (conservar `.env` si ya existe):

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run db:seed:demo
npm run start:dev
```

API local: `http://127.0.0.1:3000`. `PORT` cambia el puerto y `HOST` la interfaz; por defecto solo se escucha en `127.0.0.1`.

## Login y usuarios

Autenticación implementada: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` y listado de usuarios restringido a admin en `GET /api/auth/users`. Contraseñas con scrypt y sesiones persistentes de 8 horas mediante cookie HttpOnly; tokens almacenados como hash.

`npm run db:seed:demo` crea `mecanico.prueba.com`, `almacen.prueba.com`, `chofer01.prueba.com` y `admin.prueba.com`, todos inicialmente con `PRUEBA123`. No sobrescribe cuentas existentes ni se permite con `NODE_ENV=production`. Son usuarios, no emails. Ver [operación y alcance del login](../docs/operacion/acceso-y-usuarios-prueba.md).

Login/logout requieren un `Origin` incluido en `FRONTEND_ORIGINS`. Vite usa el mismo origen mediante proxy `/api`; no hay CORS abierto. En producción configurar HTTPS, origen exacto y retirar contraseñas de prueba.

Copiar `.env.example` solo si aún no existe `.env`; no sobrescribir credenciales existentes. Si cambias usuario, contraseña, puerto o nombre de base, actualizar también `DATABASE_URL` (codificar caracteres especiales de la URL). El puerto PostgreSQL local predeterminado es 5433, limitado a localhost. El volumen Docker conserva datos; `docker compose down` detiene servicios sin borrarlos. No usar `down -v` salvo eliminación deliberada de los datos.

El backend requiere `DATABASE_URL` y conexión disponible al iniciar. El archivo `.env` no se versiona. No usar las credenciales de ejemplo en producción.

`GET /health` responde `{"status":"ok"}`. Solo indica que el proceso HTTP responde; no verifica base de datos ni servicios externos.

## Verificación

```powershell
npm run build
npm run db:validate
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:database
```

## Estructura

```text
src/       Arranque, módulo raíz y endpoint de salud
prisma/    Esquema y migraciones PostgreSQL
test/      Pruebas HTTP de integración
```

## Pendiente

- Normalizar e indexar entidades del agregado JSONB; paginación y consultas del servidor.
- Revisar con el usuario la migración de datos antiguos y conciliar conflictos sin reemplazos automáticos.
- Extender cobertura de concurrencia y rendimiento con carga real; ya se prueba el circuito integrado contra una BD PostgreSQL temporal propia.
- Externos/carretera básicos ya implementados; reportes acumulados, valoración contable y evidencias privadas fuera de la entrega actual.
- Configuración validada, evidencias privadas y controles de producción.

No está lista para producción. Las reglas operativas compartidas están en `../shared/src` y la documentación en `../docs/`. `UNLICENSED` en el manifiesto evita conceder una licencia pública por defecto; los derechos contractuales con el cliente siguen pendientes.

## Base de datos

El [modelo inicial](../docs/arquitectura/base-de-datos.md) se conserva. Las migraciones siguientes añaden unidades tipadas y OperationState/OperationDraft/OperationEvent para el circuito vigente completo. No asumir que el modelo inicial sea la fuente operativa actual.

- `npm run db:deploy`: aplicar migraciones existentes.
- `npm run db:migrate -- --name descripcion`: crear y aplicar cambios en desarrollo.
- `npm run db:status`: consultar migraciones aplicadas.
- `npm run db:studio`: explorar datos localmente; no exponer públicamente.

No usar `prisma db push`: hay restricciones SQL adicionales en migraciones. `npm run test:database` crea una base temporal aleatoria propia, aplica migraciones, prueba reglas HTTP/concurrencia y retira solo esa base. Nunca limpia ni reinicia la BD operativa. Las pruebas de autenticación/salud también usan dobles de Prisma. Tras `npm ci`, ejecutar `npm run db:generate` antes de compilar o probar. No ejecutar build y start:dev del backend simultáneamente: escriben el mismo dist.

La auditoría npm reporta vulnerabilidades pendientes; ver notas del modelo de base de datos antes de preparar producción.
