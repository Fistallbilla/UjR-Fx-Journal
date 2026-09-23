/* =========================================================
   UjR Fx Trading Journal
   Firebase + Advanced Analytics
   No Firebase Storage
========================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

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
  setDoc,
  getDoc,
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


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
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

  calendarDate: new Date()

};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);


function number(value) {

  const n = Number(value);

  return Number.isFinite(n) ? n : 0;

}


function money(value) {

  const currency = state.settings.currency || "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(number(value));

}


function signedMoney(value) {

  const n = number(value);

  if (n > 0) return "+" + money(n);

  return money(n);

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


function formatDate(date) {

  if (!date) return "—";

  const d = new Date(`${date}T00:00:00`);

  if (Number.isNaN(d.getTime())) return date;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

}


function sortTrades(trades) {

  return [...trades].sort((a, b) => {

    const aDate = `${a.date || ""} ${a.time || ""}`;

    const bDate = `${b.date || ""} ${b.time || ""}`;

    return bDate.localeCompare(aDate);

  });

}


function resultClass(result) {

  if (result === "Win") return "result-win";

  if (result === "Loss") return "result-loss";

  return "result-be";

}


function directionClass(direction) {

  return direction === "Buy"
    ? "direction-buy"
    : "direction-sell";

}


function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {

    toast.classList.remove("show");

  }, 3000);

}


/* =========================================================
   AUTH ERROR
========================================================= */

function friendlyAuthError(error) {

  switch (error?.code) {

    case "auth/unauthorized-domain":
      return "This website address is not authorized in Firebase. Add your current domain in Firebase Authentication → Settings → Authorized domains.";

    case "auth/operation-not-allowed":
      return "Google Sign-In is not enabled. Enable Google under Firebase Authentication → Sign-in method.";

    case "auth/popup-blocked":
      return "The Google login popup was blocked. Allow popups for this website.";

    case "auth/popup-closed-by-user":
      return "The Google login window was closed.";

    case "auth/api-key-not-valid":
      return "Firebase rejected the API key. Check that the Web App Firebase configuration is correct.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    case "auth/cancelled-popup-request":
      return "A Google login window is already open.";

    default:
      return error?.message || "Google login failed. Check the browser console.";
  }

}


/* =========================================================
   LOGIN
========================================================= */

$("loginBtn").addEventListener("click", async () => {

  const button = $("loginBtn");

  button.disabled = true;

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, googleProvider);

  } catch (error) {

    console.error("Google Sign-In:", error);

    if (error?.code === "auth/popup-blocked") {

      try {

        await signInWithRedirect(auth, googleProvider);

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

    button.disabled = false;

  }

});


/* Handle redirect login */

(async function handleRedirectLogin() {

  try {

    await getRedirectResult(auth);

  } catch (error) {

    console.error("Redirect login:", error);

    $("loginError").textContent =
      friendlyAuthError(error);

  }

})();


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

    await createUserProfile(user);

    startFirestoreListeners();

    renderAll();

  } else {

    state.user = null;

    $("app").classList.add("hidden");

    $("loginScreen").classList.remove("hidden");

    if (state.unsubscribeTrades) {

      state.unsubscribeTrades();

      state.unsubscribeTrades = null;

    }

    if (state.unsubscribeSettings) {

      state.unsubscribeSettings();

      state.unsubscribeSettings = null;

    }

  }

});


/* =========================================================
   FIRESTORE USER PROFILE
========================================================= */

async function createUserProfile(user) {

  const userRef = doc(db, "users", user.uid);

  await setDoc(
    userRef,
    {
      name: user.displayName || "Trader",
      email: user.email || "",
      photoURL: user.photoURL || "",
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

}


/* =========================================================
   FIRESTORE LISTENERS
========================================================= */

function startFirestoreListeners() {

  if (!state.user) return;

  if (state.unsubscribeTrades) {

    state.unsubscribeTrades();

  }

  if (state.unsubscribeSettings) {

    state.unsubscribeSettings();

  }


  const tradesRef = collection(
    db,
    "users",
    state.user.uid,
    "trades"
  );


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

      console.error("Trades listener:", error);

      showToast("Could not load trades.");

    }
  );


  const settingsRef = doc(
    db,
    "users",
    state.user.uid,
    "settings",
    "main"
  );


  state.unsubscribeSettings = onSnapshot(
    settingsRef,
    snapshot => {

      if (snapshot.exists()) {

        state.settings = {
          startingBalance:
            number(snapshot.data().startingBalance),

          currency:
            snapshot.data().currency || "USD"
        };

      }

      renderAll();

    },
    error => {

      console.error("Settings listener:", error);

    }
  );

}


/* =========================================================
   NAVIGATION
========================================================= */

const pageNames = {

  dashboardPage: "Dashboard",

  journalPage: "Journal",

  analyticsPage: "Analytics",

  riskPage: "Risk Calculator",

  calendarPage: "Calendar",

  settingsPage: "Settings"

};


document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    showPage(button.dataset.page);

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


  document.querySelectorAll(".nav-item").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === pageId
    );

  });


  $("pageTitle").textContent =
    pageNames[pageId] || "Dashboard";


  closeMobileMenu();

}


