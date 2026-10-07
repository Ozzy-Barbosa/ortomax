# Gimo · evidencia de validación

Fecha de comprobación local: **7 de octubre de 2026**. Datos, cuentas y contraseñas de prueba ficticios; perfiles de navegador independientes de los de la usuaria. No se utilizaron datos financieros reales.

## Resultados comprobados

| Comprobación | Resultado |
| --- | --- |
| Dominio financiero y bóveda cifrada | 54 pruebas aprobadas: 37 de dominio y 17 de persistencia. |
| Recorridos de navegador | 29 aprobados; 1 caso de emulación offline omitido exclusivamente en WebKit, explicado abajo. |
| Motores | Chromium y WebKit de Playwright 1.63; ejecución en Windows. |
| Web de Orthomax | 6 pruebas aprobadas, verificación de recursos y compilación conjunta correctas. |
| Conservación del sitio | 8 páginas y recursos de la compilación coinciden por SHA-256 con la web pública previa. |
| Adaptación visual | 30 combinaciones de pantalla y ancho: inicio, resumen, actividades, configuración, reportes y registro a 320, 390, 430, 768 y 1440 px; sin desbordamiento horizontal ni errores JavaScript detectados. |
| Accesibilidad automática | 8 vistas escaneadas con axe: las 6 anteriores a 390 px y las de inicio/resumen a 1440 px; sin infracciones detectadas en las reglas WCAG A/AA seleccionadas. |
| Dependencias | `npm audit`: 0 vulnerabilidades conocidas reportadas al revisar. |

La revisión visual incluye capturas de móvil y escritorio, etiquetas accesibles de los formularios, contraste y campos de una columna en móvil. El análisis automático no equivale a una certificación integral de accesibilidad ni a pruebas de VoiceOver en un teléfono físico.

## Conservación de datos

Las pruebas comprueban guardado y reapertura; contraseña incorrecta sin alteración; ausencia de conceptos, importes estructurados y contraseña en los datos cifrados; exportación y restauración de un archivo en un contexto vacío; bloqueo por inactividad; conflicto entre pestañas; aislamiento del modo demostración; rechazo de versiones o archivos inválidos; errores de cuota y transacciones canceladas; recuperación de una copia local cuando se daña el registro principal.

La actualización real de un service worker en el servidor de prueba conserva **exactamente** el contenido cifrado principal y las copias de recuperación. Se verifica que la caché nueva sustituye a la anterior y que el worker no controla la raíz del sitio.

Chromium también comprueba abrir, capturar y volver a consultar con `setOffline(true)`. La prueba con el **servidor detenido** pasa en Chromium y WebKit: un navegador vacío no puede obtener la página, mientras el que ya tiene la aplicación preparada puede reabrirla, guardar un ingreso y conservarlo tras recargar.

Las solicitudes observadas durante el recorrido de creación y reapertura no incluyen los valores financieros de prueba ni la contraseña, y no se envían escrituras HTTP.

## Límite de la emulación offline de WebKit

Playwright 1.63 produjo `WebKit encountered an internal error` al recargar después de `context.setOffline(true)`, aun con el service worker activo. Coincide con el [problema documentado en Playwright #42775](https://github.com/microsoft/playwright/issues/42775). Se omite **solo ese caso de la bandera de emulación** en WebKit, con anotación en la prueba; no se marca como aprobado.

Se conserva una verificación separada con el servidor realmente detenido y un control negativo sin caché. Esa comprobación pasó en ambos motores. No demuestra por sí sola todos los comportamientos del modo avión de un iPhone; esa prueba física sigue pendiente.

## Reglas financieras cubiertas

Ingresos por fuente y ámbito, transferencias sin doble conteo, inversión separada del resultado operativo, saldos iniciales con corte, cuentas mixtas, ahorro reservado y liberado, metas semanales y mensuales, periodos cruzados y año bisiesto, cobros parciales y excesos, correcciones y anulaciones, cierre mensual con cambios posteriores, catálogos archivados, filtros y exportación CSV con protección ante fórmulas.

## Evidencia reproducible

- `npm run check`: validación de dominio y bóveda, TypeScript y compilación.
- `npm run test:e2e`: recorridos en ambos motores; instala antes `npx playwright install chromium webkit`.
- `node scripts/visual-qa.mjs`: genera capturas e informe en `output/qa/`. `axeChecked` distingue las vistas escaneadas de las que solo recibieron comprobación de tamaño y errores.
- `node scripts/verify-release.mjs --baseline`: guarda huellas de la web previa, antes de publicar.
- `node scripts/verify-release.mjs`: compara la web previa y comprueba HTML, manifiesto, versión y los recursos publicados de Gimo; guarda `output/release/live-verification.json`.
- `APP_URL` permite ejecutar los recorridos de bóveda contra la dirección publicada con datos ficticios en perfiles aislados; no modifica datos de la doctora.

El workflow de Orthomax vuelve a ejecutar las pruebas antes de publicar. Su resultado y la dirección real deben verificarse tras el despliegue; una compilación local o un commit no los sustituyen.

## Pendientes físicos y límites de recuperación

Pendiente comprobar con la doctora: instalación desde Safari, apertura desde el icono, teclado y selector de Archivos de su iPhone, guardado del respaldo en el destino que elija, modo avión, actualización y recuperación real en otro dispositivo. Las pruebas de WebKit de escritorio no se presentan como pruebas en iOS físico.

Ninguna prueba permite prometer conservación ante pérdida del teléfono, borrado de los datos del sitio o daño del almacenamiento sin una copia externa. La usuaria debe conservar el respaldo cifrado fuera del dispositivo y su contraseña. No hay nube ni sincronización automática en esta versión.
