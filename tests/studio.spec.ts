import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { presets } from '../src/presets/recipes'
import { generatorById } from '../src/generators'

const title = (name: string) => 'Composición ' + name
const canvas = (page: Page) => page.locator('.stage-frame canvas')
const waitForSeed = (page: Page, seed: number | string) => expect(canvas(page)).toHaveAttribute('data-seed', String(seed))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForSeed(page, presets[0].seed)
})

test('generar, deshacer, rehacer y restaurar la sesión local', async ({ page }) => {
  const first = await canvas(page).getAttribute('data-seed')
  await page.getByRole('button', { name: 'Generar', exact: true }).click()
  await expect(canvas(page)).not.toHaveAttribute('data-seed', first!)
  const second = await canvas(page).getAttribute('data-seed')
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await waitForSeed(page, first!)
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click()
  await waitForSeed(page, second!)
  await page.keyboard.press('Control+z')
  await waitForSeed(page, first!)
  await page.getByRole('button', { name: 'Nueva variante', exact: true }).click()
  await expect(canvas(page)).not.toHaveAttribute('data-seed', first!)
  const third = await canvas(page).getAttribute('data-seed')
  await page.reload()
  await waitForSeed(page, third!)
  await page.getByRole('button', { name: 'Sorpréndeme' }).click()
  await expect(page.getByRole('img', { name: title('Seda líquida') })).toHaveCount(0)
})

test('familias, modo Estudio y simetría según compatibilidad', async ({ page }) => {
  await page.getByRole('button', { name: 'Espejo', exact: true }).click()
  const slider = page.getByRole('slider', { name: 'Complejidad' })
  await slider.focus()
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('0.57')
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(slider).toHaveValue('0.56')
  await expect(page.getByRole('slider', { name: 'Corriente' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Estudio', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Corriente' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Simetría' }).selectOption('radial')
  await expect(page.getByRole('slider', { name: 'Orden radial' })).toBeVisible()
  await page.getByRole('button', { name: 'Experimental', exact: true }).click()
  await expect(page.getByRole('img', { name: title('Risografía') })).toBeVisible()
  await expect(page.getByRole('option', { name: /Radial/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Ver estilos de Experimental' }).click()
  await page.getByRole('button', { name: 'Fractura', exact: true }).click()
  await expect(page.getByRole('img', { name: title('Fractura') })).toBeVisible()
  await page.getByRole('button', { name: 'Op Art', exact: true }).click()
  await expect(page.getByText('Patrón óptico intenso')).toBeVisible()
})

test('los ajustes actualizan una miniatura y Deshacer conserva más de tres pasos', async ({ page }) => {
  const cards = page.getByRole('tabpanel').locator('.film-item')
  await expect(cards).toHaveCount(3)
  const titles = await cards.locator('.film-open').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('title')))
  const slider = page.getByRole('slider', { name: 'Complejidad' })
  for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveValue('0.61')
  expect(await cards.locator('.film-open').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('title')))).toEqual(titles)
  await expect(cards.first().locator('.film-open')).toHaveAttribute('aria-pressed', 'true')

  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(slider).toHaveValue('0.56')
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click()
  await expect(slider).toHaveValue('0.57')
  await page.getByRole('button', { name: 'Guardar favorito', exact: true }).click()

  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Generar', exact: true }).click()
  await expect(cards).toHaveCount(3)
  const recentTitles = await cards.locator('.film-open').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('title')))
  expect(new Set(recentTitles).size).toBe(3)
  expect(recentTitles).not.toContain(titles[0])
  await page.reload()
  await expect(cards).toHaveCount(3)
  await page.getByRole('tab', { name: 'Favoritos' }).click()
  await expect(cards).toHaveCount(1)
})

