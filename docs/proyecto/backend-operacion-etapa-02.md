# Backend operativo — etapa 02: sin almacenamiento operativo en el navegador

**Fecha:** 25 de octubre de 2026. Sustituye el alcance de la etapa 01 de unidades.

## Qué está conectado

La aplicación carga y guarda mediante NestJS/PostgreSQL: unidades, artículos, entradas y costos históricos, servicios/materiales/compatibilidad, tipos de revisión y aspectos, solicitudes y su conversión/rechazo, órdenes y ejecución, entregas/devoluciones, revisiones periódicas, golpes/incidencias/reparaciones, CAF/correcciones y casos pre/post con cierre. Los borradores guardados son privados por usuario y también se conservan en PostgreSQL.

`App.tsx` presenta `OperationsWorkspace.tsx`, que espera una carga válida antes de montar el trabajo. Una falla del servidor no habilita datos demo ni guardado local. React mantiene una caché y formularios en **memoria efímera**, no en localStorage ni sessionStorage. El formulario sin guardar puede perderse al cerrar la página; se conserva el botón explícito Guardar borrador.

## Arquitectura y límite deliberado del MVP

- Se extrajo el código propio de reglas a `shared/src/`, consumido por frontend y por el paquete backend `@real-ejecutivo/domain`. No se duplicaron las reglas ni se incorporó código de terceros de Atlas.
- `OperationState.data` conserva el agregado tipado/versionado en **JSONB de PostgreSQL**. `OperationDraft` tiene clave de usuario y `OperationEvent` conserva autor real, fecha, revisión, comando y hash para auditoría/idempotencia.
- No es todavía un esquema totalmente normalizado por orden/artículo/movimiento. No hay PUT público para reemplazar un snapshot: el servidor recibe un comando, verifica esquema y permiso, vuelve a ejecutar las reglas contra el estado vigente y persiste el resultado.
- Una transacción bloquea la fila operativa con `FOR UPDATE`; inventario, solicitud/orden y auditoría cambian juntos. Se rechazan revisiones obsoletas con 409, sin sobrescribir datos. La repetición del mismo comando/autor/contenido no duplica movimientos; reutilizar su ID con otro contenido se rechaza.
- IDs, actores y fechas de eventos nuevos se generan o validan en servidor. Los IDs UUID de alta enviados por la interfaz funcionan como correlación y no otorgan permisos. Numeración SOL/OT/REV generada en backend según la revisión transaccional.
- El chofer recibe solo sus solicitudes/casos y los catálogos necesarios para capturar; no recibe órdenes ni catálogo de artículos/servicios. El número de su orden vinculada se proyecta sin exponer la orden completa. Almacén no recibe expedientes ni casos. Mecánico no puede modificar unidades, revisiones ni entradas/artículos.
- Las reglas de materiales, cantidades, cierre, CAF y plantillas se aplican también en servidor. No es posible evitar la confirmación de almacén modificando React.

**Limitaciones pendientes:** el agregado único y las respuestas completas son adecuados a esta etapa de MVP, no a escala ilimitada. Faltan normalización e índices por entidad, paginación/consultas del servidor, actualización en vivo, respaldo/restauración operativa automatizada, fotos privadas, gestión de cuentas y endurecimiento de producción. Los cambios ajenos se consultan al recargar; no se anuncia telemetría o sincronización en tiempo real inexistente.