$("mobileMenuBtn").addEventListener(
  "click",
  openMobileMenu
);

$("overlay").addEventListener(
  "click",
  closeMobileMenu
);


function openMobileMenu() {

  $("sidebar").classList.add("open");

  $("overlay").classList.add("show");

}


function closeMobileMenu() {

  $("sidebar").classList.remove("open");

  $("overlay").classList.remove("show");

}


/* =========================================================
   ADD TRADE BUTTONS
========================================================= */

$("quickAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("journalAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("mobileAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);


/* =========================================================
   TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

  $("tradeModal").classList.remove("hidden");

  $("tradeError").textContent = "";

  state.editingTradeId = trade?.id || null;


  if (trade) {

    $("modalTitle").textContent = "Edit Trade";

    $("tradeId").value = trade.id;

    $("tradeDate").value = trade.date || todayString();

    $("tradeTime").value = trade.time || "";

    $("pair").value = trade.pair || "XAUUSD";

    $("direction").value = trade.direction || "Buy";

    $("entry").value = trade.entry ?? "";

    $("sl").value = trade.sl ?? "";

    $("tp").value = trade.tp ?? "";

    $("riskPercent").value =
      trade.riskPercent ?? 1;

    $("riskAmount").value =
      trade.riskAmount ?? "";

    $("lotSize").value =
      trade.lotSize ?? "";

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
      trade.result || "Win";

    $("profitLoss").value =
      trade.profitLoss ?? "";

    $("confidence").value =
      trade.confidence || "";

    $("psychology").value =
      trade.psychology || "";

    $("mistake").value =
      trade.mistake || "";

    $("notes").value =
      trade.notes || "";

    $("lotSize").dataset.manual = "true";

    calculateTradeFields();

  } else {

    resetTradeForm();

  }

}


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  state.editingTradeId = null;

}


$("closeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);


/* =========================================================
   RESET TRADE FORM
========================================================= */

function resetTradeForm() {

  $("tradeForm").reset();

  $("tradeId").value = "";

  $("tradeDate").value = todayString();

  $("tradeTime").value =
    new Date().toTimeString().slice(0, 5);

  $("pair").value = "XAUUSD";

  $("direction").value = "Buy";

  $("riskPercent").value = 1;

  $("riskAmount").value = "";

  $("lotSize").value = "";

  $("rr").value = "";

  $("result").value = "Win";

  $("profitLoss").value = "";

  $("modalTitle").textContent = "Add Trade";

  $("lotSize").dataset.manual = "false";

}


/* =========================================================
   AUTOMATIC TRADE CALCULATIONS
========================================================= */

function calculateTradeRR() {

  const entry = number($("entry").value);

  const sl = number($("sl").value);

  const tp = number($("tp").value);

  const direction =
    $("direction").value;


  if (
    entry <= 0 ||
    sl <= 0 ||
    tp <= 0
  ) {

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

  $("rr").value =
    `1:${rr.toFixed(2)}`;

  return rr;

}


function calculateTradeFields() {

  const balance =
    number(state.settings.startingBalance);

  const riskPercent =
    number($("riskPercent").value);

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);


  const riskAmount =
    balance * riskPercent / 100;


  if (balance > 0 && riskPercent > 0) {

    $("riskAmount").value =
      riskAmount.toFixed(2);

  } else {

    $("riskAmount").value = "";

  }


  const distance =
    Math.abs(entry - sl);


  if (
    riskAmount > 0 &&
    distance > 0 &&
    $("lotSize").dataset.manual !== "true"
  ) {

    /*
      Simplified XAUUSD model:
      1 standard lot ≈ 100 oz.
      Actual broker tick value/contract size can differ.
    */

    const lot =
      riskAmount / (distance * 100);

    $("lotSize").value =
      Math.max(0, lot).toFixed(2);

  }


  calculateTradeRR();

}


[
  "entry",
  "sl",
  "tp",
  "direction",
  "riskPercent"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateTradeFields
  );

  $(id).addEventListener(
    "change",
    calculateTradeFields
  );

});


$("lotSize").addEventListener(
  "input",
  () => {

    $("lotSize").dataset.manual = "true";

  }
);


/* =========================================================
   RESULT / P&L
========================================================= */

function normalizeProfitLossByResult() {

  const result = $("result").value;

  const input = $("profitLoss");

  const raw = input.value.trim();


  if (result === "Loss") {

    const value =
      Math.abs(number(raw));

    input.value =
      value ? (-value).toFixed(2) : "";

  }

  else if (result === "Win") {

    const value =
      Math.abs(number(raw));

    input.value =
      value ? value.toFixed(2) : "";

  }

  else if (result === "Break Even") {

    input.value = "0";

  }

}


function getNormalizedPL() {

  const result = $("result").value;

  let value =
    number($("profitLoss").value);


  if (result === "Loss") {

    value = -Math.abs(value);

  }

  else if (result === "Win") {

    value = Math.abs(value);

  }

  else {

    value = 0;

  }


  return Number(value.toFixed(2));

}


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

