import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, CheckCircle2, Copy, Share2, Heart, 
  Bell, Check, Flame, ChevronLeft, HeartCrack 
} from 'lucide-react';
import { getLocalDateString, getDaysOfWeek, formatArabicDate } from '../utils/dateUtils';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import versesData from '../data/verses.json';
import { Verse, MoodConfig } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

const getSafeFavoriteId = (uid: string, text: string) => {
  const encoded = btoa(unescape(encodeURIComponent(text)));
  const sanitized = encoded.replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
  return `${uid}_${sanitized.slice(0, 40)}`;
};

export const Home: React.FC = () => {
  const { user, loading, recordPrayerToday } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>({});
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [recording, setRecording] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (location.state?.message) {
      showToast(location.state.message, 'success');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);
  const [quote, setQuote] = useState<string>('');

  // Mood & Verse of the Day State
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [activeVerse, setActiveVerse] = useState<Verse | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Daily Alarm/Reminder Settings
  const [reminderHour, setReminderHour] = useState('20');
  const [reminderMinute, setReminderMinute] = useState('00');
  const [alarmSaved, setAlarmSaved] = useState(false);

  const todayStr = getLocalDateString();
  const weekDays = getDaysOfWeek();

  // Moods configurations
  const moods: MoodConfig[] = [
    { id: 'joy', label: 'فرح', emoji: '😊', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    { id: 'sad', label: 'حزن', emoji: '😢', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' },
    { id: 'anger', label: 'غضب', emoji: '😡', color: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
    { id: 'fear', label: 'قلق', emoji: '😰', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    { id: 'tired', label: 'تعب', emoji: '😴', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400' },
    { id: 'thankful', label: 'شكر', emoji: '😍', color: 'bg-pink-500/10 border-pink-500/30 text-pink-400' },
  ];

  const encourages = [
    "أنت رائع وبطل صلاة مميز اليوم! ✨",
    "يسوع يحبك جداً ويفرح عندما تصلي له 🌸",
    "صلاة واحدة تصنع فرقاً كبيراً في يومك 🌟",
    "واظب على صلاتك وستكون دائماً بطلاً حقيقياً 👑",
    "الصلاة هي التحدث مع يسوع كأفضل صديق لك ❤️"
  ];

  useEffect(() => {
    // Select a random encouraging quote
    const randIdx = Math.floor(Math.random() * encourages.length);
    setQuote(encourages[randIdx]);
    
    // Select a random default verse on mount
    const loadInitialVerse = () => {
      try {
        const keys = Object.keys(versesData);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const versesList = (versesData as Record<string, Verse[]>)[randomKey] || [];
        if (versesList.length > 0) {
          const randomIdx = Math.floor(Math.random() * versesList.length);
          const verse = versesList[randomIdx];
          setActiveVerse(verse);
        }
      } catch (err) {
        console.error("Error choosing initial verse:", err);
      }
    };

    loadInitialVerse();

    // Fetch user's week prayers
    if (user) {
      fetchWeekPrayers();
      fetchReminderSetting();
    }
  }, [user]);

  // Synchronize Favorite state safely when user, activeVerse or auth loading state changes
  useEffect(() => {
    let active = true;
    const checkFavoriteStatus = async () => {
      if (loading || !user || !activeVerse) {
        setIsFavorited(false);
        return;
      }
      try {
        const favoriteId = getSafeFavoriteId(user.uid, activeVerse.text);
        const docRef = doc(db, 'favoriteVerses', favoriteId);
        const snap = await getDoc(docRef);
        if (active) {
          setIsFavorited(snap.exists());
        }
      } catch (err: any) {
        console.warn("Gracefully handled checking favorite status:", err.message || err);
        if (active) {
          setIsFavorited(false);
        }
      }
    };

    checkFavoriteStatus();
    return () => {
      active = false;
    };
  }, [user, activeVerse, loading]);

  const fetchWeekPrayers = async () => {
    if (!user) return;
    setLoadingWeek(true);
    try {
      const q = query(
        collection(db, 'userPrayers'),
        where('uid', '==', user.uid),
        where('date', '>=', weekDays[0].dateStr),
        where('date', '<=', weekDays[6].dateStr)
      );
      const querySnapshot = await getDocs(q);
      const completed: Record<string, boolean> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date) {
          completed[data.date] = true;
        }
      });
      setCompletedDays(completed);
    } catch (e) {
      console.error("Error fetching week prayers:", e);
    } finally {
      setLoadingWeek(false);
    }
  };

  const fetchReminderSetting = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'settings', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const time = snap.data().reminderTime || '20:00';
        const [h, m] = time.split(':');
        setReminderHour(h || '20');
        setReminderMinute(m || '00');
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const adjustHour = (amount: number) => {
    let current = parseInt(reminderHour) || 0;
    let updated = (current + amount + 24) % 24;
    setReminderHour(String(updated).padStart(2, '0'));
  };

  const adjustMinute = (amount: number) => {
    let current = parseInt(reminderMinute) || 0;
    let updated = (current + amount + 60) % 60;
    setReminderMinute(String(updated).padStart(2, '0'));
  };

  const setPresetTime = async (hour: string, minute: string) => {
    setReminderHour(hour);
    setReminderMinute(minute);
    
    if (!user) return;
    try {
      const docRef = doc(db, 'settings', user.uid);
      const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      await setDoc(docRef, {
        uid: user.uid,
        reminderTime: timeStr,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setAlarmSaved(true);
      setTimeout(() => setAlarmSaved(false), 3000);
    } catch (err) {
      console.error("Error saving preset alarm:", err);
    }
  };

  const saveAlarmSettings = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'settings', user.uid);
      const timeStr = `${reminderHour.padStart(2, '0')}:${reminderMinute.padStart(2, '0')}`;
      await setDoc(docRef, {
        uid: user.uid,
        reminderTime: timeStr,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setAlarmSaved(true);
      setTimeout(() => setAlarmSaved(false), 3000);
    } catch (err) {
      console.error("Error saving alarm settings:", err);
    }
  };

  const handlePrayClick = async () => {
    if (!user || recording) return;
    setRecording(true);
    try {
      const res = await recordPrayerToday();
      if (res.success) {
        setShowAnimation(true);
        // Play sound effects or triggers if any
        setCompletedDays(prev => ({ ...prev, [todayStr]: true }));
        
        // Hide overlay after 6 seconds
        setTimeout(() => {
          setShowAnimation(false);
        }, 5500);
      } else if (res.alreadyPrayed) {
        alert("لقد قمت بتسجيل صلاتك اليوم بالفعل! أحسنت وبوركت يا بطل ❤️");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecording(false);
    }
  };

  // Mood picker logic
  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId);
    setVerseLoading(true);
    
    // Get verses list for this mood
    const versesList = (versesData as Record<string, Verse[]>)[moodId] || [];
    if (versesList.length > 0) {
      const randomIdx = Math.floor(Math.random() * versesList.length);
      const verse = versesList[randomIdx];
      setActiveVerse(verse);
    }
    setVerseLoading(false);
  };

  // Favorite/Unfavorite Verse
  const toggleFavorite = async () => {
    if (!user || !activeVerse) return;
    // Generate a unique safe Firestore ID using base64 text snippet
    const favoriteId = getSafeFavoriteId(user.uid, activeVerse.text);
    const docRef = doc(db, 'favoriteVerses', favoriteId);

    try {
      if (isFavorited) {
        await deleteDoc(docRef);
        setIsFavorited(false);
      } else {
        await setDoc(docRef, {
          id: favoriteId,
          uid: user.uid,
          text: activeVerse.text,
          reference: activeVerse.reference,
          mood: selectedMood || 'general',
          savedAt: new Date().toISOString()
        });
        setIsFavorited(true);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  // Helper formatting for reminder
  const formatArabicTime = (h: string, m: string) => {
    const hr = parseInt(h);
    const suffix = hr >= 12 ? 'مساءً' : 'صباحاً';
    let displayHr = hr % 12;
    if (displayHr === 0) displayHr = 12;
    return `${displayHr}:${m} ${suffix}`;
  };

  const copyVerse = () => {
    if (!activeVerse) return;
    const shareText = `"${activeVerse.text}" - ${activeVerse.reference}\n\nتطبيق دفتر صلاتي 📖✨`;
    navigator.clipboard.writeText(shareText);
    alert("تم نسخ الآية الجميلة إلى حافظتك! 📋❤️");
  };

  const shareVerse = () => {
    if (!activeVerse) return;
    const shareText = `"${activeVerse.text}" - ${activeVerse.reference}`;
    if (navigator.share) {
      navigator.share({
        title: 'آية جميلة من دفتر صلاتي',
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    } else {
      copyVerse();
    }
  };

  const getDaySymbol = (name: string) => {
    if (name === 'الأحد') return 'ح';
    if (name === 'الاثنين') return 'ن';
    if (name === 'الثلاثاء') return 'ث';
    if (name === 'الأربعاء') return 'ر';
    if (name === 'الخميس') return 'خ';
    if (name === 'الجمعة') return 'ج';
    if (name === 'السبت') return 'س';
    return name.substring(0, 1);
  };

  const alreadyPrayedToday = completedDays[todayStr] || user?.lastPrayerDate === todayStr;

  if (user?.role === 'servant') {
    const isApproved = user.status === 'approved' || user.status === 'active';
    const isRejected = user.status === 'rejected';
    const isPending = !user.status || user.status === 'pending';

    return (
      <div className="max-w-2xl mx-auto px-4 py-16 relative z-10 text-center" dir="rtl">
        {isPending && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl glass-card p-8 flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 text-amber-400 glow-orange border border-amber-500/25 animate-pulse text-3xl">
              ⏳
            </div>
            <h2 className="text-2xl font-black text-white mb-3 font-sans">حسابك قيد المراجعة ⏳</h2>
            <p className="text-sm text-[#B8C7E0] leading-relaxed mb-6 max-w-sm">
              مرحباً بك يا خادم الرب! حسابك كخادم مسجل حالياً وهو قيد المراجعة والقبول من قبل الأستاذ إسكندر (eskander.ragy@gmail.com).
            </p>
            <p className="text-xs text-[#B8C7E0]/70 leading-relaxed max-w-sm border-t border-white/5 pt-4">
              بمجرد تفعيل حسابك، ستتمكن من الاطلاع على قوائم الأطفال بالكامل، ومعرفة سلاسل صلواتهم، وإحصائيات التزامهم بالصلاة.
            </p>
          </motion.div>
        )}

        {isRejected && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl glass-card p-8 flex flex-col items-center border border-rose-500/30"
          >
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 text-rose-400 border border-rose-500/25 text-3xl">
              ❌
            </div>
            <h2 className="text-2xl font-black text-white mb-3 font-sans">تم رفض طلب الانضمام 🛡️</h2>
            <p className="text-sm text-[#B8C7E0] leading-relaxed mb-6 max-w-sm">
              نعتذر منك، لم يتم قبول حسابك كخادم في الوقت الحالي. يرجى مراجعة الأستاذ إسكندر راجي لتأكيد هويتك وتفعيل الحساب.
            </p>
          </motion.div>
        )}

        {isApproved && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl glass-card p-8 flex flex-col items-center border border-emerald-500/20"
          >
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 text-emerald-400 glow-orange border border-emerald-500/25 text-3xl">
              ✨
            </div>
            <h2 className="text-2xl font-black text-white mb-2 font-sans">أهلاً بك يا خادم الرب! 🛡️💼</h2>
            <p className="text-[#F39C3D] font-bold text-sm mb-4">تم تفعيل وقبول حسابك بنجاح</p>
            <p className="text-sm text-[#B8C7E0] leading-relaxed mb-8 max-w-sm">
              يسعدنا تواجدك معنا لمتابعة تقدم أطفال الكنيسة الأبطال وتشجيعهم على الصلاة اليومية. يمكنك الآن التوجه مباشرة للوحة الإشراف.
            </p>

            <motion.a
              href="#/admin"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 bg-gradient-to-r from-[#F39C3D] to-amber-500 hover:from-amber-500 hover:to-orange-500 text-[#071426] font-black rounded-2xl shadow-lg hover:shadow-orange-500/20 duration-300 flex items-center justify-center gap-2 glow-orange cursor-pointer text-center font-bold"
            >
              <span>الانتقال للوحة الإشراف والمتابعة 📊</span>
            </motion.a>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 pb-24 relative z-10" dir="rtl">
      
      {/* Header Greeting based on Elegant Dark mockup */}
      <header className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 bg-transparent">
        <div className="flex items-center gap-4 text-right">
          <div className="w-14 h-14 bg-[#F39C3D] rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-[0_0_15px_rgba(243,156,61,0.4)]">†</div>
          <div>
            <h1 className="text-2xl font-black tracking-wide leading-none text-white">دفتر صلاتي</h1>
            <p className="text-[#B8C7E0] text-sm mt-1">تابع صلاتك اليومية واقترب من الله</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/5 rounded-full pl-6 pr-2 py-2 border border-white/10 shadow-lg">
          <div className="text-right">
            <p className="text-[10px] text-[#B8C7E0] leading-none uppercase tracking-widest mb-1">أهلاً بك يا بطل الصلاة،</p>
            <p className="text-lg font-bold leading-none text-white">{user?.name || 'زائر كريم'}</p>
          </div>
          <div className="w-12 h-12 bg-blue-500 rounded-full border-2 border-[#F39C3D] overflow-hidden shadow-inner">
            <img 
              src={user?.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user?.uid}`} 
              alt="avatar" 
              className="w-full h-full object-cover" 
            />
          </div>
        </div>
      </header>

      {/* Motivational Quote banner */}
      {quote && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-[#0E3D75]/40 to-amber-500/10 border border-[#F39C3D]/20 text-center font-medium text-amber-100 flex items-center justify-center gap-2.5 shadow-sm"
        >
          <Sparkles className="w-5 h-5 text-[#F39C3D] flex-shrink-0 animate-pulse" />
          <span>{quote}</span>
        </motion.div>
      )}

      {/* Main Grid: col-span-8 for main cards, col-span-4 for sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Column */}
        <div className="md:col-span-8 flex flex-col gap-6">
          
          {/* Streak Details Card */}
          <div className="glass-card p-8 flex flex-col sm:flex-row items-center justify-between overflow-hidden relative min-h-[220px]">
            <div className="relative z-10 text-right">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#F39C3D] rounded-full"></span>سلسلة صلواتك الحالية
              </h3>
              <div className="flex items-end gap-4">
                <span className="streak-text">{user?.currentStreak || 0}</span>
                <div>
                  <p className="text-2xl font-bold text-[#F39C3D]">يوم متتالي</p>
                  <p className="text-[#B8C7E0] text-sm font-medium">أداء رائع، استمر في الصلاة!</p>
                </div>
              </div>

              {/* Weekdays track */}
              <div className="mt-10 flex flex-wrap gap-3">
                {weekDays.map((day) => {
                  const isCompleted = completedDays[day.dateStr];
                  return (
                    <div key={day.dateStr} className="flex flex-col items-center gap-2">
                      <div className={`day-circle ${isCompleted ? 'day-active' : 'day-inactive'}`}>
                        {getDaySymbol(day.name)}
                      </div>
                      <span className="text-[10px] font-bold text-[#B8C7E0]">
                        {day.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[160px] opacity-20 absolute left-[-20px] bottom-[-20px] select-none pointer-events-none">🔥</div>
          </div>

          {/* Prayer Confirm/Button Card */}
          <div className="glass-card p-8 flex-1 flex flex-col justify-center items-center text-center gap-6 border-2 border-[#F39C3D]/30 min-h-[300px] relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-400/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />

            <h2 className="text-3xl font-black text-white">صليت النهاردة؟</h2>
            
            <AnimatePresence mode="wait">
              {alreadyPrayedToday ? (
                <motion.div 
                  key="done"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center justify-center text-center p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl w-full max-w-sm glow-blue"
                >
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-9 h-9 text-emerald-400" />
                  </div>
                  <h4 className="text-xl font-bold text-emerald-400 mb-1">حلو جداً! صليت النهاردة</h4>
                  <p className="text-xs text-[#B8C7E0]/80">لقد سجلت صلاتك اليومية بنجاح يا بطل 🛡️❤️</p>
                </motion.div>
              ) : (
                <motion.button
                  key="pray-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePrayClick}
                  disabled={recording}
                  className="px-12 py-5 bg-[#F39C3D] rounded-full text-[#071426] text-2xl font-black shadow-[0_10px_40px_rgba(243,156,61,0.4)] cursor-pointer hover:scale-105 active:scale-95 transition-all border border-orange-400/30 flex items-center gap-2.5 glow-orange animate-pulse"
                >
                  {recording ? (
                    <span className="w-8 h-8 border-4 border-[#071426] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>نعم، صليت ❤️</>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
            
            <p className="text-xl italic text-[#B8C7E0] max-w-md">"صلوا كل حين ولا تملوا" (لو 18: 1)</p>
          </div>

        </div>

        {/* Sidebar Column */}
        <div className="md:col-span-4 flex flex-col gap-6">
          
          {/* Mood Selector card */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-md font-bold text-[#B8C7E0] border-b border-white/10 pb-2 text-right">عامل ايه النهاردة؟</h3>
            <div className="grid grid-cols-3 gap-2">
              {moods.map((mood) => {
                const isSelected = selectedMood === mood.id;
                return (
                  <button 
                    key={mood.id}
                    onClick={() => handleMoodSelect(mood.id)}
                    className={`p-3 rounded-2xl transition-colors duration-300 flex flex-col items-center gap-1 cursor-pointer ${
                      isSelected 
                        ? 'bg-white/10 border border-[#F39C3D]/50 text-white font-bold' 
                        : 'bg-white/5 hover:bg-white/10 text-[#B8C7E0]'
                    }`}
                  >
                    <span className="text-xl">{mood.emoji}</span>
                    <span className="text-[10px] font-bold">{mood.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verse of Today card */}
          <div className="glass-card p-6 flex-1 flex flex-col gap-4 relative overflow-hidden text-right">
            <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl"></div>
            <h3 className="text-md font-bold text-[#F39C3D] flex items-center justify-end gap-2">
              📖 آية اليوم
            </h3>
            
            <div className="flex-1 flex flex-col justify-center items-center py-4">
              <p className="text-lg leading-relaxed text-center font-semibold italic text-white">
                &ldquo;{activeVerse ? activeVerse.text : "وَلكِنْ شُكْرًا ِللهِ الَّذِي يُعْطِينَا الْغَلَبَةَ بِرَبِّنَا يَسُوعَ الْمَسِيحِ"}&rdquo;
              </p>
              <p className="text-xs text-[#B8C7E0] mt-4 w-full text-left uppercase">
                {activeVerse ? activeVerse.reference : "(١ كورنثوس ١٥: ٥٧)"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button 
                onClick={shareVerse}
                disabled={!activeVerse}
                className="flex-1 py-2 bg-white/5 rounded-lg text-[10px] font-bold hover:bg-white/10 transition text-white hover:text-[#F39C3D] disabled:opacity-50 disabled:pointer-events-none"
              >
                مشاركة
              </button>
              <button 
                onClick={copyVerse}
                disabled={!activeVerse}
                className="flex-1 py-2 bg-white/5 rounded-lg text-[10px] font-bold hover:bg-white/10 transition text-white hover:text-[#F39C3D] disabled:opacity-50 disabled:pointer-events-none"
              >
                نسخ
              </button>
              <button 
                onClick={toggleFavorite}
                disabled={!activeVerse}
                className={`w-10 py-2 rounded-lg flex items-center justify-center transition ${
                  isFavorited ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-white hover:bg-white/10'
                } disabled:opacity-50 disabled:pointer-events-none`}
                title={isFavorited ? "حذف من المفضلة" : "إضافة للمفضلة"}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-400 text-rose-400' : 'text-slate-300'}`} />
              </button>
            </div>
          </div>

          {/* Alarm Reminder card */}
          <div className="glass-card p-6 flex flex-col gap-4 text-right">
            <h3 className="text-sm font-black text-[#B8C7E0] border-b border-white/5 pb-2 flex justify-between items-center">
              <span>⏰ منبّه صلاتي اليومي</span>
              <span className="text-[#F39C3D] text-[11px] font-bold">
                {formatArabicTime(reminderHour, reminderMinute)}
              </span>
            </h3>

            {/* Big readable display with +/- controllers */}
            <div className="flex items-center justify-center gap-6 py-2 bg-[#071426]/60 rounded-2xl border border-white/5">
              
              {/* Hour control */}
              <div className="flex flex-col items-center gap-1">
                <button 
                  onClick={() => adjustHour(1)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F39C3D]/20 text-white hover:text-[#F39C3D] flex items-center justify-center font-bold text-lg duration-200"
                >
                  +
                </button>
                <span className="text-2xl font-black text-white font-mono">{reminderHour}</span>
                <button 
                  onClick={() => adjustHour(-1)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F39C3D]/20 text-white hover:text-[#F39C3D] flex items-center justify-center font-bold text-lg duration-200"
                >
                  -
                </button>
                <span className="text-[9px] text-[#B8C7E0]/50">الساعة</span>
              </div>

              <span className="text-2xl font-black text-white/50 mb-4 animate-pulse">:</span>

              {/* Minute control */}
              <div className="flex flex-col items-center gap-1">
                <button 
                  onClick={() => adjustMinute(5)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F39C3D]/20 text-white hover:text-[#F39C3D] flex items-center justify-center font-bold text-sm duration-200"
                >
                  +5
                </button>
                <span className="text-2xl font-black text-white font-mono">{reminderMinute}</span>
                <button 
                  onClick={() => adjustMinute(-5)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F39C3D]/20 text-white hover:text-[#F39C3D] flex items-center justify-center font-bold text-sm duration-200"
                >
                  -5
                </button>
                <span className="text-[9px] text-[#B8C7E0]/50">الدقيقة</span>
              </div>

            </div>

            {/* Preset shortcuts */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-[#B8C7E0]/60 text-right">أوقات مقترحة سريعة:</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPresetTime('08', '00')}
                  className="py-1.5 px-2 bg-white/5 hover:bg-amber-500/10 hover:border-amber-500/25 border border-white/5 rounded-xl text-[10px] font-bold text-[#B8C7E0] hover:text-white duration-200"
                >
                  🌅 8:00 صباحاً
                </button>
                <button 
                  onClick={() => setPresetTime('15', '00')}
                  className="py-1.5 px-2 bg-white/5 hover:bg-orange-500/10 hover:border-orange-500/25 border border-white/5 rounded-xl text-[10px] font-bold text-[#B8C7E0] hover:text-white duration-200"
                >
                  🏫 3:00 مساءً
                </button>
                <button 
                  onClick={() => setPresetTime('20', '00')}
                  className="py-1.5 px-2 bg-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/25 border border-white/5 rounded-xl text-[10px] font-bold text-[#B8C7E0] hover:text-white duration-200"
                >
                  ⭐ 8:00 مساءً
                </button>
                <button 
                  onClick={() => setPresetTime('21', '30')}
                  className="py-1.5 px-2 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/25 border border-white/5 rounded-xl text-[10px] font-bold text-[#B8C7E0] hover:text-white duration-200"
                >
                  🌙 9:30 مساءً
                </button>
              </div>
            </div>

            {/* Manual Save Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={saveAlarmSettings}
              className="w-full py-2.5 bg-gradient-to-r from-[#0E3D75] to-[#1255A1] hover:from-[#1255A1] hover:to-[#176BCB] text-white rounded-xl font-bold text-xs border border-white/10 flex items-center justify-center gap-1 cursor-pointer duration-300 shadow-sm"
            >
              {alarmSaved ? (
                <span className="text-emerald-300 flex items-center gap-1">✔️ تم حفظ المنبه بنجاح!</span>
              ) : (
                <span>تأكيد وحفظ المنبه المخصص 💾</span>
              )}
            </motion.button>
          </div>

        </div>

      </div>

      {/* Complete Animation Modal Overlay */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#071426]/95 flex flex-col justify-center items-center z-50 p-6 backdrop-blur-lg"
          >
            {/* Fire particles emitter */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.4, 1.2], rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.8, type: 'spring' }}
                className="text-8xl select-none filter drop-shadow-[0_0_30px_rgba(243,156,61,0.6)]"
              >
                🔥
              </motion.div>
              
              {/* Floating +1 indicators */}
              <motion.div 
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -120, scale: 1.8 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute text-5xl font-extrabold text-[#F39C3D] glow-orange select-none"
              >
                +1 🔥
              </motion.div>

              {/* Exploding star sparkles */}
              {[...Array(12)].map((_, i) => {
                const angle = (i * 30 * Math.PI) / 180;
                const distance = 100;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                return (
                  <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.2 }}
                    animate={{ x, y, opacity: 0, scale: 1.5 }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="absolute text-2xl"
                  >
                    ⭐
                  </motion.div>
                );
              })}
            </div>

            {/* Praise message */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center max-w-lg mt-8"
            >
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F39C3D] to-amber-400 mb-4 font-sans">
                أنت بطل رائع اليوم! 🎉
              </h2>
              <blockquote className="text-2xl font-bold text-white mb-6 leading-relaxed bg-[#0E3D75]/40 p-6 rounded-3xl border border-white/5 font-sans">
                &ldquo;❤️ صَلُّوا كُلَّ حِينٍ وَلاَ تَمَلُّوا&rdquo;
                <div className="text-sm text-[#F39C3D] font-black mt-2 ltr">- لوقا 18: 1</div>
              </blockquote>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAnimation(false)}
                className="px-8 py-3 bg-gradient-to-r from-[#F39C3D] to-amber-500 text-[#071426] font-black rounded-2xl shadow-lg hover:shadow-orange-500/20 text-md cursor-pointer glow-orange"
              >
                حسناً، سأواصل البهجة! 🌟
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

    </div>
  );
};
