import React, { useState, useEffect } from 'react';
import { useAuth, generateRandomCode } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  writeBatch,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { AppUser } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Shield, Users, Flame, CheckCircle2, XCircle, 
  Sparkles, Award, UserPlus, Filter, RefreshCw,
  Edit2, Trash2, Check, X, ShieldAlert, Key, Download, Plus, 
  Trash, LogOut, Copy, Printer
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LoginCodeDoc {
  code: string;
  role: 'user' | 'servant' | 'admin';
  isUsed: boolean;
  usedBy?: string;
  usedAt?: any;
  createdAt: any;
}

export const LeaderDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Authorization States
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Tab State: 'dashboard' | 'codes' | 'users' | 'servants'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'codes' | 'users'>('dashboard');
  const [selectedGrade, setSelectedGrade] = useState<'تالتة' | 'رابعة' | 'خامسة' | 'سادسة' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data States
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allCodes, setAllCodes] = useState<LoginCodeDoc[]>([]);
  const [todayPrayers, setTodayPrayers] = useState<Record<string, boolean>>({});
  const [monthlyPrayers, setMonthlyPrayers] = useState<Record<string, number>>({});
  
  // Code generation form state
  const [generateRole, setGenerateRole] = useState<'user' | 'servant' | 'admin'>('user');
  const [generateCount, setGenerateCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Edit States for kids (Admin only)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editStreak, setEditStreak] = useState(0);
  const [editLongestStreak, setEditLongestStreak] = useState(0);
  const [editTotalPrayers, setEditTotalPrayers] = useState(0);
  const [editGrade, setEditGrade] = useState<'تالتة' | 'رابعة' | 'خامسة' | 'سادسة' | undefined>(undefined);
  const [editRole, setEditRole] = useState<'user' | 'servant' | 'admin' | 'superadmin'>('user');

  // Detail Modal State
  const [selectedKid, setSelectedKid] = useState<AppUser | null>(null);

  const todayStr = getLocalDateString();

  // Role Checks
  useEffect(() => {
    if (user) {
      const isOwner = user.role === 'superadmin' || user.email === 'eskander.ragy@gmail.com';
      const superAdmin = user.role === 'admin' || isOwner;
      const servant = user.role === 'servant' && (user.status === 'approved' || user.status === 'active');
      
      setIsSuperAdmin(superAdmin);
      setHasAccess(superAdmin || servant);
    }
  }, [user]);

  // Load Dashboard Data
  useEffect(() => {
    if (hasAccess) {
      fetchDashboardData();
    }
  }, [hasAccess, activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList: AppUser[] = [];
      usersSnap.forEach((doc) => {
        usersList.push(doc.data() as AppUser);
      });
      setAllUsers(usersList);

      // 2. Fetch login codes if SuperAdmin
      if (isSuperAdmin) {
        const codesSnap = await getDocs(collection(db, 'loginCodes'));
        const codesList: LoginCodeDoc[] = [];
        codesSnap.forEach((doc) => {
          codesList.push(doc.data() as LoginCodeDoc);
        });
        setAllCodes(codesList.sort((a, b) => b.code.localeCompare(a.code)));
      }

      // 3. Fetch today's prayer logs
      const prayersTodayQ = query(
        collection(db, 'userPrayers'),
        where('date', '==', todayStr)
      );
      const prayersSnap = await getDocs(prayersTodayQ);
      const todayPrays: Record<string, boolean> = {};
      prayersSnap.forEach((doc) => {
        const data = doc.data();
        if (data && data.uid) {
          todayPrays[data.uid] = true;
        }
      });
      setTodayPrayers(todayPrays);

      // 4. Fetch current month's prayer logs
      const currentMonthPrefix = todayStr.substring(0, 7); // e.g. "2026-07"
      const monthlyPrayersSnap = await getDocs(collection(db, 'userPrayers'));
      const monthlyCountMap: Record<string, number> = {};
      monthlyPrayersSnap.forEach((doc) => {
        const data = doc.data();
        if (data && data.date && data.uid && data.date.startsWith(currentMonthPrefix)) {
          monthlyCountMap[data.uid] = (monthlyCountMap[data.uid] || 0) + 1;
        }
      });
      setMonthlyPrayers(monthlyCountMap);

    } catch (err) {
      console.error("Error loading dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Generate Bulk Codes
  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setIsGenerating(true);
    
    try {
      const batch = writeBatch(db);
      const generatedList: string[] = [];
      const prefix = generateRole === 'user' ? 'MKD' : (generateRole === 'servant' ? 'KHD' : 'ADM');

      for (let i = 0; i < generateCount; i++) {
        const newCode = generateRandomCode(prefix);
        const codeRef = doc(db, 'loginCodes', newCode);
        
        const codeData: LoginCodeDoc = {
          code: newCode,
          role: generateRole,
          isUsed: false,
          createdAt: serverTimestamp()
        };
        
        batch.set(codeRef, codeData);
        generatedList.push(newCode);
      }

      await batch.commit();
      alert(`تم توليد ${generateCount} أكواد جديدة بنجاح! 🎉`);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert("فشل توليد الأكواد");
    } finally {
      setIsGenerating(false);
    }
  };

  // Deactivate Code / Reset User Session (Saves history but disconnects session)
  const handleDeactivateSession = async (kid: AppUser) => {
    if (!confirm(`هل أنت متأكد من إلغاء جلسة المخدوم (${kid.name})؟ سيتم تسجيل خروجه فوراً من أي جهاز مسجل، ويمكنه إعادة الدخول بنفس الكود لاحقاً.`)) return;
    try {
      // 1. Update user profile uid to empty to detach anonymous session
      const userRef = doc(db, 'users', kid.uid);
      await updateDoc(userRef, { uid: `detached_${Date.now()}` });
      
      // 2. Also reset code usage status to false so they can re-link on new device
      if (kid.code) {
        const codeRef = doc(db, 'loginCodes', kid.code);
        await updateDoc(codeRef, {
          isUsed: false,
          usedBy: ""
        });
      }

      alert("تم إنهاء الجلسة بنجاح، وسيطالب التطبيق المخدوم بإدخال كود الدخول عند الفتح القادم.");
      await fetchDashboardData();
    } catch (e) {
      console.error(e);
      alert("فشل إلغاء الجلسة.");
    }
  };

  // Delete User Document (and release code back to unused status)
  const handleDeleteUser = async (uid: string, name: string, code?: string) => {
    if (!confirm(`تحذير هام! هل أنت متأكد من حذف حساب الطفل البطل (${name}) نهائياً؟ سيتم مسح بيانات تقدمه وسلسلة أيامه بالكامل.`)) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      
      if (code) {
        const codeRef = doc(db, 'loginCodes', code);
        await updateDoc(codeRef, {
          isUsed: false,
          usedBy: ""
        });
      }

      setAllUsers(prev => prev.filter(u => u.uid !== uid));
      alert(`تم حذف حساب ${name} بنجاح وإعادة الكود لحالة غير مستخدم.`);
    } catch (e) {
      console.error(e);
      alert("فشل حذف الحساب");
    }
  };

  // Delete/Deactivate Code Document
  const handleDeleteCode = async (codeStr: string) => {
    if (!confirm(`هل تريد بالتأكيد حذف كود تسجيل الدخول (${codeStr})؟ لن يتمكن أحد من استخدامه بعد الآن.`)) return;
    try {
      await deleteDoc(doc(db, 'loginCodes', codeStr));
      setAllCodes(prev => prev.filter(c => c.code !== codeStr));
      alert("تم حذف الكود بنجاح.");
    } catch (e) {
      console.error(e);
      alert("فشل حذف الكود");
    }
  };

  // Edit User Details
  const startEditing = (kid: AppUser) => {
    setEditingUser(kid);
    setEditName(kid.name);
    setEditStreak(kid.currentStreak || 0);
    setEditLongestStreak(kid.longestStreak || 0);
    setEditTotalPrayers(kid.totalPrayerDays || 0);
    setEditGrade(kid.grade);
    setEditRole(kid.role);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const userRef = doc(db, 'users', editingUser.uid);
      const updates: any = {
        name: editName,
        currentStreak: Number(editStreak),
        longestStreak: Number(editLongestStreak),
        totalPrayerDays: Number(editTotalPrayers),
        role: editRole
      };
      
      if (editGrade) {
        updates.grade = editGrade;
      }

      await updateDoc(userRef, updates);
      
      setAllUsers(prev => prev.map(u => u.uid === editingUser.uid ? {
        ...u,
        ...updates
      } : u));
      setEditingUser(null);
      alert("تم تحديث البيانات بنجاح! ✏️🏆");
    } catch (e) {
      console.error(e);
      alert("فشل تحديث البيانات");
    }
  };

  // CSV Data Export
  const handleExportData = () => {
    if (!isSuperAdmin) {
      alert("عذراً، هذا الإجراء متاح فقط للمديرين 🔒");
      return;
    }
    const kidsOnly = allUsers.filter(u => u.role === 'user');
    const headers = ['الاسم', 'سنة دراسية', 'كود الدخول', 'السلسلة الحالية (أيام)', 'أطول سلسلة', 'إجمالي الأيام المصلى فيها'];
    const rows = kidsOnly.map(k => [
      k.name,
      k.grade || 'غير محدد',
      k.code || 'بلا كود',
      k.currentStreak,
      k.longestStreak,
      k.totalPrayerDays
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_مخدومين_الكنيسة_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper arrays/filters
  const kidsOnly = allUsers.filter(u => u.role === 'user');
  const servantsList = allUsers.filter(u => u.role === 'servant' || u.role === 'admin' || u.role === 'superadmin');

  // Group kids by grade for stats
  const getGradeStats = (gradeName: 'تالتة' | 'رابعة' | 'خامسة' | 'سادسة') => {
    const kidsInGrade = kidsOnly.filter(u => u.grade === gradeName);
    const total = kidsInGrade.length;
    const prayed = kidsInGrade.filter(u => todayPrayers[u.uid] || u.lastPrayerDate === todayStr).length;
    const activeStreaks = kidsInGrade.filter(u => (u.currentStreak || 0) > 0).length;
    const rate = total > 0 ? Math.round((prayed / total) * 100) : 0;
    
    return { total, prayed, activeStreaks, rate };
  };

  const grades = ['تالتة', 'رابعة', 'خامسة', 'سادسة'] as const;

  // Filter and search kids
  const filteredKids = kidsOnly.filter(k => {
    const matchesSearch = k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (k.code && k.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGrade = selectedGrade ? k.grade === selectedGrade : true;
    return matchesSearch && matchesGrade;
  });

  const sortedKids = [...filteredKids].sort((a, b) => b.currentStreak - a.currentStreak);

  // Helper to render the kids list container dynamically (can be inline under a selected grade or at the bottom)
  const renderKidsList = (grade: 'تالتة' | 'رابعة' | 'خامسة' | 'سادسة' | null, isInline = false) => {
    const listKids = kidsOnly.filter(k => {
      const matchesSearch = k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (k.code && k.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesGrade = grade ? k.grade === grade : true;
      return matchesSearch && matchesGrade;
    });

    const sortedListKids = [...listKids].sort((a, b) => b.currentStreak - a.currentStreak);

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={`p-6 rounded-3xl bg-[#0D2442]/30 border border-white/5 text-right ${isInline ? 'col-span-full mt-4' : ''}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="text-right">
            <h3 className="text-xl font-black text-white">
              {grade ? `أبطال فصل سنة ${grade} 🎒` : 'جميع أبطال كنيستنا 🌟'}
            </h3>
            <p className="text-xs text-[#B8C7E0] mt-0.5">
              قائمة الترتيب الروحي بناءً على سلسلة الأيام المتتالية
            </p>
          </div>

          {/* Search and filters */}
          <div className="w-full sm:w-auto flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8C7E0]/40" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-[#071426]/60 border border-white/5 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] text-xs transition"
              />
            </div>
          </div>
        </div>

        {/* Kids Table - Desktop only */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[#B8C7E0]/60">
                <th className="py-3 px-4 font-bold">الاسم والبطل</th>
                <th className="py-3 px-4 font-bold text-center">الفئة</th>
                <th className="py-3 px-4 font-bold text-center">صلاة اليوم</th>
                <th className="py-3 px-4 font-bold text-center">السلسلة الحالية</th>
                <th className="py-3 px-4 font-bold text-center">أطول سلسلة</th>
                <th className="py-3 px-4 font-bold text-center">إجمالي الأيام</th>
                <th className="py-3 px-4 font-bold text-left">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {sortedListKids.length > 0 ? (
                sortedListKids.map((kid) => {
                  const hasPrayed = todayPrayers[kid.uid] || kid.lastPrayerDate === todayStr;
                  return (
                    <tr key={kid.uid} className="border-b border-white/5 hover:bg-white/5 transition duration-150">
                      <td className="py-4 px-4 font-bold text-white flex items-center gap-3">
                        <img src={kid.photoURL} alt="" className="w-8 h-8 rounded-full bg-white/5" referrerPolicy="no-referrer" />
                        <div className="text-right">
                          <p>{kid.name}</p>
                          <p className="text-[10px] text-[#B8C7E0]/40 font-mono mt-0.5">{kid.code}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-orange-400">سنة {kid.grade || 'تالتة'}</td>
                      <td className="py-4 px-4 text-center">
                        {hasPrayed ? (
                          <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>صلى اليوم 🔥</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 font-bold">
                            <XCircle className="w-3 h-3" />
                            <span>لم يسجل 😴</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center font-extrabold text-[#F39C3D] font-mono text-sm">{kid.currentStreak} يوم</td>
                      <td className="py-4 px-4 text-center text-white font-bold font-mono">{kid.longestStreak} يوم</td>
                      <td className="py-4 px-4 text-center text-[#B8C7E0] font-medium font-mono">{kid.totalPrayerDays} صلوات</td>
                      <td className="py-4 px-4 text-left">
                        <button
                          onClick={() => setSelectedKid(kid)}
                          className="py-1 px-3 bg-[#0E3D75]/40 hover:bg-[#0E3D75]/80 text-[#F39C3D] font-bold border border-[#F39C3D]/20 rounded-lg duration-200 cursor-pointer"
                        >
                          عرض التفاصيل 🔎
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#B8C7E0]/40 font-bold text-sm">
                    🔍 لم يتم العثور على أي أبطال صلاة يطابقون خيارات البحث أو التصفية الحالية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Kids Mobile View - Card list */}
        <div className="block md:hidden space-y-3">
          {sortedListKids.length > 0 ? (
            sortedListKids.map((kid) => {
              const hasPrayed = todayPrayers[kid.uid] || kid.lastPrayerDate === todayStr;
              return (
                <div key={kid.uid} className="p-4 rounded-2xl bg-[#0D2442]/50 border border-white/5 flex flex-col gap-3 text-right">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={kid.photoURL} alt="" className="w-10 h-10 rounded-full bg-white/5" referrerPolicy="no-referrer" />
                      <div className="text-right">
                        <h4 className="font-bold text-white text-sm">{kid.name}</h4>
                        <p className="text-[10px] text-[#B8C7E0]/40 font-mono">{kid.code}</p>
                      </div>
                    </div>
                    <span className="py-0.5 px-2.5 bg-orange-500/10 text-[#F39C3D] border border-[#F39C3D]/20 rounded-full text-[10px] font-black">
                      سنة {kid.grade || 'تالتة'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-white/5">
                    <div>
                      <p className="text-[9px] text-[#B8C7E0]/60 font-medium">السلسلة الحالية</p>
                      <p className="text-xs font-black text-[#F39C3D] font-mono">{kid.currentStreak} يوم</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#B8C7E0]/60 font-medium">أطول سلسلة</p>
                      <p className="text-xs font-black text-white font-mono">{kid.longestStreak} يوم</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#B8C7E0]/60 font-medium">إجمالي الأيام</p>
                      <p className="text-xs font-black text-[#B8C7E0] font-mono">{kid.totalPrayerDays} صلاة</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {hasPrayed ? (
                      <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>صلى اليوم 🔥</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 font-bold text-[10px]">
                        <XCircle className="w-3 h-3" />
                        <span>لم يسجل 😴</span>
                      </span>
                    )}
                    
                    <button
                      onClick={() => setSelectedKid(kid)}
                      className="py-1.5 px-3.5 bg-[#0E3D75] hover:bg-[#0E3D75]/80 text-[#F39C3D] font-bold border border-[#F39C3D]/20 rounded-xl duration-200 text-xs cursor-pointer active:scale-95 animate-pulse"
                    >
                      عرض التفاصيل 🔎
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-[#B8C7E0]/40 text-xs font-bold">
              🔍 لم يتم العثور على أي أبطال صلاة يطابقون خيارات البحث.
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (!hasAccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center relative z-10" id="unauthorized_view">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl glass-card p-8 flex flex-col items-center border border-white/10"
        >
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 text-amber-400 glow-orange border border-amber-500/25">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">صفحة المسؤولين فقط 🔒</h2>
          <p className="text-sm text-[#B8C7E0] leading-relaxed max-w-sm mb-6">
            مرحباً بك يا بطل! لوحة القيادة ومتابعة إحصائيات الكنيسة مخصصة للآباء الكهنة والخدام المعتمدين فقط. يرجى التواصل مع الخادم الرئيسي لتفعيل حسابك.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 pb-24 relative z-10 font-sans text-right" dir="rtl" id="leader_dashboard_container">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-[#F39C3D] uppercase tracking-wide justify-start">
            <Shield className="w-4 h-4 text-[#F39C3D]" />
            <span>لوحة تحكم خادم الكنيسة</span>
          </div>
          <h2 className="text-3xl font-black text-white mt-1">دفتر صلاتي • الإدارة والتحليل 📊👑</h2>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchDashboardData}
            className="p-3 bg-[#0E3D75]/40 hover:bg-[#0E3D75]/70 text-white rounded-2xl border border-white/5 cursor-pointer duration-300"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-5 h-5 text-white" />
          </motion.button>

          {isSuperAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportData}
              className="px-5 py-3 bg-[#F39C3D]/10 hover:bg-[#F39C3D]/20 border border-[#F39C3D]/20 text-[#F39C3D] rounded-2xl font-bold text-sm flex items-center gap-2 duration-300 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير تقرير المخدومين (CSV)</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-white/10 mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-4 px-6 font-bold text-sm border-b-2 transition duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dashboard' 
              ? 'border-[#F39C3D] text-white' 
              : 'border-transparent text-[#B8C7E0]/60 hover:text-[#B8C7E0]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>لوحة الإحصائيات والفصول</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('codes')}
            className={`pb-4 px-6 font-bold text-sm border-b-2 transition duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'codes' 
                ? 'border-[#F39C3D] text-white' 
                : 'border-transparent text-[#B8C7E0]/60 hover:text-[#B8C7E0]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>توليد وإدارة الأكواد 🔑</span>
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-6 font-bold text-sm border-b-2 transition duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users' 
                ? 'border-[#F39C3D] text-white' 
                : 'border-transparent text-[#B8C7E0]/60 hover:text-[#B8C7E0]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>إدارة الحسابات والصلاحيات 🛡️</span>
          </button>
        )}
      </div>

      {/* Loading state indicator */}
      {loading ? (
        <div className="py-20 flex flex-col justify-center items-center gap-4 text-[#B8C7E0]">
          <span className="w-12 h-12 border-4 border-[#F39C3D] border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-sm">جاري تحميل بيانات الكنيسة... 📖</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: DASHBOARD STATS & CLASSES */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Grid of classes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {grades.map((gradeName) => {
                  const stats = getGradeStats(gradeName);
                  const isSelected = selectedGrade === gradeName;
                  
                  return (
                    <React.Fragment key={gradeName}>
                      <motion.div
                        whileHover={{ y: -4 }}
                        onClick={() => setSelectedGrade(isSelected ? null : gradeName)}
                        className={`p-6 rounded-3xl cursor-pointer transition-all duration-300 border text-right relative overflow-hidden select-none ${
                          isSelected 
                            ? 'bg-[#0E3D75] border-[#F39C3D] text-white shadow-xl shadow-black/30' 
                            : 'bg-[#0D2442]/50 border-white/5 text-[#B8C7E0] hover:border-white/10 hover:bg-[#0D2442]/75'
                        }`}
                      >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-3xl">🎒</span>
                          <div className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                            isSelected ? 'bg-orange-500/25 border-orange-500/50 text-white' : 'bg-white/5 border-white/10 text-[#F39C3D]'
                          }`}>
                            سنة {gradeName}
                          </div>
                        </div>

                        <h4 className="text-xl font-black text-white mb-3">فصل سنة {gradeName}</h4>
                        
                        <div className="space-y-2 text-xs font-medium text-[#B8C7E0]">
                          <div className="flex justify-between">
                            <span>عدد المخدومين:</span>
                            <span className="font-extrabold text-white font-sans">{stats.total} أبطال</span>
                          </div>
                          <div className="flex justify-between">
                            <span>نسبة صلاة اليوم:</span>
                            <span className="font-extrabold text-[#F39C3D] font-sans">{stats.rate}% ({stats.prayed})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>سلاسل نشطة:</span>
                            <span className="font-extrabold text-white font-sans">{stats.activeStreaks} أبطال</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-end text-[10px] font-bold text-[#F39C3D]">
                          {isSelected ? 'إلغاء التصفية ✖️' : 'عرض المخدومين في الفصل 🔍'}
                        </div>
                      </motion.div>

                      {isSelected && renderKidsList(gradeName, true)}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Drill-down list for kids when no grade is selected */}
              {selectedGrade === null && renderKidsList(null)}

              {/* Core metrics bento grid (No graph) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Metric 1 */}
                <div className="p-6 rounded-3xl bg-[#0D2442]/40 border border-white/5 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">🏆</span>
                    <span className="text-[10px] py-1 px-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold">إجمالي الأبطال</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white font-sans mb-1">{kidsOnly.length}</h3>
                    <p className="text-xs text-[#B8C7E0]/60">إجمالي المخدومين المسجلين في الفصول</p>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="p-6 rounded-3xl bg-[#0D2442]/40 border border-white/5 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">🔥</span>
                    <span className="text-[10px] py-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">صلاة اليوم</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-emerald-400 font-sans mb-1">
                      {kidsOnly.filter(k => todayPrayers[k.uid] || k.lastPrayerDate === todayStr).length}
                    </h3>
                    <p className="text-xs text-[#B8C7E0]/60">عدد الأبطال الذين سجلوا صلواتهم اليوم</p>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="p-6 rounded-3xl bg-[#0D2442]/40 border border-white/5 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">😴</span>
                    <span className="text-[10px] py-1 px-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-bold">لم يسجلوا بعد</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-rose-400 font-sans mb-1">
                      {kidsOnly.filter(k => !(todayPrayers[k.uid] || k.lastPrayerDate === todayStr)).length}
                    </h3>
                    <p className="text-xs text-[#B8C7E0]/60">أبطال لم يرسلوا صلواتهم لليوم بعد</p>
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="p-6 rounded-3xl bg-[#0D2442]/40 border border-white/5 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">📈</span>
                    <span className="text-[10px] py-1 px-2.5 bg-amber-500/10 text-[#F39C3D] border border-amber-500/20 rounded-full font-bold">معدل التفاعل</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-[#F39C3D] font-sans mb-1">
                      {kidsOnly.length > 0 ? Math.round((kidsOnly.filter(k => todayPrayers[k.uid] || k.lastPrayerDate === todayStr).length / kidsOnly.length) * 100) : 0}%
                    </h3>
                    <p className="text-xs text-[#B8C7E0]/60">النسبة الكلية لصلوات أبطال الكنيسة اليوم</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CODE GENERATOR & MANAGEMENT (SuperAdmin Only) */}
          {activeTab === 'codes' && isSuperAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Generator Panel */}
              <div className="p-6 rounded-3xl bg-[#0D2442]/40 border border-white/5 self-start">
                <h3 className="text-lg font-black text-white mb-4">توليد أكواد دخول جديدة 🎫</h3>
                <p className="text-xs text-[#B8C7E0] leading-relaxed mb-6">
                  قم بتوليد مجموعة من الأكواد لتوزيعها على الأطفال أو الخدام للتسجيل الفوري. كل كود مخصص لشخص واحد ويتم تعطيله تلقائياً بعد استخدامه للمرة الأولى.
                </p>

                <form onSubmit={handleGenerateCodes} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">نوع الكود (الدور)</label>
                    <select
                      value={generateRole}
                      onChange={(e) => setGenerateRole(e.target.value as any)}
                      className="w-full px-4 py-3 bg-[#071426]/75 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-[#F39C3D] text-xs cursor-pointer font-bold"
                    >
                      <option value="user">مخدوم (Child) - كود يبدأ بـ MKD</option>
                      <option value="servant">خادم (Servant) - كود يبدأ بـ KHD</option>
                      <option value="admin">مدير (Admin) - كود يبدأ بـ ADM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">العدد المطلوب توليده</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={generateCount}
                      onChange={(e) => setGenerateCount(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#071426]/75 border border-white/10 rounded-2xl text-white text-center focus:outline-none focus:ring-2 focus:ring-[#F39C3D] font-mono font-bold text-sm"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isGenerating}
                    className="w-full py-4 bg-[#0E3D75] hover:bg-[#0E3D75]/80 border border-[#F39C3D]/30 text-white font-bold rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {isGenerating ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-[#F39C3D]" />
                        <span>توليد الأكواد الآن ✨</span>
                      </>
                    )}
                  </motion.button>
                </form>
              </div>

              {/* Codes list */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-[#0D2442]/30 border border-white/5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-black text-white">الأكواد المتوفرة والمستخدمة 🎟️</h3>
                  
                  {/* Search codes */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8C7E0]/40" />
                    <input
                      type="text"
                      placeholder="ابحث عن كود معين..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 bg-[#071426]/60 border border-white/5 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] text-xs transition"
                    />
                  </div>
                </div>

                 {/* Codes table - Desktop only */}
                 <div className="hidden md:block overflow-y-auto max-h-[450px]">
                   <table className="w-full text-right text-xs">
                     <thead>
                       <tr className="border-b border-white/5 text-[#B8C7E0]/60">
                         <th className="py-3 px-4 font-bold">الكود الفريد</th>
                         <th className="py-3 px-4 font-bold text-center">الدور المخصص</th>
                         <th className="py-3 px-4 font-bold text-center">الحالة</th>
                         <th className="py-3 px-4 font-bold text-center">بواسطة</th>
                         <th className="py-3 px-4 font-bold text-left">خيارات</th>
                       </tr>
                     </thead>
                     <tbody>
                       {allCodes.filter(c => c.code.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                         allCodes.filter(c => c.code.toLowerCase().includes(searchQuery.toLowerCase())).map((codeDoc) => {
                           const linkedUser = allUsers.find(u => u.uid === codeDoc.usedBy || u.code === codeDoc.code);
                           
                           return (
                             <tr key={codeDoc.code} className="border-b border-white/5 hover:bg-white/5 transition duration-150">
                               <td className="py-4 px-4 font-extrabold text-white font-mono text-sm tracking-widest flex items-center gap-2">
                                 <span>{codeDoc.code}</span>
                                 <button
                                   onClick={() => {
                                     navigator.clipboard.writeText(codeDoc.code);
                                     alert("تم نسخ الكود للحافظة! 📋");
                                   }}
                                   className="p-1 hover:bg-white/5 rounded text-[#B8C7E0]/60 hover:text-white transition cursor-pointer"
                                   title="نسخ الكود"
                                 >
                                   <Copy className="w-3.5 h-3.5" />
                                 </button>
                               </td>
                               <td className="py-4 px-4 text-center font-bold">
                                 {codeDoc.role === 'admin' && <span className="text-amber-400">مدير 👑</span>}
                                 {codeDoc.role === 'servant' && <span className="text-blue-400">خادم 🛡️</span>}
                                 {codeDoc.role === 'user' && <span className="text-[#B8C7E0]">مخدوم 🎒</span>}
                               </td>
                               <td className="py-4 px-4 text-center">
                                 {codeDoc.isUsed ? (
                                   <span className="py-0.5 px-2 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 font-bold text-[10px]">مستعمل ✖️</span>
                                 ) : (
                                   <span className="py-0.5 px-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold text-[10px]">نشط جاهز ✔️</span>
                                 )}
                               </td>
                               <td className="py-4 px-4 text-center text-[#B8C7E0]/60">
                                 {linkedUser ? (
                                   <span className="font-bold text-white text-xs">{linkedUser.name}</span>
                                 ) : (
                                   codeDoc.usedBy || '-'
                                 )}
                               </td>
                               <td className="py-4 px-4 text-left">
                                 <button
                                   onClick={() => handleDeleteCode(codeDoc.code)}
                                   className="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 rounded-lg duration-200 cursor-pointer"
                                   title="حذف الكود نهائياً"
                                 >
                                   <Trash className="w-3.5 h-3.5" />
                                 </button>
                               </td>
                             </tr>
                           );
                         })
                       ) : (
                         <tr>
                           <td colSpan={5} className="py-12 text-center text-[#B8C7E0]/40">
                             لا يوجد أي أكواد تماثل البحث.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>

                 {/* Codes Mobile View - Card list */}
                 <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto" id="mobile_codes_list">
                   {allCodes.filter(c => c.code.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                     allCodes.filter(c => c.code.toLowerCase().includes(searchQuery.toLowerCase())).map((codeDoc) => {
                       const linkedUser = allUsers.find(u => u.uid === codeDoc.usedBy || u.code === codeDoc.code);
                       return (
                         <div key={codeDoc.code} className="p-4 rounded-2xl bg-[#0D2442]/50 border border-white/5 flex flex-col gap-2 text-right">
                           <div className="flex items-center justify-between">
                             <span className="font-extrabold text-white font-mono text-sm tracking-wider bg-white/5 py-1 px-2.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                               {codeDoc.code}
                               <button
                                 onClick={() => {
                                   navigator.clipboard.writeText(codeDoc.code);
                                   alert("تم نسخ الكود للحافظة! 📋");
                                 }}
                                 className="p-1 hover:bg-white/10 rounded text-[#B8C7E0]/60 hover:text-white transition cursor-pointer"
                               >
                                 <Copy className="w-3.5 h-3.5" />
                               </button>
                             </span>
                             
                             <div>
                               {codeDoc.role === 'admin' && <span className="py-0.5 px-2 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full font-bold text-[10px]">مدير 👑</span>}
                               {codeDoc.role === 'servant' && <span className="py-0.5 px-2 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full font-bold text-[10px]">خادم 🛡️</span>}
                               {codeDoc.role === 'user' && <span className="py-0.5 px-2 bg-white/5 text-[#B8C7E0] border border-white/10 rounded-full font-bold text-[10px]">مخدوم 🎒</span>}
                             </div>
                           </div>

                           <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                             <span className="text-[#B8C7E0]/60">الحالة:</span>
                             {codeDoc.isUsed ? (
                               <span className="py-0.5 px-2.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 font-bold text-[10px]">مستعمل ✖️</span>
                             ) : (
                               <span className="py-0.5 px-2.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold text-[10px]">نشط جاهز ✔️</span>
                             )}
                           </div>

                           <div className="flex items-center justify-between text-xs">
                             <span className="text-[#B8C7E0]/60">مستعمل بواسطة:</span>
                             <span className="font-bold text-white">
                               {linkedUser ? linkedUser.name : (codeDoc.usedBy || '-')}
                             </span>
                           </div>

                           <div className="flex justify-end pt-2 border-t border-white/5">
                             <button
                               onClick={() => handleDeleteCode(codeDoc.code)}
                               className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[11px] font-bold duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95"
                             >
                               <Trash className="w-3.5 h-3.5" />
                               <span>حذف الكود</span>
                             </button>
                           </div>
                         </div>
                       );
                     })
                   ) : (
                     <div className="py-8 text-center text-[#B8C7E0]/40 text-xs">
                       لا يوجد أي أكواد تماثل البحث.
                     </div>
                   )}
                 </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROLES & USER MANAGEMENT (SuperAdmin Only) */}
          {activeTab === 'users' && isSuperAdmin && (
            <div className="p-6 rounded-3xl bg-[#0D2442]/30 border border-white/5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">إدارة حسابات الكنيسة والصلوات 🛡️</h3>
                  <p className="text-xs text-[#B8C7E0] mt-0.5">تعديل الصلاحيات أو حظر الجلسات أو ضبط السلاسل التراكمية</p>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8C7E0]/40" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو الكود..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-[#071426]/60 border border-white/5 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] text-xs transition"
                  />
                </div>
              </div>

              {/* Users management table - Desktop only */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-[#B8C7E0]/60">
                      <th className="py-3 px-4 font-bold">الاسم والملف</th>
                      <th className="py-3 px-4 font-bold text-center">الكود الفريد</th>
                      <th className="py-3 px-4 font-bold text-center">الصلاحية</th>
                      <th className="py-3 px-4 font-bold text-center">السلسلة</th>
                      <th className="py-3 px-4 font-bold text-center">إجمالي الأيام</th>
                      <th className="py-3 px-4 font-bold text-left">إجراءات الإدارة والتحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || (u.code && u.code.toLowerCase().includes(searchQuery.toLowerCase()))).length > 0 ? (
                      allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || (u.code && u.code.toLowerCase().includes(searchQuery.toLowerCase()))).map((u) => (
                        <tr key={u.uid} className="border-b border-white/5 hover:bg-white/5 transition duration-150">
                          <td className="py-4 px-4 font-bold text-white flex items-center gap-3">
                            <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full bg-white/5" />
                            <div>
                              <span>{u.name}</span>
                              <p className="text-[10px] text-[#B8C7E0]/40 font-mono mt-0.5">{u.uid}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center font-extrabold text-[#F39C3D] font-mono text-sm tracking-wider">{u.code || '-'}</td>
                          <td className="py-4 px-4 text-center">
                            {u.role === 'superadmin' && <span className="py-1 px-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-black text-[10px]">مالك رئيسي 👑</span>}
                            {u.role === 'admin' && <span className="py-1 px-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold text-[10px]">مدير لوحة التحكم 💼</span>}
                            {u.role === 'servant' && <span className="py-1 px-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold text-[10px]">خادم فصل 🛡️</span>}
                            {u.role === 'user' && <span className="py-1 px-2.5 bg-white/5 text-[#B8C7E0] border border-white/10 rounded-full font-bold text-[10px]">مخدوم (طفل) 🎒</span>}
                          </td>
                          <td className="py-4 px-4 text-center font-bold font-mono text-white">{u.currentStreak || 0} يوم</td>
                          <td className="py-4 px-4 text-center font-bold font-mono text-[#B8C7E0]">{u.totalPrayerDays || 0} صلاة</td>
                          <td className="py-4 px-4 text-left">
                            <div className="flex items-center justify-end gap-2">
                              {/* Edit details */}
                              <button
                                onClick={() => startEditing(u)}
                                className="p-1.5 bg-[#0E3D75]/50 hover:bg-[#0E3D75]/70 text-amber-400 rounded-lg border border-[#F39C3D]/10 duration-200 cursor-pointer"
                                title="تعديل يدوي للصلوات والاسم"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset Device Session */}
                              {u.role !== 'superadmin' && (
                                <button
                                  onClick={() => handleDeactivateSession(u)}
                                  className="p-1.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 rounded-lg border border-amber-500/25 duration-200 cursor-pointer"
                                  title="إنهاء الجلسة وتسجيل الخروج قسرياً"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Profile and free code */}
                              {u.role !== 'superadmin' && (
                                <button
                                  onClick={() => handleDeleteUser(u.uid, u.name, u.code)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-lg border border-rose-500/20 duration-200 cursor-pointer"
                                  title="حذف حساب المخدوم نهائياً"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#B8C7E0]/40">
                          لا يوجد مستخدمون يطابقون خيارات البحث.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Users Mobile View - Card list */}
              <div className="block md:hidden space-y-3" id="mobile_users_list">
                {allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || (u.code && u.code.toLowerCase().includes(searchQuery.toLowerCase()))).length > 0 ? (
                  allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || (u.code && u.code.toLowerCase().includes(searchQuery.toLowerCase()))).map((u) => (
                    <div key={u.uid} className="p-4 rounded-2xl bg-[#0D2442]/50 border border-white/5 flex flex-col gap-3 text-right">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full bg-white/5" />
                          <div className="text-right">
                            <h4 className="font-bold text-white text-sm">{u.name}</h4>
                            <p className="text-[10px] text-[#B8C7E0]/40 font-mono">{u.uid}</p>
                          </div>
                        </div>
                        
                        <div>
                          {u.role === 'superadmin' && <span className="py-0.5 px-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-black text-[10px]">مالك رئيسي 👑</span>}
                          {u.role === 'admin' && <span className="py-0.5 px-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold text-[10px]">مدير 💼</span>}
                          {u.role === 'servant' && <span className="py-0.5 px-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold text-[10px]">خادم 🛡️</span>}
                          {u.role === 'user' && <span className="py-0.5 px-2 bg-white/5 text-[#B8C7E0] border border-white/10 rounded-full font-bold text-[10px]">مخدوم 🎒</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-white/5 text-xs">
                        <div>
                          <p className="text-[9px] text-[#B8C7E0]/60 font-medium">الكود</p>
                          <p className="text-xs font-black text-[#F39C3D] font-mono">{u.code || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#B8C7E0]/60 font-medium">السلسلة</p>
                          <p className="text-xs font-black text-white font-mono">{u.currentStreak || 0} يوم</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#B8C7E0]/60 font-medium">الصلوات</p>
                          <p className="text-xs font-black text-[#B8C7E0] font-mono">{u.totalPrayerDays || 0} صلاة</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => startEditing(u)}
                          className="flex-1 py-2 bg-[#0E3D75]/50 hover:bg-[#0E3D75]/70 text-amber-400 rounded-xl border border-[#F39C3D]/10 duration-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>تعديل الحساب</span>
                        </button>

                        {u.role !== 'superadmin' && (
                          <button
                            onClick={() => handleDeactivateSession(u)}
                            className="p-2 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 rounded-xl border border-amber-500/25 duration-200 cursor-pointer active:scale-95"
                            title="إنهاء الجلسة وتسجيل الخروج قسرياً"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}

                        {u.role !== 'superadmin' && (
                          <button
                            onClick={() => handleDeleteUser(u.uid, u.name, u.code)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-xl border border-rose-500/20 duration-200 cursor-pointer active:scale-95"
                            title="حذف حساب المخدوم نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-[#B8C7E0]/40 text-xs">
                    لا يوجد مستخدمون يطابقون خيارات البحث.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SLEEK CHILD DETAILED VIEW MODAL */}
      <AnimatePresence>
        {selectedKid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedKid(null)}
              className="absolute inset-0 bg-[#071426]/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0D2442]/95 border border-white/10 rounded-3xl p-5 shadow-2xl z-10 text-right font-sans overflow-hidden"
              dir="rtl"
            >
              {/* Glow top right */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F39C3D]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-3">
                <button
                  onClick={() => setSelectedKid(null)}
                  className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl text-rose-400 transition cursor-pointer active:scale-90 flex items-center justify-center min-w-[40px] min-h-[40px]"
                  title="إغلاق النافذة"
                >
                  <X className="w-4 h-4 stroke-[3]" />
                </button>
                <div className="text-right">
                  <h3 className="text-lg font-black text-white">تفاصيل البطل 📖🏆</h3>
                  <p className="text-[11px] text-[#B8C7E0]/80">بطاقة الأداء الروحي والتسجيل اليومي</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 mb-5 p-3.5 bg-white/5 border border-white/5 rounded-2xl">
                <img src={selectedKid.photoURL} alt="" className="w-14 h-14 rounded-full bg-white/10" />
                <div className="text-center">
                  <h4 className="text-base font-black text-white">{selectedKid.name}</h4>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="py-0.5 px-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full font-bold text-[9px]">
                      فصل سنة {selectedKid.grade || 'تالتة'}
                    </span>
                    <span className="py-0.5 px-2 bg-white/5 text-[#B8C7E0] border border-white/10 rounded-full font-mono text-[9px] tracking-wider">
                      كود: {selectedKid.code || 'بلا كود'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center mb-5">
                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                  <p className="text-[9px] text-[#B8C7E0]/60 font-bold mb-0.5">السلسلة الحالية</p>
                  <p className="text-xs font-extrabold text-white font-sans">{selectedKid.currentStreak || 0} يوم</p>
                </div>

                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <Award className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-[9px] text-[#B8C7E0]/60 font-bold mb-0.5">أطول سلسلة</p>
                  <p className="text-xs font-extrabold text-white font-sans">{selectedKid.longestStreak || 0} يوم</p>
                </div>

                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-[9px] text-[#B8C7E0]/60 font-bold mb-0.5">إجمالي الأيام</p>
                  <p className="text-xs font-extrabold text-white font-sans">{selectedKid.totalPrayerDays || 0} صلاة</p>
                </div>
              </div>

              <div className="space-y-2.5 text-[11px] font-semibold text-[#B8C7E0] p-3.5 bg-[#071426]/50 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span>تاريخ التسجيل الأول:</span>
                  <span className="text-white font-sans">
                    {selectedKid.createdAt ? new Date(selectedKid.createdAt).toLocaleDateString('ar-EG') : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>آخر يوم صلاة مسجل:</span>
                  <span className={`font-sans font-bold ${selectedKid.lastPrayerDate === todayStr ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedKid.lastPrayerDate ? selectedKid.lastPrayerDate : 'لا يوجد صلوات مسجلة بعد'}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setSelectedKid(null)}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black duration-200 text-xs cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  إغلاق نافذة التفاصيل ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SLEEK EDIT PROFILE MODAL (SuperAdmin Only) */}
      <AnimatePresence>
        {isSuperAdmin && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-[#071426]/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0D2442]/95 border border-white/10 rounded-3xl p-6 shadow-2xl z-10 text-right font-sans"
              dir="rtl"
            >
              <h3 className="text-xl font-black text-white mb-1">تعديل بيانات الحساب ✏️</h3>
              <p className="text-xs text-[#B8C7E0] mb-6">قم بتعديل بيانات الاسم، الفصول، السلاسل المتراكمة، أو الصلاحية</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#B8C7E0] mb-2">اسم الحساب بالكامل</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-right"
                  />
                </div>

                {editingUser.role === 'user' && (
                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">الفئة (الفصل الدراسي)</label>
                    <select
                      value={editGrade}
                      onChange={(e: any) => setEditGrade(e.target.value)}
                      className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-right font-bold"
                    >
                      <option value="تالتة">سنة تالتة</option>
                      <option value="رابعة">سنة رابعة</option>
                      <option value="خامسة">سنة خامسة</option>
                      <option value="سادسة">سنة سادسة</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#B8C7E0] mb-2">نوع الصلاحية بالمنظومة</label>
                  <select
                    value={editRole}
                    onChange={(e: any) => setEditRole(e.target.value)}
                    className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-right font-bold"
                  >
                    <option value="user">مخدوم (Child)</option>
                    <option value="servant">خادم فصل معتمد (Servant)</option>
                    <option value="admin">مدير لوحة التحكم (Admin)</option>
                    <option value="superadmin">مالك رئيسي (SuperAdmin)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">السلسلة الحالية (أيام)</label>
                    <input
                      type="number"
                      value={editStreak}
                      onChange={(e) => setEditStreak(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">أطول سلسلة (أيام)</label>
                    <input
                      type="number"
                      value={editLongestStreak}
                      onChange={(e) => setEditLongestStreak(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-center font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#B8C7E0] mb-2">إجمالي الأيام المصلى فيها</label>
                  <input
                    type="number"
                    value={editTotalPrayers}
                    onChange={(e) => setEditTotalPrayers(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-center font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={handleUpdateUser}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#F39C3D] to-amber-500 hover:from-amber-500 hover:to-orange-500 text-[#071426] font-bold rounded-2xl shadow-lg hover:shadow-orange-500/20 duration-300 text-sm cursor-pointer"
                >
                  حفظ التعديلات ✨
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 duration-200 text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
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
export default LeaderDashboard;
