# Real Ejecutivo — Frontend

**Entrega verificada 29/10/2026:** consulta mínima de incidencias desde pre/post sin perder captura; orden física y requisición; servicios externos/carretera e historial por unidad; circulación explícita y resumen admin para foto; cierre validado contra odómetro inicial propio. Ver [uso y pruebas](../docs/proyecto/entrega-alcance-mvp-2026-10-28.md). Sin cuentas/paneles técnicos ni ampliación de costos internos. La consulta del chofer no expone el snapshot general.

**Diseño incremental:** primera iteración de navegación y página de Solicitudes usando CSS propio y recomendaciones de UI UX Pro Max. Se conservan marca, fuentes, permisos y flujos. Ver [dirección visual](../design-system/real-ejecutivo/MASTER.md) y [validación de la entrega](../docs/diseno/iteracion-01-pagina-principal.md).

Aplicación independiente con React, Vite y TypeScript. Primera entrega: creación de órdenes de mantenimiento por el mecánico principal.

**Actualización, 25/10/2026:** todos los módulos actuales y los borradores guardados usan la API y PostgreSQL. No se opera sobre localStorage/sessionStorage. El rol autenticado determina la vista: solicitudes para mecánico/chofer/admin y artículos para almacén. Ver [operación integrada e importación del histórico](../docs/proyecto/backend-operacion-etapa-02.md).

Para probar: iniciar sesión como `chofer01.prueba.com`, enviar una solicitud y cerrar sesión; entrar como `mecanico.prueba.com` y pulsar «Revisar solicitud». Contraseña de ambas cuentas de prueba: `PRUEBA123`. También existen `almacen.prueba.com` y `admin.prueba.com` con esa contraseña. No hay selector de rol ni contraseñas verificadas localmente.

## Desarrollo

Node 22.14.0 y npm, desde `frontend/`:

```powershell
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`. Backend y PostgreSQL deben estar activos y las cuentas sembradas. Vite exige ese puerto y redirige `/api` a `127.0.0.1:3000` para usar una cookie HttpOnly de mismo origen. El despliegue/preview requiere su propia redirección `/api`.

```powershell
npm run build
npm test
```

## Funcionalidad implementada

- Categorías de órdenes **Pendientes / En proceso / Finalizadas**, sin contadores, y retiro de contadores laterales de órdenes/solicitudes.
- Finalización bloqueada hasta que almacén confirme entrega neta positiva de cada material; entregar igual a la estimación es válido. Las órdenes sin materiales no se bloquean por esto.
- Cantidades de materiales previstos con controles de 1 por pieza y 0.5 por litro, alineados y adaptados a móvil.
- Total de entradas calculado en vivo: cantidad × costo unitario por pieza/litro.
- Historial por unidad en tabla con filtros de categoría, tipo, estado y fecha; se indica el tipo de las revisiones cerradas. Ver [alcance actualizado](../docs/proyecto/ordenes-categorias-historial-cantidades.md).

- Expediente por unidad con historial disponible, CAF cada 15,000 km, general 45 días y emergencia 90 días; sin fechas inventadas cuando faltan registros.
- Corrección extraordinaria de último CAF solo admin, con motivo, valor anterior/nuevo e historial.
- Solo admin edita unidades y tipos de revisión. Mecánico realiza revisiones existentes cuando quiera, sin asignaciones ni acceso a artículos de almacén o al catálogo de tipos de revisión. Al realizarlas se reinician los contadores; vencer solo muestra un aviso.
- Órdenes listas para iniciar sin liberación ajena: detalle, requisición imprimible, inicio, pausa, reanudación y finalización por servicios realizados.
- Almacén consulta órdenes y confirma cantidades entregadas/devueltas. Solo se aplican diferencias, evitando doble descuento y existencias negativas.
- Golpes/incidencias con origen pre/post o revisión, confirmación de reparación e historial conservado.
- Ver [reglas y límites actualizados](../docs/proyecto/historial-ordenes-almacen-permisos.md), que sustituyen las propuestas anteriores incompatibles.

- **Revisiones:** casos de viaje con unidad (Autobús o Sprinter), ida/regreso, pre/post, envío a revisión al completar ambas y único estado final **Cierre de caso** por mecánico/admin. Un solo caso abierto por unidad.
- Alta de servicio desde una orden con retorno contextual y conservación del formulario; alta directa de catálogo independiente.
- Identificador de solicitud y acceso al reporte original; observaciones opcionales para órdenes manuales.
- Selección de materiales desde una vista de almacén con búsqueda y paginación de 20 artículos. Ver [detalle del flujo](../docs/proyecto/revisiones-y-flujo-contextual.md).

- Login real, recuperación de sesión y logout; rol proveniente de la base de datos.
- Vistas de mecánico, almacén, chofer y administrador sin selector de perfiles.

