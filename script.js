import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


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
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const state = {
  user: null,
  trades: [],
  editingId: null,
  editingSource: null,
  settings: {
    startingBalance: 0,
    currency: "USD"
  },
  currentPage: "dashboard",
  calendarDate: new Date(),
  selectedCalendarDate: null
};


function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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


function formatMoney(value) {
  const amount = num(value);
  const currency = state.settings.currency || "USD";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}


function formatPL(value) {
  const amount = num(value);

  if (amount > 0) {
    return `<span class="profit">+${formatMoney(amount)}</span>`;
  }

  if (amount < 0) {
    return `<span class="loss">${formatMoney(amount)}</span>`;
  }

  return formatMoney(0);
}


function parseDateValue(date) {
  if (!date) return null;

  if (typeof date === "string") {
    const parts = date.split("-");

    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);

      return new Date(y, m, d);
    }
  }

  if (date?.toDate) {
    return date.toDate();
  }

  if (date instanceof Date) {
    return date;
  }

  return null;
}


function dateKey(date) {
  const d = parseDateValue(date);

  if (!d || Number.isNaN(d.getTime())) {
    return "";
  }

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}


function sortTradesNewestFirst(trades) {
  return [...trades].sort((a, b) => {

    const dateA = dateKey(a.date);
    const dateB = dateKey(b.date);

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;

    return timeB - timeA;
  });
}


function sortTradesOldestFirst(trades) {
  return [...trades].sort((a, b) => {

    const dateA = dateKey(a.date);
    const dateB = dateKey(b.date);

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;

    return timeA - timeB;
  });
}


/* =========================================================
   FIRESTORE PATHS
========================================================= */

/*
  IMPORTANT:

  The app now reads BOTH:

  1. users/{uid}/trades
  2. trades where userId == uid

  This is specifically to recover previous journal data
  if the old version used a different Firestore structure.
*/

function newTradesCollection() {
  return collection(db, "users", state.user.uid, "trades");
}


function oldTradesCollection() {
  return collection(db, "trades");
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

  const email = state.user.email || "";

  const photo =
    state.user.photoURL ||
    "logo.png";

  $("sidebarUserName").textContent = name;
  $("sidebarUserEmail").textContent = email;

  $("sidebarUserPhoto").src = photo;
  $("topUserPhoto").src = photo;

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;
  $("settingsPhoto").src = photo;
}


/* =========================================================
   LOAD USER DATA
========================================================= */

async function loadUserData() {

  if (!state.user) return;

  try {

    await Promise.all([
      loadTrades(),
      loadSettings()
    ]);

    renderAll();

  } catch (error) {

    console.error("Loading data failed:", error);

    showToast(
      "Could not load some data. Check Firebase Firestore permissions.",
      true
    );
  }
}


/* =========================================================
   LOAD TRADES
========================================================= */

async function loadTrades() {

  const uid = state.user.uid;

  const allTrades = [];
  const seenIds = new Set();


  /* ---------- NEW PATH ---------- */

  try {

    const snapshot = await getDocs(
      newTradesCollection()
    );

    snapshot.forEach(item => {

      const data = item.data();

      if (!seenIds.has(item.id)) {

        seenIds.add(item.id);

        allTrades.push(
          normalizeTrade({
            id: item.id,
            ...data,
            _source: "new"
          })
        );
      }
    });

  } catch (error) {

    console.warn(
      "New trade collection could not be loaded:",
      error
    );
  }


  /* ---------- OLD PATH ---------- */

  try {

    const oldQuery = query(
      oldTradesCollection(),
      where("userId", "==", uid)
    );

    const snapshot = await getDocs(oldQuery);

    snapshot.forEach(item => {

      const data = item.data();

      if (!seenIds.has(item.id)) {

        seenIds.add(item.id);

        allTrades.push(
          normalizeTrade({
            id: item.id,
            ...data,
            _source: "old"
          })
        );
      }
    });

  } catch (error) {

    console.warn(
      "Old trade collection could not be loaded:",
      error
    );
  }


  state.trades = sortTradesNewestFirst(allTrades);

  updatePairFilter();
}


/* =========================================================
   NORMALIZE OLD / NEW DATA
========================================================= */

