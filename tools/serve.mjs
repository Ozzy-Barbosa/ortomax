import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const headerFile=await readFile(resolve(root,'_headers'),'utf8').catch(()=>'');
const security=Object.fromEntries(headerFile.split('/assets/')[0].split('\n').filter(line=>/^  [A-Za-z-]+:/.test(line)).map(line=>{const split=line.indexOf(':');return [line.slice(0,split).trim(),line.slice(split+1).trim()];}));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep) || !types[extname(file)] || pathname.split('/').some(p => p.startsWith('.')) || pathname.startsWith('/tools/')) {
      res.writeHead(404); res.end('No encontrado'); return;
    }
    const data = await readFile(file);
    res.writeHead(200, { ...security, 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' }); res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(resolve(root, '404.html')).catch(() => 'No encontrado'));
  }
}).listen(4173, '127.0.0.1', () => console.log('Orthomax: http://127.0.0.1:4173'));
