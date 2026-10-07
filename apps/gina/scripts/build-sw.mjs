import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const files=(await walk('dist')).filter(p=>!p.endsWith('sw.js')).sort();
const hash=createHash('sha256');for(const p of files)hash.update(p.replaceAll('\\','/')).update(await readFile(p));
const version=hash.digest('hex').slice(0,12);const urls=files.map(p=>'/gina/'+p.replaceAll('\\','/').replace(/^dist\//,''));
await writeFile('dist/sw.js',`/* Orthomax app shell only. Financial data stays in IndexedDB; this worker never opens or deletes databases. */
const CACHE='orthomax-gina-shell-${version}';
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('orthomax-gina-shell-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith('/gina/'))return;
if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('/gina/index.html'))||fetch(event.request)));return}
if(ASSETS.includes(u.pathname)){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(u.pathname))||fetch(event.request)))}
});
`);
await writeFile('dist/version.json',JSON.stringify({version,builtAt:new Date().toISOString()}));
console.log('PWA shell '+version+' · '+urls.length+' assets · scope /gina/');
