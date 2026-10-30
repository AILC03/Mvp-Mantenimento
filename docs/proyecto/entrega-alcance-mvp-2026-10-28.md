# Entrega del alcance del 28/10 — implementación y verificación

**Verificado el 29/10/2026.** Especificación: [decisiones vigentes](decisiones-mvp-2026-10-28.md). Este documento registra implementación y pruebas, no nuevos acuerdos del cliente. No representa una entrega preparada para producción.

**Aclaración de clasificación del 30/10:** [Autobús y Sprinter](unidades-sprinter-2026-10-30.md) comparten todos los flujos. `truck`/`TRUCK` significan Sprinter de pasajeros; quedan sustituidas las restricciones anteriores que excluían esta categoría de viajes o circulación.

## Funciones implementadas

### Consulta de incidencias desde pre/post

El botón **Ver incidencias de la unidad** abre una ventana emergente independiente, sin desmontar el formulario de revisión. Muestra activas inicialmente; **Consultar resueltas** permite ver las reparadas. Cerrar con Escape, X o el botón de cierre vuelve a la captura conservando respuestas/notas. El diálogo se monta fuera del formulario para evitar anidación HTML; no agrega una respuesta «ya conocida», no deduplica ni permite resolver fallas.

Al abrir **Iniciar caso de revisión**, la aplicación actualiza el snapshot autorizado desde la API y usa su catálogo vigente para elegir la unidad y validar el alta. Evita conservar solo el listado de inicio de sesión cuando admin añadió o modificó unidades posteriormente. Muestra económico, tipo Autobús/Sprinter, marca/modelo y placa, ordenados por económico. Durante carga o error no se permite usar una lista obsoleta; hay reintento sin perder fechas. Un catálogo vacío tiene explicación explícita. Desde el 30/10 ambas categorías participan y los valores `truck` conservados representan Sprinter, sin reclasificar IDs ni duplicar registros.

`GET /api/operations/trips/:id/incidents` consulta la fuente JSONB completa **en servidor**, pero devuelve solo `id`, `title`, `description`, `date`, `origin` y `resolved` de la unidad de ese caso. Chofer requiere un caso propio; un caso ajeno/inexistente responde 404. Admin/mecánico pueden consultar; almacén/TECHNICIAN reciben 403, sin sesión 401. No se amplió el snapshot del chofer para devolver órdenes, costos, actores ni expedientes ajenos. En golpes, parte y descripción aparecen en el título; se omite la nota de atribución personal. Los textos descriptivos libres se conservan como contenido del reporte, no como identidades verificadas.

### Circuito físico de trabajo

**Órdenes → Ver detalles → Imprimir orden de trabajo** incluye número, unidad/placa, prioridad/programación, odómetro inicial, servicios, responsable escrito, instrucciones y materiales estimados. No exige cuenta al responsable. Se conserva **Imprimir requisición**, usando la hoja y confirmaciones existentes. La impresión oculta aplicación/controles y no guarda ni cambia existencias o estados. El formato se prepara antes de abrir la impresión.

Almacén sigue confirmando entregas/devoluciones y mecánico/admin finalizan con las validaciones vigentes. No se implementaron cuentas ni panel TECHNICIAN.

### Servicio externo/carretera

**Unidades → Ver historial → Registrar servicio externo/carretera**. Admin/mecánico capturan tipo, fecha real no futura, descripción, prestador, materiales, mano de obra y notas opcionales. Ambos importes admiten cero y dos decimales, en MXN; límite técnico por importe: 1,000,000,000. El total se deriva sumando centavos; no se acepta un total enviado independientemente. Autor, fecha de captura e ID se generan en servidor.

Comando `external.record`; datos en `workbench.externalServices`. El historial de la unidad muestra prestador, importes, total, notas y capturista, además de fecha del servicio/captura. Los filtros incluyen **Servicios externos**. No requiere orden/checklist, no mueve inventario, no modifica costos internos, no repara incidencias ni decide circulación. No hay reportes acumulados por unidad.

