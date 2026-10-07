import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const origin = 'https://www.orthomaxlapaz.com';
const rootPaths = ['/', '/privacidad.html', '/404.html', '/styles.css', '/script.js', '/appointment.js', '/sitemap.xml', '/assets/ortomax-simbolo.png'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function get(path) {
  const response = await fetch(`${origin}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).origin, origin, `${path}: cambió de origen`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { path, hash: digest(bytes), bytes, type: response.headers.get('content-type') };
}
await mkdir('output/release', { recursive: true });
const root = await Promise.all(rootPaths.map(get));
if (process.argv.includes('--baseline')) {
  await writeFile('output/release/root-before.json', JSON.stringify({ at: new Date().toISOString(), origin, files: root.map(({path,hash})=>({path,hash})) }, null, 2));
  console.log(`Base pública guardada: ${root.length} páginas y recursos de Orthomax.`);
} else {
  const baseline = JSON.parse(await readFile('output/release/root-before.json', 'utf8'));
  for (const file of root) assert.equal(file.hash, baseline.files.find(item => item.path === file.path)?.hash, `${file.path}: no coincide con el sitio anterior`);
  const page = await get('/gina/');
  const html = page.bytes.toString('utf8');
  assert.match(html, /<title>Gimo/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /noindex,nofollow/);
  const manifest = JSON.parse((await get('/gina/manifest.webmanifest')).bytes.toString('utf8'));
  assert.equal(manifest.short_name, 'Gimo');
  assert.equal(manifest.scope, '/gina/');
  assert.equal(manifest.start_url, '/gina/');
  const worker = (await get('/gina/sw.js')).bytes.toString('utf8');
  const urls = JSON.parse(worker.match(/const ASSETS=(\[[^;]+\]);/)[1]);
  assert.ok(urls.every(url => url.startsWith('/gina/')));
  assert.ok(!/indexedDB\.|deleteDatabase/.test(worker));
  const assets = await Promise.all(urls.map(get));
  const version = JSON.parse((await get('/gina/version.json')).bytes.toString('utf8'));
  assert.ok(worker.includes(`orthomax-gina-shell-${version.version}`));
  const report = { at: new Date().toISOString(), origin, app: origin+'/gina/', version, rootUnchanged: root.length, manifest: {name:manifest.name, scope:manifest.scope, start_url:manifest.start_url}, assets: assets.map(({path,hash,type})=>({path,hash,type})) };
  await writeFile('output/release/live-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({app:report.app, version:version.version, rootUnchanged:root.length, appAssets:assets.length, verified:true}));
}
