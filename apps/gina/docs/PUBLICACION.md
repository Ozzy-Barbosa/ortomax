# Gimo · comprobación de publicación

Publicada y comprobada el **7 de octubre de 2026**.

- Aplicación: [Gimo](https://www.orthomaxlapaz.com/gina/).
- Repositorio: [fuente de Gimo](https://github.com/Ozzy-Barbosa/ortomax/tree/main/apps/gina).
- Revisión de código publicada: `2813bca21364d208b06018f5be01c3538882d08d`.
- Versión de recursos: `8bc1b7e528f4`.
- [Publicación de GitHub Actions 37687320578](https://github.com/Ozzy-Barbosa/ortomax/actions/runs/37687320578): compilación y despliegue finalizados correctamente.

El servidor de publicación aprobó 54 pruebas de cálculos y bóveda, 6 del sitio Orthomax y 29 recorridos de navegador. Un caso de emulación offline de WebKit se omite por el límite documentado en `VALIDACION.md`; la prueba con el servidor detenido sí se ejecuta y pasa en ambos motores.

Después del despliegue se verificaron el nombre Gimo, HTTPS, manifiesto y alcance `/gina/`, versión servida, disponibilidad de los 11 recursos de la app y coincidencia por SHA-256 de 8 páginas y recursos de Orthomax respecto de su versión anterior.

Los recorridos de bóveda se repitieron **contra la dirección publicada**: 11 aprobados y el mismo caso de emulación de WebKit omitido. Se verificaron guardado, reapertura, contraseña incorrecta, respaldo y restauración, bloqueo, cambios entre pestañas, aislamiento de demostración y uso sin conexión en Chromium. Todos los valores usados fueron ficticios y se guardaron únicamente en perfiles aislados del navegador de pruebas.

La revisión visual pública volvió a comprobar 30 combinaciones de pantallas y tamaños sin desbordamiento horizontal ni errores JavaScript. Las 8 vistas seleccionadas para axe no reportaron infracciones. Las capturas e informes locales están en `output/qa/` y `output/release/`; se excluyen del sitio y del repositorio para no convertir futuras evidencias privadas en archivos públicos por accidente.

Queda pendiente la comprobación física con el iPhone de la doctora: instalación desde Safari, teclado, Archivos, modo avión y recuperación en otro dispositivo. No hay sincronización automática ni respaldo remoto. La copia cifrada fuera del teléfono y su contraseña son necesarias para recuperarse de su pérdida o del borrado de datos del navegador.
