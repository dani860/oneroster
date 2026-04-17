import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'

/* ── Types ─────────────────────────────────────────────── */
interface Contact {
  id: string
  name: string
  firstName: string
  lastName: string
  phones: string[]
  emails: string[]
  source: string
  rev?: string
  notes?: string
}

interface DuplicateGroup {
  groupId: string
  reasons: string[]
  contacts: Contact[]
}

interface RecommendationCleanupGroup {
  groupId: string
  reasons: string[]
  kept: Contact[]
  deleted: Contact[]
}

interface RecommendationCleanupResult {
  groups: RecommendationCleanupGroup[]
  keptCount: number
  deletedCount: number
}

type NameFixModule = 'spacing' | 'dictionary' | 'dictionaryNames' | 'vocabulary' | 'oneKnown'
type NameFixResultMode = 'all' | 'single' | 'multiple'
type NameFixStarFilter = 0 | 1 | 2 | 3 | 4 | 5

interface NameFixSuggestion {
  key: string
  contactId: string
  contactName: string
  field: 'firstName' | 'lastName'
  original: string
  suggested: string
  module: NameFixModule
  reason: string
  confidence: number
}

interface VcfParseResult {
  contacts: Contact[]
  cardsDetected: number
  cardsParsed: number
}

interface ImportTelemetry {
  startedAt: string
  mode: 'replace' | 'append'
  files: string[]
  details: string[]
}

type NameEditIssueType = 'hasDigits' | 'hasWeirdChars' | 'hasExtraSpaces' | 'hasRomanNumerals' | 'hasSymbols' | 'hasSpecialChars'

interface ManualEditIssue {
  contactId: string
  firstName: string
  lastName: string
  fullName: string
  issueTypes: NameEditIssueType[]
  severity: number // 1-5 based on total issues
}

interface ParsedImportBatch {
  contacts: Contact[]
  failed: number
  parseErrors: number
  importedFiles: number
}

interface ImportFileSummary {
  name: string
  contacts: number
  details: string
}

interface OffsetStringChunk {
  offset: number
  text: string
  stride: 1 | 2
}

interface BulkEditContactValues {
  firstName: string
  lastName: string
  phonesText: string
  emailsText: string
}

