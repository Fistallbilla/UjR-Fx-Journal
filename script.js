import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* FIREBASE */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "journal-38e0e.firebaseapp.com",
  projectId: "journal-38e0e",
  storageBucket: "journal-38e0e.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};


/*
IMPORTANT:
Use the exact firebaseConfig from your current working script.js
if the placeholders above are not your actual configuration.
*/


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();


/* STATE */

let currentUser = null;
let unsubscribeTrades = null;
let unsubscribeSettings = null;

let allTrades = [];

let accountSettings = {
  startingBalance: 0,
  currency: "$"
};


/* ELEMENTS */

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("app");

const googleLogin = document.getElementById("googleLogin");
const logoutBtn = document.getElementById("logoutBtn");

const userName = document.getElementById("userName");
const welcomeName = document.getElementById("welcomeName");
const userPhoto = document.getElementById("userPhoto");

const tradeModal = document.getElementById("tradeModal");
const tradeForm = document.getElementById("tradeForm");

const addTradeBtn = document.getElementById("addTradeBtn");
const closeModal = document.getElementById("closeModal");
const cancelTrade = document.getElementById("cancelTrade");

const entryInput = document.getElementById("entry");
const slInput = document.getElementById("sl");
const tpInput = document.getElementById("tp");
const rrInput = document.getElementById("rr");

const riskPercentInput = document.getElementById("riskPercent");
const riskAmountInput = document.getElementById("riskAmount");

const startingBalanceInput =
  document.getElementById("startingBalance");

const currencyInput =
  document.getElementById("currency");

const saveAccountBtn =
  document.getElementById("saveAccountBtn");


/* LOGIN */

googleLogin.addEventListener("click", async () => {

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error(error);

    showToast("Login failed");

  }

});


/* LOGOUT */

logoutBtn.addEventListener("click", async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

  }

});


/* AUTH */

onAuthStateChanged(auth, user => {

  if (user) {

    currentUser = user;

    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    userName.textContent = user.displayName || "Trader";

    welcomeName.textContent =
      (user.displayName || "Trader").split(" ")[0];

    userPhoto.src =
      user.photoURL ||
      "https://via.placeholder.com/100";

    loadTrades();
    loadSettings();

  } else {

    currentUser = null;

    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");

    allTrades = [];

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    if (unsubscribeSettings) {
      unsubscribeSettings();
      unsubscribeSettings = null;
    }

  }

});


/* OPEN MODAL */

addTradeBtn.addEventListener("click", () => {

  resetForm();

  document.getElementById("modalTitle").textContent =
    "Add Trade";

  tradeModal.classList.add("show");

});


/* CLOSE MODAL */

closeModal.addEventListener("click", closeTradeModal);
cancelTrade.addEventListener("click", closeTradeModal);


function closeTradeModal() {

  tradeModal.classList.remove("show");

}


/* CLICK OUTSIDE MODAL */

tradeModal.addEventListener("click", e => {

  if (e.target === tradeModal) {

    closeTradeModal();

  }

});


/* AUTO R:R */

function calculateRR() {

  const entry = Number(entryInput.value);
  const sl = Number(slInput.value);
  const tp = Number(tpInput.value);

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(sl) ||
    !Number.isFinite(tp)
  ) {

    rrInput.value = "";

    return;

  }

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);

  if (risk <= 0) {

    rrInput.value = "";

    return;

  }

  const rr = reward / risk;

  rrInput.value = rr.toFixed(2) + "R";

}


entryInput.addEventListener("input", calculateRR);
slInput.addEventListener("input", calculateRR);
tpInput.addEventListener("input", calculateRR);


/* AUTO RISK AMOUNT */

riskPercentInput.addEventListener("input", () => {

  const percent = Number(riskPercentInput.value);
  const balance = Number(accountSettings.startingBalance);

  if (
    percent > 0 &&
    balance > 0
  ) {

    riskAmountInput.value =
      ((balance * percent) / 100).toFixed(2);

  }

});


/* SAVE ACCOUNT */

