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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
  authDomain: "journal-38e0e.firebaseapp.com",
  projectId: "journal-38e0e",
  storageBucket: "journal-38e0e.firebasestorage.app",
  messagingSenderId: "382226906837",
  appId: "1:382226906837:web:38df881c0f7beb24256c5c",
  measurementId: "G-R6LXDMQ9K2"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();


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

function $(id) {
  return document.getElementById(id);
}


function number(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}


function money(value) {

  const amount = number(value);

  const currency = account.currency || "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}


function moneyWithSign(value) {

  const amount = number(value);

  if (amount > 0) {
    return "+" + money(amount);
  }

  return money(amount);
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


function sortTrades() {

  trades.sort((a, b) => {

    const dateA = `${a.date || ""} ${a.time || ""}`;
    const dateB = `${b.date || ""} ${b.time || ""}`;

    return dateB.localeCompare(dateA);
  });
}


/* =========================================================
   AUTH
========================================================= */

$("googleLoginBtn").addEventListener("click", async () => {

  try {

    await signInWithPopup(auth, googleProvider);

  } catch (error) {

    console.error(error);

    showToast("Google login failed.");

  }

});


$("logoutBtn").addEventListener("click", async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

    showToast("Logout failed.");

  }

});


onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;

    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    loadUserUI();

    await loadAccount();

    subscribeTrades();

  } else {

    currentUser = null;

    trades = [];

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

  }

});


/* =========================================================
   USER UI
========================================================= */

function loadUserUI() {

  if (!currentUser) return;

  const name = currentUser.displayName || "Trader";
  const email = currentUser.email || "";

  $("userName").textContent = name;
  $("userEmail").textContent = email;

  $("dashboardUserName").textContent = name.split(" ")[0];

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;

  const firstLetter = name.charAt(0).toUpperCase();

  $("userAvatar").textContent = firstLetter;
  $("settingsAvatar").textContent = firstLetter;
}


/* =========================================================
   FIRESTORE ACCOUNT
========================================================= */

async function loadAccount() {

  if (!currentUser) return;

  try {

    const accountRef = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

    const snapshot = await getDoc(accountRef);

    if (snapshot.exists()) {

      account = {
        startingBalance: number(snapshot.data().startingBalance),
        currency: snapshot.data().currency || "USD"
      };

    } else {

      account = {
        startingBalance: 0,
        currency: "USD"
      };

    }

    $("startingBalance").value =
      account.startingBalance || "";

    $("currency").value =
      account.currency || "USD";

  } catch (error) {

    console.error(error);

    showToast("Could not load account settings.");

  }

}


$("saveSettingsBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const startingBalance = number(
    $("startingBalance").value
  );

  const currency = $("currency").value;

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
      account,
      { merge: true }
    );

    calculateTradeRisk();
    updateDashboard();
    renderJournal();
    renderCalendar();

    showToast("Settings saved.");

  } catch (error) {

    console.error(error);

    showToast("Could not save settings.");

  }

});


/* =========================================================
   TRADES SUBSCRIPTION
========================================================= */

function subscribeTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
  }

  const tradesRef = collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );

  unsubscribeTrades = onSnapshot(
    tradesRef,
    (snapshot) => {

      trades = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...docItem.data()
      }));

      sortTrades();

      updateDashboard();
      renderJournal();
      renderAnalytics();
      renderCalendar();
      calculateRiskPage();

    },
    (error) => {

      console.error(error);

      showToast("Could not load trades.");

    }
  );
}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

const pageNames = {

  dashboardPage: [
    "Dashboard",
    "Your trading performance at a glance"
  ],

  journalPage: [
    "Trading Journal",
    "Record and review every trade"
  ],

  analyticsPage: [
    "Analytics",
    "Understand your trading performance"
  ],

  riskPage: [
    "Risk Calculator",
    "Calculate risk before entering a trade"
  ],

  calendarPage: [
    "Trading Calendar",
    "See your daily trading results"
  ],

  settingsPage: [
    "Settings",
    "Manage your journal settings"
  ]

};


