export const ID_TYPES = [
  ['philid', 'National ID (PhilID)'], ['ephilid', 'ePhilID / Digital National ID'],
  ['senior', 'Senior Citizen ID (OSCA)'], ['philhealth', 'PhilHealth ID'],
  ['license', "Driver's License"], ['passport', 'Philippine Passport'],
  ['umid', 'UMID / SSS ID'], ['pwd', 'PWD ID'], ['postal', 'Postal ID'],
  ['prc', 'PRC ID'], ['barangay', 'Barangay ID'], ['other', 'Other Government-Issued ID'],
]

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export function parseIdDate(value) {
  const text = String(value || '').toUpperCase().replace(/,/g, ' ').trim()
  let year, month, day
  let match = text.match(/\b(19\d{2}|20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (match) [, year, month, day] = match
  else {
    match = text.match(/\b(\d{1,2})\s+([A-Z]{3,9})\s+(19\d{2}|20\d{2})\b/)
    if (match) { day = match[1]; month = MONTHS.indexOf(match[2].slice(0, 3)) + 1; year = match[3] }
    else {
      match = text.match(/\b([A-Z]{3,9})\s+(\d{1,2})\s+(19\d{2}|20\d{2})\b/)
      if (match) { month = MONTHS.indexOf(match[1].slice(0, 3)) + 1; day = match[2]; year = match[3] }
      else {
        match = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](19\d{2}|20\d{2})\b/)
        // An ambiguous numeric date is left for manual review.
        if (!match || (+match[1] <= 12 && +match[2] <= 12 && match[1] !== match[2])) return ''
        year = match[3]; month = +match[1] > 12 ? match[2] : match[1]; day = +match[1] > 12 ? match[1] : match[2]
      }
    }
  }
  const date = new Date(+year, +month - 1, +day)
  if (!month || date.getFullYear() !== +year || date.getMonth() !== +month - 1 || date.getDate() !== +day || date > new Date()) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseGovernmentId(text, type) {
  const normalized = text
    .replace(/\bLAST\s+NAM[EL]\b/gi, 'Last Name')
    .replace(/\bGIVEN\s+NAM[EL]S?\b/gi, 'Given Names')
    .replace(/LAST\s*NAME\s*\/\s*APELYIDO/gi, 'Last Name')
    .replace(/GIVEN\s*NAMES?\s*\/\s*MGA PANGALAN/gi, 'Given Names')
    .replace(/MIDDLE\s*NAME\s*\/\s*GITNANG (?:APELYIDO|PANGALAN)/gi, 'Middle Name')
    .replace(/APELYIDO\s*\/\s*LAST NAME/gi, 'Last Name')
    .replace(/MGA PANGALAN\s*\/\s*GIVEN NAMES?/gi, 'Given Names')
    .replace(/GITNANG (?:APELYIDO|PANGALAN)\s*\/\s*MIDDLE NAME/gi, 'Middle Name')
    .replace(/PETSA NG KAPANGANAKAN\s*\/\s*DATE OF BIRTH/gi, 'Date of Birth')
    .replace(/KASARIAN\s*\/\s*SEX/gi, 'Sex')
  const lines = normalized.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const find = (labels) => {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(new RegExp(`^(?:${labels})\\s*[:.\\-]?\\s*(.*)$`, 'i'))
      if (match) return match[1] || lines[i + 1] || ''
    }
    return ''
  }
  const cleanName = (value) => /^[\p{L} .'-]{1,150}$/u.test(value) && !/\b(?:name|names|pangalan|apelyido|birth|kasarian|republic|philippine|address|sex|nationality)\b/i.test(value) ? value : ''
  const nameLabels = 'last\\s*names?|sur\\s*name|first\\s*names?|given\\s*names?|middle\\s*name|mga pangalan|gitnang (?:pangalan|apelyido)|apelyido|pangalan'
  const findName = (labels) => {
    for (let index = 0; index < lines.length; index++) {
      const match = lines[index].match(new RegExp(`(?:^|\\b)(?:${labels})\\b\\s*[:.\\-]?\\s*(.*)$`, 'i'))
      if (!match) continue
      const candidate = match[1].split(new RegExp(`\\b(?:${nameLabels}|date of birth|sex|address)\\b`, 'i'))[0].trim()
      const inline = cleanName(candidate)
      if (inline) return inline
      // Combined headings are handled by their explicit column-order rule.
      if (match[1].trim() && !/^[\s|/,:;._-]{1,8}$/.test(match[1])) continue
      const next = cleanName(lines[index + 1] || '')
      if (next) return next
    }
    return ''
  }
  const result = {
    firstName: findName('given\\s*names?|first\\s*names?|mga pangalan|pangalan'),
    middleName: findName('middle\\s*name|gitnang (?:pangalan|apelyido)'),
    lastName: findName('last\\s*names?|sur\\s*name|apelyido'),
    birthDate: parseIdDate(find('date\\s*of\\s*birth\\b|birth\\s*date\\b|birthday\\b|d\\.?o\\.?b\\b\\.?|petsa ng kapanganakan\\b')),
    sex: '',
  }
  const sex = find('sex\\b|gender\\b|kasarian\\b').toUpperCase()
  if (/^(FEMALE|F|BABAE)\b/.test(sex)) result.sex = 'Female'
  if (/^(MALE|M|LALAKI)\b/.test(sex)) result.sex = 'Male'
  if (['philid', 'ephilid'].includes(type)) {
    // National ID labels occupy their own rows. OCR often adds stray marks
    // after those small labels; those marks are not inline patient names.
    const nationalLabel = (line) => {
      if (/middle\s*nam[el]|gitnang/i.test(line)) return 'middleName'
      if (/last\s*nam[el]|\bapelyido\b/i.test(line)) return 'lastName'
      if (/given\s*nam[el]s?|mga\s*pangalan|pangan\S*.*(?:cen|given)\s*name/i.test(line)) return 'firstName'
      if (/date\s*of\s*birth|petsa.*kapanganakan/i.test(line)) return 'birthDate'
      return ''
    }
    for (let index = 0; index < lines.length - 1; index++) {
      const key = nationalLabel(lines[index])
      if (!key) continue
      // Explicit colon-separated fields remain supported for digital layouts.
      if (lines[index].includes(':') && result[key]) continue
      const next = lines[index + 1]
      if (nationalLabel(next)) continue
      if (key === 'birthDate') {
        result.birthDate = parseIdDate(next) || result.birthDate
        continue
      }
      // Reject digit-bearing OCR noise before the value. Preserve mixed-case
      // names normally; when mixed-case fragments precede an uppercase value,
      // prefer the contiguous uppercase value printed on the card.
      const stripped = next.replace(/^[^\p{L}]+/u, '').trim()
      const words = stripped.split(/\s+/)
      const uppercaseTail = words.findIndex((word, wordIndex) => wordIndex > 0 && /^[\p{Lu}][\p{Lu}.'-]+$/u.test(word) && words.slice(0, wordIndex).every((prefix) => /^(?:[a-z]{1,2}|[A-Z][a-z])$/.test(prefix)))
      const candidate = uppercaseTail > 0 ? words.slice(uppercaseTail).join(' ') : stripped
      if (uppercaseTail > 0) result.nameNeedsReview = true
      result[key] = cleanName(candidate) || ''
    }
  }
  if (type === 'license') {
    // Some licenses group several labels above one value row rather than
    // printing a separate label/value pair for every field.
    for (let index = 0; index < lines.length - 1; index++) {
      const heading = lines[index]
      const value = lines[index + 1].replace(/^[^\p{L}\p{N}]+/u, '').trim()
      if (/last name.*first name.*middle name/i.test(heading)) {
        const names = value.split(',').map((part) => part.trim())
        if (names.length === 3 && names.every((name) => cleanName(name))) {
          result.lastName = cleanName(names[0]); result.firstName = cleanName(names[1]); result.middleName = cleanName(names[2])
        } else if (names.length === 2 && names.every((name) => cleanName(name))) {
          result.lastName = cleanName(names[0])
          const remaining = names[1].split(/\s+/)
          if (remaining.length > 1) {
            // This is a review suggestion, not a verified split: compound
            // first and middle names cannot be resolved from whitespace alone.
            result.firstName = remaining.slice(0, -1).join(' ')
            result.middleName = remaining.at(-1)
            result.nameNeedsReview = true
          } else result.firstName = names[1]
        } else if (!value.includes(',')) {
          const rows = lines.slice(index + 1, index + 4)
          if (rows.length === 3 && rows.every((name) => cleanName(name))) {
            [result.lastName, result.firstName, result.middleName] = rows
          }
        }
      }
      if (/sex/i.test(heading) && /(?:date of birth|birth date)/i.test(heading) && !/expir/i.test(heading)) {
        result.birthDate ||= parseIdDate(value)
        const token = value.match(/\b(MALE|FEMALE|M|F)\b/i)?.[1]?.toUpperCase()
        if (!result.sex && token) result.sex = ['F', 'FEMALE'].includes(token) ? 'Female' : 'Male'
      }
    }
  }
  // Licenses and some local IDs explicitly print surname, given names.
  if (['license', 'senior', 'philhealth', 'pwd', 'barangay'].includes(type) && !result.lastName && !result.firstName) {
    const fullName = find('name\\b|full name\\b')
    const parts = fullName.split(',').map((part) => part.trim())
    if (parts.length === 2) { result.lastName = cleanName(parts[0]); result.firstName = cleanName(parts[1]) }
  }
  // Do not infer names from passport MRZ or unlabeled layout positions.
  const printedContact = find('contact(?: number| no\\.?)?\\b|mobile(?: number| no\\.?)?\\b|telephone\\b|tel\\b')
  const digits = printedContact.replace(/[ ()-]/g, '')
  result.contactNumber = /^\d{1,11}$/.test(digits) ? digits : ''
  return result
}

export const OCR_FIELD_LABELS = { firstName: 'First Name', middleName: 'Middle Name', lastName: 'Last Name', contactNumber: 'Contact Number', birthDate: 'Birth Date' }
export function registrationValues(fields) {
  const { birthDate, ...values } = fields
  if (birthDate) {
    const [birthYear, birthMonth, birthDay] = birthDate.split('-')
    Object.assign(values, { birthYear, birthMonth, birthDay: String(Number(birthDay)) })
  }
  return values
}

export function applyIdFields(form, fields, replaceExisting = false) {
  const applied = []
  const existingBirth = ['birthYear', 'birthMonth', 'birthDay'].some((name) => form.elements.namedItem(name)?.value)
  for (const [name, value] of Object.entries(registrationValues(fields))) {
    if (!value) continue
    if (!replaceExisting && existingBirth && ['birthYear', 'birthMonth', 'birthDay'].includes(name)) continue
    const control = form.elements.namedItem(name)
    if (!control || (!replaceExisting && control.value)) continue
    control.value = value
    const controls = control instanceof RadioNodeList ? [...control] : [control]
    controls.forEach((element) => {
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.classList.add('id-autofilled')
    })
    applied.push(name)
  }
  return applied
}