## API

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/operations` | Snapshot autorizado, revisión y borrador propio |
| POST | `/api/operations/commands` | Ejecutar un comando autorizado y devolver el estado actualizado |
| POST | `/api/operations/import` | Importación histórica confirmada, solo ADMIN y base todavía vacía |
| GET | `/api/vehicles` | Compatibilidad de lectura desde la misma fuente operativa |

POST/PUT antiguos de `/api/vehicles` responden **410**, indicando utilizar `vehicle.save`; se evita una segunda fuente de verdad. Las unidades que ya estaban en la tabla Bus se conservan al inicializar el agregado. Las tablas iniciales de inspecciones se conservan, pero el flujo vigente usa el agregado; no confundirlas con un segundo flujo operativo activo.

Ejemplo del sobre de comando:

```json
{
  "commandId": "UUID único de la operación",
  "revision": 5,
  "command": { "type": "order.change", "id": "ID de orden", "action": "start", "notes": "" }
}
```

Todos los endpoints requieren sesión. Escrituras comprueban Origin; esquemas Zod rechazan campos desconocidos, identidades de autor inyectadas, tipos incorrectos y cantidades fuera de rango. Respuestas `no-store`. Límite de cuerpo JSON: 2 MB. Un conflicto conserva el formulario; Recargar datos compartidos avisa antes de descartar cambios no guardados.

## Traslado de datos antiguos sin pérdida silenciosa

No se importaron automáticamente los datos del navegador del usuario ni se borró su localStorage durante el desarrollo.

1. Entrar como **admin** en el mismo navegador/origen donde estaban los datos antiguos.
2. Abrir **PostgreSQL · Datos del servidor · Opciones**.
3. Antes de crear registros nuevos, pulsar **Revisar y descargar respaldo local**. Se revisan formato, IDs y referencias; el archivo incluye también borradores antiguos para conservarlos.
4. Revisar cantidades y archivo descargado; marcar la confirmación y pulsar **Confirmar importación a PostgreSQL**.
5. El servidor acepta únicamente una operación aún vacía. Si ya contiene unidades u operaciones, responde 409: **no mezcla, no reemplaza y no borra**. Se requiere conciliación revisada de ambos orígenes.
6. Tras el éxito, existe una acción separada para **Retirar copias locales ya importadas**, con confirmación adicional y comprobación de que la copia no cambió desde su lectura. No se usa `localStorage.clear()` en producción.

Se conservan IDs y vínculos de los registros importados; no se convierten por posición ni se atribuyen IDs demo a usuarios reales. Los actores históricos son datos de origen no verificados y la importación queda auditada como tal. Por eso una solicitud antigua de `driver-demo` no aparece automáticamente como propiedad del chofer real.

Cada admin/mecánico puede trasladar **su borrador vinculado a su UUID real** con una acción separada, respaldo previo y confirmación. La copia propia se retira solo después de guardarlo en servidor. Los borradores demo o de otro usuario no se borran ni reasignan automáticamente; permanecen en el respaldo/almacenamiento antiguo hasta conciliarlos. Esto no constituye almacenamiento activo de la nueva aplicación.

`frontend/src/legacy-import.ts` es el único módulo de producción que lee/retira claves antiguas, y lo hace solo por estas acciones explícitas. Las pruebas anteriores conservan un adaptador de Storage inyectado exclusivamente desde `test-setup.ts`; ese adaptador no se importa en producción.

## Arranque

Conservar `.env`, volumen y cuentas. En instalación nueva, instalar también las dependencias de `shared/` con `npm ci`. Backend sigue en 3000 y frontend en 5173:

```powershell
# Desde shared/, solo instalación nueva
npm ci
```

```powershell
# Desde backend/
npm ci
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run start:dev
```

El backend compila `shared` antes de build/start:dev. Frontend usa el código compartido con Vite y su propio npm ci/npm run dev. No ejecutar build y watch del backend simultáneamente: ambos escriben dist. Para despliegue se debe incluir el paquete shared compilado junto con el backend.

## Pruebas realizadas

- Suite frontend: 69 pruebas (66 existentes y tres del transporte persistente), incluidas operación con Storage bloqueado, fallo de red conservando formulario y borrador/conflicto de revisión.
- Suite HTTP: 19 pruebas, ocho casos amplios del circuito operativo con PostgreSQL real, además de autenticación, salud y compatibilidad de API.
- `npm run test:database` crea una **BD temporal propia**, aplica las cinco migraciones, ejecuta HTTP y retira solo esa BD. No limpia ni reinicializa la base operativa.
- Navegador Chrome con cuatro perfiles y Storage bloqueado: alta de unidad y recarga, solicitud desde otro contexto, recuperación de borrador del servidor, creación/inicio de orden, bloqueo previo a entrega, confirmación de almacén y finalización. Se verificó también fallo de red y vista móvil. **Cero llamadas a getItem/setItem/removeItem/clear y cero errores JavaScript de página** en ese circuito.
- La revisión de navegador utilizó servidores/BD temporales aislados; no añadió órdenes de prueba a la base del usuario.

Esto no equivale a certificación de seguridad ni preparación para producción. La auditoría de dependencias backend conserva avisos pendientes; no se forzaron actualizaciones mayores.
