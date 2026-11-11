import { RAY_HEX } from './LightRays'
import type { ViewId } from './Scene'

export type Disorder = 'normal' | 'myopia' | 'hyperopia' | 'cataract'

export const DISORDERS: Record<Disorder, { name: string; icon: string; text: string }> = {
  normal: {
    name: 'Visió normal',
    icon: '◉',
    text: "Ull emmetrope: els raigs convergeixen exactament sobre la retina i la imatge és nítida.",
  },
  myopia: {
    name: 'Miopia',
    icon: '⬭',
    text: "El globus ocular és massa llarg: els raigs convergeixen DAVANT la retina. Els objectes llunyans es veuen borrosos.",
  },
  hyperopia: {
    name: 'Hipermetropia',
    icon: '◖',
    text: "El globus ocular és massa curt: els raigs convergeixen DARRERE la retina. Costa enfocar, sobretot de prop.",
  },
  cataract: {
    name: 'Cataractes',
    icon: '◌',
    text: "El cristal·lí es torna opac i blanquinós: bloqueja i difon la llum, i la imatge queda borrosa i velada.",
  },
}

const VIEW_NAMES: Record<ViewId, string> = { lateral: 'Tall lateral', oblique: 'Vista 3/4', retina: 'Retina' }

interface Props {
  study: boolean
  setStudy: (v: boolean) => void
  intensity: number
  setIntensity: (v: number) => void
  sliderPos: number
  setSliderPos: (v: number) => void
  distanceLabel: string
  disorder: Disorder
  setDisorder: (d: Disorder) => void
  photoMode: boolean
  setPhotoMode: (v: boolean) => void
  view: ViewId
  setView: (v: ViewId) => void
  showRays: boolean
  setShowRays: (v: boolean) => void
  showPulse: boolean
  setShowPulse: (v: boolean) => void
  onHide: () => void
  stats: { pupilMm: number; accommodation: number; lensPower: number; focusText: string; inFocus: boolean }
}

export function ControlPanel(p: Props) {
  const pupilState = p.intensity > 62 ? 'Miosi · pupil·la tancada' : p.intensity < 38 ? 'Midriasi · pupil·la oberta' : 'Pupil·la en repòs'

  return (
    <aside className="panel">
      <header className="panel__head">
        <div>
          <h1>La Vista</h1>
          <p className="subtitle">El procés de la visió · simulador 3D</p>
        </div>
        <button className="ghost" onClick={p.onHide} title="Amagar panell (tecla H)">⟩⟩</button>
      </header>

      <div className="seg seg--big">
        <button className={!p.study ? 'on' : ''} onClick={() => p.setStudy(false)}>
          🎬 Mode presentació
          <small>sense text</small>
        </button>
        <button className={p.study ? 'on' : ''} onClick={() => p.setStudy(true)}>
          📖 Mode estudi
          <small>amb etiquetes</small>
        </button>
      </div>

      <section className="card">
        <h2>☀ Miosi / Midriasi</h2>
        <label className="slider">
          <span className="slider__head">
            Intensitat de la llum <b>{p.intensity}%</b>
          </span>
          <input type="range" min={0} max={100} value={p.intensity} onChange={(e) => p.setIntensity(+e.target.value)} className="range--light" />
          <span className="slider__ends"><span>Fosc → midriasi</span><span>Molta llum → miosi</span></span>
        </label>
        <div className="chips">
          <span className="chip">{pupilState}</span>
          <span className="chip">⌀ {p.stats.pupilMm.toFixed(1)} mm</span>
        </div>
      </section>

      <section className="card">
        <h2>🔍 Acomodació</h2>
        <label className="slider">
          <span className="slider__head">
            Distància de l'objecte <b>{p.distanceLabel}</b>
          </span>
          <input type="range" min={0} max={1000} value={p.sliderPos} onChange={(e) => p.setSliderPos(+e.target.value)} />
          <span className="slider__ends"><span>10 cm</span><span>6 m</span></span>
        </label>
        <div className="chips">
          <span className="chip">Múscul ciliar {Math.round(p.stats.accommodation * 100)}%</span>
          <span className="chip">Cristal·lí {p.stats.lensPower.toFixed(1)} D</span>
        </div>
        <div className={`focus ${p.stats.inFocus ? 'focus--ok' : 'focus--bad'}`}>
          {p.stats.inFocus ? '✔' : '⚠'} {p.stats.focusText}
        </div>
      </section>

      <button className={`big ${p.photoMode ? 'big--on' : ''}`} onClick={() => p.setPhotoMode(!p.photoMode)}>
        <span className="big__icon">⁂</span>
        <span>
          <b>Fotoreceptors</b>
          <small>{p.photoMode ? 'Mostrant cons i bastons' : 'Zoom a la retina: cons i bastons'}</small>
        </span>
      </button>

      <section className="card">
        <h2>👁 Trastorns de la visió</h2>
        <div className="grid2">
          {(Object.keys(DISORDERS) as Disorder[]).map((d) => (
            <button key={d} className={`tile ${p.disorder === d ? 'tile--on' : ''}`} onClick={() => p.setDisorder(d)}>
              <span className="tile__icon">{DISORDERS[d].icon}</span>
              {DISORDERS[d].name}
            </button>
          ))}
        </div>
        <p className="note">{DISORDERS[p.disorder].text}</p>
      </section>

      <section className="card">
        <h2>🎥 Càmera</h2>
        <div className="seg">
          {(Object.keys(VIEW_NAMES) as ViewId[]).map((v) => (
            <button key={v} className={p.view === v ? 'on' : ''} onClick={() => p.setView(v)}>
              {VIEW_NAMES[v]}
            </button>
          ))}
        </div>
        <div className="toggles">
          <label className="check">
            <input type="checkbox" checked={p.showRays} onChange={(e) => p.setShowRays(e.target.checked)} /> Raigs de llum
          </label>
          <label className="check">
            <input type="checkbox" checked={p.showPulse} onChange={(e) => p.setShowPulse(e.target.checked)} /> Pols del nervi òptic
          </label>
        </div>
      </section>

      <footer className="legend">
        <span><i style={{ background: RAY_HEX.top }} />Raigs de la punta de la fletxa</span>
        <span><i style={{ background: RAY_HEX.bottom }} />Raigs de la base de la fletxa</span>
        <p className="hint">
          Tecles: <kbd>H</kbd> amagar panell · <kbd>P</kbd> presentació/estudi. Arrossega per girar, roda per fer zoom. Passa el ratolí per les parts de l'ull.
        </p>
      </footer>
    </aside>
  )
}
