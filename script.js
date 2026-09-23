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
   STATE
========================================================= */

const state = {
  user: null,
  trades: [],
  settings: {
    startingBalance: 0,
    currency: "USD"
  },
  editingId: null,
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

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampToDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function parseDateOnly(value) {
  if (!value) return null;

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  return timestampToDate(value);
}

function dateKey(date) {
  if (!date || Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function todayKey() {
  return dateKey(new Date());
}

function formatDate(value) {
  const d = parseDateOnly(value);

  if (!d) return "-";

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMoney(value) {
  const n = num(value);
  const currency = state.settings.currency || "USD";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function formatNumber(value, decimals = 2) {
  return num(value).toFixed(decimals);
}

function formatPercent(value) {
  return `${num(value).toFixed(1)}%`;
}

function normalizeResult(value) {
  const v = String(value || "").toLowerCase().trim();

  if (v === "win" || v === "won" || v === "profit") return "Win";
  if (v === "loss" || v === "lost") return "Loss";
  if (
    v === "break even" ||
    v === "breakeven" ||
    v === "be"
  ) {
    return "Break Even";
  }

  return "Break Even";
}

function normalizeRR(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value || "").trim();

  if (!text) return 0;

  if (text.includes(":")) {
    const parts = text.split(":");
    const n = Number(parts[parts.length - 1]);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(text);

  return Number.isFinite(n) ? n : 0;
}

function getTradeDate(trade) {
  if (trade.date) {
    const d = parseDateOnly(trade.date);
    if (d) return d;
  }

  if (trade.createdAt) {
    const d = timestampToDate(trade.createdAt);
    if (d) return d;
  }

  return null;
}

function getTradeDateKey(trade) {
  const d = getTradeDate(trade);
  return d ? dateKey(d) : "";
}

function generateTradeId() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const random = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  return `UJRF-${y}${m}${day}-${random}`;
}


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
    return Number(Math.abs(value).toFixed(2));
  }

  if (result === "Loss") {
    return Number(-Math.abs(value).toFixed(2));
  }

  return Number(value.toFixed(2));
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


/* =========================================================
   AUTH
========================================================= */

$("googleLoginBtn").addEventListener("click", async () => {
  const button = $("googleLoginBtn");

  button.disabled = true;
  button.innerHTML =
    `<span class="google-icon">G</span><span>Signing in...</span>`;

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

    button.innerHTML =
      `<span class="google-icon">G</span><span>Continue with Google</span>`;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }
});

getRedirectResult(auth).catch(error => {
  if (error) {
    console.error("Redirect auth error:", error);
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

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
  }
});


function updateUserUI() {
  if (!state.user) return;

  const name =
    state.user.displayName ||
    state.user.email?.split("@")[0] ||
    "Trader";

  const email = state.user.email || "";

  const avatar =
    state.user.photoURL ||
    "https://ui-avatars.com/api/?name=Trader";

  $("sidebarUserName").textContent = name;
  $("sidebarUserEmail").textContent = email;

  $("userAvatar").src = avatar;

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;
  $("settingsAvatar").src = avatar;
}


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);

    closeMobileSidebar();
  });
});

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const page = $(`${pageName}Page`);

  if (page) {
    page.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );
  });

  if (pageName === "analytics") {
    renderAnalytics();
  }

  if (pageName === "calendar") {
    renderCalendar();
  }

  if (pageName === "dashboard") {
    renderDashboard();
  }
}


/* =========================================================
   MOBILE MENU
========================================================= */

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.add("open");
  $("sidebarOverlay").classList.add("show");
});

$("sidebarOverlay").addEventListener("click", closeMobileSidebar);

function closeMobileSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("show");
}


/* =========================================================
   TRADE MODAL
========================================================= */

document.querySelectorAll("[data-add-trade]").forEach(button => {
  button.addEventListener("click", () => {
    openTradeModal();
  });
});

$("mobileAddTrade").addEventListener("click", openTradeModal);

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

