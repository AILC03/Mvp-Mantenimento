# Órdenes de mantenimiento — primera interfaz

**Estado:** prototipo funcional local solicitado por el usuario, iniciado por la creación de órdenes del mecánico principal. No conectado a la API ni a PostgreSQL.

**Aclaración posterior:** solo CAF es preventivo. Se eliminó la selección libre preventivo/correctivo; la clasificación se deriva de los servicios. También se agregó el flujo de solicitud del chofer → revisión del mecánico → orden vinculada o rechazo. Ver [aclaraciones vigentes](../proyecto/aclaraciones-servicios-y-solicitudes.md).

## Referencia y diseño propio

Atlas CMMS se utiliza como referencia conceptual para la separación entre órdenes, activos, servicios y materiales. La implementación es original: navegación lateral, formulario dividido en información general y servicios, con resumen contextual a la derecha. Identidad visual verde oscuro y tonos claros; el símbolo utilizado es ilustrativo, no un logotipo oficial de Real Ejecutivo.

No se extrajeron componentes de Atlas ni se modificó su código.

## Flujo

1. Elegir unidad (Autobús o Sprinter) y confirmar kilometraje registrado.
2. Indicar prioridad y motivo; programación opcional. La clasificación se deriva de los servicios agregados.
3. Agregar uno o varios servicios del catálogo ficticio.
4. Asignar responsable por servicio o dejar por asignar; ajustar instrucciones y horas.
5. Revisar materiales estimados, editar cantidades y agregar o retirar productos.
6. Consultar vista previa, guardar un borrador parcial o crear una orden local.
7. Ver la orden creada en el listado, pendiente de liberación.

La interfaz puede manejarse con teclado y se adapta a pantalla estrecha. Los diálogos usan el elemento nativo `dialog` para limitar foco y permitir Escape.

## Reglas representadas

- Una orden incluye múltiples servicios.
- Responsable e instrucciones se definen por servicio.
- No se obliga a checklist de taller para crear la orden.
- No se confunde crear con liberar o autorizar circulación.
- Los materiales son estimaciones: no representan entrega, consumo ni movimientos de inventario.
- Una orden necesita unidad, observaciones según el flujo, odómetro entero no negativo y al menos un servicio. Horas y cantidades deben ser positivas. Autobús y Sprinter usan las mismas reglas.

Las asignaciones pueden quedar pendientes porque se completarán antes de liberar. Esta decisión de interfaz debe validarse con el cliente. La programación no es obligatoria en este prototipo.

## Próxima integración

- Modelar órdenes, servicios, asignaciones y materiales en backend.
- Autenticar al usuario y verificar rol de mecánico principal en cada acción.
- Consultar unidades, catálogo, personal y precios desde API.
- Generar folio e identificador definitivo en servidor, dentro de una operación segura ante concurrencia.
- Revalidar todas las entradas en backend; no confiar en datos locales.
- Incorporar guardado real, idempotencia, estados y liberación con trazabilidad.
- Incorporar evidencias privadas e historial operativo de unidad.

Para pruebas del prototipo solo se utiliza almacenamiento del navegador, sin datos reales.
