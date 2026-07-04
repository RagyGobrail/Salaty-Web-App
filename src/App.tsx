import React from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlowBackground } from './components/GlowBackground';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { LeaderDashboard } from './pages/LeaderDashboard';
import { BookOpen, User, ShieldAlert, Heart, Flame, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

// Route Guard to protect routes for authenticated children
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#071426]">
        <span className="w-12 h-12 border-4 border-[#F39C3D] border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-white font-bold text-lg">جاري تجهيز دفتر صلاتك... 📖</h3>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Route Guard specifically for church leaders / admin role
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#071426]">
        <span className="w-12 h-12 border-4 border-[#F39C3D] border-t-transparent rounded-full animate-spin mb-4" />
      </div>
    );
  }

  // Allow email and role 'admin' / 'superadmin'
  const isAuthorized = user && (user.role === 'admin' || user.role === 'superadmin' || user.email === 'eskander.ragy@gmail.com');

  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Main layout wrapper featuring beautiful responsive header and bottom navbar for children
const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isLeader = user?.role === 'admin' || user?.role === 'superadmin' || user?.email === 'eskander.ragy@gmail.com' || (user?.role === 'servant' && (user?.status === 'approved' || user?.status === 'active'));

  const navItems = isLeader
    ? [
        {
          path: '/admin',
          label: 'إنجازات الأولاد 🏆',
          icon: ShieldAlert,
          match: ['/admin', '/']
        },
        {
          path: '/profile',
          label: 'ملفي الشخصي 👤',
          icon: User,
          match: ['/profile']
        }
      ]
    : [
        {
          path: '/dashboard',
          label: 'الرئيسية 📖',
          icon: BookOpen,
          match: ['/dashboard', '/']
        },
        {
          path: '/profile',
          label: 'ملفي وأوسمتي 🏆',
          icon: User,
          match: ['/profile']
        }
      ];

  const isActive = (paths: string[]) => {
    return paths.includes(location.pathname);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative text-white pb-16 sm:pb-0 font-sans">
      
      {/* Glow Background Elements */}
      <GlowBackground />

      {/* Elegant Top Header bar */}
      <header className="sticky top-0 z-40 bg-[#071426]/75 backdrop-blur-md border-b border-white/5 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-10 h-10 bg-gradient-to-tr from-[#0E3D75] to-[#F39C3D] rounded-xl flex items-center justify-center glow-orange border border-white/10">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
              <path d="M11 2h2v7h7v2h-7v11h-2v-11H4V9h7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide">دفتر صلاتي 📖</h1>
            <p className="text-[9px] text-[#B8C7E0]/70 font-semibold tracking-wider">تطبيق الكنيسة لتشجيع الصلاة اليومية</p>
          </div>
        </div>

        {/* Action Widgets in header */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Display current active streak in header only for kids */}
            {!isLeader && (
              <div className="hidden sm:flex items-center gap-1.5 bg-[#0E3D75]/60 border border-[#F39C3D]/30 py-1.5 px-3 rounded-xl text-xs font-black text-[#F39C3D]">
                <span>سلسلة الصلوات:</span>
                <span>{user.currentStreak} 🔥</span>
              </div>
            )}
            
            <Link 
              to="/profile"
              className="flex items-center gap-2 bg-[#0E3D75]/40 hover:bg-[#0E3D75]/80 border border-white/5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition duration-300"
            >
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`} 
                alt="الملف الشخصي" 
                className="w-5 h-5 rounded-md bg-[#071426] border border-white/10"
              />
              <span className="hidden md:inline">{user.name.split(' ')[0]}</span>
            </Link>
          </div>
        )}
      </header>

      {/* Main Screen Content container */}
      <main className="flex-grow w-full relative z-10 py-6">
        <Routes>
          <Route path="/" element={<Navigate to={isLeader ? "/admin" : "/dashboard"} replace />} />
          <Route path="/dashboard" element={isLeader ? <Navigate to="/admin" replace /> : <Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<LeaderDashboard />} />
          <Route path="*" element={<Navigate to={isLeader ? "/admin" : "/dashboard"} replace />} />
        </Routes>
      </main>

      {/* Mobile-optimized beautiful bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#071426]/90 border-t border-white/10 backdrop-blur-md px-4 py-2 flex justify-around sm:hidden">
        {navItems.map((item) => {
          const active = isActive(item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-300 gap-1 min-w-[70px] relative ${
                active ? 'text-[#F39C3D]' : 'text-[#B8C7E0]/60 hover:text-white'
              }`}
            >
              {active && (
                <motion.div 
                  layoutId="bottomNavGlow"
                  className="absolute inset-0 bg-[#0E3D75]/40 rounded-xl -z-10 border border-white/5"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              <span className="text-[10px] font-black">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Tablet & Desktop Sidebar layout or elegant horizontal navigation sub-header */}
      <nav className="hidden sm:flex justify-center bg-[#071426]/30 border-b border-t border-white/5 py-3 gap-6 relative z-30">
        {navItems.map((item) => {
          const active = isActive(item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative px-6 py-2 rounded-xl text-sm font-black flex items-center gap-2 duration-300 border transition-all ${
                active 
                  ? 'bg-[#0E3D75] text-white border-[#F39C3D]/30 shadow-md shadow-black/20' 
                  : 'text-[#B8C7E0] hover:text-white bg-transparent border-transparent hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="relative min-h-screen bg-[#071426]">
          <Routes>
            {/* Public Access login/signup page */}
            <Route path="/login" element={
              <div className="min-h-screen relative overflow-hidden bg-[#071426]">
                <GlowBackground />
                <Login />
              </div>
            } />
            
            {/* Protected Church Children Screens */}
            <Route path="/*" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}