function openTradeModal(trade = null) {
  $("tradeError").textContent = "";

  if (trade) {
    state.editingId = trade._key;

    $("modalTitle").textContent = "Edit Trade";
    $("saveTradeBtn").textContent = "Update Trade";

    fillTradeForm(trade);
  } else {
    state.editingId = null;

    $("modalTitle").textContent = "Add Trade";
    $("saveTradeBtn").textContent = "Save Trade";

    $("tradeForm").reset();

    $("tradeId").value = generateTradeId();
    $("tradeDate").value = todayKey();
    $("pair").value = "XAUUSD";
    $("tradingType").value = "Scalping";
    $("direction").value = "Buy";
    $("strategy").value = "Liquidity Sweep";
    $("session").value = "London";
    $("bias").value = "Bullish";
    $("result").value = "Win";
    $("confidence").value = "3/5";
    $("emotion").value = "Calm";
    $("mistake").value = "No Mistake";

    $("rr").value = "";
  }

  $("tradeModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeTradeModal() {
  $("tradeModal").classList.add("hidden");
  document.body.style.overflow = "";
  state.editingId = null;
}

function fillTradeForm(trade) {
  $("tradeId").value = trade.tradeId || trade._docId || "";
  $("tradeDate").value = getTradeDateKey(trade) || todayKey();

  $("pair").value = trade.pair || "XAUUSD";
  $("tradingType").value = trade.tradingType || "Scalping";
  $("direction").value = trade.direction || "Buy";
  $("strategy").value = trade.strategy || "Other";
  $("session").value = trade.session || "London";
  $("bias").value = trade.bias || "Neutral";

  $("entry").value = trade.entry || "";
  $("sl").value = trade.sl || "";
  $("tp").value = trade.tp || "";

  $("rr").value =
    trade.rr > 0
      ? `1:${Number(trade.rr).toFixed(2)}`
      : "";

  $("riskAmount").value =
    trade.riskAmount ?? "";

  $("lotSize").value =
    trade.lotSize ?? "";

  $("result").value =
    trade.result || "Break Even";

  $("profitLoss").value =
    trade.profitLoss ?? "";

  $("confidence").value =
    trade.confidence || "3/5";

  $("emotion").value =
    trade.emotion || "Neutral";

  $("mistake").value =
    trade.mistake || "No Mistake";

  $("notes").value =
    trade.notes || "";
}


/* =========================================================
   FORM EVENTS
========================================================= */

["entry", "sl", "tp", "direction"].forEach(id => {
  $(id).addEventListener("input", calculateTradeRR);
  $(id).addEventListener("change", calculateTradeRR);
});

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

$("tradeForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!state.user) return;

  $("tradeError").textContent = "";

  const pair =
    $("pair").value.trim().toUpperCase() || "XAUUSD";

  const riskRaw =
    $("riskAmount").value.trim();

  const riskAmount =
    riskRaw === "" ? 0 : Number(riskRaw);

  if (!Number.isFinite(riskAmount) || riskAmount < 0) {
    $("tradeError").textContent =
      "Risk Amount must be a valid positive number.";

    return;
  }

  const rr = calculateTradeRR();

  if (
    $("entry").value ||
    $("sl").value ||
    $("tp").value
  ) {
    if (rr <= 0) {
      $("tradeError").textContent =
        "Please enter a valid Entry, Stop Loss and Take Profit for the selected direction.";

      return;
    }
  }

  const pl = getNormalizedPL();

  if (pl === null) {
    $("tradeError").textContent =
      "Please enter a valid P/L.";

    return;
  }

  const tradeId =
    $("tradeId").value.trim() || generateTradeId();

  const tradeData = {
    tradeId,
    date: $("tradeDate").value || todayKey(),

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
      $("entry").value === ""
        ? 0
        : Number($("entry").value),

    sl:
      $("sl").value === ""
        ? 0
        : Number($("sl").value),

    tp:
      $("tp").value === ""
        ? 0
        : Number($("tp").value),

    rr,

    riskAmount,

    lotSize:
      $("lotSize").value === ""
        ? 0
        : Number($("lotSize").value),

    result:
      $("result").value,

    profitLoss:
      pl,

    confidence:
      $("confidence").value,

    emotion:
      $("emotion").value,

    mistake:
      $("mistake").value,

    notes:
      $("notes").value.trim(),

    userId:
      state.user.uid
  };

  const saveButton = $("saveTradeBtn");

  saveButton.disabled = true;

  try {

    if (state.editingId) {
      const existing =
        state.trades.find(
          t => t._key === state.editingId
        );

      if (!existing) {
        throw new Error("Trade could not be found.");
      }

      const tradeRef = getTradeRef(existing);

      await updateDoc(tradeRef, {
        ...tradeData,
        updatedAt: serverTimestamp()
      });

      showToast("Trade updated successfully.");

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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      showToast("Trade saved successfully.");
    }

    closeTradeModal();

    await loadTrades();

  } catch (error) {

    console.error("Save Trade Error:", error);

    $("tradeError").textContent =
      error.message ||
      "Could not save the trade.";

  } finally {
    saveButton.disabled = false;
  }
});


/* =========================================================
   FIRESTORE TRADE REFERENCES
========================================================= */

function getTradeRef(trade) {

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

  return doc(
    db,
    "users",
    state.user.uid,
    "trades",
    trade._docId
  );
}


/* =========================================================
   LOAD USER DATA
========================================================= */

async function loadUserData() {
  await Promise.all([
    loadSettings(),
    loadTrades()
  ]);

  renderAll();
}


/* =========================================================
   LOAD SETTINGS
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

    const snap = await getDoc(ref);

    if (snap.exists()) {

      const data = snap.data();

      state.settings = {
        startingBalance:
          Number(data.startingBalance) || 0,

        currency:
          data.currency || "USD"
      };
    }

    $("startingBalance").value =
      state.settings.startingBalance || "";

    $("currency").value =
      state.settings.currency || "USD";

  } catch (error) {
    console.error("Settings load error:", error);
  }
}


/* =========================================================
   LOAD TRADES
========================================================= */

async function loadTrades() {
  if (!state.user) return;

  try {

    const uid = state.user.uid;

    const all = [];

    /* NEW STRUCTURE */

    try {

      const nestedSnap = await getDocs(
        collection(
          db,
          "users",
          uid,
          "trades"
        )
      );

      nestedSnap.forEach(snap => {

        all.push({
          ...normalizeTrade(
            snap.data(),
            "nested",
            snap.id
          )
        });

      });

    } catch (error) {
      console.warn(
        "Nested trades could not be loaded:",
        error
      );
    }


    /* OLD TOP-LEVEL USER ID */

    try {

      const q1 = query(
        collection(db, "trades"),
        where("userId", "==", uid)
      );

      const snap1 = await getDocs(q1);

      snap1.forEach(snap => {

        all.push({
          ...normalizeTrade(
            snap.data(),
            "top-userId",
            snap.id
          )
        });

      });

    } catch (error) {
      console.warn(
        "Top-level userId trades could not be loaded:",
        error
      );
    }


    /* OLD TOP-LEVEL UID */

    try {

      const q2 = query(
        collection(db, "trades"),
        where("uid", "==", uid)
      );

      const snap2 = await getDocs(q2);

      snap2.forEach(snap => {

        all.push({
          ...normalizeTrade(
            snap.data(),
            "top-uid",
            snap.id
          )
        });

      });

    } catch (error) {
      console.warn(
        "Top-level uid trades could not be loaded:",
        error
      );
    }


    /* DEDUPLICATE */

    const map = new Map();

    for (const trade of all) {

      const logicalId =
        trade.tradeId
          ? `trade:${trade.tradeId}`
          : `${trade._source}:${trade._docId}`;

      if (!map.has(logicalId)) {
        map.set(logicalId, trade);
        continue;
      }

      const existing = map.get(logicalId);

      /* Prefer nested data */
      if (
        existing._source !== "nested" &&
        trade._source === "nested"
      ) {
        map.set(logicalId, trade);
      }
    }

    state.trades = Array.from(map.values());

    state.trades.sort((a, b) => {

      const da =
        getTradeDate(a)?.getTime() || 0;

      const dbb =
        getTradeDate(b)?.getTime() || 0;

      return dbb - da;
    });

    console.log(
      `Loaded ${state.trades.length} unique trades.`
    );

    populatePairFilter();

  } catch (error) {

    console.error(
      "Trade loading error:",
      error
    );
  }
}


/* =========================================================
   NORMALIZE OLD TRADES
========================================================= */

