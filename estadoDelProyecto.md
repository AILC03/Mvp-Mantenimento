# Real Ejecutivo — Estado del proyecto

**Actualización:** 25 de octubre de 2026.  
**Estado general:** MVP en desarrollo. Autenticación y flujos operativos conectados a backend/PostgreSQL, sin persistencia operativa en localStorage. **No está listo para producción.**

**Avance más reciente:** todos los módulos actuales y los borradores guardados usan `/api/operations`. Reglas compartidas en `shared/src`, comandos autorizados, transacciones, revisión/idempotencia y auditoría en PostgreSQL. La persistencia del MVP es un agregado JSONB versionado, no todavía tablas normalizadas para cada entidad. Los datos antiguos no se importaron ni borraron automáticamente: admin dispone de respaldo, revisión/importación y retiro confirmado de copias antiguas. Ver [etapa 02, arquitectura, pruebas y migración](docs/proyecto/backend-operacion-etapa-02.md), que sustituye el estado de la etapa 01.

## 1. Objetivo

**Diseño, consistencia transversal:** se corrigió la diferencia entre Solicitudes y los demás módulos con `frontend/src/styles/workspace.css`. Órdenes, catálogos, almacén, revisiones, expediente, formularios y diálogos comparten ahora tipografía, controles, colores y espaciado. Revisión de 115 combinaciones en navegador (cuatro perfiles, 320–1440 px), sin desbordamientos de página en los casos comprobados. Se añadieron regiones de tablas enfocables con teclado. No cambió la lógica de negocio. Ver [detalle de la iteración 03](docs/diseno/iteracion-03-consistencia-aplicacion.md).

**Diseño, primera iteración:** navegación común y página principal de Solicitudes con tipografía legible, contraste, espaciado consistente y adaptación móvil. Se usaron las guías de UI UX Pro Max conservando CSS propio, marca y lógica de negocio. Ver [alcance y verificaciones](docs/diseno/iteracion-01-pagina-principal.md) y `design-system/real-ejecutivo/MASTER.md`. Las pantallas restantes se migrarán gradualmente.

**Ajustes más recientes:** órdenes por categorías Pendientes/En proceso/Finalizadas sin contadores; bloqueo de finalización hasta entrega confirmada por almacén (puede igualar lo estimado); cantidades previstas de 1 por pieza y 0.5 por litro; entradas con total cantidad × costo unitario; historial tabular por unidad con filtros y tipo de revisión. Ver [reglas vigentes de esta ampliación](docs/proyecto/ordenes-categorias-historial-cantidades.md).

**Última ampliación:** expediente de cada autobús, CAF cada **15,000 km**, revisión general cada **45 días** (confirmado por el usuario, no 40) y salidas de emergencia cada **90 días**. Órdenes con ejecución sin liberación de terceros, requisición imprimible y entregas/devoluciones confirmadas por almacén. Solo admin modifica información de unidades y tipos de revisión. Ver [detalle vigente](docs/proyecto/historial-ordenes-almacen-permisos.md).

Gestionar unidades, solicitudes de servicio, órdenes de mantenimiento, materiales de almacén y revisiones de viaje de Real Ejecutivo, sin depender del CRM ni del sistema de tours existentes.

El documento original de requerimientos se conserva sin modificaciones. Las aclaraciones posteriores se encuentran en `docs/proyecto/`; las propuestas pendientes no deben tratarse como acuerdos finales con el cliente.

## 2. Ubicación y estructura

Ruta del proyecto:

```text
C:\Users\angel\OneDrive\Documentos\RealEjectuvoMantenimirntoMVP
```