/* ── Constants ──────────────────────────────────────────── */
const STORAGE_KEY = 'contacts-manager-state-v4'
const GITHUB_REPO_URL = 'https://github.com/dani860/oneroster'
const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`
const GITHUB_INSTALLER_URL = `${GITHUB_REPO_URL}/releases/latest/download/OneRoster-Installer-x64.exe`
const GITHUB_PORTABLE_URL = `${GITHUB_REPO_URL}/releases/latest/download/OneRoster-Portable-x64.rar`
const GITHUB_SOURCE_URL = `${GITHUB_REPO_URL}/archive/refs/heads/main.zip`
const GITHUB_EDIT_URL = 'https://github.dev/dani860/oneroster'
const NAME_FIX_MODULE_OPTIONS: Array<{ id: NameFixModule; label: string }> = [
  { id: 'spacing', label: 'ניקוי רווחים' },
  { id: 'dictionary', label: 'מילון מלא' },
  { id: 'dictionaryNames', label: 'מילון שמות' },
  { id: 'vocabulary', label: 'שימוש חוזר ברשימה' },
]
const NAME_FIX_RESULT_MODE_OPTIONS: Array<{ id: NameFixResultMode; label: string }> = [
  { id: 'all', label: 'כל התוצאות' },
  { id: 'single', label: 'תוצאה אחת' },
  { id: 'multiple', label: 'תוצאות מרובות' },
]
const NAME_FIX_STAR_FILTER_OPTIONS: Array<{ id: NameFixStarFilter; label: string }> = [
  { id: 0, label: 'כל הדירוגים' },
  { id: 5, label: '5★' },
  { id: 4, label: '4★ ומעלה' },
  { id: 3, label: '3★ ומעלה' },
  { id: 2, label: '2★ ומעלה' },
  { id: 1, label: '1★ ומעלה' },
]

function confidenceToStars(confidence: number): 1 | 2 | 3 | 4 | 5 {
  if (confidence >= 0.96) return 5
  if (confidence >= 0.9) return 4
  if (confidence >= 0.82) return 3
  if (confidence >= 0.74) return 2
  return 1
}

function starsLabel(stars: number): string {
  return `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 5 - stars))}`
}

const COMMON_HE_FIRST_NAMES = new Set([
  'אהרון', 'אהובה', 'אבי', 'אביעד', 'אביעזר', 'אביגדור', 'אביגיל', 'אביטל', 'אברהם', 'אדם', 'אדל', 'אדר',
  'אודי', 'אודליה', 'אוהד', 'אופיר', 'אור', 'אורה', 'אוראל', 'אורטל', 'אוריה', 'אורית',
  'אורלי', 'אורן', 'אושרי', 'איל', 'אילן', 'אילנה', 'איתן', 'איתי', 'אלון', 'אלונה',
  'אלחנן', 'אליאב', 'אליאור', 'אליעזר', 'אלירן', 'אלישבע', 'אמיר', 'אמירה', 'אמיתי', 'אסף',
  'אסתר', 'אפרת', 'ארז', 'אריה', 'אריאל', 'ארנון', 'בתאל', 'בר', 'ברוך', 'ברכה',
  'גבריאל', 'גדי', 'גולן', 'גיא', 'גילה', 'גלית', 'גליה', 'גפן', 'גרשון', 'דבורה',
  'דביר', 'דגן', 'דוד', 'דור', 'דורון', 'דיאנה', 'דינה', 'דליה', 'דן', 'דניאל',
  'דניאלה', 'דני', 'דניס', 'הדר', 'הילה', 'הלל', 'הראל', 'ורד', 'ויולטה', 'זאב',
  'זהבה', 'זוהר', 'זלמן', 'חגית', 'חיים', 'חן', 'חנה', 'חני', 'חוה', 'חיים',
  'טובה', 'טל', 'טליה', 'יואב', 'יואל', 'יובל', 'יוגב', 'יוחאי', 'יונתן', 'יוני',
  'יוסף', 'יוסי', 'יקיר', 'ירון', 'ירין', 'ישעיהו', 'ישראל', 'יצחק', 'יקי', 'יעל',
  'יעקב', 'יפה', 'יפעת', 'ירדן', 'כפיר', 'לאה', 'לביא', 'לוטם', 'ליאור', 'ליאורה',
  'ליאל', 'ליה', 'ליהיא', 'לימור', 'לינוי', 'ליעד', 'לירון', 'מאיה', 'מאיר', 'מאירב',
  'מיכאל', 'מיכל', 'מילה', 'מינה', 'מירב', 'מירי', 'מלכה', 'מנחם', 'מנור', 'מרדכי',
  'מרים', 'משה', 'מתן', 'מתניה', 'נועה', 'נועם', 'נטע', 'נח', 'נחום', 'ניב', 'נילי',
  'ניר', 'ניצן', 'נעמי', 'סהר', 'סיוון', 'סיגל', 'סימה', 'סמדר', 'סעדיה', 'עדי',
  'עדיאל', 'עדינה', 'עוז', 'עומר', 'עומרי', 'עופרה', 'עידו', 'עילאי', 'עליזה', 'עלי',
  'עמוס', 'עמרם', 'עמיחי', 'עמית', 'ענבל', 'ענת', 'ערן', 'פנינה', 'פרידה', 'צבי', 'צביה',
  'צופית', 'צחי', 'ציפי', 'קובי', 'קורל', 'ראובן', 'רבקה', 'רות', 'רועי', 'רון',
  'רונה', 'רוני', 'רונית', 'רחל', 'רינה', 'רם', 'שגב', 'שולה', 'שחר', 'שי',
  'שילה', 'שיר', 'שירה', 'שלמה', 'שמואל', 'שני', 'שרה', 'תאיר', 'תהל', 'תהילה',
  'תומר', 'תמר', 'תמיר',
])
const COMMON_HE_LAST_NAMES = new Set([
  'אבוטבול', 'אביכזר', 'אביטל', 'אביסרור', 'אבישר', 'אבני', 'אבקסיס', 'אבקסיס', 'אדרי', 'אוזן',
  'אוחיון', 'אוחנה', 'אוחנונה', 'אוחנה', 'אייזנברג', 'אילוז', 'אלבז', 'אלון', 'אלחדד', 'אלחרר',
  'אליאס', 'אלימלך', 'אלישע', 'אלמוג', 'אלמקייס', 'אמסלם', 'אנקונינה', 'אסולין', 'אסייג', 'אזולאי',
  'אטיאס', 'איציק', 'ארביב', 'ארזי', 'אשכנזי', 'באואר', 'בוכריס', 'בוזגלו', 'בוסקילה', 'בונה',
  'ביטון', 'בכר', 'בלוך', 'בןדוד', 'בןחמו', 'בןחיים', 'בןלולו', 'בןנון', 'בןשושן', 'בר',
  'ברוך', 'ברדה', 'ברזילי', 'ברכה', 'ברמן', 'ברק', 'גבאי', 'גבע', 'גבעון', 'גולן',
  'גולדברג', 'גולדמן', 'גורן', 'גזית', 'גניש', 'דבח', 'דגן', 'דוד', 'דהן', 'דנון',
  'דויטש', 'דקל', 'דרור', 'הכהן', 'הלוי', 'הראל', 'הרוש', 'וינברג', 'וייס', 'וקנין', 'זגורי',
  'זוארץ', 'זוהר', 'זיו', 'זילברמן', 'זיתון', 'חדד', 'חביב', 'חגג', 'חמו', 'חן',
  'חנוכה', 'חסון', 'חיים', 'טביב', 'טויטו', 'טולדנו', 'טהרני', 'טמסוט', 'טל', 'יאיר',
  'יבגני', 'יהב', 'יוסף', 'יפרח', 'כהן', 'כהנא', 'כחלון', 'כץ', 'לביא', 'לביא',
  'לבנה', 'לוי', 'לוין', 'לזר', 'ליאון', 'ליפשיץ', 'מאור', 'מגן', 'מדינה', 'מויאל',
  'מור', 'מועלם', 'מזרחי', 'מלכה', 'ממן', 'מנחם', 'מרציאנו', 'משיח', 'משה', 'נגר',
  'נהרי', 'נוימן', 'נחום', 'ניסים', 'נעים', 'נעים', 'סבן', 'סויסה', 'סולומון', 'סופר',
  'סעדה', 'סעדון', 'סעדיה', 'סער', 'עובדיה', 'עוז', 'עזרן', 'עטר', 'עמרם', 'פדידה', 'פישר',
  'פלד', 'פרג', 'פרץ', 'צברי', 'צדוק', 'צור', 'צמח', 'צמחוני', 'קאופמן', 'קדוש',
  'צוריה', 'קופל', 'קורן', 'קטן', 'קרן', 'קרני', 'ראובן', 'רבינוביץ', 'רגב', 'רוזן', 'רוזנברג',
  'רוזנפלד', 'רומנו', 'רון', 'רפאל', 'רפאלי', 'שבח', 'שגב', 'שוחט', 'שטרית', 'שילה',
  'שיטרית', 'שמחון', 'שמעוני', 'שמש', 'שרעבי', 'תורגמן', 'תמיר',
])

// Supplemental lexicon to broaden coverage beyond the core built-in list.
const EXTRA_HE_FIRST_NAMES = [
  'אבשלום', 'אבישג', 'אבנר', 'אדיר', 'אדלין', 'אורפז', 'אוריהו', 'אושרת', 'אחינועם', 'איילת',
  'אלדד', 'אלדר', 'אלומה', 'אלוןית', 'אלחנן', 'אליענה', 'אלירם', 'אלמה', 'אמונה', 'אמנון',
  'אסנת', 'אפיק', 'אראלה', 'ארבל', 'ארגמן', 'בארי', 'בלהה', 'בנימין', 'בנצי', 'בעז',
  'בראל', 'ברוריה', 'גאולה', 'גואל', 'גלעד', 'גפן', 'דביר', 'דולב', 'דורית', 'דורין',
  'דיקלה', 'דיצה', 'דפנה', 'הוד', 'הודיה', 'הלנה', 'הניה', 'הרצל', 'ורוניקה', 'זהבית',
  'זכריה', 'זינה', 'זמר', 'חביבה', 'חווה', 'חסידה', 'טוהר', 'טלי', 'ידידיה', 'יהודית',
  'יהונתן', 'יהורם', 'יוכבד', 'יונדב', 'יוספה', 'יזהר', 'יחזקאל', 'ינון', 'יסמין', 'יערה',
  'יפית', 'יקותיאל', 'ירדנה', 'ישעיה', 'כינרת', 'כנרת', 'כרמית', 'לבנה', 'לבנת', 'לוטן',
  'לילך', 'ליעם', 'לירן', 'לשם', 'מאיהר', 'מאי', 'מבשרת', 'מגדלנה', 'מזל', 'מחי',
  'מטר', 'מיטל', 'מיקי', 'מירית', 'מיריתי', 'מנשה', 'מסרט', 'מעוז', 'מעיין', 'מצדה',
  'מרגלית', 'מרינה', 'מתיתיהו', 'נאוה', 'נאור', 'נורית', 'נחמיה', 'נטלי', 'נירית', 'נעמן',
  'סבינה', 'סופי', 'סוזן', 'סול', 'סילבי', 'סיון', 'סלמה', 'סלין', 'סתיו', 'עובד',
  'עודד', 'עוזיאל', 'עולא', 'עטרת', 'פז', 'פאני', 'פועה', 'פאניה', 'פלג', 'פרח',
  'פרלה', 'צופיה', 'צילה', 'ציפורה', 'קרולין', 'רביב', 'רביד', 'רומי', 'רותם', 'רחמים',
  'ריטה', 'ריקי', 'רמי', 'שאנן', 'שגיא', 'שולמית', 'שחרית', 'שטרנה', 'שלומית', 'שמעיה',
  'שקד', 'שרי', 'שרון', 'תדהר', 'תהלל', 'תכלת', 'תפארת', 'תקוה',
]

const EXTRA_HE_LAST_NAMES = [
  'אבגי', 'אבגזר', 'אבדור', 'אבו', 'אבו חצירא', 'אבוחצירה', 'אביטל', 'אברג׳יל', 'אברגיל', 'אברבנאל',
  'אברמוב', 'אברמוביץ', 'אדמון', 'אדמוני', 'אדרעי', 'אהרונוב', 'אהרונוביץ', 'אוחנה', 'אוזנה', 'אוזנר',
  'אוליאל', 'אונגר', 'אופנהיים', 'אופנר', 'אורבך', 'אורון', 'אושרי', 'איזק', 'איזנשטט', 'אילוז',
  'אלגרבלי', 'אלגריסי', 'אלדר', 'אלגריסי', 'אלחדיף', 'אלחרר', 'אלטמן', 'אליקים', 'אלימלך', 'אלכסנדר',
  'אלקיים', 'אלקריף', 'אמזלג', 'אמינוב', 'אמיתי', 'אנקווה', 'אסרף', 'אפללו', 'ארבל', 'ארד',
  'ארדיטי', 'ארואס', 'ארזי', 'אריאלי', 'אשכנזי', 'באום', 'בוארון', 'בוחבוט', 'בוזנח', 'בוטבול',
  'ביטאן', 'בייניש', 'בינדר', 'בירנבוים', 'בלומנטל', 'בלט', 'בן אבו', 'בן אור', 'בן עטר', 'בן שושן',
  'בן עמי', 'בן עטר', 'בן פורת', 'בן שבת', 'בנימין', 'בסון', 'בעבור', 'בר-און', 'בר-לב', 'ברזילי',
  'ברמן', 'ברנע', 'בשארי', 'גבעתי', 'גוטמן', 'גולדשטיין', 'גולוב', 'גולומב', 'גורדון', 'גז',
  'גזיאל', 'גל', 'גלבוע', 'גלילי', 'דגני', 'דהרי', 'דויטשמן', 'דוידי', 'דולב', 'דומב',
  'דורון', 'דיאמנט', 'דילמוני', 'דקלר', 'דרעי', 'הורוביץ', 'הורן', 'הראבן', 'וולף', 'וולפסון',
  'וורצמן', 'ויקטור', 'ויזל', 'ויסמן', 'ורדי', 'זגורי', 'זגורי', 'זגורי', 'זילכה', 'זילבר',
  'זלצר', 'זמיר', 'חג׳ג׳', 'חג׳ג׳', 'חדאד', 'חודדה', 'חורי', 'חזיזה', 'חזות', 'חטב',
  'חימי', 'חלפון', 'חמדני', 'חסיד', 'חסידים', 'חרוש', 'טוויזר', 'טוקר', 'טישלר', 'טויטו',
  'יאר', 'יגיל', 'ידיד', 'יהב', 'יהלומי', 'יולזרי', 'יונס', 'יוספי', 'יחיא', 'ינאי',
  'יניב', 'יסעור', 'יפת', 'יצחקי', 'ירושלמי', 'ישורון', 'כהן-צדק', 'כחלני', 'כפיר', 'כרמי',
  'לב', 'לבב', 'לב-ארי', 'לויט', 'ליכט', 'ליברמן', 'לידור', 'לינדר', 'ליס', 'לשם',
  'מאירי', 'מגד', 'מוגרבי', 'מודעי', 'מוניץ', 'מועלם', 'מזוז', 'מחלב', 'מזרח', 'מילוא',
  'מימון', 'מילר', 'מכנס', 'מלול', 'מלמד', 'מנור', 'מסיקה', 'מעוז', 'מצליח', 'מרום',
  'מרחב', 'משיח', 'מתיתיהו', 'נבון', 'נגוסה', 'נדב', 'נהון', 'נוטמן', 'נוימרק', 'נחמני',
  'ניסני', 'נמרודי', 'נפתלי', 'סבג', 'סבן', 'סודרי', 'סולטן', 'סויסא', 'סיגל', 'סיקרון',
  'סלומון', 'סלע', 'סניור', 'סעדון', 'ספיר', 'ספרן', 'עבאדי', 'עבדל', 'עובד', 'עטרי',
  'עיני', 'עמיאל', 'עמיר', 'עמישי', 'ענתי', 'ערוסי', 'פדידה', 'פולק', 'פורת', 'פרי',
  'פריאל', 'פרנקל', 'צברי', 'צדיק', 'ציון', 'ציפורי', 'צמחי', 'קדם', 'קהתי', 'קוטלר',
  'קיסרי', 'קלדרון', 'קליין', 'קלייןמן', 'קרויזר', 'קריב', 'קרליבך', 'ראדי', 'ראובני', 'רביבו',
  'רבינא', 'רבינסקי', 'רג׳ואן', 'רודיך', 'רוט', 'רוזנבלום', 'רוזנשטיין', 'רוחם', 'רומי', 'רז',
  'רחמני', 'רימון', 'ריינר', 'רכלבסקי', 'רמז', 'שביט', 'שדה', 'שולמן', 'שושני', 'שטרנברג',
  'שטרן', 'שימעוני', 'שיפמן', 'שירזי', 'שלו', 'שלזינגר', 'שמחי', 'שמואלי', 'שני', 'שץ',
  'שרביט', 'שרון', 'תבור', 'תדמור', 'תורן', 'תמירי',
]

EXTRA_HE_FIRST_NAMES.forEach(name => COMMON_HE_FIRST_NAMES.add(name))
EXTRA_HE_LAST_NAMES.forEach(name => COMMON_HE_LAST_NAMES.add(name))
/* ── Pure helpers ───────────────────────────────────────── */
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function normalizePhone(p: string): string {
  let n = p.replace(/[\s\-().+ ]/g, '')
  if (n.startsWith('00972')) n = '0' + n.slice(5)
  else if (n.startsWith('972')) n = '0' + n.slice(3)
  return n
}

function sanitizePhoneValue(raw: string): string {
  return raw
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^(?:uri:)?tel:/i, '')
    .trim()
}

function looksLikePhone(value: string): boolean {
  return /\d{3,}/.test(value)
}

function normalizeCharset(charset: string): string {
  const c = charset.trim().toLowerCase()
  if (c === 'utf8') return 'utf-8'
  if (c === 'cp1255') return 'windows-1255'
  return c
}

function decodeQuotedPrintable(value: string, charset = 'utf-8'): string {
  const normalized = value.replace(/=\r?\n/g, '')
  const bytes: number[] = []

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === '=' && i + 2 < normalized.length) {
      const hex = normalized.slice(i + 1, i + 3)
      if (/^[A-Fa-f0-9]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 2
        continue
      }
    }
    bytes.push(normalized.charCodeAt(i) & 0xff)
  }

  try {
    return new TextDecoder(normalizeCharset(charset)).decode(new Uint8Array(bytes))
  } catch {
    return normalized
  }
}

function decodeVcfValue(rawValue: string, leftPart: string): string {
  const charset = leftPart.match(/CHARSET=([^;:]+)/i)?.[1] ?? 'utf-8'
  const isQuotedPrintable = /ENCODING=QUOTED-PRINTABLE/i.test(leftPart)
  const isBase64 = /ENCODING=(B|BASE64)/i.test(leftPart)

  let decoded = rawValue
  if (isQuotedPrintable) decoded = decodeQuotedPrintable(rawValue, charset)
  else if (isBase64) {
    try {
      const binary = atob(rawValue.replace(/\s+/g, ''))
      const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
      decoded = new TextDecoder(normalizeCharset(charset)).decode(bytes)
    } catch {
      decoded = rawValue
    }
  }

  return decoded
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .trim()
}

function unfoldVcfLines(input: string): string[] {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalized.split('\n')

  // RFC line folding: continuation lines start with space/tab.
  const folded: string[] = []
  for (const line of rawLines) {
    if (!line) {
      folded.push(line)
      continue
    }
    if ((line.startsWith(' ') || line.startsWith('\t')) && folded.length > 0) {
      folded[folded.length - 1] += line.slice(1)
    } else {
      folded.push(line)
    }
  }

  // Quoted-printable soft line breaks end with '=' and continue on next line.
  const qpMerged: string[] = []
  for (let i = 0; i < folded.length; i++) {
    let current = folded[i]
    if (/ENCODING=QUOTED-PRINTABLE/i.test(current)) {
      while (current.endsWith('=') && i + 1 < folded.length) {
        i += 1
        current = current.slice(0, -1) + folded[i].replace(/^[ \t]/, '')
      }
    }
    qpMerged.push(current)
  }

  return qpMerged
}

function parseVcf(text: string, source: string): VcfParseResult {
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const cardBlocks = normalizedText.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) ?? []
  const blocks = cardBlocks.length > 0
    ? cardBlocks
    : normalizedText.split(/\n\s*\n+/).filter(Boolean)

  const contacts: Contact[] = []
  let cardsParsed = 0

  for (const block of blocks) {
    const lines = unfoldVcfLines(block)
    let name = '', firstName = '', lastName = '', rev = '', notes = ''
    const phones: string[] = []
    const emails: string[] = []

    for (const raw of lines) {
      if (!raw || /^BEGIN:/i.test(raw) || /^END:/i.test(raw) || /^VERSION:/i.test(raw)) continue
      const ci = raw.indexOf(':')
      if (ci < 0) continue

      const left = raw.slice(0, ci).trim()
      const rawKey = left.toUpperCase().split(';')[0].trim()
      const key = rawKey.includes('.') ? rawKey.split('.').pop() ?? rawKey : rawKey
      const val = decodeVcfValue(raw.slice(ci + 1), left)
      if (!val) continue

      if (key === 'FN') name = val
      else if (key === 'N') {
        const [ln, fn] = val.split(';')
        lastName = (ln || '').trim()
        firstName = (fn || '').trim()
      } else if (key === 'TEL') {
        const phone = sanitizePhoneValue(val)
        if (looksLikePhone(phone)) phones.push(phone)
      }
      else if (key === 'EMAIL') emails.push(val)
      else if (key === 'REV') rev = val
      else if (key === 'NOTE') notes = val
    }

    if (phones.length === 0) {
      for (const line of lines) {
        if (!/(TEL|PHONE|CELL|MOBILE|WHATSAPP)/i.test(line)) continue
        const matches = line.match(/(?:\+?\d[\d\s\-()]{3,}\d)/g)
        if (!matches) continue
        for (const m of matches) {
          const phone = sanitizePhoneValue(m)
          if (looksLikePhone(phone)) phones.push(phone)
        }
      }
    }

    if (!name && !firstName && !lastName && phones.length === 0 && emails.length === 0) continue
    if (!name && (firstName || lastName)) name = [firstName, lastName].filter(Boolean).join(' ')
    if (!name && !phones.length) continue
    if (!firstName && !lastName && name) firstName = name

    contacts.push({
      id: uid(), name, firstName, lastName,
      phones, emails, source,
      rev: rev || undefined,
      notes: notes || undefined,
    })
    cardsParsed++
  }

  return {
    contacts,
    cardsDetected: blocks.length,
    cardsParsed,
  }
}

function parseLooseContacts(text: string, source: string): Contact[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\0/g, '')
  const chunks = normalized
    .split(/END:VCARD|BEGIN:VCARD/gi)
    .map(s => s.trim())
    .filter(Boolean)

  const contacts: Contact[] = []
  for (const chunk of chunks) {
    const lines = unfoldVcfLines(chunk).map(l => l.trim()).filter(Boolean)
    let name = ''
    const phones: string[] = []
    const emails: string[] = []

    for (const line of lines) {
      const ci = line.indexOf(':')
      if (ci < 0) continue
      const left = line.slice(0, ci)
      const keyRaw = left.toUpperCase().split(';')[0]
      const key = keyRaw.includes('.') ? keyRaw.split('.').pop() ?? keyRaw : keyRaw
      const val = decodeVcfValue(line.slice(ci + 1), left)
      if (!val) continue

      if ((key === 'FN' || key === 'N') && !name) name = val.replace(/;/g, ' ').trim()
      else if (key === 'TEL') {
        const phone = sanitizePhoneValue(val)
        if (looksLikePhone(phone)) phones.push(phone)
      }
      else if (key === 'EMAIL') emails.push(val)
    }

    if (phones.length === 0) {
      for (const line of lines) {
        if (!/(TEL|PHONE|CELL|MOBILE|WHATSAPP)/i.test(line)) continue
        const matches = line.match(/(?:\+?\d[\d\s\-()]{3,}\d)/g)
        if (!matches) continue
        for (const m of matches) {
          const phone = sanitizePhoneValue(m)
          if (looksLikePhone(phone)) phones.push(phone)
        }
      }
    }

    const cleanPhones = [...new Set(phones.filter(Boolean))]
    const cleanEmails = [...new Set(emails.filter(Boolean))]
    if (!name && cleanPhones.length === 0 && cleanEmails.length === 0) continue
    if (!name) name = cleanPhones[0] || cleanEmails[0] || 'ללא שם'

    contacts.push({
      id: uid(),
      name,
      firstName: name,
      lastName: '',
      phones: cleanPhones,
      emails: cleanEmails,
      source,
    })
  }

  return contacts
}

function splitStructuredName(value: string): { firstName: string; lastName: string } {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) return { firstName: '', lastName: '' }
  const parts = cleaned.split(' ')
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function normalizeMultiValue(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(v => String(v ?? '').trim()).filter(Boolean))]
  }
  if (typeof raw !== 'string') return []
  return [...new Set(raw
    .split(/[\n,;|]+/)
    .map(v => v.trim())
    .filter(Boolean))]
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function parseJsonContacts(text: string, source: string): Contact[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  const records = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { contacts?: unknown[] }).contacts)
      ? (parsed as { contacts: unknown[] }).contacts
      : [])

  const contacts: Contact[] = []
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue
    const row = rec as Record<string, unknown>

    const directFirst = pickFirstString(row, ['firstName', 'first_name', 'fname', 'givenName', 'given_name'])
    const directLast = pickFirstString(row, ['lastName', 'last_name', 'lname', 'familyName', 'family_name', 'surname'])
    const fullName = pickFirstString(row, ['name', 'fullName', 'full_name', 'displayName', 'display_name'])

    const splitFromFull = splitStructuredName(fullName)
    const firstName = directFirst || splitFromFull.firstName
    const lastName = directLast || splitFromFull.lastName
    const name = formatNameDisplay(firstName, lastName) || fullName || 'ללא שם'

    const phones = normalizeMultiValue(
      row.phones ?? row.phoneNumbers ?? row.phone_numbers ?? row.phone ?? row.mobile ?? row.tel,
    )
      .map(sanitizePhoneValue)
      .filter(looksLikePhone)
    const emails = normalizeMultiValue(
      row.emails ?? row.emailAddresses ?? row.email_addresses ?? row.email,
    )
    const recordSource = pickFirstString(row, ['source', 'file', 'origin']) || source

    if (!name && phones.length === 0 && emails.length === 0) continue
    contacts.push({
      id: uid(),
      name,
      firstName,
      lastName,
      phones: [...new Set(phones)],
      emails: [...new Set(emails)],
      source: recordSource,
    })
  }

  return contacts
}

function parseDelimitedContacts(text: string, source: string): Contact[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const sampleHeader = lines[0]
  const delimiter = sampleHeader.includes('\t')
    ? '\t'
    : sampleHeader.includes(';')
      ? ';'
      : sampleHeader.includes(',')
        ? ','
        : ''
  if (!delimiter) return []

  const headers = sampleHeader.split(delimiter).map(h => h.trim().toLowerCase())
  const idx = {
    first: headers.findIndex(h => /^(first|firstname|first_name|שם\s*פרטי)$/.test(h)),
    last: headers.findIndex(h => /^(last|lastname|last_name|surname|family|שם\s*משפחה)$/.test(h)),
    name: headers.findIndex(h => /^(name|full\s*name|display\s*name|שם)$/.test(h)),
    phone: headers.findIndex(h => /(phone|tel|mobile|cell|טלפון|נייד)/.test(h)),
    email: headers.findIndex(h => /(email|mail|מייל)/.test(h)),
    source: headers.findIndex(h => /(source|origin|file|מקור)/.test(h)),
  }

  const contacts: Contact[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
    const firstName = idx.first >= 0 ? (cols[idx.first] ?? '') : ''
    const lastName = idx.last >= 0 ? (cols[idx.last] ?? '') : ''
    const fullName = idx.name >= 0 ? (cols[idx.name] ?? '') : ''
    const split = splitStructuredName(fullName)
    const resolvedFirst = (firstName || split.firstName).trim()
    const resolvedLast = (lastName || split.lastName).trim()
    const phones = normalizeMultiValue(idx.phone >= 0 ? cols[idx.phone] : '').map(sanitizePhoneValue).filter(looksLikePhone)
    const emails = normalizeMultiValue(idx.email >= 0 ? cols[idx.email] : '')
    const contactSource = (idx.source >= 0 ? cols[idx.source] : '') || source
    const name = formatNameDisplay(resolvedFirst, resolvedLast) || fullName || 'ללא שם'

    if (!name && phones.length === 0 && emails.length === 0) continue
    contacts.push({
      id: uid(),
      name,
      firstName: resolvedFirst,
      lastName: resolvedLast,
      phones: [...new Set(phones)],
      emails: [...new Set(emails)],
      source: contactSource,
    })
  }

  return contacts
}

function parseGenericLineContacts(text: string, source: string): Contact[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const normalizedLines: string[] = []
  for (const line of lines) {
    // Binary-derived files often have giant lines; split near each phone candidate.
    if (line.length > 220) {
      const matches = [...line.matchAll(/(?:\+?\d[\d\s\-()]{5,}\d)/g)]
      if (matches.length > 1) {
        for (const m of matches) {
          const pos = m.index ?? 0
          const start = Math.max(0, pos - 70)
          const end = Math.min(line.length, pos + 90)
          normalizedLines.push(line.slice(start, end).trim())
        }
        continue
      }
    }
    normalizedLines.push(line)
  }

  const contacts: Contact[] = []
  for (const line of normalizedLines) {
    const phones = (line.match(/(?:\+?\d[\d\s\-()]{5,}\d)/g) ?? [])
      .map(sanitizePhoneValue)
      .filter(looksLikePhone)
    const emails = (line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
      .map(v => v.trim())

    if (phones.length === 0 && emails.length === 0) continue

    const lead = line
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
      .replace(/(?:\+?\d[\d\s\-()]{5,}\d)/g, '')
      .replace(/[,:;|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const split = splitStructuredName(lead)
    const name = formatNameDisplay(split.firstName, split.lastName) || lead || phones[0] || 'ללא שם'

    contacts.push({
      id: uid(),
      name,
      firstName: split.firstName,
      lastName: split.lastName,
      phones: [...new Set(phones)],
      emails: [...new Set(emails)],
      source,
    })
  }

  return contacts
}

function extractOffsetStringChunks(buffer: ArrayBuffer): OffsetStringChunk[] {
  const bytes = new Uint8Array(buffer)
  const chunks: OffsetStringChunk[] = []

  // ASCII runs
  let run = ''
  let start = 0
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b >= 0x20 && b <= 0x7e) {
      if (!run) start = i
      run += String.fromCharCode(b)
    } else {
      if (run.length >= 5) chunks.push({ offset: start, text: run.trim(), stride: 1 })
      run = ''
    }
  }
  if (run.length >= 5) chunks.push({ offset: start, text: run.trim(), stride: 1 })

  // UTF-16LE runs
  let run16 = ''
  let start16 = 0
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8)
    if (isLikelyPrintableCodePoint(code)) {
      if (!run16) start16 = i
      run16 += String.fromCharCode(code)
    } else {
      if (run16.length >= 4) chunks.push({ offset: start16, text: run16.trim(), stride: 2 })
      run16 = ''
    }
  }
  if (run16.length >= 4) chunks.push({ offset: start16, text: run16.trim(), stride: 2 })

  // Deduplicate overlapping noisy chunks
  const unique = new Map<string, OffsetStringChunk>()
  chunks.forEach(chunk => {
    if (!chunk.text) return
    const key = `${chunk.text}:${Math.floor(chunk.offset / 4)}`
    if (!unique.has(key)) unique.set(key, chunk)
  })

  return [...unique.values()].sort((a, b) => a.offset - b.offset)
}

function cleanNameCandidate(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/(?:\+?\d[\d\s\-()]{5,}\d)/g, ' ')
    .replace(/[\\/|,:;]+/g, ' ')
    .replace(/[_\-]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGoodNameCandidate(value: string): boolean {
  if (!value) return false
  if (value.length < 2 || value.length > 60) return false
  if (/backup|contacts?|phonebook|header|ibphone|nokia|\.in$|\.ib$/i.test(value)) return false
  if (!/[A-Za-z\u0590-\u05FF]/.test(value)) return false
  return true
}

function extractUtf16LeNullTerminatedChunks(buffer: ArrayBuffer): Array<{ offset: number; text: string }> {
  const bytes = new Uint8Array(buffer)
  const chunks: Array<{ offset: number; text: string }> = []

  let current = ''
  let start = 0
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8)

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

function parseNokiaLikeUtf16Contacts(buffer: ArrayBuffer, source: string): Contact[] {
  const chunks = extractUtf16LeNullTerminatedChunks(buffer)
  if (chunks.length === 0) return []

  type FieldEntry = { offset: number; text: string }
  const names: FieldEntry[] = []
  const phones: FieldEntry[] = []
  const emails: FieldEntry[] = []

  for (const chunk of chunks) {
    const text = chunk.text

    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) {
      const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) ?? [''])[0].trim()
      if (email) emails.push({ offset: chunk.offset, text: email })
      continue
    }

    if (/(?:\+?\d[\d\s\-()]{5,}\d)/.test(text)) {
      const phone = sanitizePhoneValue((text.match(/(?:\+?\d[\d\s\-()]{5,}\d)/) ?? [''])[0])
      if (looksLikePhone(phone)) phones.push({ offset: chunk.offset, text: phone })
      continue
    }

    const cleanedName = cleanNameCandidate(text)
    if (isGoodNameCandidate(cleanedName)) names.push({ offset: chunk.offset, text: cleanedName })
  }

  if (phones.length === 0 && emails.length === 0) return []

  const anchors: Array<{ offset: number; phones: Set<string>; emails: Set<string>; name?: string }> = []
  const attach = (offset: number) => {
    let anchor = anchors.find(item => Math.abs(item.offset - offset) <= 200)
    if (!anchor) {
      anchor = { offset, phones: new Set(), emails: new Set() }
      anchors.push(anchor)
    }
    return anchor
  }

  phones.forEach(entry => attach(entry.offset).phones.add(entry.text))
  emails.forEach(entry => attach(entry.offset).emails.add(entry.text))

  for (const anchor of anchors) {
    const nearby = names
      .filter(name => Math.abs(name.offset - anchor.offset) <= 260)
      .sort((a, b) => Math.abs(a.offset - anchor.offset) - Math.abs(b.offset - anchor.offset))
    if (nearby.length > 0) anchor.name = nearby[0].text
  }

  const contacts: Contact[] = anchors.map(anchor => {
    const bestName = anchor.name ?? ''
    const split = splitStructuredName(bestName)
    const display = formatNameDisplay(split.firstName, split.lastName) || bestName || [...anchor.phones][0] || [...anchor.emails][0] || 'ללא שם'
    return {
      id: uid(),
      name: display,
      firstName: split.firstName,
      lastName: split.lastName,
      phones: [...anchor.phones],
      emails: [...anchor.emails],
      source,
    }
  })

  return normalizeImportedContacts(contacts)
}

function parseBinaryBackupContacts(buffer: ArrayBuffer, source: string): Contact[] {
  const utf16Structured = parseNokiaLikeUtf16Contacts(buffer, source)
  if (utf16Structured.length > 0) return utf16Structured

  const chunks = extractOffsetStringChunks(buffer)
  if (chunks.length === 0) return []

  const phoneEntries: Array<{ offset: number; phone: string }> = []
  const emailEntries: Array<{ offset: number; email: string }> = []

  for (const chunk of chunks) {
    const phoneMatches = [...chunk.text.matchAll(/(?:\+?\d[\d\s\-()]{5,}\d)/g)]
    for (const match of phoneMatches) {
      const raw = match[0] ?? ''
      const phone = sanitizePhoneValue(raw)
      if (!looksLikePhone(phone)) continue
      const offset = chunk.offset + (match.index ?? 0) * chunk.stride
      phoneEntries.push({ offset, phone })
    }

    const emailMatches = [...chunk.text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    for (const match of emailMatches) {
      const email = (match[0] ?? '').trim()
      if (!email) continue
      const offset = chunk.offset + (match.index ?? 0) * chunk.stride
      emailEntries.push({ offset, email })
    }
  }

  if (phoneEntries.length === 0 && emailEntries.length === 0) return []

  const anchors: Array<{ offset: number; phones: Set<string>; emails: Set<string>; nameCandidates: string[] }> = []
  const proximity = 180

  const attachToAnchor = (offset: number) => {
    let target = anchors.find(anchor => Math.abs(anchor.offset - offset) <= proximity)
    if (!target) {
      target = { offset, phones: new Set(), emails: new Set(), nameCandidates: [] }
      anchors.push(target)
    }
    return target
  }

  for (const entry of phoneEntries) {
    const anchor = attachToAnchor(entry.offset)
    anchor.phones.add(entry.phone)
  }

  for (const entry of emailEntries) {
    const anchor = attachToAnchor(entry.offset)
    anchor.emails.add(entry.email)
  }

  // Pull name candidates from nearby printable chunks around each anchor.
  for (const anchor of anchors) {
    for (const chunk of chunks) {
      if (Math.abs(chunk.offset - anchor.offset) > 220) continue
      const cleaned = cleanNameCandidate(chunk.text)
      if (!isGoodNameCandidate(cleaned)) continue
      anchor.nameCandidates.push(cleaned)
    }
  }

  const contacts: Contact[] = []
  for (const anchor of anchors) {
    const phones = [...anchor.phones]
    const emails = [...anchor.emails]
    const bestName = anchor.nameCandidates.sort((a, b) => a.length - b.length)[0] ?? ''
    const split = splitStructuredName(bestName)
    const display = formatNameDisplay(split.firstName, split.lastName) || bestName || phones[0] || emails[0] || ''
    if (!display && phones.length === 0 && emails.length === 0) continue

    contacts.push({
      id: uid(),
      name: display || 'ללא שם',
      firstName: split.firstName,
      lastName: split.lastName,
      phones: [...new Set(phones)],
      emails: [...new Set(emails)],
      source,
    })
  }

  return normalizeImportedContacts(contacts)
}

function isLikelyPrintableCodePoint(code: number): boolean {
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0x0590 && code <= 0x05ff) ||
    code === 0x40 || // @
    code === 0x2b || // +
    code === 0x2d || // -
    code === 0x2e || // .
    code === 0x5f || // _
    code === 0x20
  )
}

function extractPrintableByteStrings(buffer: ArrayBuffer, minLen = 6): string[] {
  const bytes = new Uint8Array(buffer)
  const out: string[] = []

  // ASCII-like runs
  let run = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b >= 0x20 && b <= 0x7e) {
      run += String.fromCharCode(b)
    } else {
      if (run.length >= minLen) out.push(run)
      run = ''
    }
  }
  if (run.length >= minLen) out.push(run)

  // UTF-16LE printable runs (common in phone backup formats)
  let run16 = ''
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8)
    if (isLikelyPrintableCodePoint(code)) {
      run16 += String.fromCharCode(code)
    } else {
      if (run16.length >= minLen) out.push(run16)
      run16 = ''
    }
  }
  if (run16.length >= minLen) out.push(run16)

  const unique = new Set<string>()
  const cleaned: string[] = []
  out.forEach(value => {
    const v = value.trim()
    if (!v) return
    if (unique.has(v)) return
    unique.add(v)
    cleaned.push(v)
  })
  return cleaned
}

function decodeBufferCandidates(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer)
  const encodings = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1255', 'iso-8859-1'] as const
  const candidates: string[] = []

  candidates.push(decodeVcfBuffer(buffer))

  for (const enc of encodings) {
    try {
      const text = new TextDecoder(enc).decode(bytes)
      const cleaned = text
        .replace(/\0/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .trim()
      if (cleaned) candidates.push(cleaned)
    } catch {
      // ignore decode failures for this encoding
    }
  }

  const extracted = extractPrintableByteStrings(buffer)
  if (extracted.length > 0) {
    candidates.push(extracted.join('\n'))
  }

  const unique = new Set<string>()
  const out: string[] = []
  candidates.forEach(text => {
    const key = text.slice(0, 3000)
    if (!key || unique.has(key)) return
    unique.add(key)
    out.push(text)
  })

  return out
}

function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function fileBaseName(name: string): string {
  const i = name.lastIndexOf('.')
  return (i >= 0 ? name.slice(0, i) : name).toLowerCase()
}

function normalizeImportedContacts(contacts: Contact[], options?: { keepNameOnly?: boolean; allowExactDedup?: boolean }): Contact[] {
  const keepNameOnly = options?.keepNameOnly ?? false
  const allowExactDedup = options?.allowExactDedup ?? true
  const dedup = new Map<string, Contact>()
  const passthrough: Contact[] = []

  contacts.forEach(contact => {
    const normalized: Contact = {
      ...contact,
      name: (contact.name || formatNameDisplay(contact.firstName, contact.lastName)).trim(),
      firstName: (contact.firstName || '').trim(),
      lastName: (contact.lastName || '').trim(),
      phones: [...new Set((contact.phones || []).map(sanitizePhoneValue).filter(looksLikePhone))],
      emails: [...new Set((contact.emails || []).map(e => e.trim()).filter(Boolean))],
      source: (contact.source || '').trim(),
    }

    // Keep weak/name-only records as requested; do not drop anything here.
    const hasMeaningfulName = Boolean(normalized.name)
    if (!hasMeaningfulName && !(keepNameOnly && normalized.name)) {
      passthrough.push(normalized)
      return
    }

    if (!allowExactDedup) {
      passthrough.push(normalized)
      return
    }

    // Deduplicate only exact same name + exact same phone list (non-empty phones only).
    if (normalized.phones.length === 0) {
      passthrough.push(normalized)
      return
    }

    const key = `${normalized.name}::${normalized.phones.join('|')}`

    if (!dedup.has(key)) {
      dedup.set(key, normalized)
    }
  })

  return [...passthrough, ...dedup.values()]
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 3 >= bytes.length) return 0
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function detectDeclaredContactCount(buffer: ArrayBuffer, source: string): number | null {
  const ext = fileExt(source)
  if (ext !== 'ib') return null
  const bytes = new Uint8Array(buffer)

  // Nokia-like backup headers often store record count at these offsets.
  const c1 = readUint32LE(bytes, 0x2c)
  const c2 = readUint32LE(bytes, 0x30)
  if (c1 > 0 && c1 < 100000 && c1 === c2) return c1

  const alt = readUint32LE(bytes, 0x24)
  if (alt > 0 && alt < 100000) return alt

  return null
}

function parseNokiaFixedRecordNames(buffer: ArrayBuffer, source: string): Contact[] {
  if (fileExt(source) !== 'ib') return []
  const bytes = new Uint8Array(buffer)
  const declared = detectDeclaredContactCount(buffer, source)
  const dataLen = readUint32LE(bytes, 0x28)
  if (!declared || declared <= 0 || dataLen === 0) return []

  const recSize = Math.floor(dataLen / declared)
  if (recSize < 100 || recSize > 4096) return []

  const base = 0x80
  const contacts: Contact[] = []

  const readRecordByte = (slice: Uint8Array, off: number): number => {
    const n = ((off % recSize) + recSize) % recSize
    return slice[n]
  }

  const findBestNameInRecord = (slice: Uint8Array): { text: string; start: number } => {
    let best = { text: '', start: -1 }

    for (let i = 0; i + 1 < slice.length; i += 2) {
      const code = slice[i] | (slice[i + 1] << 8)
      if (code < 0x0590 || code > 0x05ff) continue

      let candidate = ''
      for (let j = i; j + 1 < slice.length; j += 2) {
        const c = slice[j] | (slice[j + 1] << 8)
        const printable =
          (c >= 0x20 && c <= 0x7e) ||
          (c >= 0x0590 && c <= 0x05ff)
        if (!printable || c === 0 || c === 0xffff) break
        candidate += String.fromCharCode(c)
      }

      // For IB keep the decoded name as close to source as possible.
      const cleaned = candidate.replace(/\s+/g, ' ').trim()
      if (cleaned.length > best.text.length) {
        best = { text: cleaned, start: i }
      }
    }

    return best
  }

  const decodeNokiaPackedPhone = (slice: Uint8Array, start: number, byteLen = 5): string => {
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

  const looksLikeRecoveredPhone = (value: string): boolean => {
    if (!value || value.length < 8 || value.length > 12) return false
    if (/^0+$/.test(value)) return false
    return (
      /^05\d{8}$/.test(value) ||
      /^0[2-9]\d{7,9}$/.test(value) ||
      /^972\d{8,11}$/.test(value)
    )
  }

  const recoverPhoneNearName = (slice: Uint8Array, nameStart: number): string => {
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

  const recoverPhoneByFullScan = (slice: Uint8Array): string => {
    for (let off = 0; off < recSize; off++) {
      const candidate = decodeNokiaPackedPhone(slice, off)
      if (looksLikeRecoveredPhone(candidate)) return candidate
    }
    return ''
  }

  for (let r = 0; r < declared; r++) {
    const start = base + r * recSize
    if (start + recSize > bytes.length) break
    const slice = bytes.slice(start, start + recSize)

    const bestName = findBestNameInRecord(slice)
    const recoveredPhone = bestName.start >= 0
      ? recoverPhoneNearName(slice, bestName.start)
      : recoverPhoneByFullScan(slice)
    const phones = looksLikeRecoveredPhone(recoveredPhone) ? [recoveredPhone] : []

    const rawFullName = bestName.text || `IB רשומה ${String(r + 1).padStart(4, '0')}`
    contacts.push({
      id: uid(),
      name: rawFullName,
      // IB stores a single display name field; keep it unsplit to avoid bad first/last splits.
      firstName: rawFullName,
      lastName: '',
      phones,
      emails: [],
      source,
    })
  }

  return normalizeImportedContacts(contacts, { keepNameOnly: true, allowExactDedup: false })
}

function parseContactsFromAnyBuffer(buffer: ArrayBuffer, source: string): { contacts: Contact[]; details: string } {
  const ext = fileExt(source)
  if (!['vcf', 'ib'].includes(ext)) {
    return {
      contacts: [],
      details: 'פורמט לא נתמך. נתמכים רק VCF ו-IB',
    }
  }

  void parseJsonContacts
  void parseDelimitedContacts
  void parseGenericLineContacts

  const textCandidates = decodeBufferCandidates(buffer)
  const parsedBinary = parseBinaryBackupContacts(buffer, source)
  const parsedFixedNames = parseNokiaFixedRecordNames(buffer, source)
  const declaredCount = detectDeclaredContactCount(buffer, source)

  let bestContacts: Contact[] = []
  let bestDetails = 'לא זוהה פורמט'
  let bestScore = -1

  for (const text of textCandidates) {
    const parsedVcf = parseVcf(text, source)
    const looseVcf = ext === 'vcf' && parsedVcf.contacts.length === 0 ? parseLooseContacts(text, source) : []

    const options: Array<{ contacts: Contact[]; details: string; score: number }> = [
      {
        contacts: parsedFixedNames,
        details: 'גיבוי Nokia IB (פענוח רשומות קבועות)',
        score: ext === 'ib' ? parsedFixedNames.length * 120 : parsedFixedNames.length * 85,
      },
      {
        contacts: parsedBinary,
        details: 'גיבוי בינארי (שחזור לפי רשומות)',
        score: ext === 'ib' ? parsedBinary.length * 90 : parsedBinary.length * 92,
      },
      {
        contacts: parsedVcf.contacts,
        details: `VCF מזוהה (${parsedVcf.cardsParsed}/${parsedVcf.cardsDetected})`,
        score: ext === 'vcf' ? parsedVcf.contacts.length * 140 + Math.min(parsedVcf.cardsParsed, 99) : parsedVcf.contacts.length * 100,
      },
      {
        contacts: looseVcf,
        details: `VCF חלקי (fallback)`,
        score: looseVcf.length * 60,
      },
    ]

    for (const option of options) {
      if (option.score > bestScore) {
        bestScore = option.score
        bestContacts = option.contacts
        bestDetails = option.details
      }
    }
  }

  const normalized = normalizeImportedContacts(bestContacts, {
    keepNameOnly: ext === 'ib',
    allowExactDedup: ext !== 'ib',
  })
  const dropped = bestContacts.length - normalized.length

  return {
    contacts: normalized,
    details: [
      bestDetails,
      declaredCount ? `מונה גיבוי: ${declaredCount}` : '',
      dropped > 0 ? `אוחדו ${dropped} כפילויות זהות (שם+מספר)` : '',
    ].filter(Boolean).join(' | '),
  }
}

function decodeVcfBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes)
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes)
  }

  const tryDecoders = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1255', 'iso-8859-1'] as const

  let bestText = ''
  let bestScore = -1
  for (const enc of tryDecoders) {
    let text = ''
    try {
      text = new TextDecoder(enc).decode(bytes)
    } catch {
      continue
    }
    const plain = text.replace(/\0/g, '')
    const score =
      (plain.match(/BEGIN:VCARD/gi)?.length ?? 0) * 5 +
      (plain.match(/\nFN[;:]/gi)?.length ?? 0) * 3 +
      (plain.match(/\nN[;:]/gi)?.length ?? 0) +
      (plain.match(/\nTEL[;:]/gi)?.length ?? 0)
    if (score > bestScore) {
      bestScore = score
      bestText = plain
    }
  }

  return bestText || new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '')
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

function buildVcfContent(contacts: Contact[]): string {
  const lines: string[] = []
  for (const c of contacts) {
    lines.push('BEGIN:VCARD', 'VERSION:3.0')
    lines.push(`FN:${c.name}`)
    lines.push(`N:${c.lastName};${c.firstName};;;`)
    c.phones.forEach(p => lines.push(`TEL:${p}`))
    c.emails.forEach(e => lines.push(`EMAIL:${e}`))
    if (c.rev) lines.push(`REV:${c.rev}`)
    if (c.notes) lines.push(`NOTE:${c.notes}`)
    lines.push('END:VCARD', '')
  }
  return lines.join('\r\n')
}

function exportVcf(contacts: Contact[]) {
  download(buildVcfContent(contacts), 'contacts.vcf', 'text/vcard;charset=utf-8')
}

function scoreContact(c: Contact): number {
  return c.phones.length * 3 + c.emails.length * 2 +
    (c.firstName ? 1 : 0) + (c.lastName ? 1 : 0) + (c.notes ? 1 : 0)
}

function tokenizeName(value: string): string[] {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(t => t.trim())
    .filter(Boolean)
}

function formatNameDisplay(firstName: string, lastName: string): string {
  const fn = (firstName || '').trim()
  const ln = (lastName || '').trim()
  if (!fn && !ln) return ''
  if (!fn) return ln
  if (!ln) return fn
  return `${fn} ${ln}`
}

function isTokenWeird(token: string): boolean {
  return /[^\u0590-\u05FFa-zA-Z'\-]/.test(token)
}

function nameQualityScore(c: Contact): number {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.name.trim()
  if (!fullName) return -20

  const tokens = tokenizeName(fullName)
  const displayName = (c.name || '').trim()
  const displayCompact = compactNameForMatch(displayName)
  const splitCompact = compactNameForMatch([c.firstName, c.lastName].filter(Boolean).join(' '))
  let score = 0

  if (tokens.length >= 2) score += 14
  else if (tokens.length === 1) score += 4

  for (const token of tokens) {
    if (COMMON_HE_FIRST_NAMES.has(token)) score += 7
    if (COMMON_HE_LAST_NAMES.has(token)) score += 7
    if (isTokenWeird(token)) score -= 8
    if (/\d/.test(token)) score -= 8
  }

  if (c.firstName && c.lastName) score += 6
  if (/\s{2,}/.test(c.name) || /[~!@#$%^&*_=+<>?]/.test(c.name)) score -= 6

  // Prefer readable display names with spacing over glued display values.
  if (displayName.includes(' ')) score += 6
  else if (displayCompact.length >= 6) score -= 5

  // If fields are split but visible display name is still glued, penalize it.
  if (splitCompact && displayCompact === splitCompact && !displayName.includes(' ')) score -= 7

  return score
}

function totalQualityScore(c: Contact): number {
  return scoreContact(c) + nameQualityScore(c)
}

function pickBestContact(contacts: Contact[]): Contact {
  return contacts.reduce((best, c) => {
    const bestScore = totalQualityScore(best)
    const curScore = totalQualityScore(c)
    if (curScore !== bestScore) return curScore > bestScore ? c : best
    return c.id < best.id ? c : best
  })
}

function recommendKeepContacts(contacts: Contact[]): Contact[] {
  if (contacts.length <= 1) return contacts

  const phoneToCandidates = new Map<string, Contact[]>()
  const uniquePhones = new Set<string>()

  contacts.forEach(contact => {
    // In keep recommendation we must preserve distinct numbers even if they are short/partial.
    const normalizedPhones = [...new Set(contact.phones.map(normalizePhone).filter(p => p.length >= 3))]
    normalizedPhones.forEach(phone => {
      uniquePhones.add(phone)
      if (!phoneToCandidates.has(phone)) phoneToCandidates.set(phone, [])
      phoneToCandidates.get(phone)!.push(contact)
    })
  })

  // אם כל המספרים דומים/זהים – משאירים רשומה אחת עם השם הכי הגיוני.
  if (uniquePhones.size <= 1) {
    return [pickBestContact(contacts)]
  }

  // אם יש מספרים שונים – שומרים רשומה מיטבית לכל מספר, עם איחוד ללא כפילויות.
  const keep = new Map<string, Contact>()
  uniquePhones.forEach(phone => {
    const candidates = phoneToCandidates.get(phone) ?? []
    if (candidates.length === 0) return
    const best = pickBestContact(candidates)
    keep.set(best.id, best)
  })

  if (keep.size === 0) return [pickBestContact(contacts)]
  return [...keep.values()]
}

function normalizeNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'`׳״.,/\\()\[\]{}\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactNameForMatch(value: string): string {
  return normalizeNameForMatch(value).replace(/\s+/g, '')
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[a.length][b.length]
}

