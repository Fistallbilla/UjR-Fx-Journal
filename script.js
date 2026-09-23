/* =========================================================
   UjR Fx Trading Journal
   FIREBASE + APP LOGIC

   IMPORTANT:
   Existing data path:
   users/{UID}/trades

   This version also checks the old top-level:
   trades/{tradeId}

   where userId / uid belongs to the logged-in user.
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
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);


function num(value) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}


function nullableNum(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

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

  const year = d.getFullYear();

  const month = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function money(value) {

  const currency =
    state.settings.currency || "USD";

  const amount = num(value);

  try {

    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }
    ).format(amount);

  } catch {

    return `${currency} ${amount.toFixed(2)}`;
  }
}


function moneyClass(value) {

  if (num(value) > 0) return "positive";

  if (num(value) < 0) return "negative";

  return "neutral";
}


function formatRR(value) {

  const n = nullableNum(value);

  if (n === null || n <= 0) {
    return "-";
  }

  return `1:${n.toFixed(2)}`;
}


function formatDate(dateString) {

  if (!dateString) return "-";

  const parts = String(dateString).split("-");

  if (parts.length !== 3) {
    return escapeHtml(dateString);
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


function sortTradesNewestFirst(trades) {

  return [...trades].sort((a, b) => {

    const da =
      `${a.date || ""} ${a.time || ""}`;

    const db =
      `${b.date || ""} ${b.time || ""}`;

    return db.localeCompare(da);
  });
}


function sortTradesOldestFirst(trades) {

  return [...trades].sort((a, b) => {

    const da =
      `${a.date || ""} ${a.time || ""}`;

    const db =
      `${b.date || ""} ${b.time || ""}`;

    return da.localeCompare(db);
  });
}


/* =========================================================
   STATE
========================================================= */

const state = {

  user: null,

  trades: [],

  editingId: null,

  currentPage: "dashboard",

  calendarDate: new Date(),

  settings: {

    startingBalance: 0,

    currency: "USD"
  }

};


/* =========================================================
   FIRESTORE REFERENCES
========================================================= */

function userTradesRef() {

  if (!state.user) {
    throw new Error("User is not logged in.");
  }

  return collection(
    db,
    "users",
    state.user.uid,
    "trades"
  );
}


function userSettingsRef() {

  if (!state.user) {
    throw new Error("User is not logged in.");
  }

  return doc(
    db,
    "users",
    state.user.uid
  );
}


/* =========================================================
   NORMALIZE OLD DATA
========================================================= */

/*
  This is the most important compatibility function.

  Old journal versions may have used:
  setup
  htfBias
  psychology
  profit
  pnl
  RR
  etc.

  New UI uses:
  strategy
  bias
  emotion
  profitLoss
  rr

  We support BOTH.
*/

function normalizeTrade(id, d) {

  const rawPL =
    d.profitLoss ??
    d.profit ??
    d.pnl ??
    d.PnL ??
    d.pl ??
    0;


  const rawRR =
    d.rr ??
    d.RR ??
    d.riskReward ??
    0;


  const rawStrategy =
    d.strategy ??
    d.setup ??
    d.setupType ??
    "";


  const rawBias =
    d.bias ??
    d.htfBias ??
    d.marketBias ??
    "";


  const rawEmotion =
    d.emotion ??
    d.psychology ??
    "";


  let pair =
    d.pair ??
    d.symbol ??
    d.instrument ??
    "XAUUSD";


  pair = String(pair || "XAUUSD")
    .trim()
    .toUpperCase();


  if (!pair) {
    pair = "XAUUSD";
  }


  return {

    id,

    date:
      d.date ??
      d.tradeDate ??
      "",

    time:
      d.time ??
      d.tradeTime ??
      "",

    pair,

    tradingType:
      d.tradingType ??
      d.tradeType ??
      d.type ??
      "Scalping",

    direction:
      d.direction ??
      d.side ??
      "Buy",

    strategy:
      rawStrategy,

    session:
      d.session ??
      "",

    bias:
      rawBias,

    liquidity:
      d.liquidity ??
      "",

    confirmation:
      d.confirmation ??
      "",

    entry:
      nullableNum(
        d.entry ??
        d.entryPrice
      ),

    sl:
      nullableNum(
        d.sl ??
        d.stopLoss
      ),

    tp:
      nullableNum(
        d.tp ??
        d.takeProfit
      ),

    rr:
      nullableNum(rawRR),

    riskAmount:
      nullableNum(
        d.riskAmount ??
        d.riskedAmount ??
        d.risk
      ) ?? 0,

    riskPercent:
      nullableNum(
        d.riskPercent
      ) ?? 0,

    lotSize:
      nullableNum(
        d.lotSize ??
        d.lots
      ) ?? 0,

    result:
      d.result ??
      "Break Even",

    profitLoss:
      num(rawPL),

    confidence:
      d.confidence ??
      "",

    emotion:
      rawEmotion,

    mistake:
      d.mistake ??
      "",

    notes:
      d.notes ??
      "",

    createdAt:
      d.createdAt ??
      d.savedAt ??
      null,

    updatedAt:
      d.updatedAt ??
      null,

    source:
      d.userId ||
      d.uid
        ? "legacy"
        : "current"

  };
}


/* =========================================================
   LOAD SETTINGS
========================================================= */

async function loadSettings() {

  if (!state.user) return;

  try {

    const snap =
      await getDoc(userSettingsRef());


    if (snap.exists()) {

      const d = snap.data();


      state.settings.startingBalance =
        num(
          d.startingBalance ??
          d.balance ??
          0
        );


      state.settings.currency =
        d.currency ||
        "USD";

    }

  } catch (error) {

    console.error(
      "Settings load error:",
      error
    );

  }

  renderSettings();

}


/* =========================================================
   LOAD TRADES
========================================================= */

