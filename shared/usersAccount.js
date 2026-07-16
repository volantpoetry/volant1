import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4DHI8aBVY4JjTvJ-r-TGIDPsewtEWxzU",
  authDomain: "silent-depth.firebaseapp.com",
  projectId: "silent-depth",
  storageBucket: "silent-depth.firebasestorage.app",
  messagingSenderId: "78008755450",
  appId: "1:78008755450:web:3fd0f0f298a08820935543",
  measurementId: "G-WSWDCB7KD8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence);

// ==================== PLATFORM DETECTION ====================
function getCurrentPlatform() {
  const currentFile = window.location.pathname.split('/').pop();
  if (currentFile.startsWith("store/')) {
    return 'reads';
  } else if (currentFile === 'parent-house.html") {
    return 'foundry';
  }
  return 'poetry';
}

const authUrlParams = new URLSearchParams(window.location.search);
const preservedRedirect = authUrlParams.get('redirect');
if (preservedRedirect) {
  localStorage.setItem('redirectAfterLogin', preservedRedirect);
}

export { auth, db, app };

// DIAGNOSTIC FUNCTION
async function forceCheckVerification(user) {
  console.log("🔍 FORCE CHECKING VERIFICATION FOR:", user.email);
  
  // Method 1: Force token refresh
  try {
    await user.getIdToken(true);
    console.log("✅ Token refreshed");
  } catch (e) {
    console.log("❌ Token refresh failed:", e);
  }
  
  // Method 2: Multiple reloads with longer delays
  for (let i = 0; i < 3; i++) {
    await user.reload();
    console.log(`Reload ${i+1}: emailVerified = ${user.emailVerified}`);
    await new Promise(r => setTimeout(r, 1500)); // Increased delay
  }
  
  // Method 3: Check Firestore
  const userDoc = await getDoc(doc(db, "users", user.uid));
  console.log("Firestore emailVerified:", userDoc.exists() ? userDoc.data().emailVerified : 'no doc');
  
  return user.emailVerified;
}

export function requireAuth() {
  return new Promise((resolve) => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const searchParams = window.location.search;
    const fullPath = currentPage + searchParams;
    const platform = getCurrentPlatform();
    
    if (auth.currentUser) {
      forceCheckVerification(auth.currentUser).then(isVerified => {
        if (!isVerified) {
          localStorage.setItem("pendingVerificationEmail", auth.currentUser.email);
          const params = new URLSearchParams();
          params.append('email', auth.currentUser.email);
          params.append('platform', platform);
          params.append('redirect', fullPath);
          window.location.href = `verify-email.html?${params.toString()}`;
          resolve(false);
          return;
        }
        resolve(true);
      });
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      
      if (!user) {
        localStorage.setItem("redirectAfterLogin", fullPath);
        const params = new URLSearchParams();
        params.append('platform', platform);
        params.append('redirect', encodeURIComponent(fullPath));
        window.location.href = `universal-login.html?${params.toString()}`;
        resolve(false);
      } else {
        const isVerified = await forceCheckVerification(user);
        if (!isVerified) {
          localStorage.setItem("pendingVerificationEmail", user.email);
          const params = new URLSearchParams();
          params.append('email', user.email);
          params.append('platform', platform);
          params.append('redirect', fullPath);
          window.location.href = `verify-email.html?${params.toString()}`;
          resolve(false);
          return;
        }
        resolve(true);
      }
    });
    
    setTimeout(() => {
      unsubscribe();
      if (!auth.currentUser) {
        localStorage.setItem("redirectAfterLogin", fullPath);
        const params = new URLSearchParams();
        params.append('platform', platform);
        params.append('redirect', encodeURIComponent(fullPath));
        window.location.href = `universal-login.html?${params.toString()}`;
        resolve(false);
      }
    }, 3000);
  });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signup-username").value.trim() || "Anonymous";
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const statusEl = document.getElementById("signup-status");

    try {
      const q = query(collection(db, "users"), where("username", "==", username));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        statusEl.textContent = "⚠ Username already taken.";
        return;
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      
      await setDoc(doc(db, "users", uid), {
        username,
        email,
        bio: "",
        joined: new Date(),
        emailVerified: false,
        createdAt: new Date().toISOString()
      });

      await sendEmailVerification(userCred.user, {
        url: window.location.origin + '/users-login.html',
        handleCodeInApp: true
      });

      localStorage.setItem("pendingVerificationEmail", email);
      await signOut(auth);
      
      statusEl.textContent = "✅ Verification email sent! Please check your inbox.";
      statusEl.style.color = "#2e7d32";

      const redirectFromSignup = localStorage.getItem('redirectAfterLogin');
      const redirectQuery = redirectFromSignup ? `&redirect=${encodeURIComponent(redirectFromSignup)}` : '';
      
      setTimeout(() => {
        window.location.href = "verify-email.html?email=" + encodeURIComponent(email) + redirectQuery;
      }, 2000);

    } catch (err) {
      statusEl.textContent = "⚠ " + err.message;
      statusEl.style.color = "#d32f2f";
    }
  });
}

