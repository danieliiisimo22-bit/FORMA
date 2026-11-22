use crate::color::build_ramp;
use crate::generator::Sample;
use crate::math::*;
use crate::recipe::{Recipe, Symmetry};

pub const MAX_PIXELS: u32 = 34_000_000;
pub const MAX_SIDE: u32 = 8192;
pub const INVALID_SIZE: &str =
    "Usa dimensiones enteras entre 16 y 8192 px, con un máximo de 34 megapíxeles.";

pub fn validate_size(width: u32, height: u32) -> Result<(), &'static str> {
    ((16..=MAX_SIDE).contains(&width)
        && (16..=MAX_SIDE).contains(&height)
        && width * height <= MAX_PIXELS)
        .then_some(())
        .ok_or(INVALID_SIZE)
}

pub fn resolution(recipe: &Recipe, short_side: u32) -> [u32; 2] {
    let aspect = recipe.ratio();
    let short = f64::from(short_side);
    let (width, height) = if aspect >= 1.0 {
        ((short * aspect).round(), short)
    } else {
        (short, (short / aspect).round())
    };
    let factor = 1.0_f64
        .min(f64::from(MAX_SIDE) / width.max(height))
        .min((f64::from(MAX_PIXELS) / (width * height)).sqrt());
    [
        (width * factor).floor() as u32,
        (height * factor).floor() as u32,
    ]
}

#[derive(Clone, Copy)]
pub struct Tile {
    pub width: u32,
    pub height: u32,
    pub x: u32,
    pub y: u32,
    pub full_width: u32,
    pub full_height: u32,
}

impl Tile {
    pub fn full(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            x: 0,
            y: 0,
            full_width: width,
            full_height: height,
        }
    }
}

pub fn fold(mut x: f64, mut y: f64, symmetry: &Symmetry) -> [f64; 2] {
    let mode = symmetry.mode.as_str();
    if mode == "free" {
        return [x, y];
    }
    [x, y] = rotate(x, y, -symmetry.axis);
    if matches!(mode, "horizontal" | "quadrants") {
        y = y.abs();
    }
    if matches!(mode, "mirror" | "vertical" | "quadrants") {
        x = x.abs();
    }
    if matches!(mode, "radial" | "kaleido") {
        let radius = x.hypot(y);
        let order = f64::from(symmetry.order);
        let sector = TAU / order;
        let mut angle = modulo(y.atan2(x) - symmetry.phase + sector * 0.5, sector) - sector * 0.5;
        if mode == "kaleido" {
            angle = angle.abs();
        }
        angle += symmetry.perturbation * 0.25 * (radius * 6.0 + angle * order).sin();
        x = angle.cos() * radius;
        y = angle.sin() * radius;
    } else {
        x += symmetry.perturbation * (y * 7.0 + symmetry.phase).sin() * 0.07;
        y += symmetry.perturbation * (x * 7.0 - symmetry.phase).sin() * 0.07;
    }
    rotate(x, y, symmetry.axis)
}

pub struct Scene<'a> {
    pub recipe: &'a Recipe,
    pub phase: f64,
    pub tilt: f64,
    pub scale: f64,
    pub dx: f64,
    pub dy: f64,
    pub ramp: Vec<u8>,
}

impl<'a> Scene<'a> {
    pub fn new(recipe: &'a Recipe) -> Self {
        let generator = recipe.generator();
        let mut rng = random_from(recipe.seed);
        let phase = rng() * TAU;
        let tilt = (rng() - 0.5)
            * if generator.family == "Geometría" {
                0.20
            } else {
                0.52
            };
        let scale = 0.90 + rng() * 0.24;
        let centered = if generator.family == "Simetría" {
            0.35
        } else {
            1.0
        };
        let dx = (rng() - 0.5) * 0.46 * centered;
        let dy = (rng() - 0.5) * 0.29 * centered;
        Self {
            recipe,
            phase,
            tilt,
            scale,
            dx,
            dy,
            ramp: build_ramp(&recipe.palette, recipe.saturation),
        }
    }