async function loadTrades() {

  if (!state.user) return;


  const allTrades = new Map();


  /* ---------------------------------------------------------
     1. CURRENT STRUCTURE
     users/{uid}/trades
  --------------------------------------------------------- */

  try {

    const currentSnapshot =
      await getDocs(userTradesRef());


    currentSnapshot.forEach(docSnap => {

      allTrades.set(
        `current-${docSnap.id}`,
        normalizeTrade(
          docSnap.id,
          docSnap.data()
        )
      );

    });

  } catch (error) {

    console.error(
      "Current trades load error:",
      error
    );

  }


  /* ---------------------------------------------------------
     2. LEGACY TOP-LEVEL STRUCTURE
     trades/{id}
     where userId == current UID
  --------------------------------------------------------- */

  try {

    const legacyQuery = query(
      collection(db, "trades"),
      where(
        "userId",
        "==",
        state.user.uid
      )
    );


    const legacySnapshot =
      await getDocs(legacyQuery);


    legacySnapshot.forEach(docSnap => {

      const trade =
        normalizeTrade(
          docSnap.id,
          docSnap.data()
        );


      /*
        Don't overwrite current structure
        if the same document already exists.
      */

      const duplicate =
        [...allTrades.values()]
          .some(existing =>
            existing.id === trade.id
          );


      if (!duplicate) {

        allTrades.set(
          `legacy-${docSnap.id}`,
          trade
        );

      }

    });

  } catch (error) {

    /*
      If Firebase rules don't allow the legacy
      top-level collection, don't break the app.
    */

    console.warn(
      "Legacy trade collection not available:",
      error
    );

  }


  /* ---------------------------------------------------------
     3. ANOTHER POSSIBLE OLD STRUCTURE
     trades/{id}
     where uid == current UID
  --------------------------------------------------------- */

  try {

    const legacyUidQuery = query(
      collection(db, "trades"),
      where(
        "uid",
        "==",
        state.user.uid
      )
    );


    const legacyUidSnapshot =
      await getDocs(legacyUidQuery);


    legacyUidSnapshot.forEach(docSnap => {

      const trade =
        normalizeTrade(
          docSnap.id,
          docSnap.data()
        );


      const duplicate =
        [...allTrades.values()]
          .some(existing =>
            existing.id === trade.id
          );


      if (!duplicate) {

        allTrades.set(
          `legacy-uid-${docSnap.id}`,
          trade
        );

      }

    });

  } catch (error) {

    console.warn(
      "Legacy UID collection not available:",
      error
    );

  }


  state.trades =
    sortTradesNewestFirst(
      [...allTrades.values()]
    );


  renderAll();
}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadUserData() {

  await loadSettings();

  await loadTrades();

}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  if (!state.user) return;


  const name =
    state.user.displayName ||
    "Trader";


  const email =
    state.user.email ||
    "-";


  const photo =
    state.user.photoURL ||
    "logo.png";


  $("sidebarUserName").textContent =
    name;

  $("sidebarUserEmail").textContent =
    email;

  $("sidebarUserPhoto").src =
    photo;


  $("topUserName").textContent =
    name;

  $("topUserEmail").textContent =
    email;

  $("topUserPhoto").src =
    photo;


  $("settingsName").textContent =
    name;

  $("settingsEmail").textContent =
    email;

  $("settingsPhoto").src =
    photo;

}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

$("googleLoginBtn").addEventListener(
  "click",
  async () => {

    const button =
      $("googleLoginBtn");


    button.disabled = true;

    button.innerHTML = `
      <span class="google-icon">G</span>
      <span>Signing in...</span>
    `;


    $("loginError").textContent = "";


    try {

      await signInWithPopup(
        auth,
        provider
      );

    } catch (error) {

      console.error(
        "Google Login Error:",
        error
      );


      if (
        error.code ===
        "auth/popup-blocked"
      ) {

        $("loginError").textContent =
          "Popup was blocked. Allow popups for this website.";

      } else if (
        error.code ===
        "auth/popup-closed-by-user"
      ) {

        $("loginError").textContent =
          "Login window was closed.";

      } else if (
        error.code ===
        "auth/unauthorized-domain"
      ) {

        $("loginError").textContent =
          "This website domain is not authorized in Firebase.";

      } else if (
        error.code ===
        "auth/operation-not-allowed"
      ) {

        $("loginError").textContent =
          "Google login is not enabled in Firebase.";

      } else if (
        error.code ===
        "auth/network-request-failed"
      ) {

        $("loginError").textContent =
          "Network error. Check your internet connection.";

      } else {

        $("loginError").textContent =
          error.message ||
          "Google login failed.";

      }

    } finally {

      button.disabled = false;

      button.innerHTML = `
        <span class="google-icon">G</span>
        <span>Continue with Google</span>
      `;

    }

  }
);


/* =========================================================
   REDIRECT RESULT
========================================================= */

getRedirectResult(auth)
  .catch(error => {

    if (error) {

      console.error(
        "Redirect auth error:",
        error
      );

    }

  });


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    if (user) {

      state.user = user;

      $("loginScreen")
        .classList
        .add("hidden");

      $("app")
        .classList
        .remove("hidden");


      updateUserUI();


      await loadUserData();


      showPage(
        state.currentPage
      );

    } else {

      state.user = null;

      state.trades = [];

      $("loginScreen")
        .classList
        .remove("hidden");

      $("app")
        .classList
        .add("hidden");

    }

  }
);


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

    }

  }
);


/* =========================================================
   NAVIGATION
========================================================= */

document
  .querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const page =
          button.dataset.page;

        showPage(page);

        closeMobileSidebar();

      }

    );

  });


function showPage(page) {

  state.currentPage =
    page;


  document
    .querySelectorAll(".page")
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


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


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


  if (page === "settings") {

    renderSettings();

  }


  if (page === "risk") {

    calculateRisk();

  }

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

$("menuToggle").addEventListener(
  "click",
  () => {

    $("sidebar")
      .classList
      .toggle("open");

    $("sidebarOverlay")
      .classList
      .toggle("show");

  }
);


$("sidebarOverlay").addEventListener(
  "click",
  closeMobileSidebar
);


function closeMobileSidebar() {

  $("sidebar")
    .classList
    .remove("open");

  $("sidebarOverlay")
    .classList
    .remove("show");

}


/* =========================================================
   TRADE MODAL
========================================================= */

document
  .querySelectorAll("[data-open-trade]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        openTradeModal();

      }

    );

  });


