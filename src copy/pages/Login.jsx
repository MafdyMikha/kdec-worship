import { useState } from 'react'
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle, CheckCircle, Info, Zap } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { KDEC_LOGO } from '../assets/kdecLogo.js'
import { hasSupabase } from '../lib/supabase.js'

const DEMO_ACCOUNTS = [
  // Admins
  { email:'mafdy@kdec.org',     label:'Mafdy Hanna',      role:'Worship Leader · Admin',   color:'bg-indigo-600', isAdmin:true  },
  { email:'christine@kdec.org', label:'Christine Ramzy',   role:'Music Director · Admin',   color:'bg-violet-600', isAdmin:true  },
  // Members
  { email:'sarah@kdec.org',     label:'Sarah Mikhail',     role:'Pianist/Keys',             color:'bg-sky-500',    isAdmin:false },
  { email:'peter@kdec.org',     label:'Peter Naguib',      role:'Bass Guitar',              color:'bg-teal-500',   isAdmin:false },
  { email:'john@kdec.org',      label:'John Fares',        role:'Drummer',                  color:'bg-orange-500', isAdmin:false },
  { email:'mary@kdec.org',      label:'Mary George',       role:'Vocalist',                 color:'bg-pink-500',   isAdmin:false },
  { email:'mark@kdec.org',      label:'Mark Youssef',      role:'Sound Engineer',           color:'bg-slate-500',  isAdmin:false },
  { email:'rita@kdec.org',      label:'Rita Beshara',      role:'Vocalist',                 color:'bg-rose-500',   isAdmin:false },
]

export default function Login({ inviteCode }) {
  const { login, registerWithInvite, isDemoMode } = useStore()
  const { lang, setLang, isAr } = useLang()
  const [mode,     setMode]     = useState(inviteCode ? 'register' : 'login')
  const [form,     setForm]     = useState({ email:'', password:'', name:'', confirmPassword:'' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const handleLogin = async (e) => {
    e?.preventDefault(); setError(''); setLoading(true)
    const result = await login(form.email, form.password)
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  const handleQuickLogin = async (email) => {
    setLoading(true); setError('')
    const result = await login(email, 'demo')
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Minimum 6 characters'); return }
    setLoading(true)
    const result = await registerWithInvite(inviteCode, form.email, form.password, form.name)
    setLoading(false)
    if (result?.error) setError(result.error)
    else { setSuccess('Account created! Check your email to confirm, then sign in.'); setMode('login') }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"/>
      </div>

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-7 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg p-1.5">
              <img src={KDEC_LOGO} alt="KDEC" className="w-full h-full object-contain"/>
            </div>
            <h1 className="font-display font-bold text-white text-2xl">KDEC Worship</h1>
            <p className="text-indigo-200 text-sm mt-1">Kasr El Doubara Evangelical Church</p>
            {/* Lang toggle on login */}
            <div className="flex items-center justify-center gap-1 mt-3">
              <button onClick={()=>setLang('ar')} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${lang==='ar'?'bg-white/30 text-white':'text-indigo-300 hover:text-white'}`}>AR</button>
              <button onClick={()=>setLang('en')} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${lang==='en'?'bg-white/30 text-white':'text-indigo-300 hover:text-white'}`}>EN</button>
            </div>
          </div>

          <div className="px-8 py-6 space-y-5">
            {/* Demo mode banner */}
            {isDemoMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={15} className="text-amber-600 flex-shrink-0"/>
                  <span className="text-sm font-semibold text-amber-800">
                    {isAr ? 'وضع تجريبي' : 'Demo Mode'}
                  </span>
                  <span className="ms-auto text-xs text-amber-500">
                    {isAr ? 'أي كلمة مرور تعمل' : 'any password works'}
                  </span>
                </div>
                <p className="text-xs text-amber-700 mb-3">
                  {isAr
                    ? 'اضغط على أي حساب لتسجيل الدخول فوراً — بيانات حقيقية جاهزة للاختبار'
                    : 'Tap any account to log in instantly — real data loaded and ready to test'}
                </p>

                {/* Admin accounts */}
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
                  {isAr ? '🔑 مسؤولون' : '🔑 Admins'}
                </p>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {DEMO_ACCOUNTS.filter(a => a.isAdmin).map(acc => (
                    <button key={acc.email} onClick={() => handleQuickLogin(acc.email)} disabled={loading}
                      className="flex items-center gap-2 p-2.5 bg-white border border-amber-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all text-left">
                      <div className={`w-8 h-8 ${acc.color} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {acc.label.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{acc.label}</div>
                        <div className="text-xs text-slate-400 truncate">{acc.role}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Member accounts */}
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
                  {isAr ? '🎵 أعضاء الفريق' : '🎵 Team Members'}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEMO_ACCOUNTS.filter(a => !a.isAdmin).map(acc => (
                    <button key={acc.email} onClick={() => handleQuickLogin(acc.email)} disabled={loading}
                      className="flex items-center gap-2 p-2 bg-white border border-amber-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer transition-all text-left">
                      <div className={`w-7 h-7 ${acc.color} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {acc.label.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-700 truncate">{acc.label.split(' ')[0]}</div>
                        <div className="text-xs text-slate-400 truncate">{acc.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Setup banner (Supabase not configured) */}
            {isDemoMode && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-blue-700">To use with real data, add <code className="bg-blue-100 px-1 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-blue-100 px-1 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> to a <code className="bg-blue-100 px-1 rounded font-mono">.env</code> file.</p>
              </div>
            )}

            {/* Invite banner */}
            {inviteCode && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-emerald-700 font-medium">You've been invited! Create your account to join.</p>
              </div>
            )}

            {/* Error / success */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 animate-slide-up">
                <AlertCircle size={15} className="flex-shrink-0"/> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 animate-slide-up">
                <CheckCircle size={15} className="flex-shrink-0"/> {success}
              </div>
            )}

            {/* Login form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@kdec.org" required
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password {isDemoMode && <span className="text-slate-400 font-normal">(any password works in demo)</span>}</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••••" required={!isDemoMode}
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                    <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                      {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                  {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <LogIn size={17}/>}
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* Register form */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Your name" required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@email.com" required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Min. 6 characters" required
                    className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3.5 top-9 text-slate-400 cursor-pointer">{showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                  <input type="password" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} placeholder="Repeat password" required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                  {loading?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<CheckCircle size={17}/>}
                  {loading?'Creating...':'Create Account'}
                </button>
                <p className="text-center text-sm text-slate-500">
                  Already have an account? <button type="button" onClick={()=>setMode('login')} className="text-indigo-600 font-medium cursor-pointer hover:underline">Sign in</button>
                </p>
              </form>
            )}

            <p className="text-center text-xs text-slate-400 pb-2">
              {isDemoMode ? 'Demo mode — data saved in browser' : 'Access by invitation only'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
