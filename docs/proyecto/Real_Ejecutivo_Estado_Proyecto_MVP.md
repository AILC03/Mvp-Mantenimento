# Real Ejecutivo — Estado del proyecto y propuesta de MVP

**Versión:** 0.2 — documento de trabajo  
**Actualización:** 21 de octubre de 2026  
**Empresa:** Real Ejecutivo — https://autobusesrealejecutivo.com/  
**Propósito:** registrar lo conversado, las ideas para el prototipo funcional, los requerimientos de negocio preliminares (BR), las decisiones de arquitectura propuestas (ADR) y las dudas por validar. **No es una especificación aprobada por el cliente.**

## 1. Contexto y objetivo

Real Ejecutivo opera autobuses para transporte y renta. Cuenta con un CRM funcional, pero no tiene actualmente acceso al código fuente ni colaboración del desarrollador original. Existe además un software separado de tours, desarrollado por el equipo con el que se colabora. El nuevo sistema debe poder funcionar sin depender del CRM y estar preparado para integraciones posteriores.

**Objetivo del MVP:** permitir gestionar unidades, checklist de viaje, daños/incidencias conocidos, mantenimiento interno y externo, servicios de emergencia en carretera, materiales de almacén y sus costos, de forma suficientemente sencilla para probarlo con la operación real.

## 2. Roles de operación

| Rol | Responsabilidad esperada |
|---|---|
| Administrador de la empresa | Alta y gestión de usuarios; configuración administrativa |
| Operador/chofer | Crea un caso de checklist de viaje; realiza inspección pre y post viaje; registra nuevas anomalías físicas con evidencia |
| Mecánico principal (responsable de mantenimiento) | Revisa **todos** los checklists, determina incidencias y duplicados, administra órdenes y trabajos, asigna a carrocero/electricista o proveedores, autoriza intervenciones externas y decide disponibilidad técnica de autobuses |
| Mecánico, carrocero, eléctrico | Ejecutan servicios asignados, solicitan materiales mediante requisición física, registran trabajo/consumos/pausas y devoluciones |
| Almacenista | Entrega contra requisición física firmada; al final del turno registra salidas; registra entradas y confirma materiales devueltos |
| Prestador externo | Realiza reparación externa; el sistema registra proveedor, trabajo y costo; no necesita usuario del sistema para el MVP |

No existe un puesto separado de «jefe de mecánicos»: el mecánico principal coordina el trabajo.

## 3. Flujo A — Checklist de viaje por autobús

1. El operador selecciona **autobús** y crea un **Checklist de viaje**. Registra fechas e identificación del operador; otros detalles del viaje son opcionales. El caso no requiere un ID del sistema de tours.
2. Registra el checklist **pre-viaje**.
3. Al terminar, registra el checklist **post-viaje**; lo realiza el mismo operador.
4. El **mecánico principal revisa y valida todas** las inspecciones, incluso sin anomalías. Una vez cumplidas las tres etapas (pre, post, validación), el caso se cierra.
5. **Solo puede existir un caso abierto por autobús**. No se puede iniciar otro hasta que el mecánico cierre el anterior. Riesgo operativo a verificar durante pruebas: posibles retrasos en la siguiente salida.
6. El post-viaje es obligatorio dentro del proceso real; se indicó que su incumplimiento afecta el cobro del operador. **El MVP registra cumplimiento; no implementa nómina.**

### Contenido del checklist

Es una revisión de **carrocería, herramientas, equipamiento y artículos de limpieza**, y otros elementos físicos que indique el cliente. **No es el canal para reportar fallas mecánicas.**

Si el operador detecta una nueva anomalía, captura **parte del autobús, descripción y evidencia (fotografía)**, además del autobús, usuario, fecha y etapa pre/post asociados automáticamente.

Cada autobús contará con sección propia de **Checklist, historial de inspecciones e incidencias conocidas**. El operador podrá consultar daños ya registrados antes de revisar la unidad.

### Validación e incidencias

- El **mecánico**, no el sistema, compara nuevas observaciones con daños anteriores.
- Si el reporte corresponde a una incidencia ya conocida, **no vuelve a sus pendientes**. La observación histórica del checklist se conserva; no se borra el historial de lo declarado.
- Si el mecánico encuentra una anomalía no declarada o considera incorrecto el checklist, puede **dar por completada su revisión** y registrar una **incidencia del autobús** con parte, descripción, foto, fecha y operador vinculado.
- Distinguir **operador asociado al viaje** de **persona responsable de causar el daño**: no se debe atribuir culpa automáticamente.
- Una incidencia puede permanecer **meses sin reparación** si el mecánico determina que no impide operar. Sigue visible como daño conocido, pero no genera pendientes repetitivos en cada viaje.
- Para el MVP, si una incidencia conocida empeora, **no se crea automáticamente una orden ni otra incidencia**; conviene conservar la opción de evidencia/nota adicional si afecta seguridad. Confirmar tratamiento final.
- El mecánico decide si la incidencia **impide circular** y cuándo generar una orden de reparación.
- **Solo el mecánico** marca una incidencia como **resuelta**, registrándose su confirmación y fecha; no se exige fotografía o vinculación obligatoria con orden para resolverla.

