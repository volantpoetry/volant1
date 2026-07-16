import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
  getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc, where,
  enableIndexedDbPersistence, startAfter, updateDoc, setDoc, increment, addDoc, arrayUnion,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC4DHI8aBVY4JjTvJ-r-TGIDPsewtEWxzU",
  authDomain: "silent-depth.firebaseapp.com",
  projectId: "silent-depth",
  storageBucket: "silent-depth.appspot.com",
  messagingSenderId: "78008755450",
  appId: "1:78008755450:web:3fd0f0f298a08820935543"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// ============================================
// PERFECT READ COUNT TRACKING CONFIGURATION
// ============================================
// ============================================
// PERFECT READ COUNT TRACKING CONFIGURATION
// ============================================
const READ_TRACKING_KEY = 'poem_read_tracking';
const READ_TIMEOUT_MINUTES = 30;     // Don't count again for 30 minutes
const READ_DELAY_SECONDS = 8;         // 8 seconds - Perfect balance for genuine reads
const VIEW_THRESHOLD = 0.6;           // 60% of poem must be visible (not just a glimpse)

// Track active timers for each poem
const activeTimers = new Map();
const viewStartTimes = new Map();     // Track when user started viewing

// Get read tracking from sessionStorage
function getReadTracking() {
  const stored = sessionStorage.getItem(READ_TRACKING_KEY);
  if (!stored) return {};
  
  try {
    const tracking = JSON.parse(stored);
    const now = Date.now();
    const cleaned = {};
    for (const [poemId, timestamp] of Object.entries(tracking)) {
      if (now - timestamp < READ_TIMEOUT_MINUTES * 60 * 1000) {
        cleaned[poemId] = timestamp;
      }
    }
    return cleaned;
  } catch (e) {
    return {};
  }
}

// Save read tracking to sessionStorage
function saveReadTracking(tracking) {
  try {
    sessionStorage.setItem(READ_TRACKING_KEY, JSON.stringify(tracking));
  } catch (e) {
    // Silent fail
  }
}

// Check if poem was recently read
function wasRecentlyRead(poemId) {
  const tracking = getReadTracking();
  const now = Date.now();
  return tracking[poemId] && (now - tracking[poemId] < READ_TIMEOUT_MINUTES * 60 * 1000);
}

// Actually record the view to Firebase
async function recordViewToFirebase(poemId) {
  // Double check before recording
  if (wasRecentlyRead(poemId)) {
    return false;
  }
  
  try {
    const poemRef = doc(db, "recentPoems", poemId);
    await updateDoc(poemRef, {
      views: increment(1)
    });
    
    // Update session storage
    const tracking = getReadTracking();
    tracking[poemId] = Date.now();
    saveReadTracking(tracking);
    
    // Update the view count on the card if it exists
    const card = document.querySelector(`.recent-poem-card[data-id="${poemId}"]`);
    if (card) {
      let viewCountSpan = card.querySelector('.view-count-inline');
      if (!viewCountSpan) viewCountSpan = card.querySelector('.view-count');
      if (!viewCountSpan) viewCountSpan = card.querySelector('.read-count');
      
      if (viewCountSpan) {
        const currentText = viewCountSpan.textContent;
        const match = currentText.match(/\d+/);
        if (match) {
          const currentCount = parseInt(match[0]);
          const newCount = currentCount + 1;
          
          if (currentText.includes('👁️')) {
            viewCountSpan.innerHTML = `👁️ ${newCount} ${newCount === 1 ? 'read' : 'reads'}`;
          } else if (currentText.includes('reads')) {
            viewCountSpan.textContent = `${newCount} reads`;
          } else {
            viewCountSpan.textContent = `${newCount}`;
          }
          
          viewCountSpan.style.transition = 'all 0.3s ease';
          viewCountSpan.style.color = '#4CAF50';
          viewCountSpan.style.transform = 'scale(1.1)';
          setTimeout(() => {
            viewCountSpan.style.color = '#888';
            viewCountSpan.style.transform = 'scale(1)';
          }, 1000);
        }
      }
    }
    
    return true;
  } catch (err) {
    // Silent fail
    return false;
  }
}

// Start tracking a poem when it becomes visible
function startTrackingPoem(poemId) {
  if (!poemId) return;
  
  // Check if already counted recently
  if (wasRecentlyRead(poemId)) {
    return;
  }
  
  // Check if timer already exists
  if (activeTimers.has(poemId)) {
    return;
  }
  
  // Record when user started viewing
  viewStartTimes.set(poemId, Date.now());
  
  // Set timer to record view after 8 seconds
  const timer = setTimeout(async () => {
    // Check if user actually viewed for full duration
    const viewDuration = Date.now() - (viewStartTimes.get(poemId) || Date.now());
    
    if (!wasRecentlyRead(poemId)) {
      if (viewDuration >= READ_DELAY_SECONDS * 1000) {
        await recordViewToFirebase(poemId);
      }
    }
    
    // Clean up
    activeTimers.delete(poemId);
    viewStartTimes.delete(poemId);
  }, READ_DELAY_SECONDS * 1000);
  
  activeTimers.set(poemId, timer);
}

// Stop tracking a poem (user scrolled away before required time)
function stopTrackingPoem(poemId) {
  if (!poemId) return;
  
  const timer = activeTimers.get(poemId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(poemId);
    viewStartTimes.delete(poemId);
  }
}

