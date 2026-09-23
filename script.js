/* =========================================================
   UjR Fx Trading Journal
   Firebase Auth + Firestore
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
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
  settings: {
    startingBalance: 0,
    currency: "USD"
  },
  unsubscribeTrades: null,
  unsubscribeSettings: null,
  editingTradeId: null,
  calendarDate: new Date(),
  analyticsPeriod: "all",
  analyticsFrom: "",
  analyticsTo: ""
};


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  const currency = state.settings.currency || "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num(value));
}

function formatPercent(value) {
  return `${num(value).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayString() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function currentTimeString() {
  const d = new Date();

  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function sortTrades(trades) {
  return [...trades].sort((a, b) => {

    const aKey = `${a.date || ""} ${a.time || ""}`;
    const bKey = `${b.date || ""} ${b.time || ""}`;

    return aKey.localeCompare(bKey);
  });
}

function showToast(message, type = "success") {

  const toast = $("toast");

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 2800);
}

function friendlyAuthError(error) {

  const code = error?.code || "";

  const messages = {
    "auth/unauthorized-domain":
      "This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.",

    "auth/operation-not-allowed":
      "Google sign-in is not enabled in Firebase Authentication.",

    "auth/popup-blocked":
      "The Google sign-in popup was blocked. Redirect sign-in will be attempted.",

    "auth/popup-closed-by-user":
      "The Google sign-in window was closed.",

    "auth/api-key-not-valid":
      "The Firebase API key is not valid.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "auth/cancelled-popup-request":
      "Another sign-in request is already running."
  };

  return messages[code] || error?.message || "Google sign-in failed.";
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(pageId) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const page = $(pageId);

  if (page) {
    page.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageId
    );
  });

  const titles = {
    dashboardPage: "Dashboard",
    journalPage: "Journal",
    analyticsPage: "Analytics",
    riskPage: "Risk Calculator",
    calendarPage: "Calendar",
    settingsPage: "Settings"
  };

  $("pageTitle").textContent = titles[pageId] || "Trading Journal";

  closeMobileMenu();

  if (pageId === "analyticsPage") {
    setTimeout(renderAnalytics, 30);
  }

  if (pageId === "calendarPage") {
    renderCalendar();
  }

  if (pageId === "riskPage") {
    syncRiskCalculatorBalance();
  }
}

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });

});


document.querySelectorAll("[data-page-target]").forEach(button => {

  button.addEventListener("click", () => {
    showPage(button.dataset.pageTarget);
  });

});


/* =========================================================
   MOBILE MENU
   ========================================================= */

function openMobileMenu() {

  $("sidebar").classList.add("open");
  $("overlay").classList.add("show");
}

function closeMobileMenu() {

  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
}

$("mobileMenuBtn").addEventListener("click", openMobileMenu);
$("closeSidebar").addEventListener("click", closeMobileMenu);
$("overlay").addEventListener("click", closeMobileMenu);


/* =========================================================
   DATE
   ========================================================= */

$("currentDate").textContent = new Date().toLocaleDateString(
  undefined,
  {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  }
);


/* =========================================================
   AUTH
   ========================================================= */

$("loginBtn").addEventListener("click", async () => {

  try {

    $("loginBtn").disabled = true;
    $("loginError").textContent = "";

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error("Google sign-in error:", error);

    if (error?.code === "auth/popup-blocked") {

      try {

        await signInWithRedirect(auth, provider);
        return;

      } catch (redirectError) {

        console.error(redirectError);

        $("loginError").textContent =
          friendlyAuthError(redirectError);
      }

    } else {

      $("loginError").textContent =
        friendlyAuthError(error);
    }

  } finally {

    $("loginBtn").disabled = false;
  }

});


$("logoutBtn").addEventListener("click", async () => {

  try {

    if (state.unsubscribeTrades) {
      state.unsubscribeTrades();
      state.unsubscribeTrades = null;
    }

    if (state.unsubscribeSettings) {
      state.unsubscribeSettings();
      state.unsubscribeSettings = null;
    }

    await signOut(auth);

  } catch (error) {

    console.error(error);
    showToast("Logout failed.", "error");
  }

});


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(auth, async user => {

  if (user) {

    state.user = user;

    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    $("userName").textContent =
      user.displayName || "Trader";

    $("userEmail").textContent =
      user.email || "";

    if (user.photoURL) {
      $("userPhoto").src = user.photoURL;
    }

    await saveUserProfile(user);
    listenToSettings(user);
    listenToTrades(user);

    renderAll();

  } else {

    state.user = null;
    state.trades = [];

    $("app").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");

  }

});


/* =========================================================
   REDIRECT RESULT
   ========================================================= */

(async function handleRedirect() {

  try {

    await getRedirectResult(auth);

  } catch (error) {

    console.error(error);

    $("loginError").textContent =
      friendlyAuthError(error);
  }

})();


/* =========================================================
   USER PROFILE
   ========================================================= */