function showPage(pageId) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const target = $(pageId);

  if (target) {
    target.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(item => {

    item.classList.toggle(
      "active",
      item.dataset.page === pageId
    );

  });

  const details = pageNames[pageId] || [];

  $("pageTitle").textContent = details[0] || "";
  $("pageSubtitle").textContent = details[1] || "";

  if (pageId === "calendarPage") {
    renderCalendar();
  }

  if (pageId === "analyticsPage") {
    renderAnalytics();
  }

  if (pageId === "riskPage") {
    calculateRiskPage();
  }

}


document.querySelectorAll(".nav-item").forEach(item => {

  item.addEventListener("click", () => {

    showPage(item.dataset.page);

  });

});


document.querySelectorAll("[data-page-link]").forEach(item => {

  item.addEventListener("click", () => {

    showPage(item.dataset.pageLink);

  });

});


/* =========================================================
   TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

  $("tradeModal").classList.remove("hidden");

  if (trade) {

    $("modalTitle").textContent = "Edit Trade";

    $("tradeId").value = trade.id;

    $("tradeDate").value = trade.date || "";
    $("tradeTime").value = trade.time || "";

    $("pair").value = trade.pair || "XAUUSD";
    $("direction").value = trade.direction || "Buy";

    $("entry").value = trade.entry ?? "";
    $("sl").value = trade.sl ?? "";
    $("tp").value = trade.tp ?? "";

    $("riskPercent").value = trade.riskPercent ?? 1;

    $("setup").value = trade.setup || "Liquidity";
    $("session").value = trade.session || "London";

    $("htfBias").value = trade.htfBias || "Neutral";
    $("liquidity").value = trade.liquidity || "None";
    $("confirmation").value = trade.confirmation || "None";

    $("result").value = trade.result || "Win";

    $("profitLoss").value = trade.profitLoss ?? "";

    $("psychology").value = trade.psychology || "Calm";
    $("confidence").value = trade.confidence || "5";

    $("mistake").value = trade.mistake || "";
    $("notes").value = trade.notes || "";

  } else {

    $("modalTitle").textContent = "Add Trade";

    $("tradeForm").reset();

    $("tradeId").value = "";

    $("tradeDate").value = getLocalDate();
    $("tradeTime").value = getLocalTime();

    $("pair").value = "XAUUSD";

    $("direction").value = "Buy";

    $("riskPercent").value = 1;

    $("setup").value = "Liquidity";
    $("session").value = "London";

    $("htfBias").value = "Neutral";
    $("liquidity").value = "None";
    $("confirmation").value = "None";

    $("result").value = "Win";

    $("psychology").value = "Calm";
    $("confidence").value = "5";

  }

  updateTradeCalculations();
}


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

}


$("quickAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);


$("journalAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);


$("closeModalBtn").addEventListener(
  "click",
  closeTradeModal
);


$("cancelTradeBtn").addEventListener(
  "click",
  closeTradeModal
);


$("modalOverlay").addEventListener(
  "click",
  closeTradeModal
);


/* =========================================================
   TRADE CALCULATIONS
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

  $("rr").value = `1:${rr.toFixed(2)}`;

  return rr;
}


function calculateTradeRisk() {

  const balance = number(
    account.startingBalance
  );

  const riskPercent = number(
    $("riskPercent").value
  );

  const entry = number(
    $("entry").value
  );

  const sl = number(
    $("sl").value
  );


  if (
    balance <= 0 ||
    riskPercent <= 0
  ) {

    $("riskAmount").value = "";
    $("lotSize").value = "";

    return;
  }


  const riskAmount =
    balance * riskPercent / 100;


  $("riskAmount").value =
    money(riskAmount);


  const distance =
    Math.abs(entry - sl);


  const contractSize = 100;


  if (distance > 0) {

    const lot =
      riskAmount /
      (distance * contractSize);

    $("lotSize").value =
      lot.toFixed(2);

  } else {

    $("lotSize").value = "";

  }

}


function updateTradeCalculations() {

  calculateTradeRR();
  calculateTradeRisk();

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
    updateTradeCalculations
  );

  $(id).addEventListener(
    "change",
    updateTradeCalculations
  );

});


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (!currentUser) return;


    const rr = calculateTradeRR();

    if (!rr || $("rr").value === "Invalid") {

      showToast(
        "Please check Entry, SL and TP."
      );

      return;
    }


    const tradeId =
      $("tradeId").value.trim();


    const tradeData = {

      date: $("tradeDate").value,
      time: $("tradeTime").value,

      pair: $("pair").value.trim().toUpperCase(),

      direction: $("direction").value,

      entry: number($("entry").value),
      sl: number($("sl").value),
      tp: number($("tp").value),

      rr,

      riskPercent:
        number($("riskPercent").value),

      riskAmount:
        number(
          $("riskAmount").value.replace(/[^\d.-]/g, "")
        ),

      lotSize:
        number($("lotSize").value),

      setup: $("setup").value,
      session: $("session").value,

      htfBias: $("htfBias").value,
      liquidity: $("liquidity").value,
      confirmation: $("confirmation").value,

      result: $("result").value,

      profitLoss:
        number($("profitLoss").value),

      psychology: $("psychology").value,

      confidence:
        number($("confidence").value),

      mistake:
        $("mistake").value.trim(),

      notes:
        $("notes").value.trim(),

      updatedAt:
        new Date().toISOString()

    };


    try {

      const tradesRef = collection(
        db,
        "users",
        currentUser.uid,
        "trades"
      );


      if (tradeId) {

        await updateDoc(
          doc(
            db,
            "users",
            currentUser.uid,
            "trades",
            tradeId
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

      console.error(error);

      showToast(
        "Could not save trade."
      );

    }

  }
);


/* =========================================================
   DASHBOARD
========================================================= */

