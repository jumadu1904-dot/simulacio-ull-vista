/**
 * Model òptic 2D (pla de tall z = 0) de l'ull humà.
 * Unitats: 1 unitat = 1 cm. Eix òptic = eix X: la llum ve de -X i la retina és a +X.
 * Els raigs es tracen amb la llei de Snell real a cada superfície.
 */

export interface V2 {
  x: number
  y: number
}

export const v = (x: number, y: number): V2 => ({ x, y })
export const add = (a: V2, b: V2) => v(a.x + b.x, a.y + b.y)
export const sub = (a: V2, b: V2) => v(a.x - b.x, a.y - b.y)
export const mul = (a: V2, s: number) => v(a.x * s, a.y * s)
export const dot = (a: V2, b: V2) => a.x * b.x + a.y * b.y
export const norm = (a: V2) => mul(a, 1 / Math.hypot(a.x, a.y))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rotate = (a: V2, ang: number) => v(a.x * Math.cos(ang) - a.y * Math.sin(ang), a.x * Math.sin(ang) + a.y * Math.cos(ang))
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Índexs de refracció */
export const N = { air: 1.0, cornea: 1.376, aqueous: 1.336, vitreous: 1.336 }

export const CORNEA = { apex: -1.32, r1: 0.78, thick: 0.055, r2: 0.75, edge: 0.6 }
export const CORNEA_C1 = CORNEA.apex + CORNEA.r1
export const CORNEA_C2 = CORNEA.apex + CORNEA.thick + CORNEA.r2

export const EYE_R = 1.2
export const SCLERA_IN = 1.15
export const CHOROID_IN = 1.12
export const RETINA_IN = 1.09

export const IRIS_X = -0.985
export const LENS_EQ_X = -0.72
export const X_OBJECT = -4.0
export const OBJECT_ANGLE = (6 * Math.PI) / 180
/** Angle (des del pol posterior) on surt el nervi òptic: costat nasal → punt cec */
export const DISC_ANGLE = (-24 * Math.PI) / 180

/** Paràmetres de l'ull que canvien en temps real */
export interface EyeParams {
  /** acomodació 0 (relaxat) … 1 (màxima) */
  k: number
  /** radi de la pupil·la (cm) */
  pupilR: number
  /** factor d'allargament del segment posterior: <1 hipermetropia, >1 miopia */
  axial: number
  /** opacitat del cristal·lí 0 … 1 */
  cataract: number
}

/** Allargament axial: només la meitat posterior (x > 0) de la paret de l'ull */
export const axialX = (x: number, s: number) => (x > 0 ? x * s : x)

/** Punt de la retina en un angle θ (des del pol posterior) */
export const retinaPoint = (theta: number, s: number, r = RETINA_IN): V2 =>
  v(axialX(r * Math.cos(theta), s), r * Math.sin(theta))

/** Normal exterior de la paret posterior (el·lipse) en un angle θ */
export const wallNormal = (theta: number, s: number): V2 => {
  const c = Math.cos(theta)
  return c > 0 ? norm(v(c / s, Math.sin(theta))) : v(c, Math.sin(theta))
}

export interface LensShape {
  R1: number
  R2: number
  a: number
  sag1: number
  sag2: number
  xFront: number
  xBack: number
}

const sag = (R: number, a: number) => R - Math.sqrt(R * R - a * a)

export function lensShape(k: number): LensShape {
  const R1 = lerp(1.0, 0.55, k)
  const R2 = lerp(0.6, 0.5, k)
  const a = lerp(0.45, 0.41, k)
  const sag1 = sag(R1, a)
  const sag2 = sag(R2, a)
  return { R1, R2, a, sag1, sag2, xFront: LENS_EQ_X - sag1, xBack: LENS_EQ_X + sag2 }
}

let nLens = 1.42
export const getLensIndex = () => nLens

function hitCircle(p: V2, d: V2, cx: number, r: number, far: boolean): number | null {
  const oc = v(p.x - cx, p.y)
  const b = dot(oc, d)
  const c = dot(oc, oc) - r * r
  const disc = b * b - c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  const t = far ? -b + s : -b - s
  return t > 1e-7 ? t : null
}

