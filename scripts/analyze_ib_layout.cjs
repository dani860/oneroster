const fs = require('fs')

const filePath = process.argv[2] || 'uploads/phonebook.ib'
const buf = fs.readFileSync(filePath)
const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

function u32le(off) {
  return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
}

const count = u32le(0x2c)
const dataLen = u32le(0x28)
const recSize = Math.floor(dataLen / count)
const base = 0x80

const stats = Array.from({ length: recSize }, () => ({ nonZero: 0, bcdish: 0, ff: 0, sameAsPrev: 0 }))

function isBcdLikeByte(v) {
  const lo = v & 0x0f
  const hi = (v >> 4) & 0x0f
  const okNib = (n) => n <= 9 || n === 0x0f
  return okNib(lo) && okNib(hi)
}

let scanned = 0
for (let r = 0; r < count; r++) {
  const start = base + r * recSize
  if (start + recSize > bytes.length) break
  scanned++
  for (let i = 0; i < recSize; i++) {
    const v = bytes[start + i]
    if (v !== 0) stats[i].nonZero++
    if (v === 0xff) stats[i].ff++
    if (isBcdLikeByte(v)) stats[i].bcdish++
    if (r > 0 && bytes[start + i] === bytes[start - recSize + i]) stats[i].sameAsPrev++
  }
}

const candidates = []
for (let i = 0; i < recSize; i++) {
  const s = stats[i]
  const nz = s.nonZero / scanned
  const bcd = s.bcdish / scanned
  const stable = s.sameAsPrev / Math.max(1, scanned - 1)
  if (nz > 0.15 && bcd > 0.88 && stable < 0.95) {
    candidates.push({ off: i, nz: +nz.toFixed(3), bcd: +bcd.toFixed(3), stable: +stable.toFixed(3) })
  }
}

const ranges = []
let cur = null
for (const c of candidates) {
  if (!cur || c.off !== cur.end + 1) {
    if (cur) ranges.push(cur)
    cur = { start: c.off, end: c.off, len: 1 }
  } else {
    cur.end = c.off
    cur.len++
  }
}
if (cur) ranges.push(cur)

console.log(JSON.stringify({
  filePath,
  count,
  recSize,
  scanned,
  candidateByteCount: candidates.length,
  topCandidates: candidates.slice(0, 120),
  contiguousRanges: ranges,
}, null, 2))
