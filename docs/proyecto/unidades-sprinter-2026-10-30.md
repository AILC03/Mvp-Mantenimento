# Unidades de pasajeros — Autobús y Sprinter

**Fecha: 30/10/2026. Aclaración explícita del usuario.** Sustituye las instrucciones anteriores que excluían la categoría heredada `truck` de viajes o circulación. No amplía el backlog del MVP ni declara preparación de producción.

## Clasificación y compatibilidad

| Categoría visible | Clave JSONB/API/TypeScript | Enum relacional heredado |
|---|---|---|
| Autobús | `bus` | `BUS` |
| Sprinter de pasajeros | `truck` | `TRUCK` |

Sprinter es una unidad más pequeña de **pasajeros**, no de carga. Se mantienen intencionalmente las claves anteriores para evitar una migración innecesaria o alterar snapshots, respaldos, contratos y registros relacionados. `vehicleTypeLabel` en `shared/src/data.ts` centraliza las etiquetas. El enum Prisma conserva sus valores, con comentario de significado; no cambia el esquema de base de datos.

No se crean unidades nuevas para renombrar ni se cambian identificadores, números económicos, VIN, vínculos, órdenes, casos, plantillas, decisiones, autores, fechas ni costos históricos. Nombres técnicos como `Bus` y `busId` también se conservan por compatibilidad y pueden identificar ambas categorías. Las observaciones y textos históricos escritos por usuarios no se reescriben masivamente; la nueva denominación se aplica a las etiquetas y reglas de la aplicación.

La fuente operativa sigue siendo `OperationState` JSONB, con auditoría, transacciones, revisión e idempotencia existentes. Los modelos relacionales iniciales no se activan como un segundo módulo. No hace falta ejecutar migraciones, seeds, reinicios de base ni acciones de reclasificación sobre datos del usuario.

## Comportamiento vigente

- Títulos comunes: **Unidad/Unidades**. Se mantienen las etiquetas específicas Autobús y Sprinter en altas, filtros y opciones; el tipo también se muestra en historial, revisiones periódicas, resumen e impresos.
- Catálogo sin filtro manual: incluye ambas categorías. Los filtros Autobuses y Sprinter permiten acotar explícitamente la consulta, sin ocultar una categoría por defecto.
- Solicitudes, órdenes, compatibilidad de servicios, pre/post de viaje, revisiones periódicas, historial, servicios externos/carretera y circulación admiten ambas categorías. No hay paneles nuevos ni permisos adicionales por tipo.
- Se eliminó el filtro `type === 'bus'` del selector de viajes y de la conservación de la selección tras refrescar el catálogo. La regla compartida `startTripCase` valida la existencia de la unidad por ID, sin excluir `truck`; esta misma regla se ejecuta de nuevo en backend al procesar el comando.
- **Un solo caso de viaje abierto por unidad**, incluidos casos pendientes de cierre. Pre antes de post; ambas capturas antes del cierre por mecánico/admin. Se conservan plantillas y capturas históricas. Cerrar no repara incidencias ni autoriza circulación.
- El resumen administrativo incluye Autobús y Sprinter, muestra el tipo y mantiene grupos **No autorizados / Sin evaluar**. Solo se abre al pulsar **Resumen del estado de circulación de las unidades**; no reaparece una vista previa desplegada.
- La consulta **Ver incidencias de la unidad** sigue siendo emergente, específica del caso propio para chofer y con proyección mínima, sin exponer órdenes o costos ajenos. Cerrar conserva el formulario.
- Sin cambios en CAF 15,000 km, general 45 días, emergencia 90 días, validación de odómetro, entrega neta positiva por material, costos externos sin inventario ni permisos por rol.

## Archivos y revisión de alcance

- `shared/src/data.ts`, `catalogs.ts`, `trip-reviews.ts`: significado de las claves, etiquetas y validación común de viaje.
- `frontend/src/Workbench.tsx` y componentes de catálogo, solicitudes, órdenes, revisiones, incidencias, historial y circulación: nombres comunes y tipos visibles, sin exclusión automática.
- `backend/src/vehicles/vehicle-input.ts` y comentario en `prisma/schema.prisma`: terminología y compatibilidad relacional. El esquema Zod ya acepta `bus` y `truck`; los comandos operativos existentes usan la regla compartida corregida.
- `AGENTS.md`, README, estado, índice y documentos vigentes actualizados. El documento original del cliente se conserva como antecedente; no se modifican las migraciones SQL históricas.

La búsqueda transversal de condiciones por `type` no encontró otras exclusiones operativas por categoría. Las restantes condiciones son etiquetas, validaciones de los dos valores válidos, conversión de enums o filtros manuales. Un filtro de fixture por `bus` en una prueba de aislamiento selecciona otra unidad de prueba; no restringe el producto.

## Verificaciones del 30/10

- **Frontend:** 80 pruebas aprobadas en 19 archivos; build correcto. Regresiones actualizadas que antes esperaban excluir `truck`. `SprinterFlows.test.tsx` comprueba una Sprinter con ID heredado, historial previo y orden anterior: filtros, selectores, pre/post/cierre, consulta periódica, circulación e impreso, conservando los registros originales.
- **Backend:** 33 pruebas unitarias en 5 suites; build correcto. Incluye conversión heredada `TRUCK` → `truck` → Sprinter, preservando ID y sin sobrescritura del JSONB existente. ESLint de archivos backend afectados sin errores.
- **HTTP/PostgreSQL:** 25 pruebas en 4 suites sobre la **BD temporal aislada del script existente**. Una Sprinter `truck` se importa como registro previo con daño histórico y mismo ID. Pruebas nuevas cubren solicitud→orden→entrega→finalización, revisión periódica, externo sin cambios de stock/costos internos, decisiones de circulación, pre/post/cierre, segundo caso bloqueado, roles positivos/negativos y recarga preservando identidad e historial.
- **Chrome real:** escritorio 1440 px y móvil 375 px. Sprinter heredada en catálogo/filtro, solicitudes y selectores, consulta de incidencias, pre/post/cierre y revisión periódica. Externo por UI sin efectos de inventario; resumen con ambas categorías y tipo; orden impresa PDF A4 mostrando Sprinter. Sin desbordamiento de página en vistas comprobadas, errores JavaScript de página ni llamadas a Storage en el circuito bloqueado.

La revisión de navegador usa Playwright ya disponible fuera del proyecto, sin instalar dependencias, mediante `OPERATIONS_BROWSER_REVIEW` del script temporal. `sprinter-20261030.cjs`, capturas `sprinter-*.png`, `sprinter-work-order.pdf` y logs de verificación quedan bajo `C:\Users\angel\AppData\Local\Temp\opencode\`, fuera del repositorio. No se probó impresora física ni múltiples motores de navegador.

Sin cambios destructivos ni escrituras de reclasificación sobre la base operativa. No se publicaron cambios, no hubo despliegue y no se modificaron credenciales. Se conserva el diseño y los límites reales del MVP: JSONB agregado, recarga para cambios ajenos y endurecimiento de producción pendiente.
