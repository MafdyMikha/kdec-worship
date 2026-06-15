import { useState } from 'react'
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { KDEC_LOGO } from '../assets/kdecLogo.js'
import { hasSupabase } from '../lib/supabase.js'

export default function Login({ inviteCode }) {
  const { login, registerWithInvite } = useStore()
  const { lang, setLang } = useLang()
  const [mode,     setMode]     = useState(inviteCode ? 'register' : 'login')
  const [form,     setForm]     = useState({ email:'', password:'', name:'', confirmPassword:'' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const handleLogin = async (e) => {
    e?.preventDefault(); setError(''); setLoading(true)
    if (!hasSupabase) {
      setLoading(false)
      setError('Supabase is not connected yet. Add your Supabase URL and anon key in Vercel environment variables.')
      return
    }
    const result = await login(form.email, form.password)
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setError('')
    if (!inviteCode) { setError('Registration requires an invitation link from an admin.'); return }
    if (!hasSupabase) { setError('Supabase is not connected yet. Add your Supabase URL and anon key in Vercel first.'); return }
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
            {/* Setup banner (Supabase not configured) */}
            {!hasSupabase && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-blue-700">Supabase is not connected yet. Add <code className="bg-blue-100 px-1 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-blue-100 px-1 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in Vercel to enable real accounts.</p>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••••" required
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
                <button type="button" onClick={()=> inviteCode ? setMode('register') : setError('Ask an admin to send you an invitation link before registering.')}
                  className="w-full py-3 border border-emerald-200 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <CheckCircle size={17}/> Register with invitation
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
              Access by invitation only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
