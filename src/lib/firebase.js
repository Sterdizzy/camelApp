import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase configuration  
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA1coOwxqfyQIAq_JLL1ATzEotkHAwKqpg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "camelapp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "camelapp",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "camelapp.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "371927109541",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:371927109541:web:5bc388bd683cf44323624c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app, 'camelapp');
export const functions = getFunctions(app);

export default app;