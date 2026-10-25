# Base de datos — primer circuito

**Actualización del 22 de octubre de 2026:** las migraciones iniciales y la de autenticación ya están aplicadas sobre PostgreSQL local. `User` incorpora `username` único y correo opcional; `AuthSession` persiste hashes de tokens y expiración. Las cuatro cuentas se verificaron contra la base real. Ver [acceso y usuarios de prueba](../operacion/acceso-y-usuarios-prueba.md). Las notas de pruebas pendientes posteriores describen el estado inicial del circuito de inspecciones, no un bloqueo actual del login.

**Estado:** esquema inicial propuesto e implementado en archivos; pendiente de validación operativa y aplicación contra PostgreSQL. No representa la totalidad del MVP.

## Tecnología

PostgreSQL 17 y Prisma 6.19.3. La versión de Prisma se eligió por compatibilidad con Node 22.14.0; no actualizar a una versión mayor sin revisar requisitos y migración. Backend y base local se configuran desde `backend/`.

## Entidades

| Modelo | Propósito |
|---|---|
| User | Personal con rol inicial, cuenta activa y hash de contraseña; autenticación pendiente |
| Bus | Identificación y ficha básica de la unidad |
| TripChecklist | Caso de viaje, operador, revisión y cierre |
| Inspection | Captura pre o post del mismo caso; respuestas y versión de formato |
| Observation | Anomalía declarada con parte, descripción y referencia privada de foto |
| Incident | Daño conocido independiente del viaje, asociación de operador sin atribuir culpa y resolución |
| TechnicalDecision | Historial de decisiones técnicas con autor, fecha y observaciones |

Relaciones principales:

```text
User → TripChecklist ← Bus
TripChecklist → Inspection → Observation → Incident ← Bus
User → TechnicalDecision ← Bus
```

## Restricciones de base de datos

- UUID como identificadores internos; número económico único e independiente.
- Relaciones con eliminación restringida para proteger el historial.
- Índice único parcial para un checklist abierto por autobús (`closedAt IS NULL`).
- Una inspección por etapa y checklist.
- Odómetro no negativo y comprobaciones básicas de fechas.
- Revisión y resolución requieren usuario y fecha conjuntamente.
- Cierre de caso requiere datos de revisión, pero no cierra incidencias.

El índice parcial y las restricciones `CHECK` están en migraciones SQL. No sustituirlas por `prisma db push`. Revisar futuras migraciones para conservarlas.

## Reglas pendientes de servicios y pruebas transaccionales

El esquema no implementa por sí solo todos los requisitos:

- Validar que solo el mecánico principal revise, resuelva incidencias o autorice circulación.
- Validar que el usuario activo que captura inspecciones sea el operador del caso y que post siga a pre.
- Exigir pre, post y revisión antes de cerrar; ejecutar comprobaciones y cierre en transacción.
- Impedir ediciones no autorizadas de observaciones históricas.
- Al vincular observación e incidencia, exigir que correspondan al mismo autobús.
- Validar estructura JSON según versión del formato y existencia/acceso de evidencias privadas.
- Normalizar email, placas y número económico antes de persistir; las unicidades actuales son sensibles a mayúsculas.
- Validar permisos al asignar roles; rol único inicial, especialidades de técnicos pendientes.
- Serializar decisiones técnicas por autobús y definir desempate de orden. Sin decisión, la condición es pendiente de revisión, nunca autorización implícita. Una decisión previa no debe ignorar restricciones de seguridad posteriores.

No hay rutas CRUD ni permisos operativos implementados. El esquema no debe exponerse directamente a usuarios.

## Fuera de esta primera migración

Órdenes, servicios, pausas, materiales, inventario, devoluciones, costos históricos y reparaciones externas/carretera se modelarán por separado. Evitar anticipar valoración de inventario y flujos aún pendientes del cliente.

## Verificación pendiente

La migración inicial fue generada sin conexión desde el esquema. El motor Docker no estaba disponible durante la configuración. Falta probar aplicación real, restricciones, concurrencia y persistencia sobre PostgreSQL.

## Dependencias y seguridad

La auditoría npm durante esta configuración reportó avisos, incluyendo tres entradas de severidad alta en la cadena `prisma` → `@prisma/config` → `deepmerge-ts` (GHSA-ggr8-5vv4-36mx). npm propone una actualización mayor; no se ejecutó `audit fix --force`. Revisar actualización de Node/Prisma y restantes avisos antes de producción. No tratar la base inicial como lista para producción.
