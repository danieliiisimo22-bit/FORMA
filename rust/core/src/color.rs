use crate::math::{TAU, clamp, mix, modulo, random_from};

#[path = "palettes.rs"]
mod palettes;
pub use palettes::PALETTES;
pub type Colors = [String; 5];
type Color = [f64; 3];

pub fn palette(name: &str) -> Option<Colors> {
    PALETTES
        .iter()
        .find(|item| item.0 == name)
        .map(|item| item.1.map(str::to_owned))
}

pub fn valid_hex(hex: &str) -> bool {
    let bytes = hex.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
}

fn hex_to_rgb(hex: &str) -> Color {
    if !valid_hex(hex) {
        return [0.0; 3];
    }
    [1, 3, 5].map(|i| f64::from(u8::from_str_radix(&hex[i..i + 2], 16).unwrap_or(0)) / 255.0)
}

fn rgb_to_hex(rgb: Color) -> String {
    let [r, g, b] = rgb.map(|value| (clamp(value) * 255.0).round() as u8);
    format!("#{r:02x}{g:02x}{b:02x}")
}

pub fn rgb_to_lab(rgb: Color) -> Color {
    let [r, g, b] = rgb.map(|x| {
        if x <= 0.04045 {
            x / 12.92
        } else {
            ((x + 0.055) / 1.055).powf(2.4)
        }
    });
    let l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b).cbrt();
    let m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b).cbrt();
    let s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b).cbrt();
    [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ]
}

pub fn lab_to_rgb([light, a, b]: Color) -> Color {
    let light = clamp(light);
    let linear = |factor: f64| {
        let (a, b) = (a * factor, b * factor);
        let l = (light + 0.3963377774 * a + 0.2158037573 * b).powf(3.0);
        let m = (light - 0.1055613458 * a - 0.0638541728 * b).powf(3.0);
        let s = (light - 0.0894841775 * a - 1.2914855480 * b).powf(3.0);
        [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
        ]
    };
    let in_gamut = |rgb: Color| {
        rgb.iter()
            .all(|channel| (-1e-7..=1.0 + 1e-7).contains(channel))
    };
    let mut rgb = linear(1.0);
    if !in_gamut(rgb) {
        let (mut low, mut high) = (0.0, 1.0);
        for _ in 0..15 {
            let candidate = (low + high) * 0.5;
            if in_gamut(linear(candidate)) {
                low = candidate;
            } else {
                high = candidate;
            }
        }
        rgb = linear(low);
    }
    rgb.map(|channel| {
        let x = clamp(channel);
        if x <= 0.0031308 {
            12.92 * x
        } else {
            1.055 * x.powf(1.0 / 2.4) - 0.055
        }
    })
}

pub const HARMONIES: &[(&str, &str, [f64; 5])] = &[
    ("mono", "Monocromática", [0.; 5]),
    ("analog", "Análoga", [-18., -28., 0., 20., 37.]),
    ("complement", "Complementaria", [180., 164., 0., 12., 182.]),
    (
        "split",
        "Complementaria dividida",
        [152., 205., 0., 13., 149.],
    ),
    ("triad", "Triádica", [238., 120., 0., 113., 246.]),
    ("tetrad", "Tetrádica", [92., 180., 0., 272., 12.]),
    ("tonal", "Escala tonal", [4., 2., 0., -3., -8.]),
    ("duotone", "Duotono", [150., 150., 0., 0., 0.]),
    (
        "controlled",
        "Tríada controlada",
        [132., 115., 0., 25., 231.],
    ),
];

pub struct Personality {
    pub id: &'static str,
    pub label: &'static str,
    pub harmony: &'static str,
    lights: [f64; 5],
    chroma: f64,
    shift: f64,
}

