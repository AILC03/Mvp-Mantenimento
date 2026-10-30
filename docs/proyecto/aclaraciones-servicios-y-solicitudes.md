# Aclaraciones: CAF, revisiones y solicitudes de servicio

**Fecha:** 21 de octubre de 2026.  
**Origen:** indicaciones posteriores del usuario. Complementa el documento original v0.2, que se conserva sin cambios. En los puntos siguientes, estas aclaraciones sustituyen las propuestas anteriores.

## 1. Único servicio preventivo

- El único servicio preventivo es **CAF: cambio de aceite y filtro**.
- Los materiales necesarios del servicio podrán agregarse, editarse y quitarse.
- El prototipo permite estos cambios en los materiales estimados de cada servicio dentro de una orden. La administración de materiales predeterminados del catálogo sigue pendiente.
- La periodicidad específica de CAF no se ha definido en esta aclaración; no inventar intervalos.
- La clasificación en la interfaz se obtiene de los servicios: no permite marcar cualquier trabajo como preventivo mediante un selector libre.

Si una orden contiene CAF y correctivos, el resumen dice «CAF + correctivos»; es una descripción de su contenido, no una nueva categoría de servicio aprobada.

## 2. Revisiones independientes

| Revisión | Frecuencia indicada |
|---|---|
| General | Cada 45 días |
| Salidas de emergencia | Cada 90 días |
| Anual | Anual |
| De viaje | Cada viaje |

Los puntos que se verifican en cada revisión se definirán después. No se crearon listas de verificación, alertas, órdenes automáticas ni vencimientos basados en supuestos. También falta definir el punto de partida de los intervalos y la relación exacta entre revisión de viaje y checklist pre/post existente.

## 3. Flujo solicitado y aclarado

1. El usuario chofer reporta una **solicitud de servicio** asociada a una unidad (Autobús o Sprinter de pasajeros).
2. El mecánico principal revisa el reporte.
3. Puede **crear una orden de mantenimiento vinculada** a esa solicitud, o rechazarla.

Ante la pregunta de si el mecánico crearía otra solicitud o una orden, el usuario confirmó **crear orden de mantenimiento**.

La solicitud es independiente del checklist de viaje y no es todavía una orden. El reporte original del chofer se conserva aunque el mecánico edite el motivo de la orden.

### Estados representados

- Pendiente de revisión: solicitud enviada, aún sin decisión.
- Con orden creada: existe una orden vinculada; no significa que el trabajo haya terminado.
- Rechazada: se conserva el motivo, responsable y fecha de revisión.

Preparar el formulario no cambia el estado. La solicitud solo pasa a «con orden» cuando se guarda la orden correctamente. Cancelar o fallar al guardar no debe darla por atendida. No se permite una segunda conversión ni rechazar una solicitud ya atendida dentro del flujo implementado.

## 4. Prototipo frontend

- Selector de perfiles **demo**, sin autenticación: chofer y mecánico principal.
- Chofer: selección de unidad, asunto, descripción y kilometraje opcional; consulta de sus solicitudes y resultado.
- Mecánico: bandeja con filtros, detalle, preparación de orden y rechazo con motivo obligatorio.
- Al preparar una orden, se conserva el vínculo, la unidad del reporte y el kilometraje informado. Si no hay kilometraje, el mecánico debe capturarlo antes de crear la orden.
- La orden sigue pendiente de liberación; ni enviar, convertir ni rechazar autorizan circulación.
- Los perfiles no son una medida de seguridad. El backend deberá autenticar y autorizar cada acción y limitar la consulta del chofer a sus propios reportes.

Todo se conserva localmente en este navegador. Orden y revisión de solicitud se escriben juntas en un único registro local para evitar estados parciales ante errores de almacenamiento. Esto no sustituye una transacción de PostgreSQL ni resuelve concurrencia entre navegadores o pestañas.

La clave nueva es `real-ejecutivo.demo.workbench.v2`. Se leen órdenes de la clave anterior como compatibilidad cuando no hay un registro nuevo; no se borran las claves anteriores. No ingresar datos reales.

## 5. Siguiente implementación real

Modelar solicitudes y órdenes en backend; agregar autenticación y permisos, persistencia PostgreSQL, transacciones para la conversión, validación de estados e idempotencia. El esquema inicial de checklists/incidencias no implementa todavía este flujo.

Fotos, avisos reales, gestión de catálogo, programación de revisiones y puntos de verificación quedan pendientes. No inventar su comportamiento como si ya estuviera aprobado.
