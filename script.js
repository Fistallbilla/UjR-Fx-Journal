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
   FIREBASE INIT
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const provider = new GoogleAuthProvider();


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let trades = [];

let account = {
  startingBalance: 0,
  currency: "USD"
};

let unsubscribeTrades = null;

let calendarDate = new Date();

let toastTimer = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);


function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


function money(value) {

  const amount = number(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: account.currency || "USD",
    minimumFractionDigits: 2
  }).format(amount);
}


function moneyClass(value) {

  const n = number(value);

  if (n > 0) return "profit";

  if (n < 0) return "loss";

  return "neutral";
}


function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getLocalDate() {

  const d = new Date();

  const year = d.getFullYear();

  const month = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getLocalTime() {

  const d = new Date();

  const hours = String(d.getHours()).padStart(2, "0");

  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}


function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);
}


/* =========================================================
   LOGIN
========================================================= */

$("loginBtn").addEventListener("click", async () => {

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error(error);

    $("loginError").textContent =
      error.message || "Login failed.";

  }

});


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener("click", async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

    showToast("Logout failed.");

  }

});


/* =========================================================
   USER UI
========================================================= */

function renderUser() {

  if (!currentUser) return;

  $("userName").textContent =
    currentUser.displayName || "Trader";

  $("userEmail").textContent =
    currentUser.email || "";

  if (currentUser.photoURL) {

    $("userPhoto").src = currentUser.photoURL;

  }

}


/* =========================================================
   ACCOUNT
========================================================= */

async function loadAccount() {

  if (!currentUser) return;

  try {

    const ref = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

    const snap = await getDoc(ref);

    if (snap.exists()) {

      account = {
        ...account,
        ...snap.data()
      };

    }

    $("startingBalance").value =
      account.startingBalance || "";

    $("currency").value =
      account.currency || "USD";

    updateDashboard();

  } catch (error) {

    console.error("Account load error:", error);

  }

}


$("saveSettingsBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const startingBalance =
    number($("startingBalance").value);

  const currency =
    $("currency").value || "USD";

  account = {
    startingBalance,
    currency
  };

  try {

    await setDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "settings",
        "account"
      ),
      account
    );

    updateDashboard();

    showToast("Settings saved.");

  } catch (error) {

    console.error(error);

    showToast("Could not save settings.");

  }

});


/* =========================================================
   FIRESTORE TRADE LISTENER
========================================================= */

function startTradeListener() {

  if (!currentUser) return;

  if (unsubscribeTrades) {

    unsubscribeTrades();

    unsubscribeTrades = null;

  }

  const tradesRef = collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );

  const q = query(
    tradesRef,
    orderBy("createdAt", "desc")
  );

  unsubscribeTrades = onSnapshot(
    q,
    (snapshot) => {

      trades = snapshot.docs.map((docSnap) => ({

        id: docSnap.id,

        ...docSnap.data()

      }));

      renderEverything();

    },

    (error) => {

      console.error("Trade listener error:", error);

      /*
       If Firestore says "Missing or insufficient permissions",
       check your Firestore security rules.
      */

      showToast("Could not load trades.");

    }
  );

}


/* =========================================================
   CALCULATE R:R
========================================================= */

function calculateTradeRR() {

  const entry = number($("entry").value);

  const sl = number($("sl").value);

  const tp = number($("tp").value);

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
   AUTO RISK / LOT
========================================================= */

function calculateTradeRisk() {

  const balance =
    number(account.startingBalance);

  const riskPercent =
    number($("riskPercent").value);

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);


  const riskAmount =
    balance * riskPercent / 100;


  $("riskAmount").value =
    riskAmount > 0
      ? riskAmount.toFixed(2)
      : "";


  if (entry <= 0 || sl <= 0 || riskAmount <= 0) {

    return;

  }


  const distance =
    Math.abs(entry - sl);


  /*
    Simplified XAUUSD assumption:

    1 lot = 100 oz.

    Exact lot sizing depends on broker
    contract size / tick value.
  */

  const lot =
    riskAmount / (distance * 100);


  if (
    !$("lotSize").dataset.manual ||
    $("lotSize").dataset.manual !== "true"
  ) {

    $("lotSize").value =
      Math.max(0, lot).toFixed(2);

  }

}