### Circulación y resumen

**Unidades → Ver historial → Decidir circulación** permite a admin/mecánico guardar **Autorizado / No autorizado / Sin evaluar**. Cada guardado agrega autor/fecha al historial; cancelar una edición no decide nada. Sin registros previos se interpreta **Sin evaluar**, sin fabricar eventos ni autorizaciones.

Comando `circulation.decide`; datos en `workbench.circulationDecisions`, más reciente primero. Historial filtrable por **Circulación**. El criterio de permitir decidir a admin/mecánico y el estado inicial sin evaluar vienen de los **criterios de implementación** del documento del 28/10; no se presentan como una confirmación adicional del cliente.

En **Unidades**, admin abre el resumen con **Resumen del estado de circulación de las unidades**, incluyendo Autobús y Sprinter. Sus grupos **No autorizados** y **Sin evaluar** se muestran solo dentro de la ventana emergente: ya no hay vista previa desplegada en la página. Muestra económico, tipo, identificación y fecha de decisión cuando existe. No toma ni envía fotos automáticamente. En listas largas se requiere desplazar o hacer varias capturas. Refleja los datos cargados: recargar para consultar cambios ajenos.

Finalizar órdenes, registrar externos, completar/cerrar revisiones o vencer plazos no cambia circulación. No hay bloqueos de viaje nuevos.

### Integridad del odómetro

`finishOrder` compara el odómetro de cierre con `order.form.odometer`: no puede ser menor al de **apertura de esa orden**. La regla compartida se ejecuta tanto antes del envío en UI como de nuevo en servidor, cuyo error 400 también se presenta en el formulario. Se conserva lo capturado ante error.

No se compara con el máximo global de lecturas posteriores. Se admiten capturas históricas válidas; no se reescriben ni se rechazan en carga órdenes antiguas ya confirmadas con lecturas inconsistentes.

## Arquitectura, compatibilidad y conservación

- Una sola fuente de verdad: `OperationState` JSONB y comandos existentes con Zod, permisos, revisión, transacción, auditoría e idempotencia. No se activaron modelos relacionales antiguos ni se añadieron migraciones.
- Los dos arrays nuevos de Workbench son opcionales. Estados sin esos campos siguen cargando. Los parsers preservan y validan los nuevos campos cuando existen; la importación revisa también referencias por unidad e IDs duplicados.
- Snapshot de chofer y almacén sigue excluyendo externos/circulación. Consulta de incidencias específica y mínima, sin privilegios de escritura nuevos para esos roles.
- No se modificaron `.env`, volúmenes ni datos operativos, ni se ejecutaron seeds. Se inició el contenedor PostgreSQL existente para crear **solo bases temporales** del script de integración y se detuvo al terminar, restaurando su estado inicial. El servicio ajeno del puerto 3000 no se tocó; navegador usó puertos temporales.
- Sin dependencias nuevas, cambios de framework, normalización, publicación, commit, push ni despliegue. Se preservaron los archivos de instrucciones/decisiones y los cambios locales previos en el índice.

## Verificaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| Frontend, Vitest | 76 pruebas aprobadas en 17 archivos |
| Backend, Jest unitario | 32 pruebas aprobadas en 5 suites |
| HTTP + PostgreSQL temporal (`npm run test:database`) | 23 pruebas aprobadas en 4 suites |
| Builds frontend/backend (incluye shared) | Correctos |
| ESLint de los archivos backend modificados/nuevos | Sin errores, sin `--fix` |
| Chrome real, 1440 px y 375 px | Circuito aprobado; sin desbordamiento de página en vistas comprobadas |
| Impresión | Orden y requisición generadas a PDF A4; hoja de orden revisada, sin menús ni botones |