saveAccountBtn.addEventListener("click", async () => {

  if (!currentUser) return;

  const startingBalance =
    Number(startingBalanceInput.value) || 0;

  const currency =
    currencyInput.value || "$";

  try {

    await setDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "settings",
        "account"
      ),
      {
        startingBalance,
        currency,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    showToast("Account settings saved");

  } catch (error) {

    console.error(error);

    showToast("Could not save settings");

  }

});


/* LOAD SETTINGS */

function loadSettings() {

  if (unsubscribeSettings) {
    unsubscribeSettings();
  }

  const ref =
    doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

  unsubscribeSettings = onSnapshot(ref, snapshot => {

    if (snapshot.exists()) {

      accountSettings = {
        startingBalance:
          Number(snapshot.data().startingBalance) || 0,

        currency:
          snapshot.data().currency || "$"
      };

    } else {

      accountSettings = {
        startingBalance: 0,
        currency: "$"
      };

    }

    startingBalanceInput.value =
      accountSettings.startingBalance || "";

    currencyInput.value =
      accountSettings.currency || "$";

    refreshEverything();

  });

}


/* SAVE TRADE */

tradeForm.addEventListener("submit", async e => {

  e.preventDefault();

  if (!currentUser) return;


  const entry = Number(entryInput.value);
  const sl = Number(slInput.value);
  const tp = Number(tpInput.value);

  const risk =
    Math.abs(entry - sl);

  const reward =
    Math.abs(tp - entry);

  const rr =
    risk > 0 ? reward / risk : 0;


  const tradeData = {

    date:
      document.getElementById("tradeDate").value,

    time:
      document.getElementById("tradeTime").value ||
      getCurrentKathmanduTime(),

    pair:
      document.getElementById("pair").value.trim().toUpperCase(),

    direction:
      document.getElementById("direction").value,

    entry,
    sl,
    tp,

    risk,
    reward,
    rr,

    riskPercent:
      Number(riskPercentInput.value) || 0,

    riskAmount:
      Number(riskAmountInput.value) || 0,

    lotSize:
      Number(document.getElementById("lotSize").value) || 0,

    setup:
      document.getElementById("setup").value,

    session:
      document.getElementById("session").value,

    htfBias:
      document.getElementById("htfBias").value,

    liquidity:
      document.getElementById("liquidity").value,

    confirmation:
      document.getElementById("confirmation").value,

    result:
      document.getElementById("result").value,

    profit:
      Number(document.getElementById("profit").value) || 0,

    psychology:
      document.getElementById("psychology").value,

    confidence:
      Number(document.getElementById("confidence").value),

    mistake:
      document.getElementById("mistake").value,

    notes:
      document.getElementById("notes").value.trim(),

    updatedAt:
      serverTimestamp(),

    savedAt:
      serverTimestamp()

  };


  try {

    const editingId =
      document.getElementById("editingTradeId").value;


    if (editingId) {

      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "trades",
          editingId
        ),
        tradeData
      );

      showToast("Trade updated");

    } else {

      tradeData.createdAt =
        serverTimestamp();

      await addDoc(
        collection(
          db,
          "users",
          currentUser.uid,
          "trades"
        ),
        tradeData
      );

      showToast("Trade saved");

    }


    closeTradeModal();
    resetForm();

  } catch (error) {

    console.error(error);

    showToast("Could not save trade");

  }

});


/* LOAD TRADES */

function loadTrades() {

  if (unsubscribeTrades) {
    unsubscribeTrades();
  }

  const tradesRef =
    collection(
      db,
      "users",
      currentUser.uid,
      "trades"
    );


  unsubscribeTrades =
    onSnapshot(
      tradesRef,
      snapshot => {

        allTrades =
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));


        allTrades.sort((a, b) => {

          const aTime =
            getTimeValue(a);

          const bTime =
            getTimeValue(b);

          return bTime - aTime;

        });


        refreshEverything();

      },

      error => {

        console.error(error);

        showToast("Could not load trades");

      }
    );

}


