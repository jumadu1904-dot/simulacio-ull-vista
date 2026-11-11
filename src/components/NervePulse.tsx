import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useLabels } from './Part'
import { NERVE_LEN } from './EyeModel'
import { DISC_ANGLE, RETINA_IN, retinaPoint, wallNormal, type V2 } from '../optics'

const PULSES = 5
const TRAIL = 6
const SPEED = 1.1
const COLOR = new THREE.Color('#8ff7ff').multiplyScalar(3)

interface Props {
  landings: V2[]
  axial: number
  active: boolean
}

/**
 * Impulsos elèctrics: neixen on la llum toca la retina, recorren la retina fins al punt cec
 * i surten pel nervi òptic cap al cervell.
 */
export function NervePulse({ landings, axial, active }: Props) {
  const { study } = useLabels()
  const disc = retinaPoint(DISC_ANGLE, axial)
  const nrm = wallNormal(DISC_ANGLE, axial)
  const exitLen = NERVE_LEN + 0.9
  const nerveEnd: V2 = { x: disc.x + nrm.x * exitLen, y: disc.y + nrm.y * exitLen }

  const paths = useMemo(() => {
    return landings.map((l) => {
      const th0 = Math.atan2(l.y, l.x / axial)
      const pts: THREE.Vector3[] = []
      const n = 24
      for (let i = 0; i <= n; i++) {
        const th = th0 + ((DISC_ANGLE - th0) * i) / n
        const p = retinaPoint(th, axial, RETINA_IN + 0.015)
        pts.push(new THREE.Vector3(p.x, p.y, 0.04))
      }
      for (let i = 1; i <= 12; i++) {
        const d = (exitLen * i) / 12
        pts.push(new THREE.Vector3(disc.x + nrm.x * d, disc.y + nrm.y * d, 0.04))
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      return { curve, len: curve.getLength() }
    })
  }, [landings, axial, disc.x, disc.y, nrm.x, nrm.y, exitLen])

  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const max = 2 * PULSES * TRAIL

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    let n = 0
    if (active)
      paths.forEach(({ curve, len }, pi) => {
        for (let k = 0; k < PULSES; k++) {
          const head = ((t * SPEED) / len + k / PULSES + pi * 0.11) % 1
          for (let j = 0; j < TRAIL && n < max; j++, n++) {
            const f = head - j * (0.036 / len)
            if (f < 0) {
              tmp.scale.setScalar(0)
            } else {
              curve.getPointAt(f, tmpV)
              tmp.position.copy(tmpV)
              const fade = Math.min(1, (1 - f) / 0.12) * Math.min(1, f / 0.03)
              tmp.scale.setScalar((1 - j / TRAIL) * fade + 1e-3)
            }
            tmp.updateMatrix()
            mesh.setMatrixAt(n, tmp.matrix)
          }
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
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, max]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[0.032, 12, 12]} />
        <meshBasicMaterial color={COLOR} toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
      {(
        <Html position={[nerveEnd.x - 0.2, nerveEnd.y - 0.3, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="label label--soft" style={{ display: study && active ? undefined : 'none' }}>Impuls nerviós → cervell</div>
        </Html>
      )}
    </group>
  )
}
