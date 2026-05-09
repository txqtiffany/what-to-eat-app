import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();

export const authService = {
  signInWithGoogle: async (): Promise<User> => {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  signOut: async (): Promise<void> => {
    await firebaseSignOut(auth);
  },

  onAuthChanged: (cb: (user: User | null) => void): (() => void) => {
    return onAuthStateChanged(auth, cb);
  },

  currentUser: (): User | null => auth.currentUser
};

export type { User };
