# Orthomax · Sitio del consultorio

Sitio estático en español para Orthomax Centro Odontológico, La Paz, B.C.S. No necesita PHP, base de datos, servicios de pago ni Node.js en el hosting. Node.js 22 o posterior solo se utiliza para preparar y comprobar los archivos antes de subirlos.

## Trabajar y revisar

```sh
npm run dev
npm test
npm run check
npm run build -- --preview
```

Vista local: http://127.0.0.1:4173. No es necesario ejecutar `npm install`: no hay dependencias de ejecución ni desarrollo. Abre la página mediante el servidor, no con `file://`, porque el JavaScript utiliza módulos.

`dist/` contiene la salida de cada compilación y se reemplaza al compilar. No edites esa carpeta directamente. La compilación de vista previa lleva `noindex` y bloquea el rastreo; NO se debe usar como versión pública definitiva.

## Publicación cuando se autorice el lanzamiento

1. Sigue `LANZAMIENTO.md` y confirma con la responsable teléfono, dirección, horarios, tratamientos, nombre comercial y privacidad.
2. El dominio ya está configurado en `site.config.json`: `https://www.orthomaxlapaz.com`. Marca las dos confirmaciones únicamente después de revisar los datos con la responsable.
3. Ejecuta `npm test`, `npm run check` y `npm run build`.
4. Ejecuta `node tools/check.mjs --dist`.
5. Sube **solo el contenido de `dist/`**, incluyendo `.htaccess` si usas Apache. No subas la carpeta del proyecto, `.git`, pruebas o herramientas.
6. Activa certificado HTTPS y la redirección al dominio canónico en el panel del proveedor. Comprueba la web publicada siguiendo la guía.

El build de producción genera las URLs canónicas, Open Graph, tarjeta de redes con una fotografía real existente, sitemap, robots indexable, datos estructurados Dentist y políticas de seguridad. Se detiene si falta el dominio o las confirmaciones. El dominio comprado en GoDaddy ya está definido; todavía no se ha publicado ni cambiado DNS. Consulta `AUDITORIA-SEO.md` para los hallazgos y las acciones posteriores al lanzamiento.

## Qué hace el sitio

- Presentación del consultorio, servicios, tratamientos, primera visita, galería, preguntas frecuentes y ubicación.
- Solicitudes de cita por WhatsApp, con nombre y preferencias; **no reserva horarios ni confirma citas automáticamente**.
- Horarios filtrados por fecha, domingos y hora actual de La Paz (`America/Mazatlan`), validados de nuevo al continuar.
- Diálogos nativos con navegación por teclado y Escape, menú adaptable, foco visible y movimiento reducido.
- Enlaces directos de llamada, mapas y WhatsApp disponibles sin JavaScript. El formulario y la ampliación de imágenes requieren JavaScript.
- Fuentes e iconos locales con sus licencias, imágenes diferidas salvo portada, mapa oficial incrustado y ausencia de analítica/cookies propias.

## Mantenimiento

- `index.html`: contenido, teléfono, dirección, horario, datos estructurados y fotografías. Mantén coherencia entre contenido visible y JSON-LD.
- `appointment.js`: teléfono de WhatsApp, zona horaria y reglas de horario.
- `script.js`: interacciones. `styles.css`: diseño y variantes adaptables.
- `privacidad.html`: explicación del sitio, pendiente de validar/complementar con el aviso integral de la responsable.
- `assets/ortomax/`: imágenes existentes. Requisitos y futuras fotografías en `LANZAMIENTO.md`.
- `hosting/`: cabeceras para Apache y hosting estático compatible con `_headers`. La redirección HTTPS depende del proveedor.
- `tools/vendor.mjs`: descarga opcional de fuentes originales y Font Awesome. Los archivos ya están incluidos; no se usa al compilar ni en producción.

Tras modificar horarios, actualiza tanto la interfaz, FAQ si corresponde y JSON-LD de `index.html` como las reglas de `appointment.js` y sus pruebas. Tras añadir servicios, sincroniza tarjetas, formulario y metadatos. Conserva siempre los originales de las fotografías fuera de la carpeta pública.

## GitHub Pages

Publicación autorizada el 3 de septiembre de 2026 para `https://www.orthomaxlapaz.com`. El workflow **Publicar Orthomax** se ejecuta manualmente desde GitHub Actions; valida y publica solo `dist/`, nunca los documentos ni herramientas del proyecto. Usa `npm run build -- --pages` para generar esa versión.

GitHub Pages gestiona HTTPS y el dominio alternativo; no interpreta `.htaccess` ni `_headers`. El build de Pages incluye la política CSP compatible en el HTML. Las cabeceras que requieren soporte del servidor (por ejemplo `frame-ancestors`, Permissions-Policy y caché personalizada) no se aplican en Pages. La URL `/index.html` conserva canonical hacia `/`; Pages no ofrece la redirección Apache de esa ruta.