/* =========================================================
   TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

  if (trade) {

    $("modalTitle").textContent = "Edit Trade";

    fillTradeForm(trade);

  } else {

    $("modalTitle").textContent = "Add Trade";

    resetTradeForm();

  }

}


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  $("tradeForm").reset();

  $("tradeId").value = "";

  $("lotSize").dataset.manual = "false";

}


function resetTradeForm() {

  $("tradeForm").reset();

  $("tradeId").value = "";

  $("tradeDate").value = getLocalDate();

  $("tradeTime").value = getLocalTime();

  $("pair").value = "XAUUSD";

  $("direction").value = "Buy";

  $("riskPercent").value = "1";

  $("result").value = "Win";

  $("lotSize").value = "";

  $("lotSize").dataset.manual = "false";

  $("rr").value = "";

  $("riskAmount").value = "";

}


function fillTradeForm(trade) {

  $("tradeId").value = trade.id || "";

  $("tradeDate").value = trade.date || "";

  $("tradeTime").value = trade.time || "";

  $("pair").value = trade.pair || "XAUUSD";

  $("direction").value = trade.direction || "Buy";

  $("entry").value = trade.entry ?? "";

  $("sl").value = trade.sl ?? "";

  $("tp").value = trade.tp ?? "";

  $("rr").value = trade.rr || "";

  $("riskPercent").value = trade.riskPercent ?? 1;

  $("riskAmount").value = trade.riskAmount ?? "";

  $("lotSize").value = trade.lotSize ?? "";

  $("lotSize").dataset.manual = "true";

  $("setup").value = trade.setup || "";

  $("session").value = trade.session || "";

  $("htfBias").value = trade.htfBias || "";

  $("liquidity").value = trade.liquidity || "";

  $("confirmation").value = trade.confirmation || "";

  $("result").value = trade.result || "Win";

  $("profitLoss").value = trade.profitLoss ?? "";

  $("confidence").value = trade.confidence || "";

  $("psychology").value = trade.psychology || "";

  $("mistake").value = trade.mistake || "";

  $("notes").value = trade.notes || "";

}


$("closeModal").addEventListener(
  "click",
  closeTradeModal
);


$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);


$("tradeModal").addEventListener("click", (event) => {

  if (event.target === $("tradeModal")) {

    closeTradeModal();

  }

});


/* =========================================================
   TRADE FORM EVENTS
========================================================= */

[
  "entry",
  "sl",
  "tp",
  "direction"
].forEach((id) => {

  $(id).addEventListener("input", () => {

    calculateTradeRR();

    calculateTradeRisk();

  });

  $(id).addEventListener("change", () => {

    calculateTradeRR();

    calculateTradeRisk();

  });

});


$("riskPercent").addEventListener(
  "input",
  calculateTradeRisk
);


$("lotSize").addEventListener("input", () => {

  $("lotSize").dataset.manual = "true";

});


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!currentUser) {

    $("tradeError").textContent =
      "Please login first.";

    return;

  }


  $("tradeError").textContent = "";


  const id = $("tradeId").value;


  const entry = number($("entry").value);

  const sl = number($("sl").value);

  const tp = number($("tp").value);


  if (entry <= 0 || sl <= 0 || tp <= 0) {

    $("tradeError").textContent =
      "Enter valid Entry, SL and TP.";

    return;

  }


  const rrValue =
    calculateTradeRR();


  if (rrValue <= 0) {

    $("tradeError").textContent =
      "Invalid trade direction or SL/TP.";

    return;

  }


  const riskPercent =
    number($("riskPercent").value);


  const riskAmount =
    number($("riskAmount").value);


  const lotSize =
    number($("lotSize").value);


  const profitLoss =
    number($("profitLoss").value);


  const trade = {

    date: $("tradeDate").value,

    time: $("tradeTime").value,

    pair: $("pair").value.trim().toUpperCase(),

    direction: $("direction").value,

    entry,

    sl,

    tp,

    rr: rrValue,

    riskPercent,

    riskAmount,

    lotSize,

    setup: $("setup").value.trim(),

    session: $("session").value,

    htfBias: $("htfBias").value,

    liquidity: $("liquidity").value.trim(),

    confirmation: $("confirmation").value.trim(),

    result: $("result").value,

    profitLoss,

    confidence: $("confidence").value,

    psychology: $("psychology").value.trim(),

    mistake: $("mistake").value.trim(),

    notes: $("notes").value.trim(),

    updatedAt: Date.now()

  };


  try {

    if (id) {

      await updateDoc(

        doc(
          db,
          "users",
          currentUser.uid,
          "trades",
          id
        ),

        trade

      );

      showToast("Trade updated.");

    } else {

      trade.createdAt = Date.now();

      await addDoc(

        collection(
          db,
          "users",
          currentUser.uid,
          "trades"
        ),

        trade

      );

      showToast("Trade added.");

    }


    closeTradeModal();

  } catch (error) {

    console.error(error);

    $("tradeError").textContent =
      error.message || "Could not save trade.";

  }

});


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

  if (!currentUser || !id) return;

  const confirmed =
    confirm("Delete this trade?");

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
   STATS
