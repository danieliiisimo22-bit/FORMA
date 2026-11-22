mod dialogs;
mod export;
mod icons;
mod render;
mod settings;
mod view;

use forma_core::color::{PALETTES, PERSONALITIES, extract_colors, generate_colors, valid_hex};
use forma_core::generator::{self, FAMILIES, GENERATORS};
use forma_core::recipe::Recipe;
use forma_core::render::{INVALID_SIZE, Scene, Tile, resolution};
use forma_core::studio::{Import, Library, STORAGE_KEY, Studio, parse_import};
use js_sys::{Array, Reflect};
use render::{Output, Renderer, Surface, error};
use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use wasm_bindgen::{JsCast, JsValue, closure::Closure, prelude::wasm_bindgen};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{
    Blob, Document, Element, Event, EventTarget, HtmlCanvasElement, HtmlDialogElement, HtmlElement,
    HtmlInputElement, HtmlSelectElement, ImageData, KeyboardEvent, MessageEvent, Window, Worker,
    WorkerOptions, WorkerType,
};

thread_local! { static APP: RefCell<Option<App>> = const { RefCell::new(None) }; }

pub fn window() -> Window {
    web_sys::window().expect("FORMA window")
}

fn with_app(work: impl FnOnce(&mut App)) {
    APP.with(|slot| {
        if let Ok(mut slot) = slot.try_borrow_mut()
            && let Some(app) = slot.as_mut()
        {
            work(app);
        }
    });
}

fn seed() -> u32 {
    let mut word = [0; 4];
    window()
        .crypto()
        .and_then(|crypto| crypto.get_random_values_with_u8_array(&mut word))
        .ok();
    u32::from_le_bytes(word)
}

#[derive(Clone, Copy, PartialEq)]
enum Dialog {
    Palette,
    Library,
    Export,
    Compare,
    Aspect,
    Help,
}

impl Dialog {
    fn from_name(name: &str) -> Option<Self> {
        match name {
            "palette" => Some(Self::Palette),
            "library" => Some(Self::Library),
            "export" => Some(Self::Export),
            "compare" => Some(Self::Compare),
            "aspect" => Some(Self::Aspect),
            "help" => Some(Self::Help),
            _ => None,
        }
    }
}

struct ExportOptions {
    format: String,
    size: String,
    width: String,
    height: String,
    quality: f64,
}

impl ExportOptions {
    fn new(recipe: &Recipe) -> Self {
        let [width, height] = resolution(recipe, 1080);
        Self {
            format: "image/png".into(),
            size: "1080".into(),
            width: width.to_string(),
            height: height.to_string(),
            quality: 0.94,
        }
    }
}

struct ExportWorker {
    worker: Worker,
    _message: Closure<dyn Fn(MessageEvent)>,
    _error: Closure<dyn Fn(Event)>,
}

impl Drop for ExportWorker {
    fn drop(&mut self) {
        self.worker.set_onmessage(None);
        self.worker.set_onerror(None);
        self.worker.terminate();
    }
}

struct App {
    document: Document,
    root: Element,
    store: Studio,
    expanded: BTreeSet<usize>,
    tab: String,
    variant_count: usize,
    variants: Vec<Recipe>,
    focus: bool,
    zoom: f64,
    dialog: Option<Dialog>,
    error: String,
    notice: String,
    notice_id: i32,
    palette_query: String,
    compare_index: usize,
    aspect_fields: [String; 2],
    export_options: ExportOptions,
    progress: Option<(f64, String)>,
    job_id: u64,
    worker: Option<ExportWorker>,
    renderer: Renderer,
    thumbnails: HashMap<String, ImageData>,
}

impl App {
    fn visible(&self) -> &[Recipe] {
        match self.tab.as_str() {
            "variants" => &self.variants,
            "favorites" => &self.store.session.library.favorites,
            _ => &self.store.session.history,
        }
    }

    fn compare_candidates(&self) -> Vec<&Recipe> {
        let mut candidates = Vec::new();
        for recipe in self
            .visible()
            .iter()
            .chain(&self.store.session.history)
            .chain(&self.store.session.library.favorites)
            .chain(&self.variants)
        {
            if recipe != self.store.recipe() && !candidates.contains(&recipe) {
                candidates.push(recipe);
            }
        }
        candidates
    }

    fn persist(&mut self) {
        self.store.storage_warning = serde_json::to_string(&self.store.session)
            .ok()
            .and_then(|data| {
                window()
                    .local_storage()
                    .ok()
                    .flatten()
                    .map(|storage| storage.set_item(STORAGE_KEY, &data))
            })
            .is_none_or(|result| result.is_err());
    }

