import { readFile, writeFile, mkdir, cp, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const config = JSON.parse(await readFile('site.config.json','utf8'));
const preview = process.argv.includes('--preview');
const originArg = process.argv.find(a=>a.startsWith('--origin='));
let origin = originArg?.slice(9) || config.origin;
if (!preview) {
  let url;
  try { url = new URL(origin); } catch { throw Error('Configura origin en site.config.json con el dominio HTTPS real. Para revisar usa npm run build -- --preview.'); }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(^|\.)(example\.(com|org|net)|localhost|test|invalid)$/.test(url.hostname)) throw Error('El dominio debe ser un origen HTTPS público, sin ruta ni credenciales.');
  origin = url.origin;
  if (!config.businessDetailsConfirmed || !config.privacyReviewed) throw Error('Confirma businessDetailsConfirmed y privacyReviewed en site.config.json después de revisar los datos y privacidad con la responsable del consultorio.');
}
const output = resolve('dist');
if (dirname(output) !== process.cwd() || (await lstat(output).catch(()=>null))?.isSymbolicLink()) throw Error('Directorio dist no seguro.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp('assets','dist/assets',{recursive:true});
const version = createHash('sha256').update(await readFile('styles.css')).update(await readFile('script.js')).update(await readFile('appointment.js')).digest('hex').slice(0,12);
for (const file of ['styles.css','script.js','appointment.js']) await cp(file,`dist/${file}`);
await writeFile('dist/script.js',(await readFile('script.js','utf8')).replace("'./appointment.js'",`'./appointment.js?v=${version}'`));
for (const file of ['index.html','privacidad.html','404.html']) {
  let html = await readFile(file,'utf8');
  html = html.replace('href="styles.css"',`href="styles.css?v=${version}"`).replace('src="script.js"',`src="script.js?v=${version}"`);
  if (!preview && file !== '404.html') {
    const url = origin + (file==='index.html' ? '/' : '/privacidad.html');
    html = html.replace('content="noindex, nofollow"','content="index, follow, max-image-preview:large"');
    let metadata = `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}">`;
    if (file === 'index.html') {
      const image = `${origin}/assets/ortomax/consultorio-dental-ortomax.jpeg`;
      metadata += `<meta property="og:image" content="${image}"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="900"><meta property="og:image:alt" content="Consultorio de Orthomax en La Paz"><meta name="twitter:title" content="Orthomax | Dentista en La Paz"><meta name="twitter:description" content="Ortodoncia y atención dental con un trato cercano. Solicita tu cita en La Paz, B.C.S."><meta name="twitter:image" content="${image}">`;
      html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,json)=>{
        const data=JSON.parse(json); data.url=url; data['@id']=`${origin}/#consultorio`; data.image=image;
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
const schema=builtHome.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
const schemaHash=createHash('sha256').update(schema).digest('base64');
for (const file of ['.htaccess','_headers']) {
  const headers=(await readFile(`hosting/${file}`,'utf8')).replace("script-src 'self'",`script-src 'self' 'sha256-${schemaHash}'`);
  await writeFile(`dist/${file}`,headers);
}
console.log(preview?'Vista previa generada en dist/ (noindex).':'Producción generada en dist/ para '+origin);
