/**
 * Textures procedurals (generades amb <canvas>) per donar un aspecte de model anatòmic realista
 * sense dependre de fitxers externs.
 */
import * as THREE from 'three'
import { DISC_ANGLE, RETINA_IN } from './optics'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Soroll de valor fractal i enrajolable (size × size, valors 0..1) */
function tileNoise(size: number, seed: number, baseCells = 8, octaves = 4): Float32Array {
  const out = new Float32Array(size * size)
  const rand = rng(seed)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o
    const grid = Array.from({ length: cells * cells }, rand)
    const g = (x: number, y: number) => grid[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)]
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells
        const fy = (y / size) * cells
        const ix = Math.floor(fx)
        const iy = Math.floor(fy)
        let tx = fx - ix
        let ty = fy - iy
        tx = tx * tx * (3 - 2 * tx)
        ty = ty * ty * (3 - 2 * ty)
        const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * tx
        const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * tx
        out[y * size + x] += (a + (b - a) * ty) * amp
      }
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

const hex = (c: string) => new THREE.Color(c)

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!] as const
}

function finish(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Teixit amb soroll entre dos colors (cares de tall) */
export function tissueTexture(a: string, b: string, seed: number, cells = 6, contrast = 1): THREE.CanvasTexture {
  const S = 256
  const [c, ctx] = canvas(S)
  const n = tileNoise(S, seed, cells, 4)
  const img = ctx.createImageData(S, S)
  const ca = hex(a)
  const cb = hex(b)
  for (let i = 0; i < S * S; i++) {
    const t = Math.min(1, Math.max(0, 0.5 + (n[i] - 0.5) * 2.2 * contrast))
    img.data[i * 4] = (ca.r + (cb.r - ca.r) * t) * 255
    img.data[i * 4 + 1] = (ca.g + (cb.g - ca.g) * t) * 255
    img.data[i * 4 + 2] = (ca.b + (cb.b - ca.b) * t) * 255
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return finish(c, true)
}

/** Vas sanguini: camí aleatori amb ramificacions */
function vessel(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  x: number,
  y: number,
  ang: number,
  w: number,
  len: number,
  color: string,
  avoid?: { x: number; y: number; r: number },
) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  let steps = Math.floor(len / 6)
  while (steps-- > 0 && w > 0.4) {
    ang += (rand() - 0.5) * 0.35
    if (avoid) {
      const dx = x - avoid.x
      const dy = y - avoid.y
      const dist = Math.hypot(dx, dy)
      if (dist < avoid.r * 1.6) {
        const away = Math.atan2(dy, dx)
        let diff = away - ang
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        ang += diff * 0.08
      }
    }
    const nx = x + Math.cos(ang) * 6
    const ny = y + Math.sin(ang) * 6
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(nx, ny)
    ctx.stroke()
    x = nx
    y = ny
    w *= 0.985
    if (rand() < 0.045) vessel(ctx, rand, x, y, ang + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.5), w * 0.7, len * 0.5, color, avoid)
  }
}

/** Escleròtica: blanc ivori amb vènules subtils */
export function scleraTexture(): THREE.CanvasTexture {
  const S = 1024
  const [c, ctx] = canvas(S)
  const n = tileNoise(S, 11, 6, 5)
  const img = ctx.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const t = n[i]
    img.data[i * 4] = 236 + t * 14
    img.data[i * 4 + 1] = 228 + t * 14
    img.data[i * 4 + 2] = 216 + t * 12
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const rand = rng(3)
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 26; i++) vessel(ctx, rand, rand() * S, rand() * S, rand() * Math.PI * 2, 1.2 + rand() * 1.6, 260, '#b5434b')
  ctx.globalAlpha = 1
  return finish(c)
}

/**
 * Iris: estroma blau-verd amb estries radials, criptes, collareta daurada i anell límbic.
 * Mapat pla (RingGeometry): el disc omple tota la textura.
 */
