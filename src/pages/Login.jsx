import { useState } from 'react'
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft, KeyRound } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { KDEC_LOGO } from '../assets/kdecLogo.js'

export default function Login({ inviteCode }) {
  const { login, registerWithInvite, forgotPassword } = useStore()
  const { lang, setLang, isAr } = useLang()

  // mode: 'login' | 'register' | 'forgot' | 'forgot-sent'
  const [mode,     setMode]     = useState(inviteCode ? 'register' : 'login')
  const [form,     setForm]     = useState({ email:'', password:'', name:'', confirmPassword:'' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  // ── Login ────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e?.preventDefault()
    setError(''); setLoading(true)
    const result = await login(form.email, form.password)
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  // ── Register ─────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault(); setError('')
    if (!form.name.trim())                       { setError('Please enter your full name'); return }
    if (form.password.length < 6)               { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    const result = await registerWithInvite(inviteCode, form.email, form.password, form.name)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    // autoLoggedIn = true means they are already logged in, nothing else to do
    // if not auto-logged in, show a clear message and switch to login
    if (!result?.autoLoggedIn) {
      setMode('login')
      setError('')
    }
  }

  // ── Forgot password ──────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault(); setError('')
    if (!form.email) { setError('Please enter your email address'); return }
    setLoading(true)
    const result = await forgotPassword(form.email)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    setMode('forgot-sent')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"/>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-7 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg p-1.5">
              <img src={KDEC_LOGO} alt="KDEC" className="w-full h-full object-contain"/>
            </div>
            <h1 className="font-display font-bold text-white text-2xl">KDEC Worship</h1>
            <p className="text-indigo-200 text-sm mt-1">Kasr El Doubara Evangelical Church</p>
            <div className="flex items-center justify-center gap-1 mt-3">
              <button onClick={() => setLang('ar')} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${lang==='ar' ? 'bg-white/30 text-white' : 'text-indigo-300 hover:text-white'}`}>AR</button>
              <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${lang==='en' ? 'bg-white/30 text-white' : 'text-indigo-300 hover:text-white'}`}>EN</button>
            </div>
          </div>

          <div className="px-8 py-6 space-y-5">

            {/* Invite banner */}
            {inviteCode && mode === 'register' && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-emerald-700 font-medium">
                  {isAr ? 'تمت دعوتك! أنشئ حسابك للانضمام للفريق.' : "You've been invited! Create your account to join the team."}
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>
                <span>{error}</span>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                LOGIN FORM
            ══════════════════════════════════════════════ */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@kdec.org" required
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-700">
                      {isAr ? 'كلمة المرور' : 'Password'}
                    </label>
                    <button type="button" onClick={() => { setMode('forgot'); setError('') }}
                      className="text-xs text-indigo-600 hover:underline cursor-pointer font-medium">
                      {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="••••••••" required
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    : <LogIn size={17}/>}
                  {loading ? (isAr ? 'جاري الدخول...' : 'Signing in...') : (isAr ? 'تسجيل الدخول' : 'Sign In')}
                </button>
              </form>
            )}

            {/* ══════════════════════════════════════════════
                REGISTER FORM
            ══════════════════════════════════════════════ */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-red-500">*</span>
                  </label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder={isAr ? 'اكتب اسمك...' : 'Your full name'} required dir="auto"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
                  </label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="you@email.com" required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'كلمة المرور' : 'Password'} <span className="text-red-500">*</span>
                    <span className="text-slate-400 font-normal ms-1">({isAr ? 'الحد الأدنى ٦ أحرف' : 'min. 6 characters'})</span>
                  </label>
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="••••••••" required
                    className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-9 text-slate-400 cursor-pointer">
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'} <span className="text-red-500">*</span>
                  </label>
                  <input type="password" value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    placeholder={isAr ? 'أعد كتابة كلمة المرور' : 'Repeat password'} required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    : <CheckCircle size={17}/>}
                  {loading ? (isAr ? 'جاري الإنشاء...' : 'Creating account...') : (isAr ? 'إنشاء الحساب' : 'Create Account')}
                </button>
                <p className="text-center text-sm text-slate-500">
                  {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="text-indigo-600 font-medium cursor-pointer hover:underline">
                    {isAr ? 'تسجيل الدخول' : 'Sign in'}
                  </button>
                </p>
              </form>
            )}

            {/* ══════════════════════════════════════════════
                FORGOT PASSWORD FORM
            ══════════════════════════════════════════════ */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={24} className="text-indigo-600"/>
                  </div>
                  <h2 className="font-display font-bold text-slate-800 text-lg">
                    {isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {isAr
                      ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين'
                      : 'Enter your email and we\'ll send you a reset link'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@kdec.org" required
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    : <Mail size={17}/>}
                  {loading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال رابط الإعادة' : 'Send Reset Link')}
                </button>
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer py-1">
                  <ArrowLeft size={14}/> {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </button>
              </form>
            )}

            {/* ══════════════════════════════════════════════
                FORGOT PASSWORD SENT CONFIRMATION
            ══════════════════════════════════════════════ */}
            {mode === 'forgot-sent' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-emerald-600"/>
                </div>
                <div>
                  <h2 className="font-display font-bold text-slate-800 text-lg">
                    {isAr ? 'تم الإرسال!' : 'Email Sent!'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">
                    {isAr
                      ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${form.email} — تحقق من بريدك الوارد (وربما مجلد Spam)`
                      : `A password reset link was sent to ${form.email} — check your inbox (and spam folder)`}
                  </p>
                </div>
                <button onClick={() => { setMode('login'); setError('') }}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl cursor-pointer hover:from-indigo-700 transition-all">
                  {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </button>
              </div>
            )}

            <p className="text-center text-xs text-slate-400 pb-2">
              {isAr ? 'الوصول بالدعوة فقط' : 'Access by invitation only'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
