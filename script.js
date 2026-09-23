/* =========================================================
   UjR Fx Trading Journal
   Firebase Authentication + Firestore
   NO Firebase Storage / NO Image Upload System
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2vK4i4XLm1zPj43cNQwC65gZlQ6Ns",
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
   GLOBAL STATE
========================================================= */

let currentUser = null;
let trades = [];
let unsubscribeTrades = null;

let settings = {
  startingBalance: 0,
  currency: "USD"
};

let editingTradeId = null;

let calendarDate = new Date();

let manualLotSize = false;


/* =========================================================
   SHORTCUT
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   DOM ELEMENTS
========================================================= */

const loginScreen = $("loginScreen");
const appScreen = $("app");

const loginBtn = $("loginBtn");
const loginError = $("loginError");

const logoutBtn = $("logoutBtn");

const sidebar = $("sidebar");
const overlay = $("overlay");

const mobileMenuBtn = $("mobileMenuBtn");

const userPhoto = $("userPhoto");
const topUserPhoto = $("topUserPhoto");
const settingsPhoto = $("settingsPhoto");

const userName = $("userName");
const userEmail = $("userEmail");

const settingsName = $("settingsName");
const settingsEmail = $("settingsEmail");

const tradeModal = $("tradeModal");
const tradeForm = $("tradeForm");


/* =========================================================
   GOOGLE LOGIN
========================================================= */

loginBtn.addEventListener("click", async () => {

  loginError.textContent = "";

  loginBtn.disabled = true;
  loginBtn.innerHTML = `
    <span class="google-icon">G</span>
    <span>Signing in...</span>
  `;

  try {

    /*
      IMPORTANT:
      signInWithPopup must run from the button click.
    */

    const result = await signInWithPopup(auth, googleProvider);

    console.log("Google login successful:", result.user.email);

  } catch (error) {

    console.error("Google login error:", error);

    let message = "Google login failed.";

    switch (error.code) {

      case "auth/popup-closed-by-user":
        message = "Login window was closed.";
        break;

      case "auth/popup-blocked":
        message = "Your browser blocked the Google popup. Allow popups and try again.";
        break;

      case "auth/unauthorized-domain":
        message = "This website domain is not authorized in Firebase.";
        break;

      case "auth/operation-not-allowed":
        message = "Google Sign-In is not enabled in Firebase Authentication.";
        break;

      case "auth/api-key-not-valid":
        message = "Firebase API key is invalid. Check your Firebase Web App configuration.";
        break;

      case "auth/network-request-failed":
        message = "Network error. Check your internet connection.";
        break;

      case "auth/cancelled-popup-request":
        message = "Another login popup is already open.";
        break;

      default:
        message = `${error.code || "Error"}: ${error.message || "Unknown error"}`;
    }

    loginError.textContent = message;

  } finally {

    loginBtn.disabled = false;

    loginBtn.innerHTML = `
      <span class="google-icon">G</span>
      <span>Continue with Google</span>
    `;
  }

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;

    console.log("Authenticated:", user.email);

    showApplication(user);

    await loadSettings();

    subscribeToTrades();

  } else {

    currentUser = null;

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    showLogin();
  }

});


/* =========================================================
   SHOW LOGIN
========================================================= */

function showLogin() {

  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");

}


/* =========================================================
   SHOW APP
========================================================= */

function showApplication(user) {

  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");

  const photo =
    user.photoURL ||
    "logo.png";

  const name =
    user.displayName ||
    "Trader";

  const email =
    user.email ||
    "";

  userPhoto.src = photo;
  topUserPhoto.src = photo;
  settingsPhoto.src = photo;

  userName.textContent = name;
  userEmail.textContent = email;

  settingsName.textContent = name;
  settingsEmail.textContent = email;

  updateCurrentDate();

}


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener("click", async () => {

  try {

    await signOut(auth);

    showToast("Logged out successfully.");

  } catch (error) {

    console.error(error);

    showToast("Logout failed.");

  }

});


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    const pageId = button.dataset.page;

    openPage(pageId);

    closeMobileSidebar();

  });

});