function areLikelySameName(a: Contact, b: Contact): boolean {
  const nameA = compactNameForMatch([a.firstName, a.lastName].filter(Boolean).join(' ') || a.name)
  const nameB = compactNameForMatch([b.firstName, b.lastName].filter(Boolean).join(' ') || b.name)
  if (!nameA || !nameB) return false
  if (nameA === nameB) return true

  const minLen = Math.min(nameA.length, nameB.length)
  if (minLen < 4) return false

  const distance = levenshteinDistance(nameA, nameB)
  return distance <= 1 || (distance <= 2 && minLen >= 7)
}

function analyzeNamesForManualEdit(contacts: Contact[]): ManualEditIssue[] {
  function detectIssues(value: string): NameEditIssueType[] {
    const issues: NameEditIssueType[] = []
    if (!value || !value.trim()) return issues
    
    if (/\d/.test(value)) issues.push('hasDigits')
    if (/\s{2,}/.test(value)) issues.push('hasExtraSpaces')
    if (/[()[\]{}<>]/.test(value)) issues.push('hasSymbols')
    if (/[!@#$%^&*=+|\\~`]/.test(value)) issues.push('hasSpecialChars')
    if (/[א-תשׁ][ִיֵּ]|[ּ-ׂ]/.test(value)) issues.push('hasWeirdChars')
    
    // Roman numerals detection - look for patterns like I, II, III, IV, V, VI, VII, VIII, IX, X
    if (/\b([IVX]{1,3})\b/i.test(value) && !/israel|israel|IV|IV/i.test(value)) {
      issues.push('hasRomanNumerals')
    }
    
    return issues
  }

  const analyzed: ManualEditIssue[] = []
  for (const c of contacts) {
    const firstIssues = detectIssues(c.firstName)
    const lastIssues = detectIssues(c.lastName)
    
    if (firstIssues.length === 0 && lastIssues.length === 0) continue
    
    const allIssues = [...new Set([...firstIssues, ...lastIssues])]
    const totalCount = firstIssues.length + lastIssues.length
    const severity = Math.min(5, Math.max(1, totalCount))
    
    analyzed.push({
      contactId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: c.name || formatNameDisplay(c.firstName, c.lastName) || 'ללא שם',
      issueTypes: allIssues,
      severity,
    })
  }

  // Sort by severity (descending), then by issue type count
  return analyzed.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    return b.issueTypes.length - a.issueTypes.length
  })
}

