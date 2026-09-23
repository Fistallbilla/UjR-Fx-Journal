/* =========================================================
   UjR Fx Trading Journal
   Firebase + Advanced Analytics
   ========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getRedirectResult
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  getDoc
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
  authDomain: "journal-38e0e.firebaseapp.com",
  databaseURL: "https://journal-38e0e-default-rtdb.firebaseio.com",
  projectId: "journal-38e0e",
  storageBucket: "journal-38e0e.firebasestorage.app",
  messagingSenderId: "382226906837",
  appId: "1:382226906837:web:38df881c0f7beb24256c5c",
  measurementId: "G-R6LXDMQ9K2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});


/* =========================================================
   STATE
   ========================================================= */

const state = {
  user: null,
  trades: [],
  currency: "USD",
  startingBalance: 0,
  currentPage: "dashboardPage",
  editingTrade: null,
  calendarDate: new Date(),
  selectedCalendarDate: null
};


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {

  const amount = num(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: state.currency || "USD",
    maximumFractionDigits: 2
  }).format(amount);

}

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

function formatDate(date) {

  if (!date) return "";

  const d = new Date(`${date}T12:00:00`);

  if (Number.isNaN(d.getTime())) return date;

  return d.toLocaleDateString();

}

function todayString() {

  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;

}

function generateTradeId() {

  const date = new Date();

  const stamp =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `UJ-${stamp}-${random}`;

}


/* =========================================================
   AUTH
   ========================================================= */

$("googleLoginBtn").addEventListener("click", async () => {

  const button = $("googleLoginBtn");

  button.disabled = true;

  button.innerHTML = `
    <span class="google-icon">G</span>
    <span>Signing in...</span>
  `;

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error("Google Login Error:", error);

    if (error.code === "auth/popup-blocked") {

      $("loginError").textContent =
        "Popup was blocked. Allow popups for this website.";

    } else if (error.code === "auth/popup-closed-by-user") {

      $("loginError").textContent =
        "Login window was closed.";

    } else if (error.code === "auth/unauthorized-domain") {

      $("loginError").textContent =
        "This website domain is not authorized in Firebase.";

    } else if (error.code === "auth/operation-not-allowed") {

      $("loginError").textContent =
        "Google login is not enabled in Firebase.";

    } else if (error.code === "auth/network-request-failed") {

      $("loginError").textContent =
        "Network error. Check your internet connection.";

    } else {

      $("loginError").textContent =
        error.message || "Google login failed.";

    }

  } finally {

    button.disabled = false;

    button.innerHTML = `
      <span class="google-icon">G</span>
      <span>Continue with Google</span>
    `;

  }

});


getRedirectResult(auth).catch(error => {

  if (error) {
    console.error("Redirect auth error:", error);
  }

});


$("logoutBtn").addEventListener("click", () => signOut(auth));

$("mobileLogoutBtn").addEventListener("click", () => signOut(auth));


onAuthStateChanged(auth, async user => {

  if (user) {

    state.user = user;

    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    updateUserUI();

    await loadUserData();

  } else {

    state.user = null;
    state.trades = [];

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

  }

});


/* =========================================================
   USER UI
   ========================================================= */

function updateUserUI() {

  if (!state.user) return;

  const name =
    state.user.displayName ||
    state.user.email?.split("@")[0] ||
    "Trader";

  const email =
    state.user.email || "---";

  const photo =
    state.user.photoURL || "logo.png";

  $("sidebarUserName").textContent = name;
  $("sidebarUserEmail").textContent = email;

  $("sidebarUserPhoto").src = photo;

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;

  $("settingsPhoto").src = photo;

}


/* =========================================================
   NAVIGATION
   ========================================================= */

document.querySelectorAll(".nav-btn").forEach(button => {

  button.addEventListener("click", () => {

    showPage(button.dataset.page);

    $("mobileNav").classList.remove("open");

  });

});


document.querySelectorAll("[data-page-target]").forEach(button => {

  button.addEventListener("click", () => {

    showPage(button.dataset.pageTarget);

  });

});


function showPage(pageId) {

  document.querySelectorAll(".page").forEach(page => {

    page.classList.remove("active-page");

  });

  const page = $(pageId);

  if (page) {

    page.classList.add("active-page");

  }

  document.querySelectorAll(".nav-btn").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === pageId
    );

  });

  state.currentPage = pageId;

  if (pageId === "dashboardPage") {
    renderDashboard();
  }

  if (pageId === "journalPage") {
    renderJournal();
  }

  if (pageId === "analyticsPage") {
    renderAnalytics();
  }

  if (pageId === "calendarPage") {
    renderCalendar();
  }

}


$("mobileMenuBtn").addEventListener("click", () => {

  $("mobileNav").classList.toggle("open");

});


/* =========================================================
   ADD TRADE BUTTONS
   ========================================================= */

document.querySelectorAll(".add-trade-btn").forEach(button => {

  button.addEventListener("click", openAddTradeModal);

});


function openAddTradeModal() {

  state.editingTrade = null;

  $("tradeForm").reset();

  $("tradeModalTitle").textContent = "Add Trade";
  $("saveTradeBtn").textContent = "Save Trade";

  $("editingTradeId").value = "";
  $("tradeId").value = generateTradeId();
  $("tradeDate").value = todayString();

  $("pair").value = "XAUUSD";

  $("rr").value = "";

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

}


/* =========================================================
   MODAL
   ========================================================= */

$("closeTradeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTradeBtn").addEventListener(
  "click",
  closeTradeModal
);

$("tradeModal").addEventListener("click", event => {

  if (event.target === $("tradeModal")) {

    closeTradeModal();

  }

});


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  state.editingTrade = null;

}


/* =========================================================
   RR
   ========================================================= */