document.querySelectorAll("[data-page-link]").forEach(button => {

  button.addEventListener("click", () => {

    openPage(button.dataset.pageLink);

  });

});


function openPage(pageId) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const target = $(pageId);

  if (target) {
    target.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === pageId
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

  $("topPageTitle").textContent =
    titles[pageId] || "Dashboard";

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

  if (pageId === "settingsPage") {
    renderSettings();
  }

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

mobileMenuBtn.addEventListener("click", () => {

  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");

});


overlay.addEventListener("click", closeMobileSidebar);


function closeMobileSidebar() {

  sidebar.classList.remove("open");
  overlay.classList.remove("show");

}


/* =========================================================
   CURRENT DATE
========================================================= */

function updateCurrentDate() {

  const now = new Date();

  $("currentDate").textContent =
    now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });

}


/* =========================================================
   FIRESTORE PATHS
========================================================= */

function userDocRef() {

  return doc(
    db,
    "users",
    currentUser.uid
  );

}


function tradesCollectionRef() {

  return collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );

}


/* =========================================================
   LOAD SETTINGS
========================================================= */

async function loadSettings() {

  if (!currentUser) return;

  try {

    const snap = await getDoc(userDocRef());

    if (snap.exists()) {

      const data = snap.data();

      settings.startingBalance =
        Number(data.startingBalance) || 0;

      settings.currency =
        data.currency || "USD";

    } else {

      settings = {
        startingBalance: 0,
        currency: "USD"
      };

      await setDoc(
        userDocRef(),
        settings,
        { merge: true }
      );

    }

    renderSettings();

  } catch (error) {

    console.error("Settings load error:", error);

  }

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

$("saveSettingsBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const startingBalance =
    Number($("startingBalance").value) || 0;

  const currency =
    $("currency").value || "USD";

  try {

    settings.startingBalance = startingBalance;
    settings.currency = currency;

    await setDoc(
      userDocRef(),
      {
        startingBalance,
        currency
      },
      { merge: true }
    );

    renderAll();

    showToast("Settings saved.");

  } catch (error) {

    console.error(error);

    showToast("Could not save settings.");

  }

});


/* =========================================================
   RENDER SETTINGS
========================================================= */

function renderSettings() {

  $("startingBalance").value =
    settings.startingBalance || 0;

  $("currency").value =
    settings.currency || "USD";

}


/* =========================================================
   TRADES REALTIME SUBSCRIPTION
========================================================= */

function subscribeToTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
  }

  const q = query(
    tradesCollectionRef(),
    orderBy("createdAt", "desc")
  );

  unsubscribeTrades = onSnapshot(
    q,
    snapshot => {

      trades = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      renderAll();

    },
    error => {

      console.error("Trade subscription error:", error);

      showToast(
        "Could not load trades. Check Firestore rules."
      );

    }
  );

}


/* =========================================================
   FORMATTERS
========================================================= */

function money(value) {

  const amount = Number(value) || 0;

  const currency =
    settings.currency || "USD";

  try {

    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ).format(amount);

  } catch {

    return `${currency} ${amount.toFixed(2)}`;

  }

}


function signedMoney(value) {

  const amount = Number(value) || 0;

  if (amount > 0) {
    return "+" + money(amount);
  }

  return money(amount);

}


function formatDate(dateString) {

  if (!dateString) return "-";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

}


/* =========================================================
   NUMBER HELPER
========================================================= */

function number(value) {

  const n = Number(value);

  return Number.isFinite(n) ? n : 0;

}


/* =========================================================
   AUTOMATIC R:R
========================================================= */

function calculateTradeRR() {

  const entry = number($("entry").value);
  const sl = number($("sl").value);
  const tp = number($("tp").value);

  const direction = $("direction").value;

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

  if (
    risk <= 0 ||
    reward <= 0
  ) {

    $("rr").value = "Invalid";

    return 0;
  }

  const rr = reward / risk;

  $("rr").value =
    `1:${rr.toFixed(2)}`;

  return rr;

}


