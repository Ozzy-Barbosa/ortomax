# Orthomax · Sitio del consultorio

Sitio estático en español para Orthomax Centro Odontológico, La Paz, B.C.S. No necesita PHP, base de datos, servicios de pago ni Node.js en el hosting. Node.js 22 o posterior solo se utiliza para preparar y comprobar los archivos antes de subirlos.

## Trabajar y revisar

```sh
npm run dev
npm ci --prefix apps/gina
npm test
npm run check
npm run build -- --preview
```

Vista local del consultorio: http://127.0.0.1:4173. El sitio del consultorio no tiene dependencias externas. Gimo, en `apps/gina`, necesita su instalación con `npm ci --prefix apps/gina`. Abre las páginas mediante el servidor, no con `file://`, porque el JavaScript utiliza módulos.

`dist/` contiene la salida de cada compilación y se reemplaza al compilar. No edites esa carpeta directamente. La compilación de vista previa lleva `noindex` y bloquea el rastreo; NO se debe usar como versión pública definitiva.

## Publicación cuando se autorice el lanzamiento

1. Sigue `LANZAMIENTO.md` y confirma con la responsable teléfono, dirección, horarios, tratamientos, nombre comercial y privacidad.
2. El dominio ya está configurado en `site.config.json`: `https://www.orthomaxlapaz.com`. Marca las dos confirmaciones únicamente después de revisar los datos con la responsable.
3. Ejecuta `npm ci --prefix apps/gina`, `npm test --prefix apps/gina`, `npm test`, `npm run check` y `npm run build`.
4. Ejecuta `node tools/check.mjs --dist`.
5. Sube **solo el contenido de `dist/`**, incluyendo `.htaccess` si usas Apache. No subas la carpeta del proyecto, `.git`, pruebas o herramientas.
6. Activa certificado HTTPS y la redirección al dominio canónico en el panel del proveedor. Comprueba la web publicada siguiendo la guía.

El build de producción genera las URLs canónicas, Open Graph, tarjetas de redes con la identidad de Orthomax, sitemap, robots indexable, datos estructurados Dentist, WebSite y WebPage y políticas de seguridad. Se detiene si falta el dominio o las confirmaciones. El sitio está publicado en GitHub Pages con HTTPS y el dominio comprado en GoDaddy. Consulta `AUDITORIA-SEO.md` para los hallazgos y las acciones posteriores al lanzamiento.

## Qué hace el sitio

- Presentación del consultorio, servicios, tratamientos, primera visita, galería, preguntas frecuentes y ubicación.
- Explorador de tratamientos por interés, con todos los servicios disponibles sin JavaScript y recuperación de enlaces a tratamientos ocultos por un filtro.
- Galería navegable mediante botones y flechas del teclado; Escape cierra la imagen.
- Solicitudes de cita por WhatsApp, con nombre y preferencias; **no reserva horarios ni confirma citas automáticamente**.
- Horarios filtrados por fecha, domingos y hora actual de La Paz (`America/Mazatlan`), validados de nuevo al continuar.
- Diálogos nativos con navegación por teclado y Escape, menú adaptable, foco visible y movimiento reducido.
- Enlaces directos de llamada, mapas y WhatsApp disponibles sin JavaScript. El formulario y la ampliación de imágenes requieren JavaScript.
- Fuentes e iconos locales con sus licencias, fotografías WebP y portada adaptable, imágenes diferidas salvo portada, mapa oficial incrustado y ausencia de analítica/cookies propias.

## Mantenimiento

