/* =========================================================
   UjR Fx Trading Journal
   Firebase Authentication + Firestore
   NO IMAGE STORAGE SYSTEM
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
   INITIALIZE FIREBASE
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

let settings = {
  startingBalance: 0,
  currency: "$"
};

let unsubscribeTrades = null;

let unsubscribeSettings = null;

let editingTradeId = null;

let manualLot = false;

let calendarDate = new Date();


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  const symbol = settings.currency || "$";

  const amount = number(value);

  const formatted = Math.abs(amount).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );

  if (amount < 0) {
    return `-${symbol}${formatted}`;
  }

  return `${symbol}${formatted}`;
}

function moneyPlain(value) {
  const symbol = settings.currency || "$";

  const amount = number(value);

  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const parts = dateString.split("-");

  if (parts.length !== 3) return dateString;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function todayString() {
  const d = new Date();

  const year = d.getFullYear();

  const month = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function showToast(message, type = "success") {

  const toast = $("toast");

  toast.textContent = message;

  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginWithGoogle() {

  const button = $("loginBtn");

  const loading = $("loginLoading");

  const errorBox = $("loginError");

  errorBox.textContent = "";

  button.disabled = true;

  loading.classList.remove("hidden");

  try {

    await signInWithPopup(
      auth,
      googleProvider
    );

  } catch (error) {

    console.error("Google login error:", error);

    let message = "Google login failed.";

    switch (error.code) {

      case "auth/popup-closed-by-user":
        message = "Login window was closed.";
        break;

      case "auth/popup-blocked":
        message =
          "Google login popup was blocked. Please allow popups for this site.";
        break;

      case "auth/unauthorized-domain":
        message =
          "This website is not authorized in Firebase. Add your current domain in Firebase Authentication → Settings → Authorized domains.";
        break;

      case "auth/operation-not-allowed":
        message =
          "Google Sign-In is not enabled. Enable Google under Firebase Authentication → Sign-in method.";
        break;

      case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      case "auth/invalid-api-key":
        message =
          "Firebase API key is invalid. Copy the current Web App configuration from Firebase Console.";
        break;

      case "auth/network-request-failed":
        message =
          "Network error. Check your internet connection and try again.";
        break;

      case "auth/internal-error":
        message =
          "Firebase returned an internal error. Check Firebase Authentication settings.";
        break;

      default:
        message =
          `${error.code || "Unknown error"}: ${error.message || "Unknown error"}`;
    }

    errorBox.textContent = message;

  } finally {

    button.disabled = false;

    loading.classList.add("hidden");

  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

    showToast(
      "Logout failed.",
      "error"
    );

  }
}


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;

    $("loginScreen").classList.add("hidden");

    $("app").classList.remove("hidden");

    setUserInfo(user);

    await loadUserSettings();

    subscribeTrades();

    updateCurrentDate();

    showPage("dashboardPage");

  } else {

    currentUser = null;

    trades = [];

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    if (unsubscribeSettings) {
      unsubscribeSettings();
      unsubscribeSettings = null;
    }

    $("app").classList.add("hidden");

    $("loginScreen").classList.remove("hidden");

  }

});


/* =========================================================
   USER INFO
   ========================================================= */

function setUserInfo(user) {

  const name =
    user.displayName ||
    "Trader";

  const email =
    user.email ||
    "";

  const photo =
    user.photoURL ||
    "logo.png";

  $("userName").textContent = name;

  $("userEmail").textContent = email;

  $("userPhoto").src = photo;

  $("topbarUserPhoto").src = photo;
}


/* =========================================================
   FIRESTORE PATHS
   ========================================================= */

function userDoc() {

  return doc(
    db,
    "users",
    currentUser.uid
  );

}

