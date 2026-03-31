import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// CONFIGURATION
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

const MASTER_DATA = {
  courses: [
    {
      id: "AUK21101",
      name: "Konsep Dasar PAUD",
      sks: 2,
      teachers: {
        D1: "Syaikhon",
        D2: "Nanang",
        D3: "Nanang",
        D4: "Syaikhon",
        D5: "Syaikhon",
        D6: "Syaikhon",
        D7: "Nanang",
      },
    },
    {
      id: "AUA21103",
      name: "Psikologi Perkembangan Anak",
      sks: 3,
      teachers: {
        D1: "Machmudah",
        D2: "Machmudah",
        D3: "Machmudah",
        D4: "Machmudah",
        D5: "Fifi",
        D6: "Fifi",
        D7: "Fifi",
      },
    },
    {
      id: "AUK21316",
      name: "Kognitif & Kreativitas",
      sks: 3,
      teachers: {
        D1: "Destita",
        D2: "Thamrin",
        D3: "Tiyas",
        D4: "Thamrin",
        D5: "Sri Hartatik",
        D6: "Pance",
        D7: "Asmaul",
      },
    },
    {
      id: "AUS21317",
      name: "Sosial Emosional AUD",
      sks: 3,
      teachers: {
        D1: "Andini",
        D2: "Andini",
        D3: "Andini",
        D4: "Andini",
        D5: "Thamrin",
        D6: "Thamrin",
        D7: "Thamrin",
      },
    },
    {
      id: "AUF21329",
      name: "Fisik Motorik AUD",
      sks: 3,
      teachers: {
        D1: "Destita",
        D2: "Destita",
        D3: "Destita",
        D4: "Berda",
        D5: "Berda",
        D6: "Sunanto",
        D7: "Sunanto",
      },
    },
    {
      id: "AUB 21514",
      name: "Bermain & Permainan AUD",
      sks: 3,
      teachers: {
        D1: "Berda",
        D2: "Berda",
        D3: "Berda",
        D4: "Jauharotur",
        D5: "Jauharotur",
        D6: "Jauharotur",
        D7: "Jauharotur",
      },
    },
    {
      id: "AUP 21523",
      name: "Perencanaan Pembelajaran AUD",
      sks: 3,
      teachers: {
        D1: "Sri Hartatik",
        D2: "Destita",
        D3: "Nailul",
        D4: "Afib",
        D5: "Dewi",
        D6: "Edi Pujo",
        D7: "Berda",
      },
    },
    {
      id: "AUE 21526",
      name: "Evaluasi Pembelajaran AUD",
      sks: 3,
      teachers: {
        D1: "Andim",
        D2: "Novi",
        D3: "Muslimin",
        D4: "Akhwani",
        D5: "Amin",
        D6: "Akhwani",
        D7: "Destita",
      },
    },
  ],
  classes: ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
};

let currentSchedule = [];
let sortConfig = { key: "day", direction: "asc" };
let currentUser = null;
let unsubscribeSnapshot = null;

// AUTH & INIT
const init = async () => {
  try {
    if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token);
    } else {
      await signInAnonymously(auth);
    }

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      if (user) {
        document.getElementById("syncStatusIndicator").className =
          "w-2 h-2 bg-green-400 rounded-full";
        document.getElementById("syncStatusText").textContent =
          "Sinkronisasi Aktif";
        listenToSchedule();
        document.getElementById("currentDate").textContent =
          new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
      } else {
        document.getElementById("syncStatusIndicator").className =
          "w-2 h-2 bg-red-400 rounded-full";
        document.getElementById("syncStatusText").textContent = "Terputus";
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });
  } catch (err) {
    console.error("Auth error", err);
    showAlert("Gagal otentikasi ke database", "error");
  }
};