$("tradeForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!state.user) return;


    const entry =
      number($("entry").value);

    const sl =
      number($("sl").value);

    const tp =
      number($("tp").value);


    if (
      entry <= 0 ||
      sl <= 0 ||
      tp <= 0
    ) {

      $("tradeError").textContent =
        "Please enter valid Entry, SL and TP.";

      return;

    }


    const rr =
      calculateTradeRR();


    if (!rr || $("rr").value === "Invalid") {

      $("tradeError").textContent =
        "Entry, SL and TP do not create a valid trade direction.";

      return;

    }


    normalizeProfitLossByResult();


    const tradeData = {

      date: $("tradeDate").value,

      time: $("tradeTime").value,

      pair:
        $("pair").value.trim().toUpperCase(),

      direction:
        $("direction").value,

      entry,

      sl,

      tp,

      rr,

      riskPercent:
        number($("riskPercent").value),

      riskAmount:
        number($("riskAmount").value),

      lotSize:
        number($("lotSize").value),

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

      result:
        $("result").value,

      profitLoss:
        getNormalizedPL(),

      confidence:
        $("confidence").value,

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

        const tradeRef =
          doc(
            db,
            "users",
            state.user.uid,
            "trades",
            state.editingTradeId
          );


        await updateDoc(
          tradeRef,
          tradeData
        );

        showToast("Trade updated.");

      } else {

        tradeData.createdAt =
          new Date().toISOString();


        await addDoc(
          tradesRef,
          tradeData
        );

        showToast("Trade saved.");

      }


      closeTradeModal();

    } catch (error) {

      console.error(error);

      $("tradeError").textContent =
        "Could not save trade. Check Firestore rules.";

    }

  }
);


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

  if (!state.user || !id) return;

  const confirmed =
    window.confirm(
      "Delete this trade permanently?"
    );

  if (!confirmed) return;


  try {

    await deleteDoc(
      doc(
        db,
        "users",
        state.user.uid,
        "trades",
        id
      )
    );

    showToast("Trade deleted.");

  } catch (error) {

    console.error(error);

    showToast("Could not delete trade.");

  }

}


/* =========================================================
   FILTERED JOURNAL
========================================================= */

function getFilteredTrades() {

  const result =
    $("filterResult").value;

  const pair =
    $("filterPair").value.trim().toLowerCase();

  const date =
    $("filterDate").value;


  return state.trades.filter(trade => {

    if (
      result &&
      trade.result !== result
    ) return false;


    if (
      pair &&
      !String(trade.pair || "")
        .toLowerCase()
        .includes(pair)
    ) return false;


    if (
      date &&
      trade.date !== date
    ) return false;


    return true;

  });

}


[
  "filterResult",
  "filterPair",
  "filterDate"
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

function calculateStats(trades) {

  const wins =
    trades.filter(t => t.result === "Win");

  const losses =
    trades.filter(t => t.result === "Loss");

  const breakeven =
    trades.filter(t => t.result === "Break Even");


  const totalPL =
    trades.reduce(
      (sum, t) => sum + number(t.profitLoss),
      0
    );


  const grossProfit =
    wins.reduce(
      (sum, t) =>
        sum + Math.max(0, number(t.profitLoss)),
      0
    );


  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, t) =>
          sum + Math.min(0, number(t.profitLoss)),
        0
      )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const winRate =
    wins.length + losses.length > 0
      ? wins.length /
        (wins.length + losses.length) * 100
      : 0;


  const averageWin =
    wins.length
      ? wins.reduce(
          (sum, t) =>
            sum + number(t.profitLoss),
          0
        ) / wins.length
      : 0;


  const averageLoss =
    losses.length
      ? losses.reduce(
          (sum, t) =>
            sum + number(t.profitLoss),
          0
        ) / losses.length
      : 0;


  const averageR =
    trades.length
      ? trades.reduce(
          (sum, t) =>
            sum + number(t.rr) *
            (
              t.result === "Loss"
                ? -1
                : t.result === "Break Even"
                  ? 0
                  : 1
            ),
          0
        ) / trades.length
      : 0;


  const bestTrade =
    trades.length
      ? Math.max(
          ...trades.map(t =>
            number(t.profitLoss)
          )
        )
      : 0;


  const worstTrade =
    trades.length
      ? Math.min(
          ...trades.map(t =>
            number(t.profitLoss)
          )
        )
      : 0;


  const expectancy =
    trades.length
      ? totalPL / trades.length
      : 0;


  return {

    wins,

    losses,

    breakeven,

    totalPL,

    grossProfit,

    grossLoss,

    profitFactor,

    winRate,

    averageWin,

    averageLoss,

    averageR,

    bestTrade,

    worstTrade,

    expectancy

  };

}


