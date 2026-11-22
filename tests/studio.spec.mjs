import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
const reference = JSON.parse(readFileSync(new URL("../rust/core/tests/data/reference.json", import.meta.url), "utf8"));
const presets = reference.filter((_, index) => index % 3 === 0).map((item) => item.recipe);
const title = (name) => "Composición " + name;
const canvas = (page) => page.locator(".stage-frame canvas");
const waitForSeed = (page, seed) => expect(canvas(page)).toHaveAttribute("data-seed", String(seed));
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForSeed(page, presets[0].seed);
});
test("generar, deshacer, rehacer y restaurar la sesión local", async ({ page }) => {
  const first = await canvas(page).getAttribute("data-seed");
  await page.getByRole("button", { name: "Generar", exact: true }).click();
  await expect(canvas(page)).not.toHaveAttribute("data-seed", first);
  const second = await canvas(page).getAttribute("data-seed");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await waitForSeed(page, first);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await waitForSeed(page, second);
  await page.keyboard.press("Control+z");
  await waitForSeed(page, first);
  await page.getByRole("button", { name: "Nueva variante", exact: true }).click();
  await expect(canvas(page)).not.toHaveAttribute("data-seed", first);
  const third = await canvas(page).getAttribute("data-seed");
  await page.reload();
  await waitForSeed(page, third);
  await page.getByRole("button", { name: "Sorpréndeme" }).click();
  await expect(page.getByRole("img", { name: title("Seda líquida") })).toHaveCount(0);
});
test("familias, modo Estudio y simetría según compatibilidad", async ({ page }) => {
  await page.getByRole("button", { name: "Espejo", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Complejidad" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("0.57");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(slider).toHaveValue("0.56");
  await expect(page.getByRole("slider", { name: "Corriente" })).toHaveCount(0);
  await page.getByRole("button", { name: "Estudio", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Corriente" })).toBeVisible();
  await page.getByRole("combobox", { name: "Simetría" }).selectOption("radial");
  await expect(page.getByRole("slider", { name: "Orden radial" })).toBeVisible();
  await page.getByRole("button", { name: "Experimental", exact: true }).click();
  await expect(page.getByRole("img", { name: title("Risografía") })).toBeVisible();
  await expect(page.getByRole("option", { name: /Radial/ })).toBeDisabled();
  await page.getByRole("button", { name: "Ver estilos de Experimental" }).click();
  await page.getByRole("button", { name: "Fractura", exact: true }).click();
  await expect(page.getByRole("img", { name: title("Fractura") })).toBeVisible();
  await page.getByRole("button", { name: "Op Art", exact: true }).click();
  await expect(page.getByText("Patrón óptico intenso")).toBeVisible();
});
test("los ajustes actualizan una miniatura y Deshacer conserva más de tres pasos", async ({ page }) => {
  const cards = page.getByRole("tabpanel").locator(".film-item");
  await expect(cards).toHaveCount(3);
  const titles = await cards.locator(".film-open").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title")));
  const slider = page.getByRole("slider", { name: "Complejidad" });
  for (let i = 0; i < 5; i++) await slider.press("ArrowRight");
  await expect(slider).toHaveValue("0.61");
  expect(await cards.locator(".film-open").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title")))).toEqual(titles);
  await expect(cards.first().locator(".film-open")).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(slider).toHaveValue("0.56");
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(slider).toHaveValue("0.57");
  await page.getByRole("button", { name: "Guardar favorito", exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Generar", exact: true }).click();
  await expect(cards).toHaveCount(3);
  const recentTitles = await cards.locator(".film-open").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title")));
  expect(new Set(recentTitles).size).toBe(3);
  expect(recentTitles).not.toContain(titles[0]);
  await page.reload();
  await expect(cards).toHaveCount(3);
  await page.getByRole("tab", { name: "Favoritos" }).click();
  await expect(cards).toHaveCount(1);
});
test("reduce el historial anterior a tres semillas distintas y conserva la biblioteca", async ({ page }) => {
  const [current, other, third, fourth] = presets;
  const history = [
    ...Array.from({ length: 32 }, (_, index) => ({ ...current, complexity: 0.5 - index / 100 })),
    other,
    third,
    fourth,
    { ...current, seed: 5 }
  ];
  const library = { schema: 1, favorites: [fourth], saved: [{ name: "Creación guardada", recipe: third }], palettes: [] };
  await page.evaluate(
    (session) => localStorage.setItem("forma-studio.v1", JSON.stringify(session)),
    { recipe: current, history, library, mode: "simple" }
  );
  await page.reload();
  await waitForSeed(page, current.seed);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("forma-studio.v1")));
  expect(saved.history).toEqual([history[0], other, third]);
  expect(saved.recipe).toEqual(current);
  expect(saved.library).toEqual(library);
});
test("variantes, comparar y favoritos", async ({ page }) => {
  await page.getByRole("tab", { name: "Variantes" }).click();
  await page.getByRole("button", { name: "Mutar composición" }).click();
  const cards = page.getByRole("tabpanel").locator(".film-item");
  await expect(cards).toHaveCount(4);
  await page.getByRole("combobox", { name: "Cantidad" }).selectOption("9");
  await page.getByRole("button", { name: "Mutar composición" }).click();
  await expect(cards).toHaveCount(9);
  await cards.first().getByRole("button", { name: "Seda líquida", exact: true }).click();
  await expect(canvas(page)).not.toHaveAttribute("data-seed", String(presets[0].seed));
  await page.getByRole("button", { name: "Guardar favorito" }).click();
  await page.getByRole("tab", { name: "Favoritos" }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole("button", { name: "Comparar composiciones", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("img")).toHaveCount(2);
  await page.getByRole("button", { name: "Usar esta composición" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("explora geometría y conserva la figura elegida al variar y recargar", async ({ page }) => {
  await page.getByRole("button", { name: "Geometría", exact: true }).click();
  for (const name of ["Arcadas", "Facetas", "Cubos isométricos", "Cintas Truchet", "Figuras", "Módulos"]) {
    await page.getByRole("button", { name: "Explorar", exact: true }).click();
    await expect(page.getByRole("img", { name: title(name) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Ver estilos de Geometría" }).click();
  await page.getByRole("complementary", { name: "Biblioteca de estilos" }).getByRole("button", { name: "Figuras", exact: true }).click();
  const figure = page.getByRole("combobox", { name: "Figura", exact: true });
  await figure.selectOption({ label: "Hexágono" });
  await page.getByRole("combobox", { name: "Proporción del lienzo" }).selectOption("9:16");
  await waitForSeed(page, presets.find((preset) => preset.generator === "silhouettes").seed);
  await page.getByRole("button", { name: "Nueva variante" }).click();
  await expect(figure).toHaveValue("3");
  await page.reload();
  await expect(figure).toHaveValue("3");
  await expect(page.getByRole("combobox", { name: "Proporción del lienzo" })).toHaveValue("9:16");
});
test("paletas personalizadas, recarga de recetas e importación de biblioteca", async ({ page }) => {
  await page.getByRole("button", { name: "Editar paleta Brasa" }).click();
  await page.getByRole("button", { name: "Bloquear color 1", exact: true }).click();
  await page.getByRole("button", { name: "Regenerar colores" }).click();
  await expect(page.getByRole("textbox", { name: "Color HEX 1" })).toHaveValue("#140C18");
  const hex = page.getByRole("textbox", { name: "Color HEX 2" });
  await hex.fill("#224488");
  await hex.press("Enter");
  await expect(hex).toHaveValue("#224488");
  await page.getByRole("textbox", { name: "Nombre de paleta personalizada" }).fill("Ocre personal");
  await page.getByRole("button", { name: "Guardar paleta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ocre personal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Mis recetas" }).click();
  await page.getByRole("textbox", { name: "Nombre de receta" }).fill("Mi composición");
  await page.getByRole("button", { name: "Guardar receta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mi composición", exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar biblioteca" }).click();
  const download = await downloadPromise;
  const library = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(library.palettes[0].colors[1]).toBe("#224488");
  expect(library.saved[0].name).toBe("Mi composición");
  const input = page.locator("input[type=file]");
  await input.setInputFiles({ name: "incompatible.json", mimeType: "application/json", buffer: Buffer.from('{"schema":2}') });
  await expect(page.getByRole("alert")).toContainText("Formato de biblioteca incompatible");
  await input.setInputFiles({ name: "roseton.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(presets[3])) });
  await expect(page.getByRole("img", { name: title("Rosetón") })).toBeVisible();
  await waitForSeed(page, presets[3].seed);
  await page.getByRole("button", { name: "Mis recetas" }).click();
  await input.setInputFiles({
    name: "biblioteca.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schema: 1, favorites: [presets[5]], saved: [{ name: "Importada", recipe: presets[5] }], palettes: [] }))
  });
  await expect(page.getByRole("button", { name: "Importada", exact: true })).toBeVisible();
});
for (const image of [
  { format: "image/png", extension: "png", width: 327, height: 219, bytes: "89504e470d0a1a0a" },
  { format: "image/jpeg", extension: "jpg", width: 1663, height: 714, bytes: "ffd8ff" },
  { format: "image/webp", extension: "webp", width: 481, height: 322, bytes: "52494646" }
]) {
  test("exporta " + image.extension + " válido a dimensiones finales", async ({ page }) => {
    if (image.extension === "png") {
      await page.addInitScript(() => {
        globalThis.formaWorkerMessages = [];
        const BrowserWorker = globalThis.Worker;
        globalThis.Worker = class extends BrowserWorker {
          constructor(...args) {
            super(...args);
            this.addEventListener("message", (event) => globalThis.formaWorkerMessages.push(event.data[0]));
          }
        };
      });
      await page.reload();
      await waitForSeed(page, presets[0].seed);
    }
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    await page.getByRole("combobox", { name: "Formato" }).selectOption(image.format);
    await page.getByRole("combobox", { name: "Resolución" }).selectOption("custom");
    await page.getByRole("spinbutton", { name: "Ancho (px)" }).fill(String(image.width));
    await page.getByRole("spinbutton", { name: "Alto (px)" }).fill(String(image.height));
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar" }).click();
    const download = await pending;
    const path = await download.path();
    expect(download.suggestedFilename()).toMatch(new RegExp(image.width + "x" + image.height + "\\." + image.extension + "$"));
    const content = await readFile(path);
    expect(content.subarray(0, image.bytes.length / 2).toString("hex")).toBe(image.bytes);
    const dimensions = await page.evaluate(async ({ content: content2, type }) => {
      const blob = new Blob([Uint8Array.from(atob(content2), (c) => c.charCodeAt(0))], { type });
      const bitmap = await createImageBitmap(blob);
      const dimensions2 = [bitmap.width, bitmap.height];
      bitmap.close();
      return dimensions2;
    }, { content: content.toString("base64"), type: image.format });
    expect(dimensions).toEqual([image.width, image.height]);
    if (image.extension === "png") {
      expect(await page.evaluate(() => globalThis.formaWorkerMessages)).toEqual(expect.arrayContaining(["ready", "progress", "done"]));
    }
  });
}
test("exportación UHD 8K con cancelación y segundo intento", async ({ page }, info) => {
  test.setTimeout(6e4);
  await page.getByRole("combobox", { name: "Proporción del lienzo" }).selectOption("16:9");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await page.getByRole("combobox", { name: "Resolución" }).selectOption("4320");
  await expect(page.getByRole("spinbutton", { name: "Ancho (px)" })).toHaveValue("7680");
  const downloads = [];
  page.on("download", (file2) => {
    downloads.push(file2.suggestedFilename());
  });
  const button = page.getByRole("button", { name: "Descargar" });
  await button.click();
  await page.getByRole("button", { name: "Cancelar renderizado" }).click();
  await expect(button).toBeEnabled();
  const started = performance.now();
  const pending = page.waitForEvent("download");
  await button.click();
  const file = await pending;
  const duration = Math.round(performance.now() - started);
  const content = await readFile(await file.path());
  expect(downloads).toEqual([file.suggestedFilename()]);
  expect(content.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect([content.readUInt32BE(16), content.readUInt32BE(20)]).toEqual([7680, 4320]);
  expect(content.subarray(-8, -4).toString("ascii")).toBe("IEND");
  await writeFile(info.outputPath("exportacion-8k.json"), JSON.stringify({ duration, bytes: content.length }) + "\n");
});
test("recupera el contexto WebGL perdido y mantiene Canvas 2D disponible", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function(contextType, ...options) {
        const context = Reflect.apply(getContext, this, [contextType, ...options]);
        if (contextType === "webgl2" && context) Object.assign(window, { formaPreviewContext: context });
        return context;
      }
    });
  });
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-backend", "WebGL2");
  await page.evaluate(async () => {
    const gl = window.formaPreviewContext;
    const ext = gl.getExtension("WEBGL_lose_context");
    if (!ext) throw new Error("WEBGL_lose_context ausente");
    const event = new Promise((resolve) => gl.canvas.addEventListener("webglcontextlost", () => resolve(), { once: true }));
    ext.loseContext();
    await event;
    Object.assign(window, { restoreFormaContext: () => ext.restoreContext() });
  });
  await expect(canvas(page)).toHaveAttribute("data-backend", "Canvas 2D");
  await page.evaluate(() => window.restoreFormaContext());
  await expect(canvas(page)).toHaveAttribute("data-backend", "WebGL2");
});
test("flujo adaptable sin desbordamiento horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(canvas(page)).toBeInViewport();
  await page.getByRole("combobox", { name: "Proporción del lienzo" }).selectOption("9:16");
  await expect.poll(() => canvas(page).evaluate((node) => node.height / node.width)).toBeGreaterThan(1.7);
  await page.getByRole("button", { name: "Generar", exact: true }).click();
  await expect(canvas(page)).not.toHaveAttribute("data-seed", String(presets[0].seed));
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeInViewport();
});
test("los estilos cromáticos se abren desde la biblioteca y usan WebGL2", async ({ page }) => {
  for (const [family, styles] of [
    ["Fluidos", [["Cintas de luz", "ribbons"], ["Nácar", "nacre"], ["Relieve espectral", "spectral"]]],
    ["Gradientes", [["Difusión de color", "diffuse"]]]
  ]) {
    await page.getByRole("button", { name: `Ver estilos de ${family}`, exact: true }).click();
    for (const [name, id] of styles) {
      await page.getByRole("button", { name, exact: true }).click();
      const recipe = presets.find((item) => item.generator === id);
      await waitForSeed(page, recipe.seed);
      await expect(canvas(page)).toHaveAttribute("data-backend", "WebGL2");
    }
  }
});
test("galería de los 22 generadores en WebAssembly y WebGL2 @gallery", async ({ page, browser }, info) => {
  test.setTimeout(12e4);
  await page.setViewportSize({ width: 1480, height: 920 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "WebGL2");
  await page.screenshot({ path: info.outputPath("estudio.png"), animations: "disabled" });
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.screenshot({ path: info.outputPath("github-social.png"), animations: "disabled" });
  await page.setViewportSize({ width: 1480, height: 920 });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await mobile.goto(page.url());
    await waitForSeed(mobile, presets[0].seed);
    await mobile.screenshot({ path: info.outputPath("movil.png"), animations: "disabled" });
    await mobile.locator(".settings").evaluate((element) => element.scrollIntoView({ block: "start" }));
    await mobile.screenshot({ path: info.outputPath("movil-ajustes.png"), animations: "disabled" });
  } finally {
    await mobile.close();
  }
  const rendered = new Set();
  const families = ["Gradientes", "Fluidos", "Geometría", "Simetría", "Op Art", "Orgánicos", "Experimental"];
  for (const family of families) {
    const submenu = page.getByRole("button", { name: "Ver estilos de " + family, exact: true });
    if (await submenu.count()) await submenu.click();
    const rows = page.getByRole("button", { name: family, exact: true }).locator("../..");
    const styles = rows.locator("[data-action=preset]");
    for (const style of await styles.all()) {
      const id = await style.getAttribute("data-value");
      await style.click();
      await expect(canvas(page)).toHaveAttribute("data-generator", id);
      await expect(canvas(page)).toHaveAttribute("data-backend", "WebGL2");
      rendered.add(id);
      if (["ribbons", "nacre", "diffuse", "spectral"].includes(id)) {
        const data = await canvas(page).evaluate((element) => element.toDataURL());
        await writeFile(info.outputPath(id + ".png"), Buffer.from(data.split(",")[1], "base64"));
      }
    }
    if (!await styles.count()) {
      await page.getByRole("button", { name: family, exact: true }).click();
      const id = await canvas(page).getAttribute("data-generator");
      await expect(canvas(page)).toHaveAttribute("data-backend", "WebGL2");
      rendered.add(id);
    }
  }
  expect(rendered).toEqual(new Set(presets.map((item) => item.generator)));
});