```text
backend/                 Proyecto independiente NestJS + TypeScript
  prisma/                Esquema, migraciones y usuarios de prueba
  src/auth/              Login, sesiones y guardas de acceso
  src/database/          Integración de Prisma
  src/operations/        Comandos, permisos, persistencia y migración
  test/                  Pruebas HTTP
frontend/                Proyecto independiente React + Vite + TypeScript
  src/components/        Formularios y pantallas
  src/testing/           Utilidades exclusivas de pruebas
shared/                  Reglas y tipos propios usados por frontend/backend
docs/                    Requisitos, aclaraciones, diseño y operación
estadoDelProyecto.md     Este resumen
```

Backend y frontend tienen sus propias dependencias y comandos. No se utiliza una configuración de monorepo.

## 3. Qué usa realmente PostgreSQL

| Funcionalidad | Persistencia actual |
|---|---|
| Usuarios, contraseñas derivadas y roles | PostgreSQL |
| Sesiones, expiración y revocación al salir | PostgreSQL |
| Unidades, artículos y entradas/costos | PostgreSQL, comandos del servidor |
| Tipos de servicio y materiales previstos | PostgreSQL |
| Tipos de revisión y aspectos/versiones | PostgreSQL |
| Solicitudes, órdenes y ejecución | PostgreSQL |
| Movimientos de almacén, expediente, incidencias y CAF | PostgreSQL |
| Casos pre/post trip y cierre | PostgreSQL |
| Borradores guardados | PostgreSQL, privados por usuario |
| Formulario aún sin guardar y retorno contextual | Memoria efímera; guardar borrador antes de cerrar |
| Copias antiguas del prototipo | Solo fuente de migración explícita; no se usan para operar |

**Importante:** los guardados ya se verifican en el servidor y se comparten entre usuarios autorizados; recargar permite consultar cambios ajenos, no hay actualización en vivo. Si falla la API no se guarda en el navegador ni se anuncia éxito. Antes de crear registros nuevos, revisar la migración de datos antiguos: la importación automática sobre una base no vacía se rechaza para no perder datos. Sigue siendo un MVP, no un sistema productivo endurecido.

## 4. Backend y base de datos

### Implementado

- NestJS 11, TypeScript y configuración por variables de entorno.
- Prisma 6.19.3 y configuración local de PostgreSQL 17 mediante Docker Compose.
- Cinco migraciones aplicadas; las dos últimas amplían unidades y añaden estado operativo JSONB, borradores y auditoría sin eliminar datos.
- Esquema inicial con usuarios, autobuses, checklists, inspecciones, observaciones, incidencias y decisiones técnicas.
- Índice SQL parcial para un checklist abierto por autobús y restricciones básicas de integridad.
- Autenticación con nombre de usuario independiente del correo opcional.
- Contraseñas con `scrypt`, sal aleatoria y comparación de tiempo constante.
- Sesiones opacas con token aleatorio; la base conserva solo su hash y expiración.
- Cookie `HttpOnly`, `SameSite=Strict`, duración de ocho horas y `Secure` en producción.
- Comprobación de usuario activo y expiración en endpoints autenticados.
- Validación de origen para login/logout y limitación de intentos de acceso.
- Guardas de autenticación y rol disponibles para futuros módulos.

### Endpoints actuales

| Método | Ruta | Función |
|---|---|---|
| GET | `/health` | Salud del proceso HTTP |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Consultar usuario y expiración de sesión |
| POST | `/api/auth/logout` | Revocar sesión y limpiar cookie |
| GET | `/api/auth/users` | Listar usuarios; solo administrador |
| GET | `/api/operations` | Datos autorizados, revisión y borrador propio |
| POST | `/api/operations/commands` | Comando validado y transaccional |
| POST | `/api/operations/import` | Importación confirmada de históricos; solo admin |

La API operativa está integrada. Aún no hay interfaz para administrar cuentas, recuperar o cambiar contraseñas. POST/PUT antiguos de `/api/vehicles` responden 410; GET lee la fuente operativa vigente.

El esquema inicial Bus/inspecciones se conserva; el circuito vigente usa OperationState/OperationDraft/OperationEvent. Queda pendiente normalizar por entidad e indexar/paginar al escalar, sin crear dos fuentes de verdad.