test('reduce el historial anterior a tres semillas distintas y conserva la biblioteca', async ({ page }) => {
  const [current, other, third, fourth] = presets
  const history = [
    ...Array.from({ length: 32 }, (_, index) => ({ ...current, complexity: 0.5 - index / 100 })),
    other, third, fourth, { ...current, seed: 5 },
  ]
  const library = { schema: 1, favorites: [fourth], saved: [{ name: 'Creación guardada', recipe: third }], palettes: [] }
  await page.evaluate((session) => localStorage.setItem('forma-studio.v1', JSON.stringify(session)),
    { recipe: current, history, library, mode: 'simple' })
  await page.reload()
  await waitForSeed(page, current.seed)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('forma-studio.v1')!))
  expect(saved.history).toEqual([history[0], other, third])
  expect(saved.recipe).toEqual(current)
  expect(saved.library).toEqual(library)
})

test('variantes, comparar y favoritos', async ({ page }) => {
  await page.getByRole('tab', { name: 'Variantes' }).click()
  await page.getByRole('button', { name: 'Mutar composición' }).click()
  const cards = page.getByRole('tabpanel').locator('.film-item')
  await expect(cards).toHaveCount(4)
  await page.getByRole('combobox', { name: 'Cantidad' }).selectOption('9')
  await page.getByRole('button', { name: 'Mutar composición' }).click()
  await expect(cards).toHaveCount(9)
  await cards.first().getByRole('button', { name: 'Seda líquida', exact: true }).click()
  await expect(canvas(page)).not.toHaveAttribute('data-seed', String(presets[0].seed))
  await page.getByRole('button', { name: 'Guardar favorito' }).click()
  await page.getByRole('tab', { name: 'Favoritos' }).click()
  await expect(cards).toHaveCount(1)
  await page.getByRole('button', { name: 'Comparar composiciones', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Usar esta composición' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('explora geometría y conserva la figura elegida al variar y recargar', async ({ page }) => {
  await page.getByRole('button', { name: 'Geometría', exact: true }).click()
  for (const name of ['Arcadas', 'Facetas', 'Cubos isométricos', 'Cintas Truchet', 'Figuras', 'Módulos']) {
    await page.getByRole('button', { name: 'Explorar', exact: true }).click()
    await expect(page.getByRole('img', { name: title(name) })).toBeVisible()
  }

  await page.getByRole('button', { name: 'Ver estilos de Geometría' }).click()
  await page.getByRole('complementary', { name: 'Biblioteca de estilos' })
    .getByRole('button', { name: 'Figuras', exact: true }).click()
  const figure = page.getByRole('combobox', { name: 'Figura', exact: true })
  await figure.selectOption({ label: 'Hexágono' })
  await page.getByRole('combobox', { name: 'Proporción del lienzo' }).selectOption('9:16')
  await waitForSeed(page, presets.find((preset) => preset.generator === 'silhouettes')!.seed)
  await page.getByRole('button', { name: 'Nueva variante' }).click()
  await expect(figure).toHaveValue('3')
  await page.reload()
  await expect(figure).toHaveValue('3')
  await expect(page.getByRole('combobox', { name: 'Proporción del lienzo' })).toHaveValue('9:16')
})

test('paletas personalizadas, recarga de recetas e importación de biblioteca', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar paleta Brasa' }).click()
  await page.getByRole('button', { name: 'Bloquear color 1', exact: true }).click()
  await page.getByRole('button', { name: 'Regenerar colores' }).click()
  await expect(page.getByRole('textbox', { name: 'Color HEX 1' })).toHaveValue('#140C18')
  const hex = page.getByRole('textbox', { name: 'Color HEX 2' })
  await hex.fill('#224488')
  await hex.press('Enter')
  await expect(hex).toHaveValue('#224488')
  await page.getByRole('textbox', { name: 'Nombre de paleta personalizada' }).fill('Ocre personal')
  await page.getByRole('button', { name: 'Guardar paleta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ocre personal', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Mis recetas' }).click()
  await page.getByRole('textbox', { name: 'Nombre de receta' }).fill('Mi composición')
  await page.getByRole('button', { name: 'Guardar receta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mi composición', exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar biblioteca' }).click()
  const download = await downloadPromise
  const library = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(library.palettes[0].colors[1]).toBe('#224488')
  expect(library.saved[0].name).toBe('Mi composición')
  const input = page.locator('input[type=file]')
  await input.setInputFiles({ name: 'incompatible.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":2}') })
  await expect(page.getByRole('alert')).toContainText('Formato de biblioteca incompatible')
  await input.setInputFiles({ name: 'roseton.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(presets[3])) })
  await expect(page.getByRole('img', { name: title('Rosetón') })).toBeVisible()
  await waitForSeed(page, presets[3].seed)
  await page.getByRole('button', { name: 'Mis recetas' }).click()
  await input.setInputFiles({
    name: 'biblioteca.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schema: 1, favorites: [presets[5]], saved: [{ name: 'Importada', recipe: presets[5] }], palettes: [] })),
  })
  await expect(page.getByRole('button', { name: 'Importada', exact: true })).toBeVisible()
})

for (const image of [
  { format: 'image/png', extension: 'png', width: 327, height: 219, bytes: '89504e470d0a1a0a' },
  { format: 'image/jpeg', extension: 'jpg', width: 1663, height: 714, bytes: 'ffd8ff' },
  { format: 'image/webp', extension: 'webp', width: 481, height: 322, bytes: '52494646' },
]) {
  test('exporta ' + image.extension + ' válido a dimensiones finales', async ({ page }) => {
    await page.getByRole('button', { name: 'Exportar', exact: true }).click()
    await page.getByRole('combobox', { name: 'Formato' }).selectOption(image.format)
    await page.getByRole('combobox', { name: 'Resolución' }).selectOption('custom')
    await page.getByRole('spinbutton', { name: 'Ancho (px)' }).fill(String(image.width))
    await page.getByRole('spinbutton', { name: 'Alto (px)' }).fill(String(image.height))
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar' }).click()
    const download = await pending
    const path = await download.path()
    expect(download.suggestedFilename()).toMatch(new RegExp(image.width + 'x' + image.height + '\\.' + image.extension + '$'))
    const content = await readFile(path!)
    expect(content.subarray(0, image.bytes.length / 2).toString('hex')).toBe(image.bytes)
    const dimensions = await page.evaluate(async ({ content, type }) => {
      const blob = new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))], { type })
      const bitmap = await createImageBitmap(blob)
      const dimensions = [bitmap.width, bitmap.height]
      bitmap.close()
      return dimensions
    }, { content: content.toString('base64'), type: image.format })
    expect(dimensions).toEqual([image.width, image.height])
  })
}

test('exportación UHD 8K con cancelación y segundo intento', async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.getByRole('combobox', { name: 'Proporción del lienzo' }).selectOption('16:9')
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await page.getByRole('combobox', { name: 'Resolución' }).selectOption('4320')
  await expect(page.getByRole('spinbutton', { name: 'Ancho (px)' })).toHaveValue('7680')
  const downloads: string[] = []
  page.on('download', (file) => { downloads.push(file.suggestedFilename()) })
  const button = page.getByRole('button', { name: 'Descargar' })
  await button.click()
  await page.getByRole('button', { name: 'Cancelar renderizado' }).click()
  await expect(button).toBeEnabled()
  const started = performance.now()
  const pending = page.waitForEvent('download')
  await button.click()
  const file = await pending
  const duration = Math.round(performance.now() - started)
  const content = await readFile((await file.path())!)
  expect(downloads).toEqual([file.suggestedFilename()])
  expect(content.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect([content.readUInt32BE(16), content.readUInt32BE(20)]).toEqual([7680, 4320])
  expect(content.subarray(-8, -4).toString('ascii')).toBe('IEND')
  await writeFile(info.outputPath('exportacion-8k.json'), JSON.stringify({ duration, bytes: content.length }) + '\n')
})

test('recupera el contexto WebGL perdido y mantiene Canvas 2D disponible', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, contextType: string, ...options: unknown[]) {
        const context = Reflect.apply(getContext, this, [contextType, ...options])
        if (contextType === 'webgl2' && context) Object.assign(window, { formaPreviewContext: context })
        return context
      },
    })
  })
  await page.reload()
  await expect(canvas(page)).toHaveAttribute('data-backend', 'WebGL2')
  await page.evaluate(async () => {
    const gl = (window as unknown as { formaPreviewContext: WebGL2RenderingContext }).formaPreviewContext
    const ext = gl.getExtension('WEBGL_lose_context')
    if (!ext) throw new Error('WEBGL_lose_context ausente')
    const event = new Promise<void>((resolve) => gl.canvas.addEventListener('webglcontextlost', () => resolve(), { once: true }))
    ext.loseContext()
    await event
    Object.assign(window, { restoreFormaContext: () => ext.restoreContext() })
  })
  await expect(canvas(page)).toHaveAttribute('data-backend', 'Canvas 2D')
  await page.evaluate(() => (window as unknown as { restoreFormaContext: () => void }).restoreFormaContext())
  await expect(canvas(page)).toHaveAttribute('data-backend', 'WebGL2')
})

