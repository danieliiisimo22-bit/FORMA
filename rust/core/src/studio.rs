use crate::color::{Colors, valid_hex};
use crate::generator::GENERATORS;
use crate::recipe::{INVALID_RECIPE, Recipe, valid_name};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const STORAGE_KEY: &str = "forma-studio.v1";
pub const MAX_SAVED: usize = 96;
const MAX_UNDO: usize = 36;
const MAX_RECENT: usize = 3;

#[derive(Clone, Deserialize, Serialize, PartialEq)]
pub struct NamedRecipe {
    pub name: String,
    pub recipe: Recipe,
}

#[derive(Clone, Deserialize, Serialize, PartialEq)]
pub struct NamedPalette {
    pub name: String,
    pub colors: Colors,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct Library {
    pub schema: u8,
    pub favorites: Vec<Recipe>,
    pub saved: Vec<NamedRecipe>,
    pub palettes: Vec<NamedPalette>,
}

impl Default for Library {
    fn default() -> Self {
        Self {
            schema: 1,
            favorites: vec![],
            saved: vec![],
            palettes: vec![],
        }
    }
}

impl Library {
    pub fn validate(&mut self) -> Result<(), &'static str> {
        if self.schema != 1
            || [self.favorites.len(), self.saved.len(), self.palettes.len()]
                .iter()
                .any(|&n| n > MAX_SAVED)
        {
            return Err("Formato de biblioteca incompatible.");
        }
        for recipe in &self.favorites {
            recipe.validate()?;
        }
        for item in &mut self.saved {
            item.name = normalize_name(&item.name)?;
            item.recipe.validate()?;
        }
        for item in &mut self.palettes {
            item.validate()?;
        }
        Ok(())
    }

    pub fn merge(&mut self, incoming: Self) -> Result<(), String> {
        fn combine<T: Clone + PartialEq>(
            previous: &[T],
            incoming: Vec<T>,
            key: impl Fn(&T) -> String,
            label: &str,
        ) -> Result<Vec<T>, String> {
            let mut merged: Vec<T> = Vec::with_capacity(MAX_SAVED);
            for item in previous.iter().cloned().chain(incoming) {
                let id = key(&item);
                if let Some(p) = merged.iter().find(|p| key(p) == id) {
                    if *p != item {
                        return Err(format!(
                            "Ya existe «{id}» en {label} con otro contenido. Cambia su nombre en el archivo antes de importarlo."
                        ));
                    }
                } else {
                    merged.push(item);
                }
            }
            if merged.len() > MAX_SAVED {
                return Err(format!(
                    "La importación superaría el límite de {MAX_SAVED} elementos en {label}. Libera espacio y vuelve a importar."
                ));
            }
            Ok(merged)
        }
        let favorites = combine(
            &self.favorites,
            incoming.favorites,
            |r| serde_json::to_string(r).unwrap(),
            "favoritos",
        )?;
        let saved = combine(&self.saved, incoming.saved, |r| r.name.clone(), "recetas")?;
        let palettes = combine(
            &self.palettes,
            incoming.palettes,
            |r| r.name.clone(),
            "paletas",
        )?;
        *self = Self {
            schema: 1,
            favorites,
            saved,
            palettes,
        };
        Ok(())
    }
}

impl NamedPalette {
    fn validate(&mut self) -> Result<(), &'static str> {
        if !self.colors.iter().all(|hex| valid_hex(hex)) {
            return Err("Una paleta debe tener cinco colores HEX.");
        }
        self.name = normalize_name(&self.name)?;
        Ok(())
    }
}

#[derive(Deserialize, Serialize)]
pub struct Session {
    pub recipe: Recipe,
    #[serde(default = "starter_history")]
    pub history: Vec<Recipe>,
    pub library: Library,
    #[serde(default)]
    pub mode: String,
}

fn starter_history() -> Vec<Recipe> {
    [0, 1, 4]
        .map(|index| Recipe::preset(&GENERATORS[index]))
        .to_vec()
}

impl Default for Session {
    fn default() -> Self {
        Self {
            recipe: Recipe::preset(&GENERATORS[0]),
            history: starter_history(),
            library: Library::default(),
            mode: "simple".into(),
        }
    }
}

pub enum Import {
    Recipe(Recipe),
    Palette(NamedPalette),
    Library(Library),
}

