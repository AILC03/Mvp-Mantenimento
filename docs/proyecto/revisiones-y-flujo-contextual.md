# Revisiones pre/post viaje y creación contextual de servicios

**Fecha:** 22 de octubre de 2026. Ampliación solicitada por el usuario; complementa las aclaraciones anteriores sin modificar el documento original.

## Revisiones: caso pre y post trip

**Ampliación verificada el 29/10:** botón **Ver incidencias de la unidad** durante captura, activas inicialmente y resueltas a petición. Conserva respuestas/notas, sin deduplicar ni añadir respuestas. Consulta específica autorizada y mínima; no se entrega al chofer el expediente completo. Ver [entrega](entrega-alcance-mvp-2026-10-28.md).

**Ajuste posterior del 29/10:** la consulta se abre en ventana emergente independiente, no desplegada dentro del formulario. Cerrar la consulta no cierra la revisión ni pierde sus respuestas. Al iniciar un caso se actualiza el catálogo autorizado desde la API, con carga/error/reintento y estado vacío; no es necesario salir y volver a iniciar sesión para ver autobuses recién registrados. El reintento conserva las fechas.

- Nueva opción lateral **Revisiones**, distinta de **Tipos de revisión**.
- Siguiendo el flujo previamente definido, el chofer inicia el caso y el mismo chofer captura ambas etapas. Mecánico principal y administrador consultan los casos y realizan su revisión/cierre. Almacén no accede a este flujo.
- Alta del caso: unidad (Autobús o Sprinter), fecha de ida y fecha de regreso. Regreso igual o posterior a ida. La [aclaración del 30/10](unidades-sprinter-2026-10-30.md) sustituye la exclusión anterior: `truck` representa Sprinter de pasajeros y también puede viajar.
- Se conserva un único caso abierto por unidad, incluso si todavía espera cierre del mecánico. Evaluar su impacto en salidas consecutivas durante la prueba operativa.
- Primero se realiza pre trip; después post trip. Cada aspecto exige una respuesta: **Bien** o **Con falla**, excluyentes y sin valores preseleccionados.
- Las capturas enviadas no se editan ni se reemplazan. Se conservan autor, fecha y observaciones.
- El caso se envía automáticamente a **Pendiente de revisión** únicamente cuando ambas capturas se guardan correctamente. Una sola captura no basta.
- Solo mecánico principal o administrador pueden finalizar un caso con ambas etapas completas.
- El único resultado final es **Cierre de caso**. No hay aprobación/rechazo ni cierre negativo. Las fallas declaradas se conservan aunque se cierre el caso.
- Cerrar no resuelve incidencias, no genera automáticamente órdenes y no autoriza circulación.

### Estados operativos

`Pre trip pendiente` → `Post trip pendiente` → `Pendiente de revisión` → **`Cierre de caso`**.

Los tres primeros identifican trabajo pendiente; no son variantes de cierre. El registro final conserva quién cerró, cuándo y observaciones opcionales.

### Formato de evaluación

Se utilizan tipos de revisión con periodicidad **Cada viaje** y aspectos definidos por el usuario. No se inventaron puntos de verificación. El caso se puede iniciar sin formato configurado, pero antes de enviar pre trip un mecánico/admin debe definir los aspectos en **Tipos de revisión**.

Al enviar pre trip, se conserva una copia de la plantilla, versión, instrucciones e identificadores de aspectos. Post trip utiliza esa misma copia, aunque el catálogo cambie después. La vista de post muestra la respuesta pre como referencia, pero no la copia automáticamente como respuesta post.

**Actualización 25/10/2026:** casos e incidencias/reparaciones actuales ya persisten en PostgreSQL. Fotos y notificaciones automáticas siguen pendientes. Este circuito no implica implementar todas las reglas del documento original; ver [etapa 02](backend-operacion-etapa-02.md).

## Crear un servicio desde una orden sin perderla

En **Agregar servicio** se incluye **Crear nuevo servicio**:

1. Se abre la pantalla de alta con un contexto explícito de retorno a esa orden.
2. Se conservan en el espacio de trabajo los datos capturados: unidad, solicitud, prioridad, fechas, odómetro, servicios, responsables, instrucciones y materiales.
3. Guardar crea el servicio en el catálogo y regresa a la orden. Se agrega el nuevo servicio si es compatible con la unidad; si no, se avisa sin perder la orden ni agregar un servicio inválido.
4. Cancelar o **Volver a la orden** regresa sin agregar un servicio.
5. Entrar por **Tipos de servicio** es independiente: guardar cierra su formulario y permanece en el catálogo. No se activa un retorno por haber creado otro servicio antes desde una orden.
6. Cambiar de sección limpia el contexto de retorno. El listado de órdenes permite **Retomar orden en edición** sin crear una orden vacía por accidente.

La conservación durante este recorrido es en memoria del componente. Para conservar datos ante recarga/cierre de pestaña se sigue usando **Guardar borrador**. No se sobrescriben automáticamente los borradores existentes.

## Identificador de solicitud en la orden

Se reemplazó **Motivo de la orden** por **Identificador de la solicitud** y acceso **Ver reporte**. La vista del reporte es de solo lectura y conserva asunto, descripción, chofer, fecha, unidad y odómetro reportado. No se copia el reporte completo a un motivo editable.

Las órdenes manuales siguen permitidas, incluyendo CAF programado: se identifica **Sin solicitud · Orden manual**, con observaciones opcionales. No se hizo obligatoria una solicitud para procesos que antes podían iniciarse manualmente.

Las solicitudes atendidas no se pueden seleccionar como pendientes. Guardar una orden vinculada conserva las comprobaciones de estado y unidad ya existentes. Datos históricos `reason` y borradores anteriores se preservan por compatibilidad; no se eliminaron registros.

## Materiales necesarios: vista de almacén

- **Agregar material necesario** abre un selector de almacén con búsqueda por nombre o código, sin distinguir mayúsculas o acentos.
- Se muestran 20 resultados por página, no miles de opciones de un `select`.
- La selección múltiple se conserva al buscar/cambiar de página. Los artículos ya agregados se señalan y no se duplican.
- Confirmar agrega los elegidos; cancelar no modifica los materiales del servicio.
- Se pueden ajustar cantidades, quitar materiales y **Cambiar artículo** usando la misma búsqueda.
- Se muestran unidad y costo de referencia, con entradas de demostración; seleccionar no reserva ni descuenta inventario.
- Los diálogos anidados tienen identificadores accesibles independientes; cerrar el buscador no debe cerrar el editor de servicio.

La búsqueda y paginación son locales. La búsqueda paginada en API se implementará al integrar el almacén real.

## Persistencia y límites

Login, sesiones y casos de viaje usan backend/PostgreSQL. `real-ejecutivo.demo.trip-cases.v1` es una clave histórica consultada solo por migración explícita; no es almacenamiento activo. No hay eliminación ni reasignación automática de datos anteriores.

Los registros operativos actuales usan comandos autorizados, transacciones PostgreSQL y control de revisión. Se comparten entre dispositivos mediante recarga; no hay actualización en vivo. Las copias antiguas requieren respaldo/importación explícitos y no se usan para operar. No ingresar información sensible hasta completar la preparación de producción.

## Verificación

Pruebas del ciclo pre/post/cierre, permisos, fechas, caso abierto único, plantilla histórica, conservación del reporte, retorno contextual y alta directa independiente. Prueba del buscador con 3000 artículos para limitar el número de opciones renderizadas.
