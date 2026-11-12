# Ajustes finales del MVP — 07/11/2026

Solicitud y aclaraciones explícitas del usuario. Sustituye las reglas anteriores incompatibles, no declara implementación completa.

- Golpe/incidencia identifica daño físico; falla identifica mal funcionamiento. Responsable del daño significa quien lo causó, no quien lo repara.
- Catálogo admite preventivos y correctivos; no reclasificar servicios existentes. Correctivo libre permitido. Un responsable por orden, empleado de taller o proveedor de servicios, sin cuenta digital obligatoria. Diferentes responsables requieren órdenes diferentes.
- Admin/mecánico administran proveedores y empleados (nombre, puesto; teléfono opcional y activo/inactivo como criterio de implementación).
- Orden creada o reanudada registra No autorizado. Una orden pausada permite decisión explícita de circulación; al terminar se ofrece autorización explícita, sujeta a otras órdenes no pausadas. No resolver fallas automáticamente.
- Servicios externos unificados, sin elegir carretera/taller; materiales opcionales, mano de obra obligatoria. Pueden vincularse a orden sin duplicar costos o existir sin orden. No descuentan almacén.
- Almacén registra todas las entradas/salidas de órdenes, incluidas piezas por pedido. Piezas compatibles son catálogo independiente del stock, accesible desde historial; identificador, nombre, proveedor, costo y compatibilidad múltiple.
- Artículos de unidad independientes del almacén: nombre, categoría y cantidad. Pre/post captura contadores y movimientos; recuperación permitida con motivo e historial. No cobros automáticos.
- Observaciones obligatorias ante falla pre/post; opción de reporte o solicitud vinculada. Consulta Estado de la unidad con detalle emergente.
- Historial imprimible horizontal, orden completa emergente, antecedentes anteriores al software sin efectos automáticos de stock. Orden impresa con firmas de recibido del responsable y terminado del mecánico; cierre digital posterior manual.
- VIN obligatorio en nuevas altas, sin borrar unidades anteriores incompletas. General 30 días; CAF 15,000 km y emergencia 90 días sin cambios.
- Stock mínimo/máximo opcionales, sin minería/alertas nuevas. Fotos futuras: máximo tres por artículo, sin implementar almacenamiento ni subida ahora.

Verificación e implementación: registrar resultados reales en la entrega; las reglas de conservación de históricos, API autenticada, JSONB, transacciones e idempotencia siguen vigentes.

## Implementación

- Rama de trabajo: `feat/ajustes-finales-mvp`, creada desde `main` limpio. Sin publicación ni despliegue.
- Directorios, piezas, artículos, movimientos y antecedentes en `workbench.workshop` del agregado JSONB existente. Comandos estrictos `workshop.save` y `parts.confirm`; no se activaron tablas relacionales paralelas ni se requieren migraciones nuevas.
- `shared/src/workshop.ts` valida directorios y compatibilidad; `operations.ts` vincula los comandos con autorizaciones, snapshots de responsable/piezas y pre/post. Actor, fecha, revisión e idempotencia siguen controlados por servidor.
- El responsable obligatorio de nuevas órdenes se selecciona por ID activo, y el servidor captura su nombre real. Los servicios existentes mantienen su clasificación; sus órdenes anteriores conservan responsables por servicio. Las bajas del directorio son lógicas para no romper vínculos.
- Piezas por pedido: almacén registra entradas recibidas, salidas y devoluciones por orden; se valida recepción antes de entrega y entrega neta positiva antes de finalizar. No crean stock ni descuentos en productos de almacén. Precio y proveedor de referencia quedan capturados en la orden.
- Corrección de devoluciones: admite bajar el acumulado a cero con motivo, agrega un movimiento compensatorio firmado por almacén/admin, conserva el anterior, y rechaza stock insuficiente. No modifica las entregas acumuladas a la baja.
- El registro externo vinculado se guarda una sola vez en `externalServices`, visible en su orden y en el expediente sin sumar dos registros de costo. La vinculación exige misma unidad y proveedor responsable; el registro sin orden continúa disponible. API conserva claves `external`/`roadside` anteriores; el formulario ya no distingue ubicación. Materiales omitidos se interpretan como cero; mano de obra debe enviarse, admitiendo cero como importe explícito.
- General: el catálogo vigente anterior de 45 días se proyecta a 30 y se persiste al siguiente comando, incrementando versión una sola vez. No se cambian snapshots de revisiones realizadas ni se recalculan declaraciones históricas. No hay actualización masiva de unidades o de órdenes anteriores.
- VIN: obligatorio en altas; no puede retirarse de una ficha ya completa. Se permite conservar fichas heredadas incompletas, sin inventar VIN.
- `Estado de la unidad` conserva la captura y ofrece detalle. Un aspecto con falla ya constituye un reporte persistente; la opción de solicitud crea un vínculo explícito, no otra copia del mismo reporte. Golpe/incidencia y falla son opciones distintas; el causante del daño se registra manualmente cuando se conoce, sin atribuirlo al chofer.
- Contadores de artículos guardan snapshot por etapa; cada diferencia registra antes/después, motivo, actor, viaje, etapa y chofer. Se muestran en el caso y el historial. Recuperaciones permitidas con observaciones. Sin cobro automático.
- Historial: detalle de orden en modal con consulta completa, impresión horizontal de todos los registros y alta de reparaciones anteriores sin efecto en stock, último CAF ni circulación. Orden imprimible con dos firmas; imprimir no finaliza y el cierre continúa manual.

## Comprobaciones ejecutadas

- Frontend: 82 pruebas en 20 archivos; backend: 46 pruebas en 6 suites. Incluyen regresión del alta contextual: enviar el formulario de persona dentro de un portal **no debe enviar la orden contenedora**.
- HTTP/PostgreSQL: 27 pruebas en 4 suites usando exclusivamente la base temporal aislada de `backend/scripts/test-database.cjs`. Incluye permisos negativos, snapshots tras nueva consulta, idempotencia de recepción/pre, entrega por pedido, devolución 1 → 0, bloqueo desde creación/reanudación, autorización con pausadas, externo único vinculado y recuperación pre/post.
- Builds frontend/backend correctos. ESLint sin `--fix` sobre los archivos TypeScript backend afectados, sin errores.
- Chrome real mediante `backend/scripts/review-final-adjustments.cjs` y `OPERATIONS_BROWSER_REVIEW` del ejecutor de BD temporal: escritorio 1440 px y móvil 375 px, sin llamadas a Storage. Alta de personal y alta contextual, orden correctiva, expediente/modal, artículos y antecedentes, captura pre/post con faltante y recuperación después de recarga, PDF de orden y PDF horizontal de historial. Sin errores JavaScript en la corrida aprobada. Capturas/PDF se guardan fuera del repositorio, en `%LOCALAPPDATA%/Temp/opencode/final-adjustments-*`.
- El ensayo inicial de navegador requirió ajustar la espera del arranque de la API y selectores de automatización; las suites HTTP permanecieron aprobadas. La revisión visual detectó propagación del submit contextual a la orden; corregida y cubierta por prueba de regresión.

## Límites conservados

Sin fotos implementadas (futuro: tres por artículo), minería/alertas de stock, cobros automáticos, compras/pagos/facturas, cuentas de técnicos, recursos humanos completos ni despliegue. Costos de piezas son referencias capturadas, no contabilidad de compras. Cambios ajenos requieren recarga; se mantiene el agregado JSONB del MVP. La autorización explícita al cierre se rechaza si otra orden permanece abierta sin pausar. No se probaron impresoras físicas ni otros motores de navegador. La validación no declara preparación de producción.