## 5. Usuarios de prueba

Los siguientes nombres son usuarios, **no correos electrónicos**:

| Usuario | Rol |
|---|---|
| `mecanico.prueba.com` | Mecánico principal |
| `almacen.prueba.com` | Almacén |
| `chofer01.prueba.com` | Chofer |
| `admin.prueba.com` | Administrador |

**Contraseña inicial de todos: `PRUEBA123`. Exclusivamente para pruebas locales.**

Las cuatro cuentas fueron creadas y se verificaron login, rol, permisos y logout contra PostgreSQL real. La contraseña no se guarda en texto plano en la base de datos.

`npm run db:seed:demo` crea únicamente las cuentas inexistentes, sin sobrescribir contraseñas, roles o estados de las existentes. Se bloquea con `NODE_ENV=production`.

## 6. Frontend implementado

### 6.1 Acceso y vistas por rol

- Pantalla de login conectada al backend, restauración de sesión y logout.
- Se retiró el selector de perfiles demo de la aplicación real.
- Mecánico y administrador acceden a la gestión del prototipo.
- Solo admin da de alta/edita unidades y tipos de revisión; mecánico consulta expedientes y realiza revisiones existentes cuando quiera, sin asignaciones.
- Mecánico no accede al catálogo Artículos de almacén: busca materiales desde la orden/servicio. Almacén sí consulta órdenes y confirma entregas/devoluciones.
- Almacén accede a artículos y entradas.
- Chofer reporta solicitudes y captura sus revisiones de viaje.
- La identidad de los reportes nuevos proviene del usuario autenticado.
- Los borradores de órdenes se separan por ID de usuario.

La ocultación de menús no sustituye permisos backend. Los futuros endpoints de negocio deberán validar cada acción y el alcance de consulta de cada usuario.

### 6.2 Solicitudes de servicio

- El chofer selecciona una unidad y registra asunto, descripción y kilometraje opcional.
- Puede consultar sus solicitudes y su resultado.
- El mecánico/admin revisa el reporte y prepara una orden vinculada o rechaza la solicitud con motivo.
- Preparar una orden no atiende la solicitud: solo cambia a «con orden» al guardarla correctamente.
- Se conservan el reporte original, el vínculo a la orden y la trazabilidad de la decisión.
- Se comprueba en servidor que una solicitud ya atendida no vuelva a convertirse o rechazarse.

### 6.3 Órdenes de mantenimiento

- Unidad, prioridad, fecha programada, odómetro y múltiples servicios.
- Responsable, instrucciones, tiempo estimado y materiales por servicio.
- Materiales agregables, editables y removibles, con estimación de costos.
- Identificador de solicitud y botón **Ver reporte**, en lugar de «Motivo de la orden».
- Órdenes manuales permitidas, por ejemplo CAF programado, con observaciones opcionales.
- Vista previa, guardado/recuperación de borrador privado en servidor y listado de órdenes compartidas.
- Las órdenes nuevas quedan **Lista para iniciar**, sin liberación de otra persona. El detalle permite iniciar, pausar con motivo, reanudar y finalizar, conservando historial. Crear o finalizar no autoriza circulación.
- Al finalizar se marcan solo servicios realmente realizados. Los omitidos requieren explicación y permanecen pendientes; CAF solo reinicia su referencia si fue realizado.
- La requisición de materiales se imprime desde el detalle de la orden, sin afectar inventario.
- Antes de finalizar, cada material requerido debe tener entrega neta positiva confirmada por almacén. Se permite entregar igual a la estimación; sin materiales previstos no existe este bloqueo. Una finalización correcta muestra la orden en Finalizadas y la excluye de Pendientes/En proceso.
- Categorías sin contadores; sin contadores laterales de Órdenes de trabajo y Solicitudes de servicio.