async function saveUserProfile(user) {

  try {

    await setDoc(
      doc(db, "users", user.uid),
      {
        name: user.displayName || "Trader",
        email: user.email || "",
        photo: user.photoURL || "",
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

  } catch (error) {

    console.error("Profile save error:", error);
  }
}


/* =========================================================
   FIRESTORE SETTINGS
   ========================================================= */

function listenToSettings(user) {

  if (state.unsubscribeSettings) {
    state.unsubscribeSettings();
  }

  const settingsRef =
    doc(db, "users", user.uid, "settings", "main");

  state.unsubscribeSettings = onSnapshot(
    settingsRef,
    snapshot => {

      if (snapshot.exists()) {

        const data = snapshot.data();

        state.settings = {
          startingBalance: num(data.startingBalance),
          currency: data.currency || "USD"
        };

      } else {

        state.settings = {
          startingBalance: 0,
          currency: "USD"
        };
      }

      $("startingBalance").value =
        state.settings.startingBalance || "";

      $("currency").value =
        state.settings.currency || "USD";

      renderAll();

    },
    error => {

      console.error("Settings listener error:", error);
    }
  );
}


/* =========================================================
   FIRESTORE TRADES
   ========================================================= */

function listenToTrades(user) {

  if (state.unsubscribeTrades) {
    state.unsubscribeTrades();
  }

  const tradesRef =
    collection(db, "users", user.uid, "trades");

  state.unsubscribeTrades = onSnapshot(
    tradesRef,
    snapshot => {

      state.trades = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      state.trades = sortTrades(state.trades);

      renderAll();

    },
    error => {

      console.error("Trades listener error:", error);

      showToast(
        "Could not load trades. Check Firestore rules.",
        "error"
      );
    }
  );
}


/* =========================================================
   TRADE RR
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


/* =========================================================
   RISK / LOT
   ========================================================= */

function calculateModalRisk() {

  const balance = num(state.settings.startingBalance);
  const riskPercent = num($("riskPercent").value);

  const entry = num($("entry").value);
  const sl = num($("sl").value);

  const riskAmount =
    balance * riskPercent / 100;

  $("riskAmount").value =
    riskAmount ? riskAmount.toFixed(2) : "";

  const distance =
    Math.abs(entry - sl);

  if (
    riskAmount <= 0 ||
    distance <= 0
  ) {
    return;
  }

  const estimatedLot =
    riskAmount / (distance * 100);

  if ($("lotSize").dataset.manual !== "true") {

    $("lotSize").value =
      estimatedLot.toFixed(2);
  }
}


/* =========================================================
   NORMALIZE P/L
   ========================================================= */

function normalizeProfitLossByResult() {

  const result = $("result").value;
  const input = $("profitLoss");

  const raw = input.value.trim();

  if (result === "Loss") {

    const value = Math.abs(Number(raw) || 0);

    input.value =
      value ? (-value).toFixed(2) : "";

  } else if (result === "Win") {

    const value = Math.abs(Number(raw) || 0);

    input.value =
      value ? value.toFixed(2) : "";

  } else if (result === "Break Even") {

    input.value = "0";
  }
}

function getNormalizedPL() {

  const result = $("result").value;

  let value =
    Number($("profitLoss").value) || 0;

  if (result === "Loss") {

    value = -Math.abs(value);

  } else if (result === "Win") {

    value = Math.abs(value);

  } else if (result === "Break Even") {

    value = 0;
  }

  return Number(value.toFixed(2));
}


/* =========================================================
   TRADE MODAL
   ========================================================= */

function openTradeModal(tradeId = null) {

  state.editingTradeId = tradeId;

  $("tradeError").textContent = "";

  $("tradeForm").reset();

  $("tradeId").value = "";
  $("modalTitle").textContent = "Add Trade";

  $("tradeDate").value = todayString();
  $("tradeTime").value = currentTimeString();

  $("pair").value = "XAUUSD";
  $("tradingType").value = "Scalping";
  $("direction").value = "Buy";
  $("riskPercent").value = "1";

  $("lotSize").dataset.manual = "false";

  if (tradeId) {

    const trade =
      state.trades.find(item => item.id === tradeId);

    if (!trade) return;

    $("modalTitle").textContent = "Edit Trade";

    $("tradeId").value = trade.id;

    $("tradeDate").value =
      trade.date || todayString();

    $("tradeTime").value =
      trade.time || currentTimeString();

    $("pair").value =
      trade.pair || "XAUUSD";

    $("tradingType").value =
      trade.tradingType || "Scalping";

    $("direction").value =
      trade.direction || "Buy";

    $("entry").value =
      trade.entry ?? "";

    $("sl").value =
      trade.sl ?? "";

    $("tp").value =
      trade.tp ?? "";

    $("riskPercent").value =
      trade.riskPercent ?? 1;

    $("riskAmount").value =
      trade.riskAmount ?? "";

    $("lotSize").value =
      trade.lotSize ?? "";

    if (trade.lotSize) {
      $("lotSize").dataset.manual = "true";
    }

    $("setup").value =
      trade.setup || "";

    $("session").value =
      trade.session || "";

    $("htfBias").value =
      trade.htfBias || "";

    $("liquidity").value =
      trade.liquidity || "";

    $("confirmation").value =
      trade.confirmation || "";

    $("result").value =
      trade.result || "";

    $("profitLoss").value =
      trade.profitLoss ?? "";

    $("confidence").value =
      trade.confidence ?? "";

    $("psychology").value =
      trade.psychology || "";

    $("mistake").value =
      trade.mistake || "";

    $("notes").value =
      trade.notes || "";

    calculateTradeRR();

  }

  $("tradeModal").classList.remove("hidden");

  calculateModalRisk();
}


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");
  state.editingTradeId = null;
}

$("journalAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("quickAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("mobileAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("closeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);

$("modalBackdrop").addEventListener(
  "click",
  closeTradeModal
);


/* =========================================================
   MODAL INPUT EVENTS
   ========================================================= */

["entry", "sl", "tp", "direction"].forEach(id => {

  $(id).addEventListener("input", () => {

    calculateTradeRR();
    calculateModalRisk();

  });

  $(id).addEventListener("change", () => {

    calculateTradeRR();
    calculateModalRisk();

  });

});


$("riskPercent").addEventListener(
  "input",
  calculateModalRisk
);


$("lotSize").addEventListener(
  "input",
  () => {
    $("lotSize").dataset.manual = "true";
  }
);


$("result").addEventListener(
  "change",
  normalizeProfitLossByResult
);


$("profitLoss").addEventListener(
  "input",
  normalizeProfitLossByResult
);


/* =========================================================
   SAVE TRADE
   ========================================================= */

$("tradeForm").addEventListener("submit", async event => {

  event.preventDefault();

  if (!state.user) {
    return;
  }

  $("tradeError").textContent = "";

  const date = $("tradeDate").value;
  const time = $("tradeTime").value;
  const pair = $("pair").value.trim();

  const tradingType =
    $("tradingType").value;

  const direction =
    $("direction").value;

  const entry =
    num($("entry").value);

  const sl =
    num($("sl").value);

  const tp =
    num($("tp").value);

  const result =
    $("result").value;

  if (!date || !pair) {

    $("tradeError").textContent =
      "Date and pair are required.";

    return;
  }

  if (
    entry <= 0 ||
    sl <= 0 ||
    tp <= 0
  ) {

    $("tradeError").textContent =
      "Entry, SL and TP must be greater than zero.";

    return;
  }

  if (!result) {

    $("tradeError").textContent =
      "Please select a result.";

    return;
  }

  const rr = calculateTradeRR();

  if (!rr) {

    $("tradeError").textContent =
      "Entry, SL and TP do not create a valid RR for this direction.";

    return;
  }

  normalizeProfitLossByResult();

  const profitLoss =
    getNormalizedPL();

  const riskPercent =
    num($("riskPercent").value);

  const balance =
    num(state.settings.startingBalance);

  const riskAmount =
    balance * riskPercent / 100;

  let lotSize =
    num($("lotSize").value);

  if (
    !lotSize ||
    $("lotSize").dataset.manual !== "true"
  ) {

    const distance =
      Math.abs(entry - sl);

    if (
      distance > 0 &&
      riskAmount > 0
    ) {

      lotSize =
        riskAmount / (distance * 100);
    }
  }


  const tradeData = {

    date,
    time,

    pair,

    tradingType,

    direction,

    entry,
    sl,
    tp,

    rr: Number(rr.toFixed(4)),

    riskPercent,

    riskAmount:
      Number(riskAmount.toFixed(2)),

    lotSize:
      Number(lotSize.toFixed(2)),

    setup:
      $("setup").value,

    session:
      $("session").value,

    htfBias:
      $("htfBias").value,

    liquidity:
      $("liquidity").value,

    confirmation:
      $("confirmation").value,

    result,

    profitLoss,

    confidence:
      $("confidence").value
        ? num($("confidence").value)
        : 0,

    psychology:
      $("psychology").value,

    mistake:
      $("mistake").value,

    notes:
      $("notes").value.trim(),

    updatedAt:
      new Date().toISOString()
  };


  try {

    const tradesRef =
      collection(
        db,
        "users",
        state.user.uid,
        "trades"
      );


    if (state.editingTradeId) {

      await updateDoc(
        doc(
          db,
          "users",
          state.user.uid,
          "trades",
          state.editingTradeId
        ),
        tradeData
      );

      showToast("Trade updated.");

    } else {

      await addDoc(
        tradesRef,
        {
          ...tradeData,
          createdAt:
            new Date().toISOString()
        }
      );

      showToast("Trade added.");
    }

    closeTradeModal();

  } catch (error) {

    console.error("Save trade error:", error);

    $("tradeError").textContent =
      error.message || "Could not save trade.";
  }

});


/* =========================================================
   DELETE TRADE
   ========================================================= */

async function deleteTrade(tradeId) {

  if (!state.user) return;

  const confirmed =
    confirm("Delete this trade permanently?");

  if (!confirmed) return;

  try {

    await deleteDoc(
      doc(
        db,
        "users",
        state.user.uid,
        "trades",
        tradeId
      )
    );

    showToast("Trade deleted.");

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade.",
      "error"
    );
  }
}


/* =========================================================
   EDIT TRADE
   ========================================================= */

function editTrade(tradeId) {
  openTradeModal(tradeId);
}


/* =========================================================
   FILTERED JOURNAL
   ========================================================= */

function getJournalTrades() {

  const result =
    $("filterResult").value;

  const pair =
    $("filterPair").value
      .trim()
      .toLowerCase();

  const date =
    $("filterDate").value;

  return state.trades.filter(trade => {

    if (
      result &&
      trade.result !== result
    ) {
      return false;
    }

    if (
      pair &&
      !String(trade.pair || "")
        .toLowerCase()
        .includes(pair)
    ) {
      return false;
    }

    if (
      date &&
      trade.date !== date
    ) {
      return false;
    }

    return true;
  });
}


function renderJournal() {

  const trades =
    getJournalTrades();

  const wins =
    trades.filter(t => t.result === "Win").length;

  const losses =
    trades.filter(t => t.result === "Loss").length;

  const pl =
    trades.reduce(
      (sum, t) => sum + num(t.profitLoss),
      0
    );

  $("journalTrades").textContent =
    trades.length;

  $("journalWins").textContent =
    wins;

  $("journalLosses").textContent =
    losses;

  $("journalPL").textContent =
    formatMoney(pl);

  $("journalPL").className =
    pl > 0
      ? "positive"
      : pl < 0
        ? "negative"
        : "";


  const body =
    $("journalTableBody");

  body.innerHTML = "";


  if (!trades.length) {

    $("journalEmpty").classList.remove("hidden");
    return;

  }

  $("journalEmpty").classList.add("hidden");


  [...trades]
    .reverse()
    .forEach(trade => {

      const tr =
        document.createElement("tr");

      const plValue =
        num(trade.profitLoss);

      let resultClass =
        "result-be";

      if (trade.result === "Win") {
        resultClass = "result-win";
      }

      if (trade.result === "Loss") {
        resultClass = "result-loss";
      }

      tr.innerHTML = `

        <td>${escapeHtml(trade.date || "—")}</td>

        <td>
          <strong>${escapeHtml(trade.pair || "—")}</strong>
        </td>

        <td>
          ${escapeHtml(trade.tradingType || "—")}
        </td>

        <td>
          ${escapeHtml(trade.direction || "—")}
        </td>

        <td>
          ${escapeHtml(trade.setup || "—")}
        </td>

        <td>
          ${num(trade.entry).toFixed(3)}
        </td>

        <td>
          1:${num(trade.rr).toFixed(2)}
        </td>

        <td>
          <span class="result-chip ${resultClass}">
            ${escapeHtml(trade.result || "—")}
          </span>
        </td>

        <td class="${plValue > 0 ? "positive" : plValue < 0 ? "negative" : "neutral"}">
          ${formatMoney(plValue)}
        </td>

        <td>
          <button
            class="action-btn"
            data-action="edit"
            data-id="${trade.id}">
            Edit
          </button>

          <button
            class="action-btn action-delete"
            data-action="delete"
            data-id="${trade.id}">
            Delete
          </button>
        </td>
      `;

      body.appendChild(tr);
    });
}


$("journalTableBody").addEventListener(
  "click",
  event => {

    const button =
      event.target.closest("[data-action]");

    if (!button) return;

    const id =
      button.dataset.id;

    if (button.dataset.action === "edit") {
      editTrade(id);
    }

    if (button.dataset.action === "delete") {
      deleteTrade(id);
    }

  }
);


["filterResult", "filterPair", "filterDate"].forEach(id => {

  $(id).addEventListener(
    "input",
    renderJournal
  );

  $(id).addEventListener(
    "change",
    renderJournal
  );

});


$("clearFilters").addEventListener(
  "click",
  () => {

    $("filterResult").value = "";
    $("filterPair").value = "";
    $("filterDate").value = "";

    renderJournal();
  }
);


/* =========================================================
   DASHBOARD
   ========================================================= */

function getAllStats(trades) {

  const total =
    trades.length;

  const wins =
    trades.filter(t => t.result === "Win");

  const losses =
    trades.filter(t => t.result === "Loss");

  const decided =
    wins.length + losses.length;

  const pl =
    trades.reduce(
      (sum, t) => sum + num(t.profitLoss),
      0
    );

  const winRate =
    decided
      ? wins.length / decided * 100
      : 0;

  const grossProfit =
    wins.reduce(
      (sum, t) => sum + Math.abs(num(t.profitLoss)),
      0
    );

  const grossLoss =
    losses.reduce(
      (sum, t) => sum + Math.abs(num(t.profitLoss)),
      0
    );

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const avgRValues =
    trades
      .filter(t => num(t.riskAmount) > 0)
      .map(t =>
        num(t.profitLoss) /
        num(t.riskAmount)
      );

  const avgR =
    avgRValues.length
      ? avgRValues.reduce((a, b) => a + b, 0) /
        avgRValues.length
      : 0;

  const expectancy =
    total
      ? pl / total
      : 0;

  const avgWin =
    wins.length
      ? grossProfit / wins.length
      : 0;

  const avgLoss =
    losses.length
      ? -(grossLoss / losses.length)
      : 0;

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    breakeven:
      trades.filter(t => t.result === "Break Even").length,
    pl,
    winRate,
    grossProfit,
    grossLoss,
    profitFactor,
    avgR,
    expectancy,
    avgWin,
    avgLoss
  };
}


