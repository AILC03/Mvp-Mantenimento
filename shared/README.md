# Dominio compartido Real Ejecutivo

**Unidades (30/10/2026):** `bus` significa Autobús y `truck` significa Sprinter de pasajeros. Se conservan las claves históricas y los IDs. `vehicleTypeLabel` centraliza etiquetas; todas las reglas, incluido el caso de viaje abierto único por unidad, aplican a ambas categorías. No excluir `truck` como si fuera carga.

Reglas y tipos propios, sin React, Prisma ni acceso al navegador. Frontend consume `src/` mediante Vite; backend consume el paquete local `@real-ejecutivo/domain`, compilado en CommonJS con declaraciones.

```powershell
npm ci
npm run build
```

`operations.ts` aplica comandos sobre el estado del MVP con el usuario autenticado del servidor. Los esquemas de entrada HTTP, transacciones y auditoría pertenecen a `backend/src/operations/`.

`storage.ts` es una caché **solo en memoria** para los adaptadores de interfaz. No añadir localStorage/sessionStorage aquí. Los parsers `loadCatalogs`, `loadWorkbench` y `loadTripCases` aceptan JSON explícito para validar respaldos/respuestas sin consultar esa caché. El backend no usa la caché para persistir.

Los catálogos demo originales se conservan para pruebas y validación de respaldos. La operación nueva del servidor utiliza `emptyOperations()`: incluye definiciones CAF/revisiones, no unidades, artículos ni existencias demo.

Antes de cambiar reglas, ejecutar las pruebas del frontend y `npm run test:database` del backend. No duplicar reglas en ambos proyectos. El dominio incluye validación por unidad de medida, material confirmado antes de finalizar, correcciones de CAF de admin y ciclo pre/post/cierre.
