import { create } from 'zustand'
import type { Palette } from '../palettes'
import { validHex } from '../palettes'
import type { Recipe } from '../engine/types'
import { initialRecipe, parseRecipe, starterHistory } from '../presets/recipes'

const STORAGE = 'forma-studio.v1'
const maxSaved = 96
const undoLimit = 36
const recentLimit = 3
export type NamedRecipe = { name: string; recipe: Recipe }
export type Mode = 'simple' | 'studio'
type StudioLibrary = { schema: 1; favorites: Recipe[]; saved: NamedRecipe[]; palettes: Palette[] }

export const recipeKey = (recipe: Recipe) => JSON.stringify(recipe)
const same = (a: Recipe, b: Recipe) => recipeKey(a) === recipeKey(b)
export const compositionKey = (recipe: Recipe) => `${recipe.generator}:${recipe.seed}`
const sameComposition = (a: Recipe, b: Recipe) => compositionKey(a) === compositionKey(b)

function refreshRecent(items: Recipe[], recipe: Recipe) {
  const index = items.findIndex((item) => sameComposition(item, recipe))
  if (index < 0 || same(items[index], recipe)) return items
  return items.map((item, i) => i === index ? recipe : item)
}

function mergeCollection<T>(existing: T[], incoming: T[], key: (value: T) => string, label: string) {
  const merged = new Map(existing.map((value) => [key(value), value]))
  for (const value of incoming) {
    const id = key(value)
    const previous = merged.get(id)
    if (previous && JSON.stringify(previous) !== JSON.stringify(value)) {
      throw new Error(`Ya existe «${id}» en ${label} con otro contenido. Cambia su nombre en el archivo antes de importarlo.`)
    }
    merged.set(id, value)
  }
  if (merged.size > maxSaved) {
    throw new Error(`La importación superaría el límite de ${maxSaved} elementos en ${label}. Libera espacio y vuelve a importar.`)
  }
  return [...merged.values()]
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Archivo JSON inválido.')
  return value as Record<string, unknown>
}

function nameOf(value: unknown) {
  if (typeof value !== 'string' || value.length > 70 || !value.trim()) throw new Error('El nombre debe tener entre 1 y 70 caracteres.')
  return value.trim()
}

function parsePalette(value: unknown): Palette {
  const { name, colors } = object(value)
  if (!Array.isArray(colors) || colors.length !== 5 || !colors.every(validHex)) throw new Error('Una paleta debe tener cinco colores HEX.')
  return { name: nameOf(name), colors: [...colors] }
}

export function parsePaletteFile(value: unknown): Palette {
  if (object(value).schema !== 1) throw new Error('Formato de paleta incompatible.')
  return parsePalette(value)
}

export function parseLibrary(value: unknown): StudioLibrary {
  const { schema, favorites, saved, palettes } = object(value)
  if (schema !== 1 || !Array.isArray(favorites) || !Array.isArray(saved) || !Array.isArray(palettes)
    || [favorites, saved, palettes].some((list) => list.length > maxSaved)) throw new Error('Formato de biblioteca incompatible.')
  return {
    schema: 1, favorites: favorites.map(parseRecipe),
    saved: saved.map((item) => {
      const named = object(item)
      return { name: nameOf(named.name), recipe: parseRecipe(named.recipe) }
    }),
    palettes: palettes.map(parsePalette),
  }
}

function restore() {
  const initial = { recipe: initialRecipe, history: starterHistory.slice(0, recentLimit), favorites: [], saved: [], palettes: [],
    mode: 'simple' as Mode, storageWarning: false }
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return initial
    const parsed = object(JSON.parse(raw))
    const library = parseLibrary(parsed.library)
    const history: Recipe[] = []
    const existing = Array.isArray(parsed.history) ? parsed.history : initial.history
    for (const item of existing) {
      const recipe = parseRecipe(item)
      if (!history.some((entry) => sameComposition(entry, recipe))) history.push(recipe)
      if (history.length === recentLimit) break
    }
    const restored = { ...initial, ...library, recipe: parseRecipe(parsed.recipe), history,
      mode: parsed.mode === 'studio' ? 'studio' as const : 'simple' as const }
    if (existing.length !== history.length) {
      try {
        localStorage.setItem(STORAGE, JSON.stringify({ recipe: restored.recipe, history, library, mode: restored.mode }))
      } catch {
        restored.storageWarning = true
      }
    }
    return restored
  } catch {
    return { ...initial, storageWarning: true }
  }
}