function calculateDrawdown(trades) {

  const ordered =
    sortTrades(trades);

  let equity =
    num(state.settings.startingBalance);

  let peak =
    equity;

  let maxDD =
    0;

  let maxDDPct =
    0;

  let currentDD =
    0;

  ordered.forEach(trade => {

    equity += num(trade.profitLoss);

    if (equity > peak) {
      peak = equity;
    }

    const dd =
      equity - peak;

    if (dd < maxDD) {
      maxDD = dd;

      if (peak > 0) {
        maxDDPct =
          Math.abs(dd) / peak * 100;
      }
    }

  });

  currentDD =
    equity - peak;

  return {
    maxDD,
    maxDDPct,
    currentDD
  };
}


function renderDashboard() {

  const stats =
    getAllStats(state.trades);

  $("totalTrades").textContent =
    stats.total;

  $("winRate").textContent =
    formatPercent(stats.winRate);

  $("totalPL").textContent =
    formatMoney(stats.pl);

  $("currentBalance").textContent =
    formatMoney(
      num(state.settings.startingBalance) +
      stats.pl
    );

  $("dashProfitFactor").textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor
        ? stats.profitFactor.toFixed(2)
        : "—";

  $("dashAvgR").textContent =
    `${stats.avgR.toFixed(2)}R`;

  $("dashExpectancy").textContent =
    formatMoney(stats.expectancy);

  const dd =
    calculateDrawdown(state.trades);

  $("dashDrawdown").textContent =
    formatMoney(Math.abs(dd.maxDD));


  const recent =
    [...state.trades]
      .reverse()
      .slice(0, 7);

  const body =
    $("recentTradesBody");

  body.innerHTML = "";

  if (!recent.length) {

    $("recentEmpty").classList.remove("hidden");

  } else {

    $("recentEmpty").classList.add("hidden");

    recent.forEach(trade => {

      const tr =
        document.createElement("tr");

      const pl =
        num(trade.profitLoss);

      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";

      tr.innerHTML = `

        <td>${escapeHtml(trade.date || "—")}</td>

        <td>${escapeHtml(trade.pair || "—")}</td>

        <td>${escapeHtml(trade.tradingType || "—")}</td>

        <td>
          <span class="result-chip ${resultClass}">
            ${escapeHtml(trade.result || "—")}
          </span>
        </td>

        <td class="${pl > 0 ? "positive" : pl < 0 ? "negative" : "neutral"}">
          ${formatMoney(pl)}
        </td>
      `;

      body.appendChild(tr);
    });
  }

  drawEquityCurve(
    $("equityCanvas"),
    state.trades
  );
}


