import { Aperture, ChevronDown, Dice5, Lock, ScanLine, SlidersHorizontal, Sparkles, Unlock, Waves } from 'lucide-react'
import { useState } from 'react'
import { freshSeed, TAU } from '../engine/math'
import { finishNames, finishes, symmetryModes, symmetryNames } from '../engine/symmetry'
import type { Recipe, SymmetryMode } from '../engine/types'
import { generatorById } from '../generators'
import { defaultHarmony, generateColors, harmonies, personalities } from '../palettes'
import { useStudio } from '../state/studio'
import { IconButton, Slider, toggleIndex } from './ui'

const simpleSymmetries: SymmetryMode[] = ['free', 'mirror', 'radial']
const labels = { Calm: 'Suave', Balanced: 'Equilibrada', Bold: 'Vibrante', Editorial: 'Contenida', Retro: 'Analógica',
  Nocturne: 'Nocturna', Solar: 'Cálida', Chromatic: 'Cromática' }

export function Settings({ onPalette, onGenerate, onVariant }: { onPalette: () => void; onGenerate: () => void; onVariant: () => void }) {
  const recipe = useStudio((s) => s.recipe)
  const apply = useStudio((s) => s.apply)
  const edit = useStudio((s) => s.edit)
  const commit = useStudio((s) => s.commit)
  const mode = useStudio((s) => s.mode)
  const setMode = useStudio((s) => s.setMode)
  const [seedText, setSeedText] = useState<string | null>(null)
  const studio = mode === 'studio'
  const generator = generatorById.get(recipe.generator)!
  const patch = (props: Partial<Recipe>) => apply({ ...recipe, ...props })
  const modes = studio ? symmetryModes : simpleSymmetries.includes(recipe.symmetry.mode)
    ? simpleSymmetries : [...simpleSymmetries, recipe.symmetry.mode]
  const changePersonality = (personality: Recipe['personality']) => {
    const harmony = defaultHarmony(personality)
    patch({ personality, harmony, paletteName: 'Paleta armónica',
      palette: generateColors(recipe.palette, personality, harmony, freshSeed(), recipe.colorLocks) })
  }
  const degrees = (radians: number) => Math.round(radians * 360 / TAU) + '°'
  const submitSeed = () => {
    if (seedText !== null && /^\d{1,10}$/.test(seedText) && Number(seedText) <= 0xffffffff) patch({ seed: Number(seedText) })
    setSeedText(null)
  }

  return <aside className="settings panel" aria-label="Ajustes de composición">
    <div className="panel-heading settings-heading"><SlidersHorizontal size={17} /><h2>Ajustes</h2></div>
    <div className="mode-switch" role="group" aria-label="Modo de edición">
      <button type="button" aria-pressed={!studio} onClick={() => setMode('simple')}>Simple</button>
      <button type="button" aria-pressed={studio} onClick={() => setMode('studio')}>Estudio</button>
    </div>
    <div className="settings-scroll">
      <section className="setting-section color-section">
        <div className="setting-title"><span>Color</span><IconButton className="tiny" label={recipe.paletteLocked ? 'Desbloquear paleta' : 'Bloquear paleta'}
          aria-pressed={recipe.paletteLocked} onClick={() => patch({ paletteLocked: !recipe.paletteLocked })}>
          {recipe.paletteLocked ? <Lock size={15} /> : <Unlock size={15} />}
        </IconButton></div>
        <button className="palette-trigger" type="button" onClick={onPalette} aria-label={'Editar paleta ' + recipe.paletteName}>
          <div className="swatches" aria-hidden="true">{recipe.palette.map((color, i) => <span key={i} style={{ background: color }}>
            {recipe.colorLocks.includes(i) && <Lock size={11} />}
          </span>)}</div>
          <div className="palette-caption"><span>{recipe.paletteName}</span><ChevronDown size={13} /></div>
        </button>
        <label className="field-label">Personalidad cromática
          <div className="select-wrap"><select value={recipe.personality} disabled={recipe.paletteLocked}
            onChange={(event) => changePersonality(event.target.value as Recipe['personality'])}>
            {personalities.map((name) => <option key={name} value={name}>{name} · {labels[name]}</option>)}
          </select><ChevronDown size={14} /></div>
        </label>
        {studio && <label className="field-label">Armonía
          <div className="select-wrap"><select value={recipe.harmony} disabled={recipe.paletteLocked} onChange={(event) => {
            const harmony = event.target.value as Recipe['harmony']
            patch({ harmony, paletteName: 'Paleta armónica',
              palette: generateColors(recipe.palette, recipe.personality, harmony, freshSeed(), recipe.colorLocks) })
          }}>{Object.entries(harmonies).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><ChevronDown size={14} /></div>
        </label>}
      </section>

      <section className="setting-section">
        <div className="setting-title"><span>Composición</span></div>
        <Slider label="Complejidad" value={recipe.complexity} onChange={(complexity) => edit((r) => ({ ...r, complexity }))} onCommit={commit} />
        <div className="symmetry-field">
          <span className="field-label">Simetría</span>
          {studio ? <div className="select-wrap"><select aria-label="Simetría" value={recipe.symmetry.mode}
            onChange={(event) => patch({ symmetry: { ...recipe.symmetry, mode: event.target.value as SymmetryMode } })}>
            {modes.map((value) => <option key={value} value={value} disabled={!generator.symmetry.includes(value)}>
              {symmetryNames[value]}{!generator.symmetry.includes(value) ? ' · requiere otro estilo' : ''}
            </option>)}
          </select><ChevronDown size={14} /></div> :
            <div className="symmetry-switch" role="group" aria-label="Simetría">
              {modes.map((value) => {
                const Symbol = value === 'free' ? Waves : value === 'mirror' ? ScanLine : Aperture
                const enabled = generator.symmetry.includes(value)
                return <button type="button" key={value} aria-pressed={recipe.symmetry.mode === value} disabled={!enabled}
                  title={enabled ? symmetryNames[value] : 'Este estilo requiere una trama de impresión continua.'}
                  onClick={() => patch({ symmetry: { ...recipe.symmetry, mode: value } })}>
                  <Symbol size={15} /><span>{symmetryNames[value]}</span>
                </button>
              })}
            </div>}
        </div>
        {studio && recipe.symmetry.mode !== 'free' && <>
          {['radial', 'kaleido'].includes(recipe.symmetry.mode) && <Slider label="Orden radial" min={2} max={16} step={1} value={recipe.symmetry.order}
            display={String(recipe.symmetry.order)} onChange={(order) => edit((r) => ({ ...r, symmetry: { ...r.symmetry, order } }))} onCommit={commit} />}
          <Slider label="Eje" min={-Math.PI} max={Math.PI} value={recipe.symmetry.axis} display={degrees(recipe.symmetry.axis)}
            onChange={(axis) => edit((r) => ({ ...r, symmetry: { ...r.symmetry, axis } }))} onCommit={commit} />
          {(['radial', 'kaleido'].includes(recipe.symmetry.mode) || recipe.symmetry.perturbation > 0) &&
            <Slider label="Fase" min={-Math.PI} max={Math.PI} value={recipe.symmetry.phase} display={degrees(recipe.symmetry.phase)}
              onChange={(phase) => edit((r) => ({ ...r, symmetry: { ...r.symmetry, phase } }))} onCommit={commit} />}
          <Slider label="Perturbación" value={recipe.symmetry.perturbation}
            onChange={(perturbation) => edit((r) => ({ ...r, symmetry: { ...r.symmetry, perturbation } }))} onCommit={commit} />
        </>}
      </section>

      <section className="setting-section">
        <div className="setting-title"><span>Textura</span></div>
        {studio && <div className="select-wrap"><select aria-label="Acabado" value={recipe.texture.finish}
          onChange={(event) => patch({ texture: { ...recipe.texture, finish: event.target.value as Recipe['texture']['finish'] } })}>
          {finishes.map((finish) => <option key={finish} value={finish}>{finishNames[finish]}</option>)}
        </select><ChevronDown size={14} /></div>}
        {(!studio || recipe.texture.finish !== 'none') && <Slider label={studio ? 'Intensidad' : finishNames[recipe.texture.finish === 'none' ? 'fine' : recipe.texture.finish]}
          value={recipe.texture.finish === 'none' && !studio ? 0 : recipe.texture.amount}
          onChange={(amount) => edit((r) => ({ ...r, texture: { finish: r.texture.finish === 'none' ? 'fine' : r.texture.finish, amount } }))} onCommit={commit} />}
      </section>
      {studio && <>
        <section className="setting-section">
          <div className="setting-title"><span>{generator.name}</span></div>
          {generator.parameters.map((param, index) => <Slider key={param.label} label={param.label} hint={param.description}
            value={recipe.parameters[index]} locked={recipe.parameterLocks.includes(index)}
            onLock={() => patch({ parameterLocks: toggleIndex(recipe.parameterLocks, index) })}
            onChange={(value) => edit((r) => {
              const parameters = [...r.parameters] as Recipe['parameters']
              parameters[index] = value
              return { ...r, parameters }
            })} onCommit={commit} />)}
        </section>
        <section className="setting-section">
          <div className="setting-title"><span>Renderizado</span></div>
          <Slider label="Contraste" min={0.45} max={1.65} value={recipe.contrast} onChange={(contrast) => edit((r) => ({ ...r, contrast }))} onCommit={commit} />
          <Slider label="Croma" max={1.65} value={recipe.saturation} onChange={(saturation) => edit((r) => ({ ...r, saturation }))} onCommit={commit} />
          <Slider label="Mezcla de campos" value={recipe.render.mix}
            onChange={(mix) => edit((r) => ({ ...r, render: { ...r.render, mix } }))} onCommit={commit} />
          <label className="checkbox"><input type="checkbox" checked={recipe.render.dither}
            onChange={(event) => patch({ render: { ...recipe.render, dither: event.target.checked } })} /> Dithering técnico</label>
          <label className="field-label">Semilla
            <input value={seedText ?? recipe.seed} inputMode="numeric" maxLength={10} onChange={(event) => setSeedText(event.target.value)}
              onBlur={submitSeed} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
          </label>
        </section>
      </>}
    </div>
    <div className="settings-actions">
      <button className="button primary generate" type="button" onClick={onGenerate}><Sparkles size={16} /> Generar</button>
      <button className="button secondary generate" type="button" onClick={onVariant}><Dice5 size={16} /> Nueva variante</button>
    </div>
  </aside>
}