function getStats() {

  const total = trades.length;

  const wins =
    trades.filter(t => t.result === "Win");

  const losses =
    trades.filter(t => t.result === "Loss");


  const totalPL =
    trades.reduce(
      (sum, trade) =>
        sum + number(trade.profitLoss),
      0
    );


  const winRate =
    total > 0
      ? wins.length / total * 100
      : 0;


  const grossProfit =
    wins.reduce(
      (sum, trade) =>
        sum + Math.max(number(trade.profitLoss), 0),
      0
    );


  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, trade) =>
          sum + Math.min(number(trade.profitLoss), 0),
        0
      )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const rrValues =
    trades
      .map(t => number(t.rr))
      .filter(v => v > 0);


  const averageRR =
    rrValues.length > 0
      ? rrValues.reduce((a,b) => a+b, 0) /
        rrValues.length
      : 0;


  const averageWin =
    wins.length > 0
      ? wins.reduce(
          (sum,t) =>
            sum + Math.max(number(t.profitLoss),0),
          0
        ) / wins.length
      : 0;


  const averageLoss =
    losses.length > 0
      ? losses.reduce(
          (sum,t) =>
            sum + Math.min(number(t.profitLoss),0),
          0
        ) / losses.length
      : 0;


  let balance =
    number(account.startingBalance);

  let peak = balance;
  let maxDrawdown = 0;


  const ordered =
    [...trades].sort((a,b) => {

      const aKey =
        `${a.date || ""} ${a.time || ""}`;

      const bKey =
        `${b.date || ""} ${b.time || ""}`;

      return aKey.localeCompare(bKey);

    });


  ordered.forEach(trade => {

    balance += number(trade.profitLoss);

    peak = Math.max(peak, balance);

    const drawdown =
      peak - balance;

    maxDrawdown =
      Math.max(maxDrawdown, drawdown);

  });


  return {
    total,
    wins: wins.length,
    losses: losses.length,
    totalPL,
    winRate,
    grossProfit,
    grossLoss,
    profitFactor,
    averageRR,
    averageWin,
    averageLoss,
    maxDrawdown
  };

}


