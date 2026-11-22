use super::App;
use super::icons::icon;
use super::view::{action, escape, flag, icon_button, option, pressed, text_button};
use forma_core::color::{HARMONIES, PERSONALITIES};
use forma_core::math::PI;
use forma_core::recipe::{FINISHES, SYMMETRIES};

pub fn quant(control: &str, value: f64) -> String {
    match control {
        "order" => format!("{value:.0}"),
        "axis" | "phase" => format!("{:.0}°", value.to_degrees()),
        _ => format!("{:.0}%", value * 100.0),
    }
}

fn slider(
    control: &str,
    label: &str,
    hint: &str,
    value: f64,
    bounds: [f64; 3],
    locked: Option<bool>,
) -> String {
    let [min, max, step] = bounds;
    let lock = locked
        .map(|on| {
            icon_button(
                "lock-parameter",
                control,
                &format!("{} {label}", if on { "Desbloquear" } else { "Bloquear" }),
                if on { "lock" } else { "unlock" },
                "tiny",
                &pressed(on),
            )
        })
        .unwrap_or_default();
    let fill = (value - min) / (max - min) * 100.0;
    format!(
        r#"<div class="slider" title="{}"><div class="slider-label">
      <label>{}<input type="range" min="{min}" max="{max}" step="{step}" value="{value}" data-control="{control}" style="--fill:{fill}%"></label>
      <span class="quant" data-quant="{control}">{}</span>{lock}</div></div>"#,
        escape(hint),
        escape(label),
        quant(control, value)
    )
}

fn basic(control: &str, label: &str, value: f64) -> String {
    slider(control, label, "", value, [0.0, 1.0, 0.01], None)
}

fn select(control: &str, label: &str, options: &str, disabled: bool) -> String {
    format!(
        r#"<div class="select-wrap"><select aria-label="{}" data-control="{control}"{}>{options}</select>{}</div>"#,
        escape(label),
        flag("disabled", disabled),
        icon("chevron-down", 14)
    )
}

fn field(label: &str, element: &str) -> String {
    format!(
        r#"<label class="field-label">{}{element}</label>"#,
        escape(label)
    )
}

fn section(name: &str, extra: &str, content: &str) -> String {
    format!(
        r#"<section class="setting-section"><div class="setting-title"><span>{name}</span>{extra}</div>{content}</section>"#
    )
}

