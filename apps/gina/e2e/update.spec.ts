import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const ORIGIN = 'http://127.0.0.1:4194';
const PASSWORD = 'Contraseña ficticia actualización 2026';
const NOTE = 'Ingreso sintético que debe sobrevivir la actualización';
const dist = resolve('dist');
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
};
let server: Server;
let workerVersion = 1;
let workerTemplate = '';

test.beforeEach(async () => {
  workerVersion = 1;
  workerTemplate = await readFile(resolve(dist, 'sw.js'), 'utf8');
  if (!/const CACHE='orthomax-gina-shell-[^']+';/.test(workerTemplate)) throw new Error('El service worker de dist no tiene el formato de versión esperado por esta prueba.');
  server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url || '/', ORIGIN);
      response.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<!doctype html><html lang="es"><title>Sitio público</title><h1>Sitio público fuera de la aplicación</h1></html>');
        return;
      }
      if (!url.pathname.startsWith('/gina/')) { response.writeHead(404); response.end(); return; }
      if (url.pathname === '/gina/sw.js') {
        response.setHeader('Content-Type', mime['.js']);
        response.setHeader('Service-Worker-Allowed', '/gina/');
        // Only the cache name varies. Files in dist and all financial storage remain untouched.
        response.end(workerTemplate.replace(/const CACHE='(orthomax-gina-shell-[^']+)';/, (_match, name) => `const CACHE='${name}-update-test-${workerVersion}';`));
        return;
      }
      const relative = decodeURIComponent(url.pathname.slice('/gina/'.length)) || 'index.html';
      const file = resolve(dist, relative);
      if (!file.startsWith(dist + sep)) { response.writeHead(403); response.end(); return; }
      try {
        const content = await readFile(file);
        response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
        response.end(content);
      } catch { response.writeHead(404); response.end(); }
    })().catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(4194, '127.0.0.1', () => resolve());
  });
});

test.afterEach(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

test('con el servidor detenido la caché permite reabrir, registrar y conservar un movimiento', async ({ page, browser }) => {
  await page.goto(`${ORIGIN}/gina/`);
  await page.getByLabel('Crea una contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Guardaré mi contraseña/ }).check();
  await page.getByRole('button', { name: 'Crear mi espacio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resumen.' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const account = page.getByRole('dialog', { name: 'Agregar cuenta' });
  await account.getByLabel('Nombre de la cuenta').fill('Cuenta ficticia sin servidor');
  await account.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(account).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  expect(await page.evaluate(async () => Boolean(await caches.match('/gina/index.html')))).toBe(true);
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
  expect(server.listening).toBe(false);
  // Negative control: a fresh browser without the worker cannot retrieve the page.
  const fresh = await browser.newContext();
  try {
    const unprepared = await fresh.newPage();
    await expect(unprepared.goto(`${ORIGIN}/gina/`, { timeout: 5000 })).rejects.toThrow();
  } finally { await fresh.close(); }
  await page.reload();
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const movement = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await movement.getByLabel('Importe en pesos (MXN)').fill('789.12');
  await movement.getByLabel('Nota (opcional)').fill('Captura ficticia con servidor apagado');
  await movement.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();
  await expect(movement).not.toBeVisible();
  const saved = await encryptedSnapshot(page);
  await page.reload();
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.getByText('Captura ficticia con servidor apagado', { exact: true })).toBeVisible();
  await expect(page.locator('.balance-hero h2')).toContainText('789.12');
  expect(await encryptedSnapshot(page)).toBe(saved);
});

async function encryptedSnapshot(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('orthomax-gina-vault', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<string>((resolve, reject) => {
      const tx = db.transaction(['records', 'recovery'], 'readonly');
      const primary = tx.objectStore('records').get('main');
      const recovery = tx.objectStore('recovery').getAll();
      tx.oncomplete = () => { db.close(); resolve(JSON.stringify({ primary: primary.result, recovery: recovery.result })); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  });
}

test('actualizar la PWA conserva exactamente bóveda, copias e importes y no controla la web raíz', async ({ page }) => {
  await page.goto(`${ORIGIN}/gina/`);
  await page.getByLabel('Crea una contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Guardaré mi contraseña/ }).check();
  await page.getByRole('button', { name: 'Crear mi espacio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resumen.' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const account = page.getByRole('dialog', { name: 'Agregar cuenta' });
  await account.getByLabel('Nombre de la cuenta').fill('Cuenta sintética de actualización');
  await account.getByLabel('Saldo inicial (MXN)').fill('1000');
  await account.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(account).not.toBeVisible();
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const movement = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await movement.getByLabel('Importe en pesos (MXN)').fill('2345.67');
  await movement.getByLabel('Nota (opcional)').fill(NOTE);
  await movement.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const before = await encryptedSnapshot(page);
  const cacheBefore = await page.evaluate(() => caches.keys());
  expect(cacheBefore.some(name => name.endsWith('-update-test-1'))).toBe(true);
  const incomeBefore = await page.locator('.balance-hero h2').innerText();
  expect(incomeBefore).toContain('2,345.67');

  workerVersion = 2;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await expect(page.getByText('Hay una actualización lista.', { exact: true })).toBeVisible();
  expect(await encryptedSnapshot(page)).toBe(before);
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Desbloquear', exact: true })).toBeVisible();
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
  expect(await encryptedSnapshot(page)).toBe(before);
  expect(await page.locator('.balance-hero h2').innerText()).toBe(incomeBefore);
  const cacheAfter = await page.evaluate(() => caches.keys());
  expect(cacheAfter.some(name => name.endsWith('-update-test-2'))).toBe(true);
  expect(cacheAfter.some(name => name.endsWith('-update-test-1'))).toBe(false);

  await page.goto(`${ORIGIN}/`);
  await expect(page.getByRole('heading', { name: 'Sitio público fuera de la aplicación' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration(location.href))?.scope ?? null)).toBe(null);
});