**Alta contextual de servicio:** desde «Agregar servicio» se puede crear uno nuevo y regresar a la orden sin perder lo capturado. Si es compatible, se agrega a esa orden. Cancelar regresa sin agregarlo. Crear directamente desde «Tipos de servicio» permanece en el catálogo y no activa ese retorno.

El retorno conserva el formulario durante la navegación en memoria. Para conservarlo ante recarga o cierre de pestaña debe guardarse un borrador.

### 6.4 Artículos de almacén

- Altas y edición de código, nombre, descripción y unidad de medida.
- Unidades: **pieza o litro**. Sin categorías de artículos por ahora.
- Entrada inicial opcional y registro de entradas posteriores con cantidad, costo, fecha, proveedor y referencia del comprobante.
- Historial de costos por entrada y distinción entre fecha efectiva y fecha de captura.
- Piezas enteras; litros admiten decimales.
- Unidad de medida fija después del alta para proteger cantidades históricas.

La existencia se calcula como **entradas − entregas confirmadas + devoluciones confirmadas**. Almacén captura totales acumulados por orden y se aplica solo la diferencia: no hay doble descuento por reenviar los mismos valores. El servidor impide existencias negativas y devoluciones superiores a lo entregado, en transacción PostgreSQL. El comprobante se captura como referencia de texto, no como archivo adjunto. El inventario ya es compartido; valoración contable definitiva pendiente.

### 6.5 Autobuses y camiones

- Catálogo común con tipos diferenciados: **autobús** y **camión**.
- Número económico, marca, modelo, año, placas, VIN, odómetro y observaciones.
- Validación de duplicados de número económico, placas y VIN.
- Identificador interno estable en nuevas unidades, independiente del número económico.
- Las altas están disponibles en solicitudes y órdenes.
- Registrar una unidad no implica liberación técnica.
- Solo administrador modifica su información. Mecánico y admin pueden abrir el expediente con servicios, revisiones, casos pre/post, golpes, fallas, reparaciones y costos conocidos.
- CAF vence cada 15,000 km. La corrección extraordinaria del último CAF exige admin, motivo y confirmación, registrando antes/después sin reescribir órdenes.
- Las fechas de general/emergencia se calculan desde revisiones efectivamente realizadas. Sin registro previo se muestra «Sin registro», sin inventar vencimientos.
- El historial es una tabla con fecha, categoría, tipo de revisión/servicio, estado, responsable y detalles. Sus filtros se combinan y conservan los datos históricos originales. El cierre pre/post identifica el tipo de revisión capturado.

### 6.6 Tipos de servicio

- Altas y edición de nombre, categoría del servicio, instrucciones, tiempo estimado y compatibilidad por unidades.
- **CAF: cambio de aceite y filtro, único servicio preventivo.** Los demás tipos creados son correctivos.
- Materiales predeterminados de CAF y otros servicios agregables, editables y removibles.
- Selector de almacén con búsqueda por nombre/código, sin distinguir mayúsculas ni acentos.
- Selección múltiple y paginación de 20 resultados para no renderizar miles de opciones.
- Posibilidad de cambiar un artículo mediante la misma búsqueda.
- Las órdenes nuevas conservan una copia del costo estimado; entradas posteriores no cambian esa estimación histórica.

La búsqueda/paginación visual consulta la colección cargada desde API en memoria; no usa persistencia local. La consulta paginada directamente en servidor sigue pendiente al escalar.

### 6.7 Tipos de revisión

