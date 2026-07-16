import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, enableIndexedDbPersistence, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Offline persistence error:", err.code);
});

// --- Sidebar and Sections ---
const links = document.querySelectorAll(".sidebar nav a");
const sections = document.querySelectorAll(".form-section");

const hideAllSections = () => {
  sections.forEach(sec => sec.classList.add("hidden"));
};

// Sidebar link click handler
links.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    links.forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    hideAllSections();
    const target = document.getElementById(link.dataset.section);
    if(target) target.classList.remove("hidden");
  });
});

// --- Admin Management ---
const adminsTable = document.getElementById("adminsTable").querySelector("tbody");
const addAdminForm = document.getElementById("addAdminForm");

const loadAdmins = async () => {
  adminsTable.innerHTML = "";
  const snapshot = await getDocs(collection(db, "admins"));
  snapshot.forEach(docItem => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${docItem.data().email}</td>
      <td><button class="delete-btn">Delete</button></td>
    `;
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if(confirm("Delete this admin?")) {
        await deleteDoc(doc(db, "admins", docItem.id));
        tr.remove();
      }
    });
    adminsTable.appendChild(tr);
  });
};

addAdminForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = addAdminForm.querySelector("input").value;
  await addDoc(collection(db, "admins"), { email });
  addAdminForm.reset();
  loadAdmins();
});

// --- Users Management ---
const usersTable = document.getElementById("usersTable").querySelector("tbody");

const loadUsers = async () => {
  usersTable.innerHTML = "";
  const snapshot = await getDocs(collection(db, "users"));
  snapshot.forEach(docItem => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${docItem.data().email}</td>
      <td><button class="delete-btn">Delete</button></td>
    `;
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if(confirm("Delete this user?")) {
        await deleteDoc(doc(db, "users", docItem.id));
        tr.remove();
      }
    });
    usersTable.appendChild(tr);
  });
};

// --- Messages Management ---
const messagesSection = document.createElement("section");
messagesSection.id = "manageMessages";
messagesSection.classList.add("form-section", "hidden");
messagesSection.innerHTML = `
  <h2>Messages</h2>
  <table id="messagesTable">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Message</th>
        <th>Time (GMT)</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
`;

// Insert Messages section **after Users section**
const usersSection = document.getElementById("usersTable").closest(".form-section");
usersSection.parentNode.insertBefore(messagesSection, usersSection.nextSibling);

const messagesTable = messagesSection.querySelector("tbody");

const loadMessages = async () => {
  messagesTable.innerHTML = "";
  const snapshot = await getDocs(collection(db, "messages"));

  const messages = snapshot.docs
    .map(docItem => ({ id: docItem.id, ...docItem.data() }))
    .sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.toMillis() - a.timestamp.toMillis();
    });

  messages.forEach(msg => {
    const { name, email, message, timestamp, id } = msg;
    let timeStr = "N/A";
    if (timestamp && timestamp.toDate) {
      timeStr = timestamp.toDate().toUTCString();
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td><a href="mailto:${email}">${email}</a></td>
      <td>${message}</td>
      <td>${timeStr}</td>
      <td><button class="delete-btn">Delete</button></td>
    `;
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if(confirm("Delete this message?")) {
        await deleteDoc(doc(db, "messages", id));
        tr.remove();
      }
    });
    messagesTable.appendChild(tr);
  });
};

// --- Add single "Messages" link at bottom of sidebar ---
const sidebarNav = document.querySelector(".sidebar nav");
const msgLink = document.createElement("a");
msgLink.href = "#";
msgLink.dataset.section = "manageMessages";
msgLink.textContent = "Messages";
sidebarNav.appendChild(msgLink);

// Handle Messages click
msgLink.addEventListener("click", e => {
  e.preventDefault();
  links.forEach(l => l.classList.remove("active"));
  msgLink.classList.add("active");
  hideAllSections();
  messagesSection.classList.remove("hidden");
  loadMessages();
});

// --- Initial load ---
loadAdmins();
loadUsers();
loadMessages();

