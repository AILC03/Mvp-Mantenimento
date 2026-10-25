# Expediente de unidades, ejecución de órdenes, almacén y permisos

**Actualización:** reglas aclaradas el 23 de octubre de 2026; persistencia revisada el 25/10/2026. La operación, login y sesiones usan backend/PostgreSQL. Ver [etapa 02](backend-operacion-etapa-02.md).

## Intervalos confirmados

- Ante la diferencia entre 40 y 45 días, el usuario confirmó **45 días** para la revisión general.
- Salidas de emergencia: **90 días**.
- CAF: **15,000 km**.
- Solo el administrador puede corregir el registro del último CAF, de forma extraordinaria, con motivo y conservación del valor anterior y nuevo. No se eliminan ni alteran órdenes históricas.

## Permisos de la interfaz

| Acción | Admin | Mecánico principal | Almacén | Chofer |
|---|---|---|---|---|
| Consultar expediente de unidades | Sí | Sí | No | No |
| Alta/edición de información de autobuses y camiones | Sí | No | No | No |
| Alta/edición de tipos de revisión | Sí | No | No | No |
| Realizar revisiones periódicas existentes, sin asignación | Sí | Sí | No | No |
| Capturar pre/post del propio viaje | No | No | No | Sí |
| Revisar y cerrar casos pre/post | Sí | Sí | No | No |
| Crear/ejecutar órdenes | Sí | Sí | No | No |
| Consultar materiales de órdenes e imprimir requisición | Sí | Sí | Sí | No |
| Confirmar entrega/devolución de materiales | Sí | No | Sí | No |
| Catálogo de artículos y entradas | Sí | No | Sí | No |
| Buscar materiales al preparar servicios/órdenes | Sí | Sí | No aplica | No |

El mecánico conserva el acceso a tipos de servicio; no recibe acceso a Artículos de almacén ni a Tipos de revisión. Del inicio del admin se retiró la tarjeta de revisiones periódicas; mantiene el catálogo de tipos. Las realizaciones también pueden capturarse desde el expediente, sin asignaciones.

Estos permisos controlan la aplicación actual. Los datos operativos siguen siendo modificables en el navegador: falta autorización backend de negocio, filtros y persistencia PostgreSQL. No se presenta la ocultación de menús como protección suficiente para datos reales.

## Expediente de la unidad

En **Unidades**, seleccionar **Ver historial** muestra:

- Último CAF y kilómetros restantes, con base en un CAF realmente marcado como realizado o una corrección extraordinaria del admin.
- Días restantes para general y salidas de emergencia, calculados desde revisiones efectivamente realizadas. Sin registro previo no se inventa fecha ni vencimiento.
- Órdenes, servicios, ejecución, pendientes no realizados, solicitudes y costos de materiales estimados/confirmados.
- Casos pre y post trip, sus respuestas originales, observaciones, chofer y cierre.
- Revisiones periódicas realizadas, con copia de plantilla y evaluación.
- Golpes/incidencias registrados, fallas derivadas de pre/post y revisiones, con filtros reparadas/no reparadas.
- Confirmaciones de reparación, actor, fecha, explicación y orden finalizada relacionada opcional.
- Correcciones de CAF con valor anterior, nuevo, motivo y administrador responsable.

El odómetro mostrado usa la ficha y las lecturas registradas al terminar órdenes; no es telemetría. Una lectura de ejecución es un dato del servicio, no un permiso para editar la ficha del autobús.

El historial muestra lo disponible en este entorno, no datos históricos externos que no se hayan cargado. Las observaciones antiguas de la ficha se muestran como texto heredado y no se declaran reparadas automáticamente. Las fallas de capturas diferentes se conservan como observaciones independientes; su consolidación como un mismo daño conocido sigue pendiente de validación.

## Revisiones periódicas sin asignación

**Aclaración final del usuario:** nadie asignará revisiones. El mecánico puede realizarlas cuando quiera, antes o después del vencimiento, utilizando tipos existentes cuyos aspectos haya definido admin.

