import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const frame = atom({ plugin: 'moon-night', key: 'frame' } as const, 0)
const isHidden = atom({ plugin: 'moon-night', key: 'isHidden' } as const, false)

type RGB = [number, number, number]
type Grid = RGB[][]

const TEXT_ROWS = 14
const H = TEXT_ROWS * 2
const HZ = Math.floor(H * 0.64)
const TICK_MS = 150
const NIGHT_FROM = 18
const DAY_FROM = 6

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const mix = (a: RGB, b: RGB, k: number): RGB => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
]
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const noise = (x: number, y: number, k: number) => hash(x * 12.9898 + y * 78.233 + k * 37.719)

// A canvas of square pixels; `px` blends with alpha, `dis` is alpha that
// crumbles: each pixel is kept or thinned by noise that reshuffles every few frames.
const canvas = (w: number, sky: (y: number) => RGB) => {
  const g: Grid = Array.from({ length: H }, (_, y) => Array.from({ length: w }, () => sky(y)))
  const px = (x: number, y: number, c: RGB, a = 1) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < w && y >= 0 && y < H && a > 0.01) g[y][x] = a >= 0.99 ? c : mix(g[y][x], c, a)
  }
  return { g, px }
}
type Px = ReturnType<typeof canvas>['px']

const ridge = (x: number, w: number, amp: number) =>
  Math.round(
    H * 0.1 + amp * (H * 0.09 * Math.sin(x / 9 + 0.5) + H * 0.055 * Math.sin(x / 3.4 + 1) + H * 0.04 * Math.sin(x / 21)) + H * 0.06,
  )

const cloud = (px: Px, t: number, cx: number, cy: number, w: number, h: number, body: RGB, lit: RGB, litAt: (x: number, y: number) => number) => {
  const blobs = [[0.3, 0.62, 0.3], [0.55, 0.45, 0.36], [0.78, 0.66, 0.26]]
  for (let y = -h; y <= 1; y++) {
    for (let x = 0; x < w; x++) {
      let d = 9
      for (const [bx, by, br] of blobs) d = Math.min(d, Math.hypot((x / w - bx) * (w / h), (y / h + 1 - by)) / (br * (w / h) * 0.6 + 0.001))
      const a = clamp((1 - d) * 2.2) * (0.5 + 0.5 * noise(Math.round(cx) + x, cy + y, Math.floor(t / 5)))
      if (a > 0) px(cx + x, cy + y, mix(body, lit, litAt(cx + x, cy + y)), a)
    }
  }
}

const pine = (px: Px, cx: number, h: number, c1: RGB, c2: RGB, t: number) => {
  for (let r = 0; r < h; r++) {
    const half = (r + 1) / 2.3
    for (let x = -Math.ceil(half); x <= Math.ceil(half); x++) {
      const edge = clamp(half + 0.6 - Math.abs(x))
      const crumble = r < 2 ? 0.55 + 0.45 * noise(cx + x, r, Math.floor(t / 6)) : 1
      px(cx + x, HZ - h + r, r % 2 ? c1 : c2, edge * crumble)
    }
  }
}

