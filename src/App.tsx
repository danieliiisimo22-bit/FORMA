import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowDownToLine, ArrowUpRight, BookOpen, ChevronDown, ChevronRight, CircleHelp, Columns2, Expand, GalleryHorizontalEnd,
  Grid2X2, Heart, History, Layers3, Minus, Plus, Redo2, Shuffle, SquareDashed, Undo2 } from 'lucide-react'
import { Artwork } from './components/Artwork'
import { CompareDialog, ExportDialog, LibraryDialog, PaletteDialog } from './components/Dialogs'
import { Settings } from './components/Settings'
import { Dialog, IconButton } from './components/ui'
import { freshSeed } from './engine/math'
import type { Aspect, Recipe } from './engine/types'
import { generatorById } from './generators'
import { families, familyDescriptions } from './generators/families'
import type { Family } from './generators/families'
import { aspectRatio, aspects, explore, initialRecipe, mutate, presets, surprise, variant } from './presets/recipes'
import { compositionKey, recipeKey, useStudio } from './state/studio'

type Modal = 'palette' | 'export' | 'library' | 'compare' | 'aspect' | 'help'
type View = 'history' | 'favorites' | 'variants'
const viewLabels = { history: 'Historial', favorites: 'Favoritos', variants: 'Variantes' }
const aspectLabels: Record<Aspect, string> = { '1:1': '1:1', '16:9': '16:9', '9:16': '9:16', '4:3': '4:3', '3:2': '3:2', '21:9': '21:9', custom: 'Personalizada' }
export default function App() {
  const recipe = useStudio((s) => s.recipe)
  const history = useStudio((s) => s.history)
  const favorites = useStudio((s) => s.favorites)
  const undoCount = useStudio((s) => s.past.length)
  const redoCount = useStudio((s) => s.future.length)
  const storageWarning = useStudio((s) => s.storageWarning)
  const paused = useStudio((s) => s.draftFrom !== null)
  const apply = useStudio((s) => s.apply)
  const toggleFavorite = useStudio((s) => s.toggleFavorite)
  const [modal, setModal] = useState<Modal | null>(null)
  const [view, setView] = useState<View>('history')
  const [variants, setVariants] = useState<Recipe[]>([])
  const [variantCount, setVariantCount] = useState(4)
  const [expanded, setExpanded] = useState<Family[]>([])
  const [zoom, setZoom] = useState(1)
  const [notice, setNotice] = useState('')
  const [focus, setFocus] = useState(false)
  const noticeTimeout = useRef(0)
  const generator = generatorById.get(recipe.generator)!
  const currentKey = recipeKey(recipe)
  const favorite = favorites.some((item) => recipeKey(item) === currentKey)
  const visible = view === 'history' ? history : view === 'favorites' ? favorites : variants
  const ratio = aspectRatio(recipe)
  const notify = (message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimeout.current)
    noticeTimeout.current = window.setTimeout(() => setNotice(''), 3000)
  }
  useEffect(() => () => clearTimeout(noticeTimeout.current), [])
  const close = () => setModal(null)
  const generate = () => { apply({ ...recipe, seed: freshSeed() }); setView('history') }
  const newVariant = () => { apply(variant(recipe, freshSeed())); setView('history') }
  const keepFavorite = () => {
    toggleFavorite()
    notify(favorite ? 'Eliminado de favoritos' : 'Guardado en favoritos')
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || modal || (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable]'))) return
      const key = event.key.toLowerCase()
      const store = useStudio.getState()
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
      } else if ((event.metaKey || event.ctrlKey) && key === 'y') {
        event.preventDefault()
        store.redo()
      } else if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault()
        setModal('library')
      } else if (key === 'escape') {
        setFocus(false)
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && key === 'g') {
        event.preventDefault()
        store.apply({ ...store.recipe, seed: freshSeed() })
        setView('history')
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [modal])

  const loadPreset = (preset: Recipe) => {
    const paletteName = recipe.paletteLocked ? recipe.paletteName : preset.paletteName
    const palette = recipe.paletteLocked ? recipe.palette
      : preset.palette.map((color, i) => recipe.colorLocks.includes(i) ? recipe.palette[i] : color)
    apply({ ...preset, palette, paletteName, colorLocks: recipe.colorLocks, paletteLocked: recipe.paletteLocked,
      aspect: recipe.aspect, customAspect: recipe.customAspect })
    setView('history')
  }

  return <div className={'studio ' + (focus ? 'focus-view' : '')}>
    <header className="topbar">
      <div className="brand">
        <img src={import.meta.env.BASE_URL + 'forma.svg'} alt="" width="34" height="34" />
        <div className="wordmark"><span>FORMA</span><small>GENERATIVE ART STUDIO</small></div>
      </div>
      <div className="top-tools" role="group" aria-label="Composición">
        <button type="button" className="button toolbar" aria-label="Nueva" onClick={() => { loadPreset({ ...initialRecipe, seed: freshSeed() }); setZoom(1); notify('Nueva composición') }}>
          <Plus size={17} /><span>Nueva</span></button>
        <span className="bar-divider" />
        <IconButton label="Deshacer" disabled={!undoCount && !paused} onClick={() => useStudio.getState().undo()}><Undo2 size={18} /></IconButton>
        <IconButton label="Rehacer" disabled={!redoCount || paused} onClick={() => useStudio.getState().redo()}><Redo2 size={18} /></IconButton>
        <span className="bar-divider surprise-divider" />
        <button type="button" className="button toolbar surprise" aria-label="Sorpréndeme" onClick={() => { apply(surprise(recipe, freshSeed())); setView('history') }}>
          <Shuffle size={16} /><span>Sorpréndeme</span></button>
      </div>
      <div className="top-actions">
        <IconButton className="help-btn" label="Ayuda y atajos" onClick={() => setModal('help')}><CircleHelp size={18} /></IconButton>
        <IconButton label={favorite ? 'Quitar favorito' : 'Guardar favorito'} aria-pressed={favorite}
          className="top-heart" onClick={keepFavorite}><Heart size={18} fill={favorite ? 'currentColor' : 'none'} /></IconButton>
        <button type="button" className="button primary export-button" onClick={() => setModal('export')}><ArrowDownToLine size={17} /> <span>Exportar</span></button>
      </div>
    </header>

    <main className="work">
      <aside className="library panel" aria-label="Biblioteca de estilos">
        <div className="panel-heading"><Layers3 size={17} /><h2>Biblioteca</h2></div>
        <div className="library-label"><span>Estilos visuales</span><span>{presets.length}</span></div>
        <div className="families">
          {families.map((family) => {
            const options = presets.filter((item) => generatorById.get(item.generator)!.family === family)
            const active = generator.family === family
            const lead = active ? options.find((item) => item.generator === recipe.generator)! : options[0]
            const isExpanded = expanded.includes(family)
            return <div key={family} className="family-group">
              <div className={'family-row ' + (active ? 'active' : '')}>
                <button type="button" className="family-item" aria-pressed={active} aria-label={family}
                  onClick={() => { if (!active) loadPreset(lead); else if (options.length > 1) {
                    setExpanded(isExpanded ? expanded.filter((item) => item !== family) : [...expanded, family])
                  } }}>
                  <span className="family-thumb"><Artwork recipe={lead} thumbnail /></span>
                  <span className="family-copy"><strong>{family}</strong><small>{familyDescriptions[family]}</small></span>
                </button>
                {options.length > 1 && <IconButton label={isExpanded ? 'Ocultar estilos de ' + family : 'Ver estilos de ' + family}
                  className="family-expand" aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? expanded.filter((item) => item !== family) : [...expanded, family])}>
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </IconButton>}
              </div>
              {isExpanded && options.length > 1 && <div className="family-submenu">
                {options.map((option) => <button type="button" key={option.generator} aria-pressed={recipe.generator === option.generator}
                  onClick={() => loadPreset(option)}><Artwork recipe={option} thumbnail /><span>{generatorById.get(option.generator)!.name}</span></button>)}
              </div>}
            </div>
          })}
        </div>
        <button type="button" className="button library-button" onClick={() => setModal('library')}><BookOpen size={17} /> Mis recetas <ArrowUpRight size={14} /></button>
      </aside>

      <section className="workspace" aria-label="Lienzo e historial">
        <div className="canvas-toolbar">
          <div className="canvas-title"><SquareDashed size={17} /><h1>Lienzo</h1></div>
          <div className="canvas-tools">
            <div className="select-wrap aspect-select">
              <select aria-label="Proporción del lienzo" value={recipe.aspect}
                onChange={(event) => {
                  const aspect = event.target.value as Aspect
                  if (aspect === 'custom') setModal('aspect')
                  else { apply({ ...recipe, aspect }); setZoom(1) }
                }}>
                {aspects.map((aspect) => <option key={aspect} value={aspect}>{aspectLabels[aspect]}</option>)}
              </select><ChevronDown size={13} />
            </div>
            {recipe.aspect === 'custom' && <button className="button toolbar" type="button" onClick={() => setModal('aspect')}>Editar proporción</button>}
            <IconButton label={focus ? 'Salir de enfoque' : 'Vista enfocada'} aria-pressed={focus} onClick={() => setFocus(!focus)}><Expand size={16} /></IconButton>
          </div>
        </div>
        <div className="stage">
          <div className="stage-body" style={{ '--ratio': ratio, '--zoom': zoom } as CSSProperties}>
            <div className="stage-frame"><Artwork recipe={recipe} paused={paused} label={'Composición ' + generator.name} /></div>
          </div>
        </div>
        <div className="canvas-caption">
          <div className="live-label">
            <span className="live-dot" /><strong title={generator.description}>{generator.name}</strong><span className="caption-slash">/</span>
            <span className="caption-family">{generator.family}</span>
            {generator.intense && <span className="intense" title="Patrón estático de alta intensidad visual.">Patrón óptico intenso</span>}
          </div>
          <div className="zoom-tools">
            <IconButton label="Alejar" disabled={zoom <= 0.5} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}><Minus size={14} /></IconButton>
            <button type="button" className="zoom-value" title="Ajustar al lienzo" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <IconButton label="Acercar" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + 0.25))}><Plus size={14} /></IconButton>
          </div>
        </div>

        <section className="timeline" aria-label="Exploración visual">
          <div className="timeline-head">
            <div className="timeline-tabs" role="tablist" aria-label="Colecciones">
              {(Object.keys(viewLabels) as View[]).map((item) => {
                const Symbol = item === 'history' ? History : item === 'favorites' ? Heart : Grid2X2
                const switchTab = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                  event.preventDefault()
                  const tabs = Object.keys(viewLabels) as View[]
                  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                    : (tabs.indexOf(item) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
                  setView(tabs[index])
                  document.getElementById('tab-' + tabs[index])?.focus()
                }
                return <button key={item} type="button" role="tab" id={'tab-' + item} aria-controls="timeline-items" aria-selected={view === item}
                  tabIndex={view === item ? 0 : -1} onKeyDown={switchTab} onClick={() => setView(item)}><Symbol size={14} /><span>{viewLabels[item]}</span></button>
              })}
            </div>
            <div className="timeline-tools">
              <IconButton label="Comparar composiciones" onClick={() => setModal('compare')}><Columns2 size={16} /></IconButton>
              <button className="button timeline-explore" type="button" onClick={() => { apply(explore(recipe, freshSeed())); setView('history'); notify('Exploración de ' + generator.family) }}>
                <GalleryHorizontalEnd size={15} /><span>Explorar</span></button>
            </div>
          </div>
          {view === 'variants' && <div className="mutation-controls">
            <label>Cantidad<select value={variantCount} onChange={(event) => setVariantCount(Number(event.target.value))}>
              {[4, 9, 16].map((count) => <option key={count}>{count}</option>)}</select></label>
            <button className="button secondary" type="button" onClick={() => setVariants(mutate(recipe, freshSeed(), variantCount))}>Mutar composición</button>
          </div>}
          <div className="timeline-items" id="timeline-items" role="tabpanel" aria-labelledby={'tab-' + view}>
            {visible.map((item) => {
              const key = recipeKey(item)
              const active = currentKey === key
              const title = generatorById.get(item.generator)!.name
              const saved = favorites.some((saved) => recipeKey(saved) === key)
              return <div className={'film-item ' + (active ? 'selected' : '')} key={view === 'history' ? compositionKey(item) : key}>
                <button type="button" className="film-open" aria-pressed={active} title={title + ' · ' + item.seed}
                  onClick={() => apply(item)}><Artwork recipe={item} thumbnail /><span>{title}</span></button>
                <IconButton className="film-heart" label={(saved ? 'Quitar favorito ' : 'Marcar favorito ') + title}
                  aria-pressed={saved} onClick={() => toggleFavorite(item)}><Heart size={13} fill={saved ? 'currentColor' : 'none'} /></IconButton>
              </div>
            })}
            {!visible.length && <p className="empty-timeline">{view === 'favorites'
              ? 'Marca una composición con el corazón para guardarla aquí.' : 'Genera descendientes de la composición actual.'}</p>}
          </div>
        </section>
      </section>

      <Settings onPalette={() => setModal('palette')} onGenerate={generate} onVariant={newVariant} />
    </main>
    <footer className="statusbar">
      <div><span className="status-dot" /> Sesión local {storageWarning && <span className="error" role="alert">· El navegador no pudo guardar la sesión</span>}</div>
      <span className="seed-status">SEMILLA <b>{recipe.seed}</b></span>
    </footer>
    <div className={'toast ' + (notice ? 'shown' : '')} role="status">{notice}</div>
    {modal === 'palette' && <PaletteDialog onClose={close} notify={notify} />}
    {modal === 'export' && <ExportDialog recipe={recipe} onClose={close} notify={notify} />}
    {modal === 'library' && <LibraryDialog onClose={close} notify={notify} />}
    {modal === 'compare' && <CompareDialog recipe={recipe} candidates={[...visible, ...history, ...favorites, ...variants]} onClose={close} />}
    {modal === 'aspect' && <AspectDialog recipe={recipe} onClose={close} onApply={(customAspect) => {
      apply({ ...recipe, aspect: 'custom', customAspect }); setZoom(1); close()
    }} />}
    {modal === 'help' && <Dialog title="Atajos" onClose={close}>
      <dl className="shortcuts">
        <div><dt>Generar</dt><dd><kbd>G</kbd></dd></div>
        <div><dt>Deshacer</dt><dd><kbd>Ctrl / ⌘</kbd> <kbd>Z</kbd></dd></div>
        <div><dt>Rehacer</dt><dd><kbd>Ctrl / ⌘</kbd> <kbd>Mayús</kbd> <kbd>Z</kbd></dd></div>
        <div><dt>Mis recetas</dt><dd><kbd>Ctrl / ⌘</kbd> <kbd>S</kbd></dd></div>
        <div><dt>Salir de un diálogo o de enfoque</dt><dd><kbd>Esc</kbd></dd></div>
      </dl>
    </Dialog>}
  </div>
}

function AspectDialog({ recipe, onClose, onApply }: { recipe: Recipe; onClose: () => void; onApply: (value: [number, number]) => void }) {
  const [width, setWidth] = useState(recipe.customAspect[0])
  const [height, setHeight] = useState(recipe.customAspect[1])
  const [error, setError] = useState(false)
  return <Dialog title="Proporción personalizada" description="Define la relación entre ancho y alto del lienzo." onClose={onClose}>
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault()
      if (Math.max(width, height) / Math.min(width, height) > 8) setError(true)
      else onApply([width, height])
    }}>
      <div className="form-row">
        <label className="field-label">Ancho<input type="number" min={1} max={100} required value={width}
          onChange={(event) => setWidth(Number(event.target.value))} /></label>
        <label className="field-label">Alto<input type="number" min={1} max={100} required value={height}
          onChange={(event) => setHeight(Number(event.target.value))} /></label>
      </div>
      {error && <p className="error" role="alert">La relación máxima entre lados es 8:1.</p>}
      <div className="dialog-actions"><button className="button primary" type="submit">Aplicar proporción</button></div>
    </form>
  </Dialog>
}