function renderDashboard() {

  const trades =
    state.trades;


  const stats =
    calculateStats(trades);


  const balance =
    number(state.settings.startingBalance)
    + stats.totalPL;


  $("currentBalance").textContent =
    money(balance);

  $("totalPL").textContent =
    signedMoney(stats.totalPL);

  $("winRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("totalTrades").textContent =
    trades.length;

  $("profitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("avgR").textContent =
    `${stats.averageR.toFixed(2)}R`;

  $("dashboardAvgWin").textContent =
    signedMoney(stats.averageWin);

  $("dashboardAvgLoss").textContent =
    signedMoney(stats.averageLoss);

  $("bestTrade").textContent =
    signedMoney(stats.bestTrade);

  $("worstTrade").textContent =
    signedMoney(stats.worstTrade);


  renderRecentTrades();

  renderDiscipline();

  drawEquityChart(
    $("equityCanvas"),
    trades
  );

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const body =
    $("recentTradesBody");

  const trades =
    sortTrades(state.trades)
      .slice(0, 7);


  body.innerHTML = "";


  if (!trades.length) {

    $("recentEmpty").style.display =
      "block";

    return;

  }


  $("recentEmpty").style.display =
    "none";


  trades.forEach(trade => {

    const row =
      document.createElement("tr");


    row.innerHTML = `

      <td>${escapeHtml(formatDate(trade.date))}</td>

      <td>${escapeHtml(trade.pair || "—")}</td>

      <td>
        <span class="direction-chip ${directionClass(trade.direction)}">
          ${escapeHtml(trade.direction || "—")}
        </span>
      </td>

      <td>
        <span class="result-chip ${resultClass(trade.result)}">
          ${escapeHtml(trade.result || "—")}
        </span>
      </td>

      <td>${signedMoney(trade.profitLoss)}</td>

    `;


    body.appendChild(row);

  });

}


/* =========================================================
   DISCIPLINE
========================================================= */

function renderDiscipline() {

  const container =
    $("disciplineList");

  const counts = {};


  state.trades.forEach(trade => {

    if (!trade.mistake) return;

    counts[trade.mistake] =
      (counts[trade.mistake] || 0) + 1;

  });


  const entries =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);


  if (!entries.length) {

    container.innerHTML = `
      <div class="empty-state">
        No mistakes recorded yet.
      </div>
    `;

    return;

  }


  container.innerHTML =
    entries.map(
      ([name, count]) => `
        <div class="discipline-item">
          <span>${escapeHtml(name)}</span>
          <strong>${count}</strong>
        </div>
      `
    ).join("");

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

  const trades =
    getFilteredTrades();

  const stats =
    calculateStats(trades);


  $("journalTrades").textContent =
    trades.length;

  $("journalWins").textContent =
    stats.wins.length;

  $("journalLosses").textContent =
    stats.losses.length;

  $("journalPL").textContent =
    signedMoney(stats.totalPL);


  const body =
    $("journalTableBody");


  body.innerHTML = "";


  if (!trades.length) {

    $("journalEmpty").style.display =
      "block";

    return;

  }


  $("journalEmpty").style.display =
    "none";


  trades.forEach(trade => {

    const row =
      document.createElement("tr");


    row.innerHTML = `

      <td>${escapeHtml(formatDate(trade.date))}</td>

      <td>${escapeHtml(trade.pair || "—")}</td>

      <td>
        <span class="direction-chip ${directionClass(trade.direction)}">
          ${escapeHtml(trade.direction || "—")}
        </span>
      </td>

      <td>${number(trade.entry).toFixed(3)}</td>

      <td>${number(trade.sl).toFixed(3)}</td>

      <td>${number(trade.tp).toFixed(3)}</td>

      <td>1:${number(trade.rr).toFixed(2)}</td>

      <td>
        <span class="result-chip ${resultClass(trade.result)}">
          ${escapeHtml(trade.result || "—")}
        </span>
      </td>

      <td>${signedMoney(trade.profitLoss)}</td>

      <td>

        <div class="table-action">

          <button
            data-edit="${trade.id}"
            type="button"
          >
            Edit
          </button>

          <button
            data-delete="${trade.id}"
            type="button"
          >
            Delete
          </button>

        </div>

      </td>

    `;


    body.appendChild(row);

  });


  body
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            state.trades.find(
              t => t.id === button.dataset.edit
            );

          if (trade) {

            openTradeModal(trade);

          }

        }
      );

    });


  body
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteTrade(
            button.dataset.delete
          );

        }
      );

    });

}


/* =========================================================
   ADVANCED ANALYTICS FILTER
========================================================= */

function getAnalyticsTrades() {

  let trades =
    [...state.trades];


  const period =
    $("analyticsPeriod").value;


  const direction =
    $("analyticsDirection").value;


  const session =
    $("analyticsSession").value;


  if (period !== "all") {

    const days =
      number(period);


    const cutoff =
      new Date();

    cutoff.setHours(0, 0, 0, 0);

    cutoff.setDate(
      cutoff.getDate() - days + 1
    );


    trades =
      trades.filter(trade => {

        if (!trade.date) return false;

        const d =
          new Date(`${trade.date}T00:00:00`);

        return d >= cutoff;

      });

  }


  if (direction) {

    trades =
      trades.filter(
        trade =>
          trade.direction === direction
      );

  }


  if (session) {

    trades =
      trades.filter(
        trade =>
          trade.session === session
      );

  }


  return sortTrades(trades);

}


