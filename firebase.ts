import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAieoY_nzVR2id4vtDAE6R19azq7KC928g",
  authDomain: "myjeju-292cb.firebaseapp.com",
  projectId: "myjeju-292cb",
  storageBucket: "myjeju-292cb.firebasestorage.app",
  messagingSenderId: "374353569802",
  appId: "1:374353569802:web:f567b01a5bec70651017f3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);