function normalizeTrade(trade) {

  const normalized = {
    id: trade.id || "",
    _source: trade._source || "new",

    tradeId:
      trade.tradeId ||
      trade.id ||
      generateTradeId(),

    date:
      trade.date ||
      dateKey(trade.createdAt) ||
      todayString(),

    pair:
      String(
        trade.pair ||
        trade.symbol ||
        trade.instrument ||
        "XAUUSD"
      ).trim().toUpperCase(),

    tradingType:
      trade.tradingType ||
      trade.tradeType ||
      trade.type ||
      "Scalping",

    direction:
      trade.direction ||
      "Buy",

    strategy:
      trade.strategy ||
      "Other",

    session:
      trade.session ||
      "London",

    bias:
      trade.bias ||
      trade.marketBias ||
      "Neutral",

    entry:
      safeNumber(trade.entry) ?? 0,

    sl:
      safeNumber(trade.sl ?? trade.stopLoss) ?? 0,

    tp:
      safeNumber(trade.tp ?? trade.takeProfit) ?? 0,

    rr:
      safeNumber(trade.rr) ?? null,

    riskAmount:
      safeNumber(trade.riskAmount ?? trade.risk) ?? 0,

    lotSize:
      safeNumber(trade.lotSize) ?? 0,

    result:
      trade.result ||
      "Break Even",

    profitLoss:
      safeNumber(
        trade.profitLoss ??
        trade.pnl ??
        trade.pl ??
        trade.P_L
      ) ?? 0,

    confidence:
      trade.confidence ||
      "3/5",

    emotion:
      trade.emotion ||
      "Neutral",

    notes:
      trade.notes ||
      "",

    createdAt:
      trade.createdAt ||
      null,

    updatedAt:
      trade.updatedAt ||
      null
  };


  /* Old data without pair becomes XAUUSD */
  if (!normalized.pair) {
    normalized.pair = "XAUUSD";
  }


  /* Make P/L consistent with result */

  if (normalized.result === "Win") {
    normalized.profitLoss =
      Math.abs(normalized.profitLoss);

  } else if (normalized.result === "Loss") {
    normalized.profitLoss =
      -Math.abs(normalized.profitLoss);

  } else if (normalized.result === "Break Even") {
    normalized.profitLoss = 0;
  }


  return normalized;
}


/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings() {

  if (!state.user) return;

  try {

    const ref = doc(
      db,
      "users",
      state.user.uid,
      "settings",
      "profile"
    );

    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {

      const data = snapshot.data();

      state.settings.startingBalance =
        num(data.startingBalance);

      state.settings.currency =
        data.currency || "USD";

    }

  } catch (error) {

    console.warn("Settings load error:", error);
  }


  $("startingBalance").value =
    state.settings.startingBalance || "";

  $("currency").value =
    state.settings.currency || "USD";
}


$("saveSettingsBtn").addEventListener("click", async () => {

  if (!state.user) return;

  const balance =
    num($("startingBalance").value);

  const currency =
    $("currency").value || "USD";

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
        startingBalance: balance,
        currency,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    state.settings.startingBalance = balance;
    state.settings.currency = currency;

    $("settingsMessage").textContent =
      "Settings saved successfully.";

    renderAll();

    setTimeout(() => {
      $("settingsMessage").textContent = "";
    }, 2500);

  } catch (error) {

    console.error(error);

    $("settingsMessage").textContent =
      "Could not save settings.";

    $("settingsMessage").className =
      "error-text";
  }
});


$("logoutBtn").addEventListener("click", async () => {

  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }
});


/* =========================================================
   TRADE ID
========================================================= */

function generateTradeId() {

  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const random =
    Math.floor(1000 + Math.random() * 9000);

  return `UJRF-${y}${m}${d}-${random}`;
}


/* =========================================================
   TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

  state.editingId = null;
  state.editingSource = null;

  $("tradeForm").reset();

  $("tradeModalTitle").textContent =
    trade ? "Edit Trade" : "Add Trade";

  $("saveTradeBtn").textContent =
    trade ? "Update Trade" : "Save Trade";

  $("tradeError").textContent = "";


  if (trade) {

    state.editingId = trade.id;
    state.editingSource = trade._source;

    $("tradeId").value =
      trade.tradeId || generateTradeId();

    $("tradeDate").value =
      trade.date || todayString();

    $("pair").value =
      trade.pair || "XAUUSD";

    $("tradingType").value =
      trade.tradingType || "Scalping";

    $("direction").value =
      trade.direction || "Buy";

    $("strategy").value =
      trade.strategy || "Other";

    $("session").value =
      trade.session || "London";

    $("bias").value =
      trade.bias || "Neutral";

    $("entry").value =
      trade.entry || "";

    $("sl").value =
      trade.sl || "";

    $("tp").value =
      trade.tp || "";

    $("riskAmount").value =
      trade.riskAmount ?? "";

    $("lotSize").value =
      trade.lotSize || "";

    $("result").value =
      trade.result || "Win";

    $("profitLoss").value =
      trade.profitLoss ?? "";

    $("confidence").value =
      trade.confidence || "3/5";

    $("emotion").value =
      trade.emotion || "Neutral";

    $("notes").value =
      trade.notes || "";

    calculateTradeRR();

  } else {

    $("tradeId").value =
      generateTradeId();

    $("tradeDate").value =
      todayString();

    $("pair").value =
      "XAUUSD";

    $("tradingType").value =
      "Scalping";

    $("direction").value =
      "Buy";

    $("strategy").value =
      "Liquidity Sweep";

    $("session").value =
      "London";

    $("bias").value =
      "Bullish";

    $("result").value =
      "Win";

    $("confidence").value =
      "3/5";

    $("emotion").value =
      "Calm";

    $("profitLoss").value = "";

    $("riskAmount").value = "";

    $("lotSize").value = "";

    $("rr").value = "";
  }


  $("tradeModal").classList.remove("hidden");
}


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  state.editingId = null;
  state.editingSource = null;
}


document.querySelectorAll(".page-add-trade")
  .forEach(button => {

    button.addEventListener("click", () => {
      openTradeModal();
    });

  });


$("closeTradeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTradeBtn").addEventListener(
  "click",
  closeTradeModal
);

document.querySelector(".modal-overlay")
  .addEventListener("click", closeTradeModal);


/* =========================================================
   RR
========================================================= */

