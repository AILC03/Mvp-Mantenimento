# Decisiones vigentes y pendientes — MVP Real Ejecutivo

Fecha: 28 de octubre de 2026. Fuente: aclaraciones directas del usuario posteriores a la revisión local.

Este documento sustituye únicamente los puntos incompatibles del alcance anterior. No convierte todas las brechas de la revisión en tareas obligatorias. Describe trabajo solicitado, no funcionalidades ya terminadas.

**Aclaración posterior del 30/10:** [Autobús y Sprinter de pasajeros](unidades-sprinter-2026-10-30.md). Las claves heredadas `truck`/`TRUCK` significan Sprinter, no carga. Ambas categorías participan en viajes, mantenimiento y circulación; esta aclaración elimina las exclusiones anteriores.

## 1. Incidencias conocidas: consulta y criterio humano

**Confirmado:** añadir un botón para consultar las incidencias ya marcadas de la unidad. El usuario decide qué reportar; no se requiere deduplicación automática.

Implementar acceso «Ver incidencias de la unidad» desde la captura pre/post, sin perder respuestas ni observaciones en edición. Mostrar inicialmente las activas, con consulta opcional de resueltas; incluir parte/aspecto, descripción, fecha y origen disponibles. Limitar la consulta a la unidad elegida y a los campos necesarios: el chofer no debe recibir costos, órdenes completas ni datos personales ajenos para poder consultar incidencias.

La regla vigente sigue siendo responder todos los aspectos de la revisión. No inventar una respuesta adicional «ya conocida», no suprimir fallas automáticamente y no reinterpretar una respuesta «Bien» como conformidad ante un daño. Si el usuario desea modificar esas respuestas o vincular reportes manualmente, será una ampliación posterior. Las fallas declaradas pueden seguir apareciendo como observaciones independientes; eso es una limitación aceptada del MVP.

Aceptación: el chofer abre/cierra la consulta de la unidad elegida, conserva su formulario y no puede resolver incidencias. Una unidad sin registros muestra un estado vacío claro. Las declaraciones históricas no cambian.

## 2. Carrocero y eléctrico: circuito físico

**Confirmado:** asignación física mediante formato impreso de la orden; requisición impresa; almacén registra movimientos al cierre; el mecánico finaliza con el flujo existente.

Conservar el responsable como información de la orden, sin exigir cuenta digital. Revisar la impresión existente de requisición y reutilizarla. Añadir impresión de orden si no existe: número, unidad, servicios, responsable, instrucciones y materiales estimados; sin menús ni controles de aplicación. Imprimir no cambia estados ni existencias.

No implementar panel TECHNICIAN, asignaciones autenticadas, solicitudes digitales de servicios adicionales ni jerarquía de bloqueos para esta entrega. Mantener pausas y reanudaciones actuales.

Aceptación: impresión legible, flujo de almacén conservado y finalización por mecánico sujeta a las validaciones actuales.

## 3. Evidencias y cuentas

**Confirmado:** fotos/comprobantes privados y administración completa de empleados quedan fuera de esta entrega. Mantener login individual y permisos existentes. No crear usuarios inseguros, eliminar autenticación ni añadir un selector de perfiles de demostración a la aplicación real.

## 4. Servicios externos y reparaciones de carretera

**Confirmado:** admin o mecánico registran el servicio realizado en una unidad, prestador y costos. No hay artículos ni movimientos de almacén. El registro queda en el historial de la unidad; la acumulación/reportes de costos por unidad se desarrollarán en el proyecto real.

Campos mínimos para este MVP: unidad, tipo (externo/carretera), fecha del servicio, descripción de lo realizado, nombre de empresa/persona, costo de materiales, costo de mano de obra y observaciones opcionales. La fecha/autor de captura se generan en servidor. Total derivado = materiales + mano de obra; no aceptar un total independiente inconsistente. Usar la moneda actual del producto y no añadir conversión de divisas.

Validar unidad existente, fecha real no futura, descripción/prestador no vacíos, costos no negativos con precisión monetaria de dos decimales. Permitir cero sin inventar un costo. Persistir y mostrar el registro con sus importes y responsable en el expediente de esa unidad. No exigir orden interna ni checklist.

No incorporar proveedores como catálogo obligatorio, garantías, facturas, pagos, compras, autorización previa, evidencia adjunta ni reportes consolidados de costos en esta entrega.

**Interpretación explícita del alcance:** los dos importes anteriores aplican al registro externo descrito por el usuario. La instrucción posterior «no añadiremos gastos externos ni mano de obra» se aplica a la ampliación del módulo de órdenes internas/materiales. No agregar esos conceptos a órdenes internas ni descontar inventario desde un registro externo. Si el usuario cambia esta distinción, actualizar este documento antes de cambiar el comportamiento.

