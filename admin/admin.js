import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

document.addEventListener("DOMContentLoaded", () => {
  // Helper function for messages
  const showMessage = (container, text, success = true) => {
    container.textContent = text;
    container.style.color = success ? "green" : "red";
    setTimeout(() => { container.textContent = ""; }, 4000);
  };

  // Get form elements
  const quoteForm = document.getElementById("quoteSubmitForm");
  const poemForm = document.getElementById("poemSubmitForm");
  const recentForm = document.getElementById("recentPoemSubmitForm");

  // Weekly Quote Form (overwrite previous)
  quoteForm.addEventListener("submit", async e => {
    e.preventDefault();
    const quote = quoteForm.querySelector("textarea[placeholder='Enter quote...']").value;
    const author = quoteForm.querySelector("input[placeholder='Author name']").value || "";
    const msg = quoteForm.querySelector(".form-message");

    try {
      await setDoc(doc(db, "weeklyHighlights", "weeklyQuote"), {
        quote,
        author,
        timestamp: serverTimestamp()
      });
      showMessage(msg, "✅ Weekly Quote updated!");
      quoteForm.reset();
    } catch (err) {
      showMessage(msg, "❌ Error updating quote: " + err.message, false);
    }
  });

  // Weekly Poem Form (overwrite previous)
// Weekly Poem Form (overwrite previous)
poemForm.addEventListener("submit", async e => {
  e.preventDefault();

  // ✅ Get values from form
  const title = poemForm.querySelector("input[placeholder='Poem title']").value;
  const content = poemForm.querySelector("textarea[placeholder='Poem content...']").value;
  const author = poemForm.querySelector("input[placeholder='Author name']").value || "";
  const msg = poemForm.querySelector(".form-message");

  try {
    // ✅ Create/overwrite document with title field
    await setDoc(doc(db, "weeklyHighlights", "weeklyPoem"), {
      title,      // 🎯 now saved in Firestore
      content,
      author,
      timestamp: serverTimestamp()
    });

    showMessage(msg, "✅ Weekly Poem updated!");
    poemForm.reset();
  } catch (err) {
    showMessage(msg, "❌ Error updating poem: " + err.message, false);
  }
});

// Recent Poem Form (adds new document)
recentForm.addEventListener("submit", async e => {
  e.preventDefault();

  const title = recentForm.querySelector("input[placeholder='Recent poem title']").value.trim();
  const excerpt = recentForm.querySelector("textarea[placeholder='Short excerpt of poem...']").value.trim() || null; // optional
  const content = recentForm.querySelector("textarea[placeholder='Full poem content...']").value.trim();
  const authorInput = recentForm.querySelector("input[placeholder='Author name']").value.trim();
  const author = authorInput === "" ? null : authorInput; // store null if empty

  const categoryInput = recentForm.querySelector("input[placeholder='Choose or type category']").value.trim();
  
  // Convert comma-separated input into an array of trimmed categories
  const categories = categoryInput.split(",").map(cat => cat.trim()).filter(cat => cat);  

  const msg = recentForm.querySelector(".form-message");

  try {
    await addDoc(collection(db, "recentPoems"), {
      title,
      excerpt,     
      content,
      author,      
      categories,  // stored as an array
      timestamp: serverTimestamp()
    });

    showMessage(msg, "✅ Recent Poem added successfully!");
    recentForm.reset();
  } catch (err) {
    showMessage(msg, "❌ Error adding recent poem: " + err.message, false);
  }
});



});

document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll(".sidebar nav a");
  const sections = document.querySelectorAll(".form-section");

  links.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault(); // prevent page jump

      // Remove active from all links, add to clicked
      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      // Hide all sections
      sections.forEach(sec => sec.classList.add("hidden"));

      // Show the target section
      const targetId = link.dataset.section;
      const target = document.getElementById(targetId);
      if (target) target.classList.remove("hidden");
    });
  });
});



document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");

  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      navLinks.classList.toggle("show");
    });
  }

  // Close menu on link click (mobile)
  if (navLinks) {
    const links = navLinks.querySelectorAll("a");
    links.forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("show");
      });
    });
  }
});