async function detectDuplicates(
  contacts: Contact[],
  onProgress?: (percent: number, stage: string) => void,
): Promise<DuplicateGroup[]> {
  const idToContact = new Map(contacts.map(c => [c.id, c] as const))
  const adj = new Map<string, Set<string>>()
  const idReasons = new Map<string, Set<string>>()

  const report = (percent: number, stage: string) => {
    onProgress?.(Math.max(0, Math.min(100, Math.round(percent))), stage)
  }

  const yieldToUI = async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  const ensureNode = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Set())
    if (!idReasons.has(id)) idReasons.set(id, new Set())
  }

  const connect = (a: string, b: string, reason: string) => {
    if (a === b) return
    ensureNode(a)
    ensureNode(b)
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
    idReasons.get(a)!.add(reason)
    idReasons.get(b)!.add(reason)
  }

  contacts.forEach(c => ensureNode(c.id))
  report(2, 'מאתחל נתונים')
  await yieldToUI()

  const phoneMap = new Map<string, string[]>()

  for (const c of contacts) {
    for (const p of c.phones) {
      const norm = normalizePhone(p)
      if (norm.length < 5) continue
      if (!phoneMap.has(norm)) phoneMap.set(norm, [])
      phoneMap.get(norm)!.push(c.id)
    }
  }
  report(15, 'מספרי טלפון נסרקו')
  await yieldToUI()

  const phoneEntries = [...phoneMap.entries()]
  for (const [phone, ids] of phoneEntries) {
    const unique = [...new Set(ids)]
    if (unique.length < 2) continue
    for (let a = 0; a < unique.length; a++) {
      for (let b = a + 1; b < unique.length; b++) {
        connect(unique[a], unique[b], `טלפון זהה: ${phone}`)
      }
    }
  }
  report(30, 'קישור לפי טלפונים הושלם')
  await yieldToUI()

  const nameBuckets = new Map<string, Contact[]>()
  contacts.forEach(c => {
    const raw = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.name
    const key = compactNameForMatch(raw)
    if (key.length < 3) return
    if (!nameBuckets.has(key)) nameBuckets.set(key, [])
    nameBuckets.get(key)!.push(c)
  })
  report(40, 'נרמול שמות הושלם')
  await yieldToUI()

  for (const [keyName, bucket] of nameBuckets.entries()) {
    const uniqueIds = [...new Set(bucket.map(c => c.id))].sort()
    if (uniqueIds.length < 2) continue
    for (let a = 0; a < uniqueIds.length; a++) {
      for (let b = a + 1; b < uniqueIds.length; b++) {
        connect(uniqueIds[a], uniqueIds[b], `שם זהה/דומה: ${keyName}`)
      }
    }
  }
  report(50, 'קישור לפי שם זהה הושלם')
  await yieldToUI()

  // Fuzzy name comparison in coarse buckets to reduce heavy O(n^2) on all contacts.
  const fuzzyBuckets = new Map<string, Contact[]>()
  for (const c of contacts) {
    const key = compactNameForMatch([c.firstName, c.lastName].filter(Boolean).join(' ') || c.name)
    if (key.length < 4) continue
    const bucketKey = `${key.slice(0, 1)}:${Math.floor(key.length / 2)}`
    if (!fuzzyBuckets.has(bucketKey)) fuzzyBuckets.set(bucketKey, [])
    fuzzyBuckets.get(bucketKey)!.push(c)
  }

  const fuzzyEntries = [...fuzzyBuckets.entries()]
  for (let bi = 0; bi < fuzzyEntries.length; bi++) {
    const [, bucket] = fuzzyEntries[bi]
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]
        const b = bucket[j]
        const lenDiff = Math.abs(compactNameForMatch(a.name).length - compactNameForMatch(b.name).length)
        if (lenDiff > 2) continue
        if (!areLikelySameName(a, b)) continue
        connect(a.id, b.id, 'שם דומה (fuzzy)')
      }
    }

    if (bi % 10 === 0) {
      report(50 + (bi / Math.max(1, fuzzyEntries.length)) * 35, 'בודק דמיון שמות')
      await yieldToUI()
    }
  }
  report(85, 'דמיון שמות הושלם')
  await yieldToUI()

  const visited = new Set<string>()
  const groups: DuplicateGroup[] = []

  const allNodeIds = [...adj.keys()]
  for (const id of allNodeIds) {
    if (visited.has(id)) continue
    const stack = [id]
    const component: string[] = []
    visited.add(id)

    while (stack.length) {
      const cur = stack.pop()!
      component.push(cur)
      for (const next of adj.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          stack.push(next)
        }
      }
    }

    if (component.length < 2) continue
    const contactsInGroup = component
      .map(cid => idToContact.get(cid))
      .filter((c): c is Contact => Boolean(c))

    const reasons = [...new Set(component.flatMap(cid => [...(idReasons.get(cid) ?? [])]))]

    groups.push({
      groupId: uid(),
      reasons,
      contacts: contactsInGroup,
    })

  }

  report(100, 'הזיהוי הושלם')
  return groups
}