// Setup Intersection Observer for view tracking (silent version)
function setupReadTracking() {
  if (!window.IntersectionObserver) {
    return;
  }
  
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const card = entry.target;
      const poemId = card.dataset.id;
      
      if (!poemId) continue;
      
      // Poem is visible enough (60% or more in viewport)
      if (entry.isIntersecting && entry.intersectionRatio >= VIEW_THRESHOLD) {
        startTrackingPoem(poemId);
      } 
      // Poem is not visible enough (below 60%)
      else {
        stopTrackingPoem(poemId);
      }
    }
  }, {
    threshold: [0, VIEW_THRESHOLD],
    rootMargin: "0px"
  });
  
  // Observe existing and future poem cards
  function observePoemCards() {
    const cards = document.querySelectorAll('.recent-poem-card:not([data-read-tracked])');
    cards.forEach(card => {
      card.setAttribute('data-read-tracked', 'true');
      observer.observe(card);
    });
  }
  
  // Initial observation
  observePoemCards();
  
  // Watch for dynamically added cards anywhere on the page
  const mutationObserver = new MutationObserver(() => {
    observePoemCards();
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

// Initialize tracking when page loads (silent)
document.addEventListener("DOMContentLoaded", () => {
  setupReadTracking();
});

// ============================================
// RENCE BLUNT FILTER - UID for filtering
// ============================================
const RENCE_BLUNT_UID = "1Ou084CsNaf115Jw4NcTomVyPOZ2";

// Helper function to check if a poem is by Rence Blunt
function isRenceBluntPoem(poemData) {
  return poemData.userId === RENCE_BLUNT_UID || 
         poemData.authorId === RENCE_BLUNT_UID || 
         poemData.submittedBy === RENCE_BLUNT_UID ||
         poemData.author === "Rence Blunt" ||
         poemData.authorName === "Rence Blunt";
}

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// --- Truncate helper function ---
function truncatePoem(text, lines = 8) {
  if (!text || typeof text !== 'string') {
    return { preview: '', full: '', truncated: false };
  }
  const allLines = text.split(/\r?\n/);
  if (allLines.length <= lines) {
    return { preview: text, full: text, truncated: false };
  }
  return {
    preview: allLines.slice(0, lines).join("\n"),
    full: text,
    truncated: true
  };
}

// Track pagination
let lastVisible = null;
let reachedEnd = false;

// Helper function to detect current platform
function getCurrentPlatform() {
  const currentFile = window.location.pathname.split('/').pop();
  if (currentFile.startsWith('store/')) {
    return 'reads';
  } else if (currentFile === 'parent-house.html') {
    return 'foundry';
  }
  return 'poetry';
}

// Helper function to redirect to login with return URL
function redirectToLogin() {
  const currentPage = window.location.href;
  const platform = getCurrentPlatform();
  localStorage.setItem('redirectAfterLogin', currentPage);
  window.location.href = `universal-login.html?platform=${platform}&redirect=${encodeURIComponent(currentPage)}`;
}

// Helper function to redirect to signup with return URL
function redirectToSignup() {
  const currentPage = window.location.href;
  const platform = getCurrentPlatform();
  localStorage.setItem('redirectAfterSignup', currentPage);
  window.location.href = `universal-signup.html?platform=${platform}&redirect=${encodeURIComponent(currentPage)}`;
}

// --- Structured Data Injection for SEO ---
function addPoemSchema(poem) {
  document.querySelectorAll('script[type="application/ld+json"].poem-schema').forEach(el => el.remove());
  const schema = {
    "@context": "https://schema.org",
    "@type": "Poem",
    "name": poem.title,
    "author": { "@type": "Person", "name": "Rence Blunt" },
    "publisher": { "@type": "Organization", "name": "Volate Poetry", "url": "https://renceblunt.github.io" },
    "inLanguage": "en",
    "url": `https://renceblunt.github.io/poems/${poem.slug || poem.title.toLowerCase().replace(/\s+/g, "-")}`,
    "datePublished": poem.date || "2025-01-01",
    "description": poem.description || "A poem from Volate Poetry by Rence Blunt."
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.classList.add("poem-schema");
  script.textContent = JSON.stringify(schema, null, 2);
  document.head.appendChild(script);
}

// --- Weekly Highlights ---
// Helper function to get UID from username
async function getUidByUsername(username) {
  if (!username) return null;
  
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
  } catch (err) {
    console.warn("Could not find user by username:", err);
  }
  return null;
}

// --- Weekly Highlights ---
async function loadWeeklyHighlights() {
  try {
    // Load Quote of the Week (works on both pages)
    const quoteSnap = await getDoc(doc(db, "weeklyHighlights", "weeklyQuote"));
    if (quoteSnap.exists()) {
      const data = quoteSnap.data();
      const quoteHTML = data.quote.replace(/\n/g, "<br>");
      
      const quoteElement = document.getElementById("weekly-quote");
      const authorElement = document.getElementById("quote-author");
      
      if (quoteElement) {
        quoteElement.innerHTML = `<em>“${quoteHTML}”</em>`;
      }
      
      if (authorElement && data.author) {
        const authorName = data.author;
        const userUid = await getUidByUsername(authorName);
        const profileLink = userUid ? `/user-profile.html?uid=${encodeURIComponent(userUid)}` : "#";
        const authorLink = `<a href="${profileLink}" style="color: #B8860B; text-decoration:none; cursor:pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(authorName)}</a>`;
        authorElement.innerHTML = `<br>~ ${authorLink}`;
      } else if (authorElement) {
        authorElement.innerHTML = "";
      }
    }

    // Load Poem of the Week
    const poemContainer = document.getElementById("weekly-poem");
    const poemAuthor = document.getElementById("poem-author");
    const poemTitle = document.getElementById("poem-title");
    
    if (poemContainer && poemTitle) {
      const poemSnap = await getDoc(doc(db, "weeklyHighlights", "weeklyPoem"));
      if (poemSnap.exists()) {
        const data = poemSnap.data();
        const title = data.title || "Untitled";
        const author = data.author || "";
        const content = data.content || "";
        const lines = content.split("\n");
        const firstPart = lines.slice(0, 8).join("<br>");
        const restPart = lines.slice(8).join("<br>");
        
        poemTitle.innerHTML = `<h3 class="poem-title">${escapeHtml(title)}</h3>`;
        
        const wrapperId = "poem-wrapper";
        poemContainer.innerHTML = `
          <div id="${wrapperId}">
            <div class="poem-text">
              <span class="first-lines">${firstPart}</span>
              <span class="more-lines" style="display:none;">${restPart ? "<br>" + restPart : ""}</span>
            </div>
            ${lines.length > 8 ? '<button class="toggle-poem">Read more</button>' : ""}
          </div>
        `;
        
        if (poemAuthor && author) {
          const userUid = await getUidByUsername(author);
          const profileLink = userUid ? `/user-profile.html?uid=${encodeURIComponent(userUid)}` : "#";
          const authorLink = `<a href="${profileLink}" style="color: #B8860B; text-decoration:none; cursor:pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(author)}</a>`;
          poemAuthor.innerHTML = `<hr class="poem-separator"><div class="poem-author">~ ${authorLink}</div>`;
        } else if (poemAuthor) {
          poemAuthor.innerHTML = "";
        }

        if (lines.length > 8) {
          const wrapper = document.getElementById(wrapperId);
          if (wrapper) {
            const toggleBtn = wrapper.querySelector(".toggle-poem");
            const moreLines = wrapper.querySelector(".more-lines");
            if (toggleBtn && moreLines) {
              toggleBtn.addEventListener("click", () => {
                const isHidden = moreLines.style.display === "none";
                moreLines.style.display = isHidden ? "inline" : "none";
                toggleBtn.textContent = isHidden ? "Read less" : "Read more";
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching weekly highlights:", err);
  }
}

// --- Recent Poems with Pagination ---
let loading = false;
const batchSize = 10;
let allPoemsCache = [];
let currentIndex = 0;
let currentUserId = null;
let followStates = new Map();

// Function to check if current user follows a poet
async function checkFollowStatus(poetId, currentUid) {
  if (!currentUid || !poetId || currentUid === poetId) return false;
  if (followStates.has(poetId)) return followStates.get(poetId);
  
  try {
    const docId = `${currentUid}_${poetId}`;
    const followRef = doc(db, "social", docId);
    const docSnap = await getDoc(followRef);
    const isFollowing = docSnap.exists();
    followStates.set(poetId, isFollowing);
    return isFollowing;
  } catch (err) {
    console.warn("Error checking follow status:", err);
    return false;
  }
}

// Function to send notification (ADDED)
async function sendNotification(forUserId, fromUserId, type, data) {
  if (!forUserId || !fromUserId || forUserId === fromUserId) return;
  
  try {
    const userDoc = await getDoc(doc(db, "users", fromUserId));
    const fromUserName = userDoc.exists() ? userDoc.data().username : "Someone";
    
    const notification = {
      forUser: forUserId,
      fromUser: fromUserId,
      fromUserName: fromUserName,
      type: type,
      timestamp: serverTimestamp(),
      read: false
    };
    
    if (type === 'like' || type === 'comment') {
      notification.poemId = data.poemId;
      notification.poemTitle = data.poemTitle;
    }
    if (type === 'comment') {
      notification.commentText = data.commentText;
    }
    if (type === 'reply') {
      notification.commentId = data.commentId;
      notification.replyText = data.replyText;
      notification.poemId = data.poemId;
    }
    
    await addDoc(collection(db, "notifications"), notification);
  } catch (err) {
    console.warn("Error sending notification:", err);
  }
}

// Function to handle follow/unfollow (UPDATED with notification)
async function handleFollowFromPoem(poetId, buttonElement) {
  if (!currentUserId || !poetId || currentUserId === poetId) return;
  
  try {
    const docId = `${currentUserId}_${poetId}`;
    const followRef = doc(db, "social", docId);
    const docSnap = await getDoc(followRef);
    const batch = writeBatch(db);
    
    if (docSnap.exists()) {
      batch.delete(followRef);
      batch.update(doc(db, "users", poetId), { followerCount: increment(-1) });
      batch.update(doc(db, "users", currentUserId), { followingCount: increment(-1) });
      await batch.commit();
      followStates.set(poetId, false);
      buttonElement.textContent = "Follow";
      buttonElement.classList.remove("following");
      buttonElement.style.background = "#4CAF50";
    } else {
      batch.set(followRef, { followerId: currentUserId, followedId: poetId, createdAt: serverTimestamp() });
      batch.update(doc(db, "users", poetId), { followerCount: increment(1) });
      batch.update(doc(db, "users", currentUserId), { followingCount: increment(1) });
      await batch.commit();
      followStates.set(poetId, true);
      buttonElement.textContent = "Following";
      buttonElement.classList.add("following");
      buttonElement.style.background = "#f44336";
      
      // Send follow notification
      await sendNotification(poetId, currentUserId, 'follow', {});
    }
  } catch (err) {
    console.error("Error handling follow:", err);
  }
}


async function loadPoemsBatch() {
  if (loading || reachedEnd) return;
  loading = true;

  const container = document.getElementById("recent-poems-container");
  if (!container) {
    loading = false;
    return;
  }

  try {
    if (allPoemsCache.length === 0) {
      const colRef = collection(db, "recentPoems");
      const snapshot = await getDocs(colRef);
      
      const poems = [];
      for (const docSnap of snapshot.docs) {
        const poem = docSnap.data();
        poems.push({
          id: docSnap.id,
          ...poem,
          timestamp: poem.timestamp?.toMillis?.() || 0
        });
      }
      
      poems.sort((a, b) => b.timestamp - a.timestamp);
      allPoemsCache = poems;
    }
    
    if (allPoemsCache.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:60px 20px; color:#7a6a5a;">📜 No poems yet. Be the first to share!</div>';
      reachedEnd = true;
      loading = false;
      return;
    }
    
    const start = currentIndex;
    const end = Math.min(start + batchSize, allPoemsCache.length);
    
    if (start >= allPoemsCache.length) {
      reachedEnd = true;
      loading = false;
      return;
    }
    
    const batch = allPoemsCache.slice(start, end);
    
    for (const poem of batch) {
      const docId = poem.id;
      const card = document.createElement("div");
      card.className = "recent-poem-card";
      card.dataset.id = docId;

      const truncated = truncatePoem(poem.content, 8);
      const likes = typeof poem.likes === "number" ? poem.likes : 0;
      const viewCount = typeof poem.views === "number" ? poem.views : 0;

      // Helper functions for avatar
      function getInitials(name = "") {
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }

      function colorFromName(name = "") {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 60%, 45%)`;
      }

      function generateAvatarImage(initials, bgColor, size = 180) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#ffffff";
        ctx.font = `${size * 0.5}px 'Playfair Display', serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, size / 2, size / 2);
        return new Promise(resolve => {
          canvas.toBlob(blob => resolve(blob), "image/png");
        });
      }

      async function uploadAvatarToCloudinary(initials, bgColor, poetUid, publicId = null) {
        const blob = await generateAvatarImage(initials, bgColor);
        const formData = new FormData();
        formData.append("file", blob);
        formData.append("upload_preset", "profile_pics");
        if (publicId) formData.append("public_id", publicId);
        const cloudName = "dzoq4pgjn";
        try {
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          const imageUrl = data.secure_url;
          await updateDoc(doc(db, "users", poetUid), { cachedAvatarURL: imageUrl });
          return imageUrl;
        } catch (err) {
          console.error("Cloudinary upload failed:", err);
          return null;
        }
      }
      
      // Author info
      const poetUid = poem.authorId;
      let displayName = "Anonymous Poet";
      let profileLink = "#";
      let profileImage = "/images/default-avatar.png";
      let isFollowing = false;

      if (poetUid) {
        try {
          const userDoc = await getDoc(doc(db, "users", poetUid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            displayName = userData.username || displayName;
            profileLink = `/user-profile.html?uid=${encodeURIComponent(poetUid)}`;
            if (userData.photoURL) {
              profileImage = userData.photoURL;
            } else if (userData.cachedAvatarURL) {
              profileImage = userData.cachedAvatarURL;
            } else {
              const initials = getInitials(displayName);
              const bgColor = colorFromName(displayName);
              const url = await uploadAvatarToCloudinary(initials, bgColor, poetUid);
              if (url) profileImage = url;
            }
          }
          if (currentUserId && currentUserId !== poetUid) {
            isFollowing = await checkFollowStatus(poetUid, currentUserId);
          }
        } catch (err) {
          console.warn("Failed to fetch user info:", err);
        }
      }

      // Collaborators info
      let collaboratorsHTML = "";
      if (Array.isArray(poem.collaborators) && poem.collaborators.length > 0) {
        try {
          const collaboratorLinks = [];
          for (const collaborator of poem.collaborators) {
            if (!collaborator.uid) continue;
            let collabName = collaborator.username || "Unknown";
            let collabLink = "#";
            const collabDoc = await getDoc(doc(db, "users", collaborator.uid));
            if (collabDoc.exists()) {
              const collabData = collabDoc.data();
              collabName = collabData.username || collabName;
              collabLink = `/user-profile.html?uid=${encodeURIComponent(collaborator.uid)}`;
            }
            collaboratorLinks.push(`<a href="${collabLink}" class="collaborator-link">${collabName}</a>`);
          }
          if (collaboratorLinks.length) {
            collaboratorsHTML = `<div class="collaborator-line" style="margin-top:4px; font-size:0.95rem; color:#555;"><em>Co-written with ${collaboratorLinks.join(", ")}</em></div>`;
          }
        } catch (err) {
          console.warn("Failed to fetch collaborators:", err);
        }
      }

      // Audio section
      let audioHTML = '';
      if (poem.audioUrl) {
        audioHTML = `<div class="poem-audio-section" style="margin: 15px 0 15px 0 !important; padding: 8px 12px !important; background: #f0ede8; border-radius: 12px; width: fit-content; max-width: 45%; min-width: 240px; clear: both;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;"><span style="font-size: 0.75rem; color: #4b2aad; font-weight: 600;">🎙️ Spoken Version</span></div><audio controls style="width: 100%; border-radius: 8px; height: 35px;" preload="metadata"><source src="${poem.audioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio></div>`;
      }

      // Follow button
      const followButtonHTML = (currentUserId && currentUserId !== poetUid && poetUid) 
        ? `<button class="follow-btn-on-card ${isFollowing ? 'following' : ''}" data-poet-id="${poetUid}" style="background: ${isFollowing ? '#f44336' : '#4CAF50'}; color: white; border: none; border-radius: 20px; padding: 4px 12px; cursor: pointer; font-size: 12px; margin-left: auto; transition: all 0.2s;">${isFollowing ? 'Following' : 'Follow'}</button>`
        : '';

      // MAIN POEM CARD HTML WITH VIEW COUNT
card.innerHTML = `
  <div class="author-line" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:2px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <img src="${profileImage}" alt="${displayName}" class="author-img" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
      <div class="author-info">
        <a href="${profileLink}" class="author-link" style="font-size:1.2rem; font-weight:700;">${displayName}</a>
        <div class="follow-button-container" style="margin-top: 4px;">
          ${followButtonHTML}
        </div>
      </div>
    </div>
    <span class="view-count-inline" style="font-size:0.85rem; color:#333;">${viewCount} Reads</span>
  </div>
  ${collaboratorsHTML}
  <h3 class="recent-poem-title" style="margin-top:12px;">${poem.title || "Untitled"}</h3>
  <p class="poem-content" style="white-space:pre-wrap; margin-top:8px; margin-left:0; padding-left:0;">${truncated.preview.trim()}</p>
  ${truncated.truncated ? `<button class="read-more-btn">Read More</button>` : ""}
  ${audioHTML}
  ${poem.categories?.length ? `<p class="poem-category-line"><em>${poem.categories.map(cat => `<a href="category.html?name=${encodeURIComponent(cat)}" class="category-link">${cat}</a>`).join(", ")}</em></p>` : ""}
  
  <div class="poem-actions">
    <div class="comment-section">
      <textarea class="comment-input" placeholder="Write a comment..." rows="1"></textarea>
      <button class="comment-btn">Post</button>
    </div>
    <button class="like-btn">❤️</button>
    <span class="like-count">${likes}</span>
    <span class="message-count">💬</span>
  </div>
`;

      container.appendChild(card);

      // Add comment list
      const commentListDiv = document.createElement("div");
      commentListDiv.className = "comment-list";
      commentListDiv.style.display = "none";
      container.appendChild(commentListDiv);

      // Read More toggle
      if (truncated.truncated) {
        const btn = card.querySelector(".read-more-btn");
        const p = card.querySelector(".poem-content");
        btn.addEventListener("click", () => {
          if (btn.textContent === "Read More") {
            p.textContent = truncated.full;
            btn.textContent = "Show Less";
          } else {
            p.textContent = truncated.preview;
            btn.textContent = "Read More";
          }
        });
      }

      // Count comments
      const commentsCol = collection(db, "recentPoems", docId, "comments");
      const commentsSnapshot = await getDocs(commentsCol);
      const msgSpan = card.querySelector(".message-count");
      if (msgSpan) msgSpan.textContent = `💬 ${commentsSnapshot.size}`;

      // Auto-resize comment box
      const textarea = card.querySelector(".comment-input");
      if (textarea) {
        textarea.addEventListener("input", () => {
          textarea.style.height = "auto";
          textarea.style.height = textarea.scrollHeight + "px";
        });
      }
    }
    
    // Attach follow button event listeners
    document.querySelectorAll('.follow-btn-on-card').forEach(btn => {
      const poetId = btn.dataset.poetId;
      btn.removeEventListener('click', btn._followHandler);
      btn._followHandler = async (e) => {
        e.stopPropagation();
        await handleFollowFromPoem(poetId, btn);
      };
      btn.addEventListener('click', btn._followHandler);
    });

    currentIndex = end;
    if (currentIndex >= allPoemsCache.length) reachedEnd = true;
    loading = false;
    
    if (container.children.length === 0 && allPoemsCache.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:60px 20px; color:#7a6a5a;">Fetching poems...</div>';
    }
  } catch (err) {
    console.error("Error fetching poems:", err);
    loading = false;
  }
}

// Helper function to get comment list
function getCommentList(card) {
  if (!card) return null;
  const nextSibling = card.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains("comment-list")) return nextSibling;
  return null;
}

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    allPoemsCache = [];
    currentIndex = 0;
    reachedEnd = false;
    const container = document.getElementById("recent-poems-container");
    if (container) container.innerHTML = '';
    loadPoemsBatch();
  } else {
    currentUserId = null;
    followStates.clear();
    allPoemsCache = [];
    currentIndex = 0;
    reachedEnd = false;
    const container = document.getElementById("recent-poems-container");
    if (container) container.innerHTML = '';
    loadPoemsBatch();
  }

  const rankingContainer = document.getElementById("rank-poems");
  if (rankingContainer) {
    loadRankingPoemsRich();
  }
});

// Load first batch
window.addEventListener("DOMContentLoaded", () => {
  loadPoemsBatch();
});

// Infinite scroll listener
window.addEventListener("scroll", () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
    loadPoemsBatch();
  }
});

// --- Offline Notice ---
function setupOfflineNotice() {
  window.addEventListener("offline", () => {
    const notice = document.createElement("div");
    notice.textContent = "⚠ You are offline. Viewing cached content.";
    notice.className = "offline-notice";
    document.body.prepend(notice);
  });
  window.addEventListener("online", () => {
    document.querySelectorAll(".offline-notice").forEach(el => el.remove());
  });
}

// --- Auth Navbar ---
onAuthStateChanged(auth, async (user) => {
  const profileLink = document.getElementById("profile-link");
  let userDisplay = document.getElementById("user-display");
  if (!userDisplay) {
    userDisplay = document.createElement("div");
    userDisplay.id = "user-display";
    userDisplay.className = "user-dropdown";
    if (profileLink && profileLink.parentNode) {
      profileLink.parentNode.insertBefore(userDisplay, profileLink);
      profileLink.style.display = "none";
    }
  }

  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    let username = user.email;
    if (docSnap.exists()) username = docSnap.data().username || user.email;
    if (userDisplay) {
      userDisplay.innerHTML = `<span class="username"> ${username}</span><div class="dropdown-content"><a href="#" id="logout-link">Logout</a></div>`;
    }
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.onclick = async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.reload();
      };
    }
  } else {
    if (profileLink) profileLink.style.display = "inline-block";
    if (userDisplay) userDisplay.remove();
  }
});

