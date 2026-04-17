const fs = require('fs')

const filePath = process.argv[2] || 'uploads/phonebook.ib'
const buf = fs.readFileSync(filePath)
const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

function isLikelyPrintableCodePoint(code) {
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0x0590 && code <= 0x05ff) ||
    code === 0x40 ||
    code === 0x2b ||
    code === 0x2d ||
    code === 0x2e ||
    code === 0x5f ||
    code === 0x20
  )
}

function sanitizePhoneValue(raw) {
  return String(raw)
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^(?:uri:)?tel:/i, '')
    .trim()
}

function looksLikePhone(value) {
  return /\d{3,}/.test(value)
}

function extractUtf16LeNullTerminatedChunks(bufferBytes) {
  const chunks = []
  let current = ''
  let start = 0

  for (let i = 0; i + 1 < bufferBytes.length; i += 2) {
    const code = bufferBytes[i] | (bufferBytes[i + 1] << 8)

    if (code === 0x0000) {
      const text = current.trim()
      if (text.length >= 2) chunks.push({ offset: start, text })
      current = ''
      continue
    }

    if (!isLikelyPrintableCodePoint(code)) {
      if (current.trim().length >= 2) chunks.push({ offset: start, text: current.trim() })
      current = ''
      continue
    }

    if (!current) start = i
    current += String.fromCharCode(code)
  }

  if (current.trim().length >= 2) chunks.push({ offset: start, text: current.trim() })
  return chunks
}

function cleanNameCandidate(value) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/(?:\+?\d[\d\s\-()]{5,}\d)/g, ' ')
    .replace(/[\\/|,:;]+/g, ' ')
    .replace(/[_\-]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGoodNameCandidate(value) {
  if (!value) return false
  if (value.length < 2 || value.length > 60) return false
  if (/backup|contacts?|phonebook|header|ibphone|nokia|\.in$|\.ib$/i.test(value)) return false
  if (/^[\d\W_]+$/.test(value)) return false
  if (!/[A-Za-z\u0590-\u05FF]/.test(value)) return false
  return true
}

function splitStructuredName(value) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) return { firstName: '', lastName: '' }
  const parts = cleaned.split(' ')
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

const chunks = extractUtf16LeNullTerminatedChunks(bytes)
const phoneRe = /(?:\+?\d[\d\s\-()]{5,}\d)/g
const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig

const names = []
const phones = []
const emails = []

for (const chunk of chunks) {
  const text = chunk.text

  const pm = [...text.matchAll(phoneRe)]
  for (const m of pm) {
    const phone = sanitizePhoneValue(m[0])
    if (looksLikePhone(phone)) phones.push({ offset: chunk.offset + (m.index || 0) * 2, phone })
  }

  const em = [...text.matchAll(emailRe)]
  for (const m of em) {
    const email = String(m[0] || '').trim()
    if (email) emails.push({ offset: chunk.offset + (m.index || 0) * 2, email })
  }

  const cleaned = cleanNameCandidate(text)
  if (isGoodNameCandidate(cleaned)) names.push({ offset: chunk.offset, text: cleaned })
}

const anchors = []
const proximity = 200
function attach(offset) {
  let anchor = anchors.find(item => Math.abs(item.offset - offset) <= proximity)
  if (!anchor) {
    anchor = { offset, phones: new Set(), emails: new Set(), name: '' }
    anchors.push(anchor)
  }
  return anchor
}

for (const p of phones) attach(p.offset).phones.add(p.phone)
for (const e of emails) attach(e.offset).emails.add(e.email)

for (const anchor of anchors) {
  const nearby = names
    .filter(name => Math.abs(name.offset - anchor.offset) <= 260)
    .sort((a, b) => Math.abs(a.offset - anchor.offset) - Math.abs(b.offset - anchor.offset))
  if (nearby.length > 0) anchor.name = nearby[0].text
}

const contacts = anchors
  .map(anchor => {
    const split = splitStructuredName(anchor.name || '')
    return {
      name: anchor.name || '',
      firstName: split.firstName,
      lastName: split.lastName,
      phones: [...anchor.phones],
      emails: [...anchor.emails],
    }
  })
  .filter(c => c.phones.length > 0 || c.emails.length > 0)

const uniquePhones = new Set()
for (const c of contacts) {
  for (const p of c.phones) uniquePhones.add(p.replace(/[\s\-()]/g, ''))
}

console.log(JSON.stringify({
  filePath,
  fileBytes: buf.length,
  utf16Chunks: chunks.length,
  nameCandidates: names.length,
  phoneHits: phones.length,
  emailHits: emails.length,
  contactAnchors: anchors.length,
  contactsWithData: contacts.length,
  uniquePhones: uniquePhones.size,
  sample: contacts.slice(0, 10),
}, null, 2))