/** תיקון טכני בלבד: רווחים מיותרים בשדות שם. ללא פיצול בין שדות. */
function suggestNameFixes(contacts: Contact[]): NameFixSuggestion[] {
  const normalizeSpaces = (v: string) => v.replace(/\s+/g, ' ').trim()
  const compact = (v: string) => normalizeSpaces(v).replace(/\s+/g, '')
  const tokenCount = (v: string) => normalizeSpaces(v).split(' ').filter(Boolean).length

  const vocabularyCounts = new Map<string, number>()
  contacts.forEach(c => {
    const addTokens = (txt: string) => {
      normalizeSpaces(txt)
        .split(' ')
        .map(t => t.trim())
        .filter(t => t.length >= 2)
        .forEach(t => {
          vocabularyCounts.set(t, (vocabularyCounts.get(t) ?? 0) + 1)
        })
    }
    addTokens(c.firstName || '')
    addTokens(c.lastName || '')
  })

  const splitByDictionary = (
    field: 'firstName' | 'lastName',
    value: string,
  ): Array<{ text: string; confidence: number; reason: string; module: NameFixModule }> => {
    const raw = compact(value)
    if (raw.length < 4) return []
    const rawIsKnownWhole = field === 'firstName'
      ? COMMON_HE_FIRST_NAMES.has(raw)
      : COMMON_HE_LAST_NAMES.has(raw)
    if (rawIsKnownWhole) return []

    const matches: Array<{
      text: string
      confidence: number
      reason: string
      rank: number
      kind: 'strict' | 'vocab' | 'oneKnown'
      knownToken: string
      module: NameFixModule
    }> = []
    for (let i = 2; i <= raw.length - 2; i++) {
      const left = raw.slice(0, i)
      const right = raw.slice(i)

      const leftIsFirst = COMMON_HE_FIRST_NAMES.has(left)
      const rightIsFirst = COMMON_HE_FIRST_NAMES.has(right)
      const leftIsLast = COMMON_HE_LAST_NAMES.has(left)
      const rightIsLast = COMMON_HE_LAST_NAMES.has(right)

      const firstLast = leftIsFirst && rightIsLast
      const lastFirst = leftIsLast && rightIsFirst
      const firstFirst = field === 'firstName' && leftIsFirst && rightIsFirst
      const lastLast = field === 'lastName' && leftIsLast && rightIsLast
      const vocabSplit = (vocabularyCounts.get(left) ?? 0) >= 2 && (vocabularyCounts.get(right) ?? 0) >= 2

      if (firstLast || lastFirst || firstFirst || lastLast || vocabSplit) {
        const knownToken = ''
        const confidence = firstLast
          ? 0.99
          : lastFirst
            ? 0.97
            : (firstFirst || lastLast)
              ? 0.93
              : 0.84
        const leftCount = vocabularyCounts.get(left) ?? 0
        const rightCount = vocabularyCounts.get(right) ?? 0
        const reason = (firstLast || lastFirst)
          ? 'הפרדת שם מחובר לפי מילון'
          : (firstFirst || lastLast)
            ? 'הפרדת שם מחובר לפי מילון שמות'
            : `הפרדת שם מחובר לפי שימוש חוזר בשדות שם ברשימה: ${left} (${leftCount}), ${right} (${rightCount})`
        const module: NameFixModule = (firstLast || lastFirst)
          ? 'dictionary'
          : (firstFirst || lastLast)
            ? 'dictionaryNames'
            : 'vocabulary'
        const rank = 0
        const kind: 'strict' | 'vocab' | 'oneKnown' = (firstLast || lastFirst || firstFirst || lastLast)
          ? 'strict'
          : 'vocab'
        matches.push({ text: `${left} ${right}`, confidence, reason, rank, kind, knownToken, module })
      }
    }

    if (matches.length === 0) return []

    const deduped = new Map<string, {
      text: string
      confidence: number
      reason: string
      rank: number
      kind: 'strict' | 'vocab' | 'oneKnown'
      knownToken: string
      module: NameFixModule
    }>()
    matches.forEach(match => {
      const prev = deduped.get(match.text)
      if (!prev || match.confidence > prev.confidence || (match.confidence === prev.confidence && match.rank > prev.rank)) {
        deduped.set(match.text, match)
      }
    })

    const all = [...deduped.values()].sort((a, b) => b.confidence - a.confidence || b.rank - a.rank)
    const primary = all.filter(m => m.kind !== 'oneKnown')
    const oneKnown = all.filter(m => m.kind === 'oneKnown')

    const chosenOneKnown: typeof oneKnown = []
    const usedKnownTokens = new Set<string>()
    for (const candidate of oneKnown) {
      if (usedKnownTokens.has(candidate.knownToken)) continue
      chosenOneKnown.push(candidate)
      usedKnownTokens.add(candidate.knownToken)
      if (chosenOneKnown.length >= 2) break
    }

    return [...primary, ...chosenOneKnown]
      .sort((a, b) => b.confidence - a.confidence || b.rank - a.rank)
      .slice(0, 4)
      .map(match => ({ text: match.text, confidence: match.confidence, reason: match.reason, module: match.module }))
  }

  const fixes: NameFixSuggestion[] = []
  for (const c of contacts) {
    for (const field of ['firstName', 'lastName'] as const) {
      const original = c[field] || ''
      if (!original.trim()) continue
      const originalTokenCount = tokenCount(original)

      const candidates: Array<{ suggested: string; reason: string; confidence: number; module: NameFixModule }> = []

      const spacing = normalizeSpaces(original)
      if (spacing !== original) {
        candidates.push({ suggested: spacing, reason: 'רווחים מיותרים', confidence: 1, module: 'spacing' })
      }

      const spacingTokens = spacing.split(' ').filter(Boolean)
      spacingTokens.forEach((token, tokenIndex) => {
        const splitCandidates = splitByDictionary(field, token)
        splitCandidates.forEach(splitCandidate => {
          const rebuiltTokens = [...spacingTokens]
          rebuiltTokens[tokenIndex] = splitCandidate.text
          const rebuilt = rebuiltTokens.join(' ')
          if (rebuilt !== original) {
            candidates.push({ suggested: rebuilt, reason: splitCandidate.reason, confidence: splitCandidate.confidence, module: splitCandidate.module })
          }
        })
      })

      if (candidates.length === 0) continue
      const uniqueCandidates = new Map<string, { suggested: string; reason: string; confidence: number; module: NameFixModule }>()
      candidates.forEach(candidate => {
        const normalizedSuggested = normalizeSpaces(candidate.suggested)
        if (!normalizedSuggested || normalizedSuggested === original) return
        if (tokenCount(normalizedSuggested) < originalTokenCount) return
        const prev = uniqueCandidates.get(normalizedSuggested)
        if (!prev || candidate.confidence > prev.confidence) {
          uniqueCandidates.set(normalizedSuggested, {
            suggested: normalizedSuggested,
            reason: candidate.reason,
            confidence: candidate.confidence,
            module: candidate.module,
          })
        }
      })

      const sortedCandidates = [...uniqueCandidates.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 4)
      const contactLabel = (c.name || formatNameDisplay(c.firstName, c.lastName) || 'ללא שם').trim()
      sortedCandidates.forEach(candidate => {
        fixes.push({
          key: `${c.id}:${field}:${candidate.suggested}`,
          contactId: c.id,
          contactName: contactLabel,
          field,
          original,
          suggested: candidate.suggested,
          module: candidate.module,
          reason: candidate.reason,
          confidence: candidate.confidence,
        })
      })
    }
  }
  return fixes
}

