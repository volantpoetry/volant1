import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Sidebar navigation
const links = document.querySelectorAll(".sidebar nav a");
const sections = document.querySelectorAll(".form-section");
links.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    links.forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    sections.forEach(sec => sec.classList.add("hidden"));
    const target = document.getElementById(link.dataset.section);
    if (target) target.classList.remove("hidden");
  });
});

// Load data with optional alphabetical sorting for recentPoems
const loadCollection = async (collectionName, tableBodyId) => {
  const tableBody = document.getElementById(tableBodyId);
  tableBody.innerHTML = ""; // clear table

  const snapshot = await getDocs(collection(db, collectionName));
  let items = snapshot.docs.map(docItem => ({
    id: docItem.id,
    data: docItem.data()
  }));

  // Sort only recentPoems by title A → Z
  if (collectionName === "recentPoems") {
    items.sort((a, b) => {
      const titleA = a.data.title ? a.data.title.toLowerCase() : "";
      const titleB = b.data.title ? b.data.title.toLowerCase() : "";
      return titleA.localeCompare(titleB);
    });
  }

  items.forEach(item => {
    const data = item.data;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.title || data.quote || ""}</td>
      <td>${data.author || ""}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </td>
    `;

    // Delete
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this item?")) {
        await deleteDoc(doc(db, collectionName, item.id));
        tr.remove();
      }
    });

    // Edit
    tr.querySelector(".edit-btn").addEventListener("click", async () => {
      const newTitle = prompt("Edit title/quote:", data.title || data.quote || "");
      const newAuthor = prompt("Edit author:", data.author || "");
      if (newTitle !== null) {
        const updateData = {};
        if (collectionName === "quotes") updateData.quote = newTitle;
        else updateData.title = newTitle;
        updateData.author = newAuthor;
        await updateDoc(doc(db, collectionName, item.id), updateData);
        loadCollection(collectionName, tableBodyId); // reload table
      }
    });

    tableBody.appendChild(tr);
  });
};

// Initial load
loadCollection("poems", "poemsTable").catch(console.error);
loadCollection("quotes", "quotesTable").catch(console.error);
loadCollection("recentPoems", "recentTable").catch(console.error);
