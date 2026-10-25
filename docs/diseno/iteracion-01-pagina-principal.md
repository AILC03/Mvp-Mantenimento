# Diseño incremental — primera iteración

**Fecha:** 24 de octubre de 2026.  
**Alcance:** estructura común del espacio de trabajo y página inicial de Solicitudes. No es un rediseño completo de todos los módulos.

## Revisión previa

- React 19, Vite y TypeScript; iconos Lucide.
- CSS propio en `frontend/src/styles.css`; no se utiliza Tailwind ni un kit de componentes.
- `App.tsx` restaura la sesión y presenta login o `Workbench.tsx`.
- `Workbench.tsx` conserva las vistas y sus permisos: solicitudes, órdenes, revisiones, artículos, unidades, tipos y expediente.
- La página inicial de mecánico/admin es Solicitudes; chofer tiene el formulario de reporte y su bandeja; almacén inicia en artículos.
- Problemas identificados: texto operativo de 8–12 px, bajo contraste secundario, controles pequeños y algunos encabezados comprimidos en móvil.

## Uso de UI UX Pro Max

La skill no estaba registrada en el cargador local. Se consultó su `SKILL.md`, referencias y buscador desde el repositorio facilitado, sin instalar una skill global ni incorporar sus scripts a la aplicación.

Referencia: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, commit `d14efff8ed1faa4187f004f79926f428c8074ec7`.

Consultas realizadas:

- `fleet maintenance operations dashboard --design-system`: el perfil oscuro/OLED no encajaba y no se adoptó.
- `enterprise backoffice dashboard light --design-system`: estilo verificado Minimalism & Swiss Style, adecuado a una herramienta interna empresarial.
- `readable text contrast --domain ux`: contraste 4.5:1, texto oscuro sobre superficies claras y cuerpo móvil legible.
- `responsive accessible dashboard --stack react`: pruebas con consultas accesibles de Testing Library.

Se usaron las recomendaciones pertinentes, no la estructura de landing comercial, la paleta azul/naranja ni nuevas familias de fuentes. La dirección final es una adaptación deliberada a la marca y al producto existentes.

## Dirección visual

Panel claro y sobrio, con navegación verde oscuro, superficies blancas y acento lima de marca. Se conservan DM Sans y Manrope, mejorando escala, peso e interlineado.

- Texto principal de 16 px en Solicitudes.
- Controles y metadatos secundarios con tamaños legibles.
- Tokens semánticos `--re-*` para texto, superficies, marca, avisos, error, éxito, bordes, foco y espaciado.
- Ritmo de espaciado 4/8 px, tarjetas consistentes y sombras discretas.
- Acción principal más clara; estados y avisos siguen comunicándose mediante texto, no solo color.
- No se añadieron KPIs, contadores laterales, datos de actividad ni gráficos ficticios.

Fuente de verdad: [MASTER](../../design-system/real-ejecutivo/MASTER.md) y [ajuste de inicio](../../design-system/real-ejecutivo/pages/home.md).

## Archivos y aplicación

- `frontend/src/styles.css`: tokens nuevos; se conservan reglas previas de otros módulos.
- `frontend/src/styles/homepage.css`: nueva capa CSS, después del archivo existente, limitada a `.visual-refresh` para navegación y a `data-page="requests"` para el contenido inicial.
- `frontend/src/main.tsx`: importación de esa capa, sin dependencias nuevas de interfaz.
- `frontend/src/Workbench.tsx`: identificación de vista, enlace de salto, navegación actual y menú móvil accesible.
- `frontend/src/components/ServiceRequests.tsx`: estructura visual de encabezado/estado vacío y jerarquía de la acción existente.
- `frontend/src/homepage-design.test.tsx`: comprobación de contraste de tokens y navegación accesible.

El formulario del chofer y la bandeja comparten dos columnas en escritorio amplio y una en pantallas estrechas. Los encabezados y etiquetas envuelven sin quedar comprimidos en columnas mínimas.

## Accesibilidad

- Enlace **Saltar al contenido principal** y destino enfocable.
- `aria-current` en navegación y `aria-expanded`/`aria-controls` en menú móvil.
- Menú cerrado oculto también para navegación por teclado en móvil; al abrir se enfoca navegación. Escape y fondo permiten cerrar, devolviendo foco al control.
- Recorrido por teclado contenido en la navegación móvil abierta, con botón de cierre y Escape como salidas.
- Controles de la página principal con objetivos de al menos 44 px; campos de 48 px y fuente de 16 px.
- Foco visible y colores de texto/estado verificados con relación mínima 4.5:1 en los pares nuevos de esta etapa.
- Compatibilidad con movimiento reducido, sin añadir librerías de animación.

Estas comprobaciones no son una certificación WCAG de toda la aplicación. Los módulos aún no migrados mantienen parte de los estilos anteriores.

## Verificación realizada

- Login real y logout en navegador independiente con cuentas de prueba de mecánico y chofer.
- Tamaños 375, 768, 1024 y 1440 px; además 667 × 375 en horizontal, con movimiento reducido.
- Sin desbordamiento horizontal de página en los tamaños comprobados.
- Texto principal/campos de 16 px y filtros de 44 px de alto.
- Apertura del menú móvil y cierre por Escape.
- Revisión de capturas de escritorio/móvil y diálogo de revisión de solicitud.
- Solicitud ficticia usada solo dentro de un contexto de navegador aislado, descartado al finalizar; no se añadieron reportes al navegador del usuario ni a su base de datos de negocio.

El navegador integrado no pudo capturar su ventana oculta. Se utilizó Chrome headless con una herramienta de prueba instalada temporalmente fuera del proyecto. No se agregó Playwright al frontend ni al código de producción.

## Funcionalidad conservada

No se modificaron roles, reglas, validaciones de negocio, intervalos CAF/revisiones, confirmaciones de materiales, estados de órdenes, persistencia ni endpoints. Admin sigue sin la tarjeta periódica en su inicio; no se reintrodujeron contadores laterales ni contadores de categorías de órdenes.

El aviso de almacenamiento operativo local se conserva visible. El rediseño no implica integración adicional con PostgreSQL.

## Siguientes iteraciones

Acceso/formularios de órdenes, almacén, expediente y revisión de tablas/diálogos. Cada etapa debe adoptar los mismos tokens de forma explícita, no extender overrides globales a toda la aplicación sin comprobar sus flujos.