// --- Like / Comment / Reply Handler with Notifications ---
document.addEventListener("click", async (e) => {
  const user = auth.currentUser;

  // LIKE / UNLIKE with notification
  if (e.target.classList.contains("like-btn")) {
    if (!user) { 
      redirectToLogin();
      return; 
    }
    const card = e.target.closest(".recent-poem-card");
    if (!card) return;
    const docId = card.dataset.id;
    const countSpan = card.querySelector(".like-count");
    const poemRef = doc(db, "recentPoems", docId);

    try {
      const docSnap = await getDoc(poemRef);
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
      let likes = typeof data.likes === "number" ? data.likes : 0;
      const poemOwnerId = data.userId || data.authorId || null;

      if (likedBy.includes(user.uid)) {
        if (likes > 0) await updateDoc(poemRef, { likes: increment(-1), likedBy: likedBy.filter(uid => uid !== user.uid) });
        countSpan.textContent = likes - 1;
        e.target.classList.remove("liked");
      } else {
        await updateDoc(poemRef, { likes: increment(1), likedBy: arrayUnion(user.uid) });
        countSpan.textContent = likes + 1;
        e.target.classList.add("liked");
        
        // Send like notification
        await sendNotification(poemOwnerId, user.uid, 'like', {
          poemId: docId,
          poemTitle: data.title || "Untitled"
        });
      }
    } catch (err) { console.error("Error updating like:", err); }
  }

  // COMMENT POST with notification
  if (e.target.classList.contains("comment-btn")) {
    if (!user) { 
      redirectToLogin();
      return; 
    }

    const card = e.target.closest(".recent-poem-card");
    if (!card) return;
    const docId = card.dataset.id;
    const input = card.querySelector(".comment-input");
    const commentList = getCommentList(card);
    const text = input.value.trim();
    if (!text) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let username = "Anonymous";
      if (userDoc.exists()) username = userDoc.data().username || user.email;

      const newCommentRef = await addDoc(collection(db, "recentPoems", docId, "comments"), {
        userId: user.uid,
        username: username,
        text,
        timestamp: serverTimestamp()
      });

      const div = document.createElement("div");
      div.className = "comment";
      div.dataset.commentId = newCommentRef.id;
      div.dataset.userId = user.uid;
      div.style.cssText = "background:#f0f0f0; padding:8px 12px; margin:6px 0; border-radius:6px;";
      div.innerHTML = `
        <a href="user-profile.html?uid=${encodeURIComponent(user.uid)}" class="comment-author-link" style="font-weight:600; color:#5a3cb3; text-decoration:none;">${escapeHtml(username)}</a>: ${escapeHtml(text)}
        <div><small class="reply-toggle" style="color:#5a3cb3; cursor:pointer;">Reply</small></div>
        <div class="reply-section" style="margin-left:20px; margin-top:5px;"></div>
      `;

      if (commentList) commentList.prepend(div);
      input.value = "";
      input.style.height = "auto";

      const commentsSnapshot = await getDocs(collection(db, "recentPoems", docId, "comments"));
      const commentCount = commentsSnapshot.size;
      card.querySelector(".message-count").textContent = `💬 ${commentCount}`;

      const poemRef = doc(db, "recentPoems", docId);
      const poemSnap = await getDoc(poemRef);
      if (poemSnap.exists()) {
        const poemData = poemSnap.data();
        const poemOwnerId = poemData.userId || poemData.authorId || null;
        if (poemOwnerId && poemOwnerId !== user.uid) {
          // Send comment notification
          await sendNotification(poemOwnerId, user.uid, 'comment', {
            poemId: docId,
            poemTitle: poemData.title || "Untitled",
            commentText: text
          });
        }
      }
    } catch (err) {
      console.error("Error posting comment:", err);
      alert("Failed to post comment. Please try again.");
    }
  }
  
  // SHOW COMMENTS WITH REPLIES
  if (e.target.classList.contains("message-count")) {
    e.preventDefault();
    e.stopPropagation();
    
    const card = e.target.closest(".recent-poem-card");
    if (!card) return;
    const docId = card.dataset.id;
    const commentList = getCommentList(card);
    if (!commentList) return;
    
    const isVisible = commentList.style.display === "block";
    commentList.style.display = isVisible ? "none" : "block";
    if (isVisible) return;

    commentList.innerHTML = "<p style='color:#888;'>Loading comments...</p>";

    try {
      const commentsCol = collection(db, "recentPoems", docId, "comments");
      const commentsSnapshot = await getDocs(query(commentsCol, orderBy("timestamp", "asc")));
      commentList.innerHTML = "";
      
      if (commentsSnapshot.empty) {
        commentList.innerHTML = "<p style='color:#888;'>No comments yet. Be the first!</p>";
        return;
      }

      for (const docSnap of commentsSnapshot.docs) {
        const comment = docSnap.data();
        const div = document.createElement("div");
        div.className = "comment";
        div.dataset.commentId = docSnap.id;
        div.dataset.userId = comment.userId || "";
        div.style.cssText = "background:#fff; padding:8px 12px; margin:6px 0; border-radius:6px; border:1px solid #eee;";
        
        const usernameLink = comment.userId 
          ? `<a href="/user-profile.html?uid=${encodeURIComponent(comment.userId)}" style="font-weight:600; color:#5a3cb3; text-decoration:none; cursor:pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(comment.username || "Anonymous")}</a>`
          : `<span style="font-weight:600; color:#5a3cb3;">${escapeHtml(comment.username || "Anonymous")}</span>`;
        
        div.innerHTML = `
          ${usernameLink}: ${escapeHtml(comment.text)}
          <div><small class="reply-toggle" style="color:#5a3cb3; cursor:pointer;">Reply</small></div>
          <div class="reply-section" style="margin-left:20px; margin-top:5px;"></div>
        `;
        commentList.appendChild(div);
        
        // LOAD EXISTING REPLIES
        try {
          const repliesCol = collection(db, "recentPoems", docId, "comments", docSnap.id, "replies");
          const repliesSnapshot = await getDocs(query(repliesCol, orderBy("timestamp", "asc")));
          if (!repliesSnapshot.empty) {
            const replySection = div.querySelector(".reply-section");
            repliesSnapshot.forEach(replyDoc => {
              const reply = replyDoc.data();
              const replyUsernameLink = reply.userId
                ? `<a href="/user-profile.html?uid=${encodeURIComponent(reply.userId)}" style="font-weight:600; color:#B8860B; text-decoration:none; cursor:pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(reply.username)}</a>`
                : `<span style="font-weight:600; color:#B8860B;">${escapeHtml(reply.username)}</span>`;
              
              const replyDiv = document.createElement("div");
              replyDiv.style.cssText = "background:#f7f7f7; padding:6px 10px; margin:4px 0; border-radius:6px; font-size:0.9rem;";
              replyDiv.setAttribute('data-reply-id', replyDoc.id);
              replyDiv.innerHTML = `${replyUsernameLink}: ${escapeHtml(reply.text)}`;
              replySection.appendChild(replyDiv);
            });
          }
        } catch (replyErr) {
          console.error("Error loading replies:", replyErr);
        }
      }
    } catch (err) {
      console.error("Error loading comments:", err);
      commentList.innerHTML = "<p style='color:red;'>Error loading comments.</p>";
    }
  }

  // REPLY TOGGLE - SHOW INPUT FORM
  if (e.target.classList.contains("reply-toggle")) {
    e.preventDefault();
    e.stopPropagation();
    
    const commentDiv = e.target.closest(".comment");
    if (!commentDiv) return;
    
    const replySection = commentDiv.querySelector(".reply-section");
    if (!replySection) return;

    // Remove existing reply input if any
    const existing = replySection.querySelector(".reply-input");
    if (existing) {
      existing.remove();
      return;
    }

    // Create reply input form
    const inputContainer = document.createElement("div");
    inputContainer.className = "reply-input";
    inputContainer.style.marginTop = "8px";
    inputContainer.innerHTML = `
      <textarea placeholder="Write a reply..." rows="2" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc; font-family:inherit; resize:vertical;"></textarea>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="send-reply-btn" style="background:#5a3cb3; color:white; border:none; border-radius:6px; padding:6px 12px; cursor:pointer;">Send Reply</button>
        <button class="cancel-reply-btn" style="background:#ccc; color:#333; border:none; border-radius:6px; padding:6px 12px; cursor:pointer;">Cancel</button>
      </div>
    `;
    replySection.appendChild(inputContainer);
    
    const textarea = inputContainer.querySelector("textarea");
    if (textarea) textarea.focus();
    
    const cancelBtn = inputContainer.querySelector(".cancel-reply-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", (cancelEvent) => {
        cancelEvent.preventDefault();
        cancelEvent.stopPropagation();
        inputContainer.remove();
      });
    }
  }

  // SEND REPLY with notification
  if (e.target.classList.contains("send-reply-btn")) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!auth.currentUser) { 
      alert("Please sign in to reply."); 
      redirectToLogin();
      return; 
    }

    const user = auth.currentUser;
    const sendBtn = e.target;
    const originalText = sendBtn.textContent;
    
    sendBtn.textContent = "Sending...";
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.6";

    try {
      const commentDiv = e.target.closest(".comment");
      if (!commentDiv) throw new Error("Could not find comment");
      
      let card = commentDiv.closest(".recent-poem-card");
      if (!card) {
        const commentList = commentDiv.closest(".comment-list");
        if (commentList) {
          card = commentList.previousElementSibling;
          while (card && !card.classList.contains("recent-poem-card")) {
            card = card.previousElementSibling;
          }
        }
      }
      if (!card) throw new Error("Could not find poem card");
      
      const docId = card.dataset.id;
      const commentId = commentDiv.dataset.commentId;
      if (!docId || !commentId) throw new Error("Missing comment or poem ID");
      
      const replyInputDiv = commentDiv.querySelector(".reply-input");
      if (!replyInputDiv) throw new Error("Reply input not found");
      
      const textarea = replyInputDiv.querySelector("textarea");
      if (!textarea) throw new Error("Textarea not found");
      
      const replyText = textarea.value.trim();
      if (!replyText) throw new Error("Please enter a reply");
      
      const replySection = commentDiv.querySelector(".reply-section");
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.exists() ? userDoc.data().username || user.email.split('@')[0] : "User";

      const repliesRef = collection(db, "recentPoems", docId, "comments", commentId, "replies");
      const replyDoc = await addDoc(repliesRef, {
        userId: user.uid,
        username: username,
        text: replyText,
        timestamp: serverTimestamp()
      });

      // Get comment owner for notification
      const commentDoc = await getDoc(doc(db, "recentPoems", docId, "comments", commentId));
      const commentOwnerId = commentDoc.exists() ? commentDoc.data().userId : null;
      
      const poemDoc = await getDoc(doc(db, "recentPoems", docId));
      const poemTitle = poemDoc.exists() ? poemDoc.data().title : "Untitled";

      // Send reply notification
      if (commentOwnerId && commentOwnerId !== user.uid) {
        await sendNotification(commentOwnerId, user.uid, 'reply', {
          poemId: docId,
          poemTitle: poemTitle,
          commentId: commentId,
          replyText: replyText
        });
      }

      const replyUsernameLink = `<a href="/user-profile.html?uid=${encodeURIComponent(user.uid)}"
                                   style="font-weight:600; color:#B8860B; text-decoration:none; cursor:pointer;"
                                   onmouseover="this.style.textDecoration='underline'"
                                   onmouseout="this.style.textDecoration='none'">
                                   ${escapeHtml(username)}
                                 </a>`;

      const replyDiv = document.createElement("div");
      replyDiv.style.cssText = "background:#f7f7f7; padding:6px 10px; margin:4px 0; border-radius:6px; font-size:0.9rem;";
      replyDiv.setAttribute('data-reply-id', replyDoc.id);
      replyDiv.innerHTML = `${replyUsernameLink}: ${escapeHtml(replyText)}`;
      
      if (replyInputDiv) {
        replySection.insertBefore(replyDiv, replyInputDiv);
      } else {
        replySection.appendChild(replyDiv);
      }
      
      textarea.value = "";
      replyInputDiv.remove();
      
      const tempMsg = document.createElement("div");
      tempMsg.style.cssText = "color:green; font-size:12px; margin-top:5px;";
      tempMsg.textContent = "✓ Reply posted!";
      replySection.appendChild(tempMsg);
      setTimeout(() => tempMsg.remove(), 2000);
      
    } catch (err) {
      console.error("Error sending reply:", err);
      alert(err.message || "Failed to send reply. Please try again.");
    } finally {
      sendBtn.textContent = originalText;
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  }
});

