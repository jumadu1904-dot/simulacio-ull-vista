import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { Callout, Part, useLabels } from './Part'
import { LENS_EQ_X, RETINA_IN, add, mul, type Bundle, type V2 } from '../optics'
import { toV3 } from '../geometry'

/** Colors HDR (> 1) perquè l'efecte bloom els faci brillar */
const hdr = (c: string, k: number) => new THREE.Color(c).multiplyScalar(k)
export const RAY_HEX = { top: '#ffc53d', bottom: '#38e6ff' } as const
const RAY_HDR = { top: hdr(RAY_HEX.top, 1.5), bottom: hdr(RAY_HEX.bottom, 1.5) }
const WHITE_HDR = hdr('#fff6dc', 3)

const noRaycast = () => null
type P3 = [number, number, number]

/** Fotons que viatgen per les trajectòries dels raigs */
function Photons({ paths, color, speed }: { paths: V2[][]; color: THREE.Color; speed: number }) {
  const PER = 3
  const max = 11 * PER
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const prepared = useMemo(
    () =>
      paths.map((pts) => {
        const cum = [0]
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
        return { pts, cum, len: cum[cum.length - 1] }
      }),
    [paths],
  )
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    let n = 0
    prepared.forEach((p, i) => {
      for (let j = 0; j < PER && n < max; j++, n++) {
        if (p.len <= 0) continue
        const s = (t * speed + (j / PER) * p.len + i * 0.137) % p.len
        let seg = 1
        while (seg < p.cum.length - 1 && p.cum[seg] < s) seg++
        const a = p.pts[seg - 1]
        const b = p.pts[seg]
        const f = (s - p.cum[seg - 1]) / Math.max(p.cum[seg] - p.cum[seg - 1], 1e-9)
        tmp.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 0.025)
        tmp.scale.setScalar(Math.max(Math.min(1, (p.len - s) / 0.12), 0.001))
        tmp.updateMatrix()
        mesh.setMatrixAt(n, tmp.matrix)
      }
    })
    for (; n < max; n++) {
      tmp.scale.setScalar(0)
      tmp.updateMatrix()
      mesh.setMatrixAt(n, tmp.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, max]} raycast={noRaycast} frustumCulled={false}>
      <sphereGeometry args={[0.028, 12, 12]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  )
}