- Alta y edición de nombre, instrucciones, periodicidad y aspectos escritos por el usuario.
- Opciones por aspecto: **Bien / Con falla**, excluyentes.
- Plantillas base: general cada 45 días, salidas de emergencia cada 90 días, anual y por viaje.
- No se inventaron aspectos para las plantillas base; deben configurarse con la operación.
- Versionado de definición y vista «Probar formato», sin guardar una revisión realizada.
- No hay asignaciones ni solicitudes previas de revisión periódica. El mecánico puede realizarla anticipada o vencida. Cada realización reinicia el contador desde su propia fecha: 45 días para general y 90 para emergencia.
- El catálogo de tipos de revisión es exclusivo del admin. Mecánico/admin capturan realizaciones desde Revisiones o el expediente sin editar los tipos. Vencer solo muestra «Vencida»: no bloquea la captura, no genera órdenes ni afecta automáticamente la disponibilidad.

### 6.8 Casos de revisión pre/post viaje

Nueva opción lateral **Revisiones**, separada de **Tipos de revisión**:

1. El chofer inicia un caso indicando autobús y fechas de ida/regreso.
2. Realiza pre trip y posteriormente post trip; cada aspecto requiere respuesta.
3. Al guardar ambas capturas, el caso pasa automáticamente a pendiente de revisión.
4. Mecánico principal o administrador consulta ambas y registra **Cierre de caso**.

Estados operativos:

```text
Pre trip pendiente → Post trip pendiente → Pendiente de revisión → Cierre de caso
```

**No hay cierre negativo ni resultado de aprobación/rechazo.** Las fallas declaradas permanecen en el historial. Cerrar no resuelve incidencias ni autoriza circulación.

Se conserva un solo caso abierto por autobús. La primera captura guarda una copia del formato y versión para que post trip no cambie aunque se edite el catálogo. Si aún no se definieron aspectos de viaje, se puede iniciar el caso, pero no enviar una captura sin formato.

## 7. Pruebas y verificaciones realizadas

Últimos resultados verificados antes de este documento:

- **Frontend:** 69 pruebas aprobadas (66 existentes y tres nuevas del transporte) y compilación correcta, incluidas operación con Storage bloqueado, preservación ante fallo y borrador de servidor. Se conservan contraste, navegación, acceso, tablas y reglas de negocio.
- Buscador probado con **3,000 artículos**, limitado a 20 opciones renderizadas por página.
- Pruebas de conservación de la orden, retorno contextual, alta directa independiente y cancelación del buscador sin cerrar el editor de servicio.
- Pruebas de pre/post, permisos, fechas, caso abierto único, copia histórica del formato y cierre único.
- **Backend:** 20 pruebas unitarias y 19 pruebas HTTP aprobadas; compilación y ESLint del código nuevo correctos. Ocho casos amplios del circuito operativo usan PostgreSQL real en BD temporal aislada. Compatibilidad de la API anterior verificada sin permitir una segunda fuente de verdad.
- Ciclo de autenticación de las cuatro cuentas comprobado adicionalmente contra PostgreSQL real.
- Última auditoría del frontend: sin vulnerabilidades reportadas. Persisten avisos de dependencias del backend documentados previamente; no se realizaron actualizaciones mayores forzadas.

Las pruebas HTTP de autenticación/salud utilizan un doble de Prisma. `npm run test:database` prueba el circuito operativo/concurrencia en una BD temporal propia; no debe ejecutarse esa suite directamente sobre la base operativa. También se comprobó en Chrome un circuito completo con cuatro perfiles y Storage bloqueado: cero accesos al almacenamiento del navegador y cero errores JavaScript de página.

## 8. Estado de ejecución tras el reinicio

**Actualización del 23 de octubre de 2026:** Docker volvió a estar disponible; el contenedor PostgreSQL se confirmó saludable y se iniciaron los servidores de desarrollo. Comprobación HTTP realizada:

- `http://127.0.0.1:3000/health` → **200**.
- `http://127.0.0.1:5173/` → **200**.
- `http://127.0.0.1:5173/api/auth/me`, sin cookie → **401**, comportamiento correcto: exige login.

**No se borraron ni reinicializaron datos, cuentas ni migraciones.** Los servidores pueden detenerse al cerrar terminales o reiniciar el entorno. En ese caso seguir el apartado siguiente; no reinstalar ni borrar datos como primer recurso.

