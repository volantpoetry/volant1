// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC4DHI8aBVY4JjTvJ-r-TGIDPsewtEWxzU",
  authDomain: "silent-depth.firebaseapp.com",
  projectId: "silent-depth",
  storageBucket: "silent-depth.firebasestorage.app",
  messagingSenderId: "78008755450",
  appId: "1:78008755450:web:3fd0f0f298a08820935543",
  measurementId: "G-WSWDCB7KD8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Hide admin content initially
document.addEventListener("DOMContentLoaded", () => {
  const adminContent = document.getElementById("admin-dashboard");
  if (adminContent) adminContent.style.display = "none";

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists()) {
          // Show admin content
          if (adminContent) adminContent.style.display = "block";
        } else {
          // Not an admin
          alert("Access denied. Admins only.");
          window.location.href = "admin-login.html";
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        window.location.href = "admin-login.html";
      }
    } else {
      // Not logged in
      window.location.href = "admin-login.html";
    }
  });
});
