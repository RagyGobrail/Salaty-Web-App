import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, Heart, Calendar, LogOut, Flame, Sparkles, 
  Trash2, Copy, Trophy, Check, Trash, Edit, User, Upload, Image as ImageIcon
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { FavoriteVerse } from '../types';
import { formatArabicDate } from '../utils/dateUtils';
import { useLocation, useNavigate } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLeader = user?.role === 'admin' || user?.role === 'superadmin' || user?.email === 'eskander.ragy@gmail.com' || (user?.role === 'servant' && (user?.status === 'approved' || user?.status === 'active'));
  const [favorites, setFavorites] = useState<FavoriteVerse[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(true);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [selectedPhotoURL, setSelectedPhotoURL] = useState(user?.photoURL || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Custom UI notification & modal states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    // Auto clear after 3.5 seconds
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (location.state?.message) {
      showToast(location.state.message, 'success');
      // Clear location state so toast is not re-rendered on reload
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
      setEditedName(user.name || '');
      setSelectedPhotoURL(user.photoURL || '');
    }
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.2 * 1024 * 1024) { // Limit to ~1.2MB for firestore performance
        setUploadError("حجم الصورة كبير جداً! الرجاء اختيار صورة أصغر من 1.2 ميجابايت.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSelectedPhotoURL(reader.result);
        }
      };
      reader.onerror = () => {
        setUploadError("حدث خطأ أثناء قراءة الصورة. حاول مرة أخرى.");
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    setLoadingFavs(true);
    try {
      const q = query(
        collection(db, 'favoriteVerses'),
        where('uid', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const favList: FavoriteVerse[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        favList.push({
          id: doc.id,
          uid: data.uid || '',
          text: data.text || '',
          reference: data.reference || '',
          mood: data.mood || '',
          savedAt: data.savedAt || new Date().toISOString()
        } as FavoriteVerse);
      });
      // Sort favorites by saved date descending
      favList.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      setFavorites(favList);
    } catch (e) {
      console.error("Error fetching favorites:", e);
    } finally {
      setLoadingFavs(false);
    }
  };

  const removeFavorite = (favId: string) => {
    setDeleteConfirmId(favId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const favId = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await deleteDoc(doc(db, 'favoriteVerses', favId));
      setFavorites(prev => prev.filter(f => f.id !== favId));
      showToast("تم حذف الآية بنجاح من قائمتك المفضلة! ✨🗑️", 'success');
    } catch (err: any) {
      console.error("Error removing favorite:", err);
      showToast(`عذراً، فشل حذف الآية. الخطأ: ${err.message || err}`, 'error');
    }
  };

  const copyToClipboard = (text: string, ref: string) => {
    const shareText = `"${text}" - ${ref}\n\nتطبيق دفتر صلاتي 📖✨`;
    navigator.clipboard.writeText(shareText);
    showToast("تم نسخ الآية الجميلة إلى حافظتك! 📋❤️", 'success');
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!editedName.trim()) {
      showToast("الرجاء إدخال الاسم!", 'error');
      return;
    }
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: editedName,
        photoURL: selectedPhotoURL
      });
      await refreshUser();
      setIsEditingProfile(false);
      showToast("تم تحديث ملفك الشخصي بنجاح! 🎉", 'success');
    } catch (err) {
      console.error("Error updating profile:", err);
      showToast("حدث خطأ أثناء تحديث الملف الشخصي.", 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const avatarPresets = [
    // Neutral Emojis / Animals
    { url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=happy`, label: "مبتسم سعيد" },
    { url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=angel`, label: "ملاك طيب" },
    { url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=star`, label: "نجم ساطع" },
    { url: `https://api.dicebear.com/7.x/bottts/svg?seed=cute`, label: "روبوت ذكي" },
    { url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editedName || 'ص')}`, label: "الحروف الأولى" },
    
    // Girls
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Zoe`, label: "فتاة زوي" },
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Maya`, label: "فتاة مايا" },
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Lucy`, label: "فتاة لوسي" },
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Lily`, label: "فتاة ليلي" },

    // Boys
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Liam`, label: "فتى ليام" },
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Oliver`, label: "فتى أوليفر" },
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Leo`, label: "فتى ليو" },
    { url: `https://api.dicebear.com/7.x/lorelei/svg?seed=Jack`, label: "فتى جاك" },
  ];

  // Badge list with calculation based on user stats
  const totalDays = user?.totalPrayerDays || 0;
  const longestStr = user?.longestStreak || 0;

  const badges = [
    {
      id: 'first_prayer',
      title: '🌱 أول صلاة',
      desc: 'سجلت صلاتك الأولى بنجاح وبدأت رحلتك الروحية',
      unlocked: totalDays >= 1,
      requirement: 'صلِّ لمرة واحدة على الأقل'
    },
    {
      id: 'seven_days',
      title: '🔥 بطل الأسبوع',
      desc: 'حافظت على سلسلة صلاة لمدة 7 أيام متتالية',
      unlocked: longestStr >= 7,
      requirement: 'سلسلة 7 أيام متتالية'
    },
    {
      id: 'thirty_days',
      title: '⭐ نجم الشهر',
      desc: 'وصلت إلى سلسلة صلاة لمدة 30 يوماً متتالياً',
      unlocked: longestStr >= 30,
      requirement: 'سلسلة 30 يوماً متتالياً'
    },
    {
      id: 'hundred_days',
      title: '👑 تاج الأبطال',
      desc: 'أتممت 100 يوم متتالي من التحدث مع يسوع في الصلاة',
      unlocked: longestStr >= 100,
      requirement: 'سلسلة 100 يوم متتالي'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-24 relative z-10">
      
      {/* Profile Overview Card */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl glass-card p-8 mb-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-right">
            <img 
              src={user?.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user?.uid}`} 
              alt="صورة بطل الصلاة" 
              className="w-24 h-24 rounded-3xl bg-[#071426] border-4 border-[#F39C3D] glow-orange p-1 flex-shrink-0 object-cover"
            />
            <div>
              <div className="inline-block py-1 px-3 bg-orange-500/10 text-[#F39C3D] border border-orange-500/20 rounded-full text-xs font-black mb-2">
                {user?.role === 'superadmin' ? "خادم رئيسي 👑 (Super Admin)" : user?.role === 'admin' ? "خادم (Admin)" : user?.role === 'servant' ? "خادم" : "بطل صلاة متميز 🛡️"}
              </div>
              <h2 className="text-3xl font-black text-white">{user?.name}</h2>
              {user?.code && (
                <div className="flex items-center gap-2 mt-2 bg-[#071426]/50 px-3 py-1.5 rounded-xl border border-white/5 w-fit mx-auto sm:mx-0">
                  <span className="text-xs text-[#B8C7E0]">كود الدخول الخاص بك:</span>
                  <span className="font-mono font-black text-sm text-[#F39C3D] tracking-wider">{user.code}</span>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(user.code || '');
                      showToast("تم نسخ كود الدخول الخاص بك! 📋", 'success');
                    }}
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition cursor-pointer"
                    title="نسخ الكود"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {user?.email && (
                <p className="text-sm text-[#B8C7E0] mt-1 font-medium ltr">{user.email}</p>
              )}
              
              <div className="flex items-center gap-2 mt-4 text-xs text-[#B8C7E0] justify-center sm:justify-start">
                <Calendar className="w-4 h-4 text-[#F39C3D]" />
                <span>تاريخ الانضمام:</span>
                <span className="font-extrabold text-white">
                  {user?.createdAt ? formatArabicDate(
                    (typeof user.createdAt === 'string' 
                      ? user.createdAt 
                      : (user.createdAt.toDate ? user.createdAt.toDate().toISOString() : new Date().toISOString())
                    ).split('T')[0]
                  ) : '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 w-full sm:w-auto relative z-30">
            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-5 py-3 bg-[#0E3D75] hover:bg-[#0E3D75]/80 active:scale-[0.98] border border-[#F39C3D]/20 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 relative z-30"
            >
              <Edit className="w-4 h-4 text-[#F39C3D]" />
              <span>تعديل الحساب</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.98] border border-rose-500/20 text-rose-300 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 relative z-30"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>

        {/* Collapsible Edit Profile Form */}
        <AnimatePresence>
          {isEditingProfile && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 pt-8 border-t border-white/5 text-right overflow-hidden"
            >
              <h3 className="text-lg font-black text-white mb-4">تعديل ملفك الشخصي 🎨</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Name Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#B8C7E0]">اسم بطل الصلاة:</label>
                  <input 
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="px-4 py-3 bg-[#071426]/80 border border-white/10 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition"
                    placeholder="اكتب اسمك هنا..."
                  />

                  <div className="mt-4">
                    <span className="text-xs font-bold text-[#B8C7E0] block mb-2">الصورة الشخصية الحالية:</span>
                    <div className="flex items-center gap-4 bg-[#071426]/40 p-4 rounded-2xl border border-white/5">
                      <img 
                        src={selectedPhotoURL} 
                        alt="الرمز المختار"
                        className="w-16 h-16 rounded-2xl bg-[#071426] border-2 border-[#F39C3D] p-0.5 object-cover" 
                      />
                      <div>
                        <p className="text-xs font-bold text-white">رمز بطل الصلاة الحالي</p>
                        <p className="text-[10px] text-[#B8C7E0]/60 mt-0.5">اختر رمزك المفضل من المجموعة، أو قم برفع صورتك الخاصة أدناه!</p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Picture Uploader */}
                  <div className="mt-4 p-4 bg-[#071426]/60 rounded-2xl border border-white/5 flex flex-col gap-3">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <span>📸 اختر صورتك الخاصة من جهازك</span>
                    </span>
                    <label className="flex flex-col items-center justify-center gap-2 py-4 px-3 bg-[#0B2545]/50 border-2 border-dashed border-white/10 hover:border-[#F39C3D]/50 rounded-2xl cursor-pointer duration-200">
                      <Upload className="w-5 h-5 text-[#F39C3D] animate-bounce" />
                      <span className="text-xs font-bold text-white">اضغط لاختيار صورة من صورك</span>
                      <span className="text-[9px] text-[#B8C7E0]/50">صيغ الصور المدعومة (PNG, JPG, WebP)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                      />
                    </label>
                    {uploadError && (
                      <p className="text-[10px] font-bold text-rose-400 text-center">{uploadError}</p>
                    )}
                  </div>
                </div>

                {/* Avatar Selector Grid */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#B8C7E0] mb-2">اختر صورتك الرمزية المفضلة (أولاد وبنات ورموز لطيفة):</label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-56 overflow-y-auto pr-1">
                    {avatarPresets.map((preset, idx) => {
                      const isSelected = selectedPhotoURL === preset.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPhotoURL(preset.url)}
                          className={`relative rounded-xl p-1 bg-[#071426] border-2 transition duration-200 cursor-pointer hover:scale-105 ${
                            isSelected ? 'border-[#F39C3D] bg-[#F39C3D]/10' : 'border-white/5 hover:border-white/20'
                          }`}
                          title={preset.label}
                        >
                          <img 
                            src={preset.url} 
                            alt={preset.label} 
                            className="w-full h-auto aspect-square rounded-lg" 
                          />
                          {isSelected && (
                            <div className="absolute -top-1 -left-1 bg-[#F39C3D] text-[#071426] rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5 font-black" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end mt-8 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[#B8C7E0] hover:text-white rounded-xl text-xs font-bold duration-200"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#F39C3D] to-amber-500 text-[#071426] hover:scale-[1.02] active:scale-[0.98] font-black rounded-xl text-xs duration-200 glow-orange flex items-center gap-1.5"
                >
                  {isSavingProfile ? "جاري الحفظ..." : "حفظ التغييرات 💾"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Key Metrics Grid */}
        {!isLeader && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/5">
            <div className="bg-[#071426]/50 p-4 rounded-2xl border border-white/5 text-center">
              <div className="text-2xl mb-1 text-[#F39C3D]">🔥</div>
              <div className="text-2xl font-extrabold text-white">{user?.currentStreak || 0}</div>
              <div className="text-xs text-[#B8C7E0] mt-1 font-medium">السلسلة الحالية</div>
            </div>

            <div className="bg-[#071426]/50 p-4 rounded-2xl border border-white/5 text-center">
              <div className="text-2xl mb-1 text-yellow-400">🏆</div>
              <div className="text-2xl font-extrabold text-white">{longestStr}</div>
              <div className="text-xs text-[#B8C7E0] mt-1 font-medium">أطول سلسلة</div>
            </div>

            <div className="bg-[#071426]/50 p-4 rounded-2xl border border-white/5 text-center col-span-2 sm:col-span-1">
              <div className="text-2xl mb-1 text-emerald-400">🎯</div>
              <div className="text-2xl font-extrabold text-white">{totalDays}</div>
              <div className="text-xs text-[#B8C7E0] mt-1 font-medium">إجمالي الأيام</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Achievement Badges Section */}
      {!isLeader && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl glass-card p-6 sm:p-8 mb-8"
        >
          <h3 className="text-xl font-black text-white mb-2 text-right">أوسمة الشرف والأبطال 🏆🛡️</h3>
          <p className="text-xs text-[#B8C7E0] mb-6 text-right">
            كل صلاة تقربك خطوة من رب المجد وتنير قلبك بأوسمة رائعة تدل على أمانتك:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {badges.map((badge) => (
              <div 
                key={badge.id}
                className={`p-5 rounded-2xl border flex items-start gap-4 transition-all duration-300 relative overflow-hidden ${
                  badge.unlocked 
                    ? 'bg-gradient-to-br from-[#0E3D75] to-[#F39C3D]/10 border-[#F39C3D]/30 shadow-md shadow-[#F39C3D]/5' 
                    : 'bg-[#071426]/30 border-white/5 opacity-50'
                }`}
              >
                {/* Unlocked background glow */}
                {badge.unlocked && (
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-[#F39C3D]/10 rounded-full blur-xl" />
                )}
                
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 font-sans text-2xl ${
                  badge.unlocked 
                    ? 'bg-[#F39C3D]/20 border border-[#F39C3D]/40 text-[#F39C3D]' 
                    : 'bg-[#071426] border border-white/5 text-slate-500'
                }`}>
                  {badge.unlocked ? '✨' : '🔒'}
                </div>

                <div className="text-right">
                  <h4 className={`text-base font-black ${badge.unlocked ? 'text-white' : 'text-slate-400'}`}>
                    {badge.title}
                  </h4>
                  <p className="text-xs text-[#B8C7E0]/70 mt-1 leading-relaxed">
                    {badge.unlocked ? badge.desc : badge.requirement}
                  </p>
                  {badge.unlocked ? (
                    <span className="inline-block mt-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      مفتوح بنجاح 🎉
                    </span>
                  ) : (
                    <span className="inline-block mt-2 text-[10px] font-bold text-slate-400 bg-[#071426] px-2 py-0.5 rounded-full">
                      مغلق حالياً
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Favorite Verses List */}
      {!isLeader && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl glass-card p-6 sm:p-8"
        >
          <div className="flex justify-between items-center mb-6">
            <span className="text-[#F39C3D] font-bold text-xs bg-[#F39C3D]/10 border border-[#F39C3D]/20 py-1 px-3 rounded-full">
              {favorites.length} آية محفوظة
            </span>
            <h3 className="text-xl font-black text-white">آياتي المفضلة ❤️📖</h3>
          </div>

          {loadingFavs ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="w-8 h-8 border-4 border-[#F39C3D] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-[#B8C7E0]">جاري تحميل آياتك المفضلة...</p>
            </div>
          ) : favorites.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence>
                {favorites.map((fav) => (
                  <motion.div 
                    key={fav.id}
                    initial={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, scale: 0.9, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="p-5 rounded-2xl bg-[#071426]/60 border border-white/5 relative overflow-hidden group hover:border-[#F39C3D]/20 duration-300"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => removeFavorite(fav.id)}
                          className="p-2 rounded-xl bg-[#071426] border border-white/5 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 duration-300 cursor-pointer"
                          title="حذف من المفضلة"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => copyToClipboard(fav.text, fav.reference)}
                          className="p-2 rounded-xl bg-[#071426] border border-white/5 text-[#B8C7E0] hover:text-white hover:bg-[#0E3D75]/40 duration-300 cursor-pointer"
                          title="نسخ الآية"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mood tag indicator */}
                      <div className="py-0.5 px-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-bold">
                        شديد الحفظ ✨
                      </div>
                    </div>

                    <blockquote className="text-right text-base font-bold leading-relaxed text-slate-100 pr-3 border-r-2 border-[#F39C3D] font-sans">
                      &ldquo;{fav.text}&rdquo;
                    </blockquote>

                    <div className="text-left text-xs text-[#F39C3D] font-bold ltr mt-3">
                      - {fav.reference}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-12 border border-dashed border-white/10 rounded-2xl text-center text-[#B8C7E0]/50 text-sm">
              📖 لا يوجد آيات محفوظة في المفضلة بعد. اضغط على أيقونة القلب ❤️ بجانب أي آية تقرأها لحفظها هنا والرجوع إليها دائماً!
            </div>
          )}
        </motion.div>
      )}

      {/* Custom Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border backdrop-blur-md text-right font-sans"
            style={{
              backgroundColor: toast.type === 'success' ? 'rgba(11, 37, 69, 0.95)' : toast.type === 'error' ? 'rgba(45, 15, 21, 0.95)' : 'rgba(7, 20, 38, 0.95)',
              borderColor: toast.type === 'success' ? '#F39C3D' : toast.type === 'error' ? '#f43f5e' : '#3b82f6',
            }}
          >
            <span className="text-sm font-black text-white">
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#0B2545] border border-white/10 rounded-3xl p-6 shadow-2xl text-right"
            >
              <h4 className="text-lg font-black text-white mb-2">تأكيد الحذف 🗑️😢</h4>
              <p className="text-sm text-[#B8C7E0] mb-6 leading-relaxed">
                هل أنت متأكد أنك تريد إزالة هذه الآية الكريمة من قائمتك المفضلة؟ يمكنك دائماً حفظها مرة أخرى لاحقاً.
              </p>
              <div className="flex flex-row-reverse gap-3">
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold duration-200 cursor-pointer"
                >
                  نعم، احذفها 🗑️
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#071426] border border-white/5 hover:border-white/10 text-[#B8C7E0] text-sm font-bold duration-200 cursor-pointer"
                >
                  إلغاء ❌
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
