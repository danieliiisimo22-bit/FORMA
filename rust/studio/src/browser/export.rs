use super::render::{Renderer, Surface, error};
use forma_core::recipe::{INVALID_RECIPE, Recipe};
use forma_core::render::{Scene, Tile, validate_size};
use js_sys::{Array, Promise};
use serde::{Deserialize, Serialize};
use wasm_bindgen::{JsCast, JsValue, closure::Closure, prelude::wasm_bindgen};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{
    Blob, BlobPropertyBag, DedicatedWorkerGlobalScope, HtmlAnchorElement, HtmlCanvasElement,
    ImageEncodeOptions, MessageEvent, OffscreenCanvas, Url,
};

#[derive(Clone, Serialize, Deserialize)]
pub struct Job {
    pub recipe: Recipe,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub quality: f64,
}

impl Job {
    pub fn validate(&self) -> Result<(), JsValue> {
        self.recipe.validate().map_err(error)?;
        validate_size(self.width, self.height).map_err(error)?;
        if !matches!(
            self.format.as_str(),
            "image/png" | "image/jpeg" | "image/webp"
        ) {
            return Err(error("Formato de imagen inválido."));
        }
        Ok(())
    }

    pub fn filename(&self) -> String {
        let suffix = match self.format.as_str() {
            "image/jpeg" => "jpg",
            "image/webp" => "webp",
            _ => "png",
        };
        format!(
            "forma-{}-{}-{}x{}.{}",
            self.recipe.generator, self.recipe.seed, self.width, self.height, suffix
        )
    }
}

pub fn json_download(value: &impl Serialize, name: &str) -> Result<(), JsValue> {
    let json =
        serde_json::to_string_pretty(value).map_err(|_| error("No se pudo exportar JSON."))?;
    let parts = Array::of1(&json.into());
    let bag = BlobPropertyBag::new();
    bag.set_type("application/json");
    let blob = Blob::new_with_str_sequence_and_options(&parts, &bag)?;
    download(&blob, name)
}

pub fn download(blob: &Blob, name: &str) -> Result<(), JsValue> {
    let window = super::window();
    let document = window
        .document()
        .ok_or_else(|| error("No se encontró el documento."))?;
    let a: HtmlAnchorElement = document.create_element("a")?.dyn_into()?;
    let url = Url::create_object_url_with_blob(blob)?;
    a.set_href(&url);
    a.set_download(name);
    if let Some(body) = document.body() {
        body.append_child(&a)?;
        a.click();
        a.remove();
    }
    let release = Closure::once_into_js(move || {
        let _ = Url::revoke_object_url(&url);
    });
    window
        .set_timeout_with_callback_and_timeout_and_arguments_0(release.unchecked_ref(), 60_000)?;
    Ok(())
}

pub async fn render(
    job: &Job,
    output: Surface,
    surface: Surface,
    yield_frame: impl Fn() -> Promise,
    report: impl Fn(f64, &str),
    cancelled: impl Fn() -> bool,
) -> Result<Blob, JsValue> {
    job.validate()?;
    let context = output.context_2d()?;
    let mut renderer = Renderer::new(surface);
    let scene = Scene::new(&job.recipe);
    let step = renderer.tile_limit();
    let count = job.width.div_ceil(step) * job.height.div_ceil(step);
    let mut done = 0;
    let mut backend = None;
    for y in (0..job.height).step_by(step as usize) {
        for x in (0..job.width).step_by(step as usize) {
            if cancelled() {
                return Err(error("Exportación cancelada."));
            }
            let next = renderer.draw(
                &scene,
                Tile {
                    width: step.min(job.width - x),
                    height: step.min(job.height - y),
                    x,
                    y,
                    full_width: job.width,
                    full_height: job.height,
                },
                &context,
            )?;
            if backend.is_some_and(|previous| previous != next) {
                return Err(error(
                    "El contexto gráfico cambió durante la exportación. Vuelve a intentarlo.",
                ));
            }
            backend = Some(next);
            done += 1;
            report(
                f64::from(done) / f64::from(count) * 0.89,
                "Renderizando imagen",
            );
            JsFuture::from(yield_frame()).await?;
        }
    }
    if cancelled() {
        return Err(error("Exportación cancelada."));
    }
    report(0.94, "Codificando archivo");
    let blob = encode(output, &job.format, job.quality).await?;
    if blob.type_() != job.format {
        return Err(error(
            "Este navegador no admite la codificación en el formato elegido.",
        ));
    }
    Ok(blob)
}