document
  .querySelectorAll("[data-close-trade]")
  .forEach(element => {

    element.addEventListener(
      "click",
      closeTradeModal
    );

  });


$("closeTradeModal")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("cancelTradeBtn")
  .addEventListener(
    "click",
    closeTradeModal
  );


function openTradeModal(trade = null) {

  state.editingId =
    trade?.id || null;


  $("tradeForm").reset();


  $("tradeDate").value =
    trade?.date ||
    todayString();


  $("tradeTime").value =
    trade?.time ||
    "";


  $("pair").value =
    trade?.pair ||
    "XAUUSD";


  $("tradingType").value =
    trade?.tradingType ||
    "Scalping";


  $("direction").value =
    trade?.direction ||
    "Buy";


  $("strategy").value =
    trade?.strategy ||
    "Liquidity Sweep";


  $("session").value =
    trade?.session ||
    "London";


  $("bias").value =
    trade?.bias ||
    "Bullish";


  $("entry").value =
    trade?.entry ??
    "";


  $("sl").value =
    trade?.sl ??
    "";


  $("tp").value =
    trade?.tp ??
    "";


  $("riskAmount").value =
    trade?.riskAmount ??
    "";


  $("lotSize").value =
    trade?.lotSize ??
    "";


  $("result").value =
    trade?.result ||
    "Win";


  $("profitLoss").value =
    trade
      ? trade.profitLoss
      : "";


  $("confidence").value =
    trade?.confidence ||
    "3/5";


  $("emotion").value =
    trade?.emotion ||
    "Calm";


  $("mistake").value =
    trade?.mistake ||
    "";


  $("notes").value =
    trade?.notes ||
    "";


  $("tradeError").textContent =
    "";


  $("tradeModalTitle").textContent =
    trade
      ? "Edit Trade"
      : "Add Trade";


  $("saveTradeText").textContent =
    trade
      ? "Update Trade"
      : "Save Trade";


  calculateTradeRR();


  $("tradeModal")
    .classList
    .remove("hidden");

}


function closeTradeModal() {

  $("tradeModal")
    .classList
    .add("hidden");

  state.editingId = null;

}


/* =========================================================
   RR
========================================================= */

function calculateTradeRR() {

  const entry =
    num($("entry").value);

  const sl =
    num($("sl").value);

  const tp =
    num($("tp").value);

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


  if (
    risk <= 0 ||
    reward <= 0
  ) {

    $("rr").value =
      "Invalid";

    return 0;

  }


  const rr =
    reward / risk;


  $("rr").value =
    `1:${rr.toFixed(2)}`;


  return rr;

}


[
  "entry",
  "sl",
  "tp",
  "direction"
].forEach(id => {

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
   P/L NORMALIZATION
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

  }


  if (result === "Loss") {

    input.value =
      -Math.abs(value);

  }

}


function getNormalizedPL() {

  const result =
    $("result").value;

  const raw =
    $("profitLoss").value;


  if (
    result === "Break Even"
  ) {

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


$("result")
  .addEventListener(
    "change",
    normalizeProfitLossByResult
  );


$("profitLoss")
  .addEventListener(
    "blur",
    normalizeProfitLossByResult
  );


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!state.user) {

        $("tradeError").textContent =
          "Please login first.";

        return;

      }


      $("tradeError").textContent =
        "";


      const date =
        $("tradeDate").value;


      const pair =
        $("pair").value
          .trim()
          .toUpperCase();


      const entry =
        Number($("entry").value);


      const sl =
        Number($("sl").value);


      const tp =
        Number($("tp").value);


      const riskRaw =
        $("riskAmount").value.trim();


      const riskAmount =
        riskRaw === ""
          ? 0
          : Number(riskRaw);


      const lotRaw =
        $("lotSize").value.trim();


      const lotSize =
        lotRaw === ""
          ? 0
          : Number(lotRaw);


      const rr =
        calculateTradeRR();


      const profitLoss =
        getNormalizedPL();


      /* -----------------------------------------------------
         VALIDATION
      ----------------------------------------------------- */

      if (!date) {

        $("tradeError").textContent =
          "Please select the trade date.";

        return;

      }


      if (!pair) {

        $("tradeError").textContent =
          "Pair is required.";

        return;

      }


      if (
        !Number.isFinite(entry) ||
        entry <= 0
      ) {

        $("tradeError").textContent =
          "Entry must be a valid positive number.";

        return;

      }


      if (
        !Number.isFinite(sl) ||
        sl <= 0
      ) {

        $("tradeError").textContent =
          "Stop Loss must be a valid positive number.";

        return;

      }


      if (
        !Number.isFinite(tp) ||
        tp <= 0
      ) {

        $("tradeError").textContent =
          "Take Profit must be a valid positive number.";

        return;

      }


      if (!rr || rr <= 0) {

        $("tradeError").textContent =
          "Entry, SL and TP do not create a valid R:R for this direction.";

        return;

      }


      if (
        !Number.isFinite(riskAmount) ||
        riskAmount < 0
      ) {

        $("tradeError").textContent =
          "Risk Amount must be a valid number.";

        return;

      }


      if (
        !Number.isFinite(lotSize) ||
        lotSize < 0
      ) {

        $("tradeError").textContent =
          "Lot Size must be a valid number.";

        return;

      }


      if (profitLoss === null) {

        $("tradeError").textContent =
          "Please enter Profit / Loss manually.";

        return;

      }


      const tradeData = {

        date,

        time:
          $("tradeTime").value || "",

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

        rr: Number(
          rr.toFixed(4)
        ),

        riskAmount,

        lotSize,

        result:
          $("result").value,

        profitLoss,

        confidence:
          $("confidence").value,

        emotion:
          $("emotion").value,

        mistake:
          $("mistake").value.trim(),

        notes:
          $("notes").value.trim(),

        updatedAt:
          serverTimestamp()

      };


      try {

        if (state.editingId) {

          /*
            Existing current data is edited here.
          */

          await updateDoc(
            doc(
              db,
              "users",
              state.user.uid,
              "trades",
              state.editingId
            ),
            tradeData
          );


          showToast(
            "Trade updated successfully."
          );

        } else {

          /*
            New trades ALWAYS use the same
            current structure.
          */

          await addDoc(
            userTradesRef(),
            {
              ...tradeData,

              createdAt:
                serverTimestamp()
            }
          );


          showToast(
            "Trade added successfully."
          );

        }


        closeTradeModal();

        await loadTrades();

      } catch (error) {

        console.error(
          "Save trade error:",
          error
        );


        $("tradeError").textContent =
          error.message ||
          "Could not save the trade.";

      }

    }
  );


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

  renderSettings();

  updateJournalPairFilter();

}