function calculateTradeRR() {

  const entry = num($("entry").value);
  const sl = num($("sl").value);
  const tp = num($("tp").value);
  const direction = $("direction").value;

  if (entry <= 0 || sl <= 0 || tp <= 0) {

    $("rr").value = "";

    return 0;

  }

  let risk = 0;
  let reward = 0;

  if (direction === "Buy") {

    risk = entry - sl;
    reward = tp - entry;

  } else {

    risk = sl - entry;
    reward = entry - tp;

  }

  if (risk <= 0 || reward <= 0) {

    $("rr").value = "Invalid";

    return 0;

  }

  const rr = reward / risk;

  $("rr").value = `1:${rr.toFixed(2)}`;

  return rr;

}


["entry", "sl", "tp", "direction"].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateTradeRR
  );

  $(id).addEventListener(
    "change",
    calculateTradeRR
  );

});


/* =========================================================
   P/L
   ========================================================= */

function normalizeProfitLossByResult() {

  const result = $("result").value;
  const input = $("profitLoss");

  if (result === "Break Even") {

    input.value = "0";

    return;

  }

  if (input.value === "") return;

  const value = Number(input.value);

  if (!Number.isFinite(value)) return;

  if (result === "Win") {

    input.value = Math.abs(value);

  }

  if (result === "Loss") {

    input.value = -Math.abs(value);

  }

}


function getNormalizedPL() {

  const result = $("result").value;
  const raw = $("profitLoss").value;

  if (result === "Break Even") return 0;

  if (raw === "") return null;

  const value = Number(raw);

  if (!Number.isFinite(value)) return null;

  if (result === "Win") {

    return Number(
      Math.abs(value).toFixed(2)
    );

  }

  if (result === "Loss") {

    return Number(
      -Math.abs(value).toFixed(2)
    );

  }

  return Number(value.toFixed(2));

}


$("result").addEventListener(
  "change",
  normalizeProfitLossByResult
);

$("profitLoss").addEventListener(
  "blur",
  normalizeProfitLossByResult
);


/* =========================================================
   SAVE / UPDATE TRADE
   ========================================================= */

$("tradeForm").addEventListener(
  "submit",
  saveTrade
);


async function saveTrade(event) {

  event.preventDefault();

  if (!state.user) return;

  $("tradeError").textContent = "";

  const rr = calculateTradeRR();

  if ($("entry").value &&
      $("sl").value &&
      $("tp").value &&
      $("rr").value === "Invalid") {

    $("tradeError").textContent =
      "Invalid Entry, SL or TP for this direction.";

    return;

  }


  const riskRaw =
    $("riskAmount").value.trim();

  const riskAmount =
    riskRaw === "" ? 0 : Number(riskRaw);

  if (!Number.isFinite(riskAmount) || riskAmount < 0) {

    $("tradeError").textContent =
      "Risk Amount must be a valid positive number.";

    return;

  }


  const profitLoss =
    getNormalizedPL();

  if (profitLoss === null) {

    $("tradeError").textContent =
      "Please enter a valid P/L.";

    return;

  }


  const pair =
    $("pair").value.trim().toUpperCase() ||
    "XAUUSD";


  const tradeData = {

    tradeId:
      $("tradeId").value ||
      generateTradeId(),

    date:
      $("tradeDate").value ||
      todayString(),

    pair,

    tradingType:
      $("tradingType").value,

    direction:
      $("direction").value,

    strategy:
      $("strategy").value,

    session:
      $("session").value,

    bias:
      $("bias").value,

    entry:
      num($("entry").value),

    sl:
      num($("sl").value),

    tp:
      num($("tp").value),

    rr:
      rr > 0 ? rr : 0,

    riskAmount,

    lotSize:
      num($("lotSize").value),

    result:
      $("result").value,

    profitLoss,

    confidence:
      $("confidence").value,

    emotion:
      $("emotion").value,

    mistake:
      $("mistake").value,

    notes:
      $("notes").value.trim(),

    userId:
      state.user.uid,

    updatedAt:
      serverTimestamp()

  };


  const button = $("saveTradeBtn");

  button.disabled = true;
  button.textContent = "Saving...";


  try {

    if (state.editingTrade) {

      const trade = state.editingTrade;

      const reference =
        getTradeReference(trade);

      if (!reference) {

        throw new Error(
          "Could not find the original trade location."
        );

      }

      await updateDoc(
        reference,
        tradeData
      );

    } else {

      await addDoc(
        collection(
          db,
          "users",
          state.user.uid,
          "trades"
        ),
        {
          ...tradeData,
          createdAt: serverTimestamp()
        }
      );

    }


    closeTradeModal();

    await loadUserData();

  } catch (error) {

    console.error(
      "Save Trade Error:",
      error
    );

    $("tradeError").textContent =
      error.message ||
      "Could not save trade.";

  } finally {

    button.disabled = false;

    button.textContent =
      state.editingTrade
        ? "Update Trade"
        : "Save Trade";

  }

}


/* =========================================================
   FIRESTORE COMPATIBILITY
   ========================================================= */

function getTradeReference(trade) {

  if (!state.user || !trade?._docId) {
    return null;
  }


  if (trade._source === "nested") {

    return doc(
      db,
      "users",
      state.user.uid,
      "trades",
      trade._docId
    );

  }


  if (
    trade._source === "top-userId" ||
    trade._source === "top-uid"
  ) {

    return doc(
      db,
      "trades",
      trade._docId
    );

  }


  return null;

}


function firstValue(data, keys, fallback = "") {

  for (const key of keys) {

    if (
      data[key] !== undefined &&
      data[key] !== null &&
      data[key] !== ""
    ) {

      return data[key];

    }

  }

  return fallback;

}