pub fn build(app: &App) -> String {
    let r = app.store.recipe();
    let g = r.generator();
    let studio = app.store.session.mode == "studio";
    let lock = icon_button(
        "lock-palette",
        "",
        if r.palette_locked {
            "Desbloquear paleta"
        } else {
            "Bloquear paleta"
        },
        if r.palette_locked { "lock" } else { "unlock" },
        "tiny",
        &pressed(r.palette_locked),
    );
    let swatches: String = r
        .palette
        .iter()
        .enumerate()
        .map(|(index, hex)| {
            let locked = if r.color_locks.contains(&index) {
                icon("lock", 11)
            } else {
                String::new()
            };
            format!(r#"<span style="background:{hex}">{locked}</span>"#)
        })
        .collect();
    let palette = action(
        "palette-trigger",
        "dialog",
        "palette",
        &format!(
            r#"<div class="swatches" aria-hidden="true">{swatches}</div><div class="palette-caption"><span>{}</span>{}</div>"#,
            escape(&r.palette_name),
            icon("chevron-down", 13)
        ),
        &format!(r#" aria-label="Editar paleta {}""#, escape(&r.palette_name)),
    );
    let personalities: String = PERSONALITIES
        .iter()
        .map(|p| {
            option(
                p.id,
                &format!("{} · {}", p.id, p.label),
                &r.personality,
                false,
            )
        })
        .collect();
    let personality = field(
        "Personalidad cromática",
        &select(
            "personality",
            "Personalidad cromática",
            &personalities,
            r.palette_locked,
        ),
    );
    let harmony = if studio {
        let modes: String = HARMONIES
            .iter()
            .map(|(id, label, _)| option(id, label, &r.harmony, false))
            .collect();
        field(
            "Armonía",
            &select("harmony", "Armonía", &modes, r.palette_locked),
        )
    } else {
        String::new()
    };
    let colors = section("Color", &lock, &format!("{palette}{personality}{harmony}"));

    let mut composition = String::new();
    for (i, param) in g
        .parameters
        .iter()
        .enumerate()
        .filter(|(_, p)| !p.choices.is_empty())
    {
        let selected = (r.parameters[i] * param.choices.len() as f64).floor() as usize;
        let selected = selected.min(param.choices.len() - 1).to_string();
        let choices: String = param
            .choices
            .iter()
            .enumerate()
            .map(|(j, label)| option(&j.to_string(), label, &selected, false))
            .collect();
        composition.push_str(&field(
            param.label,
            &select(&format!("choice-{i}"), param.label, &choices, false),
        ));
    }
    composition.push_str(&basic("complexity", "Complejidad", r.complexity));
    let sym = &r.symmetry;
    let choices: String = SYMMETRIES
        .iter()
        .filter(|(id, _)| studio || matches!(*id, "free" | "mirror" | "radial") || *id == sym.mode)
        .map(|(id, label)| {
            let enabled = g.symmetry.contains(id);
            if studio {
                let label = if enabled {
                    (*label).to_owned()
                } else {
                    format!("{label} · requiere otro estilo")
                };
                option(id, &label, &sym.mode, !enabled)
            } else {
                let symbol = match *id {
                    "free" => "waves",
                    "mirror" => "scan-line",
                    _ => "aperture",
                };
                action(
                    "",
                    "symmetry",
                    id,
                    &format!("{}<span>{label}</span>", icon(symbol, 15)),
                    &format!("{}{}", pressed(*id == sym.mode), flag("disabled", !enabled)),
                )
            }
        })
        .collect();
    let sym_control = if studio {
        select("symmetry", "Simetría", &choices, false)
    } else {
        format!(
            r#"<div class="symmetry-switch" role="group" aria-label="Simetría">{choices}</div>"#
        )
    };
    composition.push_str(&format!(r#"<div class="symmetry-field"><span class="field-label">Simetría</span>{sym_control}</div>"#));
    if studio && sym.mode != "free" {
        let radial = matches!(sym.mode.as_str(), "radial" | "kaleido");
        if radial {
            composition.push_str(&slider(
                "order",
                "Orden radial",
                "",
                f64::from(sym.order),
                [2.0, 16.0, 1.0],
                None,
            ));
        }
        composition.push_str(&slider("axis", "Eje", "", sym.axis, [-PI, PI, 0.01], None));
        if radial || sym.perturbation > 0.0 {
            composition.push_str(&slider(
                "phase",
                "Fase",
                "",
                sym.phase,
                [-PI, PI, 0.01],
                None,
            ));
        }
        composition.push_str(&basic("perturbation", "Perturbación", sym.perturbation));
    }
    let composition = section("Composición", "", &composition);

    let finish = &r.texture.finish;
    let mut texture = String::new();
    if studio {
        let choices: String = FINISHES
            .iter()
            .map(|(id, label)| option(id, label, finish, false))
            .collect();
        texture.push_str(&select("finish", "Acabado", &choices, false));
    }
    if !studio || finish != "none" {
        let (label, value) = if studio {
            ("Intensidad", r.texture.amount)
        } else if finish == "none" {
            ("Grano fino", 0.0)
        } else {
            (
                FINISHES.iter().find(|(id, _)| *id == finish).unwrap().1,
                r.texture.amount,
            )
        };
        texture.push_str(&basic("texture", label, value));
    }
    let texture = section("Textura", "", &texture);

    let mut advanced = String::new();
    if studio {
        let parameters: String = g
            .parameters
            .iter()
            .enumerate()
            .filter(|(_, p)| p.choices.is_empty())
            .map(|(i, p)| {
                slider(
                    &format!("param-{i}"),
                    p.label,
                    p.description,
                    r.parameters[i],
                    [0.0, 1.0, 0.01],
                    Some(r.parameter_locks.contains(&i)),
                )
            })
            .collect();
        advanced.push_str(&section(g.name, "", &parameters));
        let render = format!(
            r#"{}{}{}
            <label class="checkbox"><input type="checkbox" data-control="dither"{}> Dithering técnico</label>
            <label class="field-label">Semilla<input inputmode="numeric" maxlength="10" data-control="seed" value="{}"></label>"#,
            slider(
                "contrast",
                "Contraste",
                "",
                r.contrast,
                [0.45, 1.65, 0.01],
                None
            ),
            slider(
                "saturation",
                "Croma",
                "",
                r.saturation,
                [0.0, 1.65, 0.01],
                None
            ),
            basic("mix", "Mezcla de campos", r.render.mix),
            flag("checked", r.render.dither),
            r.seed
        );
        advanced.push_str(&section("Renderizado", "", &render));
    }

    format!(
        r#"<aside class="settings panel" aria-label="Ajustes de composición">
      <div class="panel-heading settings-heading">{}<h2>Ajustes</h2></div>
      <div class="mode-switch" role="group" aria-label="Modo de edición">{}{}</div>
      <div class="settings-scroll">{colors}{composition}{texture}{advanced}</div>
      <div class="settings-actions">{}{}</div></aside>"#,
        icon("sliders-horizontal", 17),
        action("", "mode", "simple", "Simple", &pressed(!studio)),
        action("", "mode", "studio", "Estudio", &pressed(studio)),
        text_button("generate", "", "Generar", "primary generate", "sparkles"),
        text_button(
            "variant",
            "",
            "Nueva variante",
            "secondary generate",
            "dice-5"
        )
    )
}
