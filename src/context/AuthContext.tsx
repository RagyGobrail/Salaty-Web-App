/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppUser } from '../types';
import { getLocalDateString, getYesterdayDateString } from '../utils/dateUtils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('prayer_app_code'),
      email: null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Generate random code for Child, Servant or Admin
export const generateRandomCode = (prefix: 'MKD' | 'KHD' | 'ADM'): string => {
  const allowedChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No O, 0, I, 1 to prevent confusion
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += allowedChars.charAt(Math.floor(Math.random() * allowedChars.length));
  }
  return `${prefix}-${randomPart}`;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  hasNoAdmins: boolean;
  loginWithCode: (code: string) => Promise<{ success: boolean; isFirstLogin: boolean; role?: 'user' | 'servant' | 'admin'; user?: AppUser }>;
  completeRegistration: (code: string, name: string, grade?: 'تالتة' | 'رابعة' | 'خامسة' | 'سادسة') => Promise<AppUser>;
  setupFirstAdmin: (name: string, setupKey: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  recordPrayerToday: () => Promise<{ success: boolean; newStreak: number; alreadyPrayed: boolean }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNoAdmins, setHasNoAdmins] = useState(false);

  // Sync and load user from code
  const loadUserByCode = async (code: string): Promise<AppUser | null> => {
    try {
      const q = query(collection(db, 'users'), where('code', '==', code));
      const querySnap = await getDocs(q);
      
      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const data = userDoc.data() as AppUser;

        // Check and sync streak
        const todayStr = getLocalDateString();
        const yesterdayStr = getYesterdayDateString(todayStr);
        let updatedStreak = data.currentStreak || 0;
        
        if (data.lastPrayerDate && data.lastPrayerDate !== todayStr && data.lastPrayerDate !== yesterdayStr) {
          updatedStreak = 0;
          const userRef = doc(db, 'users', userDoc.id);
          await updateDoc(userRef, { currentStreak: 0 });
          data.currentStreak = 0;
        }

        return {
          ...data,
          currentStreak: updatedStreak
        };
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users_by_code_${code}`);
      return null;
    }
  };

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const storedCode = localStorage.getItem('prayer_app_code');
        if (storedCode) {
          const appUser = await loadUserByCode(storedCode);
          if (active) {
            if (appUser) {
              setUser(appUser);
            } else {
              localStorage.removeItem('prayer_app_code');
              setUser(null);
            }
          }
        } else {
          if (active) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (active) {
          setUser(null);
        }
      }

      // Check if there are no admin users in Firestore for the one-time admin setup screen
      try {
        const adminQuery = query(collection(db, 'users'), where('role', 'in', ['admin', 'superadmin']));
        const adminSnap = await getDocs(adminQuery);
        if (active) {
          setHasNoAdmins(adminSnap.empty);
        }
      } catch (err) {
        console.error("Failed to query admin status:", err);
      }

      if (active) {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      active = false;
    };
  }, []);

  const refreshUser = async () => {
    const storedCode = localStorage.getItem('prayer_app_code');
    if (storedCode) {
      const appUser = await loadUserByCode(storedCode);
      if (appUser) {
        setUser(appUser);
      }
    }
  };

  const loginWithCode = async (code: string): Promise<{ success: boolean; isFirstLogin: boolean; role?: 'user' | 'servant' | 'admin'; user?: AppUser }> => {
    setLoading(true);
    try {
      const formattedCode = code.trim().toUpperCase();
      if (!formattedCode) {
        throw new Error('يرجى إدخال كود تسجيل الدخول الخاص بك!');
      }

      const codeRef = doc(db, 'loginCodes', formattedCode);
      const codeSnap = await getDoc(codeRef);
      if (!codeSnap.exists()) {
        throw new Error('الكود غير صالح!');
      }
      const codeData = codeSnap.data();

      const q = query(collection(db, 'users'), where('code', '==', formattedCode));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        // Returning User!
        const userDoc = querySnap.docs[0];
        const data = userDoc.data() as AppUser;

        localStorage.setItem('prayer_app_code', formattedCode);

        const todayStr = getLocalDateString();
        const yesterdayStr = getYesterdayDateString(todayStr);
        let updatedStreak = data.currentStreak || 0;
        if (data.lastPrayerDate && data.lastPrayerDate !== todayStr && data.lastPrayerDate !== yesterdayStr) {
          updatedStreak = 0;
          const userRef = doc(db, 'users', userDoc.id);
          await updateDoc(userRef, { currentStreak: 0 });
          data.currentStreak = 0;
        }

        const finalUserObj: AppUser = {
          ...data,
          currentStreak: updatedStreak
        };

        setUser(finalUserObj);
        setLoading(false);

        return { success: true, isFirstLogin: false, role: data.role as any, user: finalUserObj };
      } else {
        const codeRole = codeData.role;
        setLoading(false);
        return { success: true, isFirstLogin: true, role: codeRole };
      }
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const completeRegistration = async (
    code: string,
    name: string,
    grade?: 'تالتة' | 'رابعة' | 'خامسة' | 'سادسة'
  ): Promise<AppUser> => {
    if (!name.trim()) {
      throw new Error('يرجى إدخال اسمك بالكامل لإنشاء ملفك الشخصي!');
    }
    const formattedCode = code.trim().toUpperCase();

    setLoading(true);
    try {
      const codeRef = doc(db, 'loginCodes', formattedCode);
      const codeSnap = await getDoc(codeRef);
      if (!codeSnap.exists()) {
        throw new Error('الكود غير صالح!');
      }
      const codeData = codeSnap.data();
      if (codeData.isUsed) {
        throw new Error('هذا الكود تم استخدامه من قبل!');
      }

      const newUid = 'usr_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const role = codeData.role === 'user' ? 'user' : (codeData.role === 'servant' ? 'servant' : 'admin');
      const userRef = doc(db, 'users', newUid);

      const newUserData: AppUser = {
        uid: newUid,
        name: name.trim(),
        email: '',
        photoURL: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${newUid}`,
        currentStreak: 0,
        longestStreak: 0,
        totalPrayerDays: 0,
        lastPrayerDate: null,
        status: role === 'servant' ? 'approved' : 'active',
        createdAt: serverTimestamp(),
        role: role,
        code: formattedCode
      };

      if (grade && (role === 'user' || role === 'servant')) {
        newUserData.grade = grade;
      }

      await setDoc(userRef, newUserData);

      await updateDoc(codeRef, {
        isUsed: true,
        usedBy: newUid,
        usedAt: serverTimestamp()
      });

      localStorage.setItem('prayer_app_code', formattedCode);

      const loadedUser: AppUser = {
        ...newUserData,
        createdAt: new Date().toISOString()
      };

      setUser(loadedUser);
      setLoading(false);

      return loadedUser;
    } catch (error: any) {
      setLoading(false);
      handleFirestoreError(error, OperationType.WRITE, `users_registration_${code}`);
      throw error;
    }
  };

  const setupFirstAdmin = async (name: string, setupKey: string): Promise<AppUser> => {
    if (!name.trim() || !setupKey.trim()) {
      throw new Error('يرجى ملء جميع الحقول المطلوبة!');
    }
    const correctKey = import.meta.env.VITE_ADMIN_SETUP_KEY || 'church-admin-123';
    if (setupKey !== correctKey) {
      throw new Error('مفتاح الإعداد السري غير صحيح!');
    }

    setLoading(true);
    try {
      const firstAdminCode = generateRandomCode('ADM');

      const newUid = 'usr_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const userRef = doc(db, 'users', newUid);

      const adminData: AppUser = {
        uid: newUid,
        name: name.trim(),
        email: 'eskander.ragy@gmail.com',
        photoURL: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${newUid}`,
        currentStreak: 0,
        longestStreak: 0,
        totalPrayerDays: 0,
        lastPrayerDate: null,
        status: 'active',
        createdAt: serverTimestamp(),
        role: 'superadmin' as const,
        code: firstAdminCode
      };

      await setDoc(userRef, adminData);

      await setDoc(doc(db, 'loginCodes', firstAdminCode), {
        code: firstAdminCode,
        role: 'admin',
        isUsed: true,
        usedBy: newUid,
        createdAt: serverTimestamp(),
        usedAt: serverTimestamp()
      });

      localStorage.setItem('prayer_app_code', firstAdminCode);

      const loadedAdmin: AppUser = {
        ...adminData,
        createdAt: new Date().toISOString()
      };

      setUser(loadedAdmin);
      setHasNoAdmins(false);
      setLoading(false);

      return loadedAdmin;
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('prayer_app_code');
      setUser(null);
      window.location.hash = '#/login';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const recordPrayerToday = async (): Promise<{ success: boolean; newStreak: number; alreadyPrayed: boolean }> => {
    if (!user) throw new Error("مستخدم غير مسجل الدخول");

    const todayStr = getLocalDateString();
    const yesterdayStr = getYesterdayDateString(todayStr);
    
    const userRef = doc(db, 'users', user.uid);
    const prayerRef = doc(db, 'userPrayers', `${user.uid}_${todayStr}`);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const prayerDoc = await transaction.get(prayerRef);
        
        if (prayerDoc.exists()) {
          return { success: false, newStreak: user.currentStreak, alreadyPrayed: true };
        }

        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("ملف المستخدم غير موجود");
        }

        const userData = userDoc.data() as AppUser;
        const lastDate = userData.lastPrayerDate;
        
        let newStreak = 1;
        if (lastDate === yesterdayStr) {
          newStreak = userData.currentStreak + 1;
        } else if (lastDate === todayStr) {
          return { success: false, newStreak: userData.currentStreak, alreadyPrayed: true };
        } else {
          newStreak = 1;
        }

        const newLongestStreak = Math.max(newStreak, userData.longestStreak || 0);
        const newTotalDays = (userData.totalPrayerDays || 0) + 1;

        transaction.set(prayerRef, {
          id: `${user.uid}_${todayStr}`,
          uid: user.uid,
          date: todayStr,
          timestamp: new Date().toISOString()
        });

        transaction.update(userRef, {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastPrayerDate: todayStr,
          totalPrayerDays: newTotalDays
        });

        return { success: true, newStreak, alreadyPrayed: false };
      });

      if (result.success) {
        setUser(prev => prev ? {
          ...prev,
          currentStreak: result.newStreak,
          longestStreak: Math.max(result.newStreak, prev.longestStreak),
          lastPrayerDate: todayStr,
          totalPrayerDays: prev.totalPrayerDays + 1
        } : null);
      }

      return result;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `userPrayers/${user.uid}_${todayStr}`);
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      hasNoAdmins,
      loginWithCode,
      completeRegistration,
      setupFirstAdmin,
      logout,
      recordPrayerToday,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
