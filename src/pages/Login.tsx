import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Key, User, GraduationCap, Check, AlertCircle, ArrowLeft, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const { loginWithCode, completeRegistration, setupFirstAdmin, hasNoAdmins } = useAuth();
  const navigate = useNavigate();
  
  // Login Steps: 'code' | 'register'
  const [step, setStep] = useState<'code' | 'register'>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<'تالتة' | 'رابعة' | 'خامسة' | 'سادسة'>('تالتة');
  const [codeRole, setCodeRole] = useState<'user' | 'servant' | 'admin'>('user');

  // First Admin Setup States
  const [setupName, setSetupName] = useState('');
  const [setupKey, setSetupKey] = useState('');

  // Status indicators
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle entering code
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('يرجى إدخال كود تسجيل الدخول الخاص بك!');
      return;
    }
    
    setError(null);
    setLoading(true);

    try {
      const formattedCode = code.trim().toUpperCase();
      const result = await loginWithCode(formattedCode);
      
      if (result.success) {
        if (result.isFirstLogin) {
          // Proceed to registration details
          setCodeRole(result.role || 'user');
          setStep('register');
        } else {
          const userRole = result.user?.role || result.role || 'user';
          const destination = 
            userRole === 'user' ? '/dashboard' :
            userRole === 'servant' ? '/dashboard' :
            '/admin';

          console.log("LOGIN STEP 9: Navigation initiated. Role is:", userRole, "Destination is:", destination);
          
          // Navigate to the target screen immediately, passing the success message in router state
          navigate(destination, { state: { message: 'تم تسجيل الدخول بنجاح! 🎉' } });
        }
      }
    } catch (err: any) {
      setError(err.message || 'الكود المدخل غير صحيح أو غير مفعل، يرجى التحقق وإعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  // Handle registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسمك بالكامل لإنشاء ملفك الشخصي!');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formattedCode = code.trim().toUpperCase();
      // Only children and servants choose a grade
      const selectedGrade = (codeRole === 'user' || codeRole === 'servant') ? grade : undefined;
      const registeredUser = await completeRegistration(formattedCode, name.trim(), selectedGrade);
      
      const userRole = registeredUser?.role || 'user';
      const destination = 
        userRole === 'user' ? '/dashboard' :
        userRole === 'servant' ? '/dashboard' :
        '/admin';

      navigate(destination, { state: { message: 'تم تسجيل الدخول بنجاح' } });
    } catch (err: any) {
      setError(err.message || 'فشلت عملية إنشاء الحساب، يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  // Handle setup of first admin
  const handleFirstAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim() || !setupKey.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة!');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const adminUser = await setupFirstAdmin(setupName.trim(), setupKey.trim());
      
      const destination = '/admin';
      navigate(destination, { state: { message: 'تم تسجيل الدخول بنجاح' } });
    } catch (err: any) {
      setError(err.message || 'فشل إعداد حساب المدير، يرجى التأكد من المفتاح السري.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative z-10" id="login_page_container">
      {/* Header and Brand */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8 flex flex-col items-center"
      >
        <div className="w-20 h-20 bg-gradient-to-tr from-[#0E3D75] to-[#F39C3D] rounded-3xl flex items-center justify-center mb-4 glow-orange border border-white/20 shadow-xl shadow-black/30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white">
            <path d="M11 2h2v7h7v2h-7v11h-2v-11H4V9h7z" />
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 font-sans text-center">
          دفتر صلاتي 📖✨
        </h1>
        <p className="text-[#B8C7E0] text-base max-w-sm text-center font-medium leading-relaxed">
          تابع صلاتك اليومية، واجمع السلاسل الروحية الرائعة داخل كنيستك!
        </p>
      </motion.div>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md p-8 rounded-3xl glass-card relative overflow-hidden shadow-2xl shadow-black/40 border border-white/5"
      >
        {/* Glow accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />

        {/* Global Messages */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5 text-right"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-sm flex items-start gap-2.5 text-right"
          >
            <Check className="w-5 h-5 flex-shrink-0 text-teal-400 mt-0.5" />
            <span>{success}</span>
          </motion.div>
        )}

        {/* ONE-TIME FIRST ADMIN SETUP SCREEN */}
        {hasNoAdmins ? (
          <div>
            <div className="text-center mb-6">
              <span className="inline-flex items-center justify-center p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 mb-3">
                <Shield className="w-6 h-6" />
              </span>
              <h3 className="text-xl font-bold text-white mb-1">إعداد المدير الأول</h3>
              <p className="text-xs text-[#B8C7E0]">
                لا يوجد أي حساب مدير في قاعدة البيانات حالياً. يرجى تهيئة حسابك كمدير أول للمرة الأولى.
              </p>
            </div>

            <form onSubmit={handleFirstAdminSetupSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#B8C7E0] mb-2 text-right">اسم المدير</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8C7E0]/50" />
                  <input
                    type="text"
                    required
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="اكتب اسمك الثلاثي هنا..."
                    className="w-full pr-12 pl-4 py-3.5 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition text-right font-medium"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#B8C7E0] mb-2 text-right">مفتاح الإعداد السري (Environment Variable)</label>
                <div className="relative">
                  <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8C7E0]/50" />
                  <input
                    type="password"
                    required
                    value={setupKey}
                    onChange={(e) => setSetupKey(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-12 pl-4 py-3.5 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition text-right"
                    disabled={loading}
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-[#071426] font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all duration-300 flex items-center justify-center gap-2 text-lg cursor-pointer"
              >
                {loading ? (
                  <span className="w-6 h-6 border-2 border-[#071426] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>تفعيل حسابي كمدير</span>
                  </>
                )}
              </motion.button>
            </form>
          </div>
        ) : (
          /* REGULAR LOGIN FLOW */
          <div>
            {step === 'code' ? (
              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-black text-orange-400 mb-2">أدخل الكود</h3>
                  <p className="text-xs text-[#B8C7E0] leading-relaxed">
                    أدخل كودك الفريد الموجود في كشكول صلاتك للدخول الفوري.
                  </p>
                </div>

                <div>
                  <div className="relative">
                    <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8C7E0]/50" />
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="مثال: MKD-8G4XQ"
                      className="w-full pr-12 pl-4 py-4 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition text-center uppercase tracking-wider font-extrabold text-xl"
                      disabled={loading}
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-gradient-to-r from-[#F39C3D] to-amber-500 hover:from-amber-500 hover:to-[#F39C3D] text-[#071426] font-bold rounded-2xl shadow-lg hover:shadow-orange-500/20 transition-all duration-300 flex items-center justify-center gap-2 text-lg glow-orange cursor-pointer"
                >
                  {loading ? (
                    <span className="w-6 h-6 border-2 border-[#071426] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>دخول</span>
                  )}
                </motion.button>
              </form>
            ) : (
              /* REGISTRATION FOR NEW UNLINKED CODE */
              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    type="button" 
                    onClick={() => { setStep('code'); setError(null); }}
                    className="p-2 hover:bg-white/5 rounded-xl text-[#B8C7E0] hover:text-white transition cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="text-right flex-1">
                    <h3 className="text-xl font-bold text-white">إكمال الملف الشخصي</h3>
                    <p className="text-xs text-[#B8C7E0] mt-0.5">
                      أنت تسجل للمرة الأولى باستخدام كود {code.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#B8C7E0] mb-2 text-right">الاسم بالكامل</label>
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8C7E0]/50" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="اكتب اسمك الثلاثي الجميل هنا..."
                      className="w-full pr-12 pl-4 py-3.5 bg-[#071426]/75 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] focus:border-transparent transition text-right font-semibold"
                      disabled={loading}
                    />
                  </div>
                </div>

                {(codeRole === 'user' || codeRole === 'servant') && (
                  <div>
                    <label className="block text-sm font-medium text-[#B8C7E0] mb-3 text-right">
                      {codeRole === 'user' ? 'في سنة كام؟' : 'خادم في سنة كام؟'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['تالتة', 'رابعة', 'خامسة', 'سادسة'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGrade(g)}
                          className={`py-3.5 px-4 rounded-2xl border text-center font-bold text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                            grade === g
                              ? 'bg-[#0E3D75] border-[#F39C3D] text-white shadow-lg'
                              : 'bg-[#071426]/40 border-white/5 text-[#B8C7E0] hover:bg-[#071426]/70 hover:border-white/15'
                          }`}
                        >
                          <GraduationCap className={`w-4 h-4 ${grade === g ? 'text-[#F39C3D]' : 'text-[#B8C7E0]/50'}`} />
                          <span>سنة {g}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-[#0E3D75] hover:bg-[#0E3D75]/80 border border-[#F39C3D]/30 text-white font-bold rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-lg cursor-pointer"
                >
                  {loading ? (
                    <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-[#F39C3D]" />
                      <span>إتمام الدخول</span>
                    </>
                  )}
                </motion.button>
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