/* ── App ────────────────────────────────────────────────── */
export default function App() {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) { localStorage.removeItem(STORAGE_KEY); return [] }
      return parsed.map((c: Contact) => ({
        id: c.id ?? uid(),
        name: c.name ?? '',
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        phones: Array.isArray(c.phones) ? c.phones : [],
        emails: Array.isArray(c.emails) ? c.emails : [],
        source: c.source ?? '',
        rev: c.rev,
        notes: c.notes,
      }))
    } catch { localStorage.removeItem(STORAGE_KEY); return [] }
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isBulkEditMode, setIsBulkEditMode] = useState(false)
  const [bulkEditValues, setBulkEditValues] = useState<Record<string, BulkEditContactValues>>({})
  const [activeTab, setActiveTab] = useState<'contacts' | 'duplicates' | 'namefix' | 'manual-edit'>('contacts')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'firstName' | 'lastName' | 'source' | 'phones'>('firstName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null)
  const [cleanupResult, setCleanupResult] = useState<RecommendationCleanupResult | null>(null)
  const [nameFixSuggestions, setNameFixSuggestions] = useState<NameFixSuggestion[] | null>(null)
  const [enabledNameFixModules, setEnabledNameFixModules] = useState<Set<NameFixModule>>(
    new Set(NAME_FIX_MODULE_OPTIONS.map(option => option.id)),
  )
  const [nameFixResultMode, setNameFixResultMode] = useState<NameFixResultMode>('all')
  const [nameFixMinStars, setNameFixMinStars] = useState<NameFixStarFilter>(0)
  const [manualNameFixValues, setManualNameFixValues] = useState<Record<string, string>>({})
  const [selectedNameFixIds, setSelectedNameFixIds] = useState<Set<string>>(new Set())
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set())
  const [statusMsg, setStatusMsg] = useState('')
  const [detectProgress, setDetectProgress] = useState<{ percent: number; stage: string } | null>(null)
  const [importTelemetry, setImportTelemetry] = useState<ImportTelemetry | null>(null)
  const [isDuplicateEditOpen, setIsDuplicateEditOpen] = useState(false)
  const [editFields, setEditFields] = useState<Partial<Contact>>({})
  const [manualEditIssues, setManualEditIssues] = useState<ManualEditIssue[] | null>(null)
  const [manualEditValues, setManualEditValues] = useState<Record<string, { firstName: string; lastName: string }>>({})
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState(false)
  const [dictionaryInput, setDictionaryInput] = useState('')
  const [dictionaryType, setDictionaryType] = useState<'first' | 'last'>('first')
  const [duplicatesDeletedTotal, setDuplicatesDeletedTotal] = useState(0)
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false)
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [conversionStage, setConversionStage] = useState<'confirm' | 'processing' | 'ready' | 'failed'>('confirm')
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([])
  const [conversionContacts, setConversionContacts] = useState<Contact[]>([])
  const [conversionDetails, setConversionDetails] = useState<string[]>([])
  const [importFileSummaries, setImportFileSummaries] = useState<ImportFileSummary[]>([])
  const importFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const allowedModules = new Set(NAME_FIX_MODULE_OPTIONS.map(option => option.id))
    setEnabledNameFixModules(prev => {
      const next = new Set([...prev].filter(module => allowedModules.has(module)))
      return next.size === prev.size ? prev : next
    })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts)) } catch { /* quota */ }
  }, [contacts])

  const selectedContact = useMemo(
    () => contacts.find(c => c.id === selectedId) ?? null,
    [contacts, selectedId]
  )

  const filteredNameFixSuggestions = useMemo(() => {
    if (!nameFixSuggestions) return []
    return nameFixSuggestions.filter(suggestion =>
      enabledNameFixModules.has(suggestion.module) &&
      (nameFixMinStars === 0 || confidenceToStars(suggestion.confidence) >= nameFixMinStars),
    )
  }, [nameFixSuggestions, enabledNameFixModules, nameFixMinStars])

  const groupedNameFixSuggestions = useMemo(() => {
    if (filteredNameFixSuggestions.length === 0) return []
    const groups = new Map<string, {
      key: string
      contactId: string
      contactName: string
      field: 'firstName' | 'lastName'
      original: string
      suggestions: NameFixSuggestion[]
    }>()

    for (const suggestion of filteredNameFixSuggestions) {
      const groupKey = `${suggestion.contactId}:${suggestion.field}`
      const existing = groups.get(groupKey)
      if (!existing) {
        groups.set(groupKey, {
          key: groupKey,
          contactId: suggestion.contactId,
          contactName: suggestion.contactName,
          field: suggestion.field,
          original: suggestion.original,
          suggestions: [suggestion],
        })
      } else {
        existing.suggestions.push(suggestion)
      }
    }

    return [...groups.values()].map(group => ({
      ...group,
      suggestions: group.suggestions.sort((a, b) => b.confidence - a.confidence),
    }))
  }, [filteredNameFixSuggestions])

  const visibleGroupedNameFixSuggestions = useMemo(() => {
    if (nameFixResultMode === 'single') {
      return groupedNameFixSuggestions.filter(group => group.suggestions.length === 1)
    }
    if (nameFixResultMode === 'multiple') {
      return groupedNameFixSuggestions.filter(group => group.suggestions.length > 1)
    }
    return groupedNameFixSuggestions
  }, [groupedNameFixSuggestions, nameFixResultMode])

  const visibleNameFixSuggestions = useMemo(
    () => visibleGroupedNameFixSuggestions.flatMap(group => group.suggestions),
    [visibleGroupedNameFixSuggestions],
  )

  useEffect(() => {
    if (!nameFixSuggestions) return
    const visibleKeys = new Set(visibleNameFixSuggestions.map(suggestion => suggestion.key))
    setSelectedNameFixIds(prev => {
      let changed = false
      const next = new Set<string>()
      prev.forEach(key => {
        if (visibleKeys.has(key)) next.add(key)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [nameFixSuggestions, visibleNameFixSuggestions])

  const selectedVisibleNameFixCount = useMemo(
    () => visibleNameFixSuggestions.filter(suggestion => selectedNameFixIds.has(suggestion.key)).length,
    [visibleNameFixSuggestions, selectedNameFixIds],
  )

  useEffect(() => {
    if (!nameFixSuggestions) setManualNameFixValues({})
  }, [nameFixSuggestions])

  useEffect(() => {
    if (selectedContact) setEditFields({ ...selectedContact })
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleContacts = useMemo(() => {
    let list = contacts
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phones.some(p => p.includes(q)) ||
        c.source.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let av = '', bv = ''
      if (sortBy === 'phones') { av = String(a.phones.length).padStart(6, '0'); bv = String(b.phones.length).padStart(6, '0') }
      else { av = (a[sortBy] || '').toString(); bv = (b[sortBy] || '').toString() }
      return sortDir === 'asc' ? av.localeCompare(bv, 'he') : bv.localeCompare(av, 'he')
    })
  }, [contacts, searchTerm, sortBy, sortDir])

  const stats = useMemo(() => ({
    total: contacts.length,
    withPhone: contacts.filter(c => c.phones.length > 0).length,
    sources: new Set(contacts.map(c => c.source)).size,
  }), [contacts])
  const clientBootAt = useMemo(() => new Date().toLocaleTimeString('he-IL'), [])

  async function extractContactsFromFiles(
    picked: File[],
    pushDetail: (msg: string) => void,
    onFileParsed?: (summary: ImportFileSummary) => void,
  ): Promise<ParsedImportBatch> {
    const pickedByBase = new Map<string, Set<string>>()
    picked.forEach(file => {
      const base = fileBaseName(file.name)
      const ext = fileExt(file.name)
      if (!pickedByBase.has(base)) pickedByBase.set(base, new Set())
      pickedByBase.get(base)!.add(ext)
    })

    const allNew: Contact[] = []
    let failed = 0
    let parseErrors = 0
    let importedFiles = 0

    for (const file of picked) {
      try {
        const ext = fileExt(file.name)
        if (!['vcf', 'ib', 'in'].includes(ext)) {
          pushDetail(`דולג על ${file.name} (נתמכים רק VCF ו-IB)`)
          continue
        }

        const base = fileBaseName(file.name)
        const siblings = pickedByBase.get(base)

        if (ext === 'in' && siblings?.has('ib')) {
          pushDetail(`דולג על ${file.name} (קובץ כותרת). יש זוג נתונים ${base}.ib`)
          continue
        }

        pushDetail(`קורא: ${file.name}`)
        const buf = await file.arrayBuffer()
        const parsedAny = parseContactsFromAnyBuffer(buf, file.name)
        onFileParsed?.({
          name: file.name,
          contacts: parsedAny.contacts.length,
          details: parsedAny.details,
        })

        if (parsedAny.contacts.length > 0) {
          allNew.push(...parsedAny.contacts)
          importedFiles++
          pushDetail(`נקלט: ${file.name} | אנשי קשר: ${parsedAny.contacts.length} | זיהוי: ${parsedAny.details}`)
        } else {
          pushDetail(`לא זוהו אנשי קשר: ${file.name}`)
        }
      } catch {
        failed++
        parseErrors++
        pushDetail(`נכשל: ${file.name}`)
      }
    }

    return {
      contacts: normalizeImportedContacts(allNew, {
        keepNameOnly: picked.some(file => fileExt(file.name) === 'ib'),
        allowExactDedup: !picked.some(file => fileExt(file.name) === 'ib'),
      }),
      failed,
      parseErrors,
      importedFiles,
    }
  }

  function startConversionFlow(files: File[]) {
    setPendingUploadFiles(files)
    setConversionContacts([])
    setConversionDetails([])
    setImportFileSummaries([])
    setConversionStage('confirm')
    setIsConversionModalOpen(true)
  }

  async function runPendingConversion(filesOverride?: File[]) {
    const filesToImport = filesOverride ?? pendingUploadFiles
    if (filesToImport.length === 0) return

    setPendingUploadFiles(filesToImport)
    setConversionStage('processing')
    setImportTelemetry({
      startedAt: new Date().toLocaleTimeString('he-IL'),
      mode: 'append',
      files: filesToImport.map(file => `${file.name} (${file.size}B)`),
      details: ['התחלת טעינת קבצים...'],
    })
    const details: string[] = []
    const pushDetail = (msg: string) => {
      details.push(msg)
      setConversionDetails([...details])
      setImportTelemetry(prev => prev ? { ...prev, details: [...details] } : prev)
    }

    const fileSummaries: ImportFileSummary[] = []
    const parsed = await extractContactsFromFiles(
      filesToImport,
      pushDetail,
      (summary) => {
        fileSummaries.push(summary)
        setImportFileSummaries([...fileSummaries])
      },
    )
    if (parsed.contacts.length === 0) {
      setConversionContacts([])
      setConversionStage('failed')
      setStatusMsg('ייבוא נכשל: לא זוהו אנשי קשר מהקבצים')
      return
    }

    setContacts(prev => [...prev, ...parsed.contacts])
    setSearchTerm('')
    setDuplicateGroups(null)
    setCleanupResult(null)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setConversionContacts(parsed.contacts)
    setConversionStage('ready')
    setStatusMsg(`נוספו ${parsed.contacts.length} אנשי קשר מהייבוא`)
  }

  function handleUploadSelection(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    const picked = Array.from(files)
    const supported = picked.filter(file => ['vcf', 'ib'].includes(fileExt(file.name)))

    if (supported.length !== picked.length) {
      setStatusMsg('ניתן לייבא רק קבצי VCF או IB')
    }

    if (supported.length === 0) return
    startConversionFlow(supported)
    void runPendingConversion(supported)
  }

  function openImportModal() {
    setPendingUploadFiles([])
    setConversionContacts([])
    setConversionDetails([])
    setImportFileSummaries([])
    setConversionStage('confirm')
    setIsConversionModalOpen(true)
  }

  function closeImportModal() {
    setIsConversionModalOpen(false)
    setPendingUploadFiles([])
  }

  function openDownloadModal() {
    setIsDownloadModalOpen(true)
  }

  function closeDownloadModal() {
    setIsDownloadModalOpen(false)
  }

  function openSystemFilePicker() {
    importFileInputRef.current?.click()
  }

  function handleDropToImport(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const dropped = Array.from(event.dataTransfer.files ?? [])
    handleUploadSelection(dropped)
  }

  async function handleDetect() {
    if (contacts.length === 0) return
    setActiveTab('duplicates')
    setDetectProgress({ percent: 0, stage: 'מתחיל זיהוי...' })
    try {
      const groups = await detectDuplicates(contacts, (percent, stage) => {
        setDetectProgress({ percent, stage })
      })
      setDuplicateGroups(groups.length ? groups : [])
      setSelectedDuplicateIds(new Set())
      setStatusMsg(groups.length ? `נמצאו ${groups.length} קבוצות כפולות` : 'לא נמצאו כפילויות')
    } finally {
      setTimeout(() => setDetectProgress(null), 500)
    }
  }

  function buildPreferredNameFixSelection(fixes: NameFixSuggestion[]): Set<string> {
    const bestByField = new Map<string, NameFixSuggestion>()
    for (const fix of fixes) {
      const fieldKey = `${fix.contactId}:${fix.field}`
      const prev = bestByField.get(fieldKey)
      if (!prev || fix.confidence > prev.confidence) bestByField.set(fieldKey, fix)
    }
    return new Set([...bestByField.values()].map(f => f.key))
  }

  function handleAddToDictionary() {
    const trimmed = dictionaryInput.trim()
    if (!trimmed) {
      setStatusMsg('הזן שם בבקשה')
      return
    }

    if (dictionaryType === 'first') {
      COMMON_HE_FIRST_NAMES.add(trimmed)
    } else {
      COMMON_HE_LAST_NAMES.add(trimmed)
    }

    setStatusMsg(`נוסף למילון: "${trimmed}" (${dictionaryType === 'first' ? 'שם פרטי' : 'שם משפחה'})`)
    setDictionaryInput('')
    setIsDictionaryModalOpen(false)
  }

  function handleNameFix() {
    setActiveTab('namefix')
    const fixes = suggestNameFixes(contacts)
    setNameFixSuggestions(fixes.length ? fixes : null)
    setSelectedNameFixIds(buildPreferredNameFixSelection(
      fixes.filter(f => enabledNameFixModules.has(f.module) && (nameFixMinStars === 0 || confidenceToStars(f.confidence) >= nameFixMinStars)),
    ))
    setManualNameFixValues({})
    setStatusMsg(fixes.length ? `נמצאו ${fixes.length} תיקוני שמות` : 'אין תיקונים נדרשים')
  }

  function toggleNameFixModule(module: NameFixModule) {
    setEnabledNameFixModules(prev => {
      const next = new Set(prev)
      if (next.has(module)) next.delete(module)
      else next.add(module)
      return next
    })
  }

  function applyManualNameFix(contactId: string, field: 'firstName' | 'lastName', groupKey: string, fallbackOriginal: string) {
    const rawValue = manualNameFixValues[groupKey] ?? fallbackOriginal
    const nextValue = rawValue.replace(/\s+/g, ' ').trim()
    if (!nextValue) return

    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c
      if (field === 'firstName' && c.firstName === nextValue) return c
      if (field === 'lastName' && c.lastName === nextValue) return c
      return field === 'firstName'
        ? { ...c, firstName: nextValue }
        : { ...c, lastName: nextValue }
    }))

    setNameFixSuggestions(prev => {
      if (!prev) return prev
      const next = prev.filter(s => !(s.contactId === contactId && s.field === field))
      return next.length ? next : null
    })

    setSelectedNameFixIds(prev => {
      if (!nameFixSuggestions) return prev
      const blocked = new Set(
        nameFixSuggestions
          .filter(s => s.contactId === contactId && s.field === field)
          .map(s => s.key),
      )
      const next = new Set<string>()
      prev.forEach(key => {
        if (!blocked.has(key)) next.add(key)
      })
      return next
    })

    setManualNameFixValues(prev => {
      const next = { ...prev }
      delete next[groupKey]
      return next
    })

    setStatusMsg(`עודכן ידנית ${field === 'firstName' ? 'שם פרטי' : 'שם משפחה'}`)
  }

  function handleApplyNameFix() {
    if (!nameFixSuggestions) return
    const toApply = nameFixSuggestions.filter(f => selectedNameFixIds.has(f.key))
    const bestByField = new Map<string, NameFixSuggestion>()
    toApply.forEach(fix => {
      const fieldKey = `${fix.contactId}:${fix.field}`
      const prev = bestByField.get(fieldKey)
      if (!prev || fix.confidence > prev.confidence) bestByField.set(fieldKey, fix)
    })

    if (bestByField.size === 0) return

    const appliedFieldKeys = new Set(bestByField.keys())
    const blockedSuggestionKeys = new Set(
      nameFixSuggestions
        .filter(s => appliedFieldKeys.has(`${s.contactId}:${s.field}`))
        .map(s => s.key),
    )

    setContacts(prev => prev.map(c => {
      const firstFix = bestByField.get(`${c.id}:firstName`)
      const lastFix = bestByField.get(`${c.id}:lastName`)
      if (!firstFix && !lastFix) return c
      const updated = { ...c }
      if (firstFix) updated.firstName = firstFix.suggested
      if (lastFix) updated.lastName = lastFix.suggested
      return updated
    }))
    setNameFixSuggestions(prev => {
      if (!prev) return prev
      const next = prev.filter(s => !appliedFieldKeys.has(`${s.contactId}:${s.field}`))
      return next.length ? next : null
    })
    setSelectedNameFixIds(prev => {
      const next = new Set<string>()
      prev.forEach(key => {
        if (!blockedSuggestionKeys.has(key)) next.add(key)
      })
      return next
    })
    setManualNameFixValues(prev => {
      const next = { ...prev }
      appliedFieldKeys.forEach(key => { delete next[key] })
      return next
    })
    setStatusMsg(`הוחלו ${bestByField.size} תיקוני שמות, ניתן להמשיך באותה קטגוריה`)
  }

  function applyRecommendationCleanup() {
    if (!duplicateGroups?.length) return
    const toDelete = new Set<string>()
    const result: RecommendationCleanupResult = { groups: [], keptCount: 0, deletedCount: 0 }

    for (const group of duplicateGroups) {
      const kept = recommendKeepContacts(group.contacts)
      const keepIds = new Set(kept.map(c => c.id))
      const deleted = group.contacts.filter(c => !keepIds.has(c.id))
      deleted.forEach(c => toDelete.add(c.id))
      result.groups.push({ groupId: group.groupId, reasons: group.reasons, kept, deleted })
      result.keptCount += kept.length
      result.deletedCount += deleted.length
    }

    setContacts(prev => prev.filter(c => !toDelete.has(c.id)))
    setDuplicateGroups(null)
    setCleanupResult(result)
    setDuplicatesDeletedTotal(prev => prev + result.deletedCount)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setStatusMsg(`נמחקו ${result.deletedCount} כפילויות, נשמרו ${result.keptCount} אנשי קשר`)
  }

  function restoreDeletedRecommendedContact(groupId: string, contactId: string) {
    if (!cleanupResult) return
    const group = cleanupResult.groups.find(g => g.groupId === groupId)
    const contact = group?.deleted.find(c => c.id === contactId)
    if (!contact) return
    setContacts(prev => [...prev, contact])
    setCleanupResult(prev => prev ? {
      ...prev,
      keptCount: prev.keptCount + 1,
      deletedCount: prev.deletedCount - 1,
      groups: prev.groups.map(g => g.groupId !== groupId ? g : {
        ...g,
        deleted: g.deleted.filter(c => c.id !== contactId),
        kept: [...g.kept, contact],
      }),
    } : prev)
    setDuplicatesDeletedTotal(prev => Math.max(0, prev - 1))
  }

  function saveEdit() {
    if (!selectedId) return
    const patch = { ...editFields } as Partial<Contact>
    setContacts(prev => prev.map(c => c.id === selectedId ? { ...c, ...patch } as Contact : c))
    setDuplicateGroups(prev => prev?.map(g => ({
      ...g,
      contacts: g.contacts.map(c => c.id === selectedId ? { ...c, ...patch } as Contact : c),
    })) ?? null)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setStatusMsg('נשמר')
  }

  function splitMultiValue(input: string): string[] {
    return input
      .split(/[\n,;]+/)
      .map(value => value.trim())
      .filter(Boolean)
  }

  function enterBulkEditMode() {
    const initialValues: Record<string, BulkEditContactValues> = {}
    contacts.forEach(contact => {
      initialValues[contact.id] = {
        firstName: contact.firstName ?? '',
        lastName: contact.lastName ?? '',
        phonesText: (contact.phones ?? []).join('\n'),
        emailsText: (contact.emails ?? []).join('\n'),
      }
    })

    setBulkEditValues(initialValues)
    setIsBulkEditMode(true)
    setStatusMsg('מצב עריכה כללית הופעל')
  }

  function saveBulkEditChanges() {
    if (!isBulkEditMode) return

    setContacts(prev => prev.map(contact => {
      const values = bulkEditValues[contact.id]
      if (!values) return contact

      const firstName = values.firstName.trim()
      const lastName = values.lastName.trim()
      const phones = splitMultiValue(values.phonesText)
      const emails = splitMultiValue(values.emailsText)

      return {
        ...contact,
        firstName,
        lastName,
        name: formatNameDisplay(firstName, lastName),
        phones,
        emails,
      }
    }))

    setIsBulkEditMode(false)
    setBulkEditValues({})
    setStatusMsg('נשמרו כל השינויים ברשימה')
  }

  function cancelBulkEditChanges() {
    setIsBulkEditMode(false)
    setBulkEditValues({})
    setStatusMsg('עריכה כללית בוטלה')
  }

  function deleteContact(id: string) {
    setContacts(prev => prev.filter(c => c.id !== id))
    setDuplicateGroups(prev => prev?.map(g => ({ ...g, contacts: g.contacts.filter(c => c.id !== id) })).filter(g => g.contacts.length > 1) ?? null)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setSelectedDuplicateIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (selectedId === id) setSelectedId(null)
    setStatusMsg('נמחק')
  }

  function toggleDuplicateSelection(contactId: string) {
    setSelectedDuplicateIds(prev => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  function toggleAllInGroupSelection(groupId: string) {
    const group = duplicateGroups?.find(g => g.groupId === groupId)
    if (!group) return

    const groupIds = group.contacts.map(c => c.id)
    const allSelected = groupIds.length > 0 && groupIds.every(id => selectedDuplicateIds.has(id))

    setSelectedDuplicateIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        groupIds.forEach(id => next.delete(id))
      } else {
        groupIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function openDuplicateQuickEdit(contact: Contact) {
    setSelectedId(contact.id)
    setEditFields({ ...contact })
    setIsDuplicateEditOpen(true)
  }

  function deleteSelectedInGroup(groupId: string) {
    const group = duplicateGroups?.find(g => g.groupId === groupId)
    if (!group) return

    const selected = new Set(group.contacts.filter(c => selectedDuplicateIds.has(c.id)).map(c => c.id))
    if (selected.size === 0) return

    setContacts(prev => prev.filter(c => !selected.has(c.id)))
    setDuplicateGroups(prev => prev
      ?.map(g => ({ ...g, contacts: g.contacts.filter(c => !selected.has(c.id)) }))
      .filter(g => g.contacts.length > 1) ?? null)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setSelectedDuplicateIds(prev => {
      const next = new Set(prev)
      selected.forEach(id => next.delete(id))
      return next
    })
    setDuplicatesDeletedTotal(prev => prev + selected.size)
    setStatusMsg(`נמחקו ${selected.size} נבחרים מהקבוצה`)
  }

  function keepOnlySelectedInGroup(groupId: string) {
    const group = duplicateGroups?.find(g => g.groupId === groupId)
    if (!group) return

    const selected = new Set(group.contacts.filter(c => selectedDuplicateIds.has(c.id)).map(c => c.id))
    if (selected.size === 0) return

    const toDelete = new Set<string>()

    group.contacts.forEach(c => {
      if (!selected.has(c.id)) toDelete.add(c.id)
    })

    if (toDelete.size === 0) return
    setContacts(prev => prev.filter(c => !toDelete.has(c.id)))
    setDuplicateGroups(prev => prev
      ?.map(g => ({ ...g, contacts: g.contacts.filter(c => !toDelete.has(c.id)) }))
      .filter(g => g.contacts.length > 1) ?? null)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setSelectedDuplicateIds(prev => {
      const next = new Set(prev)
      toDelete.forEach(id => next.delete(id))
      return next
    })
    setDuplicatesDeletedTotal(prev => prev + toDelete.size)
    setStatusMsg(`נמחקו ${toDelete.size} לא-נבחרים מהקבוצה`)
  }

  function deleteContactsWithoutPhone() {
    const hasPhone = (contact: Contact) =>
      contact.phones.some(phone => looksLikePhone(sanitizePhoneValue(phone)))

    const removed = contacts.filter(contact => !hasPhone(contact)).length
    if (removed === 0) {
      setStatusMsg('לא נמצאו אנשי קשר ללא מספר')
      return
    }

    setContacts(prev => prev.filter(contact => hasPhone(contact)))
    setSelectedId(null)
    setDuplicateGroups(null)
    setSelectedDuplicateIds(new Set())
    setCleanupResult(null)
    setNameFixSuggestions(null)
    setSelectedNameFixIds(new Set())
    setStatusMsg(`נמחקו ${removed} אנשי קשר ללא מספר`)
  }

  function clearAllContacts() {
    setContacts([])
    setDuplicateGroups(null)
    setSelectedDuplicateIds(new Set())
    setCleanupResult(null)
    setNameFixSuggestions(null)
    setSelectedId(null)
    setStatusMsg('הכל נמחק')
  }

  function toggleNameFixId(key: string) {
    setSelectedNameFixIds(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="app-shell" dir="rtl">

      {/* Header */}
      <header className="app-header">
        <div className="header-quick-actions">
          <button
            type="button"
            className="download-action"
            onClick={openDownloadModal}
          >
            הורדת תוכנה
          </button>
          <button
            type="button"
            onClick={() => exportVcf(visibleContacts)}
            disabled={visibleContacts.length === 0}
          >
            ייצוא
          </button>
          <button type="button" className="header-upload-btn" onClick={openImportModal}>
            ייבוא
          </button>
          <button
            type="button"
            className="danger-action"
            onClick={clearAllContacts}
            disabled={contacts.length === 0}
          >
            נקה הכל
          </button>
        </div>
        <div className="header-main">
          <img className="brand-banner-logo" src="logos/logo-01-clean.svg?v=5" alt="OneRoster" />
          <h1 className="brand-title">OneRoster</h1>
        </div>
      </header>

      <section className="home-tabs" role="tablist" aria-label="ניווט ראשי">
        <button
          role="tab"
          aria-selected={activeTab === 'contacts'}
          className={activeTab === 'contacts' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('contacts')}
        >
          אנשי קשר
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'duplicates'}
          className={activeTab === 'duplicates' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('duplicates')}
        >
          זיהוי כפולים
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'namefix'}
          className={activeTab === 'namefix' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('namefix')}
        >
          תיקון שמות
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'manual-edit'}
          className={activeTab === 'manual-edit' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => {
            setActiveTab('manual-edit')
            if (!manualEditIssues) setManualEditIssues(analyzeNamesForManualEdit(contacts))
          }}
        >
          עריכה ידנית
        </button>
      </section>

      <section className="top-status-grid">
        <div className="kpi-grid">
          <article className="kpi-card kpi-card--contacts">
            <span className="kpi-label">אנשי קשר</span>
            <strong className="kpi-value">{stats.total.toLocaleString('he-IL')}</strong>
            <small className="kpi-meta">סה"כ במערכת</small>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">מקורות</span>
            <strong className="kpi-value">{stats.sources.toLocaleString('he-IL')}</strong>
            <small className="kpi-meta">קבצי מקור</small>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">עם מספר</span>
            <strong className="kpi-value">{stats.withPhone.toLocaleString('he-IL')}</strong>
            <small className="kpi-meta">כולל טלפון</small>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">כפולים שנמחקו</span>
            <strong className="kpi-value">{duplicatesDeletedTotal.toLocaleString('he-IL')}</strong>
            <small className="kpi-meta">מאז פתיחת המערכת</small>
          </article>
        </div>

        <article className="import-status-card import-status-card--minimal">
          <h3>ייבוא אחרון</h3>
          <p>
            {importTelemetry
              ? `${importTelemetry.startedAt} · ${importTelemetry.mode === 'replace' ? 'החלפה' : 'הוספה'} · ${importTelemetry.files.length} קבצים`
              : 'עדיין לא בוצע ייבוא בסשן הזה.'}
          </p>
          {importTelemetry && (
            <>
              <p>{importTelemetry.files.join(' · ')}</p>
              <p>{importTelemetry.details.slice(-1).join('')}</p>
            </>
          )}
          <p>נפתח: {clientBootAt}</p>
          {detectProgress && (
            <div className="detect-progress-strip">
              <div>זיהוי כפילויות: {detectProgress.stage} ({detectProgress.percent}%)</div>
              <div className="detect-progress-bar">
                <span style={{ width: `${detectProgress.percent}%` }} />
              </div>
            </div>
          )}
          {statusMsg && <p>{statusMsg}</p>}
        </article>
      </section>

      {/* Cleanup report */}
      {activeTab === 'duplicates' && cleanupResult && (
        <section className="cleanup-report">
          <header>
            <h2>דוח ניקוי כפילויות</h2>
            <div className="cleanup-summary-row">
              <span>נשמרו: {cleanupResult.keptCount}</span>
              <span>נמחקו: {cleanupResult.deletedCount}</span>
              <span>קבוצות: {cleanupResult.groups.length}</span>
            </div>
            <button onClick={() => setCleanupResult(null)}>סגור</button>
          </header>
          <div className="cleanup-groups">
            {cleanupResult.groups.map(group => (
              <div key={group.groupId} className="cleanup-group-report">
                <h3>סיבה: {group.reasons.join(' | ')}</h3>
                <div className="cleanup-grid">
                  <div className="cleanup-col">
                    <h3>נשמרו ({group.kept.length})</h3>
                    <ul>
                      {group.kept.map(c => (
                        <li key={c.id}>
                          <div className="cleanup-contact-info">
                            <strong>{c.name}</strong>
                            <span>{c.phones.join(', ')}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{c.source}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="cleanup-col">
                    <h3>נמחקו ({group.deleted.length})</h3>
                    <ul>
                      {group.deleted.map(c => (
                        <li key={c.id}>
                          <div className="cleanup-contact-info">
                            <strong>{c.name}</strong>
                            <span>{c.phones.join(', ')}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{c.source}</span>
                          </div>
                          <button onClick={() => restoreDeletedRecommendedContact(group.groupId, c.id)}>שחזר</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Name fix suggestions */}
      {activeTab === 'namefix' && nameFixSuggestions && nameFixSuggestions.length > 0 && (
        <section className="split-preview">
          <header>
            <h2>תיקוני שמות ({visibleGroupedNameFixSuggestions.length} שדות)</h2>
            <div className="split-actions">
              <button onClick={() => setIsDictionaryModalOpen(true)}>📚 הוסף למילון</button>
              <button onClick={() => setSelectedNameFixIds(new Set(visibleNameFixSuggestions.map(f => f.key)))}>בחר הכל</button>
              <button onClick={() => setSelectedNameFixIds(buildPreferredNameFixSelection(visibleNameFixSuggestions))}>בחר מומלצים</button>
              <button onClick={() => setSelectedNameFixIds(new Set())}>בטל הכל</button>
              <button onClick={handleApplyNameFix} disabled={selectedVisibleNameFixCount === 0}>החל תיקון</button>
              <button onClick={() => setNameFixSuggestions(null)}>סגור</button>
            </div>
          </header>
          <div className="namefix-module-filters">
            {NAME_FIX_MODULE_OPTIONS.map(option => (
              <label key={option.id} className={`namefix-module-pill${enabledNameFixModules.has(option.id) ? ' active' : ''}`}>
                <input
                  type="checkbox"
                  checked={enabledNameFixModules.has(option.id)}
                  onChange={() => toggleNameFixModule(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="namefix-result-filters">
            {NAME_FIX_RESULT_MODE_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={`namefix-result-pill${nameFixResultMode === option.id ? ' active' : ''}`}
                onClick={() => setNameFixResultMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="namefix-star-filters">
            {NAME_FIX_STAR_FILTER_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={`namefix-star-pill${nameFixMinStars === option.id ? ' active' : ''}`}
                onClick={() => setNameFixMinStars(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="namefix-groups">
            {visibleGroupedNameFixSuggestions.length === 0 && (
              <p className="empty-note">אין כרגע תוצאות לפי מודולי ההפרדה שנבחרו.</p>
            )}
            {visibleGroupedNameFixSuggestions.map((group, groupIdx) => (
              <article key={group.key} className="namefix-group-card">
                <div className="namefix-group-head">
                  <div className="namefix-group-number">#{groupIdx + 1}</div>
                  <div className="namefix-group-info">
                    <h3>{group.contactName}</h3>
                    <span>{group.field === 'firstName' ? 'שם פרטי' : 'שם משפחה'}</span>
                  </div>
                </div>
                <div className="namefix-pair-row">
                  <div className="namefix-original-box">
                    <strong>מקורי</strong>
                    <p>{group.original}</p>
                    <div className="namefix-manual-edit">
                      <input
                        type="text"
                        value={manualNameFixValues[group.key] ?? group.original}
                        onChange={e => setManualNameFixValues(prev => ({ ...prev, [group.key]: e.target.value }))}
                        placeholder="עריכה ידנית"
                      />
                      <button onClick={() => applyManualNameFix(group.contactId, group.field, group.key, group.original)}>
                        החל ידני
                      </button>
                    </div>
                  </div>
                  <div className="namefix-suggestions-box">
                    {group.suggestions.map((suggestion, suggestionIdx) => (
                      <label
                        key={suggestion.key}
                        className={`namefix-suggestion-card${selectedNameFixIds.has(suggestion.key) ? ' selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNameFixIds.has(suggestion.key)}
                          onChange={() => toggleNameFixId(suggestion.key)}
                        />
                        <div className="namefix-suggestion-content">
                          <div className="namefix-suggestion-number">#{suggestionIdx + 1}</div>
                          <div>
                            <strong>{suggestion.suggested}</strong>
                            <span className="namefix-stars">{starsLabel(confidenceToStars(suggestion.confidence))}</span>
                            <span>{suggestion.reason} ({Math.round(suggestion.confidence * 100)}%)</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'contacts' && (
      /* Main workspace */
      <>
      <main className="workspace-grid contacts-grid-single">
        <section className="contacts-list-panel contacts-cards-panel">
          <div className="contacts-header">
            <h2>אנשי קשר ({visibleContacts.length})</h2>
            <div className="contacts-bulk-actions">
              <button
                type="button"
                className={`bulk-edit-toggle ${isBulkEditMode ? 'active' : ''}`}
                onClick={() => {
                  if (isBulkEditMode) cancelBulkEditChanges()
                  else enterBulkEditMode()
                }}
                title={isBulkEditMode ? 'בטל עריכה כללית' : 'הפעל עריכה כללית'}
              >
                {isBulkEditMode ? '✖' : '✏️'}
              </button>
              {isBulkEditMode && (
                <button type="button" className="bulk-edit-save" onClick={saveBulkEditChanges}>שמור</button>
              )}
            </div>
            <div className="contacts-search-wrap">
              <input
                type="search"
                placeholder="חיפוש שם / טלפון / מקור..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <button
                type="button"
                className="search-inline-danger"
                onClick={deleteContactsWithoutPhone}
                disabled={contacts.length === 0}
              >
                מחק בלי מספר
              </button>
            </div>
            <div className="contacts-sort-controls">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="firstName">שם פרטי</option>
                <option value="lastName">שם משפחה</option>
                <option value="source">מקור</option>
                <option value="phones">מס׳ טלפונים</option>
              </select>
              <select value={sortDir} onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}>
                <option value="asc">עולה ↑</option>
                <option value="desc">יורד ↓</option>
              </select>
            </div>
          </div>

          <div className="contacts-cards-grid">
            {visibleContacts.map((c, idx) => {
              const bulkValues = bulkEditValues[c.id]
              const displayName = formatNameDisplay(c.firstName, c.lastName) || c.name || '--'
              const phonesSummary = c.phones.length ? c.phones.join(' | ') : '--'
              const emailsSummary = c.emails.length ? c.emails.join(' | ') : '--'
              const hasEmails = c.emails.length > 0

              return (
                <div
                  key={c.id}
                  className={`contact-card ${selectedId === c.id ? 'selected' : ''} ${isBulkEditMode ? 'bulk-mode' : ''}`}
                >
                  <div className="contact-card-number">#{idx + 1}</div>
                  {isBulkEditMode && bulkValues ? (
                    <div className="contact-inline-edit-layout">
                      <div className="contact-name-edit bulk-edit-name-stack">
                        <label>
                          <span>שם פרטי:</span>
                          <input
                            type="text"
                            value={bulkValues.firstName}
                            onChange={e => setBulkEditValues(prev => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], firstName: e.target.value },
                            }))}
                          />
                        </label>
                        <label>
                          <span>שם משפחה:</span>
                          <input
                            type="text"
                            value={bulkValues.lastName}
                            onChange={e => setBulkEditValues(prev => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], lastName: e.target.value },
                            }))}
                          />
                        </label>
                      </div>
                      <div className="bulk-edit-inline-field phone">
                        <span>טלפונים:</span>
                        <textarea
                          value={bulkValues.phonesText}
                          onChange={e => setBulkEditValues(prev => ({
                            ...prev,
                            [c.id]: { ...prev[c.id], phonesText: e.target.value },
                          }))}
                          rows={3}
                          placeholder="מספר בכל שורה או מופרד בפסיק"
                        />
                      </div>
                      <div className="bulk-edit-inline-field email">
                        <span>מיילים:</span>
                        <textarea
                          value={bulkValues.emailsText}
                          onChange={e => setBulkEditValues(prev => ({
                            ...prev,
                            [c.id]: { ...prev[c.id], emailsText: e.target.value },
                          }))}
                          rows={3}
                          placeholder="מייל בכל שורה או מופרד בפסיק"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="contact-card-name">
                        <span className="contact-name-display" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
                          {c.firstName || displayName}
                        </span>
                        <span className="contact-name-display-full" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
                          {c.lastName || '--'}
                        </span>
                      </div>
                      <div className="contact-card-details contact-info-grid">
                        <div className="contact-detail">
                          <span className="detail-icon">📱</span>
                          <span className="detail-text">{phonesSummary}</span>
                        </div>
                        {hasEmails && (
                          <div className="contact-detail">
                            <span className="detail-icon">📧</span>
                            <span className="detail-text">{emailsSummary}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="contact-card-source">
                    <span className="detail-icon">🏷️</span>
                    <span className="detail-text">{c.source || '--'}</span>
                  </div>

                  <button
                    className="contact-card-delete-btn"
                    onClick={() => deleteContact(c.id)}
                    title="מחק"
                  >
                    🗑️
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </main>
      </>
      )}

      {activeTab === 'duplicates' && duplicateGroups === null && (
        <section className="duplicates-section">
          <header>
            <h2>זיהוי כפילויות</h2>
            <div className="dup-actions">
              <button onClick={handleDetect} disabled={contacts.length === 0}>זהה כפילויות עכשיו</button>
            </div>
          </header>
          <p className="empty-note">הפעל זיהוי כדי לראות קבוצות כפולות ולהחליט מה לשמור.</p>
        </section>
      )}

      {activeTab === 'namefix' && !nameFixSuggestions && (
        <section className="split-preview">
          <header>
            <h2>תיקון שמות</h2>
            <div className="split-actions">
              <button onClick={handleNameFix} disabled={contacts.length === 0}>אתר תיקוני שמות</button>
            </div>
          </header>
          <p className="empty-note">אין כרגע הצעות פתוחות. הפעל פעולה כדי לקבל הצעות.</p>
        </section>
      )}

      {/* Manual edit panel */}
      {activeTab === 'manual-edit' && (
        <section className="manual-edit-section">
          <header>
            <h2>עריכה ידנית של שמות בעייתיים</h2>
            <div className="manual-edit-actions">
              <button 
                onClick={() => {
                  setManualEditIssues(analyzeNamesForManualEdit(contacts))
                  setManualEditValues({})
                }}
              >
                סרוק שוב
              </button>
              <button 
                onClick={() => setManualEditIssues(null)}
              >
                סגור
              </button>
            </div>
          </header>

          {!manualEditIssues ? (
            <p className="empty-note">לחץ "סרוק שוב" כדי לחפש שמות בעייתיים</p>
          ) : manualEditIssues.length === 0 ? (
            <p className="empty-note">כל השמות נראים בסדר! ✓</p>
          ) : (
            <div className="manual-edit-list">
              <div className="manual-edit-stats">
                סה"כ: {manualEditIssues.length} אנשי קשר עם בעיות בשמות
              </div>
              {manualEditIssues.map((issue, issueIdx) => {
                const editKey = issue.contactId
                const edited = manualEditValues[editKey]
                const displayFN = edited?.firstName ?? issue.firstName
                const displayLN = edited?.lastName ?? issue.lastName
                const contact = contacts.find(c => c.id === issue.contactId)

                const issueLabels = {
                  hasDigits: '🔢 ספרות',
                  hasWeirdChars: '🔤 תווים מוזרים',
                  hasExtraSpaces: '  רווחים מיותרים',
                  hasRomanNumerals: '🏛️ ספרות רומיות',
                  hasSymbols: '⚠️ סימנים',
                  hasSpecialChars: '❗ תווים מיוחדים',
                }

                return (
                  <div key={issue.contactId} className={`manual-edit-card severity-${issue.severity}`}>
                    <div className="manual-edit-card-header">
                      <div className="manual-edit-card-number">#{issueIdx + 1}</div>
                      <div className="manual-edit-card-name">{issue.fullName}</div>
                      <div className="manual-edit-severity">
                        {'⚠️'.repeat(issue.severity)}
                      </div>
                    </div>

                    <div className="manual-edit-card-issues">
                      {issue.issueTypes.map(issueType => (
                        <span key={issueType} className={`issue-tag issue-${issueType}`}>
                          {issueLabels[issueType]}
                        </span>
                      ))}
                    </div>

                    {contact && (
                      <div className="manual-edit-card-details">
                        {contact.phones.length > 0 && (
                          <div className="detail-item">
                            <span className="detail-label">📱 טלפונים:</span>
                            <span className="detail-value">{contact.phones.join(', ')}</span>
                          </div>
                        )}
                        {contact.emails.length > 0 && (
                          <div className="detail-item">
                            <span className="detail-label">📧 מיילים:</span>
                            <span className="detail-value">{contact.emails.join(', ')}</span>
                          </div>
                        )}
                        {contact.source && (
                          <div className="detail-item">
                            <span className="detail-label">📂 מקור:</span>
                            <span className="detail-value">{contact.source}</span>
                          </div>
                        )}
                        {contact.notes && (
                          <div className="detail-item">
                            <span className="detail-label">📝 הערות:</span>
                            <span className="detail-value">{contact.notes}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="manual-edit-card-fields">
                      <div className="manual-edit-field">
                        <label>שם פרטי:</label>
                        <input
                          type="text"
                          value={displayFN}
                          onChange={e => {
                            setManualEditValues(prev => ({
                              ...prev,
                              [editKey]: { ...prev[editKey] ?? { firstName: issue.firstName, lastName: issue.lastName }, firstName: e.target.value }
                            }))
                          }}
                          placeholder={issue.firstName}
                        />
                      </div>
                      <div className="manual-edit-field">
                        <label>שם משפחה:</label>
                        <input
                          type="text"
                          value={displayLN}
                          onChange={e => {
                            setManualEditValues(prev => ({
                              ...prev,
                              [editKey]: { ...prev[editKey] ?? { firstName: issue.firstName, lastName: issue.lastName }, lastName: e.target.value }
                            }))
                          }}
                          placeholder={issue.lastName}
                        />
                      </div>
                    </div>

                    <div className="manual-edit-card-actions">
                      <button
                        className="manual-edit-apply-btn"
                        onClick={() => {
                          const edited = manualEditValues[editKey]
                          if (!edited) return
                          
                          setContacts(prev => prev.map(c =>
                            c.id === issue.contactId
                              ? { ...c, firstName: edited.firstName, lastName: edited.lastName, name: `${edited.firstName} ${edited.lastName}`.trim() }
                              : c
                          ))
                          
                          setManualEditValues(prev => {
                            const next = { ...prev }
                            delete next[editKey]
                            return next
                          })
                          
                          setManualEditIssues(prev =>
                            prev?.filter(i => i.contactId !== issue.contactId) ?? []
                          )
                          
                          setStatusMsg(`עודכן: ${issue.fullName}`)
                        }}
                      >
                        ✓ החל
                      </button>
                      <button
                        className="manual-edit-approve-btn"
                        onClick={() => {
                          setManualEditIssues(prev =>
                            prev?.filter(i => i.contactId !== issue.contactId) ?? []
                          )
                          setStatusMsg(`אושר: ${issue.fullName}`)
                        }}
                      >
                        👍 בסדר
                      </button>
                      <button
                        className="manual-edit-delete-btn"
                        onClick={() => {
                          setContacts(prev => prev.filter(c => c.id !== issue.contactId))
                          setManualEditValues(prev => {
                            const next = { ...prev }
                            delete next[editKey]
                            return next
                          })
                          setManualEditIssues(prev =>
                            prev?.filter(i => i.contactId !== issue.contactId) ?? []
                          )
                          setStatusMsg(`נמחק: ${issue.fullName}`)
                        }}
                      >
                        🗑️ מחק
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Duplicate groups */}
      {activeTab === 'duplicates' && duplicateGroups !== null && (
        <section className="duplicates-section">
          <header>
            <h2>
              {duplicateGroups.length > 0
                ? `קבוצות כפילויות (${duplicateGroups.length})`
                : 'לא נמצאו כפילויות'}
            </h2>
            <div className="dup-actions">
              {duplicateGroups.length > 0 && (
                <button onClick={applyRecommendationCleanup}>ניקוי חכם לכל הקבוצות</button>
              )}
              <button onClick={() => setDuplicateGroups(null)}>סגור</button>
            </div>
          </header>
          <div className="duplicate-groups">
            {duplicateGroups.map((group, groupIdx) => {
              const recIds = new Set(recommendKeepContacts(group.contacts).map(c => c.id))
              const selectedInGroupCount = group.contacts.filter(c => selectedDuplicateIds.has(c.id)).length
              const allSelectedInGroup = group.contacts.length > 0 && selectedInGroupCount === group.contacts.length
              const groupPhoneColorMap = new Map<string, string>()
              const uniqueGroupPhones = [...new Set(
                group.contacts.flatMap(c => c.phones.map(normalizePhone).filter(p => p.length >= 5))
              )]
              uniqueGroupPhones.forEach((phone, idx) => {
                groupPhoneColorMap.set(phone, `phone-color-${idx % 8}`)
              })
              const getGroupPhoneColor = (phone: string) => {
                const normalized = normalizePhone(phone)
                return groupPhoneColorMap.get(normalized) ?? 'phone-color-empty'
              }
              return (
                <div key={group.groupId} className="duplicate-group">
                  <h3>קבוצה #{groupIdx + 1}</h3>
                  <p className="group-reasons">{group.reasons.join(' | ')}</p>
                  <div className="group-keep-actions">
                    <label className="dup-select-dot" title={allSelectedInGroup ? 'בטל סימון הכל' : 'סמן הכל'}>
                      <input
                        type="checkbox"
                        checked={allSelectedInGroup}
                        onChange={() => toggleAllInGroupSelection(group.groupId)}
                        aria-label={allSelectedInGroup ? 'בטל סימון הכל בקבוצה' : 'סמן הכל בקבוצה'}
                      />
                      <span aria-hidden="true" />
                    </label>
                    <button onClick={() => keepOnlySelectedInGroup(group.groupId)} disabled={selectedInGroupCount === 0}>השאר נבחרים</button>
                    <button className="danger" onClick={() => deleteSelectedInGroup(group.groupId)} disabled={selectedInGroupCount === 0}>מחק נבחרים</button>
                  </div>
                  <div className="dup-cards-row">
                    {group.contacts.map(c => {
                      const isSelected = selectedDuplicateIds.has(c.id)
                      const isRec = recIds.has(c.id)
                      return (
                        <div
                          key={c.id}
                          className={`dup-card${isSelected ? ' marked' : ''}${isRec ? ' recommended' : ''}`}
                        >
                          <div className="dup-card-head">
                            <div className="dup-head-main">
                              <div className="dup-name-row">
                                <strong>{c.name}</strong>
                                <button className="dup-edit-trigger" onClick={() => openDuplicateQuickEdit(c)} title="ערוך איש קשר" aria-label="ערוך איש קשר">✎</button>
                              </div>
                              {isRec && <span className="recommended-badge">מומלץ לשמירה</span>}
                            </div>
                            <div className="dup-card-buttons">
                              <label className="dup-select-dot" title="בחר">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDuplicateSelection(c.id)}
                                />
                                <span aria-hidden="true" />
                              </label>
                              <button className="danger" onClick={() => deleteContact(c.id)}>מחק</button>
                            </div>
                          </div>
                          <div className="phone-row">
                            {c.phones.map(p => (
                              <span key={p} className={`phone-pill ${getGroupPhoneColor(p)}`}>{p}</span>
                            ))}
                          </div>
                          <p>{c.source}</p>
                          {c.emails.length > 0 && <p>{c.emails.join(', ')}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {isDuplicateEditOpen && selectedId && (
        <div className="modal-backdrop" onClick={() => setIsDuplicateEditOpen(false)}>
          <section className="quick-edit-modal" onClick={e => e.stopPropagation()}>
            <h3>עריכת איש קשר</h3>
            <div className="detail-card">
              <label>
                שם פרטי
                <input value={editFields.firstName ?? ''} onChange={e => setEditFields(f => ({ ...f, firstName: e.target.value, name: formatNameDisplay(e.target.value, f.lastName ?? selectedContact?.lastName ?? '') }))} />
              </label>
              <label>
                שם משפחה
                <input value={editFields.lastName ?? ''} onChange={e => setEditFields(f => ({ ...f, lastName: e.target.value, name: formatNameDisplay(f.firstName ?? selectedContact?.firstName ?? '', e.target.value) }))} />
              </label>
              <label>
                טלפונים (שורה לכל מספר)
                <textarea
                  rows={3}
                  value={(editFields.phones ?? []).join('\n')}
                  onChange={e => setEditFields(f => ({ ...f, phones: e.target.value.split('\n').map(p => p.trim()).filter(Boolean) }))}
                />
              </label>
              <label>
                מיילים (שורה לכל כתובת)
                <textarea
                  rows={2}
                  value={(editFields.emails ?? []).join('\n')}
                  onChange={e => setEditFields(f => ({ ...f, emails: e.target.value.split('\n').map(p => p.trim()).filter(Boolean) }))}
                />
              </label>
              <div className="quick-edit-actions">
                <button onClick={() => { saveEdit(); setIsDuplicateEditOpen(false) }}>שמור</button>
                <button className="danger" onClick={() => setIsDuplicateEditOpen(false)}>ביטול</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Dictionary Modal */}
      {isDictionaryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsDictionaryModalOpen(false)}>
          <div className="dictionary-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>הוסף שם למילון</h3>
              <button className="modal-close" onClick={() => setIsDictionaryModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>
                סוג שם
                <select value={dictionaryType} onChange={e => setDictionaryType(e.target.value as 'first' | 'last')}>
                  <option value="first">שם פרטי</option>
                  <option value="last">שם משפחה</option>
                </select>
              </label>
              <label>
                השם
                <input
                  type="text"
                  value={dictionaryInput}
                  onChange={e => setDictionaryInput(e.target.value)}
                  placeholder="הזן שם..."
                  onKeyDown={e => e.key === 'Enter' && handleAddToDictionary()}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleAddToDictionary}>הוסף</button>
              <button className="btn-secondary" onClick={() => setIsDictionaryModalOpen(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {isConversionModalOpen && (
        <div className="modal-backdrop" onClick={closeImportModal}>
          <div className="dictionary-modal conversion-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ייבוא אנשי קשר</h3>
              <button className="modal-close" onClick={closeImportModal}>✕</button>
            </div>
            <div className="modal-body">
              {conversionStage === 'confirm' && (
                <>
                  <p>גרור לכאן או בחר קובץ מהמחשב. נתמכים: VCF או IB (נוקיה).</p>
                  <div
                    className="import-dropzone"
                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={handleDropToImport}
                  >
                    <p>גרור קבצים לכאן</p>
                    <button type="button" className="btn-primary" onClick={openSystemFilePicker}>בחר קבצים מהמחשב</button>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept=".vcf,.ib"
                      multiple
                      className="import-hidden-input"
                      onChange={e => {
                        handleUploadSelection(e.target.files)
                        e.currentTarget.value = ''
                      }}
                    />
                  </div>
                </>
              )}
              {conversionStage === 'processing' && (
                <div className="import-loading-state" role="status" aria-live="polite">
                  <span className="import-loading-spinner" aria-hidden="true" />
                  <p>טוען קבצים ומפענח אנשי קשר... {importFileSummaries.length}/{pendingUploadFiles.length}</p>
                </div>
              )}
              {conversionStage === 'failed' && <p>לא זוהו אנשי קשר. נסה קובץ אחר.</p>}
              {conversionStage === 'ready' && (
                <>
                  <p>הייבוא הושלם. נמצאו {conversionContacts.length} אנשי קשר ונוספו לתוכנה.</p>
                </>
              )}

              {(importFileSummaries.length > 0 || conversionDetails.length > 0) && (
                <div className="conversion-log">
                  {importFileSummaries.map((summary, idx) => (
                    <article key={`${idx}-${summary.name}`} className="import-file-summary">
                      <h4>קובץ {idx + 1}: {summary.name}</h4>
                      <p>נמצאו {summary.contacts} אנשי קשר</p>
                      <p>{summary.details}</p>
                    </article>
                  ))}
                  {conversionDetails.length > 0 && (
                    <div className="import-run-log">
                      {conversionDetails.map((line, idx) => <p key={`${idx}-${line}`}>{line}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              {conversionStage === 'failed' && (
                <button className="btn-primary" onClick={openSystemFilePicker}>נסה שוב</button>
              )}
              <button className="btn-secondary" onClick={closeImportModal}>סגור</button>
            </div>
          </div>
        </div>
      )}

      {isDownloadModalOpen && (
        <div className="modal-backdrop" onClick={closeDownloadModal}>
          <div className="dictionary-modal download-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>הורדת OneRoster</h3>
              <button className="modal-close" onClick={closeDownloadModal}>✕</button>
            </div>
            <div className="modal-body">
              <p className="download-modal-intro">בחר איך אתה רוצה להמשיך: הורדה למחשב, גרסה ניידת, קוד מקור או כניסה לעריכת הקוד ב־GitHub.</p>
              <div className="download-options-grid">
                <a className="download-option-card primary" href={GITHUB_INSTALLER_URL} target="_blank" rel="noreferrer">
                  <strong>הורד EXE</strong>
                  <span>מתקין מלא ל־Windows</span>
                </a>
                <a className="download-option-card" href={GITHUB_PORTABLE_URL} target="_blank" rel="noreferrer">
                  <strong>גרסה ניידת</strong>
                  <span>קובץ דחוס נייד, ללא התקנה</span>
                </a>
                <a className="download-option-card" href={GITHUB_SOURCE_URL} target="_blank" rel="noreferrer">
                  <strong>הורד קוד מקור</strong>
                  <span>קובץ ZIP של הפרויקט</span>
                </a>
                <a className="download-option-card" href={GITHUB_EDIT_URL} target="_blank" rel="noreferrer">
                  <strong>עריכת קוד ב־GitHub</strong>
                  <span>פתיחה ב־github.dev</span>
                </a>
              </div>
              <p className="download-modal-note">
                אם אחת מגרסאות ההורדה למחשב לא נפתחת, אפשר לעבור לעמוד
                {' '}
                <a href={GITHUB_RELEASES_URL} target="_blank" rel="noreferrer">Releases</a>
                {' '}
                ולהוריד משם ידנית.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeDownloadModal}>סגור</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
