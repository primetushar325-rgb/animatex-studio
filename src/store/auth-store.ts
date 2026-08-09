'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/client';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin: boolean;
  createdAt?: number;
  lastActiveAt?: number;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  initialize: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
  updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
}

// Helper to create/update user document in Firestore
async function createUserDocument(firebaseUser: User, additionalData?: { displayName?: string }) {
  try {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // New user - create document
      await setDoc(userRef, {
        email: firebaseUser.email,
        displayName: additionalData?.displayName || firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || '',
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        role: 'user',
        status: 'active',
        projectCount: 0,
        storageUsed: 0,
      });
    } else {
      // Existing user - update last active
      await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true });
    }
  } catch (err) {
    console.error('Error creating user document:', err);
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      error: null,
      initialized: false,

      initialize: () => {
        if (get().initialized) return;

        try {
          const auth = getFirebaseAuth();
          
          onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            if (firebaseUser) {
              // Get custom claims for admin status
              const tokenResult = await firebaseUser.getIdTokenResult();
              const isAdmin = tokenResult.claims.admin === true;

              const userProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                isAdmin,
              };

              // Update last active in Firestore
              await createUserDocument(firebaseUser);

              set({ user: userProfile, loading: false, initialized: true });
            } else {
              set({ user: null, loading: false, initialized: true });
            }
          });
        } catch {
          set({ loading: false, initialized: true });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const auth = getFirebaseAuth();
          await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
          const error = err as { code?: string; message?: string };
          let message = 'Failed to sign in';
          if (error.code === 'auth/user-not-found') {
            message = 'No account found with this email';
          } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = 'Incorrect password';
          } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address';
          } else if (error.code === 'auth/too-many-requests') {
            message = 'Too many failed attempts. Please try again later';
          }
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },

      signInWithGoogle: async () => {
        set({ loading: true, error: null });
        try {
          const auth = getFirebaseAuth();
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({
            prompt: 'select_account'
          });
          
          const result = await signInWithPopup(auth, provider);
          
          // Create/update user document
          await createUserDocument(result.user);
        } catch (err) {
          const error = err as { code?: string; message?: string };
          let message = 'Failed to sign in with Google';
          if (error.code === 'auth/popup-closed-by-user') {
            message = 'Sign in was cancelled';
          } else if (error.code === 'auth/popup-blocked') {
            message = 'Popup was blocked. Please allow popups for this site';
          }
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },

      signUp: async (email: string, password: string, displayName: string) => {
        set({ loading: true, error: null });
        try {
          const auth = getFirebaseAuth();
          
          const result = await createUserWithEmailAndPassword(auth, email, password);
          
          // Update display name
          await updateProfile(result.user, { displayName });

          // Create user document in Firestore
          await createUserDocument(result.user, { displayName });
        } catch (err) {
          const error = err as { code?: string; message?: string };
          let message = 'Failed to create account';
          if (error.code === 'auth/email-already-in-use') {
            message = 'An account with this email already exists';
          } else if (error.code === 'auth/weak-password') {
            message = 'Password should be at least 6 characters';
          } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address';
          }
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },

      logout: async () => {
        set({ loading: true, error: null });
        try {
          const auth = getFirebaseAuth();
          await signOut(auth);
          set({ user: null, loading: false });
        } catch (err) {
          const error = err as { message?: string };
          set({ error: error.message || 'Failed to log out', loading: false });
          throw err;
        }
      },

      resetPassword: async (email: string) => {
        set({ loading: true, error: null });
        try {
          const auth = getFirebaseAuth();
          await sendPasswordResetEmail(auth, email);
          set({ loading: false });
        } catch (err) {
          const error = err as { code?: string; message?: string };
          let message = 'Failed to send reset email';
          if (error.code === 'auth/user-not-found') {
            message = 'No account found with this email';
          }
          set({ error: message, loading: false });
          throw new Error(message);
        }
      },

      clearError: () => set({ error: null }),

      updateUserProfile: async (data) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');

        try {
          const auth = getFirebaseAuth();
          const currentUser = auth.currentUser;
          if (currentUser) {
            await updateProfile(currentUser, data);
            set({
              user: {
                ...user,
                displayName: data.displayName ?? user.displayName,
                photoURL: data.photoURL ?? user.photoURL,
              },
            });
          }
        } catch (err) {
          const error = err as { message?: string };
          set({ error: error.message || 'Failed to update profile' });
          throw err;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
