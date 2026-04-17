const fs = require('fs')

const filePath = process.argv[2] || 'uploads/phonebook.ib'
const file = fs.readFileSync(filePath)
const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength)

function u32le(off) {
  return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
}

function u16le(buf, off) {
  return (buf[off] | (buf[off + 1] << 8)) >>> 0
}

function isPrintableCode(code) {
  return (code >= 0x20 && code <= 0x7e) || (code >= 0x0590 && code <= 0x05ff)
}

function bestHebrewName(slice) {
  let best = { text: '', start: -1, lenWord: -1 }
  for (let i = 0; i + 1 < slice.length; i += 2) {
    const c = u16le(slice, i)
    if (c < 0x0590 || c > 0x05ff) continue
    let t = ''
    for (let j = i; j + 1 < slice.length; j += 2) {
      const cc = u16le(slice, j)
      if (cc === 0 || cc === 0xffff || !isPrintableCode(cc)) break
      t += String.fromCharCode(cc)
    }
    const cleaned = t.replace(/\s+/g, ' ').trim()
    if (cleaned.length > best.text.length) {
      best = { text: cleaned, start: i, lenWord: i - 2 }
    }
  }
  return best
}

function decodeSemiOctet(slice, start, byteLen) {
  let out = ''
  for (let i = 0; i < byteLen && start + i < slice.length; i++) {
    const b = slice[start + i]
    const lo = b & 0x0f
    const hi = (b >> 4) & 0x0f
    if (lo <= 9) out += String(lo)
    else if (lo !== 0xf) return ''
    if (hi <= 9) out += String(hi)
    else if (hi !== 0xf) return ''
  }
  return out
}

function plausiblePhone(s) {
  if (!s || s.length < 8 || s.length > 14) return false
  if (/^0+$/.test(s)) return false
  return /^0\d{8,10}$/.test(s) || /^05\d{8}$/.test(s) || /^972\d{8,11}$/.test(s)
}

const declared = u32le(0x2c)
const dataLen = u32le(0x28)
const recSize = Math.floor(dataLen / declared)
const base = 0x80

const interesting = []
for (let r = 0; r < Math.min(declared, 120); r++) {
  const recStart = base + r * recSize
  if (recStart + recSize > bytes.length) break
  const slice = bytes.slice(recStart, recStart + recSize)
  const name = bestHebrewName(slice)
  if (!name.text) continue

  const words = []
  for (let off = 0; off + 1 < recSize; off += 2) {
    const v = u16le(slice, off)
    if (v !== 0) words.push({ off, v })
  }

  const around = words.filter(w => w.off >= Math.max(0, name.start - 120) && w.off <= name.start + 24)

  const phoneCandidates = []
  for (let off = Math.max(0, name.start - 180); off < name.start; off++) {
    for (let n = 4; n <= 8; n++) {
      const d = decodeSemiOctet(slice, off, n)
      if (plausiblePhone(d)) {
        phoneCandidates.push({ off, n, d })
      }
    }
  }

  interesting.push({
    rec: r,
    name: name.text,
    nameStart: name.start,
    nameLenWordOff: name.lenWord,
    nameLenWordVal: name.lenWord >= 0 ? u16le(slice, name.lenWord) : 0,
    around,
    phoneCandidates: phoneCandidates.slice(0, 8),
  })
}

console.log(JSON.stringify({ declared, recSize, sample: interesting.slice(0, 30) }, null, 2))
