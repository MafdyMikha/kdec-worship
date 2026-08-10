import { useState, useMemo } from 'react'
import { Check, Copy, Users, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, Select } from '../components/ui'

// ── WhatsApp icon SVG ───────────────────────────────────────
const WaIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

// ── Build WhatsApp URL ──────────────────────────────────────
const normalizePhone = phone => (phone || '').replace(/\D/g, '').replace(/^0/, '20')
const hasValidPhone = phone => normalizePhone(phone).length >= 8

const buildUrl = (phone, msg) => {
  const clean = normalizePhone(phone)
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
}

// ── Fill template placeholders ──────────────────────────────
const fillTemplate = (template, person, service) => {
  const date = service?.date || ''
  const time = service?.time || ''
  const assignmentRole = service?.team?.find(member => member.personId === person?.id)?.role
  const personRole = Array.isArray(person?.roles) ? person.roles[0] : person?.role
  return template
    .replace(/\{name\}/gi,    person?.name || '')
    .replace(/\{service\}/gi, service?.title || '')
    .replace(/\{date\}/gi,    date)
    .replace(/\{time\}/gi,    time)
    .replace(/\{role\}/gi,    assignmentRole || personRole || '')
}

// ── Default templates ───────────────────────────────────────
const DEFAULT_TEMPLATE = {
  ar: `مرحباً {name} 🎵

تذكير بخدمة *{service}*
📅 {date}  ⏰ {time}

نتشوق لخدمتك معنا 🙏
— فريق KDEC Worship`,
  en: `Hey {name} 🎵

Reminder for *{service}*
📅 {date}  ⏰ {time}

Looking forward to worshipping with you 🙏
— KDEC Worship Team`,
}

// ── Role colours ────────────────────────────────────────────
const ROLE_COLOR = {
  'Worship Leader':'indigo','Music Director':'purple','Pianist/Keys':'blue',
  'Acoustic Guitar':'green','Electric Guitar':'green','Bass Guitar':'teal',
  'Drummer':'orange','Vocalist':'pink','Sound Engineer':'slate',
  'Projection':'slate','AUX Instrument':'amber','Camera':'red',
}