/* TIME */

function getTimeValue(trade) {

  if (
    trade.savedAt &&
    typeof trade.savedAt.toMillis === "function"
  ) {

    return trade.savedAt.toMillis();

  }

  if (trade.createdAt &&
      typeof trade.createdAt.toMillis === "function") {

    return trade.createdAt.toMillis();

  }

  return new Date(
    `${trade.date || "1970-01-01"}T${trade.time || "00:00"}`
  ).getTime();

}


/* REFRESH */

function refreshEverything() {

  updateDashboard();
  updateFilters();
  renderTrades();
  updateWeekly();
  updateMonthly();
  updateAnalytics();
  drawEquityCurve();

}


/* DASHBOARD */

function updateDashboard() {

  const trades = allTrades;

  const total = trades.length;

  const wins =
    trades.filter(t => t.result === "Win").length;

  const losses =
    trades.filter(t => t.result === "Loss").length;

  const winRate =
    total ? (wins / total) * 100 : 0;

  const totalPL =
    trades.reduce(
      (sum, t) => sum + Number(t.profit || 0),
      0
    );

  const averagePL =
    total ? totalPL / total : 0;


  const winningPL =
    trades
      .filter(t => Number(t.profit) > 0)
      .reduce(
        (sum, t) => sum + Number(t.profit || 0),
        0
      );


  const losingPL =
    trades
      .filter(t => Number(t.profit) < 0)
      .reduce(
        (sum, t) => sum + Number(t.profit || 0),
        0
      );


  const profitFactor =
    losingPL < 0
      ? winningPL / Math.abs(losingPL)
      : winningPL > 0
        ? Infinity
        : 0;


  const averageWin =
    wins > 0
      ? winningPL / wins
      : 0;


  const lossTrades =
    trades.filter(
      t => Number(t.profit) < 0
    );


  const averageLoss =
    lossTrades.length
      ? losingPL / lossTrades.length
      : 0;


  const maxDrawdown =
    calculateMaxDrawdown(trades);


  const validRR =
    trades
      .map(t => Number(t.rr))
      .filter(v => Number.isFinite(v) && v > 0);


  const avgRR =
    validRR.length
      ? validRR.reduce((a,b) => a+b,0) / validRR.length
      : 0;


  setText("totalTrades", total);
  setText("wins", wins);
  setText("losses", losses);

  setText(
    "winRate",
    winRate.toFixed(1) + "%"
  );

  setText(
    "totalPL",
    money(totalPL)
  );

  setText(
    "averagePL",
    money(averagePL)
  );

  setText(
    "currentBalance",
    money(
      Number(accountSettings.startingBalance) +
      totalPL
    )
  );

  setText(
    "profitFactor",
    profitFactor === Infinity
      ? "∞"
      : profitFactor.toFixed(2)
  );

  setText(
    "expectancy",
    money(averagePL)
  );

  setText(
    "avgWin",
    money(averageWin)
  );

  setText(
    "avgLoss",
    money(averageLoss)
  );

  setText(
    "maxDrawdown",
    money(maxDrawdown)
  );

  setText(
    "avgRR",
    avgRR.toFixed(2) + "R"
  );


  const streaks =
    calculateStreaks(trades);


  setText(
    "currentStreak",
    streaks.current
  );

  setText(
    "bestWinStreak",
    streaks.bestWin
  );

  setText(
    "worstLossStreak",
    streaks.worstLoss
  );


  setText(
    "equityLabel",
    "Current: " +
    money(
      Number(accountSettings.startingBalance) +
      totalPL
    )
  );

}


/* MAX DRAWDOWN */

function calculateMaxDrawdown(trades) {

  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;


  const chronological =
    [...trades].sort(
      (a,b) =>
        getTimeValue(a) - getTimeValue(b)
    );


  chronological.forEach(trade => {

    cumulative +=
      Number(trade.profit || 0);

    peak =
      Math.max(peak, cumulative);

    const drawdown =
      peak - cumulative;

    maxDD =
      Math.max(maxDD, drawdown);

  });


  return maxDD;

}


