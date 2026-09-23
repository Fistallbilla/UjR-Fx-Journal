/* =========================================================
   UjR Fx Trading Journal
   Firebase + Firestore
   ========================================================= */

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
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return num(value).toFixed(2);
}

function escapeHTML(value) {
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

function parseDateOnly(dateString) {
  if (!dateString) return null;

  const parts = String(dateString).split("-");

  if (parts.length !== 3) return null;

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d);
}

function formatDate(dateString) {
  const date = parseDateOnly(dateString);

  if (!date) return "-";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatPL(value) {
  const n = num(value);

  if (n > 0) return `+${n.toFixed(2)}`;

  return n.toFixed(2);
}

function getPLClass(value) {
  const n = num(value);

  if (n > 0) return "pl-positive";
  if (n < 0) return "pl-negative";

  return "";
}


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

  currentPage: "dashboard",

  calendarDate: new Date(),

  editingTrade: null
};


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


$("logoutBtn").addEventListener("click", async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error("Logout error:", error);

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

  const user = state.user;

  if (!user) return;

  const name =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Trader";

  const email = user.email || "-";

  $("welcomeName").textContent = name;

  $("sidebarUserName").textContent = name;
  $("sidebarUserEmail").textContent = email;

  $("profileName").textContent = name;
  $("profileEmail").textContent = email;

  if (user.photoURL) {

    $("sidebarUserPhoto").src = user.photoURL;
    $("profilePhoto").src = user.photoURL;

  }

}


/* =========================================================
   LOAD USER DATA
   ========================================================= */

async function loadUserData() {

  if (!state.user) return;

  state.trades = [];

  await loadSettings();
  await loadTradesCompatible();

  populatePairFilter();

  renderAll();

}


/* =========================================================
   COMPATIBLE FIRESTORE LOADER
   =========================================================

   New:
   users/{uid}/trades

   Old possible structures:
   trades/{docId} with userId
   trades/{docId} with uid
   ========================================================= */

