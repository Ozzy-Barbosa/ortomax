# Publicación y mantenimiento de Gimo

## Ubicación

Destino: `https://www.orthomaxlapaz.com/gina/`, dentro del sitio existente de Orthomax en GitHub Pages. Se conserva el dominio y la página del consultorio. No se publican bóvedas, contraseñas, respaldos, resultados de pruebas ni datos reales.

En el repositorio del sitio, la fuente de Gimo vive en `apps/gina/`. La compilación raíz prepara la aplicación y después el sitio, e incluye `apps/gina/dist/` en `dist/gina/`. Si falta la aplicación compilada, el empaquetado falla para evitar una publicación futura que elimine el acceso a Gimo.

## Preparar una versión

Desde la raíz del repositorio Orthomax:

```sh
npm ci --prefix apps/gina
npm test --prefix apps/gina
npm test
npm run check
npm run build -- --pages
node tools/check.mjs --dist
```

Desde `apps/gina`, ejecutar también `npx playwright install chromium webkit` y `npm run test:e2e`. El workflow **Publicar Orthomax** instala las dependencias fijadas, ejecuta pruebas de ambas aplicaciones, compila, verifica recursos y ejecuta los recorridos de Gimo antes de publicar `dist/`.

Revisar el cambio, guardarlo en Git, subir la revisión a `main` y ejecutar el workflow manual de publicación. Verificar su resultado completo, la dirección pública de Gimo, los recursos de la web del consultorio y la versión servida. Un push por sí solo no acredita una publicación.

## Conservación de datos entre versiones

- Mantener el origen exacto HTTPS y `/gina/` como acceso principal. Una copia en otro dominio no puede leer automáticamente la bóveda del primero.
- Conservar la base `orthomax-gina-vault`, la versión IndexedDB `1`, los almacenes `records` y `recovery`, y el formato de respaldo actual. Estos nombres históricos se mantienen aunque la app se llame Gimo.
- El service worker solo guarda recursos estáticos de `/gina/`. No puede abrir, limpiar o eliminar bases de datos. Retira únicamente cachés de su prefijo al activarse una nueva versión.
- La usuaria debe terminar o guardar su captura antes de aceptar una actualización. La versión nueva espera su confirmación.
- No recomendar borrar datos de Safari o reinstalar la app para corregir una versión sin un respaldo comprobado. Solicitar primero una exportación cuando la bóveda aún abre.
- Revertir código no debe implicar volver a un esquema que no reconoce los datos nuevos. Esta V1 rechaza esquemas desconocidos sin alterarlos.

## Verificación en el iPhone principal

Abrir la dirección en Safari y añadir a inicio. Configurar el espacio real desde ese icono, comprobar un movimiento, bloquear y volver a abrir; exportar un respaldo y localizarlo en Archivos. Probar una restauración en otro perfil o dispositivo vacío. Comprobar la reapertura en modo avión. Mantener un único dispositivo principal para la captura.

Las pruebas automatizadas realizadas se documentan en `VALIDACION.md`. La instalación, teclado y selector de archivos de un iPhone físico requieren esa comprobación en el dispositivo; no se presentan como hechos a partir de emulación.

## Límites del hosting

GitHub Pages sirve archivos estáticos. No ofrece aquí una API de datos, cuentas remotas, copias automáticas ni sincronización. El cifrado es local y necesita la contraseña de la usuaria. Las cabeceras personalizadas de `_headers` y `.htaccess` no operan en Pages; Gimo incluye una política CSP compatible en su HTML. Para añadir recuperación remota o acceso entre dispositivos, diseñar primero autenticación y almacenamiento privado, migración y controles de acceso.
