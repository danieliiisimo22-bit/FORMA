import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const current = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('forma-studio.v1')!).recipe)
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.stage-frame canvas')).toHaveAttribute('data-seed', '482901')
})

test('auditoría: ajustes, simetrías, acabados y bloqueos', async ({ page }) => {
  test.setTimeout(90_000)
  await page.getByRole('button', { name: 'Estudio', exact: true }).click()
  for (const value of ['Calm', 'Balanced', 'Bold', 'Editorial', 'Retro', 'Nocturne', 'Solar', 'Chromatic']) {
    await page.getByLabel('Personalidad cromática').selectOption(value)
    expect((await current(page)).personality).toBe(value)
  }
  for (const value of await page.getByLabel('Armonía', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value))) {
    await page.getByLabel('Armonía', { exact: true }).selectOption(value)
    expect((await current(page)).harmony).toBe(value)
  }
  for (const value of ['free', 'mirror', 'horizontal', 'vertical', 'quadrants', 'radial', 'kaleido']) {
    await page.getByRole('combobox', { name: 'Simetría', exact: true }).selectOption(value)
    expect((await current(page)).symmetry.mode).toBe(value)
  }
  for (const value of ['none', 'fine', 'film', 'halftone', 'blur', 'bloom', 'vignette', 'posterize', 'print', 'analog', 'aberration']) {
    await page.getByLabel('Acabado', { exact: true }).selectOption(value)
    expect((await current(page)).texture.finish).toBe(value)
  }
  for (const slider of await page.getByRole('slider').all()) {
    await slider.press('ArrowRight')
    expect(await slider.inputValue()).not.toBe('')
  }
  await page.getByLabel('Dithering técnico').uncheck()
  expect((await current(page)).render.dither).toBe(false)
  await page.getByLabel('Semilla', { exact: true }).fill('123456')
  await page.getByLabel('Semilla', { exact: true }).press('Enter')
  await expect(page.locator('.stage-frame canvas')).toHaveAttribute('data-seed', '123456')
  await page.getByRole('button', { name: 'Bloquear paleta', exact: true }).click()
  await page.getByRole('button', { name: 'Bloquear Corriente', exact: true }).click()
  const locked = await current(page)
  await expect(page.getByLabel('Personalidad cromática')).toBeDisabled()
  await page.getByRole('button', { name: 'Nueva variante', exact: true }).click()
  const changed = await current(page)
  expect(changed.palette).toEqual(locked.palette)
  expect(changed.parameters[0]).toBe(locked.parameters[0])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Estudio', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('auditoría: proporciones, zoom, enfoque, ayuda y nueva composición', async ({ page }) => {
  for (const value of ['1:1', '16:9', '9:16', '4:3', '3:2', '21:9']) {
    await page.getByLabel('Proporción del lienzo').selectOption(value)
    expect((await current(page)).aspect).toBe(value)
  }
  await page.getByLabel('Proporción del lienzo').selectOption('custom')
  await page.getByRole('spinbutton', { name: 'Ancho', exact: true }).fill('9')
  await page.getByRole('spinbutton', { name: 'Alto', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Aplicar proporción' }).click()
  await expect(page.getByRole('alert')).toContainText('8:1')
  await page.getByRole('spinbutton', { name: 'Ancho', exact: true }).fill('5')
  await page.getByRole('spinbutton', { name: 'Alto', exact: true }).fill('4')
  await page.getByRole('button', { name: 'Aplicar proporción' }).click()
  expect((await current(page)).customAspect).toEqual([5, 4])
  await page.getByRole('button', { name: 'Acercar', exact: true }).click()
  await expect(page.getByRole('button', { name: '125%', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '125%', exact: true }).click()
  await page.getByRole('button', { name: 'Alejar', exact: true }).click()
  await expect(page.getByRole('button', { name: '75%', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Vista enfocada' }).click()
  await expect(page.getByRole('complementary', { name: 'Ajustes de composición' })).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: 'Ajustes de composición' })).toBeVisible()
  await page.getByRole('button', { name: 'Ayuda y atajos' }).click()
  await expect(page.getByRole('dialog')).toContainText('Generar')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Nueva', exact: true }).click()
  await expect(page.getByRole('button', { name: '100%', exact: true })).toBeVisible()
  const seed = (await current(page)).seed
  await page.keyboard.press('g')
  expect((await current(page)).seed).not.toBe(seed)
  await page.keyboard.press('Meta+z')
  expect((await current(page)).seed).toBe(seed)
  await page.keyboard.press('Meta+Shift+z')
  expect((await current(page)).seed).not.toBe(seed)
  await page.keyboard.press('Meta+s')
  await expect(page.getByRole('dialog')).toContainText('Mis recetas')
})

test('auditoría: extracción, búsqueda y archivos de paleta y receta', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar paleta Brasa' }).click()
  await page.getByLabel('Buscar paleta').fill('Brasa')
  await expect(page.locator('.palette-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Extraer del lienzo' }).click()
  expect((await current(page)).paletteName).toBe('Paleta extraída')
  const palette = (await current(page)).palette
  const wait = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar paleta', exact: true }).click()
  const file = await wait
  expect(JSON.parse(await readFile((await file.path())!, 'utf8')).colors).toEqual(palette)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Mis recetas' }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar receta', exact: true }).click()
  expect(JSON.parse(await readFile((await (await pending).path())!, 'utf8'))).toEqual(await current(page))
  await page.locator('input[type=file]').setInputFiles({ name: 'mal.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('alert')).toContainText('JSON válido')
})

test('auditoría: 16 variantes, exploración y navegación por pestañas', async ({ page }) => {
  await page.getByRole('button', { name: 'Comparar composiciones', exact: true }).click()
  await page.getByRole('combobox', { name: 'Comparar con', exact: true }).selectOption('1')
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('tab', { name: 'Variantes', exact: true }).click()
  await page.getByRole('combobox', { name: 'Cantidad', exact: true }).selectOption('16')
  await page.getByRole('button', { name: 'Mutar composición' }).click()
  await expect(page.locator('.film-item')).toHaveCount(16)
  await page.getByRole('tab', { name: 'Variantes', exact: true }).press('Home')
  await expect(page.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
  const before = await page.locator('.stage-frame canvas').getAttribute('data-seed')
  await page.getByRole('button', { name: 'Explorar', exact: true }).click()
  expect(String((await current(page)).seed)).not.toBe(before)
  await page.getByRole('button', { name: 'Guardar favorito', exact: true }).click()
  await page.getByRole('button', { name: 'Quitar favorito', exact: true }).click()
  await page.getByRole('tab', { name: 'Favoritos', exact: true }).click()
  await expect(page.locator('.film-item')).toHaveCount(0)
})

test('auditoría: guardar, cargar y eliminar datos de prueba', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar paleta Brasa' }).click()
  await page.getByRole('textbox', { name: 'Nombre de paleta personalizada' }).fill('Paleta auditoría')
  await page.getByRole('button', { name: 'Guardar paleta', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Mis recetas' }).click()
  await page.getByRole('textbox', { name: 'Nombre de receta' }).fill('Receta auditoría')
  await page.getByRole('button', { name: 'Guardar receta', exact: true }).click()
  await page.getByRole('button', { name: 'Receta auditoría', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mis recetas' }).click()
  await page.getByRole('button', { name: 'Eliminar Receta auditoría', exact: true }).click()
  await page.getByRole('button', { name: 'Eliminar paleta Paleta auditoría', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Receta auditoría', exact: true })).toHaveCount(0)
  await expect(page.getByText('Paleta auditoría', { exact: true })).toHaveCount(0)
})

test('auditoría: límite de megapíxeles', async ({ page }) => {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await page.getByRole('combobox', { name: 'Resolución', exact: true }).selectOption('custom')
  await page.getByLabel('Ancho (px)', { exact: true }).fill('8192')
  await page.getByLabel('Alto (px)', { exact: true }).fill('8192')
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('34 megapíxeles')
})