// --- DOM Initialization & Tabs ---
document.addEventListener("DOMContentLoaded", () => {
  setupOfflineNotice();

  const faders = document.querySelectorAll('.fade-in');
  window.addEventListener('scroll', () => {
    faders.forEach(fader => {
      const rect = fader.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100) fader.classList.add('visible');
    });
  });

  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  function activateTab(tabId) {
    tabBtns.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(tabId);
    if (activeBtn && activeContent) {
      activeBtn.classList.add("active");
      activeContent.classList.add("active");
      localStorage.setItem("activeTab", tabId);
    }
  }

  const lastTab = localStorage.getItem("activeTab");
  if (lastTab) activateTab(lastTab);
  else activateTab("recent");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
});

// Username display and logout
const usernameDisplay = document.getElementById("username-display");
const usernameDisplaySm = document.getElementById("username-display-sm");
const logoutBtn = document.getElementById("logout-btn");
const logoutBtnMobile = document.getElementById("logout-btn-mobile");
const loginLink = document.getElementById("login-link");

onAuthStateChanged(auth, async (user) => {
  if (!usernameDisplay || !usernameDisplaySm) return;
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const username = userDoc.exists() ? userDoc.data().username : "Anonymous";
    usernameDisplay.textContent = username;
    usernameDisplaySm.textContent = username;
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtnMobile) {
      logoutBtnMobile.onclick = async () => {
        await signOut(auth);
        window.location.href = "index.html";
      };
    }
  } else {
    usernameDisplay.textContent = "";
    usernameDisplaySm.textContent = "";
    if (loginLink) loginLink.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (logoutBtnMobile) logoutBtnMobile.style.display = "none";
  }
});

// ============================================
// UNIVERSAL SEARCH - FIRESTORE INTEGRATION
// Displays results directly in the existing poems container
// ============================================

let universalSearchDebounceTimer = null;
let isUniversalSearching = false;

// Search users from Firestore
async function searchAllUsers(searchTerm) {
  const users = [];
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    
    for (const docSnap of snapshot.docs) {
      const user = docSnap.data();
      const username = (user.username || "").toLowerCase();
      if (username.includes(searchTerm)) {
        let poemCount = 0;
        try {
          const poemsQuery = query(collection(db, "recentPoems"), where("authorId", "==", docSnap.id));
          const poemsSnap = await getDocs(poemsQuery);
          poemCount = poemsSnap.size;
        } catch(e) {}
        
        users.push({
          id: docSnap.id,
          username: user.username || "Anonymous",
          photoURL: user.photoURL || user.cachedAvatarURL || "/images/default-avatar.png",
          poemCount: poemCount,
          followerCount: user.followerCount || 0,
          bio: user.bio || ""
        });
      }
    }
    return users.slice(0, 10);
  } catch(err) {
    console.error("Error searching users:", err);
    return [];
  }
}

// Search all poems from Firestore
async function searchAllPoems(searchTerm) {
  const poems = [];
  try {
    const poemsRef = collection(db, "recentPoems");
    const snapshot = await getDocs(poemsRef);
    
    for (const docSnap of snapshot.docs) {
      const poem = docSnap.data();
      const title = (poem.title || "").toLowerCase();
      const content = (poem.content || "").toLowerCase();
      const author = (poem.author || "").toLowerCase();
      
      if (title.includes(searchTerm) || content.includes(searchTerm) || author.includes(searchTerm)) {
        let authorName = poem.author || "Anonymous";
        let authorId = poem.authorId || poem.userId || null;
        let authorPhoto = "/images/default-avatar.png";
        
        if (authorId) {
          try {
            const userDoc = await getDoc(doc(db, "users", authorId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              authorName = userData.username || authorName;
              authorPhoto = userData.photoURL || userData.cachedAvatarURL || "/images/default-avatar.png";
            }
          } catch(e) {}
        }
        
        poems.push({
          id: docSnap.id,
          title: poem.title || "Untitled",
          content: poem.content || "",
          author: authorName,
          authorId: authorId,
          authorPhoto: authorPhoto,
          views: poem.views || 0,
          likes: poem.likes || 0,
          categories: poem.categories || [],
          audioUrl: poem.audioUrl || null,
          timestamp: poem.timestamp?.toDate() || new Date(),
          userId: poem.userId || poem.authorId,
          likedBy: poem.likedBy || [],
          collaborators: poem.collaborators || []
        });
      }
    }
    
    // Sort by relevance
    poems.sort((a, b) => {
      const aTitleMatch = (a.title || "").toLowerCase().includes(searchTerm);
      const bTitleMatch = (b.title || "").toLowerCase().includes(searchTerm);
      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;
      return (b.views || 0) - (a.views || 0);
    });
    
    return poems.slice(0, 30);
  } catch(err) {
    console.error("Error searching poems:", err);
    return [];
  }
}

// Search categories
async function searchAllCategories(searchTerm) {
  const categoriesMap = new Map();
  try {
    const poemsRef = collection(db, "recentPoems");
    const snapshot = await getDocs(poemsRef);
    
    for (const docSnap of snapshot.docs) {
      const poem = docSnap.data();
      const poemCategories = poem.categories || [];
      for (const cat of poemCategories) {
        if (cat && cat.toLowerCase().includes(searchTerm)) {
          categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + 1);
        }
      }
    }
    
    return Array.from(categoriesMap.entries()).map(([name, count]) => ({ name, count })).slice(0, 15);
  } catch(err) {
    console.error("Error searching categories:", err);
    return [];
  }
}