/** Intersecció amb la retina el·líptica (x/s)² + y² = R² (part posterior) */
function hitRetina(p: V2, d: V2, s: number): number | null {
  const ps = v(p.x / s, p.y)
  const ds = v(d.x / s, d.y)
  const a = dot(ds, ds)
  const b = 2 * dot(ps, ds)
  const c = dot(ps, ps) - RETINA_IN * RETINA_IN
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const t = (-b + Math.sqrt(disc)) / (2 * a)
  return t > 1e-7 ? t : null
}

function refract(d: V2, normal: V2, n1: number, n2: number): V2 | null {
  let n = normal
  let cosi = -dot(n, d)
  if (cosi < 0) {
    n = mul(n, -1)
    cosi = -cosi
  }
  const eta = n1 / n2
  const k = 1 - eta * eta * (1 - cosi * cosi)
  if (k < 0) return null
  return norm(add(mul(d, eta), mul(n, eta * cosi - Math.sqrt(k))))
}

const circleNormal = (p: V2, cx: number) => norm(v(p.x - cx, p.y))

export interface TraceResult {
  pts: V2[]
  blocked: boolean
  hitRetina: boolean
  scattered: boolean
  afterLens?: { p: V2; d: V2 }
}

export const corneaPointAt = (h: number) => v(CORNEA_C1 - Math.sqrt(CORNEA.r1 * CORNEA.r1 - h * h), h)

export function traceFromCornea(entry: V2, dir: V2, P: EyeParams, usePupil: boolean, idx = 0): TraceResult {
  const L = lensShape(P.k)
  const pts: V2[] = [entry]
  const fail: TraceResult = { pts, blocked: true, hitRetina: false, scattered: false }

  let d = refract(dir, circleNormal(entry, CORNEA_C1), N.air, N.cornea)
  if (!d) return fail
  let p = entry

  let t = hitCircle(p, d, CORNEA_C2, CORNEA.r2, false)
  if (t === null) return fail
  p = add(p, mul(d, t))
  pts.push(p)
  d = refract(d, circleNormal(p, CORNEA_C2), N.cornea, N.aqueous)
  if (!d) return fail

  if (usePupil) {
    const ti = (IRIS_X - p.x) / d.x
    const pi = add(p, mul(d, ti))
    if (Math.abs(pi.y) > P.pupilR) {
      pts.push(pi)
      return { pts, blocked: true, hitRetina: false, scattered: false }
    }
  }

  const cFront = L.xFront + L.R1
  t = hitCircle(p, d, cFront, L.R1, false)
  if (t === null) return fail
  p = add(p, mul(d, t))
  pts.push(p)
  if (Math.abs(p.y) > L.a) return fail
  d = refract(d, circleNormal(p, cFront), N.aqueous, nLens)
  if (!d) return fail

  // Cataractes: el cristal·lí opac absorbeix una part dels raigs
  if (P.cataract > 0.01 && hash(idx * 3.17) < 0.55 * P.cataract) {
    pts.push(add(p, mul(d, (L.sag1 + L.sag2) * 0.45)))
    return { pts, blocked: true, hitRetina: false, scattered: true }
  }

  const cBack = L.xBack - L.R2
  t = hitCircle(p, d, cBack, L.R2, true)
  if (t === null) return fail
  p = add(p, mul(d, t))
  pts.push(p)
  d = refract(d, circleNormal(p, cBack), nLens, N.vitreous)
  if (!d) return fail

  // Cataractes: la resta de raigs es difonen (imatge borrosa i velada)
  let scattered = false
  if (P.cataract > 0.01) {
    d = rotate(d, (hash(idx * 7.31 + 1.7) - 0.5) * 0.55 * P.cataract)
    scattered = true
  }
  const afterLens = { p, d }

  t = hitRetina(p, d, P.axial)
  if (t === null) return { pts, blocked: true, hitRetina: false, scattered, afterLens }
  p = add(p, mul(d, t))
  pts.push(p)
  return { pts, blocked: false, hitRetina: true, scattered, afterLens }
}

const RELAXED: EyeParams = { k: 0, pupilR: 1, axial: 1, cataract: 0 }

/** Focus paraxial (x) d'un punt de l'eix a distància D (cm) */
export function focusX(k: number, D: number): number {
  const h = 0.004
  const entry = corneaPointAt(h)
  const dir = Number.isFinite(D) ? norm(sub(entry, v(CORNEA.apex - D, 0))) : v(1, 0)
  const r = traceFromCornea(entry, dir, { ...RELAXED, k }, false)
  if (!r.afterLens) return Infinity
  const { p, d } = r.afterLens
  if (d.y >= 0) return Infinity
  return p.x - (p.y * d.x) / d.y
}

