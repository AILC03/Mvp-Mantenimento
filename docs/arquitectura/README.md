# Arquitectura propuesta

**Estado:** pendiente de aprobación. Referencia: sección 9 del [documento original](../proyecto/Real_Ejecutivo_Estado_Proyecto_MVP.md).

| Área | Propuesta |
|---|---|
| Interfaz | Web responsiva con React + Vite + TypeScript |
| Backend | Monolito modular NestJS con API REST |
| Persistencia | PostgreSQL + Prisma |
| Evidencias | Almacenamiento privado; proveedor pendiente |
| Integraciones | Interfaces futuras; sin dependencia inicial del CRM o tours |

**Estado implementado al 25/10/2026:** backend y frontend son proyectos separados, sin herramientas de monorepo, con reglas propias compartidas en `shared/`. NestJS 11/Prisma 6/PostgreSQL 17 y React 19/Vite/TypeScript integran los módulos actuales. Cinco migraciones y pruebas sobre PostgreSQL verificadas.

Las reglas de CAF, solicitudes, órdenes, almacén y revisiones se ejecutan mediante comandos autorizados. La persistencia vigente usa un agregado JSONB versionado, borradores privados y auditoría/idempotencia, con transacciones y control de revisión. Normalización por entidad pendiente. Ver [arquitectura y límites de etapa 02](../proyecto/backend-operacion-etapa-02.md).

Ver [modelo inicial de base de datos](base-de-datos.md).

El modelo inicial de Bus/inspecciones se conserva como referencia y evolución histórica; no es una segunda fuente operativa activa. Autenticación mediante sesiones opacas y cookie HttpOnly. Ver [acceso y usuarios](../operacion/acceso-y-usuarios-prueba.md). La operación actual no usa persistencia en el navegador; las copias antiguas requieren importación explícita revisada.

## Reglas que deben influir en el diseño

- Checklist e incidencia tienen ciclos de vida independientes.
- Solo un caso de checklist abierto por autobús, incluso ante solicitudes concurrentes; confirmar impacto operativo.
- Cierre de orden y autorización de circulación son acciones independientes.
- Los servicios no ejecutados no desaparecen al cerrar una orden.
- Entrega, consumo y devolución requieren conciliación sin descontar inventario dos veces.
- Registrar fechas efectivas y de captura cuando la operación sea diferida.
- Fotos y tickets requieren autorización de acceso.

## Próximos entregables

Modelo de datos, permisos por acción y decisiones de arquitectura (ADR) individuales, con estado, contexto, alternativas y consecuencias.
