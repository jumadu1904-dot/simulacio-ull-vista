import * as THREE from 'three'
import { axialX, type V2 } from './optics'
import { FUNDUS_SCALE } from './textures'

/** Punt de perfil: x = posició sobre l'eix òptic, r = distància a l'eix (≥ 0) */
export interface PP {
  x: number
  r: number
}

/** Superfície de revolució al voltant de l'eix X, només la meitat z ≤ 0 (tall sagital) */
export function halfLathe(profile: PP[], segments = 72): THREE.BufferGeometry {
  const pts = profile.map((p) => new THREE.Vector2(Math.max(p.r, 0), p.x))
  const g = new THREE.LatheGeometry(pts, segments, Math.PI / 2, Math.PI)
  g.rotateZ(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** UV de "fons d'ull": projecció frontal (y, z) → la fòvea queda al centre de la textura */
export function applyFundusUV(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = 0.5 + pos.getZ(i) / FUNDUS_SCALE
    uv[i * 2 + 1] = 0.5 + pos.getY(i) / FUNDUS_SCALE
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** Cara de tall (pla z = 0): perfil + imatge especular sota l'eix */
export function cutCap(profile: PP[]): THREE.BufferGeometry {
  const up = new THREE.Shape(profile.map((p) => new THREE.Vector2(p.x, p.r)))
  const down = new THREE.Shape(profile.map((p) => new THREE.Vector2(p.x, -p.r)).reverse())
  return new THREE.ShapeGeometry([up, down], 6)
}

export function arc(cx: number, radius: number, from: number, to: number, n = 48): PP[] {
  const out: PP[] = []
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n
    out.push({ x: cx + radius * Math.cos(t), r: radius * Math.sin(t) })
  }
  return out
}

/** Capa de la paret de l'ull (del pol posterior θ = 0 fins a θmax), amb gruix variable opcional */
export function shellProfile(rIn: number | ((t: number) => number), rOut: number, thetaMax: number, n = 64): PP[] {
  const inner = typeof rIn === 'number' ? () => rIn : rIn
  const out: PP[] = []
  for (let i = 0; i <= n; i++) {
    const t = (thetaMax * i) / n
    out.push({ x: rOut * Math.cos(t), r: rOut * Math.sin(t) })
  }
  for (let i = n; i >= 0; i--) {
    const t = (thetaMax * i) / n
    out.push({ x: inner(t) * Math.cos(t), r: inner(t) * Math.sin(t) })
  }
  return out
}

/** Allarga (miopia) o escurça (hipermetropia) la meitat posterior del perfil */
export const scaleAxial = (profile: PP[], s: number): PP[] =>
  s === 1 ? profile : profile.map((p) => ({ x: axialX(p.x, s), r: p.r }))

export const toV3 = (p: V2, z = 0.01): [number, number, number] => [p.x, p.y, z]
