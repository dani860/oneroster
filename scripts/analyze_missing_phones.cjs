const fs = require('fs')

const inFile = process.argv[2] || 'uploads/phonebook.ib'
const b = fs.readFileSync(inFile)
const bytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)

const u32 = (o) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
const u16 = (arr, o) => (arr[o] | (arr[o + 1] << 8))

const cnt = u32(0x2c)
const len = u32(0x28)
const rs = Math.floor(len / cnt)
const base = 0x80

const isPrintable = (c) => ((c >= 0x20 && c <= 0x7e) || (c >= 0x590 && c <= 0x5ff))
const clean = (s) => s.replace(/\s+/g, ' ').trim()

function bestName(slice) {
  let best = { text: '', start: -1 }
  for (let i = 0; i + 1 < slice.length; i += 2) {
    const code = u16(slice, i)
    if (code < 0x590 || code > 0x5ff) continue

    let t = ''
    for (let j = i; j + 1 < slice.length; j += 2) {
      const c = u16(slice, j)
      if (c === 0 || c === 0xffff || !isPrintable(c)) break
      t += String.fromCharCode(c)
    }

    t = clean(t)
    if (t.length > best.text.length) best = { text: t, start: i }
  }
  return best
}

const readRecordByte = (slice, off) => slice[((off % rs) + rs) % rs]

function decodePhone(slice, start, byteLen = 5) {
  let digits = ''
  for (let i = 0; i < byteLen; i++) {
    const v = readRecordByte(slice, start + i)
    const lo = v & 0x0f
    const hi = (v >> 4) & 0x0f

    if (lo > 9) break
    digits += String(lo)
    if (hi > 9) break
    digits += String(hi)
  }

  return digits
}

function plausiblePhone(v) {
  if (!v || /^0+$/.test(v) || /^0+1?0+$/.test(v)) return false
  return /^05\d{8}$/.test(v) || /^0[2-9]\d{7,9}$/.test(v) || /^972\d{8,11}$/.test(v)
}

const results = []
for (let r = 0; r < cnt; r++) {
  const s = base + r * rs
  if (s + rs > bytes.length) break

  const slice = bytes.slice(s, s + rs)
  const name = bestName(slice)
  if (!name.text) continue

  const lenOff = name.start - 2
  const expectedPhone = lenOff >= 0 ? decodePhone(slice, lenOff - 64) : ''
  const expectedOk = plausiblePhone(expectedPhone)

  let nearby = null
  for (let delta = -16; delta <= 16 && !nearby; delta++) {
    const candidate = decodePhone(slice, lenOff - 64 + delta)
    if (plausiblePhone(candidate)) {
      nearby = { delta, phone: candidate }
    }
  }

  let anywhere = null
  if (!expectedOk && !nearby) {
    for (let off = 0; off < rs && !anywhere; off++) {
      const candidate = decodePhone(slice, off)
      if (plausiblePhone(candidate)) {
        anywhere = { off, phone: candidate }
      }
    }
  }

  results.push({
    rec: r,
    name: name.text,
    expectedPhone,
    expectedOk,
    nearby,
    anywhere,
  })
}

const noPhone = results.filter((row) => !row.expectedOk)
const summary = {
  totalNamed: results.length,
  withPhoneAtExpectedOffset: results.filter((row) => row.expectedOk).length,
  missingAtExpectedOffset: noPhone.length,
  recoverableNearby: noPhone.filter((row) => row.nearby).length,
  recoverableElsewhere: noPhone.filter((row) => !row.nearby && row.anywhere).length,
  likelyNoPhoneInRecord: noPhone.filter((row) => !row.nearby && !row.anywhere).length,
  samplesNearby: noPhone.filter((row) => row.nearby).slice(0, 20),
  samplesElsewhere: noPhone.filter((row) => !row.nearby && row.anywhere).slice(0, 20),
  samplesNoPhone: noPhone.filter((row) => !row.nearby && !row.anywhere).slice(0, 20),
}

console.log(JSON.stringify(summary, null, 2))