    fn notify(&mut self, message: impl Into<String>) {
        self.notice = message.into();
        window().clear_timeout_with_handle(self.notice_id);
        let hide = Closure::once_into_js(move || {
            with_app(|app| {
                app.notice.clear();
                for id in ["toast", "dialog-toast"] {
                    if let Some(toast) = app.document.get_element_by_id(id) {
                        let _ = toast.class_list().remove_1("shown");
                        toast.set_text_content(None);
                    }
                }
            })
        });
        self.notice_id = window()
            .set_timeout_with_callback_and_timeout_and_arguments_0(hide.unchecked_ref(), 3000)
            .unwrap_or(0);
    }

    fn artifact(&mut self, canvas: HtmlCanvasElement, task: &view::Artwork) -> Result<(), JsValue> {
        let ratio = task.recipe.ratio();
        let (width, height) = if task.thumbnail {
            (
                (176.0 * ratio.min(1.0)).round() as u32,
                (176.0 / ratio.max(1.0)).round() as u32,
            )
        } else {
            let rect = canvas.get_bounding_client_rect();
            let css_width = rect.width().max(1.0);
            let css_height = rect.height().max(1.0);
            let factor = window()
                .device_pixel_ratio()
                .min(1.6)
                .min(1200.0 / css_width.max(css_height));
            (
                (css_width * factor).round().max(1.0) as u32,
                (css_height * factor).round().max(1.0) as u32,
            )
        };
        if canvas.width() != width {
            canvas.set_width(width);
        }
        if canvas.height() != height {
            canvas.set_height(height);
        }
        let Output::Html(output) = Surface::Html(canvas.clone()).context_2d()? else {
            unreachable!()
        };
        let key = if task.thumbnail {
            serde_json::to_string(&task.recipe).ok()
        } else {
            None
        };
        if let Some(image) = key.as_ref().and_then(|key| self.thumbnails.get(key)) {
            output.put_image_data(image, 0.0, 0.0)?;
        } else {
            let scene = Scene::new(&task.recipe);
            let backend = self.renderer.draw(
                &scene,
                Tile::full(width, height),
                &Output::Html(output.clone()),
            )?;
            canvas.set_attribute("data-backend", backend)?;
            if let Some(key) = key {
                if self.thumbnails.len() >= 96 {
                    self.thumbnails.clear();
                }
                if let Ok(image) =
                    output.get_image_data(0.0, 0.0, f64::from(width), f64::from(height))
                {
                    self.thumbnails.insert(key, image);
                }
            }
        }
        canvas.set_attribute("data-seed", &task.recipe.seed.to_string())?;
        canvas.set_attribute("data-generator", &task.recipe.generator)?;
        Ok(())
    }

    fn render_main(&mut self) {
        if let Ok(Some(canvas)) = self.root.query_selector(".stage-frame canvas")
            && let Ok(canvas) = canvas.dyn_into::<HtmlCanvasElement>()
        {
            let task = view::Artwork {
                recipe: self.store.recipe().clone(),
                thumbnail: false,
            };
            if let Err(reason) = self.artifact(canvas, &task) {
                web_sys::console::warn_1(&reason);
            }
        }
    }

    fn render(&mut self) {
        let selected = self.document.active_element().and_then(|element| {
            element
                .get_attribute("data-control")
                .map(|id| format!("[data-control=\"{id}\"]"))
                .or_else(|| {
                    element
                        .get_attribute("id")
                        .filter(|id| id.starts_with("tab-"))
                        .map(|id| format!("#{id}"))
                })
        });
        let scroll_regions = [
            ".families",
            ".settings-scroll",
            ".timeline-items",
            ".palette-grid",
            "dialog.dialog",
        ];
        let offsets = scroll_regions.map(|selector| {
            self.root
                .query_selector(selector)
                .ok()
                .flatten()
                .map(|node| (node.scroll_left(), node.scroll_top()))
        });
        let mut tasks = Vec::new();
        self.root.set_inner_html(&view::build(self, &mut tasks));
        if let Some(dialog) = self
            .document
            .get_element_by_id("forma-dialog")
            .and_then(|element| element.dyn_into::<HtmlDialogElement>().ok())
        {
            let _ = dialog.show_modal();
        }
        for (selector, offset) in scroll_regions.into_iter().zip(offsets) {
            if let (Ok(Some(node)), Some((x, y))) = (self.root.query_selector(selector), offset) {
                node.set_scroll_left(x);
                node.set_scroll_top(y);
            }
        }
        if let Some(selector) = selected {
            self.focus_element(&selector);
        }
        if let Ok(nodes) = self.root.query_selector_all("canvas[data-art]") {
            for i in 0..nodes.length() {
                let Some(canvas) = nodes
                    .item(i)
                    .and_then(|node| node.dyn_into::<HtmlCanvasElement>().ok())
                else {
                    continue;
                };
                let Some(task) = canvas
                    .get_attribute("data-art")
                    .and_then(|id| id.parse::<usize>().ok())
                    .and_then(|id| tasks.get(id))
                else {
                    continue;
                };
                if let Err(reason) = self.artifact(canvas, task) {
                    web_sys::console::warn_1(&reason);
                }
            }
        }
    }