function calculateTradeRR() {

  const entry = num($("entry").value);
  const sl = num($("sl").value);
  const tp = num($("tp").value);

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


  if (
    risk <= 0 ||
    reward <= 0
  ) {

    $("rr").value = "Invalid";

    return 0;
  }


  const rr =
    reward / risk;

  $("rr").value =
    `1:${rr.toFixed(2)}`;

  return rr;
}


["entry", "sl", "tp", "direction"]
  .forEach(id => {

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

  const result =
    $("result").value;

  const input =
    $("profitLoss");


  if (result === "Break Even") {

    input.value = "0";

    return;
  }


  if (input.value === "") {
    return;
  }


  const value =
    Number(input.value);

  if (!Number.isFinite(value)) {
    return;
  }


  if (result === "Win") {

    input.value =
      Math.abs(value);

  } else if (result === "Loss") {

    input.value =
      -Math.abs(value);
  }
}


function getNormalizedPL() {

  const result =
    $("result").value;

  const raw =
    $("profitLoss").value;


  if (result === "Break Even") {
    return 0;
  }


  if (raw === "") {
    return null;
  }


  const value =
    Number(raw);

  if (!Number.isFinite(value)) {
    return null;
  }


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


  return Number(
    value.toFixed(2)
  );
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
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!state.user) return;

    $("tradeError").textContent = "";

    const pair =
      $("pair").value
        .trim()
        .toUpperCase() ||
      "XAUUSD";


    const entry =
      num($("entry").value);

    const sl =
      num($("sl").value);

    const tp =
      num($("tp").value);


    const riskRaw =
      $("riskAmount").value.trim();

    const riskAmount =
      riskRaw === ""
        ? 0
        : Number(riskRaw);


    const pl =
      getNormalizedPL();


    if (!$("tradeDate").value) {

      $("tradeError").textContent =
        "Please select a date.";

      return;
    }


    if (!pair) {

      $("tradeError").textContent =
        "Please enter a pair.";

      return;
    }


    if (
      entry <= 0 ||
      sl <= 0 ||
      tp <= 0
    ) {

      $("tradeError").textContent =
        "Entry, Stop Loss and Take Profit must be valid.";

      return;
    }


    const rrValue =
      calculateTradeRR();


    if (!rrValue || rrValue <= 0) {

      $("tradeError").textContent =
        "Please check Entry, Stop Loss and Take Profit.";

      return;
    }


    if (
      !Number.isFinite(riskAmount) ||
      riskAmount < 0
    ) {

      $("tradeError").textContent =
        "Risk Amount must be a valid positive number.";

      return;
    }


    if (pl === null) {

      $("tradeError").textContent =
        "Please enter your P/L.";

      return;
    }


    const tradeData = {

      tradeId:
        $("tradeId").value ||
        generateTradeId(),

      date:
        $("tradeDate").value,

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

      entry,

      sl,

      tp,

      rr:
        Number(rrValue.toFixed(4)),

      riskAmount,

      lotSize:
        num($("lotSize").value),

      result:
        $("result").value,

      profitLoss:
        pl,

      confidence:
        $("confidence").value,

      emotion:
        $("emotion").value,

      notes:
        $("notes").value.trim(),

      updatedAt:
        serverTimestamp()
    };


    const button =
      $("saveTradeBtn");

    button.disabled = true;

    button.textContent =
      state.editingId
        ? "Updating..."
        : "Saving...";


    try {

      if (state.editingId) {

        await updateExistingTrade(
          state.editingId,
          state.editingSource,
          tradeData
        );

      } else {

        /*
          New trades are saved to the new,
          user-specific path.
        */

        await addDoc(
          newTradesCollection(),
          {
            ...tradeData,
            createdAt:
              serverTimestamp()
          }
        );
      }


      closeTradeModal();

      await loadTrades();

      renderAll();

      showToast(
        state.editingId
          ? "Trade updated."
          : "Trade saved."
      );

    } catch (error) {

      console.error(
        "Save trade error:",
        error
      );

      $("tradeError").textContent =
        error.message ||
        "Could not save trade.";

    } finally {

      button.disabled = false;

      button.textContent =
        state.editingId
          ? "Update Trade"
          : "Save Trade";
    }
  }
);


/* =========================================================
   UPDATE OLD / NEW TRADE
========================================================= */

async function updateExistingTrade(
  id,
  source,
  data
) {

  if (source === "old") {

    await updateDoc(
      doc(db, "trades", id),
      {
        ...data,
        userId: state.user.uid
      }
    );

    return;
  }


  await updateDoc(
    doc(
      db,
      "users",
      state.user.uid,
      "trades",
      id
    ),
    data
  );
}


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(
  id,
  source
) {

  const confirmed =
    confirm(
      "Delete this trade permanently?"
    );

  if (!confirmed) return;


  try {

    if (source === "old") {

      await deleteDoc(
        doc(db, "trades", id)
      );

    } else {

      await deleteDoc(
        doc(
          db,
          "users",
          state.user.uid,
          "trades",
          id
        )
      );
    }


    await loadTrades();

    renderAll();

    showToast("Trade deleted.");

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade.",
      true
    );
  }
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderDashboard();
  renderJournal();
  renderAnalytics();
  renderCalendar();
  calculateRisk();
  updatePairFilter();
}


/* =========================================================
   DASHBOARD
========================================================= */

