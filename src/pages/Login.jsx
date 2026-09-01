import { useState } from 'react'
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft, KeyRound } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { KDEC_LOGO } from '../assets/kdecLogo.js'
import { getDemoAccount } from '../lib/demoAccounts.js'

export default function Login({ inviteCode }) {
  const { login, registerWithInvite, forgotPassword, isDemoMode } = useStore()
  const { lang, setLang, isAr } = useLang()

  // mode: 'login' | 'register' | 'forgot' | 'forgot-sent'
  const [mode,     setMode]     = useState(inviteCode ? 'register' : 'login')
  const [form,     setForm]     = useState({ email:'', password:'', name:'', confirmPassword:'' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
    setSuccess('')
  }

  const unexpectedError = isAr ? 'حدث خطأ غير متوقع. حاول مرة أخرى.' : 'Something went wrong. Please try again.'

  // ── Login ────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const result = await login(form.email.trim(), form.password)
      if (result?.error) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : unexpectedError)
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async (email) => {
    const password = 'demo'
    setForm(f => ({ ...f, email, password }))
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result?.error) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : unexpectedError)
    } finally {
      setLoading(false)
    }
  }

  // ── Register ─────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim()) {
      setError(isAr ? 'أدخل اسمك الكامل' : 'Please enter your full name')
      return
    }
    if (form.password.length < 6) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const result = await registerWithInvite(inviteCode, form.email.trim(), form.password, form.name.trim())
      if (result?.error) {
        setError(result.error)
        return
      }
      // An active session will take the user into the app. Otherwise, make the
      // required email-confirmation step explicit on the sign-in screen.
      if (!result?.autoLoggedIn) {
        setMode('login')
        setSuccess(isAr
          ? 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده، ثم سجّل الدخول.'
          : (result?.message || 'Account created. Check your email to confirm it, then sign in.'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : unexpectedError)
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ──────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.email.trim()) {
      setError(isAr ? 'أدخل بريدك الإلكتروني' : 'Please enter your email address')
      return
    }
    setLoading(true)
    try {
      const result = await forgotPassword(form.email.trim())
      if (result?.error) {
        setError(result.error)
        return
      }
      setMode('forgot-sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : unexpectedError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"/>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 sm:px-8 py-7 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg p-1.5">
              <img src={KDEC_LOGO} alt="KDEC Worship" className="w-full h-full object-contain"/>
            </div>
            <h1 className="font-display font-bold text-white text-2xl">KDEC Worship</h1>
            <p className="text-indigo-200 text-sm mt-1">Kasr El Doubara Evangelical Church</p>
            <div className="flex items-center justify-center gap-1 mt-3" role="group" aria-label={isAr ? 'لغة الواجهة' : 'Interface language'}>
              <button type="button" onClick={() => setLang('ar')} aria-pressed={lang === 'ar'} aria-label="العربية"
                className={`min-h-9 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${lang==='ar' ? 'bg-white/30 text-white' : 'text-indigo-200 hover:text-white'}`}>AR</button>
              <button type="button" onClick={() => setLang('en')} aria-pressed={lang === 'en'} aria-label="English"
                className={`min-h-9 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${lang==='en' ? 'bg-white/30 text-white' : 'text-indigo-200 hover:text-white'}`}>EN</button>
            </div>
          </div>

          <div className="px-4 sm:px-8 py-6 space-y-5">

            {/* Invite banner */}
            {inviteCode && mode === 'register' && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5" role="status">
                <CheckCircle size={14} aria-hidden="true" className="text-emerald-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-emerald-700 font-medium">
                  {isAr ? 'تمت دعوتك! أنشئ حسابك للانضمام للفريق.' : "You've been invited! Create your account to join the team."}
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div id="auth-error" role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <AlertCircle size={15} aria-hidden="true" className="flex-shrink-0 mt-0.5"/>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div role="status" className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                <CheckCircle size={15} aria-hidden="true" className="flex-shrink-0 mt-0.5"/>
                <span>{success}</span>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                LOGIN FORM
            ══════════════════════════════════════════════ */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail size={15} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input id="login-email" name="email" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@kdec.org" required autoComplete="email" inputMode="email" dir="ltr"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                      {isAr ? 'كلمة المرور' : 'Password'}
                    </label>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                      className="text-xs text-indigo-600 hover:underline cursor-pointer font-medium">
                      {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={15} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input id="login-password" name="password" type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="••••••••" required autoComplete="current-password" dir="ltr"
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                    <button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}
                      aria-label={showPass ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 cursor-pointer rounded-lg">
                      {showPass ? <EyeOff size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>}
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

            {mode === 'login' && isDemoMode && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3" aria-label={isAr ? 'حسابات العرض التجريبي' : 'Demo accounts'}>
                <p className="text-xs font-semibold text-indigo-800 mb-2">
                  {isAr ? 'وضع العرض التجريبي — اختر حساباً للمتابعة' : 'Demo mode — choose an account to continue'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button type="button" disabled={loading} onClick={() => handleDemoLogin(getDemoAccount('admin').email)}
                    className="min-h-10 rounded-lg bg-white border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                    {isAr ? 'الدخول كمسؤول' : 'Continue as admin'}
                  </button>
                  <button type="button" disabled={loading} onClick={() => handleDemoLogin(getDemoAccount('leader').email)}
                    className="min-h-10 rounded-lg bg-white border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                    {isAr ? 'الدخول كقائد' : 'Continue as leader'}
                  </button>
                  <button type="button" disabled={loading} onClick={() => handleDemoLogin(getDemoAccount('member').email)}
                    className="min-h-10 rounded-lg bg-white border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                    {isAr ? 'الدخول كعضو' : 'Continue as member'}
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                REGISTER FORM
            ══════════════════════════════════════════════ */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="register-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-red-500">*</span>
                  </label>
                  <input id="register-name" name="name" value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder={isAr ? 'اكتب اسمك...' : 'Your full name'} required autoComplete="name" dir="auto"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
                  </label>
                  <input id="register-email" name="email" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="you@email.com" required autoComplete="email" inputMode="email" dir="ltr"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                </div>
                <div className="relative">
                  <label htmlFor="register-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'كلمة المرور' : 'Password'} <span className="text-red-500">*</span>
                    <span className="text-slate-400 font-normal ms-1">({isAr ? 'الحد الأدنى ٦ أحرف' : 'min. 6 characters'})</span>
                  </label>
                  <input id="register-password" name="new-password" type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="••••••••" required minLength={6} autoComplete="new-password" dir="ltr"
                    className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}
                    aria-label={showPass ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute right-2 bottom-1 w-9 h-9 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 cursor-pointer rounded-lg">
                    {showPass ? <EyeOff size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>}
                  </button>
                </div>
                <div>
                  <label htmlFor="register-confirm-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'} <span className="text-red-500">*</span>
                  </label>
                  <input id="register-confirm-password" name="confirm-password" type="password" value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    placeholder={isAr ? 'أعد كتابة كلمة المرور' : 'Repeat password'} required minLength={6} autoComplete="new-password" dir="ltr"
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
                  <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}
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
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail size={15} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input id="forgot-email" name="email" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@kdec.org" required autoComplete="email" inputMode="email" dir="ltr"
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
                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer py-1">
                  <ArrowLeft size={14} aria-hidden="true" className={isAr ? 'rotate-180' : ''}/> {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </button>
              </form>
            )}

            {/* ══════════════════════════════════════════════
                FORGOT PASSWORD SENT CONFIRMATION
            ══════════════════════════════════════════════ */}
            {mode === 'forgot-sent' && (
              <div className="text-center space-y-4" role="status">
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
                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}
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
