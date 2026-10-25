# Inicio operativo — Solicitudes

## Alcance

La página inicial tras autenticar es Solicitudes para mecánico/admin y el reporte de solicitudes para chofer. Almacén mantiene su página funcional actual; en esta entrega recibe únicamente la mejora de navegación común.

## Composición

1. Navegación lateral y barra superior con identidad de la sesión.
2. Título y descripción legibles, sin hero comercial ni métricas inventadas.
3. Aviso de que los registros operativos siguen locales, siempre visible y legible.
4. Bandeja con filtros existentes, estados textuales, acción principal y tarjetas de reportes.
5. Formulario del chofer: una columna de lectura y controles de 48 px. En pantallas grandes, formulario y bandeja pueden compartir dos columnas.
6. Información secundaria de periodicidades y seguridad sin restarle contraste ni alterar su visibilidad por rol.

## Accesibilidad y móvil

- Enlace de salto al contenido.
- Navegación actual marcada con `aria-current`, menú móvil con `aria-expanded` y cierre por Escape/fondo.
- Navegación cerrada no disponible mediante Tab en móvil.
- Texto largo, referencias y nombres pueden envolver sin romper el diseño.
- Filtros con área táctil cómoda, no dependientes de hover.
- No cambiar los textos funcionales usados para realizar acciones ni sus manejadores.

## Fuera de alcance

No cambiar login, modelo de datos, roles, reglas de cierre, entrega de materiales, intervalos de mantenimiento o contadores. No declarar los datos operativos como sincronizados con el backend.