function calculateStats(trades) {

  const list = trades || [];

  const wins =
    list.filter(
      t => t.result === "Win"
    );

  const losses =
    list.filter(
      t => t.result === "Loss"
    );

  const breakeven =
    list.filter(
      t => t.result === "Break Even"
    );


  const totalPL =
    list.reduce(
      (sum, t) =>
        sum + num(t.profitLoss),
      0
    );


  const grossProfit =
    wins.reduce(
      (sum, t) =>
        sum + Math.max(0, num(t.profitLoss)),
      0
    );


  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, t) =>
          sum + Math.min(0, num(t.profitLoss)),
        0
      )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const rrTrades =
    list.filter(
      t => num(t.rr) > 0
    );


  const avgRR =
    rrTrades.length
      ? rrTrades.reduce(
          (sum, t) =>
            sum + num(t.rr),
          0
        ) / rrTrades.length
      : 0;


  const avgPL =
    list.length
      ? totalPL / list.length
      : 0;


  const avgWin =
    wins.length
      ? grossProfit / wins.length
      : 0;


  const avgLoss =
    losses.length
      ? grossLoss / losses.length
      : 0;


  const expectancy =
    avgPL;


  const best =
    list.length
      ? Math.max(
          ...list.map(
            t => num(t.profitLoss)
          )
        )
      : 0;


  const worst =
    list.length
      ? Math.min(
          ...list.map(
            t => num(t.profitLoss)
          )
        )
      : 0;


  const avgRisk =
    list.length
      ? list.reduce(
          (sum, t) =>
            sum + num(t.riskAmount),
          0
        ) / list.length
      : 0;


  const winRate =
    list.length
      ? (wins.length / list.length) * 100
      : 0;


  const maxDrawdown =
    calculateMaxDrawdown(list);


  return {
    total: list.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    totalPL,
    grossProfit,
    grossLoss,
    profitFactor,
    avgRR,
    avgPL,
    avgWin,
    avgLoss,
    expectancy,
    best,
    worst,
    avgRisk,
    winRate,
    maxDrawdown
  };
}


function calculateMaxDrawdown(trades) {

  const ordered =
    sortTradesOldestFirst(trades);

  let equity = 0;
  let peak = 0;
  let maxDD = 0;

  for (const trade of ordered) {

    equity += num(trade.profitLoss);

    if (equity > peak) {
      peak = equity;
    }

    const drawdown =
      equity - peak;

    if (drawdown < maxDD) {
      maxDD = drawdown;
    }
  }

  return Math.abs(maxDD);
}


function renderDashboard() {

  const stats =
    calculateStats(state.trades);


  $("dashTotalTrades").textContent =
    stats.total;

  $("dashWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("dashTotalPL").innerHTML =
    formatPL(stats.totalPL);

  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("dashAverageRR").textContent =
    `${stats.avgRR.toFixed(2)}R`;

  $("dashExpectancy").innerHTML =
    formatPL(stats.expectancy);

  $("dashWins").textContent =
    stats.wins;

  $("dashLosses").textContent =
    stats.losses;


  renderEquityChart(
    $("dashboardEquityChart"),
    state.trades
  );


  const recent =
    sortTradesNewestFirst(
      state.trades
    ).slice(0, 6);


  if (!recent.length) {

    $("recentTrades").innerHTML =
      `<div class="empty-state">No trades yet.</div>`;

    return;
  }


  $("recentTrades").innerHTML =
    recent.map(trade => `
      <div class="recent-trade">

        <div>
          <strong>
            ${escapeHtml(
              trade.pair || "XAUUSD"
            )}
          </strong>

          <small>
            ${escapeHtml(trade.date)}
            ·
            ${escapeHtml(trade.result)}
          </small>
        </div>

        <strong>
          ${formatPL(
            trade.profitLoss
          )}
        </strong>

      </div>
    `).join("");
}


/* =========================================================
   EQUITY
========================================================= */

function renderEquityChart(
  container,
  trades
) {

  if (!trades.length) {

    container.innerHTML =
      `<div class="empty-state">No trading data yet.</div>`;

    return;
  }


  const ordered =
    sortTradesOldestFirst(trades);


  let equity = 0;

  const values =
    ordered.map(trade => {

      equity +=
        num(trade.profitLoss);

      return equity;
    });


  const maxAbs =
    Math.max(
      ...values.map(v => Math.abs(v)),
      1
    );


  container.innerHTML =
    values.map(value => {

      const height =
        Math.max(
          5,
          Math.abs(value) / maxAbs * 100
        );


      return `
        <div
          class="equity-bar ${value < 0 ? "negative" : ""}"
          style="height:${height}%"
        >
          <span class="equity-bar-label">
            ${value.toFixed(0)}
          </span>
        </div>
      `;

    }).join("");
}


/* =========================================================
   JOURNAL
========================================================= */

function updatePairFilter() {

  const select =
    $("filterPair");

  const current =
    select.value;


  const pairs =
    [...new Set(
      state.trades.map(
        t => t.pair || "XAUUSD"
      )
    )]
    .sort();


  select.innerHTML =
    `<option value="">All Pairs</option>` +
    pairs.map(
      pair =>
        `<option value="${escapeHtml(pair)}">
          ${escapeHtml(pair)}
        </option>`
    ).join("");


  if (pairs.includes(current)) {
    select.value = current;
  }
}


function getFilteredTrades() {

  let list =
    [...state.trades];


  const result =
    $("filterResult").value;

  const type =
    $("filterTradingType").value;

  const pair =
    $("filterPair").value;

  const date =
    $("filterDate").value;

  const search =
    $("journalSearch").value
      .trim()
      .toLowerCase();


  if (result) {

    list =
      list.filter(
        t => t.result === result
      );
  }


  if (type) {

    list =
      list.filter(
        t => t.tradingType === type
      );
  }


  if (pair) {

    list =
      list.filter(
        t =>
          (t.pair || "XAUUSD") === pair
      );
  }


  if (date) {

    list =
      list.filter(
        t => dateKey(t.date) === date
      );
  }


  if (search) {

    list =
      list.filter(t => {

        const text =
          [
            t.pair,
            t.strategy,
            t.session,
            t.direction,
            t.result,
            t.notes
          ]
          .join(" ")
          .toLowerCase();

        return text.includes(search);
      });
  }


  return sortTradesNewestFirst(list);
}


function renderJournal() {

  const list =
    getFilteredTrades();

  const body =
    $("journalTableBody");


  if (!list.length) {

    body.innerHTML = "";

    $("journalEmpty")
      .classList.remove("hidden");

    return;
  }


  $("journalEmpty")
    .classList.add("hidden");


  body.innerHTML =
    list.map(trade => {

      const rr =
        num(trade.rr) > 0
          ? `1:${num(trade.rr).toFixed(2)}`
          : "-";


      return `
        <tr>

          <td>
            ${escapeHtml(trade.date)}
          </td>

          <td>
            <strong>
              ${escapeHtml(
                trade.pair || "XAUUSD"
              )}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              trade.tradingType
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.direction
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.strategy
            )}
          </td>

          <td>
            ${num(trade.entry).toFixed(3)}
          </td>

          <td>
            ${rr}
          </td>

          <td>
            ${escapeHtml(
              trade.result
            )}
          </td>

          <td>
            ${formatPL(
              trade.profitLoss
            )}
          </td>

          <td>
            <div class="action-buttons">

              <button
                class="small-btn"
                data-edit="${escapeHtml(trade.id)}"
              >
                Edit
              </button>

              <button
                class="small-btn delete"
                data-delete="${escapeHtml(trade.id)}"
              >
                Delete
              </button>

            </div>
          </td>

        </tr>
      `;

    }).join("");


  body
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            state.trades.find(
              t =>
                t.id ===
                button.dataset.edit
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

          const trade =
            state.trades.find(
              t =>
                t.id ===
                button.dataset.delete
            );

          if (trade) {

            deleteTrade(
              trade.id,
              trade._source
            );
          }
        }
      );

    });
}