**Distinción esencial:** el *caso de checklist* se cierra al concluir pre, post y validación; la *incidencia* es un registro independiente asociado al autobús y puede seguir abierta mucho después.

## 4. Flujo B — Mantenimiento y órdenes internas

### Tipos y origen

- **Preventivo:** por tiempo, kilometraje o criterio del mecánico. El sistema puede mostrar servicios próximos/vencidos; la precisión de alertas por km depende de capturas de odómetro (en servicios y/o checklists).
- **Correctivo:** ante fallas reportadas verbalmente o por un mecanismo digital futuro. El mecánico principal decide qué atender.

El mecánico principal puede crear una orden de forma manual, desde un preventivo próximo o desde una solicitud. El número visible propuesto es `BUS015-10-2026-0124` (unidad-mes-año-consecutivo de **orden**, no ID de servicio). Número generado automáticamente; identificador interno inmutable independiente.

### Catálogo y contenido de la orden

Una orden contiene **uno o varios servicios**. Solo el mecánico principal crea nuevos servicios permanentes en categorías como motor, frenos, carrocería o electricidad. Datos propuestos: nombre, descripción, categoría, materiales/cantidades estimadas, instrucciones, tiempo estimado y compatibilidad de unidad.

Datos de orden propuestos: unidad, motivo, tipo, fecha creación/programación, prioridad, odómetro, servicios, materiales estimados, encargado(s), estado y evidencia. Cada servicio puede asignarse al mecánico, carrocero o eléctrico bajo coordinación del mecánico principal.

### Asignación, liberación y ejecución

- El mecánico principal **asigna y libera** las órdenes; antes de la liberación el trabajador puede consultar, pero no iniciar.
- Panel del trabajador **Mis órdenes**: **en proceso, pausadas, pendientes**. Al abrir una orden se consultan detalles, materiales e **historial de la unidad** (servicios, diagnósticos, incidencias y fallas recurrentes).
- El trabajador puede **solicitar un servicio adicional**; el mecánico principal aprueba o rechaza. El mecánico principal también puede agregarlo directamente.
- Una pausa aplica a **toda la orden**, con reporte obligatorio (motivo, servicio asociado, descripción, responsable, fecha/hora, evidencia opcional).
- **Pausa del trabajador:** él puede reanudar. **Pausa/bloqueo del mecánico principal:** solo este puede liberar; su bloqueo prevalece.

### Finalización de la orden

El trabajador reporta:

1. **Servicios realizados:** marca únicamente casillas de los ejecutados; los no marcados requieren explicación.
2. **Materiales utilizados:** parte de cantidades previstas/entregadas, informa cuánto utilizó, cambios y materiales adicionales; registrar sobrantes.

**Se eliminó la propuesta de checklist obligatorio al finalizar una orden de mantenimiento.** Los checklists pre y post son del **viaje**, no de cada trabajo de taller.

### Cierre por excepciones

- Cuando se cumplen los servicios y no hay excepciones, la **orden puede cerrarse automáticamente**.
- Si faltó un servicio, cambiaron materiales o existe otra excepción, el mecánico principal revisa.
- Si falta un servicio, puede **cerrar sin nueva orden**, conservándolo pendiente, o **cerrar y crear una nueva orden relacionada**.
- Preventivos no realizados conservan su umbral de fecha/km; al superarlo aparecen **vencidos** en historial del autobús y pendientes del mecánico. Los correctivos pendientes permanecen abiertos hasta su resolución, con vencimiento cuando exista fecha objetivo.
- **Cerrar orden ≠ autorizar circulación.** Solo el mecánico principal decide si la unidad puede circular, con registro de fecha/usuario/observaciones y cumplimiento de requisitos de seguridad.

## 5. Flujo C — Almacén y requisición física