test('flujo adaptable sin desbordamiento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await expect(canvas(page)).toBeInViewport()
  await page.getByRole('combobox', { name: 'Proporción del lienzo' }).selectOption('9:16')
  await expect.poll(() => canvas(page).evaluate((node) => (node as HTMLCanvasElement).height / (node as HTMLCanvasElement).width)).toBeGreaterThan(1.7)
  await page.getByRole('button', { name: 'Generar', exact: true }).click()
  await expect(canvas(page)).not.toHaveAttribute('data-seed', String(presets[0].seed))
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeInViewport()
})

test('los estilos cromáticos se abren desde la biblioteca y usan WebGL2', async ({ page }) => {
  for (const [family, styles] of [
    ['Fluidos', ['Cintas de luz', 'Nácar', 'Relieve espectral']],
    ['Gradientes', ['Difusión de color']],
  ] as const) {
    await page.getByRole('button', { name: `Ver estilos de ${family}`, exact: true }).click()
    for (const name of styles) {
      await page.getByRole('button', { name, exact: true }).click()
      const recipe = presets.find((item) => generatorById.get(item.generator)?.name === name)!
      await waitForSeed(page, recipe.seed)
      await expect(canvas(page)).toHaveAttribute('data-backend', 'WebGL2')
    }
  }
})

