import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Only synthetic figures and accounts are entered. Each test gets its own browser storage.
// All setup uses the visible UI; no application imports, database mutation or test backdoors.
test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });
const PASSWORD = 'Finanzas ficticias E2E octubre 2026';
const FIXED_DATE = new Date('2026-10-15T18:00:00Z');
const cash = (pesos: number) => new RegExp(pesos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[.,]/g, '\\$&'));

async function createVault(page: Page) {
  await page.clock.setFixedTime(FIXED_DATE);
  await page.goto('./');
  await page.getByLabel('Crea una contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Guardaré mi contraseña/ }).check();
  await page.getByRole('button', { name: 'Crear mi espacio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resumen.' })).toBeVisible();
}
async function openDemo(page: Page) {
  await page.clock.setFixedTime(FIXED_DATE);
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorar demostración', exact: true }).click();
  await expect(page.locator('.demo-banner')).toBeVisible();
}
async function navigate(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cuentas', exact: true })).toBeVisible();
}
const card = (page: Page, title: string) => page.locator('section.card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const accountRow = (page: Page, name: string) => card(page, 'Cuentas').locator('.settings-row').filter({ has: page.getByText(name, { exact: true }) });

async function addAccount(page: Page, name: string, area: 'clinic' | 'personal' | 'mixed' = 'mixed', opening = '0') {
  await settings(page);
  await card(page, 'Cuentas').getByRole('button', { name: 'Agregar cuenta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar cuenta' });
  await dialog.getByLabel('Nombre de la cuenta').fill(name);
  await dialog.getByLabel(/^Área/).selectOption(area);
  await dialog.getByLabel('Saldo inicial (MXN)').fill(opening);
  await dialog.getByLabel(/^Fecha de corte inicial/).fill('2026-10-01');
  await dialog.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(accountRow(page, name)).toBeVisible();
}

async function openMovement(page: Page) {
  await page.locator('.sidebar').getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar movimiento', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function addMovement(page: Page, amount: string, note: string, options: {
  type?: 'Ingreso' | 'Gasto' | 'Inversión' | 'Transferencia'; source?: string; account?: string; destination?: string; category?: string;
} = {}) {
  const dialog = await openMovement(page);
  const type = options.type || 'Ingreso';
  await dialog.getByRole('button', { name: type, exact: true }).click();
  await dialog.getByLabel('Importe en pesos (MXN)').fill(amount);
  if (options.source) await dialog.getByLabel(type === 'Transferencia' ? 'Actividad de referencia' : 'Actividad', { exact: true }).selectOption(options.source);
  if (options.account) await dialog.getByLabel(type === 'Transferencia' ? 'Cuenta de origen' : 'Cuenta', { exact: true }).selectOption({ label: options.account });
  if (options.destination) await dialog.getByLabel(/^Cuenta de destino/).selectOption({ label: options.destination });
  if (options.category) await dialog.getByLabel('Categoría', { exact: true }).selectOption(options.category);
  await dialog.getByLabel(/^Nota \(opcional\)/).fill(note);
  await dialog.getByRole('button', { name: `Guardar ${type.toLocaleLowerCase('es-MX')}`, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function movementDetail(page: Page, note: string) {
  await navigate(page, 'Movimientos');
  await page.getByLabel('Filtrar actividad').selectOption('all');
  await page.locator('.movement-row').filter({ hasText: note }).click();
  const dialog = page.getByRole('dialog', { name: 'Detalle del movimiento' });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function editAmount(page: Page, note: string, amount: string) {
  const detail = await movementDetail(page, note);
  await detail.getByRole('button', { name: 'Editar movimiento', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar movimiento', exact: true });
  await edit.getByLabel('Importe en pesos (MXN)').fill(amount);
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(edit).not.toBeVisible();
}
async function voidMovement(page: Page, note: string) {
  const detail = await movementDetail(page, note);
  page.once('dialog', dialog => dialog.accept());
  await detail.getByRole('button', { name: 'Anular movimiento', exact: true }).click();
  await expect(detail).not.toBeVisible();
}
function goalCard(page: Page, name: string) {
  return page.locator('.goal-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
}
async function personal(page: Page) {
  await navigate(page, 'Actividades');
  await page.getByLabel('Filtrar actividad').selectOption('all');
  await page.locator('.activity-card').filter({ has: page.getByRole('heading', { name: 'Personal', exact: true }) }).click();
  await expect(page.getByRole('heading', { name: 'Un espacio para tu ahorro' })).toBeVisible();
}
async function expectFree(page: Page, amount: number) {
  await expect(page.locator('.kpi').filter({ hasText: 'Dinero libre hoy' }).locator('strong')).toContainText(cash(amount));
}

test('una meta se recalcula tras registrar, editar, anular y deshacer un ingreso', async ({ page }) => {
  await createVault(page);
  await addAccount(page, 'Banco ficticio');
  await navigate(page, 'Mis metas');
  await page.locator('.heading-register').click();
  const goal = page.getByRole('dialog', { name: 'Tu meta' });
  await goal.getByLabel('Nombre de la meta').fill('Meta mensual de prueba');
  await goal.getByLabel('Importe objetivo (MXN)').fill('2000');
  await goal.getByRole('button', { name: 'Crear meta', exact: true }).click();
  await expect(goal).not.toBeVisible();
  await expect(goalCard(page, 'Meta mensual de prueba').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

  await addMovement(page, '1500', 'Ingreso para meta E2E');
  await expect(goalCard(page, 'Meta mensual de prueba').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  await editAmount(page, 'Ingreso para meta E2E', '2000');
  await navigate(page, 'Mis metas');
  await expect(goalCard(page, 'Meta mensual de prueba').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(goalCard(page, 'Meta mensual de prueba')).toContainText('¡Meta alcanzada!');

  await voidMovement(page, 'Ingreso para meta E2E');
  await navigate(page, 'Mis metas');
  await expect(goalCard(page, 'Meta mensual de prueba').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(goalCard(page, 'Meta mensual de prueba').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await navigate(page, 'Resumen');
  await expect(page.locator('.balance-hero h2')).toContainText(cash(2000));
});

test('una transferencia conserva General y aparece recibida en Personal sin duplicar ingresos', async ({ page }) => {
  await createVault(page);
  await addAccount(page, 'Banco consultorio ficticio', 'clinic', '6000');
  await addAccount(page, 'Banco personal ficticio', 'personal', '0');
  await addMovement(page, '1000', 'Transferencia interna de prueba', { type: 'Transferencia', account: 'Banco consultorio ficticio', destination: 'Banco personal ficticio' });
  await navigate(page, 'Resumen');
  await expect(page.locator('.balance-hero h2')).toContainText(cash(0));
  await expectFree(page, 6000);
  await page.getByLabel('Filtrar actividad').selectOption('personal');
  await expect(page.locator('.balance-hero h2')).toContainText(cash(0));
  await expectFree(page, 1000);
  await expect(page.locator('.transfer-note')).toContainText('Transferencias recibidas');
  await expect(page.locator('.transfer-note')).toContainText(cash(1000));
  await settings(page);
  await expect(accountRow(page, 'Banco consultorio ficticio')).toContainText(cash(5000));
  await expect(accountRow(page, 'Banco personal ficticio')).toContainText(cash(1000));
});

test('cobros parciales rechazan excesos y una corrección o anulación recalcula el pendiente', async ({ page }) => {
  await createVault(page);
  await addAccount(page, 'Cuenta de honorarios ficticia');
  await navigate(page, 'Por cobrar');
  await card(page, 'Honorarios por cobrar').getByRole('button', { name: 'Agregar pendiente' }).first().click();
  const pending = page.getByRole('dialog', { name: 'Nuevo cobro pendiente' });
  await pending.getByLabel('Concepto', { exact: true }).fill('Honorarios Secom E2E');
  await pending.getByLabel('Actividad', { exact: true }).selectOption('secom');
  await pending.getByLabel('Total esperado (MXN)').fill('5000');
  await pending.getByRole('button', { name: 'Crear pendiente', exact: true }).click();
  await expect(pending).not.toBeVisible();
  const receivable = page.locator('.receivable-card').filter({ hasText: 'Honorarios Secom E2E' });
  await expect(receivable.locator('strong').first()).toContainText(cash(5000));
  await receivable.getByRole('button', { name: 'Registrar cobro' }).click();
  const payment = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await payment.getByLabel('Importe en pesos (MXN)').fill('2000');
  await payment.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();
  await expect(payment).not.toBeVisible();
  await expect(receivable).toContainText('Cobro parcial');
  await expect(receivable.locator('strong').first()).toContainText(cash(3000));

  await receivable.getByRole('button', { name: 'Registrar cobro' }).click();
  const excessive = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await excessive.getByLabel('Importe en pesos (MXN)').fill('4000');
  await excessive.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();
  await expect(excessive.getByRole('alert')).toContainText('superan su total pendiente');
  await excessive.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(receivable.locator('strong').first()).toContainText(cash(3000));

  await editAmount(page, 'Honorarios Secom E2E', '1500');
  await navigate(page, 'Por cobrar');
  await expect(receivable.locator('strong').first()).toContainText(cash(3500));
  await voidMovement(page, 'Honorarios Secom E2E');
  await navigate(page, 'Por cobrar');
  await expect(receivable.locator('strong').first()).toContainText(cash(5000));
  await expect(receivable.locator('.pill')).toHaveText('Pendiente');
  await receivable.getByRole('button', { name: 'Editar pendiente' }).click();
  await expect(page.getByRole('dialog').getByLabel(/^Actividad/)).toBeDisabled();
});

test('los apartados reducen dinero libre, validan disponibilidad y permiten liberar sin crear ingresos', async ({ page }) => {
  await createVault(page);
  await addAccount(page, 'Cuenta personal ficticia', 'personal', '6000');
  await personal(page);
  await expectFree(page, 6000);
  const savingsCard = card(page, 'Un espacio para tu ahorro');
  await savingsCard.getByRole('button', { name: 'Apartar', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Tu ahorro' });
  await dialog.getByLabel('Nombre del apartado').fill('Fondo de tranquilidad E2E');
  await dialog.getByLabel(/^Primera aportación/).fill('2000');
  await dialog.getByRole('button', { name: 'Crear apartado', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expectFree(page, 4000);
  await expect(savingsCard.locator('.category-row')).toContainText(cash(2000));

  await savingsCard.getByRole('button', { name: 'Apartar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Tu ahorro' });
  await dialog.getByLabel('Qué quieres hacer').selectOption('add');
  await dialog.getByLabel(/^Importe a apartar/).fill('4500');
  await dialog.getByRole('button', { name: 'Guardar aportación' }).click();
  await expect(dialog.getByRole('alert')).toContainText('supera el saldo disponible');
  await dialog.getByLabel(/^Importe a apartar/).fill('500');
  await dialog.getByRole('button', { name: 'Guardar aportación' }).click();
  await expect(dialog).not.toBeVisible();
  await expectFree(page, 3500);

  await savingsCard.getByRole('button', { name: 'Apartar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Tu ahorro' });
  await dialog.getByLabel('Qué quieres hacer').selectOption('release');
  await dialog.getByLabel(/^Importe a liberar/).fill('500');
  await dialog.getByRole('button', { name: 'Liberar dinero', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expectFree(page, 4000);
  await expect(page.locator('.balance-hero h2')).toContainText(cash(0));
  await settings(page);
  await expect(accountRow(page, 'Cuenta personal ficticia')).toContainText(cash(6000));
});

test('los filtros determinan las filas y el CSV exportado, con protección ante fórmulas', async ({ page }, testInfo) => {
  await createVault(page);
  await addAccount(page, 'Cuenta ficticia para exportar');
  const formula = '=HYPERLINK("x") · Filtro de prueba';
  await addMovement(page, '1500', formula);
  await addMovement(page, '100', 'Consumibles sintéticos', { type: 'Gasto', category: 'expense-materials' });
  await addMovement(page, '700', 'Honorarios externos sintéticos', { source: 'secom' });
  await navigate(page, 'Movimientos');
  await expect(page.locator('.movement-row')).toHaveCount(3);
  await page.getByLabel('Filtrar categoría').selectOption('expense-materials');
  await expect(page.locator('.movement-row')).toHaveCount(1);
  await expect(page.locator('.movement-row')).toContainText('Consumibles sintéticos');
  await page.getByLabel('Filtrar categoría').selectOption('all');
  await page.getByLabel('Filtrar actividad').selectOption('secom');
  await expect(page.locator('.movement-row')).toHaveCount(1);
  await expect(page.locator('.movement-row')).toContainText(cash(700));
  await page.getByLabel('Filtrar actividad').selectOption('all');
  await page.getByLabel('Buscar movimientos').fill('Filtro de prueba');
  await expect(page.locator('.movement-row')).toHaveCount(1);
  await page.getByLabel('Tipo de movimiento', { exact: true }).selectOption('expense');
  await expect(page.locator('.movement-row')).toHaveCount(0);
  await page.getByLabel('Tipo de movimiento', { exact: true }).selectOption('all');
  await expect(page.locator('.movement-row')).toHaveCount(1);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
  const csvFile = await downloaded;
  const path = testInfo.outputPath('movimientos-filtrados.csv');
  await csvFile.saveAs(path);
  const csv = await readFile(path, 'utf8');
  expect(csv.trim().split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain('1500.00');
  expect(csv).not.toContain('Consumibles sintéticos');
  expect(csv).not.toContain('Honorarios externos sintéticos');
});

test('el cierre mensual conserva una revisión de más de cuatro registros y detecta correcciones posteriores', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Movimientos');
  await expect(page.locator('.movement-row')).toHaveCount(13);
  await navigate(page, 'Reportes');
  await page.getByLabel('Filtrar actividad').selectOption('all');
  await page.getByRole('button', { name: 'Marcar mes revisado', exact: true }).click();
  const review = page.getByRole('region', { name: 'Comparación con el mes revisado' });
  await expect(review).toContainText('Sin cambios desde esta revisión');
  await expect(review).toContainText(cash(18000));
  await addMovement(page, '500', 'Corrección de cierre ficticia');
  await expect(review).toContainText('Hay cambios posteriores');
  await expect(review).toContainText(cash(18500));
  await expect(review).toContainText(cash(500));
  await page.getByRole('button', { name: 'Marcar mes revisado', exact: true }).click();
  await expect(review).toContainText('Sin cambios desde esta revisión');
  await page.getByLabel('Filtrar actividad').selectOption('personal');
  await expect(page.getByRole('button', { name: 'Marcar mes revisado', exact: true })).toBeDisabled();
});

test('editar fuentes, cuentas y categorías conserva los movimientos y sus importes', async ({ page }) => {
  await createVault(page);
  await addAccount(page, 'Cuenta original ficticia');
  await addMovement(page, '1500', 'Ingreso de catálogo E2E', { source: 'secom' });
  await settings(page);
  const sources = card(page, 'Actividades y fuentes');
  let source = sources.locator('.settings-row').filter({ has: page.getByText('Secom', { exact: true }) });
  await source.getByRole('button', { name: 'Renombrar', exact: true }).click();
  await sources.getByLabel('Nuevo nombre').fill('Secom · nombre de prueba');
  await sources.getByRole('button', { name: 'Guardar nombre', exact: true }).click();
  source = sources.locator('.settings-row').filter({ has: page.getByText('Secom · nombre de prueba', { exact: true }) });
  await expect(source).toBeVisible();

  await accountRow(page, 'Cuenta original ficticia').getByRole('button', { name: 'Editar', exact: true }).click();
  const account = page.getByRole('dialog', { name: 'Editar cuenta', exact: true });
  await account.getByLabel('Nombre de la cuenta').fill('Cuenta editada ficticia');
  await account.getByRole('button', { name: 'Guardar cuenta', exact: true }).click();
  await expect(account).not.toBeVisible();
  await expect(accountRow(page, 'Cuenta editada ficticia')).toContainText(cash(1500));

  const categories = card(page, 'Categorías');
  const category = categories.locator('.settings-row').filter({ has: page.getByText('Cobro de servicios', { exact: true }) });
  await category.getByRole('button', { name: 'Renombrar', exact: true }).click();
  await categories.getByLabel('Nuevo nombre').fill('Honorarios recibidos E2E');
  await categories.getByRole('button', { name: 'Guardar nombre', exact: true }).click();
  const renamedCategory = categories.locator('.settings-row').filter({ has: page.getByText('Honorarios recibidos E2E', { exact: true }) });
  await expect(renamedCategory).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await renamedCategory.getByRole('button', { name: 'Archivar', exact: true }).click();
  await expect(categories).toContainText('Honorarios recibidos E2E · archivada');
  await categories.getByText('Crear una categoría', { exact: true }).click();
  await categories.getByLabel('Nombre de categoría').fill('Transporte profesional E2E');
  await categories.getByRole('button', { name: 'Crear categoría', exact: true }).click();
  await expect(categories.getByText('Transporte profesional E2E', { exact: true })).toBeVisible();

  const detail = await movementDetail(page, 'Ingreso de catálogo E2E');
  await expect(detail).toContainText('Secom · nombre de prueba');
  await expect(detail).toContainText('Cuenta editada ficticia');
  await expect(detail).toContainText(cash(1500));
  await detail.getByRole('button', { name: 'Editar movimiento', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar movimiento', exact: true });
  await expect(edit.getByLabel('Categoría', { exact: true }).locator('option:checked')).toHaveText('Honorarios recibidos E2E · archivada');
  await edit.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.reload();
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  await expect(page.locator('.balance-hero h2')).toContainText(cash(1500));
  await expect(page.locator('.movement-row')).toContainText('Secom · nombre de prueba');
});