/* STREAKS */

function calculateStreaks(trades) {

  const chronological =
    [...trades].sort(
      (a,b) =>
        getTimeValue(a) - getTimeValue(b)
    );


  let current = 0;
  let bestWin = 0;
  let worstLoss = 0;

  let winStreak = 0;
  let lossStreak = 0;


  chronological.forEach(trade => {

    if (trade.result === "Win") {

      winStreak++;
      lossStreak = 0;

      bestWin =
        Math.max(bestWin, winStreak);

    } else if (trade.result === "Loss") {

      lossStreak++;
      winStreak = 0;

      worstLoss =
        Math.max(worstLoss, lossStreak);

    }

  });


  if (chronological.length) {

    const last =
      chronological[chronological.length - 1];

    if (last.result === "Win") {

      current =
        "W" + winStreak;

    } else if (last.result === "Loss") {

      current =
        "L" + lossStreak;

    } else {

      current = "BE";

    }

  }


  return {
    current,
    bestWin,
    worstLoss
  };

}


/* FILTER OPTIONS */

function updateFilters() {

  const select =
    document.getElementById("filterSetup");

  const current =
    select.value;

  const setups =
    [...new Set(
      allTrades
        .map(t => t.setup)
        .filter(Boolean)
    )];


  select.innerHTML =
    `<option value="all">All Setups</option>`;


  setups.sort().forEach(setup => {

    const option =
      document.createElement("option");

    option.value = setup;
    option.textContent = setup;

    select.appendChild(option);

  });


  if (
    setups.includes(current)
  ) {

    select.value = current;

  }

}


/* FILTER */

function getFilteredTrades() {

  const search =
    document
      .getElementById("searchInput")
      .value
      .toLowerCase()
      .trim();


  const result =
    document.getElementById("filterResult").value;

  const direction =
    document.getElementById("filterDirection").value;

  const setup =
    document.getElementById("filterSetup").value;


  return allTrades.filter(trade => {

    const searchable = [

      trade.date,
      trade.time,
      trade.pair,
      trade.direction,
      trade.setup,
      trade.session,
      trade.result,
      trade.mistake,
      trade.notes

    ]
      .join(" ")
      .toLowerCase();


    const matchesSearch =
      !search ||
      searchable.includes(search);


    const matchesResult =
      result === "all" ||
      trade.result === result;


    const matchesDirection =
      direction === "all" ||
      trade.direction === direction;


    const matchesSetup =
      setup === "all" ||
      trade.setup === setup;


    return (
      matchesSearch &&
      matchesResult &&
      matchesDirection &&
      matchesSetup
    );

  });

}


/* RENDER TABLE */

function renderTrades() {

  const tbody =
    document.getElementById("tradeTable");

  const empty =
    document.getElementById("emptyState");

  const trades =
    getFilteredTrades();


  tbody.innerHTML = "";


  if (!trades.length) {

    empty.style.display = "block";

    return;

  }


  empty.style.display = "none";


  trades.forEach(trade => {

    const tr =
      document.createElement("tr");


    const resultClass =
      trade.result === "Win"
        ? "result-win"
        : trade.result === "Loss"
          ? "result-loss"
          : "result-be";


    const pl =
      Number(trade.profit || 0);


    tr.innerHTML = `

      <td>${escapeHTML(trade.date || "")}</td>

      <td>${escapeHTML(trade.time || "")}</td>

      <td>${escapeHTML(trade.pair || "")}</td>

      <td>${escapeHTML(trade.direction || "")}</td>

      <td>${formatNumber(trade.entry)}</td>

      <td>${formatNumber(trade.sl)}</td>

      <td>${formatNumber(trade.tp)}</td>

      <td>${Number(trade.rr || 0).toFixed(2)}R</td>

      <td>${escapeHTML(trade.setup || "")}</td>

      <td>${escapeHTML(trade.session || "")}</td>

      <td>
        <span class="result ${resultClass}">
          ${escapeHTML(trade.result || "")}
        </span>
      </td>

      <td class="${pl >= 0 ? "positive" : "negative"}">
        ${money(pl)}
      </td>

      <td>${escapeHTML(trade.mistake || "")}</td>

      <td>

        <button
          class="edit-btn"
          data-edit="${trade.id}">
          Edit
        </button>

        <button
          class="delete-btn"
          data-delete="${trade.id}">
          Delete
        </button>

      </td>

    `;


    tbody.appendChild(tr);

  });


  tbody
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => deleteTrade(button.dataset.delete)
      );

    });


  tbody
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => editTrade(button.dataset.edit)
      );

    });

}