// FIXED LOGIN FORM
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Get form elements
    const loginInput = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const statusEl = document.getElementById("login-status");
    const loginButton = e.target.querySelector('button[type="submit"]');
    
    // Disable button to prevent double submission
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'Checking...';
    }

    try {
      console.log("🔐 LOGIN ATTEMPT FOR:", loginInput);
      statusEl.textContent = "⏳ Checking credentials...";
      statusEl.style.color = "#1976d2";
      
      let emailToUse = loginInput;

      // If input is not email, search by username
      if (!loginInput.includes("@")) {
        console.log("Searching by username...");
        const q = query(collection(db, "users"), where("username", "==", loginInput));
        const querySnap = await getDocs(q);
        
        if (querySnap.empty) {
          statusEl.textContent = "⚠ No account found with that username.";
          statusEl.style.color = "#d32f2f";
          if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
          }
          return;
        }
        if (querySnap.size > 1) {
          statusEl.textContent = "⚠ Multiple accounts found with that username. Please login with your email instead.";
          statusEl.style.color = "#d32f2f";
          if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
          }
          return;
        }        
        emailToUse = querySnap.docs[0].data().email;
        console.log("Found email:", emailToUse);
      }

      // Sign in
      console.log("Attempting sign in...");
      const userCred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const user = userCred.user;
      
      console.log("✅ LOGIN SUCCESSFUL FOR:", user.email);
      console.log("📊 INITIAL emailVerified:", user.emailVerified);

      // CRITICAL: Force check verification like the test page does
      statusEl.textContent = "⏳ Verifying email status...";
      
      // Multiple reloads with delays
      for (let i = 0; i < 3; i++) {
        await user.reload();
        console.log(`Reload ${i+1}: emailVerified = ${user.emailVerified}`);
        await new Promise(r => setTimeout(r, 1500));
      }
      
      // Force token refresh
      try {
        await user.getIdToken(true);
        console.log("Token refreshed");
      } catch (e) {
        console.log("Token refresh failed:", e);
      }
      
      // Final reload
      await user.reload();
      
      const isVerified = user.emailVerified;
      console.log("📊 FINAL emailVerified AFTER CHECKS:", isVerified);

      if (!isVerified) {
        console.log("❌ EMAIL NOT VERIFIED - BLOCKING LOGIN");
        
        // Send new verification email
        await sendEmailVerification(user);
        
        // Sign out immediately
        await signOut(auth);
        
        // Store email for verification page
        localStorage.setItem("pendingVerificationEmail", user.email);
        
        statusEl.textContent = "⚠ Email not verified. A new verification email has been sent.";
        statusEl.style.color = "#f57c00";
        
        // Redirect to verification page
        setTimeout(() => {
          window.location.href = "verify-email.html?email=" + encodeURIComponent(user.email);
        }, 2000);
        return;
      }

      console.log("✅ EMAIL VERIFIED - ALLOWING LOGIN");
      
      // Update Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          username: user.displayName || "Anonymous",
          email: user.email,
          bio: "",
          joined: new Date(),
          emailVerified: true
        });
      } else {
        await updateDoc(userDocRef, { 
          emailVerified: true,
          lastLogin: new Date()
        });
      }

      statusEl.textContent = "✅ Login successful! Redirecting…";
      statusEl.style.color = "#2e7d32";
      
      // Get redirect URL
      const params = new URLSearchParams(window.location.search);
      let redirectUrl = params.get("redirect");
      
      if (!redirectUrl) {
        redirectUrl = localStorage.getItem("redirectAfterLogin");
      }
      
      if (!redirectUrl || 
          redirectUrl.includes("login") || 
          redirectUrl.includes("signup") || 
          redirectUrl.includes("reset") ||
          redirectUrl.includes("verify") ||
          redirectUrl === "null" ||
          redirectUrl === "undefined") {
        redirectUrl = "index.html";
      }

      // Clear stored data
      localStorage.removeItem("redirectAfterLogin");
      localStorage.removeItem("pendingVerificationEmail");

      setTimeout(() => { window.location.href = redirectUrl; }, 1200);

    } catch (err) {
      console.error("❌ LOGIN ERROR:", err);
      statusEl.textContent = "⚠ " + err.message;
      statusEl.style.color = "#d32f2f";
      
      // Re-enable button on error
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      }
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  console.log("🔄 AUTH STATE CHANGED:", user ? user.email : "No user");
  
  const currentPath = window.location.pathname;
  const currentPage = currentPath.split('/').pop();
  
  if (user) {
    // Reload user to get latest status
    await user.reload();
    const isVerified = user.emailVerified;
    console.log("📊 AUTH STATE - Verified:", isVerified);
    
    const publicPages = ['verify-email.html', 'users-login.html', 'users-signup.html', 'users-reset.html'];
    
    if (!isVerified && !publicPages.includes(currentPage)) {
      console.log("🚫 UNVERIFIED USER ON PROTECTED PAGE - SIGNING OUT");
      await signOut(auth);
      localStorage.setItem("pendingVerificationEmail", user.email);
      window.location.href = "verify-email.html?email=" + encodeURIComponent(user.email);
      return;
    }
    
    // Update UI
    const userInfoDiv = document.getElementById("user-info");
    const logoutBtn = document.getElementById("logoutBtn");

    if (userInfoDiv || logoutBtn) {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      let username = "Anonymous";
      if (docSnap.exists()) username = docSnap.data().username || "Anonymous";

      if (userInfoDiv) userInfoDiv.textContent = ` Welcome, ${username}`;
      if (logoutBtn) {
        logoutBtn.style.display = "inline-block";
        logoutBtn.onclick = logoutUser;
      }
    }
    
    const verifyBadge = document.getElementById("verify-badge");
    if (verifyBadge) {
      if (!isVerified) {
        verifyBadge.style.display = "inline-block";
        verifyBadge.innerHTML = ' <span style="color:orange; font-size:0.9rem;">(unverified)</span>';
      } else {
        verifyBadge.style.display = "none";
      }
    }
  } else {
    const userInfoDiv = document.getElementById("user-info");
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (userInfoDiv) userInfoDiv.textContent = "";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
});

function logoutUser() {
  signOut(auth).then(() => {
    localStorage.removeItem("redirectAfterLogin");
    localStorage.removeItem("pendingVerificationEmail");
    window.location.href = "users-login.html";
  }).catch(err => alert("Failed to log out: " + err.message));
}

window.logoutUser = logoutUser;