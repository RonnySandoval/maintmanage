import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const payload = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(payload))
  return Buffer.concat([len, payload, crc])
}

function inRoundedRect(px, py, x0, y0, x1, y1, r) {
  if (px >= x0 + r && px <= x1 - r && py >= y0 && py <= y1) return true
  if (px >= x0 && px <= x1 && py >= y0 + r && py <= y1 - r) return true
  const corners = [
    [x0 + r, y0 + r],
    [x1 - r, y0 + r],
    [x0 + r, y1 - r],
    [x1 - r, y1 - r],
  ]
  return corners.some(([cx, cy]) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r)
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const x = x1 + t * dx
  const y = y1 + t * dy
  return Math.hypot(px - x, py - y)
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const teal = [15, 118, 110]
  const tealDark = [13, 92, 86]
  const white = [255, 255, 255]

  const card = {
    x0: size * 0.26,
    y0: size * 0.16,
    x1: size * 0.74,
    y1: size * 0.84,
    r: size * 0.06,
  }
  const clip = {
    x0: size * 0.4,
    y0: size * 0.11,
    x1: size * 0.6,
    y1: size * 0.2,
    r: size * 0.03,
  }

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4
      let [r, g, b] = teal
      const nx = x / size
      const ny = y / size
      if (nx + ny > 1.15) {
        r = tealDark[0]
        g = tealDark[1]
        b = tealDark[2]
      }
      if (inRoundedRect(x, y, card.x0, card.y0, card.x1, card.y1, card.r)) {
        ;[r, g, b] = white
      }
      if (inRoundedRect(x, y, clip.x0, clip.y0, clip.x1, clip.y1, clip.r)) {
        ;[r, g, b] = white
      }
      const w = size * 0.045
      const d1 = distToSegment(x, y, size * 0.36, size * 0.54, size * 0.46, size * 0.66)
      const d2 = distToSegment(x, y, size * 0.46, size * 0.66, size * 0.68, size * 0.38)
      if (d1 <= w || d2 <= w) {
        if (inRoundedRect(x, y, card.x0, card.y0, card.x1, card.y1, card.r)) {
          ;[r, g, b] = teal
        }
      }
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync(join(publicDir, 'pwa-192.png'), makePng(192))
writeFileSync(join(publicDir, 'pwa-512.png'), makePng(512))
writeFileSync(join(publicDir, 'apple-touch-icon.png'), makePng(180))
console.log('Icons written to public/')