    pub fn cpu_pixels(&self, tile: Tile) -> Vec<u8> {
        let r = self.recipe;
        let sample = r.generator().sample;
        let finish = r.texture.finish.as_str();
        let amount = r.texture.amount;
        let inv = 1.0 / f64::from(tile.full_width.min(tile.full_height));
        let seed = r.seed & 0xffff;
        let technical = u8::from(r.render.dither) as f64;
        let (tilt_sin, tilt_cos) = self.tilt.sin_cos();
        let tone = |x, y| {
            let [x, y] = fold(x, y, &r.symmetry);
            let (x, y) = (
                (x * tilt_cos - y * tilt_sin) * self.scale + self.dx,
                (x * tilt_sin + y * tilt_cos) * self.scale + self.dy,
            );
            let mut t = sample(Sample {
                x,
                y,
                knobs: r.parameters,
                complexity: r.complexity,
                phase: self.phase,
            });
            if r.render.mix != 0.0 {
                let accent = 0.5
                    + 0.5
                        * ((x * 0.72 - y * 0.43) * TAU + self.phase + modulo(noise(x, y), 1.0))
                            .sin();
                t = mix(t, t * 0.48 + accent * 0.52, r.render.mix);
            }
            clamp((t - 0.5) * r.contrast + 0.5)
        };
        let channel = |t, j: usize| {
            let u = clamp(t) * 511.0;
            let left = (u as usize).min(510);
            mix(
                f64::from(self.ramp[left * 4 + j]),
                f64::from(self.ramp[left * 4 + j + 4]),
                u - left as f64,
            )
        };
        let coordinate = |p, total| (2.0 * (f64::from(p) + 0.5) - f64::from(total)) * inv;
        let mut pixels = Vec::with_capacity(tile.width as usize * tile.height as usize * 4);
        for iy in tile.y..tile.y + tile.height {
            let y = coordinate(iy, tile.full_height);
            for ix in tile.x..tile.x + tile.width {
                let x = coordinate(ix, tile.full_width);
                let mut t = tone(x, y);
                let rnd = pixel_noise(ix, iy, seed);
                match finish {
                    "halftone" => {
                        t += (0.5 - (fract(x * 58.0) - 0.5).hypot(fract(y * 58.0) - 0.5))
                            * amount
                            * 0.40
                    }
                    "blur" => {
                        let offset = 0.015 + amount * 0.050;
                        t = mix(
                            t,
                            (tone(x + offset, y)
                                + tone(x - offset, y)
                                + tone(x, y + offset)
                                + tone(x, y - offset))
                                * 0.25,
                            amount,
                        );
                    }
                    "bloom" => {
                        t += (t
                            .max(tone(x + 0.055, y + 0.018))
                            .max(tone(x - 0.055, y - 0.018))
                            - 0.48)
                            .max(0.0)
                            * amount
                            * 0.33
                    }
                    "vignette" => t -= smooth(0.45, 1.9, x.hypot(y)) * amount * 0.26,
                    "posterize" => {
                        let levels = 21.0 - (17.0 * amount).floor();
                        t = mix(t, (t * levels + 0.5).floor() / levels, amount);
                    }
                    "print" => t += ((x * 122.0 + y * 168.0).cos() * 0.038 + rnd * 0.039) * amount,
                    "analog" => t += (fbm(x * 94.0, y * 94.0) - 0.5) * amount * 0.15,
                    _ => {}
                }
                let grain = rnd * technical
                    + match finish {
                        "fine" => rnd * amount * 0.12 * 255.0,
                        "film" => {
                            (rnd * 0.091 + (noise(x * 176.0, y * 176.0) - 0.5) * 0.13)
                                * amount
                                * 255.0
                        }
                        _ => 0.0,
                    };
                let offset = amount * 0.026;
                let shades = if finish == "aberration" {
                    [tone(x + offset, y), t, tone(x - offset, y)]
                } else {
                    [t; 3]
                };
                pixels.extend(
                    [0, 1, 2].map(|j| (channel(shades[j], j) + grain).round_ties_even() as u8),
                );
                pixels.push(255);
            }
        }
        pixels
    }
}

fn pixel_noise(x: u32, y: u32, seed: u32) -> f64 {
    let mut h = (x + 313 * seed)
        .wrapping_mul(374761393)
        .wrapping_add((y + 17).wrapping_mul(668265263));
    h = (h ^ (h >> 13)).wrapping_mul(1274126177);
    f64::from((h ^ (h >> 16)) & 65535) / 65535.0 - 0.5
}