Aceptación: admin/mecánico pueden registrar, chofer/almacén no; recargar conserva el registro; no cambia stock ni costo histórico interno; el historial muestra únicamente registros de la unidad elegida. Registrar un servicio no autoriza circulación ni resuelve incidencias automáticamente.

## 5. Permiso de circulación y resumen administrativo

**Confirmado:** control sencillo para aprobar/denegar circulación y resumen de unidades no disponibles que admin pueda fotografiar y compartir manualmente.

**Criterios de implementación adoptados para concretar lo solicitado:** admin y mecánico pueden registrar la decisión. El estado inicial es «Sin evaluar»; solo una decisión explícita produce «Autorizado» o «No autorizado». Mantener actor/fecha e historial de cambios. Usar una casilla o control equivalente con texto inequívoco; consultar la ficha no guarda decisiones y desmarcar antes de guardar no debe alterar datos.

El resumen del admin lista unidades «No autorizadas» y, en grupo claramente separado, «Sin evaluar», sin declarar estas últimas como autorizadas ni como denegaciones técnicas. Incluye Autobús y Sprinter, mostrando tipo, número económico, identificación útil, estado y fecha de decisión cuando exista. Se mantienen las etiquetas de grupos «No autorizados» y «Sin evaluar». No excluir Sprinter. Mantener una presentación compacta y legible para captura de pantalla; no implementar envío automático, mensajería ni contactos.

No permitir que terminar órdenes, registrar reparaciones, cerrar viajes o vencer revisiones modifique automáticamente el permiso. No agregar bloqueos de viajes distintos del caso abierto existente.

Aceptación: cambios autorizados persisten tras recarga y aparecen en el resumen; chofer/almacén no pueden cambiarlos; una unidad nueva no aparece autorizada; historial conserva cambios previos. Probar especialmente autorizado → no autorizado y el caso sin decisión.

## 6. Almacén y costos internos

**Confirmado:** no habrá entregas fuera de turno. Se conserva la captura al cierre del turno, las entradas y las entregas/devoluciones actuales. No desarrollar turnos, entregas extraordinarias, consumo detallado obligatorio, mano de obra interna, gastos externos en órdenes internas ni valoración contable nueva.

Mantener entrega neta positiva por artículo antes de finalizar, cantidades acumuladas, prevención de existencias negativas y costos históricos de referencia. No inferir consumo certificado como un hecho distinto de entrega neta.

## 7. Corrección técnica prioritaria

La revisión reprodujo cierre de orden con odómetro 1 cuando la orden se creó con 1,000. Corregir la regla en servidor y UI: el odómetro de ejecución no puede ser menor al de apertura de esa orden. No imponer el máximo global de lecturas posteriores como mínimo para una ejecución histórica, pues impediría capturas diferidas válidas. Conservar órdenes históricas existentes; no corregir sus lecturas automáticamente.

Esta es una corrección técnica propuesta, no una nueva función acordada. Se incluye en el encargo para OpenCode como validación de integridad del cierre.

## 8. Fuera de esta entrega

Normalización integral del JSONB, actualización en vivo, rediseño completo, infraestructura productiva, nuevas dependencias mayores, paneles técnicos, deduplicación automática, fotos, gestión completa de empleados y reportes acumulados de costos. Documentar limitaciones, sin tratarlas como bloqueantes para completar este encargo.

## 9. Orden de trabajo y trazabilidad

1. Revisar código y pruebas existentes, sin asumir que los documentos antiguos describen la implementación vigente.
2. Consulta de incidencias e impresos.
3. Registro externo/carretera persistente.
4. Permiso de circulación y resumen.
5. Corrección del odómetro y verificación transversal.
6. Actualizar README, estado e índice; registrar qué se implementó y qué se probó.

Los criterios de implementación aquí identificados se pueden ajustar por instrucción del usuario; no deben atribuirse como decisiones expresamente confirmadas por él.

## 10. Ajustes posteriores solicitados el 29/10/2026

- Consulta de incidencias de viaje en **ventana emergente**, no desplegada en el formulario; conservar respuestas/notas y cerrar solo la consulta.
- Revisar carga de unidades al iniciar un caso: consultar el catálogo vigente al abrir, con carga/error/reintento explícitos y sin perder las fechas capturadas. Desde la aclaración del 30/10 se incluyen Autobús y Sprinter sin cambiar claves ni identificadores guardados.
- Retirar la vista previa del resumen de circulación en Unidades. Mostrar sus grupos únicamente al pulsar **Resumen del estado de circulación de las unidades**.

Estas instrucciones posteriores sustituyen la presentación anterior incompatible. Ver resultados en la [entrega y ajustes verificados](entrega-alcance-mvp-2026-10-28.md).
