import { useEffect, useRef, useState } from 'react'
import { Download, Shuffle, Trash2, Upload } from 'lucide-react'
import type { FormEvent } from 'react'
import type { Recipe } from '../engine/types'
import { freshSeed } from '../engine/math'
import { generatorById } from '../generators'
import { exportImage, download, downloadJson } from '../export/client'
import { resolution, suffix, validateSize } from '../export/image'
import type { ImageFormat } from '../export/image'
import { extractColors, generateColors, palettes, validHex } from '../palettes'
import { parseRecipe } from '../presets/recipes'
import { parseLibrary, readLibrary, recipeKey, useStudio } from '../state/studio'
import { Artwork } from './Artwork'
import { Dialog, IconButton, toggleIndex } from './ui'
import { Lock, Unlock } from 'lucide-react'

export function ExportDialog({ recipe, onClose, notify }: { recipe: Recipe; onClose: () => void; notify: (message: string) => void }) {
  const [format, setFormat] = useState<ImageFormat>('image/png')
  const [size, setSize] = useState('1080')
  const [width, setWidth] = useState(() => String(resolution(recipe, 1080)[0]))
  const [height, setHeight] = useState(() => String(resolution(recipe, 1080)[1]))
  const [quality, setQuality] = useState(0.94)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ fraction: number; message: string } | null>(null)
  const job = useRef<AbortController | null>(null)
  useEffect(() => () => job.current?.abort(), [])
  const selectSize = (value: string) => {
    setSize(value)
    if (value !== 'custom') {
      const [w, h] = resolution(recipe, Number(value))
      setWidth(String(w))
      setHeight(String(h))
    }
  }
  const start = async (event: FormEvent) => {
    event.preventDefault()
    if (job.current) return
    setError('')
    const controller = new AbortController()
    job.current = controller
    try {
      const w = Number(width)
      const h = Number(height)
      validateSize(w, h)
      setProgress({ fraction: 0, message: 'Preparando lienzo' })
      const blob = await exportImage(recipe, { width: w, height: h, format, quality },
        (fraction, message) => setProgress({ fraction, message }), controller.signal)
      download(blob, `forma-${recipe.generator}-${recipe.seed}-${w}x${h}.${suffix[format]}`)
      notify('Imagen exportada')
      onClose()
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falló la exportación.')
    } finally {
      if (job.current === controller) job.current = null
      if (!controller.signal.aborted) setProgress(null)
    }
  }
  return <Dialog title="Exportar imagen" description="Renderizado a la resolución final en sRGB." onClose={onClose}>
    <form className="dialog-form" onSubmit={start}>
      <div className="export-preview"><Artwork recipe={recipe} thumbnail /></div>
      <label className="field-label">Formato<select disabled={!!progress} value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)}>
        <option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option>
      </select></label>
      <label className="field-label">Resolución<select disabled={!!progress} value={size} onChange={(e) => selectSize(e.target.value)}>
        <option value="1080">1080p</option><option value="1440">1440p</option><option value="2160">4K</option><option value="4320">8K</option>
        <option value="custom">Personalizada</option>
      </select></label>
      <div className="form-row">
        <label className="field-label">Ancho (px)<input type="number" value={width} min={16} max={8192}
          readOnly={size !== 'custom' || !!progress} onChange={(e) => setWidth(e.target.value)} /></label>
        <label className="field-label">Alto (px)<input type="number" value={height} min={16} max={8192}
          readOnly={size !== 'custom' || !!progress} onChange={(e) => setHeight(e.target.value)} /></label>
      </div>
      {size === '4320' && <p className="note">Las dimensiones se ajustan a la proporción y al límite de 34 megapíxeles.</p>}
      {format !== 'image/png' && <label className="field-label">Calidad {Math.round(quality * 100)}%
        <input type="range" min="0.55" max="1" step="0.01" value={quality} disabled={!!progress} onChange={(e) => setQuality(Number(e.target.value))} />
      </label>}
      {progress && <div role="status" className="progress"><span>{progress.message} · {Math.round(progress.fraction * 100)}%</span>
        <progress max={1} value={progress.fraction} /></div>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="dialog-actions">
        {progress ? <button className="button secondary" type="button" onClick={() => { job.current?.abort(); job.current = null; setProgress(null) }}>Cancelar renderizado</button>
          : <><button className="button secondary" type="button" onClick={onClose}>Cerrar</button>
            <button className="button primary" type="submit"><Download size={16} /> Descargar</button></>}
      </div>
    </form>
  </Dialog>
}