/* =========================================================
   ANALYTICS FILTER
   ========================================================= */

function getAnalyticsTrades() {

  const all =
    sortTrades(state.trades);

  const period =
    state.analyticsPeriod;

  if (period === "all") {
    return all;
  }

  const now =
    new Date();

  if (period === "month") {

    const year =
      now.getFullYear();

    const month =
      now.getMonth();

    return all.filter(trade => {

      const d =
        new Date(`${trade.date}T00:00:00`);

      return (
        d.getFullYear() === year &&
        d.getMonth() === month
      );
    });
  }

  if (
    period === "7" ||
    period === "30"
  ) {

    const days =
      Number(period);

    const from =
      new Date();

    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    return all.filter(trade => {

      const d =
        new Date(`${trade.date}T00:00:00`);

      return d >= from && d <= now;
    });
  }

  if (period === "custom") {

    const from =
      state.analyticsFrom
        ? new Date(`${state.analyticsFrom}T00:00:00`)
        : null;

    const to =
      state.analyticsTo
        ? new Date(`${state.analyticsTo}T23:59:59`)
        : null;

    return all.filter(trade => {

      const d =
        new Date(`${trade.date}T00:00:00`);

      if (from && d < from) return false;
      if (to && d > to) return false;

      return true;
    });
  }

  return all;
}