async function loadTradesCompatible() {

  const uid = state.user.uid;

  const loaded = [];

  /* ---------- NEW USER SUBCOLLECTION ---------- */

  try {

    const nestedRef = collection(
      db,
      "users",
      uid,
      "trades"
    );

    const snapshot = await getDocs(nestedRef);

    snapshot.forEach(item => {

      loaded.push(
        normalizeTrade(
          item.data(),
          item.id,
          "nested"
        )
      );

    });

    console.log(
      `Loaded ${snapshot.size} trades from users/${uid}/trades`
    );

  } catch (error) {

    console.error(
      "Could not load nested trades:",
      error
    );

  }


  /* ---------- OLD TOP LEVEL: userId ---------- */

  try {

    const topRef = collection(db, "trades");

    const q = query(
      topRef,
      where("userId", "==", uid)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(item => {

      loaded.push(
        normalizeTrade(
          item.data(),
          item.id,
          "top-userId"
        )
      );

    });

    console.log(
      `Loaded ${snapshot.size} old userId trades`
    );

  } catch (error) {

    console.warn(
      "Old userId trade query failed:",
      error
    );

  }


  /* ---------- OLD TOP LEVEL: uid ---------- */

  try {

    const topRef = collection(db, "trades");

    const q = query(
      topRef,
      where("uid", "==", uid)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(item => {

      loaded.push(
        normalizeTrade(
          item.data(),
          item.id,
          "top-uid"
        )
      );

    });

    console.log(
      `Loaded ${snapshot.size} old uid trades`
    );

  } catch (error) {

    console.warn(
      "Old uid trade query failed:",
      error
    );

  }


  /* =======================================================
     DEDUPLICATION
     ======================================================= */

  const unique = new Map();

  for (const trade of loaded) {

    /*
      Prefer Trade ID when available.
      This prevents the same trade appearing twice
      if it exists in both old and new locations.
    */

    const key =
      trade.tradeId ||
      `${trade._source}-${trade._docId}`;

    if (!unique.has(key)) {

      unique.set(key, trade);

    } else {

      /*
        Prefer nested/newer version when duplicate exists.
      */

      const existing = unique.get(key);

      if (
        trade._source === "nested" &&
        existing._source !== "nested"
      ) {

        unique.set(key, trade);

      }

    }

  }


  state.trades = Array.from(unique.values());

  state.trades.sort(
    (a, b) => String(b.date).localeCompare(String(a.date))
  );


  console.log(
    "FINAL LOADED TRADES:",
    state.trades.length,
    state.trades
  );

}


/* =========================================================
   NORMALIZE OLD DATA
   ========================================================= */

function firstDefined(data, keys, fallback = "") {

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


function normalizeTrade(data, docId, source) {

  const raw = data || {};

  const trade = {

    tradeId: String(
      firstDefined(
        raw,
        ["tradeId", "tradeID", "id"],
        `UJR-${docId.slice(-6)}`
      )
    ),

    date: String(
      firstDefined(
        raw,
        ["date", "tradeDate"],
        todayString()
      )
    ).slice(0, 10),

    pair: String(
      firstDefined(
        raw,
        ["pair", "symbol", "instrument"],
        "XAUUSD"
      )
    ).toUpperCase(),

    tradingType: String(
      firstDefined(
        raw,
        ["tradingType", "tradeType", "type"],
        "Scalping"
      )
    ),

    direction: String(
      firstDefined(
        raw,
        ["direction", "side"],
        "Buy"
      )
    ),

    strategy: String(
      firstDefined(
        raw,
        ["strategy", "setup"],
        "Other"
      )
    ),

    session: String(
      firstDefined(
        raw,
        ["session"],
        "London"
      )
    ),

    bias: String(
      firstDefined(
        raw,
        ["bias", "marketBias"],
        "Neutral"
      )
    ),

    entry: num(
      firstDefined(
        raw,
        ["entry", "entryPrice"],
        0
      )
    ),

    sl: num(
      firstDefined(
        raw,
        ["sl", "stopLoss"],
        0
      )
    ),

    tp: num(
      firstDefined(
        raw,
        ["tp", "takeProfit"],
        0
      )
    ),

    rr: num(
      firstDefined(
        raw,
        ["rr", "riskReward"],
        0
      )
    ),

    riskAmount: num(
      firstDefined(
        raw,
        ["riskAmount", "risk"],
        0
      )
    ),

    lotSize: num(
      firstDefined(
        raw,
        ["lotSize", "lot"],
        0
      )
    ),

    result: String(
      firstDefined(
        raw,
        ["result"],
        ""
      )
    ),

    profitLoss: num(
      firstDefined(
        raw,
        ["profitLoss", "pnl", "pl", "P/L"],
        0
      )
    ),

    confidence: String(
      firstDefined(
        raw,
        ["confidence"],
        "3"
      )
    ),

    emotion: String(
      firstDefined(
        raw,
        ["emotion"],
        "Neutral"
      )
    ),

    notes: String(
      firstDefined(
        raw,
        ["notes", "note"],
        ""
      )
    ),

    userId: String(
      firstDefined(
        raw,
        ["userId", "uid"],
        state.user?.uid || ""
      )
    ),

    _source: source,
    _docId: docId
  };


  /*
    Normalize P/L according to result.
  */

  if (trade.result === "Win") {

    trade.profitLoss = Math.abs(trade.profitLoss);

  } else if (trade.result === "Loss") {

    trade.profitLoss = -Math.abs(trade.profitLoss);

  } else if (trade.result === "Break Even") {

    trade.profitLoss = 0;

  }


  return trade;
}


/* =========================================================
   SETTINGS
   ========================================================= */

async function loadSettings() {

  if (!state.user) return;

  try {

    const settingsRef = doc(
      db,
      "users",
      state.user.uid,
      "settings",
      "profile"
    );

    const snapshot = await getDoc(settingsRef);

    if (snapshot.exists()) {

      const data = snapshot.data();

      state.settings.startingBalance =
        num(data.startingBalance);

      state.settings.currency =
        data.currency || "USD";

    }

  } catch (error) {

    console.error(
      "Settings load error:",
      error
    );

  }


  $("startingBalance").value =
    state.settings.startingBalance;

  $("currency").value =
    state.settings.currency;

}


$("saveSettingsBtn").addEventListener("click", async () => {

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
        "profile"
      ),
      {
        startingBalance,
        currency,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    state.settings.startingBalance =
      startingBalance;

    state.settings.currency =
      currency;

    $("settingsMessage").textContent =
      "Settings saved successfully.";

    setTimeout(() => {

      $("settingsMessage").textContent = "";

    }, 2500);

    renderAll();

  } catch (error) {

    console.error(error);

    $("settingsMessage").textContent =
      "Could not save settings.";

  }

});


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    showPage(button.dataset.page);

    $("sidebar").classList.remove("mobile-open");

  });

});


document.querySelectorAll("[data-page-target]").forEach(button => {

  button.addEventListener("click", () => {

    showPage(button.dataset.pageTarget);

  });

});


function showPage(pageName) {

  state.currentPage = pageName;

  document.querySelectorAll(".page").forEach(page => {

    page.classList.remove("active-page");

  });

  const target =
    $(`${pageName}Page`);

  if (target) {

    target.classList.add("active-page");

  }


  document.querySelectorAll(".nav-item").forEach(item => {

    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );

  });


  const sidebar =
    document.querySelector(".sidebar");

  if (sidebar) {

    sidebar.classList.remove("mobile-open");

  }

}


/* =========================================================
   MOBILE MENU
   ========================================================= */

$("mobileMenuBtn").addEventListener("click", () => {

  document
    .querySelector(".sidebar")
    .classList.toggle("mobile-open");

});


/* =========================================================
   TRADE ID
   ========================================================= */

function generateTradeId() {

  const numbers = state.trades
    .map(trade => {

      const match =
        String(trade.tradeId || "")
          .match(/(\d+)$/);

      return match
        ? Number(match[1])
        : 0;

    })
    .filter(n => Number.isFinite(n));

  const next =
    numbers.length
      ? Math.max(...numbers) + 1
      : 1;

  return `UJR-${String(next).padStart(4, "0")}`;

}