pub fn parse_import(text: &str) -> Result<Import, &'static str> {
    let value: Value =
        serde_json::from_str(text).map_err(|_| "El archivo no contiene JSON válido.")?;
    if value.get("generator").is_some() {
        let recipe: Recipe = serde_json::from_value(value).map_err(|_| INVALID_RECIPE)?;
        recipe.validate()?;
        return Ok(Import::Recipe(recipe));
    }
    if value.get("colors").is_some() {
        if value.get("schema").and_then(Value::as_u64) != Some(1) {
            return Err("Formato de paleta incompatible.");
        }
        let mut palette: NamedPalette = serde_json::from_value(value)
            .map_err(|_| "Una paleta debe tener cinco colores HEX.")?;
        palette.validate()?;
        return Ok(Import::Palette(palette));
    }
    let mut library: Library =
        serde_json::from_value(value).map_err(|_| "Formato de biblioteca incompatible.")?;
    library.validate()?;
    Ok(Import::Library(library))
}

#[derive(Default)]
pub struct Studio {
    pub session: Session,
    pub past: Vec<Recipe>,
    pub future: Vec<Recipe>,
    draft_from: Option<Recipe>,
    pub storage_warning: bool,
}

impl Studio {
    pub fn restore(raw: &str) -> Result<Self, &'static str> {
        let mut session: Session = serde_json::from_str(raw).map_err(|_| "Sesión inválida.")?;
        session.recipe.validate()?;
        session.library.validate()?;
        let mut history: Vec<Recipe> = Vec::with_capacity(MAX_RECENT);
        for item in session.history {
            item.validate()?;
            if !history.iter().any(|entry| entry.same_composition(&item)) {
                history.push(item);
            }
            if history.len() == MAX_RECENT {
                break;
            }
        }
        session.history = history;
        if session.mode != "studio" {
            session.mode = "simple".into();
        }
        Ok(Self {
            session,
            ..Self::default()
        })
    }

    pub fn recipe(&self) -> &Recipe {
        &self.session.recipe
    }

    fn refresh_history(&mut self) {
        let r = &self.session.recipe;
        if let Some(entry) = self
            .session
            .history
            .iter_mut()
            .find(|item| item.same_composition(r))
        {
            entry.clone_from(r);
        }
    }

    fn remember(&mut self, recipe: Recipe) {
        if self.past.len() == MAX_UNDO {
            self.past.remove(0);
        }
        self.past.push(recipe);
    }

    pub fn apply(&mut self, recipe: Recipe) {
        self.commit();
        if self.session.recipe == recipe {
            return;
        }
        let previous = std::mem::replace(&mut self.session.recipe, recipe.clone());
        if previous.same_composition(&recipe) {
            self.refresh_history();
        } else {
            self.session
                .history
                .retain(|entry| !entry.same_composition(&recipe));
            self.session.history.insert(0, recipe);
            self.session.history.truncate(MAX_RECENT);
        }
        self.remember(previous);
        self.future.clear();
    }

    pub fn edit(&mut self, update: impl FnOnce(&mut Recipe)) {
        self.draft_from
            .get_or_insert_with(|| self.session.recipe.clone());
        update(&mut self.session.recipe);
    }

    pub fn commit(&mut self) {
        if let Some(previous) = self.draft_from.take().filter(|r| r != &self.session.recipe) {
            self.remember(previous);
            self.future.clear();
            self.refresh_history();
        }
    }

    pub fn undo(&mut self) {
        self.commit();
        if let Some(previous) = self.past.pop() {
            self.future
                .push(std::mem::replace(&mut self.session.recipe, previous));
            self.refresh_history();
        }
    }

    pub fn redo(&mut self) {
        if let Some(next) = self.future.pop() {
            let previous = std::mem::replace(&mut self.session.recipe, next);
            self.remember(previous);
            self.refresh_history();
        }
    }

    pub fn favorite(&mut self, recipe: Recipe) {
        self.commit();
        let items = &mut self.session.library.favorites;
        if let Some(index) = items.iter().position(|item| item == &recipe) {
            items.remove(index);
        } else {
            items.insert(0, recipe);
            items.truncate(MAX_SAVED);
        }
    }

    pub fn save_recipe(&mut self, name: &str) -> Result<(), &'static str> {
        let name = normalize_name(name)?;
        self.commit();
        let items = &mut self.session.library.saved;
        items.retain(|item| item.name != name);
        items.insert(
            0,
            NamedRecipe {
                name,
                recipe: self.session.recipe.clone(),
            },
        );
        items.truncate(MAX_SAVED);
        Ok(())
    }

    pub fn save_palette(&mut self, name: &str) -> Result<(), &'static str> {
        let name = normalize_name(name)?;
        let items = &mut self.session.library.palettes;
        items.retain(|item| item.name != name);
        items.insert(
            0,
            NamedPalette {
                name,
                colors: self.session.recipe.palette.clone(),
            },
        );
        items.truncate(MAX_SAVED);
        Ok(())
    }
}

fn normalize_name(value: &str) -> Result<String, &'static str> {
    valid_name(value)
        .then(|| value.trim().to_owned())
        .ok_or("El nombre debe tener entre 1 y 70 caracteres.")
}
