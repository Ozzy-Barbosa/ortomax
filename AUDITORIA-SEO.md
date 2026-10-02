# Orthomax · Revisión previa al lanzamiento

Fecha: 3 de septiembre de 2026. Dominio principal: **https://www.orthomaxlapaz.com**. Dominio comprado en GoDaddy; hosting por confirmar. No se ha publicado, cambiado DNS ni enviado mensajes a pacientes.

> Actualización de lanzamiento: el cliente confirmó datos y privacidad y autorizó publicar el 3 de septiembre de 2026. GitHub Pages desplegó la versión de producción; www apunta a ozzy-barbosa.github.io y el dominio raíz a 185.199.108.153. La auditoría siguiente conserva el estado previo al lanzamiento.

## Cambios implementados

- Dominio incorporado en la configuración del build. Producción genera canonical, Open Graph, tarjeta social, robots y sitemap con ese origen. La vista previa permanece no indexable.
- Encabezado principal descriptivo: dentista en La Paz, Baja California Sur. Títulos de servicios, tratamientos y ubicación coherentes con búsquedas locales, conservando un lenguaje natural.
- Cinco tratamientos con información para preparar la valoración y enlaces internos individuales desde servicios y pie de página. Se mantienen en una sola página útil, sin multiplicar páginas casi idénticas por palabra clave.
- Datos estructurados Dentist con dirección, horario, mapa, logo, sitio web y catálogo de los tratamientos visibles. El catálogo se genera a partir de las tarjetas para evitar discrepancias. Sin calificaciones, precios, especialidades profesionales ni credenciales inventadas.
- Redirección Apache de `/index.html` a `/` y, en producción, del dominio alternativo al principal. HTTPS se activará en el proveedor para evitar errores detrás de un proxy.
- Corrección de desbordamientos en servicios y beneficios a 320 px. Se conservan logo transparente, colores, fotografías reales, fuentes locales y carga diferida de imágenes secundarias.
- Comprobador ampliado: imágenes con texto alternativo y dimensiones, enlaces entre páginas y coherencia de teléfonos/WhatsApp con los datos estructurados.

## Qué limita hoy la competitividad local

En la consulta de búsquedas «dentistas / odontólogos en La Paz BCS» aparecen directorios como Doctoralia y sitios propios como Clínica Dental Araiza y Lau Dental. Es una muestra de búsqueda, no un seguimiento de posiciones desde cada zona de La Paz. Los competidores muestran información sobre servicios y profesionales que Orthomax todavía debe aportar; no se han copiado sus textos ni asumido sus credenciales.

La mejora prioritaria pendiente es identificar a la dentista: nombre completo, fotografía profesional autorizada, formación y cédulas verificables. Esto permitirá explicar quién atiende, con evidencia propia. También conviene añadir fotos recientes de recepción, fachada y consultorio. No se debe presentar material ajeno como casos clínicos de Orthomax.

Un directorio externo devuelve **612 123 0934**, diferente del **612 142 9561** del proyecto. No se sustituyó el número por un dato de terceros. Confirmar con la clínica teléfono, WhatsApp, dirección postal, horarios y denominación comercial, y corregir posteriormente las fichas externas desactualizadas. La ubicación del mapa es la proporcionada por el cliente.

## Pruebas y alcance

- Suite Node: zona horaria del consultorio, fechas inválidas y pasadas, domingos, horario de sábado, horario vencido y codificación del mensaje de WhatsApp.
- Build de producción probado en una carpeta temporal con la configuración del dominio real y confirmaciones simuladas únicamente en esa prueba. Se comprueban canonical, sitemap, catálogo, logo, redirección generada y hash de la política de seguridad. No se modifican las confirmaciones reales del proyecto.
- Vista previa comprobada como `noindex`, robots bloqueado y sitemap vacío, para evitar confundirla con una entrega pública.
- Revisión en navegador: portada, menú móvil, apertura/cierre de citas, rechazo de domingo, horarios de sábado, galería y preguntas frecuentes. No se envían solicitudes reales.
- El rendimiento del hosting, DNS, certificado, redirecciones ejecutadas por Apache e indexación solo podrán verificarse después del despliegue. No se atribuye una puntuación de PageSpeed o Lighthouse no medida.

