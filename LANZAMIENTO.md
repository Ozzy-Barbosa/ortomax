# Preparación de lanzamiento

## Lo que falta aportar o confirmar

- [x] Dominio definitivo comprado en GoDaddy: **www.orthomaxlapaz.com**. Origen canónico: `https://www.orthomaxlapaz.com`.
- [ ] Elegir/confirmar hosting y acceso a DNS. La compra del dominio no identifica el hosting. **No publicar hasta nueva instrucción del cliente.**
- [ ] Confirmar nombre comercial: el proyecto existente usa **Orthomax Centro Odontológico**.
- [ ] Confirmar que **612 142 9561** es el teléfono y recibe WhatsApp.
- [x] Ubicación del mapa proporcionada por el cliente: ficha de Orthomax Centro de Especialidades Odontológicas en las coordenadas 24.153191, -110.314859. El botón de indicaciones usa estas coordenadas para evitar depender de datos antiguos de directorios.
- [ ] Confirmar el texto postal que se mostrará junto al mapa: Antonio Rosales 555, entre Altamirano y Ramírez, Lic. Benito Juárez, 23000, La Paz, B.C.S.
- [ ] Confirmar horario: lunes a viernes 9–19 h, sábado 9–14 h. El sitio no conoce vacaciones ni días festivos; por eso toda solicitud requiere confirmación humana.
- [ ] Confirmar servicios ofrecidos. Se conservaron ortodoncia convencional y estética, ortopedia maxilar, blanqueamiento y retenedores. Se eliminaron de los metadatos implantes y endodoncia porque no estaban respaldados por el contenido del sitio.
- [ ] Proporcionar nombre completo de la dentista, formación y cédulas que deba mostrar el sitio. No se inventaron datos profesionales, certificaciones, años de experiencia, precios ni reseñas.
- [ ] Validar contenido de privacidad con la responsable: identidad legal, domicilio, contacto para derechos sobre datos, finalidad y procedimiento, y aviso integral del consultorio. `privacidad.html` explica el funcionamiento implementado; no sustituye por sí sola esa revisión.
- [ ] Confirmar autorización de uso de todas las fotografías y derechos de las personas reconocibles. Añadir enlaces oficiales de redes sociales solo cuando se tengan; se retiraron los enlaces genéricos.

## Fotografías reales recomendadas

La web funciona con las cuatro fotografías existentes. No utiliza retratos artificiales de la dentista ni testimonios ficticios.

| Uso | Material sugerido | Preparación |
| --- | --- | --- |
| Portada | Consultorio luminoso o dentista en su espacio | Horizontal, al menos 1600 × 1000 px; el recorte actual centra el sillón |
| Nosotros | Retrato profesional de la dentista | Vertical u horizontal con espacio alrededor del rostro; acompañar de sus datos verificados |
| Galería | Fachada, recepción y áreas de atención | 1200–1600 px de ancho, luz natural y sin datos de pacientes visibles |
| Redes | Fotografía horizontal representativa | 1600 × 900 o 1200 × 630; la tarjeta actual utiliza el consultorio existente |

Exportar fotografías a WebP o JPEG de buena calidad, preferentemente 100–250 KB. Evitar texto incrustado cuando sea posible. Actualizar `src`, `data-full`, `width`, `height` y el texto alternativo en el HTML. Si cambia la imagen social, actualizar la ruta y dimensiones de `tools/build.mjs`. No subir documentos clínicos ni originales con información sensible a la carpeta pública.

## Hosting y dominio

El proveedor debe servir archivos estáticos, permitir HTTPS y una página 404 real. En Apache/cPanel, subir el contenido de `dist/` a la raíz pública del sitio e incluir `.htaccess`. En un hosting compatible con `_headers`, usar ese archivo; en otros, trasladar sus políticas al panel. En Nginx se configura `try_files $uri $uri/ =404;` y `error_page 404 /404.html;` con el administrador. No redirigir todas las rutas inexistentes a la portada.

Configurar los registros DNS exactos indicados por el proveedor. La variante elegida es **www**; `origin` ya coincide con esa elección. Activar certificado y redirigir HTTP y la variante secundaria hacia la principal con 301 o 308. El build de producción añade en Apache la redirección del dominio sin www al canónico, y normaliza `/index.html` hacia `/`. La redirección de HTTP a HTTPS se debe activar en el panel del hosting según su arquitectura; no se utiliza una condición HTTPS ciega que pueda generar bucles detrás de un proxy. Si el hosting no usa Apache, configurar ambas redirecciones en su panel.

No subir `site.config.json`, herramientas, pruebas, README, archivos de Git ni esta lista. El build selecciona únicamente recursos públicos. Mantener una copia de la versión anterior para volver atrás si falla una actualización.

## Comprobación después de subir

- [ ] Inicio y privacidad responden 200; una ruta inventada responde **404**, no 200.
- [ ] HTTP y dominio alternativo redirigen correctamente a HTTPS canónico, sin bucles.
- [ ] No aparecen recursos bloqueados, fuentes faltantes ni errores de JavaScript.
- [ ] Revisar móvil real, escritorio, menú, preguntas, galería y cierre con Escape.
- [ ] Probar solicitud de cita, revisar el mensaje y confirmar manualmente que el número pertenece al consultorio. El sitio nunca confirma disponibilidad.
- [ ] `robots.txt` permite rastreo y apunta al sitemap del dominio real. El HTML público no contiene `noindex` excepto en la página 404.
- [ ] Canonical, Open Graph, imagen y JSON-LD contienen el dominio definitivo.
- [ ] Comprobar cabeceras, caché y compresión en el proveedor elegido. Verificar privacidad del hosting y retención de registros.
- [ ] Dar de alta el dominio en Google Search Console y enviar `/sitemap.xml`.
- [ ] Revisar datos estructurados con Rich Results Test y rendimiento con PageSpeed Insights sobre el dominio final; estas pruebas dependen del hosting y no se han realizado todavía.
- [ ] Sincronizar nombre, dirección, teléfono y enlace web con la ficha oficial de Google Business Profile.

## Comprobaciones realizadas en desarrollo

Pruebas automáticas de la zona horaria de La Paz, días cerrados, horarios pasados, sábados y codificación de WhatsApp. Verificación de anclas, archivos locales, fuentes y JSON-LD. Compilación de vista previa no indexable y prueba de producción aislada con el dominio real. La indexación, DNS, TLS, entrega de mensajes y comportamiento del proveedor solo se pueden confirmar después de disponer del dominio/hosting reales.
