// ============================================================
// JOURNAL DEL REY — Trading Pro Lab
// CONFIGURACIÓN FIREBASE
// ============================================================
// INSTRUCCIONES:
// 1. Ve a https://console.firebase.google.com
// 2. Crea un proyecto llamado "journal-del-rey"
// 3. Activa Authentication > Email/Password
// 4. Crea una base de datos Firestore
// 5. Activa Storage
// 6. En Configuración del proyecto > Apps web, copia tus credenciales aquí
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// UID del admin (tú, Williams)
// Después de hacer login por primera vez, ve a Firebase Console > Authentication
// y copia tu UID aquí para tener acceso al panel de admin
const ADMIN_UID = "TU_UID_AQUI";

// Nombre de la app
const APP_NAME = "Journal del Rey";
const APP_BRAND = "Trading Pro Lab";

// ============================================================
// NO MODIFICAR DEBAJO DE ESTA LÍNEA
// ============================================================

// Inicializar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================
// ESTRUCTURA FIRESTORE:
//
// /users/{uid}
//   email, displayName, role ("user"|"admin"), createdAt, active
//
// /allowedEmails/{docId}
//   email, addedAt, addedBy, active
//
// /users/{uid}/accounts/{accountId}
//   name, size, type ("fondeo"|"personal"), strategy,
//   goalPct, winrateExpected, createdAt, currency
//
// /users/{uid}/accounts/{accountId}/trades/{tradeId}
//   ...todos los campos del journal
//   createdAt, timestamp
// ============================================================

export { auth, db, storage, ADMIN_UID, APP_NAME, APP_BRAND, FIREBASE_CONFIG };
export { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged };
export { doc, setDoc, getDoc, getDocs, collection, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, ref, uploadBytes, getDownloadURL, deleteObject };
