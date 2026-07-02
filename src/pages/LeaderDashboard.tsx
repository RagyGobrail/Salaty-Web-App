import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, getDocs, updateDoc, deleteDoc, doc, query, where, writeBatch 
} from 'firebase/firestore';
import { AppUser, PrayerLog } from '../types';
import { getLocalDateString, getYesterdayDateString } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { 
  Search, Shield, Users, Flame, CheckCircle2, XCircle, 
  Sparkles, Award, UserPlus, Filter, Calendar, RefreshCw,
  Edit2, Trash2, Check, X, ShieldAlert, UserCheck
} from 'lucide-react';

export const LeaderDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  
  // Authorization States
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isMainOwner, setIsMainOwner] = useState(false);
  const [isApprovedServant, setIsApprovedServant] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data States
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [todayPrayers, setTodayPrayers] = useState<Record<string, boolean>>({});
  const [monthlyPrayers, setMonthlyPrayers] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<{ name: string; count: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'all'>('leaderboard');
  const [isSeeding, setIsSeeding] = useState(false);

  // Edit States for kids (Admin only)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editStreak, setEditStreak] = useState(0);
  const [editLongestStreak, setEditLongestStreak] = useState(0);
  const [editTotalPrayers, setEditTotalPrayers] = useState(0);

  const todayStr = getLocalDateString();

  // Handle Admin / Servant Authorization Checks
  useEffect(() => {
    if (user) {
      const isOwner = user.role === 'superadmin' || user.email === 'eskander.ragy@gmail.com';
      const superAdmin = user.role === 'admin' || isOwner;
      const servant = user.role === 'servant' && user.status === 'approved';
      setIsSuperAdmin(superAdmin);
      setIsMainOwner(isOwner);
      setIsApprovedServant(servant);
      setHasAccess(superAdmin || servant);
    }
  }, [user]);

  // Load Dashboard Data
  useEffect(() => {
    if (hasAccess) {
      fetchDashboardData();
    }
  }, [hasAccess]);

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

      // 2. Fetch today's prayer logs
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

      // 3. Fetch current month's prayer logs for each user to get exact counts
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

      // 4. Build past 7 days chart data
      await buildPast7DaysChart();

    } catch (err) {
      console.error("Error loading dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildPast7DaysChart = async () => {
    const daysArabicShort = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const past7: { dateStr: string; label: string }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      past7.push({
        dateStr,
        label: daysArabicShort[d.getDay()]
      });
    }

    try {
      // Fetch all prayers in range
      const prayersRangeQ = query(
        collection(db, 'userPrayers'),
        where('date', '>=', past7[0].dateStr),
        where('date', '<=', past7[6].dateStr)
      );
      const snapshot = await getDocs(prayersRangeQ);
      const counts: Record<string, number> = {};
      
      // Initialize count at 0
      past7.forEach(p => counts[p.dateStr] = 0);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.date && counts[data.date] !== undefined) {
          counts[data.date]++;
        }
      });

      const formattedChart = past7.map(p => ({
        name: p.label,
        count: counts[p.dateStr]
      }));

      setChartData(formattedChart);
    } catch (e) {
      console.error("Error building weekly chart:", e);
    }
  };

  // Seed demo kids data for Church presentation
  const seedDemoData = async () => {
    if (!user) return;
    setIsSeeding(true);
    
    try {
      const batch = writeBatch(db);
      
      // Sample kids
      const demoKids = [
        { name: "مينا يوسف", email: "mina@church.com", streak: 15, longest: 22, total: 35, photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=mina" },
        { name: "مريم جرجس", email: "mary@church.com", streak: 8, longest: 14, total: 19, photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=mary" },
        { name: "كيرلس فادي", email: "kirollos@church.com", streak: 0, longest: 30, total: 45, photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=kirollos" },
        { name: "دميانة ماجد", email: "demiana@church.com", streak: 12, longest: 12, total: 12, photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=demi" },
        { name: "يوستينا سامح", email: "justina@church.com", streak: 3, longest: 7, total: 10, photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=justina" },
        { name: "أنطونيوس رأفت", email: "antony@church.com", streak: 21, longest: 25, total: 50, photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=antony" }
      ];

      const yesterdayStr = getYesterdayDateString(todayStr);

      demoKids.forEach((kid, idx) => {
        const uid = `demo_kid_${idx}`;
        const userRef = doc(db, 'users', uid);
        
        // Define last prayer date (some prayed today, some yesterday, some before)
        let lastDate = todayStr;
        if (idx === 2) lastDate = "2026-06-25"; // missed
        else if (idx === 4) lastDate = yesterdayStr; // prayed yesterday, not today
        
        const kidData: AppUser = {
          uid,
          name: kid.name,
          email: kid.email,
          photoURL: kid.photo,
          currentStreak: kid.streak,
          longestStreak: kid.longest,
          lastPrayerDate: lastDate,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrayerDays: kid.total,
          role: 'user'
        };

        batch.set(userRef, kidData);

        // Also add some prayer logs to display in charts
        const prayerRef = doc(db, 'userPrayers', `${uid}_${lastDate}`);
        batch.set(prayerRef, {
          id: `${uid}_${lastDate}`,
          uid,
          date: lastDate,
          timestamp: new Date().toISOString()
        });
        
        // Let's add older logs for chart density
        const dates = [
          getYesterdayDateString(todayStr),
          getYesterdayDateString(getYesterdayDateString(todayStr)),
          getYesterdayDateString(getYesterdayDateString(getYesterdayDateString(todayStr)))
        ];
        
        dates.forEach((dStr, dIdx) => {
          if (idx % 2 === 0 || dIdx === 0) {
            const pRef = doc(db, 'userPrayers', `${uid}_${dStr}`);
            batch.set(pRef, {
              id: `${uid}_${dStr}`,
              uid,
              date: dStr,
              timestamp: new Date().toISOString()
            });
          }
        });
      });

      await batch.commit();
      alert("تم بنجاح توليد مخدومين افتراضيين لتجربة لوحة التحكم وعرض المخططات والترتيب! 🚀🌟");
      await fetchDashboardData();
    } catch (e) {
      console.error(e);
      alert("فشل توليد البيانات الافتراضية");
    } finally {
      setIsSeeding(false);
    }
  };

  // Switch temporary logged in user to admin role for testing
  const grantTestAdmin = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role: 'admin' });
      setIsSuperAdmin(true);
      setHasAccess(true);
      alert("رائع! لقد تم ترقيتك لدور خادم الكنيسة (مسؤول) بنجاح للمعاينة والتحكم! 🛡️💼");
      await refreshUser();
    } catch (e) {
      console.error(e);
    }
  };

  const approveServant = async (servant: AppUser) => {
    try {
      await updateDoc(doc(db, 'users', servant.uid), { status: 'approved' });
      setAllUsers(prev => prev.map(u => u.uid === servant.uid ? { ...u, status: 'approved' } : u));
      alert(`تم قبول الخادم ${servant.name} بنجاح وتفعيل حسابه! 🛡️✨`);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء قبول الخادم");
    }
  };

  const rejectServant = async (servant: AppUser) => {
    try {
      await updateDoc(doc(db, 'users', servant.uid), { status: 'rejected' });
      setAllUsers(prev => prev.map(u => u.uid === servant.uid ? { ...u, status: 'rejected' } : u));
      alert(`تم رفض طلب الخادم ${servant.name}.`);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء رفض الخادم");
    }
  };

  // Child management functions (SuperAdmin Only)
  const startEditing = (targetUser: AppUser) => {
    setEditingUser(targetUser);
    setEditName(targetUser.name);
    setEditStreak(targetUser.currentStreak || 0);
    setEditLongestStreak(targetUser.longestStreak || 0);
    setEditTotalPrayers(targetUser.totalPrayerDays || 0);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const userRef = doc(db, 'users', editingUser.uid);
      await updateDoc(userRef, {
        name: editName,
        currentStreak: Number(editStreak),
        longestStreak: Number(editLongestStreak),
        totalPrayerDays: Number(editTotalPrayers)
      });
      setAllUsers(prev => prev.map(u => u.uid === editingUser.uid ? {
        ...u,
        name: editName,
        currentStreak: Number(editStreak),
        longestStreak: Number(editLongestStreak),
        totalPrayerDays: Number(editTotalPrayers)
      } : u));
      setEditingUser(null);
      alert("تم تحديث بيانات الطفل البطل بنجاح! ✏️🌟");
    } catch (e) {
      console.error(e);
      alert("فشل تحديث البيانات");
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب الطفل البطل (${name}) نهائياً من قاعدة البيانات؟`)) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setAllUsers(prev => prev.filter(u => u.uid !== uid));
      alert(`تم حذف حساب ${name} بنجاح.`);
    } catch (e) {
      console.error(e);
      alert("فشل حذف الحساب");
    }
  };

  const handleDeleteServant = async (uid: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب الخادم (${name}) نهائياً من قاعدة البيانات؟`)) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setAllUsers(prev => prev.filter(u => u.uid !== uid));
      alert(`تم حذف حساب الخادم ${name} بنجاح.`);
    } catch (e) {
      console.error(e);
      alert("فشل حذف حساب الخادم");
    }
  };

  // Update user role to servant, admin, or superadmin
  const updateUserRole = async (targetUser: AppUser, newRole: 'servant' | 'admin' | 'superadmin') => {
    const roleLabels = {
      servant: 'خادم عادي (Servant)',
      admin: 'مسؤول (Admin)',
      superadmin: 'مالك رئيسي مثلك (Super Admin) 👑'
    };
    const msg = `هل أنت متأكد من تغيير صلاحيات الخادم ${targetUser.name} ليكون ${roleLabels[newRole]}؟`;
    if (!confirm(msg)) return;

    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { 
        role: newRole,
        status: 'approved' // ensure they are approved if they get changed
      });
      setAllUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, role: newRole, status: 'approved' } : u));
      alert(`تم تعديل صلاحيات الخادم ${targetUser.name} إلى ${roleLabels[newRole]} بنجاح! 🎉`);
    } catch (e) {
      console.error(e);
      alert("فشل في تعديل الصلاحيات.");
    }
  };

  // Calculations
  const kidsOnly = allUsers.filter(u => u.role !== 'admin' && u.role !== 'superadmin' && u.role !== 'servant' && u.email !== 'eskander.ragy@gmail.com');
  const pendingServants = allUsers.filter(u => u.role === 'servant' && u.status === 'pending');
  const totalServants = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin' || (u.role === 'servant' && u.status === 'approved') || u.email === 'eskander.ragy@gmail.com').length;
  const otherServants = allUsers.filter(u => 
    u.uid !== user?.uid && 
    u.email !== 'eskander.ragy@gmail.com' &&
    (u.role === 'admin' || u.role === 'superadmin' || (u.role === 'servant' && u.status === 'approved'))
  );

  const totalKids = kidsOnly.length;
  const prayedTodayCount = kidsOnly.filter(u => todayPrayers[u.uid] || u.lastPrayerDate === todayStr).length;
  const completionPercentage = totalKids > 0 ? Math.round((prayedTodayCount / totalKids) * 100) : 0;

  // Filter & Search users
  const filteredUsers = kidsOnly.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Split into categories
  const leaderboardUsers = [...filteredUsers].sort((a, b) => b.currentStreak - a.currentStreak);

  if (!hasAccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl glass-card p-8 flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 text-amber-400 glow-orange border border-amber-500/25">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3 font-sans">صفحة المسؤولين فقط 🔒</h2>
          <p className="text-sm text-[#B8C7E0] leading-relaxed mb-8 max-w-sm">
            نعتذر يا بطل! لوحة القيادة ومتابعة إحصائيات الكنيسة مخصصة للآباء الكهنة والخدام المسؤولين فقط لمتابعة صلوات الأطفال ومساعدتهم.
          </p>

          <div className="space-y-4 w-full">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={grantTestAdmin}
              className="w-full py-4 bg-gradient-to-r from-[#F39C3D] to-amber-500 hover:from-amber-500 hover:to-orange-500 text-[#071426] font-black rounded-2xl shadow-lg hover:shadow-orange-500/20 duration-300 flex items-center justify-center gap-2 glow-orange cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>ترقية حسابي الحالي كمسؤول للمعاينة 🛠️</span>
            </motion.button>
            
            <p className="text-[10px] text-[#B8C7E0]/60">
              *اضغط على هذا الزر لتجربة دور الخادم بالكامل، والاطلاع على المخططات والتسجيل الفوري لجميع الأطفال!
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 pb-24 relative z-10">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="text-right">
          <div className="flex items-center gap-2 text-xs font-black text-[#F39C3D] uppercase tracking-wide">
            <Shield className="w-4 h-4 text-[#F39C3D]" />
            <span>لوحة تحكم خادم الكنيسة</span>
          </div>
          <h2 className="text-3xl font-black text-white mt-1">دفتر صلاتي • الإدارة والتحليل 📊👔</h2>
        </div>

        {/* Action triggers */}
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

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={seedDemoData}
            disabled={isSeeding}
            className="px-5 py-3 bg-[#F39C3D]/10 hover:bg-[#F39C3D]/20 border border-[#F39C3D]/20 text-[#F39C3D] rounded-2xl font-bold text-sm flex items-center gap-2 duration-300 cursor-pointer"
          >
            {isSeeding ? (
              <span className="w-4 h-4 border-2 border-[#F39C3D] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>محاكاة وتوليد بيانات المخدومين 🚀</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Pending Servant Requests Section (SuperAdmin Only) */}
      {isSuperAdmin && pendingServants.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 mb-8 text-right font-sans"
          dir="rtl"
        >
          <div className="flex items-center gap-2 text-sm font-black text-amber-400 mb-4">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>طلبات انضمام الخدام المعلقة ({pendingServants.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingServants.map((servant) => (
              <div 
                key={servant.uid} 
                className="flex items-center justify-between p-4 bg-[#071426]/60 rounded-2xl border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F39C3D]/10 rounded-full flex items-center justify-center text-lg">
                    👤
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{servant.name}</p>
                    <p className="text-xs text-[#B8C7E0]/70">{servant.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveServant(servant)}
                    className="p-2 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/25 duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Check className="w-4 h-4" />
                    <span>قبول</span>
                  </button>
                  <button
                    onClick={() => rejectServant(servant)}
                    className="p-2 px-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/25 duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  >
                    <X className="w-4 h-4" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Other Servants Management Section (isMainOwner Only) */}
      {isMainOwner && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-[#0E3D75]/30 bg-[#0E3D75]/5 p-6 mb-8 text-right font-sans"
          dir="rtl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-2 text-sm font-black text-[#F39C3D]">
              <Users className="w-5 h-5 text-[#F39C3D]" />
              <span>قائمة الخدام والمسؤولين الآخرين ({otherServants.length})</span>
            </div>
            <div className="inline-flex text-[10px] text-slate-300 font-extrabold bg-[#0E3D75]/60 py-1 px-3.5 rounded-full border border-white/10 self-start">
              صلاحيات الإدارة والتحكم الكامل 👑
            </div>
          </div>

          {otherServants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherServants.map((servant) => (
                <div 
                  key={servant.uid} 
                  className="flex flex-col gap-4 p-4 bg-[#071426]/60 rounded-2xl border border-white/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={servant.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${servant.uid}`} 
                        alt={servant.name}
                        className="w-10 h-10 rounded-xl bg-[#071426] border border-white/10 p-0.5 object-cover"
                      />
                      <div className="text-right">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{servant.name}</p>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                            servant.role === 'superadmin'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : servant.role === 'admin' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {servant.role === 'superadmin' ? 'مالك رئيسي (Owner) 👑' : servant.role === 'admin' ? 'مسؤول (Admin)' : 'خادم (Servant)'}
                          </span>
                        </div>
                        <p className="text-xs text-[#B8C7E0]/70 ltr text-right mt-0.5">{servant.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteServant(servant.uid, servant.name)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/25 duration-200 cursor-pointer"
                      title="حذف الخادم"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 w-full pt-3 border-t border-white/5">
                    <p className="text-[10px] text-[#B8C7E0]/60 font-bold">تعديل رتبة وصلاحيات الخادم:</p>
                    <div className="flex flex-wrap gap-1.5 justify-start">
                      {/* Servant button */}
                      <button
                        onClick={() => updateUserRole(servant, 'servant')}
                        disabled={servant.role === 'servant'}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition duration-200 cursor-pointer ${
                          servant.role === 'servant'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 opacity-50 cursor-not-allowed'
                            : 'bg-[#071426] hover:bg-[#0E3D75]/40 text-blue-400 border border-white/5'
                        }`}
                      >
                        خادم عادي (Servant)
                      </button>

                      {/* Admin button */}
                      <button
                        onClick={() => updateUserRole(servant, 'admin')}
                        disabled={servant.role === 'admin'}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition duration-200 cursor-pointer ${
                          servant.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 opacity-50 cursor-not-allowed'
                            : 'bg-[#071426] hover:bg-[#0E3D75]/40 text-amber-400 border border-white/5'
                        }`}
                      >
                        مسؤول (Admin)
                      </button>

                      {/* Superadmin button */}
                      <button
                        onClick={() => updateUserRole(servant, 'superadmin')}
                        disabled={servant.role === 'superadmin'}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition duration-200 cursor-pointer ${
                          servant.role === 'superadmin'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 opacity-50 cursor-not-allowed'
                            : 'bg-[#071426] hover:bg-[#0E3D75]/40 text-purple-400 border border-white/5'
                        }`}
                      >
                        مالك رئيسي مثلي 👑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-[#B8C7E0]/50 text-xs border border-dashed border-white/5 rounded-2xl">
              لا يوجد خدام أو مسؤولون آخرون مسجلون في النظام حالياً 🛡️
            </div>
          )}
        </motion.div>
      )}

      {/* Aggregate Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        
        <div className="rounded-3xl glass-card p-5 sm:p-6 flex items-center gap-4 sm:gap-5 relative overflow-hidden">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 font-sans">
            👥
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{totalKids}</div>
            <div className="text-[10px] sm:text-xs text-[#B8C7E0] mt-1 font-semibold">إجمالي المخدومين</div>
          </div>
        </div>

        <div className="rounded-3xl glass-card p-5 sm:p-6 flex items-center gap-4 sm:gap-5 relative overflow-hidden">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 font-sans">
            🛡️
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{totalServants}</div>
            <div className="text-[10px] sm:text-xs text-[#B8C7E0] mt-1 font-semibold">عدد الخدام</div>
          </div>
        </div>

        <div className="rounded-3xl glass-card p-5 sm:p-6 flex items-center gap-4 sm:gap-5 relative overflow-hidden">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 font-sans">
            🔥
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{prayedTodayCount}</div>
            <div className="text-[10px] sm:text-xs text-[#B8C7E0] mt-1 font-semibold">المصلين اليوم</div>
          </div>
        </div>

        <div className="rounded-3xl glass-card p-5 sm:p-6 flex items-center gap-4 sm:gap-5 relative overflow-hidden">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 font-sans">
            🎯
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#F39C3D]">{completionPercentage}%</div>
            <div className="text-[10px] sm:text-xs text-[#B8C7E0] mt-1 font-semibold">نسبة الالتزام</div>
          </div>
        </div>

      </div>

      {/* Recharts Analytics Area Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl glass-card p-6 sm:p-8 mb-8"
      >
        <h3 className="text-lg font-black text-white mb-2 text-right">معدل التزام الصلاة الأسبوعي 📈</h3>
        <p className="text-xs text-[#B8C7E0] mb-6 text-right">إحصائيات إجمالي الصلوات المسجلة لجميع المخدومين في الـ 7 أيام الماضية:</p>
        
        <div className="w-full h-72 font-sans text-xs">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrayers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F39C3D" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#F39C3D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#B8C7E0" dy={10} />
                <YAxis stroke="#B8C7E0" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#071426', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    color: 'white',
                    borderRadius: '16px',
                    textAlign: 'right'
                  }} 
                />
                <Area type="monotone" dataKey="count" name="عدد المصلين" stroke="#F39C3D" strokeWidth={3} fillOpacity={1} fill="url(#colorPrayers)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              يرجى إضافة / محاكاة مخدومين افتراضيين لتعبئة المخطط 📊
            </div>
          )}
        </div>
      </motion.div>

      {/* Search and Filters Section */}
      <div className="rounded-3xl glass-card p-6 sm:p-8">
        
        {/* Controls header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          
          {/* Tabs switch */}
          <div className="flex bg-[#071426] p-1 rounded-2xl border border-white/5 w-full md:w-auto order-2 md:order-1">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 md:flex-none px-5 py-2.5 text-xs font-bold rounded-xl transition duration-300 ${activeTab === 'leaderboard' ? 'bg-[#0E3D75] text-white' : 'text-[#B8C7E0] hover:text-white'}`}
            >
              الترتيب (الأعلى سلسلة) 🔥
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 md:flex-none px-5 py-2.5 text-xs font-bold rounded-xl transition duration-300 ${activeTab === 'all' ? 'bg-[#0E3D75] text-white' : 'text-[#B8C7E0] hover:text-white'}`}
            >
              جميع المخدومين ({totalKids})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80 order-1 md:order-2">
            <Search className="absolute right-4 top-3.5 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="ابحث عن اسم المخدوم أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-11 py-3 bg-[#071426]/80 border border-white/10 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-right"
            />
          </div>

        </div>

        {/* Mobile View: Standings Cards (highly readable on phone screens) */}
        <div className="block lg:hidden space-y-4">
          <AnimatePresence mode="wait">
            {(activeTab === 'leaderboard' ? leaderboardUsers : filteredUsers).length > 0 ? (
              (activeTab === 'leaderboard' ? leaderboardUsers : filteredUsers).map((kid, idx) => {
                const isPrayedToday = todayPrayers[kid.uid] || kid.lastPrayerDate === todayStr;
                return (
                  <motion.div
                    key={kid.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-5 rounded-2xl bg-[#071426]/60 border border-white/5 space-y-4 relative overflow-hidden"
                  >
                    {/* Rank Indicator for Leaderboard */}
                    {activeTab === 'leaderboard' && (
                      <div className="absolute top-0 left-0 bg-gradient-to-br from-[#F39C3D] to-amber-500 text-[#071426] font-bold text-xs py-1 px-3.5 rounded-bl-2xl font-sans">
                        #{idx + 1}
                      </div>
                    )}

                    {/* Kid Profile Header */}
                    <div className="flex items-center gap-3">
                      <img 
                        src={kid.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${kid.uid}`} 
                        alt={kid.name}
                        className="w-12 h-12 rounded-xl bg-[#071426] border border-white/10 p-0.5 object-cover"
                      />
                      <div className="flex-1 min-w-0 text-right">
                        <h4 className="font-bold text-base text-white truncate">
                          {kid.name}
                        </h4>
                        <p className="text-[10px] text-[#B8C7E0]/60 truncate ltr text-right mt-0.5">{kid.email || 'تسجيل كضيف سريع'}</p>
                      </div>
                    </div>

                    {/* Today Status Badge */}
                    <div className="flex items-center justify-between bg-[#071426]/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-xs font-bold text-[#B8C7E0]">الالتزام اليوم:</span>
                      {isPrayedToday ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-black border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          صلى اليوم 🔥
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-black border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          لم يسجل بعد 😴
                        </span>
                      )}
                    </div>

                    {/* Core Statistics bento box */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-[#071426]/30 p-2.5 rounded-xl border border-white/5">
                        <div className="text-[9px] text-[#B8C7E0]/70 mb-0.5 font-bold">السلسلة الحالية</div>
                        <div className="text-sm font-extrabold text-[#F39C3D] font-sans">{kid.currentStreak} يوم</div>
                      </div>
                      <div className="bg-[#071426]/30 p-2.5 rounded-xl border border-white/5">
                        <div className="text-[9px] text-[#B8C7E0]/70 mb-0.5 font-bold">أطول سلسلة</div>
                        <div className="text-sm font-extrabold text-white font-sans">{kid.longestStreak} يوم</div>
                      </div>
                      <div className="bg-[#071426]/30 p-2.5 rounded-xl border border-white/5">
                        <div className="text-[9px] text-[#B8C7E0]/70 mb-0.5 font-bold">صلوات هذا الشهر</div>
                        <div className="text-sm font-extrabold text-[#F39C3D] font-sans">{monthlyPrayers[kid.uid] || 0} صلاة</div>
                      </div>
                      <div className="bg-[#071426]/30 p-2.5 rounded-xl border border-white/5">
                        <div className="text-[9px] text-[#B8C7E0]/70 mb-0.5 font-bold">إجمالي الأيام</div>
                        <div className="text-sm font-extrabold text-slate-300 font-sans">{kid.totalPrayerDays} يوم</div>
                      </div>
                    </div>

                    {/* Admin management tools */}
                    {isSuperAdmin && (
                      <div className="flex gap-2 pt-3 border-t border-white/5 justify-end">
                        <button
                          onClick={() => startEditing(kid)}
                          className="px-3.5 py-2 bg-[#0E3D75]/40 hover:bg-[#0E3D75]/70 text-amber-400 rounded-xl border border-[#F39C3D]/10 duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(kid.uid, kid.name)}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-xl border border-rose-500/20 duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="py-12 text-center text-[#B8C7E0]/60 text-sm border border-dashed border-white/10 rounded-2xl">
                🔍 لا يوجد نتائج مطابقة للبحث أو الترتيب المختار!
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop View: Table Layout (clean, full columns on larger screens) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[#B8C7E0] text-xs font-bold uppercase tracking-wide">
                <th className="pb-4 pt-2">المخدوم البطل</th>
                <th className="pb-4 pt-2 text-center">الالتزام اليوم</th>
                <th className="pb-4 pt-2 text-center">السلسلة الحالية</th>
                <th className="pb-4 pt-2 text-center">أطول سلسلة</th>
                <th className="pb-4 pt-2 text-center">صلوات هذا الشهر</th>
                <th className="pb-4 pt-2 text-center">إجمالي الأيام</th>
                {isSuperAdmin && <th className="pb-4 pt-2 text-left">التحكم</th>}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {(activeTab === 'leaderboard' ? leaderboardUsers : filteredUsers).length > 0 ? (
                  (activeTab === 'leaderboard' ? leaderboardUsers : filteredUsers).map((kid, idx) => {
                    const isPrayedToday = todayPrayers[kid.uid] || kid.lastPrayerDate === todayStr;
                    return (
                      <motion.tr 
                        key={kid.uid}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-white/5 hover:bg-white/5 transition duration-200"
                      >
                        {/* Child info */}
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            {activeTab === 'leaderboard' && (
                              <div className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-[#F39C3D]/10 text-[#F39C3D] rounded-full font-sans">
                                {idx + 1}
                              </div>
                            )}
                            <img 
                              src={kid.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${kid.uid}`} 
                              alt={kid.name}
                              className="w-10 h-10 rounded-xl bg-[#071426] border border-white/10 p-0.5 flex-shrink-0"
                            />
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                {kid.name}
                                {kid.role === 'admin' && (
                                  <span className="bg-amber-500/10 text-[#F39C3D] border border-[#F39C3D]/30 py-0.5 px-1.5 rounded-full text-[9px] font-black flex items-center gap-0.5">
                                    <Shield className="w-2.5 h-2.5" /> خادم
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#B8C7E0]/50 ltr text-right mt-0.5">{kid.email || 'تسجيل كضيف سريع'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Status Check Today */}
                        <td className="py-4 text-center">
                          {isPrayedToday ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-black border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              صلى اليوم 🔥
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-black border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" />
                              لم يسجل بعد 😴
                            </span>
                          )}
                        </td>

                        {/* Current Streak */}
                        <td className="py-4 text-center font-extrabold text-[#F39C3D] text-sm font-sans">
                          {kid.currentStreak} يوم
                        </td>

                        {/* Longest Streak */}
                        <td className="py-4 text-center font-bold text-white text-sm font-sans">
                          {kid.longestStreak} يوم
                        </td>

                        {/* Monthly count of prayers */}
                        <td className="py-4 text-center font-bold text-[#F39C3D] text-sm font-sans">
                          {monthlyPrayers[kid.uid] || 0} صلوات
                        </td>

                        {/* Total Days */}
                        <td className="py-4 text-center font-bold text-slate-300 text-sm font-sans">
                          {kid.totalPrayerDays} يوم
                        </td>

                        {/* Admin actions toggle */}
                        {isSuperAdmin && (
                          <td className="py-4 text-left">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => startEditing(kid)}
                                className="p-2 bg-[#0E3D75]/40 hover:bg-[#0E3D75]/70 text-amber-400 rounded-xl border border-[#F39C3D]/10 duration-200 cursor-pointer"
                                title="تعديل بيانات المخدوم"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(kid.uid, kid.name)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-xl border border-rose-500/20 duration-200 cursor-pointer"
                                title="حذف الحساب نهائياً"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}

                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isSuperAdmin ? 7 : 6} className="py-12 text-center text-[#B8C7E0]/60 text-sm">
                      🔍 لا يوجد نتائج مطابقة للبحث أو الترتيب المختار! جرب توليد بيانات المخدومين الافتراضيين بالأعلى للمعاينة الفورية 🌟
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

      </div>

      {/* Sleek Edit Modal (SuperAdmin Only) */}
      <AnimatePresence>
        {isSuperAdmin && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-[#071426]/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0D2442]/95 border border-white/10 rounded-3xl p-6 shadow-2xl z-10 text-right font-sans"
              dir="rtl"
            >
              <h3 className="text-xl font-black text-white mb-1 font-sans">تعديل بيانات المخدوم ✏️🏆</h3>
              <p className="text-xs text-[#B8C7E0] mb-6">قم بتحديث السلسلة أو الاسم مباشرة من هنا</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#B8C7E0] mb-2">اسم المخدوم بالكامل</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">السلسلة الحالية (أيام)</label>
                    <input
                      type="number"
                      value={editStreak}
                      onChange={(e) => setEditStreak(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-center font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#B8C7E0] mb-2">أطول سلسلة (أيام)</label>
                    <input
                      type="number"
                      value={editLongestStreak}
                      onChange={(e) => setEditLongestStreak(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-center font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#B8C7E0] mb-2">إجمالي الأيام المصلى فيها</label>
                  <input
                    type="number"
                    value={editTotalPrayers}
                    onChange={(e) => setEditTotalPrayers(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-[#071426]/70 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#F39C3D] transition text-sm text-center font-sans"
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

    </div>
  );
};
