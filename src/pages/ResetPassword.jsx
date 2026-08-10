import { useState } from 'react'
import { Eye, EyeOff, KeyRound, CheckCircle, AlertCircle, Lock } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { KDEC_LOGO } from '../assets/kdecLogo.js'

export default function ResetPassword() {
  const { updatePassword, finishPasswordRecovery } = useStore()
  const { isAr } = useLang()

  const [password,  setPassword]  = useState('')
  const [confirm,    setConfirm]  = useState('')
  const [showPass,   setShowPass] = useState(false)
  const [error,      setError]    = useState('')
  const [loading,    setLoading]  = useState(false)
  const [done,       setDone]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6)      { setError(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters'); return }
    if (password !== confirm)     { setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return }
    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    setDone(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"/>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">

          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-7 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg p-1.5">
              <img src={KDEC_LOGO} alt="KDEC" className="w-full h-full object-contain"/>
            </div>
            <h1 className="font-display font-bold text-white text-2xl">KDEC Worship</h1>
          </div>

          <div className="px-8 py-7 space-y-5">
            {!done ? (
              <>
                <div className="text-center">
                  <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={24} className="text-indigo-600"/>
                  </div>
                  <h2 className="font-display font-bold text-slate-800 text-lg">
                    {isAr ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {isAr ? 'أدخل كلمة المرور الجديدة لحسابك' : 'Enter a new password for your account'}
                  </p>
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <label htmlFor="recovery-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                      {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
                    </label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input id="recovery-password" name="new-password" type={showPass ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" required minLength={6} autoComplete="new-password"
                        className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                      <button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}
                        aria-label={showPass?(isAr?'إخفاء كلمة المرور':'Hide password'):(isAr?'إظهار كلمة المرور':'Show password')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                        {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="recovery-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                      {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    </label>
                    <input id="recovery-confirm" name="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••" required minLength={6} autoComplete="new-password"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                    {loading
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      : <CheckCircle size={17}/>}
                    {loading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ كلمة المرور' : 'Save Password')}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4 py-2">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-emerald-600"/>
                </div>
                <div>
                  <h2 className="font-display font-bold text-slate-800 text-lg">
                    {isAr ? 'تم تحديث كلمة المرور!' : 'Password Updated!'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">
                    {isAr ? 'يمكنك الآن استخدام كلمة المرور الجديدة لتسجيل الدخول' : 'You can now use your new password to sign in'}
                  </p>
                </div>
                <button onClick={() => { finishPasswordRecovery(); window.location.assign('/') }}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl cursor-pointer hover:from-indigo-700 transition-all">
                  {isAr ? 'الذهاب للتطبيق' : 'Go to App'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
