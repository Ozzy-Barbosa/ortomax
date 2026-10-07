import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { PHONE } from '../appointment.js';
const root = resolve(process.argv.includes('--dist')?'dist':'.');
for(const page of ['index.html','privacidad.html','404.html']) {
  const html=await readFile(resolve(root,page),'utf8');
  assert.equal([...html.matchAll(/<h1\b/g)].length,1,`${page}: exactly one h1`);
  assert.match(html,/<html lang="es">/);
  assert.equal([...html.matchAll(/<title>/g)].length,1,`${page}: exactly one title`);
  for (const [,tag] of html.matchAll(/(<img\b[^>]*\bsrc="[^"]+"[^>]*>)/g)) {
    assert.match(tag,/\balt="[^"]*"/,`${page}: image alternative text`);
    assert.match(tag,/\bwidth="\d+"/,`${page}: image width`);
    assert.match(tag,/\bheight="\d+"/,`${page}: image height`);
    const srcset=tag.match(/\bsrcset="([^"]+)"/);
    if(srcset) for(const candidate of srcset[1].split(',')) {
      const image=candidate.trim().split(/\s+/)[0];
      if(!/^https?:/.test(image)) await access(resolve(root,image));
    }
  }
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,`${page}: duplicate ids`);
  for(const [,value] of html.matchAll(/(?:href|src|data-full)="([^"]+)"/g)) {
    assert.notEqual(value,'#',`${page}: placeholder link`);
    if(value.startsWith('#')) { assert.ok(ids.includes(value.slice(1)),`${page}: broken anchor ${value}`); continue; }
    if(value.startsWith('tel:')) { assert.equal(value.replace(/\D/g,''),PHONE,`${page}: consistent phone`); continue; }
    if(value.startsWith('https://wa.me/')) { assert.equal(new URL(value).pathname,`/${PHONE}`,`${page}: consistent WhatsApp`); continue; }
    if(/^(https?:|data:)/.test(value)) continue;
    const path=value.split(/[?#]/)[0];
    const target=resolve(root,path==='/'?'index.html':path.replace(/^\//,''));
    await access(target);
    if (value.includes('#')) {
      const targetHtml=await readFile(target,'utf8');
      assert.ok(targetHtml.includes(`id="${value.split('#')[1]}"`),`${page}: broken cross-page anchor ${value}`);
    }
  }
  for(const [,json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
}
for(const stylesheet of ['assets/vendor/fonts.css','assets/vendor/icons.css']) {
  const path=resolve(root,stylesheet);
  for(const [,url] of (await readFile(path,'utf8')).matchAll(/url\(['"]?([^)'" ]+)['"]?\)/g)) await access(resolve(dirname(path),url));
}
const html=await readFile(resolve(root,'index.html'),'utf8');
const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(schema.telephone.replace(/\D/g,''),PHONE);
assert.ok(!html.includes('www.facebook.com/'));
assert.ok(!html.includes('www.instagram.com/'));
assert.ok(!/https:\/\/(fonts\.|cdnjs)/.test(html));
console.log('OK: páginas, anclas, recursos locales, fuentes, metadatos y enlaces.');

if (process.argv.includes('--dist')) {
  const manifest = JSON.parse(await readFile(resolve(root, 'gina/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.short_name, 'Gimo');
  assert.equal(manifest.start_url, '/gina/');
  assert.equal(manifest.scope, '/gina/');
  const app = await readFile(resolve(root, 'gina/index.html'), 'utf8');
  assert.match(app, /<title>Gimo/);
  assert.match(app, /noindex/);
  for (const [, path] of app.matchAll(/(?:src|href)="(\/gina\/[^"?#]+)"/g)) await access(resolve(root, path.slice(1)));
  const worker = await readFile(resolve(root, 'gina/sw.js'), 'utf8');
  assert.ok(!/indexedDB\.|deleteDatabase/.test(worker));
  assert.match(worker, /orthomax-gina-shell-/);
  await access(resolve(root, 'gina/version.json'));
  console.log('OK: Gimo, recursos compilados, manifiesto y caché acotados a /gina/.');
}
