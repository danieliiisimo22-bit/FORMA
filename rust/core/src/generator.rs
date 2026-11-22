#[path = "fields.rs"]
mod fields;
pub use fields::GENERATORS;

pub const ALL_SYMMETRIES: &[&str] = &[
    "free",
    "mirror",
    "horizontal",
    "vertical",
    "quadrants",
    "radial",
    "kaleido",
];
pub const FAMILIES: &[(&str, &str)] = &[
    ("Gradientes", "Campos cromáticos"),
    ("Fluidos", "Corrientes y pliegues"),
    ("Geometría", "Formas y retículas"),
    ("Simetría", "Orden y reflejos"),
    ("Op Art", "Interferencia óptica"),
    ("Orgánicos", "Ruido y contornos"),
    ("Experimental", "Tramas y recursión"),
];

pub struct Parameter {
    pub label: &'static str,
    pub description: &'static str,
    pub initial: f64,
    pub safe: [f64; 2],
    pub choices: &'static [&'static str],
}

#[derive(Clone, Copy)]
pub struct Sample {
    pub x: f64,
    pub y: f64,
    pub knobs: [f64; 4],
    pub complexity: f64,
    pub phase: f64,
}

pub struct Generator {
    pub id: &'static str,
    pub family: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub palette: &'static str,
    pub seed: u32,
    pub intense: bool,
    pub parameters: [Parameter; 4],
    pub symmetry: &'static [&'static str],
    pub texture: (&'static str, f64),
    pub shader: &'static str,
    pub sample: fn(Sample) -> f64,
}

pub fn get(id: &str) -> Option<&'static Generator> {
    GENERATORS.iter().find(|generator| generator.id == id)
}

pub const VERTEX: &str = include_str!("shaders/vertex.glsl");

pub fn fragment(generator: &Generator) -> String {
    include_str!("shaders/fragment.glsl").replace("/* GENERATOR */", generator.shader)
}