1. El trabajador lleva una **requisición física** con materiales solicitados para una orden/servicio.
2. Almacén entrega artículos y **firma/recibe** la requisición; el flujo físico se conserva.
3. El almacenista **captura las salidas al final de su turno**, no al entregar. Se acepta este flujo para el MVP porque la operación actual atiende un trabajo a la vez; el inventario mostrado puede quedar temporalmente desactualizado.
4. El sistema permite **registrar entradas** de almacén con producto, cantidad, unidad, precio/costo, fecha, proveedor y comprobante cuando exista.
5. Se conservan tres cantidades vinculadas al servicio/orden: **entregada, utilizada y devuelta**.
6. Al finalizar el trabajo, el trabajador informa lo usado y el sobrante. **Solo cuando exista material por devolver** se crea una devolución en estado **pendiente**; el almacenista verifica físicamente y cambia a **recibida/entregada a almacén** (etiqueta definitiva pendiente).
7. Si el almacenista aún no capturó la salida cuando llega la devolución, puede capturar **el consumo neto** al cierre de turno, manteniendo en el registro de la orden cuánto entregó, cuánto se utilizó y cuánto volvió. **No se exige número digital extra de requisición**.
8. Si la salida ya fue capturada, se necesita ajuste/devolución sin duplicar cantidades; definirlo durante el módulo de almacén.

Los artículos tendrán **costos históricos**, porque el objetivo es conocer inversión por servicio y autobús. Queda pendiente elegir valoración (promedio ponderado, lotes/FIFO), manejo de diferencias y compras por faltantes. Registrar fechas reales y fechas de captura ayuda a auditar el proceso diferido. Evitar doble descuento.

## 6. Flujo D — Reparaciones externas y en carretera

### Externas programadas

Se registran mediante **orden independiente**, coordinada/autorizada por el mecánico principal. Datos: **taller o proveedor, servicio solicitado, fechas, mano de obra, refacciones, costo total, factura/evidencia y garantía**. Vincular los gastos al historial del autobús.

### Emergencia en carretera

Es un **registro sencillo de reparación ya realizada**, **sin obligación de orden interna ni vínculo con checklist**. El **mecánico** captura la información cuando la recibe: autobús, fecha, prestador, descripción de falla, reparación realizada, **precio/costo**, fotografía del ticket, y opcionalmente kilometraje, ubicación y observaciones. Queda en historial y costos del autobús. Registrar el servicio no equivale a declarar la unidad segura para circular.

## 7. Historial, pendientes y costos

Por **autobús**: historial de checklists, incidencias activas/resueltas, mantenimientos, servicios faltantes, preventivos vencidos, reparaciones de carretera/externas y costos.

Pantalla **Pendientes** del mecánico principal: revisión de todos los checklists, posibles nuevas incidencias, solicitudes de trabajo, órdenes y servicios atrasados/vencidos, solicitudes de agregar servicios, cierres con excepciones y restricciones de circulación.

Reportes mínimos del MVP: costos de refacciones y servicios por **orden, autobús y periodo**; costos externos/carretera; listado de servicios pendientes/vencidos. Analítica avanzada puede esperar.

## 8. BR preliminares (para convertir luego en criterios de aceptación)

| ID | Requisito de negocio |
|---|---|
| BR-01 | Usuarios acceden con credenciales individuales; administrador gestiona empleados y roles. |
| BR-02 | Toda unidad posee ficha propia, historial, checklists e incidencias. |
| BR-03 | Operador crea checklist con autobús, operador y fechas; demás información del viaje opcional. |
| BR-04 | Cada checklist requiere pre, post y aprobación del mecánico; solo uno abierto por autobús. |
| BR-05 | El mecánico revisa **todas** las inspecciones y puede registrar incidencias, sin reabrir el checklist para corregirlo. |
| BR-06 | El operador ve incidencias conocidas; reporta nuevas con parte, descripción y foto. |
| BR-07 | Los daños reconocidos no generan pendientes repetidos; solo el mecánico los marca resueltos. |
| BR-08 | Una incidencia puede seguir abierta aunque el checklist del viaje esté cerrado. |
| BR-09 | El mecánico principal crea, asigna, libera, supervisa y revisa órdenes internas. |
| BR-10 | Una orden tiene múltiples servicios; los trabajadores pueden solicitar servicios adicionales. |
| BR-11 | Pausas requieren motivo; bloqueos del mecánico principal solo puede levantar él. |
| BR-12 | Al finalizar se identifican servicios realizados y cantidades utilizadas; excepciones se revisan. |
| BR-13 | Servicios no ejecutados permanecen pendientes/vencidos aunque se cierre la orden. |
| BR-14 | Solo el mecánico principal autoriza circulación; el cierre de orden es independiente. |
| BR-15 | Almacén registra entradas con costos y salidas diferidas al fin de turno a partir de requisiciones físicas. |
| BR-16 | Se documentan entregado, utilizado y devuelto; devolución positiva necesita confirmación física de almacén. |
| BR-17 | Órdenes externas independientes registran proveedor, fechas, desglose de costos, evidencia y garantía. |
| BR-18 | Reparaciones en carretera las registra el mecánico, asociadas a autobús sin checklist obligatorio. |
| BR-19 | El sistema presenta costos básicos e historial por unidad. |