test('galería, estadísticas y comparación de tiles @gallery', async ({ page, browser }, info) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1480, height: 920 })
  await expect(canvas(page)).toHaveAttribute('data-backend', 'WebGL2')
  await page.screenshot({ path: info.outputPath('estudio.png'), animations: 'disabled' })
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await mobile.goto(new URL('/', page.url()).href)
    await waitForSeed(mobile, presets[0].seed)
    await mobile.screenshot({ path: info.outputPath('movil.png'), animations: 'disabled' })
    await mobile.locator('.settings').evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await mobile.screenshot({ path: info.outputPath('movil-ajustes.png'), animations: 'disabled' })
  } finally {
    await mobile.close()
  }
  await page.setViewportSize({ width: 1470, height: 1000 })
  const stats = await page.evaluate(async ([renderUrl, presetUrl, registryUrl]) => {
    const { Renderer, fullTile } = await import(renderUrl) as typeof import('../src/engine/render')
    const { aspectRatio, presets, mutate } = await import(presetUrl) as typeof import('../src/presets/recipes')
    const { generatorById } = await import(registryUrl) as typeof import('../src/generators')
    const renderer = new Renderer(document.createElement('canvas'))
    const metrics: { generator: string; backend: string; ms: number; deviation: number }[] = []
    const title = document.createElement('h1')
    title.textContent = 'FORMA · Galería de semillas'
    title.style.cssText = 'font-size:23px;margin:0 0 18px'
    const gallery = document.createElement('div')
    gallery.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:13px'
    document.body.replaceChildren(title, gallery)
    document.body.style.cssText = 'padding:16px;background:#19191b'
    for (const preset of presets) {
      const group = document.createElement('section')
      group.style.cssText = 'padding:9px;border:1px solid #353536;border-radius:5px'
      group.dataset.generator = preset.generator
      const heading = document.createElement('h2')
      heading.style.cssText = 'font-size:14px;margin:0 0 7px'
      const generator = generatorById.get(preset.generator)!
      heading.textContent = generator.name + ' · ' + generator.family
      group.append(heading)
      const galleryRow = document.createElement('div')
      galleryRow.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:7px;align-items:start'
      const layouts = ['3:2', '16:9', '21:9', '9:16', '1:1'] as const
      const recipes = [preset, ...mutate(preset, 1084238715, 4)]
      for (const [index, base] of recipes.entries()) {
        const recipe = { ...base, aspect: layouts[index] }
        const canvas = document.createElement('canvas')
        const ratio = aspectRatio(recipe)
        canvas.width = Math.round(480 * Math.min(1, ratio))
        canvas.height = Math.round(480 * Math.min(1, 1 / ratio))
        canvas.style.cssText = 'width:100%;display:block'
        const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!
        const start = performance.now()
        const backend = renderer.draw(recipe, fullTile(canvas.width, canvas.height), ctx)
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const ms = performance.now() - start
        let sum = 0
        let squareSum = 0
        let count = 0
        for (let i = 0; i < px.length; i += 32) {
          const luma = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
          sum += luma
          squareSum += luma * luma
          count++
        }
        metrics.push({ generator: recipe.generator, backend, ms, deviation: Math.sqrt(squareSum / count - (sum / count) ** 2) })
        const card = document.createElement('figure')
        card.style.margin = '0'
        const label = document.createElement('figcaption')
        label.style.cssText = 'font:10px monospace;color:#bbb;margin-top:4px'
        label.textContent = `${recipe.aspect} · ${recipe.seed}`
        card.append(canvas, label)
        galleryRow.append(card)
      }
      group.append(galleryRow)
      gallery.append(group)
    }
    const c = document.createElement('canvas')
    c.width = 241
    c.height = 173
    const ctx = c.getContext('2d', { alpha: false, willReadFrequently: true })!
    renderer.draw(presets[0], fullTile(241, 173), ctx)
    const before = ctx.getImageData(0, 0, 241, 173).data
    renderer.draw(presets[0], { width: 111, height: 132, x: 82, y: 24, fullWidth: 241, fullHeight: 173 }, ctx, 82, 24)
    const after = ctx.getImageData(0, 0, 241, 173).data
    let mismatch = 0
    for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 1) mismatch++
    renderer.dispose()
    return { metrics, mismatch }
  }, ['/src/engine/render.ts', '/src/presets/recipes.ts', '/src/generators/index.ts'])
  await page.screenshot({ path: info.outputPath('galeria.png'), fullPage: true, animations: 'disabled' })
  for (const id of ['ribbons', 'nacre', 'diffuse', 'spectral']) {
    const dataUrl = await page.locator(`[data-generator="${id}"] canvas`).first().evaluate((node: HTMLCanvasElement) => node.toDataURL('image/png'))
    await writeFile(info.outputPath(`${id}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))
  }
  await writeFile(info.outputPath('metricas.json'), JSON.stringify(stats, null, 2) + '\n')
  expect(stats.metrics).toHaveLength(presets.length * 5)
  expect(stats.metrics.filter((item) => item.backend !== 'WebGL2')).toEqual([])
  expect(stats.metrics.filter((item) => item.deviation < 8)).toEqual([])
  expect(stats.mismatch).toBe(0)
})