function tradesCollection() {

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

async function loadUserSettings() {

  if (!currentUser) return;

  try {

    const snapshot =
      await getDoc(userDoc());

    if (snapshot.exists()) {

      const data = snapshot.data();

      settings.startingBalance =
        number(data.startingBalance);

      settings.currency =
        data.currency || "$";

    } else {

      settings = {
        startingBalance: 0,
        currency: "$"
      };

      await setDoc(
        userDoc(),
        settings
      );

    }

    renderSettings();

  } catch (error) {

    console.error(
      "Settings error:",
      error
    );

    showToast(
      "Could not load settings.",
      "error"
    );

  }
}


/* =========================================================
   SAVE SETTINGS
   ========================================================= */

async function saveSettings() {

  if (!currentUser) return;

  const balance =
    number($("startingBalance").value);

  const currency =
    $("currency").value || "$";

  settings.startingBalance = balance;

  settings.currency = currency;

  try {

    await setDoc(
      userDoc(),
      {
        startingBalance: balance,
        currency: currency
      },
      {
        merge: true
      }
    );

    renderSettings();

    updateDashboard();

    updateAnalytics();

    renderCalendar();

    showToast(
      "Settings saved."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Could not save settings.",
      "error"
    );

  }
}


/* =========================================================
   SETTINGS UI
   ========================================================= */

function renderSettings() {

  $("startingBalance").value =
    settings.startingBalance;

  $("currency").value =
    settings.currency || "$";
}


/* =========================================================
   TRADES SUBSCRIPTION
   ========================================================= */

function subscribeTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
  }

  const q = query(
    tradesCollection(),
    orderBy("date", "desc")
  );

  unsubscribeTrades = onSnapshot(
    q,
    (snapshot) => {

      trades = snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

      updateEverything();

    },
    (error) => {

      console.error(
        "Trades listener error:",
        error
      );

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

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  const tp =
    number($("tp").value);

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


/* =========================================================
   RISK CALCULATION
   ========================================================= */

function calculateTradeRisk() {

  const balance =
    settings.startingBalance;

  const riskPercent =
    number($("riskPercent").value);

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  const direction =
    $("direction").value;

  if (
    balance <= 0 ||
    riskPercent <= 0 ||
    entry <= 0 ||
    sl <= 0
  ) {

    $("riskAmount").value = "";

    if (!manualLot) {
      $("lotSize").value = "";
    }

    return;

  }

  const riskAmount =
    balance * riskPercent / 100;

  let distance;

  if (direction === "Buy") {
    distance = entry - sl;
  } else {
    distance = sl - entry;
  }

  $("riskAmount").value =
    riskAmount.toFixed(2);

  if (
    distance <= 0
  ) {

    if (!manualLot) {
      $("lotSize").value = "";
    }

    return;

  }

  /*
    Simplified XAUUSD sizing:
    1 lot ≈ 100 oz.

    Exact broker sizing can differ.
  */

  const lot =
    riskAmount /
    (Math.abs(distance) * 100);

  if (!manualLot) {

    $("lotSize").value =
      Math.max(0, lot).toFixed(2);

  }

}


/* =========================================================
   P/L NORMALIZATION
   ========================================================= */

function normalizeProfitLossByResult() {

  const result =
    $("result").value;

  const input =
    $("profitLoss");

  const raw =
    input.value.trim();

  if (result === "Loss") {

    const value =
      Math.abs(Number(raw) || 0);

    input.value =
      value ? (-value).toFixed(2) : "";

  }

  else if (result === "Win") {

    const value =
      Math.abs(Number(raw) || 0);

    input.value =
      value ? value.toFixed(2) : "";

  }

  else if (result === "Break Even") {

    input.value = "0";

  }

}


/* =========================================================
   P/L INPUT SIGN CONTROL
   ========================================================= */

function handleProfitLossInput() {

  const result =
    $("result").value;

  let value =
    Number($("profitLoss").value);

  if (!Number.isFinite(value)) {
    return;
  }

  if (result === "Loss") {

    value = -Math.abs(value);

  }

  else if (result === "Win") {

    value = Math.abs(value);

  }

  else if (result === "Break Even") {

    value = 0;

  }

  $("profitLoss").value =
    value === 0 ? "0" : value;

}


/* =========================================================
   GET NORMALIZED P/L
   ========================================================= */

function getNormalizedPL() {

  const result =
    $("result").value;

  let value =
    Number($("profitLoss").value) || 0;

  if (result === "Loss") {

    value = -Math.abs(value);

  }

  else if (result === "Win") {

    value = Math.abs(value);

  }

  else if (result === "Break Even") {

    value = 0;

  }

  return Number(
    value.toFixed(2)
  );
}


/* =========================================================
   OPEN ADD TRADE MODAL
   ========================================================= */

function openAddTradeModal() {

  editingTradeId = null;

  manualLot = false;

  $("tradeForm").reset();

  $("modalTitle").textContent =
    "Add Trade";

  $("tradeId").value = "";

  $("tradeDate").value =
    todayString();

  const now = new Date();

  $("tradeTime").value =
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  $("pair").value = "XAUUSD";

  $("direction").value = "Buy";

  $("result").value = "Win";

  $("riskPercent").value = "1";

  $("profitLoss").value = "";

  $("rr").value = "";

  $("riskAmount").value = "";

  $("lotSize").value = "";

  $("lotSize").dataset.manual =
    "false";

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

}


/* =========================================================
   OPEN EDIT TRADE
   ========================================================= */

function openEditTradeModal(trade) {

  editingTradeId =
    trade.id;

  manualLot = true;

  $("modalTitle").textContent =
    "Edit Trade";

  $("tradeId").value =
    trade.id;

  $("tradeDate").value =
    trade.date || todayString();

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

  $("riskPercent").value =
    trade.riskPercent ?? 1;

  $("riskAmount").value =
    trade.riskAmount ?? "";

  $("lotSize").value =
    trade.lotSize ?? "";

  $("lotSize").dataset.manual =
    "true";

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
    trade.profitLoss ?? 0;

  $("confidence").value =
    trade.confidence || "";

  $("psychology").value =
    trade.psychology || "";

  $("mistake").value =
    trade.mistake || "";

  $("notes").value =
    trade.notes || "";

  calculateTradeRR();

  normalizeProfitLossByResult();

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

}


/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  editingTradeId = null;

  manualLot = false;

}


/* =========================================================
   SAVE TRADE
   ========================================================= */

async function saveTrade(event) {

  event.preventDefault();

  if (!currentUser) {

    $("tradeError").textContent =
      "Please login first.";

    return;

  }

  const errorBox =
    $("tradeError");

  errorBox.textContent = "";

  const date =
    $("tradeDate").value;

  const pair =
    $("pair").value.trim();

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  const tp =
    number($("tp").value);

  if (!date || !pair) {

    errorBox.textContent =
      "Please enter date and pair.";

    return;

  }

  if (
    entry <= 0 ||
    sl <= 0 ||
    tp <= 0
  ) {

    errorBox.textContent =
      "Entry, SL and TP must be greater than 0.";

    return;

  }

  const rr =
    calculateTradeRR();

  if (!rr || rr <= 0) {

    errorBox.textContent =
      "Invalid Entry / SL / TP for the selected direction.";

    return;

  }

  calculateTradeRisk();

  normalizeProfitLossByResult();

  const profitLoss =
    getNormalizedPL();

  const trade = {

    date,

    time:
      $("tradeTime").value || "",

    pair,

    direction:
      $("direction").value,

    entry,

    sl,

    tp,

    rr:

      Number(
        rr.toFixed(4)
      ),

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
        trade
      );

      showToast(
        "Trade updated."
      );

    } else {

      await addDoc(
        tradesCollection(),
        {
          ...trade,
          createdAt: Date.now()
        }
      );

      showToast(
        "Trade added."
      );

    }

    closeTradeModal();

  } catch (error) {

    console.error(
      "Save trade error:",
      error
    );

    errorBox.textContent =
      error.message ||
      "Could not save trade.";

  }

}