function normalizeTrade(data, source, docId) {

  const rawRR =
    firstValue(
      data,
      ["rr", "riskReward"],
      0
    );

  let rr = num(rawRR);

  if (
    typeof rawRR === "string" &&
    rawRR.includes(":")
  ) {

    rr = num(
      rawRR.split(":").pop()
    );

  }


  return {

    _source: source,
    _docId: docId,

    tradeId:
      firstValue(
        data,
        ["tradeId", "id", "tradeID"],
        docId
      ),

    date:
      firstValue(
        data,
        ["date", "tradeDate"],
        todayString()
      ),

    pair:
      String(
        firstValue(
          data,
          ["pair", "symbol", "instrument"],
          "XAUUSD"
        )
      ).toUpperCase(),

    tradingType:
      firstValue(
        data,
        ["tradingType", "tradeType", "type"],
        "Scalping"
      ),

    direction:
      firstValue(
        data,
        ["direction", "side"],
        "Buy"
      ),

    strategy:
      firstValue(
        data,
        ["strategy", "setup"],
        "Other"
      ),

    session:
      firstValue(
        data,
        ["session"],
        "London"
      ),

    bias:
      firstValue(
        data,
        ["bias", "marketBias"],
        "Neutral"
      ),

    entry:
      num(
        firstValue(
          data,
          ["entry", "entryPrice"],
          0
        )
      ),

    sl:
      num(
        firstValue(
          data,
          ["sl", "stopLoss"],
          0
        )
      ),

    tp:
      num(
        firstValue(
          data,
          ["tp", "takeProfit"],
          0
        )
      ),

    rr,

    riskAmount:
      num(
        firstValue(
          data,
          ["riskAmount", "risk"],
          0
        )
      ),

    lotSize:
      num(
        firstValue(
          data,
          ["lotSize", "lot"],
          0
        )
      ),

    result:
      firstValue(
        data,
        ["result"],
        "Break Even"
      ),

    profitLoss:
      num(
        firstValue(
          data,
          ["profitLoss", "pnl", "pl"],
          0
        )
      ),

    confidence:
      firstValue(
        data,
        ["confidence"],
        "3"
      ),

    emotion:
      firstValue(
        data,
        ["emotion"],
        "Neutral"
      ),

    mistake:
      firstValue(
        data,
        ["mistake", "mistakes"],
        "None"
      ),

    notes:
      firstValue(
        data,
        ["notes", "note"],
        ""
      )

  };

}


async function loadUserData() {

  if (!state.user) return;

  const uid = state.user.uid;

  const results = [];

  /* ---------- NEW STRUCTURE ---------- */

  try {

    const nestedSnapshot =
      await getDocs(
        collection(
          db,
          "users",
          uid,
          "trades"
        )
      );

    nestedSnapshot.forEach(item => {

      results.push(
        normalizeTrade(
          item.data(),
          "nested",
          item.id
        )
      );

    });

  } catch (error) {

    console.error(
      "Nested trades load error:",
      error
    );

  }


  /* ---------- OLD TOP LEVEL: userId ---------- */

  try {

    const q =
      query(
        collection(db, "trades"),
        where("userId", "==", uid)
      );

    const snapshot =
      await getDocs(q);

    snapshot.forEach(item => {

      results.push(
        normalizeTrade(
          item.data(),
          "top-userId",
          item.id
        )
      );

    });

  } catch (error) {

    console.error(
      "Top-level userId trades load error:",
      error
    );

  }


  /* ---------- OLD TOP LEVEL: uid ---------- */

  try {

    const q =
      query(
        collection(db, "trades"),
        where("uid", "==", uid)
      );

    const snapshot =
      await getDocs(q);

    snapshot.forEach(item => {

      results.push(
        normalizeTrade(
          item.data(),
          "top-uid",
          item.id
        )
      );

    });

  } catch (error) {

    console.error(
      "Top-level uid trades load error:",
      error
    );

  }


  /* ---------- DEDUPLICATE ---------- */

  const unique = new Map();

  for (const trade of results) {

    const key =
      trade.tradeId ||
      `${trade._source}-${trade._docId}`;

    if (!unique.has(key)) {

      unique.set(key, trade);

    } else {

      const existing =
        unique.get(key);

      /*
        Prefer nested copy when the
        same trade exists in both places.
      */

      if (
        existing._source !== "nested" &&
        trade._source === "nested"
      ) {

        unique.set(key, trade);

      }

    }

  }


  state.trades =
    Array.from(unique.values())
      .sort(
        (a,b) =>
          String(b.date).localeCompare(
            String(a.date)
          )
      );


  console.log(
    "Loaded trades:",
    state.trades.length
  );


  await loadSettings();

  updatePairFilter();

  renderDashboard();
  renderJournal();
  renderAnalytics();
  renderCalendar();

}


/* =========================================================
   EDIT TRADE
   ========================================================= */

function editTrade(tradeId) {

  const trade =
    state.trades.find(
      item =>
        item.tradeId === tradeId
    );

  if (!trade) return;

  state.editingTrade = trade;

  $("tradeModalTitle").textContent =
    "Edit Trade";

  $("saveTradeBtn").textContent =
    "Update Trade";


  $("editingTradeId").value =
    trade.tradeId;

  $("tradeId").value =
    trade.tradeId;

  $("tradeDate").value =
    trade.date;

  $("pair").value =
    trade.pair || "XAUUSD";

  $("tradingType").value =
    trade.tradingType;

  $("direction").value =
    trade.direction;

  $("strategy").value =
    trade.strategy;

  $("session").value =
    trade.session;

  $("bias").value =
    trade.bias;

  $("entry").value =
    trade.entry || "";

  $("sl").value =
    trade.sl || "";

  $("tp").value =
    trade.tp || "";

  calculateTradeRR();

  $("riskAmount").value =
    trade.riskAmount || "";

  $("lotSize").value =
    trade.lotSize || "";

  $("result").value =
    trade.result;

  $("profitLoss").value =
    trade.profitLoss;

  $("confidence").value =
    trade.confidence || "3";

  $("emotion").value =
    trade.emotion || "Neutral";

  $("mistake").value =
    trade.mistake || "None";

  $("notes").value =
    trade.notes || "";

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

}


