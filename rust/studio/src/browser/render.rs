use forma_core::generator::{Generator, VERTEX, fragment};
use forma_core::recipe::{FINISHES, SYMMETRIES};
use forma_core::render::{Scene, Tile};
use js_sys::{Object, Reflect};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::{Clamped, JsCast, JsValue};
use web_sys::{
    CanvasRenderingContext2d, HtmlCanvasElement, ImageData, OffscreenCanvas,
    OffscreenCanvasRenderingContext2d, WebGl2RenderingContext as Gl, WebGlProgram, WebGlTexture,
    WebGlUniformLocation,
};

pub fn error(message: &str) -> JsValue {
    JsValue::from_str(message)
}

pub enum Surface {
    Html(HtmlCanvasElement),
    Worker(OffscreenCanvas),
}

impl Surface {
    fn resize(&self, width: u32, height: u32) {
        match self {
            Self::Html(canvas) => {
                if canvas.width() != width {
                    canvas.set_width(width);
                }
                if canvas.height() != height {
                    canvas.set_height(height);
                }
            }
            Self::Worker(canvas) => {
                if canvas.width() != width {
                    canvas.set_width(width);
                }
                if canvas.height() != height {
                    canvas.set_height(height);
                }
            }
        }
    }

    fn context(&self, name: &str, options: &JsValue) -> Result<JsValue, JsValue> {
        let context = match self {
            Self::Html(canvas) => canvas.get_context_with_context_options(name, options)?,
            Self::Worker(canvas) => canvas.get_context_with_context_options(name, options)?,
        };
        context
            .map(JsValue::from)
            .ok_or_else(|| error("El navegador no pudo crear el contexto gráfico."))
    }

    pub fn context_2d(&self) -> Result<Output, JsValue> {
        let options = Object::new();
        Reflect::set(&options, &"alpha".into(), &false.into())?;
        match self {
            Self::Html(_) => self.context("2d", &options)?.dyn_into().map(Output::Html),
            Self::Worker(_) => self.context("2d", &options)?.dyn_into().map(Output::Worker),
        }
    }
}

pub enum Output {
    Html(CanvasRenderingContext2d),
    Worker(OffscreenCanvasRenderingContext2d),
}

impl Output {
    fn draw(&self, surface: &Surface, tile: Tile) -> Result<(), JsValue> {
        let (x, y) = (f64::from(tile.x), f64::from(tile.y));
        match (self, surface) {
            (Self::Html(ctx), Surface::Html(canvas)) => {
                ctx.draw_image_with_html_canvas_element(canvas, x, y)
            }
            (Self::Worker(ctx), Surface::Worker(canvas)) => {
                ctx.draw_image_with_offscreen_canvas(canvas, x, y)
            }
            (Self::Html(ctx), Surface::Worker(canvas)) => {
                ctx.draw_image_with_offscreen_canvas(canvas, x, y)
            }
            (Self::Worker(ctx), Surface::Html(canvas)) => {
                ctx.draw_image_with_html_canvas_element(canvas, x, y)
            }
        }
    }

    fn put(&self, scene: &Scene<'_>, tile: Tile) -> Result<(), JsValue> {
        let pixels = scene.cpu_pixels(tile);
        let image =
            ImageData::new_with_u8_clamped_array_and_sh(Clamped(&pixels), tile.width, tile.height)?;
        let (x, y) = (f64::from(tile.x), f64::from(tile.y));
        match self {
            Self::Html(ctx) => ctx.put_image_data(&image, x, y),
            Self::Worker(ctx) => ctx.put_image_data(&image, x, y),
        }
    }
}

const UNIFORMS: [&str; 10] = [
    "uSize",
    "uOrigin",
    "uTileHeight",
    "uParams",
    "uLayout",
    "uSym",
    "uFinish",
    "uGeometry",
    "uGrades",
    "uRamp",
];

struct Program {
    program: WebGlProgram,
    uniforms: [Option<WebGlUniformLocation>; 10],
}

pub struct Renderer {
    surface: Surface,
    gl: Option<Gl>,
    programs: HashMap<&'static str, Program>,
    unavailable: HashSet<&'static str>,
    texture: Option<WebGlTexture>,
    previous_ramp: Vec<u8>,
}

impl Renderer {
    pub fn new(surface: Surface) -> Self {
        let options = Object::new();
        for (key, value) in [
            ("alpha", false),
            ("antialias", false),
            ("depth", false),
            ("stencil", false),
            ("preserveDrawingBuffer", true),
        ] {
            let _ = Reflect::set(&options, &key.into(), &value.into());
        }
        let gl = surface
            .context("webgl2", &options)
            .ok()
            .and_then(|v| v.dyn_into().ok());
        Self {
            surface,
            gl,
            programs: HashMap::new(),
            unavailable: HashSet::new(),
            texture: None,
            previous_ramp: Vec::new(),
        }
    }

    pub fn reset(&mut self) {
        self.programs.clear();
        self.unavailable.clear();
        self.texture = None;
        self.previous_ramp.clear();
    }

    pub fn tile_limit(&self) -> u32 {
        let Some(gl) = self.gl.as_ref().filter(|gl| !gl.is_context_lost()) else {
            return 384;
        };
        let max = gl
            .get_parameter(Gl::MAX_RENDERBUFFER_SIZE)
            .ok()
            .and_then(|v| v.as_f64())
            .unwrap_or(1536.0);
        1536_u32.min(max as u32).max(1)
    }

