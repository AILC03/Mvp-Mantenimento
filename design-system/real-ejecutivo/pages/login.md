# Acceso — segunda iteración

Se mantiene el diseño maestro: verde bosque/lima, DM Sans y Manrope, CSS propio y Lucide.

- Fondo claro y composición de dos columnas en escritorio; identidad compacta y formulario de una columna en móvil.
- Texto principal y campos de 16 px; campos de 52 px, botón principal de 48 px y mostrar contraseña de 44 px.
- Texto secundario de 13 px con tokens de contraste del maestro.
- Resumen de error al inicio del formulario, enfocable después de enviar; enlaces a los campos vacíos e indicación `aria-invalid`/`aria-describedby`.
- Se conservan autocompletado de usuario/contraseña, pegado y sesión real por cookie. Sin selector de perfil ni acceso local de emergencia.
- Estilos en `frontend/src/styles/login.css`, importados después del CSS base. No extender sus reglas a formularios de negocio.

Referencia local consultada: `.opencode/skills/ui-ux-pro-max/SKILL.md`; búsqueda `error summary validation --domain ux`, resultado verificado Forms / Accessibility → Focusable Error Summary.

Validado con Chrome headless a 320, 375, 768, 1024 y 1440 px, y 667×375 horizontal. Sin desbordamiento horizontal; foco/enlaces de error y login/logout reales comprobados. No es certificación WCAG global.