- Altas y edición de artículos (pieza/litro), unidades Autobús/Sprinter, tipos de servicio y tipos de revisión. `truck` se conserva como clave de Sprinter de pasajeros.
- Entradas de artículos con cantidades, fechas, costos históricos, proveedor y referencia de comprobante.
- Materiales predeterminados de CAF y otros servicios; compatibilidad con unidades.
- Aspectos de revisión escritos por el usuario y prueba de formato Bien/Con falla con opciones excluyentes.
- Catálogos disponibles en solicitudes y órdenes, con persistencia y permisos de servidor. Las reglas funcionales de [altas](../docs/proyecto/altas-catalogos-y-unidades.md) se conservan; su descripción de almacenamiento local es histórica.

- Formulario de unidad, prioridad, observaciones, fecha opcional y odómetro. Clasificación derivada de servicios: únicamente CAF es preventivo.
- Selección de múltiples servicios desde el catálogo registrado, sin duplicados del mismo servicio.
- Responsable, instrucciones y tiempo estimado por servicio.
- Agregar, cambiar y retirar materiales; cantidades editables y estimación en MXN.
- Resumen, vista previa y contexto de la unidad registrada.
- Borrador privado en PostgreSQL con guardado/recuperación explícitos.
- Creación y listado de órdenes compartidas listas para iniciar sin liberación adicional.
- Solicitudes del chofer, bandeja del mecánico, conversión vinculada y rechazo con motivo.
- Referencia de revisiones: general cada 45 días, salidas de emergencia cada 90 días y anual, sin programación automática. Cada viaje tiene el circuito persistente pre/post, revisión y cierre.
- Validaciones, avisos de error de almacenamiento y diseño responsivo.

## Límites importantes

- La aplicación requiere API y PostgreSQL disponibles; no hay fallback de guardado en navegador. Los formularios sin guardar viven solo en memoria.
- Las cuentas de acceso siguen siendo de prueba. No se crean vehículos/existencias demo al arrancar una operación nueva; admin debe importar su histórico revisado o dar altas reales.
- Datos antiguos solo se leen/retiran mediante acciones explícitas en Opciones; no se borran automáticamente. Importar antes de crear datos nuevos. Conflictos con una operación no vacía requieren conciliación, no reemplazo.
- Numeración nueva generada en backend y guardados con revisión transaccional. Los cambios ajenos se consultan al recargar; aún no hay actualización en vivo.
- Valida compatibilidad por unidades seleccionadas, no por modelo de fabricante. Asignar materiales no descuenta existencias; confirmar entregas/devoluciones en almacén actualiza PostgreSQL en transacción.
- La suma de horas es esfuerzo total estimado, no duración calendario de la orden.
- La estimación no incluye mano de obra ni impuestos.
- Crear deja la orden lista para iniciar sin liberación de terceros. No autoriza circulación. Las notificaciones reales siguen pendientes.
- Los catálogos ya usan la API; evidencias privadas, paginación de servidor y endurecimiento de producción siguen pendientes. El mecánico no necesita liberación de un tercero para iniciar una orden.

## Organización

```text
src/
  App.tsx              Restauración de sesión, login y logout
  auth.ts              Cliente API de autenticación, sin tokens en localStorage
  Workbench.tsx        Espacio de trabajo según usuario autenticado
  OperationsWorkspace.tsx Carga de servidor, guardado y migración explícita
  operations-client.ts Transporte de comandos y caché solo en memoria
  legacy-import.ts     Lectura/retiro explícitos de datos antiguos, no operación
  components/Login.tsx Pantalla de acceso
  data.ts              Reexportación del dominio compartido en shared/src
  requests.ts          Adaptador de solicitudes y comandos de servidor
  catalogs.ts          Adaptador de catálogos y comandos de servidor
  trip-reviews.ts      Casos pre/post viaje, permisos y cierre único
  components/TripReviews.tsx Captura pre/post, revisión y cierre del caso
  components/MaterialPicker.tsx Búsqueda y selección paginada de almacén
  components/CatalogManager.tsx Formularios de artículos, unidades, servicios y revisiones
  components/ServiceRequests.tsx Reporte del chofer y bandeja de revisión
  components/Modal.tsx Diálogo nativo con foco y cierre por Escape
  styles.css           Diseño original y adaptación a móvil
  App.test.tsx         Pruebas del flujo y validaciones locales
  Auth.test.tsx        Pruebas del acceso, sesión y roles
  testing/WorkbenchHarness.tsx Selector exclusivo de tests, no importado por la aplicación
```

La organización de formularios toma como referencia funcional un CMMS como Atlas. No se copió código, estilos, imágenes ni logotipos de Atlas. Ver [decisión de interfaz](../docs/diseno/ordenes-mantenimiento.md) y [dependencias](../docs/legal/dependencias-frontend.md).

Las fuentes DM Sans y Manrope se solicitan a Google Fonts; hay fuentes de sistema como alternativa si no existe conexión. Evaluar autoalojamiento antes de producción.

Las reglas de permisos y negocio se validan en backend mediante los comandos y el dominio compartido; ocultar controles nunca sustituye autorización.