[
  "analyticsPeriod",
  "analyticsDirection",
  "analyticsSession"
].forEach(id => {

  $(id).addEventListener(
    "change",
    renderAnalytics
  );

});


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  const stats =
    calculateStats(trades);


  $("analyticsPL").textContent =
    signedMoney(stats.totalPL);

  $("analyticsWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("analyticsProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("analyticsExpectancy").textContent =
    signedMoney(stats.expectancy);

  $("analyticsRR").textContent =
    `${stats.averageR.toFixed(2)}R`;

  $("analyticsTrades").textContent =
    trades.length;


  $("analyticsWins").textContent =
    stats.wins.length;

  $("analyticsLosses").textContent =
    stats.losses.length;

  $("analyticsBE").textContent =
    stats.breakeven.length;


  const total =
    trades.length || 1;


  $("winBar").style.width =
    `${stats.wins.length / total * 100}%`;

  $("lossBar").style.width =
    `${stats.losses.length / total * 100}%`;

  $("beBar").style.width =
    `${stats.breakeven.length / total * 100}%`;


  $("analyticsAvgWin").textContent =
    signedMoney(stats.averageWin);

  $("analyticsAvgLoss").textContent =
    signedMoney(stats.averageLoss);

  $("analyticsBest").textContent =
    signedMoney(stats.bestTrade);

  $("analyticsWorst").textContent =
    signedMoney(stats.worstTrade);


  const streaks =
    calculateStreaks(trades);


  $("analyticsWinStreak").textContent =
    streaks.maxWin;

  $("analyticsLossStreak").textContent =
    streaks.maxLoss;


  const drawdown =
    calculateDrawdown(trades);


  $("maxDrawdownLabel").textContent =
    `Max DD: ${money(drawdown.maxDrawdown)}`;


  renderDirectionAnalytics(trades);

  renderSessionAnalytics(trades);

  renderSetupAnalytics(trades);

  renderMonthlyAnalytics(trades);


  drawAnalyticsEquityChart(
    $("analyticsEquityCanvas"),
    trades
  );

}


/* =========================================================
   STREAKS
========================================================= */

function calculateStreaks(trades) {

  const ordered =
    [...trades].sort((a, b) => {

      const aKey =
        `${a.date || ""} ${a.time || ""}`;

      const bKey =
        `${b.date || ""} ${b.time || ""}`;

      return aKey.localeCompare(bKey);

    });


  let currentWin = 0;

  let currentLoss = 0;

  let maxWin = 0;

  let maxLoss = 0;


  ordered.forEach(trade => {

    if (trade.result === "Win") {

      currentWin++;

      currentLoss = 0;

      maxWin =
        Math.max(maxWin, currentWin);

    }

    else if (trade.result === "Loss") {

      currentLoss++;

      currentWin = 0;

      maxLoss =
        Math.max(maxLoss, currentLoss);

    }

    else {

      currentWin = 0;

      currentLoss = 0;

    }

  });


  return {
    maxWin,
    maxLoss
  };

}


/* =========================================================
   DRAWDOWN
========================================================= */

function calculateDrawdown(trades) {

  const ordered =
    [...trades].sort((a, b) => {

      const aKey =
        `${a.date || ""} ${a.time || ""}`;

      const bKey =
        `${b.date || ""} ${b.time || ""}`;

      return aKey.localeCompare(bKey);

    });


  let equity =
    number(state.settings.startingBalance);

  let peak = equity;

  let maxDrawdown = 0;


  ordered.forEach(trade => {

    equity +=
      number(trade.profitLoss);

    peak =
      Math.max(peak, equity);

    const dd =
      peak - equity;

    maxDrawdown =
      Math.max(maxDrawdown, dd);

  });


  return {
    maxDrawdown
  };

}


/* =========================================================
   BUY / SELL ANALYTICS
========================================================= */

function renderDirectionAnalytics(trades) {

  const buy =
    trades.filter(
      t => t.direction === "Buy"
    );

  const sell =
    trades.filter(
      t => t.direction === "Sell"
    );


  const buyStats =
    calculateStats(buy);

  const sellStats =
    calculateStats(sell);


  $("buyTrades").textContent =
    buy.length;

  $("buyPL").textContent =
    signedMoney(buyStats.totalPL);

  $("buyWinRate").textContent =
    `${buyStats.winRate.toFixed(1)}%`;


  $("sellTrades").textContent =
    sell.length;

  $("sellPL").textContent =
    signedMoney(sellStats.totalPL);

  $("sellWinRate").textContent =
    `${sellStats.winRate.toFixed(1)}%`;

}


/* =========================================================
   SESSION ANALYTICS
========================================================= */

