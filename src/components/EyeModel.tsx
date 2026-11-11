import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { Mat, Part, type MatProps } from './Part'
import { applyFundusUV, arc, cutCap, halfLathe, scaleAxial, shellProfile, type PP } from '../geometry'
import {
  CHOROID_IN,
  CORNEA,
  CORNEA_C1,
  CORNEA_C2,
  DISC_ANGLE,
  EYE_R,
  IRIS_X,
  LENS_EQ_X,
  RETINA_IN,
  SCLERA_IN,
  lensShape,
  lerp,
  retinaPoint,
  wallNormal,
  type EyeParams,
} from '../optics'
import { fiberTexture, irisTexture, retinaTexture, scleraTexture, tissueTexture } from '../textures'

const deg = Math.PI / 180

let TEX: ReturnType<typeof makeTextures> | null = null
function makeTextures() {
  return {
    sclera: scleraTexture(),
    scleraCut: tissueTexture('#f4e6de', '#e2c9c0', 31, 5, 0.8),
    choroidCut: tissueTexture('#3c0d14', '#7a1f27', 41, 8, 1.4),
    retina: retinaTexture(),
    retinaCut: tissueTexture('#ff7a3d', '#d8401d', 51, 10, 1.1),
    iris: irisTexture(),
    irisCut: tissueTexture('#2e6f78', '#4fa0a3', 61, 12, 1.2),
    ciliary: fiberTexture('#a8343f', '#e07a7f', 71, 90),
    nerve: fiberTexture('#ecd39b', '#fff4d6', 81, 160),
    sheath: tissueTexture('#efe7dc', '#d9cbbb', 91, 6, 0.8),
  }
}
export const useTextures = () => (TEX ??= makeTextures())

/** Superfície de revolució + cara de tall d'un perfil, amb alliberament de memòria */
function useSection(profile: PP[], fundus = false) {
  const geo = useMemo(() => {
    const lathe = halfLathe(profile)
    if (fundus) applyFundusUV(lathe)
    return { lathe, cap: cutCap(profile) }
  }, [profile, fundus])
  useEffect(
    () => () => {
      geo.lathe.dispose()
      geo.cap.dispose()
    },
    [geo],
  )
  return geo
}

interface SectionProps {
  profile: PP[]
  fundus?: boolean
  surface: MatProps
  cut: MatProps
  z?: number
  renderOrder?: number
}

function Section({ profile, fundus, surface, cut, z = 0, renderOrder = 0 }: SectionProps) {
  const { lathe, cap } = useSection(profile, fundus)
  return (
    <>
      <mesh geometry={lathe} renderOrder={renderOrder}>
        <Mat {...surface} />
      </mesh>
      <mesh geometry={cap} position={[0, 0, z]} renderOrder={renderOrder + 1}>
        <Mat {...cut} />
      </mesh>
    </>
  )
}

// ---------- Perfils fixos (part anterior, no afectada per miopia/hipermetropia) ----------
const CORNEA_PROFILE: PP[] = [
  ...arc(CORNEA_C1, CORNEA.r1, Math.PI, Math.PI - Math.asin(CORNEA.edge / CORNEA.r1)),
  ...arc(CORNEA_C2, CORNEA.r2, Math.PI - Math.asin(0.575 / CORNEA.r2), Math.PI),
]
/** retina amb la depressió de la fòvea (més prima al centre) */
const retinaInner = (t: number) => RETINA_IN + 0.022 * Math.exp(-((t / 0.075) ** 2))

const NERVE_LEN = 1.5
const NERVE_R = 0.15

interface Props {
  P: EyeParams
  retinaGlow: number
}