/* =========================================================
   OPEN ADD TRADE
   ========================================================= */

document.querySelectorAll(".open-add-trade").forEach(button => {

  button.addEventListener("click", () => {

    openAddTradeModal();

  });

});


function openAddTradeModal() {

  state.editingTrade = null;

  $("tradeModalTitle").textContent =
    "Add Trade";

  $("saveTradeBtn").textContent =
    "Save Trade";

  $("editingTradeId").value = "";

  $("tradeIdPreview").textContent =
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

  $("confidence").value =
    "3";

  $("emotion").value =
    "Calm";

  $("entry").value = "";
  $("sl").value = "";
  $("tp").value = "";

  $("rr").value = "";

  $("riskAmount").value = "";
  $("lotSize").value = "";

  $("result").value =
    "Win";

  $("profitLoss").value = "";

  $("notes").value = "";

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

}


/* =========================================================
   CLOSE MODAL
   ========================================================= */

$("closeTradeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTradeBtn").addEventListener(
  "click",
  closeTradeModal
);

document
  .querySelector(".modal-backdrop")
  .addEventListener(
    "click",
    closeTradeModal
  );


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  state.editingTrade = null;

}


/* =========================================================
   RR CALCULATION
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
   RESULT / P&L
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


  if (input.value === "") return;


  const value =
    Number(input.value);

  if (!Number.isFinite(value)) return;


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


  const tradeId =
    $("tradeIdPreview").textContent.trim();


  const date =
    $("tradeDate").value ||
    todayString();


  const pair =
    $("pair").value.trim().toUpperCase() ||
    "XAUUSD";


  const tradingType =
    $("tradingType").value;


  const direction =
    $("direction").value;


  const strategy =
    $("strategy").value;


  const session =
    $("session").value;


  const bias =
    $("bias").value;


  const entry =
    num($("entry").value);


  const sl =
    num($("sl").value);


  const tp =
    num($("tp").value);


  const rr =
    calculateTradeRR();


  const riskRaw =
    $("riskAmount").value.trim();


  const riskAmount =
    riskRaw === ""
      ? 0
      : Number(riskRaw);


  if (
    !Number.isFinite(riskAmount) ||
    riskAmount < 0
  ) {

    $("tradeError").textContent =
      "Risk Amount must be a valid positive number.";

    return;

  }


  const lotRaw =
    $("lotSize").value.trim();


  const lotSize =
    lotRaw === ""
      ? 0
      : Number(lotRaw);


  if (
    !Number.isFinite(lotSize) ||
    lotSize < 0
  ) {

    $("tradeError").textContent =
      "Lot Size must be a valid number.";

    return;

  }


  const result =
    $("result").value;


  const profitLoss =
    getNormalizedPL();


  if (profitLoss === null) {

    $("tradeError").textContent =
      "Enter a valid P/L amount.";

    return;

  }


  if (
    entry > 0 &&
    sl > 0 &&
    tp > 0 &&
    rr <= 0
  ) {

    $("tradeError").textContent =
      "Entry, SL and TP create an invalid Risk : Reward.";

    return;

  }


  const tradeData = {

    tradeId,
    date,

    pair,

    tradingType,

    direction,

    strategy,

    session,

    bias,

    entry,

    sl,

    tp,

    rr,

    riskAmount,

    lotSize,

    result,

    profitLoss,

    confidence:
      $("confidence").value,

    emotion:
      $("emotion").value,

    notes:
      $("notes").value.trim(),

    userId:
      state.user.uid,

    updatedAt:
      serverTimestamp()

  };


  try {

    const editingId =
      $("editingTradeId").value;


    /* ================= UPDATE ================= */

    if (editingId && state.editingTrade) {

      const oldTrade =
        state.editingTrade;


      let tradeRef;


      if (
        oldTrade._source === "nested"
      ) {

        tradeRef = doc(
          db,
          "users",
          state.user.uid,
          "trades",
          oldTrade._docId
        );

      } else {

        /*
          Old top-level trades
          are updated in place.
        */

        tradeRef = doc(
          db,
          "trades",
          oldTrade._docId
        );

      }


      await updateDoc(
        tradeRef,
        tradeData
      );


      /*
        Update local copy immediately.
      */

      const normalized =
        normalizeTrade(
          {
            ...tradeData
          },
          oldTrade._docId,
          oldTrade._source
        );


      const index =
        state.trades.findIndex(
          t =>
            t._docId === oldTrade._docId &&
            t._source === oldTrade._source
        );


      if (index !== -1) {

        state.trades[index] =
          normalized;

      }


    }


    /* ================= NEW ================= */

    else {

      const tradeRef =
        collection(
          db,
          "users",
          state.user.uid,
          "trades"
        );


      const newDoc =
        await addDoc(
          tradeRef,
          {
            ...tradeData,
            createdAt:
              serverTimestamp()
          }
        );


      state.trades.unshift(
        normalizeTrade(
          {
            ...tradeData
          },
          newDoc.id,
          "nested"
        )
      );

    }


    state.trades.sort(
      (a,b) =>
        String(b.date)
          .localeCompare(String(a.date))
    );


    populatePairFilter();

    renderAll();

    closeTradeModal();

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