/* =========================================================
   ANALYTICS GROUPING
   ========================================================= */

function groupPerformance(
  trades,
  field
) {

  const map = {};

  trades.forEach(trade => {

    const key =
      trade[field] ||
      "Unspecified";

    if (!map[key]) {

      map[key] = {
        name: key,
        trades: 0,
        wins: 0,
        losses: 0,
        be: 0,
        pl: 0,
        rValues: []
      };
    }

    const item =
      map[key];

    item.trades++;

    if (trade.result === "Win") {
      item.wins++;
    }

    if (trade.result === "Loss") {
      item.losses++;
    }

    if (trade.result === "Break Even") {
      item.be++;
    }

    item.pl +=
      num(trade.profitLoss);

    if (num(trade.riskAmount) > 0) {

      item.rValues.push(
        num(trade.profitLoss) /
        num(trade.riskAmount)
      );
    }

  });

  return Object.values(map)
    .sort((a, b) => b.trades - a.trades);
}


function renderPerformanceTable(
  elementId,
  rows,
  includeRR = false
) {

  const body =
    $(elementId);

  body.innerHTML = "";

  rows.forEach(item => {

    const decided =
      item.wins + item.losses;

    const winRate =
      decided
        ? item.wins / decided * 100
        : 0;

    const avgR =
      item.rValues.length
        ? item.rValues.reduce((a, b) => a + b, 0) /
          item.rValues.length
        : 0;

    const tr =
      document.createElement("tr");

    if (includeRR) {

      tr.innerHTML = `
        <td>${escapeHtml(item.name)}</td>
        <td>${item.trades}</td>
        <td>${item.wins}</td>
        <td>${item.losses}</td>
        <td>${formatPercent(winRate)}</td>
        <td class="${item.pl > 0 ? "positive" : item.pl < 0 ? "negative" : "neutral"}">
          ${formatMoney(item.pl)}
        </td>
        <td>${avgR.toFixed(2)}R</td>
      `;

    } else {

      tr.innerHTML = `
        <td>${escapeHtml(item.name)}</td>
        <td>${item.trades}</td>
        <td>${item.wins}</td>
        <td>${item.losses}</td>
        <td>${formatPercent(winRate)}</td>
        <td class="${item.pl > 0 ? "positive" : item.pl < 0 ? "negative" : "neutral"}">
          ${formatMoney(item.pl)}
        </td>
      `;
    }

    body.appendChild(tr);
  });
}


/* =========================================================
   ANALYTICS STREAKS
   ========================================================= */

function calculateStreaks(trades) {

  const ordered =
    sortTrades(trades);

  let currentWin = 0;
  let currentLoss = 0;

  let bestWin = 0;
  let worstLoss = 0;

  let tempWin = 0;
  let tempLoss = 0;

  ordered.forEach(trade => {

    if (trade.result === "Win") {

      tempWin++;
      tempLoss = 0;

      bestWin =
        Math.max(bestWin, tempWin);

    } else if (trade.result === "Loss") {

      tempLoss++;
      tempWin = 0;

      worstLoss =
        Math.max(worstLoss, tempLoss);

    } else {

      tempWin = 0;
      tempLoss = 0;
    }

  });


  for (
    let i = ordered.length - 1;
    i >= 0;
    i--
  ) {

    if (ordered[i].result === "Win") {
      currentWin++;
    } else {
      break;
    }
  }

  for (
    let i = ordered.length - 1;
    i >= 0;
    i--
  ) {

    if (ordered[i].result === "Loss") {
      currentLoss++;
    } else {
      break;
    }
  }


  return {
    currentWin,
    currentLoss,
    bestWin,
    worstLoss
  };
}


/* =========================================================
   ANALYTICS RENDER
   ========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();

  const stats =
    getAllStats(trades);

  $("analyticsTrades").textContent =
    stats.total;

  $("analyticsWinRate").textContent =
    formatPercent(stats.winRate);

  $("analyticsRR").textContent =
    stats.avgR
      ? `1:${Math.abs(stats.avgR).toFixed(2)}`
      : "—";

  $("analyticsPL").textContent =
    formatMoney(stats.pl);

  $("analyticsPL").className =
    stats.pl > 0
      ? "positive"
      : stats.pl < 0
        ? "negative"
        : "";

  $("analyticsWins").textContent =
    stats.wins;

  $("analyticsLosses").textContent =
    stats.losses;

  $("analyticsBE").textContent =
    stats.breakeven;

  $("analyticsProfitFactor").textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor
        ? stats.profitFactor.toFixed(2)
        : "—";

  $("analyticsExpectancy").textContent =
    formatMoney(stats.expectancy);

  $("analyticsAvgWin").textContent =
    formatMoney(stats.avgWin);

  $("analyticsAvgLoss").textContent =
    formatMoney(stats.avgLoss);

  const best =
    trades.length
      ? Math.max(
          ...trades.map(t => num(t.profitLoss))
        )
      : 0;

  const worst =
    trades.length
      ? Math.min(
          ...trades.map(t => num(t.profitLoss))
        )
      : 0;

  $("analyticsBestTrade").textContent =
    formatMoney(best);

  $("analyticsWorstTrade").textContent =
    formatMoney(worst);

  $("analyticsAvgR").textContent =
    `${stats.avgR.toFixed(2)}R`;


  const risks =
    trades
      .map(t => num(t.riskPercent))
      .filter(v => v > 0);

  const avgRisk =
    risks.length
      ? risks.reduce((a, b) => a + b, 0) /
        risks.length
      : 0;

  const maxRisk =
    risks.length
      ? Math.max(...risks)
      : 0;

  const riskViolations =
    risks.filter(v => v > 2).length;

  $("analyticsAvgRisk").textContent =
    formatPercent(avgRisk);

  $("analyticsMaxRisk").textContent =
    formatPercent(maxRisk);

  $("analyticsRiskViolations").textContent =
    riskViolations;


  const confidenceValues =
    trades
      .map(t => num(t.confidence))
      .filter(v => v > 0);

  const avgConfidence =
    confidenceValues.length
      ? confidenceValues.reduce((a, b) => a + b, 0) /
        confidenceValues.length
      : 0;

  $("analyticsAvgConfidence").textContent =
    `${avgConfidence.toFixed(1)}/10`;


  const dd =
    calculateDrawdown(trades);

  $("analyticsMaxDD").textContent =
    formatMoney(Math.abs(dd.maxDD));

  $("analyticsMaxDDPct").textContent =
    formatPercent(dd.maxDDPct);

  $("analyticsCurrentDD").textContent =
    formatMoney(dd.currentDD);


  const streaks =
    calculateStreaks(trades);

  $("analyticsCurrentWinStreak").textContent =
    streaks.currentWin;

  $("analyticsCurrentLossStreak").textContent =
    streaks.currentLoss;

  $("analyticsBestWinStreak").textContent =
    streaks.bestWin;

  $("analyticsWorstLossStreak").textContent =
    streaks.worstLoss;


  const total =
    trades.length || 1;

  $("winBar").style.width =
    `${stats.wins / total * 100}%`;

  $("lossBar").style.width =
    `${stats.losses / total * 100}%`;

  $("beBar").style.width =
    `${stats.breakeven / total * 100}%`;

  $("winBarLabel").textContent =
    stats.wins;

  $("lossBarLabel").textContent =
    stats.losses;

  $("beBarLabel").textContent =
    stats.breakeven;


  renderPerformanceTable(
    "setupBreakdown",
    groupPerformance(trades, "setup"),
    true
  );


  renderTradingTypeTable(trades);


  renderPerformanceTable(
    "sessionBreakdown",
    groupPerformance(trades, "session")
  );


  renderPerformanceTable(
    "directionBreakdown",
    groupPerformance(trades, "direction")
  );


  renderPerformanceTable(
    "biasBreakdown",
    groupPerformance(trades, "htfBias")
  );


  renderDayPerformance(trades);
  renderMonthlyPerformance(trades);
  renderBehaviorLists(trades);


  drawEquityCurve(
    $("analyticsEquityCanvas"),
    trades
  );

  drawMonthlyChart(trades);
}


/* =========================================================
   TRADING TYPE ANALYTICS
   ========================================================= */

