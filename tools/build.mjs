import { readFile, writeFile, mkdir, cp, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const config = JSON.parse(await readFile('site.config.json','utf8'));
const preview = process.argv.includes('--preview');
const pages = process.argv.includes('--pages');
const originArg = process.argv.find(a=>a.startsWith('--origin='));
let origin = originArg?.slice(9) || config.origin;
if (!preview) {
  let url;
  try { url = new URL(origin); } catch { throw Error('Configura origin en site.config.json con el dominio HTTPS real. Para revisar usa npm run build -- --preview.'); }
  if (url.protocol !== 'https:' || url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(^|\.)(example\.(com|org|net)|localhost|test|invalid)$/.test(url.hostname)) throw Error('El dominio debe ser un origen HTTPS público, sin puerto, ruta ni credenciales.');
  origin = url.origin;
  if (!config.businessDetailsConfirmed || !config.privacyReviewed) throw Error('Confirma businessDetailsConfirmed y privacyReviewed en site.config.json después de revisar los datos y privacidad con la responsable del consultorio.');
}
const output = resolve('dist');
if (dirname(output) !== process.cwd() || (await lstat(output).catch(()=>null))?.isSymbolicLink()) throw Error('Directorio dist no seguro.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp('assets','dist/assets',{recursive:true});
// A new filename on each image revision avoids reusing an older cached image.
async function shareImage(name) {
  const bytes=await readFile(`assets/${name}.jpg`);
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
  const path=`assets/${name}-${hash}.jpg`;
  await writeFile(`dist/${path}`,bytes);
  return path;
}
const shareSquare=await shareImage('orthomax-enlace');
const shareWide=await shareImage('orthomax-social');
const version = createHash('sha256').update(await readFile('styles.css')).update(await readFile('script.js')).update(await readFile('appointment.js')).digest('hex').slice(0,12);
const plainText=value=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
for (const file of ['styles.css','script.js','appointment.js']) await cp(file,`dist/${file}`);
await writeFile('dist/script.js',(await readFile('script.js','utf8')).replace("'./appointment.js'",`'./appointment.js?v=${version}'`));
for (const file of ['index.html','privacidad.html','404.html']) {
  let html = await readFile(file,'utf8');
  html = html.replace(/href="(\/?styles\.css)"/,`href="$1?v=${version}"`).replace('src="script.js"',`src="script.js?v=${version}"`);
  if (!preview && file !== '404.html') {
    const url = origin + (file==='index.html' ? '/' : '/privacidad.html');
    html = html.replace('content="noindex, nofollow"','content="index, follow, max-image-preview:large"');
    let metadata = `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}">`;
    if (file === 'index.html') {
      const image = `${origin}/assets/ortomax/consultorio-dental-ortomax.jpeg`;
      const title=html.match(/<title>(.*?)<\/title>/)[1];
      const description=html.match(/<meta name="description"\s+content="([^"]+)"/)[1];
      // Share copy is separate from the search title and the real clinic photo in JSON-LD.
      const shareTitle=html.match(/<meta property="og:title" content="([^"]+)"/)[1];
      const shareDescription=html.match(/<meta property="og:description" content="([^"]+)"/)[1];
      const squareUrl=`${origin}/${shareSquare}`;
      metadata += `<meta property="og:image" content="${squareUrl}"><meta property="og:image:secure_url" content="${squareUrl}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="800"><meta property="og:image:height" content="800"><meta property="og:image:alt" content="Logotipo de Orthomax Centro Odontológico, La Paz, B.C.S."><meta name="twitter:title" content="${shareTitle}"><meta name="twitter:description" content="${shareDescription}"><meta name="twitter:image" content="${origin}/${shareWide}"><meta name="twitter:image:alt" content="Orthomax: Que tu sonrisa hable de ti. Fachada y recepción del consultorio en La Paz, B.C.S.">`;
      // A top-level WebSite node gives the brand its own identity in search.
      const website={
        '@type':'WebSite','@id':`${origin}/#sitio`,url:origin+'/',name:'Orthomax La Paz',
        alternateName:['Orthomax','Orthomax Centro Odontológico'],inLanguage:'es-MX',publisher:{'@id':`${origin}/#consultorio`}
      };
      const webpage={
        '@type':'WebPage','@id':`${url}#pagina`,url,name:title,description,inLanguage:'es-MX',
        isPartOf:{'@id':website['@id']},mainEntity:{'@id':`${origin}/#consultorio`},
        primaryImageOfPage:{'@type':'ImageObject',url:image,width:1600,height:900}
      };
      metadata += `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[website,webpage]})}</script>`;
      html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,json)=>{
        const data=JSON.parse(json); data.url=url; data['@id']=`${origin}/#consultorio`; data.image=image;
        data.logo = `${origin}/assets/ortomax-simbolo.png`;
        data.alternateName=['Orthomax La Paz','Orthomax Centro de Especialidades Odontológicas'];
        data.mainEntityOfPage = {'@id':webpage['@id']};
        // Derive services from visible cards so structured data cannot drift from the page.
        data.hasOfferCatalog = {
          '@type':'OfferCatalog', name:'Tratamientos dentales en Orthomax',
          itemListElement:[...html.matchAll(/<article class="treatment-card" id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)].map(([,id,card])=>({
            '@type':'Offer',itemOffered:{'@type':'Service',name:card.match(/<h3>(.*?)<\/h3>/)[1],
              description:plainText(card.match(/<p>([\s\S]*?)<\/p>/)[1]),
              url:`${url}#${id}`, areaServed:'La Paz, Baja California Sur',provider:{'@id':data['@id']}}
          }))
        };
        return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
      });
    }
    html = html.replace('</head>',metadata+'</head>');
  }
  await writeFile(`dist/${file}`,html);
}
await writeFile('dist/robots.txt',preview?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${preview?'':['/','/privacidad.html'].map(path=>`<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`);
const builtHome=await readFile('dist/index.html','utf8');
const schemaHashes=[...builtHome.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(([,json])=>`'sha256-${createHash('sha256').update(json).digest('base64')}'`).join(' ');
for (const file of ['.htaccess','_headers']) {
  let headers=(await readFile(`hosting/${file}`,'utf8')).replace("script-src 'self'",`script-src 'self' ${schemaHashes}`);
  if (!preview && file === '.htaccess') {
    const host = new URL(origin).hostname;
    const secondary = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    headers += `\n# Canonical host only; enforce HTTPS in the hosting panel.\n<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteCond %{HTTP_HOST} ^${secondary.replaceAll('.', '\\.')}(:[0-9]+)?$ [NC]\n  RewriteRule ^ ${origin}%{REQUEST_URI} [R=301,L,NE]\n</IfModule>\n`;
  }
  await writeFile(`dist/${file}`,headers);
}
if (pages) {
  // GitHub Pages ignores custom response headers; deliver the supported CSP via HTML.
  const policy = (await readFile('dist/_headers','utf8')).match(/Content-Security-Policy: ([^\n]+)/)[1].trim().replace(/; frame-ancestors 'none'/,'');
  for (const file of ['index.html','privacidad.html','404.html']) {
    const html=await readFile(`dist/${file}`,'utf8');
    await writeFile(`dist/${file}`,html.replace(/(<meta charset="[^"]+">)/i,`$1<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="strict-origin-when-cross-origin">`));
  }
  await writeFile('dist/.nojekyll','');
  await rm('dist/.htaccess');
  await rm('dist/_headers');
}
console.log(preview?'Vista previa generada en dist/ (noindex).':'Producción generada en dist/ para '+origin);