/* =========================================================
   ANALYTICS CALCULATIONS
========================================================= */

function calculateStats(trades) {

  const totalTrades =
    trades.length;


  const wins =
    trades.filter(
      t => t.result === "Win"
    ).length;


  const losses =
    trades.filter(
      t => t.result === "Loss"
    ).length;


  const breakEven =
    trades.filter(
      t => t.result === "Break Even"
    ).length;


  const totalPL =
    trades.reduce(
      (sum, t) =>
        sum + num(t.profitLoss),
      0
    );


  const grossProfit =
    trades.reduce(
      (sum, t) =>
        sum +
        (
          num(t.profitLoss) > 0
            ? num(t.profitLoss)
            : 0
        ),
      0
    );


  const grossLoss =
    Math.abs(
      trades.reduce(
        (sum, t) =>
          sum +
          (
            num(t.profitLoss) < 0
              ? num(t.profitLoss)
              : 0
          ),
        0
      )
    );


  let profitFactor = 0;


  if (grossLoss > 0) {

    profitFactor =
      grossProfit / grossLoss;

  } else if (
    grossProfit > 0
  ) {

    profitFactor =
      Infinity;

  }


  const winRate =
    totalTrades > 0
      ? wins / totalTrades * 100
      : 0;


  const averagePL =
    totalTrades > 0
      ? totalPL / totalTrades
      : 0;


  const averageWin =
    wins > 0
      ? grossProfit / wins
      : 0;


  const averageLoss =
    losses > 0
      ? grossLoss / losses
      : 0;


  const validRR =
    trades
      .map(t => nullableNum(t.rr))
      .filter(
        value =>
          value !== null &&
          value > 0
      );


  const averageRR =
    validRR.length > 0
      ? validRR.reduce(
          (a,b) => a+b,
          0
        ) / validRR.length
      : 0;


  const validRisk =
    trades
      .map(t =>
        nullableNum(t.riskAmount)
      )
      .filter(
        value =>
          value !== null &&
          value >= 0
      );


  const averageRisk =
    validRisk.length > 0
      ? validRisk.reduce(
          (a,b) => a+b,
          0
        ) / validRisk.length
      : 0;


  const bestTrade =
    totalTrades > 0
      ? Math.max(
          ...trades.map(
            t => num(t.profitLoss)
          )
        )
      : 0;


  const worstTrade =
    totalTrades > 0
      ? Math.min(
          ...trades.map(
            t => num(t.profitLoss)
          )
        )
      : 0;


  /*
    Max drawdown.
  */

  const chronological =
    sortTradesOldestFirst(
      trades
    );


  let equity = 0;

  let peak = 0;

  let maxDrawdown = 0;


  chronological.forEach(trade => {

    equity +=
      num(trade.profitLoss);


    if (equity > peak) {

      peak = equity;

    }


    const drawdown =
      equity - peak;


    if (drawdown < maxDrawdown) {

      maxDrawdown =
        drawdown;

    }

  });


  const streaks =
    calculateStreaks(
      chronological
    );


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

    averageRR,

    averageRisk,

    expectancy: averagePL,

    bestTrade,

    worstTrade,

    maxDrawdown,

    ...streaks

  };

}


/* =========================================================
   STREAKS
========================================================= */

