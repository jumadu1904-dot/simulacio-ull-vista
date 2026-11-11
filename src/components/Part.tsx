import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { PARTS, type PartId } from '../parts'

interface LabelState {
  hovered: PartId | null
  selected: PartId | null
  /** true = mode estudi (etiquetes visibles) · false = mode presentació (sense text) */
  study: boolean
  setHovered: (fn: (h: PartId | null) => PartId | null) => void
  setSelected: (fn: (s: PartId | null) => PartId | null) => void
}

export const LabelContext = createContext<LabelState | null>(null)

export const useLabels = () => {
  const ctx = useContext(LabelContext)
  if (!ctx) throw new Error('LabelContext missing')
  return ctx
}

type P3 = [number, number, number]

/** Etiqueta amb línia guia: punt sobre la peça → text fora de l'ull */
export function Callout({
  id,
  anchor,
  label,
  active,
  title,
  hidden = false,
}: {
  id: PartId
  anchor: P3
  label: P3
  active: boolean
  title?: string
  hidden?: boolean
}) {
  // Es manté muntada i s'amaga amb CSS: desmuntar <Html> sovint provoca avisos de React
  return (
    <group raycast={() => null} visible={!hidden}>
      <Line
        points={[anchor, label]}
        color={active ? '#ffd76a' : '#d8e4ff'}
        lineWidth={1}
        transparent
        opacity={active ? 0.95 : 0.55}
        raycast={() => null}
      />
      <mesh position={anchor} raycast={() => null}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color={active ? '#ffd76a' : '#ffffff'} toneMapped={false} />
      </mesh>
      <Html position={label} center zIndexRange={[active ? 100 : 10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`label ${active ? 'label--active' : ''}`} style={{ display: hidden ? 'none' : undefined }}>
          <strong>{title ?? PARTS[id].name}</strong>
          {active && !title && <span>{PARTS[id].desc}</span>}
        </div>
      </Html>
    </group>
  )
}

interface PartProps {
  id: PartId
  anchor: P3
  label: P3
  children: (active: boolean) => ReactNode
}

/** Peça anatòmica: ressaltat en passar-hi el ratolí i etiqueta (només en mode estudi) */
export function Part({ id, anchor, label, children }: PartProps) {
  const { hovered, selected, study, setHovered, setSelected } = useLabels()
  const active = hovered === id || selected === id

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(() => id)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHovered((h) => (h === id ? null : h))
    document.body.style.cursor = 'auto'
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelected((s) => (s === id ? null : id))
  }

  return (
    <group onPointerOver={over} onPointerOut={out} onClick={click}>
      {children(active)}
      <Callout id={id} anchor={anchor} label={label} active={active} hidden={!study} />
    </group>
  )
}

export interface MatProps {
  color?: string
  active?: boolean
  /** brillantor pulsant (ex.: retina quan rep llum) */
  pulse?: number
  glow?: string
  opacity?: number
  roughness?: number
  map?: THREE.Texture | null
  transmission?: number
  thickness?: number
  ior?: number
  clearcoat?: number
  sheen?: number
  attenuationColor?: string
  side?: THREE.Side
}

/** Material PBR (MeshPhysicalMaterial) amb ressaltat animat */
export function Mat({
  color = '#ffffff',
  active = false,
  pulse = 0,
  glow,
  opacity = 1,
  roughness = 0.55,
  map = null,
  transmission = 0,
  thickness = 0,
  ior = 1.5,
  clearcoat = 0,
  sheen = 0,
  attenuationColor = '#ffffff',
  side = THREE.DoubleSide,
}: MatProps) {
  const ref = useRef<THREE.MeshPhysicalMaterial>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    let target = active ? 0.35 : 0
    if (pulse > 0) target = Math.max(target, pulse * (0.35 + 0.25 * Math.sin(clock.elapsedTime * 6)))
    m.emissiveIntensity += (target - m.emissiveIntensity) * 0.15
  })
  const transparent = opacity < 1
  return (
    <meshPhysicalMaterial
      ref={ref}
      color={color}
      map={map}
      emissive={glow ?? color}
      emissiveIntensity={0}
      roughness={roughness}
      metalness={0}
      transmission={transmission}
      thickness={thickness}
      ior={ior}
      clearcoat={clearcoat}
      clearcoatRoughness={0.15}
      sheen={sheen}
      sheenColor="#ffffff"
      attenuationColor={attenuationColor}
      attenuationDistance={2}
      side={side}
      transparent={transparent}
      opacity={opacity}
      depthWrite={!transparent}
    />
  )
}
