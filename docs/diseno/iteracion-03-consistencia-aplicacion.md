# Iteración 03 — consistencia de toda la aplicación

Fecha: 24 de octubre de 2026.

## Problema corregido

La primera entrega estilizó el contenido de Solicitudes mediante selectores limitados a `data-page="requests"`. El resto de los módulos conservaba controles, textos y colores anteriores; por eso parecían aplicaciones diferentes aunque compartían navegación.

## Solución

Nueva capa común `frontend/src/styles/workspace.css`, importada después de `homepage.css`. Su ámbito `.visual-refresh[data-page]` cubre todas las vistas operativas. Define el contrato visual compartido y tiene prioridad sobre las reglas comunes de la primera iteración. No añadir nuevas variantes de tarjeta, campo o botón restringidas a una sola pantalla sin una necesidad funcional documentada.

Se conservan React, CSS propio, Lucide, DM Sans/Manrope y los tokens `--re-*`. No se añadieron dependencias de producción.

Elementos unificados:

- Títulos, descripciones, jerarquía de secciones y ancho/espaciado del contenido.
- Tarjetas blancas con los mismos bordes, radios y separación.
- Acciones primarias, secundarias, peligrosas, enlaces de acción e iconos.
- Campos de 16 px, altura mínima de 48 px y controles de acción de al menos 44 px.
- Filtros, estados, avisos, metadatos y estados vacíos.
- Listas de unidades, artículos, servicios, órdenes y casos de viaje.
- Formularios y diálogos de alta/edición, selección de materiales, cantidades y entrega de almacén.
- Expediente, historial tabular, tablas de materiales, detalles de orden y resumen lateral.

Se ajustaron columnas y saltos de línea para que el aumento de tamaño no comprima formularios, botones o cantidades en móvil. El resumen de orden deja de ser lateral antes de quedarse sin espacio.

Las tablas amplias siguen siendo tablas: el desplazamiento horizontal ocurre dentro de su contenedor, no en la página. Las tres regiones de tablas de órdenes, entregas e historial ahora tienen nombre accesible y se pueden enfocar con Tab para desplazarse mediante teclado.

## Skill local

Se volvió a leer `.opencode/skills/ui-ux-pro-max/SKILL.md`, junto con el MASTER existente. La búsqueda local `consistent component design --domain ux` devolvió, entre otros, **Typography → Font Size Scale**, aplicable a la inconsistencia observada. Se mantuvo la escala tipográfica compartida en lugar de generar otra paleta o dirección visual.

## Verificación

Chrome headless independiente, sin modificar el perfil del navegador del usuario:

- Admin, mecánico, almacén y chofer con autenticación real.
- Anchos 320, 375, 768, 1024 y 1440 px.
- **115 comprobaciones** de combinaciones de vista/estado/perfil/tamaño, incluidos diálogos y orden con servicios/materiales.
- Sin desbordamiento horizontal de página o diálogo en los casos comprobados; tablas con desplazamiento interno deliberado.
- Descripción de página de 16 px, botones de al menos 44 px, sin errores JavaScript de página.
- Capturas revisadas de catálogos, expediente, formularios, revisiones, selector de servicios y entrega de almacén.
- Dos pruebas automatizadas nuevas para conservar las regiones accesibles de tablas.
- Suite completa: 66 pruebas aprobadas en 15 archivos; compilación TypeScript/Vite correcta.

El script y las capturas de revisión están fuera del código de producción, en el directorio temporal aprobado `AppData/Local/Temp/opencode/ui-review-20261024`. No se instaló Playwright en el proyecto. Las solicitudes y órdenes ficticias se guardaron solo en contextos desechables de ese navegador y se descartaron al cerrarlos.

## Sin cambios de negocio

No se modificaron autenticación, permisos, intervalos de revisiones, CAF, estados de órdenes, cantidades, validaciones, confirmaciones de almacén ni persistencia. Se conserva el aviso de datos locales y la requisición imprimible mantiene sus estilos propios. El backend de unidades continúa en el estado documentado, sin conectar silenciosamente datos locales.

Esta revisión visual no representa una certificación WCAG completa ni una revisión exhaustiva de todos los estados posibles.
