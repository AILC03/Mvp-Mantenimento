# Altas de artículos, unidades, servicios y revisiones

**Fecha:** 21 de octubre de 2026.  
**Origen:** ampliación solicitada por el usuario. Complementa el documento original y las aclaraciones de CAF y solicitudes.

## Requerimientos indicados

- Dar de alta artículos del almacén, sin categorías por ahora, medidos en **pieza o litro**.
- Dar de alta autobuses con los datos previstos.
- Dar de alta tipos de servicio.
- Dar de alta tipos de revisión con aspectos escritos por el usuario; cada aspecto tendrá las opciones **Bien / Con falla**.
- Dar de alta Sprinter de pasajeros, categoría distinta de Autobús. La aclaración del 30/10 sustituye la denominación anterior: las claves `truck`/`TRUCK` se conservan por compatibilidad y significan Sprinter, no carga.

## Interfaz implementada

Las nuevas secciones son «Unidades», «Artículos de almacén», «Tipos de servicio» y «Tipos de revisión». En esta etapa se habilitan desde el perfil de mecánico demo. La matriz definitiva de permisos de administrador, mecánico y almacén debe definirse en backend; el selector demo no constituye autenticación.

### Artículos y entradas

- Código único, nombre, descripción y unidad pieza/litro. Sin campo de categoría.
- Entrada inicial opcional: cantidad, costo unitario MXN, fecha, proveedor y referencia de factura/ticket si existe.
- Entradas posteriores separadas, conservando su costo unitario y fecha de captura además de la fecha efectiva.
- Piezas enteras; litros admiten decimales. Costos no negativos, con máximo dos decimales en entradas.
- Código y descripción editables; unidad de medida fija tras el alta para no reinterpretar cantidades anteriores.
- Una nueva entrada actualiza el último costo de referencia, sin modificar las entradas anteriores.
- El listado muestra la suma de entradas registradas, no inventario operativo disponible. Todavía no incorpora salidas, consumos o devoluciones.
- Comprobantes: por ahora solo referencia de texto; el archivo privado se implementará con backend y almacenamiento autorizado.

Valoración de inventario, desperdicios, conciliación y compras siguen pendientes; no se aplicó FIFO o promedio ponderado como decisión implícita.

### Unidades: Autobús y Sprinter

- Un catálogo común con tipo **Autobús/Sprinter** y posibilidad de filtrar. Ambas categorías participan en todos los flujos.
- Identificador interno estable independiente del número económico en nuevas unidades.
- Número económico, tipo y odómetro obligatorios en el prototipo.
- Marca, modelo, año, placas, VIN/serie y observaciones; datos identificativos no disponibles pueden quedar vacíos.
- Validación de unicidad de número económico, placas y VIN sin distinguir mayúsculas. VIN opcional de 17 caracteres válidos.
- No existe aprobación técnica implícita por registrar o editar una unidad.
- Las nuevas unidades aparecen en solicitudes del chofer y órdenes del mecánico. Las observaciones de ficha no sustituyen registros de incidencias.

Los datos originales conservan sus identificadores y relaciones. La operación vigente usa JSONB; `truck`/`TRUCK` se interpretan como Sprinter sin cambiar IDs ni generar unidades nuevas. No se requiere migración de valores. Ver [compatibilidad y alcance vigente](unidades-sprinter-2026-10-30.md).

### Tipos de servicio

- Nombre, categoría del servicio, descripción/instrucciones, horas estimadas, materiales y cantidades necesarias.
- La exclusión de categorías solicitada se aplica a artículos; se conserva la categoría de servicio propuesta anteriormente (motor, frenos, etc.).
- Materiales predeterminados agregables, editables y removibles; se seleccionan desde artículos registrados.
- Compatibilidad por unidades concretas; ninguna seleccionada significa todas. No se implementó inferencia por modelo o fabricante.
- CAF sigue siendo el único preventivo y no se permite crear otro CAF. Los nuevos tipos son correctivos.
- Se pueden editar los materiales predeterminados de CAF para próximas órdenes.
- Las nuevas definiciones están disponibles al agregar servicios a una orden. Se valida compatibilidad al agregar y al guardar.
- Los materiales de órdenes nuevas conservan un costo estimado de referencia como copia, para que futuras entradas no cambien su estimación histórica. No equivale al costo contable final del consumo.

### Tipos de revisión

- Nombre, instrucciones, frecuencia por días/anual/por viaje y aspectos con identificadores propios.
- Se mantienen las cuatro plantillas base: general 45 días, salidas de emergencia 90 días, anual y por viaje.
- Las plantillas base no contienen aspectos inventados. El usuario los escribe mediante edición o crea un tipo nuevo.
- Para guardar una plantilla se exige al menos un aspecto no vacío; no se aceptan textos duplicados en la misma revisión.
- Al editar se incrementa la versión de definición. Las inspecciones futuras deberán conservar la versión y sus aspectos, no depender de una plantilla mutable.
- «Probar formato» permite marcar **Bien** o **Con falla** por aspecto, con apariencia de casilla y comportamiento excluyente. No permite ambas a la vez.
- Esa prueba **no guarda respuestas ni genera una revisión realizada**, ni modifica la condición técnica. El registro operativo de resultados, fallas y evidencias requiere otro flujo.

## Persistencia y límites

**Actualización 25/10/2026:** las altas actuales se guardan mediante comandos autorizados en PostgreSQL. La clave histórica `real-ejecutivo.demo.catalogs.v1` solo se consulta por acciones explícitas de migración, nunca como persistencia activa. Ver [etapa 02](backend-operacion-etapa-02.md); no se borran ni importan datos antiguos automáticamente.

No hay API, autenticación real, datos compartidos entre equipos ni persistencia PostgreSQL de estos catálogos. No ingresar información real o sensible. No hay eliminación definitiva de artículos/unidades/tipos; se evita romper referencias. Archivo/bajas y permisos se definirán después.

## Próximos pasos

Modelos y migraciones backend para unidades tipadas, artículos, entradas, catálogo de servicios, plantillas versionadas y resultados reales. Integrar permisos, transacciones, costos decimales, evidencias privadas y auditoría. Validar los formatos y reglas de obligatoriedad con la operación antes de considerarlos especificación final.
