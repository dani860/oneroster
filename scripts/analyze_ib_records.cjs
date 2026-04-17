const fs = require('fs')

const filePath = process.argv[2] || 'uploads/phonebook.ib'
const file = fs.readFileSync(filePath)
const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength)

function u32le(off) {
  if (off + 3 >= bytes.length) return 0
  return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
}

function isPrintableCode(code) {
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0x0590 && code <= 0x05ff) ||
    code === 0x40 || code === 0x2b || code === 0x2d || code === 0x2e || code === 0x5f || code === 0x20
  )
}

function extractUtf16StringsFromSlice(slice, minLen = 2) {
  const out = []
  let cur = ''
  for (let i = 0; i + 1 < slice.length; i += 2) {
    const code = slice[i] | (slice[i + 1] << 8)
    if (code === 0 || !isPrintableCode(code)) {
      const t = cur.trim()
      if (t.length >= minLen) out.push(t)
      cur = ''
      continue
    }
    cur += String.fromCharCode(code)
  }
  const t = cur.trim()
  if (t.length >= minLen) out.push(t)
  return out
}

function countAsciiPhoneHits(slice) {
  const str = Buffer.from(slice).toString('latin1')
  const m = str.match(/(?:\+?\d[\d\s\-()]{5,}\d)/g)
  return m ? m.length : 0
}

const declared = u32le(0x2c)
const declared2 = u32le(0x30)
const dataLen = u32le(0x28)
const records = declared > 0 ? declared : 0
const recSize = records > 0 ? Math.floor(dataLen / records) : 0

console.log('header', { declared, declared2, dataLen, fileBytes: bytes.length, recSize })

if (!records || !recSize) process.exit(0)

const base = 0x80
let withUtf16 = 0
let withPhoneText = 0
const commonOffsets = new Map()
const samples = []

for (let r = 0; r < Math.min(records, 40); r++) {
  const start = base + r * recSize
  const end = Math.min(start + recSize, bytes.length)
  if (start >= bytes.length) break
  const slice = bytes.slice(start, end)

  const utf16 = extractUtf16StringsFromSlice(slice, 3)
  const phoneHits = countAsciiPhoneHits(slice)

  if (utf16.length > 0) withUtf16++
  if (phoneHits > 0) withPhoneText++

  for (let i = 0; i + 1 < slice.length; i += 2) {
    const code = slice[i] | (slice[i + 1] << 8)
    if (isPrintableCode(code)) {
      const off = i
      commonOffsets.set(off, (commonOffsets.get(off) || 0) + 1)
    }
  }

  samples.push({ rec: r, start, utf16: utf16.slice(0, 8), phoneHits })
}

const topOffsets = [...commonOffsets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)

console.log(JSON.stringify({
  scannedRecords: samples.length,
  withUtf16,
  withPhoneText,
  topPrintableOffsets: topOffsets,
  samples,
}, null, 2))
