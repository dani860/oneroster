const fs = require('fs')

const filePath = process.argv[2] || 'uploads/phonebook.ib'
const recIndex = Number(process.argv[3] || 8)
const buf = fs.readFileSync(filePath)
const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

function u32le(off) {
  return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
}

const count = u32le(0x2c)
const dataLen = u32le(0x28)
const recSize = Math.floor(dataLen / count)
const base = 0x80

const start = base + recIndex * recSize
const end = Math.min(start + recSize, bytes.length)
const slice = bytes.slice(start, end)

function isPrintableCode(code) {
  return (code >= 0x20 && code <= 0x7e) || (code >= 0x0590 && code <= 0x05ff)
}

const pairs = []
for (let i = 0; i + 1 < slice.length; i += 2) {
  const code = slice[i] | (slice[i + 1] << 8)
  if (code !== 0) {
    pairs.push({ off: i, code, hex: '0x' + code.toString(16), ch: isPrintableCode(code) ? String.fromCharCode(code) : '' })
  }
}

console.log(JSON.stringify({ recIndex, start, recSize, nonZeroPairs: pairs.length, first200Pairs: pairs.slice(0, 200) }, null, 2))