    fn focus_element(&self, selector: &str) {
        if let Ok(Some(element)) = self.root.query_selector(selector)
            && let Ok(element) = element.dyn_into::<HtmlElement>()
        {
            let _ = element.focus();
        }
    }

    fn update(&mut self, change: impl FnOnce(&mut Recipe)) {
        let mut next = self.store.recipe().clone();
        change(&mut next);
        if next.validate().is_ok() {
            self.store.apply(next);
        }
    }

    fn preset(&mut self, generator: &generator::Generator, new_seed: Option<u32>) {
        let mut next = Recipe::preset(generator);
        next.keep_palette_and_aspect(self.store.recipe());
        if !next.palette_locked {
            next.palette_name = generator.palette.into();
        }
        if let Some(seed) = new_seed {
            next.seed = seed;
        }
        self.store.apply(next);
        self.tab = "history".into();
    }

    fn close_dialog(&mut self) {
        self.cancel_job();
        self.dialog = None;
        self.error.clear();
    }

    fn open_dialog(&mut self, dialog: Dialog) {
        self.error.clear();
        self.dialog = Some(dialog);
        self.compare_index = 0;
        self.palette_query.clear();
        self.aspect_fields = self
            .store
            .recipe()
            .custom_aspect
            .map(|value| value.to_string());
        self.export_options = ExportOptions::new(self.store.recipe());
    }

    fn click(&mut self, action: &str, value: &str) {
        let index = || value.parse::<usize>().ok();
        match action {
            "new" => {
                self.preset(&GENERATORS[0], Some(seed()));
                self.zoom = 1.0;
                self.notify("Nueva composición");
            }
            "generate" => {
                self.update(|r| r.seed = seed());
                self.tab = "history".into();
            }
            "variant" => {
                self.store.apply(self.store.recipe().variant(seed(), 0.13));
                self.tab = "history".into();
            }
            "surprise" => {
                self.store.apply(self.store.recipe().surprise(seed()));
                self.tab = "history".into();
            }
            "explore" => {
                let family = self.store.recipe().generator().family;
                self.store.apply(self.store.recipe().explore(seed()));
                self.tab = "history".into();
                self.notify(format!("Exploración de {family}"));
            }
            "undo" => self.store.undo(),
            "redo" => self.store.redo(),
            "favorite" => {
                let recipe = self.store.recipe().clone();
                let old = self.store.session.library.favorites.contains(&recipe);
                self.store.favorite(recipe);
                self.notify(if old {
                    "Eliminado de favoritos"
                } else {
                    "Guardado en favoritos"
                });
            }
            "dialog" => {
                if let Some(dialog) = Dialog::from_name(value) {
                    self.open_dialog(dialog);
                }
            }
            "close" => self.close_dialog(),
            "family" => {
                if let Some(i) = index().filter(|&i| i < FAMILIES.len()) {
                    let family = FAMILIES[i].0;
                    if self.store.recipe().generator().family == family {
                        if !self.expanded.remove(&i) {
                            self.expanded.insert(i);
                        }
                    } else if let Some(lead) = GENERATORS.iter().find(|g| g.family == family) {
                        self.preset(lead, None);
                    }
                }
            }
            "expand" => {
                if let Some(i) = index()
                    && !self.expanded.remove(&i)
                {
                    self.expanded.insert(i);
                }
            }
            "preset" => {
                if let Some(generator) = generator::get(value) {
                    self.preset(generator, None);
                }
            }
            "zoom" => {
                self.zoom = (match value {
                    "in" => self.zoom + 0.25,
                    "out" => self.zoom - 0.25,
                    _ => 1.0,
                })
                .clamp(0.5, 2.0);
            }
            "focus" => self.focus = !self.focus,
            "tab" => {
                if ["history", "favorites", "variants"].contains(&value) {
                    self.tab = value.into();
                }
            }
            "mutate" => self.variants = self.store.recipe().mutate(seed(), self.variant_count),
            "open-film" => {
                if let Some(recipe) = index().and_then(|i| self.visible().get(i)).cloned() {
                    self.store.apply(recipe);
                }
            }
            "favorite-film" => {
                if let Some(recipe) = index().and_then(|i| self.visible().get(i)).cloned() {
                    self.store.favorite(recipe);
                }
            }
            "mode" => {
                if ["simple", "studio"].contains(&value) {
                    self.store.session.mode = value.into();
                }
            }
            "symmetry" => self.update(|r| r.symmetry.mode = value.into()),
            "lock-palette" => self.update(|r| r.palette_locked = !r.palette_locked),
            "lock-parameter" => {
                if let Some(i) = value
                    .strip_prefix("param-")
                    .and_then(|i| i.parse::<usize>().ok())
                {
                    self.update(|r| toggle(&mut r.parameter_locks, i));
                }
            }
            "lock-color" => {
                if let Some(i) = index() {
                    self.update(|r| toggle(&mut r.color_locks, i));
                }
            }
            "regenerate" => self.update(|r| {
                let colors = harmonize(r);
                r.use_colors("Paleta armónica", colors);
            }),
            "extract" => self.extract(),
            "palette-choice" => {
                if let Some(i) = index() {
                    self.apply_palette(i);
                }
            }
            "open-saved" => {
                if let Some(item) = index().and_then(|i| self.store.session.library.saved.get(i)) {
                    self.store.apply(item.recipe.clone());
                    self.close_dialog();
                }
            }
            "remove-saved" => {
                if let Some(i) = index().filter(|&i| i < self.store.session.library.saved.len()) {
                    self.store.session.library.saved.remove(i);
                }
            }
            "remove-palette" => {
                if let Some(i) = index().filter(|&i| i < self.store.session.library.palettes.len())
                {
                    self.store.session.library.palettes.remove(i);
                }
            }
            "use-compare" => {
                if let Some(&other) = self.compare_candidates().get(self.compare_index) {
                    self.store.apply(other.clone());
                }
                self.close_dialog();
            }
            "json" => {
                self.download_json(value);
                return;
            }
            "import" => {
                if let Some(field) = self
                    .document
                    .get_element_by_id("import-json")
                    .and_then(|el| el.dyn_into::<HtmlInputElement>().ok())
                {
                    field.click();
                }
                return;
            }
            "cancel-job" => self.cancel_job(),
            _ => return,
        }
        self.persist();
        self.render();
        if action == "tab" {
            self.focus_element(&format!("#tab-{}", self.tab));
        }
    }