/* DELETE */

async function deleteTrade(id) {

  if (!currentUser) return;

  if (!confirm("Delete this trade?")) return;


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

    showToast("Trade deleted");

  } catch (error) {

    console.error(error);

    showToast("Could not delete trade");

  }

}


/* EDIT */

function editTrade(id) {

  const trade =
    allTrades.find(t => t.id === id);

  if (!trade) return;


  document.getElementById("editingTradeId").value =
    id;

  document.getElementById("modalTitle").textContent =
    "Edit Trade";


  document.getElementById("tradeDate").value =
    trade.date || "";

  document.getElementById("tradeTime").value =
    trade.time || "";

  document.getElementById("pair").value =
    trade.pair || "XAUUSD";

  document.getElementById("direction").value =
    trade.direction || "Buy";

  entryInput.value =
    trade.entry ?? "";

  slInput.value =
    trade.sl ?? "";

  tpInput.value =
    trade.tp ?? "";

  rrInput.value =
    trade.rr
      ? Number(trade.rr).toFixed(2) + "R"
      : "";

  riskPercentInput.value =
    trade.riskPercent || "";

  riskAmountInput.value =
    trade.riskAmount || "";

  document.getElementById("lotSize").value =
    trade.lotSize || "";

  document.getElementById("setup").value =
    trade.setup || "Other";

  document.getElementById("session").value =
    trade.session || "Other";

  document.getElementById("htfBias").value =
    trade.htfBias || "Neutral";

  document.getElementById("liquidity").value =
    trade.liquidity || "None";

  document.getElementById("confirmation").value =
    trade.confirmation || "None";

  document.getElementById("result").value =
    trade.result || "Win";

  document.getElementById("profit").value =
    trade.profit ?? "";

  document.getElementById("psychology").value =
    trade.psychology || "Neutral";

  document.getElementById("confidence").value =
    trade.confidence || 3;

  document.getElementById("mistake").value =
    trade.mistake || "No mistake";

  document.getElementById("notes").value =
    trade.notes || "";


  tradeModal.classList.add("show");

}


/* WEEK */

function updateWeekly() {

  const now =
    new Date();

  const day =
    now.getDay();

  const monday =
    new Date(now);

  monday.setDate(
    now.getDate() -
    (day === 0 ? 6 : day - 1)
  );

  monday.setHours(0,0,0,0);


  const trades =
    allTrades.filter(t => {

      const date =
        new Date(
          `${t.date}T${t.time || "00:00"}`
        );

      return date >= monday;

    });


  updatePeriod(
    trades,
    "week"
  );

}


/* MONTH */

function updateMonthly() {

  const now =
    new Date();

  const trades =
    allTrades.filter(t => {

      if (!t.date) return false;

      const d =
        new Date(t.date);

      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );

    });


  updatePeriod(
    trades,
    "month"
  );

}


/* PERIOD */

function updatePeriod(trades, prefix) {

  const total =
    trades.length;

  const wins =
    trades.filter(
      t => t.result === "Win"
    ).length;

  const losses =
    trades.filter(
      t => t.result === "Loss"
    ).length;

  const pl =
    trades.reduce(
      (sum,t) =>
        sum + Number(t.profit || 0),
      0
    );

  const winRate =
    total
      ? (wins / total) * 100
      : 0;


  setText(
    prefix + "Trades",
    total
  );

  setText(
    prefix + "Wins",
    wins
  );

  setText(
    prefix + "Losses",
    losses
  );

  setText(
    prefix + "WinRate",
    winRate.toFixed(1) + "%"
  );

  setText(
    prefix + "PL",
    money(pl)
  );

}


