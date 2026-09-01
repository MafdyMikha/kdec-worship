import { useState } from 'react'
import { Plus, Mail, Copy, Check, X, Clock, UserPlus } from 'lucide-react'
import { useStore, buildInvitationMsg } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Modal, Input, Select, EmptyState } from '../components/ui'
import { hasPermission, isSuperAdminUser } from '../lib/permissions.js'
import { isValidEmail, normalizeEmail } from '../lib/validation.js'

const WA = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function Invitations() {
  const { isAr, t } = useLang()
  const { invitations,createInvitation,cancelInvitation,currentUser,ROLES,worshipRoles } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState({email:'',roles:[],primaryRole:'',accessLevel:'member',method:'whatsapp',phone:''})
  const [created, setCreated] = useState(null)
  const [copied,  setCopied]  = useState(null)

  const canManageInvitations=hasPermission(currentUser,'invitations.manage')
  const [formError,setFormError]=useState('')
  const senderName = currentUser?.name || currentUser?.email?.split('@')[0] || (isAr?'المسؤول':'Admin')

  if (!canManageInvitations) return (
    <EmptyState icon={<UserPlus size={28}/>}
      title={isAr ? 'للمسؤولين فقط' : 'Admins Only'}
      description={isAr ? 'فقط المسؤولون يمكنهم إدارة الدعوات.' : 'Only admins can manage invitations.'}/>
  )

  const handleCreate = async () => {
    if (!isValidEmail(form.email)) {
      setFormError(isAr?'أدخل عنوان بريد إلكتروني صالحاً.':'Enter a valid email address.')
      return
    }
    if (!form.roles || form.roles.length === 0) return
    setFormError('')
    const primaryRoleId=worshipRoles.find(role=>role.name===form.primaryRole)?.id
    const inv=await createInvitation(normalizeEmail(form.email),form.roles,form.method,{primaryRoleId,accessLevel:form.accessLevel})
    if(inv){const defaultRole=ROLES[0]||'';setCreated({...inv,phone:form.phone});setShowAdd(false);setForm({email:'',roles:defaultRole?[defaultRole]:[],primaryRole:defaultRole,accessLevel:'member',method:'whatsapp',phone:''})}
  }

  const getInviteUrl = (code) => `${window.location.origin}?invite=${code}`

  const handleWhatsApp = (inv) => {
    const msg   = buildInvitationMsg(inv.code, senderName)
    const phone = (inv.phone||'').replace(/\s+/g,'').replace(/[^+\d]/g,'')
    const num   = phone.startsWith('+')?phone.slice(1):phone
    const url   = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me?text=${encodeURIComponent(msg)}`
    window.open(url,'_blank')
  }

  const handleEmail = (inv) => {
    const subject = encodeURIComponent(isAr ? 'دعوة للانضمام لمنصة KDEC Worship' : 'Invitation to KDEC Worship Platform')
    const body    = encodeURIComponent(isAr
      ? `مرحباً!\n\n${senderName} يدعوك للانضمام لمنصة فريق تسبيح KDEC.\n\nاضغط الرابط:\n${getInviteUrl(inv.code)}\n\nصالح لمدة 7 أيام.`
      : `Hello!\n\n${senderName} has invited you to join the KDEC Worship team.\n\nClick here:\n${getInviteUrl(inv.code)}\n\nExpires in 7 days.`)
    window.location.href = `mailto:${inv.email}?subject=${subject}&body=${body}`
  }

  const copyLink = (code) => {
    navigator.clipboard.writeText(getInviteUrl(code))
    setCopied(code)
    setTimeout(()=>setCopied(null), 2000)
  }

  const pending = invitations.filter(i=>i.status==='pending')
  const past    = invitations.filter(i=>i.status!=='pending')

  const STATUS_LABEL = isAr
    ? { pending:'انتظار', accepted:'مقبول', cancelled:'ملغي', expired:'منتهي' }
    : { pending:'Pending', accepted:'Accepted', cancelled:'Cancelled', expired:'Expired' }
  const STATUS_COLOR = { pending:'yellow', accepted:'green', cancelled:'red', expired:'slate' }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          {pending.length} {isAr ? 'دعوة معلقة' : 'pending invitation(s)'}
        </p>
        <Btn onClick={()=>setShowAdd(true)} icon={<Plus size={16}/>}>{t('inviteMember')}</Btn>
      </div>

      {/* Created success banner */}
      {created && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-scale-in">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-emerald-800">✅ {isAr?`تم إنشاء الدعوة لـ ${created.email}`:`Invitation created for ${created.email}`}</p>
              <p className="text-sm text-emerald-600 mt-0.5">{isAr?'اختر طريقة الإرسال:':'Choose how to send it:'}</p>
            </div>
            <button onClick={()=>setCreated(null)} className="text-emerald-400 hover:text-emerald-600 cursor-pointer"><X size={16}/></button>
          </div>
          <div className="bg-white rounded-xl p-3 mb-3 flex items-center justify-between gap-3 border border-emerald-100">
            <span className="truncate text-xs font-mono text-slate-600">{getInviteUrl(created.code)}</span>
            <button onClick={()=>copyLink(created.code)} className="text-indigo-500 hover:text-indigo-700 cursor-pointer flex-shrink-0 flex items-center gap-1 text-xs font-medium">
              {copied===created.code?<><Check size={13}/>{isAr?'تم':'Done'}</>:<><Copy size={13}/>{isAr?'نسخ':'Copy'}</>}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>handleWhatsApp(created)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 cursor-pointer">
              <WA/> {isAr?'واتساب':'WhatsApp'}
            </button>
            <button onClick={()=>handleEmail(created)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              <Mail size={15}/> {isAr?'بريد إلكتروني':'Email'}
            </button>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length===0 && !created ? (
        <EmptyState icon={<UserPlus size={28}/>}
          title={isAr?'لا توجد دعوات معلقة':'No pending invitations'}
          description={isAr?'ادعُ أعضاء الفريق عبر واتساب أو البريد الإلكتروني.':'Invite team members via WhatsApp or email.'}
          action={<Btn onClick={()=>setShowAdd(true)} icon={<Plus size={16}/>}>{t('inviteMember')}</Btn>}/>
      ) : pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isAr?'معلقة':'Pending'}
          </h3>
          {pending.map(inv=>(
            <Card key={inv.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 flex-shrink-0"><Clock size={18}/></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm">{inv.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {(Array.isArray(inv.roles) && inv.roles.length > 0 ? inv.roles : [inv.role]).filter(Boolean).join(' · ')} · {isAr?'تنتهي':'expires'} {inv.expires_at?.slice(0,10)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>copyLink(inv.code)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer" title={isAr?'نسخ الرابط':'Copy link'}>
                    {copied===inv.code?<Check size={14} className="text-emerald-500"/>:<Copy size={14}/>}
                  </button>
                  <button onClick={()=>handleWhatsApp({...inv,phone:''})} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer" title="WhatsApp"><WA/></button>
                  <button onClick={()=>handleEmail(inv)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer" title={isAr?'بريد':'Email'}><Mail size={14}/></button>
                  <button onClick={()=>cancelInvitation(inv.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer" title={isAr?'إلغاء':'Cancel'}><X size={14}/></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* History */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isAr?'السابقة':'History'}
          </h3>
          {past.map(inv=>(
            <Card key={inv.id} className="p-4 opacity-70">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-700 text-sm">{inv.email}</div>
                  <div className="text-xs text-slate-400">{(Array.isArray(inv.roles) && inv.roles.length > 0 ? inv.roles : [inv.role]).filter(Boolean).join(' · ')} · {inv.created_at?.slice(0,10)}</div>
                </div>
                <Badge color={STATUS_COLOR[inv.status]||'slate'} size="xs">{STATUS_LABEL[inv.status]||inv.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)}
        title={isAr?'إرسال دعوة جديدة':'Send New Invitation'} size="sm"
        footer={<>
          <Btn variant="secondary" onClick={()=>setShowAdd(false)}>{t('cancel')}</Btn>
          <Btn type="submit" form="create-invitation-form" disabled={!isValidEmail(form.email) || form.roles.length === 0}>{isAr?'إنشاء الدعوة':'Create Invitation'}</Btn>
        </>}>
        <form id="create-invitation-form" className="space-y-4" onSubmit={event=>{event.preventDefault();void handleCreate()}}>
          <Input label={t('email')} required type="email" placeholder="member@email.com"
            value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
          {formError&&<p className="text-sm text-red-600" role="alert">{formError}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {isAr ? 'الأدوار' : 'Roles'} <span className="text-red-500">*</span>
              <span className="text-xs text-slate-400 font-normal ms-1.5">
                ({isAr ? 'يمكن اختيار أكثر من دور' : 'select one or more'})
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(role => {
                const on = form.roles.includes(role)
                return (
                  <button key={role} type="button"
                    onClick={()=>setForm(f=>{const roles=f.roles.includes(role)?f.roles.filter(item=>item!==role):[...f.roles,role];return{...f,roles,primaryRole:roles.includes(f.primaryRole)?f.primaryRole:(roles[0]||'')}})}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all select-none ${
                      on ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}>
                    {role}
                  </button>
                )
              })}
            </div>
            {form.roles.length === 0 && (
              <p className="text-xs text-amber-500 mt-1.5">{isAr ? 'اختر دوراً واحداً على الأقل' : 'Select at least one role'}</p>
            )}
          </div>
          <Select label={isAr?'الدور الأساسي':'Primary role'} value={form.primaryRole} onChange={event=>setForm(current=>({...current,primaryRole:event.target.value}))}>
            {form.roles.map(role=><option key={role} value={role}>{role}</option>)}
          </Select>
          <Select label={isAr?'صلاحية النظام':'System access'} value={form.accessLevel} onChange={event=>setForm(current=>({...current,accessLevel:event.target.value}))}>
            <option value="member">{isAr?'عضو':'Member'}</option><option value="leader">{isAr?'قائد':'Leader'}</option>{isSuperAdminUser(currentUser)&&<option value="admin">{isAr?'مسؤول':'Admin'}</option>}
          </Select>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {isAr?'طريقة الإرسال':'Send via'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[['whatsapp',isAr?'واتساب':'WhatsApp',<WA/>],['email',isAr?'بريد':'Email',<Mail size={15}/>]].map(([val,label,icon])=>(
                <button key={val} type="button" onClick={()=>setForm(f=>({...f,method:val}))}
                  className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${form.method===val?(val==='whatsapp'?'bg-emerald-50 border-emerald-400 text-emerald-700':'bg-indigo-50 border-indigo-400 text-indigo-700'):'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {icon}<span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {form.method==='whatsapp' && (
            <Input label={t('whatsapp')} placeholder="+20 100 000 0000"
              value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
          )}
          <p className="text-xs text-slate-400">
            {isAr?'سيتم إنشاء رابط دعوة صالح لمدة 7 أيام.':'An invitation link valid for 7 days will be created.'}
          </p>
        </form>
      </Modal>
    </div>
  )
}
