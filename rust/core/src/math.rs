pub use std::f64::consts::{PI, TAU};

pub fn clamp(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

pub fn mix(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

pub fn fract(value: f64) -> f64 {
    value - value.floor()
}

pub fn modulo(value: f64, period: f64) -> f64 {
    value - period * (value / period).floor()
}

pub fn smooth(a: f64, b: f64, value: f64) -> f64 {
    let t = clamp((value - a) / (b - a));
    t * t * (3.0 - 2.0 * t)
}

pub fn hash(x: f64, y: f64) -> f64 {
    let a = fract(x * 0.1031);
    let b = fract(y * 0.1031);
    let c = a;
    let dot = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
    fract(((a + dot) + (b + dot)) * (c + dot))
}

pub fn noise(x: f64, y: f64) -> f64 {
    let (ix, iy) = (x.floor(), y.floor());
    let fx = smooth(0.0, 1.0, fract(x));
    let fy = smooth(0.0, 1.0, fract(y));
    mix(
        mix(hash(ix, iy), hash(ix + 1.0, iy), fx),
        mix(hash(ix, iy + 1.0), hash(ix + 1.0, iy + 1.0), fx),
        fy,
    )
}

pub fn fbm(x: f64, y: f64) -> f64 {
    0.57 * noise(x, y)
        + 0.28 * noise(2.07 * x + 7.2, 2.07 * y + 3.1)
        + 0.15 * noise(4.17 * x - 2.3, 4.17 * y + 8.4)
}

pub fn rotate(x: f64, y: f64, angle: f64) -> [f64; 2] {
    let (sin, cos) = angle.sin_cos();
    [x * cos - y * sin, x * sin + y * cos]
}

pub fn random_from(mut state: u32) -> impl FnMut() -> f64 {
    move || {
        state = state.wrapping_add(0x6d2b79f5);
        f64::from(crate::forma_random_word(state)) / 4_294_967_296.0
    }
}