/* =========================================================
   EDIT TRADE
   ========================================================= */

function editTrade(tradeId) {

  const trade =
    state.trades.find(
      t =>
        String(t.tradeId) ===
        String(tradeId)
    );


  if (!trade) return;


  state.editingTrade =
    trade;


  $("tradeModalTitle").textContent =
    "Edit Trade";

  $("saveTradeBtn").textContent =
    "Update Trade";


  $("editingTradeId").value =
    trade._docId;


  $("tradeIdPreview").textContent =
    trade.tradeId;


  $("tradeDate").value =
    trade.date || todayString();


  $("pair").value =
    trade.pair || "XAUUSD";


  setSelectValue(
    "tradingType",
    trade.tradingType,
    "Scalping"
  );


  setSelectValue(
    "direction",
    trade.direction,
    "Buy"
  );


  setSelectValue(
    "strategy",
    trade.strategy,
    "Other"
  );


  setSelectValue(
    "session",
    trade.session,
    "London"
  );


  setSelectValue(
    "bias",
    trade.bias,
    "Neutral"
  );


  setSelectValue(
    "confidence",
    trade.confidence,
    "3"
  );


  setSelectValue(
    "emotion",
    trade.emotion,
    "Neutral"
  );


  $("entry").value =
    trade.entry || "";

  $("sl").value =
    trade.sl || "";

  $("tp").value =
    trade.tp || "";

  $("riskAmount").value =
    trade.riskAmount || "";

  $("lotSize").value =
    trade.lotSize || "";


  setSelectValue(
    "result",
    trade.result,
    "Win"
  );


  $("profitLoss").value =
    trade.profitLoss;


  $("notes").value =
    trade.notes || "";


  calculateTradeRR();


  $("tradeError").textContent = "";

  $("tradeModal").classList.remove(
    "hidden"
  );

}


function setSelectValue(
  id,
  value,
  fallback
) {

  const select = $(id);

  const exists =
    [...select.options]
      .some(
        option =>
          option.value === String(value)
      );


  select.value =
    exists
      ? String(value)
      : fallback;

}


/* =========================================================
   DELETE TRADE
   ========================================================= */

async function deleteTrade(tradeId) {

  const trade =
    state.trades.find(
      t =>
        String(t.tradeId) ===
        String(tradeId)
    );


  if (!trade) return;


  const confirmed =
    confirm(
      `Delete trade ${trade.tradeId}?`
    );


  if (!confirmed) return;


  try {

    let tradeRef;


    if (
      trade._source === "nested"
    ) {

      tradeRef = doc(
        db,
        "users",
        state.user.uid,
        "trades",
        trade._docId
      );

    } else {

      tradeRef = doc(
        db,
        "trades",
        trade._docId
      );

    }


    await deleteDoc(tradeRef);


    state.trades =
      state.trades.filter(
        t =>
          !(
            t._docId === trade._docId &&
            t._source === trade._source
          )
      );


    populatePairFilter();

    renderAll();


  } catch (error) {

    console.error(
      "Delete error:",
      error
    );

    alert(
      error.message ||
      "Could not delete trade."
    );

  }

}


/* =========================================================
   JOURNAL FILTERS
   ========================================================= */

