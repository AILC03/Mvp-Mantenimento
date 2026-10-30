# Backend operativo — etapa 01: Unidades

**Documento histórico:** sustituido por [etapa 02, operación integrada](backend-operacion-etapa-02.md). La interfaz ya usa PostgreSQL; POST/PUT antiguos de `/api/vehicles` devuelven 410 y sus lecturas usan la fuente operativa común.

Fecha: 24 de octubre de 2026.

## Alcance real

Primera API operativa persistente sobre NestJS/Prisma/PostgreSQL. **El catálogo de Unidades del frontend todavía no consume esta API.** No se sustituyeron los datos locales ni se importaron los registros del navegador. Autenticación sigue siendo el único circuito integrado de extremo a extremo en la interfaz.

Se amplió el modelo existente `Bus` para unidades tipadas, conservando sus UUID, relaciones y registros. La migración aditiva `20261024000100_operational_vehicles` añade tipo, kilometraje, notas y versión; se aplicó sobre PostgreSQL local sin recrear el volumen. Las unidades anteriores reciben tipo BUS, kilometraje 0 (valor inicial, no lectura histórica) y notas vacías hasta su conciliación explícita. Aclaración vigente del 30/10: las categorías son Autobús y Sprinter de pasajeros; las claves heredadas `truck`/`TRUCK` significan Sprinter. No alterar migraciones históricas ni reclasificar IDs para renombrar.

## API

Todas las rutas requieren sesión válida mediante la cookie existente. No aceptan roles, IDs de autor ni permisos enviados en el cuerpo.

| Método | Ruta | Permiso | Resultado |
|---|---|---|---|
| GET | `/api/vehicles` | Usuario autenticado | `{ vehicles: [...] }`, unidades activas |
| POST | `/api/vehicles` | ADMIN | Unidad creada, UUID generado por servidor |
| PUT | `/api/vehicles/:id` | ADMIN | Actualización completa con versión esperada |

POST y PUT exigen un encabezado Origin incluido en `FRONTEND_ORIGINS`, como login/logout. Respuestas sin caché. No se implementó eliminación ni archivado.

Cuerpo de alta:

```json
{
  "fleetNumber": "CAM-001",
  "type": "truck",
  "brand": "Marca",
  "model": "Modelo",
  "plate": "",
  "vin": "",
  "year": null,
  "odometer": 0,
  "note": ""
}
```

Para editar, enviar los mismos campos más `version`, tomado de la última respuesta. Cada cambio incrementa la versión. La comprobación y modificación son atómicas; si otra persona ya guardó, responde 409 sin sobrescribir su cambio.

- `type`: `bus` (Autobús) o `truck` (Sprinter de pasajeros; clave heredada).
- Número económico obligatorio (máximo 30 caracteres), normalizado a mayúsculas.
- Placa y VIN vacíos se guardan como null para no impedir otras altas sin estos datos.
- VIN no vacío: 17 caracteres, sin I/O/Q.
- Marca/modelo: máximo 80 caracteres; notas: máximo 4,000.
- Año: null o entero entre 1950 y el año siguiente al actual.
- Kilometraje: entero de 0 a 2,147,483,647.
- Se rechazan campos desconocidos, tipos incorrectos y datos fuera de rango.
- Duplicados de número económico, placa o VIN: 409. UUID inválido: 400. Unidad inexistente: 404.

## Identificadores y siguiente etapa

`BUS015` y los IDs locales no son UUID del backend. No asociar datos por posición ni convertir IDs por su apariencia. Antes de conectar el catálogo:

1. Presentar conciliación explícita entre unidades locales y unidades del servidor, usando número económico como candidato, no como prueba suficiente.
2. Confirmar importación o vinculación y conservar una copia/exportación del origen.
3. Mantener un mapa de IDs y resolver todas las referencias de solicitudes, órdenes, servicios compatibles, expediente y casos de viaje.
4. Pasar guardados a operaciones asíncronas: espera, error visible y actualización de pantalla únicamente tras confirmación del servidor.
5. No regresar a un guardado local silencioso si falla la API.
6. Continuar con solicitudes/órdenes y movimientos de almacén, aplicando reglas en el servidor y transacciones, no solo en React.

La API no modifica reglas de revisión, CAF, órdenes o almacén. Aún falta auditoría de cambios administrativos y el circuito específico de corrección de CAF; editar una unidad aquí no equivale a registrar una revisión ni un CAF.

## Verificación

- Compilación de backend y frontend correctas.
- Backend: 20 pruebas unitarias; 11 HTTP, incluyendo dos pruebas contra PostgreSQL real del circuito de unidades.
- HTTP real: login con cuentas temporales aisladas, permisos de admin/chofer/técnico/almacén, origen, validación, alta, lectura, actualización, versión obsoleta y duplicados.
- Las pruebas eliminan únicamente los UUID que ellas crearon; no borran tablas ni cuentas de demostración.
- ESLint del código nuevo correcto.

Para ejecutar voluntariamente las pruebas HTTP contra la BD configurada, desde `backend` en PowerShell:

```powershell
$env:RUN_DATABASE_TESTS = '1'
npx jest --config ./test/jest-e2e.json --runInBand
```

Sin esa variable, se omiten las dos pruebas que escriben registros temporales en PostgreSQL. Debe usarse una base local/de pruebas, nunca producción.