// Display search results directly in the recent poems container
async function displaySearchResults(poems, users, categories, searchTerm) {
  const container = document.getElementById("recent-poems-container");
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Add search header
  const searchHeader = document.createElement('div');
  searchHeader.style.cssText = `
    background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    text-align: center;
  `;
  searchHeader.innerHTML = `
    <h3 style="color: #4b2aad; margin: 0 0 10px 0;">🔍 Search Results for "${escapeHtml(searchTerm)}"</h3>
    <p style="color: #666; margin: 0;">Found ${poems.length} poems, ${users.length} users, ${categories.length} categories</p>
    <button id="clear-search-results" style="margin-top: 10px; background: #4b2aad; color: white; border: none; padding: 6px 16px; border-radius: 20px; cursor: pointer;">Clear Search</button>
  `;
  container.appendChild(searchHeader);
  
  // Users Section
  if (users.length > 0) {
    const usersSection = document.createElement('div');
    usersSection.style.cssText = `
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f7f4;
      border-radius: 16px;
    `;
    usersSection.innerHTML = `<h4 style="color: #4b2aad; margin: 0 0 15px 0;">👥 Users & Authors (${users.length})</h4>`;
    
    for (const user of users) {
      const userCard = document.createElement('div');
      userCard.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 12px;
        background: white;
        border-radius: 12px;
        margin-bottom: 10px;
        transition: all 0.2s;
        cursor: pointer;
      `;
      userCard.onmouseover = () => userCard.style.transform = 'translateX(5px)';
      userCard.onmouseout = () => userCard.style.transform = 'translateX(0)';
      userCard.onclick = () => window.location.href = `user-profile.html?uid=${encodeURIComponent(user.id)}`;
      
      userCard.innerHTML = `
        <img src="${user.photoURL}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
        <div style="flex: 1;">
          <strong style="font-size: 16px;">@${escapeHtml(user.username)}</strong>
          ${user.bio ? `<p style="font-size: 12px; color: #666; margin-top: 4px;">${escapeHtml(user.bio.substring(0, 80))}${user.bio.length > 80 ? '...' : ''}</p>` : ''}
          <div style="font-size: 12px; color: #999; margin-top: 4px;">📝 ${user.poemCount} poems · 👥 ${user.followerCount} followers</div>
        </div>
        <span style="color: #4b2aad;">→</span>
      `;
      usersSection.appendChild(userCard);
    }
    container.appendChild(usersSection);
  }
  
  // Categories Section
  if (categories.length > 0) {
    const categoriesSection = document.createElement('div');
    categoriesSection.style.cssText = `
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f7f4;
      border-radius: 16px;
    `;
    categoriesSection.innerHTML = `<h4 style="color: #4b2aad; margin: 0 0 15px 0;">🏷️ Categories (${categories.length})</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">`;
    
    for (const cat of categories) {
      const catLink = document.createElement('a');
      catLink.href = `category.html?name=${encodeURIComponent(cat.name)}`;
      catLink.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 20px;
        border-radius: 25px;
        text-decoration: none;
        font-size: 14px;
        transition: all 0.2s;
      `;
      catLink.onmouseover = () => catLink.style.transform = 'scale(1.05)';
      catLink.onmouseout = () => catLink.style.transform = 'scale(1)';
      catLink.textContent = `${cat.name} (${cat.count})`;
      categoriesSection.querySelector('div').appendChild(catLink);
    }
    categoriesSection.innerHTML += `</div>`;
    container.appendChild(categoriesSection);
  }
  
  // Poems Section - Using your existing card design
  if (poems.length > 0) {
    const poemsSection = document.createElement('div');
    poemsSection.innerHTML = `<h4 style="color: #4b2aad; margin: 0 0 15px 0;">📖 Poems (${poems.length})</h4>`;
    
    for (const poem of poems) {
      const cardHTML = await createPoemCardFromSearch(poem);
      poemsSection.insertAdjacentHTML('beforeend', cardHTML);
    }
    container.appendChild(poemsSection);
    
    // Attach event listeners to the newly created poem cards
    attachSearchResultEventListeners();
  }
  
  // If no results
  if (poems.length === 0 && users.length === 0 && categories.length === 0) {
    container.innerHTML += `
      <div style="text-align: center; padding: 60px 20px; color: #999;">
        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
        <p>No results found for "${escapeHtml(searchTerm)}"</p>
        <p style="font-size: 14px;">Try different keywords or browse our categories</p>
      </div>
    `;
  }
  
  // Clear search button
  document.getElementById('clear-search-results')?.addEventListener('click', () => {
    // Reload original poems
    allPoemsCache = [];
    currentIndex = 0;
    reachedEnd = false;
    container.innerHTML = '';
    loadPoemsBatch();
  });
}

// Create poem card for search results (uses your existing design)
async function createPoemCardFromSearch(poem) {
  const truncated = truncatePoem(poem.content, 8);
  const likes = poem.likes;
  const viewCount = poem.views;
  
  let userLiked = false;
  if (currentUserId && poem.likedBy && poem.likedBy.includes(currentUserId)) {
    userLiked = true;
  }
  
  let isFollowing = false;
  if (currentUserId && poem.authorId && currentUserId !== poem.authorId) {
    isFollowing = await checkFollowStatus(poem.authorId, currentUserId);
  }
  
  // Collaborators HTML
  let collaboratorsHTML = "";
  if (Array.isArray(poem.collaborators) && poem.collaborators.length > 0) {
    const collaboratorLinks = [];
    for (const collaborator of poem.collaborators) {
      if (!collaborator.uid) continue;
      let collabName = collaborator.username || "Unknown";
      collaboratorLinks.push(`<a href="/user-profile.html?uid=${encodeURIComponent(collaborator.uid)}" class="collaborator-link">${escapeHtml(collabName)}</a>`);
    }
    if (collaboratorLinks.length) {
      collaboratorsHTML = `<div class="collaborator-line" style="margin-top:4px; font-size:0.95rem; color:#555;"><em>Co-written with ${collaboratorLinks.join(", ")}</em></div>`;
    }
  }
  
  // Audio HTML
  let audioHTML = '';
  if (poem.audioUrl) {
    audioHTML = `<div class="poem-audio-section" style="margin: 15px 0 15px 0 !important; padding: 8px 12px !important; background: #f0ede8; border-radius: 12px; width: fit-content; max-width: 45%; min-width: 240px; clear: both;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;"><span style="font-size: 0.75rem; color: #4b2aad; font-weight: 600;">🎙️ Spoken Version</span></div><audio controls style="width: 100%; border-radius: 8px; height: 35px;" preload="metadata"><source src="${poem.audioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio></div>`;
  }
  
  // Follow button
  const followButtonHTML = (currentUserId && poem.authorId && currentUserId !== poem.authorId) 
    ? `<button class="follow-btn-on-card ${isFollowing ? 'following' : ''}" data-poet-id="${poem.authorId}" style="background: ${isFollowing ? '#f44336' : '#4CAF50'}; color: white; border: none; border-radius: 20px; padding: 4px 12px; cursor: pointer; font-size: 12px; margin-left: auto; transition: all 0.2s;">${isFollowing ? 'Following' : 'Follow'}</button>`
    : '';
  
  // Get comment count
  let commentCount = 0;
  try {
    const commentsSnapshot = await getDocs(collection(db, "recentPoems", poem.id, "comments"));
    commentCount = commentsSnapshot.size;
  } catch(e) {}
  
  return `
    <div class="recent-poem-card" data-id="${poem.id}" style="margin-bottom: 20px;">
      <div class="author-line" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:2px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${poem.authorPhoto}" alt="${poem.author}" class="author-img" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
          <div class="author-info">
            <a href="/user-profile.html?uid=${encodeURIComponent(poem.authorId || '')}" class="author-link" style="font-size:1.2rem; font-weight:700;">${escapeHtml(poem.author)}</a>
            <div class="follow-button-container" style="margin-top: 4px;">
              ${followButtonHTML}
            </div>
          </div>
        </div>
        <span class="view-count-inline" style="font-size:0.85rem; color:#333;">${viewCount} Reads</span>
      </div>
      ${collaboratorsHTML}
      <h3 class="recent-poem-title" style="margin-top:12px;">${escapeHtml(poem.title)}</h3>
      <p class="poem-content" style="white-space:pre-wrap; margin-top:8px; margin-left:0; padding-left:0;" data-full-text="${escapeHtml(truncated.full)}" data-preview-text="${escapeHtml(truncated.preview)}">${escapeHtml(truncated.preview)}</p>
      ${truncated.truncated ? `<button class="read-more-btn" style="background:none; border:none; color:#960606; cursor:pointer; padding:0; font-size:0.92rem; font-weight:500; margin-bottom:10px;">Read More</button>` : ""}
      ${audioHTML}
      ${poem.categories?.length ? `<p class="poem-category-line"><em>${poem.categories.map(cat => `<a href="category.html?name=${encodeURIComponent(cat)}" class="category-link">${escapeHtml(cat)}</a>`).join(", ")}</em></p>` : ""}
      
      <div class="poem-actions">
        <div class="comment-section">
          <textarea class="comment-input" placeholder="Write a comment..." rows="1"></textarea>
          <button class="comment-btn">Post</button>
        </div>
        <button class="like-btn ${userLiked ? 'liked' : ''}">❤️</button>
        <span class="like-count">${likes}</span>
        <span class="message-count">💬 ${commentCount}</span>
      </div>
    </div>
    <div class="comment-list" style="display: none; margin-bottom: 20px;"></div>
  `;
}

// Attach event listeners for search result cards
function attachSearchResultEventListeners() {
  // Read more buttons
  document.querySelectorAll('#recent-poems-container .read-more-btn').forEach(btn => {
    btn.removeEventListener('click', btn._readMoreHandler);
    btn._readMoreHandler = () => {
      const card = btn.closest('.recent-poem-card');
      const p = card.querySelector('.poem-content');
      const fullText = p.getAttribute('data-full-text');
      const previewText = p.getAttribute('data-preview-text');
      if (btn.textContent === "Read More") {
        p.textContent = fullText;
        btn.textContent = "Show Less";
      } else {
        p.textContent = previewText;
        btn.textContent = "Read More";
      }
    };
    btn.addEventListener('click', btn._readMoreHandler);
  });
  
  // Like buttons
  document.querySelectorAll('#recent-poems-container .like-btn').forEach(btn => {
    btn.removeEventListener('click', btn._likeHandler);
    btn._likeHandler = async (e) => {
      if (!auth.currentUser) {
        redirectToLogin();
        return;
      }
      const card = btn.closest('.recent-poem-card');
      const poemId = card.dataset.id;
      const countSpan = card.querySelector('.like-count');
      const poemRef = doc(db, "recentPoems", poemId);
      
      try {
        const docSnap = await getDoc(poemRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
        let likes = typeof data.likes === "number" ? data.likes : 0;
        
        if (likedBy.includes(currentUserId)) {
          await updateDoc(poemRef, { likes: increment(-1), likedBy: likedBy.filter(uid => uid !== currentUserId) });
          countSpan.textContent = likes - 1;
          btn.classList.remove("liked");
        } else {
          await updateDoc(poemRef, { likes: increment(1), likedBy: arrayUnion(currentUserId) });
          countSpan.textContent = likes + 1;
          btn.classList.add("liked");
        }
      } catch(err) {
        console.error("Error updating like:", err);
      }
    };
    btn.addEventListener('click', btn._likeHandler);
  });
  
  // Comment buttons
  document.querySelectorAll('#recent-poems-container .comment-btn').forEach(btn => {
    btn.removeEventListener('click', btn._commentHandler);
    btn._commentHandler = async () => {
      if (!auth.currentUser) {
        redirectToLogin();
        return;
      }
      const card = btn.closest('.recent-poem-card');
      const docId = card.dataset.id;
      const input = card.querySelector('.comment-input');
      const commentList = card.nextElementSibling;
      const text = input.value.trim();
      if (!text) return;
      
      try {
        const userDoc = await getDoc(doc(db, "users", currentUserId));
        const username = userDoc.exists() ? userDoc.data().username : "Anonymous";
        
        await addDoc(collection(db, "recentPoems", docId, "comments"), {
          userId: currentUserId,
          username: username,
          text: text,
          timestamp: serverTimestamp()
        });
        
        input.value = "";
        const commentsSnapshot = await getDocs(collection(db, "recentPoems", docId, "comments"));
        card.querySelector(".message-count").textContent = `💬 ${commentsSnapshot.size}`;
      } catch(err) {
        console.error("Error posting comment:", err);
      }
    };
    btn.addEventListener('click', btn._commentHandler);
  });
  
  // Follow buttons
  document.querySelectorAll('#recent-poems-container .follow-btn-on-card').forEach(btn => {
    btn.removeEventListener('click', btn._followHandler);
    btn._followHandler = async (e) => {
      e.stopPropagation();
      const poetId = btn.dataset.poetId;
      await handleFollowFromPoem(poetId, btn);
    };
    btn.addEventListener('click', btn._followHandler);
  });
}

// Perform universal search and display results in the main container
async function performUniversalSearch(query) {
  if (!query || query.trim().length < 2) {
    // If search is cleared, reload original poems
    if (query === '') {
      allPoemsCache = [];
      currentIndex = 0;
      reachedEnd = false;
      const container = document.getElementById("recent-poems-container");
      if (container) {
        container.innerHTML = '';
        loadPoemsBatch();
      }
    }
    return;
  }
  
  const searchTerm = query.trim().toLowerCase();
  const container = document.getElementById("recent-poems-container");
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<div style="text-align: center; padding: 60px 20px;"><div class="loading-spinner"></div><br>Searching...</div>';
  
  try {
    // Search in parallel
    const [poems, users, categories] = await Promise.all([
      searchAllPoems(searchTerm),
      searchAllUsers(searchTerm),
      searchAllCategories(searchTerm)
    ]);
    
    await displaySearchResults(poems, users, categories, searchTerm);
    
  } catch(err) {
    console.error("Search error:", err);
    container.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: red;">Error searching. Please try again.</div>';
  }
}

// Enhanced performSearch that uses universal search
async function enhancedPerformSearch(query) {
  if (universalSearchDebounceTimer) clearTimeout(universalSearchDebounceTimer);
  universalSearchDebounceTimer = setTimeout(() => {
    performUniversalSearch(query);
  }, 300);
}

// Get search input elements
const globalSearchInput = document.getElementById('global-search-input');
const mobileSearchInput = document.getElementById('mobile-search-input');

// Attach event listeners
if (globalSearchInput) {
  globalSearchInput.addEventListener("input", async (e) => {
    await enhancedPerformSearch(e.target.value);
  });
}

if (mobileSearchInput) {
  mobileSearchInput.addEventListener("input", async (e) => {
    await enhancedPerformSearch(e.target.value);
    if (globalSearchInput) globalSearchInput.value = e.target.value;
  });
}

// Add loading spinner styles if not exists
if (!document.querySelector('#search-spinner-styles')) {
  const spinnerStyles = document.createElement('style');
  spinnerStyles.id = 'search-spinner-styles';
  spinnerStyles.textContent = `
    .loading-spinner {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #4b2aad;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(spinnerStyles);
}

// Poetry Gallery
async function loadPoetryGallery() {
  const galleryContainer = document.getElementById("poetry-gallery");
  const gallerySection = document.querySelector(".gallery-section");
  if (!galleryContainer || !gallerySection) return;
  gallerySection.style.display = "none";
  try {
    const recentSnap = await getDocs(collection(db, "recentPoems"));
    const recentPoems = [];
    for (const docSnap of recentSnap.docs) {
      const data = docSnap.data();
      if (isRenceBluntPoem(data)) {
        recentPoems.push({
          id: docSnap.id,
          title: data.title || "Untitled",
          content: data.content || "",
          author: "Rence Blunt",
          slug: data.slug || (data.title ? data.title.toLowerCase().replace(/\s+/g, "-") : docSnap.id),
          collection: "recentPoems",
        });
      }
    }
    const classicSnap = await getDocs(collection(db, "classicPoems"));
    const classicPoems = [];
    for (const docSnap of classicSnap.docs) {
      const data = docSnap.data();
      if (isRenceBluntPoem(data)) {
        classicPoems.push({
          id: docSnap.id,
          title: data.title || "Untitled",
          content: data.content || "",
          author: "Rence Blunt",
          slug: data.slug || (data.title ? data.title.toLowerCase().replace(/\s+/g, "-") : docSnap.id),
          collection: "classicPoems",
        });
      }
    }
    const randomRecent = recentPoems.sort(() => 0.5 - Math.random()).slice(0, 3);
    const randomClassic = classicPoems.sort(() => 0.5 - Math.random()).slice(0, 2);
    const allPoems = [...randomRecent, ...randomClassic];
    if (allPoems.length === 0) {
      galleryContainer.innerHTML = `<p style="text-align:center; padding:40px;">Gallery poems coming soon.</p>`;
      gallerySection.style.display = "block";
      return;
    }
    const html = allPoems.map((p, index) => {
      const lines = (p.content || "").split(/\r?\n/);
      const preview = lines.slice(0, 6).join("\n");
      const url = `poem.html?collection=${p.collection}&slug=${encodeURIComponent(p.slug)}`;
      const visibilityClass = index >= 3 ? "classic" : "recent";
      return `<div class="gallery-item fade-in ${visibilityClass}"><div class="gallery-overlay"><h3>${escapeHtml(p.title)}</h3><p style="white-space: pre-line;">${escapeHtml(preview)}${lines.length > 6 ? "..." : ""}</p><span class="author">By ${escapeHtml(p.author)}</span><a href="${url}" class="view-poem-btn" style="text-decoration:none; display:inline-block; margin-top:10px; padding:6px 12px; background:#4b2aad; color:#fff; border-radius:8px;">View Poem</a></div></div>`;
    }).join("");
    galleryContainer.innerHTML = html;
    animateGalleryItems();
    gallerySection.style.display = "block";
  } catch (err) {
    console.error("Error loading gallery:", err);
    galleryContainer.innerHTML = `<p>Failed to load poems.</p>`;
    gallerySection.style.display = "block";
  }
}

function animateGalleryItems() {
  document.querySelectorAll(".fade-in").forEach((item, i) => {
    item.style.opacity = "0";
    item.style.transform = "translateY(20px)";
    setTimeout(() => {
      item.style.transition = "all 0.8s ease";
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    }, i * 200);
  });
}

// Load Categories
async function loadAllCategories() {
  const section = document.getElementById("poem-categories-container");
  const container = document.getElementById("poem-categories");
  if (!container || !section) return;
  try {
    const snapshot = await getDocs(collection(db, "recentPoems"));
    const categoriesSet = new Set();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (isRenceBluntPoem(data) && Array.isArray(data.categories)) {
        data.categories.forEach((cat) => {
          if (cat && cat.trim() !== "") categoriesSet.add(cat.trim());
        });
      }
    });
    const categories = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    if (categories.length === 0) return;
    const limitedCategories = categories.slice(0, 38);
    const categoriesHTML = limitedCategories.map(cat => `<a href="category.html?name=${encodeURIComponent(cat)}" class="category-card">${escapeHtml(cat)}</a>`).join("");
    const allCategoriesLink = `<a href="all-categories.html" class="category-card all-categories">All Categories →</a>`;
    container.innerHTML = `<div class="categories-grid">${categoriesHTML}${allCategoriesLink}</div>`;
    section.style.display = "block";
    section.style.opacity = 0;
    setTimeout(() => {
      section.style.transition = "opacity 0.4s ease";
      section.style.opacity = 1;
    }, 50);
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

// Load all content
document.addEventListener("DOMContentLoaded", () => {
  loadPoetryGallery();
  loadAllCategories();
  loadWeeklyHighlights();
});

// Ranking Poems
// --- Load Ranking Poems (Top 20) - Based on LAST 7 DAYS ACTIVITY with REAL-TIME UPDATES ---
async function loadRankingPoemsRich() {
  const container = document.getElementById("rank-poems");
  if (!container) return console.warn("No #rank-poems container found.");

  // Calculate date range for last 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRangeText = `${sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
      <p>Top 20 poems based on views, likes, and comments.</p>
    </div>
    <div id="ranking-list"></div>
  `;
  const listEl = container.querySelector("#ranking-list");
  listEl.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "recentPoems"));
    if (snapshot.empty) {
      listEl.innerHTML = "<p style='color:#666;'>No poems found.</p>";
      return;
    }

    const poems = await Promise.all(snapshot.docs.map(async docSnap => {
      const data = docSnap.data() || {};
      
      // Get ALL views (for display)
      const totalViews = typeof data.views === "number" ? data.views : 0;
      
      // Count likes from last 7 days only
      let recentLikes = 0;
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
      const likedByTimestamps = Array.isArray(data.likedByTimestamps) ? data.likedByTimestamps : [];
      
      for (let i = 0; i < likedBy.length; i++) {
        const likeTime = likedByTimestamps[i]?.toDate();
        if (likeTime && likeTime >= sevenDaysAgo) {
          recentLikes++;
        } else if (!likedByTimestamps.length) {
          // If no timestamps stored, count all likes (fallback)
          recentLikes = likedBy.length;
          break;
        }
      }
      
      // Count comments from last 7 days only
      let recentComments = 0;
      let totalComments = 0;
      try {
        const commentSnap = await getDocs(collection(db, "recentPoems", docSnap.id, "comments"));
        totalComments = commentSnap.size;
        for (const commentDoc of commentSnap.docs) {
          const comment = commentDoc.data();
          const commentTime = comment.timestamp?.toDate();
          if (commentTime && commentTime >= sevenDaysAgo) {
            recentComments++;
          }
        }
      } catch (err) {
        console.warn("Unable to fetch comment count:", err);
      }

      // SCORE based ONLY on recent activity (last 7 days)
      // Views × 1 + Recent Likes × 3 + Recent Comments × 4
      // Note: Using total views as fallback since view timestamps are hard to track
      const recentViews = totalViews; // For now, use total views
      const score = (recentViews * 1) + (recentLikes * 3) + (recentComments * 4);
      
      const poetUid = data.authorId || data.userId || "";
      let displayName = data.author || "Anonymous";
      let profileLink = "#";

      if (poetUid) {
        try {
          const userDoc = await getDoc(doc(db, "users", poetUid));
          if (userDoc.exists()) {
            displayName = userDoc.data().username || displayName;
            profileLink = `/user-profile.html?uid=${encodeURIComponent(poetUid)}`;
          }
        } catch (err) {
          console.warn("Failed to fetch author:", err);
        }
      }

      const collaborators = Array.isArray(data.collaborators)
        ? data.collaborators.map(c => ({ uid: c.uid || "#", username: c.username || "Anonymous" }))
        : [];

      return {
        id: docSnap.id,
        title: data.title || "Untitled",
        slug: data.slug || docSnap.id,
        authorId: poetUid,
        authorName: displayName,
        authorProfile: profileLink,
        content: data.content || "",
        totalLikes: data.likes || 0,
        recentLikes: recentLikes,
        likedBy: likedBy,
        totalViews: totalViews,
        audioUrl: data.audioUrl || data.audio || "",
        categories: Array.isArray(data.categories)
          ? data.categories
          : (data.categories ? [data.categories] : []),
        score: score,
        totalComments: totalComments,
        recentComments: recentComments,
        collaborators,
        createdAt: data.timestamp?.toDate() || new Date()
      };
    }));

    // Sort by score (based on recent activity)
    poems.sort((a, b) => b.score - a.score);
    const top = poems.slice(0, 20);

    if (top.length === 0) {
      listEl.innerHTML = "<p style='color:#666; text-align:center; padding:20px;'>No activity in the last 7 days. Be the first to engage! </p>";
      return;
    }

    function getInitials(name = "") {
      const parts = name.trim().split(" ");
      if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function colorFromName(name = "") {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 60%, 45%)`;
    }

    function generateAvatarImage(initials, bgColor, size = 180) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#ffffff";
      ctx.font = `${size * 0.5}px 'Playfair Display', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, size / 2, size / 2);
      return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), "image/png");
      });
    }

    async function uploadAvatarToCloudinary(initials, bgColor, poetUid, publicId = null) {
      const blob = await generateAvatarImage(initials, bgColor);
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("upload_preset", "profile_pics");
      if (publicId) formData.append("public_id", publicId);
      const cloudName = "dzoq4pgjn";
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        const imageUrl = data.secure_url;
        await updateDoc(doc(db, "users", poetUid), { cachedAvatarURL: imageUrl });
        return imageUrl;
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        return null;
      }
    }

    for (let index = 0; index < top.length; index++) {
      const poem = top[index];
      const card = document.createElement("div");
      card.className = "recent-poem-card";
      card.dataset.id = poem.id;
      card.dataset.slug = poem.slug;

      const truncated = truncatePoem(poem.content, 8);
      let profileImage = "/images/default-avatar.png";
      let isFollowing = false;

      if (poem.authorId) {
        try {
          const userDoc = await getDoc(doc(db, "users", poem.authorId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.photoURL) profileImage = userData.photoURL;
            else if (userData.cachedAvatarURL) profileImage = userData.cachedAvatarURL;
            else {
              const initials = getInitials(poem.authorName);
              const bgColor = colorFromName(poem.authorName);
              uploadAvatarToCloudinary(initials, bgColor, poem.authorId)
                .then(url => {
                  if (url) {
                    const img = card.querySelector(".author-img");
                    if (img) img.src = url;
                  }
                });
            }
          }
        } catch (err) {
          console.warn("Failed to fetch author profile image:", err);
        }

        if (currentUserId && currentUserId !== poem.authorId) {
          isFollowing = await checkFollowStatus(poem.authorId, currentUserId);
        }
      }

      let collaboratorsHTML = "";
      if (Array.isArray(poem.collaborators) && poem.collaborators.length > 0) {
        const links = poem.collaborators.map(c => {
          const uid = c.uid && c.uid !== "#" ? encodeURIComponent(c.uid) : "";
          return `<a href="${uid ? `/user-profile.html?uid=${uid}` : '#'}" class="collaborator-link">${escapeHtml(c.username)}</a>`;
        });
        collaboratorsHTML = `<div class="collaborators" style="margin-top:6px; margin-left:58px; font-size:0.95rem; color:#555;"><em>Co-written with ${links.join(", ")}</em></div>`;
      }

      const audioHTML = poem.audioUrl ? `<div class="poem-audio-section" style="margin: 15px 0 15px 0 !important; padding: 8px 12px !important; background: #f0ede8; border-radius: 12px; width: fit-content; max-width: 45%; min-width: 240px; clear: both;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;"><span style="font-size: 0.75rem; color: #4b2aad; font-weight: 600;">🎙️ Spoken Version</span></div><audio controls style="width: 100%; border-radius: 8px; height: 35px;" preload="metadata"><source src="${poem.audioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio></div>` : "";

      const followButtonHTML = (currentUserId && poem.authorId && currentUserId !== poem.authorId)
        ? `<button class="follow-btn-on-card ${isFollowing ? 'following' : ''}" data-poet-id="${poem.authorId}" style="background: ${isFollowing ? '#f44336' : '#4CAF50'}; color: white; border: none; border-radius: 20px; padding: 6px 14px; cursor: pointer; font-size: 12px; transition: all 0.2s;">${isFollowing ? 'Following' : 'Follow'}</button>`
        : "";

      // Show recent activity badge
      const hasRecentActivity = poem.recentLikes > 0 || poem.recentComments > 0;
      const recentBadge = hasRecentActivity ? `<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;"></span>` : '';

      card.innerHTML = `
        <div class="author-line" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${profileImage}" alt="${escapeHtml(poem.authorName)}" class="author-img" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
            <div>
              <a href="${poem.authorProfile}" class="author-link" style="font-size:1.1rem; font-weight:700;">${escapeHtml(poem.authorName)}</a>
              <div style="margin-top: 4px;">
                ${followButtonHTML}
              </div>
            </div>
          </div>
<div style="display: flex; gap: 10px; align-items: center;">
  ${poem.recentLikes > 0 || poem.recentComments > 0 ? `<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px;">🔥 Trending this week</span>` : ''}
  <span style="font-size:0.75rem; color:#888;">📅 ${poem.createdAt.toLocaleDateString()}</span>
</div>
        </div>

        ${collaboratorsHTML}

        <h3 class="recent-poem-title" style="margin-top:4px; font-size:1.2rem;">${index + 1}. ${escapeHtml(poem.title)} ${recentBadge} <small style="font-weight:400; color:#777; font-size:0.85rem;">(weekly score: ${poem.score})</small></h3>
        <p class="poem-content" style="white-space:pre-wrap; margin-top:10px;">${escapeHtml(truncated.preview)}</p>
        ${truncated.truncated ? `<button class="read-more-btn" style="margin-top:10px; background:#960606; color:white; border:none; padding:8px 14px; border-radius:8px; cursor:pointer;">Read More</button>` : ""}
        ${audioHTML}
        ${poem.categories?.length ? `<p class="poem-category-line" style="margin-top:12px;"><em>${poem.categories.map(cat => `<a href="category.html?name=${encodeURIComponent(cat)}" class="category-link">${escapeHtml(cat)}</a>`).join(", ")}</em></p>` : ""}

        <div class="poem-actions">
          <div class="comment-section">
            <textarea class="comment-input" placeholder="Write a comment..." rows="1"></textarea>
            <button class="comment-btn">Post</button>
          </div>
          <button class="like-btn">❤️</button>
          <span class="like-count">${poem.totalLikes}</span>
          <span class="message-count">💬 ${poem.totalComments}</span>
        </div>
        <div class="recent-stats" style="font-size: 11px; color: #888; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">
          📊 This week: ${poem.recentLikes} likes · ${poem.recentComments} comments
        </div>
      `;

      if (index === 0) card.style.border = "2px solid gold";
      else if (index === 1) card.style.border = "2px solid silver";
      else if (index === 2) card.style.border = "2px solid #cd7f32";
      else card.style.border = "1px solid #eee";

      listEl.appendChild(card);

      const commentListDiv = document.createElement("div");
      commentListDiv.className = "comment-list";
      commentListDiv.style.display = "none";
      commentListDiv.style.margin = "10px 0 20px 0";
      listEl.appendChild(commentListDiv);

      if (truncated.truncated) {
        const btn = card.querySelector(".read-more-btn");
        const p = card.querySelector(".poem-content");
        let expanded = false;
        btn.addEventListener("click", () => {
          if (!expanded) {
            p.textContent = truncated.full;
            btn.textContent = "Show Less";
          } else {
            p.textContent = truncated.preview;
            btn.textContent = "Read More";
          }
          expanded = !expanded;
        });
      }

      const textarea = card.querySelector(".comment-input");
      if (textarea) {
        textarea.addEventListener("input", () => {
          textarea.style.height = "auto";
          textarea.style.height = `${textarea.scrollHeight}px`;
        });
      }

      const user = auth.currentUser;
      if (user && Array.isArray(poem.likedBy) && poem.likedBy.includes(user.uid)) {
        const btn = card.querySelector(".like-btn");
        if (btn) btn.classList.add("liked");
      }

      // Like button with REAL-TIME update
      const likeBtn = card.querySelector(".like-btn");
      const likeCountSpan = card.querySelector(".like-count");
      
      if (likeBtn) {
        likeBtn.addEventListener("click", async () => {
          if (!user) {
            window.location.href = "universal-login.html";
            return;
          }
          
          const poemRef = doc(db, "recentPoems", poem.id);
          const likedBy = poem.likedBy || [];
          const isLiked = likedBy.includes(user.uid);
          
          if (isLiked) {
            await updateDoc(poemRef, {
              likes: (poem.totalLikes || 0) - 1,
              likedBy: likedBy.filter(id => id !== user.uid)
            });
            poem.totalLikes--;
            poem.recentLikes = Math.max(0, poem.recentLikes - 1);
            likeBtn.style.color = "";
            likeBtn.classList.remove("liked");
          } else {
            await updateDoc(poemRef, {
              likes: (poem.totalLikes || 0) + 1,
              likedBy: [...likedBy, user.uid],
              likedByTimestamps: [...(data.likedByTimestamps || []), new Date()]
            });
            poem.totalLikes++;
            poem.recentLikes++;
            likeBtn.style.color = "#e74c3c";
            likeBtn.classList.add("liked");
          }
          likeCountSpan.textContent = poem.totalLikes;
          
          // Update score and display
          poem.score = (poem.totalViews * 1) + (poem.recentLikes * 3) + (poem.recentComments * 4);
          const scoreBadge = card.querySelector("h3 small");
          if (scoreBadge) scoreBadge.textContent = `(weekly score: ${poem.score})`;
          
          const recentStats = card.querySelector(".recent-stats");
          if (recentStats) {
            recentStats.innerHTML = `📊 This week: ${poem.recentLikes} likes · ${poem.recentComments} comments`;
          }
        });
      }

      // Comment button with REAL-TIME update
      const commentBtn = card.querySelector(".comment-btn");
      if (commentBtn) {
        commentBtn.addEventListener("click", async () => {
          if (!user) {
            window.location.href = "universal-login.html";
            return;
          }
          
          const commentText = textarea?.value.trim();
          if (!commentText) return;
          
          const commentsRef = collection(db, "recentPoems", poem.id, "comments");
          await addDoc(commentsRef, {
            text: commentText,
            userId: user.uid,
            username: user.displayName || "Anonymous",
            timestamp: new Date()
          });
          
          if (textarea) textarea.value = "";
          poem.totalComments++;
          poem.recentComments++;
          const msgSpan = card.querySelector(".message-count");
          if (msgSpan) msgSpan.textContent = `💬 ${poem.totalComments}`;
          
          // Update score and display
          poem.score = (poem.totalViews * 1) + (poem.recentLikes * 3) + (poem.recentComments * 4);
          const scoreBadge = card.querySelector("h3 small");
          if (scoreBadge) scoreBadge.textContent = `(weekly score: ${poem.score})`;
          
          const recentStats = card.querySelector(".recent-stats");
          if (recentStats) {
            recentStats.innerHTML = `📊 This week: ${poem.recentLikes} likes · ${poem.recentComments} comments`;
          }
        });
      }
    }

    if (!listEl.children.length) {
      listEl.innerHTML = "<p style='color:#666;'>No poems to display.</p>";
    }
  } catch (err) {
    console.error("Error loading ranking poems:", err);
    container.innerHTML += `<p style="color:red;">Failed to load ranking poems.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadRankingPoemsRich);





// --- Load Ranking Poets ---
// ============ HELPER FUNCTIONS FOR RANKING ============

// Get initials from username for avatar
function getInitials(name) {
  if (!name || name === "Anonymous") return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Generate color from name for avatar background
function colorFromName(name) {
  if (!name) return "hsl(0, 60%, 45%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

// Upload avatar to Cloudinary
async function uploadAvatarToCloudinary(initials, bgColor, userId) {
  try {
    const cloudName = "dzoq4pgjn";
    if (!cloudName) return null;
    
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 80px 'Playfair Display', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, canvas.width / 2, canvas.height / 2);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", "profile_pics");
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });
    
    if (response.ok) {
      const data = await response.json();
      const imageUrl = data.secure_url;
      
      if (userId && typeof updateDoc === 'function') {
        await updateDoc(doc(db, "users", userId), { 
          cachedAvatarURL: imageUrl 
        });
      }
      return imageUrl;
    }
  } catch (err) {
    console.warn("Cloudinary upload failed:", err);
  }
  return null;
}

// Escape HTML to prevent XSS
function safeEscapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Dynamic countdown that updates every second
let countdownInterval = null;

function startCountdown() {
  const countdownElement = document.getElementById('countdown-timer');
  if (!countdownElement) return;
  
  // Clear existing interval
  if (countdownInterval) clearInterval(countdownInterval);
  
  function updateCountdown() {
    const now = new Date();
    const nextMonday = new Date(now);
    const dayOfWeek = now.getDay();
    
    // Calculate days until next Monday (1 = Monday, 0 = Sunday)
    let daysUntilMonday;
    if (dayOfWeek === 0) {
      daysUntilMonday = 1; // Sunday -> Monday tomorrow
    } else if (dayOfWeek === 1) {
      daysUntilMonday = 0; // Monday -> today
    } else {
      daysUntilMonday = 8 - dayOfWeek; // Tuesday-Saturday
    }
    
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    // If it's Monday and before midnight, show remaining hours
    if (dayOfWeek === 1 && now.getHours() < 24) {
      nextMonday.setDate(now.getDate() + 7); // Next Monday
    }
    
    const diffMs = nextMonday - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    let countdownText = '';
    if (diffDays > 0) {
      countdownText = `${diffDays}d ${diffHours}h ${diffMinutes}m`;
    } else if (diffHours > 0) {
      countdownText = `${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
    } else if (diffMinutes > 0) {
      countdownText = `${diffMinutes}m ${diffSeconds}s`;
    } else {
      countdownText = `${diffSeconds}s`;
    }
    
    if (dayOfWeek === 1 && now.getHours() === 0 && diffDays === 7) {
      countdownText = "Resetting now...";
    }
    
    countdownElement.textContent = countdownText;
  }
  
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

// Stop countdown when page unloads
window.addEventListener('beforeunload', () => {
  if (countdownInterval) clearInterval(countdownInterval);
});

// Save past winners to hall of fame (FIXED - added safety check)
async function saveWeeklyWinner(poet, weekLabel) {
  try {
    // Check if setDoc is available
    if (typeof setDoc !== 'function') {
      console.warn("setDoc is not available, skipping winner save");
      return;
    }
    
    const winnerRef = doc(db, "weeklyWinners", weekLabel);
    await setDoc(winnerRef, {
      poetId: poet.userId,
      username: poet.username,
      score: poet.score,
      poemsWritten: poet.poemsWritten,
      commentsGiven: poet.commentsGiven,
      likesGiven: poet.likesGiven,
      week: weekLabel,
      timestamp: new Date()
    });
    console.log(`}`);
  } catch (err) {
    console.warn("", err);
  }
}

// Get previous week's range
function getPreviousWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  let daysToLastMonday;
  if (dayOfWeek === 0) {
    daysToLastMonday = 6;
  } else {
    daysToLastMonday = dayOfWeek - 1;
  }
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const weekLabel = `${formatDate(lastMonday)} - ${formatDate(lastSunday)}`;
  
  return {
    weekStart: lastMonday,
    weekEnd: lastSunday,
    weekLabel: weekLabel
  };
}

// ============ END HELPER FUNCTIONS ============

// Main ranking function
async function loadRankingPoets() {
  try {
    const container = document.getElementById("ranking-poets-container");
    if (!container) {
      console.warn("Ranking poets container not found!");
      return;
    }

    // Get the previous complete week
    const { weekStart, weekEnd, weekLabel } = getPreviousWeekRange();

    const poetsMap = new Map();

    // YOUR WEIGHTS
    const WEIGHTS = {
      poemsWritten: 2,
      likesReceived: 1.5,
      commentsReceived: 1.5,
      likesGiven: 3,
      commentsGiven: 4
    };

    // Fetch data
    const [poemsSnapshot, usersSnapshot] = await Promise.all([
      getDocs(collection(db, "recentPoems")),
      getDocs(collection(db, "users"))
    ]);

    // Initialize poets
    if (usersSnapshot.empty) {
      container.innerHTML = `
        <div class="ranking-header">
          <h3>🏆 Weekly Poet Rankings</h3>
          <div class="countdown-container" style="margin-bottom:15px;">
            <span style="background:#e8e0f0; padding:5px 12px; border-radius:20px; font-size:12px;">⏰ Resets in: <span id="countdown-timer">calculating...</span></span>
          </div>
          <p style="color:#666; text-align:center; padding:20px;">No poets yet. Be the first to join! ✨</p>
        </div>
      `;
      startCountdown();
      return;
    }

    usersSnapshot.forEach(userDoc => {
      const data = userDoc.data();
      poetsMap.set(userDoc.id, {
        userId: userDoc.id,
        username: data.username || "Anonymous",
        photoURL: data.photoURL || data.cachedAvatarURL || null,
        poemsWritten: 0,
        likesReceived: 0,
        commentsReceived: 0,
        likesGiven: 0,
        commentsGiven: 0,
        meaningfulCommentsGiven: 0,
        score: 0
      });
    });

    // Process poems from the target week only
    for (const docSnap of poemsSnapshot.docs) {
      const data = docSnap.data();
      const createdAt = data.timestamp ? data.timestamp.toDate() : new Date();
      const isInTargetWeek = createdAt >= weekStart && createdAt <= weekEnd;
      
      const authorId = data.authorId || data.userId || data.submittedBy;
      
      if (authorId && poetsMap.has(authorId) && isInTargetWeek) {
        const poet = poetsMap.get(authorId);
        poet.poemsWritten += 1;
        
        const wordCount = (data.content || "").split(/\s+/).length;
        const hasAudio = !!data.audioUrl;
        const hasStructure = (data.content || "").includes("\n");
        
        let qualityBonus = 1;
        if (wordCount >= 50) qualityBonus += 0.5;
        if (hasAudio) qualityBonus += 0.5;
        if (hasStructure) qualityBonus += 0.5;
        
        poet.likesReceived += (data.likes || 0) * qualityBonus;
        poet.commentsReceived += (data.comments?.length || 0) * qualityBonus;
      }
      
      // Likes given
      if (data.likedBy && Array.isArray(data.likedBy) && isInTargetWeek) {
        data.likedBy.forEach(uid => {
          if (poetsMap.has(uid)) {
            poetsMap.get(uid).likesGiven += 1;
          }
        });
      }
    }

    // Process comments from target week only
    for (const docSnap of poemsSnapshot.docs) {
      try {
        const commentsSnapshot = await getDocs(collection(db, "recentPoems", docSnap.id, "comments"));
        for (const commentDoc of commentsSnapshot.docs) {
          const comment = commentDoc.data();
          const commenterId = comment.userId || comment.user;
          const createdAt = comment.timestamp?.toDate() || new Date();
          const isInTargetWeek = createdAt >= weekStart && createdAt <= weekEnd;
          
          if (commenterId && poetsMap.has(commenterId) && isInTargetWeek) {
            const poet = poetsMap.get(commenterId);
            
            const commentText = comment.text || comment.content || "";
            const isMeaningful = commentText.length >= 20 && 
                                !/^(nice|good|great|awesome|cool|lovely|beautiful|amazing|wow|like it|beautiful poem|nice work|thanks for sharing|love this)$/i.test(commentText.trim());
            
            let commentValue = 1;
            if (!isMeaningful) commentValue = 0.25;
            
            poet.commentsGiven += commentValue;
            if (isMeaningful) poet.meaningfulCommentsGiven += 1;
          }
        }
      } catch (err) {
        continue;
      }
    }

    // Calculate scores
    for (const poet of poetsMap.values()) {
      let rawScore = 
        (poet.poemsWritten * WEIGHTS.poemsWritten) +
        (poet.likesReceived * WEIGHTS.likesReceived) +
        (poet.commentsReceived * WEIGHTS.commentsReceived) +
        (poet.likesGiven * WEIGHTS.likesGiven) +
        (poet.commentsGiven * WEIGHTS.commentsGiven);
      
      if (rawScore === 0 && (poet.poemsWritten > 0 || poet.likesGiven > 0 || poet.commentsGiven > 0)) {
        rawScore = 1;
      }
      
      poet.score = rawScore;
      
      if (poet.commentsGiven >= 3) poet.score += 10;
      if (poet.likesGiven >= 10) poet.score += 5;
      if (poet.poemsWritten >= 1 && (poet.commentsGiven >= 1 || poet.likesGiven >= 3)) {
        poet.score += 15;
      }
    }

    // Sort and take top 20
    const sortedPoets = Array.from(poetsMap.values())
      .filter(poet => poet.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // Save the winner to hall of fame (safe version)
    if (sortedPoets.length > 0 && typeof setDoc === 'function') {
      await saveWeeklyWinner(sortedPoets[0], weekLabel);
    }

    // Render
    container.innerHTML = `
      <div class="ranking-header">
        <div style="margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <span style="background:#e8e0f0; padding:5px 12px; border-radius:20px; font-size:12px;">⏰ Resets in: <span id="countdown-timer">calculating...</span></span>
          <span style="background:#4b2aad; color:white; padding:5px 12px; border-radius:20px; font-size:12px;">📅 ${weekLabel}</span>
        </div>
      
        <p class="ranking-description">Based on: Writing (${WEIGHTS.poemsWritten} pts) · Support Given (likes ${WEIGHTS.likesGiven}, comments ${WEIGHTS.commentsGiven}) · Popularity (likes ${WEIGHTS.likesReceived}, comments ${WEIGHTS.commentsReceived})</p>
        <small> Rankings reset every Monday | Showing previous week's champions</small>
      </div>
      <div class="poets-ranking-list"></div>
    `;
    
    // Start the dynamic countdown
    startCountdown();
    
    const listEl = container.querySelector(".poets-ranking-list");
    
    if (sortedPoets.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f9f7f4; border-radius: 12px;">
          <p style="font-size: 1.2rem; margin-bottom: 10px;">📊 No activity recorded for ${weekLabel}</p>
          <p style="color: #666;">Be the first to write, like, or comment this week!</p>
          <button onclick="window.location.href='write-poem.html'" style="margin-top: 15px; padding: 10px 20px; background: #5a3cb3; color: white; border: none; border-radius: 8px; cursor: pointer;">Write a Poem →</button>
        </div>
      `;
      return;
    }

    for (let index = 0; index < sortedPoets.length; index++) {
      const poet = sortedPoets[index];
      const poetDiv = document.createElement("div");
      poetDiv.className = "ranking-poet-card";
      
      let badge = "";
      if (index === 0) badge = "🏆";
      else if (index === 1) badge = "🥈";
      else if (index === 2) badge = "🥉";
      
      let communityBadge = "";
      if (poet.commentsGiven >= 5 || poet.likesGiven >= 20) {
        communityBadge = '<span class="community-badge" style="background:#4CAF50; color:white; padding:2px 8px; border-radius:12px; font-size:11px; margin-left:10px;">🤝 Community Helper</span>';
      }
      
      let profileImage = poet.photoURL || "/images/default-avatar.png";
      if (!poet.photoURL) {
        const initials = getInitials(poet.username);
        const bgColor = colorFromName(poet.username);
        uploadAvatarToCloudinary(initials, bgColor, poet.userId).then(url => {
          if (url) {
            const img = poetDiv.querySelector(".poet-avatar");
            if (img) img.src = url;
          }
        });
      }
      
      const safeUsername = safeEscapeHtml(poet.username);
      
      poetDiv.innerHTML = `
        <div class="poet-card-header">
          <div class="rank-number">#${index + 1}</div>
          <div class="poet-rank-badge">${badge}</div>
          <img src="${profileImage}" alt="${poet.username}" class="poet-avatar" onerror="this.src='/images/default-avatar.png'">
          <div class="poet-info">
            <div class="poet-name-line">
              <a href="user-profile.html?uid=${encodeURIComponent(poet.userId)}" class="poet-username">${safeUsername}</a>
              ${communityBadge}
            </div>
            <div class="poet-stats-grid">
              <div class="stat-group">
                <span class="stat-label">✍️ Poems</span>
                <span class="stat-value">${poet.poemsWritten}</span>
              </div>
              <div class="stat-group">
                <span class="stat-label">💝 Given</span>
                <span class="stat-value">❤️ ${poet.likesGiven} · 💬 ${poet.commentsGiven.toFixed(1)}</span>
              </div>
              <div class="stat-group">
                <span class="stat-label">⭐ Received</span>
                <span class="stat-value">❤️ ${Math.round(poet.likesReceived)} · 💬 ${Math.round(poet.commentsReceived)}</span>
              </div>
              <div class="stat-group">
                <span class="stat-label">🏆 Score</span>
                <span class="stat-value highlight">${Math.round(poet.score)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      listEl.appendChild(poetDiv);
    }
    
  } catch (err) {
    console.error("Error loading ranking poets:", err);
    const container = document.getElementById("ranking-poets-container");
    if (container) {
      container.innerHTML = `
        <div class="ranking-header">
          <h3> Poet Rankings</h3>
          <p style="color:#666; text-align:center; padding:20px;">Unable to load rankings. Please refresh the page.</p>
        </div>
      `;
    }
  }
}

// Check and refresh on Monday
function checkAndRefreshRankings() {
  const today = new Date();
  const isMonday = today.getDay() === 1;
  const lastRefresh = localStorage.getItem('lastRankingRefresh');
  const todayStr = today.toDateString();
  
  if (isMonday && lastRefresh !== todayStr) {
    console.log("Monday refresh: Updating rankings...");
    localStorage.setItem('lastRankingRefresh', todayStr);
    loadRankingPoets();
  }
}

// Load when page is ready
document.addEventListener("DOMContentLoaded", () => {
  loadRankingPoets();
  checkAndRefreshRankings();
  if (typeof loadWeeklyHighlights === 'function') {
    loadWeeklyHighlights();
  }
});

// ============================================
// EXPOSE USER DATA TO GLOBAL SCOPE FOR LOGOUT SCRIPT
// ============================================

// Make auth and user data available globally
window.firebaseAuth = auth;
window.firebaseDb = db;

// Function to get current user data
function exposeUserData(user) {
  if (user) {
    // Fetch username from Firestore
    getDoc(doc(db, "users", user.uid)).then(userDoc => {
      let username = user.displayName || user.email?.split('@')[0] || "User";
      if (userDoc.exists()) {
        username = userDoc.data().username || username;
      }
      
      // Store user data in window object for logout script
      window.currentUser = {
        uid: user.uid,
        username: username,
        email: user.email,
        displayName: username
      };
      
      // Also store in localStorage for persistence
      localStorage.setItem('volant_user', JSON.stringify({
        uid: user.uid,
        username: username,
        email: user.email
      }));
      localStorage.setItem('volant_logged_in', 'true');
      
      // Dispatch event that logout script can listen to
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { user: window.currentUser } 
      }));
      
      console.log("User data exposed globally:", username);
    }).catch(err => {
      console.warn("Error fetching user data for global exposure:", err);
      window.currentUser = {
        uid: user.uid,
        username: user.email?.split('@')[0] || "User",
        email: user.email
      };
      localStorage.setItem('volant_user', JSON.stringify(window.currentUser));
      localStorage.setItem('volant_logged_in', 'true');
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { user: window.currentUser } 
      }));
    });
  } else {
    // User is logged out
    delete window.currentUser;
    localStorage.removeItem('volant_user');
    localStorage.removeItem('volant_logged_in');
    window.dispatchEvent(new CustomEvent('authStateChanged', { 
      detail: { user: null } 
    }));
  }
}

// Listen to auth state changes and expose user data
onAuthStateChanged(auth, async (user) => {
  exposeUserData(user);
});

// Also expose signOut function globally
window.logoutUser = async function() {
  try {
    await signOut(auth);
    delete window.currentUser;
    localStorage.removeItem('volant_user');
    localStorage.removeItem('volant_logged_in');
    console.log("User logged out successfully");
    return true;
  } catch (err) {
    console.error("Logout error:", err);
    return false;
  }
};

// ==================== DYNAMIC LOGIN/SIGNUP LINK SETUP ====================
// This runs on EVERY page to make all login/signup links capture current page
(function() {
  function setupDynamicAuthLinks() {
    const currentPage = window.location.href;
    const platform = getCurrentPlatform();
    const loginParams = new URLSearchParams();
    loginParams.append('platform', platform);
    loginParams.append('redirect', currentPage);
    
    const signupParams = new URLSearchParams();
    signupParams.append('platform', platform);
    signupParams.append('redirect', currentPage);
    
    // Update all universal-login links
    document.querySelectorAll('a[href*="universal-login.html"]').forEach(link => {
      link.href = `universal-login.html?${loginParams.toString()}`;
    });
    
    // Update all universal-signup links
    document.querySelectorAll('a[href*="universal-signup.html"]').forEach(link => {
      link.href = `universal-signup.html?${signupParams.toString()}`;
    });
    
    // Also handle buttons if any
    document.querySelectorAll('button[onclick*="universal-login"]').forEach(btn => {
      btn.onclick = () => {
        window.location.href = `universal-login.html?${loginParams.toString()}`;
      };
    });
    
    document.querySelectorAll('button[onclick*="universal-signup"]').forEach(btn => {
      btn.onclick = () => {
        window.location.href = `universal-signup.html?${signupParams.toString()}`;
      };
    });
  }
  
  // Set up on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDynamicAuthLinks);
  } else {
    setupDynamicAuthLinks();
  }
  
  // Also set up when DOM is modified (for dynamically added elements)
  const observer = new MutationObserver(() => {
    setupDynamicAuthLinks();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// Initial exposure in case auth state already resolved
const currentAuthUser = auth.currentUser;
if (currentAuthUser) {
  exposeUserData(currentAuthUser);
}

console.log("Global auth exposed - logout script can now access user data");