[
  "journalResultFilter",
  "journalTypeFilter",
  "journalPairFilter",
  "journalDateFilter",
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


$("clearJournalFilters").addEventListener(
  "click",
  () => {

    $("journalResultFilter").value =
      "all";

    $("journalTypeFilter").value =
      "all";

    $("journalPairFilter").value =
      "all";

    $("journalDateFilter").value =
      "";

    $("journalSearch").value =
      "";

    renderJournal();

  }
);


function populatePairFilter() {

  const select =
    $("journalPairFilter");

  const current =
    select.value;


  const pairs =
    [...new Set(
      state.trades
        .map(t => t.pair)
        .filter(Boolean)
    )].sort();


  select.innerHTML = `
    <option value="all">All Pairs</option>
  `;


  pairs.forEach(pair => {

    const option =
      document.createElement("option");

    option.value = pair;
    option.textContent = pair;

    select.appendChild(option);

  });


  if (
    [...select.options]
      .some(
        option =>
          option.value === current
      )
  ) {

    select.value = current;

  }

}


/* =========================================================
   JOURNAL RENDER
   ========================================================= */

function getFilteredJournalTrades() {

  const result =
    $("journalResultFilter").value;

  const type =
    $("journalTypeFilter").value;

  const pair =
    $("journalPairFilter").value;

  const date =
    $("journalDateFilter").value;

  const search =
    $("journalSearch").value
      .trim()
      .toLowerCase();


  return state.trades.filter(trade => {

    if (
      result !== "all" &&
      trade.result !== result
    ) {

      return false;

    }


    if (
      type !== "all" &&
      trade.tradingType !== type
    ) {

      return false;

    }


    if (
      pair !== "all" &&
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


    if (search) {

      const searchable =
        [
          trade.tradeId,
          trade.pair,
          trade.strategy,
          trade.tradingType,
          trade.direction,
          trade.session,
          trade.bias,
          trade.emotion,
          trade.notes
        ]
          .join(" ")
          .toLowerCase();


      if (
        !searchable.includes(search)
      ) {

        return false;

      }

    }


    return true;

  });

}


function renderJournal() {

  const trades =
    getFilteredJournalTrades();

  const body =
    $("journalTableBody");


  body.innerHTML = "";


  if (!trades.length) {

    $("journalEmpty")
      .classList.remove("hidden");

    return;

  }


  $("journalEmpty")
    .classList.add("hidden");


  trades.forEach(trade => {

    const tr =
      document.createElement("tr");


    let resultClass =
      "result-be";

    if (trade.result === "Win") {
      resultClass = "result-win";
    }

    if (trade.result === "Loss") {
      resultClass = "result-loss";
    }


    tr.innerHTML = `

      <td>${escapeHTML(formatDate(trade.date))}</td>

      <td>
        <strong>${escapeHTML(trade.pair)}</strong>
      </td>

      <td>${escapeHTML(trade.tradingType)}</td>

      <td>${escapeHTML(trade.direction)}</td>

      <td>${escapeHTML(trade.strategy)}</td>

      <td>${trade.entry ? trade.entry : "-"}</td>

      <td>
        ${trade.rr > 0 ? `1:${trade.rr.toFixed(2)}` : "-"}
      </td>

      <td>
        <strong class="${resultClass}">
          ${escapeHTML(trade.result || "-")}
        </strong>
      </td>

      <td class="${getPLClass(trade.profitLoss)}">
        ${formatPL(trade.profitLoss)}
      </td>

      <td>

        <div class="action-buttons">

          <button
            class="table-action edit-btn"
            data-id="${escapeHTML(trade.tradeId)}">
            Edit
          </button>

          <button
            class="table-action delete delete-btn"
            data-id="${escapeHTML(trade.tradeId)}">
            Delete
          </button>

        </div>

      </td>

    `;


    body.appendChild(tr);

  });


  body
    .querySelectorAll(".edit-btn")
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          editTrade(
            button.dataset.id
          )
      );

    });


  body
    .querySelectorAll(".delete-btn")
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteTrade(
            button.dataset.id
          )
      );

    });

}


/* =========================================================
   ANALYTICS PERIOD
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


  if (period === "all") {

    return [...state.trades];

  }


  const now =
    new Date();


  const today =
    todayString();


  return state.trades.filter(
    trade => {

      const date =
        parseDateOnly(trade.date);

      if (!date) return false;


      if (period === "7") {

        const start =
          new Date(now);

        start.setHours(0,0,0,0);

        start.setDate(
          start.getDate() - 6
        );

        return date >= start &&
               date <= now;

      }


      if (period === "30") {

        const start =
          new Date(now);

        start.setHours(0,0,0,0);

        start.setDate(
          start.getDate() - 29
        );

        return date >= start &&
               date <= now;

      }


      if (period === "month") {

        return (
          date.getFullYear() ===
            now.getFullYear() &&
          date.getMonth() ===
            now.getMonth()
        );

      }


      if (period === "year") {

        return (
          date.getFullYear() ===
          now.getFullYear()
        );

      }


      return true;

    }
  );

}


/* =========================================================
   ANALYTICS CALCULATIONS
   ========================================================= */

