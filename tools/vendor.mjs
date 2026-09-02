// One-time, reproducible download from the original font distributors.
import fs from 'node:fs/promises';
async function get(url) {
  const response = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}});
  if (!response.ok) throw Error(`Download failed: ${response.status} ${url}`);
  return response;
}
await fs.mkdir('assets/vendor', {recursive:true});
let css = await (await get('https://fonts.googleapis.com/css2?family=Montserrat:wght@400..800&family=Nunito+Sans:wght@400..700&display=swap')).text();
const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))];
for (const [i,url] of urls.entries()) {
  const filename = `font-${i}.${url.includes('.woff2') ? 'woff2' : 'ttf'}`;
  await fs.writeFile(`assets/vendor/${filename}`, Buffer.from(await (await get(url)).arrayBuffer()));
  css = css.replaceAll(url,filename);
}
await fs.writeFile('assets/vendor/fonts.css',css);
let icons = await (await get('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css')).text();
await fs.mkdir('assets/webfonts', {recursive:true});
for (const file of ['fa-solid-900.woff2','fa-regular-400.woff2','fa-brands-400.woff2']) {
  await fs.writeFile(`assets/webfonts/${file}`,Buffer.from(await (await get(`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/${file}`)).arrayBuffer()));
}
icons = icons.replace(/,url\([^)]*\.ttf\) format\("truetype"\)/g,'');
// Only the three used families; the compatibility V4 family isn't needed.
icons = icons.replace(/@font-face\{font-family:"FontAwesome"[^}]*\}/g,'');
await fs.writeFile('assets/vendor/icons.css',icons);
for (const [name,url] of Object.entries({
  'Montserrat-OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt',
  'NunitoSans-OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/OFL.txt',
  'FontAwesome-LICENSE.txt':'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.7.2/LICENSE.txt'
})) await fs.writeFile(`assets/vendor/${name}`,await (await get(url)).text());
console.log(`Downloaded ${urls.length} font files and Font Awesome, with licenses.`);