window.editTrade = editTrade;


/* =========================================================
   DELETE TRADE
   ========================================================= */

async function deleteTrade(tradeId) {

  const trade =
    state.trades.find(
      item =>
        item.tradeId === tradeId
    );

  if (!trade) return;

  const confirmed =
    confirm(
      `Delete trade ${trade.tradeId}?`
    );

  if (!confirmed) return;


  try {

    const reference =
      getTradeReference(trade);

    if (!reference) {

      throw new Error(
        "Original trade location not found."
      );

    }

    await deleteDoc(reference);

    await loadUserData();

  } catch (error) {

    console.error(
      "Delete trade error:",
      error
    );

    alert(
      error.message ||
      "Could not delete trade."
    );

  }

}


window.deleteTrade = deleteTrade;


/* =========================================================
   JOURNAL
   ========================================================= */

function updatePairFilter() {

  const select =
    $("journalPairFilter");

  const current =
    select.value;

  const pairs =
    [...new Set(
      state.trades
        .map(t => t.pair)
        .filter(Boolean)
    )]
    .sort();

  select.innerHTML =
    `<option value="">All Pairs</option>` +
    pairs
      .map(
        pair =>
          `<option value="${escapeHTML(pair)}">${escapeHTML(pair)}</option>`
      )
      .join("");

  select.value = current;

}


[
  "journalSearch",
  "journalResultFilter",
  "journalTypeFilter",
  "journalPairFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderJournal
  );

  $(id).addEventListener(
    "change",
    renderJournal
  );

});


$("clearJournalFilters").addEventListener(
  "click",
  () => {

    $("journalSearch").value = "";
    $("journalResultFilter").value = "";
    $("journalTypeFilter").value = "";
    $("journalPairFilter").value = "";

    renderJournal();

  }
);


