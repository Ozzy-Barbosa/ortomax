# Gimo · finanzas personales de la Dra. Gina

PWA en español para registrar ingresos, gastos, inversión en equipo, transferencias, pendientes de cobro, ahorro y metas. Destino: **https://www.orthomaxlapaz.com/gina/**. Conserva la identidad visual de Orthomax y el nombre Gimo elegido por el propietario del proyecto.

El modo real comienza vacío. La demostración utiliza datos ficticios únicamente en memoria. No hay servidor de datos, sincronización, analítica ni envíos a las clínicas.

## Protección de registros

Los registros y respaldos se cifran con AES-256-GCM; la contraseña deriva una clave mediante PBKDF2-SHA256. La clave vive solo en memoria durante la sesión. El guardado se confirma al terminar la transacción de IndexedDB y rechaza escrituras obsoletas. Se conservan hasta doce revisiones locales y una recuperación previa a restaurar. Una actualización reemplaza recursos de la PWA y no borra su base de datos.

**La recuperación ante pérdida del dispositivo o borrado del navegador requiere un respaldo externo y su contraseña.** Las copias locales no sustituyen el archivo guardado fuera del iPhone. Gimo no confirma que iCloud recibió el archivo, no recupera contraseñas por correo y no sincroniza dispositivos. La restauración reemplaza el historial, no lo fusiona.

Conservar siempre los identificadores `orthomax-gina-vault`, `orthomax-gina-encrypted`, el esquema `1`, la extensión `.ginabackup` y el prefijo `/gina/` mientras no exista una migración explícita y comprobada. El cambio de marca no cambia estos contratos.

## Desarrollo

Requiere Node.js 22 y npm. Las dependencias quedan fijadas en el archivo de bloqueo.

```sh
npm ci
npm run dev
npm run check
npx playwright install chromium webkit
npm run test:e2e
```

`dev` sirve `/gina/` en el puerto 5192. `npm run check` ejecuta las pruebas de dominio y bóveda y compila. Las pruebas de navegador sirven la compilación en 4192; la prueba de actualización utiliza además 4194. Necesitan esos puertos libres. Cada prueba utiliza un perfil aislado y datos ficticios.

Para la revisión visual: `npm run preview -- --port 4193`, seguido de `node scripts/visual-qa.mjs`. El informe identifica cuáles pantallas recibieron comprobación automática de accesibilidad. Chromium con tamaño de iPhone no equivale a Safari en un dispositivo físico.

## Estructura

- `src/domain.ts`: validaciones, cálculos y periodos; importes en centavos enteros.
- `src/vault.ts`: persistencia cifrada, respaldo y recuperación.
- `src/App.tsx`, `src/Forms.tsx`, `src/Settings.tsx`: interfaz y coordinación.
- `scripts/build-sw.mjs`: caché versionada de recursos, independiente de la base financiera.
- `e2e/`: recorridos de uso, respaldo, aislamiento de demostración y actualización.
- `docs/GUIA-DRA-GINA.md`: instrucciones de uso y recuperación.
- `docs/ARQUITECTURA.md`: contratos y límites de seguridad.
- `docs/DESPLIEGUE.md`: integración con el sitio de Orthomax y mantenimiento.
- `docs/VALIDACION.md`: evidencia y límites de la verificación.

El símbolo, los colores y las fuentes locales provienen del sitio Orthomax. Se conservan las licencias de las fuentes en `public/brand/`. Los prototipos ALTUM se utilizaron como referencia para separar cálculos, interfaz y persistencia; sus pruebas anteriores no acreditan esta aplicación.

## Mantenimiento seguro

Antes de cambiar el esquema, implementar y probar una migración sobre una copia validada, conservar la versión original y verificar recuperación. Nunca resolver incompatibilidades mediante un reinicio automático de la bóveda. Las actualizaciones deben seguir pasando los recorridos de respaldo y conservación del almacenamiento.

El sitio estático y la app comparten origen. No añadir scripts de terceros al origen sin evaluar su acceso potencial al almacenamiento. La política de contenido y el cifrado reducen riesgos, pero no convierten una sesión desbloqueada en un entorno aislado del resto del mismo origen.