const nightScene = (w: number, t: number): Grid => {
  const SKY_TOP: RGB = [4, 6, 22]
  const SKY_LOW: RGB = [36, 66, 118]
  const { g, px } = canvas(w, y => mix(SKY_TOP, SKY_LOW, clamp(y / HZ) ** 1.5))
  const mx = w * 0.74
  const my = H * 0.28
  const R = H * 0.17
  const MOON_C: RGB = [255, 245, 195]

  for (let i = 0; i < Math.floor((w * HZ) / 26); i++) {
    const x = Math.floor(hash(i) * w)
    const y = Math.floor(hash(i + 100) * (HZ - 3))
    const v = Math.sin(t / 3 + hash(i + 200) * 6.28) * 0.5 + 0.5
    px(x, y, [205, 220, 255], 0.2 + 0.8 * v)
    if (i % 9 === 0 && v > 0.8) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(x + dx, y + dy, [160, 180, 255], 0.45)
  }

  const pulse = 0.5 + 0.5 * Math.sin(t / 8)
  const gr = R * 2.8
  for (let y = Math.floor(my - gr); y <= my + gr; y++) {
    for (let x = Math.floor(mx - gr); x <= mx + gr; x++) {
      const d = Math.hypot(x - mx, y - my)
      if (d > R && d < gr) px(x, y, [125, 145, 215], (0.3 + 0.07 * pulse) * (1 - (d - R) / (gr - R)) ** 2 * (0.7 + 0.3 * noise(x, y, Math.floor(t / 4))))
    }
  }
  for (let y = Math.floor(my - R - 1); y <= my + R + 1; y++) {
    for (let x = Math.floor(mx - R - 1); x <= mx + R + 1; x++) {
      const d = Math.hypot(x - mx, y - my)
      if (d <= R + 0.6) px(x, y, mix(MOON_C, [215, 200, 140], clamp(((x - mx) - (y - my)) / (R * 3) + 0.15)), clamp(R + 0.6 - d))
    }
  }
  for (const [dx, dy, r] of [[-0.35, -0.3, 0.26], [0.3, 0.35, 0.22], [0.4, -0.45, 0.14], [-0.5, 0.35, 0.16], [0.05, -0.05, 0.1], [0.62, 0.05, 0.1]]) {
    const cr = r * R
    for (let y = -Math.ceil(cr); y <= Math.ceil(cr); y++)
      for (let x = -Math.ceil(cr); x <= Math.ceil(cr); x++) {
        const d = Math.hypot(x, y)
        if (d <= cr) px(mx + dx * R + x, my + dy * R + y, [208, 192, 132], clamp(cr + 0.5 - d) * 0.9)
      }
  }

  const litAt = (x: number, y: number) => clamp(1 - Math.hypot(x - mx, (y - my) * 1.4) / (R * 4.5)) * 0.7
  const span = w + 40
  const drift = (s: number, off: number) => ((t * s + off) % span) - 24
  cloud(px, t, drift(0.2, 0), Math.floor(H * 0.2), Math.floor(w * 0.2), 6, [44, 58, 100], [200, 210, 240], litAt)
  cloud(px, t, drift(0.33, span * 0.5), Math.floor(H * 0.4), Math.floor(w * 0.26), 7, [36, 50, 90], [190, 200, 235], litAt)
  cloud(px, t, drift(0.13, span * 0.8), Math.floor(H * 0.08), Math.floor(w * 0.14), 4, [52, 66, 110], [205, 215, 245], litAt)

  for (const [period, off, seed] of [[43, 5, 1], [67, 30, 2], [89, 11, 3]]) {
    const n = Math.floor((t + off) / period)
    const p = (t + off) % period
    if (p < 14) {
      const x0 = w * 0.15 + hash(n * 7 + seed) * w * 0.7
      const y0 = hash(n * 13 + seed) * H * 0.22
      for (let k = 0; k < 11; k++) {
        const q = p - k * 0.45
        if (q >= 0) px(x0 - q * 2.3, y0 + q * 1.1, [255, 255, 255], k === 0 ? 1 : 0.8 - k * 0.07)
      }
    }
  }

  for (let x = 0; x < w; x++) {
    const top = HZ - ridge(x, w, 1)
    for (let y = top; y < HZ; y++) {
      const depth = (y - top) / Math.max(1, HZ - top)
      const haze = depth > 0.55 ? (depth - 0.55) / 0.45 : 0
      const col: RGB = y === top ? [66, 92, 150] : mix([24, 38, 76], [14, 24, 52], depth)
      px(x, y, col)
      if (haze > 0) px(x, y, [60, 86, 140], haze * 0.5 * noise(x, y, Math.floor(t / 5)))
    }
  }
  for (let x = 0; x < w; x++) px(x, HZ, [10, 26, 30])

  const trees: [number, number][] = [[0.03, 9], [0.07, 12], [0.11, 8], [0.15, 10], [0.2, 6], [0.4, 5], [0.56, 6], [0.9, 8], [0.94, 12], [0.98, 9], [0.84, 6]]
  for (const [fx, h] of trees) pine(px, Math.round(fx * w), Math.round(h * (H / 28)), [10, 38, 32], [14, 50, 40], t)

  for (let y = HZ + 1; y < H; y++) {
    const d = (y - HZ - 1) / (H - HZ - 2)
    for (let x = 0; x < w; x++) {
      px(x, y, mix([30, 56, 104], [6, 14, 40], d))
      const ripple = Math.sin(x / 2.8 + t / 3 + y * 1.9) * 0.5 + 0.5
      if (ripple > 0.82) px(x, y, [70, 106, 170], 0.35)
      if (y < HZ + 4) px(x, y, [8, 24, 30], (0.5 - (y - HZ) * 0.14) * noise(x, y, Math.floor(t / 4)))
    }
    const wob = Math.sin(t / 2 + y * 1.3) * (1 + d * 3)
    const half = R * (0.9 - d * 0.35)
    for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) {
      const inside = Math.abs(x + wob) <= half
      if (inside && Math.sin(t / 1.5 + y * 2.1 + x) > -0.35) px(mx + x, y, MOON_C, (0.85 - d * 0.4) * (0.6 + 0.4 * noise(x, y, Math.floor(t / 2))))
    }
  }

  for (let i = 0; i < Math.max(6, Math.floor(w / 14)); i++) {
    const blink = Math.sin(t / 2.5 + i * 2.3)
    if (blink > 0) {
      const x = hash(i + 400) * w + Math.sin(t / 7 + i) * 4
      const y = HZ - 3 + Math.sin(t / 5 + i * 1.7) * 2.5
      px(x, y, [200, 255, 120], blink * 0.9)
      px(x + 1, y, [160, 220, 90], blink * 0.3)
    }
  }
  return g
}

