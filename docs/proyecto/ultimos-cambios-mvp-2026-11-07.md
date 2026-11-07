# Últimos cambios del MVP — implementación local y verificaciones

Fecha: 7 de noviembre de 2026. Rama: `feat/ultimos-cambios-mvp`.

Este documento recoge la ampliación aprobada durante la conversación posterior al 30/10. Sustituye únicamente las reglas anteriores incompatibles. **No declara una entrega de producción ni una certificación exhaustiva.** No se hizo commit, push ni despliegue de esta ampliación.

## Confirmado por el usuario

- Golpe/Falla en lugar de Incidencia en la interfaz. Conservar los identificadores y declaraciones históricas; mostrar los registros antiguos como Falla sin cambiar su identidad.
- El chofer registra directamente una falla o golpe en la unidad: **no requiere confirmación previa del mecánico y no se convierte automáticamente en solicitud**. El mecánico puede marcar la reparación o preparar una orden desde esa falla.
- Apartados independientes del menú del chofer para reportar falla y registrar servicio externo, con el mismo formulario externo que utiliza el mecánico.
- Correctivos escritos como texto libre, materiales, responsable Taller/Externo y alta rápida; fecha estimada de término y piezas por número de parte, aunque no existan en almacén.
- Catálogos de empleados del taller y proveedores de servicios/materiales; piezas compatibles con una o varias unidades. Stock mínimo/máximo opcional en artículos.
- VIN obligatorio al guardar una unidad y VIN ficticio para unidades existentes que no lo tengan. Conservar unidades, claves `truck`/`TRUCK`, IDs, relaciones e historial.
- Inventario por unidad independiente de existencias de almacén, con conteos pre/post y registro de disminuciones.
- Observación obligatoria cuando una revisión pre/post tiene una falla; acciones explícitas para crear solicitud o registrar falla desde el resultado capturado.
- Orden en curso bloquea circulación; decisión explícita «Autorizar circulación» al finalizar, sin crear decisiones atribuidas a un actor «sistema».
- Correcciones de entregas/devoluciones hacia cero por almacén/admin, conservando auditoría.
- Historial con acceso a orden completa, impresión y registro de reparaciones anteriores; responsable del golpe/falla.
- Revisión general de 30 días, incluida la definición guardada; CAF 15,000 km y emergencia 90 días sin cambios.
- Fotos solo indicadas como pendientes; no integrar archivos en este MVP.

## Criterios de implementación adoptados

- La baja de un empleado es lógica (`active: false`): conserva el registro y los nombres capturados en órdenes anteriores. No crea ni administra cuentas de acceso.
- Los proveedores pueden ser de servicios, materiales o ambos; los nombres capturados en servicios y entradas siguen siendo copias históricas. El chofer puede dar de alta un prestador, pero no editar proveedores existentes.
- La mano de obra requiere captura explícita, sin valor predeterminado. Se conserva la regla de importes **no negativos**: escribir cero es válido; omitir el importe no. No se añadió mano de obra a órdenes internas.
- Los VIN ficticios son deterministas y exclusivos dentro del catálogo. No son VIN certificados: deben sustituirse por los reales antes de utilizar el sistema definitivo. La normalización completa solo catálogos nuevos ausentes, VIN vacío y la definición general de 45 a 30 días, con incremento de versión. No altera plantillas ya capturadas en revisiones.
- La lectura presenta el catálogo compatible; el siguiente comando autorizado lo conserva dentro de la transacción existente. No hay reset, reseed ni una segunda fuente de verdad.
- El inventario por unidad comparte las definiciones de artículos, **no sus existencias ni costos**. La configuración corresponde a admin/mecánico; durante un viaje con pre enviada no puede reconfigurarse. El chofer recibe los artículos necesarios sin entradas, precios ni movimientos de otras personas.
- En proceso y Pausada bloquean circulación. La decisión histórica se conserva y el bloqueo es derivado. Terminar sin marcar autorización registra No autorizado; autorizar con otra orden en curso se rechaza de forma atómica.
- Las correcciones de materiales agregan diferencias firmadas al historial; una disminución exige motivo. Se conservan cantidades no negativas acumuladas, devolución no superior a entrega, existencias no negativas y costo histórico.
- Las acciones desde pre/post son explícitas y producen registros separados. La declaración original no se elimina ni se deduplica automáticamente.
- «Imprimir» permite guardar PDF desde el navegador, con líneas de firma de recibido y trabajo terminado. No equivale a firma electrónica ni a almacenar PDFs firmados.

## Implementado en esta rama

- Contratos compartidos, esquemas Zod estrictos y comandos de catálogo, inventario y reparaciones anteriores; permisos y referencias comprobados en servidor.
- Pantallas de empleados/proveedores/piezas, alta rápida desde la orden y desde externos; VIN obligatorio y límites de stock opcionales.
- Reporte directo de chofer y acciones de mecánico, correctivos libres, responsable y piezas en orden, bloqueo derivado y decisión al cierre, corrección auditada de materiales.
- Conteos de inventario en pre/post con copia en la inspección, movimientos independientes de almacén y observación obligatoria ante falla.
- Historial imprimible, orden completa desde «Ver detalles», reparación anterior y formatos de orden con firmas.
- Mismo agregado `OperationState` JSONB, revisión, bloqueo, idempotencia y eventos existentes. No se introdujo persistencia operativa en Storage del navegador.

## Comprobaciones realizadas

- Frontend: **83 pruebas aprobadas** (20 archivos), incluidas alta/baja de empleado, reporte directo del chofer y correctivo con piezas/responsable.
- Backend: **43 pruebas unitarias aprobadas**; reglas nuevas verifican permisos negativos, VIN, compatibilidad, límites opcionales, corrección auditada, circulación e inventario pre/post.
- HTTP/PostgreSQL: **26 pruebas aprobadas** en cuatro suites mediante `npm --prefix backend run test:database`. Incluyen persistencia del reporte directo de chofer, autor real, reintento idempotente sin duplicación, ausencia de solicitud automática y rechazo de resolución por chofer. Se conservó la decisión de circulación registrada al cerrar una orden al comprobar el historial de Sprinter.
- Builds de frontend, backend y paquete compartido aprobados. ESLint de backend (`src` y `test`, sin `--fix`) sin errores.
- Chrome real, escritorio 1440 px y móvil 390 px, con API simulada y Storage bloqueado: alta de empleado, reporte directo sin solicitud pendiente, recarga y creación de correctivo. Sin desbordamiento horizontal en esas pantallas ni errores JavaScript de página. No confundir esa recarga con persistencia PostgreSQL.
- PDFs de historial y de orden revisados con datos sintéticos, sin controles de aplicación; la orden incluye las líneas de firma de recibido y trabajo terminado.

## Límites y pendientes del software real

- El bloqueo inicial de Docker quedó resuelto cuando estuvo disponible: se inició únicamente el contenedor PostgreSQL existente y se repitió la suite hasta obtener 26/26. Las cinco migraciones se aplicaron exclusivamente a bases temporales aleatorias creadas y retiradas por el script; no se reinicializó, migró ni borró la base operativa.
- La revisión Chrome utilizó API simulada; la persistencia real se verificó por la suite HTTP/PostgreSQL. No se afirma una revisión exhaustiva de todas las combinaciones de formularios ni una prueba de carga.
- Fotos, comprobantes privados, firma electrónica, infraestructura productiva, paginación, esquema normalizado, gestión de cuentas y respaldo/restauración operativa pertenecen al software real; no están implementados por este encargo.

Los resultados anteriores son comprobaciones concretas, no un porcentaje de avance ni una certificación de seguridad.