/* =========================================================
   AUTOMATIC RISK AMOUNT
========================================================= */

function calculateRiskAmount() {

  const balance =
    number(settings.startingBalance);

  const riskPercent =
    number($("riskPercent").value);

  const riskAmount =
    balance * riskPercent / 100;

  $("riskAmount").value =
    riskAmount > 0
      ? riskAmount.toFixed(2)
      : "";

  return riskAmount;

}


/* =========================================================
   AUTOMATIC LOT SIZE
========================================================= */

function calculateLotSize() {

  if (manualLotSize) {
    return;
  }

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  const riskAmount =
    number($("riskAmount").value);

  if (
    entry <= 0 ||
    sl <= 0 ||
    riskAmount <= 0
  ) {

    $("lotSize").value = "";

    return;
  }

  const distance =
    Math.abs(entry - sl);

  if (distance <= 0) {

    $("lotSize").value = "";

    return;
  }

  /*
    Simplified XAUUSD calculation:
    1 lot = 100 oz
  */

  const lot =
    riskAmount /
    (distance * 100);

  $("lotSize").value =
    lot.toFixed(2);

}


/* =========================================================
   RECALCULATE TRADE
========================================================= */

function recalculateTrade() {

  calculateTradeRR();

  calculateRiskAmount();

  calculateLotSize();

}


/* =========================================================
   MANUAL LOT SIZE OVERRIDE
========================================================= */

$("lotSize").addEventListener("input", () => {

  manualLotSize = true;

});


/* =========================================================
   TRADE FIELD EVENTS
========================================================= */

[
  "entry",
  "sl",
  "tp",
  "direction",
  "riskPercent"
].forEach(id => {

  $(id).addEventListener("input", () => {

    recalculateTrade();

  });

  $(id).addEventListener("change", () => {

    recalculateTrade();

  });

});


/* =========================================================
   RESULT → P/L AUTOMATIC SIGN
========================================================= */