function updateDashboard() {

  const stats = getStats();


  const currentBalance =
    number(account.startingBalance) +
    stats.totalPL;


  $("dashBalance").textContent =
    money(currentBalance);


  $("dashPL").textContent =
    moneyWithSign(stats.totalPL);


  $("dashPL").className =
    "stat-value " +
    (
      stats.totalPL > 0
        ? "positive"
        : stats.totalPL < 0
          ? "negative"
          : ""
    );


  $("dashWinRate").textContent =
    stats.winRate.toFixed(1) + "%";


  $("dashTrades").textContent =
    stats.total;


  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";


  $("dashAverageRR").textContent =
    stats.averageRR > 0
      ? "1:" + stats.averageRR.toFixed(2)
      : "0.00";


  $("dashAverageWin").textContent =
    moneyWithSign(stats.averageWin);


  $("dashAverageLoss").textContent =
    money(stats.averageLoss);


  $("dashDrawdown").textContent =
    money(stats.maxDrawdown);


  renderRecentTrades();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const container =
    $("recentTrades");

  const recent =
    trades.slice(0, 5);


  if (!recent.length) {

    container.innerHTML =
      `<div class="empty-small">
        No trades yet.
      </div>`;

    return;
  }


  container.innerHTML =
    recent.map(trade => {

      const pl =
        number(trade.profitLoss);

      const resultClass =
        trade.result === "Win"
          ? "positive"
          : trade.result === "Loss"
            ? "negative"
            : "neutral";


      return `
        <div class="recent-item">

          <div class="recent-left">

            <strong>
              ${escapeHTML(trade.pair || "XAUUSD")}
              ·
              ${escapeHTML(trade.direction || "")}
            </strong>

            <span>
              ${escapeHTML(trade.date || "")}
              ${escapeHTML(trade.time || "")}
            </span>

          </div>

          <div class="recent-right">

            <strong class="${resultClass}">
              ${moneyWithSign(pl)}
            </strong>

            <span class="${resultClass}">
              ${escapeHTML(trade.result || "")}
            </span>

          </div>

        </div>
      `;

    }).join("");

}


/* =========================================================
   JOURNAL
========================================================= */

$("tradeSearch").addEventListener(
  "input",
  renderJournal
);


$("resultFilter").addEventListener(
  "change",
  renderJournal
);