function getFilteredJournalTrades() {

  const search =
    $("journalSearch").value
      .trim()
      .toLowerCase();

  const result =
    $("journalResultFilter").value;

  const type =
    $("journalTypeFilter").value;

  const pair =
    $("journalPairFilter").value;


  return state.trades.filter(trade => {

    const matchesSearch =
      !search ||
      [
        trade.pair,
        trade.strategy,
        trade.direction,
        trade.session,
        trade.emotion,
        trade.mistake,
        trade.notes
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesResult =
      !result ||
      trade.result === result;

    const matchesType =
      !type ||
      trade.tradingType === type;

    const matchesPair =
      !pair ||
      trade.pair === pair;

    return (
      matchesSearch &&
      matchesResult &&
      matchesType &&
      matchesPair
    );

  });

}


function renderJournal() {

  const trades =
    getFilteredJournalTrades();

  $("journalTradeCount").textContent =
    `${trades.length} trade${trades.length === 1 ? "" : "s"}`;


  if (!trades.length) {

    $("journalTableBody").innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;color:var(--muted);padding:30px">
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  $("journalTableBody").innerHTML =
    trades.map(trade => {

      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";

      const plClass =
        trade.profitLoss >= 0
          ? "pl-positive"
          : "pl-negative";


      return `
        <tr>

          <td>${escapeHTML(formatDate(trade.date))}</td>

          <td>${escapeHTML(trade.pair)}</td>

          <td>${escapeHTML(trade.tradingType)}</td>

          <td>${escapeHTML(trade.direction)}</td>

          <td>${escapeHTML(trade.strategy)}</td>

          <td>${trade.entry || "-"}</td>

          <td>
            ${trade.rr > 0
              ? `1:${trade.rr.toFixed(2)}`
              : "-"}
          </td>

          <td class="${resultClass}">
            ${escapeHTML(trade.result)}
          </td>

          <td class="${plClass}">
            ${money(trade.profitLoss)}
          </td>

          <td>

            <button
              class="action-btn"
              onclick="editTrade('${escapeHTML(trade.tradeId)}')"
            >
              Edit
            </button>

            <button
              class="action-btn delete"
              onclick="deleteTrade('${escapeHTML(trade.tradeId)}')"
            >
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


/* =========================================================
   ANALYTICS
   ========================================================= */

$("analyticsPeriod").addEventListener(
  "change",
  renderAnalytics
);

$("analyticsBreakdown").addEventListener(
  "change",
  renderAnalytics
);


function getAnalyticsTrades() {

  const period =
    $("analyticsPeriod").value;

  const now =
    new Date();

  let start = null;

  if (period === "7") {

    start = new Date(now);

    start.setDate(
      now.getDate() - 6
    );

  }

  if (period === "30") {

    start = new Date(now);

    start.setDate(
      now.getDate() - 29
    );

  }

  if (period === "month") {

    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  }

  if (period === "year") {

    start = new Date(
      now.getFullYear(),
      0,
      1
    );

  }

  if (!start) {

    return [...state.trades];

  }


  start.setHours(0,0,0,0);

  return state.trades.filter(trade => {

    const date =
      new Date(`${trade.date}T12:00:00`);

    return date >= start;

  });

}


function calculateAnalytics(trades) {

  let wins = 0;
  let losses = 0;
  let breakEven = 0;

  let totalPL = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  let rrSum = 0;
  let rrCount = 0;

  let riskSum = 0;
  let riskCount = 0;

  let bestTrade = 0;
  let worstTrade = 0;

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;


  const sorted =
    [...trades].sort(
      (a,b) =>
        String(a.date).localeCompare(
          String(b.date)
        )
    );


  for (const trade of sorted) {

    const pl =
      num(trade.profitLoss);

    totalPL += pl;

    equity += pl;

    peak =
      Math.max(
        peak,
        equity
      );

    const drawdown =
      peak - equity;

    maxDrawdown =
      Math.max(
        maxDrawdown,
        drawdown
      );


    if (trade.result === "Win") {

      wins++;

      grossProfit +=
        Math.max(pl,0);

    }

    else if (trade.result === "Loss") {

      losses++;

      grossLoss +=
        Math.abs(
          Math.min(pl,0)
        );

    }

    else {

      breakEven++;

    }


    if (trade.rr > 0) {

      rrSum +=
        num(trade.rr);

      rrCount++;

    }


    if (trade.riskAmount > 0) {

      riskSum +=
        num(trade.riskAmount);

      riskCount++;

    }


    bestTrade =
      Math.max(
        bestTrade,
        pl
      );

    worstTrade =
      Math.min(
        worstTrade,
        pl
      );

  }


  const totalTrades =
    trades.length;

  const winRate =
    totalTrades > 0
      ? (wins / totalTrades) * 100
      : 0;


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const averagePL =
    totalTrades
      ? totalPL / totalTrades
      : 0;


  const averageWin =
    wins
      ? grossProfit / wins
      : 0;


  const averageLoss =
    losses
      ? -grossLoss / losses
      : 0;


  const avgRR =
    rrCount
      ? rrSum / rrCount
      : 0;


  const avgRisk =
    riskCount
      ? riskSum / riskCount
      : 0;


  const recoveryFactor =
    maxDrawdown > 0
      ? totalPL / maxDrawdown
      : 0;


  return {

    totalTrades,
    wins,
    losses,
    breakEven,
    winRate,
    totalPL,
    grossProfit,
    grossLoss,
    profitFactor,
    averagePL,
    averageWin,
    averageLoss,
    avgRR,
    avgRisk,
    bestTrade,
    worstTrade,
    maxDrawdown,
    recoveryFactor,
    expectancy: averagePL

  };

}


function calculateStreaks(trades) {

  const sorted =
    [...trades].sort(
      (a,b) =>
        String(a.date).localeCompare(
          String(b.date)
        )
    );


  let currentWin = 0;
  let currentLoss = 0;

  let bestWin = 0;
  let bestLoss = 0;

  let win = 0;
  let loss = 0;


  for (const trade of sorted) {

    if (trade.result === "Win") {

      win++;
      loss = 0;

      bestWin =
        Math.max(
          bestWin,
          win
        );

    }

    else if (trade.result === "Loss") {

      loss++;
      win = 0;

      bestLoss =
        Math.max(
          bestLoss,
          loss
        );

    }

  }


  for (
    let i = sorted.length - 1;
    i >= 0;
    i--
  ) {

    if (
      sorted[i].result === "Win"
    ) {

      currentWin++;

    } else {

      break;

    }

  }


  for (
    let i = sorted.length - 1;
    i >= 0;
    i--
  ) {

    if (
      sorted[i].result === "Loss"
    ) {

      currentLoss++;

    } else {

      break;

    }

  }


  return {
    currentWin,
    currentLoss,
    bestWin,
    bestLoss
  };

}


function renderAnalytics() {

  const trades =
    getAnalyticsTrades();

  const stats =
    calculateAnalytics(trades);

  const streaks =
    calculateStreaks(trades);


  $("aTotalTrades").textContent =
    stats.totalTrades;

  $("aWins").textContent =
    stats.wins;

  $("aLosses").textContent =
    stats.losses;

  $("aBreakEven").textContent =
    stats.breakEven;

  $("aWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("aTotalPL").textContent =
    money(stats.totalPL);

  $("aProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("aExpectancy").textContent =
    money(stats.expectancy);

  $("aAvgRR").textContent =
    stats.avgRR
      ? `1:${stats.avgRR.toFixed(2)}`
      : "0.00";

  $("aAvgRisk").textContent =
    money(stats.avgRisk);

  $("aAvgWin").textContent =
    money(stats.averageWin);

  $("aAvgLoss").textContent =
    money(stats.averageLoss);

  $("aBestTrade").textContent =
    money(stats.bestTrade);

  $("aWorstTrade").textContent =
    money(stats.worstTrade);

  $("aMaxDrawdown").textContent =
    money(stats.maxDrawdown);

  $("aRecoveryFactor").textContent =
    stats.recoveryFactor.toFixed(2);


  $("currentWinStreak").textContent =
    streaks.currentWin;

  $("currentLossStreak").textContent =
    streaks.currentLoss;

  $("bestWinStreak").textContent =
    streaks.bestWin;

  $("bestLossStreak").textContent =
    streaks.bestLoss;


  renderAnalyticsBreakdown(trades);

  renderDailyPerformance(trades);

  renderMonthlyPerformance(trades);

  drawEquityChart(
    $("analyticsEquityChart"),
    trades
  );

  drawResultChart(
    $("resultChart"),
    trades
  );

}


/* =========================================================
   BREAKDOWN
   ========================================================= */

function getBreakdownLabel(trade, key) {

  const map = {

    pair: trade.pair,

    tradingType:
      trade.tradingType,

    strategy:
      trade.strategy,

    session:
      trade.session,

    direction:
      trade.direction,

    bias:
      trade.bias,

    emotion:
      trade.emotion,

    mistake:
      trade.mistake,

    result:
      trade.result

  };

  return map[key] || "Unknown";

}


function renderAnalyticsBreakdown(trades) {

  const key =
    $("analyticsBreakdown").value;

  const titles = {

    pair: "Performance by Pair",
    tradingType: "Performance by Trading Type",
    strategy: "Performance by Strategy",
    session: "Performance by Session",
    direction: "Performance by Direction",
    bias: "Performance by Market Bias",
    emotion: "Performance by Emotion",
    mistake: "Performance by Mistake",
    result: "Performance by Result"

  };


  $("breakdownTitle").textContent =
    titles[key] ||
    "Performance Breakdown";


  const groups =
    new Map();


  trades.forEach(trade => {

    const label =
      getBreakdownLabel(
        trade,
        key
      );

    if (!groups.has(label)) {

      groups.set(label, []);

    }

    groups.get(label).push(trade);

  });


  if (!groups.size) {

    $("analyticsBreakdownBody").innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:var(--muted);padding:30px">
          No data available.
        </td>
      </tr>
    `;

    return;

  }


  $("analyticsBreakdownBody").innerHTML =
    [...groups.entries()]
      .sort((a,b) => {

        const apl =
          a[1].reduce(
            (sum,t) =>
              sum + num(t.profitLoss),
            0
          );

        const bpl =
          b[1].reduce(
            (sum,t) =>
              sum + num(t.profitLoss),
            0
          );

        return bpl - apl;

      })
      .map(([label, items]) => {

        const s =
          calculateAnalytics(items);


        return `
          <tr>

            <td>
              <strong>
                ${escapeHTML(label)}
              </strong>
            </td>

            <td>${s.totalTrades}</td>

            <td class="result-win">
              ${s.wins}
            </td>

            <td class="result-loss">
              ${s.losses}
            </td>

            <td>
              ${s.winRate.toFixed(1)}%
            </td>

            <td class="${
              s.totalPL >= 0
                ? "pl-positive"
                : "pl-negative"
            }">
              ${money(s.totalPL)}
            </td>

            <td>
              ${money(s.averagePL)}
            </td>

            <td>
              ${s.avgRR
                ? `1:${s.avgRR.toFixed(2)}`
                : "-"}
            </td>

          </tr>
        `;

      })
      .join("");

}


/* =========================================================
   DAILY / MONTHLY
   ========================================================= */

function groupByDate(trades) {

  const map = new Map();

  trades.forEach(trade => {

    if (!map.has(trade.date)) {

      map.set(
        trade.date,
        {
          trades: 0,
          pl: 0
        }
      );

    }

    const item =
      map.get(trade.date);

    item.trades++;

    item.pl +=
      num(trade.profitLoss);

  });

  return map;

}


function renderDailyPerformance(trades) {

  const groups =
    groupByDate(trades);

  const entries =
    [...groups.entries()]
      .sort(
        (a,b) =>
          b[0].localeCompare(a[0])
      )
      .slice(0,30);


  $("dailyPerformanceBody").innerHTML =
    entries.length
      ? entries.map(([date,data]) => `
          <tr>
            <td>${escapeHTML(formatDate(date))}</td>
            <td>${data.trades}</td>
            <td class="${
              data.pl >= 0
                ? "pl-positive"
                : "pl-negative"
            }">
              ${money(data.pl)}
            </td>
          </tr>
        `).join("")
      : `
          <tr>
            <td colspan="3"
              style="text-align:center;color:var(--muted);padding:25px">
              No data.
            </td>
          </tr>
        `;

}


function renderMonthlyPerformance(trades) {

  const map = new Map();

  trades.forEach(trade => {

    const key =
      String(trade.date).slice(0,7);

    if (!map.has(key)) {

      map.set(
        key,
        {
          trades: 0,
          pl: 0
        }
      );

    }

    const item =
      map.get(key);

    item.trades++;

    item.pl +=
      num(trade.profitLoss);

  });


  const entries =
    [...map.entries()]
      .sort(
        (a,b) =>
          b[0].localeCompare(a[0])
      )
      .slice(0,24);


  $("monthlyPerformanceBody").innerHTML =
    entries.length
      ? entries.map(([month,data]) => {

          const [year,m] =
            month.split("-");

          const label =
            new Date(
              Number(year),
              Number(m)-1,
              1
            ).toLocaleDateString(
              "en-US",
              {
                month:"short",
                year:"numeric"
              }
            );


          return `
            <tr>

              <td>${label}</td>

              <td>${data.trades}</td>

              <td class="${
                data.pl >= 0
                  ? "pl-positive"
                  : "pl-negative"
              }">
                ${money(data.pl)}
              </td>

            </tr>
          `;

        }).join("")
      : `
          <tr>
            <td colspan="3"
              style="text-align:center;color:var(--muted);padding:25px">
              No data.
            </td>
          </tr>
        `;

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  const stats =
    calculateAnalytics(
      state.trades
    );


  $("dashTotalTrades").textContent =
    stats.totalTrades;

  $("dashWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("dashTotalPL").textContent =
    money(stats.totalPL);

  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("dashAvgRR").textContent =
    stats.avgRR
      ? `1:${stats.avgRR.toFixed(2)}`
      : "0.00";

  $("dashDrawdown").textContent =
    money(stats.maxDrawdown);


  renderRecentTrades();

  drawEquityChart(
    $("equityChart"),
    state.trades
  );

}


function renderRecentTrades() {

  const trades =
    state.trades.slice(0,8);


  if (!trades.length) {

    $("recentTrades").innerHTML = `
      <div style="color:var(--muted);padding:25px;text-align:center">
        No trades yet.
      </div>
    `;

    return;

  }


  $("recentTrades").innerHTML =
    trades.map(trade => {

      const pl =
        num(trade.profitLoss);


      return `
        <div class="recent-trade">

          <div class="recent-trade-left">

            <strong>
              ${escapeHTML(trade.pair)}
              ·
              ${escapeHTML(trade.direction)}
            </strong>

            <span>
              ${escapeHTML(formatDate(trade.date))}
              ·
              ${escapeHTML(trade.strategy)}
            </span>

          </div>

          <strong class="${
            pl >= 0
              ? "pl-positive"
              : "pl-negative"
          }">

            ${money(pl)}

          </strong>

        </div>
      `;

    }).join("");

}


/* =========================================================
   SIMPLE CANVAS CHARTS
   ========================================================= */

function setupCanvas(canvas) {

  if (!canvas) return null;

  const rect =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    Math.max(
      rect.width * ratio,
      300
    );

  canvas.height =
    Math.max(
      300 * ratio,
      300
    );

  const ctx =
    canvas.getContext("2d");

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  return {
    ctx,
    width: rect.width,
    height: 300
  };

}


function drawEquityChart(canvas, trades) {

  const setup =
    setupCanvas(canvas);

  if (!setup) return;

  const {
    ctx,
    width,
    height
  } = setup;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const sorted =
    [...trades].sort(
      (a,b) =>
        String(a.date).localeCompare(
          String(b.date)
        )
    );


  if (!sorted.length) {

    ctx.fillStyle = "#8c929e";

    ctx.font = "13px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
      "No trading data yet",
      width / 2,
      height / 2
    );

    return;

  }


  let equity = 0;

  const values =
    [0];


  sorted.forEach(trade => {

    equity +=
      num(trade.profitLoss);

    values.push(equity);

  });


  const min =
    Math.min(...values);

  const max =
    Math.max(...values);

  const range =
    max - min || 1;


  const left = 20;
  const right = width - 20;
  const top = 20;
  const bottom = height - 25;


  ctx.strokeStyle =
    "rgba(255,255,255,.08)";

  ctx.lineWidth = 1;


  for (let i=0;i<5;i++) {

    const y =
      top +
      (i/4) *
      (bottom-top);

    ctx.beginPath();

    ctx.moveTo(
      left,
      y
    );

    ctx.lineTo(
      right,
      y
    );

    ctx.stroke();

  }


  ctx.beginPath();


  values.forEach((value,index) => {

    const x =
      left +
      (index /
        Math.max(values.length - 1,1)) *
      (right-left);

    const y =
      bottom -
      ((value-min)/range) *
      (bottom-top);


    if (index === 0) {

      ctx.moveTo(x,y);

    } else {

      ctx.lineTo(x,y);

    }

  });


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth = 2.5;

  ctx.stroke();


  ctx.fillStyle =
    "#8c929e";

  ctx.font =
    "10px Arial";

  ctx.textAlign =
    "left";

  ctx.fillText(
    money(max),
    left,
    12
  );

  ctx.fillText(
    money(min),
    left,
    height - 5
  );

}


function drawResultChart(canvas, trades) {

  const setup =
    setupCanvas(canvas);

  if (!setup) return;

  const {
    ctx,
    width,
    height
  } = setup;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const wins =
    trades.filter(
      t => t.result === "Win"
    ).length;

  const losses =
    trades.filter(
      t => t.result === "Loss"
    ).length;

  const be =
    trades.filter(
      t => t.result === "Break Even"
    ).length;


  const total =
    wins + losses + be;


  if (!total) {

    ctx.fillStyle = "#8c929e";

    ctx.font = "13px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
      "No result data",
      width/2,
      height/2
    );

    return;

  }


  const values =
    [wins,losses,be];

  const labels =
    ["Wins","Losses","Break Even"];


  const max =
    Math.max(...values,1);

  const chartWidth =
    width - 40;

  const barWidth =
    chartWidth / 3 - 20;


  values.forEach((value,index) => {

    const x =
      20 +
      index *
      (chartWidth/3) +
      10;

    const barHeight =
      (value/max) *
      220;

    const y =
      245 - barHeight;


    ctx.fillStyle =
      index === 0
        ? "#36d399"
        : index === 1
          ? "#ff5c70"
          : "#8c929e";


    ctx.fillRect(
      x,
      y,
      barWidth,
      barHeight
    );


    ctx.fillStyle =
      "#f3f4f6";

    ctx.font =
      "11px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      String(value),
      x + barWidth/2,
      y - 7
    );


    ctx.fillStyle =
      "#8c929e";

    ctx.fillText(
      labels[index],
      x + barWidth/2,
      270
    );

  });

}


/* =========================================================
   CSV EXPORT
   ========================================================= */

$("exportCsvBtn").addEventListener(
  "click",
  exportCSV
);


function csvEscape(value) {

  const text =
    String(value ?? "");

  return `"${text.replaceAll('"','""')}"`;

}


function exportCSV() {

  if (!state.trades.length) {

    alert("There are no trades to export.");

    return;

  }


  const headers = [

    "Trade ID",
    "Date",
    "Pair",
    "Trading Type",
    "Direction",
    "Strategy",
    "Session",
    "Market Bias",
    "Entry",
    "SL",
    "TP",
    "RR",
    "Risk Amount",
    "Lot Size",
    "Result",
    "P/L",
    "Confidence",
    "Emotion",
    "Mistake",
    "Notes"

  ];


  const rows =
    state.trades.map(trade => [

      trade.tradeId,
      trade.date,
      trade.pair,
      trade.tradingType,
      trade.direction,
      trade.strategy,
      trade.session,
      trade.bias,
      trade.entry,
      trade.sl,
      trade.tp,
      trade.rr,
      trade.riskAmount,
      trade.lotSize,
      trade.result,
      trade.profitLoss,
      trade.confidence,
      trade.emotion,
      trade.mistake,
      trade.notes

    ]);


  const csv =
    [
      headers,
      ...rows
    ]
      .map(row =>
        row.map(csvEscape).join(",")
      )
      .join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `ujr-fx-trades-${todayString()}.csv`;

  link.click();

  URL.revokeObjectURL(url);

}


/* =========================================================
   RISK CALCULATOR
   ========================================================= */

[
  "calcBalance",
  "calcRiskPercent",
  "calcEntry",
  "calcSL",
  "calcTP",
  "calcDirection"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateRisk
  );

  $(id).addEventListener(
    "change",
    calculateRisk
  );

});