function renderSessionAnalytics(trades) {

  const container =
    $("sessionBreakdown");


  const sessions = {};


  trades.forEach(trade => {

    const name =
      trade.session || "Not Set";


    if (!sessions[name]) {

      sessions[name] = {
        trades: [],
        pl: 0
      };

    }


    sessions[name].trades.push(trade);

    sessions[name].pl +=
      number(trade.profitLoss);

  });


  const entries =
    Object.entries(sessions)
      .sort(
        (a, b) =>
          b[1].pl - a[1].pl
      );


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">No session data.</div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([name, data]) => {

        const wins =
          data.trades.filter(
            t => t.result === "Win"
          ).length;


        const losses =
          data.trades.filter(
            t => t.result === "Loss"
          ).length;


        const wr =
          wins + losses
            ? wins /
              (wins + losses) *
              100
            : 0;


        return `

          <div class="breakdown-row">

            <span>${escapeHtml(name)}</span>

            <small>${data.trades.length} trades</small>

            <small>${wr.toFixed(0)}%</small>

            <strong>${signedMoney(data.pl)}</strong>

          </div>

        `;

      }
    ).join("");

}


/* =========================================================
   SETUP ANALYTICS
========================================================= */

function renderSetupAnalytics(trades) {

  const container =
    $("setupBreakdown");


  const setups = {};


  trades.forEach(trade => {

    const name =
      trade.setup || "Not Set";


    if (!setups[name]) {

      setups[name] = {
        trades: [],
        pl: 0
      };

    }


    setups[name].trades.push(trade);

    setups[name].pl +=
      number(trade.profitLoss);

  });


  const entries =
    Object.entries(setups)
      .sort(
        (a, b) =>
          b[1].pl - a[1].pl
      );


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">No setup data.</div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([name, data]) => {

        const wins =
          data.trades.filter(
            t => t.result === "Win"
          ).length;


        const losses =
          data.trades.filter(
            t => t.result === "Loss"
          ).length;


        const wr =
          wins + losses
            ? wins /
              (wins + losses) *
              100
            : 0;


        const avg =
          data.trades.length
            ? data.pl /
              data.trades.length
            : 0;


        return `

          <div class="setup-row">

            <span>${escapeHtml(name)}</span>

            <small>${data.trades.length} trades</small>

            <small>${wr.toFixed(0)}% WR</small>

            <small>${signedMoney(avg)} avg</small>

            <strong>${signedMoney(data.pl)}</strong>

          </div>

        `;

      }
    ).join("");

}


/* =========================================================
   MONTHLY ANALYTICS
========================================================= */

