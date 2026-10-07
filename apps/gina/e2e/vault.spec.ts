import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// These credentials and financial figures are synthetic test fixtures, never production data.
const PASSWORD = 'Prueba local ficticia 2026 segura';
const NOTE = 'Honorarios ficticios E2E — PRIVADO-796251';
const APP_BASE = process.env.APP_URL || 'http://127.0.0.1:4192/gina/';

async function createVault(page: Page) {
  await page.goto('./');
  await page.getByLabel('Crea una contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Guardaré mi contraseña/ }).check();
  await page.getByRole('button', { name: 'Crear mi espacio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resumen.' })).toBeVisible();
}
async function createMovement(page: Page) {
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const account = page.getByRole('dialog', { name: 'Agregar cuenta' });
  await expect(account).toBeVisible();
  await account.getByLabel('Nombre de la cuenta').fill('Cuenta de pruebas ficticias');
  await account.getByLabel('Saldo inicial (MXN)').fill('2000');
  await account.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(account).not.toBeVisible();
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const movement = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await movement.getByLabel('Importe en pesos (MXN)').fill('1234.56');
  await movement.getByLabel('Nota (opcional)').fill(NOTE);
  await movement.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();
  await expect(movement).not.toBeVisible();
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
}
async function storedEnvelope(page: Page): Promise<string> {
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
async function unlock(page: Page) {
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resumen.' })).toBeVisible();
}

test('registra, persiste al recargar y no expone datos legibles en IndexedDB', async ({ page }) => {
  const pageErrors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => requests.push(`${request.method()} ${request.url()} ${request.postData() || ''}`));
  await createVault(page);
  await createMovement(page);
  const saved = await storedEnvelope(page);
  expect(saved).not.toContain(NOTE);
  expect(saved).not.toContain(PASSWORD);
  expect(saved).not.toContain('1234.56');
  expect(saved).not.toContain('amountCents');
  expect(saved).not.toContain('Cuenta de pruebas ficticias');
  expect(JSON.parse(saved).primary.cipher).toBe('AES-256-GCM');
  await page.reload();
  await page.getByLabel('Contraseña', { exact: true }).fill('Contraseña incorrecta ficticia');
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Contraseña incorrecta');
  expect(await storedEnvelope(page)).toBe(saved);
  await unlock(page);
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
  expect(await storedEnvelope(page)).toBe(saved);
  expect(pageErrors).toEqual([]);
  expect(requests.join('\n')).not.toContain(NOTE);
  expect(requests.join('\n')).not.toContain(encodeURIComponent(NOTE));
  expect(requests.join('\n')).not.toContain(PASSWORD);
  expect(requests.some(request => /^(POST|PUT|PATCH|DELETE) /.test(request))).toBe(false);
  await page.screenshot({ path: test.info().outputPath('mobile-restored-dashboard.png'), fullPage: true });
});

test('exporta respaldo cifrado e importa sus movimientos en otro dispositivo limpio', async ({ page, browser }, testInfo) => {
  await createVault(page);
  await createMovement(page);
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar respaldo cifrado', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar respaldo', exact: true }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath('orthomax-prueba-respaldo.json');
  await download.saveAs(path);
  const backup = await readFile(path, 'utf8');
  expect(backup).not.toContain(NOTE);
  expect(backup).not.toContain(PASSWORD);
  expect(JSON.parse(backup).format).toBe('orthomax-gina-encrypted');

  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX', timezoneId: 'America/Mazatlan' });
  try {
    const target = await other.newPage();
    await target.goto(APP_BASE);
    await target.getByRole('button', { name: 'Restaurar respaldo', exact: true }).click();
    const dialog = target.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(path);
    await dialog.locator('input[type=password]').fill(PASSWORD);
    await dialog.getByRole('button', { name: /Revisar|Previsualizar|Validar/ }).click();
    await expect(dialog.getByText('1 (0 anulados)', { exact: true })).toBeVisible();
    const confirm = dialog.getByRole('checkbox');
    if (await confirm.count()) await confirm.check();
    await dialog.getByRole('button', { name: 'Restaurar el respaldo revisado', exact: true }).click();
    await expect(target.getByText(NOTE, { exact: true })).toBeVisible();
    await target.reload();
    await unlock(target);
    await expect(target.getByText(NOTE, { exact: true })).toBeVisible();
  } finally { await other.close(); }
});

test('la PWA abre sin internet y conserva registros con service worker limitado a /gina/', async ({ page, context, browserName }) => {
  // Playwright 1.63 blocks service-worker responses before dispatch in WebKit offline emulation.
  // The separate origin-stopped test validates WebKit's actual cache fallback without this flag.
  test.skip(browserName === 'webkit', 'Límite del simulador: https://github.com/microsoft/playwright/issues/42775; reapertura con servidor detenido cubierta en update.spec.ts.');
  await createVault(page);
  await createMovement(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const registration = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, script: registration.active?.scriptURL };
  });
  expect(registration.scope).toBe(APP_BASE);
  expect(registration.script).toBe(new URL('sw.js', APP_BASE).href);
  const previous = await storedEnvelope(page);
  await context.setOffline(true);
  await page.reload();
  await unlock(page);
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
  await expect(page.locator('.save-status')).toContainText('Sin conexión');
  expect(await storedEnvelope(page)).toBe(previous);
  await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Registrar' }).click();
  const offlineForm = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await offlineForm.getByLabel('Importe en pesos (MXN)').fill('345.67');
  await offlineForm.getByLabel('Nota (opcional)').fill('Registro ficticio capturado sin conexión');
  await offlineForm.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();
  await expect(offlineForm).not.toBeVisible();
  await page.reload();
  await unlock(page);
  await expect(page.getByText('Registro ficticio capturado sin conexión', { exact: true })).toBeVisible();
  await expect(page.locator('.balance-hero h2')).toContainText('1,580.23');
  await context.setOffline(false);
});

test('se bloquea por inactividad sin perder lo ya guardado', async ({ page }) => {
  await page.clock.install();
  await createVault(page);
  await createMovement(page);
  const saved = await storedEnvelope(page);
  await page.clock.fastForward(5 * 60 * 1000 + 16_000);
  await expect(page.getByRole('button', { name: 'Desbloquear', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('inactividad');
  expect(await storedEnvelope(page)).toBe(saved);
  await unlock(page);
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
});

test('otra pestaña detecta cambios y exige recargar la bóveda antes de continuar', async ({ page, context }) => {
  await createVault(page);
  const second = await context.newPage();
  await second.goto('./');
  await unlock(second);
  await createMovement(page);
  await expect(second.getByRole('button', { name: 'Desbloquear', exact: true })).toBeVisible();
  await unlock(second);
  await expect(second.getByText(NOTE, { exact: true })).toBeVisible();
});

test('la demostración no puede exportar ni reemplazar una bóveda existente', async ({ page }) => {
  await createVault(page);
  await createMovement(page);
  const before = await storedEnvelope(page);
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByRole('button', { name: 'Bloquear mi bóveda', exact: true }).click();
  await page.getByRole('button', { name: 'Explorar demostración', exact: true }).click();
  await expect(page.locator('.demo-banner')).toBeVisible();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Preparar respaldo cifrado', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restaurar respaldo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Descargar respaldo', exact: true })).toHaveCount(0);
  expect(await storedEnvelope(page)).toBe(before);
  await page.getByRole('button', { name: 'Salir de la demostración', exact: true }).click();
  await unlock(page);
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
  expect(await storedEnvelope(page)).toBe(before);
});
