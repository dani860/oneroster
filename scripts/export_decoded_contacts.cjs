const fs = require('fs')

const inFile = process.argv[2] || 'uploads/phonebook.ib'
const outTxt = process.argv[3] || 'uploads/decoded_contacts_with_phones.txt'
const outCsv = process.argv[4] || 'uploads/decoded_contacts_with_phones.csv'

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

    if (lo > 9) break  // 0xF = Nokia BCD terminator, stop here
    digits += String(lo)
    if (hi > 9) break
    digits += String(hi)
  }

  return digits
}

function plausiblePhone(v) {
  return /^05\d{8}$/.test(v) || /^0\d{8,10}$/.test(v) || /^972\d{8,11}$/.test(v)
}

const rows = []
for (let r = 0; r < cnt; r++) {
  const s = base + r * rs
  if (s + rs > bytes.length) break

  const slice = bytes.slice(s, s + rs)
  const name = bestName(slice)
  if (!name.text) continue

  const lenOff = name.start - 2
  const phoneRaw = lenOff >= 0 ? decodePhone(slice, lenOff - 64) : ''
  const phone = plausiblePhone(phoneRaw) ? phoneRaw : ''

  rows.push({ rec: r, name: name.text, phone })
}

const withPhone = rows.filter((x) => x.phone).length

const txtLines = [
  '# extracted contacts (read-only)',
  '# declared records: ' + cnt,
  '# extracted names: ' + rows.length,
  '# extracted phones: ' + withPhone,
  '',
  '# rec\tname\tphone',
]

for (const row of rows) {
  txtLines.push(String(row.rec).padStart(4, '0') + '\t' + row.name + '\t' + (row.phone || ''))
}

fs.writeFileSync(outTxt, txtLines.join('\n'), 'utf8')

const csvRows = ['"rec","name","phone"']
for (const row of rows) {
  const rec = String(row.rec).replace(/"/g, '""')
  const name = String(row.name).replace(/"/g, '""')
  const phone = String(row.phone || '').replace(/"/g, '""')
  csvRows.push('"' + rec + '","' + name + '","' + phone + '"')
}

fs.writeFileSync(outCsv, '\uFEFF' + csvRows.join('\n'), 'utf8')

console.log(JSON.stringify({
  declared: cnt,
  recordSize: rs,
  rows: rows.length,
  withPhone,
  withoutPhone: rows.length - withPhone,
  outTxt,
  outCsv,
  sampleWithPhone: rows.filter((r) => r.phone).slice(0, 15),
}, null, 2))
