use super::{ALL_SYMMETRIES, Generator, Parameter, Sample};
use crate::math::*;

const SQRT_3: f64 = 1.7320508075688772;

fn shape_edge(kind: f64, x: f64, y: f64) -> f64 {
    let h = x.abs();
    if kind == 0.0 {
        return x.hypot(y) - 1.0;
    }
    if kind == 1.0 {
        return h.max(y.abs()) - 0.79;
    }
    if kind == 2.0 {
        return (y - 0.5).max(SQRT_3 / 2.0 * h - 0.5 * y - 0.5);
    }
    h.max(0.5 * h + SQRT_3 / 2.0 * y.abs()) - SQRT_3 / 2.0
}

fn silk(input: Sample) -> f64 {
    let Sample {
        mut x,
        mut y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    y +=
        (0.16 + a * 0.55) * f64::sin(x * (1.25 + b * 1.4) + s) + 0.17 * f64::cos(x * 3.1 - s * 0.7);
    x += 0.24 * f64::sin(y * 3.4 + s * 0.5);
    let q =
        (y + 0.23 * f64::sin(x * 2.8 + y * 3.9 + s) + 0.16 * f64::sin(x * 3.2 - y * 2.7 - s)) * 1.2;
    let folds = f64::cos(q * (7.2 + k * 8.0) + x * (1.12 + d) + 1.1 * f64::sin(x * 2.25 + y * 1.7));
    let body = f64::exp(
        -f64::powf(f64::abs(y) * (1.3 + 0.74 * b), 2.0) - f64::powf(f64::abs(x) * 0.42, 4.0),
    );
    let light = (0.39 + 0.52 * f64::powf(0.5 + 0.5 * folds, 1.58)) * body;
    let lines = f64::sin(q * (120.0 + c * 143.0) + x * 13.0 + 7.0 * f64::sin(y * 3.1 + x));
    let satin = 0.5 + 0.5 * f64::sin(x * 2.4 - y * 3.2 + s);
    0.033
        + light * (0.72 + 0.32 * satin)
        + lines * (0.014 + 0.044 * body)
        + 0.036 * f64::sin(q * 26.0 - x * 3.0) * body
}

fn atmosphere(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let main = f64::exp(
        -f64::powf((x - 0.53 * f64::sin(s)) * (0.61 + a * 0.71), 2.0)
            - f64::powf((y - b * 1.6 + 0.8) * (1.03 + a * 0.9), 2.0),
    );
    let other =
        f64::exp(-f64::powf((x + c * 2.0 - 1.0) * 0.69, 2.0) - f64::powf((y + 0.64) * 1.64, 2.0));
    let scale = 0.6 + k * 2.8;
    0.06 + 0.61 * main + 0.43 * other - 0.28 * main * other
        + (fbm(x * scale + s, y * scale + s) - 0.49) * d * 0.48
}

fn modules(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let scale = 1.7 + a * 4.0 + k * 1.7;
    let px = x * scale + 0.26;
    let py = y * scale + 0.51;
    let h = hash(
        f64::floor(px) + f64::floor(s * 19.0),
        f64::floor(py) + f64::floor(s * 19.0),
    );
    if h < c * 0.34 {
        return 0.89;
    }
    let mut fx = fract(px);
    let mut fy = fract(py);
    if h < 0.5 {
        fx = 1.0 - fx;
    }
    if h > 0.75 {
        fy = 1.0 - fy;
    }
    let edge = f64::min(f64::min(f64::min(fx, 1.0 - fx), fy), 1.0 - fy);
    if edge < d * 0.09 {
        return 0.89;
    }
    let shape = if h > 0.56 {
        fy <= fx
    } else {
        f64::hypot(fx, fy) <= 0.35 + b * 0.57
    };
    (if shape { 0.58 } else { 0.1 }) + h * 0.36
}

fn kaleid(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let r = f64::hypot(x, y);
    let angle = f64::atan2(y, x);
    let count = f64::floor(4.0 + a * 13.0);
    let phase = angle * count + s * 0.35;
    let f = r * (5.0 + k * 11.0) + f64::cos(phase) * b * 1.12;
    let rings = 0.5 + 0.5 * f64::cos(f * 2.0);
    let leaf = 0.5 + 0.5 * f64::cos(phase - r * 2.7);
    let envelope = 1.0 - smooth(0.42 + d * 0.33, 0.63 + d * 0.33, r);
    0.05 + (0.21 + 0.46 * f64::powf(rings, 1.5) + c * 0.37 * leaf) * envelope
}

fn moire(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let f = 12.0 + a * 36.0 + k * 13.0;
    let p = x * f + y * y * (2.1 + c * 12.0) + s;
    let q = x * (f + b * 7.3) + y * (0.45 + b * 4.1) + f64::cos(y * 2.6 + s) * (1.0 + c * 4.0);
    let beat = 0.5 + 0.5 * f64::cos(p - q);
    0.48 + beat * (0.16 + d * 0.24) - (f64::cos(p) + f64::cos(q)) * 0.5 * (0.12 + (1.0 - d) * 0.3)
}

fn terrain(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let px = x * (0.72 + a * 2.7) + s;
    let py = y * (0.72 + a * 2.7) + s;
    let bend = fbm(px * 0.72, py * 0.72);
    let mut n = fbm(px + bend * b * 3.6, py - bend * b * 2.8);
    n = clamp(n * 0.75 + 0.23 * f64::exp(-(x * x + y * y) * 0.39));
    let v = fract(n * (7.0 + c * 18.0 + k * 12.0));
    let ink = 1.0 - smooth(d * 0.19, d * 0.19 + 0.045, f64::min(v, 1.0 - v));
    0.24 + n * 0.67 - ink * 0.32
}

fn print(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let scale = 7.0 + a * 17.0 + k * 11.0;
    let n = fbm(x * 1.53 + s, y * 1.53 + s);
    let m = 0.5 + 0.5 * f64::cos(x * 2.7 + y * 1.6 + s);
    let angle = 0.19 + d * 0.5;
    let dots = f64::hypot(fract(x * scale) - 0.5, fract(y * scale) - 0.5);
    let dots2 = f64::hypot(
        fract((x * f64::cos(angle) - y * f64::sin(angle)) * scale + b * 0.53) - 0.5,
        fract((x * f64::sin(angle) + y * f64::cos(angle)) * scale + b * 0.71) - 0.5,
    );
    let arc = f64::hypot(x - 0.62 * f64::sin(s * 1.1), y - 0.54 * f64::cos(s)) * 1.8;
    let ink_mass = 0.5 + 0.5 * f64::cos(arc + y * 0.91 + s * 0.22);
    let cover = smooth(0.2, 0.66, n * 0.35 + ink_mass * 0.65);
    let overprint = smooth(0.3, 0.75, 0.69 * m + 0.31 * n);
    let ink = cover * (1.0 - smooth(0.03 + cover * c * 0.5, 0.06 + cover * c * 0.5, dots));
    let ink2 = overprint
        * (1.0
            - smooth(
                0.05 + overprint * c * 0.44,
                0.08 + overprint * c * 0.44,
                dots2,
            ));
    0.94 - ink * 0.54 - ink2 * 0.4
}

fn iridescence(input: Sample) -> f64 {
    let Sample {
        mut x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    x += d - 0.5;
    let scale = 0.75 + a * 2.6;
    let f = f64::sin(x * scale + (0.4 + b * 2.0) * f64::sin(y * 1.93 + s));
    let g = f64::cos(y * scale + (0.4 + b * 2.0) * f64::sin(x * 1.57 - s));
    let angular = f64::cos(f64::atan2(y, x) * 3.0 - f64::hypot(x, y) * (2.0 + k * 5.0) + s);
    0.5 + f * 0.28 + g * 0.19 * c + angular * 0.18
}

fn vortex(input: Sample) -> f64 {
    let Sample {
        mut x,
        mut y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    x += (c - 0.5) * 1.7;
    y -= 0.2 * f64::sin(s);
    let r = f64::hypot(x, y);
    let theta = f64::atan2(y, x) + (2.0 + a * 13.0) * f64::exp(-r * 1.02);
    let n = fbm(
        f64::cos(theta) * r * (1.2 + k * 5.0) + s,
        f64::sin(theta) * r * (1.2 + k * 5.0) + s,
    );
    let ripple = 0.5 + 0.5 * f64::sin(r * 16.0 + theta * 3.0 + b * 12.0 * n);
    0.12 + 0.59 * n + (0.14 + 0.42 * d) * f64::powf(ripple, 2.5) * f64::exp(-r * 0.55)
}

fn arches(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let xx = x * (1.5 + a * 3.1) + (s - 3.14) * 0.08;
    let j = hash(f64::floor(xx), f64::floor(s * 10.0));
    let r = f64::hypot(
        fract(xx) - 0.5,
        f64::max(y + (j - 0.5) * c * 1.9, 0.0) * (0.7 + d),
    );
    if r > 0.45 {
        0.94
    } else {
        if fract(r * (4.0 + k * 10.0)) >= b * 0.73 {
            0.8
        } else {
            0.18 + j * 0.37
        }
    }
}

fn cells(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let scale = 1.45 + a * 3.7 + k * 2.2;
    let px = x * scale + s;
    let py = y * scale + s;
    let gx = f64::floor(px);
    let gy = f64::floor(py);
    let mut first = 10.0;
    let mut second = 10.0;
    let mut id = 0.0;
    for j in -1..=1 {
        let j = f64::from(j);
        for i in -1..=1 {
            let i = f64::from(i);
            let vx = i + 0.5 + (hash(gx + i, gy + j) - 0.5) * b - fract(px);
            let vy = j + 0.5 + (hash(gx + i + 21.7, gy + j + 21.7) - 0.5) * b - fract(py);
            let dist = vx * vx + vy * vy;
            if dist < first {
                second = first;
                first = dist;
                id = hash(gx + i + 11.0, gy + j + 11.0);
            } else if dist < second {
                second = dist;
            }
        }
    }
    let edge = smooth(0.006, 0.03 + c * 0.13, f64::sqrt(second) - f64::sqrt(first));
    mix(0.13, 0.47 + id * 0.4 - d * f64::sqrt(first) * 0.37, edge)
}

fn fracture(input: Sample) -> f64 {
    let Sample {
        mut x,
        mut y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    x *= 0.74;
    y *= 0.74;
    let mut t = 1.0;
    let angle = 0.14 + b * 0.78 + s * 0.033;
    for i in 0..6 {
        let i = f64::from(i);
        if i > 2.0 + k * 4.0 {
            break;
        }
        let px = f64::abs(x * f64::cos(angle) - y * f64::sin(angle)) - (0.48 + a * 0.36);
        let py = f64::abs(x * f64::sin(angle) + y * f64::cos(angle)) - (0.36 + d * 0.36);
        t = f64::min(t, f64::abs(px) * f64::powf(1.24, i));
        x = px * 1.29 + 0.11;
        y = py * 1.29 - 0.1;
    }
    0.13 + 0.61 * f64::exp(-t * (9.5 + c * 12.0)) + 0.15 * f64::cos(f64::hypot(x, y) * 6.0 + s)
}

fn facets(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let scale = 1.1 + a * 3.2 + k * 1.7;
    let [rx, ry] = rotate(x, y, (b - 0.5) * 1.05);
    let u = (rx - ry / SQRT_3) * scale;
    let v = ry * 2.0 / SQRT_3 * scale;
    let mut fu = fract(u);
    let mut fv = fract(v);
    let face = if fu + fv >= 1.0 { 1.0 } else { 0.0 };
    if face != 0.0 {
        fu = 1.0 - fu;
        fv = 1.0 - fv;
    }
    let edge = f64::min(f64::min(fu, fv), 1.0 - fu - fv);
    let h = hash(
        f64::floor(u) + f64::floor(s * 13.0),
        f64::floor(v) + face * 23.0,
    );
    let tone = 0.18 + face * 0.28 + h * 0.22 + d * 0.28 * (1.0 - fu - fv);
    mix(0.07, tone, smooth(c * 0.075, c * 0.075 + 0.013, edge))
}

fn isometric(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let scale = 2.2 + a * 5.2 + k * 2.6;
    let px = x * scale;
    let py = y * scale;
    let first_x = modulo(px + SQRT_3 / 2.0, SQRT_3) - SQRT_3 / 2.0;
    let first_y = modulo(py + 1.5, 3.0) - 1.5;
    let second_x = modulo(px, SQRT_3) - SQRT_3 / 2.0;
    let second_y = modulo(py, 3.0) - 1.5;
    let first = first_x * first_x + first_y * first_y < second_x * second_x + second_y * second_y;
    let fx = if first { first_x } else { second_x };
    let fy = if first { first_y } else { second_y };
    let face = f64::floor(modulo(f64::atan2(fy, fx) + TAU * 5.0 / 12.0, TAU) / (TAU / 3.0));
    let light = if face == 0.0 {
        1.0
    } else {
        if face == 1.0 { 0.0 } else { 0.45 }
    };
    let edge = SQRT_3 / 2.0
        - f64::max(
            f64::abs(fx),
            0.5 * f64::abs(fx) + SQRT_3 / 2.0 * f64::abs(fy),
        );
    let offset = f64::floor(s * 17.0);
    let h = hash(
        f64::floor((px - fx) * 2.0 / SQRT_3 + 0.5) + offset,
        f64::floor((py - fy) * 2.0 / 3.0 + 0.5) + offset,
    );
    let tone = 0.29 + light * (0.24 + b * 0.31) + (h - 0.5) * d * 0.27;
    mix(0.09, tone, smooth(c * 0.16, c * 0.16 + 0.022, edge))
}

fn truchet(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let scale = 1.45 + a * 3.2 + k * 2.0;
    let px = x * scale + 0.37;
    let py = y * scale + 0.62;
    let offset = f64::floor(s * 29.0);
    let h = hash(f64::floor(px) + offset, f64::floor(py) + offset);
    let fx = if h < 0.13 + d * 0.74 {
        1.0 - fract(px)
    } else {
        fract(px)
    };
    let fy = fract(py);
    let edge = f64::min(
        f64::abs(f64::hypot(fx, fy) - 0.5),
        f64::abs(f64::hypot(1.0 - fx, 1.0 - fy) - 0.5),
    );
    let width = 0.046 + b * 0.124;
    let ribbon = 1.0 - smooth(width, width + 0.016, edge);
    let stripe = 1.0 - smooth(width * 0.19, width * 0.37, edge);
    mix(0.13, 0.79 - c * 0.41 * stripe, ribbon)
}

fn silhouettes(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let kind = f64::min(f64::floor(a * 4.0), 3.0);
    let [px, py] = rotate(x, y, (d - 0.5) * 1.57);
    let scale = 0.34 + b * 0.42;
    let shift_x = 0.13 + c * 0.36;
    let shift_y = -0.06 - c * 0.13;
    let main_x = (px + shift_x * 0.31) / scale;
    let main_y = (py + shift_y * 0.31) / scale;
    let echo_scale = scale * (0.72 + k * 0.16);
    let main_edge = shape_edge(kind, main_x, main_y);
    let echo_edge = shape_edge(
        kind,
        (px - shift_x) / echo_scale,
        (py - shift_y) / echo_scale,
    );
    let bg = 0.07 + 0.13 * f64::exp(-(px * px + py * py) * 0.72);
    let fill = 0.64 + 0.19 * clamp(main_x * 0.3 - main_y * 0.24 + 0.5);
    let rim = smooth(-0.065, -0.035, main_edge) * (0.04 + 0.08 * k);
    let base = mix(
        bg,
        0.4 + 0.06 * f64::sin(s),
        1.0 - smooth(-0.012, 0.014, echo_edge),
    );
    mix(base, fill + rim, 1.0 - smooth(-0.012, 0.014, main_edge))
}

fn dunes(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let phase = x * 1.42 + s + 0.86 * y;
    let wave =
        (0.13 + b * 0.38) * (f64::sin(phase) + 0.3 * f64::cos(x * 2.81 - y * 1.2 + s * 0.73));
    let ground = y + 0.78 - d * 1.14 - wave;
    let bands = ground * (1.7 + a * 3.2 + k * 1.35);
    let depth = fract(bands);
    let light = 0.5 + 0.5 * f64::cos(phase);
    let glow = 0.5 + 0.5 * f64::cos(x * 1.26 + s * 0.6);
    let sky = 0.44 + 0.27 * f64::exp(-f64::abs(ground) * 1.75) * (0.58 + 0.42 * glow);
    let far = f64::exp(-f64::max(f64::floor(bands), 0.0) * 0.4);
    let sand = 0.66 + 0.13 * light + 0.1 * far
        - (0.16 + c * 0.35) * f64::exp(-depth * (1.6 + light * 1.4)) * (1.0 - 0.61 * far)
        + 0.028 * f64::sin(depth * 40.0 + x * 1.7) * depth * (1.0 - depth) * (1.0 - far);
    mix(sky, sand, smooth(-0.008, 0.008, ground))
}

fn branches(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let t = (1.16 - y) / 1.97;
    let spine = 0.24 * f64::sin(t * 2.6 + s) + b * 0.42 * (t - 0.35);
    let dx = x - spine;
    let reach = f64::abs(dx);
    let lean = reach * (0.24 + b * 0.22) + f64::powf(reach, 1.6) * 0.16;
    let rows = 6.0 + c * 6.0 + k * 3.0;
    let stagger = if dx >= 0.0 { 0.28 } else { -0.18 };
    let branch = (t - lean) * rows + stagger;
    let root = (f64::floor(branch) + 0.5 - stagger) / rows;
    let canopy = f64::powf(f64::max(0.0, f64::sin(clamp(root) * PI)), 0.93);
    let span = f64::max(
        0.001,
        (0.37 + a * 0.68) * canopy * (1.0 - 0.28 * clamp(root)),
    );
    let taper = 1.0 - smooth(0.0, span, reach);
    let bend = f64::abs(fract(branch) - 0.5) / rows;
    let width = (0.003 + d * 0.013) * (0.22 + 0.78 * taper);
    let rib = 1.0 - smooth(width, width + 0.005, bend);
    let twig_distance =
        f64::abs((fract(reach * (9.0 + 4.0 * k)) - 0.5) * 0.072 + bend * 0.81 - 0.022);
    let twig = (1.0 - smooth(0.002 + d * 0.002, 0.007 + d * 0.003, twig_distance))
        * smooth(0.006, 0.02, reach)
        * (1.0 - smooth(0.033, 0.046, bend));
    let leaf = f64::max(rib * (0.42 + 0.46 * taper), twig * (0.14 + 0.42 * taper));
    let growth = smooth(0.035, 0.16, root) * (1.0 - smooth(0.86, 1.0, root));
    let stem_width = (0.012 + d * 0.021) * (1.0 - 0.8 * clamp(t));
    let stem = (1.0 - smooth(stem_width, stem_width + 0.008, reach)) * (1.0 - smooth(0.9, 1.0, t));
    let mist = 0.08 + 0.22 * f64::exp(-reach * 1.85 - f64::abs(t - 0.57) * 1.6);
    mist + f64::max(
        0.55 * stem,
        leaf * growth * (1.0 - smooth(0.8, 1.0, reach / span)),
    ) * 0.75
}

fn ribbons(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let u = y
        + (d - 0.5) * x
        + (0.27 + a * 0.83) * f64::sin(x * 1.55 + s + 0.32 * y)
        + 0.17 * f64::cos(x * 3.0 - y * 1.2 + s * 0.65);
    let f = fract(u * (2.15 - b * 0.95 + k * 0.7) + s * 0.21);
    let face = smooth(0.0, 0.45, f) * (1.0 - 0.15 * f);
    let shade = 0.18 + 0.25 * (0.5 + 0.5 * f64::sin(x * 1.9 - y * 1.2 + s));
    0.025 + face * (0.4 + shade) + smooth(0.86, 0.995, f) * c * 0.23
}

fn nacre(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let u = (y + (d - 0.5) * x) * (1.8 + a * 3.1)
        + b * 2.3 * f64::sin(x * 1.71 + s)
        + 0.42 * f64::cos(y * 1.88 - x * 2.3 + s * 0.7);
    let wave = f64::sin(u + 0.34 * f64::sin(u * 2.0));
    let specular = f64::exp(-f64::abs(wave) * (8.0 + k * 10.0)) * smooth(-0.4, 0.55, f64::cos(u));
    0.47 + wave * 0.31 + 0.12 * f64::sin(x * 1.7 - y * 0.83 + s) + specular * (0.1 + c * 0.37)
}

fn diffuse(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let qx = (x - 0.39 * f64::cos(s)) * (1.35 - a * 0.92);
    let qy = (y + (b - 0.5) * 1.9 + 0.28 * f64::sin(s)) * (1.45 - d * 0.68);
    let main = f64::exp(-qx * qx - qy * qy);
    let rx = (x + 0.56 * f64::sin(s)) * 0.71;
    let ry = (y - 0.61) * 1.71;
    0.025 + main * (0.84 + 0.18 * k) + f64::exp(-rx * rx - ry * ry) * c * (0.52 - 0.51 * main)
}

fn spectral(input: Sample) -> f64 {
    let Sample {
        x,
        y,
        knobs: [a, b, c, d],
        complexity: k,
        phase: s,
    } = input;
    let qx = (x + 0.68 - d * 1.56) * (0.69 + b * 0.53);
    let qy = y + 0.65 + 0.31 * f64::sin(s);
    let u = f64::hypot(qx, qy) * (5.6 + a * 7.2 + k * 2.6)
        + 0.83 * f64::sin(x * 1.6 - y * 0.9 + s)
        + s * 0.41;
    let wave = f64::powf(f64::max(0.0, 0.5 + 0.5 * f64::cos(u)), 1.6 + c * 3.8);
    let light = f64::exp(-0.21 * (f64::powf(qx - 0.48, 2.0) + f64::powf(qy - 0.37, 2.0)));
    0.045 + light * (0.82 * wave + 0.115 * (0.5 + 0.5 * f64::sin(u + x * 2.17)))
}

pub static GENERATORS: &[Generator] = &[
    Generator {
        id: "silk",
        family: "Fluidos",
        name: "Seda líquida",
        description: "Corrientes de color con pliegues finos y reflejos de seda.",
        palette: "Brasa",
        seed: 482901,
        intense: false,
        parameters: [
            Parameter {
                label: "Corriente",
                description: "Amplitud de la corriente principal.",
                initial: 0.57,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Ondulación",
                description: "Curvatura de los pliegues.",
                initial: 0.61,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Filamentos",
                description: "Separación entre los filamentos.",
                initial: 0.56,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Dirección",
                description: "Inclinación de la corriente.",
                initial: 0.48,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/silk.glsl"),
        sample: silk,
    },
    Generator {
        id: "atmosphere",
        family: "Gradientes",
        name: "Horizonte",
        description: "Masas de luz que se mezclan como un cielo desenfocado.",
        palette: "Violeta",
        seed: 619821,
        intense: false,
        parameters: [
            Parameter {
                label: "Apertura",
                description: "Extensión de las fuentes de luz.",
                initial: 0.49,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Altura",
                description: "Altura de la fuente principal.",
                initial: 0.53,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Desplazamiento",
                description: "Separación de las masas cromáticas.",
                initial: 0.63,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Velo",
                description: "Intensidad del campo atmosférico.",
                initial: 0.39,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/atmosphere.glsl"),
        sample: atmosphere,
    },
    Generator {
        id: "modules",
        family: "Geometría",
        name: "Módulos",
        description: "Retículas gráficas de piezas, diagonales y cuartos de círculo.",
        palette: "Bauhaus",
        seed: 13674,
        intense: false,
        parameters: [
            Parameter {
                label: "Escala",
                description: "Cantidad de filas y columnas.",
                initial: 0.45,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Radio",
                description: "Tamaño de los cuartos de círculo.",
                initial: 0.47,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Vacío",
                description: "Presencia de módulos despejados.",
                initial: 0.32,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Borde",
                description: "Separación entre piezas.",
                initial: 0.19,
                safe: [0.05, 0.43],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/modules.glsl"),
        sample: modules,
    },
    Generator {
        id: "kaleid",
        family: "Simetría",
        name: "Rosetón",
        description: "Una estructura radial de pétalos, anillos y vacíos.",
        palette: "Luz gótica",
        seed: 28868,
        intense: false,
        parameters: [
            Parameter {
                label: "Pétalos",
                description: "Cantidad de secciones de la roseta.",
                initial: 0.5,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Curvatura",
                description: "Profundidad de los pétalos.",
                initial: 0.61,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Relieve",
                description: "Peso de los anillos secundarios.",
                initial: 0.38,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Umbral",
                description: "Tamaño del espacio exterior.",
                initial: 0.49,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/kaleid.glsl"),
        sample: kaleid,
    },
    Generator {
        id: "moire",
        family: "Op Art",
        name: "Interferencia",
        description: "Dos campos de líneas estáticas crean batidos ópticos.",
        palette: "Tinta índigo",
        seed: 49054,
        intense: true,
        parameters: [
            Parameter {
                label: "Frecuencia",
                description: "Separación de las líneas primarias.",
                initial: 0.32,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Desfase",
                description: "Desfase relativo entre las ondas.",
                initial: 0.56,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Curvatura",
                description: "Curvatura de ambos campos.",
                initial: 0.48,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Mezcla",
                description: "Peso del batido sobre la línea.",
                initial: 0.59,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/moire.glsl"),
        sample: moire,
    },
    Generator {
        id: "terrain",
        family: "Orgánicos",
        name: "Topografía",
        description: "Curvas de nivel sobre un terreno de ruido multiescala.",
        palette: "Glaciar",
        seed: 876353,
        intense: false,
        parameters: [
            Parameter {
                label: "Escala",
                description: "Tamaño de las formaciones.",
                initial: 0.5,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Erosión",
                description: "Distorsión del campo de altura.",
                initial: 0.51,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Curvas",
                description: "Distancia entre curvas de nivel.",
                initial: 0.5,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Trazo",
                description: "Grosor de las curvas de nivel.",
                initial: 0.46,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/terrain.glsl"),
        sample: terrain,
    },
    Generator {
        id: "print",
        family: "Experimental",
        name: "Risografía",
        description: "Puntos de semitono con densidad variable y registro desplazado.",
        palette: "Mandarina",
        seed: 678434,
        intense: false,
        parameters: [
            Parameter {
                label: "Trama",
                description: "Frecuencia de los puntos impresos.",
                initial: 0.53,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Registro",
                description: "Distancia entre las dos tintas.",
                initial: 0.44,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Cobertura",
                description: "Superficie cubierta por tinta.",
                initial: 0.64,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Ángulo",
                description: "Inclinación de la segunda trama.",
                initial: 0.39,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: &["free", "mirror", "horizontal", "vertical", "quadrants"],
        texture: ("fine", 0.17),
        shader: include_str!("shaders/print.glsl"),
        sample: print,
    },
    Generator {
        id: "iridescence",
        family: "Gradientes",
        name: "Iridiscencia",
        description: "Superficies cromáticas de interferencia, con transiciones perceptuales.",
        palette: "Prisma",
        seed: 417723,
        intense: false,
        parameters: [
            Parameter {
                label: "Escala",
                description: "Tamaño de las islas cromáticas.",
                initial: 0.39,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Distorsión",
                description: "Curvatura del campo angular.",
                initial: 0.57,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Interferencia",
                description: "Peso de la segunda onda.",
                initial: 0.71,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Centro",
                description: "Desplazamiento del foco.",
                initial: 0.58,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/iridescence.glsl"),
        sample: iridescence,
    },
    Generator {
        id: "vortex",
        family: "Fluidos",
        name: "Vórtice",
        description: "Un remolino advectivo de corrientes concéntricas.",
        palette: "Abisal",
        seed: 701546,
        intense: false,
        parameters: [
            Parameter {
                label: "Giro",
                description: "Rotación acumulada hacia el centro.",
                initial: 0.55,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Turbulencia",
                description: "Irregularidad entre las corrientes.",
                initial: 0.43,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Desplazamiento",
                description: "Posición del centro del remolino.",
                initial: 0.63,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Brillo",
                description: "Peso de las crestas iluminadas.",
                initial: 0.39,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/vortex.glsl"),
        sample: vortex,
    },
    Generator {
        id: "arches",
        family: "Geometría",
        name: "Arcadas",
        description: "Arquitecturas concéntricas con un ritmo de bandas y silencios.",
        palette: "Cal y óxido",
        seed: 911934,
        intense: false,
        parameters: [
            Parameter {
                label: "Repetición",
                description: "Número de arcadas visibles.",
                initial: 0.38,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Grosor",
                description: "Peso de la banda interior.",
                initial: 0.54,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Elevación",
                description: "Altura de los centros de cada arco.",
                initial: 0.4,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Abertura",
                description: "Proporción vertical de la arcada.",
                initial: 0.35,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/arches.glsl"),
        sample: arches,
    },
    Generator {
        id: "cells",
        family: "Orgánicos",
        name: "Voronoi",
        description: "Membranas celulares por distancia a puntos vecinos.",
        palette: "Liquen",
        seed: 79194,
        intense: false,
        parameters: [
            Parameter {
                label: "Densidad",
                description: "Número de células visibles.",
                initial: 0.51,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Dispersión",
                description: "Posición irregular de los centros.",
                initial: 0.75,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Membrana",
                description: "Anchura del borde celular.",
                initial: 0.53,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Relieve",
                description: "Gradiente entre centro y borde.",
                initial: 0.62,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/cells.glsl"),
        sample: cells,
    },
    Generator {
        id: "fracture",
        family: "Experimental",
        name: "Fractura",
        description: "Reflexiones recursivas que tallan planos y fracturas.",
        palette: "Ultramar",
        seed: 718831,
        intense: false,
        parameters: [
            Parameter {
                label: "Plegado",
                description: "Distancia entre reflexiones recursivas.",
                initial: 0.44,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Rotación",
                description: "Giro entre un nivel y el siguiente.",
                initial: 0.52,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Apertura",
                description: "Anchura de las fisuras.",
                initial: 0.38,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Traslación",
                description: "Desplazamiento recursivo del plano.",
                initial: 0.46,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/fracture.glsl"),
        sample: fracture,
    },
    Generator {
        id: "facets",
        family: "Geometría",
        name: "Facetas",
        description: "Un mosaico de triángulos equiláteros con luz y juntas regulables.",
        palette: "Ultramar",
        seed: 315207,
        intense: false,
        parameters: [
            Parameter {
                label: "Densidad",
                description: "Cantidad de triángulos en la trama.",
                initial: 0.41,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Inclinación",
                description: "Giro de la retícula triangular.",
                initial: 0.44,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Junta",
                description: "Separación entre los triángulos.",
                initial: 0.26,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Relieve",
                description: "Intensidad del degradado dentro de cada pieza.",
                initial: 0.64,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/facets.glsl"),
        sample: facets,
    },
    Generator {
        id: "isometric",
        family: "Geometría",
        name: "Cubos isométricos",
        description: "Rombos que encajan en cubos mediante tres planos de luz.",
        palette: "Marea",
        seed: 613255,
        intense: false,
        parameters: [
            Parameter {
                label: "Densidad",
                description: "Cantidad de cubos en la trama.",
                initial: 0.48,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Contraste de caras",
                description: "Diferencia de luz entre los tres planos.",
                initial: 0.65,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Junta",
                description: "Separación alrededor de cada cubo.",
                initial: 0.19,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Variación tonal",
                description: "Diferencia de tono entre cubos.",
                initial: 0.44,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/isometric.glsl"),
        sample: isometric,
    },
    Generator {
        id: "truchet",
        family: "Geometría",
        name: "Cintas Truchet",
        description: "Cuartos de círculo que se conectan en cintas, bucles y laberintos.",
        palette: "Terracota",
        seed: 267193,
        intense: false,
        parameters: [
            Parameter {
                label: "Densidad",
                description: "Cantidad de baldosas en la trama.",
                initial: 0.41,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Anchura",
                description: "Grosor total de cada cinta.",
                initial: 0.51,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Filete",
                description: "Intensidad de la línea interior.",
                initial: 0.55,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Orientación",
                description: "Proporción de baldosas con la misma orientación.",
                initial: 0.5,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/truchet.glsl"),
        sample: truchet,
    },
    Generator {
        id: "silhouettes",
        family: "Geometría",
        name: "Figuras",
        description: "Una figura protagonista con un eco desplazado y espacio alrededor.",
        palette: "Órbita",
        seed: 805319,
        intense: false,
        parameters: [
            Parameter {
                label: "Figura",
                description: "Contorno de la figura principal.",
                initial: 0.125,
                safe: [0.0, 1.0],
                choices: &["Círculo", "Cuadrado", "Triángulo", "Hexágono"],
            },
            Parameter {
                label: "Tamaño",
                description: "Tamaño de la composición principal.",
                initial: 0.53,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Separación",
                description: "Distancia entre la figura y su eco.",
                initial: 0.54,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Giro",
                description: "Inclinación de la figura y la diagonal del eco.",
                initial: 0.39,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/silhouettes.glsl"),
        sample: silhouettes,
    },
    Generator {
        id: "dunes",
        family: "Orgánicos",
        name: "Dunas",
        description: "Crestas suaves y capas de arena que se pierden en el horizonte.",
        palette: "Oro viejo",
        seed: 654703,
        intense: false,
        parameters: [
            Parameter {
                label: "Capas",
                description: "Cantidad de crestas visibles por debajo del horizonte.",
                initial: 0.46,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Ondulación",
                description: "Altura y curvatura de las dunas.",
                initial: 0.6,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Sombra",
                description: "Profundidad de la sombra junto a cada cresta.",
                initial: 0.56,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Horizonte",
                description: "Posición vertical de las primeras dunas.",
                initial: 0.42,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/dunes.glsl"),
        sample: dunes,
    },
    Generator {
        id: "branches",
        family: "Orgánicos",
        name: "Ramificaciones",
        description: "Un tallo curvo del que brotan nervaduras y ramas finas.",
        palette: "Liquen",
        seed: 802469,
        intense: false,
        parameters: [
            Parameter {
                label: "Apertura",
                description: "Alcance lateral de las ramas principales.",
                initial: 0.64,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Curvatura",
                description: "Inclinación de las ramas y curvatura del tallo.",
                initial: 0.55,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Densidad",
                description: "Número de ramas que salen del tallo.",
                initial: 0.48,
                safe: [0.19, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Grosor",
                description: "Grosor de las nervaduras y del tallo.",
                initial: 0.55,
                safe: [0.19, 0.82],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/branches.glsl"),
        sample: branches,
    },
    Generator {
        id: "ribbons",
        family: "Fluidos",
        name: "Cintas de luz",
        description: "Cintas curvas con bordes iluminados y sombras entre los pliegues.",
        palette: "Neón coral",
        seed: 635227,
        intense: false,
        parameters: [
            Parameter {
                label: "Curva",
                description: "Amplitud de los pliegues.",
                initial: 0.67,
                safe: [0.24, 0.88],
                choices: &[],
            },
            Parameter {
                label: "Separación",
                description: "Ancho de las cintas.",
                initial: 0.62,
                safe: [0.22, 0.87],
                choices: &[],
            },
            Parameter {
                label: "Luz",
                description: "Intensidad del borde iluminado.",
                initial: 0.49,
                safe: [0.16, 0.82],
                choices: &[],
            },
            Parameter {
                label: "Dirección",
                description: "Inclinación del conjunto de cintas.",
                initial: 0.51,
                safe: [0.12, 0.88],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/ribbons.glsl"),
        sample: ribbons,
    },
    Generator {
        id: "nacre",
        family: "Fluidos",
        name: "Nácar",
        description: "Reflejos pastel sobre ondas anchas, con brillos finos en las crestas.",
        palette: "Luz nacarada",
        seed: 112042,
        intense: false,
        parameters: [
            Parameter {
                label: "Escala",
                description: "Tamaño de las ondas.",
                initial: 0.43,
                safe: [0.12, 0.88],
                choices: &[],
            },
            Parameter {
                label: "Ondulación",
                description: "Curvatura lateral del relieve.",
                initial: 0.66,
                safe: [0.23, 0.86],
                choices: &[],
            },
            Parameter {
                label: "Destello",
                description: "Intensidad de los reflejos especulares.",
                initial: 0.52,
                safe: [0.12, 0.86],
                choices: &[],
            },
            Parameter {
                label: "Inclinación",
                description: "Dirección de las ondas.",
                initial: 0.63,
                safe: [0.14, 0.87],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("fine", 0.17),
        shader: include_str!("shaders/nacre.glsl"),
        sample: nacre,
    },
    Generator {
        id: "diffuse",
        family: "Gradientes",
        name: "Difusión de color",
        description: "Campos suaves de color con bordes difusos y textura de película.",
        palette: "Fulgor",
        seed: 739152,
        intense: false,
        parameters: [
            Parameter {
                label: "Apertura",
                description: "Extensión del haz principal.",
                initial: 0.61,
                safe: [0.16, 0.86],
                choices: &[],
            },
            Parameter {
                label: "Altura",
                description: "Posición vertical de la luz.",
                initial: 0.55,
                safe: [0.13, 0.88],
                choices: &[],
            },
            Parameter {
                label: "Dispersión",
                description: "Peso de la luz secundaria.",
                initial: 0.47,
                safe: [0.14, 0.85],
                choices: &[],
            },
            Parameter {
                label: "Caída",
                description: "Oscurecimiento hacia los extremos.",
                initial: 0.55,
                safe: [0.12, 0.87],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("film", 0.37),
        shader: include_str!("shaders/diffuse.glsl"),
        sample: diffuse,
    },
    Generator {
        id: "spectral",
        family: "Fluidos",
        name: "Relieve espectral",
        description: "Arcos luminosos con sombras profundas y grano de película.",
        palette: "Prisma nocturno",
        seed: 940158,
        intense: false,
        parameters: [
            Parameter {
                label: "Ritmo",
                description: "Separación entre crestas.",
                initial: 0.56,
                safe: [0.18, 0.86],
                choices: &[],
            },
            Parameter {
                label: "Curvatura",
                description: "Abertura de los arcos.",
                initial: 0.62,
                safe: [0.16, 0.88],
                choices: &[],
            },
            Parameter {
                label: "Nitidez",
                description: "Anchura de las crestas iluminadas.",
                initial: 0.48,
                safe: [0.15, 0.86],
                choices: &[],
            },
            Parameter {
                label: "Centro",
                description: "Posición del centro de los arcos.",
                initial: 0.38,
                safe: [0.12, 0.88],
                choices: &[],
            },
        ],
        symmetry: ALL_SYMMETRIES,
        texture: ("film", 0.57),
        shader: include_str!("shaders/spectral.glsl"),
        sample: spectral,
    },
];