export default function WhatsAppBulk() {
  const { t, isAr, lang } = useLang()
  const { people, services, ROLES } = useStore()

  // ── State ─────────────────────────────────────────────────
  const [selectedSvcId, setSelectedSvcId] = useState('')
  const [filterMode,    setFilterMode]    = useState('all')   // all | service | role | custom
  const [selectedRoles, setSelectedRoles] = useState(new Set())
  const [customIds,     setCustomIds]     = useState(new Set())
  const [template,      setTemplate]      = useState(DEFAULT_TEMPLATE[lang] || DEFAULT_TEMPLATE.ar)
  const [openedIds,     setOpenedIds]     = useState(new Set())
  const [copiedId,      setCopiedId]      = useState(null)
  const [actionError,   setActionError]   = useState('')
  const [showPreview,   setShowPreview]   = useState(true)

  const changeTemplate = nextTemplate => {
    setTemplate(nextTemplate)
    setOpenedIds(new Set())
    setActionError('')
  }

  const activeMembers = useMemo(() => people.filter(p => p.status === 'active'), [people])
  const selectedSvc   = services.find(s => s.id === selectedSvcId) || null

  // ── Filter recipients ─────────────────────────────────────
  const pool = useMemo(() => {
    if (filterMode === 'service') {
      if (!selectedSvc) return []
      const ids = new Set((selectedSvc.team || []).map(t => t.personId))
      return activeMembers.filter(p => ids.has(p.id))
    }
    if (filterMode === 'role') {
      if (selectedRoles.size === 0) return []
      return activeMembers.filter(p => {
        const roles = (Array.isArray(p.roles) && p.roles.length > 0) ? p.roles : (p.role ? [p.role] : [])
        return roles.some(r => selectedRoles.has(r))
      })
    }
    return activeMembers
  }, [filterMode, selectedSvc, selectedRoles, activeMembers])

  // In custom mode, pool is still all, but only customIds are selected
  const displayList = filterMode === 'custom' ? activeMembers : pool

  const isSelected = (p) =>
    filterMode === 'custom' ? customIds.has(p.id) : true

  const toggleCustom = (id) =>
    setCustomIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleRole = (r) =>
    setSelectedRoles(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n })

  const selectedPeople = useMemo(() => {
    if (filterMode === 'custom') return displayList.filter(p => customIds.has(p.id))
    return pool
  }, [filterMode, displayList, customIds, pool])

  const withPhone = useMemo(
    () => selectedPeople.filter(p => hasValidPhone(p.whatsapp || p.phone)),
    [selectedPeople],
  )
  const openedCount = withPhone.filter(person => openedIds.has(person.id)).length
  const remainingRecipients = withPhone.filter(person => !openedIds.has(person.id))
  const nextRecipient = remainingRecipients[0] || null
  const allDone = withPhone.length > 0 && remainingRecipients.length === 0
  const missingServiceDetails = !selectedSvc && /\{(?:service|date|time)\}/i.test(template)
  const messageReady = template.trim().length > 0 && !missingServiceDetails

  // ── Send actions ──────────────────────────────────────────
  const sendOne = (person) => {
    if (!isSelected(person)) return
    const phone = person.whatsapp || person.phone
    if (!hasValidPhone(phone)) return
    if (!messageReady) {
      setActionError(missingServiceDetails
        ? (isAr ? 'اختر خدمة أو أزل حقول الخدمة والتاريخ والوقت من القالب.' : 'Select a service or remove the service, date, and time fields from the template.')
        : (isAr ? 'اكتب رسالة أولاً.' : 'Write a message first.'))
      return
    }
    const msg = fillTemplate(template, person, selectedSvc)
    setActionError('')
    const openedWindow = window.open(buildUrl(phone, msg), '_blank', 'noopener,noreferrer')
    if (!openedWindow) {
      setActionError(isAr ? 'منع المتصفح فتح واتساب. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.' : 'The browser blocked WhatsApp. Allow popups, then try again.')
      return
    }
    setOpenedIds(ids => new Set([...ids, person.id]))
  }

  const copyLink = async (person) => {
    if (!isSelected(person)) return
    const phone = person.whatsapp || person.phone
    if (!hasValidPhone(phone) || !messageReady) return
    const msg = fillTemplate(template, person, selectedSvc)
    try {
      await navigator.clipboard.writeText(buildUrl(phone, msg))
      setCopiedId(person.id)
      setActionError('')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setActionError(isAr ? 'تعذر نسخ الرابط. افتح الرسالة مباشرة بدلاً من ذلك.' : 'Could not copy the link. Open the message directly instead.')
    }
  }

  const openNext = () => {
    if (nextRecipient) sendOne(nextRecipient)
  }

  const selectAll = () => {
    if (filterMode === 'custom') setCustomIds(new Set(activeMembers.map(p => p.id)))
  }
  const deselectAll = () => {
    if (filterMode === 'custom') setCustomIds(new Set())
    else if (filterMode === 'role') setSelectedRoles(new Set())
  }

  // ── Preview message for first person ─────────────────────
  const previewPerson = withPhone[0] || selectedPeople[0] || activeMembers[0]
  const previewMsg = previewPerson ? fillTemplate(template, previewPerson, selectedSvc) : template

  // ── Service options ───────────────────────────────────────
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcomingSvcs = services
    .filter(service => service.date >= todayKey && service.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
            <WaIcon size={20}/>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">{t('bulkWhatsApp')}</h1>
            <p className="text-sm text-slate-500">{t('bulkSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">

        {/* ── LEFT: Config panel ──────────────────────────── */}
        <div className="space-y-4">

          {/* 1. Service selector */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              {t('selectService')}
            </h3>
            <Select aria-label={t('selectService')} value={selectedSvcId} onChange={e => {
              setSelectedSvcId(e.target.value)
              setOpenedIds(new Set())
              setActionError('')
            }}>
              <option value="">{t('noServiceFilter')}</option>
              {upcomingSvcs.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.date}
                </option>
              ))}
            </Select>
          </Card>

          {/* 2. Filter recipients */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              {t('recipients')}
            </h3>

            {/* Filter mode pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4" role="group" aria-label={isAr ? 'طريقة اختيار المستلمين' : 'Recipient selection mode'}>
              {[
                ['all',     t('allMembers')],
                ['service', t('serviceTeamOnly')],
                ['role',    t('byRoleFilter')],
                ['custom',  t('customSelect')],
              ].map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => setFilterMode(mode)} aria-pressed={filterMode === mode}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    filterMode === mode
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Role checkboxes */}
            {filterMode === 'role' && (
              <div className="space-y-1 max-h-52 overflow-y-auto animate-fade-in">
                {ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                      selectedRoles.has(role) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                    }`}>
                      {selectedRoles.has(role) && <Check size={10} className="text-white"/>}
                    </div>
                    <input type="checkbox" className="sr-only" checked={selectedRoles.has(role)} onChange={() => toggleRole(role)}/>
                    <Badge color={ROLE_COLOR[role] || 'slate'} size="xs">{role}</Badge>
                    <span className="text-xs text-slate-500 ms-auto">
                      {activeMembers.filter(p => ((Array.isArray(p.roles) && p.roles.length > 0) ? p.roles : (p.role ? [p.role] : [])).includes(role)).length}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {filterMode === 'service' && !selectedSvc && (
              <div role="status" className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle size={14} aria-hidden="true"/>
                {isAr ? 'اختر خدمة أولاً من الأعلى' : 'Select a service above first'}
              </div>
            )}
            {filterMode === 'role' && selectedRoles.size === 0 && (
              <div role="status" className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle size={14} aria-hidden="true"/>
                {isAr ? 'اختر دوراً واحداً على الأقل' : 'Select at least one role'}
              </div>
            )}

            {/* Summary bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100">
              <span className="text-sm text-slate-600">
                <strong className="text-slate-800">{withPhone.length}</strong> {t('withPhone')} · {' '}
                <strong className="text-slate-800">{selectedPeople.length}</strong> {t('selectedCount')}
              </span>
              {filterMode === 'custom' && (
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline cursor-pointer">{t('selectAll')}</button>
                  <button onClick={deselectAll} className="text-xs text-slate-400 hover:underline cursor-pointer">{t('deselectAll')}</button>
                </div>
              )}
            </div>
          </Card>

          {/* 3. Message template */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              {t('messageTemplate')}
            </h3>
            <label htmlFor="whatsapp-template" className="sr-only">{t('messageTemplate')}</label>
            <textarea id="whatsapp-template"
              value={template}
              onChange={e => changeTemplate(e.target.value)}
              rows={8}
              dir="auto"
              aria-describedby="whatsapp-template-help"
              className="w-full px-3.5 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:border-slate-300 resize-none leading-relaxed"
            />
            <p id="whatsapp-template-help" className="text-xs text-slate-500 mt-2">{t('templateHelp')}</p>
            {missingServiceDetails && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800" role="status">
                <AlertCircle size={14} aria-hidden="true" className="flex-shrink-0"/>
                {isAr ? 'اختر خدمة لإكمال حقول الرسالة قبل فتح واتساب.' : 'Select a service to fill the message fields before opening WhatsApp.'}
              </p>
            )}

            {/* Quick reset templates */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <button type="button" onClick={() => changeTemplate(DEFAULT_TEMPLATE.ar)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:border-slate-300 hover:bg-slate-50 cursor-pointer">
                🔄 {isAr ? 'افتراضي عربي' : 'Default AR'}
              </button>
              <button type="button" onClick={() => changeTemplate(DEFAULT_TEMPLATE.en)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:border-slate-300 hover:bg-slate-50 cursor-pointer">
                🔄 {isAr ? 'افتراضي إنجليزي' : 'Default EN'}
              </button>
            </div>
          </Card>

          {/* Message preview */}
          <Card className="p-5">
            <button type="button" onClick={() => setShowPreview(v => !v)}
              aria-expanded={showPreview} aria-controls="whatsapp-preview"
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 cursor-pointer">
              {t('messagePreview')}
              {showPreview ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
            </button>
            {showPreview && (
              <div id="whatsapp-preview" className="mt-3 animate-fade-in">
                {previewPerson && (
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar name={previewPerson.name} size="xs"/>
                    <span className="text-xs text-slate-500" dir="auto">{previewPerson.name}</span>
                  </div>
                )}
                {/* WhatsApp-style bubble */}
                <div className="bg-[#DCF8C6] rounded-xl rounded-tl-none px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed shadow-sm max-w-xs" dir="auto">
                  {previewMsg}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT: Recipients list ──────────────────────── */}
        <div className="space-y-4">

          {/* Action header */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-slate-800">
                  {withPhone.length} {t('recipients')} {isAr ? 'لديهم رقم' : 'with phone numbers'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{t('whatsappNote')}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500" aria-live="polite">
                  {openedCount} / {withPhone.length} {isAr ? 'فُتح' : 'opened'}
                </span>
                <Btn
                  onClick={openNext}
                  disabled={!nextRecipient || !messageReady}
                  className={`${allDone ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  icon={allDone ? <Check size={16}/> : <WaIcon size={16}/>}
                >
                  {allDone
                    ? (isAr ? 'تم فتح الكل' : 'All opened')
                    : (isAr ? `فتح التالي (${remainingRecipients.length})` : `Open next (${remainingRecipients.length})`)}
                </Btn>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {isAr
                ? 'يفتح كل ضغط رسالة واحدة حتى لا يمنع المتصفح النوافذ المنبثقة. راجع الرسالة واضغط إرسال داخل واتساب.'
                : 'Each click opens one message to avoid popup blocking. Review it and press Send in WhatsApp.'}
            </p>
            {actionError && <p className="mt-2 text-xs text-red-600" role="alert">{actionError}</p>}
            {copiedId && <span className="sr-only" role="status">{isAr ? 'تم نسخ الرابط' : 'Link copied'}</span>}

            {/* Progress bar */}
            {withPhone.length > 0 && (
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden" role="progressbar"
                aria-label={isAr ? 'تقدم فتح الرسائل' : 'Message opening progress'} aria-valuemin="0" aria-valuemax={withPhone.length} aria-valuenow={openedCount}>
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(openedCount / withPhone.length) * 100}%` }}/>
              </div>
            )}
          </Card>

          {/* Member list */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pe-1">
            {displayList.length === 0 && (
              <Card className="p-10 text-center">
                <Users size={32} className="text-slate-200 mx-auto mb-3"/>
                <p className="text-slate-400 text-sm">{t('noRecipients')}</p>
              </Card>
            )}

            {displayList.map(person => {
              const hasPhone  = hasValidPhone(person.whatsapp || person.phone)
              const selected  = isSelected(person)
              const wasOpened = selected && openedIds.has(person.id)
              const phone     = person.whatsapp || person.phone

              return (
                <Card key={person.id}
                  className={`px-4 py-3 transition-all ${
                    wasOpened ? 'bg-emerald-50 border-emerald-200' :
                    selected && hasPhone ? 'border-slate-200' :
                    'opacity-60 border-slate-100'
                  }`}>
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">

                    {/* Custom mode: checkbox */}
                    {filterMode === 'custom' && (
                      <button type="button" onClick={() => toggleCustom(person.id)} aria-pressed={customIds.has(person.id)}
                        aria-label={customIds.has(person.id)
                          ? (isAr ? `إلغاء اختيار ${person.name}` : `Deselect ${person.name}`)
                          : (isAr ? `اختيار ${person.name}` : `Select ${person.name}`)}
                        className="w-9 h-9 inline-flex items-center justify-center flex-shrink-0 cursor-pointer rounded-lg hover:bg-slate-100">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          customIds.has(person.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                        }`}>
                          {customIds.has(person.id) && <Check size={10} className="text-white"/>}
                        </div>
                      </button>
                    )}

                    <Avatar name={person.name} size="sm"/>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate" dir="auto">{person.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {((Array.isArray(person.roles) && person.roles.length > 0) ? person.roles : (person.role ? [person.role] : [])).map(r => (
                          <Badge key={r} color={ROLE_COLOR[r] || 'slate'} size="xs">{r}</Badge>
                        ))}
                        {phone && (
                          <span className="text-xs text-slate-400" dir="ltr">{phone}</span>
                        )}
                        {wasOpened && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                            <Check size={10} aria-hidden="true"/>{isAr ? 'فُتحت' : 'Opened'}
                          </span>
                        )}
                        {!hasPhone && (
                          <span className="text-xs text-red-600">{phone ? (isAr ? 'رقم غير صالح' : 'Invalid phone') : t('noPhone')}</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {selected && hasPhone && (
                      <div className="flex items-center gap-1 flex-shrink-0 ms-auto">
                        <button type="button" onClick={() => copyLink(person)} disabled={!messageReady} aria-label={`${t('copy')}: ${person.name}`}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          {copiedId === person.id
                            ? <Check size={14} aria-hidden="true" className="text-emerald-500"/>
                            : <Copy size={14} aria-hidden="true"/>}
                        </button>
                        <button type="button" onClick={() => sendOne(person)} disabled={!messageReady} aria-label={`${isAr ? 'فتح رسالة واتساب إلى' : 'Open WhatsApp message for'} ${person.name}`}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            wasOpened
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}>
                          {wasOpened ? <><Check size={12} aria-hidden="true"/> {isAr ? 'فتح مجدداً' : 'Open again'}</> : <><WaIcon size={12}/> {isAr ? 'فتح' : 'Open'}</>}
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