function renderTradingTypeTable(trades) {

  const types = [
    "Scalping",
    "Intraday",
    "Swing"
  ];

  const body =
    $("tradingTypeBreakdown");

  body.innerHTML = "";

  types.forEach(type => {

    const rows =
      trades.filter(
        trade =>
          (trade.tradingType || "Scalping") === type
      );

    const wins =
      rows.filter(t => t.result === "Win").length;

    const losses =
      rows.filter(t => t.result === "Loss").length;

    const decided =
      wins + losses;

    const winRate =
      decided
        ? wins / decided * 100
        : 0;

    const pl =
      rows.reduce(
        (sum, t) => sum + num(t.profitLoss),
        0
      );

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td>${type}</td>
      <td>${rows.length}</td>
      <td>${wins}</td>
      <td>${losses}</td>
      <td>${formatPercent(winRate)}</td>
      <td class="${pl > 0 ? "positive" : pl < 0 ? "negative" : "neutral"}">
        ${formatMoney(pl)}
      </td>
    `;

    body.appendChild(tr);
  });
}


/* =========================================================
   DAY PERFORMANCE
   ========================================================= */

function renderDayPerformance(trades) {

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  const map = {};

  days.forEach(day => {

    map[day] = {
      trades: 0,
      wins: 0,
      losses: 0,
      pl: 0
    };

  });

  trades.forEach(trade => {

    if (!trade.date) return;

    const d =
      new Date(`${trade.date}T00:00:00`);

    const day =
      days[d.getDay()];

    map[day].trades++;

    if (trade.result === "Win") {
      map[day].wins++;
    }

    if (trade.result === "Loss") {
      map[day].losses++;
    }

    map[day].pl +=
      num(trade.profitLoss);
  });


  const body =
    $("dayBreakdown");

  body.innerHTML = "";

  days.forEach(day => {

    const item =
      map[day];

    const decided =
      item.wins + item.losses;

    const winRate =
      decided
        ? item.wins / decided * 100
        : 0;

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td>${day}</td>
      <td>${item.trades}</td>
      <td>${item.wins}</td>
      <td>${item.losses}</td>
      <td>${formatPercent(winRate)}</td>
      <td class="${item.pl > 0 ? "positive" : item.pl < 0 ? "negative" : "neutral"}">
        ${formatMoney(item.pl)}
      </td>
    `;

    body.appendChild(tr);
  });
}


/* =========================================================
   MONTHLY
   ========================================================= */

function renderMonthlyPerformance(trades) {

  const map = {};

  trades.forEach(trade => {

    if (!trade.date) return;

    const month =
      trade.date.slice(0, 7);

    if (!map[month]) {

      map[month] = {
        trades: 0,
        wins: 0,
        losses: 0,
        pl: 0
      };
    }

    map[month].trades++;

    if (trade.result === "Win") {
      map[month].wins++;
    }

    if (trade.result === "Loss") {
      map[month].losses++;
    }

    map[month].pl +=
      num(trade.profitLoss);
  });


  const body =
    $("monthlyBreakdown");

  body.innerHTML = "";


  Object.keys(map)
    .sort()
    .reverse()
    .forEach(month => {

      const item =
        map[month];

      const tr =
        document.createElement("tr");

      tr.innerHTML = `
        <td>${month}</td>
        <td>${item.trades}</td>
        <td>${item.wins}</td>
        <td>${item.losses}</td>
        <td class="${item.pl > 0 ? "positive" : item.pl < 0 ? "negative" : "neutral"}">
          ${formatMoney(item.pl)}
        </td>
      `;

      body.appendChild(tr);
    });
}


/* =========================================================
   BEHAVIOR
   ========================================================= */

function frequencyMap(trades, field) {

  const map = {};

  trades.forEach(trade => {

    const value =
      trade[field];

    if (!value) return;

    map[value] =
      (map[value] || 0) + 1;
  });

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1]);
}