    fn extract(&mut self) {
        let result = (|| -> Result<_, JsValue> {
            let source: HtmlCanvasElement = self
                .root
                .query_selector(".stage-frame canvas")?
                .ok_or_else(|| error("Lienzo ausente."))?
                .dyn_into()?;
            let reduced = export::html_canvas(60, 40)?;
            let Output::Html(ctx) = Surface::Html(reduced).context_2d()? else {
                unreachable!()
            };
            ctx.draw_image_with_html_canvas_element_and_dw_and_dh(&source, 0.0, 0.0, 60.0, 40.0)?;
            Ok(extract_colors(
                &ctx.get_image_data(0.0, 0.0, 60.0, 40.0)?.data().0,
            ))
        })();
        match result {
            Ok(colors) => self.update(|r| r.use_colors("Paleta extraída", colors)),
            Err(_) => self.error = "No se pudo extraer color del lienzo.".into(),
        }
    }

    fn apply_palette(&mut self, index: usize) {
        let custom = &self.store.session.library.palettes;
        let selected = if index < custom.len() {
            Some((custom[index].name.clone(), custom[index].colors.clone()))
        } else {
            PALETTES
                .get(index - custom.len())
                .map(|(name, colors)| (name.to_string(), colors.map(str::to_owned)))
        };
        if let Some((name, colors)) = selected {
            self.update(|r| r.use_colors(name, colors));
        }
    }

    fn download_json(&mut self, which: &str) {
        let r = self.store.recipe();
        let result = match which {
            "palette" => export::json_download(
                &serde_json::json!({"schema":1,"name":r.palette_name,"colors":r.palette}),
                "forma-paleta.json",
            ),
            "recipe" => export::json_download(r, &format!("forma-receta-{}.json", r.seed)),
            "library" => {
                export::json_download(&self.store.session.library, "forma-biblioteca.json")
            }
            _ => return,
        };
        if result.is_err() {
            self.error = "No se pudo guardar el archivo JSON.".into();
            self.render();
        }
    }

    fn do_import(&mut self, input: HtmlInputElement) {
        let Some(file) = input.files().and_then(|files| files.get(0)) else {
            return;
        };
        input.set_value("");
        if file.size() > 1024.0 * 1024.0 {
            self.error = "El archivo JSON debe pesar menos de 1 MB.".into();
            self.render();
            return;
        }
        spawn_local(async move {
            let outcome = JsFuture::from(file.text())
                .await
                .ok()
                .and_then(|text| text.as_string())
                .ok_or("No se pudo leer el archivo JSON.")
                .and_then(|text| parse_import(&text));
            with_app(|app| {
                if app.dialog != Some(Dialog::Library) {
                    return;
                }
                app.error.clear();
                match outcome {
                    Ok(Import::Recipe(recipe)) => {
                        app.store.apply(recipe);
                        app.close_dialog();
                        app.notify("Receta importada");
                    }
                    Ok(Import::Palette(palette)) => app.merge_library(
                        Library {
                            palettes: vec![palette],
                            ..Library::default()
                        },
                        "Paleta importada",
                    ),
                    Ok(Import::Library(library)) => {
                        app.merge_library(library, "Biblioteca importada")
                    }
                    Err(reason) => app.error = reason.into(),
                }
                app.persist();
                app.render();
            });
        });
    }

