import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { EyeModel } from './EyeModel'
import { LightRays } from './LightRays'
import { NervePulse } from './NervePulse'
import { computeBundles, retinaPoint, type EyeParams, type V2 } from '../optics'

interface OrbitControlsImpl extends THREE.EventDispatcher<{ start: object }> {
  target: THREE.Vector3
  update: () => void
}

export type ViewId = 'lateral' | 'oblique' | 'retina'

interface Props {
  target: EyeParams
  distance: number
  intensity: number
  view: ViewId
  viewNonce: number
  showRays: boolean
  showPulse: boolean
  photoMode: boolean
  showFocus: boolean
}

/** Transició suau d'un valor (el reflex pupil·lar i l'acomodació no són instantanis) */
function useSmoothed(target: number, rate: number) {
  const [value, setValue] = useState(target)
  const ref = useRef(target)
  useFrame((_, dt) => {
    const cur = ref.current
    if (cur === target) return
    let next = cur + (target - cur) * (1 - Math.exp(-dt * rate))
    if (Math.abs(target - next) < 0.0006) next = target
    ref.current = next
    setValue(next)
  })
  return value
}

const VIEWS: Record<ViewId, { pos: [number, number, number]; target: [number, number, number] }> = {
  lateral: { pos: [-0.75, 0.25, 7.4], target: [-0.75, 0, 0] },
  oblique: { pos: [-4.4, 2.1, 5.2], target: [-0.45, -0.1, 0] },
  retina: { pos: [1.45, 0.3, 2.7], target: [1.75, 0, 0] },
}

/** Moviments de càmera suaus entre vistes predefinides (ideal per gravar) */
function CameraRig({ view, nonce }: { view: ViewId; nonce: number }) {
  const { camera, size } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const anim = useRef(true)
  const goal = useMemo(() => {
    const v = VIEWS[view]
    const t = new THREE.Vector3(...v.target)
    const p = new THREE.Vector3(...v.pos)
    const aspect = size.width / Math.max(size.height, 1)
    const m = Math.max(1, 1.55 / aspect)
    return { t, p: t.clone().add(p.sub(t).multiplyScalar(m)) }
  }, [view, size.width, size.height])

  useEffect(() => {
    anim.current = true
  }, [goal, nonce])

  useEffect(() => {
    if (!controls) return
    const stop = () => (anim.current = false)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, dt) => {
    if (!anim.current || !controls) return
    const k = 1 - Math.exp(-dt * 3)
    camera.position.lerp(goal.p, k)
    controls.target.lerp(goal.t, k)
    controls.update()
    if (camera.position.distanceTo(goal.p) < 0.005 && controls.target.distanceTo(goal.t) < 0.005) anim.current = false
  })
  return null
}

function Magnifier({ at }: { at: V2 }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + 0.08 * Math.sin(clock.elapsedTime * 3))
  })
  return (
    <mesh ref={ref} position={[at.x - 0.02, at.y, 0.06]} raycast={() => null}>
      <torusGeometry args={[0.2, 0.008, 12, 64]} />
      <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(3)} toneMapped={false} />
    </mesh>
  )
}

export function Scene({ target, distance, intensity, view, viewNonce, showRays, showPulse, photoMode, showFocus }: Props) {
  const k = useSmoothed(target.k, 3.2)
  const pupilR = useSmoothed(target.pupilR, 2.4)
  const axial = useSmoothed(target.axial, 2.2)
  const cataract = useSmoothed(target.cataract, 2.0)
  const P = useMemo<EyeParams>(() => ({ k, pupilR, axial, cataract }), [k, pupilR, axial, cataract])

  const bundles = useMemo(() => computeBundles(P, distance), [P, distance])
  const landings = useMemo(() => bundles.map((b) => b.landing).filter((l): l is V2 => !!l), [bundles])
  const light = intensity / 100

  return (
    <>
      <color attach="background" args={['#060a14']} />
      <CameraRig view={view} nonce={viewNonce} />

      <ambientLight intensity={0.25 + 0.35 * light} />
      <directionalLight position={[-4, 5, 6]} intensity={1.4 + 1.6 * light} color="#fff4e6" />
      <directionalLight position={[5, -2, 4]} intensity={0.6} color="#8fb8ff" />

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} color="#bcd4ff" />
        <Lightformer form="ring" intensity={1.5} position={[5, 2, 3]} scale={2} color="#ffe2c4" />
        <Lightformer form="rect" intensity={0.6} position={[0, -4, 2]} rotation-x={Math.PI / 2} scale={[10, 4, 1]} color="#ff9a7a" />
      </Environment>

      {/* La primera etiqueta <Html> que es munta de vegades es perd: aquesta buida la substitueix */}
      <Html><span /></Html>
      <EyeModel P={P} retinaGlow={showRays && landings.length ? 0.12 : 0} />
      {showRays && <LightRays bundles={bundles} axial={axial} cataract={cataract} intensity={intensity} showFocus={showFocus} />}
      <NervePulse landings={landings} axial={axial} active={showRays && showPulse && landings.length > 0} />
      {photoMode && <Magnifier at={retinaPoint(0, axial)} />}

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={18} />

      <EffectComposer multisampling={4}>
        <Bloom intensity={1.15} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur radius={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.65} />
      </EffectComposer>
    </>
  )
}