pub const PERSONALITIES: &[Personality] = &[
    Personality {
        id: "Calm",
        label: "Suave",
        harmony: "analog",
        lights: [0.33, 0.49, 0.65, 0.78, 0.94],
        chroma: 0.085,
        shift: -9.,
    },
    Personality {
        id: "Balanced",
        label: "Equilibrada",
        harmony: "analog",
        lights: [0.15, 0.30, 0.53, 0.71, 0.89],
        chroma: 0.15,
        shift: 0.,
    },
    Personality {
        id: "Bold",
        label: "Vibrante",
        harmony: "split",
        lights: [0.13, 0.29, 0.52, 0.71, 0.93],
        chroma: 0.26,
        shift: 7.,
    },
    Personality {
        id: "Editorial",
        label: "Contenida",
        harmony: "duotone",
        lights: [0.16, 0.32, 0.52, 0.69, 0.91],
        chroma: 0.10,
        shift: -4.,
    },
    Personality {
        id: "Retro",
        label: "Analógica",
        harmony: "controlled",
        lights: [0.21, 0.37, 0.57, 0.73, 0.90],
        chroma: 0.14,
        shift: 22.,
    },
    Personality {
        id: "Nocturne",
        label: "Nocturna",
        harmony: "complement",
        lights: [0.10, 0.20, 0.40, 0.62, 0.83],
        chroma: 0.20,
        shift: -27.,
    },
    Personality {
        id: "Solar",
        label: "Cálida",
        harmony: "analog",
        lights: [0.27, 0.46, 0.67, 0.81, 0.97],
        chroma: 0.18,
        shift: 23.,
    },
    Personality {
        id: "Chromatic",
        label: "Cromática",
        harmony: "tetrad",
        lights: [0.17, 0.34, 0.58, 0.75, 0.91],
        chroma: 0.22,
        shift: 0.,
    },
];

pub fn generate_colors(
    base: &Colors,
    personality: &str,
    harmony: &str,
    seed: u32,
    locks: &[usize],
) -> Colors {
    let profile = PERSONALITIES
        .iter()
        .find(|p| p.id == personality)
        .unwrap_or(&PERSONALITIES[1]);
    let offsets = HARMONIES
        .iter()
        .find(|p| p.0 == harmony)
        .unwrap_or(&HARMONIES[1])
        .2;
    let mut rng = random_from(seed ^ 0x6576c9f7);
    let [_, a, b] = rgb_to_lab(hex_to_rgb(&base[2]));
    let base_hue = if a.hypot(b) < 0.015 {
        rng() * 360.0
    } else {
        b.atan2(a) * 360.0 / TAU
    };
    let dominant = modulo(base_hue + (rng() - 0.5) * 64.0 + profile.shift, 360.0);
    std::array::from_fn(|i| {
        let light = clamp(profile.lights[i] + (rng() - 0.5) * 0.07);
        let chroma = profile.chroma * [0.37, 0.56, 1.0, 0.79, 0.43][i] * (0.86 + rng() * 0.28);
        let angle =
            (dominant + offsets[i] + (rng() - 0.5) * if harmony == "mono" { 0.0 } else { 8.0 })
                * TAU
                / 360.0;
        if locks.contains(&i) {
            base[i].clone()
        } else {
            rgb_to_hex(lab_to_rgb([
                light,
                chroma * angle.cos(),
                chroma * angle.sin(),
            ]))
        }
    })
}

pub fn build_ramp(colors: &Colors, saturation: f64) -> Vec<u8> {
    let stops = colors.each_ref().map(|hex| {
        let [light, a, b] = rgb_to_lab(hex_to_rgb(hex));
        [light, a * saturation, b * saturation]
    });
    let mut ramp = Vec::with_capacity(512 * 4);
    for i in 0..512 {
        let p = f64::from(i) / 511.0 * 4.0;
        let index = (p as usize).min(3);
        let lab =
            std::array::from_fn(|j| mix(stops[index][j], stops[index + 1][j], p - index as f64));
        ramp.extend(lab_to_rgb(lab).map(|channel| (channel * 255.0).round() as u8));
        ramp.push(255);
    }
    ramp
}

pub fn extract_colors(pixels: &[u8]) -> Colors {
    let mut samples: Vec<_> = pixels
        .chunks_exact(4)
        .step_by((pixels.len() / 4).div_ceil(1800).max(1))
        .map(|pixel| rgb_to_lab([0, 1, 2].map(|i| f64::from(pixel[i]) / 255.0)))
        .collect();
    if samples.is_empty() {
        return PALETTES[0].1.map(str::to_owned);
    }
    samples.sort_by(|a, b| a[0].total_cmp(&b[0]));
    [0.04, 0.22, 0.51, 0.78, 0.96].map(|q| {
        rgb_to_hex(lab_to_rgb(
            samples[(q * (samples.len() - 1) as f64).round() as usize],
        ))
    })
}