function calculateStreaks(
  chronologicalTrades
) {

  let currentWinStreak = 0;

  let currentLossStreak = 0;

  let bestWinStreak = 0;

  let bestLossStreak = 0;


  let winRun = 0;

  let lossRun = 0;


  chronologicalTrades.forEach(trade => {

    if (trade.result === "Win") {

      winRun++;

      lossRun = 0;

    } else if (
      trade.result === "Loss"
    ) {

      lossRun++;

      winRun = 0;

    } else {

      winRun = 0;

      lossRun = 0;

    }


    bestWinStreak =
      Math.max(
        bestWinStreak,
        winRun
      );


    bestLossStreak =
      Math.max(
        bestLossStreak,
        lossRun
      );

  });


  for (
    let i =
      chronologicalTrades.length - 1;
    i >= 0;
    i--
  ) {

    if (
      chronologicalTrades[i].result ===
      "Win"
    ) {

      currentWinStreak++;

    } else {

      break;

    }

  }


  for (
    let i =
      chronologicalTrades.length - 1;
    i >= 0;
    i--
  ) {

    if (
      chronologicalTrades[i].result ===
      "Loss"
    ) {

      currentLossStreak++;

    } else {

      break;

    }

  }


  return {

    currentWinStreak,

    currentLossStreak,

    bestWinStreak,

    bestLossStreak

  };

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const stats =
    calculateStats(
      state.trades
    );


  $("dashTotalTrades").textContent =
    stats.totalTrades;


  $("dashWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;


  setMoney(
    $("dashTotalPL"),
    stats.totalPL
  );


  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";


  $("dashAvgRR").textContent =
    stats.averageRR > 0
      ? `1:${stats.averageRR.toFixed(2)}`
      : "-";


  setMoney(
    $("dashExpectancy"),
    stats.expectancy
  );


  $("dashWins").textContent =
    stats.wins;


  $("dashLosses").textContent =
    stats.losses;


  $("dashBE").textContent =
    stats.breakEven;


  setMoney(
    $("dashBest"),
    stats.bestTrade
  );


  setMoney(
    $("dashWorst"),
    stats.worstTrade
  );


  setMoney(
    $("dashDrawdown"),
    stats.maxDrawdown
  );


  renderEquity(
    $("dashboardEquity"),
    state.trades
  );


  renderRecentTrades();

}


/* =========================================================
   MONEY ELEMENT
========================================================= */

function setMoney(
  element,
  value
) {

  element.textContent =
    money(value);


  element.classList.remove(
    "positive",
    "negative",
    "neutral"
  );


  element.classList.add(
    moneyClass(value)
  );

}


/* =========================================================
   EQUITY
========================================================= */

function renderEquity(
  container,
  trades
) {

  if (!container) return;


  const chronological =
    sortTradesOldestFirst(
      trades
    );


  if (!chronological.length) {

    container.innerHTML = `
      <div class="no-chart">
        No trading data yet.
      </div>
    `;

    return;

  }


  let equity = 0;


  const points =
    chronological.map(
      trade => {

        equity +=
          num(trade.profitLoss);

        return {

          equity,

          date:
            trade.date || ""

        };

      }
    );


  const maxAbs =
    Math.max(
      1,
      ...points.map(
        p => Math.abs(p.equity)
      )
    );


  container.innerHTML =
    points.map(
      (point, index) => {

        const height =
          Math.max(
            3,
            Math.abs(point.equity) /
              maxAbs *
              150
          );


        const negative =
          point.equity < 0
            ? "negative"
            : "";


        return `
          <div class="equity-bar-wrap">

            <span class="equity-value">
              ${money(point.equity)}
            </span>

            <div
              class="equity-bar ${negative}"
              style="height:${height}px"
            ></div>

            <span class="equity-label">
              ${escapeHtml(
                point.date?.slice(5) ||
                String(index + 1)
              )}
            </span>

          </div>
        `;

      }
    )
    .join("");

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const container =
    $("recentTrades");


  const trades =
    sortTradesNewestFirst(
      state.trades
    ).slice(0, 7);


  if (!trades.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">▤</div>
        <h3>No trades yet</h3>
        <p>Add your first journal entry.</p>
      </div>
    `;

    return;

  }


  container.innerHTML =
    trades.map(
      trade => {

        const pl =
          num(trade.profitLoss);


        return `
          <div class="recent-item">

            <div class="recent-main">

              <strong>
                ${escapeHtml(
                  trade.pair ||
                  "XAUUSD"
                )}
                ·
                ${escapeHtml(
                  trade.strategy ||
                  "-"
                )}
              </strong>

              <span>
                ${escapeHtml(
                  trade.date ||
                  "-"
                )}
                ·
                ${escapeHtml(
                  trade.result ||
                  "-"
                )}
              </span>

            </div>

            <strong
              class="recent-pl ${moneyClass(pl)}"
            >
              ${money(pl)}
            </strong>

          </div>
        `;

      }
    )
    .join("");

}


/* =========================================================
   JOURNAL FILTERS
========================================================= */

[
  "journalSearch",
  "journalPairFilter",
  "journalResultFilter",
  "journalTypeFilter",
  "journalDateFilter"
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
  .addEventListener(
    "click",
    () => {

      $("journalSearch").value =
        "";

      $("journalPairFilter").value =
        "";

      $("journalResultFilter").value =
        "";

      $("journalTypeFilter").value =
        "";

      $("journalDateFilter").value =
        "";

      renderJournal();

    }
  );


function updateJournalPairFilter() {

  const select =
    $("journalPairFilter");


  const current =
    select.value;


  const pairs =
    [
      ...new Set(
        state.trades
          .map(t =>
            (
              t.pair ||
              "XAUUSD"
            ).toUpperCase()
          )
      )
    ]
    .sort();


  select.innerHTML = `
    <option value="">
      All Pairs
    </option>
  `;


  pairs.forEach(pair => {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      pair;

    option.textContent =
      pair;

    select.appendChild(
      option
    );

  });


  if (
    pairs.includes(current)
  ) {

    select.value =
      current;

  }

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

  updateJournalPairFilter();


  const search =
    $("journalSearch")
      .value
      .trim()
      .toLowerCase();


  const pair =
    $("journalPairFilter")
      .value;


  const result =
    $("journalResultFilter")
      .value;


  const type =
    $("journalTypeFilter")
      .value;


  const date =
    $("journalDateFilter")
      .value;


  let trades =
    sortTradesNewestFirst(
      state.trades
    );


  trades =
    trades.filter(
      trade => {

        const searchText =
          [
            trade.pair,
            trade.strategy,
            trade.direction,
            trade.session,
            trade.bias,
            trade.tradingType
          ]
          .join(" ")
          .toLowerCase();


        if (
          search &&
          !searchText.includes(search)
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
          result &&
          trade.result !== result
        ) {

          return false;

        }


        if (
          type &&
          trade.tradingType !== type
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

      }
    );


  const body =
    $("journalTableBody");


  const empty =
    $("journalEmpty");


  if (!trades.length) {

    body.innerHTML = "";

    empty.classList.remove(
      "hidden"
    );

    return;

  }


  empty.classList.add(
    "hidden"
  );


  body.innerHTML =
    trades.map(
      trade => {

        let resultClass =
          "result-be";


        if (
          trade.result === "Win"
        ) {

          resultClass =
            "result-win";

        } else if (
          trade.result === "Loss"
        ) {

          resultClass =
            "result-loss";

        }


        return `
          <tr>

            <td>
              ${formatDate(
                trade.date
              )}
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  trade.pair ||
                  "XAUUSD"
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                trade.tradingType ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                trade.direction ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                trade.strategy ||
                "-"
              )}
            </td>

            <td>
              ${trade.entry ?? "-"}
            </td>

            <td>
              ${formatRR(
                trade.rr
              )}
            </td>

            <td>
              <span
                class="result-badge ${resultClass}"
              >
                ${escapeHtml(
                  trade.result ||
                  "-"
                )}
              </span>
            </td>

            <td
              class="${moneyClass(
                trade.profitLoss
              )}"
            >
              <strong>
                ${money(
                  trade.profitLoss
                )}
              </strong>
            </td>

            <td>

              <div class="action-buttons">

                <button
                  class="action-btn edit"
                  data-edit-id="${escapeHtml(
                    trade.id
                  )}"
                  title="Edit"
                >
                  ✎
                </button>

                <button
                  class="action-btn delete"
                  data-delete-id="${escapeHtml(
                    trade.id
                  )}"
                  title="Delete"
                >
                  ×
                </button>

              </div>

            </td>

          </tr>
        `;

      }
    )
    .join("");


  document
    .querySelectorAll("[data-edit-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            state.trades.find(
              t =>
                t.id ===
                button.dataset.editId
            );


          if (trade) {

            /*
              Only current-structure documents
              can safely be updated through
              this editor.

              Legacy records are also displayed.
            */

            openTradeModal(
              trade
            );

          }

        }
      );

    });


  document
    .querySelectorAll("[data-delete-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const id =
            button.dataset.deleteId;


          const trade =
            state.trades.find(
              t => t.id === id
            );


          if (!trade) return;


          const confirmed =
            confirm(
              `Delete ${trade.pair || "XAUUSD"} trade?`
            );


          if (!confirmed) return;


          await deleteTrade(
            trade
          );

        }
      );

    });

}


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(trade) {

  try {

    /*
      First try the current structure.
    */

    try {

      await deleteDoc(
        doc(
          db,
          "users",
          state.user.uid,
          "trades",
          trade.id
        )
      );


      showToast(
        "Trade deleted."
      );


      await loadTrades();

      return;

    } catch (currentError) {

      console.warn(
        "Current delete failed. Trying legacy...",
        currentError
      );

    }


    /*
      Legacy top-level.
    */

    await deleteDoc(
      doc(
        db,
        "trades",
        trade.id
      )
    );


    showToast(
      "Trade deleted."
    );


    await loadTrades();

  } catch (error) {

    console.error(
      "Delete error:",
      error
    );


    showToast(
      "Could not delete this trade.",
      true
    );

  }

}


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );


function csvEscape(value) {

  const text =
    String(value ?? "");


  return `"${text
    .replaceAll('"', '""')}"`;

}


