# Operación y seguridad

**Estado al 25/10/2026:** desarrollo local e integración PostgreSQL disponibles; no hay despliegue productivo. La API ya valida roles, comandos y auditoría operativa. Ver [arranque](../../README.md), [acceso](acceso-y-usuarios-prueba.md) y [persistencia/migración vigentes](../proyecto/backend-operacion-etapa-02.md).

Pendientes para definir antes de operar con información real:

- Entornos de desarrollo, pruebas y producción.
- Gestión de credenciales y variables de entorno, fuera del repositorio.
- Revisar con el cliente los permisos por usuario/rol ya validados en backend.
- Almacenamiento privado de fotografías y tickets.
- Auditoría de revisiones, autorizaciones de circulación y movimientos de materiales.
- Respaldos, restauración y recuperación ante errores.
- Política de conservación y acceso a datos personales y evidencias.
- Infraestructura, costos y responsables de soporte.

No hay infraestructura de producción configurada. No cargar datos reales hasta definir los controles mínimos.