async fn encode(surface: Surface, format: &str, quality: f64) -> Result<Blob, JsValue> {
    let promise = match surface {
        Surface::Worker(canvas) => {
            let options = ImageEncodeOptions::new();
            options.set_type(format);
            options.set_quality(quality);
            canvas.convert_to_blob_with_options(&options)?
        }
        Surface::Html(canvas) => Promise::new(&mut |resolve, reject| {
            if let Err(reason) =
                canvas.to_blob_with_type_and_encoder_options(&resolve, format, &quality.into())
            {
                let _ = reject.call1(&JsValue::NULL, &reason);
            }
        }),
    };
    let reason =
        || error("El navegador no pudo codificar esta imagen. Prueba con una resolución menor.");
    JsFuture::from(promise)
        .await
        .map_err(|_| reason())?
        .dyn_into()
        .map_err(|_| reason())
}

pub fn html_canvas(width: u32, height: u32) -> Result<HtmlCanvasElement, JsValue> {
    let canvas: HtmlCanvasElement = super::window()
        .document()
        .unwrap()
        .create_element("canvas")?
        .dyn_into()?;
    canvas.set_width(width);
    canvas.set_height(height);
    Ok(canvas)
}

pub fn yield_on_window() -> Promise {
    Promise::new(&mut |resolve, _| {
        let _ = super::window().set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, 0);
    })
}

#[wasm_bindgen]
pub fn start_worker() -> Result<(), JsValue> {
    let worker: DedicatedWorkerGlobalScope = js_sys::global().dyn_into()?;
    let handler = {
        let worker = worker.clone();
        Closure::<dyn Fn(MessageEvent)>::new(move |message: MessageEvent| {
            let worker = worker.clone();
            spawn_local(async move {
                let outcome = async {
                    let text = message
                        .data()
                        .as_string()
                        .ok_or_else(|| error(INVALID_RECIPE))?;
                    let job: Job =
                        serde_json::from_str(&text).map_err(|_| error(INVALID_RECIPE))?;
                    job.validate()?;
                    let output = Surface::Worker(OffscreenCanvas::new(job.width, job.height)?);
                    let scratch = Surface::Worker(OffscreenCanvas::new(1, 1)?);
                    render(
                        &job,
                        output,
                        scratch,
                        || {
                            Promise::new(&mut |resolve, _| {
                                let _ = worker
                                    .set_timeout_with_callback_and_timeout_and_arguments_0(
                                        &resolve, 0,
                                    );
                            })
                        },
                        |fraction, label| {
                            let _ = worker.post_message(&Array::of3(
                                &"progress".into(),
                                &fraction.into(),
                                &label.into(),
                            ));
                        },
                        || false,
                    )
                    .await
                }
                .await;
                let payload = match outcome {
                    Ok(blob) => Array::of2(&"done".into(), &blob),
                    Err(reason) => Array::of2(
                        &"error".into(),
                        &reason
                            .as_string()
                            .unwrap_or_else(|| "Falló la exportación.".into())
                            .into(),
                    ),
                };
                let _ = worker.post_message(&payload);
            });
        })
    };
    worker.set_onmessage(Some(handler.as_ref().unchecked_ref()));
    handler.forget();
    worker.post_message(&Array::of1(&"ready".into()))?;
    Ok(())
}
