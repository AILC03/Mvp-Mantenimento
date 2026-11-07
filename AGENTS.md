# Instrucciones para agentes — Real Ejecutivo MVP

Estas instrucciones aplican a todo el repositorio. Antes de editar, leer `docs/proyecto/decisiones-mvp-2026-10-28.md` y los documentos del módulo afectado.

## Autoridad y alcance

1. Respetar las instrucciones actuales del usuario. Las decisiones explícitas posteriores sustituyen las anteriores incompatibles.
2. El alcance vigente se establece en `docs/proyecto/decisiones-mvp-2026-10-28.md`, `docs/proyecto/unidades-sprinter-2026-10-30.md` y la ampliación posterior `docs/proyecto/ultimos-cambios-mvp-2026-11-07.md`. Las decisiones posteriores prevalecen solo sobre puntos incompatibles; separar implementación de verificación pendiente.
3. `README.md` y `estadoDelProyecto.md` describen implementación; comprobar sus afirmaciones en código. El documento original v0.2 y las propuestas arquitectónicas son antecedentes, no una lista de funcionalidades obligatorias.
4. Separar siempre: confirmado por el usuario, criterio de implementación, implementado y pendiente. No presentar una recomendación de una IA como acuerdo del cliente.
5. Implementar lo solicitado de principio a fin. No ampliar el MVP con módulos, infraestructura o automatizaciones no pedidos. Preguntar solo por contradicciones materiales que no puedan resolverse con el contexto.

## Reglas del producto

- Aplicación web para celulares y computadoras. Interfaz en español, clara, adaptable y consistente con el diseño existente.
- PostgreSQL y API autenticada son la fuente de verdad. No introducir persistencia operativa en localStorage/sessionStorage ni simular un guardado exitoso ante fallo de red.
- Validar permisos, referencias, cantidades y transiciones en servidor; ocultar botones no es autorización.
- Conservar historial, actores, fechas, plantillas capturadas, vínculos y costos históricos. No reescribir silenciosamente registros confirmados.
- Categorías: **Autobús** (`bus`/`BUS`) y **Sprinter de pasajeros** (`truck`/`TRUCK`, claves heredadas, no vehículos de carga). Conservar claves, IDs e historial; no crear duplicados para renombrar.
- Ambas categorías participan en todos los flujos y selectores de unidades. Usar Unidad/Unidades para textos comunes y mostrar el tipo cuando ayude. El filtro manual de catálogo puede acotar una categoría; no excluir Sprinter por código en viajes ni circulación.
- Un caso de viaje abierto por unidad, tanto Autobús como Sprinter; pre antes de post; ambas etapas antes del cierre. Cerrar no resuelve fallas ni autoriza circulación.
- Golpes/Fallas: consulta por unidad y decisión humana; conservar claves históricas y declaraciones sin deduplicación automática. El chofer registra directamente, sin confirmación previa; solo admin/mecánico resuelve o abre orden.
- Carrocero/eléctrico reciben orden y requisición impresas. Almacén registra movimientos y el mecánico finaliza. No necesitan cuentas ni paneles de técnicos en este MVP.
- No añadir fotos/comprobantes privados ni recuperación de contraseña. Sí catálogo de empleados del taller con baja lógica, sin cuentas ni paneles de técnicos; fotos solo indicadas como pendientes.
- Circulación requiere decisión explícita. Orden en proceso/pausada deriva bloqueo sin actor sistema; al finalizar se registra Autorizar/No autorizar. Otro trabajo en curso impide autorizar. Cerrar viajes no autoriza.
- Servicios externos/carretera: registro por unidad con costos y prestador; no descuentan inventario. No añadir mano de obra ni gastos externos a órdenes internas.
- No introducir entregas fuera de turno ni modelado de turnos. Conservar captura al cierre del turno y las entregas/devoluciones actuales.
- Mantener CAF 15,000 km, general 30 días y emergencia 90 días. Actualizar la definición general guardada sin reescribir plantillas capturadas. Una revisión vencida avisa; no bloquea ni crea órdenes automáticamente.
- Finalizar una orden con materiales exige entrega neta positiva de cada artículo requerido, confirmada por almacén; puede igualar lo estimado. Sin materiales, ese bloqueo no aplica.

## Arquitectura y cambios

- Stack existente: React/TypeScript/Vite/CSS propio; NestJS/Prisma/PostgreSQL; reglas propias en `shared/`.
- La operación vigente usa `OperationState` JSONB, `OperationDraft` y `OperationEvent`. Los modelos relacionales iniciales no son automáticamente módulos activos. Evitar una segunda fuente de verdad.
- Ampliar contratos, esquemas Zod, comandos autorizados, reglas compartidas, persistencia y UI de forma coherente. Mantener transacciones, control de revisión e idempotencia existentes.
- No normalizar toda la base, cambiar de framework, añadir microservicios ni actualizar dependencias mayores como trabajo incidental.
- Migraciones aditivas y compatibles si hacen falta. No ejecutar reset, borrado de volúmenes, reseed destructivo ni cambios masivos para resolver errores.
- No sobrescribir `.env`, mostrar secretos, incorporar datos reales, respaldos o credenciales al repositorio. No desplegar ni publicar sin autorización.
- Preservar cambios ajenos. Inspeccionar estado de trabajo antes de editar; si Git falla, investigar el entorno sin reinicializar el repositorio.
- Leer scripts antes de ejecutarlos: `lint` y `format` actuales modifican archivos. Evitar build/watch simultáneos del backend porque comparten `dist/`.

## Verificación y entrega

- Probar los cambios de reglas con casos relevantes, permisos negativos y persistencia tras recarga. Verificar UI en escritorio y móvil; comprobar impresión cuando corresponda.
- Comandos disponibles: `npm --prefix frontend test -- --run`, `npm --prefix frontend run build`, `npm --prefix backend test -- --runInBand`, `npm --prefix backend run build`.
- Antes de invocar esos comandos, confirmar dependencias y leer sus pre-scripts: varios compilan `shared/`. No afirmar que se ejecutaron si solo se revisó código.
- Pruebas PostgreSQL: `npm --prefix backend run test:database`; inspeccionar primero su script y usar exclusivamente su BD temporal aislada. Nunca apuntar pruebas destructivas a la BD operativa.
- Si falta un servicio, conservar el trabajo y explicar qué no pudo verificarse. No instalar, migrar o borrar datos por sorpresa.
- Actualizar estado y documentación afectados con resultados reales. No marcar completadas funciones que solo tienen tablas o pantallas.
- Entregar cambios, razones, comprobaciones ejecutadas, limitaciones y pendientes concretos. Evitar porcentajes de avance sin criterios medibles.