function calculateRisk() {

  const balance =
    num($("calcBalance").value);

  const riskPercent =
    num($("calcRiskPercent").value);

  const entry =
    num($("calcEntry").value);

  const sl =
    num($("calcSL").value);

  const tp =
    num($("calcTP").value);

  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  let stopDistance = 0;
  let rewardDistance = 0;


  if (direction === "Buy") {

    stopDistance =
      entry - sl;

    rewardDistance =
      tp - entry;

  } else {

    stopDistance =
      sl - entry;

    rewardDistance =
      entry - tp;

  }


  const rr =
    stopDistance > 0 &&
    rewardDistance > 0
      ? rewardDistance /
        stopDistance
      : 0;


  const lot =
    stopDistance > 0
      ? riskAmount /
        (stopDistance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);

  $("calcStopDistance").textContent =
    stopDistance > 0
      ? stopDistance.toFixed(2)
      : "0";

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0.00";

  $("calcLotSize").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";

}


calculateRisk();


/* =========================================================
   CALENDAR
   ========================================================= */

$("prevMonth").addEventListener(
  "click",
  () => {

    state.calendarDate.setMonth(
      state.calendarDate.getMonth() - 1
    );

    renderCalendar();

  }
);


$("nextMonth").addEventListener(
  "click",
  () => {

    state.calendarDate.setMonth(
      state.calendarDate.getMonth() + 1
    );

    renderCalendar();

  }
);


