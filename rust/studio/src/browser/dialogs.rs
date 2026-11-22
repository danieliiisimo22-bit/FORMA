use super::view::{
    Artwork, action, canvas, dialog, escape, flag, icon_button, open_title, option, pressed,
    text_button,
};
use super::{App, Dialog, icons::icon};
use forma_core::color::PALETTES;
use std::fmt::Write;

pub fn build(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let Some(kind) = app.dialog else {
        return String::new();
    };
    let (description, class, content) = match kind {
        Dialog::Palette => (
            "Edita la paleta actual o elige una de la biblioteca.",
            "wide-dialog",
            palette(app),
        ),
        Dialog::Library => (
            "Guarda composiciones reproducibles y mueve tu biblioteca entre dispositivos.",
            "wide-dialog",
            library(app, tasks),
        ),
        Dialog::Compare => ("", "compare-dialog", compare(app, tasks)),
        Dialog::Aspect => (
            "Define la relación entre ancho y alto del lienzo.",
            "",
            aspect(app),
        ),
        Dialog::Export => (
            "Renderizado a la resolución final en sRGB.",
            "",
            export(app, tasks),
        ),
        Dialog::Help => (
            "",
            "",
            String::from(
                r#"
          <dl class="shortcuts">
            <div><dt>Generar</dt><dd><kbd>G</kbd></dd></div>
            <div><dt>Deshacer</dt><dd><kbd>Ctrl / ⌘</kbd> <kbd>Z</kbd></dd></div>
            <div><dt>Rehacer</dt><dd><kbd>Ctrl / ⌘</kbd> <kbd>Mayús</kbd> <kbd>Z</kbd></dd></div>
            <div><dt>Mis recetas</dt><dd><kbd>Ctrl / ⌘</kbd> <kbd>S</kbd></dd></div>
            <div><dt>Salir de un diálogo o de enfoque</dt><dd><kbd>Esc</kbd></dd></div>
          </dl>"#,
            ),
        ),
    };
    let message = if app.error.is_empty() {
        String::new()
    } else {
        format!(
            r#"<p role="alert" class="error">{}</p>"#,
            escape(&app.error)
        )
    };
    let toast = format!(
        r#"<div class="toast{}" id="dialog-toast" role="status">{}</div>"#,
        if app.notice.is_empty() { "" } else { " shown" },
        escape(&app.notice)
    );
    dialog(
        open_title(kind),
        description,
        class,
        &format!("{content}{message}{toast}"),
    )
}