Pruebas añadidas en `frontend/src/components/MvpScope.test.tsx`, `backend/src/operations/unit-records.spec.ts` y `backend/test/operations.e2e-spec.ts`: roles permitidos/prohibidos, consulta propia/mínima y aislamiento por unidad, activas/resueltas/vacío/error de red, conservación pre/post, importes/fechas inválidos, total y costo cero, stock/costos internos intactos, persistencia/recarga, historial autorizado→no autorizado, ausencia inicial, cancelar sin decidir, impresión sin mutaciones, cierre inferior rechazado e histórico válido, sin reescribir órdenes previas.

La revisión Chrome usó Playwright **ya instalado fuera del proyecto**, sin añadir dependencias, mediante el hook existente `OPERATIONS_BROWSER_REVIEW` del script de BD temporal. Verificó además guardado externo fallido y reintento, circulación tras recarga, consultas pre/post sin perder formulario, cierre inválido y luego histórico válido, circulación intacta tras finalizar e impresión. Cero errores JavaScript de página y cero llamadas a Storage en ese circuito (el almacenamiento se bloqueó deliberadamente).

Script, capturas y PDFs de revisión quedaron fuera del repositorio en `C:\Users\angel\AppData\Local\Temp\opencode\ui-review-20261024\` (`mvp-20261028.cjs`, `scope-*.png/pdf`). No son evidencias operativas del cliente ni una suite Playwright instalada en el proyecto. Las pruebas unitarias/HTTP sí quedan en el proyecto. No se verificó una impresora física ni múltiples navegadores/dispositivos físicos.

## Límites reales y trabajo posterior

Se conserva el agregado global y su serialización; no hay actualización en vivo ni paginación de servidor. Las declaraciones de fallas siguen independientes, sin consolidación automática. La autorización es una decisión humana, no una inferencia del trabajo realizado. Respaldos/restauración operativa, endurecimiento de seguridad y revisión de dependencias siguen pendientes para producción.

Fotos/storage, empleados completos, costos internos adicionales, turnos, garantías/facturas/pagos, reportes acumulados y paneles técnicos permanecen **fuera de esta entrega**, no como tareas que deban implementarse para cerrar este encargo.

## Ajuste de interfaz y carga — verificado el 29/10/2026

Cambios acotados a `TripIncidents.tsx`, `TripReviews.tsx` y `UnitRecords.tsx`, más pruebas y documentación. Se conservaron los cambios locales previos, incluidos el nombre del botón y los filtros existentes del resumen. No hubo escrituras diagnósticas sobre datos operativos: se consultaron únicamente conteos/tipos para distinguir un problema de carga de la clasificación de unidades.

- Frontend: **79 pruebas aprobadas en 18 archivos**, build correcto. Nuevas regresiones en `TripVehicleLoading.test.tsx` (catálogo cambiado tras login, alta con unidad nueva, error/reintento conservando fechas y catálogo vacío); pruebas de modal y resumen solo a petición actualizadas en `MvpScope.test.tsx`.
- Backend: build correcto y **23 pruebas HTTP** sobre BD temporal aislada aprobadas. No se cambió el código backend ni el contrato de permisos en este ajuste.
- Chrome real a 1440/375 px: catálogo actualizado sin recargar página, reintento tras fallo, nueva revisión creada, dos diálogos independientes durante consulta, cierre por Escape/X/botón, formularios pre/post conservados y resumen oculto fuera del diálogo. Sin desbordamiento de página, errores JavaScript de página ni llamadas a Storage en el circuito bloqueado.
- Revisión temporal: `trip-dialog-20261029.cjs`, `adjustment-*.png` y `trip-dialog-review.log` bajo el directorio temporal de OpenCode; sin dependencias nuevas. PostgreSQL ya estaba activo al iniciar este ajuste y se dejó en ese estado. Las bases/servidores de revisión temporales se retiraron con el script existente.

El diagnóstico del 29/10 identificó catálogo de sesión obsoleto y una exclusión por tipo que entonces se conservaba. La aclaración posterior del 30/10 elimina esa exclusión: Sprinter también pertenece al selector de viajes. Se conservan los valores internos e identidades guardadas; ver la entrega del 30/10 para verificación vigente. Sin publicación ni despliegue; sigue sin ser una entrega de producción.
