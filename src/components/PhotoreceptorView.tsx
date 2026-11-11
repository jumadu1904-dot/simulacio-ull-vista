import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

type Kind = 'L' | 'M' | 'S' | 'rod'

const CONE_COLORS: Record<Exclude<Kind, 'rod'>, string> = { L: '#ff3b3b', M: '#3bff6a', S: '#3b7bff' }
const ROD_COLOR = '#b58ad8'

interface Cell {
  kind: Kind
  x: number
  z: number
}

/** Mosaic de fotoreceptors: a la fòvea (centre) només cons; a la perifèria predominen els bastons */
function useMosaic(): Cell[] {
  return useMemo(() => {
    let seed = 9
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const cells: Cell[] = []
    const coneKind = (): Kind => {
      const r = rand()
      return r < 0.6 ? 'L' : r < 0.9 ? 'M' : 'S'
    }
    for (const z of [-0.35, 0, 0.35]) {
      let x = -3.4 + (z === 0 ? 0.08 : 0)
      while (x < 3.4) {
        const fovea = Math.abs(x) < 0.85
        const kind: Kind = fovea ? coneKind() : rand() < 0.2 ? coneKind() : 'rod'
        cells.push({ kind, x, z })
        x += fovea ? 0.2 : kind === 'rod' ? 0.15 : 0.22
      }
    }
    return cells
  }, [])
}

function Cells({ day }: { day: boolean }) {
  const cells = useMosaic()
  // Un material compartit per tipus: tots els cons/bastons del mateix tipus s'activen junts
  const mats = useMemo(() => {
    const mk = (c: string) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.2, roughness: 0.35 })
    return { L: mk(CONE_COLORS.L), M: mk(CONE_COLORS.M), S: mk(CONE_COLORS.S), rod: mk(ROD_COLOR) } as Record<Kind, THREE.MeshStandardMaterial>
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ;(['L', 'M', 'S', 'rod'] as Kind[]).forEach((k, i) => {
      const m = mats[k]
      const on = k === 'rod' ? !day : day
      const target = on ? 1.4 + 0.9 * Math.sin(t * 4 + i * 1.7) : 0.05
      m.emissiveIntensity += (target - m.emissiveIntensity) * 0.08
      if (k === 'rod') m.emissive.set(day ? ROD_COLOR : '#e8e8ff')
    })
  })

  return (
    <group>
      {cells.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {/* segment intern + nucli */}
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={c.kind === 'rod' ? [0.04, 0.045, 0.55, 10] : [0.07, 0.085, 0.5, 12]} />
            <meshStandardMaterial color="#e9d7c4" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[c.kind === 'rod' ? 0.05 : 0.07, 12, 12]} />
            <meshStandardMaterial color="#c7a2d6" roughness={0.5} />
          </mesh>
          {/* segment extern (on hi ha els pigments) */}
          {c.kind === 'rod' ? (
            <mesh position={[0, -0.62, 0]} material={mats.rod}>
              <cylinderGeometry args={[0.042, 0.042, 0.7, 10]} />
            </mesh>
          ) : (
            <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]} material={mats[c.kind]}>
              <coneGeometry args={[0.08, 0.5, 14]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** Fotons que baixen des del vitri cap als fotoreceptors */
function Photons({ day }: { day: boolean }) {
  const N = 60
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ x: ((i * 0.6180339) % 1) * 6.4 - 3.2, z: ((i * 0.37) % 1) * 0.8 - 0.4, o: (i * 0.731) % 1 })), [])
  const colors = useMemo(() => {
    const pal = ['#ff5a5a', '#5aff7f', '#5a8cff', '#ffffff', '#ffe25a']
    return seeds.map((_, i) => new THREE.Color(pal[i % pal.length]).multiplyScalar(2.5))
  }, [seeds])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    seeds.forEach((s, i) => {
      const visible = day || i % 5 === 0
      const f = (t * 0.45 + s.o) % 1
      tmp.position.set(s.x, 2.6 - f * 3.0, s.z)
      tmp.scale.setScalar(visible ? Math.min(1, (1 - f) * 4) : 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      m.setColorAt(i, day ? colors[i] : new THREE.Color('#c9d6ff').multiplyScalar(1.6))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[0.04, 10, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function Tag({ position, children }: { position: [number, number, number]; children: React.ReactNode }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div className="pr-tag">{children}</div>
    </Html>
  )
}

interface Props {
  day: boolean
  setDay: (d: boolean) => void
  study: boolean
  onClose: () => void
}

export function PhotoreceptorView({ day, setDay, study, onClose }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head">
        <div>
          <b>Fotoreceptors de la retina</b>
          <small>Zoom a la fòvea i la seva perifèria</small>
        </div>
        <div className="pr-toggle">
          <button className={day ? 'on' : ''} onClick={() => setDay(true)}>☀ Dia · cons</button>
          <button className={!day ? 'on' : ''} onClick={() => setDay(false)}>☾ Nit · bastons</button>
        </div>
        <button className="pr-close" onClick={onClose} aria-label="Tancar">×</button>
      </div>
      <div className="pr-canvas">
        <Canvas camera={{ position: [0, 0.5, 8.2], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={['#05070d']} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[2, 4, 5]} intensity={1.6} />
          <pointLight position={[0, 2.5, 1]} intensity={day ? 6 : 1.5} color={day ? '#fff4d6' : '#9fb4ff'} />
          <group position={[0, -0.1, 0]}>
            {/* epiteli pigmentari */}
            <mesh position={[0, -1.15, 0]}>
              <boxGeometry args={[7.2, 0.25, 1.2]} />
              <meshStandardMaterial color="#2a120c" roughness={0.8} />
            </mesh>
            {/* capa de neurones (bipolars i ganglionars) */}
            <mesh position={[0, 0.85, 0]}>
              <boxGeometry args={[7.2, 0.18, 1.2]} />
              <meshStandardMaterial color="#ffd9b0" transparent opacity={0.25} roughness={0.3} />
            </mesh>
            <Cells day={day} />
            <Photons day={day} />
            {study && (
              <>
                <Tag position={[0, 2.25, 0]}>Llum ↓</Tag>
                <Tag position={[0, -1.65, 0]}>Fòvea: només cons</Tag>
                <Tag position={[-2.5, -1.65, 0]}>Perifèria: sobretot bastons</Tag>
                <Tag position={[2.6, 1.15, 0]}>Neurones → nervi òptic</Tag>
              </>
            )}
          </group>
          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} minPolarAngle={1.0} maxPolarAngle={1.75} minDistance={3} maxDistance={9} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.9} luminanceThreshold={0.85} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        </Canvas>
      </div>
      <div className="pr-legend">
        <span><i style={{ background: CONE_COLORS.L }} />Cons L (vermell)</span>
        <span><i style={{ background: CONE_COLORS.M }} />Cons M (verd)</span>
        <span><i style={{ background: CONE_COLORS.S }} />Cons S (blau)</span>
        <span><i style={{ background: ROD_COLOR }} />Bastons</span>
        <p>
          {day
            ? 'Amb molta llum treballen els CONS: visió diürna, nítida i en color (concentrats a la fòvea).'
            : 'Amb poca llum treballen els BASTONS: visió nocturna en escala de grisos (sobretot a la perifèria).'}
        </p>
      </div>
    </div>
  )
}