function normalizeProfitLossByResult() {

  const result =
    $("result").value;

  const input =
    $("profitLoss");

  const raw =
    input.value.trim();

  let value =
    Number(raw) || 0;

  if (result === "Loss") {

    value = Math.abs(value);

    input.value =
      value ? (-value).toFixed(2) : "";

  }

  else if (result === "Win") {

    value = Math.abs(value);

    input.value =
      value ? value.toFixed(2) : "";

  }

  else if (result === "Break Even") {

    input.value = "0";

  }

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
   GET GUARANTEED NORMALIZED P/L
========================================================= */

function getNormalizedPL() {

  const result =
    $("result").value;

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
   OPEN ADD TRADE MODAL
========================================================= */

function openAddTradeModal() {

  editingTradeId = null;
  manualLotSize = false;

  $("modalTitle").textContent =
    "Add Trade";

  $("tradeForm").reset();

  $("tradeId").value = "";

  const now = new Date();

  $("tradeDate").value =
    now.toISOString().slice(0, 10);

  $("tradeTime").value =
    now.toTimeString().slice(0, 5);

  $("pair").value = "XAUUSD";

  $("direction").value = "Buy";

  $("riskPercent").value = "1";

  $("result").value = "Win";

  $("profitLoss").value = "";

  $("rr").value = "";

  $("riskAmount").value = "";

  $("lotSize").value = "";

  $("tradeError").textContent = "";

  tradeModal.classList.remove("hidden");

  recalculateTrade();

}


/* =========================================================
   OPEN EDIT TRADE MODAL
========================================================= */

function openEditTradeModal(trade) {

  editingTradeId = trade.id;

  manualLotSize =
    trade.lotSize !== undefined &&
    trade.lotSize !== null;

  $("modalTitle").textContent =
    "Edit Trade";

  $("tradeId").value =
    trade.id;

  $("tradeDate").value =
    trade.date || "";

  $("tradeTime").value =
    trade.time || "";

  $("pair").value =
    trade.pair || "XAUUSD";

  $("direction").value =
    trade.direction || "Buy";

  $("entry").value =
    trade.entry ?? "";

  $("sl").value =
    trade.sl ?? "";

  $("tp").value =
    trade.tp ?? "";

  $("rr").value =
    trade.rr
      ? `1:${Number(trade.rr).toFixed(2)}`
      : "";

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

  normalizeProfitLossByResult();

  $("tradeError").textContent = "";

  tradeModal.classList.remove("hidden");

}


/* =========================================================
   CLOSE TRADE MODAL
========================================================= */

function closeTradeModal() {

  tradeModal.classList.add("hidden");

  editingTradeId = null;

  manualLotSize = false;

}


$("closeModalBtn").addEventListener(
  "click",
  closeTradeModal
);


$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);


$("closeModal").addEventListener(
  "click",
  closeTradeModal
);


/* =========================================================
   SAVE TRADE
========================================================= */

tradeForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!currentUser) {

    $("tradeError").textContent =
      "Please log in first.";

    return;
  }

  normalizeProfitLossByResult();

  const rr = calculateTradeRR();

  const riskAmount =
    calculateRiskAmount();

  calculateLotSize();

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

  if (!rr || rr <= 0) {

    $("tradeError").textContent =
      "Invalid trade levels. Check Entry, SL, TP and Direction.";

    return;
  }

  const profitLoss =
    getNormalizedPL();

  const data = {

    date: $("tradeDate").value,

    time: $("tradeTime").value,

    pair:
      $("pair").value.trim().toUpperCase(),

    direction:
      $("direction").value,

    entry,

    sl,

    tp,

    rr:
      Number(rr.toFixed(4)),

    riskPercent:
      number($("riskPercent").value),

    riskAmount:
      Number(riskAmount.toFixed(2)),

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

    /*
      Guaranteed:
      Loss = negative
      Win = positive
      Break Even = zero
    */
    profitLoss,

    confidence:
      $("confidence").value,

    psychology:
      $("psychology").value,

    mistake:
      $("mistake").value,

    notes:
      $("notes").value.trim(),

    updatedAt:
      Date.now()

  };


  try {

    if (editingTradeId) {

      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "trades",
          editingTradeId
        ),
        data
      );

      showToast("Trade updated.");

    } else {

      data.createdAt = Date.now();

      await addDoc(
        tradesCollectionRef(),
        data
      );

      showToast("Trade added.");

    }

    closeTradeModal();

  } catch (error) {

    console.error("Trade save error:", error);

    $("tradeError").textContent =
      `${error.code || "Error"}: ${error.message || "Could not save trade."}`;

  }

});


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

  const confirmed =
    confirm("Delete this trade permanently?");

  if (!confirmed) return;

  try {

    await deleteDoc(
      doc(
        db,
        "users",
        currentUser.uid,
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
   CALCULATE STATISTICS
========================================================= */

function getStats(list = trades) {

  const total =
    list.length;

  const wins =
    list.filter(t => t.result === "Win").length;

  const losses =
    list.filter(t => t.result === "Loss").length;

  const breakEven =
    list.filter(t => t.result === "Break Even").length;

  const closed =
    wins + losses;

  const totalPL =
    list.reduce(
      (sum, t) =>
        sum + number(t.profitLoss),
      0
    );

  const winningPL =
    list
      .filter(t => number(t.profitLoss) > 0)
      .reduce(
        (sum, t) =>
          sum + number(t.profitLoss),
        0
      );

  const losingPL =
    Math.abs(
      list
        .filter(t => number(t.profitLoss) < 0)
        .reduce(
          (sum, t) =>
            sum + number(t.profitLoss),
          0
        )
    );

  const winRate =
    closed > 0
      ? (wins / closed) * 100
      : 0;

  const profitFactor =
    losingPL > 0
      ? winningPL / losingPL
      : winningPL > 0
        ? Infinity
        : 0;

  const avgWin =
    wins > 0
      ? winningPL / wins
      : 0;

  const avgLoss =
    losses > 0
      ? -losingPL / losses
      : 0;

  const bestTrade =
    list.length
      ? Math.max(
          ...list.map(t =>
            number(t.profitLoss)
          )
        )
      : 0;

  const worstTrade =
    list.length
      ? Math.min(
          ...list.map(t =>
            number(t.profitLoss)
          )
        )
      : 0;

  const avgR =
    list.length
      ? list.reduce(
          (sum, t) =>
            sum + number(t.rr),
          0
        ) / list.length
      : 0;

  return {
    total,
    wins,
    losses,
    breakEven,
    closed,
    totalPL,
    winningPL,
    losingPL,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    avgR
  };

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const stats =
    getStats();

  const balance =
    number(settings.startingBalance) +
    stats.totalPL;

  $("currentBalance").textContent =
    money(balance);

  $("totalPL").textContent =
    signedMoney(stats.totalPL);

  $("totalPL").className =
    stats.totalPL > 0
      ? "pl-positive"
      : stats.totalPL < 0
        ? "pl-negative"
        : "";

  $("winRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("totalTrades").textContent =
    stats.total;

  $("profitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("avgR").textContent =
    `${stats.avgR.toFixed(2)}R`;

  $("avgWin").textContent =
    money(stats.avgWin);

  $("avgLoss").textContent =
    money(stats.avgLoss);

  $("bestTrade").textContent =
    signedMoney(stats.bestTrade);

  $("worstTrade").textContent =
    signedMoney(stats.worstTrade);

  renderRecentTrades();

  renderDiscipline();

  drawEquityCurve();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const body =
    $("recentTradesBody");

  body.innerHTML = "";

  const recent =
    [...trades]
      .sort(
        (a, b) =>
          number(b.createdAt) -
          number(a.createdAt)
      )
      .slice(0, 7);

  if (!recent.length) {

    $("recentEmpty").classList.remove("hidden");

    return;

  }

  $("recentEmpty").classList.add("hidden");

  recent.forEach(trade => {

    const row =
      document.createElement("tr");

    const resultClass =
      trade.result === "Win"
        ? "result-win"
        : trade.result === "Loss"
          ? "result-loss"
          : "result-be";

    const directionClass =
      trade.direction === "Buy"
        ? "direction-buy"
        : "direction-sell";

    const pl =
      number(trade.profitLoss);

    row.innerHTML = `
      <td>${formatDate(trade.date)}</td>

      <td>
        <strong>${escapeHTML(trade.pair || "-")}</strong>
      </td>

      <td>
        <span class="${directionClass}">
          ${escapeHTML(trade.direction || "-")}
        </span>
      </td>

      <td>${escapeHTML(trade.setup || "-")}</td>

      <td>1:${number(trade.rr).toFixed(2)}</td>

      <td>
        <span class="result-chip ${resultClass}">
          ${escapeHTML(trade.result || "-")}
        </span>
      </td>

      <td class="${pl >= 0 ? "pl-positive" : "pl-negative"}">
        ${signedMoney(pl)}
      </td>
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

  container.innerHTML = "";

  const counts = {};

  trades.forEach(trade => {

    if (!trade.mistake) return;

    counts[trade.mistake] =
      (counts[trade.mistake] || 0) + 1;

  });

  const items =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

  if (!items.length) {

    container.innerHTML =
      `<div class="empty-small">No mistakes recorded.</div>`;

    return;
  }

  items.forEach(([mistake, count]) => {

    const div =
      document.createElement("div");

    div.className =
      "discipline-item";

    div.innerHTML = `
      <span>${escapeHTML(mistake)}</span>
      <strong>${count}</strong>
    `;

    container.appendChild(div);

  });

}


/* =========================================================
   JOURNAL FILTER
========================================================= */

$("filterResult").addEventListener(
  "change",
  renderJournal
);

$("filterPair").addEventListener(
  "change",
  renderJournal
);

$("filterDate").addEventListener(
  "change",
  renderJournal
);


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
   GET FILTERED TRADES
========================================================= */

function getFilteredTrades() {

  const result =
    $("filterResult").value;

  const pair =
    $("filterPair").value;

  const date =
    $("filterDate").value;

  return trades.filter(trade => {

    if (
      result &&
      trade.result !== result
    ) {
      return false;
    }

    if (
      pair &&
      trade.pair !== pair
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


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

  const list =
    getFilteredTrades();

  const stats =
    getStats(list);

  $("journalTrades").textContent =
    stats.total;

  $("journalWins").textContent =
    stats.wins;

  $("journalLosses").textContent =
    stats.losses;

  $("journalPL").textContent =
    signedMoney(stats.totalPL);

  $("journalPL").className =
    stats.totalPL > 0
      ? "pl-positive"
      : stats.totalPL < 0
        ? "pl-negative"
        : "";

  const body =
    $("journalTableBody");

  body.innerHTML = "";

  if (!list.length) {

    $("journalEmpty").classList.remove("hidden");

    return;

  }

  $("journalEmpty").classList.add("hidden");

  list.forEach(trade => {

    const row =
      document.createElement("tr");

    const resultClass =
      trade.result === "Win"
        ? "result-win"
        : trade.result === "Loss"
          ? "result-loss"
          : "result-be";

    const directionClass =
      trade.direction === "Buy"
        ? "direction-buy"
        : "direction-sell";

    const pl =
      number(trade.profitLoss);

    row.innerHTML = `

      <td>${formatDate(trade.date)}</td>

      <td>
        <strong>${escapeHTML(trade.pair || "-")}</strong>
      </td>

      <td>
        <span class="${directionClass}">
          ${escapeHTML(trade.direction || "-")}
        </span>
      </td>

      <td>${number(trade.entry).toFixed(3)}</td>

      <td>${number(trade.sl).toFixed(3)}</td>

      <td>${number(trade.tp).toFixed(3)}</td>

      <td>1:${number(trade.rr).toFixed(2)}</td>

      <td>
        <span class="result-chip ${resultClass}">
          ${escapeHTML(trade.result || "-")}
        </span>
      </td>

      <td class="${pl >= 0 ? "pl-positive" : "pl-negative"}">
        ${signedMoney(pl)}
      </td>

      <td>

        <button
          class="action-btn edit-trade"
          data-id="${trade.id}">
          Edit
        </button>

        <button
          class="action-btn delete delete-trade"
          data-id="${trade.id}">
          Delete
        </button>

      </td>
    `;

    body.appendChild(row);

  });

  document
    .querySelectorAll(".edit-trade")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            trades.find(
              t => t.id === button.dataset.id
            );

          if (trade) {
            openEditTradeModal(trade);
          }

        }
      );

    });


  document
    .querySelectorAll(".delete-trade")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteTrade(
            button.dataset.id
          );

        }
      );

    });

}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const stats =
    getStats();

  $("analyticsTrades").textContent =
    stats.total;

  $("analyticsWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("analyticsRR").textContent =
    stats.avgR.toFixed(2);

  $("analyticsPL").textContent =
    signedMoney(stats.totalPL);

  $("analyticsWins").textContent =
    stats.wins;

  $("analyticsLosses").textContent =
    stats.losses;

  $("analyticsBE").textContent =
    stats.breakEven;

  const max =
    Math.max(
      stats.wins,
      stats.losses,
      stats.breakEven,
      1
    );

  $("winBar").style.width =
    `${(stats.wins / max) * 100}%`;

  $("lossBar").style.width =
    `${(stats.losses / max) * 100}%`;

  $("beBar").style.width =
    `${(stats.breakEven / max) * 100}%`;

  $("analyticsProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("analyticsAvgR").textContent =
    `${stats.avgR.toFixed(2)}R`;

  $("analyticsAvgWin").textContent =
    money(stats.avgWin);

  $("analyticsAvgLoss").textContent =
    money(stats.avgLoss);

  $("analyticsBest").textContent =
    signedMoney(stats.bestTrade);

  $("analyticsWorst").textContent =
    signedMoney(stats.worstTrade);

  renderSetupBreakdown();

}


/* =========================================================
   SETUP BREAKDOWN
========================================================= */

function renderSetupBreakdown() {

  const container =
    $("setupBreakdown");

  container.innerHTML = "";

  const setupMap = {};

  trades.forEach(trade => {

    const setup =
      trade.setup || "No Setup";

    if (!setupMap[setup]) {

      setupMap[setup] = {
        trades: 0,
        pl: 0
      };

    }

    setupMap[setup].trades++;

    setupMap[setup].pl +=
      number(trade.profitLoss);

  });

  const entries =
    Object.entries(setupMap)
      .sort(
        (a, b) =>
          Math.abs(b[1].pl) -
          Math.abs(a[1].pl)
      );

  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-small">No setup data yet.</div>`;

    return;
  }

  entries.forEach(([setup, data]) => {

    const div =
      document.createElement("div");

    div.className =
      "breakdown-item";

    div.innerHTML = `
      <span>
        ${escapeHTML(setup)}
        · ${data.trades} trade${data.trades === 1 ? "" : "s"}
      </span>

      <strong class="${
        data.pl >= 0
          ? "pl-positive"
          : "pl-negative"
      }">
        ${signedMoney(data.pl)}
      </strong>
    `;

    container.appendChild(div);

  });

}


/* =========================================================
   EQUITY CURVE
========================================================= */

function drawEquityCurve() {

  const canvas =
    $("equityCanvas");

  const empty =
    $("equityEmpty");

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const width =
    Math.max(rect.width, 300);

  const height =
    Math.max(rect.height, 250);

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;

  const ctx =
    canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  const sorted =
    [...trades]
      .sort(
        (a, b) =>
          number(a.createdAt) -
          number(b.createdAt)
      );

  if (!sorted.length) {

    empty.classList.remove("hidden");

    return;

  }

  empty.classList.add("hidden");

  let balance =
    number(settings.startingBalance);

  const points = [
    balance
  ];

  sorted.forEach(trade => {

    balance +=
      number(trade.profitLoss);

    points.push(balance);

  });

  const min =
    Math.min(...points);

  const max =
    Math.max(...points);

  const range =
    max - min || 1;

  const padding = 35;

  const chartWidth =
    width - padding * 2;

  const chartHeight =
    height - padding * 2;

  /*
    Grid
  */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i++) {

    const y =
      padding +
      chartHeight * i / 4;

    ctx.beginPath();

    ctx.moveTo(
      padding,
      y
    );

    ctx.lineTo(
      width - padding,
      y
    );

    ctx.stroke();

  }

  /*
    Curve
  */

  ctx.beginPath();

  points.forEach((value, index) => {

    const x =
      padding +
      chartWidth *
      (index / Math.max(points.length - 1, 1));

    const y =
      padding +
      chartHeight *
      (1 - ((value - min) / range));

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

  });

  ctx.strokeStyle =
    "#d9a441";

  ctx.lineWidth = 2.5;

  ctx.stroke();


  /*
    Area
  */

  const lastX =
    padding + chartWidth;

  ctx.lineTo(
    lastX,
    height - padding
  );

  ctx.lineTo(
    padding,
    height - padding
  );

  ctx.closePath();

  ctx.fillStyle =
    "rgba(217,164,65,.07)";

  ctx.fill();


  /*
    Current balance
  */

  const lastValue =
    points[points.length - 1];

  const lastY =
    padding +
    chartHeight *
    (1 - ((lastValue - min) / range));

  ctx.beginPath();

  ctx.arc(
    lastX,
    lastY,
    4,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#f0c66a";

  ctx.fill();

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

  $("calcRiskAmount").textContent =
    money(riskAmount);

  if (
    entry <= 0 ||
    sl <= 0
  ) {

    $("calcDistance").textContent =
      "0.00";

    $("calcRR").textContent =
      "Invalid";

    $("calcLot").textContent =
      "0.00";

    return;

  }

  const distance =
    Math.abs(entry - sl);

  $("calcDistance").textContent =
    distance.toFixed(2);

  let risk = 0;
  let reward = 0;

  if (direction === "Buy") {

    risk = entry - sl;
    reward = tp - entry;

  } else {

    risk = sl - entry;
    reward = entry - tp;

  }

  if (
    risk <= 0 ||
    reward <= 0
  ) {

    $("calcRR").textContent =
      "Invalid";

  } else {

    const rr =
      reward / risk;

    $("calcRR").textContent =
      `1:${rr.toFixed(2)}`;

  }

  const lot =
    distance > 0
      ? riskAmount / (distance * 100)
      : 0;

  $("calcLot").textContent =
    lot.toFixed(2);

}


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth").addEventListener(
  "click",
  () => {

    calendarDate.setMonth(
      calendarDate.getMonth() - 1
    );

    renderCalendar();

  }
);


$("nextMonth").addEventListener(
  "click",
  () => {

    calendarDate.setMonth(
      calendarDate.getMonth() + 1
    );

    renderCalendar();

  }
);


$("todayMonth").addEventListener(
  "click",
  () => {

    calendarDate = new Date();

    renderCalendar();

  }
);


function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();

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
    trades.filter(trade => {

      if (!trade.date) return false;

      const d =
        new Date(
          trade.date + "T00:00:00"
        );

      return (
        d.getFullYear() === year &&
        d.getMonth() === month
      );

    });


  const monthPL =
    monthTrades.reduce(
      (sum, trade) =>
        sum + number(trade.profitLoss),
      0
    );

  $("calendarMonthPL").textContent =
    signedMoney(monthPL);

  $("calendarWins").textContent =
    monthTrades.filter(
      t => t.result === "Win"
    ).length;

  $("calendarLosses").textContent =
    monthTrades.filter(
      t => t.result === "Loss"
    ).length;


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


  /*
    Empty cells
  */

  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day muted-day";

    grid.appendChild(cell);

  }


  const today =
    new Date();

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dayTrades =
      monthTrades.filter(
        t => t.date === dateString
      );

    const pl =
      dayTrades.reduce(
        (sum, trade) =>
          sum + number(trade.profitLoss),
        0
      );

    const cell =
      document.createElement("div");

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day;

    cell.className =
      `calendar-day ${isToday ? "today" : ""}`;

    let plHTML = "";

    if (dayTrades.length) {

      plHTML = `
        <div class="calendar-pl ${
          pl > 0
            ? "pl-positive"
            : pl < 0
              ? "pl-negative"
              : ""
        }">
          ${signedMoney(pl)}
        </div>

        <div class="calendar-count">
          ${dayTrades.length}
          trade${dayTrades.length === 1 ? "" : "s"}
        </div>
      `;

    }

    cell.innerHTML = `
      <div class="calendar-number">
        ${day}
      </div>
      ${plHTML}
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


function exportCSV() {

  const list =
    getFilteredTrades();

  if (!list.length) {

    showToast("No trades to export.");

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
    list.map(trade => [

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

    ].map(csvEscape).join(","));


  const csv =
    [
      headers.map(csvEscape).join(","),
      ...rows
    ].join("\n");


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
    `UjR-Fx-Trading-Journal-${new Date().toISOString().slice(0,10)}.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  showToast("CSV exported.");

}


function csvEscape(value) {

  const text =
    String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {

    return `"${text.replaceAll('"', '""')}"`;

  }

  return text;

}


/* =========================================================
   ADD TRADE BUTTONS
========================================================= */

$("quickAddBtn").addEventListener(
  "click",
  openAddTradeModal
);

$("journalAddBtn").addEventListener(
  "click",
  openAddTradeModal
);

$("mobileAddBtn").addEventListener(
  "click",
  openAddTradeModal
);


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  const toast =
    $("toast");

  toast.textContent =
    message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2800);

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

  renderSettings();

  drawEquityCurve();

}


/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    drawEquityCurve();

  }
);


/* =========================================================
   STARTUP
========================================================= */

updateCurrentDate();

console.log("UjR Fx Trading Journal loaded.");
