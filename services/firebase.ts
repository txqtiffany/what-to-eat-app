import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingKeys.length > 0) {
  console.error(
    'Firebase config is incomplete. Missing env vars: ' +
      missingKeys.map(k => 'FIREBASE_' + k.replace(/[A-Z]/g, m => '_' + m).toUpperCase()).join(', ') +
      '. Copy .env.example to .env.local and fill in values from the Firebase console.'
  );
}

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(firebaseApp);
// `ignoreUndefinedProperties` lets us pass Dish objects straight to setDoc
// without first stripping optional fields (dishType, tips, nutrition, etc.)
// that Gemini may omit. Firestore would otherwise reject the whole write.
export const db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
export const storage = getStorage(firebaseApp);
