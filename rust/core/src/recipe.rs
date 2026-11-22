use crate::color::{
    Colors, HARMONIES, PALETTES, PERSONALITIES, generate_colors, palette, valid_hex,
};
use crate::generator::{self, GENERATORS, Generator};
use crate::math::{TAU, random_from};
use serde::{Deserialize, Serialize};

pub const ASPECTS: &[&str] = &["1:1", "16:9", "9:16", "4:3", "3:2", "21:9", "custom"];
pub const SYMMETRIES: &[(&str, &str)] = &[
    ("free", "Libre"),
    ("mirror", "Espejo"),
    ("horizontal", "Horizontal"),
    ("vertical", "Vertical"),
    ("quadrants", "Cuadrantes"),
    ("radial", "Radial"),
    ("kaleido", "Caleidoscópica"),
];
pub const FINISHES: &[(&str, &str)] = &[
    ("none", "Sin textura"),
    ("fine", "Grano fino"),
    ("film", "Grano de película"),
    ("halftone", "Semitono"),
    ("blur", "Desenfoque"),
    ("bloom", "Halo"),
    ("vignette", "Viñeta"),
    ("posterize", "Posterización"),
    ("print", "Impresión"),
    ("analog", "Papel analógico"),
    ("aberration", "Aberración cromática"),
];

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Symmetry {
    pub mode: String,
    pub order: u8,
    pub axis: f64,
    pub phase: f64,
    pub perturbation: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Texture {
    pub finish: String,
    pub amount: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Render {
    pub dither: bool,
    pub mix: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub schema: u8,
    pub generator: String,
    pub algorithm: u8,
    pub seed: u32,
    pub palette: Colors,
    pub palette_name: String,
    pub harmony: String,
    pub personality: String,
    pub palette_locked: bool,
    pub color_locks: Vec<usize>,
    pub parameter_locks: Vec<usize>,
    pub parameters: [f64; 4],
    pub complexity: f64,
    pub contrast: f64,
    pub saturation: f64,
    pub symmetry: Symmetry,
    pub texture: Texture,
    pub aspect: String,
    pub custom_aspect: [u32; 2],
    pub render: Render,
}

pub const INVALID_RECIPE: &str = "La receta es inválida o pertenece a una versión incompatible.";

impl Recipe {
    pub fn preset(generator: &Generator) -> Self {
        Self {
            schema: 1,
            generator: generator.id.into(),
            algorithm: 1,
            seed: generator.seed,
            palette: palette(generator.palette).expect("registered palette"),
            palette_name: generator.palette.into(),
            harmony: "analog".into(),
            personality: "Balanced".into(),
            palette_locked: false,
            color_locks: vec![],
            parameter_locks: vec![],
            parameters: generator.parameters.each_ref().map(|p| p.initial),
            complexity: 0.56,
            contrast: 1.0,
            saturation: 1.0,
            symmetry: Symmetry {
                mode: "free".into(),
                order: 6,
                axis: 0.0,
                phase: 0.0,
                perturbation: 0.0,
            },
            texture: Texture {
                finish: generator.texture.0.into(),
                amount: generator.texture.1,
            },
            aspect: "3:2".into(),
            custom_aspect: [3, 2],
            render: Render {
                dither: true,
                mix: 0.0,
            },
        }
    }

    pub fn validate(&self) -> Result<(), &'static str> {
        let Some(g) = generator::get(&self.generator) else {
            return Err(INVALID_RECIPE);
        };
        let indices = |values: &[usize], limit| {
            values
                .iter()
                .enumerate()
                .all(|(i, item)| *item < limit && !values[..i].contains(item))
        };
        let [width, height] = self.custom_aspect;
        let unit = |value| (0.0..=1.0).contains(&value);
        let valid = self.schema == 1
            && self.algorithm == 1
            && self.palette.iter().all(|hex| valid_hex(hex))
            && valid_name(&self.palette_name)
            && HARMONIES.iter().any(|item| item.0 == self.harmony)
            && PERSONALITIES.iter().any(|item| item.id == self.personality)
            && indices(&self.color_locks, 5)
            && indices(&self.parameter_locks, 4)
            && self.parameters.iter().copied().all(unit)
            && unit(self.complexity)
            && (0.45..=1.65).contains(&self.contrast)
            && (0.0..=1.65).contains(&self.saturation)
            && g.symmetry.contains(&self.symmetry.mode.as_str())
            && (2..=16).contains(&self.symmetry.order)
            && (-TAU..=TAU).contains(&self.symmetry.axis)
            && (-TAU..=TAU).contains(&self.symmetry.phase)
            && unit(self.symmetry.perturbation)
            && FINISHES.iter().any(|entry| entry.0 == self.texture.finish)
            && unit(self.texture.amount)
            && ASPECTS.contains(&self.aspect.as_str())
            && (1..=100).contains(&width)
            && (1..=100).contains(&height)
            && width.max(height) <= 8 * width.min(height)
            && unit(self.render.mix);
        valid.then_some(()).ok_or(INVALID_RECIPE)
    }

    pub fn generator(&self) -> &'static Generator {
        generator::get(&self.generator).expect("validated generator")
    }

    pub fn ratio(&self) -> f64 {
        match self.aspect.as_str() {
            "16:9" => 16.0 / 9.0,
            "9:16" => 9.0 / 16.0,
            "4:3" => 4.0 / 3.0,
            "3:2" => 1.5,
            "21:9" => 21.0 / 9.0,
            "custom" => f64::from(self.custom_aspect[0]) / f64::from(self.custom_aspect[1]),
            _ => 1.0,
        }
    }

    pub fn same_composition(&self, other: &Self) -> bool {
        self.seed == other.seed && self.generator == other.generator
    }

    pub fn variant(&self, seed: u32, strength: f64) -> Self {
        let mut result = self.clone();
        result.seed = seed;
        let mut rng = random_from(seed ^ 0xaa94b);
        for (index, parameter) in self.generator().parameters.iter().enumerate() {
            let value = self.parameters[index];
            let next = value + (rng() - 0.5) * strength;
            if parameter.choices.is_empty() && !self.parameter_locks.contains(&index) {
                result.parameters[index] =
                    next.clamp(value.min(parameter.safe[0]), value.max(parameter.safe[1]));
            }
        }
        result
    }

    pub fn explore(&self, seed: u32) -> Self {
        let generator = self.generator();
        let family: Vec<_> = GENERATORS
            .iter()
            .filter(|g| g.family == generator.family)
            .collect();
        let current = family.iter().position(|g| g.id == self.generator).unwrap();
        let mut result = self.clone();
        if self.parameter_locks.is_empty() && family.len() > 1 {
            let next = family[(current + 1) % family.len()];
            result.generator = next.id.into();
            result.parameters = next.parameters.each_ref().map(|p| p.initial);
            if !next.symmetry.contains(&self.symmetry.mode.as_str()) {
                result.symmetry.mode = "free".into();
            }
        }
        result = result.variant(seed, 0.68);
        result.complexity = 0.27 + random_from(seed ^ 0x57d9)() * 0.51;
        result
    }

    pub fn surprise(&self, seed: u32) -> Self {
        let mut rng = random_from(seed);
        let safe: Vec<_> = GENERATORS
            .iter()
            .filter(|g| !g.intense && g.family != self.generator().family)
            .collect();
        let mut result =
            Self::preset(safe[(rng() * safe.len() as f64) as usize]).variant(seed, 0.32);
        if !self.palette_locked && rng() < 0.45 {
            let (name, colors) = PALETTES[(rng() * PALETTES.len() as f64) as usize];
            result.palette_name = name.into();
            result.palette = generate_colors(
                &colors.map(str::to_owned),
                &self.personality,
                &self.harmony,
                seed,
                &[],
            );
        }
        result.personality.clone_from(&self.personality);
        result.harmony.clone_from(&self.harmony);
        result.keep_palette_and_aspect(self);
        result
    }

    pub fn mutate(&self, seed: u32, count: usize) -> Vec<Self> {
        let mut rng = random_from(seed);
        let mut seeds = vec![self.seed];
        let mut result = Vec::with_capacity(count);
        while result.len() < count {
            let child = (rng() * 4_294_967_296.0) as u32;
            if !seeds.contains(&child) {
                seeds.push(child);
                result.push(self.variant(child, 0.14 + result.len() as f64 / count as f64 * 0.31));
            }
        }
        result
    }

    pub fn keep_palette_and_aspect(&mut self, source: &Self) {
        if source.palette_locked {
            self.palette.clone_from(&source.palette);
        }
        for &index in &source.color_locks {
            self.palette[index].clone_from(&source.palette[index]);
        }
        if source.palette_locked || !source.color_locks.is_empty() {
            self.palette_name.clone_from(&source.palette_name);
        }
        self.palette_locked = source.palette_locked;
        self.color_locks.clone_from(&source.color_locks);
        self.aspect.clone_from(&source.aspect);
        self.custom_aspect = source.custom_aspect;
    }

    pub fn use_colors(&mut self, name: impl Into<String>, colors: Colors) {
        if self.palette_locked {
            return;
        }
        self.palette_name = name.into();
        for (i, hex) in colors.into_iter().enumerate() {
            if !self.color_locks.contains(&i) {
                self.palette[i] = hex;
            }
        }
    }
}

pub fn valid_name(value: &str) -> bool {
    !value.trim().is_empty() && value.encode_utf16().count() <= 70
}