========================================================= */

function getStats(list = trades) {

  const wins =
    list.filter(t => t.result === "Win").length;

  const losses =
    list.filter(t => t.result === "Loss").length;

  const be =
    list.filter(t => t.result === "BE").length;

  const pl =
    list.reduce(
      (sum, t) => sum + number(t.profitLoss),
      0
    );

  const closed =
    wins + losses;

  const winRate =
    closed > 0
      ? wins / closed * 100
      : 0;

  const rrValues =
    list
      .map(t => number(t.rr))
      .filter(n => n > 0);

  const avgRR =
    rrValues.length
      ? rrValues.reduce((a,b) => a+b,0) / rrValues.length
      : 0;

  return {
    wins,
    losses,
    be,
    pl,
    winRate,
    avgRR
  };

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {

  const stats = getStats();

  $("totalTrades").textContent =
    trades.length;

  $("winRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("totalPL").textContent =
    money(stats.pl);

  $("totalPL").className =
    moneyClass(stats.pl);


  const balance =
    number(account.startingBalance) +
    stats.pl;

  $("currentBalance").textContent =
    money(balance);


  renderRecentTrades();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const body =
    $("recentTradesBody");

  const recent =
    [...trades]
      .sort((a,b) =>
        number(b.createdAt) -
        number(a.createdAt)
      )
      .slice(0, 8);


  body.innerHTML = "";


  if (!recent.length) {

    $("recentEmpty").classList.remove("hidden");

    return;

  }


  $("recentEmpty").classList.add("hidden");


  recent.forEach((trade) => {

    const pl =
      number(trade.profitLoss);


    const tr =
      document.createElement("tr");


    tr.innerHTML = `

      <td>${escapeHTML(trade.date || "-")}</td>

      <td>${escapeHTML(trade.pair || "-")}</td>

      <td class="${
        trade.direction === "Buy"
          ? "buy"
          : "sell"
      }">
        ${escapeHTML(trade.direction || "-")}
      </td>

      <td>${escapeHTML(trade.entry ?? "-")}</td>

      <td>1:${number(trade.rr).toFixed(2)}</td>

      <td class="${
        trade.result === "Win"
          ? "profit"
          : trade.result === "Loss"
          ? "loss"
          : "neutral"
      }">
        ${escapeHTML(trade.result || "-")}
      </td>

      <td class="${moneyClass(pl)}">
        ${money(pl)}
      </td>

    `;

    body.appendChild(tr);

  });

}


/* =========================================================
   JOURNAL
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


  return trades.filter((trade) => {

    if (
      result !== "All" &&
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

  const list =
    getFilteredTrades();


  const stats =
    getStats(list);


  $("journalTrades").textContent =
    list.length;

  $("journalWins").textContent =
    stats.wins;

  $("journalLosses").textContent =
    stats.losses;

  $("journalPL").textContent =
    money(stats.pl);

  $("journalPL").className =
    moneyClass(stats.pl);


  const body =
    $("journalTableBody");

  body.innerHTML = "";


  $("journalEmpty").classList.toggle(
    "hidden",
    list.length > 0
  );


  list.forEach((trade) => {

    const pl =
      number(trade.profitLoss);


    const tr =
      document.createElement("tr");


    tr.innerHTML = `

      <td>${escapeHTML(trade.date || "-")}</td>

      <td>${escapeHTML(trade.time || "-")}</td>

      <td>${escapeHTML(trade.pair || "-")}</td>

      <td class="${
        trade.direction === "Buy"
          ? "buy"
          : "sell"
      }">
        ${escapeHTML(trade.direction || "-")}
      </td>

      <td>${escapeHTML(trade.entry ?? "-")}</td>

      <td>${escapeHTML(trade.sl ?? "-")}</td>

      <td>${escapeHTML(trade.tp ?? "-")}</td>

      <td>1:${number(trade.rr).toFixed(2)}</td>

      <td>${number(trade.lotSize).toFixed(2)}</td>

      <td class="${
        trade.result === "Win"
          ? "profit"
          : trade.result === "Loss"
          ? "loss"
          : "neutral"
      }">
        ${escapeHTML(trade.result || "-")}
      </td>

      <td class="${moneyClass(pl)}">
        ${money(pl)}
      </td>

      <td>

        <button
          class="action-btn"
          data-edit="${trade.id}"
        >
          Edit
        </button>

        <button
          class="action-btn delete-btn"
          data-delete="${trade.id}"
        >
          Delete
        </button>

      </td>

    `;


    body.appendChild(tr);

  });

}


/* =========================================================
   JOURNAL ACTIONS
========================================================= */

$("journalTableBody").addEventListener(
  "click",
  (event) => {

    const editBtn =
      event.target.closest("[data-edit]");

    const deleteBtn =
      event.target.closest("[data-delete]");


    if (editBtn) {

      const trade =
        trades.find(
          t => t.id === editBtn.dataset.edit
        );

      if (trade) {

        openTradeModal(trade);

      }

    }


    if (deleteBtn) {

      deleteTrade(
        deleteBtn.dataset.delete
      );

    }

  }
);


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const stats =
    getStats();


  $("analyticsTrades").textContent =
    trades.length;

  $("analyticsWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("analyticsRR").textContent =
    stats.avgRR.toFixed(2);

  $("analyticsPL").textContent =
    money(stats.pl);

  $("analyticsPL").className =
    moneyClass(stats.pl);


  $("analyticsWins").textContent =
    stats.wins;

  $("analyticsLosses").textContent =
    stats.losses;

  $("analyticsBE").textContent =
    stats.be;


  const total =
    trades.length || 1;


  $("winBar").style.width =
    `${stats.wins / total * 100}%`;

  $("lossBar").style.width =
    `${stats.losses / total * 100}%`;

  $("beBar").style.width =
    `${stats.be / total * 100}%`;


  const winningPL =
    trades
      .map(t => number(t.profitLoss))
      .filter(n => n > 0);


  const losingPL =
    trades
      .map(t => number(t.profitLoss))
      .filter(n => n < 0);


  const averageWin =
    winningPL.length
      ? winningPL.reduce((a,b) => a+b,0)
        / winningPL.length
      : 0;


  const averageLoss =
    losingPL.length
      ? losingPL.reduce((a,b) => a+b,0)
        / losingPL.length
      : 0;


  const best =
    trades.length
      ? Math.max(
          ...trades.map(t => number(t.profitLoss))
        )
      : 0;


  const worst =
    trades.length
      ? Math.min(
          ...trades.map(t => number(t.profitLoss))
        )
      : 0;


  $("avgWin").textContent =
    money(averageWin);

  $("avgLoss").textContent =
    money(averageLoss);

  $("bestTrade").textContent =
    money(best);

  $("worstTrade").textContent =
    money(worst);


  $("avgWin").className =
    moneyClass(averageWin);

  $("avgLoss").className =
    moneyClass(averageLoss);

  $("bestTrade").className =
    moneyClass(best);

  $("worstTrade").className =
    moneyClass(worst);

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
    balance * riskPercent / 100;


  $("calcRiskAmount").textContent =
    money(riskAmount);


  if (entry <= 0 || sl <= 0) {

    $("calcDistance").textContent = "0";

    $("calcLot").textContent = "0.00";

    $("calcRR").textContent = "0:0";

    return;

  }


  const distance =
    Math.abs(entry - sl);


  $("calcDistance").textContent =
    distance.toFixed(3);


  const lot =
    riskAmount /
    (distance * 100);


  $("calcLot").textContent =
    Math.max(0, lot).toFixed(2);


  if (tp > 0) {

    let risk;
    let reward;


    if (direction === "Buy") {

      risk = entry - sl;

      reward = tp - entry;

    } else {

      risk = sl - entry;

      reward = entry - tp;

    }


    if (risk > 0 && reward > 0) {

      $("calcRR").textContent =
        `1:${(reward / risk).toFixed(2)}`;

    } else {

      $("calcRR").textContent =
        "Invalid";

    }

  }

}


$("calculateRiskBtn").addEventListener(
  "click",
  calculateRiskCalculator
);


/* =========================================================
   CALENDAR
========================================================= */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  const monthName =
    calendarDate.toLocaleString(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    );


  $("calendarMonthLabel").textContent =
    monthName;


  const firstDay =
    new Date(year, month, 1).getDay();


  const daysInMonth =
    new Date(year, month + 1, 0).getDate();


  const grid =
    $("calendarGrid");


  grid.innerHTML = "";


  for (let i = 0; i < firstDay; i++) {

    const empty =
      document.createElement("div");

    empty.className =
      "calendar-day empty";

    grid.appendChild(empty);

  }


  let monthPL = 0;

  let wins = 0;

  let losses = 0;


  for (let day = 1; day <= daysInMonth; day++) {

    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";


    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dayTrades =
      trades.filter(
        t => t.date === dateString
      );


    const dayPL =
      dayTrades.reduce(
        (sum, t) =>
          sum + number(t.profitLoss),
        0
      );


    monthPL += dayPL;


    wins +=
      dayTrades.filter(
        t => t.result === "Win"
      ).length;


    losses +=
      dayTrades.filter(
        t => t.result === "Loss"
      ).length;


    if (
      dateString === getLocalDate()
    ) {

      cell.classList.add("today");

    }


    let plText = "";


    if (dayTrades.length === 0) {

      plText = "No trade";

    } else {

      plText = money(dayPL);

    }


    cell.innerHTML = `

      <div class="day-number">
        ${day}
      </div>

      <div class="day-pl ${moneyClass(dayPL)}">
        ${escapeHTML(plText)}
      </div>

    `;


    grid.appendChild(cell);

  }


  $("calendarMonthPL").textContent =
    money(monthPL);

  $("calendarMonthPL").className =
    moneyClass(monthPL);

  $("calendarWins").textContent =
    wins;

  $("calendarLosses").textContent =
    losses;

}


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


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove(
        "active-page"
      );

    });


  const page =
    $(pageId);


  if (page) {

    page.classList.add(
      "active-page"
    );

  }


  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === pageId
      );

    });


  closeMobileMenu();

}


document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

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


$("mobileMenuBtn").addEventListener(
  "click",
  openMobileMenu
);


$("overlay").addEventListener(
  "click",
  closeMobileMenu
);


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
   FILTER EVENTS
========================================================= */

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

    $("filterResult").value = "All";

    $("filterPair").value = "";

    $("filterDate").value = "";

    renderJournal();

  }
);


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderEverything() {

  updateDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

}


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    currentUser = user;


    if (user) {

      $("loginScreen").classList.add("hidden");

      $("app").classList.remove("hidden");

      renderUser();

      await loadAccount();

      startTradeListener();

      renderEverything();

    } else {

      $("loginScreen").classList.remove("hidden");

      $("app").classList.add("hidden");

      trades = [];

      if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;

      }

    }

  }
);


/* =========================================================
   KEYBOARD SHORTCUT
   Press N to add trade.
========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key.toLowerCase() === "n" &&
      $("tradeModal").classList.contains("hidden") &&
      document.activeElement?.tagName !== "INPUT" &&
      document.activeElement?.tagName !== "TEXTAREA" &&
      document.activeElement?.tagName !== "SELECT"
    ) {

      openTradeModal();

    }

  }
);


/* =========================================================
   INITIAL RENDER
========================================================= */

renderCalendar();