[
  "filterResult",
  "filterTradingType",
  "filterPair",
  "filterDate",
  "journalSearch"
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


$("clearFiltersBtn")
  .addEventListener("click", () => {

    $("filterResult").value = "";
    $("filterTradingType").value = "";
    $("filterPair").value = "";
    $("filterDate").value = "";
    $("journalSearch").value = "";

    renderJournal();
  });


/* =========================================================
   ANALYTICS PERIOD
========================================================= */

function getAnalyticsTrades() {

  const period =
    $("analyticsPeriod").value;

  const today =
    new Date();

  today.setHours(0,0,0,0);


  if (period === "all") {
    return [...state.trades];
  }


  if (period === "7" ||
      period === "30") {

    const days =
      Number(period);

    const start =
      new Date(today);

    start.setDate(
      start.getDate() - days + 1
    );


    return state.trades.filter(
      trade => {

        const d =
          parseDateValue(trade.date);

        if (!d) return false;

        d.setHours(0,0,0,0);

        return d >= start &&
               d <= today;
      }
    );
  }


  if (period === "month") {

    const y =
      today.getFullYear();

    const m =
      today.getMonth();


    return state.trades.filter(
      trade => {

        const d =
          parseDateValue(trade.date);

        return d &&
          d.getFullYear() === y &&
          d.getMonth() === m;
      }
    );
  }


  if (period === "year") {

    const y =
      today.getFullYear();


    return state.trades.filter(
      trade => {

        const d =
          parseDateValue(trade.date);

        return d &&
          d.getFullYear() === y;
      }
    );
  }


  return [...state.trades];
}


$("analyticsPeriod")
  .addEventListener(
    "change",
    renderAnalytics
  );


$("analyticsBreakdown")
  .addEventListener(
    "change",
    renderAnalytics
  );


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();

  const stats =
    calculateStats(trades);


  $("analyticsTrades").textContent =
    stats.total;

  $("analyticsWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("analyticsPL").innerHTML =
    formatPL(stats.totalPL);

  $("analyticsPF").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("analyticsAvgPL").innerHTML =
    formatPL(stats.avgPL);

  $("analyticsAvgWin").innerHTML =
    formatPL(stats.avgWin);

  $("analyticsAvgLoss").innerHTML =
    formatPL(-stats.avgLoss);

  $("analyticsRR").textContent =
    `${stats.avgRR.toFixed(2)}R`;

  $("analyticsRisk").innerHTML =
    formatMoney(stats.avgRisk);

  $("analyticsBest").innerHTML =
    formatPL(stats.best);

  $("analyticsWorst").innerHTML =
    formatPL(stats.worst);

  $("analyticsDrawdown").innerHTML =
    formatPL(-stats.maxDrawdown);


  const streaks =
    calculateStreaks(trades);


  $("currentWinStreak").textContent =
    streaks.currentWin;

  $("currentLossStreak").textContent =
    streaks.currentLoss;

  $("bestWinStreak").textContent =
    streaks.bestWin;

  $("bestLossStreak").textContent =
    streaks.bestLoss;


  renderBreakdown(trades);

  renderResultDistribution(trades);

  renderDailyPerformance(trades);

  renderMonthlyPerformance(trades);
}


/* =========================================================
   BREAKDOWN
========================================================= */

const breakdownLabels = {
  pair: "By Pair",
  tradingType: "By Trading Type",
  strategy: "By Strategy",
  session: "By Session",
  direction: "By Direction",
  bias: "By Market Bias",
  emotion: "By Emotion",
  result: "By Result"
};


function getTradeField(
  trade,
  field
) {

  if (field === "pair") {
    return trade.pair || "XAUUSD";
  }

  if (field === "tradingType") {
    return trade.tradingType || "Unknown";
  }

  if (field === "strategy") {
    return trade.strategy || "Unknown";
  }

  if (field === "session") {
    return trade.session || "Unknown";
  }

  if (field === "direction") {
    return trade.direction || "Unknown";
  }

  if (field === "bias") {
    return trade.bias || "Unknown";
  }

  if (field === "emotion") {
    return trade.emotion || "Unknown";
  }

  if (field === "result") {
    return trade.result || "Unknown";
  }

  return "Unknown";
}


function renderBreakdown(trades) {

  const field =
    $("analyticsBreakdown").value;

  $("breakdownTitle").textContent =
    breakdownLabels[field] ||
    "Performance Breakdown";


  const groups = {};


  trades.forEach(trade => {

    const key =
      getTradeField(
        trade,
        field
      );

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(trade);
  });


  const rows =
    Object.entries(groups)
      .map(([name, list]) => {

        const stats =
          calculateStats(list);

        return {
          name,
          stats
        };
      })
      .sort(
        (a,b) =>
          b.stats.totalPL -
          a.stats.totalPL
      );


  $("breakdownBody").innerHTML =
    rows.length

      ? rows.map(item => {

          const s =
            item.stats;

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(item.name)}
                </strong>
              </td>

              <td>${s.total}</td>

              <td>${s.wins}</td>

              <td>${s.losses}</td>

              <td>
                ${s.winRate.toFixed(1)}%
              </td>

              <td>
                ${formatPL(s.totalPL)}
              </td>

            </tr>
          `;

        }).join("")

      : `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              No data for this period.
            </div>
          </td>
        </tr>
      `;
}


/* =========================================================
   RESULT DISTRIBUTION
========================================================= */

function renderResultDistribution(trades) {

  const stats =
    calculateStats(trades);

  const total =
    Math.max(stats.total, 1);


  const winPercent =
    stats.wins / total * 100;

  const lossPercent =
    stats.losses / total * 100;

  const bePercent =
    stats.breakeven / total * 100;


  $("resultDistribution").innerHTML = `

    <div class="distribution-item">

      <div class="distribution-top">
        <span>Wins</span>
        <strong>
          ${stats.wins}
          ·
          ${winPercent.toFixed(1)}%
        </strong>
      </div>

      <div class="distribution-bar">
        <div
          class="distribution-fill win"
          style="width:${winPercent}%"
        ></div>
      </div>

    </div>


    <div class="distribution-item">

      <div class="distribution-top">
        <span>Losses</span>
        <strong>
          ${stats.losses}
          ·
          ${lossPercent.toFixed(1)}%
        </strong>
      </div>

      <div class="distribution-bar">
        <div
          class="distribution-fill loss"
          style="width:${lossPercent}%"
        ></div>
      </div>

    </div>


    <div class="distribution-item">

      <div class="distribution-top">
        <span>Break Even</span>
        <strong>
          ${stats.breakeven}
          ·
          ${bePercent.toFixed(1)}%
        </strong>
      </div>

      <div class="distribution-bar">
        <div
          class="distribution-fill be"
          style="width:${bePercent}%"
        ></div>
      </div>

    </div>
  `;
}


/* =========================================================
   STREAKS
========================================================= */

function calculateStreaks(trades) {

  const ordered =
    sortTradesOldestFirst(trades);


  let currentWin = 0;
  let currentLoss = 0;

  let bestWin = 0;
  let bestLoss = 0;


  let winRun = 0;
  let lossRun = 0;


  for (const trade of ordered) {

    if (trade.result === "Win") {

      winRun++;
      lossRun = 0;

    } else if (trade.result === "Loss") {

      lossRun++;
      winRun = 0;

    } else {

      winRun = 0;
      lossRun = 0;
    }


    bestWin =
      Math.max(
        bestWin,
        winRun
      );

    bestLoss =
      Math.max(
        bestLoss,
        lossRun
      );
  }


  for (
    let i = ordered.length - 1;
    i >= 0;
    i--
  ) {

    if (
      ordered[i].result === "Win"
    ) {

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

    if (
      ordered[i].result === "Loss"
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


/* =========================================================
   DAILY PERFORMANCE
========================================================= */

function renderDailyPerformance(trades) {

  const groups = {};


  trades.forEach(trade => {

    const key =
      dateKey(trade.date);

    if (!key) return;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(trade);
  });


  const rows =
    Object.entries(groups)
      .map(([date, list]) => {

        const stats =
          calculateStats(list);

        return {
          date,
          stats
        };
      })
      .sort(
        (a,b) =>
          b.date.localeCompare(a.date)
      )
      .slice(0, 15);


  $("dailyPerformanceBody").innerHTML =
    rows.length

      ? rows.map(item => `

          <tr>

            <td>
              ${escapeHtml(item.date)}
            </td>

            <td>
              ${item.stats.total}
            </td>

            <td>
              ${item.stats.wins}
            </td>

            <td>
              ${item.stats.losses}
            </td>

            <td>
              ${formatPL(item.stats.totalPL)}
            </td>

          </tr>

        `).join("")

      : `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              No daily data.
            </div>
          </td>
        </tr>
      `;
}


/* =========================================================
   MONTHLY PERFORMANCE
========================================================= */

function renderMonthlyPerformance(trades) {

  const groups = {};


  trades.forEach(trade => {

    const d =
      parseDateValue(trade.date);

    if (!d) return;

    const key =
      `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(trade);
  });


  const rows =
    Object.entries(groups)
      .map(([month, list]) => {

        return {
          month,
          stats:
            calculateStats(list)
        };
      })
      .sort(
        (a,b) =>
          b.month.localeCompare(a.month)
      );


  $("monthlyPerformanceBody").innerHTML =
    rows.length

      ? rows.map(item => `

          <tr>

            <td>
              ${escapeHtml(item.month)}
            </td>

            <td>
              ${item.stats.total}
            </td>

            <td>
              ${item.stats.wins}
            </td>

            <td>
              ${item.stats.losses}
            </td>

            <td>
              ${formatPL(item.stats.totalPL)}
            </td>

          </tr>

        `).join("")

      : `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              No monthly data.
            </div>
          </td>
        </tr>
      `;
}