function renderMonthlyAnalytics(trades) {

  const body =
    $("monthlyAnalyticsBody");


  const months = {};


  trades.forEach(trade => {

    if (!trade.date) return;


    const month =
      trade.date.slice(0, 7);


    if (!months[month]) {

      months[month] = {
        trades: [],
        pl: 0
      };

    }


    months[month].trades.push(trade);

    months[month].pl +=
      number(trade.profitLoss);

  });


  const entries =
    Object.entries(months)
      .sort(
        (a, b) =>
          b[0].localeCompare(a[0])
      );


  body.innerHTML = "";


  if (!entries.length) {

    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No monthly data.
        </td>
      </tr>
    `;

    return;

  }


  entries.forEach(
    ([month, data]) => {

      const wins =
        data.trades.filter(
          t => t.result === "Win"
        ).length;


      const losses =
        data.trades.filter(
          t => t.result === "Loss"
        ).length;


      const wr =
        wins + losses
          ? wins /
            (wins + losses) *
            100
          : 0;


      const date =
        new Date(
          `${month}-01T00:00:00`
        );


      const label =
        date.toLocaleDateString(
          "en-US",
          {
            month: "long",
            year: "numeric"
          }
        );


      const row =
        document.createElement("tr");


      row.innerHTML = `

        <td>${label}</td>

        <td>${data.trades.length}</td>

        <td>${wins}</td>

        <td>${losses}</td>

        <td>${wr.toFixed(1)}%</td>

        <td>${signedMoney(data.pl)}</td>

      `;


      body.appendChild(row);

    }
  );

}


/* =========================================================
   EQUITY CHART
========================================================= */

function drawEquityChart(canvas, trades) {

  if (!canvas) return;


  const ctx =
    canvas.getContext("2d");


  const rect =
    canvas.getBoundingClientRect();


  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    rect.width * dpr;

  canvas.height =
    rect.height * dpr;


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  const width =
    rect.width;

  const height =
    rect.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const ordered =
    [...trades].sort((a, b) => {

      const aKey =
        `${a.date || ""} ${a.time || ""}`;

      const bKey =
        `${b.date || ""} ${b.time || ""}`;

      return aKey.localeCompare(bKey);

    });


  let equity =
    number(state.settings.startingBalance);


  const values = [
    equity
  ];


  ordered.forEach(trade => {

    equity +=
      number(trade.profitLoss);

    values.push(equity);

  });


  if (values.length <= 1) {

    drawEmptyChart(
      ctx,
      width,
      height,
      "Add trades to see your equity curve"
    );

    return;

  }


  drawLineChart(
    ctx,
    width,
    height,
    values
  );

}


/* =========================================================
   ANALYTICS EQUITY + DRAWDOWN CHART
========================================================= */

function drawAnalyticsEquityChart(canvas, trades) {

  if (!canvas) return;


  const ctx =
    canvas.getContext("2d");


  const rect =
    canvas.getBoundingClientRect();


  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    rect.width * dpr;

  canvas.height =
    rect.height * dpr;


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  const width =
    rect.width;

  const height =
    rect.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const ordered =
    [...trades].sort((a, b) => {

      const aKey =
        `${a.date || ""} ${a.time || ""}`;

      const bKey =
        `${b.date || ""} ${b.time || ""}`;

      return aKey.localeCompare(bKey);

    });


  let equity =
    number(state.settings.startingBalance);


  const equityValues = [
    equity
  ];

  const drawdowns = [];

  let peak = equity;


  ordered.forEach(trade => {

    equity +=
      number(trade.profitLoss);

    peak =
      Math.max(peak, equity);

    const dd =
      peak - equity;

    equityValues.push(equity);

    drawdowns.push(dd);

  });


  if (equityValues.length <= 1) {

    drawEmptyChart(
      ctx,
      width,
      height,
      "Add trades to see analytics"
    );

    return;

  }


  drawLineChart(
    ctx,
    width,
    height,
    equityValues,
    drawdowns
  );

}


/* =========================================================
   GENERIC LINE CHART
========================================================= */

function drawLineChart(
  ctx,
  width,
  height,
  values,
  drawdowns = []
) {

  const padding = {
    top: 25,
    right: 25,
    bottom: 35,
    left: 60
  };


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  let min =
    Math.min(...values);

  let max =
    Math.max(...values);


  if (min === max) {

    min -= 1;

    max += 1;

  }


  const range =
    max - min;


  /* Grid */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;


  for (let i = 0; i <= 4; i++) {

    const y =
      padding.top +
      chartHeight *
      (i / 4);


    ctx.beginPath();

    ctx.moveTo(
      padding.left,
      y
    );

    ctx.lineTo(
      width - padding.right,
      y
    );

    ctx.stroke();


    const value =
      max -
      range *
      (i / 4);


    ctx.fillStyle =
      "#667080";

    ctx.font =
      "10px Inter, sans-serif";

    ctx.fillText(
      money(value),
      5,
      y + 4
    );

  }


  /* Drawdown area */

  if (drawdowns.length) {

    const maxDD =
      Math.max(...drawdowns, 0);


    if (maxDD > 0) {

      ctx.fillStyle =
        "rgba(255,101,119,.07)";

      ctx.beginPath();

      ctx.moveTo(
        padding.left,
        padding.top +
        chartHeight
      );


      drawdowns.forEach(
        (dd, index) => {

          const x =
            padding.left +
            chartWidth *
            ((index + 1) /
              (values.length - 1));


          const y =
            padding.top +
            chartHeight -
            (dd / maxDD) *
            (chartHeight * .3);


          ctx.lineTo(x, y);

        }
      );


      ctx.lineTo(
        width - padding.right,
        padding.top +
        chartHeight
      );

      ctx.closePath();

      ctx.fill();

    }

  }


  /* Equity line */

  ctx.beginPath();

  values.forEach(
    (value, index) => {

      const x =
        padding.left +
        chartWidth *
        (index /
          (values.length - 1));


      const y =
        padding.top +
        chartHeight -
        ((value - min) /
          range) *
        chartHeight;


      if (index === 0) {

        ctx.moveTo(x, y);

      } else {

        ctx.lineTo(x, y);

      }

    }
  );


  ctx.strokeStyle =
    "#d8a94a";

  ctx.lineWidth = 2.5;

  ctx.stroke();


  /* Points */

  values.forEach(
    (value, index) => {

      const x =
        padding.left +
        chartWidth *
        (index /
          (values.length - 1));


      const y =
        padding.top +
        chartHeight -
        ((value - min) /
          range) *
        chartHeight;


      ctx.beginPath();

      ctx.arc(
        x,
        y,
        3,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#f2c866";

      ctx.fill();

    }
  );

}


/* =========================================================
   EMPTY CHART
========================================================= */

function drawEmptyChart(
  ctx,
  width,
  height,
  text
) {

  ctx.fillStyle =
    "#667080";

  ctx.font =
    "12px Inter, sans-serif";

  ctx.textAlign =
    "center";

  ctx.fillText(
    text,
    width / 2,
    height / 2
  );

  ctx.textAlign =
    "left";

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

$("calculateRiskBtn").addEventListener(
  "click",
  calculateRisk
);


function calculateRisk() {

  const balance =
    number($("calcBalance").value);

  const riskPercent =
    number($("calcRisk").value);

  const entry =
    number($("calcEntry").value);

  const sl =
    number($("calcSL").value);

  const tp =
    number($("calcTP").value);

  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  const distance =
    Math.abs(entry - sl);


  let risk = 0;

  let reward = 0;


  if (direction === "Buy") {

    risk =
      entry - sl;

    reward =
      tp - entry;

  } else {

    risk =
      sl - entry;

    reward =
      entry - tp;

  }


  let rr = 0;


  if (
    risk > 0 &&
    reward > 0
  ) {

    rr =
      reward / risk;

  }


  const lot =
    riskAmount > 0 &&
    distance > 0

      ? riskAmount /
        (distance * 100)

      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);

  $("calcDistance").textContent =
    distance.toFixed(3);

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "Invalid";

  $("calcLot").textContent =
    lot.toFixed(2);

}


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

  const date =
    state.calendarDate;


  const year =
    date.getFullYear();

  const month =
    date.getMonth();


  $("calendarMonthLabel").textContent =
    date.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    );


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const previousDays =
    new Date(
      year,
      month,
      0
    ).getDate();


  const cells = [];


  for (
    let i = firstDay - 1;
    i >= 0;
    i--
  ) {

    cells.push({
      day: previousDays - i,
      current: false
    });

  }


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    cells.push({
      day,
      current: true
    });

  }


  while (cells.length < 42) {

    cells.push({
      day:
        cells.filter(
          c => !c.current
        ).length + 1,
      current: false
    });

  }


  const grid =
    $("calendarGrid");


  grid.innerHTML = "";


  let monthPL = 0;

  let monthWins = 0;

  let monthLosses = 0;


  state.trades.forEach(trade => {

    if (!trade.date) return;


    const d =
      new Date(
        `${trade.date}T00:00:00`
      );


    if (
      d.getFullYear() === year &&
      d.getMonth() === month
    ) {

      monthPL +=
        number(trade.profitLoss);


      if (trade.result === "Win")
        monthWins++;


      if (trade.result === "Loss")
        monthLosses++;

    }

  });


  $("calendarMonthPL").textContent =
    signedMoney(monthPL);

  $("calendarWins").textContent =
    monthWins;

  $("calendarLosses").textContent =
    monthLosses;


  cells.forEach(cell => {

    const element =
      document.createElement("div");


    if (!cell.current) {

      element.className =
        "calendar-day empty";

      element.innerHTML =
        `<span class="calendar-day-number">${cell.day}</span>`;

      grid.appendChild(element);

      return;

    }


    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;


    const dayTrades =
      state.trades.filter(
        t => t.date === dateString
      );


    const pl =
      dayTrades.reduce(
        (sum, t) =>
          sum + number(t.profitLoss),
        0
      );


    const today =
      dateString === todayString();


    let className =
      "calendar-day ";


    if (today)
      className += "today ";


    if (pl > 0)
      className += "calendar-positive";

    else if (pl < 0)
      className += "calendar-negative";

    else
      className += "calendar-neutral";


    element.className =
      className;


    element.innerHTML = `

      <div class="calendar-day-number">
        ${cell.day}
      </div>

      <div class="calendar-day-pl">
        ${
          dayTrades.length
            ? signedMoney(pl)
            : "—"
        }
      </div>

    `;


    grid.appendChild(element);

  });

}


/* =========================================================
   SETTINGS
========================================================= */

$("saveSettingsBtn").addEventListener(
  "click",
  saveSettings
);


async function saveSettings() {

  if (!state.user) return;


  const startingBalance =
    number(
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


    state.settings = {
      startingBalance,
      currency
    };


    renderAll();

    showToast(
      "Settings saved."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Could not save settings."
    );

  }

}


function renderSettings() {

  $("startingBalance").value =
    state.settings.startingBalance || "";

  $("currency").value =
    state.settings.currency || "USD";

}


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn").addEventListener(
  "click",
  exportCSV
);


function csvValue(value) {

  const text =
    String(value ?? "");


  return `"${text.replaceAll('"', '""')}"`;

}


function exportCSV() {

  const trades =
    getFilteredTrades();


  if (!trades.length) {

    showToast(
      "No trades to export."
    );

    return;

  }


  const headers = [

    "Date",
    "Time",
    "Pair",
    "Direction",
    "Entry",
    "SL",
    "TP",
    "RR",
    "Risk %",
    "Risk Amount",
    "Lot Size",
    "Setup",
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
    trades.map(
      trade => [

        trade.date,
        trade.time,
        trade.pair,
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

      ]
        .map(csvValue)
        .join(",")
    );


  const csv =
    [
      headers.map(csvValue).join(","),
      ...rows
    ].join("\n");


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
    `UjR-Fx-Trading-Journal-${todayString()}.csv`;


  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

}


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error(error);

      showToast(
        "Could not logout."
      );

    }

  }
);


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

  if (!state.user) return;


  $("currentDate").textContent =
    new Date().toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );


  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderSettings();

  renderCalendar();

}


/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      $("dashboardPage")
        .classList
        .contains("active-page")
    ) {

      drawEquityChart(
        $("equityCanvas"),
        state.trades
      );

    }


    if (
      $("analyticsPage")
        .classList
        .contains("active-page")
    ) {

      drawAnalyticsEquityChart(
        $("analyticsEquityCanvas"),
        getAnalyticsTrades()
      );

    }

  }
);


/* =========================================================
   INITIAL DEFAULTS
========================================================= */

$("tradeDate").value =
  todayString();

$("tradeTime").value =
  new Date()
    .toTimeString()
    .slice(0, 5);

$("pair").value =
  "XAUUSD";

$("lotSize").dataset.manual =
  "false";
