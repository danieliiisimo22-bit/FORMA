use super::{App, Dialog, icons::icon};
use forma_core::generator::{FAMILIES, GENERATORS};
use forma_core::recipe::{ASPECTS, Recipe};
use std::fmt::Write;

pub struct Artwork {
    pub recipe: Recipe,
    pub thumbnail: bool,
}

pub fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub fn flag(name: &str, yes: bool) -> String {
    if yes {
        format!(" {name}")
    } else {
        String::new()
    }
}

pub fn pressed(active: bool) -> String {
    format!(" aria-pressed=\"{active}\"")
}

pub fn action(
    class: &str,
    name: &str,
    value: impl std::fmt::Display,
    body: &str,
    attrs: &str,
) -> String {
    format!(
        r#"<button type="button" class="{class}" data-action="{name}" data-value="{value}"{attrs}>{body}</button>"#
    )
}

pub fn icon_button(
    action_name: &str,
    value: impl std::fmt::Display,
    label: &str,
    symbol: &str,
    class: &str,
    attrs: &str,
) -> String {
    let label = escape(label);
    action(
        &format!("icon-btn {class}"),
        action_name,
        value,
        &icon(symbol, 16),
        &format!(r#" title="{label}" aria-label="{label}"{attrs}"#),
    )
}

pub fn text_button(
    action_name: &str,
    value: impl std::fmt::Display,
    text: &str,
    class: &str,
    symbol: &str,
) -> String {
    action(
        &format!("button {class}"),
        action_name,
        value,
        &format!("{}<span>{}</span>", icon(symbol, 16), escape(text)),
        "",
    )
}

pub fn option(value: &str, text: &str, current: &str, disabled: bool) -> String {
    format!(
        r#"<option value="{}"{}{}>{}</option>"#,
        escape(value),
        flag("selected", value == current),
        flag("disabled", disabled),
        escape(text)
    )
}

pub fn canvas(
    tasks: &mut Vec<Artwork>,
    recipe: &Recipe,
    thumbnail: bool,
    label: Option<&str>,
) -> String {
    let id = tasks.len();
    tasks.push(Artwork {
        recipe: recipe.clone(),
        thumbnail,
    });
    let access = match label {
        Some(label) => format!(r#" role="img" aria-label="{}""#, escape(label)),
        None => " aria-hidden=\"true\"".into(),
    };
    format!(r#"<canvas class="artwork" data-art="{id}"{access}></canvas>"#)
}

pub fn build(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let recipe = app.store.recipe();
    let favorite = app.store.session.library.favorites.contains(recipe);
    let head = format!(
        r#"
        <header class="topbar">
          <div class="brand"><img src="./forma.svg" alt="" width="34" height="34">
          <div class="wordmark"><span>FORMA</span><small>GENERATIVE ART STUDIO</small></div></div>
          <div class="top-tools" role="group" aria-label="Composición">
            {}<span class="bar-divider"></span>{}{}<span class="bar-divider surprise-divider"></span>{}
          </div>
          <div class="top-actions">{}{}{}</div>
        </header>"#,
        text_button("new", "", "Nueva", "toolbar", "plus"),
        icon_button(
            "undo",
            "",
            "Deshacer",
            "undo-2",
            "",
            &flag("disabled", app.store.past.is_empty())
        ),
        icon_button(
            "redo",
            "",
            "Rehacer",
            "redo-2",
            "",
            &flag("disabled", app.store.future.is_empty())
        ),
        text_button("surprise", "", "Sorpréndeme", "toolbar surprise", "shuffle"),
        icon_button(
            "dialog",
            "help",
            "Ayuda y atajos",
            "circle-help",
            "help-btn",
            ""
        ),
        icon_button(
            "favorite",
            "",
            if favorite {
                "Quitar favorito"
            } else {
                "Guardar favorito"
            },
            "heart",
            "top-heart",
            &pressed(favorite)
        ),
        text_button(
            "dialog",
            "export",
            "Exportar",
            "primary export-button",
            "arrow-down-to-line"
        ),
    );
    let library = library(app, tasks);
    let workspace = workspace(app, tasks);
    let settings = super::settings::build(app);
    let modal = super::dialogs::build(app, tasks);
    let toast = if app.dialog.is_some() || app.notice.is_empty() {
        String::new()
    } else {
        format!(
            r#"<div id="toast" class="toast shown" role="status">{}</div>"#,
            escape(&app.notice)
        )
    };
    format!(
        r#"<div class="studio{}">{head}
        <main class="work">{library}{workspace}{settings}</main>
        <footer class="statusbar">
           <div><span class="status-dot"></span> Sesión local {}</div>
           <span class="seed-status">SEMILLA <b>{}</b></span>
        </footer>
        {modal}
        {toast}
        </div>"#,
        if app.focus { " focus-view" } else { "" },
        if app.store.storage_warning {
            r#"<span class="error" role="alert">· El navegador no pudo guardar la sesión</span>"#
        } else {
            ""
        },
        recipe.seed,
    )
}

fn library(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let recipe = app.store.recipe();
    let generator = recipe.generator();
    let mut rows = String::new();
    for (index, &(family, description)) in FAMILIES.iter().enumerate() {
        let mut options = GENERATORS.iter().filter(|g| g.family == family).peekable();
        let lead = options.peek().expect("known family");
        let active = generator.family == family;
        let lead = Recipe::preset(if active { generator } else { lead });
        let expanded = app.expanded.contains(&index);
        let options: Vec<_> = options.collect();
        let _ = write!(
            rows,
            r#"<div class="family-group"><div class="family-row{}">{}"#,
            if active { " active" } else { "" },
            action(
                "family-item",
                "family",
                index,
                &format!(
                    r#"<span class="family-thumb">{}</span><span class="family-copy"><strong>{family}</strong><small>{description}</small></span>"#,
                    canvas(tasks, &lead, true, None)
                ),
                &format!(r#" aria-label="{family}" aria-pressed="{active}""#)
            )
        );
        if options.len() > 1 {
            rows.push_str(&icon_button(
                "expand",
                index,
                &format!(
                    "{} estilos de {family}",
                    if expanded { "Ocultar" } else { "Ver" }
                ),
                if expanded {
                    "chevron-down"
                } else {
                    "chevron-right"
                },
                "family-expand",
                &format!(" aria-expanded=\"{expanded}\""),
            ));
        }
        rows.push_str("</div>");
        if expanded && options.len() > 1 {
            rows.push_str(r#"<div class="family-submenu">"#);
            for entry in options {
                rows.push_str(&action(
                    "",
                    "preset",
                    entry.id,
                    &format!(
                        "{}<span>{}</span>",
                        canvas(tasks, &Recipe::preset(entry), true, None),
                        entry.name
                    ),
                    &pressed(entry.id == recipe.generator),
                ));
            }
            rows.push_str("</div>");
        }
        rows.push_str("</div>");
    }
    format!(
        r#"<aside class="library panel" aria-label="Biblioteca de estilos">
        <div class="panel-heading">{}<h2>Biblioteca</h2></div>
        <div class="library-label"><span>Estilos visuales</span><span>{}</span></div>
        <div class="families">{rows}</div>{}</aside>"#,
        icon("layers-3", 17),
        GENERATORS.len(),
        text_button(
            "dialog",
            "library",
            "Mis recetas",
            "library-button",
            "book-open"
        )
    )
}

const TABS: &[(&str, &str, &str)] = &[
    ("history", "Historial", "history"),
    ("favorites", "Favoritos", "heart"),
    ("variants", "Variantes", "grid-2x2"),
];

fn workspace(app: &App, tasks: &mut Vec<Artwork>) -> String {
    let recipe = app.store.recipe();
    let g = recipe.generator();
    let mut choices = String::new();
    for &aspect in ASPECTS {
        choices.push_str(&option(
            aspect,
            if aspect == "custom" {
                "Personalizada"
            } else {
                aspect
            },
            &recipe.aspect,
            false,
        ));
    }
    let tabs: String = TABS.iter().map(|(id,name,symbol)| {
        let selected = *id == app.tab;
        format!(r#"<button type="button" role="tab" id="tab-{id}" aria-controls="timeline-items" aria-selected="{selected}" tabindex="{}" data-action="tab" data-value="{id}">{}<span>{name}</span></button>"#,
            if selected {0} else {-1},icon(symbol,14))
    }).collect();
    let mutation_control = if app.tab == "variants" {
        let counts: String = ["4", "9", "16"]
            .map(|count| option(count, count, &app.variant_count.to_string(), false))
            .concat();
        format!(
            r#"<div class="mutation-controls"><label>Cantidad<select data-control="variant-count">{counts}</select></label>{}</div>"#,
            text_button("mutate", "", "Mutar composición", "secondary", "")
        )
    } else {
        String::new()
    };
    let mut cards = String::new();
    let favorites = &app.store.session.library.favorites;
    for (index, item) in app.visible().iter().enumerate() {
        let name = item.generator().name;
        let selected = item == recipe;
        let marked = favorites.contains(item);
        let _ = write!(
            cards,
            r#"<div class="film-item{}">{}{}</div>"#,
            if selected { " selected" } else { "" },
            action(
                "film-open",
                "open-film",
                index,
                &format!("{}<span>{name}</span>", canvas(tasks, item, true, None)),
                &format!(
                    r#" title="{name} · {}" aria-pressed="{selected}""#,
                    item.seed
                )
            ),
            icon_button(
                "favorite-film",
                index,
                &format!(
                    "{} favorito {name}",
                    if marked { "Quitar" } else { "Marcar" }
                ),
                "heart",
                "film-heart",
                &pressed(marked)
            )
        );
    }
    if cards.is_empty() {
        let message = if app.tab == "favorites" {
            "Marca una composición con el corazón para guardarla aquí."
        } else {
            "Genera descendientes de la composición actual."
        };
        let _ = write!(cards, r#"<p class="empty-timeline">{message}</p>"#);
    }
    format!(
        r#"<section class="workspace" aria-label="Lienzo e historial">
      <div class="canvas-toolbar"><div class="canvas-title">{}<h1>Lienzo</h1></div>
        <div class="canvas-tools"><div class="select-wrap aspect-select">
          <select aria-label="Proporción del lienzo" data-control="aspect">{choices}</select>{}
        </div>{}{}</div>
      </div>
      <div class="stage"><div class="stage-body" style="--ratio:{};--zoom:{}"><div class="stage-frame">{}</div></div></div>
      <div class="canvas-caption"><div class="live-label"><span class="live-dot"></span>
        <strong title="{}">{}</strong><span class="caption-slash">/</span><span class="caption-family">{}</span>{}</div>
        <div class="zoom-tools">{}{}{}</div>
      </div>
      <section class="timeline" aria-label="Exploración visual">
        <div class="timeline-head"><div class="timeline-tabs" role="tablist" aria-label="Colecciones">{tabs}</div>
        <div class="timeline-tools">{}{}</div></div>
        {mutation_control}
        <div class="timeline-items" id="timeline-items" role="tabpanel" aria-labelledby="tab-{}">{cards}</div>
      </section>
    </section>"#,
        icon("square-dashed", 17),
        icon("chevron-down", 13),
        if recipe.aspect == "custom" {
            text_button("dialog", "aspect", "Editar proporción", "toolbar", "")
        } else {
            String::new()
        },
        icon_button(
            "focus",
            "",
            if app.focus {
                "Salir de enfoque"
            } else {
                "Vista enfocada"
            },
            "expand",
            "",
            &pressed(app.focus)
        ),
        recipe.ratio(),
        app.zoom,
        canvas(
            tasks,
            recipe,
            false,
            Some(&format!("Composición {}", g.name))
        ),
        escape(g.description),
        g.name,
        g.family,
        if g.intense {
            r#"<span class="intense" title="Patrón estático de alta intensidad visual.">Patrón óptico intenso</span>"#
        } else {
            ""
        },
        icon_button(
            "zoom",
            "out",
            "Alejar",
            "minus",
            "",
            &flag("disabled", app.zoom <= 0.5)
        ),
        action(
            "zoom-value",
            "zoom",
            "fit",
            &format!("{:.0}%", app.zoom * 100.0),
            r#" title="Ajustar al lienzo""#
        ),
        icon_button(
            "zoom",
            "in",
            "Acercar",
            "plus",
            "",
            &flag("disabled", app.zoom >= 2.0)
        ),
        icon_button(
            "dialog",
            "compare",
            "Comparar composiciones",
            "columns-2",
            "",
            ""
        ),
        text_button(
            "explore",
            "",
            "Explorar",
            "timeline-explore",
            "gallery-horizontal-end"
        ),
        app.tab,
    )
}

pub fn dialog(title: &str, description: &str, class: &str, content: &str) -> String {
    let description = if description.is_empty() {
        String::new()
    } else {
        format!("<p>{}</p>", escape(description))
    };
    format!(
        r#"<dialog class="dialog {class}" id="forma-dialog" aria-labelledby="dialog-title">
        <div class="dialog-body"><header class="dialog-header">
        <div><h2 id="dialog-title">{}</h2>{description}</div>{}</header>{content}</div>
        </dialog>"#,
        escape(title),
        icon_button("close", "", "Cerrar", "x", "", "")
    )
}

pub fn open_title(kind: Dialog) -> &'static str {
    match kind {
        Dialog::Palette => "Paletas",
        Dialog::Library => "Mis recetas",
        Dialog::Aspect => "Proporción personalizada",
        Dialog::Compare => "Comparar composiciones",
        Dialog::Export => "Exportar imagen",
        Dialog::Help => "Atajos",
    }
}