function exportCSV() {

  const trades =
    sortTradesNewestFirst(
      state.trades
    );


  if (!trades.length) {

    showToast(
      "There are no trades to export.",
      true
    );

    return;

  }


  const headers = [

    "Date",
    "Time",
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
    "Profit/Loss",
    "Confidence",
    "Emotion",
    "Mistake",
    "Notes"

  ];


  const rows =
    trades.map(
      t => [

        t.date,
        t.time,
        t.pair,
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
        t.mistake,
        t.notes

      ].map(
        csvEscape
      ).join(",")
    );


  const csv =
    [
      headers.map(
        csvEscape
      ).join(","),
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
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    `ujr-fx-trading-journal-${todayString()}.csv`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );


  showToast(
    "CSV exported successfully."
  );

}


/* =========================================================
   ANALYTICS PERIOD
========================================================= */

$("analyticsPeriod")
  .addEventListener(
    "change",
    renderAnalytics
  );


function getAnalyticsTrades() {

  const period =
    $("analyticsPeriod").value;


  if (period === "all") {

    return state.trades;

  }


  const now =
    new Date();


  if (period === "month") {

    const year =
      now.getFullYear();


    const month =
      String(
        now.getMonth() + 1
      ).padStart(2, "0");


    const prefix =
      `${year}-${month}`;


    return state.trades.filter(
      trade =>
        String(
          trade.date || ""
        ).startsWith(prefix)
    );

  }


  const days =
    Number(period);


  const start =
    new Date();


  start.setHours(
    0,
    0,
    0,
    0
  );


  start.setDate(
    start.getDate() -
    (days - 1)
  );


  return state.trades.filter(
    trade => {

      if (!trade.date) {
        return false;
      }


      const parts =
        trade.date.split("-");


      if (parts.length !== 3) {
        return false;
      }


      const d =
        new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2])
        );


      return d >= start;

    }
  );

}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  const stats =
    calculateStats(
      trades
    );


  $("aTotalTrades").textContent =
    stats.totalTrades;


  $("aWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;


  setMoney(
    $("aTotalPL"),
    stats.totalPL
  );


  $("aProfitFactor").textContent =
    Number.isFinite(
      stats.profitFactor
    )
      ? stats.profitFactor.toFixed(2)
      : "∞";


  setMoney(
    $("aAveragePL"),
    stats.averagePL
  );


  setMoney(
    $("aAverageWin"),
    stats.averageWin
  );


  setMoney(
    $("aAverageLoss"),
    -stats.averageLoss
  );


  $("aAverageRR").textContent =
    stats.averageRR > 0
      ? `1:${stats.averageRR.toFixed(2)}`
      : "-";


  setMoney(
    $("aAverageRisk"),
    stats.averageRisk
  );


  setMoney(
    $("aExpectancy"),
    stats.expectancy
  );


  setMoney(
    $("aBestTrade"),
    stats.bestTrade
  );


  setMoney(
    $("aWorstTrade"),
    stats.worstTrade
  );


  setMoney(
    $("aMaxDrawdown"),
    stats.maxDrawdown
  );


  $("aCurrentWinStreak").textContent =
    stats.currentWinStreak;


  $("aCurrentLossStreak").textContent =
    stats.currentLossStreak;


  $("aBestWinStreak").textContent =
    stats.bestWinStreak;


  renderEquity(
    $("analyticsEquity"),
    trades
  );


  renderResultDistribution(
    trades
  );


  renderBreakdown(
    "pair",
    $("pairAnalyticsBody"),
    trades,
    true
  );


  renderBreakdown(
    "strategy",
    $("strategyAnalyticsBody"),
    trades
  );


  renderBreakdown(
    "session",
    $("sessionAnalyticsBody"),
    trades
  );


  renderBreakdown(
    "tradingType",
    $("typeAnalyticsBody"),
    trades
  );


  renderBreakdown(
    "direction",
    $("directionAnalyticsBody"),
    trades
  );


  renderBreakdown(
    "emotion",
    $("emotionAnalyticsBody"),
    trades
  );

}