function renderCalendar() {

  const year =
    state.calendarDate.getFullYear();

  const month =
    state.calendarDate.getMonth();


  $("calendarTitle").textContent =
    new Date(
      year,
      month,
      1
    ).toLocaleDateString(
      "en-US",
      {
        month:"long",
        year:"numeric"
      }
    );


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const grid =
    $("calendarGrid");

  grid.innerHTML = "";


  for (
    let i=0;
    i<firstDay;
    i++
  ) {

    const empty =
      document.createElement("div");

    empty.className =
      "calendar-day empty";

    grid.appendChild(empty);

  }


  for (
    let day=1;
    day<=daysInMonth;
    day++
  ) {

    const date =
      `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


    const trades =
      state.trades.filter(
        t => t.date === date
      );


    const pl =
      trades.reduce(
        (sum,t) =>
          sum + num(t.profitLoss),
        0
      );


    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";


    if (date === todayString()) {

      cell.classList.add("today");

    }


    cell.innerHTML = `

      <div class="calendar-number">
        ${day}
      </div>

      ${
        trades.length
          ? `
            <div class="calendar-pl ${
              pl >= 0
                ? "pl-positive"
                : "pl-negative"
            }">
              ${money(pl)}
            </div>

            <div class="calendar-trades">
              ${trades.length} trade${trades.length === 1 ? "" : "s"}
            </div>
          `
          : ""
      }

    `;


    cell.addEventListener(
      "click",
      () => showCalendarDay(date)
    );


    grid.appendChild(cell);

  }

}


function showCalendarDay(date) {

  state.selectedCalendarDate =
    date;


  const trades =
    state.trades.filter(
      t => t.date === date
    );


  $("selectedDayTrades").innerHTML =
    trades.length
      ? trades.map(trade => `

          <div class="recent-trade">

            <div class="recent-trade-left">

              <strong>
                ${escapeHTML(trade.pair)}
                ·
                ${escapeHTML(trade.direction)}
              </strong>

              <span>
                ${escapeHTML(trade.strategy)}
                ·
                ${escapeHTML(trade.result)}
              </span>

            </div>

            <strong class="${
              trade.profitLoss >= 0
                ? "pl-positive"
                : "pl-negative"
            }">

              ${money(trade.profitLoss)}

            </strong>

          </div>

        `).join("")
      : `
          <div style="color:var(--muted);padding:20px 0">
            No trades on ${formatDate(date)}.
          </div>
        `;

}


/* =========================================================
   SETTINGS
   ========================================================= */

async function loadSettings() {

  if (!state.user) return;

  try {

    const reference =
      doc(
        db,
        "users",
        state.user.uid,
        "settings",
        "profile"
      );


    const snapshot =
      await getDoc(reference);


    if (snapshot.exists()) {

      const data =
        snapshot.data();


      state.currency =
        data.currency ||
        "USD";

      state.startingBalance =
        num(
          data.startingBalance
        );

    } else {

      state.currency =
        "USD";

      state.startingBalance =
        0;

    }


    $("startingBalance").value =
      state.startingBalance;

    $("currency").value =
      state.currency;

  } catch (error) {

    console.error(
      "Load settings error:",
      error
    );

  }

}


$("saveSettingsBtn").addEventListener(
  "click",
  saveSettings
);


async function saveSettings() {

  if (!state.user) return;

  const startingBalance =
    num(
      $("startingBalance").value
    );

  const currency =
    $("currency").value;


  try {

    await setDoc(
      doc(
        db,
        "users",
        state.user.uid,
        "settings",
        "profile"
      ),
      {
        startingBalance,
        currency,
        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    );


    state.startingBalance =
      startingBalance;

    state.currency =
      currency;


    $("settingsMessage").textContent =
      "Settings saved successfully.";

    renderDashboard();
    renderJournal();
    renderAnalytics();
    renderCalendar();


    setTimeout(() => {

      $("settingsMessage").textContent = "";

    },3000);


  } catch (error) {

    console.error(
      "Save settings error:",
      error
    );

    $("settingsMessage").textContent =
      error.message ||
      "Could not save settings.";

  }

}


/* =========================================================
   WINDOW RESIZE
   ========================================================= */

let resizeTimer;

window.addEventListener(
  "resize",
  () => {

    clearTimeout(resizeTimer);

    resizeTimer =
      setTimeout(() => {

        if (
          state.currentPage ===
          "dashboardPage"
        ) {

          drawEquityChart(
            $("equityChart"),
            state.trades
          );

        }

        if (
          state.currentPage ===
          "analyticsPage"
        ) {

          const trades =
            getAnalyticsTrades();

          drawEquityChart(
            $("analyticsEquityChart"),
            trades
          );

          drawResultChart(
            $("resultChart"),
            trades
          );

        }

      },150);

  }
);


/* =========================================================
   INITIAL
   ========================================================= */

$("tradeDate").value =
  todayString();

$("tradeId").value =
  generateTradeId();

console.log(
  "UjR Fx Trading Journal loaded."
);
