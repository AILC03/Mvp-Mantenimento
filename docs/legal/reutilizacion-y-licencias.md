# Reutilización de código y licencias

**Fecha:** 21 de octubre de 2026.  
**Estado:** recomendación técnica inicial; pendiente de aprobación y, cuando corresponda, revisión jurídica. No es un dictamen legal.

## Contexto

Se evaluó Atlas CMMS como referencia para Real Ejecutivo. Se revisaron su documentación general, la licencia raíz AGPLv3, el contrato comercial y las dependencias del frontend. No se ha realizado una auditoría de procedencia de cada archivo ni de todas sus dependencias.

## Recomendación

Desarrollar componentes y reglas propios del negocio. Reutilizar bibliotecas externas directamente desde sus fuentes originales, verificando las licencias de las versiones y paquetes concretos.

No incorporar código, componentes, estilos, imágenes o recursos propios de Atlas sin revisar su procedencia, licencia y autorización de uso. La estructura inicial de este proyecto no incorpora código de Atlas.

## Distinciones importantes

- Copiar un componente propio de Atlas puede implicar obligaciones AGPL aunque no se copie el sistema completo.
- Renombrar, traducir o transformar código con IA no elimina automáticamente su condición de obra derivada.
- Usar directamente una biblioteca externa que Atlas también utiliza no equivale a copiar sus componentes.
- Las ideas funcionales generales pueden orientar una implementación independiente; evitar copiar expresión protegida o recursos de marca.
- Separar frontend y backend mediante REST no resuelve por sí solo el alcance jurídico de una obra combinada.

## AGPLv3

Permite uso comercial. Según cómo se modifique, combine, distribuya y utilice el software, puede exigir proporcionar el código fuente correspondiente y conservar avisos. La sección 13 regula la oferta de código a usuarios que interactúan remotamente con una versión modificada.

Esto no equivale necesariamente a publicar un repositorio abierto al público ni a entregar datos operativos, fotos o secretos. Tampoco debe asumirse una exención general por uso interno.

## Licencia comercial de Atlas

El contrato consultado, con fecha efectiva del 8 de enero de 2026, contempla uso y modificación internos (2.1 y 2.2), restricciones de distribución (3.1), uso competitivo (3.5) y derechos SaaS limitados (3.6).

No asumir que una licencia estándar permite extraer componentes para una aplicación propietaria independiente o reutilizarlos con otros clientes. Solicitar autorización escrita que cubra el caso específico si se considera esa vía. Las condiciones comerciales y AGPL son alternativas; no mezclar sus restricciones como si fueran una sola licencia.

## Control recomendado para dependencias

**Preparación para GitHub, 25/10/2026:** las skills de terceros en `.opencode/skills/` se conservan localmente pero se excluyen de publicación. No todas contienen una licencia identificable en su carpeta (incluida la copia local de UI UX Pro Max), por lo que no se presupone permiso de redistribución. No forman parte de la aplicación ni de sus dependencias de ejecución. Los diseños y reglas propios del proyecto sí se versionan. Esta exclusión no sustituye la revisión de licencias de las dependencias npm.

Antes de aprobar una dependencia o código externo, registrar nombre, versión o commit, origen, licencia, avisos exigidos y uso previsto. Revisar también las dependencias transitivas y las diferencias entre ediciones gratuitas y comerciales. Conservar los textos de licencia y atribuciones requeridos.

No se ha elegido aún una licencia para el código propio del proyecto ni se han establecido condiciones de propiedad intelectual con el cliente.

## Fuentes consultadas

- Repositorio: https://github.com/Grashjs/cmms
- AGPLv3: https://github.com/Grashjs/cmms/blob/main/LICENSE
- Contrato comercial: https://github.com/Grashjs/cmms/blob/main/COMMERCIAL_LICENSE.MD
- Dependencias frontend: https://github.com/Grashjs/cmms/blob/main/frontend/package.json

Los enlaces apuntan a una rama mutable. Antes de incorporar código externo, conservar la referencia exacta del commit y de los términos aplicables.