export function PaletteDialog({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const recipe = useStudio((s) => s.recipe)
  const custom = useStudio((s) => s.palettes)
  const apply = useStudio((s) => s.apply)
  const savePalette = useStudio((s) => s.savePalette)
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const setColors = (colors: string[], paletteName: string) => {
    if (recipe.paletteLocked) return
    apply({ ...recipe, paletteName, palette: colors.map((color, index) => recipe.colorLocks.includes(index) ? recipe.palette[index] : color) })
  }
  const extract = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.stage-frame canvas')
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !canvas.dataset.backend) return
    const reduced = Object.assign(document.createElement('canvas'), { width: 60, height: 40 })
    const sample = reduced.getContext('2d')!
    sample.drawImage(canvas, 0, 0, 60, 40)
    setColors(extractColors(sample.getImageData(0, 0, 60, 40).data), 'Paleta extraída')
  }
  return <Dialog title="Paletas" description="Edita la paleta actual o elige una de la biblioteca." className="wide-dialog" onClose={onClose}>
    <div className="palette-edit">
      {recipe.palette.map((color, i) => <div className="color-editor" key={i}>
        <label className="color-preview" style={{ background: color }}><span className="sr-only">Selector de color {i + 1}</span>
          <input aria-label={'Selector de color ' + (i + 1)} type="color" value={color} disabled={recipe.paletteLocked || recipe.colorLocks.includes(i)}
            onChange={(e) => setColors(recipe.palette.map((v, j) => i === j ? e.target.value : v), 'Paleta editada')} /></label>
        <div className="hex-row">
          <HexField color={color} index={i} disabled={recipe.paletteLocked || recipe.colorLocks.includes(i)}
            onChange={(value) => setColors(recipe.palette.map((v, j) => i === j ? value : v), 'Paleta editada')} />
          <IconButton className="tiny" label={(recipe.colorLocks.includes(i) ? 'Desbloquear' : 'Bloquear') + ' color ' + (i + 1)}
            aria-pressed={recipe.colorLocks.includes(i)} disabled={recipe.paletteLocked}
            onClick={() => apply({ ...recipe, colorLocks: toggleIndex(recipe.colorLocks, i) })}>
            {recipe.colorLocks.includes(i) ? <Lock size={13} /> : <Unlock size={13} />}
          </IconButton>
        </div>
      </div>)}
    </div>
    <div className="palette-tools">
      <button className="button secondary" type="button" disabled={recipe.paletteLocked}
        onClick={() => setColors(generateColors(recipe.palette, recipe.personality, recipe.harmony, freshSeed(), recipe.colorLocks), 'Paleta armónica')}>
        <Shuffle size={15} /> Regenerar colores</button>
      <button className="button secondary" type="button" disabled={recipe.paletteLocked} onClick={extract}>Extraer del lienzo</button>
      <button className="button secondary" type="button"
        onClick={() => downloadJson({ schema: 1, name: recipe.paletteName, colors: recipe.palette }, 'forma-paleta.json')}>Exportar paleta</button>
      {recipe.paletteLocked && <span className="note">Paleta bloqueada</span>}
    </div>
    <label className="field-label">Buscar paleta<input placeholder="Nombre de la paleta" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="palette-grid">{[...custom, ...palettes].filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).map((item, index) =>
      <button type="button" className="palette-card" key={item.name + index} disabled={recipe.paletteLocked}
        onClick={() => setColors(item.colors, item.name)}>
        <span className="palette-card-swatches">{item.colors.map((color, i) => <span key={i} style={{ background: color }} />)}</span>
        <span>{item.name}</span>
      </button>)}</div>
    <form className="save-inline" onSubmit={(event) => {
      event.preventDefault()
      try { savePalette(name); setName(''); setError(''); notify('Paleta guardada') } catch (reason) { setError((reason as Error).message) }
    }}>
      <input aria-label="Nombre de paleta personalizada" placeholder="Nombre de la nueva paleta" value={name} maxLength={70}
        onChange={(event) => setName(event.target.value)} required />
      <button className="button primary" type="submit">Guardar paleta</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
  </Dialog>
}

function HexField({ color, index, disabled, onChange }: { color: string; index: number; disabled: boolean; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const valid = draft === null || validHex(draft)
  return <input aria-label={'Color HEX ' + (index + 1)} value={draft ?? color.toUpperCase()} maxLength={7} disabled={disabled} aria-invalid={!valid}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => { if (draft && validHex(draft)) onChange(draft.toLowerCase()); setDraft(null) }}
    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}