/* =========================================================
   RISK CALCULATOR
========================================================= */

[
  "calcBalance",
  "calcRiskPercent",
  "calcDirection",
  "calcEntry",
  "calcSL",
  "calcTP"
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


  let distance = 0;
  let reward = 0;


  if (
    entry > 0 &&
    sl > 0 &&
    tp > 0
  ) {

    if (direction === "Buy") {

      distance =
        Math.abs(entry - sl);

      reward =
        tp - entry;

    } else {

      distance =
        Math.abs(sl - entry);

      reward =
        entry - tp;
    }
  }


  const rr =
    distance > 0
      ? reward / distance
      : 0;


  /*
    Approximate XAUUSD calculation.
    Assumes roughly $100 P/L per 1 lot
    for a $1.00 gold move.
  */

  const lot =
    distance > 0
      ? riskAmount /
        (distance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    formatMoney(riskAmount);

  $("calcDistance").textContent =
    distance.toFixed(2);

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0.00";

  $("calcLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";
}


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate.setMonth(
        state.calendarDate.getMonth() - 1
      );

      renderCalendar();
    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate.setMonth(
        state.calendarDate.getMonth() + 1
      );

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


  $("calendarMonth").textContent =
    new Intl.DateTimeFormat(
      undefined,
      {
        month: "long",
        year: "numeric"
      }
    ).format(date);


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


  const previousMonthDays =
    new Date(
      year,
      month,
      0
    ).getDate();


  let html = "";


  for (
    let i = firstDay - 1;
    i >= 0;
    i--
  ) {

    const day =
      previousMonthDays - i;

    const d =
      new Date(
        year,
        month - 1,
        day
      );

    html +=
      createCalendarDay(
        d,
        true
      );
  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const d =
      new Date(
        year,
        month,
        day
      );

    html +=
      createCalendarDay(
        d,
        false
      );
  }


  const totalCells =
    firstDay +
    daysInMonth;


  const remaining =
    Math.ceil(
      totalCells / 7
    ) * 7 -
    totalCells;


  for (
    let day = 1;
    day <= remaining;
    day++
  ) {

    const d =
      new Date(
        year,
        month + 1,
        day
      );

    html +=
      createCalendarDay(
        d,
        true
      );
  }


  $("calendarGrid").innerHTML =
    html;


  $("calendarGrid")
    .querySelectorAll("[data-date]")
    .forEach(day => {

      day.addEventListener(
        "click",
        () => {

          showCalendarDate(
            day.dataset.date
          );
        }
      );

    });


  if (!state.selectedCalendarDate) {

    showCalendarDate(
      todayString()
    );
  } else {

    showCalendarDate(
      state.selectedCalendarDate
    );
  }
}


function createCalendarDay(
  date,
  otherMonth
) {

  const key =
    dateKey(date);


  const trades =
    state.trades.filter(
      t =>
        dateKey(t.date) === key
    );


  const pl =
    trades.reduce(
      (sum,t) =>
        sum + num(t.profitLoss),
      0
    );


  const today =
    key === todayString();


  return `

    <div
      class="calendar-day
        ${otherMonth ? "other-month" : ""}
        ${today ? "today" : ""}"
      data-date="${key}"
    >

      <div class="calendar-day-number">
        ${date.getDate()}
      </div>

      ${
        trades.length
          ? `
            <div class="calendar-day-info">
              ${trades.length} trade${trades.length === 1 ? "" : "s"}
            </div>

            <div
              class="calendar-day-pl ${
                pl >= 0
                  ? "profit"
                  : "loss"
              }"
            >
              ${pl >= 0 ? "+" : ""}
              ${formatMoney(pl)}
            </div>
          `
          : ""
      }

    </div>
  `;
}