## 9. ADR propuestos (no todos aprobados)

| ID | Decisión / estado | Justificación |
|---|---|---|
| ADR-01 | **Propuesta:** aplicación web responsiva para PC y móvil | Operadores en celular y personal en computadora; internet normalmente disponible |
| ADR-02 | **Propuesta:** sistema independiente del CRM | Sin acceso a su fuente; integraciones futuras por interfaces documentadas |
| ADR-03 | **Propuesta:** backend monolítico modular con API REST | MVP rápido sin complejidad de microservicios |
| ADR-04 | **Propuesta:** React + Vite + TypeScript para frontend | Interfaces compartidas y responsivas |
| ADR-05 | **Propuesta:** NestJS para reglas de negocio y permisos | Separación de dominios y validación centralizada |
| ADR-06 | **Propuesta:** PostgreSQL + Prisma | Relaciones, restricciones, transacciones, movimientos/costos |
| ADR-07 | **Propuesta:** almacenamiento privado de fotos/tickets (p. ej. Supabase Storage) | Archivos separados de la base de datos con control de accesos |
| ADR-08 | **Decisión funcional:** checklist e incidencia son entidades independientes | Caso de viaje se cierra aun con daño pendiente |
| ADR-09 | **Decisión funcional:** captura de salidas al finalizar turno | Respeta operación actual; exige control de consistencia |
| ADR-10 | **Propuesta:** restricción de unicidad para checklist abierto por unidad | Evitar duplicados incluso con solicitudes concurrentes |

**Stack recomendado para evaluación:** React + Vite + TypeScript; NestJS; PostgreSQL; Prisma; almacenamiento privado de imágenes, con proveedor por validar. La decisión final dependerá de la experiencia del equipo, presupuesto y operación.

## 10. Alcance de MVP crudo y fuera de alcance inicial

**Incluir, en versión sencilla:** login/roles, unidades, checklist pre/post con revisión, incidencias persistentes por autobús, órdenes internas, pausas, entrega/consumo/devolución de materiales, entradas/salidas con costos, órdenes externas, registro de carretera, historial y reportes básicos.

**Dejar para otra etapa salvo necesidad real:** integración al CRM o tours, telemetría/GPS, nómina, compras complejas, analítica avanzada, app nativa, automatismos sofisticados o flujos de múltiples almacenes.

## 11. Dudas y riesgos por validar en la prueba

- **Bloqueo de checklist:** ¿afecta la operación impedir otro caso mientras el mecánico no revise el anterior? Medir retrasos reales.
- **Catálogo de revisión:** elementos exactos de carrocería, herramientas, limpieza/equipamiento; criterios para fotos y su calidad.
- **Reporte de daños existentes:** qué hacer ante cambio significativo de un daño conocido sin generar duplicados ni ignorar un riesgo de seguridad.
- **Permisos reales:** nivel de acceso de carrocero/eléctrico y sustitución del mecánico principal si en el futuro falta.
- **Disponibilidad técnica:** reglas de bloqueo y autorización para circulación ante fallas críticas.
- **Almacén:** cómo capturar entregas, consumos y devoluciones cuando ocurren antes del registro de salida; fechas efectivas y reconciliación; discrepancias físicas.
- **Costo de materiales:** elegir modelo de valoración y cómo tratar sobrantes no reutilizables o artículos adicionales.
- **Mantenimiento preventivo:** periodicidades por modelo y fuente/frecuencia de kilometraje.
- **Formatos físicos:** obtener checklist actual, requisición física y ejemplo de orden de trabajo; adaptar pantallas a estos formatos.
- **Reparaciones externas:** quién aporta facturas, y cómo se registran garantías y pagos.
- **Datos iniciales:** inventario, autobuses, personal e incidencias anteriores; modo de importación.
- **Seguridad y operación:** respaldos, control de acceso a fotografías, auditoría y recuperación ante errores.

## 12. Siguientes pasos sugeridos

1. Recopilar formatos reales y probar en papel los flujos con operador, mecánico principal y almacenista.
2. Validar BR, clasificarlos por prioridad y establecer criterios de aceptación observables.
3. Aprobar ADR de arquitectura y escoger infraestructura según el equipo y costos.
4. Crear el esquema mínimo de datos y prototipos de pantallas.
5. Implementar un **circuito vertical completo**: autobús → checklist → incidencia → revisión del mecánico; después orden → almacén → cierre y costos.
6. Probar en operación con información controlada, registrar fricciones y decidir qué conservar o quitar.

---

> **Nota:** Este documento recoge lo conversado y validaciones preliminares. Las propuestas técnicas y reglas todavía pendientes no deben tratarse como compromisos finales del cliente.