function renderFrequencyList(
  elementId,
  entries
) {

  const element =
    $(elementId);

  element.innerHTML = "";

  if (!entries.length) {

    element.innerHTML =
      `<div class="frequency-item">
        <span>No data</span>
        <strong>0</strong>
      </div>`;

    return;
  }

  entries.slice(0, 10).forEach(
    ([name, count]) => {

      const div =
        document.createElement("div");

      div.className =
        "frequency-item";

      div.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <strong>${count}</strong>
      `;

      element.appendChild(div);
    }
  );
}


function renderBehaviorLists(trades) {

  renderFrequencyList(
    "mistakeBreakdown",
    frequencyMap(trades, "mistake")
  );

  renderFrequencyList(
    "psychologyBreakdown",
    frequencyMap(trades, "psychology")
  );
}


/* =========================================================
   CANVAS HELPERS
   ========================================================= */

function setupCanvas(canvas) {

  if (!canvas) return null;

  const rect =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    rect.width * ratio;

  canvas.height =
    rect.height * ratio;

  const ctx =
    canvas.getContext("2d");

  ctx.scale(ratio, ratio);

  return {
    ctx,
    width: rect.width,
    height: rect.height
  };
}


function drawEquityCurve(
  canvas,
  trades
) {

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

  const ordered =
    sortTrades(trades);

  const start =
    num(state.settings.startingBalance);

  if (!ordered.length) {

    ctx.fillStyle = "#646b77";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";

    ctx.fillText(
      "No trades yet",
      width / 2,
      height / 2
    );

    return;
  }


  const values = [start];

  let equity = start;

  ordered.forEach(trade => {

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

  const left = 48;
  const right = 14;
  const top = 20;
  const bottom = 32;

  const chartW =
    width - left - right;

  const chartH =
    height - top - bottom;


  /* grid */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {

    const y =
      top + chartH * i / 4;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    const value =
      max - range * i / 4;

    ctx.fillStyle =
      "#626976";

    ctx.font =
      "10px sans-serif";

    ctx.textAlign =
      "right";

    ctx.fillText(
      formatMoney(value),
      left - 7,
      y + 3
    );
  }


  /* line */

  ctx.beginPath();

  values.forEach((value, index) => {

    const x =
      left +
      chartW *
      index /
      Math.max(values.length - 1, 1);

    const y =
      top +
      (max - value) /
      range *
      chartH;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth = 2;

  ctx.stroke();


  /* last point */

  const last =
    values[values.length - 1];

  const lastX =
    left + chartW;

  const lastY =
    top +
    (max - last) /
    range *
    chartH;

  ctx.fillStyle =
    "#f0cf79";

  ctx.beginPath();

  ctx.arc(
    lastX,
    lastY,
    4,
    0,
    Math.PI * 2
  );

  ctx.fill();
}


/* =========================================================
   MONTHLY CHART
   ========================================================= */

function drawMonthlyChart(trades) {

  const canvas =
    $("monthlyCanvas");

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


  const map = {};

  trades.forEach(trade => {

    if (!trade.date) return;

    const month =
      trade.date.slice(0, 7);

    map[month] =
      (map[month] || 0) +
      num(trade.profitLoss);
  });


  const months =
    Object.keys(map).sort().slice(-12);

  if (!months.length) {

    ctx.fillStyle =
      "#646b77";

    ctx.font =
      "12px sans-serif";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "No monthly data",
      width / 2,
      height / 2
    );

    return;
  }


  const values =
    months.map(m => map[m]);

  const maxAbs =
    Math.max(
      1,
      ...values.map(v => Math.abs(v))
    );

  const centerY =
    height / 2;

  const left = 38;
  const right = 10;
  const top = 20;
  const bottom = 30;

  const chartW =
    width - left - right;

  const chartH =
    height - top - bottom;


  ctx.strokeStyle =
    "rgba(255,255,255,.08)";

  ctx.beginPath();

  ctx.moveTo(left, centerY);
  ctx.lineTo(width - right, centerY);

  ctx.stroke();


  const gap = 7;

  const barWidth =
    Math.max(
      10,
      (chartW - gap * (months.length - 1)) /
      months.length
    );


  months.forEach((month, index) => {

    const value =
      map[month];

    const barHeight =
      Math.abs(value) /
      maxAbs *
      (chartH / 2 - 12);

    const x =
      left +
      index *
      (barWidth + gap);

    const y =
      value >= 0
        ? centerY - barHeight
        : centerY;

    ctx.fillStyle =
      value >= 0
        ? "#36d399"
        : "#ff5c70";

    ctx.fillRect(
      x,
      y,
      barWidth,
      barHeight
    );

    ctx.fillStyle =
      "#646b77";

    ctx.font =
      "9px sans-serif";

    ctx.textAlign =
      "center";

    ctx.fillText(
      month.slice(5),
      x + barWidth / 2,
      height - 9
    );
  });
}


/* =========================================================
   RISK CALCULATOR
   ========================================================= */

function syncRiskCalculatorBalance() {

  $("calcBalance").value =
    state.settings.startingBalance || "";
}


$("calculateRiskBtn").addEventListener(
  "click",
  calculateRiskCalculator
);


[
  "calcBalance",
  "calcRisk",
  "calcEntry",
  "calcSL",
  "calcTP",
  "calcDirection"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateRiskCalculator
  );

  $(id).addEventListener(
    "change",
    calculateRiskCalculator
  );
});


function calculateRiskCalculator() {

  const balance =
    num($("calcBalance").value);

  const riskPercent =
    num($("calcRisk").value);

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

  const distance =
    Math.abs(entry - sl);


  let reward = 0;

  if (direction === "Buy") {

    reward =
      tp - entry;

  } else {

    reward =
      entry - tp;
  }


  const rr =
    distance > 0 &&
    reward > 0
      ? reward / distance
      : 0;

  const lot =
    riskAmount > 0 &&
    distance > 0
      ? riskAmount / (distance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    formatMoney(riskAmount);

  $("calcDistance").textContent =
    distance
      ? distance.toFixed(3)
      : "0.000";

  $("calcRR").textContent =
    rr
      ? `1:${rr.toFixed(2)}`
      : "1:0.00";

  $("calcLot").textContent =
    lot
      ? lot.toFixed(2)
      : "0.00";
}


/* =========================================================
   SETTINGS
   ========================================================= */

$("saveSettingsBtn").addEventListener(
  "click",
  async () => {

    if (!state.user) return;

    const startingBalance =
      num($("startingBalance").value);

    const currency =
      $("currency").value;

    try {

      await setDoc(
        doc(
          db,
          "users",
          state.user.uid,
          "settings",
          "main"
        ),
        {
          startingBalance,
          currency,
          updatedAt:
            new Date().toISOString()
        },
        {
          merge: true
        }
      );

      showToast("Settings saved.");

    } catch (error) {

      console.error(error);

      showToast(
        "Could not save settings.",
        "error"
      );
    }
  }
);


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


$("todayMonth").addEventListener(
  "click",
  () => {

    state.calendarDate =
      new Date();

    renderCalendar();
  }
);


function renderCalendar() {

  const year =
    state.calendarDate.getFullYear();

  const month =
    state.calendarDate.getMonth();


  $("calendarMonthLabel").textContent =
    new Date(
      year,
      month,
      1
    ).toLocaleDateString(
      undefined,
      {
        month: "long",
        year: "numeric"
      }
    );


  const monthTrades =
    state.trades.filter(trade => {

      if (!trade.date) return false;

      const d =
        new Date(`${trade.date}T00:00:00`);

      return (
        d.getFullYear() === year &&
        d.getMonth() === month
      );
    });


  const monthPL =
    monthTrades.reduce(
      (sum, t) => sum + num(t.profitLoss),
      0
    );

  const wins =
    monthTrades.filter(
      t => t.result === "Win"
    ).length;

  const losses =
    monthTrades.filter(
      t => t.result === "Loss"
    ).length;


  $("calendarMonthPL").textContent =
    formatMoney(monthPL);

  $("calendarMonthPL").className =
    monthPL > 0
      ? "positive"
      : monthPL < 0
        ? "negative"
        : "";


  $("calendarWins").textContent =
    wins;

  $("calendarLosses").textContent =
    losses;


  const grid =
    $("calendarGrid");

  grid.innerHTML = "";


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


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const empty =
      document.createElement("div");

    empty.className =
      "calendar-day empty";

    grid.appendChild(empty);
  }


  const today =
    todayString();


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const date =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dayTrades =
      state.trades.filter(
        trade => trade.date === date
      );


    const pl =
      dayTrades.reduce(
        (sum, t) => sum + num(t.profitLoss),
        0
      );


    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";

    if (date === today) {
      cell.classList.add("today-day");
    }


    let plHtml = "";

    if (dayTrades.length) {

      plHtml = `
        <div class="day-pl ${
          pl > 0
            ? "positive"
            : pl < 0
              ? "negative"
              : "neutral"
        }">
          ${formatMoney(pl)}
        </div>
      `;
    }


    cell.innerHTML = `
      <div class="day-number">${day}</div>
      ${plHtml}
    `;

    grid.appendChild(cell);
  }
}


/* =========================================================
   CSV EXPORT
   ========================================================= */

$("exportCsvBtn").addEventListener(
  "click",
  exportCSV
);


function csvEscape(value) {

  const string =
    String(value ?? "");

  if (
    string.includes(",") ||
    string.includes('"') ||
    string.includes("\n")
  ) {

    return `"${string.replaceAll('"', '""')}"`;
  }

  return string;
}


