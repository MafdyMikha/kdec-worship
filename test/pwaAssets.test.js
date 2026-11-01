import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { APP_ICONS } from '../src/assets/appIcons.js'
import { inflateSync } from 'node:zlib'

const readPublic = path => readFileSync(new URL(`../public/${path}`, import.meta.url))
const manifest = JSON.parse(readPublic('manifest.webmanifest'))

// Decode these non-interlaced RGB/RGBA PNG assets without a runtime dependency.
function png(path) {
  const file = readPublic(path)
  assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  const width = file.readUInt32BE(16), height = file.readUInt32BE(20)
  assert.equal(file[24], 8, '8-bit PNG')
  const channels = file[25] === 2 ? 3 : file[25] === 6 ? 4 : 0
  assert.ok(channels, 'RGB or RGBA PNG')
  assert.equal(file[28], 0, 'non-interlaced PNG')
  const data = []
  for (let offset = 8; offset < file.length;) {
    const size = file.readUInt32BE(offset)
    if (file.toString('ascii', offset + 4, offset + 8) === 'IDAT') data.push(file.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    assert.ok(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x
      const a = x >= channels ? pixels[i - channels] : 0
      const b = y ? pixels[i - stride] : 0
      const c = y && x >= channels ? pixels[i - stride - channels] : 0
      const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255
    }
  }
  return { width, height, channels, pixels }
}

test('manifest preserves the installed identity, calendar start and standalone display', () => {
  assert.equal(manifest.id, '/')
  assert.equal(manifest.name, 'KDEC Worship')
  assert.equal(manifest.short_name, 'KDEC Worship')
  assert.equal(manifest.start_url, '/schedule')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.prefer_related_applications, false)
  for (const size of [192, 512]) assert.ok(manifest.icons.some(icon => icon.sizes === `${size}x${size}` && icon.purpose === 'any'))
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
})

test('every manifest icon and the Apple touch icon has correct dimensions and an opaque navy background', () => {
  const icons = [...manifest.icons, { src: APP_ICONS.apple180, sizes: '180x180' }]
  for (const icon of icons) {
    const asset = png(new URL(icon.src, 'https://kdec.test').pathname.slice(1))
    assert.equal(`${asset.width}x${asset.height}`, icon.sizes)
    assert.deepEqual([...asset.pixels.subarray(0, 3)], [16, 25, 35])
    let ivoryPixels = 0
    for (let i = 0; i < asset.pixels.length; i += asset.channels) {
      if (asset.pixels[i] >= 240 && asset.pixels[i + 1] >= 240 && asset.pixels[i + 2] >= 235) ivoryPixels++
    }
    assert.ok(ivoryPixels > asset.width * asset.height * .02, 'ivory tower must remain visible against navy')
    if (asset.channels === 4) {
      for (let i = 3; i < asset.pixels.length; i += 4) assert.equal(asset.pixels[i], 255)
    }
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.ok(html.includes(`rel="apple-touch-icon" sizes="180x180" href="${APP_ICONS.apple180}"`))
})

test('all maskable artwork fits inside the central 80 percent safe circle', () => {
  const icon = manifest.icons.find(icon => icon.purpose === 'maskable')
  const { width, height, channels, pixels } = png(new URL(icon.src, 'https://kdec.test').pathname.slice(1))
  let artworkPixels = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (pixels[i] === 16 && pixels[i + 1] === 25 && pixels[i + 2] === 35) continue
      artworkPixels++
      assert.ok(Math.hypot(x + .5 - width / 2, y + .5 - height / 2) <= width * .4, `artwork clipped at ${x},${y}`)
    }
  }
  assert.ok(artworkPixels > width * height * .015, 'the icon contains visible artwork')
})


test('installation previews and metadata reference fresh icon files with the full wordmark', () => {
  assert.equal(manifest.icons.find(icon => icon.sizes === '192x192').src, APP_ICONS.app192)
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.ok(html.includes(`href="${APP_ICONS.favicon}"`))
  // Keep the manifest's discovery URL stable for previously installed apps.
  assert.ok(html.includes('href="/manifest.webmanifest?v=pwa4"'))
  for (const icon of [...manifest.icons, { src: APP_ICONS.apple180 }]) {
    assert.ok(icon.src.startsWith('/icons/') && !icon.src.includes('?'))
    const { width, height, channels, pixels } = png(icon.src.slice(1))
    let bands = 0, inBand = false
    for (let y = 0; y < height; y++) {
      let visible = false
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels
        if (pixels[i] > 140 && pixels[i + 1] > 140 && pixels[i + 2] > 140) { visible = true; break }
      }
      if (visible && !inBand) bands++
      inBand = visible
    }
    // The tower, KDEC and WORSHIP form three separated tiers; tower-only fails.
    assert.ok(bands >= 3, `${icon.src} is missing the full wordmark`)
  }
})
