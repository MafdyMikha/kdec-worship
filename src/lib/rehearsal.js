export function rehearsalLocationUrl(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  try {
    const url = new URL(text)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function prepareRehearsal(previous, fields) {
  return { ...previous, ...fields, location: fields.location.trim(), locationUrl: rehearsalLocationUrl(fields.locationUrl) }
}