interface Studio {
  recipe: Recipe
  history: Recipe[]
  favorites: Recipe[]
  saved: NamedRecipe[]
  palettes: Palette[]
  past: Recipe[]
  future: Recipe[]
  draftFrom: Recipe | null
  mode: Mode
  storageWarning: boolean
  apply: (recipe: Recipe) => void
  edit: (update: (recipe: Recipe) => Recipe) => void
  commit: () => void
  undo: () => void
  redo: () => void
  toggleFavorite: (recipe?: Recipe) => void
  savePreset: (name: string) => void
  removePreset: (name: string) => void
  savePalette: (name: string) => void
  removePalette: (name: string) => void
  mergeLibrary: (library: StudioLibrary) => void
  setMode: (mode: Mode) => void
}

export const useStudio = create<Studio>((set, get) => ({
  ...restore(),
  past: [], future: [], draftFrom: null,
  apply: (recipe) => {
    get().commit()
    set((state) => same(recipe, state.recipe) ? state : {
      recipe,
      history: sameComposition(state.recipe, recipe)
        ? refreshRecent(state.history, recipe)
        : [recipe, ...state.history.filter((item) => !sameComposition(item, recipe))].slice(0, recentLimit),
      past: [...state.past.slice(1 - undoLimit), state.recipe], future: [],
    })
  },
  edit: (update) => set((state) => ({ recipe: update(state.recipe), draftFrom: state.draftFrom ?? state.recipe })),
  commit: () => set((state) => {
    if (!state.draftFrom) return state
    if (same(state.draftFrom, state.recipe)) return { draftFrom: null }
    return { draftFrom: null, past: [...state.past.slice(1 - undoLimit), state.draftFrom], future: [],
      history: refreshRecent(state.history, state.recipe) }
  }),
  undo: () => {
    get().commit()
    set((state) => {
      const recipe = state.past.at(-1)
      if (!recipe) return state
      return { recipe, history: refreshRecent(state.history, recipe),
        past: state.past.slice(0, -1), future: [state.recipe, ...state.future] }
    })
  },
  redo: () => set((state) => {
    const recipe = state.future[0]
    return recipe ? { recipe, history: refreshRecent(state.history, recipe), past: [...state.past, state.recipe],
      future: state.future.slice(1) } : state
  }),
  toggleFavorite: (recipe = get().recipe) => {
    get().commit()
    set((state) => ({ favorites: state.favorites.some((item) => same(recipe, item))
      ? state.favorites.filter((item) => !same(recipe, item))
      : [recipe, ...state.favorites].slice(0, maxSaved) }))
  },
  savePreset: (name) => {
    const normalized = nameOf(name)
    get().commit()
    set((state) => ({ saved: [{ name: normalized, recipe: state.recipe }, ...state.saved.filter((item) => item.name !== normalized)].slice(0, maxSaved) }))
  },
  removePreset: (name) => set((state) => ({ saved: state.saved.filter((item) => item.name !== name) })),
  savePalette: (name) => {
    const normalized = nameOf(name)
    set((state) => ({ palettes: [{ name: normalized, colors: state.recipe.palette }, ...state.palettes.filter((item) => item.name !== normalized)].slice(0, maxSaved) }))
  },
  removePalette: (name) => set((state) => ({ palettes: state.palettes.filter((item) => item.name !== name) })),
  mergeLibrary: (library) => set(({ favorites, saved, palettes }) => {
    const current = parseLibrary({ schema: 1, favorites, saved, palettes })
    return {
      favorites: mergeCollection(current.favorites, library.favorites, recipeKey, 'favoritos'),
      saved: mergeCollection(current.saved, library.saved, (item) => item.name, 'recetas'),
      palettes: mergeCollection(current.palettes, library.palettes, (item) => item.name, 'paletas'),
    }
  }),
  setMode: (mode) => set({ mode }),
}))

export function readLibrary(): StudioLibrary {
  const { favorites, saved, palettes } = useStudio.getState()
  return { schema: 1, favorites, saved, palettes }
}

useStudio.subscribe((state, previous) => {
  if (state.draftFrom || (state.recipe === previous.recipe && state.history === previous.history && state.mode === previous.mode
    && state.saved === previous.saved && state.favorites === previous.favorites && state.palettes === previous.palettes)) return
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ recipe: state.recipe, history: state.history, library: readLibrary(), mode: state.mode }))
    if (state.storageWarning) useStudio.setState({ storageWarning: false })
  } catch {
    if (!state.storageWarning) useStudio.setState({ storageWarning: true })
  }
})
