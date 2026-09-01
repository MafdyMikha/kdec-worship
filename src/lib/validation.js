const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

export function normalizeRequiredText(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

export function isBlankText(value) {
  return normalizeRequiredText(value).length === 0
}

export function normalizeEmail(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en')
}

export function isValidEmail(value) {
  const normalized = normalizeEmail(value)
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized)
}
