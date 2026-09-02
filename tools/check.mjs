import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(process.argv.includes('--dist')?'dist':'.');
for(const page of ['index.html','privacidad.html','404.html']) {
  const html=await readFile(resolve(root,page),'utf8');
  assert.equal([...html.matchAll(/<h1\b/g)].length,1,`${page}: exactly one h1`);
  assert.match(html,/<html lang="es">/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,`${page}: duplicate ids`);
  for(const [,value] of html.matchAll(/(?:href|src|data-full)="([^"]+)"/g)) {
    assert.notEqual(value,'#',`${page}: placeholder link`);
    if(value.startsWith('#')) { assert.ok(ids.includes(value.slice(1)),`${page}: broken anchor ${value}`); continue; }
    if(/^(https?:|tel:|data:)/.test(value)) continue;
    const path=value.split(/[?#]/)[0];
    if(path==='/') continue;
    await access(resolve(root,path.replace(/^\//,'')));
  }
  for(const [,json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
}
for(const stylesheet of ['assets/vendor/fonts.css','assets/vendor/icons.css']) {
  const path=resolve(root,stylesheet);
  for(const [,url] of (await readFile(path,'utf8')).matchAll(/url\(['"]?([^)'" ]+)['"]?\)/g)) await access(resolve(dirname(path),url));
}
const html=await readFile(resolve(root,'index.html'),'utf8');
assert.ok(!html.includes('www.facebook.com/'));
assert.ok(!html.includes('www.instagram.com/'));
assert.ok(!/https:\/\/(fonts\.|cdnjs)/.test(html));
console.log('OK: páginas, anclas, recursos locales, fuentes, metadatos y enlaces.');