const dayScene = (w: number, t: number): Grid => {
  const SKY_TOP: RGB = [52, 124, 224]
  const SKY_LOW: RGB = [190, 228, 252]
  const { g, px } = canvas(w, y => mix(SKY_TOP, SKY_LOW, clamp(y / HZ) ** 1.3))
  const sx = w * 0.26
  const sy = H * 0.26
  const R = H * 0.13
  const SUN: RGB = [255, 247, 190]

  const gr = R * 3.4
  for (let y = Math.floor(sy - gr); y <= sy + gr; y++) {
    for (let x = Math.floor(sx - gr); x <= sx + gr; x++) {
      const d = Math.hypot(x - sx, y - sy)
      if (d <= R || d >= gr) continue
      const ang = Math.atan2(y - sy, x - sx)
      const ray = Math.max(0, Math.sin(ang * 9 + t / 9)) ** 3
      const k = (1 - (d - R) / (gr - R)) ** 2
      px(x, y, [255, 240, 170], (0.28 * k + 0.35 * ray * k) * (0.65 + 0.35 * noise(x, y, Math.floor(t / 3))))
    }
  }
  for (let y = Math.floor(sy - R - 1); y <= sy + R + 1; y++)
    for (let x = Math.floor(sx - R - 1); x <= sx + R + 1; x++) {
      const d = Math.hypot(x - sx, y - sy)
      if (d <= R + 0.6) px(x, y, mix(SUN, [255, 214, 110], clamp(d / R) ** 2), clamp(R + 0.6 - d))
    }

  const span = w + 40
  const drift = (s: number, off: number) => ((t * s + off) % span) - 24
  const white: RGB = [250, 252, 255]
  const shade: RGB = [196, 214, 238]
  const lit = (_x: number, y: number) => clamp(1 - (y % 10) / 9)
  cloud(px, t, drift(0.22, 0), Math.floor(H * 0.22), Math.floor(w * 0.22), 6, shade, white, lit)
  cloud(px, t, drift(0.36, span * 0.45), Math.floor(H * 0.42), Math.floor(w * 0.28), 7, shade, white, lit)
  cloud(px, t, drift(0.14, span * 0.75), Math.floor(H * 0.1), Math.floor(w * 0.16), 5, shade, white, lit)

  for (let i = 0; i < 4; i++) {
    const bx = ((t * (0.9 + i * 0.25) + i * w * 0.27) % (w + 20)) - 10
    const by = H * (0.12 + 0.1 * i) + Math.sin(t / 4 + i * 2) * 1.8
    const flap = Math.floor(t / 2 + i) % 2
    const c: RGB = [40, 50, 70]
    px(bx, by, c)
    px(bx - 1, by - flap, c)
    px(bx + 1, by - flap, c)
    px(bx - 2, by - flap + 1, c, 0.7)
    px(bx + 2, by - flap + 1, c, 0.7)
  }

  for (let x = 0; x < w; x++) {
    const top = HZ - ridge(x, w, 1)
    const snow = HZ - top > H * 0.26
    for (let y = top; y < HZ; y++) {
      const depth = (y - top) / Math.max(1, HZ - top)
      let col: RGB = mix([108, 138, 186], [150, 178, 214], depth)
      if (snow && y - top < (HZ - top) * 0.28) col = mix([245, 250, 255], col, (y - top) / ((HZ - top) * 0.28) * 0.6)
      px(x, y, col)
      if (depth > 0.5) px(x, y, [200, 226, 250], (depth - 0.5) * 1.1 * noise(x, y, Math.floor(t / 5)))
    }
  }
  for (let x = 0; x < w; x++) {
    const hill = Math.round(1 + Math.sin(x / 6) * 1.2 + Math.sin(x / 2.3) * 0.5)
    for (let y = HZ - hill; y <= HZ; y++) px(x, y, mix([76, 160, 80], [50, 124, 62], (y - (HZ - hill)) / 3), y === HZ - hill ? 0.6 + 0.4 * noise(x, y, 1) : 1)
  }
  const trees: [number, number][] = [[0.03, 9], [0.07, 12], [0.11, 8], [0.15, 10], [0.2, 6], [0.4, 5], [0.56, 6], [0.9, 8], [0.94, 12], [0.98, 9], [0.84, 6]]
  for (const [fx, h] of trees) pine(px, Math.round(fx * w), Math.round(h * (H / 28)), [30, 100, 54], [40, 124, 66], t)
  for (let i = 0; i < Math.floor(w / 6); i++) {
    const c: RGB[] = [[255, 120, 150], [255, 230, 90], [255, 255, 255]]
    px(hash(i + 500) * w, HZ - hash(i + 600) * 2, c[i % 3], 0.9)
  }

  for (let y = HZ + 1; y < H; y++) {
    const d = (y - HZ - 1) / (H - HZ - 2)
    for (let x = 0; x < w; x++) {
      px(x, y, mix([86, 168, 226], [28, 88, 160], d))
      const ripple = Math.sin(x / 2.6 + t / 3 + y * 1.8) * 0.5 + 0.5
      if (ripple > 0.84) px(x, y, [170, 220, 255], 0.45)
      if (y < HZ + 4) px(x, y, [50, 124, 62], (0.5 - (y - HZ) * 0.14) * noise(x, y, Math.floor(t / 4)))
      if (noise(x, y, Math.floor(t / 2)) > 0.985) px(x, y, [255, 255, 255], 0.9)
    }
    const wob = Math.sin(t / 2 + y * 1.3) * (1 + d * 3)
    for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) {
      if (Math.abs(x + wob) <= R * (0.85 - d * 0.3) && Math.sin(t / 1.5 + y * 2.1 + x) > -0.35) px(sx + x, y, SUN, (0.7 - d * 0.35) * (0.6 + 0.4 * noise(x, y, Math.floor(t / 2))))
    }
  }

  for (let i = 0; i < 5; i++) {
    const bx = hash(i + 700) * w * 0.9 + Math.sin(t / 6 + i * 2) * 5
    const by = HZ - 2 - hash(i + 800) * 4 + Math.sin(t / 4 + i) * 2
    const flap = Math.floor(t / 2 + i) % 2
    const c: RGB = i % 2 ? [255, 150, 190] : [255, 220, 90]
    px(bx - 1, by - flap, c, 0.9)
    px(bx + 1, by - flap, c, 0.9)
    px(bx, by, [90, 60, 40])
  }
  return g
}

