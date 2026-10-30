# Real Ejecutivo — Mantenimiento MVP

Plataforma para gestionar unidades, inspecciones de viaje, incidencias, mantenimiento y materiales de Real Ejecutivo.

**Estado al 30/10/2026:** MVP integrado, con el alcance solicitado el 28/10 y la clasificación Autobús/Sprinter; **no listo para producción**. Catálogos, solicitudes, órdenes, almacén, revisiones, historial, CAF, servicios externos, circulación y borradores privados se guardan en PostgreSQL mediante una API autenticada. La operación no depende de localStorage ni sessionStorage.

**Unidades de pasajeros:** las categorías son **Autobús** y **Sprinter**. Ambas pueden realizar todos los flujos, incluidos pre/post y circulación. Las claves heredadas `truck`/`TRUCK` ahora significan Sprinter, no carga: no cambian IDs ni relaciones, ni se crean unidades nuevas. Se mantiene un caso abierto por unidad. Ver [aclaración, compatibilidad y pruebas del 30/10](docs/proyecto/unidades-sprinter-2026-10-30.md).

El [alcance del 28/10](docs/proyecto/decisiones-mvp-2026-10-28.md) prevalece sobre antecedentes incompatibles. Ver [entrega y comprobaciones](docs/proyecto/entrega-alcance-mvp-2026-10-28.md), que distingue criterios de implementación y resultados verificados.

Los requerimientos son preliminares; las propuestas técnicas no representan acuerdos finales con el cliente.

## Estructura

```text
backend/               NestJS 11 + Prisma 6; API, sesiones y persistencia
frontend/              React 19 + Vite + TypeScript + CSS propio
shared/                Reglas y tipos propios compartidos entre ambos proyectos
design-system/         Tokens y documentación de diseño
docs/
  proyecto/            Documento original y contexto
  requisitos/          Requerimientos y criterios de aceptación
  arquitectura/        Arquitectura y decisiones propuestas
  diseno/              Flujos, pantallas y formatos operativos
  legal/               Reutilización de código y dependencias
  operacion/           Despliegue, respaldos y operación futura
```

## Funcionalidades y reglas

- Acceso por rol: administrador, mecánico principal, almacén y chofer; permisos validados en servidor.
- Catálogos de unidades, artículos, servicios/materiales y plantillas de revisión. Solo admin modifica unidades, tipos de revisión y correcciones extraordinarias de CAF.
- Solicitud del chofer → revisión del mecánico → orden vinculada o rechazo con motivo.
- Ejecución, pausas y cierre de órdenes sin liberación adicional. Para finalizar se requiere entrega neta positiva de cada material; las órdenes sin materiales no requieren entrega.
- Entradas con costo histórico, entregas/devoluciones y existencias transaccionales. Piezas enteras y litros en pasos de 0.5 para cantidades previstas.
- CAF cada 15,000 km, revisión general cada 45 días y emergencia cada 90 días. El vencimiento avisa, no bloquea.
- Historial filtrable, incidencias/reparaciones y revisión pre/post de viaje con cierre único del caso. Cerrar un caso u orden no autoriza circulación.
- Borradores privados por usuario en PostgreSQL; los formularios aún no guardados viven solo en memoria.
- Consulta de incidencias activas/resueltas en ventana emergente desde pre/post, sin perder la captura ni exponer el expediente al chofer. Al iniciar un viaje se actualiza el catálogo de unidades desde la API, con carga/error/reintento, incluyendo Autobús y Sprinter.
- Orden física imprimible para eléctrico/carrocero, además de la requisición existente; sin cuentas de técnicos.
- Servicios externos/carretera por unidad, con prestador, materiales, mano de obra y total derivado en MXN. No afectan inventario ni órdenes internas.
- Decisiones explícitas de circulación (admin/mecánico), con historial y estado inicial **Sin evaluar**. El resumen para foto manual de Autobús y Sprinter se muestra únicamente al pulsar **Resumen del estado de circulación de las unidades**, en Unidades; sin vista previa desplegada.
- El cierre exige odómetro igual o mayor al de apertura de esa orden, sin bloquear capturas históricas por lecturas posteriores ni corregir registros previos.

## Arranque local (PowerShell)

Requisitos: **Node.js 22 LTS**, npm y Docker Desktop activo (PostgreSQL 17). Desde la raíz del proyecto:

```powershell
npm --prefix shared ci
npm --prefix backend ci
npm --prefix frontend ci
```

Preparar el backend en una terminal:

```powershell
Set-Location backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Revisar .env y configurar credenciales locales antes de continuar.
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run db:seed:demo
npm run start:dev
```

Desde otra terminal, en la raíz:

```powershell
npm --prefix frontend run dev
```