// LISTEN TO FIRESTORE (REALTIME)
const listenToSchedule = () => {
  if (!currentUser) return;
  const q = collection(db, "artifacts", appId, "public", "data", "schedules");
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  unsubscribeSnapshot = onSnapshot(
    q,
    (snapshot) => {
      currentSchedule = snapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
      document.getElementById("loadingState").classList.add("hidden");
      updateUI();
      initSelects();
    },
    (err) => {
      console.error("Firestore Error:", err);
      if (err.code === "permission-denied") {
        showAlert("Izin ditolak. Memulai ulang koneksi...", "error");
      } else {
        showAlert("Gagal memuat data cloud", "error");
      }
    },
  );
};

// UI: DROPDOWN DENGAN ELIMINASI
const initSelects = () => {
  const select = document.getElementById("courseSelect");
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>';

  const usedKeys = currentSchedule.map((s) => `${s.courseId}|${s.class}`);

  MASTER_DATA.courses.forEach((course) => {
    MASTER_DATA.classes.forEach((cls) => {
      const key = `${course.id}|${cls}`;
      if (!usedKeys.includes(key)) {
        const teacher = course.teachers[cls];
        const option = document.createElement("option");
        option.value = key;
        option.textContent = `[${cls}] ${course.name} - ${teacher}`;
        select.appendChild(option);
      }
    });
  });

  if (currentVal) select.value = currentVal;
};

// UI: UPDATE TABLE & STATS
const updateUI = () => {
  const body = document.getElementById("scheduleTableBody");
  const emptyState = document.getElementById("emptyState");
  body.innerHTML = "";

  if (currentSchedule.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");

    const sorted = [...currentSchedule].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === "day") {
        const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        valA = days.indexOf(valA);
        valB = days.indexOf(valB);
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "day") {
        return timeToMinutes(a.start) - timeToMinutes(b.start);
      }
      return 0;
    });

    sorted.forEach((item) => {
      const row = document.createElement("tr");
      row.className = "hover:bg-indigo-50 transition duration-150";
      row.innerHTML = `
                        <td class="p-4">
                            <div class="font-bold text-gray-800">${item.day}</div>
                            <div class="text-xs text-indigo-600 font-mono">${item.start} - ${item.end}</div>
                        </td>
                        <td class="p-4">
                            <div class="text-sm font-semibold text-gray-800">${item.courseName}</div>
                            <div class="text-[10px] text-gray-400 font-mono">${item.courseId}</div>
                        </td>
                        <td class="p-4 text-sm text-gray-700">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                ${item.teacher}
                            </span>
                        </td>
                        <td class="p-4 text-center">
                            <span class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">${item.class}</span>
                        </td>
                        <td class="p-4 text-center text-xs text-gray-500">
                            ${item.sks} SKS<br>(${item.sks * 50}m)
                        </td>
                        <td class="p-4 text-center">
                            <button onclick="window.deleteEntry('${item.docId}')" class="text-red-300 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-full">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
      body.appendChild(row);
    });
  }
  updateStats();
};

const updateStats = () => {
  const statsContainer = document.getElementById("lecturerStats");
  const teacherLoad = {};
  currentSchedule.forEach((s) => {
    teacherLoad[s.teacher] = (teacherLoad[s.teacher] || 0) + s.sks * 50;
  });

  statsContainer.innerHTML = "";
  Object.entries(teacherLoad).forEach(([name, load]) => {
    const h = Math.floor(load / 60);
    const m = load % 60;
    statsContainer.innerHTML += `
                    <div class="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                        <span class="text-xs font-medium text-gray-700">${name}</span>
                        <span class="text-[10px] bg-white px-2 py-0.5 rounded shadow-sm text-indigo-600 font-bold">${h}j ${m}m</span>
                    </div>
                `;
  });
};

const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const showAlert = (msg, type = "error") => {
  const box = document.getElementById("alertBox");
  box.textContent = msg;
  box.className = `mt-4 p-4 rounded-lg text-sm font-bold ${
    type === "error"
      ? "bg-red-100 text-red-700 border border-red-200"
      : "bg-green-100 text-green-700 border border-green-200"
  }`;
  box.classList.remove("hidden");
  if (type === "success") setTimeout(() => box.classList.add("hidden"), 3000);
};

// GLOBAL ACTIONS
window.sortBy = (key) => {
  if (sortConfig.key === key) {
    sortConfig.direction = sortConfig.direction === "asc" ? "desc" : "asc";
  } else {
    sortConfig.key = key;
    sortConfig.direction = "asc";
  }
  updateUI();
};

window.deleteEntry = async (docId) => {
  if (!currentUser) return;
  if (confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) {
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "schedules", docId),
      );
      showAlert("Data jadwal berhasil dihapus", "success");
    } catch (e) {
      console.error(e);
      showAlert("Gagal menghapus data", "error");
    }
  }
};

window.deleteAllEntries = async () => {
  if (!currentUser) return;
  if (
    confirm(
      "PERINGATAN: Semua jadwal akan dihapus secara permanen. Anda ingin memulai awal?",
    )
  ) {
    const q = collection(db, "artifacts", appId, "public", "data", "schedules");
    try {
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      showAlert(
        "Semua data berhasil dibersihkan. Silakan mulai input awal.",
        "success",
      );
    } catch (e) {
      console.error(e);
      showAlert("Gagal membersihkan data", "error");
    }
  }
};

// FORM LOGIC
document.getElementById("courseSelect").addEventListener("change", (e) => {
  const val = e.target.value;
  if (val) {
    const [id, cls] = val.split("|");
    const course = MASTER_DATA.courses.find((c) => c.id === id);
    document.getElementById("courseInfo").textContent =
      `${course.sks} SKS | Dosen: ${course.teachers[cls]}`;
    const start = document.getElementById("startTime").value;
    if (start) {
      const [h, m] = start.split(":").map(Number);
      const total = h * 60 + m + course.sks * 50;
      document.getElementById("endTimeDisplay").textContent =
        `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }
  }
});