function normalizeTrade(data, source, docId) {

  const get = (...keys) => {

    for (const key of keys) {

      if (
        data[key] !== undefined &&
        data[key] !== null
      ) {
        return data[key];
      }
    }

    return "";
  };

  const rawPL =
    get("profitLoss", "pnl", "pl");

  const rawRisk =
    get("riskAmount", "risk");

  const rawDate =
    get("date", "tradeDate");

  const rawCreatedAt =
    data.createdAt || null;

  const rr =
    normalizeRR(
      get("rr", "riskReward")
    );

  return {

    ...data,

    _source: source,
    _docId: docId,
    _key: `${source}:${docId}`,

    tradeId:
      get("tradeId") ||
      docId,

    date:
      rawDate ||
      "",

    pair:
      String(
        get(
          "pair",
          "symbol",
          "instrument"
        ) || "XAUUSD"
      ).toUpperCase(),

    tradingType:
      get(
        "tradingType",
        "tradeType",
        "type"
      ) || "Scalping",

    direction:
      get("direction") || "Buy",

    strategy:
      get(
        "strategy",
        "setup"
      ) || "Other",

    session:
      get("session") || "London",

    bias:
      get(
        "bias",
        "marketBias"
      ) || "Neutral",

    entry:
      Number(get("entry")) || 0,

    sl:
      Number(
        get("sl", "stopLoss")
      ) || 0,

    tp:
      Number(
        get("tp", "takeProfit")
      ) || 0,

    rr,

    riskAmount:
      Number(rawRisk) || 0,

    lotSize:
      Number(get("lotSize")) || 0,

    result:
      normalizeResult(
        get("result")
      ),

    profitLoss:
      Number(rawPL) || 0,

    confidence:
      get("confidence") || "3/5",

    emotion:
      get("emotion") || "Neutral",

    mistake:
      get("mistake") || "No Mistake",

    notes:
      get("notes") || "",

    createdAt:
      rawCreatedAt
  };
}


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(tradeKey) {

  const trade =
    state.trades.find(
      t => t._key === tradeKey
    );

  if (!trade) return;

  const confirmed =
    confirm(
      `Delete trade ${trade.tradeId}?`
    );

  if (!confirmed) return;

  try {

    await deleteDoc(
      getTradeRef(trade)
    );

    showToast("Trade deleted.");

    await loadTrades();

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade."
    );
  }
}


/* =========================================================
   JOURNAL FILTERS
========================================================= */

[
  "filterResult",
  "filterTradingType",
  "filterPair",
  "filterDate",
  "filterSearch"
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
    $("filterTradingType").value = "";
    $("filterPair").value = "";
    $("filterDate").value = "";
    $("filterSearch").value = "";

    renderJournal();
  }
);

