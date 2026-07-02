import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Sparkles, LogIn as GuestIcon, Check, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, loginAnonymously, resetPassword } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isServant, setIsServant] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isGuestMode) {
        if (!guestName.trim()) {
          setError('من فضلك اكتب اسمك أولاً!');
          setLoading(false);
          return;
        }
        await loginAnonymously(guestName.trim());
      } else if (isForgotPassword) {
        if (!email.trim()) {
          setError('يرجى إدخال البريد الإلكتروني لإرسال رابط استعادة كلمة المرور.');
          setLoading(false);
          return;
        }
        await resetPassword(email.trim());
        setSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح! ✉️🔑');
      } else if (isRegister) {
        if (!name.trim() || !email.trim() || !password.trim()) {
          setError('من فضلك املأ جميع الحقول المطلوبة');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name, isServant);
      } else {
        if (!email.trim() || !password.trim()) {
          setError('من فضلك ادخل البريد الإلكتروني وكلمة المرور');
          setLoading(false);
          return;
        }
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      let arabicError = 'حدث خطأ ما، يرجى المحاولة مرة أخرى.';
      const errorCode = err.code || '';
      
      switch (errorCode) {
        case 'auth/email-already-in-use':
          arabicError = 'هذا البريد الإلكتروني مستخدم بالفعل، يرجى تسجيل الدخول.';
          break;
        case 'auth/user-not-found':
          arabicError = 'البريد الإلكتروني غير مسجل، يرجى إنشاء حساب جديد.';
          break;
        case 'auth/wrong-password':
          arabicError = 'كلمة المرور التي أدخلتها غير صحيحة. يرجى المحاولة مرة أخرى.';
          break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
          arabicError = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق من بياناتك.';
          break;
        case 'auth/invalid-email':
          arabicError = 'البريد الإلكتروني غير صالح، يرجى كتابته بشكل صحيح (مثال: user@example.com).';
          break;
        case 'auth/too-many-requests':
          arabicError = 'لقد قمت بمحاولات كثيرة خاطئة. تم حظر الحساب مؤقتاً لحمايتك، يرجى المحاولة لاحقاً.';
          break;
        case 'auth/weak-password':
          arabicError = 'كلمة المرور ضعيفة جداً. يجب أن تكون كلمة المرور 6 أحرف على الأقل.';
          break;
        case 'auth/popup-closed-by-user':
          arabicError = 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
          break;
        default:
          arabicError = err.message || 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.';
      }
      setError(arabicError);
    } finally {
      setLoading(false);
    }
  };

  const triggerGoogleLogin = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('فشل تسجيل الدخول باستخدام Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative z-10">
      {/* App Logo and Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8 flex flex-col items-center"
      >
        {/* Glowing Cross Logo */}
        <div className="w-20 h-20 bg-gradient-to-tr from-[#0E3D75] to-[#F39C3D] rounded-3xl flex items-center justify-center mb-4 glow-orange border border-white/20">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white">
            <path d="M11 2h2v7h7v2h-7v11h-2v-11H4V9h7z" />
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 font-sans text-center">
          دفتر صلاتي 📖✨
        </h1>
        <p className="text-[#B8C7E0] text-lg max-w-sm text-center">
          تابع صلاتك اليومية واجمع سلاسل الأيام الرائعة مع أصدقائك في الكنيسة!
        </p>
      </motion.div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md p-8 rounded-3xl glass-card relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />
        
        {/* Mode Selector Tab */}
        {!isGuestMode && !isForgotPassword && (
          <div className="flex bg-[#071426]/60 p-1.5 rounded-2xl mb-8 border border-white/5 relative z-10">
            <button 
              onClick={() => { setIsRegister(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 text-center text-sm font-semibold rounded-xl transition-all duration-300 ${!isRegister ? 'bg-[#0E3D75] text-white shadow-lg shadow-black/20' : 'text-[#B8C7E0] hover:text-white'}`}
            >
              تسجيل الدخول
            </button>
            <button 
              onClick={() => { setIsRegister(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 text-center text-sm font-semibold rounded-xl transition-all duration-300 ${isRegister ? 'bg-[#0E3D75] text-white shadow-lg shadow-black/20' : 'text-[#B8C7E0] hover:text-white'}`}
            >
              حساب جديد
            </button>
          </div>
        )}

        {/* Forgot Password Header */}
        {isForgotPassword && (
          <div className="mb-6 text-center">
            <h3 className="text-xl font-bold text-orange-400 mb-1 flex items-center justify-center gap-2">
              استعادة كلمة المرور 🔑
            </h3>
            <p className="text-xs text-[#B8C7E0]">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور الخاصة بك.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Success Message */}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-sm flex items-start gap-2.5"
          >
            <Check className="w-5 h-5 flex-shrink-0 text-teal-400 mt-0.5" />
            <span>{success}</span>
          </motion.div>
        )}

        {/* Guest Mode Indicator */}
        {isGuestMode && (
          <div className="mb-6 text-center">
            <h3 className="text-xl font-bold text-orange-400 mb-1 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              دخول سريع كضيف
            </h3>
            <p className="text-xs text-[#B8C7E0]">
              سجل صلاتك اليومية فوراً دون كلمة مرور. يمكنك المتابعة بشكل أسرع!
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5 relative z-10">
          {isGuestMode ? (
            <div>
              <label className="block text-sm font-medium text-[#B8C7E0] mb-2">اسم البطل / البطلة</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="اكتب اسمك الثلاثي الجميل هنا..."
                className="w-full px-5 py-4 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition text-center font-semibold text-lg"
                disabled={loading}
              />
            </div>
          ) : (
            <>
              {isRegister && (
                <div key="name-field">
                  <label className="block text-sm font-medium text-[#B8C7E0] mb-2">الاسم بالكامل</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك الجميل"
                    className="w-full px-4 py-3.5 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition"
                    disabled={loading}
                  />
                </div>
              )}
              <div key="email-field">
                <label className="block text-sm font-medium text-[#B8C7E0] mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="child@church.com"
                  className="w-full px-4 py-3.5 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition ltr"
                  disabled={loading}
                />
              </div>
              {!isForgotPassword && (
                <div key="password-field">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-[#B8C7E0]">كلمة المرور</label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setError(null); setSuccess(null); }}
                        className="text-xs font-semibold text-[#F39C3D] hover:underline cursor-pointer bg-transparent border-none outline-none"
                      >
                        هل نسيت كلمة المرور؟ 🤔
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition"
                    disabled={loading}
                  />
                </div>
              )}
              {isRegister && (
                <div key="role-selection-field" className="space-y-3 mt-3">
                  <label className="block text-sm font-medium text-[#B8C7E0] mb-1 text-right">نوع الحساب المطلوب:</label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Disciple Option */}
                    <div
                      onClick={() => setIsServant(false)}
                      className={`p-4 rounded-2xl border cursor-pointer duration-200 text-center flex flex-col items-center justify-center gap-1.5 select-none ${
                        !isServant
                          ? 'bg-[#0E3D75]/60 border-[#F39C3D] text-white shadow-md'
                          : 'bg-[#071426]/40 border-white/5 text-[#B8C7E0] hover:border-white/15'
                      }`}
                    >
                      <span className="text-2xl">📖</span>
                      <p className="text-xs font-black">مخدوم (عضو)</p>
                      <p className="text-[9px] text-[#B8C7E0]/60 leading-tight">لمتابعة صلواتك الشخصية والأوسمة والآيات</p>
                    </div>

                    {/* Servant Option */}
                    <div
                      onClick={() => setIsServant(true)}
                      className={`p-4 rounded-2xl border cursor-pointer duration-200 text-center flex flex-col items-center justify-center gap-1.5 select-none ${
                        isServant
                          ? 'bg-[#0E3D75]/60 border-[#F39C3D] text-white shadow-md'
                          : 'bg-[#071426]/40 border-white/5 text-[#B8C7E0] hover:border-white/15'
                      }`}
                    >
                      <span className="text-2xl">🛡️</span>
                      <p className="text-xs font-black">خادم كنيسة</p>
                      <p className="text-[9px] text-[#B8C7E0]/60 leading-tight">لمتابعة مخدوميك في الخدمة والاطلاع على التحليلات</p>
                    </div>
                  </div>
                  {isServant && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-amber-400 text-right font-bold mt-1 bg-amber-400/5 p-2 rounded-lg border border-amber-400/10"
                    >
                      ⚠️ حساب الخادم يتطلب مراجعة وقبول فوري من المالك الرئيسي (Eskander) قبل تفعيله وإمكانية الدخول.
                    </motion.p>
                  )}
                </div>
              )}
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-gradient-to-r from-[#F39C3D] to-amber-500 hover:from-amber-500 hover:to-orange-500 text-[#071426] font-bold rounded-2xl shadow-lg hover:shadow-orange-500/20 transition-all duration-300 flex items-center justify-center gap-2 text-lg glow-orange cursor-pointer"
          >
            {loading ? (
              <span className="w-6 h-6 border-2 border-[#071426] border-t-transparent rounded-full animate-spin" />
            ) : isGuestMode ? (
              <>
                <GuestIcon className="w-5 h-5" />
                <span>دخول وتسجيل صلاتي!</span>
              </>
            ) : isForgotPassword ? (
              <>
                <Sparkles className="w-5 h-5" />
                <span>إرسال رابط استعادة المرور</span>
              </>
            ) : isRegister ? (
              <>
                <UserPlus className="w-5 h-5" />
                <span>إنشاء حساب جديد</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Divider */}
        {!isForgotPassword && (
          <>
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <span className="relative px-3 bg-[#0E3D75] text-xs text-[#B8C7E0] font-medium uppercase">أو</span>
            </div>

            {/* Google Sign In Button */}
            {!isGuestMode && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={triggerGoogleLogin}
                disabled={loading}
                className="w-full py-3.5 px-6 bg-[#071426]/80 hover:bg-[#071426] text-white font-medium rounded-2xl border border-white/10 hover:border-white/20 transition duration-300 flex items-center justify-center gap-3 relative z-10 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4 h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.107C18.29 1.92 15.48 1 12.24 1 6.136 1 1.18 5.92 1.18 12s4.956 11 11.06 11c6.37 0 10.6-4.434 10.6-10.74 0-.723-.078-1.277-.174-1.975H12.24z"
                  />
                </svg>
                <span>تسجيل الدخول باستخدام Google</span>
              </motion.button>
            )}
          </>
        )}

        {/* Toggle Guest Mode & Regular Mode / Forgot Password */}
        <div className="text-center mt-6 text-sm relative z-10 space-y-3">
          {isGuestMode ? (
            <button 
              onClick={() => { setIsGuestMode(false); setError(null); setSuccess(null); }}
              className="text-[#B8C7E0] hover:text-[#F39C3D] font-semibold underline transition cursor-pointer bg-transparent border-none outline-none"
            >
              العودة لتسجيل الدخول العادي
            </button>
          ) : isForgotPassword ? (
            <button 
              onClick={() => { setIsForgotPassword(false); setError(null); setSuccess(null); }}
              className="text-[#B8C7E0] hover:text-[#F39C3D] font-semibold underline transition cursor-pointer bg-transparent border-none outline-none"
            >
              العودة لتسجيل الدخول 🔙
            </button>
          ) : (
            <div className="space-y-2">
              <div>
                <span className="text-[#B8C7E0]">ليس لديك بريد إلكتروني؟ </span>
                <button 
                  onClick={() => { setIsGuestMode(true); setError(null); setSuccess(null); }}
                  className="text-[#F39C3D] hover:underline font-bold transition cursor-pointer bg-transparent border-none outline-none"
                >
                  ادخل سريعاً كضيف 🚀
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
