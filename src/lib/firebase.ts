// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCoCv7SlZ95quCGEfxBputIpx65GA_BYNI",
  authDomain: "vecsale-6ff3a.firebaseapp.com",
  databaseURL: "https://vecsale-6ff3a-default-rtdb.firebaseio.com",
  projectId: "vecsale-6ff3a",
  storageBucket: "vecsale-6ff3a.firebasestorage.app",
  messagingSenderId: "934764662043",
  appId: "1:934764662043:web:3e36cf8b6e0db5f7a997be",
  measurementId: "G-VBZPZYZJSF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