    fn merge_library(&mut self, incoming: Library, message: &str) {
        match self.store.session.library.merge(incoming) {
            Ok(()) => {
                self.persist();
                self.notify(message);
            }
            Err(reason) => self.error = reason,
        }
    }

    fn change(&mut self, control: &str, value: &str, element: &Element) {
        let index = |prefix| {
            control
                .strip_prefix(prefix)
                .and_then(|i| i.parse::<usize>().ok())
        };
        match control {
            "aspect" if value == "custom" => self.open_dialog(Dialog::Aspect),
            "aspect" => {
                self.update(|r| r.aspect = value.into());
                self.zoom = 1.0;
            }
            "variant-count" => {
                if let Ok(n @ (4 | 9 | 16)) = value.parse() {
                    self.variant_count = n;
                }
            }
            "compare" => {
                if let Ok(n) = value.parse() {
                    self.compare_index = n;
                }
            }
            "personality" => {
                if let Some(p) = PERSONALITIES.iter().find(|p| p.id == value) {
                    self.update(|r| {
                        r.personality = value.into();
                        r.harmony = p.harmony.into();
                        let colors = harmonize(r);
                        r.use_colors("Paleta armónica", colors);
                    });
                }
            }
            "harmony" => self.update(|r| {
                r.harmony = value.into();
                let colors = harmonize(r);
                r.use_colors("Paleta armónica", colors);
            }),
            "symmetry" => self.update(|r| r.symmetry.mode = value.into()),
            "finish" => self.update(|r| r.texture.finish = value.into()),
            "seed" => {
                if let Ok(n) = value.parse::<u32>() {
                    self.update(|r| r.seed = n);
                }
            }
            "dither" => {
                if let Some(input) = element.dyn_ref::<HtmlInputElement>() {
                    self.update(|r| r.render.dither = input.checked());
                }
            }
            "import" => {
                if let Ok(input) = element.clone().dyn_into::<HtmlInputElement>() {
                    self.do_import(input);
                }
                return;
            }
            "export-format" => {
                self.read_export_fields();
                self.export_options.format = value.into();
            }
            "export-size" => {
                self.read_export_fields();
                self.export_options.size = value.into();
                if let Ok(short) = value.parse() {
                    let [width, height] = resolution(self.store.recipe(), short);
                    self.export_options.width = width.to_string();
                    self.export_options.height = height.to_string();
                }
            }
            "palette-query" | "quality" => return,
            _ => {
                if let Some(i) = index("choice-").filter(|&i| i < 4)
                    && let Ok(n) = value.parse::<usize>()
                {
                    let len = self.store.recipe().generator().parameters[i].choices.len();
                    if n < len {
                        self.update(|r| r.parameters[i] = (n as f64 + 0.5) / len as f64);
                    }
                } else if let Some(i) = index("hex-").or_else(|| index("color-")).filter(|&i| i < 5)
                {
                    if valid_hex(value) {
                        self.update(|r| {
                            let mut colors = r.palette.clone();
                            colors[i] = value.to_lowercase();
                            r.use_colors("Paleta editada", colors);
                        });
                    }
                } else if element
                    .dyn_ref::<HtmlInputElement>()
                    .is_some_and(|input| input.type_() == "range")
                {
                    if let Ok(n) = value.parse::<f64>() {
                        self.range(control, n);
                    }
                    self.store.commit();
                } else {
                    return;
                }
            }
        }
        self.persist();
        self.render();
    }

    fn range(&mut self, control: &str, value: f64) {
        self.store.edit(|r| match control {
            "complexity" => r.complexity = value,
            "order" => r.symmetry.order = value as u8,
            "axis" => r.symmetry.axis = value,
            "phase" => r.symmetry.phase = value,
            "perturbation" => r.symmetry.perturbation = value,
            "texture" => {
                if r.texture.finish == "none" {
                    r.texture.finish = "fine".into();
                }
                r.texture.amount = value;
            }
            "contrast" => r.contrast = value,
            "saturation" => r.saturation = value,
            "mix" => r.render.mix = value,
            _ => {
                if let Some(i) = control
                    .strip_prefix("param-")
                    .and_then(|i| i.parse::<usize>().ok())
                    .filter(|&i| i < 4)
                {
                    r.parameters[i] = value;
                }
            }
        });
    }