/* ANALYTICS */

function updateAnalytics() {

  const setupMap = {};
  const mistakeMap = {};


  allTrades.forEach(trade => {

    const setup =
      trade.setup || "Unknown";

    if (!setupMap[setup]) {

      setupMap[setup] = {
        trades: 0,
        wins: 0,
        pl: 0
      };

    }


    setupMap[setup].trades++;

    if (trade.result === "Win") {
      setupMap[setup].wins++;
    }

    setupMap[setup].pl +=
      Number(trade.profit || 0);


    const mistake =
      trade.mistake || "No mistake";


    if (!mistakeMap[mistake]) {

      mistakeMap[mistake] = {
        trades: 0,
        pl: 0
      };

    }


    mistakeMap[mistake].trades++;

    mistakeMap[mistake].pl +=
      Number(trade.profit || 0);

  });


  renderAnalytics(
    "setupAnalytics",
    setupMap,
    true
  );


  renderAnalytics(
    "mistakeAnalytics",
    mistakeMap,
    false
  );

}


/* ANALYTICS RENDER */

function renderAnalytics(
  elementId,
  data,
  setupMode
) {

  const container =
    document.getElementById(elementId);

  container.innerHTML = "";


  const entries =
    Object.entries(data)
      .sort(
        (a,b) =>
          Math.abs(b[1].pl) -
          Math.abs(a[1].pl)
      );


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">No data yet.</div>`;

    return;

  }


  entries.forEach(([name, stats]) => {

    const row =
      document.createElement("div");

    row.className =
      "analytics-row";


    const winRate =
      stats.trades
        ? (stats.wins / stats.trades) * 100
        : 0;


    row.innerHTML = `

      <div>
        <strong>
          ${escapeHTML(name)}
        </strong>

        <small>
          ${stats.trades} trade(s)
          ${setupMode
            ? " · " + winRate.toFixed(0) + "% win"
            : ""}
        </small>
      </div>

      ${
        setupMode
          ? `<span>${stats.wins}W</span>`
          : `<span>${stats.trades} trades</span>`
      }

      <span class="analytics-profit ${
        stats.pl >= 0
          ? "positive"
          : "negative"
      }">
        ${money(stats.pl)}
      </span>

    `;


    container.appendChild(row);

  });

}


/* EQUITY */

function drawEquityCurve() {

  const canvas =
    document.getElementById("equityChart");

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


  ctx.scale(dpr, dpr);


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


  const trades =
    [...allTrades]
      .sort(
        (a,b) =>
          getTimeValue(a) -
          getTimeValue(b)
      );


  if (!trades.length) {

    ctx.fillStyle =
      "#8b98aa";

    ctx.font =
      "14px Arial";

    ctx.fillText(
      "Add trades to see your equity curve.",
      20,
      30
    );

    return;

  }


  const values = [0];

  let cumulative = 0;


  trades.forEach(trade => {

    cumulative +=
      Number(trade.profit || 0);

    values.push(cumulative);

  });


  const min =
    Math.min(...values);

  const max =
    Math.max(...values);


  const range =
    max - min || 1;


  /* GRID */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;


  for (let i = 1; i < 5; i++) {

    const y =
      (height / 5) * i;

    ctx.beginPath();

    ctx.moveTo(0,y);
    ctx.lineTo(width,y);

    ctx.stroke();

  }


  /* LINE */

  ctx.beginPath();


  values.forEach((value,index) => {

    const x =
      (index / (values.length - 1)) *
      width;

    const y =
      height -
      ((value - min) / range) *
      (height - 30) -
      15;


    if (index === 0) {

      ctx.moveTo(x,y);

    } else {

      ctx.lineTo(x,y);

    }

  });


  ctx.strokeStyle =
    "#8d6cff";

  ctx.lineWidth = 3;

  ctx.stroke();


  /* POINTS */

  values.forEach((value,index) => {

    const x =
      (index / (values.length - 1)) *
      width;

    const y =
      height -
      ((value - min) / range) *
      (height - 30) -
      15;


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      3,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#8d6cff";

    ctx.fill();

  });

}