export function EyeModel({ P, retinaGlow }: Props) {
  const tex = useTextures()
  const s = P.axial
  const L = useMemo(() => lensShape(P.k), [P.k])

  // ---------- Paret de l'ull (s'allarga o s'escurça amb els trastorns) ----------
  const sclera = useMemo(() => scaleAxial(shellProfile(SCLERA_IN, EYE_R, 150 * deg), s), [s])
  const choroid = useMemo(() => scaleAxial(shellProfile(CHOROID_IN, SCLERA_IN, 138 * deg), s), [s])
  const retina = useMemo(() => scaleAxial(shellProfile(retinaInner, CHOROID_IN, 125 * deg, 96), s), [s])

  // ---------- Cristal·lí, humors, iris i múscul ciliar ----------
  const lensBack = useMemo(() => arc(L.xBack - L.R2, L.R2, Math.asin(L.a / L.R2), 0), [L])
  const lensProfile = useMemo<PP[]>(
    () => [...arc(L.xFront + L.R1, L.R1, Math.PI, Math.PI - Math.asin(L.a / L.R1)), ...lensBack],
    [L, lensBack],
  )
  const vitreous = useMemo(
    () => scaleAxial([...arc(0, RETINA_IN, 0, Math.acos(LENS_EQ_X / RETINA_IN)), ...lensBack], s),
    [lensBack, s],
  )
  const aqueous = useMemo<PP[]>(() => {
    const cF = L.xFront + L.R1
    const rp = Math.min(P.pupilR, L.a * 0.98)
    return [
      ...arc(CORNEA_C2, CORNEA.r2, Math.PI, Math.PI - Math.asin(0.575 / CORNEA.r2), 32),
      { x: IRIS_X - 0.022, r: 0.57 },
      { x: IRIS_X - 0.01, r: P.pupilR },
      { x: IRIS_X + 0.01, r: P.pupilR },
      ...arc(cF, L.R1, Math.PI - Math.asin(rp / L.R1), Math.PI, 24),
    ]
  }, [L, P.pupilR])
  const iris = useMemo<PP[]>(
    () => [
      { x: IRIS_X - 0.008, r: P.pupilR },
      { x: IRIS_X - 0.024, r: 0.32 },
      { x: IRIS_X - 0.022, r: 0.575 },
      { x: IRIS_X + 0.024, r: 0.575 },
      { x: IRIS_X + 0.012, r: 0.3 },
      { x: IRIS_X + 0.01, r: P.pupilR },
      { x: IRIS_X - 0.008, r: P.pupilR },
    ],
    [P.pupilR],
  )
  // El múscul ciliar es contrau (més gruixut i cap a dins) quan el cristal·lí acomoda
  const ciliary = useMemo<PP[]>(() => {
    const rr = lerp(0.05, 0.075, P.k)
    const cr = lerp(0.825, 0.8, P.k)
    return Array.from({ length: 49 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2
      return { x: -0.75 + 0.13 * Math.cos(t), r: cr + rr * Math.sin(t) }
    })
  }, [P.k])
  const zonules = useMemo(() => {
    const inner = lerp(0.775, 0.725, P.k)
    const sagAmt = lerp(0, 0.025, P.k) // fibres afluixades quan el múscul es contrau
    const out: [number, number, number][][] = []
    for (const sg of [1, -1])
      for (const tx of [-0.84, -0.79, -0.74, -0.69, -0.64]) {
        const a: [number, number, number] = [LENS_EQ_X, sg * L.a, 0.006]
        const b: [number, number, number] = [tx, sg * inner, 0.006]
        const m: [number, number, number] = [(a[0] + b[0]) / 2 + sagAmt, (a[1] + b[1]) / 2, 0.006]
        out.push([a, m, b])
      }
    return out
  }, [L, P.k])

  const irisRing = useMemo(() => {
    const g = new THREE.RingGeometry(P.pupilR, 0.575, 96, 1, Math.PI / 2, Math.PI)
    g.rotateY(-Math.PI / 2)
    return g
  }, [P.pupilR])
  useEffect(() => () => irisRing.dispose(), [irisRing])

  // ---------- Nervi òptic i punt cec ----------
  const disc = retinaPoint(DISC_ANGLE, s)
  const nrm = wallNormal(DISC_ANGLE, s)
  const nerveRot = Math.atan2(nrm.y, nrm.x) - Math.PI / 2
  const nervePos: [number, number, number] = [disc.x + nrm.x * (NERVE_LEN / 2 - 0.02), disc.y + nrm.y * (NERVE_LEN / 2 - 0.02), 0]
  const fovea = retinaPoint(0, s)

  const c = P.cataract
  const lensMat: MatProps = {
    color: c > 0.02 ? new THREE.Color('#fff7e2').lerp(new THREE.Color('#ddd6c4'), c).getStyle() : '#fff7e2',
    transmission: 1 - 0.95 * c,
    roughness: 0.04 + 0.6 * c,
    thickness: 0.35,
    ior: 1.42,
    clearcoat: 1,
    attenuationColor: '#ffe7b0',
    opacity: c > 0.02 ? 0.55 + 0.4 * c : 1,
  }

  return (
    <group>
      <Part id="sclera" anchor={[-0.25, 1.17, 0.02]} label={[-0.2, 1.72, 0]}>
        {(a) => (
          <Section
            profile={sclera}
            surface={{ color: '#ffffff', map: tex.sclera, roughness: 0.42, clearcoat: 0.6, sheen: 0.4, active: a }}
            cut={{ color: '#ffffff', map: tex.scleraCut, roughness: 0.75, active: a }}
          />
        )}
      </Part>

      <Part id="choroid" anchor={[0.42 * s, 1.07, 0.02]} label={[0.95 * s, 1.62, 0]}>
        {(a) => (
          <Section
            profile={choroid}
            surface={{ color: '#5a1a20', roughness: 0.6, active: a }}
            cut={{ color: '#ffffff', map: tex.choroidCut, roughness: 0.55, active: a }}
            z={0.0006}
          />
        )}
      </Part>

      <Part id="retina" anchor={[0.76 * s, 0.76, 0.02]} label={[1.75 * s, 1.3, 0]}>
        {(a) => (
          <Section
            profile={retina}
            fundus
            surface={{ color: '#ffffff', map: tex.retina, roughness: 0.62, active: a, pulse: retinaGlow, glow: '#ff9a52' }}
            cut={{ color: '#ffffff', map: tex.retinaCut, roughness: 0.5, active: a, pulse: retinaGlow, glow: '#ff9a52' }}
            z={0.0012}
          />
        )}
      </Part>

      <Part id="fovea" anchor={[fovea.x - 0.01, 0, 0.02]} label={[fovea.x + 0.95, 0.5, 0]}>
        {(a) => (
          <mesh position={[fovea.x + 0.008, 0, 0.004]} scale={[0.35, 1, 1]}>
            <sphereGeometry args={[0.045, 24, 24]} />
            <Mat color="#ffd84a" glow="#ffd84a" active={a} pulse={0.6} roughness={0.3} />
          </mesh>
        )}
      </Part>

      <Part id="blindspot" anchor={[disc.x, disc.y, 0.02]} label={[disc.x + 1.0, disc.y - 0.55, 0]}>
        {(a) => (
          <mesh position={[disc.x - nrm.x * 0.01, disc.y - nrm.y * 0.01, 0.005]} rotation={[0, 0, nerveRot]} scale={[1, 0.3, 1]}>
            <sphereGeometry args={[0.13, 24, 16]} />
            <Mat color="#fff0c8" glow="#fff0c8" active={a} roughness={0.4} />
          </mesh>
        )}
      </Part>

      <Part id="nerve" anchor={[nervePos[0] + nrm.x * 0.3, nervePos[1] + nrm.y * 0.3, 0.02]} label={[nervePos[0] + 1.1, nervePos[1] - 0.95, 0]}>
        {(a) => (
          <group position={nervePos} rotation={[0, 0, nerveRot]}>
            {/* beina (duramàter) */}
            <mesh>
              <cylinderGeometry args={[NERVE_R, NERVE_R * 0.92, NERVE_LEN, 48, 1, true, Math.PI / 2, Math.PI]} />
              <Mat color="#ffffff" map={tex.sheath} roughness={0.5} clearcoat={0.3} active={a} />
            </mesh>
            {/* fibres nervioses al tall */}
            <mesh position={[0, 0, 0.003]}>
              <planeGeometry args={[NERVE_R * 1.7, NERVE_LEN]} />
              <Mat color="#ffffff" map={tex.nerve} roughness={0.55} active={a} glow="#fff2b0" />
            </mesh>
            <mesh position={[0, 0, 0.002]}>
              <planeGeometry args={[NERVE_R * 2, NERVE_LEN]} />
              <Mat color="#e9ddcc" roughness={0.6} active={a} />
            </mesh>
          </group>
        )}
      </Part>

      <Part id="cornea" anchor={[-1.29, 0.32, 0.02]} label={[-2.2, 1.45, 0]}>
        {(a) => (
          <Section
            profile={CORNEA_PROFILE}
            surface={{ color: '#f2fbff', transmission: 1, roughness: 0.02, thickness: 0.08, ior: 1.376, clearcoat: 1, active: a, glow: '#bfe9ff' }}
            cut={{ color: '#d9f3ff', transmission: 0.85, roughness: 0.08, thickness: 0.05, ior: 1.376, active: a, glow: '#bfe9ff' }}
            renderOrder={6}
          />
        )}
      </Part>

      <Part id="aqueous" anchor={[-1.12, 0.2, 0.02]} label={[-2.6, 1.05, 0]}>
        {(a) => (
          <Section
            profile={aqueous}
            surface={{ color: '#9ad8ff', opacity: 0.07, roughness: 0.1, active: a }}
            cut={{ color: '#8fd3ff', opacity: a ? 0.28 : 0.12, roughness: 0.1, active: a }}
            renderOrder={3}
          />
        )}
      </Part>

      <Part id="iris" anchor={[-0.99, 0.45, 0.02]} label={[-1.3, 1.72, 0]}>
        {(a) => (
          <>
            <Section
              profile={iris}
              surface={{ color: '#2a1810', roughness: 0.7, active: a }}
              cut={{ color: '#ffffff', map: tex.irisCut, roughness: 0.6, active: a }}
              z={0.002}
            />
            <mesh geometry={irisRing} position={[IRIS_X - 0.026, 0, 0]}>
              <Mat color="#ffffff" map={tex.iris} roughness={0.55} clearcoat={0.2} active={a} />
            </mesh>
          </>
        )}
      </Part>

      <Part id="pupil" anchor={[-0.99, -0.02, 0.02]} label={[-2.65, -1.1, 0]}>
        {(a) => (
          <mesh position={[IRIS_X, 0, 0.004]}>
            <planeGeometry args={[0.05, P.pupilR * 2]} />
            <meshBasicMaterial color="#9fdcff" transparent opacity={a ? 0.3 : 0} depthWrite={false} />
          </mesh>
        )}
      </Part>

      <Part id="ciliary" anchor={[-0.75, -0.8, 0.02]} label={[-1.0, -1.72, 0]}>
        {(a) => (
          <>
            <Section
              profile={ciliary}
              surface={{ color: '#ffffff', map: tex.ciliary, roughness: 0.5, clearcoat: 0.3, active: a }}
              cut={{ color: '#ffffff', map: tex.ciliary, roughness: 0.5, active: a }}
              z={0.0018}
            />
            {zonules.map((pts, i) => (
              <Line key={i} points={pts} color="#f1e6c4" lineWidth={1} transparent opacity={0.75} raycast={() => null} />
            ))}
          </>
        )}
      </Part>

      <Part id="lens" anchor={[-0.66, -0.12, 0.02]} label={[-1.95, -1.6, 0]}>
        {(a) => (
          <Section
            profile={lensProfile}
            surface={{ ...lensMat, active: a, glow: '#fff3c4', pulse: c * 0.4 }}
            cut={{ ...lensMat, active: a, glow: '#fff3c4', pulse: c * 0.4 }}
            renderOrder={7}
            z={0.0015}
          />
        )}
      </Part>

      <Part id="vitreous" anchor={[0.25 * s, 0.42, 0.02]} label={[1.9 * s + 0.2, 0.95, 0]}>
        {(a) => (
          <Section
            profile={vitreous}
            surface={{ color: '#e8f4ff', opacity: 0.025, roughness: 0.15, active: a }}
            cut={{ color: '#d6ecff', opacity: a ? 0.16 : 0.03, roughness: 0.15, active: a }}
            renderOrder={2}
          />
        )}
      </Part>
    </group>
  )
}

export { NERVE_LEN }