    fn input(&mut self, input: &HtmlInputElement, control: &str) {
        let value = input.value();
        match control {
            "palette-query" => {
                self.palette_query = value;
                if let Ok(Some(grid)) = self.root.query_selector(".palette-grid") {
                    grid.set_inner_html(&dialogs::palette_cards(self));
                }
            }
            "quality" => {
                if let Ok(n) = value.parse::<f64>() {
                    self.export_options.quality = n;
                    if let Some(label) = self.document.get_element_by_id("quality-label") {
                        label.set_text_content(Some(&format!("Calidad {:.0}%", n * 100.0)));
                    }
                }
            }
            _ if control.starts_with("hex-") => {
                let _ = input.set_attribute(
                    "aria-invalid",
                    if valid_hex(&value) { "false" } else { "true" },
                );
            }
            _ if input.type_() == "range" => {
                if let Ok(n) = value.parse::<f64>() {
                    self.range(control, n);
                    let min = input.min().parse::<f64>().unwrap_or(0.0);
                    let max = input.max().parse::<f64>().unwrap_or(1.0);
                    let _ = input
                        .style()
                        .set_property("--fill", &format!("{}%", (n - min) / (max - min) * 100.0));
                    if let Ok(Some(tag)) = self
                        .root
                        .query_selector(&format!("[data-quant=\"{control}\"]"))
                    {
                        tag.set_text_content(Some(&settings::quant(control, n)));
                    }
                    self.render_main();
                }
            }
            _ => {}
        }
    }

    fn read_export_fields(&mut self) {
        if let Ok(Some(form)) = self.root.query_selector("[data-form=\"export\"]") {
            self.export_options.width = form_value(&form, "width");
            self.export_options.height = form_value(&form, "height");
        }
    }

    fn submit(&mut self, form: &Element, kind: &str) {
        self.error.clear();
        match kind {
            "save-recipe" => match self.store.save_recipe(&form_value(form, "title")) {
                Ok(()) => self.notify("Receta guardada"),
                Err(reason) => self.error = reason.into(),
            },
            "save-palette" => match self.store.save_palette(&form_value(form, "title")) {
                Ok(()) => self.notify("Paleta guardada"),
                Err(reason) => self.error = reason.into(),
            },
            "aspect" => {
                self.aspect_fields = [form_value(form, "width"), form_value(form, "height")];
                let w = self.aspect_fields[0].parse::<u32>().unwrap_or(0);
                let h = self.aspect_fields[1].parse::<u32>().unwrap_or(0);
                if w.min(h) == 0 || w.max(h) > 8 * w.min(h) {
                    self.error = "La relación máxima entre lados es 8:1.".into();
                } else {
                    self.update(|r| {
                        r.aspect = "custom".into();
                        r.custom_aspect = [w, h];
                    });
                    self.zoom = 1.0;
                    self.close_dialog();
                }
            }
            "export" => {
                self.start_export();
                return;
            }
            _ => return,
        }
        self.persist();
        self.render();
    }

    fn cancel_job(&mut self) {
        self.job_id += 1;
        self.progress = None;
        self.worker = None;
    }

    fn start_export(&mut self) {
        if self.progress.is_some() {
            return;
        }
        self.read_export_fields();
        let options = &self.export_options;
        let job = export::Job {
            recipe: self.store.recipe().clone(),
            width: options.width.parse().unwrap_or(0),
            height: options.height.parse().unwrap_or(0),
            format: options.format.clone(),
            quality: options.quality,
        };
        if let Err(reason) = job.validate() {
            self.error = reason.as_string().unwrap_or_else(|| INVALID_SIZE.into());
            self.render();
            return;
        }
        self.job_id += 1;
        let id = self.job_id;
        self.progress = Some((0.0, "Preparando lienzo".into()));
        self.render();
        let offscreen = Reflect::has(&js_sys::global(), &"OffscreenCanvas".into()).unwrap_or(false);
        if offscreen && self.start_worker(id, &job).is_ok() {
            return;
        }
        run_inline(id, job);
    }

