import { test, expect, Page } from '@playwright/test';

/**
 * Seed v2 items into localStorage before app boot.
 * Must be called before page.goto so the app reads initial state.
 */
async function seedItems(page: Page) {
  await page.addInitScript(() => {
    const items = [
      { id: '1', label: 'Item A', hidden: false, weight: 1, imageFit: 'cover', imageZoom: 1, imageOpacity: 1 },
      { id: '2', label: 'Item B', hidden: false, weight: 2, imageFit: 'cover', imageZoom: 1, imageOpacity: 1 },
    ];
    localStorage.setItem('modern-wheel:items:v2', JSON.stringify(items));
  });
}

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('modern-wheel:items');
    localStorage.removeItem('modern-wheel:items:v2');
    localStorage.removeItem('modern-wheel:config');
    localStorage.removeItem('modern-wheel:history');
  });
}

/**
 * Garante que o InputsPanel e o Item 1 estejam visíveis em layout desktop.
 * Também injeta spies para clipboard e sinalizadores de diagnóstico para confirmar montagem.
 */
async function ensureInputsVisible(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 });

  // Injeta diagnóstico antes de qualquer script da app
  await page.addInitScript(() => {
    (window as any).__copied = '';
    (window as any).__MW_READY__ = false;

    const orig = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (orig) {
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

    // eventos que sinalizam que a app interagiu com o DOM/localStorage
    window.addEventListener('modern-wheel:items-updated', () => {
      (window as any).__MW_READY__ = true;
    });
    window.addEventListener('load', () => {
      (window as any).__MW_READY__ = true;
    });
  });

  await page.goto('/');

  // Aguarda ancorador do painel para evitar interações prematuras
  const panelRoot = page.getByTestId('inputs-panel-root');
  await expect(panelRoot).toBeVisible({ timeout: 30000 }).catch(() => {});

  // Tenta tornar algum input visível rapidamente, mas permita o flag de prontidão
  const anyInput = page.locator('[data-testid^="label-input-"], [data-testid^="weight-input-"]').first();

  // Aguarda OU um input visível OU o flag interno __MW_READY__
  await Promise.race([
    anyInput.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {}),
    page.waitForFunction(() => (window as any).__MW_READY__ === true, { timeout: 15000 }).catch(() => {})
  ]);

  // Força evento de resize para layout desktop
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));

  // Se a seção "Itens" estiver colapsada, tenta expandir (não falha se não existir)
  if (!(await anyInput.isVisible().catch(() => false))) {
    const itensToggler = page.locator('[data-testid="section-itens-toggle"]');
    if (await itensToggler.isVisible().catch(() => false)) {
      await itensToggler.click().catch(() => {});
      await page.waitForTimeout(150);
    } else {
      const itensSummary = page.locator('summary', { hasText: /^Itens\b/i });
      const count = await itensSummary.count().catch(() => 0);
      if (count > 0) {
        await itensSummary.first().click().catch(() => {});
      } else {
        const itensHeaderButton = page.getByRole('button', { name: /^Itens\b/i });
        if (await itensHeaderButton.isVisible().catch(() => false)) {
          await itensHeaderButton.click().catch(() => {});
        } else {
          await page.getByText(/^Itens\b/i).first().click().catch(() => {});
        }
      }
      await page.waitForTimeout(150);
    }
  }

  // Garante visibilidade via scrollIntoView no primeiro input
  await anyInput.scrollIntoViewIfNeeded().catch(() => {});
  await anyInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
}