function exportCSV() {

  const trades =
    getJournalTrades();

  const headers = [
    "Date",
    "Time",
    "Pair",
    "Trading Type",
    "Direction",
    "Entry",
    "SL",
    "TP",
    "RR",
    "Risk %",
    "Risk Amount",
    "Lot Size",
    "Strategy",
    "Session",
    "HTF Bias",
    "Liquidity",
    "Confirmation",
    "Result",
    "Profit/Loss",
    "Confidence",
    "Psychology",
    "Mistake",
    "Notes"
  ];


  const rows =
    trades.map(trade => [

      trade.date,
      trade.time,
      trade.pair,

      trade.tradingType,

      trade.direction,

      trade.entry,
      trade.sl,
      trade.tp,

      trade.rr,

      trade.riskPercent,
      trade.riskAmount,
      trade.lotSize,

      trade.setup,
      trade.session,
      trade.htfBias,
      trade.liquidity,
      trade.confirmation,

      trade.result,

      trade.profitLoss,

      trade.confidence,
      trade.psychology,
      trade.mistake,

      trade.notes
    ]);


  const csv = [
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
        type: "text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download =
    `ujr-fx-trading-journal-${todayString()}.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


/* =========================================================
   ANALYTICS CONTROLS
   ========================================================= */

$("analyticsPeriod").addEventListener(
  "change",
  () => {

    const value =
      $("analyticsPeriod").value;

    const custom =
      value === "custom";

    $("analyticsFrom").classList.toggle(
      "hidden",
      !custom
    );

    $("analyticsTo").classList.toggle(
      "hidden",
      !custom
    );
  }
);


$("applyAnalyticsFilter").addEventListener(
  "click",
  () => {

    state.analyticsPeriod =
      $("analyticsPeriod").value;

    state.analyticsFrom =
      $("analyticsFrom").value;

    state.analyticsTo =
      $("analyticsTo").value;

    renderAnalytics();

  }
);


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
          $("dashboardPage")
            .classList.contains("active-page")
        ) {
          drawEquityCurve(
            $("equityCanvas"),
            state.trades
          );
        }

        if (
          $("analyticsPage")
            .classList.contains("active-page")
        ) {
          renderAnalytics();
        }

      }, 150);
  }
);


/* =========================================================
   RENDER EVERYTHING
   ========================================================= */

function renderAll() {

  renderDashboard();
  renderJournal();
  renderAnalytics();
  renderCalendar();

}


/* =========================================================
   INITIAL UI
   ========================================================= */

$("tradeDate").value =
  todayString();

$("tradeTime").value =
  currentTimeString();

$("lotSize").dataset.manual =
  "false";

showPage("dashboardPage");