function getFilteredJournalTrades() {

  const result =
    $("filterResult").value;

  const type =
    $("filterTradingType").value;

  const pair =
    $("filterPair").value;

  const date =
    $("filterDate").value;

  const search =
    $("filterSearch").value
      .trim()
      .toLowerCase();

  return state.trades.filter(trade => {

    if (
      result &&
      trade.result !== result
    ) return false;

    if (
      type &&
      trade.tradingType !== type
    ) return false;

    if (
      pair &&
      trade.pair !== pair
    ) return false;

    if (
      date &&
      getTradeDateKey(trade) !== date
    ) return false;

    if (search) {

      const haystack = [
        trade.tradeId,
        trade.pair,
        trade.tradingType,
        trade.direction,
        trade.strategy,
        trade.session,
        trade.bias,
        trade.emotion,
        trade.mistake,
        trade.notes
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}


/* =========================================================
   PAIR FILTER
========================================================= */

function populatePairFilter() {

  const current =
    $("filterPair").value;

  const pairs =
    [...new Set(
      state.trades
        .map(t => t.pair)
        .filter(Boolean)
    )].sort();

  $("filterPair").innerHTML =
    `<option value="">All Pairs</option>` +
    pairs
      .map(
        pair =>
          `<option value="${esc(pair)}">${esc(pair)}</option>`
      )
      .join("");

  if (pairs.includes(current)) {
    $("filterPair").value = current;
  }
}


/* =========================================================
   RENDER JOURNAL
========================================================= */

function renderJournal() {

  const trades =
    getFilteredJournalTrades();

  $("journalCount").textContent =
    `${trades.length} trade${trades.length === 1 ? "" : "s"}`;

  const body =
    $("journalTableBody");

  if (!trades.length) {

    body.innerHTML = "";

    $("journalEmpty").classList.remove(
      "hidden"
    );

    return;
  }

  $("journalEmpty").classList.add(
    "hidden"
  );

  body.innerHTML =
    trades.map(trade => {

      const pl =
        num(trade.profitLoss);

      const rr =
        num(trade.rr);

      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";

      const plClass =
        pl > 0
          ? "pl-positive"
          : pl < 0
            ? "pl-negative"
            : "";

      return `
        <tr>
          <td>${esc(formatDate(trade.date))}</td>
          <td>${esc(trade.pair)}</td>
          <td>${esc(trade.tradingType)}</td>
          <td>${esc(trade.direction)}</td>
          <td>${esc(trade.strategy)}</td>
          <td>${trade.entry ? esc(trade.entry) : "-"}</td>
          <td>${rr ? `1:${rr.toFixed(2)}` : "-"}</td>
          <td class="${resultClass}">
            ${esc(trade.result)}
          </td>
          <td class="${plClass}">
            ${formatMoney(pl)}
          </td>
          <td>
            <div class="action-buttons">
              <button
                class="action-btn"
                data-edit="${esc(trade._key)}">
                Edit
              </button>

              <button
                class="action-btn delete"
                data-delete="${esc(trade._key)}">
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
                t._key ===
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
        () =>
          deleteTrade(
            button.dataset.delete
          )
      );
    });
}


/* =========================================================
   ANALYTICS FILTER
========================================================= */

function getAnalyticsTrades() {

  const period =
    $("analyticsPeriod").value;

  if (period === "all") {
    return [...state.trades];
  }

  const now = new Date();

  let start;

  if (period === "7") {

    start = new Date(now);
    start.setDate(
      start.getDate() - 6
    );

  } else if (period === "30") {

    start = new Date(now);
    start.setDate(
      start.getDate() - 29
    );

  } else if (period === "month") {

    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  } else if (period === "year") {

    start = new Date(
      now.getFullYear(),
      0,
      1
    );
  }

  start.setHours(0,0,0,0);

  return state.trades.filter(trade => {

    const d =
      getTradeDate(trade);

    if (!d) return false;

    d.setHours(0,0,0,0);

    return d >= start && d <= now;
  });
}


/* =========================================================
   ANALYTICS CALCULATION
========================================================= */

function calculateAnalytics(trades) {

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

  let realizedRSum = 0;
  let realizedRCount = 0;

  const chronological =
    [...trades].sort(
      (a,b) =>
        (getTradeDate(a)?.getTime() || 0) -
        (getTradeDate(b)?.getTime() || 0)
    );

  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;

  let currentWin = 0;
  let currentLoss = 0;

  let bestWin = 0;
  let bestLoss = 0;

  let bestTrade = null;
  let worstTrade = null;

  for (const trade of chronological) {

    const pl =
      Number(trade.profitLoss) || 0;

    totalPL += pl;

    if (trade.result === "Win") {
      wins++;
      grossProfit += Math.max(pl,0);

      currentWin++;
      currentLoss = 0;

      bestWin =
        Math.max(bestWin,currentWin);

    } else if (trade.result === "Loss") {

      losses++;
      grossLoss += Math.abs(
        Math.min(pl,0)
      );

      currentLoss++;
      currentWin = 0;

      bestLoss =
        Math.max(bestLoss,currentLoss);

    } else {

      breakeven++;

      currentWin = 0;
      currentLoss = 0;
    }

    if (
      Number.isFinite(
        Number(trade.rr)
      ) &&
      num(trade.rr) > 0
    ) {

      rrSum += num(trade.rr);
      rrCount++;
    }

    if (
      num(trade.riskAmount) > 0
    ) {

      riskSum +=
        num(trade.riskAmount);

      riskCount++;

      realizedRSum +=
        pl / num(trade.riskAmount);

      realizedRCount++;
    }

    cumulative += pl;

    peak =
      Math.max(peak,cumulative);

    const dd =
      peak - cumulative;

    maxDD =
      Math.max(maxDD,dd);

    if (
      !bestTrade ||
      pl > bestTrade.profitLoss
    ) {
      bestTrade = trade;
    }

    if (
      !worstTrade ||
      pl < worstTrade.profitLoss
    ) {
      worstTrade = trade;
    }
  }

  const total = trades.length;

  const winRate =
    total > 0
      ? wins / total * 100
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
      ? -grossLoss / losses
      : 0;

  const expectancy =
    averagePL;

  const avgRR =
    rrCount > 0
      ? rrSum / rrCount
      : 0;

  const avgRisk =
    riskCount > 0
      ? riskSum / riskCount
      : 0;

  const avgRealizedR =
    realizedRCount > 0
      ? realizedRSum /
        realizedRCount
      : 0;

  const payoffRatio =
    averageLoss < 0 &&
    averageWin > 0
      ? averageWin /
        Math.abs(averageLoss)
      : 0;

  const recoveryFactor =
    maxDD > 0
      ? totalPL / maxDD
      : 0;

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
    expectancy,
    avgRR,
    avgRisk,
    avgRealizedR,
    payoffRatio,
    maxDD,
    recoveryFactor,
    currentWin,
    currentLoss,
    bestWin,
    bestLoss,
    bestTrade,
    worstTrade,
    chronological
  };
}


/* =========================================================
   ANALYTICS BREAKDOWN
========================================================= */

const breakdownLabels = {
  tradingType: "Trading Type",
  pair: "Pair",
  direction: "Direction",
  strategy: "Strategy",
  session: "Session",
  emotion: "Emotion",
  mistake: "Mistake"
};

function getBreakdownValue(
  trade,
  type
) {

  if (type === "tradingType") {
    return trade.tradingType || "Unknown";
  }

  if (type === "pair") {
    return trade.pair || "Unknown";
  }

  if (type === "direction") {
    return trade.direction || "Unknown";
  }

  if (type === "strategy") {
    return trade.strategy || "Unknown";
  }

  if (type === "session") {
    return trade.session || "Unknown";
  }

  if (type === "emotion") {
    return trade.emotion || "Unknown";
  }

  if (type === "mistake") {
    return trade.mistake || "No Mistake";
  }

  return "Unknown";
}

function createBreakdown(
  trades,
  type
) {

  const map = new Map();

  trades.forEach(trade => {

    const category =
      getBreakdownValue(
        trade,
        type
      );

    if (!map.has(category)) {

      map.set(category, {
        category,
        trades: [],
        wins: 0,
        losses: 0,
        totalPL: 0,
        rrSum: 0,
        rrCount: 0,
        riskSum: 0,
        riskCount: 0,
        grossProfit: 0,
        grossLoss: 0
      });

    }

    const item =
      map.get(category);

    item.trades.push(trade);

    const pl =
      num(trade.profitLoss);

    item.totalPL += pl;

    if (trade.result === "Win") {
      item.wins++;
      item.grossProfit +=
        Math.max(pl,0);
    }

    if (trade.result === "Loss") {
      item.losses++;
      item.grossLoss +=
        Math.abs(Math.min(pl,0));
    }

    if (num(trade.rr) > 0) {
      item.rrSum += num(trade.rr);
      item.rrCount++;
    }

    if (num(trade.riskAmount) > 0) {
      item.riskSum +=
        num(trade.riskAmount);

      item.riskCount++;
    }
  });

  return Array.from(map.values())
    .map(item => {

      const total =
        item.trades.length;

      return {
        ...item,

        winRate:
          total
            ? item.wins / total * 100
            : 0,

        avgPL:
          total
            ? item.totalPL / total
            : 0,

        avgRR:
          item.rrCount
            ? item.rrSum /
              item.rrCount
            : 0,

        avgRisk:
          item.riskCount
            ? item.riskSum /
              item.riskCount
            : 0,

        profitFactor:
          item.grossLoss > 0
            ? item.grossProfit /
              item.grossLoss
            : item.grossProfit > 0
              ? Infinity
              : 0
      };
    })
    .sort(
      (a,b) =>
        b.totalPL - a.totalPL
    );
}


/* =========================================================
   ANALYTICS RENDER
========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();

  const stats =
    calculateAnalytics(trades);

  $("aTotalTrades").textContent =
    stats.total;

  $("aWinRate").textContent =
    formatPercent(stats.winRate);

  $("aNetPL").textContent =
    formatMoney(stats.totalPL);

  $("aProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("aExpectancy").textContent =
    formatMoney(stats.expectancy);

  $("aMaxDD").textContent =
    formatMoney(stats.maxDD);

  $("aAvgRR").textContent =
    stats.avgRR
      ? `1:${stats.avgRR.toFixed(2)}`
      : "0.00";

  $("aAvgRisk").textContent =
    formatMoney(stats.avgRisk);

  $("currentWinStreak").textContent =
    stats.currentWin;

  $("currentLossStreak").textContent =
    stats.currentLoss;

  $("bestWinStreak").textContent =
    stats.bestWin;

  $("bestLossStreak").textContent =
    stats.bestLoss;

  renderBreakdown(trades);
  renderResultBars(stats);
  renderRiskAnalysis(trades);
  renderDayOfWeek(trades);
  renderMonthly(trades);
  renderAnalyticsInsights(
    trades,
    stats
  );

  drawAnalyticsCharts(trades);
}


/* =========================================================
   BREAKDOWN TABLE
========================================================= */

function renderBreakdown(trades) {

  const type =
    $("analyticsBreakdown").value;

  const label =
    breakdownLabels[type];

  $("breakdownTitle").textContent =
    `Performance by ${label}`;

  const data =
    createBreakdown(
      trades,
      type
    );

  if (!data.length) {

    $("breakdownBody").innerHTML =
      `<tr><td colspan="10">No data available.</td></tr>`;

    return;
  }

  $("breakdownBody").innerHTML =
    data.map(item => {

      const pf =
        Number.isFinite(
          item.profitFactor
        )
          ? item.profitFactor.toFixed(2)
          : "∞";

      const plClass =
        item.totalPL > 0
          ? "pl-positive"
          : item.totalPL < 0
            ? "pl-negative"
            : "";

      return `
        <tr>
          <td>
            <strong>${esc(item.category)}</strong>
          </td>

          <td>${item.trades.length}</td>

          <td>${item.wins}</td>

          <td>${item.losses}</td>

          <td>${formatPercent(item.winRate)}</td>

          <td class="${plClass}">
            ${formatMoney(item.totalPL)}
          </td>

          <td>
            ${formatMoney(item.avgPL)}
          </td>

          <td>
            ${item.avgRR ? `1:${item.avgRR.toFixed(2)}` : "-"}
          </td>

          <td>
            ${formatMoney(item.avgRisk)}
          </td>

          <td>${pf}</td>
        </tr>
      `;
    }).join("");
}


/* =========================================================
   RESULT BARS
========================================================= */

function renderResultBars(stats) {

  const total =
    Math.max(stats.total,1);

  const rows = [
    {
      label: "Wins",
      value: stats.wins,
      className: "win"
    },
    {
      label: "Losses",
      value: stats.losses,
      className: "loss"
    },
    {
      label: "Break Even",
      value: stats.breakeven,
      className: "be"
    }
  ];

  $("resultBars").innerHTML =
    rows.map(row => {

      const percent =
        row.value / total * 100;

      return `
        <div class="result-bar-row">

          <div class="result-bar-head">
            <span>${row.label}</span>
            <strong>
              ${row.value}
              (${percent.toFixed(1)}%)
            </strong>
          </div>

          <div class="result-bar-track">
            <div
              class="result-bar-fill ${row.className}"
              style="width:${percent}%">
            </div>
          </div>

        </div>
      `;
    }).join("");
}


/* =========================================================
   RISK ANALYSIS
========================================================= */

function renderRiskAnalysis(trades) {

  const risks =
    trades
      .map(t => num(t.riskAmount))
      .filter(r => r > 0);

  if (!risks.length) {

    $("minRisk").textContent =
      formatMoney(0);

    $("riskAverage").textContent =
      formatMoney(0);

    $("maxRisk").textContent =
      formatMoney(0);

    $("riskStd").textContent =
      formatMoney(0);

    $("aboveAvgRisk").textContent =
      "0";

    return;
  }

  const min =
    Math.min(...risks);

  const max =
    Math.max(...risks);

  const avg =
    risks.reduce(
      (sum,n) => sum+n,
      0
    ) / risks.length;

  const variance =
    risks.reduce(
      (sum,n) =>
        sum + Math.pow(n-avg,2),
      0
    ) / risks.length;

  const std =
    Math.sqrt(variance);

  const above =
    risks.filter(
      r => r > avg
    ).length;

  $("minRisk").textContent =
    formatMoney(min);

  $("riskAverage").textContent =
    formatMoney(avg);

  $("maxRisk").textContent =
    formatMoney(max);

  $("riskStd").textContent =
    formatMoney(std);

  $("aboveAvgRisk").textContent =
    above;
}


/* =========================================================
   DAY OF WEEK
========================================================= */

function renderDayOfWeek(trades) {

  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  const data =
    names.map(day => ({
      day,
      trades: [],
      wins: 0,
      losses: 0,
      pl: 0
    }));

  trades.forEach(trade => {

    const d =
      getTradeDate(trade);

    if (!d) return;

    const item =
      data[d.getDay()];

    item.trades.push(trade);

    item.pl +=
      num(trade.profitLoss);

    if (trade.result === "Win") {
      item.wins++;
    }

    if (trade.result === "Loss") {
      item.losses++;
    }
  });

  $("dayOfWeekBody").innerHTML =
    data.map(item => {

      const total =
        item.trades.length;

      const winRate =
        total
          ? item.wins / total * 100
          : 0;

      const avg =
        total
          ? item.pl / total
          : 0;

      return `
        <tr>
          <td><strong>${item.day}</strong></td>
          <td>${total}</td>
          <td>${item.wins}</td>
          <td>${item.losses}</td>
          <td>${formatPercent(winRate)}</td>
          <td class="${
            item.pl > 0
              ? "pl-positive"
              : item.pl < 0
                ? "pl-negative"
                : ""
          }">
            ${formatMoney(item.pl)}
          </td>
          <td>${formatMoney(avg)}</td>
        </tr>
      `;
    }).join("");
}


/* =========================================================
   MONTHLY
========================================================= */

function renderMonthly(trades) {

  const map = new Map();

  trades.forEach(trade => {

    const d =
      getTradeDate(trade);

    if (!d) return;

    const key =
      `${d.getFullYear()}-${String(
        d.getMonth()+1
      ).padStart(2,"0")}`;

    if (!map.has(key)) {
      map.set(key,[]);
    }

    map.get(key).push(trade);
  });

  const rows =
    Array.from(map.entries())
      .sort(
        (a,b) =>
          b[0].localeCompare(a[0])
      );

  if (!rows.length) {

    $("monthlyBody").innerHTML =
      `<tr><td colspan="6">No data available.</td></tr>`;

    return;
  }

  $("monthlyBody").innerHTML =
    rows.map(([key, monthTrades]) => {

      const stats =
        calculateAnalytics(
          monthTrades
        );

      const [year,month] =
        key.split("-").map(Number);

      const label =
        new Date(
          year,
          month-1,
          1
        ).toLocaleDateString(
          undefined,
          {
            month:"long",
            year:"numeric"
          }
        );

      return `
        <tr>
          <td><strong>${label}</strong></td>
          <td>${stats.total}</td>
          <td>${formatPercent(stats.winRate)}</td>
          <td class="${
            stats.totalPL > 0
              ? "pl-positive"
              : stats.totalPL < 0
                ? "pl-negative"
                : ""
          }">
            ${formatMoney(stats.totalPL)}
          </td>
          <td>${formatMoney(stats.averagePL)}</td>
          <td>
            ${stats.avgRR ? `1:${stats.avgRR.toFixed(2)}` : "-"}
          </td>
        </tr>
      `;
    }).join("");
}


/* =========================================================
   ANALYTICS INSIGHTS
========================================================= */

function renderAnalyticsInsights(
  trades,
  stats
) {

  const insights = [];

  if (!trades.length) {

    $("analyticsInsights").innerHTML = `
      <div class="insight">
        Add trades to generate journal insights.
      </div>
    `;

    return;
  }

  insights.push(
    `You recorded <strong>${stats.total}</strong> trades in the selected period, with a win rate of <strong>${formatPercent(stats.winRate)}</strong>.`
  );

  insights.push(
    `Your recorded net P/L is <strong>${formatMoney(stats.totalPL)}</strong>, with an average P/L of <strong>${formatMoney(stats.averagePL)}</strong> per trade.`
  );

  if (stats.avgRisk > 0) {
    insights.push(
      `Your average recorded risk amount is <strong>${formatMoney(stats.avgRisk)}</strong>.`
    );
  }

  if (stats.avgRealizedR !== 0) {
    insights.push(
      `Your average realized R across trades with recorded risk is <strong>${stats.avgRealizedR.toFixed(2)}R</strong>.`
    );
  }

  if (stats.bestTrade) {
    insights.push(
      `Your highest recorded single-trade P/L in this period was <strong>${formatMoney(stats.bestTrade.profitLoss)}</strong>.`
    );
  }

  if (stats.worstTrade) {
    insights.push(
      `Your lowest recorded single-trade P/L in this period was <strong>${formatMoney(stats.worstTrade.profitLoss)}</strong>.`
    );
  }

  const breakdownType =
    $("analyticsBreakdown").value;

  const groups =
    createBreakdown(
      trades,
      breakdownType
    );

  if (groups.length) {

    const highestTradeCount =
      [...groups].sort(
        (a,b) =>
          b.trades.length -
          a.trades.length
      )[0];

    if (highestTradeCount) {

      insights.push(
        `Your highest trade count is in <strong>${esc(highestTradeCount.category)}</strong> with <strong>${highestTradeCount.trades.length}</strong> recorded trades.`
      );
    }

    const highestPL =
      [...groups].sort(
        (a,b) =>
          b.totalPL -
          a.totalPL
      )[0];

    if (highestPL) {

      insights.push(
        `<strong>${esc(highestPL.category)}</strong> has the highest recorded net P/L within the selected ${esc(breakdownLabels[breakdownType].toLowerCase())} breakdown at <strong>${formatMoney(highestPL.totalPL)}</strong>.`
      );
    }
  }

  const mistakes =
    createBreakdown(
      trades,
      "mistake"
    );

  const mistakeGroups =
    mistakes.filter(
      x =>
        x.category !== "No Mistake"
    );

  if (mistakeGroups.length) {

    const mostFrequent =
      [...mistakeGroups].sort(
        (a,b) =>
          b.trades.length -
          a.trades.length
      )[0];

    insights.push(
      `The most frequently recorded mistake is <strong>${esc(mostFrequent.category)}</strong>, appearing in <strong>${mostFrequent.trades.length}</strong> trades.`
    );
  }

  $("analyticsInsights").innerHTML =
    insights.map(
      text =>
        `<div class="insight">• ${text}</div>`
    ).join("");
}


/* =========================================================
   CHART DRAWING
========================================================= */

function prepareCanvas(canvas) {

  const rect =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  const width =
    Math.max(rect.width, 100);

  const height =
    Math.max(rect.height, 180);

  canvas.width =
    width * ratio;

  canvas.height =
    height * ratio;

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
    width,
    height
  };
}

function drawLineChart(
  canvas,
  values,
  options = {}
) {

  const {
    ctx,
    width,
    height
  } = prepareCanvas(canvas);

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  if (!values.length) {

    ctx.fillStyle =
      "#8c929e";

    ctx.font =
      "12px system-ui";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "No data available",
      width / 2,
      height / 2
    );

    return;
  }

  const padding = {
    top: 20,
    right: 15,
    bottom: 28,
    left: 50
  };

  const chartW =
    width -
    padding.left -
    padding.right;

  const chartH =
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

  min -= range * .08;
  max += range * .08;

  /* GRID */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;

  for (let i=0; i<5; i++) {

    const y =
      padding.top +
      chartH * i / 4;

    ctx.beginPath();
    ctx.moveTo(
      padding.left,
      y
    );
    ctx.lineTo(
      width-padding.right,
      y
    );
    ctx.stroke();
  }

  /* ZERO LINE */

  if (min <= 0 && max >= 0) {

    const zeroY =
      padding.top +
      (max / (max-min)) *
      chartH;

    ctx.strokeStyle =
      "rgba(255,255,255,.12)";

    ctx.beginPath();
    ctx.moveTo(
      padding.left,
      zeroY
    );
    ctx.lineTo(
      width-padding.right,
      zeroY
    );
    ctx.stroke();
  }

  /* LABELS */

  ctx.fillStyle =
    "#8c929e";

  ctx.font =
    "10px system-ui";

  ctx.textAlign =
    "right";

  for (let i=0; i<5; i++) {

    const value =
      max -
      ((max-min) * i / 4);

    const y =
      padding.top +
      chartH * i / 4;

    ctx.fillText(
      value.toFixed(0),
      padding.left-7,
      y+3
    );
  }

  /* LINE */

  ctx.beginPath();

  values.forEach(
    (value,index) => {

      const x =
        values.length === 1
          ? padding.left +
            chartW/2
          : padding.left +
            chartW *
            index /
            (values.length-1);

      const y =
        padding.top +
        (max-value) /
        (max-min) *
        chartH;

      if (index === 0) {
        ctx.moveTo(x,y);
      } else {
        ctx.lineTo(x,y);
      }
    }
  );

  ctx.strokeStyle =
    options.lineColor ||
    "#d6ae55";

  ctx.lineWidth = 2.5;
  ctx.stroke();

  /* AREA */

  const lastX =
    values.length === 1
      ? padding.left +
        chartW/2
      : padding.left +
        chartW;

  const bottom =
    padding.top +
    chartH;

  ctx.lineTo(
    lastX,
    bottom
  );

  ctx.lineTo(
    padding.left,
    bottom
  );

  ctx.closePath();

  const gradient =
    ctx.createLinearGradient(
      0,
      padding.top,
      0,
      bottom
    );

  gradient.addColorStop(
    0,
    "rgba(214,174,85,.18)"
  );

  gradient.addColorStop(
    1,
    "rgba(214,174,85,0)"
  );

  ctx.fillStyle =
    gradient;

  ctx.fill();

  /* DOTS */

  ctx.fillStyle =
    options.lineColor ||
    "#d6ae55";

  values.forEach(
    (value,index) => {

      const x =
        values.length === 1
          ? padding.left +
            chartW/2
          : padding.left +
            chartW *
            index /
            (values.length-1);

      const y =
        padding.top +
        (max-value) /
        (max-min) *
        chartH;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        3,
        0,
        Math.PI*2
      );

      ctx.fill();
    }
  );
}

function drawAnalyticsCharts(trades) {

  const chronological =
    [...trades].sort(
      (a,b) =>
        (getTradeDate(a)?.getTime() || 0) -
        (getTradeDate(b)?.getTime() || 0)
    );

  let cumulative =
    Number(
      state.settings.startingBalance
    ) || 0;

  let pnlCurve = [];
  let drawdown = [];

  let peak =
    cumulative;

  chronological.forEach(trade => {

    cumulative +=
      num(trade.profitLoss);

    peak =
      Math.max(
        peak,
        cumulative
      );

    pnlCurve.push(cumulative);

    drawdown.push(
      cumulative - peak
    );
  });

  if (!pnlCurve.length) {

    pnlCurve = [
      Number(
        state.settings.startingBalance
      ) || 0
    ];

    drawdown = [0];
  }

  drawLineChart(
    $("analyticsEquityChart"),
    pnlCurve
  );

  drawLineChart(
    $("drawdownChart"),
    drawdown
  );

  drawLineChart(
    $("dashboardEquityChart"),
    pnlCurve
  );
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
    formatPercent(stats.winRate);

  $("dashNetPL").textContent =
    formatMoney(stats.totalPL);

  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("dashAvgRR").textContent =
    stats.avgRR
      ? `1:${stats.avgRR.toFixed(2)}`
      : "0.00";

  $("dashDrawdown").textContent =
    formatMoney(stats.maxDD);

  $("dashWins").textContent =
    stats.wins;

  $("dashLosses").textContent =
    stats.losses;

  $("dashBE").textContent =
    stats.breakeven;

  $("dashAvgWin").textContent =
    formatMoney(stats.averageWin);

  $("dashAvgLoss").textContent =
    formatMoney(stats.averageLoss);

  $("dashExpectancy").textContent =
    formatMoney(stats.expectancy);

  renderRecentTrades();

  drawAnalyticsCharts(
    state.trades
  );
}

function renderRecentTrades() {

  const recent =
    state.trades.slice(0,6);

  if (!recent.length) {

    $("recentTrades").innerHTML = `
      <div class="empty-state">
        <div>▤</div>
        <h3>No trades yet</h3>
        <p>Add your first trade.</p>
      </div>
    `;

    return;
  }

  $("recentTrades").innerHTML =
    recent.map(trade => {

      const pl =
        num(trade.profitLoss);

      const resultClass =
        pl > 0
          ? "pl-positive"
          : pl < 0
            ? "pl-negative"
            : "";

      return `
        <div class="recent-trade">

          <div>
            <strong>
              ${esc(trade.pair)}
              ·
              ${esc(trade.direction)}
            </strong>

            <small>
              ${esc(formatDate(trade.date))}
              ·
              ${esc(trade.strategy)}
            </small>
          </div>

          <div class="pl ${resultClass}">
            ${formatMoney(pl)}
          </div>

        </div>
      `;
    }).join("");
}


/* =========================================================
   ANALYTICS CONTROLS
========================================================= */

$("analyticsPeriod").addEventListener(
  "change",
  renderAnalytics
);

$("analyticsBreakdown").addEventListener(
  "change",
  renderAnalytics
);


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

  let rr = 0;

  if (
    stopDistance > 0 &&
    rewardDistance > 0
  ) {
    rr =
      rewardDistance /
      stopDistance;
  }

  const lot =
    stopDistance > 0
      ? riskAmount /
        (stopDistance * 100)
      : 0;

  $("calcRiskAmount").textContent =
    formatMoney(riskAmount);

  $("calcStopDistance").textContent =
    formatNumber(
      Math.abs(stopDistance),
      2
    );

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

$("prevMonth").addEventListener(
  "click",
  () => {

    state.calendarDate.setMonth(
      state.calendarDate.getMonth()-1
    );

    renderCalendar();
  }
);

$("nextMonth").addEventListener(
  "click",
  () => {

    state.calendarDate.setMonth(
      state.calendarDate.getMonth()+1
    );

    renderCalendar();
  }
);

function renderCalendar() {

  const year =
    state.calendarDate.getFullYear();

  const month =
    state.calendarDate.getMonth();

  $("calendarMonthTitle").textContent =
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

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const daysInMonth =
    new Date(
      year,
      month+1,
      0
    ).getDate();

  const daysInPrevMonth =
    new Date(
      year,
      month,
      0
    ).getDate();

  const grid =
    $("calendarGrid");

  grid.innerHTML = "";

  const totalCells =
    Math.ceil(
      (firstDay + daysInMonth) / 7
    ) * 7;

  for (
    let i=0;
    i<totalCells;
    i++
  ) {

    let dayNumber;
    let cellDate;
    let otherMonth = false;

    if (i < firstDay) {

      dayNumber =
        daysInPrevMonth -
        firstDay +
        i +
        1;

      cellDate =
        new Date(
          year,
          month-1,
          dayNumber
        );

      otherMonth = true;

    } else if (
      i >=
      firstDay + daysInMonth
    ) {

      dayNumber =
        i -
        firstDay -
        daysInMonth +
        1;

      cellDate =
        new Date(
          year,
          month+1,
          dayNumber
        );

      otherMonth = true;

    } else {

      dayNumber =
        i -
        firstDay +
        1;

      cellDate =
        new Date(
          year,
          month,
          dayNumber
        );
    }

    const key =
      dateKey(cellDate);

    const dayTrades =
      state.trades.filter(
        trade =>
          getTradeDateKey(trade) === key
      );

    const wins =
      dayTrades.filter(
        t => t.result === "Win"
      ).length;

    const losses =
      dayTrades.filter(
        t => t.result === "Loss"
      ).length;

    const pl =
      dayTrades.reduce(
        (sum,t) =>
          sum + num(t.profitLoss),
        0
      );

    const selected =
      state.selectedCalendarDate === key;

    const cell =
      document.createElement("div");

    cell.className =
      `calendar-day
       ${otherMonth ? "other-month" : ""}
       ${selected ? "selected" : ""}`;

    cell.innerHTML = `
      <div class="calendar-number">
        ${dayNumber}
      </div>

      ${
        dayTrades.length
          ? `
            <div class="calendar-summary">
              <span>
                <span class="win">${wins}W</span>
                /
                <span class="loss">${losses}L</span>
              </span>

              <span class="money ${
                pl > 0
                  ? "pl-positive"
                  : pl < 0
                    ? "pl-negative"
                    : ""
              }">
                ${pl > 0 ? "+" : ""}
                ${pl.toFixed(0)}
              </span>
            </div>
          `
          : ""
      }
    `;

    cell.addEventListener(
      "click",
      () => {

        state.selectedCalendarDate =
          key;

        renderCalendar();

        renderSelectedCalendarDate();
      }
    );

    grid.appendChild(cell);
  }

  renderSelectedCalendarDate();
}

function renderSelectedCalendarDate() {

  const key =
    state.selectedCalendarDate;

  if (!key) {

    $("selectedDateTitle").textContent =
      "Select a date";

    $("calendarDayTrades").innerHTML = `
      <div class="empty-state">
        <div>▣</div>
        <h3>No date selected</h3>
        <p>Choose a day from the calendar.</p>
      </div>
    `;

    return;
  }

  const date =
    parseDateOnly(key);

  $("selectedDateTitle").textContent =
    date
      ? date.toLocaleDateString(
          undefined,
          {
            weekday:"long",
            year:"numeric",
            month:"long",
            day:"numeric"
          }
        )
      : key;

  const trades =
    state.trades.filter(
      trade =>
        getTradeDateKey(trade) === key
    );

  if (!trades.length) {

    $("calendarDayTrades").innerHTML = `
      <div class="empty-state">
        <div>▣</div>
        <h3>No trades</h3>
        <p>No journal entries were recorded on this date.</p>
      </div>
    `;

    return;
  }

  $("calendarDayTrades").innerHTML =
    trades.map(trade => {

      const pl =
        num(trade.profitLoss);

      return `
        <div class="calendar-trade">

          <div class="calendar-trade-top">
            <strong>
              ${esc(trade.pair)}
              ·
              ${esc(trade.direction)}
            </strong>

            <strong class="${
              pl > 0
                ? "pl-positive"
                : pl < 0
                  ? "pl-negative"
                  : ""
            }">
              ${formatMoney(pl)}
            </strong>
          </div>

          <small>
            ${esc(trade.tradingType)}
            ·
            ${esc(trade.strategy)}
            ·
            ${esc(trade.session)}
          </small>

          <small>
            Emotion: ${esc(trade.emotion)}
            ·
            Mistake: ${esc(trade.mistake)}
          </small>

        </div>
      `;
    }).join("");
}


/* =========================================================
   SETTINGS
========================================================= */

$("saveSettingsBtn").addEventListener(
  "click",
  async () => {

    if (!state.user) return;

    const startingBalance =
      Number(
        $("startingBalance").value
      ) || 0;

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

      state.settings = {
        startingBalance,
        currency
      };

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
  }
);


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

  return `"${text.replaceAll('"','""')}"`;
}

function exportCSV() {

  const trades =
    getFilteredJournalTrades();

  if (!trades.length) {

    showToast(
      "No trades to export."
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
    "Mistake",
    "Notes"
  ];

  const rows =
    trades.map(t => [
      t.tradeId,
      t.date,
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
    ]);

  const csv =
    [
      headers,
      ...rows
    ]
      .map(
        row =>
          row
            .map(csvValue)
            .join(",")
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
    `ujr-fx-trades-${todayKey()}.csv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

  showToast(
    "CSV exported."
  );
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

  toast.classList.add(
    "show"
  );

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 2500);
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
   WINDOW RESIZE
========================================================= */

let resizeTimer;

window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      resizeTimer
    );

    resizeTimer =
      setTimeout(() => {

        renderDashboard();

        if (
          $("analyticsPage")
            .classList
            .contains("active-page")
        ) {
          renderAnalytics();
        }

      }, 120);
  }
);


/* =========================================================
   INITIAL DEFAULTS
========================================================= */

$("tradeDate").value =
  todayKey();

$("tradeId").value =
  generateTradeId();

$("pair").value =
  "XAUUSD";

calculateRisk();
