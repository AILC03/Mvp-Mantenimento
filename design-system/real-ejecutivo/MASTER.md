# Real Ejecutivo — dirección visual incremental

## Producto y tecnología

Herramienta interna de mantenimiento de flota para personal de taller, administración, almacén y choferes. React 19, TypeScript, Vite, CSS propio y Lucide. Sin cambiar framework ni añadir dependencias de UI.

## Referencia de diseño

Se consultó y ejecutó UI UX Pro Max desde https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, commit `d14efff8ed1faa4187f004f79926f428c8074ec7`.

Continuación: skill local leída y ejecutada desde `.opencode/skills/ui-ux-pro-max`, según indicación del usuario. Segunda iteración de acceso en `pages/login.md`; reutiliza tokens existentes y añade resumen accesible de errores. No cambia la autenticación ni las reglas de negocio.

La consulta `enterprise backoffice dashboard light` verificó el estilo **Minimalism & Swiss Style**, adecuado para una herramienta empresarial: jerarquía clara, superficies simples, espacio consistente, foco visible y pocos efectos. Las consultas UX confirmaron contraste mínimo 4.5:1 y cuerpo legible en móvil; la guía React recomienda consultas accesibles en pruebas.

Se adopta ese criterio de estilo, no la composición de landing comercial generada. Tampoco se adopta el primer resultado oscuro/OLED, por no corresponder al uso actual. La paleta azul/naranja y la pareja Fira sugeridas no se trasladan: se conserva la identidad verde y las fuentes existentes para una evolución gradual.

## Decisiones

- Panel claro, fondo neutral cálido y tarjetas blancas; navegación lateral verde oscuro.
- Verde bosque para acciones, lima como acento de marca; ámbar para avisos, rojo para errores. Mantener también texto y símbolos de estado.
- DM Sans para cuerpo y Manrope para títulos, ya presentes. Mejorar tamaño, peso, interlineado y contraste antes de cambiar familias tipográficas.
- Cuerpo principal 16 px, información secundaria 14 px, metadatos 12–13 px. Evitar el texto operativo de 8–10 px de la versión anterior.
- Espaciado basado en 4/8 px. Controles de al menos 44 px en la primera página, foco visible y transiciones breves sin desplazar contenido.
- Iconos Lucide consistentes; ocultar los puramente decorativos a tecnologías de asistencia.
- Móvil: contenido en una columna, navegación desplegable con cierre accesible y controles táctiles separados. Sin desbordamiento horizontal de página.
- No añadir indicadores de actividad en tiempo real, gráficos decorativos, contadores laterales ni métricas sin datos.
- Respetar `prefers-reduced-motion`. No incorporar GSAP para esta etapa.

## Implementación

Tokens semánticos `--re-*` en `frontend/src/styles.css`. `frontend/src/styles/homepage.css` conserva navegación y ajustes específicos del inicio. **La capa compartida vigente es `frontend/src/styles/workspace.css`**, importada después: aplica tipografía, tarjetas, controles, estados, formularios, diálogos y tablas a todas las vistas `.visual-refresh[data-page]`, no solo Solicitudes. `frontend/src/styles/login.css` cubre el acceso. Ver [iteración de consistencia](../../docs/diseno/iteracion-03-consistencia-aplicacion.md).

El diseño no modifica autorización, validaciones, persistencia, intervalos, cantidades, inventario ni estados de órdenes o revisiones. No agrega contadores a los menús o categorías donde se retiraron.

## Próximas etapas

1. Navegación común, Solicitudes y acceso: aplicados.
2. Contrato visual compartido en órdenes, catálogos, almacén, revisiones y expediente/historial: aplicado y revisado en móvil/escritorio.
3. Mantener consistencia al integrar las APIs: reutilizar clases existentes para carga, error y confirmación, no crear otro lenguaje visual.
4. Continuar revisión accesible de estados menos frecuentes y probar con personal operativo; no considerar esta entrega una certificación global.

Antes de ampliar, leer este archivo y el ajuste específico de página correspondiente.