Abrir **http://127.0.0.1:5173**. API: `http://127.0.0.1:3000`; PostgreSQL local: puerto `5433`. Vite redirige `/api` al backend; `vite preview` requiere configurar esa redirección por separado.

El seed crea únicamente cuentas de prueba que no existan, sin cambiar las existentes; no se ejecuta en producción. Usuarios: `admin.prueba.com`, `mecanico.prueba.com`, `almacen.prueba.com` y `chofer01.prueba.com`; contraseña inicial **`PRUEBA123`**, exclusivamente para pruebas locales. No crea unidades ni existencias de demostración. Ver [acceso y usuarios](docs/operacion/acceso-y-usuarios-prueba.md).

No sobrescribir `.env`, reiniciar migraciones ni eliminar volúmenes para resolver problemas. No ejecutar build y watch del backend simultáneamente porque comparten `dist/`.

## Datos y arquitectura

Frontend y backend tienen dependencias y comandos separados, sin herramientas de monorepo. Ambos consumen reglas propias de `shared/`; backend lo compila antes de build/start/test. Autenticación con sesiones opacas, cookies HttpOnly/SameSite Strict y hashes scrypt; sin tokens en el almacenamiento del navegador.

El MVP persiste un **agregado JSONB versionado** (`OperationState`), borradores privados (`OperationDraft`) y auditoría/idempotencia (`OperationEvent`). Los comandos se validan con Zod y reglas compartidas; las escrituras usan transacciones, bloqueo de fila y revisión contra conflictos. No hay un PUT público para reemplazar todo el estado ni guardado local alternativo ante fallas.

**Datos del prototipo anterior:** no se importan ni borran automáticamente. Antes de crear registros nuevos, entrar como admin y abrir **PostgreSQL → Opciones** para revisar/descargar un respaldo e importar explícitamente. Solo se acepta una operación todavía vacía; si ambos orígenes contienen datos, se requiere conciliación revisada. La retirada de copias antiguas es una acción posterior con confirmación. Ver [procedimiento y límites](docs/proyecto/backend-operacion-etapa-02.md).

## Comprobaciones

```powershell
npm --prefix frontend run build
npm --prefix frontend test -- --run
npm --prefix backend run build
npm --prefix backend test -- --runInBand
npm --prefix backend run test:database
```

Validación del 30/10: **80 pruebas frontend, 33 unitarias backend y 25 HTTP aprobadas**, builds correctos y ESLint del backend afectado sin errores. `test:database` requiere Docker y `.env`: crea una BD temporal propia, aplica migraciones y elimina solo esa BD; no limpia la base operativa. Chrome real verificó escritorio/móvil, Sprinter heredada en los flujos, historial, resumen e impresión PDF, con Storage bloqueado y sin errores JavaScript de página. Detalles en la [aclaración del 30/10](docs/proyecto/unidades-sprinter-2026-10-30.md) y la [entrega previa](docs/proyecto/entrega-alcance-mvp-2026-10-28.md).

## Límites y siguientes pasos

Pendientes: normalización por entidad, paginación en servidor, actualización en vivo, respaldo/restauración automatizados, evidencias privadas, gestión completa de cuentas y endurecimiento de producción. Los cambios ajenos se consultan al recargar. Hay avisos de dependencias backend pendientes de resolver; no se forzaron actualizaciones mayores. Usar datos ficticios para demostraciones y no exponer los servidores de desarrollo a Internet.

## Documentación

Comenzar por el [índice de documentación](docs/README.md). El [documento original del MVP](docs/proyecto/Real_Ejecutivo_Estado_Proyecto_MVP.md) se conserva sin modificaciones.

Para entrar y arrancar ambos servicios: [login y cuentas de prueba](docs/operacion/acceso-y-usuarios-prueba.md).

## Principios iniciales

- Independencia del CRM y del sistema de tours.
- Checklist de viaje e incidencia son registros independientes.
- Cerrar una orden no equivale a autorizar circulación.
- Conservar el historial y la trazabilidad de costos y materiales.
- Implementar reglas propias del negocio; no copiar código de Atlas CMMS sin revisión de licencias.

## Publicación y derechos

No versionar `.env`, credenciales, certificados, datos operativos ni respaldos. Sí se incluyen los tres `package-lock.json` y las migraciones SQL. El `.gitignore` no sustituye la revisión de lo que se añade a Git.

No se concede una licencia pública por publicar el repositorio. Los derechos contractuales con el cliente y las licencias de recursos de terceros requieren revisión; consultar `docs/legal/`. Las skills locales de terceros no se redistribuyen: se conservan en disco y se excluyen de Git hasta verificar sus licencias. No son necesarias para instalar, ejecutar o probar la aplicación.