## Al autorizar el lanzamiento

1. Confirmar datos de la clínica y completar/revisar el aviso de privacidad. Las banderas de `site.config.json` permanecen en `false` hasta entonces.
2. Configurar el hosting elegido, certificado para ambos nombres y redirección permanente a `https://www.orthomaxlapaz.com`. Mantener registros de correo existentes al modificar DNS; no sustituir toda la zona.
3. Compilar producción y subir únicamente su contenido. No subir el `dist/` actual: es una vista previa no indexable.
4. Validar respuestas HTTP, recursos, formulario, mapa, robots, sitemap, canonical y datos estructurados sobre el dominio público.
5. Verificar una propiedad de dominio en Google Search Console con el TXT que proporcione Google y enviar `https://www.orthomaxlapaz.com/sitemap.xml`. No se inventó un código de verificación.
6. Actualizar la ficha oficial de Google Business Profile con el dominio, datos confirmados, servicios y fotos. Solicitar reseñas auténticas de manera neutral, sin incentivos ni seleccionar únicamente pacientes satisfechos.
7. Registrar impresiones, clics, consultas y páginas en Search Console y contactos recibidos. Revisar oportunidades reales tras disponer de datos; no interpretar la posición de una sola búsqueda como un ranking universal.

No se puede garantizar primera página o primer puesto. Google explica que los resultados locales dependen de relevancia, distancia y prominencia; el sitio es una parte de ese trabajo junto con la ficha, reseñas y referencias reales.

## Fuentes consultadas

- [Google: posicionamiento local](https://support.google.com/business/answer/7091?hl=es).
- [Google: datos estructurados de negocio local](https://developers.google.com/search/docs/appearance/structured-data/local-business).
- [Google: contenido útil y fiable](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
- [Google: URLs canónicas](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- Muestra de mercado: [Clínica Dental Araiza](https://clinicadentalaraiza.com/), [Lau Dental](https://www.laudental.co/), [Doctoralia La Paz](https://www.doctoralia.com.mx/dentista-odontologo/la-paz).
- Discrepancia a confirmar: [directorio de Orthomax](https://www.allbiz.mx/orthomax-centro-de-especialidades-612-123-0934).

## Renovación editorial y visual — 1 de octubre de 2026

- Portada «Que tu sonrisa hable de ti», con la ubicación y el servicio en el texto visible de apoyo. El título de búsqueda mantiene «Orthomax La Paz | Dentista y ortodoncia en B.C.S.».
- Textos reescritos sobre tratamientos, primera visita, dudas y ubicación; sin testimonios, credenciales, precios ni resultados clínicos inventados.
- Selector de tratamientos por interés, mejor navegación de galería, animación de entrada y aparición al desplazarse. Todas las opciones permanecen en el HTML; los filtros no limitan el contenido disponible a buscadores o sin JavaScript.
- Datos estructurados Dentist vinculados con WebSite y WebPage. Los cinco servicios incluyen descripciones derivadas de sus textos visibles. La política de seguridad admite cada bloque JSON-LD mediante su hash.
- Canonical, metadatos sociales, robots y sitemap verificados en la salida para GitHub Pages. No se cambió el dominio ni las rutas públicas.
- Fotografías WebP: 279 676 bytes frente a 417 384 bytes de los JPEG (33 % menos en conjunto), más una variante de portada de 800 px para pantallas pequeñas. Se conservan los originales para ampliar y compartir.
- Validación: 6 pruebas automatizadas; navegador a 320, 390, 768, 1024 y 1440 px; filtros, enlaces internos tras filtrar, solicitud por WhatsApp interceptada sin enviar mensajes, calendario, galería, FAQ, menú móvil, movimiento reducido y lectura sin JavaScript.

Criterios consultados: [contenido útil para las personas](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [identidad del sitio en Google](https://developers.google.com/search/docs/appearance/site-names?hl=en) y [datos estructurados de negocios locales](https://developers.google.com/search/docs/appearance/structured-data/local-business). Estos cambios mejoran la presentación, el acceso al contenido y la comprensión del sitio; las posiciones se evalúan con datos reales de Search Console después del rastreo.