export function LibraryDialog({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const recipe = useStudio((s) => s.recipe)
  const saved = useStudio((s) => s.saved)
  const custom = useStudio((s) => s.palettes)
  const store = useStudio()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const importFile = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      if (file.size > 1024 * 1024) throw new Error('El archivo JSON debe pesar menos de 1 MB.')
      const value = JSON.parse(await file.text()) as unknown
      if (value && typeof value === 'object' && 'generator' in value) {
        store.apply(parseRecipe(value))
        notify('Receta importada')
        onClose()
      } else {
        store.mergeLibrary(parseLibrary(value))
        notify('Biblioteca importada')
      }
    } catch (reason) {
      setError(reason instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : (reason as Error).message)
    } finally {
      if (input.current) input.current.value = ''
    }
  }
  return <Dialog title="Mis recetas" description="Guarda composiciones reproducibles y mueve tu biblioteca entre dispositivos." className="wide-dialog" onClose={onClose}>
    <form className="save-inline" onSubmit={(event) => {
      event.preventDefault()
      try { store.savePreset(name); setName(''); setError(''); notify('Receta guardada') } catch (reason) { setError((reason as Error).message) }
    }}>
      <input aria-label="Nombre de receta" placeholder={generatorById.get(recipe.generator)!.name} value={name} maxLength={70}
        onChange={(event) => setName(event.target.value)} required />
      <button className="button primary" type="submit">Guardar receta</button>
    </form>
    <div className="library-grid">
      {saved.map((item) => <div className="saved-card" key={item.name}>
        <button type="button" onClick={() => { store.apply(item.recipe); onClose() }}><Artwork recipe={item.recipe} thumbnail /><span>{item.name}</span></button>
        <IconButton label={'Eliminar ' + item.name} onClick={() => store.removePreset(item.name)}><Trash2 size={15} /></IconButton>
      </div>)}
      {!saved.length && <p className="note">Tus recetas guardadas aparecerán aquí.</p>}
    </div>
    {custom.length > 0 && <div className="custom-palettes"><h3>Paletas personales</h3>{custom.map((palette) =>
      <div key={palette.name} className="custom-row"><span>{palette.name}</span>
        <IconButton label={'Eliminar paleta ' + palette.name} onClick={() => store.removePalette(palette.name)}><Trash2 size={15} /></IconButton></div>)}</div>}
    <div className="palette-tools">
      <button className="button secondary" type="button" onClick={() => input.current?.click()}><Upload size={15} /> Importar JSON</button>
      <button className="button secondary" type="button" onClick={() => downloadJson(recipe, `forma-receta-${recipe.seed}.json`)}>Exportar receta</button>
      <button className="button secondary" type="button" onClick={() => downloadJson(readLibrary(), 'forma-biblioteca.json')}>Exportar biblioteca</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => { void importFile(event.target.files?.[0]) }} />
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </Dialog>
}

export function CompareDialog({ recipe, candidates, onClose }: { recipe: Recipe; candidates: Recipe[]; onClose: () => void }) {
  const options = [...new Map(candidates.filter((candidate) => recipeKey(candidate) !== recipeKey(recipe))
    .map((candidate) => [recipeKey(candidate), candidate])).values()]
  const [index, setIndex] = useState(0)
  const other = options[index]
  const apply = useStudio((state) => state.apply)
  return <Dialog title="Comparar composiciones" className="compare-dialog" onClose={onClose}>
    {other ? <>
      <label className="field-label">Comparar con<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
        {options.map((candidate, i) => <option key={recipeKey(candidate)} value={i}>
          {generatorById.get(candidate.generator)!.name} · {candidate.seed}</option>)}
      </select></label>
      <div className="compare-grid">{[recipe, other].map((r, i) => <div key={i}><div className="compare-preview">
        <Artwork recipe={r} label={'Composición ' + (i + 1)} /></div>
        <div className="compare-meta"><strong>{generatorById.get(r.generator)!.name}</strong><span>{r.seed}</span></div>
      </div>)}</div>
      <div className="dialog-actions"><button className="button primary" type="button" onClick={() => { apply(other); onClose() }}>Usar esta composición</button></div>
    </> : <p className="note">Genera una variante para tener otra composición que comparar.</p>}
  </Dialog>
}