- `index.html`: contenido, teléfono, dirección, horario, datos estructurados y fotografías. Mantén coherencia entre contenido visible y JSON-LD.
- `appointment.js`: teléfono de WhatsApp, zona horaria y reglas de horario.
- `script.js`: interacciones. `styles.css`: diseño y variantes adaptables.
- `privacidad.html`: información del sitio, revisada para el lanzamiento; el aviso integral de la responsable se solicita directamente al consultorio.
- `assets/ortomax/`: imágenes existentes. Requisitos y futuras fotografías en `LANZAMIENTO.md`.
- `hosting/`: cabeceras para Apache y hosting estático compatible con `_headers`. La redirección HTTPS depende del proveedor.
- `assets/tarjeta-digital-orthomax.png`: tarjeta horizontal en alta resolución con datos confirmados y QR directo al sitio seguro.
- `assets/orthomax-qr.png`: QR de alta resolución que apunta a `https://www.orthomaxlapaz.com/`.
- `assets/orthomax-enlace.jpg`: imagen cuadrada de 800 × 800 para Open Graph; prioriza el logotipo y la ubicación en miniaturas.
- `assets/orthomax-social.jpg`: tarjeta horizontal de 1200 × 630 para Twitter/X, con el logotipo y fotografías reales de fachada y recepción.
- `tools/social-preview.html`: composición editable de ambas imágenes. Abre este archivo directamente en un navegador, espera a que carguen las fuentes locales y exporta los elementos `#shareSquare` y `#shareWide` a tamaño natural, sin escalado. Las imágenes finales están incluidas y no necesitan regenerarse durante la publicación.
- `tools/vendor.mjs`: descarga opcional de fuentes originales y Font Awesome. Los archivos ya están incluidos; no se usa al compilar ni en producción.

El título y la descripción para compartir se editan en las etiquetas `og:title` y `og:description` de `index.html`; el título y la descripción de búsqueda se mantienen independientes. El build añade al nombre público de cada imagen una huella de su contenido para renovar su URL cuando cambia el diseño. Las plataformas pueden conservar la vista previa del enlace en su propia caché y los mensajes ya enviados pueden seguir mostrando la imagen anterior. La fotografía del consultorio se conserva en los datos estructurados del negocio.

Tras modificar horarios, actualiza tanto la interfaz, FAQ si corresponde y JSON-LD de `index.html` como las reglas de `appointment.js` y sus pruebas. Tras añadir servicios, sincroniza tarjetas, formulario y metadatos. Conserva siempre los originales de las fotografías fuera de la carpeta pública.

## GitHub Pages

Gimo es la aplicación financiera personal de la Dra. Gina y vive en `/gina/`. Su fuente, guía y pruebas están en `apps/gina/`. `npm run build` compila ambas aplicaciones y copia Gimo a `dist/gina/`, para conservarla en cada publicación futura del sitio. El flujo de Pages prueba las reglas financieras y la bóveda antes de compilar. Publica siempre el `dist/` completo.

Gimo conserva datos cifrados en el dispositivo de la usuaria. No hay registros financieros en este repositorio ni en Pages. Nunca cambies el nombre de su base de datos, el formato de respaldo ni el origen de la app como parte de una mejora visual. No borres IndexedDB ni desregistres el almacenamiento de la usuaria para actualizar. Las actualizaciones sustituyen solo recursos estáticos. El cambio de marca a Gimo conserva los identificadores históricos `orthomax-gina-*` por compatibilidad.

Publicación autorizada el 3 de septiembre de 2026 para `https://www.orthomaxlapaz.com`. El workflow **Publicar Orthomax** se ejecuta manualmente desde GitHub Actions; valida y publica solo `dist/`, nunca los documentos ni herramientas del proyecto. Usa `npm run build -- --pages` para generar esa versión.

GitHub Pages gestiona HTTPS y el dominio alternativo; no interpreta `.htaccess` ni `_headers`. El build de Pages incluye la política CSP compatible en el HTML. Las cabeceras que requieren soporte del servidor (por ejemplo `frame-ancestors`, Permissions-Policy y caché personalizada) no se aplican en Pages. La URL `/index.html` conserva canonical hacia `/`; Pages no ofrece la redirección Apache de esa ruta.