export function irisTexture(): THREE.CanvasTexture {
  const S = 1024
  const [c, ctx] = canvas(S)
  const cx = S / 2
  const R = S / 2
  const rand = rng(7)

  const base = ctx.createRadialGradient(cx, cx, R * 0.12, cx, cx, R)
  base.addColorStop(0, '#6b4a1c')
  base.addColorStop(0.3, '#8a6a2a')
  base.addColorStop(0.42, '#3f8f86')
  base.addColorStop(0.7, '#2f7aa0')
  base.addColorStop(0.92, '#1f4f7a')
  base.addColorStop(1, '#0d2238')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)

  // estries radials (fibres de l'estroma)
  for (let i = 0; i < 1400; i++) {
    const a = rand() * Math.PI * 2
    const r1 = R * (0.15 + rand() * 0.3)
    const r2 = R * (0.75 + rand() * 0.22)
    const wob = (rand() - 0.5) * 0.08
    const cols = ['#9fe3e0', '#7cc7d8', '#c4f0e6', '#5aa7b8', '#2c6f8f', '#e0c27a']
    ctx.strokeStyle = cols[Math.floor(rand() * cols.length)]
    ctx.globalAlpha = 0.08 + rand() * 0.22
    ctx.lineWidth = 0.6 + rand() * 2.2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1)
    const am = a + wob
    const rm = (r1 + r2) / 2
    ctx.quadraticCurveTo(cx + Math.cos(am) * rm, cx + Math.sin(am) * rm, cx + Math.cos(a) * r2, cx + Math.sin(a) * r2)
    ctx.stroke()
  }
  // criptes
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2
    const r = R * (0.45 + rand() * 0.35)
    ctx.globalAlpha = 0.25 + rand() * 0.3
    ctx.fillStyle = '#0f2f40'
    ctx.beginPath()
    ctx.ellipse(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 4 + rand() * 10, 2 + rand() * 4, a, 0, Math.PI * 2)
    ctx.fill()
  }
  // collareta
  ctx.globalAlpha = 0.6
  ctx.strokeStyle = '#d9b25e'
  ctx.lineWidth = 5
  ctx.beginPath()
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2
    const r = R * (0.4 + 0.025 * Math.sin(a * 17) + 0.01 * Math.sin(a * 41))
    const x = cx + Math.cos(a) * r
    const y = cx + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  // anell límbic fosc
  ctx.globalAlpha = 1
  const limb = ctx.createRadialGradient(cx, cx, R * 0.86, cx, cx, R)
  limb.addColorStop(0, 'rgba(5,15,30,0)')
  limb.addColorStop(1, 'rgba(5,15,30,0.9)')
  ctx.fillStyle = limb
  ctx.fillRect(0, 0, S, S)
  return finish(c)
}

/** Posició del disc òptic dins la textura del fons d'ull (coordenades UV) */
export const FUNDUS_SCALE = 2.4
export const discUV = () => ({ u: 0.5, v: 0.5 + (RETINA_IN * Math.sin(DISC_ANGLE)) / FUNDUS_SCALE })

/**
 * Fons d'ull (retina vista per dins): taronja-vermellós, màcula i fòvea al centre,
 * disc òptic (punt cec) pàl·lid i arcades vasculars.
 */
export function retinaTexture(): THREE.CanvasTexture {
  const S = 1024
  const [c, ctx] = canvas(S)
  const n = tileNoise(S, 21, 10, 5)
  const img = ctx.createImageData(S, S)
  const base = hex('#f5823c')
  const dark = hex('#c2441c')
  for (let i = 0; i < S * S; i++) {
    const t = n[i]
    img.data[i * 4] = (dark.r + (base.r - dark.r) * t * 1.2) * 255
    img.data[i * 4 + 1] = (dark.g + (base.g - dark.g) * t * 1.2) * 255
    img.data[i * 4 + 2] = (dark.b + (base.b - dark.b) * t * 1.2) * 255
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const fx = S / 2
  const fy = S / 2
  // màcula (taca groga) i fòvea
  const mac = ctx.createRadialGradient(fx, fy, 0, fx, fy, S * 0.09)
  mac.addColorStop(0, 'rgba(90,25,10,0.85)')
  mac.addColorStop(0.5, 'rgba(140,50,15,0.5)')
  mac.addColorStop(1, 'rgba(140,50,15,0)')
  ctx.fillStyle = mac
  ctx.fillRect(0, 0, S, S)
  const fov = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10)
  fov.addColorStop(0, 'rgba(255,240,170,1)')
  fov.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = fov
  ctx.beginPath()
  ctx.arc(fx, fy, 10, 0, Math.PI * 2)
  ctx.fill()

  // disc òptic
  const d = discUV()
  const dx = d.u * S
  const dy = (1 - d.v) * S
  const rand = rng(5)
  const avoid = { x: fx, y: fy, r: S * 0.08 }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.4
    vessel(ctx, rand, dx, dy, a, 7 + rand() * 3, 520, i % 2 ? '#6d0d0d' : '#b0201a', avoid)
  }
  const disc = ctx.createRadialGradient(dx, dy, 0, dx, dy, 34)
  disc.addColorStop(0, '#fffbe6')
  disc.addColorStop(0.35, '#ffe2a6')
  disc.addColorStop(0.85, '#f2a96f')
  disc.addColorStop(1, 'rgba(242,169,111,0)')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(dx, dy, 34, 0, Math.PI * 2)
  ctx.fill()
  return finish(c)
}

/** Fibres longitudinals (nervi òptic, múscul ciliar) */
export function fiberTexture(a: string, b: string, seed: number, lines = 140): THREE.CanvasTexture {
  const S = 512
  const [c, ctx] = canvas(S)
  ctx.fillStyle = a
  ctx.fillRect(0, 0, S, S)
  const rand = rng(seed)
  for (let i = 0; i < lines; i++) {
    const x = rand() * S
    ctx.strokeStyle = b
    ctx.globalAlpha = 0.15 + rand() * 0.35
    ctx.lineWidth = 1 + rand() * 3
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + (rand() - 0.5) * 30, S * 0.33, x + (rand() - 0.5) * 30, S * 0.66, x, S)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return finish(c, true)
}