Después de aquellas comprobaciones se solicitó apagar el equipo. Esos resultados son el último arranque registrado, no una garantía de que los servicios estén encendidos en este momento. Para volver a correrlo, utilizar el apartado 9.

## 9. Cómo correr el programa en Windows

### Requisitos y preparación inicial

- Node.js y npm instalados; la base del proyecto se verificó con Node 22.14.0.
- Docker Desktop instalado y abierto, con motor Linux disponible.
- `backend/.env` configurado. **Si ya existe, conservarlo.** Solo en una instalación nueva copiar `backend/.env.example` a `.env` y ajustar las credenciales.
- En una instalación nueva ejecutar `npm ci` una vez desde `backend/` y otra desde `frontend/` para instalar las dependencias.

### Terminal 1: PostgreSQL y backend

Abrir PowerShell y ejecutar:

```powershell
Set-Location 'C:\Users\angel\OneDrive\Documentos\RealEjectuvoMantenimirntoMVP\backend'
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run start:dev
```

Dejar esa terminal abierta. El backend utiliza el puerto **3000**. Las migraciones ya aplicadas no se vuelven a crear; `db:deploy` aplica únicamente las pendientes.

Si es una base nueva y faltan los usuarios de prueba, antes de arrancar el backend ejecutar:

```powershell
npm run db:seed:demo
```

El seed no cambia cuentas existentes. Las cuentas actuales ya estaban creadas.

### Terminal 2: frontend

Abrir otra ventana de PowerShell:

```powershell
Set-Location 'C:\Users\angel\OneDrive\Documentos\RealEjectuvoMantenimirntoMVP\frontend'
npm run dev
```

Dejarla abierta. Abrir **http://127.0.0.1:5173/** y usar las cuentas del apartado 5, con contraseña inicial **`PRUEBA123`**. Vite redirige `/api` al backend en `127.0.0.1:3000`; iniciar solo el frontend no basta para entrar.

### Comprobaciones y problemas frecuentes

- **Docker no conecta / falta `dockerDesktopLinuxEngine`:** abrir Docker Desktop y esperar a que el motor termine de iniciar; volver a ejecutar `docker compose up -d --wait`.
- **Login muestra que no conecta al backend:** comprobar que la Terminal 1 siga abierta y que `http://127.0.0.1:3000/health` responda.
- **Puerto 5173 o 3000 ocupado:** puede existir otra instancia ya iniciada. Usar la instancia correcta o detenerla con `Ctrl+C` en su terminal; no terminar procesos desconocidos ni cambiar puertos al azar.
- **No hay stock para dar salida:** registrar primero una entrada real desde la cuenta de almacén/admin. No se cargan cantidades ficticias para permitir una entrega.
- **CAF o revisión muestra «Sin registro»:** falta un servicio/revisión realmente realizado o una corrección extraordinaria de admin. No equivale a un error de cálculo.

### Cómo detenerlo sin perder datos

- `Ctrl+C` en cada terminal detiene frontend/backend.
- Para detener PostgreSQL conservando sus datos, ejecutar desde `backend/`: `docker compose stop`.
- La operación vigente usa PostgreSQL. Si había copias antiguas en el navegador, no limpiar localStorage para resolver errores: exportar/revisar/importar antes de retirarlas con confirmación.

No sobrescribir `.env` existente. No usar `docker compose down -v`, resets de migraciones ni limpieza de almacenamiento del navegador para resolver un problema de arranque: podrían eliminar datos.

## 10. Pendientes prioritarios

### Integración y persistencia

1. Ejecutar y revisar con el usuario la importación explícita de sus datos antiguos; no hacerlo automáticamente ni limpiar su navegador.
2. Conciliar manualmente los casos donde servidor y navegador ya tengan registros, y los borradores demo sin dueño real confirmado.
3. Normalizar el agregado JSONB por entidades, añadir índices/paginación y mantener los comandos/reglas transaccionales.
4. Revisar rendimiento y carga simultánea con volumen operativo real; actualmente se serializan escrituras del agregado.
5. Completar respaldo/restauración operativa y preparación de producción.