function showCalendarDate(key) {

  state.selectedCalendarDate =
    key;


  const trades =
    state.trades.filter(
      t =>
        dateKey(t.date) === key
    );


  $("selectedDateTitle").textContent =
    key;


  if (!trades.length) {

    $("selectedDateContent").innerHTML =
      `<div class="empty-state">
        No trades on this date.
      </div>`;

    return;
  }


  $("selectedDateContent").innerHTML =
    trades.map(trade => `

      <div class="recent-trade">

        <div>

          <strong>
            ${escapeHtml(
              trade.pair || "XAUUSD"
            )}
          </strong>

          <small>
            ${escapeHtml(
              trade.strategy
            )}
            ·
            ${escapeHtml(
              trade.direction
            )}
            ·
            ${escapeHtml(
              trade.result
            )}
          </small>

        </div>

        <strong>
          ${formatPL(
            trade.profitLoss
          )}
        </strong>

      </div>

    `).join("");
}


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );


function exportCSV() {

  const trades =
    getFilteredTrades();


  if (!trades.length) {

    showToast(
      "There are no trades to export.",
      true
    );

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
    "Stop Loss",
    "Take Profit",
    "RR",
    "Risk Amount",
    "Lot Size",
    "Result",
    "P/L",
    "Confidence",
    "Emotion",
    "Notes"
  ];


  const rows =
    trades.map(t => [

      t.tradeId,
      t.date,
      t.pair || "XAUUSD",
      t.tradingType,
      t.direction,
      t.strategy,
      t.session,
      t.bias,
      t.entry,
      t.sl,
      t.tp,
      t.rr,
      t.riskAmount,
      t.lotSize,
      t.result,
      t.profitLoss,
      t.confidence,
      t.emotion,
      t.notes

    ]);


  const csv = [
    headers,
    ...rows
  ]
  .map(row =>
    row.map(value =>
      `"${String(value ?? "")
        .replaceAll('"', '""')}"`
    ).join(",")
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


  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    `ujr-fx-journal-${todayString()}.csv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
}


/* =========================================================
   NAVIGATION
========================================================= */

const pageInfo = {

  dashboard: {
    title: "Dashboard",
    subtitle: "Trading overview"
  },

  journal: {
    title: "Journal",
    subtitle: "Your trading history"
  },

  analytics: {
    title: "Analytics",
    subtitle: "Performance analysis"
  },

  risk: {
    title: "Risk Calculator",
    subtitle: "Plan your risk"
  },

  calendar: {
    title: "Calendar",
    subtitle: "Trading activity"
  },

  settings: {
    title: "Settings",
    subtitle: "Journal settings"
  }
};


document.querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

        $("sidebar")
          .classList.remove("open");
      }
    );

  });


function showPage(page) {

  state.currentPage =
    page;


  document.querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove(
        "active-page"
      );

    });


  const target =
    $(`${page}Page`);

  if (target) {

    target.classList.add(
      "active-page"
    );
  }


  document.querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


  $("pageTitle").textContent =
    pageInfo[page]?.title ||
    page;

  $("pageSubtitle").textContent =
    pageInfo[page]?.subtitle ||
    "";


  if (page === "dashboard") {
    renderDashboard();
  }

  if (page === "journal") {
    renderJournal();
  }

  if (page === "analytics") {
    renderAnalytics();
  }

  if (page === "calendar") {
    renderCalendar();
  }

  if (page === "risk") {
    calculateRisk();
  }
}


/* =========================================================
   MOBILE MENU
========================================================= */

$("menuToggle")
  .addEventListener(
    "click",
    () => {

      $("sidebar")
        .classList.toggle("open");
    }
  );


/* =========================================================
   TOAST
========================================================= */

function showToast(
  message,
  error = false
) {

  let toast =
    document.getElementById(
      "toastMessage"
    );


  if (!toast) {

    toast =
      document.createElement("div");

    toast.id =
      "toastMessage";

    toast.style.position =
      "fixed";

    toast.style.right =
      "20px";

    toast.style.bottom =
      "20px";

    toast.style.zIndex =
      "1000";

    toast.style.padding =
      "12px 16px";

    toast.style.borderRadius =
      "11px";

    toast.style.background =
      error
        ? "#35151b"
        : "#16241e";

    toast.style.border =
      "1px solid " +
      (
        error
          ? "rgba(255,92,112,.3)"
          : "rgba(54,211,153,.3)"
      );

    toast.style.color =
      "white";

    toast.style.fontSize =
      "12px";

    document.body.appendChild(
      toast
    );
  }


  toast.textContent =
    message;

  toast.style.display =
    "block";


  clearTimeout(
    toast._timer
  );


  toast._timer =
    setTimeout(
      () => {

        toast.style.display =
          "none";

      },
      2500
    );
}


/* =========================================================
   START
========================================================= */

calculateRisk();