/* EXPORT */

document
  .getElementById("exportBtn")
  .addEventListener(
    "click",
    exportCSV
  );


function exportCSV() {

  if (!allTrades.length) {

    showToast("No trades to export");

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
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"

  ];


  const rows =
    allTrades.map(t => [

      t.date,
      t.time,
      t.pair,
      t.direction,
      t.entry,
      t.sl,
      t.tp,
      t.rr,
      t.riskPercent,
      t.riskAmount,
      t.lotSize,
      t.setup,
      t.session,
      t.htfBias,
      t.liquidity,
      t.confirmation,
      t.result,
      t.profit,
      t.psychology,
      t.confidence,
      t.mistake,
      t.notes

    ].map(csvEscape));


  const csv =
    [
      headers.map(csvEscape),
      ...rows
    ]
      .map(row => row.join(","))
      .join("\n");


  const blob =
    new Blob(
      [csv],
      { type: "text/csv;charset=utf-8;" }
    );


  const url =
    URL.createObjectURL(blob);


  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    "ujr-fx-trading-journal.csv";

  a.click();


  URL.revokeObjectURL(url);

  showToast("CSV exported");

}


/* FILTER EVENTS */

document
  .getElementById("searchInput")
  .addEventListener(
    "input",
    renderTrades
  );


document
  .getElementById("filterResult")
  .addEventListener(
    "change",
    renderTrades
  );


document
  .getElementById("filterDirection")
  .addEventListener(
    "change",
    renderTrades
  );


document
  .getElementById("filterSetup")
  .addEventListener(
    "change",
    renderTrades
  );


/* RESET */

function resetForm() {

  tradeForm.reset();

  document.getElementById("editingTradeId").value =
    "";

  document.getElementById("modalTitle").textContent =
    "Add Trade";


  document.getElementById("pair").value =
    "XAUUSD";

  document.getElementById("direction").value =
    "Buy";

  document.getElementById("setup").value =
    "Liquidity Sweep";

  document.getElementById("result").value =
    "Win";

  document.getElementById("mistake").value =
    "No mistake";

  document.getElementById("confidence").value =
    "3";

  document.getElementById("session").value =
    "London";

  document.getElementById("htfBias").value =
    "Bullish";

  document.getElementById("liquidity").value =
    "Previous High";

  document.getElementById("confirmation").value =
    "BOS";

  document.getElementById("psychology").value =
    "Calm";


  document.getElementById("tradeDate").value =
    getTodayKathmandu();

  document.getElementById("tradeTime").value =
    getCurrentKathmanduTime();


  rrInput.value = "";

}


/* DATE */

function getTodayKathmandu() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kathmandu"
    }
  ).format(new Date());

}


function getCurrentKathmanduTime() {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Kathmandu",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  ).format(new Date());

}


/* MONEY */

function money(value) {

  const number =
    Number(value) || 0;

  return (
    accountSettings.currency +
    number.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )
  );

}


/* NUMBER */

function formatNumber(value) {

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(3);

}


/* TEXT */

function setText(id, value) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }

}


/* ESCAPE */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* CSV ESCAPE */

function csvEscape(value) {

  const text =
    String(value ?? "");

  return `"${text.replaceAll('"','""')}"`;

}


/* TOAST */

let toastTimer;

function showToast(message) {

  const toast =
    document.getElementById("toast");

  toast.textContent =
    message;

  toast.classList.add("show");


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2500);

}


/* RESIZE */

window.addEventListener(
  "resize",
  drawEquityCurve
);


/* SERVICE WORKER */

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .catch(error =>
          console.log(
            "Service worker:",
            error
          )
        );

    }
  );

}