/* =========================================================
   RESULT DISTRIBUTION
========================================================= */

function renderResultDistribution(
  trades
) {

  const container =
    $("resultDistribution");


  const total =
    trades.length || 1;


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


  const rows = [

    {
      label: "Wins",
      count: wins,
      className: ""
    },

    {
      label: "Losses",
      count: losses,
      className: "loss"
    },

    {
      label: "Break Even",
      count: be,
      className: "be"
    }

  ];


  container.innerHTML =
    rows.map(
      row => {

        const percent =
          row.count /
          total *
          100;


        return `
          <div class="distribution-row">

            <div class="distribution-top">
              <span>
                ${row.label}
              </span>

              <span>
                ${row.count}
                ·
                ${percent.toFixed(1)}%
              </span>
            </div>

            <div class="progress">

              <div
                class="progress-fill ${row.className}"
                style="width:${percent}%"
              ></div>

            </div>

          </div>
        `;

      }
    )
    .join("");

}


/* =========================================================
   BREAKDOWN
========================================================= */

function renderBreakdown(
  field,
  body,
  trades,
  isPair = false
) {

  const groups =
    new Map();


  trades.forEach(
    trade => {

      let key =
        trade[field];


      if (!key) {

        key =
          isPair
            ? "XAUUSD"
            : "Not Set";

      }


      if (isPair) {

        key =
          String(key)
            .toUpperCase();

      }


      if (!groups.has(key)) {

        groups.set(
          key,
          []
        );

      }


      groups
        .get(key)
        .push(trade);

    }
  );


  const entries =
    [...groups.entries()]
      .sort(
        (a,b) =>
          b[1].reduce(
            (sum,t) =>
              sum + num(t.profitLoss),
            0
          ) -
          a[1].reduce(
            (sum,t) =>
              sum + num(t.profitLoss),
            0
          )
      );


  if (!entries.length) {

    body.innerHTML = `
      <tr>
        <td colspan="6">
          <span class="neutral">
            No data
          </span>
        </td>
      </tr>
    `;

    return;

  }


  body.innerHTML =
    entries.map(
      ([key, group]) => {

        const stats =
          calculateStats(
            group
          );


        if (isPair) {

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(key)}
                </strong>
              </td>

              <td>
                ${stats.totalTrades}
              </td>

              <td>
                ${stats.wins}
              </td>

              <td>
                ${stats.losses}
              </td>

              <td>
                ${stats.winRate.toFixed(1)}%
              </td>

              <td
                class="${moneyClass(
                  stats.totalPL
                )}"
              >
                <strong>
                  ${money(
                    stats.totalPL
                  )}
                </strong>
              </td>

            </tr>
          `;

        }


        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(key)}
              </strong>
            </td>

            <td>
              ${stats.totalTrades}
            </td>

            <td>
              ${stats.winRate.toFixed(1)}%
            </td>

            <td
              class="${moneyClass(
                stats.totalPL
              )}"
            >
              <strong>
                ${money(
                  stats.totalPL
                )}
              </strong>
            </td>

          </tr>
        `;

      }
    )
    .join("");

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


$("calculateRiskBtn")
  .addEventListener(
    "click",
    calculateRisk
  );