/** Fletxa 3D lluminosa */
function GlowArrow({ from, to, radius, color }: { from: V2; to: V2; radius: number; color: THREE.Color }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-4) return null
  const head = Math.min(len * 0.38, radius * 5)
  const shaft = len - head
  const ang = Math.atan2(dy, dx) - Math.PI / 2
  const ux = dx / len
  const uy = dy / len
  return (
    <group raycast={noRaycast}>
      <mesh position={[from.x + ux * shaft * 0.5, from.y + uy * shaft * 0.5, 0.03]} rotation={[0, 0, ang]}>
        <cylinderGeometry args={[radius, radius, shaft, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[from.x + ux * (shaft + head * 0.5), from.y + uy * (shaft + head * 0.5), 0.03]} rotation={[0, 0, ang]}>
        <coneGeometry args={[radius * 2.6, head, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Flash({ p, color, size = 0.05 }: { p: V2; color: THREE.Color; size?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const phase = useMemo(() => Math.random() * 6, [])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(clock.elapsedTime * 5 + phase)))
  })
  return (
    <mesh ref={ref} position={toV3(p, 0.03)} raycast={noRaycast}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
    </mesh>
  )
}

interface Props {
  bundles: Bundle[]
  axial: number
  cataract: number
  intensity: number
  /** mostrar el punt de convergència (miopia / hipermetropia) */
  showFocus: boolean
}

export function LightRays({ bundles, axial, cataract, intensity, showFocus }: Props) {
  const { study } = useLabels()
  const bright = 0.45 + 0.55 * (intensity / 100)
  const [top, bottom] = bundles

  // Focus davant (miopia) o darrere (hipermetropia) de la retina?
  const focusInfo = bundles.map((b) => {
    if (!showFocus || !b.focus || !b.landing) return null
    const f = b.focus
    const behind = (f.x / axial) ** 2 + f.y ** 2 > RETINA_IN ** 2
    const gap = Math.hypot(f.x - b.landing.x, f.y - b.landing.y)
    return { f, behind, gap }
  })

  return (
    <group>
      {bundles.map((b, bi) => {
        const color = RAY_HDR[b.kind]
        const ext: P3[] = []
        const pass: P3[] = []
        const stop: P3[] = []
        const dashed: P3[] = []
        for (const r of b.rays) {
          ext.push(toV3(r.start), toV3(r.entry))
          const target = r.blocked ? stop : pass
          for (let i = 0; i < r.inner.length - 1; i++) target.push(toV3(r.inner[i]), toV3(r.inner[i + 1]))
          // Hipermetropia: prolongació (discontínua) fins al punt on convergirien
          const fi = focusInfo[bi]
          if (fi && fi.behind && fi.gap > 0.03 && r.hitRetina && r.afterLens) {
            const end = r.inner[r.inner.length - 1]
            const t = (fi.f.x - r.afterLens.p.x) / r.afterLens.d.x
            dashed.push(toV3(end), toV3(add(r.afterLens.p, mul(r.afterLens.d, t))))
          }
        }
        const paths = b.rays.map((r) => [r.start, ...r.inner])
        return (
          <group key={b.kind}>
            {/* halo ample + nucli brillant */}
            <Line segments points={ext} color={color} lineWidth={5} transparent opacity={0.06 * bright} toneMapped={false} raycast={noRaycast} />
            <Line segments points={ext} color={color} lineWidth={1.4} transparent opacity={0.85 * bright} toneMapped={false} raycast={noRaycast} />
            {pass.length > 0 && (
              <>
                <Line segments points={pass} color={color} lineWidth={5} transparent opacity={0.08 * bright} toneMapped={false} raycast={noRaycast} />
                <Line segments points={pass} color={color} lineWidth={1.5} transparent opacity={0.95 * bright} toneMapped={false} raycast={noRaycast} />
              </>
            )}
            {stop.length > 0 && (
              <Line segments points={stop} color={color} lineWidth={1.3} transparent opacity={0.45 * bright} toneMapped={false} raycast={noRaycast} />
            )}
            {dashed.length > 0 && (
              <Line segments points={dashed} color={color} lineWidth={1.3} dashed dashSize={0.035} gapSize={0.03} transparent opacity={0.7} toneMapped={false} raycast={noRaycast} />
            )}
            <Photons paths={paths} color={color} speed={1.3} />
            {b.rays.filter((r) => r.hitRetina).map((r, i) => (
              <Flash key={i} p={r.inner[r.inner.length - 1]} color={color} size={0.022} />
            ))}
          </group>
        )
      })}

      {/* Punts de convergència quan no coincideixen amb la retina */}
      {focusInfo.map(
        (fi, i) =>
          fi &&
          fi.gap > 0.04 && (
            <group key={i}>
              <Flash p={fi.f} color={WHITE_HDR} size={0.035} />
              {study && i === 0 && (
                <Callout
                  id="image"
                  anchor={toV3(fi.f, 0.03)}
                  label={[fi.f.x + (fi.behind ? 0.9 : -0.2), fi.f.y - 1.1, 0]}
                  active={false}
                  title={fi.behind ? 'Focus DARRERE la retina' : 'Focus DAVANT la retina'}
                />
              )}
            </group>
          ),
      )}

      {/* Cristal·lí opac: llum difosa */}
      {cataract > 0.02 && (
        <mesh position={[LENS_EQ_X, 0, 0.02]} scale={[0.45, 1, 0.2]} raycast={noRaycast}>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshBasicMaterial color={hdr('#fff4dc', 1.6)} transparent opacity={0.22 * cataract * bright} toneMapped={false} depthWrite={false} />
        </mesh>
      )}

      {/* Objecte: fletxa lluminosa cap amunt ↑ */}
      <Part id="object" anchor={toV3(top.objectPoint, 0.03)} label={[top.objectPoint.x, top.objectPoint.y + 0.75, 0]}>
        {() => (
          <group>
            <GlowArrow from={bottom.objectPoint} to={top.objectPoint} radius={0.035} color={WHITE_HDR} />
            <Flash p={top.objectPoint} color={RAY_HDR.top} size={0.06} />
            <Flash p={bottom.objectPoint} color={RAY_HDR.bottom} size={0.06} />
            {/* zona clicable */}
            <mesh position={[top.objectPoint.x, 0, 0]}>
              <planeGeometry args={[0.4, Math.abs(top.objectPoint.y - bottom.objectPoint.y) + 0.3]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        )}
      </Part>

      {/* Imatge projectada: invertida ↓ i més petita */}
      {top.landing && bottom.landing && (
        <Part
          id="image"
          anchor={[(top.landing.x + bottom.landing.x) / 2 - 0.05, 0.05, 0.03]}
          label={[(top.landing.x + bottom.landing.x) / 2 + 1.0, -0.12, 0]}
        >
          {() => (
            <GlowArrow
              from={{ x: bottom.landing!.x - 0.05, y: bottom.landing!.y }}
              to={{ x: top.landing!.x - 0.05, y: top.landing!.y }}
              radius={0.012}
              color={hdr('#ffffff', cataract > 0.3 ? 1.2 : 2.6)}
            />
          )}
        </Part>
      )}
    </group>
  )
}
