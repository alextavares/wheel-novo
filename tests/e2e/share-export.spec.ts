import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('modern-wheel:items');
    localStorage.removeItem('modern-wheel:items:v2');
    localStorage.removeItem('modern-wheel:config');
    localStorage.removeItem('modern-wheel:history');
  });
}

async function seedItems(page: Page) {
  await page.addInitScript(() => {
    const items = [
      { id: '1', label: 'Item A', hidden: false, weight: 1, imageFit: 'cover', imageZoom: 1, imageOpacity: 1 },
      { id: '2', label: 'Item B', hidden: false, weight: 2, imageFit: 'cover', imageZoom: 1, imageOpacity: 1 },
    ];
    localStorage.setItem('modern-wheel:items:v2', JSON.stringify(items));
    localStorage.setItem('modern-wheel:history', JSON.stringify([
      { id: '1', label: 'Item A', timestamp: new Date().toISOString() }
    ]));
  });
}

// helper para esperar toast com parte do texto
async function expectToast(page: Page, partial: RegExp | string) {
  const role = page.getByRole('status');
  // pode haver múltiplos; usamos a primeira aparição
  await expect(role.filter({ hasText: partial })).toBeVisible({ timeout: 5000 });
}

test.describe('Exportar / Compartilhar / Importar via URL', () => {
  test('Exportar copia JSON para clipboard (com fallback de download) e mostra toast', async ({ page }) => {
    await clearStorage(page);
    await seedItems(page);

    await page.addInitScript(() => {
      (window as any).__copied = '';
      const native = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      if (native) {
        navigator.clipboard.writeText = async (txt: string) => {
          (window as any).__copied = txt;
          return Promise.resolve();
        };
      } else {
        (navigator as any).clipboard = {
          writeText: async (txt: string) => {
            (window as any).__copied = txt;
            return Promise.resolve();
          }
        };
      }
    });

    await page.goto('/');

    const exportBtn = page.getByRole('button', { name: /exportar/i }).first();
    await exportBtn.click();

    // valida JSON copiado
    const copied = await page.evaluate(() => (window as any).__copied || '');
    expect(copied.length).toBeGreaterThan(0);
    const parsed = JSON.parse(copied);
    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('items');
    expect(parsed).toHaveProperty('config');
    expect(parsed).toHaveProperty('history');

    // valida toast de sucesso
    await expectToast(page, /Exportado para a área de transferência/i);
  });

  test('Compartilhar gera URL com ?data=..., mostra toast e importar aplica estado ao abrir', async ({ page, context }) => {
    await clearStorage(page);
    await seedItems(page);

    await page.addInitScript(() => {
      const cfg = { spinDuration: 4321, randomStart: false, removeAfterChoiceEnabled: true };
      localStorage.setItem('modern-wheel:config', JSON.stringify(cfg));
    });

    await page.addInitScript(() => {
      (window as any).__copied = '';
      (navigator as any).clipboard = {
        writeText: async (txt: string) => {
          (window as any).__copied = txt;
          return Promise.resolve();
        }
      };
    });

    await page.goto('/');

    const shareBtn = page.getByRole('button', { name: /compartilhar/i }).first();
    await shareBtn.click();

    // valida toast de sucesso
    await expectToast(page, /Link de compartilhamento copiado/i);

    const url = await page.evaluate(() => (window as any).__copied || '');
    expect(url).toMatch(/\?data=/);

    const newPage = await context.newPage();
    await newPage.goto(url);

    // valida toast de importação (pode aparecer muito rápido; dar pequena margem)
    await expectToast(newPage, /Configuração importada do link/i);

    const cfg = await newPage.evaluate(() => {
      const raw = localStorage.getItem('modern-wheel:config');
      return raw ? JSON.parse(raw) : {};
    });
    expect(cfg.spinDuration).toBe(4321);
    expect(cfg.randomStart).toBe(false);
    expect(cfg.removeAfterChoiceEnabled).toBe(true);

    const v2 = await newPage.evaluate(() => {
      const raw = localStorage.getItem('modern-wheel:items:v2');
      return raw ? JSON.parse(raw) : [];
    });
    expect(Array.isArray(v2)).toBe(true);
    expect(v2.length).toBeGreaterThan(0);

    const hist = await newPage.evaluate(() => {
      const raw = localStorage.getItem('modern-wheel:history');
      return raw ? JSON.parse(raw) : [];
    });
    expect(Array.isArray(hist)).toBe(true);

    expect(newPage.url()).not.toMatch(/\?data=/);
  });
});