document.getElementById("startTime").addEventListener("input", (e) => {
  const val = document.getElementById("courseSelect").value;
  if (val && e.target.value) {
    const [id, cls] = val.split("|");
    const course = MASTER_DATA.courses.find((c) => c.id === id);
    const [h, m] = e.target.value.split(":").map(Number);
    const total = h * 60 + m + course.sks * 50;
    document.getElementById("endTimeDisplay").textContent =
      `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
});

document
  .getElementById("scheduleForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showAlert("Koneksi belum siap", "error");
      return;
    }

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    const courseVal = document.getElementById("courseSelect").value;
    const day = document.getElementById("daySelect").value;
    const start = document.getElementById("startTime").value;

    const [id, cls] = courseVal.split("|");
    const course = MASTER_DATA.courses.find((c) => c.id === id);
    const teacher = course.teachers[cls];
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + course.sks * 50;
    const end = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

    const entry = {
      courseId: id,
      courseName: course.name,
      class: cls,
      teacher: teacher,
      sks: course.sks,
      day: day,
      start: start,
      end: end,
      createdAt: Date.now(),
    };

    // Conflict Check
    const startMins = timeToMinutes(entry.start);
    const endMins = timeToMinutes(entry.end);
    let conflict = null;
    for (let e of currentSchedule) {
      if (e.day === entry.day) {
        const eS = timeToMinutes(e.start);
        const eE = timeToMinutes(e.end);
        if (
          (e.teacher === entry.teacher || e.class === entry.class) &&
          startMins < eE &&
          endMins > eS
        ) {
          conflict = `Bentrok dengan jadwal ${e.courseName} (${e.start}-${e.end})`;
          break;
        }
      }
    }

    if (conflict) {
      showAlert(conflict, "error");
    } else {
      try {
        const docRef = doc(
          collection(db, "artifacts", appId, "public", "data", "schedules"),
        );
        await setDoc(docRef, entry);
        showAlert("Jadwal tersimpan!", "success");
        e.target.reset();
        document.getElementById("endTimeDisplay").textContent = "--:--";
        document.getElementById("courseInfo").textContent = "";
      } catch (err) {
        showAlert("Gagal menyimpan", "error");
      }
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan ke Cloud';
  });

init();