const toCells = (g: Grid, w: number) => {
  const words = new Uint32Array(w * TEXT_ROWS * 3)
  const pack = ([r, gg, b]: RGB) => (Math.round(clamp(r, 0, 255)) << 16) | (Math.round(clamp(gg, 0, 255)) << 8) | Math.round(clamp(b, 0, 255))
  let i = 0
  for (let r = 0; r < TEXT_ROWS; r++) {
    for (let x = 0; x < w; x++) {
      words[i++] = 0x2580
      words[i++] = pack(g[r * 2][x])
      words[i++] = pack(g[r * 2 + 1][x])
    }
  }
  return new Uint8Array(words.buffer).toBase64()
}

const isNight = (ms: number) => {
  const hour = new Date(ms).getHours()
  return hour >= NIGHT_FROM || hour < DAY_FROM
}

export const register: Register = on => {
  let preview: 'day' | 'night' | null = null
  let previewTimer: { cancel: () => void } | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'moon', description: 'Show or hide the day/night scene band' })
    $.clock.every(TICK_MS, () => void update($, frame, n => (n + 1) % 1000000))

    return next(e)
  })

  on('command.run', { command: 'moon' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'day' || arg === 'night') {
      preview = arg
      previewTimer?.cancel()
      previewTimer = $.clock.after(10000, () => {
        preview = null
      })
      await update($, isHidden, () => false)

      return { text: `Preview: ${arg} scene for 10 seconds.` }
    }
    const hidden = await read($, isHidden)
    await update($, isHidden, () => !hidden)

    return { text: hidden ? 'Scene shown.' : 'Scene hidden.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const t = await read($, frame)
    const night = preview ? preview === 'night' : isNight(await $.clock.now())
    const w = Math.max(40, Math.min(180, e.props.bodyColumns))
    const { Raster } = $.ui.resolve(e)
    const cells = toCells(night ? nightScene(w, t) : dayScene(w, t), w)

    return <Raster key="scene" columns={w} rows={TEXT_ROWS} cells={cells} />
  })
}
