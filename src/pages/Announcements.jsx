import { useState } from 'react'
import { Plus, Megaphone, Trash2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { hasPermission } from '../lib/permissions.js'
import { Card, Btn, Badge, Avatar, Modal, Input, Textarea, Select, EmptyState, ConfirmDialog } from '../components/ui'

const blank = { title:'', content:'', priority:'normal' }

export default function Announcements() {
  const { isAr, t } = useLang()
  const { announcements, addAnnouncement, deleteAnnouncement, people, currentUser } = useStore()
  const [showAdd,      setShowAdd]      = useState(false)
  const [form,         setForm]         = useState(blank)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const canManage = hasPermission(currentUser,'announcements.manage')

  const PRIORITY_CONFIG = {
    high:   { color:'red',   icon:<AlertCircle size={16}/>,   label: isAr?'عاجل':'Urgent',  border:'border-l-red-400'   },
    normal: { color:'blue',  icon:<Info size={16}/>,           label: isAr?'عادي':'Normal',  border:'border-l-blue-400'  },
    low:    { color:'slate', icon:<AlertTriangle size={16}/>,  label: isAr?'منخفض':'Low',    border:'border-l-slate-300' },
  }

  const handleAdd = async () => {
    if (!form.title || !form.content) return
    const result = await addAnnouncement(form)
    if (!result?.error) { setShowAdd(false); setForm(blank) }
  }

  const getAuthor = (a) => {
    if (a.authorName) return { name: a.authorName }
    return people.find(p => p.id === a.author || p.id === a.author_id)
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = parseISO(dateStr)
      if (isValid(d)) return formatDistanceToNow(d, { addSuffix:true, locale: isAr ? arLocale : undefined })
    } catch { return dateStr }
    return dateStr
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          {announcements.length} {isAr ? 'إعلان' : 'announcements'}
        </p>
        {canManage && (
          <Btn onClick={() => setShowAdd(true)} icon={<Plus size={16}/>}>{t('newAnnouncement')}</Btn>
        )}
      </div>

      {announcements.length === 0 ? (
        <EmptyState icon={<Megaphone size={28}/>}
          title={t('noAnnouncements')}
          description={isAr ? 'انشر إعلاناً لإبقاء فريق التسبيح على اطلاع.' : 'Post an announcement to keep the worship team informed.'}
          action={canManage ? <Btn onClick={() => setShowAdd(true)} icon={<Plus size={16}/>}>{t('newAnnouncement')}</Btn> : null}/>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const config = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal
            const author = getAuthor(a)
            const canDelete = canManage || a.author_id === currentUser?.id || a.author === currentUser?.id
            return (
              <Card key={a.id} className={`p-5 border-l-4 ${config.border} group`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-display font-semibold text-slate-800">{a.title}</h3>
                        <Badge color={config.color} size="xs">{config.label}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mb-3" dir="auto">{a.content}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {author && (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={author.name} size="xs"/>
                            <span>{author.name}</span>
                          </div>
                        )}
                        <span>·</span>
                        <span>{formatTime(a.created_at || a.date)}</span>
                      </div>
                    </div>
                  </div>
                  {canDelete && (
                    <button onClick={() => setDeleteTarget(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg cursor-pointer transition-all flex-shrink-0">
                      <Trash2 size={15}/>
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('newAnnouncement')} size="md"
        footer={<>
          <Btn variant="secondary" onClick={() => setShowAdd(false)}>{t('cancel')}</Btn>
          <Btn onClick={handleAdd} disabled={!form.title || !form.content}>{t('post')}</Btn>
        </>}>
        <div className="space-y-4">
          <Input label={t('title')} required placeholder={isAr ? 'تغيير موعد البروفة' : 'Practice time change'} value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))}/>
          <Textarea label={t('message')} required placeholder={isAr ? 'اكتب الإعلان هنا...' : 'Write your announcement...'} value={form.content} onChange={e => setForm(f => ({...f,content:e.target.value}))} rows={5}/>
          <Select label={t('priority')} value={form.priority} onChange={e => setForm(f => ({...f,priority:e.target.value}))}>
            <option value="low">{isAr?'منخفض':'Low'}</option>
            <option value="normal">{isAr?'عادي':'Normal'}</option>
            <option value="high">{isAr?'عاجل':'Urgent'}</option>
          </Select>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async() => { const result=await deleteAnnouncement(deleteTarget); if(!result?.error)setDeleteTarget(null); return result }}
        title={isAr ? 'حذف الإعلان' : 'Delete Announcement'}
        message={isAr ? 'هل أنت متأكد من حذف هذا الإعلان؟' : 'Are you sure you want to delete this announcement?'}/>
    </div>
  )
}