test.describe('InputsPanel validações', () => {
  test.beforeEach(async ({ page }) => {
    await seedItems(page);
    await ensureInputsVisible(page);
  });

  test('Label: vazio, limite e aviso de proximidade', async ({ page }) => {
    test.setTimeout(60000);
    const id = '1';
    const input = page.getByTestId(`label-input-${id}`);
  
    // Aguarda painel
    await expect(page.getByTestId('inputs-panel-root')).toBeVisible({ timeout: 30000 });
  
    // Abre explicitamente a seção Itens via botão/summary/data-testid e aguarda input ficar visível
    const itensToggler = page.locator('[data-testid="section-itens-toggle"]');
    const itensSummary = page.locator('summary', { hasText: /^Itens\b/i });
    const itensHeaderButton = page.getByRole('button', { name: /^Itens\b/i });
  
    if (!(await input.isVisible().catch(() => false))) {
      if (await itensToggler.isVisible().catch(() => false)) {
        await itensToggler.click().catch(() => {});
      } else if ((await itensSummary.count().catch(() => 0)) > 0) {
        await itensSummary.first().click().catch(() => {});
      } else if (await itensHeaderButton.isVisible().catch(() => false)) {
        await itensHeaderButton.click().catch(() => {});
      } else {
        await page.getByText(/^Itens\b/i).first().click().catch(() => {});
      }
    }
  
    // Usa locator.waitFor({state:'visible'}) no próprio input para evitar evaluate() com página fechada
    await input.scrollIntoViewIfNeeded().catch(() => {});
    await input.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await expect(input).toBeVisible({ timeout: 20000 });
  
    // Interações
    await input.focus();
  
    // vazio
    await input.fill('');
    await input.blur();
    await expect(page.getByText(/r[oó]tulo.*vaz[ií]o/i)).toBeVisible({ timeout: 15000 });
  
    // limite 80/80
    const long = 'x'.repeat(80);
    await input.fill(long);
    await input.blur();
    await expect(page.getByText(/80\/80/i)).toBeVisible({ timeout: 15000 });
  
    // próximo do limite (>=70)
    const near = 'y'.repeat(70);
    await input.fill(near);
    await input.blur();
    await expect(page.getByText(/pr[oó]ximo do limite/i)).toBeVisible({ timeout: 15000 });
  });

  test('Weight: fora do intervalo e normalização no blur', async ({ page }) => {
    const id = '1';
    const input = page.getByTestId(`weight-input-${id}`);

    await input.scrollIntoViewIfNeeded();
    await input.focus();

    // mínimo
    await input.fill('0');
    await input.blur();
    await expect(page.getByText(/peso m[ií]nimo/i)).toBeVisible({ timeout: 10000 });

    // máximo
    await input.fill('1000');
    await input.blur();
    await expect(page.getByText(/peso m[aá]ximo/i)).toBeVisible({ timeout: 10000 });

    // arredondamento/normalização no blur (inteiro)
    await input.fill('3.7');
    await input.blur();
    await expect(input).toHaveValue(/^\s*4\s*$/);
  });

  test('URL: deve ser http/https e resolver erro ao corrigir', async ({ page }) => {
    const id = '1';
    const input = page.getByTestId(`image-url-input-${id}`);

    await input.scrollIntoViewIfNeeded();
    await input.focus();

    await input.fill('ftp://foo');
    await input.blur();
    await expect(page.getByText(/url inv[aá]lida/i)).toBeVisible({ timeout: 10000 });

    await input.fill('https://example.com/a.jpg');
    await input.blur();
    await expect(page.getByText(/url inv[aá]lida/i)).toHaveCount(0);
  });

  test('Zoom: validação de faixa e normalização no blur', async ({ page }) => {
    const id = '1';
    const input = page.getByTestId(`image-zoom-input-${id}`);

    await input.scrollIntoViewIfNeeded();
    await input.focus();

    await input.fill('0.1');
    await input.blur();
    await expect(page.getByText(/m[ií]nimo\s*0[.,]5/i)).toBeVisible({ timeout: 10000 });

    await input.fill('3');
    await input.blur();
    await expect(page.getByText(/m[aá]ximo\s*2(?:[.,]0{1,2})?/i)).toBeVisible({ timeout: 10000 });

    await input.fill('1.23');
    await input.blur();
    await expect(input).toHaveValue(/^1[.,]23$/);
  });

  test('Opacidade: slider reflete % e limpar volta a 100%', async ({ page }) => {
    const id = '1';
    const slider = page.getByTestId(`image-opacity-input-${id}`);

    await slider.scrollIntoViewIfNeeded();
    await slider.focus();

    await slider.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = '40';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const display = page.getByTestId(`image-opacity-display-${id}`);
    if (await display.isVisible().catch(() => false)) {
      await expect(display).toHaveText(/40%/i, { timeout: 10000 });
    } else {
      await expect(page.getByText(/40%/i)).toBeVisible({ timeout: 10000 });
    }

    const limpar = page.getByRole('button', { name: /limpar/i }).first();
    await limpar.click();

    if (await display.isVisible().catch(() => false)) {
      await expect(display).toHaveText(/100%/i, { timeout: 10000 });
    } else {
      await expect(page.getByText(/100%/i)).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Exportar/Compartilhar/Importar por URL', () => {
  test('Exportar copia JSON para clipboard (fallback: download)', async ({ page, context }) => {
    await clearStorage(page);
    await seedItems(page);

    // Intercepta writeText do clipboard
    await page.addInitScript(() => {
      const orig = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      (window as any).__copied = '';
      if (orig) {
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

    // garante render da sidebar e footer (botões)
    await ensureInputsVisible(page);

    // clica no botão Exportar no footer da sidebar
    const exportBtn = page.getByRole('button', { name: /exportar/i }).first();
    await exportBtn.waitFor({ state: 'visible', timeout: 10000 });
    await exportBtn.click();

    // valida que algo JSON-like foi copiado
    const copied = await page.evaluate(() => (window as any).__copied || '');
    expect(copied.length).toBeGreaterThan(0);
    expect(() => JSON.parse(copied)).not.toThrow();
    const parsed = JSON.parse(copied);
    expect(parsed).toHaveProperty('items');
    expect(parsed).toHaveProperty('config');
    expect(parsed).toHaveProperty('history');
  });

  test('Compartilhar gera URL com ?data=... e Importa ao abrir', async ({ page, context }) => {
    await clearStorage(page);
    await seedItems(page);

    // Intercepta writeText para capturar URL
    await page.addInitScript(() => {
      (window as any).__copied = '';
      (navigator as any).clipboard = {
        writeText: async (txt: string) => {
          (window as any).__copied = txt;
          return Promise.resolve();
        }
      };
    });

    await ensureInputsVisible(page);

    // Ajusta alguma config para verificar que foi transportada
    await page.evaluate(() => {
      const cfg = { spinDuration: 4321, randomStart: false, removeAfterChoiceEnabled: true };
      localStorage.setItem('modern-wheel:config', JSON.stringify(cfg));
      window.dispatchEvent(new Event('modern-wheel:config-updated'));
    });

    // Compartilhar
    const shareBtn = page.getByRole('button', { name: /compartilhar/i }).first();
    await shareBtn.waitFor({ state: 'visible', timeout: 10000 });
    await shareBtn.click();

    const url = await page.evaluate(() => (window as any).__copied || '');
    expect(url).toMatch(/\?data=/);

    // Abre a URL compartilhada em nova aba e valida importação automática
    const newPage = await context.newPage();
    await newPage.goto(url);

    // A app deve aplicar items/config/history no boot; verificamos config aplicada
    const cfg = await newPage.evaluate(() => {
      const raw = localStorage.getItem('modern-wheel:config');
      return raw ? JSON.parse(raw) : {};
    });
    expect(cfg.spinDuration).toBe(4321);
    expect(cfg.randomStart).toBe(false);
    expect(cfg.removeAfterChoiceEnabled).toBe(true);

    // Verifica que itens v2 foram aplicados (derivado do seed)
    const v2 = await newPage.evaluate(() => {
      const raw = localStorage.getItem('modern-wheel:items:v2');
      return raw ? JSON.parse(raw) : [];
    });
    expect(Array.isArray(v2)).toBe(true);
    expect(v2.length).toBeGreaterThan(0);

    // Confere que a URL foi limpa do parâmetro ?data
    expect(newPage.url()).not.toMatch(/\?data=/);
  });
});