// Calibració: ull normal relaxat → l'infinit s'enfoca exactament a la retina (emmetropia)
;(function calibrate() {
  let lo = 1.36
  let hi = 1.75
  for (let i = 0; i < 60; i++) {
    nLens = (lo + hi) / 2
    if (focusX(0, Infinity) > RETINA_IN) lo = nLens
    else hi = nLens
  }
})()

/** Acomodació necessària per enfocar a distància D amb un ull de llargada relativa s */
export function solveAccommodation(D: number, s = 1): { k: number; reachable: boolean } {
  const target = RETINA_IN * s
  if (focusX(1, D) > target) return { k: 1, reachable: false }
  if (focusX(0, D) <= target) return { k: 0, reachable: focusX(0, D) > target - 0.002 }
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (focusX(m, D) > target) lo = m
    else hi = m
  }
  return { k: (lo + hi) / 2, reachable: true }
}

export function lensPower(k: number): number {
  const L = lensShape(k)
  return (nLens - N.aqueous) * (1 / (L.R1 * 0.01) + 1 / (L.R2 * 0.01))
}

export interface Ray {
  start: V2
  entry: V2
  inner: V2[]
  blocked: boolean
  hitRetina: boolean
  scattered: boolean
  afterLens?: { p: V2; d: V2 }
}

export interface Bundle {
  kind: 'top' | 'bottom'
  rays: Ray[]
  landing: V2 | null
  objectPoint: V2
  /** punt real on convergeixen els raigs (pot ser davant o darrere la retina) */
  focus: V2 | null
}

export const RAYS_PER_BUNDLE = 11

/** Punt que minimitza la distància a totes les rectes (intersecció per mínims quadrats) */
function convergence(lines: { p: V2; d: V2 }[]): V2 | null {
  if (lines.length < 2) return null
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0
  for (const { p, d } of lines) {
    const m11 = 1 - d.x * d.x
    const m12 = -d.x * d.y
    const m22 = 1 - d.y * d.y
    a11 += m11
    a12 += m12
    a22 += m22
    b1 += m11 * p.x + m12 * p.y
    b2 += m12 * p.x + m22 * p.y
  }
  const det = a11 * a22 - a12 * a12
  if (Math.abs(det) < 1e-9) return null
  return v((b1 * a22 - b2 * a12) / det, (a11 * b2 - a12 * b1) / det)
}

export function computeBundles(P: EyeParams, D: number): Bundle[] {
  return (['top', 'bottom'] as const).map((kind, bi) => {
    const sign = kind === 'top' ? 1 : -1
    const tanA = Math.tan(OBJECT_ANGLE)
    const O = Number.isFinite(D) ? v(CORNEA.apex - D, sign * D * tanA) : null
    const c = sign * 0.25 * tanA
    const rays: Ray[] = []
    for (let i = 0; i < RAYS_PER_BUNDLE; i++) {
      const h = c + lerp(-0.55, 0.55, i / (RAYS_PER_BUNDLE - 1))
      const entry = corneaPointAt(h)
      const dir = O ? norm(sub(entry, O)) : v(Math.cos(OBJECT_ANGLE), -sign * Math.sin(OBJECT_ANGLE))
      const tr = traceFromCornea(entry, dir, P, true, bi * 100 + i)
      const start = sub(entry, mul(dir, (entry.x - X_OBJECT) / dir.x))
      rays.push({ start, entry, inner: tr.pts, blocked: tr.blocked, hitRetina: tr.hitRetina, scattered: tr.scattered, afterLens: tr.afterLens })
    }
    const hits = rays.filter((r) => r.hitRetina)
    const landing = hits.length
      ? mul(hits.reduce((s, r) => add(s, r.inner[r.inner.length - 1]), v(0, 0)), 1 / hits.length)
      : null
    const objectPoint = mul(rays.reduce((s, r) => add(s, r.start), v(0, 0)), 1 / rays.length)
    const focus = P.cataract > 0.05 ? null : convergence(hits.map((r) => r.afterLens!))
    return { kind, rays, landing, objectPoint, focus }
  })
}