function calculateAnalytics(trades) {

  const total =
    trades.length;


  let wins = 0;
  let losses = 0;
  let breakeven = 0;

  let totalPL = 0;

  let grossProfit = 0;
  let grossLoss = 0;

  let rrSum = 0;
  let rrCount = 0;

  let riskSum = 0;
  let riskCount = 0;


  let bestTrade = 0;
  let worstTrade = 0;


  trades.forEach(trade => {

    const pl =
      num(trade.profitLoss);


    totalPL += pl;


    if (trade.result === "Win") {

      wins++;
      grossProfit += Math.max(pl, 0);

    } else if (trade.result === "Loss") {

      losses++;
      grossLoss += Math.abs(
        Math.min(pl, 0)
      );

    } else if (
      trade.result === "Break Even"
    ) {

      breakeven++;

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


    if (
      trades.length === 1 ||
      pl > bestTrade
    ) {

      bestTrade = pl;

    }


    if (
      trades.length === 1 ||
      pl < worstTrade
    ) {

      worstTrade = pl;

    }

  });


  const winRate =
    total > 0
      ? (wins / total) * 100
      : 0;


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const averagePL =
    total > 0
      ? totalPL / total
      : 0;


  const averageWin =
    wins > 0
      ? grossProfit / wins
      : 0;


  const averageLoss =
    losses > 0
      ? grossLoss / losses
      : 0;


  const averageRR =
    rrCount > 0
      ? rrSum / rrCount
      : 0;


  const averageRisk =
    riskCount > 0
      ? riskSum / riskCount
      : 0;


  /*
    Max drawdown based on cumulative P/L.
  */

  const sorted =
    [...trades].sort(
      (a,b) =>
        String(a.date)
          .localeCompare(String(b.date))
    );


  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;


  sorted.forEach(trade => {

    equity +=
      num(trade.profitLoss);

    peak =
      Math.max(peak, equity);

    const drawdown =
      peak - equity;

    maxDrawdown =
      Math.max(
        maxDrawdown,
        drawdown
      );

  });


  return {

    total,
    wins,
    losses,
    breakeven,

    winRate,

    totalPL,

    grossProfit,
    grossLoss,

    profitFactor,

    averagePL,
    averageWin,
    averageLoss,

    bestTrade,
    worstTrade,

    averageRR,
    averageRisk,

    expectancy:
      averagePL,

    maxDrawdown

  };

}


/* =========================================================
   STREAKS
   ========================================================= */

function calculateStreaks(trades) {

  const sorted =
    [...trades].sort(
      (a,b) =>
        String(a.date)
          .localeCompare(String(b.date))
    );


  let currentWin = 0;
  let currentLoss = 0;

  let bestWin = 0;
  let bestLoss = 0;


  let runningWin = 0;
  let runningLoss = 0;


  sorted.forEach(trade => {

    if (trade.result === "Win") {

      runningWin++;
      runningLoss = 0;

      bestWin =
        Math.max(
          bestWin,
          runningWin
        );

    } else if (
      trade.result === "Loss"
    ) {

      runningLoss++;
      runningWin = 0;

      bestLoss =
        Math.max(
          bestLoss,
          runningLoss
        );

    } else {

      runningWin = 0;
      runningLoss = 0;

    }

  });


  /*
    Current streak should be based
    on the most recent trade.
  */

  const reversed =
    [...sorted].reverse();


  for (const trade of reversed) {

    if (trade.result === "Win") {

      currentWin++;
      break;

    }

    break;

  }


  currentLoss = 0;

  for (const trade of reversed) {

    if (trade.result === "Loss") {

      currentLoss++;
      break;

    }

    break;

  }


  return {
    currentWin,
    currentLoss,
    bestWin,
    bestLoss
  };

}


/* =========================================================
   BREAKDOWN
   ========================================================= */

function getBreakdownField() {

  const type =
    $("analyticsBreakdown").value;


  const map = {

    pair: {
      title: "By Pair",
      field: "pair"
    },

    tradingType: {
      title: "By Trading Type",
      field: "tradingType"
    },

    strategy: {
      title: "By Strategy",
      field: "strategy"
    },

    session: {
      title: "By Session",
      field: "session"
    },

    direction: {
      title: "By Direction",
      field: "direction"
    },

    bias: {
      title: "By Market Bias",
      field: "bias"
    },

    emotion: {
      title: "By Emotion",
      field: "emotion"
    },

    result: {
      title: "By Result",
      field: "result"
    }

  };


  return (
    map[type] ||
    map.pair
  );

}


function calculateBreakdown(trades) {

  const config =
    getBreakdownField();


  const groups =
    new Map();


  trades.forEach(trade => {

    const label =
      trade[config.field] ||
      "Unknown";


    if (!groups.has(label)) {

      groups.set(
        label,
        {
          trades: 0,
          wins: 0,
          losses: 0,
          pl: 0
        }
      );

    }


    const group =
      groups.get(label);


    group.trades++;

    group.pl +=
      num(trade.profitLoss);


    if (
      trade.result === "Win"
    ) {

      group.wins++;

    }


    if (
      trade.result === "Loss"
    ) {

      group.losses++;

    }

  });


  return {
    title: config.title,
    rows:
      [...groups.entries()]
        .map(([label, data]) => {

          const winRate =
            data.trades > 0
              ? (
                  data.wins /
                  data.trades
                ) * 100
              : 0;


          return {

            label,

            trades:
              data.trades,

            wins:
              data.wins,

            losses:
              data.losses,

            winRate,

            pl:
              data.pl,

            averagePL:
              data.trades > 0
                ? data.pl / data.trades
                : 0

          };

        })
        .sort(
          (a,b) =>
            b.pl - a.pl
        )

  };

}


/* =========================================================
   RENDER ANALYTICS
   ========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  const stats =
    calculateAnalytics(trades);


  $("aTotalTrades").textContent =
    stats.total;

  $("aWins").textContent =
    stats.wins;

  $("aLosses").textContent =
    stats.losses;

  $("aBreakEven").textContent =
    stats.breakeven;

  $("aWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("aTotalPL").textContent =
    formatPL(stats.totalPL);

  $("aProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("aAveragePL").textContent =
    formatPL(stats.averagePL);

  $("aAverageWin").textContent =
    formatPL(stats.averageWin);

  $("aAverageLoss").textContent =
    formatPL(-stats.averageLoss);

  $("aBestTrade").textContent =
    formatPL(stats.bestTrade);

  $("aWorstTrade").textContent =
    formatPL(stats.worstTrade);

  $("aAverageRR").textContent =
    stats.averageRR > 0
      ? `1:${stats.averageRR.toFixed(2)}`
      : "0.00";

  $("aAverageRisk").textContent =
    money(stats.averageRisk);

  $("aExpectancy").textContent =
    formatPL(stats.expectancy);

  $("aMaxDrawdown").textContent =
    money(-stats.maxDrawdown);


  /*
    Streaks
  */

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


  /*
    Breakdown
  */

  const breakdown =
    calculateBreakdown(trades);


  $("breakdownTitle").textContent =
    breakdown.title;


  const body =
    $("analyticsBreakdownBody");


  body.innerHTML = "";


  breakdown.rows.forEach(row => {

    const tr =
      document.createElement("tr");


    tr.innerHTML = `

      <td>
        <strong>
          ${escapeHTML(row.label)}
        </strong>
      </td>

      <td>${row.trades}</td>

      <td class="result-win">
        ${row.wins}
      </td>

      <td class="result-loss">
        ${row.losses}
      </td>

      <td>
        ${row.winRate.toFixed(1)}%
      </td>

      <td class="${getPLClass(row.pl)}">
        ${formatPL(row.pl)}
      </td>

      <td class="${getPLClass(row.averagePL)}">
        ${formatPL(row.averagePL)}
      </td>

    `;


    body.appendChild(tr);

  });


  /*
    Distribution
  */

  const total =
    stats.total || 1;


  const winPct =
    (stats.wins / total) * 100;

  const lossPct =
    (stats.losses / total) * 100;

  const bePct =
    (stats.breakeven / total) * 100;


  $("winDistribution").textContent =
    `${winPct.toFixed(1)}%`;

  $("lossDistribution").textContent =
    `${lossPct.toFixed(1)}%`;

  $("beDistribution").textContent =
    `${bePct.toFixed(1)}%`;


  $("winBar").style.width =
    `${winPct}%`;

  $("lossBar").style.width =
    `${lossPct}%`;

  $("beBar").style.width =
    `${bePct}%`;

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
    stats.total;

  $("dashWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("dashTotalPL").textContent =
    formatPL(stats.totalPL);

  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("dashAvgRR").textContent =
    stats.averageRR > 0
      ? `1:${stats.averageRR.toFixed(2)}`
      : "0.00";

  $("dashDrawdown").textContent =
    formatPL(-stats.maxDrawdown);


  renderRecentTrades();

  renderEquityChart();

}


function renderRecentTrades() {

  const container =
    $("recentTrades");


  container.innerHTML = "";


  const trades =
    [...state.trades]
      .sort(
        (a,b) =>
          String(b.date)
            .localeCompare(String(a.date))
      )
      .slice(0, 6);


  if (!trades.length) {

    container.innerHTML = `
      <div class="empty-state">
        No trades yet.
      </div>
    `;

    return;

  }


  trades.forEach(trade => {

    let resultClass =
      "result-be";

    if (trade.result === "Win") {
      resultClass = "result-win";
    }

    if (trade.result === "Loss") {
      resultClass = "result-loss";
    }


    const row =
      document.createElement("div");

    row.className =
      "recent-row";


    row.innerHTML = `

      <div class="recent-main">

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

      <div class="recent-result">

        <div class="${resultClass}">
          ${escapeHTML(trade.result)}
        </div>

        <div class="${getPLClass(trade.profitLoss)}">
          ${formatPL(trade.profitLoss)}
        </div>

      </div>

    `;


    container.appendChild(row);

  });

}


/* =========================================================
   SIMPLE EQUITY CHART
   ========================================================= */

function renderEquityChart() {

  const canvas =
    $("equityChart");

  const empty =
    $("emptyChart");


  const rect =
    canvas.getBoundingClientRect();


  if (
    rect.width === 0 ||
    rect.height === 0
  ) {

    return;

  }


  const ctx =
    canvas.getContext("2d");


  const dpr =
    window.devicePixelRatio || 1;


  const width =
    rect.width;

  const height =
    rect.height;


  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  if (!state.trades.length) {

    empty.classList.remove(
      "hidden"
    );

    return;

  }


  empty.classList.add(
    "hidden"
  );


  const trades =
    [...state.trades]
      .sort(
        (a,b) =>
          String(a.date)
            .localeCompare(String(b.date))
      );


  let equity = 0;

  const values =
    trades.map(trade => {

      equity +=
        num(trade.profitLoss);

      return equity;

    });


  const min =
    Math.min(
      0,
      ...values
    );

  const max =
    Math.max(
      0,
      ...values
    );


  const range =
    max - min || 1;


  const padding =
    28;


  const chartWidth =
    width - padding * 2;

  const chartHeight =
    height - padding * 2;


  /* Grid */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;


  for (let i = 0; i < 4; i++) {

    const y =
      padding +
      (chartHeight / 3) * i;


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


  /* Curve */

  ctx.beginPath();


  values.forEach(
    (value, index) => {

      const x =
        values.length === 1
          ? width / 2
          : padding +
            (
              index /
              (values.length - 1)
            ) *
            chartWidth;


      const y =
        padding +
        (
          (max - value) /
          range
        ) *
        chartHeight;


      if (index === 0) {

        ctx.moveTo(x,y);

      } else {

        ctx.lineTo(x,y);

      }

    }
  );


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth = 2.5;

  ctx.stroke();


  /* Dots */

  values.forEach(
    (value,index) => {

      const x =
        values.length === 1
          ? width / 2
          : padding +
            (
              index /
              (values.length - 1)
            ) *
            chartWidth;


      const y =
        padding +
        (
          (max - value) /
          range
        ) *
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
        "#f0cf79";

      ctx.fill();

    }
  );

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


function renderCalendar() {

  const date =
    state.calendarDate;


  const year =
    date.getFullYear();

  const month =
    date.getMonth();


  $("calendarTitle").textContent =
    date.toLocaleDateString(
      undefined,
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


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


    const dayTrades =
      state.trades.filter(
        trade =>
          trade.date === dateString
      );


    const totalPL =
      dayTrades.reduce(
        (sum,trade) =>
          sum + num(trade.profitLoss),
        0
      );


    const div =
      document.createElement("div");


    div.className =
      "calendar-day";


    if (totalPL > 0) {

      div.classList.add(
        "profit"
      );

    } else if (totalPL < 0) {

      div.classList.add(
        "loss"
      );

    }


    div.innerHTML = `

      <div class="calendar-number">
        ${day}
      </div>

      ${
        dayTrades.length
          ? `
            <div class="calendar-pl ${getPLClass(totalPL)}">
              ${formatPL(totalPL)}
            </div>

            <div class="calendar-count">
              ${dayTrades.length} trade${dayTrades.length === 1 ? "" : "s"}
            </div>
          `
          : ""
      }

    `;


    div.addEventListener(
      "click",
      () =>
        showCalendarDetails(
          dateString
        )
    );


    grid.appendChild(div);

  }

}


function showCalendarDetails(
  dateString
) {

  const details =
    $("calendarDetails");


  const trades =
    state.trades.filter(
      trade =>
        trade.date === dateString
    );


  document
    .querySelectorAll(".calendar-day")
    .forEach(day =>
      day.classList.remove(
        "selected"
      )
    );


  if (!trades.length) {

    details.innerHTML = `

      <h3>
        ${escapeHTML(formatDate(dateString))}
      </h3>

      <p>
        No trades on this day.
      </p>

    `;

    return;

  }


  const totalPL =
    trades.reduce(
      (sum,t) =>
        sum + num(t.profitLoss),
      0
    );


  details.innerHTML = `

    <h3>
      ${escapeHTML(formatDate(dateString))}
    </h3>

    <p>
      ${trades.length} trade${trades.length === 1 ? "" : "s"}
      ·
      <strong class="${getPLClass(totalPL)}">
        ${formatPL(totalPL)}
      </strong>
    </p>

    <div>

      ${trades.map(trade => `

        <div class="calendar-trade">

          <div>
            <strong>
              ${escapeHTML(trade.pair)}
            </strong>

            <div>
              ${escapeHTML(trade.direction)}
              ·
              ${escapeHTML(trade.strategy)}
            </div>
          </div>

          <strong class="${getPLClass(trade.profitLoss)}">
            ${formatPL(trade.profitLoss)}
          </strong>

        </div>

      `).join("")}

    </div>

  `;

}


/* =========================================================
   RISK CALCULATOR
   ========================================================= */

$("calculateRiskBtn").addEventListener(
  "click",
  calculateRisk
);


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

  const direction =
    $("calcDirection").value;

  const entry =
    num($("calcEntry").value);

  const sl =
    num($("calcSL").value);

  const tp =
    num($("calcTP").value);


  const riskAmount =
    balance *
    (riskPercent / 100);


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


  let rr = 0;

  if (
    stopDistance > 0 &&
    rewardDistance > 0
  ) {

    rr =
      rewardDistance /
      stopDistance;

  }


  /*
    Approximate XAUUSD lot formula.
    Assumes approximately $100 per 1.00 price
    move per 1 lot.
  */

  const lot =
    stopDistance > 0
      ? riskAmount /
        (stopDistance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);


  $("calcStopDistance").textContent =
    money(stopDistance);


  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0:0";


  $("calcLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";

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

  return `"${string.replaceAll('"','""')}"`;

}


function exportCSV() {

  if (!state.trades.length) {

    alert(
      "There are no trades to export."
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
      trade.notes

    ]);


  const csv = [

    headers.map(csvEscape).join(","),

    ...rows.map(
      row =>
        row.map(csvEscape).join(",")
    )

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


  const a =
    document.createElement("a");


  a.href = url;

  a.download =
    `UjR-Fx-Trading-Journal-${todayString()}.csv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

}


/* =========================================================
   RENDER EVERYTHING
   ========================================================= */

function renderAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

  calculateRisk();

}


/* =========================================================
   RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      state.currentPage ===
      "dashboard"
    ) {

      renderEquityChart();

    }

  }
);


/* =========================================================
   INITIAL DATE
   ========================================================= */

$("tradeDate").value =
  todayString();

$("tradeIdPreview").textContent =
  "UJR-0001";


/* =========================================================
   INITIAL RENDER
   ========================================================= */

renderAll();

console.log(
  "UjR Fx Trading Journal loaded."
);
