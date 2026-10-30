# Categorías de órdenes, confirmación de materiales e historial tabular

**Fecha:** 23 de octubre de 2026. Esta ampliación sustituye las reglas anteriores incompatibles. Se mantienen el login real y los registros operativos locales del prototipo.

## Órdenes y menú

- Se quitaron los contadores del menú lateral en **Órdenes de trabajo** y **Solicitudes de servicio**.
- Órdenes se organiza en **Pendientes**, **En proceso** y **Finalizadas**, sin contadores en las categorías.
- Pendientes contiene las listas para iniciar y las anteriores pendientes de liberación, que pueden iniciarse sin aprobación adicional.
- En proceso incluye trabajo iniciado y pausado. Pausada sigue siendo un estado visible de la orden, no otra categoría.
- Al finalizar correctamente, la orden deja las categorías activas y se abre **Finalizadas**. No se elimina ni duplica el registro.

## Materiales antes de finalizar

El usuario confirmó que se requiere **entrega confirmada por almacén**, y que la cantidad entregada **puede ser igual a la estimada**.

- Cada artículo requerido debe tener una entrega neta positiva confirmada: entregado menos devuelto mayor a cero.
- No se exige que la entrega difiera de la estimación ni que sea mayor que ella. Una entrega igual a la estimación es válida.
- El botón de terminar permanece deshabilitado y explica cuáles artículos faltan.
- La operación de finalización también vuelve a comprobar los registros actuales; no basta con habilitar el botón visualmente.
- Una orden sin materiales previstos no se bloquea por esta condición.
- Una entrega totalmente devuelta no cuenta como entrega neta positiva para finalizar.
- Las devoluciones posteriores al cierre pueden registrarse; no reabren automáticamente el trabajo ni borran la ejecución.
- Órdenes históricas ya finalizadas no se reabren ni se alteran retroactivamente.

Esta entrega no introduce un formulario obligatorio de consumo del mecánico: la condición acordada es la confirmación de entrega de almacén. El consumo detallado y la conciliación contable siguen pendientes.

## Cantidades de materiales necesarios en tipos de servicio

- Pieza: botones e incremento de **1 en 1**, mínimo una pieza.
- Litro: botones e incremento de **0.5 en 0.5**, mínimo medio litro.
- Se reemplazó el control nativo mal alineado por un control con botones menos/más y entrada numérica, junto a su unidad.
- La cantidad queda alineada con el artículo en escritorio; en pantallas estrechas ocupa su propia fila, sin quedar debajo del botón de cambiar artículo.
- Guardar un tipo de servicio valida cantidades positivas, piezas enteras y litros en múltiplos de 0.5.
- Esta regla corresponde a los materiales previstos de tipos de servicio. No cambia la precisión histórica de entradas o devoluciones de almacén.

## Entrada y precio unitario

Se muestran por separado cantidad y **costo unitario por pieza o litro**, con un total calculado en vivo:

```text
5 L × $100.00 MXN por L = $500.00 MXN
```

Se conserva `quantity = 5` y `unitCost = 100`. No se divide el precio unitario entre la cantidad ni se guarda 500 como costo de un litro. El total se deriva de ambos valores y también está disponible en el historial de entradas. No se introduce una política de valoración de inventario nueva.

## Historial por unidad (Autobús y Sprinter)

El resumen se muestra como tabla con fecha, categoría, revisión/servicio, estado, registro, responsable y detalles desplegables. No se eliminan reportes, respuestas, movimientos o notas anteriores.

Filtros combinables:

- Categoría: servicios, revisiones, solicitudes, materiales, incidencias, reparaciones o ajustes CAF.
- Estado de la revisión, caso, orden o incidencia.
- Tipo específico de revisión o servicio.
- Rango inclusivo de fechas desde/hasta.
- Texto de referencia, tipo, estado o responsable.

Para una realización se usa su fecha de ejecución; en otros eventos se usa su fecha registrada. Si el rango está invertido se informa al usuario, sin modificar sus registros.

### Tipo de revisión en el cierre

Los casos pre/post conservan el nombre y versión de la plantilla usados al capturar. El cierre y la fila del historial indican ese tipo, además de **Cierre de caso**. Las revisiones periódicas indican su tipo específico y estado **Realizada**. Cambiar el nombre del catálogo después no renombra las capturas históricas.

## Verificación

Se agregaron pruebas de categorías exclusivas y traslado a Finalizadas, ausencia de contadores laterales, bloqueo sin entrega y desbloqueo con entrega igual a la estimada, órdenes sin materiales, incrementos de cantidad, entrada 5 × 100, filtros combinados y tipo conservado en revisiones cerradas.

**Actualización 25/10/2026:** los controles de negocio actuales también se ejecutan en comandos autorizados y transacciones PostgreSQL, con revisión e idempotencia. La operación no usa persistencia del navegador. Sigue pendiente endurecer el MVP antes de producción; ver [etapa 02](backend-operacion-etapa-02.md).
