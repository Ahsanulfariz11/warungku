/* ============================================================
   FIREBASE CONFIG — Kredensial Firebase & Fallback Check
   ============================================================ */

// Ganti placeholder di bawah ini dengan konfigurasi proyek Firebase Anda!
// Anda bisa mendapatkan konfigurasi ini dari Firebase Console -> Project Settings -> General -> Web Apps.
const firebaseConfig = {
  apiKey: "AIzaSyDd4Swe7OrJkEJFDbwm4aeXqR9Q7iINhnM",
  authDomain: "warungku-248cd.firebaseapp.com",
  databaseURL: "https://warungku-248cd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "warungku-248cd",
  storageBucket: "warungku-248cd.firebasestorage.app",
  messagingSenderId: "1068914290141",
  appId: "1:1068914290141:web:767bf8dd39173fad67da34",
  measurementId: "G-BH3BR28XE0"
};

/**
 * Cek apakah konfigurasi Firebase sudah diisi oleh pengguna
 * @returns {boolean}
 */
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "YOUR_API_KEY" && 
         firebaseConfig.projectId && 
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

window.firebaseConfig = firebaseConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