### Operación del taller y almacén

- Validar con personal real la ejecución, pausas y finalización ya integradas a comandos transaccionales. Las órdenes del mecánico no requieren liberación de un tercero.
- Servicios no ejecutados que permanecen pendientes y preventivos vencidos.
- Completar captura de consumo y ajustes/reversiones. Entregas/devoluciones, requisición imprimible y aplicación de diferencias ya funcionan con la API.
- Modelo de valoración del inventario y costos contables, evitando doble descuento.
- Reparaciones externas, emergencias en carretera, garantías e historial de costos.
- Completar consolidación de daños conocidos, evidencias y decisiones de circulación. Incidencias/reparaciones actuales ya están integradas al servidor.
- Evidencias privadas, fotos y comprobantes reales.
- Programación de revisiones periódicas y definición de sus aspectos con el cliente.
- Intervalo CAF confirmado en **15,000 km**; conservar correcciones extraordinarias solo de admin con auditoría.

### Seguridad y despliegue

- Gestión de usuarios, cambio/recuperación de contraseñas y retiro de credenciales de prueba.
- HTTPS, configuración del origen público y revisión del proxy.
- Auditoría operativa, respaldos, restauración, conservación de evidencias y revisión de dependencias.
- Pruebas de integración reales de negocio, concurrencia y validación con los formatos del cliente.

## 11. Decisiones y límites que deben conservarse

- Sistema independiente del CRM/tours; integraciones posteriores por interfaces documentadas.
- Checklist/caso de viaje e incidencia son registros con ciclos independientes.
- Operador asociado al viaje no significa responsable de causar un daño.
- **Cerrar orden o caso no equivale a autorizar circulación.**
- Solo CAF es preventivo; revisiones periódicas se administran por separado.
- Autobuses y camiones son vehículos distintos.
- No hay categorías de artículos por ahora.
- No copiar componentes, código, estilos ni recursos propios de Atlas CMMS sin revisión de licencia. Se usó como referencia conceptual; la interfaz implementada es original.
- No introducir información sensible ni usar como sistema definitivo hasta completar seguridad y preparación de producción, aunque la persistencia ya sea de servidor.

## 12. Documentos de referencia

- [Índice de documentación](docs/README.md).
- [Documento original del MVP](docs/proyecto/Real_Ejecutivo_Estado_Proyecto_MVP.md).
- [CAF, revisiones y solicitudes](docs/proyecto/aclaraciones-servicios-y-solicitudes.md).
- [Altas, catálogos y unidades](docs/proyecto/altas-catalogos-y-unidades.md).
- [Casos pre/post y flujo contextual](docs/proyecto/revisiones-y-flujo-contextual.md).
- [Expedientes, CAF, ejecución, almacén y permisos vigentes](docs/proyecto/historial-ordenes-almacen-permisos.md).
- [Categorías, materiales obligatorios, precio unitario e historial tabular](docs/proyecto/ordenes-categorias-historial-cantidades.md).
- [Login y cuentas de prueba](docs/operacion/acceso-y-usuarios-prueba.md).
- [Modelo inicial de base de datos](docs/arquitectura/base-de-datos.md).
- [Licencias y reutilización](docs/legal/reutilizacion-y-licencias.md).

---

**Siguiente paso recomendado:** revisar/importar el histórico del usuario con respaldo y confirmación, validar la operación integrada con personal real y continuar normalización, respaldos y endurecimiento. Ver la etapa 02 antes de seguir instrucciones antiguas que describan almacenamiento local. El arranque está documentado en el apartado 9; en instalación nueva, instalar también `shared/` con `npm ci`.
