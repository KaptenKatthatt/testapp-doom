import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { initializeFirestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { getAuth } from "firebase/auth";

const apiKey: string | undefined = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain: string | undefined = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId: string | undefined = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket: string | undefined = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId: string | undefined = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId: string | undefined = import.meta.env.VITE_FIREBASE_APP_ID;

// Check if we have the minimum required keys to initialize Firebase

let db: Firestore | null = null;
let auth: Auth | null = null;

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
    
    // Enable long polling to prevent timeouts in networks/browsers that block gRPC/WebSockets
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
    auth = getAuth(app);
    console.log("Firebase Cloud Firestore & Auth initialized successfully!");
  } catch (error: unknown) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.warn(
    "Firebase environment variables are missing. Doom editor will fall back to using localStorage exclusively. " +
    "To enable database storage, create a .env file based on .env.example."
  );
}

export { db, auth };

