import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

const apiKey: string | undefined = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain: string | undefined = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId: string | undefined = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket: string | undefined = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId: string | undefined = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId: string | undefined = import.meta.env.VITE_FIREBASE_APP_ID;

// Check if we have the minimum required keys to initialize Firebase

let db: Firestore | null = null;

if (apiKey && projectId && appId) {
  try {
    const firebaseConfig: FirebaseOptions = {
      apiKey,
      projectId,
      appId,
      ...(authDomain ? { authDomain } : {}),
      ...(storageBucket ? { storageBucket } : {}),
      ...(messagingSenderId ? { messagingSenderId } : {}),
    };

    // Initialize Firebase
    const existingApps = getApps();
    const app = existingApps[0] ?? initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase Cloud Firestore initialized successfully!");
  } catch (error: unknown) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.warn(
    "Firebase environment variables are missing. Doom editor will fall back to using localStorage exclusively. " +
    "To enable database storage, create a .env file based on .env.example."
  );
}

export { db };