    fn start_worker(&mut self, id: u64, job: &export::Job) -> Result<(), JsValue> {
        let options = WorkerOptions::new();
        options.set_type(WorkerType::Module);
        let worker = Worker::new_with_options("./worker.js", &options)?;
        let name = job.filename();
        let payload = JsValue::from_str(
            &serde_json::to_string(job)
                .map_err(|_| error("No se pudo preparar la exportación."))?,
        );
        let receiver = worker.clone();
        let alternate = job.clone();
        let message = Closure::<dyn Fn(MessageEvent)>::new(move |event: MessageEvent| {
            let data = Array::from(&event.data());
            with_app(|app| {
                if app.job_id != id {
                    return;
                }
                match data.get(0).as_string().as_deref() {
                    Some("ready") => {
                        if receiver.post_message(&payload).is_err() {
                            app.worker = None;
                            run_inline(id, alternate.clone());
                        }
                    }
                    Some("progress") => app.progress_update(
                        data.get(1).as_f64().unwrap_or(0.0),
                        &data.get(2).as_string().unwrap_or_default(),
                    ),
                    Some("done") => app.finish_export(data.get(1).dyn_into::<Blob>(), &name),
                    Some("error") => app.finish_export(Err(data.get(1)), &name),
                    _ => {}
                }
            });
        });
        let fallback = job.clone();
        let failure = Closure::<dyn Fn(Event)>::new(move |event: Event| {
            event.prevent_default();
            with_app(|app| {
                if app.job_id == id && app.worker.take().is_some() {
                    run_inline(id, fallback.clone());
                }
            });
        });
        worker.set_onmessage(Some(message.as_ref().unchecked_ref()));
        worker.set_onerror(Some(failure.as_ref().unchecked_ref()));
        self.worker = Some(ExportWorker {
            worker,
            _message: message,
            _error: failure,
        });
        Ok(())
    }

    fn progress_update(&mut self, fraction: f64, message: &str) {
        self.progress = Some((fraction, message.into()));
        if let Some(element) = self.document.get_element_by_id("export-message") {
            element.set_text_content(Some(&format!("{message} · {:.0}%", fraction * 100.0)));
        }
        if let Some(element) = self.document.get_element_by_id("export-progress") {
            let _ = element.set_attribute("value", &fraction.to_string());
        }
    }

    fn finish_export(&mut self, result: Result<Blob, JsValue>, name: &str) {
        self.cancel_job();
        match result.and_then(|blob| export::download(&blob, name)) {
            Ok(()) => {
                self.close_dialog();
                self.notify("Imagen exportada");
            }
            Err(reason) => {
                self.error = reason
                    .as_string()
                    .unwrap_or_else(|| "Falló la exportación.".into())
            }
        }
        self.render();
    }
}

fn toggle(items: &mut Vec<usize>, index: usize) {
    if let Some(p) = items.iter().position(|&n| n == index) {
        items.remove(p);
    } else {
        items.push(index);
        items.sort_unstable();
    }
}

fn harmonize(r: &Recipe) -> forma_core::color::Colors {
    generate_colors(
        &r.palette,
        &r.personality,
        &r.harmony,
        seed(),
        &r.color_locks,
    )
}

fn form_value(form: &Element, name: &str) -> String {
    form.query_selector(&format!("input[name=\"{name}\"]"))
        .ok()
        .flatten()
        .and_then(|element| element.dyn_into::<HtmlInputElement>().ok())
        .map(|field| field.value())
        .unwrap_or_default()
}

fn run_inline(id: u64, job: export::Job) {
    spawn_local(async move {
        let name = job.filename();
        let outcome = async {
            let canvas = Surface::Html(export::html_canvas(job.width, job.height)?);
            let scratch = Surface::Html(export::html_canvas(1, 1)?);
            export::render(
                &job,
                canvas,
                scratch,
                export::yield_on_window,
                |fraction, label| {
                    with_app(|app| {
                        if app.job_id == id {
                            app.progress_update(fraction, label);
                        }
                    })
                },
                || APP.with(|cell| cell.borrow().as_ref().is_none_or(|app| app.job_id != id)),
            )
            .await
        }
        .await;
        with_app(|app| {
            if app.job_id == id {
                app.finish_export(outcome, &name);
            }
        });
    });
}

fn on(target: &EventTarget, kind: &str, handler: impl Fn(Event) + 'static) -> Result<(), JsValue> {
    let handler = Closure::<dyn Fn(Event)>::new(handler);
    target.add_event_listener_with_callback(kind, handler.as_ref().unchecked_ref())?;
    handler.forget();
    Ok(())
}

fn target(event: &Event) -> Option<Element> {
    event.target().and_then(|value| value.dyn_into().ok())
}