function calculateRisk() {

  const balance =
    num(
      $("calcBalance").value ||
      state.settings.startingBalance
    );


  const riskPercent =
    num(
      $("calcRiskPercent").value
    );


  const entry =
    num(
      $("calcEntry").value
    );


  const sl =
    num(
      $("calcSL").value
    );


  const tp =
    num(
      $("calcTP").value
    );


  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  let stopDistance = 0;

  let rewardDistance = 0;


  if (
    entry > 0 &&
    sl > 0 &&
    tp > 0
  ) {

    if (
      direction === "Buy"
    ) {

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

  }


  const rr =
    stopDistance > 0 &&
    rewardDistance > 0

      ? rewardDistance /
        stopDistance

      : 0;


  /*
    Approximation for XAUUSD:
    1 standard lot ≈ 100 oz.

    This is only an approximate
    lot-size estimate and should not
    be treated as broker-specific.
  */

  const lot =
    stopDistance > 0

      ? riskAmount /
        (
          stopDistance *
          100
        )

      : 0;


  $("riskResultAmount").textContent =
    money(riskAmount);


  $("riskResultDistance").textContent =
    stopDistance > 0
      ? stopDistance.toFixed(3)
      : "0.00";


  $("riskResultRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "-";


  $("riskResultLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";

}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

  $("startingBalance").value =
    state.settings.startingBalance || "";


  $("currency").value =
    state.settings.currency ||
    "USD";


  if (state.user) {

    $("settingsName").textContent =
      state.user.displayName ||
      "Trader";

    $("settingsEmail").textContent =
      state.user.email ||
      "-";

    $("settingsPhoto").src =
      state.user.photoURL ||
      "logo.png";

  }

}


$("saveSettingsBtn")
  .addEventListener(
    "click",
    async () => {

      if (!state.user) return;


      const balance =
        Number(
          $("startingBalance").value
        );


      const currency =
        $("currency").value;


      if (
        !Number.isFinite(balance) ||
        balance < 0
      ) {

        $("settingsMessage").textContent =
          "Starting balance must be a valid number.";

        return;

      }


      try {

        await setDoc(
          userSettingsRef(),
          {

            startingBalance:
              balance,

            currency,

            updatedAt:
              serverTimestamp()

          },
          {
            merge: true
          }
        );


        state.settings = {

          startingBalance:
            balance,

          currency

        };


        $("settingsMessage").textContent =
          "Settings saved successfully.";


        showToast(
          "Settings saved."
        );


      } catch (error) {

        console.error(
          "Settings save error:",
          error
        );


        $("settingsMessage").textContent =
          error.message ||
          "Could not save settings.";

      }

    }
  );


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonthBtn")
  .addEventListener(
    "click",
    () => {

      state.calendarDate =
        new Date(
          state.calendarDate.getFullYear(),
          state.calendarDate.getMonth() - 1,
          1
        );

      renderCalendar();

    }
  );


$("nextMonthBtn")
  .addEventListener(
    "click",
    () => {

      state.calendarDate =
        new Date(
          state.calendarDate.getFullYear(),
          state.calendarDate.getMonth() + 1,
          1
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


  const monthName =
    date.toLocaleString(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    );


  $("calendarMonthTitle")
    .textContent =
      monthName;


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


  const previousDays =
    new Date(
      year,
      month,
      0
    ).getDate();


  const cells = [];


  /*
    Previous month days.
  */

  for (
    let i = firstDay - 1;
    i >= 0;
    i--
  ) {

    const day =
      previousDays - i;


    const prevMonth =
      month === 0
        ? 11
        : month - 1;


    const prevYear =
      month === 0
        ? year - 1
        : year;


    const key =
      `${prevYear}-${String(
        prevMonth + 1
      ).padStart(2,"0")}-${String(
        day
      ).padStart(2,"0")}`;


    cells.push({
      day,
      key,
      muted: true
    });

  }


  /*
    Current month.
  */

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const key =
      `${year}-${String(
        month + 1
      ).padStart(2,"0")}-${String(
        day
      ).padStart(2,"0")}`;


    cells.push({
      day,
      key,
      muted: false
    });

  }


  /*
    Next month.
  */

  let nextDay = 1;


  while (
    cells.length % 7 !== 0
  ) {

    const nextMonth =
      month === 11
        ? 0
        : month + 1;


    const nextYear =
      month === 11
        ? year + 1
        : year;


    const key =
      `${nextYear}-${String(
        nextMonth + 1
      ).padStart(2,"0")}-${String(
        nextDay
      ).padStart(2,"0")}`;


    cells.push({
      day: nextDay,
      key,
      muted: true
    });


    nextDay++;

  }


  const grid =
    $("calendarGrid");


  grid.innerHTML =
    cells.map(
      cell => {

        const trades =
          state.trades.filter(
            trade =>
              trade.date ===
              cell.key
          );


        const pl =
          trades.reduce(
            (sum, trade) =>
              sum +
              num(trade.profitLoss),
            0
          );


        const today =
          cell.key ===
          todayString();


        return `
          <div
            class="
              calendar-day
              ${cell.muted ? "muted-day" : ""}
              ${today ? "today" : ""}
            "
            data-calendar-date="${cell.key}"
          >

            <div class="calendar-number">
              ${cell.day}
            </div>

            ${
              trades.length
                ? `
                  <div
                    class="
                      calendar-pl
                      ${moneyClass(pl)}
                    "
                  >
                    ${money(pl)}
                  </div>

                  <div class="calendar-count">
                    ${trades.length}
                    trade${trades.length > 1 ? "s" : ""}
                  </div>
                `
                : ""
            }

          </div>
        `;

      }
    )
    .join("");


  document
    .querySelectorAll(
      "[data-calendar-date]"
    )
    .forEach(dayElement => {

      dayElement.addEventListener(
        "click",
        () => {

          showCalendarDetails(
            dayElement.dataset.calendarDate
          );

        }
      );

    });

}


/* =========================================================
   CALENDAR DETAILS
========================================================= */

function showCalendarDetails(
  date
) {

  const container =
    $("calendarDetails");


  const trades =
    state.trades.filter(
      trade =>
        trade.date === date
    );


  if (!trades.length) {

    container.innerHTML = `
      <div class="empty-state">

        <h3>
          ${formatDate(date)}
        </h3>

        <p>
          No trades on this day.
        </p>

      </div>
    `;

    return;

  }


  const totalPL =
    trades.reduce(
      (sum,t) =>
        sum + num(t.profitLoss),
      0
    );


  container.innerHTML = `

    <div class="panel-header">

      <div>
        <h2>
          ${formatDate(date)}
        </h2>

        <p>
          ${trades.length}
          trade${trades.length > 1 ? "s" : ""}
          ·
          <span class="${moneyClass(totalPL)}">
            ${money(totalPL)}
          </span>
        </p>

      </div>

    </div>

    <div class="table-wrapper">

      <table>

        <thead>

          <tr>
            <th>Pair</th>
            <th>Direction</th>
            <th>Strategy</th>
            <th>Result</th>
            <th>P/L</th>
          </tr>

        </thead>

        <tbody>

          ${trades.map(
            trade => `

              <tr>

                <td>
                  ${escapeHtml(
                    trade.pair ||
                    "XAUUSD"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    trade.direction ||
                    "-"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    trade.strategy ||
                    "-"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    trade.result ||
                    "-"
                  )}
                </td>

                <td
                  class="${moneyClass(
                    trade.profitLoss
                  )}"
                >
                  <strong>
                    ${money(
                      trade.profitLoss
                    )}
                  </strong>
                </td>

              </tr>

            `
          ).join("")}

        </tbody>

      </table>

    </div>

  `;

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;


function showToast(
  message,
  error = false
) {

  const toast =
    $("toast");


  toast.textContent =
    message;


  toast.style.borderColor =
    error
      ? "rgba(255,92,112,.35)"
      : "rgba(54,211,153,.3)";


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2600
    );

}


/* =========================================================
   INITIAL DEFAULTS
========================================================= */

function setInitialDefaults() {

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


  $("calcRiskPercent").value =
    "1";

}


/* =========================================================
   START
========================================================= */

setInitialDefaults();
