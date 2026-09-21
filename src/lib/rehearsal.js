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

export function rehearsalBeforeService(practice, service) {
  if (!practice?.enabled) return true
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value || '')
  if (!validDate(practice.date) || !validDate(service?.date) || !validTime(practice.time) || !validTime(service?.time)) return false
  return `${practice.date}T${practice.time.slice(0,5)}` < `${service.date}T${service.time.slice(0,5)}`
}
