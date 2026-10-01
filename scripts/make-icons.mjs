// Generate PNG icons for PWA without external deps
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// Encode RGBA pixel buffer to PNG
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// Simple software rasterizer: rounded-rect mask + shapes
function drawIcon(S) {
  const px = Buffer.alloc(S * S * 4)

  const setPx = (x, y, r, g, b, a) => {
    const i = (y * S + x) * 4
    // source-over alpha blend
    const na = a / 255 + (px[i + 3] / 255) * (1 - a / 255)
    if (na <= 0) return
    px[i] = Math.round((r * a + px[i] * (255 - a)) / 255)
    px[i + 1] = Math.round((g * a + px[i + 1] * (255 - a)) / 255)
    px[i + 2] = Math.round((b * a + px[i + 2] * (255 - a)) / 255)
    px[i + 3] = Math.round(na * 255)
  }

  const inRoundRect = (x, y, rx, ry, rw, rh, rad) => {
    if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false
    const cx = Math.max(rx + rad, Math.min(x, rx + rw - 1 - rad))
    const cy = Math.max(ry + rad, Math.min(y, ry + rh - 1 - rad))
    const dx = x - cx, dy = y - cy
    return dx * dx + dy * dy < rad * rad
  }

  // background #0f172a rounded 22%
  const rad = S * 0.22
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (inRoundRect(x, y, 0, 0, S, S, rad)) setPx(x, y, 15, 23, 42, 255)
    }
  }

  const u = S / 512 // unit scale from 512 design
  const rect = (rx, ry, rw, rh, r, g, b, a = 255, corner = 0) => {
    const x0 = Math.round(rx * u), y0 = Math.round(ry * u)
    const x1 = Math.round((rx + rw) * u), y1 = Math.round((ry + rh) * u)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (corner > 0 ? inRoundRect(x, y, x0, y0, x1 - x0, y1 - y0, corner * u) : true) setPx(x, y, r, g, b, a)
  }

  // machine body
  rect(104, 128, 304, 216, 30, 41, 59, 255, 24)
  // stroke ring (approx by drawing lighter border)
  rect(104, 128, 304, 8, 99, 102, 241)
  rect(104, 336, 304, 8, 99, 102, 241)
  rect(104, 128, 8, 216, 99, 102, 241)
  rect(400, 128, 8, 216, 99, 102, 241)
  // screen
  rect(152, 176, 208, 72, 99, 102, 241, 90)
  // details
  rect(152, 272, 88, 24, 129, 140, 248)
  rect(152, 300, 56, 24, 71, 85, 105)
  // money green
  rect(256, 272, 104, 52, 34, 197, 94, 255, 14)
  // drawer
  rect(200, 372, 112, 18, 71, 85, 105)

  return encodePNG(S, S, px)
}

writeFileSync('public/icon-192.png', drawIcon(192))
writeFileSync('public/icon-512.png', drawIcon(512))
writeFileSync('public/apple-touch-icon.png', drawIcon(180))
console.log('icons generated: public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png')