/* =========================================================
   DELETE TRADE
   ========================================================= */

async function deleteTrade(id) {

  if (!currentUser) return;

  const confirmed =
    confirm(
      "Delete this trade?"
    );

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

    showToast(
      "Trade deleted."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade.",
      "error"
    );

  }

}


/* =========================================================
   RESULT CHIP
   ========================================================= */

function resultChip(result) {

  if (result === "Win") {

    return `
      <span class="result-chip result-win">
        WIN
      </span>
    `;

  }

  if (result === "Loss") {

    return `
      <span class="result-chip result-loss">
        LOSS
      </span>
    `;

  }

  return `
    <span class="result-chip result-be">
      BREAK EVEN
    </span>
  `;

}


/* =========================================================
   FILTER TRADES
   ========================================================= */

function getFilteredTrades() {

  const result =
    $("filterResult").value;

  const pair =
    $("filterPair").value
      .trim()
      .toLowerCase();

  const date =
    $("filterDate").value;

  return trades.filter(
    (trade) => {

      if (
        result &&
        trade.result !== result
      ) {
        return false;
      }

      if (
        pair &&
        !String(
          trade.pair || ""
        )
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

    }
  );

}


/* =========================================================
   RENDER JOURNAL
   ========================================================= */

function renderJournal() {

  const tbody =
    $("journalTableBody");

  const empty =
    $("journalEmpty");

  const filtered =
    getFilteredTrades();

  tbody.innerHTML = "";

  if (!filtered.length) {

    empty.classList.remove(
      "hidden"
    );

  } else {

    empty.classList.add(
      "hidden"
    );

  }

  filtered.forEach(
    (trade) => {

      const tr =
        document.createElement("tr");

      const pl =
        number(
          trade.profitLoss
        );

      const directionClass =
        trade.direction === "Buy"
          ? "direction-buy"
          : "direction-sell";

      const plClass =
        pl > 0
          ? "pl-positive"
          : pl < 0
            ? "pl-negative"
            : "";

      tr.innerHTML = `

        <td>${formatDate(trade.date)}</td>

        <td>${trade.time || "-"}</td>

        <td>
          <strong>${escapeHtml(trade.pair || "-")}</strong>
        </td>

        <td class="${directionClass}">
          ${escapeHtml(trade.direction || "-")}
        </td>

        <td>${number(trade.entry).toFixed(3)}</td>

        <td>${number(trade.sl).toFixed(3)}</td>

        <td>${number(trade.tp).toFixed(3)}</td>

        <td>
          1:${number(trade.rr).toFixed(2)}
        </td>

        <td>
          ${resultChip(trade.result)}
        </td>

        <td class="${plClass}">
          ${money(pl)}
        </td>

        <td>

          <div class="table-actions">

            <button
              class="action-btn"
              data-edit="${trade.id}"
              title="Edit"
            >
              ✎
            </button>

            <button
              class="action-btn action-delete"
              data-delete="${trade.id}"
              title="Delete"
            >
              ×
            </button>

          </div>

        </td>

      `;

      tbody.appendChild(tr);

    }
  );

  updateJournalStats(
    filtered
  );

}


/* =========================================================
   JOURNAL STATS
   ========================================================= */

function updateJournalStats(list = trades) {

  const wins =
    list.filter(
      t => t.result === "Win"
    ).length;

  const losses =
    list.filter(
      t => t.result === "Loss"
    ).length;

  const pl =
    list.reduce(
      (sum, t) =>
        sum + number(t.profitLoss),
      0
    );

  $("journalTrades").textContent =
    list.length;

  $("journalWins").textContent =
    wins;

  $("journalLosses").textContent =
    losses;

  $("journalPL").textContent =
    money(pl);

  $("journalPL").className =
    pl > 0
      ? "pl-positive"
      : pl < 0
        ? "pl-negative"
        : "";

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function updateDashboard() {

  const total =
    trades.length;

  const wins =
    trades.filter(
      t => t.result === "Win"
    );

  const losses =
    trades.filter(
      t => t.result === "Loss"
    );

  const breakEven =
    trades.filter(
      t => t.result === "Break Even"
    );

  const totalPL =
    trades.reduce(
      (sum, t) =>
        sum + number(t.profitLoss),
      0
    );

  const balance =
    settings.startingBalance +
    totalPL;

  const decided =
    wins.length +
    losses.length;

  const winRate =
    decided > 0
      ? wins.length / decided * 100
      : 0;

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

  const pf =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const avgR =
    total > 0
      ? trades.reduce(
          (sum, t) =>
            sum + number(t.rr),
          0
        ) / total
      : 0;

  $("currentBalance").textContent =
    money(balance);

  $("totalPL").textContent =
    money(totalPL);

  $("totalPL").className =
    totalPL > 0
      ? "pl-positive"
      : totalPL < 0
        ? "pl-negative"
        : "";

  $("winRate").textContent =
    `${winRate.toFixed(1)}%`;

  $("totalTrades").textContent =
    total;

  $("profitFactor").textContent =
    pf === Infinity
      ? "∞"
      : pf.toFixed(2);

  $("avgR").textContent =
    `${avgR.toFixed(2)}R`;

  $("dashboardWins").textContent =
    wins.length;

  $("dashboardLosses").textContent =
    losses.length;

  $("dashboardBE").textContent =
    breakEven.length;

  const avgWin =
    wins.length
      ? wins.reduce(
          (sum, t) =>
            sum + Math.abs(number(t.profitLoss)),
          0
        ) / wins.length
      : 0;

  const avgLoss =
    losses.length
      ? losses.reduce(
          (sum, t) =>
            sum + Math.abs(number(t.profitLoss)),
          0
        ) / losses.length
      : 0;

  $("dashboardAvgWin").textContent =
    money(avgWin);

  $("dashboardAvgLoss").textContent =
    money(-avgLoss);

  const best =
    trades.length
      ? Math.max(
          ...trades.map(
            t => number(t.profitLoss)
          )
        )
      : 0;

  const worst =
    trades.length
      ? Math.min(
          ...trades.map(
            t => number(t.profitLoss)
          )
        )
      : 0;

  $("bestTrade").textContent =
    money(best);

  $("worstTrade").textContent =
    money(worst);

  renderRecentTrades();

  drawEquityCurve();

}


/* =========================================================
   RECENT TRADES
   ========================================================= */

function renderRecentTrades() {

  const tbody =
    $("recentTradesBody");

  const empty =
    $("recentEmpty");

  tbody.innerHTML = "";

  const recent =
    [...trades]
      .sort(
        (a,b) =>
          String(b.date || "")
            .localeCompare(
              String(a.date || "")
            )
      )
      .slice(0, 8);

  if (!recent.length) {

    empty.classList.remove(
      "hidden"
    );

    return;

  }

  empty.classList.add(
    "hidden"
  );

  recent.forEach(
    (trade) => {

      const tr =
        document.createElement("tr");

      const pl =
        number(trade.profitLoss);

      const plClass =
        pl > 0
          ? "pl-positive"
          : pl < 0
            ? "pl-negative"
            : "";

      const directionClass =
        trade.direction === "Buy"
          ? "direction-buy"
          : "direction-sell";

      tr.innerHTML = `

        <td>${formatDate(trade.date)}</td>

        <td>
          <strong>${escapeHtml(trade.pair || "-")}</strong>
        </td>

        <td class="${directionClass}">
          ${escapeHtml(trade.direction || "-")}
        </td>

        <td>${number(trade.entry).toFixed(3)}</td>

        <td>1:${number(trade.rr).toFixed(2)}</td>

        <td>${resultChip(trade.result)}</td>

        <td class="${plClass}">
          ${money(pl)}
        </td>

      `;

      tbody.appendChild(tr);

    }
  );

}


/* =========================================================
   ANALYTICS
   ========================================================= */

function updateAnalytics() {

  const total =
    trades.length;

  const wins =
    trades.filter(
      t => t.result === "Win"
    );

  const losses =
    trades.filter(
      t => t.result === "Loss"
    );

  const be =
    trades.filter(
      t => t.result === "Break Even"
    );

  const pl =
    trades.reduce(
      (sum, t) =>
        sum + number(t.profitLoss),
      0
    );

  const decided =
    wins.length +
    losses.length;

  const winRate =
    decided
      ? wins.length / decided * 100
      : 0;

  const avgRR =
    total
      ? trades.reduce(
          (sum, t) =>
            sum + number(t.rr),
          0
        ) / total
      : 0;

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

  const pf =
    grossLoss
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  $("analyticsTrades").textContent =
    total;

  $("analyticsWinRate").textContent =
    `${winRate.toFixed(1)}%`;

  $("analyticsRR").textContent =
    avgRR.toFixed(2);

  $("analyticsPL").textContent =
    money(pl);

  $("analyticsWins").textContent =
    wins.length;

  $("analyticsLosses").textContent =
    losses.length;

  $("analyticsBE").textContent =
    be.length;

  const max =
    Math.max(
      wins.length,
      losses.length,
      be.length,
      1
    );

  $("winBar").style.width =
    `${wins.length / max * 100}%`;

  $("lossBar").style.width =
    `${losses.length / max * 100}%`;

  $("beBar").style.width =
    `${be.length / max * 100}%`;

  const avgWin =
    wins.length
      ? wins.reduce(
          (sum, t) =>
            sum + Math.abs(number(t.profitLoss)),
          0
        ) / wins.length
      : 0;

  const avgLoss =
    losses.length
      ? losses.reduce(
          (sum, t) =>
            sum + Math.abs(number(t.profitLoss)),
          0
        ) / losses.length
      : 0;

  const best =
    total
      ? Math.max(
          ...trades.map(
            t => number(t.profitLoss)
          )
        )
      : 0;

  const worst =
    total
      ? Math.min(
          ...trades.map(
            t => number(t.profitLoss)
          )
        )
      : 0;

  $("analyticsAvgWin").textContent =
    money(avgWin);

  $("analyticsAvgLoss").textContent =
    money(-avgLoss);

  $("analyticsBest").textContent =
    money(best);

  $("analyticsWorst").textContent =
    money(worst);

  $("analyticsProfitFactor").textContent =
    pf === Infinity
      ? "∞"
      : pf.toFixed(2);

  $("analyticsAvgR").textContent =
    `${avgRR.toFixed(2)}R`;

}


/* =========================================================
   EQUITY CURVE
   ========================================================= */

function drawEquityCurve() {

  const canvas =
    $("equityCanvas");

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const width =
    Math.max(
      rect.width,
      300
    );

  const height =
    Math.max(
      rect.height,
      200
    );

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;

  const ctx =
    canvas.getContext("2d");

  ctx.scale(
    dpr,
    dpr
  );

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  const sorted =
    [...trades].sort(
      (a,b) => {

        const dateCompare =
          String(a.date || "")
            .localeCompare(
              String(b.date || "")
            );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return String(a.time || "")
          .localeCompare(
            String(b.time || "")
          );

      }
    );

  let balance =
    settings.startingBalance;

  const points =
    [
      balance
    ];

  sorted.forEach(
    trade => {

      balance +=
        number(trade.profitLoss);

      points.push(balance);

    }
  );

  if (points.length === 1) {

    points.push(balance);

  }

  const min =
    Math.min(
      ...points
    );

  const max =
    Math.max(
      ...points
    );

  const range =
    max - min || 1;

  const padX = 15;
  const padY = 25;

  /* Grid */

  ctx.strokeStyle =
    "rgba(255,255,255,0.06)";

  ctx.lineWidth = 1;

  for (
    let i = 0;
    i < 5;
    i++
  ) {

    const y =
      padY +
      i *
      ((height - padY * 2) / 4);

    ctx.beginPath();

    ctx.moveTo(
      padX,
      y
    );

    ctx.lineTo(
      width - padX,
      y
    );

    ctx.stroke();

  }

  /* Line */

  ctx.beginPath();

  points.forEach(
    (value, index) => {

      const x =
        padX +
        index *
        (
          (width - padX * 2) /
          Math.max(
            points.length - 1,
            1
          )
        );

      const y =
        height -
        padY -
        (
          (value - min) /
          range
        ) *
        (
          height -
          padY * 2
        );

      if (index === 0) {
        ctx.moveTo(x,y);
      } else {
        ctx.lineTo(x,y);
      }

    }
  );

  ctx.strokeStyle =
    "#d7b56d";

  ctx.lineWidth = 2;

  ctx.stroke();

  /* Points */

  points.forEach(
    (value, index) => {

      const x =
        padX +
        index *
        (
          (width - padX * 2) /
          Math.max(
            points.length - 1,
            1
          )
        );

      const y =
        height -
        padY -
        (
          (value - min) /
          range
        ) *
        (
          height -
          padY * 2
        );

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        3,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#d7b56d";

      ctx.fill();

    }
  );

}


/* =========================================================
   RISK CALCULATOR
   ========================================================= */

function calculateRiskCalculator() {

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

  let distance = 0;

  let reward = 0;

  if (direction === "Buy") {

    distance =
      entry - sl;

    reward =
      tp - entry;

  } else {

    distance =
      sl - entry;

    reward =
      entry - tp;

  }

  const rr =
    distance > 0 &&
    reward > 0
      ? reward / distance
      : 0;

  const lot =
    distance > 0
      ? riskAmount /
        (
          Math.abs(distance) *
          100
        )
      : 0;

  $("calcRiskAmount").textContent =
    moneyPlain(riskAmount);

  $("calcDistance").textContent =
    distance > 0
      ? distance.toFixed(3)
      : "Invalid";

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "Invalid";

  $("calcLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "Invalid";

}


/* =========================================================
   CALENDAR
   ========================================================= */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();

  const firstDay =
    new Date(
      year,
      month,
      1
    );

  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );

  $("calendarMonthLabel").textContent =
    firstDay.toLocaleDateString(
      undefined,
      {
        month: "long",
        year: "numeric"
      }
    );

  const monthTrades =
    trades.filter(
      trade => {

        if (!trade.date) {
          return false;
        }

        const d =
          new Date(
            `${trade.date}T00:00:00`
          );

        return (
          d.getFullYear() === year &&
          d.getMonth() === month
        );

      }
    );

  const monthPL =
    monthTrades.reduce(
      (sum, trade) =>
        sum + number(trade.profitLoss),
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
    money(monthPL);

  $("calendarMonthPL").className =
    monthPL > 0
      ? "pl-positive"
      : monthPL < 0
        ? "pl-negative"
        : "";

  $("calendarWins").textContent =
    wins;

  $("calendarLosses").textContent =
    losses;

  const grid =
    $("calendarGrid");

  grid.innerHTML = "";

  const weekdays =
    [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ];

  weekdays.forEach(
    day => {

      const el =
        document.createElement("div");

      el.className =
        "calendar-weekday";

      el.textContent =
        day;

      grid.appendChild(el);

    }
  );

  const leading =
    firstDay.getDay();

  for (
    let i = 0;
    i < leading;
    i++
  ) {

    const blank =
      document.createElement("div");

    blank.className =
      "calendar-day";

    grid.appendChild(blank);

  }

  const today =
    todayString();

  for (
    let day = 1;
    day <= lastDay.getDate();
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dayTrades =
      trades.filter(
        t => t.date === dateString
      );

    const pl =
      dayTrades.reduce(
        (sum, t) =>
          sum + number(t.profitLoss),
        0
      );

    const el =
      document.createElement("div");

    el.className =
      "calendar-day";

    if (dateString === today) {
      el.classList.add("today");
    }

    const plClass =
      pl > 0
        ? "calendar-positive"
        : pl < 0
          ? "calendar-negative"
          : "";

    el.innerHTML = `

      <div class="calendar-day-number">
        ${day}
      </div>

      ${
        dayTrades.length
          ? `
            <div class="calendar-day-pl ${plClass}">
              ${money(pl)}
            </div>

            <div class="calendar-day-trades">
              ${dayTrades.length}
              trade${dayTrades.length === 1 ? "" : "s"}
            </div>
          `
          : ""
      }

    `;

    grid.appendChild(el);

  }

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(
      page => {
        page.classList.remove(
          "active-page"
        );
      }
    );

  const target =
    $(pageId);

  if (target) {

    target.classList.add(
      "active-page"
    );

  }

  document
    .querySelectorAll(".nav-item")
    .forEach(
      item => {

        item.classList.toggle(
          "active",
          item.dataset.page === pageId
        );

      }
    );

  closeMobileSidebar();

  if (pageId === "calendarPage") {
    renderCalendar();
  }

}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openMobileSidebar() {

  $("sidebar").classList.add(
    "open"
  );

  $("overlay").classList.add(
    "show"
  );

}

function closeMobileSidebar() {

  $("sidebar").classList.remove(
    "open"
  );

  $("overlay").classList.remove(
    "show"
  );

}


/* =========================================================
   CURRENT DATE
   ========================================================= */

function updateCurrentDate() {

  const now =
    new Date();

  $("currentDate").textContent =
    now.toLocaleDateString(
      undefined,
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );

}


/* =========================================================
   CSV ESCAPE
   ========================================================= */

function csvEscape(value) {

  const text =
    String(
      value ?? ""
    );

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {

    return `"${text.replace(
      /"/g,
      '""'
    )}"`;

  }

  return text;

}


/* =========================================================
   EXPORT CSV
   ========================================================= */

function exportCSV() {

  if (!trades.length) {

    showToast(
      "No trades to export.",
      "error"
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
    );

  const csv =
    [
      headers,
      ...rows
    ]
      .map(
        row =>
          row
            .map(csvEscape)
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
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `ujr-fx-trading-journal-${todayString()}.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  showToast(
    "CSV exported."
  );

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   UPDATE EVERYTHING
   ========================================================= */

function updateEverything() {

  renderJournal();

  updateDashboard();

  updateAnalytics();

  renderCalendar();

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */


/* Google Login */

$("loginBtn").addEventListener(
  "click",
  loginWithGoogle
);


/* Logout */

$("logoutBtn").addEventListener(
  "click",
  logout
);


/* Navigation */

document
  .querySelectorAll(".nav-item")
  .forEach(
    item => {

      item.addEventListener(
        "click",
        () => {

          showPage(
            item.dataset.page
          );

        }
      );

    }
  );


/* Mobile menu */

$("mobileMenuBtn").addEventListener(
  "click",
  openMobileSidebar
);

$("overlay").addEventListener(
  "click",
  closeMobileSidebar
);


/* Add trade */

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


/* Modal */

$("closeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);


/* Trade form */

$("tradeForm").addEventListener(
  "submit",
  saveTrade
);


/* Auto RR */

[
  "entry",
  "sl",
  "tp",
  "direction"
].forEach(
  id => {

    $(id).addEventListener(
      "input",
      () => {

        calculateTradeRR();

        calculateTradeRisk();

      }
    );

    $(id).addEventListener(
      "change",
      () => {

        calculateTradeRR();

        calculateTradeRisk();

      }
    );

  }
);


/* Risk % */

$("riskPercent").addEventListener(
  "input",
  calculateTradeRisk
);


/* Manual lot */

$("lotSize").addEventListener(
  "input",
  () => {

    manualLot = true;

    $("lotSize").dataset.manual =
      "true";

  }
);


/* Result */

$("result").addEventListener(
  "change",
  () => {

    normalizeProfitLossByResult();

  }
);


/* P/L */

$("profitLoss").addEventListener(
  "input",
  handleProfitLossInput
);


/* Filters */

$("filterResult").addEventListener(
  "change",
  renderJournal
);

$("filterPair").addEventListener(
  "input",
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


/* Journal actions */

$("journalTableBody").addEventListener(
  "click",
  (event) => {

    const editButton =
      event.target.closest(
        "[data-edit]"
      );

    const deleteButton =
      event.target.closest(
        "[data-delete]"
      );

    if (editButton) {

      const trade =
        trades.find(
          t =>
            t.id ===
            editButton.dataset.edit
        );

      if (trade) {
        openEditTradeModal(trade);
      }

    }

    if (deleteButton) {

      deleteTrade(
        deleteButton.dataset.delete
      );

    }

  }
);


/* CSV */

$("exportCsvBtn").addEventListener(
  "click",
  exportCSV
);


/* Settings */

$("saveSettingsBtn").addEventListener(
  "click",
  saveSettings
);


/* Risk calculator */

$("calculateRiskBtn").addEventListener(
  "click",
  calculateRiskCalculator
);


/* Calendar */

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

    calendarDate =
      new Date();

    renderCalendar();

  }
);


/* View Journal */

document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-page-target]"
      );

    if (!button) return;

    showPage(
      button.dataset.pageTarget
    );

  }
);


/* Window resize */

window.addEventListener(
  "resize",
  () => {

    drawEquityCurve();

  }
);


/* =========================================================
   START
   ========================================================= */

updateCurrentDate();

setInterval(
  updateCurrentDate,
  60000
);