#[wasm_bindgen]
pub fn start() -> Result<(), JsValue> {
    let document = window()
        .document()
        .ok_or_else(|| error("No se encontró el documento."))?;
    let root = document
        .get_element_by_id("root")
        .ok_or_else(|| error("No se encontró el estudio."))?;
    let mut store = Studio::default();
    match window()
        .local_storage()
        .and_then(|storage| storage.map_or(Ok(None), |storage| storage.get_item(STORAGE_KEY)))
    {
        Ok(Some(session)) => match Studio::restore(&session) {
            Ok(restored) => store = restored,
            Err(_) => store.storage_warning = true,
        },
        Err(_) => store.storage_warning = true,
        _ => {}
    }
    let gpu = export::html_canvas(1, 1)?;
    let renderer = Renderer::new(Surface::Html(gpu.clone()));
    let export_options = ExportOptions::new(store.recipe());
    let app = App {
        document,
        root: root.clone(),
        store,
        expanded: BTreeSet::new(),
        tab: "history".into(),
        variant_count: 4,
        variants: Vec::new(),
        focus: false,
        zoom: 1.0,
        dialog: None,
        error: String::new(),
        notice: String::new(),
        notice_id: 0,
        palette_query: String::new(),
        compare_index: 0,
        aspect_fields: ["3".into(), "2".into()],
        export_options,
        progress: None,
        job_id: 0,
        worker: None,
        renderer,
        thumbnails: HashMap::new(),
    };
    APP.with(|slot| slot.replace(Some(app)));
    on(&root, "click", |event| {
        let Some(target) = target(&event) else { return };
        if target.id() == "forma-dialog" {
            with_app(|app| app.click("close", ""));
            return;
        }
        if let Ok(Some(button)) = target.closest("button[data-action]")
            && let Some(action) = button.get_attribute("data-action")
        {
            let value = button.get_attribute("data-value").unwrap_or_default();
            with_app(|app| app.click(&action, &value));
        }
    })?;
    on(&root, "input", |event| {
        if let Some(input) =
            target(&event).and_then(|target| target.dyn_into::<HtmlInputElement>().ok())
            && let Some(control) = input.get_attribute("data-control")
        {
            with_app(|app| app.input(&input, &control));
        }
    })?;
    on(&root, "change", |event| {
        let Some(element) = target(&event) else {
            return;
        };
        let Some(control) = element.get_attribute("data-control") else {
            return;
        };
        let value = element
            .dyn_ref::<HtmlInputElement>()
            .map(HtmlInputElement::value)
            .or_else(|| {
                element
                    .dyn_ref::<HtmlSelectElement>()
                    .map(HtmlSelectElement::value)
            })
            .unwrap_or_default();
        with_app(|app| app.change(&control, &value, &element));
    })?;
    on(&root, "submit", |event| {
        if let Some(form) = target(&event)
            && let Some(kind) = form.get_attribute("data-form")
        {
            event.prevent_default();
            with_app(|app| app.submit(&form, &kind));
        }
    })?;
    on(&window(), "keydown", handle_key)?;
    on(&window(), "resize", |_| with_app(App::render_main))?;
    on(&gpu, "webglcontextlost", |event| {
        event.prevent_default();
        with_app(|app| {
            app.renderer.reset();
            app.render_main();
        });
    })?;
    on(&gpu, "webglcontextrestored", |_| {
        with_app(|app| {
            app.renderer.reset();
            app.render_main();
        });
    })?;
    with_app(|app| {
        if !app.store.storage_warning {
            app.persist();
        }
        app.render();
    });
    Ok(())
}

fn handle_key(event: Event) {
    let Some(key_event) = event.dyn_ref::<KeyboardEvent>() else {
        return;
    };
    let key = key_event.key();
    let element = target(&event);
    with_app(|app| {
        if key == "Escape" && (app.dialog.is_some() || app.focus) {
            event.prevent_default();
            if app.dialog.is_some() {
                app.click("close", "");
            } else {
                app.click("focus", "");
            }
            return;
        }
        if let Some(element) = element.as_ref() {
            if let Some(input) = element.dyn_ref::<HtmlInputElement>()
                && key == "Enter"
                && let Some(control) = input
                    .get_attribute("data-control")
                    .filter(|id| id == "seed" || id.starts_with("hex-"))
            {
                event.prevent_default();
                app.change(&control, &input.value(), element);
                return;
            }
            if element.get_attribute("role").as_deref() == Some("tab")
                && matches!(key.as_str(), "Home" | "End" | "ArrowLeft" | "ArrowRight")
            {
                event.prevent_default();
                let tabs = ["history", "favorites", "variants"];
                let current = tabs.iter().position(|tab| *tab == app.tab).unwrap_or(0);
                let next = match key.as_str() {
                    "Home" => 0,
                    "End" => 2,
                    "ArrowLeft" => (current + 2) % 3,
                    _ => (current + 1) % 3,
                };
                app.click("tab", tabs[next]);
                return;
            }
            if element
                .closest("input,select,textarea,[contenteditable]")
                .ok()
                .flatten()
                .is_some()
            {
                return;
            }
        }
        if app.dialog.is_some() {
            return;
        }
        let command = key_event.ctrl_key() || key_event.meta_key();
        let lower = key.to_ascii_lowercase();
        let action = match (command, lower.as_str()) {
            (true, "z") if key_event.shift_key() => ("redo", ""),
            (true, "z") => ("undo", ""),
            (true, "y") => ("redo", ""),
            (true, "s") => ("dialog", "library"),
            (false, "g") if !key_event.alt_key() => ("generate", ""),
            _ => return,
        };
        event.prevent_default();
        app.click(action.0, action.1);
    });
}