    pub fn draw(
        &mut self,
        scene: &Scene<'_>,
        tile: Tile,
        output: &Output,
    ) -> Result<&'static str, JsValue> {
        let g = scene.recipe.generator();
        if let Some(gl) = self.gl.clone().filter(|gl| !gl.is_context_lost())
            && !self.unavailable.contains(g.id)
        {
            match self
                .draw_gl(&gl, scene, tile)
                .and_then(|_| output.draw(&self.surface, tile))
            {
                Ok(()) => return Ok("WebGL2"),
                Err(reason) if !gl.is_context_lost() => {
                    self.unavailable.insert(g.id);
                    web_sys::console::warn_2(&"FORMA: se usará Canvas 2D.".into(), &reason);
                }
                Err(_) => {}
            }
        }
        output.put(scene, tile)?;
        Ok("Canvas 2D")
    }

    fn draw_gl(&mut self, gl: &Gl, scene: &Scene<'_>, tile: Tile) -> Result<(), JsValue> {
        self.surface.resize(tile.width, tile.height);
        if gl.drawing_buffer_width() != tile.width as i32
            || gl.drawing_buffer_height() != tile.height as i32
        {
            return Err(error("Tamaño de buffer no disponible."));
        }
        let recipe = scene.recipe;
        let generator = recipe.generator();
        if !self.programs.contains_key(generator.id) {
            self.programs.insert(generator.id, compile(gl, generator)?);
        }
        let program = &self.programs[generator.id];
        let u = |i: usize| program.uniforms[i].as_ref();
        if self.texture.is_none() {
            self.texture = gl.create_texture();
        }
        if self.texture.is_none() {
            return Err(error("No se pudo crear la textura cromática."));
        }
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, self.texture.as_ref());
        if self.previous_ramp != scene.ramp {
            gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
                Gl::TEXTURE_2D,
                0,
                Gl::RGBA8 as i32,
                512,
                1,
                0,
                Gl::RGBA,
                Gl::UNSIGNED_BYTE,
                Some(&scene.ramp),
            )?;
            for (key, value) in [
                (Gl::TEXTURE_MIN_FILTER, Gl::LINEAR),
                (Gl::TEXTURE_MAG_FILTER, Gl::LINEAR),
                (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE),
                (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE),
            ] {
                gl.tex_parameteri(Gl::TEXTURE_2D, key, value as i32);
            }
            self.previous_ramp.clone_from(&scene.ramp);
        }
        gl.disable(Gl::DITHER);
        gl.viewport(0, 0, tile.width as i32, tile.height as i32);
        gl.use_program(Some(&program.program));
        gl.uniform2f(u(0), tile.full_width as f32, tile.full_height as f32);
        gl.uniform2f(u(1), tile.x as f32, tile.y as f32);
        gl.uniform1f(u(2), tile.height as f32);
        gl.uniform4fv_with_f32_array(u(3), &recipe.parameters.map(|x| x as f32));
        gl.uniform4f(
            u(4),
            scene.phase as f32,
            recipe.complexity as f32,
            (recipe.seed & 0xffff) as f32,
            scene.dy as f32,
        );
        let sym = &recipe.symmetry;
        gl.uniform4f(
            u(5),
            sym.order as f32,
            sym.axis as f32,
            sym.phase as f32,
            sym.perturbation as f32,
        );
        let finish = FINISHES
            .iter()
            .position(|(id, _)| *id == recipe.texture.finish)
            .unwrap_or_default();
        gl.uniform4f(u(6), finish as f32, recipe.texture.amount as f32, 0.0, 0.0);
        let mode = SYMMETRIES
            .iter()
            .position(|(id, _)| *id == sym.mode)
            .unwrap_or_default();
        gl.uniform4f(
            u(7),
            scene.tilt as f32,
            scene.scale as f32,
            scene.dx as f32,
            mode as f32,
        );
        gl.uniform3f(
            u(8),
            recipe.contrast as f32,
            recipe.render.mix as f32,
            u8::from(recipe.render.dither) as f32,
        );
        gl.uniform1i(u(9), 0);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        if gl.get_error() != Gl::NO_ERROR {
            return Err(error("Falló el dibujo en WebGL."));
        }
        Ok(())
    }
}

impl Drop for Renderer {
    fn drop(&mut self) {
        if let Some(gl) = &self.gl {
            for program in self.programs.values() {
                gl.delete_program(Some(&program.program));
            }
            gl.delete_texture(self.texture.as_ref());
        }
    }
}

fn compile(gl: &Gl, generator: &Generator) -> Result<Program, JsValue> {
    let program = gl
        .create_program()
        .ok_or_else(|| error("WebGL no pudo crear el programa."))?;
    let source = fragment(generator);
    let link = || -> Result<(), JsValue> {
        for (kind, text) in [
            (Gl::VERTEX_SHADER, VERTEX),
            (Gl::FRAGMENT_SHADER, source.as_str()),
        ] {
            let shader = gl
                .create_shader(kind)
                .ok_or_else(|| error("WebGL no pudo crear el shader."))?;
            gl.shader_source(&shader, text);
            gl.compile_shader(&shader);
            if gl
                .get_shader_parameter(&shader, Gl::COMPILE_STATUS)
                .as_bool()
                != Some(true)
            {
                let log = gl.get_shader_info_log(&shader).unwrap_or_default();
                gl.delete_shader(Some(&shader));
                return Err(error(&log));
            }
            gl.attach_shader(&program, &shader);
            gl.delete_shader(Some(&shader));
        }
        gl.link_program(&program);
        if gl
            .get_program_parameter(&program, Gl::LINK_STATUS)
            .as_bool()
            != Some(true)
        {
            return Err(error(
                &gl.get_program_info_log(&program).unwrap_or_default(),
            ));
        }
        Ok(())
    };
    if let Err(reason) = link() {
        gl.delete_program(Some(&program));
        return Err(reason);
    }
    let uniforms = UNIFORMS.map(|name| gl.get_uniform_location(&program, name));
    Ok(Program { program, uniforms })
}
