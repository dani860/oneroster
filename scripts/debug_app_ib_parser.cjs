const fs = require('fs')

const inFile = process.argv[2] || 'uploads/phonebook.ib'
const b = fs.readFileSync(inFile)
const bytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)

function sanitizePhoneValue(raw) {
  return raw.trim().replace(/^"|"$/g, '').replace(/^(?:uri:)?tel:/i, '').trim()
}

function looksLikePhone(value) {
  return /\d{3,}/.test(value)
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
  if (/backup|contacts?|phonebook|header|ibphone|\.in$|\.ib$/i.test(value)) return false
  if (!/[A-Za-z\u0590-\u05FF]/.test(value)) return false
  return true
}

function formatNameDisplay(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(' ').trim()
}

function splitStructuredName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function normalizeNameForMatch(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function isWeakImportedContact(contact) {
  const name = (contact.name || '').trim()
  const hasPhoneOrEmail = (contact.phones?.length ?? 0) > 0 || (contact.emails?.length ?? 0) > 0
  if (hasPhoneOrEmail) return false
  if (!name) return true
  if (/[\\/]/.test(name)) return true
  if (/backup|contacts?|phonebook|header|ibphone|\.in$|\.ib$/i.test(name)) return true
  if (name.length <= 2) return true
  return false
}

function normalizeImportedContacts(contacts, options) {
  const keepNameOnly = options?.keepNameOnly ?? false
  const dedup = new Map()

  contacts.forEach(contact => {
    const normalized = {
      ...contact,
      name: (contact.name || formatNameDisplay(contact.firstName, contact.lastName)).trim(),
      firstName: (contact.firstName || '').trim(),
      lastName: (contact.lastName || '').trim(),
      phones: [...new Set((contact.phones || []).map(sanitizePhoneValue).filter(looksLikePhone))],
      emails: [...new Set((contact.emails || []).map(e => e.trim()).filter(Boolean))],
      source: (contact.source || '').trim(),
    }

    if (isWeakImportedContact(normalized) && !(keepNameOnly && normalized.name)) return

    const key = [
      normalizeNameForMatch(normalized.name || formatNameDisplay(normalized.firstName, normalized.lastName)),
      normalized.phones.join('|'),
      normalized.emails.join('|'),
    ].join('::')

    if (!dedup.has(key)) dedup.set(key, normalized)
  })

  return [...dedup.values()]
}

function readUint32LE(bytes, offset) {
  if (offset + 3 >= bytes.length) return 0
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function detectDeclaredContactCount() {
  const c1 = readUint32LE(bytes, 0x2c)
  const c2 = readUint32LE(bytes, 0x30)
  if (c1 > 0 && c1 < 100000 && c1 === c2) return c1
  const alt = readUint32LE(bytes, 0x24)
  if (alt > 0 && alt < 100000) return alt
  return null
}

function parseNokiaFixedRecordNames() {
  const declared = detectDeclaredContactCount()
  const dataLen = readUint32LE(bytes, 0x28)
  const recSize = Math.floor(dataLen / declared)
  const base = 0x80
  const contacts = []

  const readRecordByte = (slice, off) => slice[((off % recSize) + recSize) % recSize]

  const findBestNameInRecord = (slice) => {
    let best = { text: '', start: -1 }
    for (let i = 0; i + 1 < slice.length; i += 2) {
      const code = slice[i] | (slice[i + 1] << 8)
      if (code < 0x0590 || code > 0x05ff) continue
      let candidate = ''
      for (let j = i; j + 1 < slice.length; j += 2) {
        const c = slice[j] | (slice[j + 1] << 8)
        const printable = ((c >= 0x20 && c <= 0x7e) || (c >= 0x0590 && c <= 0x05ff))
        if (!printable || c === 0 || c === 0xffff) break
        candidate += String.fromCharCode(c)
      }
      const cleaned = cleanNameCandidate(candidate)
      if (isGoodNameCandidate(cleaned) && cleaned.length > best.text.length) best = { text: cleaned, start: i }
    }
    return best
  }

  const decodeNokiaPackedPhone = (slice, start, byteLen = 5) => {
    let digits = ''
    let done = false
    for (let i = 0; i < byteLen && !done; i++) {
      const v = readRecordByte(slice, start + i)
      const lo = v & 0x0f
      const hi = (v >> 4) & 0x0f
      if (lo > 9) { done = true; break }
      digits += String(lo)
      if (hi > 9) { done = true; break }
      digits += String(hi)
    }
    return digits.trim()
  }

  const looksLikeRecoveredPhone = (value) => {
    if (!value || value.length < 8 || value.length > 12) return false
    if (/^0+$/.test(value)) return false
    return /^05\d{8}$/.test(value) || /^0[2-9]\d{7,9}$/.test(value) || /^972\d{8,11}$/.test(value)
  }

  const recoverPhoneNearName = (slice, nameStart) => {
    const expectedStart = nameStart - 2 - 64
    const exact = decodeNokiaPackedPhone(slice, expectedStart)
    if (looksLikeRecoveredPhone(exact)) return exact
    for (let step = 1; step <= 16; step++) {
      const before = decodeNokiaPackedPhone(slice, expectedStart - step)
      if (looksLikeRecoveredPhone(before)) return before
      const after = decodeNokiaPackedPhone(slice, expectedStart + step)
      if (looksLikeRecoveredPhone(after)) return after
    }
    return ''
  }

  for (let r = 0; r < declared; r++) {
    const start = base + r * recSize
    if (start + recSize > bytes.length) break
    const slice = bytes.slice(start, start + recSize)
    const bestName = findBestNameInRecord(slice)
    if (!bestName.text || bestName.start < 0) continue
    const recoveredPhone = recoverPhoneNearName(slice, bestName.start)
    const phones = looksLikeRecoveredPhone(recoveredPhone) ? [recoveredPhone] : []
    const split = splitStructuredName(bestName.text)
    contacts.push({
      id: String(r),
      name: formatNameDisplay(split.firstName, split.lastName) || bestName.text,
      firstName: split.firstName,
      lastName: split.lastName,
      phones,
      emails: [],
      source: inFile,
    })
  }

  return normalizeImportedContacts(contacts, { keepNameOnly: true })
}

const contacts = parseNokiaFixedRecordNames()
console.log(JSON.stringify({ count: contacts.length, sample: contacts.slice(0, 20) }, null, 2))