function renderJournal() {

  const search =
    $("tradeSearch").value
      .trim()
      .toLowerCase();


  const filter =
    $("resultFilter").value;


  const filtered =
    trades.filter(trade => {

      const searchable = [

        trade.pair,
        trade.setup,
        trade.session,
        trade.direction,
        trade.psychology,
        trade.liquidity,
        trade.confirmation,
        trade.notes

      ]
      .join(" ")
      .toLowerCase();


      const searchMatch =
        !search ||
        searchable.includes(search);


      const resultMatch =
        filter === "All" ||
        trade.result === filter;


      return searchMatch && resultMatch;

    });


  const wins =
    trades.filter(
      t => t.result === "Win"
    ).length;


  const losses =
    trades.filter(
      t => t.result === "Loss"
    ).length;


  const totalPL =
    trades.reduce(
      (sum,t) =>
        sum + number(t.profitLoss),
      0
    );


  $("journalTotal").textContent =
    trades.length;

  $("journalWins").textContent =
    wins;

  $("journalLosses").textContent =
    losses;

  $("journalPL").textContent =
    moneyWithSign(totalPL);


  $("journalPL").className =
    totalPL > 0
      ? "positive"
      : totalPL < 0
        ? "negative"
        : "neutral";


  const body =
    $("journalBody");


  if (!filtered.length) {

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
    filtered.map(trade => {

      const pl =
        number(trade.profitLoss);


      let resultClass =
        "result-be";


      if (trade.result === "Win") {
        resultClass = "result-win";
      }

      if (trade.result === "Loss") {
        resultClass = "result-loss";
      }


      const plClass =
        pl > 0
          ? "positive"
          : pl < 0
            ? "negative"
            : "neutral";


      return `
        <tr>

          <td>
            ${escapeHTML(trade.date || "")}
          </td>

          <td>
            <strong>
              ${escapeHTML(trade.pair || "")}
            </strong>
          </td>

          <td>
            ${escapeHTML(trade.direction || "")}
          </td>

          <td>
            ${number(trade.entry).toFixed(3)}
          </td>

          <td>
            ${number(trade.sl).toFixed(3)}
          </td>

          <td>
            ${number(trade.tp).toFixed(3)}
          </td>

          <td>
            1:${number(trade.rr).toFixed(2)}
          </td>

          <td>
            <span class="result-badge ${resultClass}">
              ${escapeHTML(trade.result || "BE")}
            </span>
          </td>

          <td class="${plClass}">
            <strong>
              ${moneyWithSign(pl)}
            </strong>
          </td>

          <td>

            <button
              class="action-btn"
              data-action="edit"
              data-id="${escapeHTML(trade.id)}"
            >
              Edit
            </button>

            <button
              class="action-btn delete-btn"
              data-action="delete"
              data-id="${escapeHTML(trade.id)}"
            >
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


$("journalBody").addEventListener(
  "click",
  async (event) => {

    const button =
      event.target.closest("button[data-action]");

    if (!button) return;

    const id =
      button.dataset.id;

    const action =
      button.dataset.action;


    const trade =
      trades.find(t => t.id === id);


    if (!trade) return;


    if (action === "edit") {

      openTradeModal(trade);

    }


    if (action === "delete") {

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

        showToast("Trade deleted.");

      } catch (error) {

        console.error(error);

        showToast(
          "Could not delete trade."
        );

      }

    }

  }
);


/* =========================================================
   ANALYTICS
========================================================= */

function groupAnalytics(list, field) {

  const groups = {};


  list.forEach(trade => {

    const key =
      trade[field] ||
      "Not specified";


    if (!groups[key]) {

      groups[key] = {
        trades: 0,
        wins: 0,
        pl: 0
      };

    }


    groups[key].trades++;

    if (trade.result === "Win") {
      groups[key].wins++;
    }

    groups[key].pl +=
      number(trade.profitLoss);

  });


  return groups;
}


function renderAnalyticsGroup(
  elementId,
  field
) {

  const container =
    $(elementId);

  const groups =
    groupAnalytics(trades, field);


  const keys =
    Object.keys(groups);


  if (!keys.length) {

    container.innerHTML =
      `<div class="empty-small">
        No data yet.
      </div>`;

    return;

  }


  container.innerHTML =
    keys.map(key => {

      const item =
        groups[key];

      const winRate =
        item.trades > 0
          ? item.wins / item.trades * 100
          : 0;


      const plClass =
        item.pl > 0
          ? "positive"
          : item.pl < 0
            ? "negative"
            : "neutral";


      return `
        <div class="analytics-row">

          <span>
            ${escapeHTML(key)}
            · ${item.trades} trades
            · ${winRate.toFixed(0)}%
          </span>

          <strong class="${plClass}">
            ${moneyWithSign(item.pl)}
          </strong>

        </div>
      `;

    }).join("");

}


function renderAnalytics() {

  renderAnalyticsGroup(
    "setupAnalytics",
    "setup"
  );

  renderAnalyticsGroup(
    "directionAnalytics",
    "direction"
  );

  renderAnalyticsGroup(
    "sessionAnalytics",
    "session"
  );

  renderAnalyticsGroup(
    "psychologyAnalytics",
    "psychology"
  );

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

[
  "calcBalance",
  "calcRisk",
  "calcEntry",
  "calcSL",
  "calcTP",
  "calcContract"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateRiskPage
  );

});


function calculateRiskPage() {

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


  const contract =
    number($("calcContract").value) || 100;


  const riskAmount =
    balance * riskPercent / 100;


  const distance =
    Math.abs(entry - sl);


  const reward =
    Math.abs(tp - entry);


  const rr =
    distance > 0
      ? reward / distance
      : 0;


  const lot =
    distance > 0
      ? riskAmount /
        (distance * contract)
      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);


  $("calcDistance").textContent =
    distance.toFixed(3);


  $("calcReward").textContent =
    reward.toFixed(3);


  $("calcRR").textContent =
    rr > 0
      ? "1:" + rr.toFixed(2)
      : "1:0.00";


  $("calcLot").textContent =
    lot.toFixed(2);

}


/* =========================================================
   CALENDAR
========================================================= */

function formatMonthYear(date) {

  return date.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric"
    }
  );

}


function dateKey(year, month, day) {

  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");

}


function getCalendarData() {

  const data = {};


  trades.forEach(trade => {

    if (!trade.date) return;


    if (!data[trade.date]) {

      data[trade.date] = {
        pl: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        be: 0
      };

    }


    const item =
      data[trade.date];


    const pl =
      number(trade.profitLoss);


    item.pl += pl;

    item.trades++;


    if (trade.result === "Win") {
      item.wins++;
    } else if (trade.result === "Loss") {
      item.losses++;
    } else {
      item.be++;
    }

  });


  return data;

}


function renderCalendar() {

  const year =
    calendarDate.getFullYear();


  const month =
    calendarDate.getMonth();


  $("calendarMonth").textContent =
    formatMonthYear(calendarDate);


  const grid =
    $("calendarGrid");


  grid.innerHTML = "";


  const calendarData =
    getCalendarData();


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


  let monthTrades = 0;
  let monthPL = 0;


  trades.forEach(trade => {

    if (!trade.date) return;

    const [y,m] =
      trade.date.split("-").map(Number);


    if (
      y === year &&
      m === month + 1
    ) {

      monthTrades++;
      monthPL +=
        number(trade.profitLoss);

    }

  });


  const summaryClass =
    monthPL > 0
      ? "positive"
      : monthPL < 0
        ? "negative"
        : "neutral";


  $("calendarSummary").innerHTML =
    `${monthTrades} trades ·
     <span class="${summaryClass}">
       ${moneyWithSign(monthPL)}
     </span>`;


  /* Previous month cells */

  for (
    let i = firstDay - 1;
    i >= 0;
    i--
  ) {

    const day =
      previousMonthDays - i;


    const cell =
      createCalendarDay(
        year,
        month - 1,
        day,
        true,
        calendarData
      );


    grid.appendChild(cell);

  }


  /* Current month */

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const cell =
      createCalendarDay(
        year,
        month,
        day,
        false,
        calendarData
      );


    grid.appendChild(cell);

  }


  /* Next month cells */

  const totalCells =
    Math.ceil(
      grid.children.length / 7
    ) * 7;


  let nextDay = 1;


  while (
    grid.children.length <
    totalCells
  ) {

    const cell =
      createCalendarDay(
        year,
        month + 1,
        nextDay,
        true,
        calendarData
      );


    grid.appendChild(cell);

    nextDay++;

  }

}


function createCalendarDay(
  year,
  month,
  day,
  otherMonth,
  calendarData
) {

  const cell =
    document.createElement("div");


  cell.className =
    "calendar-day";


  if (otherMonth) {

    cell.classList.add(
      "other-month"
    );

  }


  const actualDate =
    new Date(
      year,
      month,
      day
    );


  const actualYear =
    actualDate.getFullYear();


  const actualMonth =
    actualDate.getMonth();


  const actualDay =
    actualDate.getDate();


  const key =
    dateKey(
      actualYear,
      actualMonth,
      actualDay
    );


  const today =
    getLocalDate();


  if (key === today) {

    cell.classList.add(
      "today"
    );

  }


  const data =
    calendarData[key];


  let resultHTML = "";


  if (data) {

    const pl =
      data.pl;


    let amountClass =
      "neutral";


    let dayClass =
      "calendar-be";


    if (pl > 0) {

      amountClass = "positive";
      dayClass = "calendar-win";

    } else if (pl < 0) {

      amountClass = "negative";
      dayClass = "calendar-loss";

    }


    cell.classList.add(
      dayClass
    );


    resultHTML = `

      <div class="calendar-result">

        <div class="calendar-amount ${amountClass}">
          ${moneyWithSign(pl)}
        </div>

        <div class="calendar-trades">
          ${data.trades}
          ${data.trades === 1 ? "trade" : "trades"}
        </div>

      </div>

    `;

  }


  cell.innerHTML = `

    <div class="calendar-date">
      ${actualDay}
    </div>

    ${resultHTML}

  `;


  return cell;

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


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key.toLowerCase() === "n" &&
      !$("tradeModal").classList.contains("hidden") === false
    ) {

      const tag =
        document.activeElement?.tagName;

      if (
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        tag !== "SELECT"
      ) {

        openTradeModal();

      }

    }


    if (
      event.key === "Escape" &&
      !$("tradeModal").classList.contains("hidden")
    ) {

      closeTradeModal();

    }

  }
);


/* =========================================================
   INITIAL
========================================================= */

updateDashboard();
renderJournal();
renderAnalytics();
renderCalendar();
calculateRiskPage();
