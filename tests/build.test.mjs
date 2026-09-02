import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
test('production requires confirmed configuration and generates coherent SEO output',async()=>{
  const base=resolve(tmpdir());
  const work=await mkdtemp(join(base,'orthomax-build-test-'));
  try {
    for(const file of ['tools','hosting','assets','index.html','privacidad.html','404.html','styles.css','script.js','appointment.js']) await cp(file,join(work,file),{recursive:true});
    const build=()=>spawnSync(process.execPath,['tools/build.mjs'],{cwd:work,encoding:'utf8'});
    await writeFile(join(work,'site.config.json'),JSON.stringify({origin:''}));
    assert.notEqual(build().status,0);
    await writeFile(join(work,'site.config.json'),JSON.stringify({origin:'https://clinic.fixture.mx',businessDetailsConfirmed:false,privacyReviewed:false}));
    assert.notEqual(build().status,0);
    await writeFile(join(work,'site.config.json'),JSON.stringify({origin:'https://clinic.fixture.mx',businessDetailsConfirmed:true,privacyReviewed:true}));
    const built=build(); assert.equal(built.status,0,built.stderr);
    const html=await readFile(join(work,'dist/index.html'),'utf8');
    assert.match(html,/<link rel="canonical" href="https:\/\/clinic.fixture.mx\/">/);
    assert.ok(!html.includes('noindex'));
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema.url,'https://clinic.fixture.mx/');
    assert.match(schema.image,/^https:\/\/clinic.fixture.mx\//);
    assert.match(await readFile(join(work,'dist/robots.txt'),'utf8'),/Sitemap: https:\/\/clinic.fixture.mx\/sitemap.xml/);
    assert.match(await readFile(join(work,'dist/_headers'),'utf8'),/sha256-/);
    assert.match(await readFile(join(work,'dist/_headers'),'utf8'),/frame-src https:\/\/www\.google\.com/);
    assert.match(await readFile(join(work,'dist/404.html'),'utf8'),/noindex/);
    assert.equal(spawnSync(process.execPath,['tools/check.mjs','--dist'],{cwd:work,encoding:'utf8'}).status,0);
  } finally {
    if(dirname(work)!==base || !work.startsWith(join(base,'orthomax-build-test-'))) throw Error('Unsafe temporary directory');
    await rm(work,{recursive:true,force:true});
  }
});
