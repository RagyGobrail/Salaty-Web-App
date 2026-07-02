import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInAnonymously as firebaseSignInAnonymously,
  signOut, 
  User as FirebaseUser,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { AppUser, PrayerLog } from '../types';
import { getLocalDateString, getYesterdayDateString } from '../utils/dateUtils';
import { sendServantSignupEmail } from '../utils/emailService';

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, isServant?: boolean) => Promise<void>;
  loginAnonymously: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  recordPrayerToday: () => Promise<{ success: boolean; newStreak: number; alreadyPrayed: boolean }>;
  refreshUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const registeringUid = useRef<string | null>(null);

  // Sync / check streak from loaded user
  const syncUserDoc = async (fUser: FirebaseUser, displayNameInput?: string, isServant?: boolean): Promise<AppUser> => {
    const userRef = doc(db, 'users', fUser.uid);
    const docSnap = await getDoc(userRef);
    const todayStr = getLocalDateString();
    const yesterdayStr = getYesterdayDateString(todayStr);

    let finalUser: AppUser;

    if (!docSnap.exists()) {
      // Determine if they should be admin based on email
      const email = fUser.email || '';
      const isAdminEmail = email.toLowerCase() === 'eskander.ragy@gmail.com';
      
      // We set status to "pending" for servants, or "active" for normal users/admins (never undefined)
      const newUserData = {
        uid: fUser.uid,
        name: displayNameInput || fUser.displayName || 'طفل صلاتي',
        email: email,
        photoURL: fUser.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${fUser.uid}`,
        currentStreak: 0,
        longestStreak: 0,
        totalPrayerDays: 0,
        lastPrayerDate: null,
        status: isServant ? 'pending' : 'active',
        createdAt: serverTimestamp(),
        role: isAdminEmail ? 'admin' : (isServant ? 'servant' : 'user')
      };
      
      // Before writing, remove any undefined fields to comply with Firestore rules and constraints
      const cleanedData = Object.fromEntries(
        Object.entries(newUserData).filter(([_, value]) => value !== undefined)
      );
      
      await setDoc(userRef, cleanedData, { merge: true });
      
      // Provide a clean client-side state mapping for the newly created user doc
      finalUser = {
        ...newUserData,
        status: newUserData.status as any,
        createdAt: new Date().toISOString() // Use a string ISO value for immediate client-side UI consumption
      } as AppUser;
    } else {
      const data = docSnap.data() as AppUser;
      
      // Check if streak is broken
      // If lastPrayerDate is not null, not today, and not yesterday, reset currentStreak to 0
      let updatedStreak = data.currentStreak || 0;
      if (data.lastPrayerDate && data.lastPrayerDate !== todayStr && data.lastPrayerDate !== yesterdayStr) {
        updatedStreak = 0;
        await updateDoc(userRef, { currentStreak: 0 });
      }
      
      // Fix authentication race conditions: if this function was called concurrently (e.g., from signup or onAuthStateChanged),
      // we must merge any missing or updated credentials (like custom names or servant status) into the document
      let needsUpdate = false;
      const updatedFields: Partial<AppUser> = {};

      if (displayNameInput && (!data.name || data.name === 'طفل صلاتي' || data.name !== displayNameInput)) {
        updatedFields.name = displayNameInput;
        needsUpdate = true;
      }
      if (isServant && data.role !== 'servant' && data.role !== 'admin') {
        updatedFields.role = 'servant';
        updatedFields.status = 'pending';
        needsUpdate = true;
      }

      if (needsUpdate) {
        const cleanedFields = Object.fromEntries(
          Object.entries(updatedFields).filter(([_, value]) => value !== undefined)
        );
        await updateDoc(userRef, cleanedFields);
      }
      
      finalUser = {
        status: data.status || 'active', // Default fallback status if undefined on historical doc
        ...data,
        ...updatedFields,
        currentStreak: updatedStreak,
        // Make sure admin gets updated role if needed
        role: (fUser.email?.toLowerCase() === 'eskander.ragy@gmail.com') ? 'admin' : (updatedFields.role || data.role || 'user')
      };
    }
    
    return finalUser;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // If we are currently registering/signing up this specific user, let the signUpWithEmail/loginAnonymously
        // trigger the initial sync and state set to avoid concurrent state and Firestore conflicts!
        if (registeringUid.current === fUser.uid) {
          return;
        }
        try {
          const appUser = await syncUserDoc(fUser);
          if (registeringUid.current !== fUser.uid) {
            setUser(appUser);
          }
        } catch (error) {
          console.error("Error syncing user document on auth state change:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      try {
        const appUser = await syncUserDoc(auth.currentUser);
        setUser(appUser);
      } catch (error) {
        console.error("Failed to refresh user:", error);
      }
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const appUser = await syncUserDoc(result.user);
      setUser(appUser);
    } catch (error) {
      console.error("Google login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const appUser = await syncUserDoc(result.user);
      setUser(appUser);
    } catch (error) {
      console.error("Email sign-in failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, isServant?: boolean) => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      // Set the registering ref immediately to lock onAuthStateChanged listener out of race condition syncs
      registeringUid.current = result.user.uid;
      
      // Update display name in firebase auth profile
      await updateProfile(result.user, { displayName: name });
      
      const appUser = await syncUserDoc(result.user, name, isServant);
      setUser(appUser);

      if (isServant) {
        // Send email notification to admin asynchronously
        sendServantSignupEmail(name, email).catch(err => {
          console.error("Failed to send servant registration email:", err);
        });
      }
    } catch (error) {
      console.error("Email signup failed:", error);
      throw error;
    } finally {
      registeringUid.current = null;
      setLoading(false);
    }
  };

  const loginAnonymously = async (name: string) => {
    setLoading(true);
    try {
      const result = await firebaseSignInAnonymously(auth);
      registeringUid.current = result.user.uid;
      
      await updateProfile(result.user, { displayName: name });
      const appUser = await syncUserDoc(result.user, name);
      setUser(appUser);
    } catch (error) {
      console.error("Anonymous login failed:", error);
      throw error;
    } finally {
      registeringUid.current = null;
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Password reset failed:", error);
      throw error;
    }
  };

  // Transaction-based prayer logging with robust streak management
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
          // Double guard
          return { success: false, newStreak: userData.currentStreak, alreadyPrayed: true };
        } else {
          // If they missed yesterday or it's their very first prayer
          newStreak = 1;
        }

        const newLongestStreak = Math.max(newStreak, userData.longestStreak || 0);
        const newTotalDays = (userData.totalPrayerDays || 0) + 1;

        // Log the prayer document inside transaction
        transaction.set(prayerRef, {
          id: `${user.uid}_${todayStr}`,
          uid: user.uid,
          date: todayStr,
          timestamp: new Date().toISOString()
        });

        // Update the user statistics inside transaction
        transaction.update(userRef, {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastPrayerDate: todayStr,
          totalPrayerDays: newTotalDays
        });

        return { success: true, newStreak, alreadyPrayed: false };
      });

      if (result.success) {
        // Update local user state immediately
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
      console.error("Error in recording prayer:", e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      loginAnonymously,
      logout,
      recordPrayerToday,
      refreshUser,
      resetPassword
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