pub fn palette_cards(app: &App) -> String {
    let query = app.palette_query.to_lowercase();
    let custom = &app.store.session.library.palettes;
    let rip = app.store.recipe().palette_locked;
    let possibilities = custom
        .iter()
        .map(|p| (p.name.as_str(), p.colors.each_ref().map(String::as_str)))
        .chain(PALETTES.iter().copied());
    possibilities
        .enumerate()
        .filter(|(_, (name, _))| name.to_lowercase().contains(&query))
        .map(|(i, (name, colors))| {
            let swatches: String = colors
                .iter()
                .map(|color| format!(r#"<span style="background:{color}"></span>"#))
                .collect();
            action(
                "palette-card",
                "palette-choice",
                i,
                &format!(
                    r#"<span class="palette-card-swatches">{swatches}</span><span>{}</span>"#,
                    escape(name)
                ),
                &flag("disabled", rip),
            )
        })
        .collect()
}

fn palette(app: &App) -> String {
    let recipe = app.store.recipe();
    let mut colors = String::new();
    for (i, hex) in recipe.palette.iter().enumerate() {
        let locked = recipe.color_locks.contains(&i);
        let disabled = flag("disabled", recipe.palette_locked || locked);
        let n = i + 1;
        let lock = icon_button(
            "lock-color",
            i,
            &format!(
                "{} color {n}",
                if locked { "Desbloquear" } else { "Bloquear" }
            ),
            if locked { "lock" } else { "unlock" },
            "tiny",
            &format!(
                "{}{}",
                pressed(locked),
                flag("disabled", recipe.palette_locked)
            ),
        );
        let _ = write!(
            colors,
            r#"<div class="color-editor">
            <label class="color-preview" style="background:{hex}">
              <input aria-label="Selector de color {n}" type="color" value="{hex}" data-control="color-{i}"{disabled}>
            </label>
            <div class="hex-row"><input aria-label="Color HEX {n}" value="{}" maxlength="7" data-control="hex-{i}"{disabled}>{lock}</div>
            </div>"#,
            hex.to_uppercase()
        );
    }
    let regenerate = action(
        "button secondary",
        "regenerate",
        "",
        &format!("{} Regenerar colores", icon("shuffle", 15)),
        &flag("disabled", recipe.palette_locked),
    );
    format!(
        r#"
      <div class="palette-edit">{colors}</div>
      <div class="palette-tools">{regenerate}{}{}{}
      </div>
      <label class="field-label">Buscar paleta<input data-control="palette-query" placeholder="Nombre de la paleta" value="{}"></label>
      <div class="palette-grid">{}</div>
      <form class="save-inline" data-form="save-palette">
        <input name="title" aria-label="Nombre de paleta personalizada" placeholder="Nombre de la nueva paleta" maxlength="70" required>
        <button class="button primary" type="submit">Guardar paleta</button>
      </form>"#,
        action(
            "button secondary",
            "extract",
            "",
            "Extraer del lienzo",
            &flag("disabled", recipe.palette_locked)
        ),
        text_button("json", "palette", "Exportar paleta", "secondary", ""),
        if recipe.palette_locked {
            r#"<span class="note">Paleta bloqueada</span>"#
        } else {
            ""
        },
        escape(&app.palette_query),
        palette_cards(app)
    )
}

fn library(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let library = &app.store.session.library;
    let mut saved = String::new();
    for (i, item) in library.saved.iter().enumerate() {
        let _ = write!(
            saved,
            r#"<div class="saved-card">{}{}</div>"#,
            action(
                "",
                "open-saved",
                i,
                &format!(
                    "{}<span>{}</span>",
                    canvas(tasks, &item.recipe, true, None),
                    escape(&item.name)
                ),
                ""
            ),
            icon_button(
                "remove-saved",
                i,
                &format!("Eliminar {}", item.name),
                "trash-2",
                "",
                ""
            )
        );
    }
    if saved.is_empty() {
        saved.push_str(r#"<p class="note">Tus recetas guardadas aparecerán aquí.</p>"#);
    }
    let custom = if !library.palettes.is_empty() {
        let rows: String = library
            .palettes
            .iter()
            .enumerate()
            .map(|(i, p)| {
                format!(
                    r#"<div class="custom-row"><span>{}</span>{}</div>"#,
                    escape(&p.name),
                    icon_button(
                        "remove-palette",
                        i,
                        &format!("Eliminar paleta {}", p.name),
                        "trash-2",
                        "",
                        ""
                    )
                )
            })
            .collect();
        format!(r#"<div class="custom-palettes"><h3>Paletas personales</h3>{rows}</div>"#)
    } else {
        String::new()
    };
    format!(
        r#"<form class="save-inline" data-form="save-recipe">
        <input name="title" aria-label="Nombre de receta" placeholder="{}" maxlength="70" required>
        <button class="button primary" type="submit">Guardar receta</button>
      </form>
      <div class="library-grid">{saved}</div>{custom}
      <div class="palette-tools">{}{}{}
        <input type="file" id="import-json" data-control="import" accept=".json,application/json" hidden>
      </div>"#,
        escape(app.store.recipe().generator().name),
        text_button("import", "", "Importar JSON", "secondary", "upload"),
        text_button("json", "recipe", "Exportar receta", "secondary", ""),
        text_button("json", "library", "Exportar biblioteca", "secondary", "")
    )
}

fn compare(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let candidates = app.compare_candidates();
    let Some(other) = candidates
        .get(app.compare_index)
        .or_else(|| candidates.first())
    else {
        return String::from(
            r#"<p class="note">Genera una variante para tener otra composición que comparar.</p>"#,
        );
    };
    let r = app.store.recipe();
    let choices: String = candidates
        .iter()
        .enumerate()
        .map(|(i, r)| {
            option(
                &i.to_string(),
                &format!("{} · {}", r.generator().name, r.seed),
                &app.compare_index.to_string(),
                false,
            )
        })
        .collect();
    let previews: String = [r,*other].into_iter().enumerate().map(|(i,recipe)| format!(r#"
        <div><div class="compare-preview">{}</div><div class="compare-meta"><strong>{}</strong><span>{}</span></div></div>"#,
        canvas(tasks,recipe,false,Some(&format!("Composición {}",i+1))),recipe.generator().name,recipe.seed)).collect();
    format!(
        r#"<label class="field-label">Comparar con<select data-control="compare">{choices}</select></label>
      <div class="compare-grid">{previews}</div><div class="dialog-actions">{}</div>"#,
        text_button("use-compare", "", "Usar esta composición", "primary", "")
    )
}

fn aspect(app: &App) -> String {
    let [width, height] = &app.aspect_fields;
    format!(
        r#"<form class="dialog-form" data-form="aspect">
      <div class="form-row">
        <label class="field-label">Ancho<input name="width" type="number" min="1" max="100" value="{}" required></label>
        <label class="field-label">Alto<input name="height" type="number" min="1" max="100" value="{}" required></label>
      </div><div class="dialog-actions"><button class="button primary" type="submit">Aplicar proporción</button></div></form>"#,
        escape(width),
        escape(height)
    )
}

fn export(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let request = &app.export_options;
    let disabled = flag("disabled", app.progress.is_some());
    let readonly = flag(
        "readonly",
        app.progress.is_some() || request.size != "custom",
    );
    let formats: String = [
        ("image/png", "PNG"),
        ("image/jpeg", "JPEG"),
        ("image/webp", "WebP"),
    ]
    .iter()
    .map(|(id, label)| option(id, label, &request.format, false))
    .collect();
    let sizes: String = [
        ("1080", "1080p"),
        ("1440", "1440p"),
        ("2160", "4K"),
        ("4320", "8K"),
        ("custom", "Personalizada"),
    ]
    .iter()
    .map(|(id, label)| option(id, label, &request.size, false))
    .collect();
    let quality = if request.format != "image/png" {
        format!(
            r#"<label class="field-label"><span id="quality-label">Calidad {:.0}%</span><input type="range" name="quality" data-control="quality" min="0.55" max="1" step="0.01" value="{}"{disabled}></label>"#,
            request.quality * 100.0,
            request.quality
        )
    } else {
        String::new()
    };
    let (progress, actions) = if let Some((fraction, message)) = &app.progress {
        (
            format!(
                r#"<div role="status" class="progress"><span id="export-message">{} · {:.0}%</span><progress id="export-progress" max="1" value="{fraction}"></progress></div>"#,
                escape(message),
                fraction * 100.0
            ),
            text_button("cancel-job", "", "Cancelar renderizado", "secondary", ""),
        )
    } else {
        (
            String::new(),
            format!(
                r#"{}<button class="button primary" type="submit">{} Descargar</button>"#,
                action(
                    "button secondary",
                    "close",
                    "",
                    "Cerrar",
                    r#" aria-label="Cerrar diálogo""#
                ),
                icon("arrow-down-to-line", 16)
            ),
        )
    };
    let recipe = app.store.recipe();
    format!(
        r#"<form class="dialog-form" data-form="export">
      <div class="export-preview">{}</div>
      <label class="field-label">Formato<select data-control="export-format"{disabled}>{formats}</select></label>
      <label class="field-label">Resolución<select data-control="export-size"{disabled}>{sizes}</select></label>
      <div class="form-row">
        <label class="field-label">Ancho (px)<input name="width" type="number" min="16" max="8192" value="{}"{readonly}></label>
        <label class="field-label">Alto (px)<input name="height" type="number" min="16" max="8192" value="{}"{readonly}></label>
      </div>
      {}{quality}{progress}<div class="dialog-actions">{actions}</div></form>"#,
        canvas(tasks, recipe, true, None),
        escape(&request.width),
        escape(&request.height),
        if request.size == "4320" {
            r#"<p class="note">Las dimensiones se ajustan a la proporción y al límite de 34 megapíxeles.</p>"#
        } else {
            ""
        }
    )
}
