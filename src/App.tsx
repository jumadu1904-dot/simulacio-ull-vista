import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Scene, type ViewId } from './components/Scene'
import { ControlPanel, DISORDERS, type Disorder } from './components/ControlPanel'
import { PhotoreceptorView } from './components/PhotoreceptorView'
import { LabelContext } from './components/Part'
import { focusX, lensPower, RETINA_IN, solveAccommodation, type EyeParams } from './optics'
import type { PartId } from './parts'

/** Escala logarítmica del lliscador: 10 cm → 600 cm */
const sliderToCm = (s: number) => 10 * Math.pow(60, s / 1000)
const formatDistance = (cm: number) =>
  cm < 100 ? `${Math.round(cm)} cm` : cm >= 590 ? '6 m (lluny)' : `${(cm / 100).toFixed(1)} m`

/** Intensitat 0–100 % → radi de la pupil·la (cm): 7,6 mm (fosc) a 2 mm (molta llum) */
const pupilFromLight = (i: number) => 0.38 - (0.38 - 0.1) * Math.pow(i / 100, 0.8)

const AXIAL: Record<Disorder, number> = { normal: 1, myopia: 1.28, hyperopia: 0.8, cataract: 1 }

export default function App() {
  const [study, setStudy] = useState(true)
  const [intensity, setIntensity] = useState(55)
  const [sliderPos, setSliderPos] = useState(850)
  const [disorder, setDisorder] = useState<Disorder>('normal')
  const [photoMode, setPhotoMode] = useState(false)
  const [view, setViewState] = useState<ViewId>('lateral')
  const [viewNonce, setViewNonce] = useState(0)
  const [showRays, setShowRays] = useState(true)
  const [showPulse, setShowPulse] = useState(true)
  const [panelHidden, setPanelHidden] = useState(false)
  const [hovered, setHovered] = useState<PartId | null>(null)
  const [selected, setSelected] = useState<PartId | null>(null)

  const setView = (v: ViewId) => {
    setViewState(v)
    setViewNonce((n) => n + 1)
  }
  const togglePhoto = (on: boolean) => {
    setPhotoMode(on)
    setView(on ? 'retina' : 'lateral')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'h' || e.key === 'H') setPanelHidden((v) => !v)
      if (e.key === 'p' || e.key === 'P') setStudy((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const distance = sliderToCm(sliderPos)
  const axial = AXIAL[disorder]
  const target = useMemo<EyeParams>(() => {
    // Hipermetropia: es mostra l'ull amb el cristal·lí relaxat perquè es vegi el focus darrere la retina
    const k = disorder === 'hyperopia' ? 0 : solveAccommodation(distance, axial).k
    return { k, pupilR: pupilFromLight(intensity), axial, cataract: disorder === 'cataract' ? 1 : 0 }
  }, [distance, axial, disorder, intensity])

  const stats = useMemo(() => {
    const err = (focusX(target.k, distance) - RETINA_IN * axial) * 10
    let focusText: string
    let inFocus = Math.abs(err) < 0.06
    if (disorder === 'cataract') {
      inFocus = false
      focusText = 'Cristal·lí opac: la llum es bloqueja i es difon'
    } else if (inFocus) focusText = 'Imatge nítida sobre la retina'
    else if (err > 0) focusText = `Focus ${err.toFixed(1)} mm DARRERE la retina: borrosa`
    else focusText = `Focus ${(-err).toFixed(1)} mm DAVANT la retina: borrosa`
    return { pupilMm: target.pupilR * 20, accommodation: target.k, lensPower: lensPower(target.k), focusText, inFocus }
  }, [target, distance, axial, disorder])

  // Amb la vista de fotoreceptors oberta s'amaguen les etiquetes de l'ull (taparien la targeta)
  const labels = useMemo(
    () => ({ hovered, selected, study: study && !photoMode, setHovered, setSelected }),
    [hovered, selected, study, photoMode],
  )
  const day = intensity >= 35

  return (
    <div className={`app ${panelHidden ? 'app--full' : ''}`}>
      <main className="viewport">
        <Canvas
          camera={{ position: [-0.75, 0.25, 7.4], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: false, toneMapping: THREE.NoToneMapping }}
          onPointerMissed={() => setSelected(() => null)}
        >
          <LabelContext.Provider value={labels}>
            <Scene
              target={target}
              distance={distance}
              intensity={intensity}
              view={view}
              viewNonce={viewNonce}
              showRays={showRays}
              showPulse={showPulse}
              photoMode={photoMode}
              showFocus={disorder === 'myopia' || disorder === 'hyperopia'}
            />
          </LabelContext.Provider>
        </Canvas>

        {study && (
          <div className="caption">
            <b>{photoMode ? 'Fotoreceptors: cons i bastons' : DISORDERS[disorder].name}</b>
            <span>
              {photoMode
                ? 'Els cons funcionen amb molta llum i veuen colors; els bastons, amb poca llum i en grisos.'
                : DISORDERS[disorder].text}
            </span>
          </div>
        )}

        {photoMode && (
          <PhotoreceptorView
            day={day}
            setDay={(d) => setIntensity(d ? 85 : 12)}
            study={study}
            onClose={() => togglePhoto(false)}
          />
        )}

        {panelHidden && (
          <button className="reveal" onClick={() => setPanelHidden(false)} title="Mostrar panell (H)">
            ⟨⟨
          </button>
        )}
      </main>

      {!panelHidden && (
        <ControlPanel
          study={study}
          setStudy={setStudy}
          intensity={intensity}
          setIntensity={setIntensity}
          sliderPos={sliderPos}
          setSliderPos={setSliderPos}
          distanceLabel={formatDistance(distance)}
          disorder={disorder}
          setDisorder={setDisorder}
          photoMode={photoMode}
          setPhotoMode={togglePhoto}
          view={view}
          setView={setView}
          showRays={showRays}
          setShowRays={setShowRays}
          showPulse={showPulse}
          setShowPulse={setShowPulse}
          onHide={() => setPanelHidden(true)}
          stats={stats}
        />
      )}
    </div>
  )
}