El mecánico entra a **Revisiones → Realizar revisiones periódicas** o al expediente de la unidad, evalúa los aspectos y guarda fecha/observaciones. No puede editar la plantilla ni inventar aspectos.

Al realizar la general, el próximo vencimiento se calcula **45 días desde la fecha de realización**, no desde el vencimiento anterior. Para salidas de emergencia se reinicia a 90 días. Si se supera el plazo, el sistema **solo muestra «Vencida»**: no bloquea la ejecución, no asigna tareas, no genera órdenes ni cambia la disponibilidad técnica. Una revisión anticipada también reinicia su contador desde su realización.

Cada captura genera su propio registro histórico, copia de plantilla, respuestas y actor. Los registros previos se conservan. El flujo de cierre único de casos pre/post sigue siendo independiente.

## Ejecución de órdenes

Las nuevas órdenes quedan **Lista para iniciar**, sin liberación de un tercero. Las antiguas «Pendiente de liberación» se conservan y pueden iniciarse directamente, sin borrar su estado histórico.

Estados de ejecución: `Lista para iniciar → En proceso ↔ Pausada → Finalizada`. La pausa exige motivo. Las acciones conservan autor, fecha y notas.

En el detalle se consultan datos completos, reporte original, servicios, responsables, instrucciones, materiales, estimaciones, confirmaciones y actividad. También se puede imprimir una requisición con cantidades y espacios para firmas.

Al terminar, se marcan solo servicios efectivamente realizados y se informa fecha/odómetro. Cada servicio no realizado exige explicación y permanece pendiente en el expediente. **CAF solo reinicia su referencia si ese servicio está entre los realizados.** Finalizar no autoriza circulación ni resuelve fallas automáticamente.

## Materiales y actualización de almacén

Almacén consulta órdenes y abre **Dar salida a materiales**. Se muestran estimaciones de consulta, total entregado y total devuelto por artículo.

- Las cantidades introducidas son **acumuladas**. Se guarda un movimiento nuevo solo por su diferencia respecto a lo confirmado anteriormente.
- Confirmar de nuevo los mismos números no descuenta nada y devuelve un aviso de ausencia de cambios.
- Las devoluciones no pueden superar lo entregado; los acumulados no pueden disminuir.
- Se impiden cantidades no válidas, piezas fraccionarias y existencias negativas.
- Existencia calculada: **entradas − entregas confirmadas + devoluciones confirmadas**.
- Si el artículo no tiene existencia, primero se registra una entrada real en almacén. No se precarga stock ficticio.
- El movimiento conserva actor, fecha, artículos y cantidades. Las entregas/devoluciones pueden capturarse después de finalizar el trabajo para respetar el proceso diferido ya descrito.

La salida y sus devoluciones viven dentro del mismo registro operativo que la orden. La existencia se deriva de ese historial y las entradas del catálogo; no se realiza un segundo descuento separado que pudiera quedar aplicado a medias. Esto no garantiza concurrencia entre pestañas ni sustituye una transacción PostgreSQL.

Los costos de salida/devolución usan un costo de referencia congelado por artículo y orden desde su primera entrega. Es una estimación histórica del prototipo, **no una decisión de valoración contable FIFO/promedio**. Mano de obra y gastos externos siguen pendientes.

Una corrección de cantidades equivocadas requiere un flujo explícito de ajustes/reversiones posterior; no se permite reescribir silenciosamente movimientos confirmados.

## Impresión

**Imprimir requisición** abre la impresión del navegador. Permite impresora o guardar en PDF. La hoja contiene orden, unidad, fecha, materiales, unidades, cantidades y firmas de solicitud/entrega/recepción. Imprimir no entrega materiales ni afecta existencias.

## Límites actuales

- Registros operativos en PostgreSQL, compartidos entre usuarios autorizados; consultar cambios ajenos al recargar. No hay actualización en vivo.
- Permisos, movimientos y auditoría operativos locales; falta su implementación autorizada en servidor.
- Sin evidencia fotográfica privada ni importación de historial de otros sistemas.
- Sin autorización de circulación automática.
- Datos previos preservados; los nuevos campos de órdenes y flota no requieren borrar almacenamiento.
