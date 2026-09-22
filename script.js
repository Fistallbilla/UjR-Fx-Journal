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
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ======================================================
// FIREBASE CONFIG
// ======================================================

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
  authDomain: "journal-38e0e.firebaseapp.com",
  projectId: "journal-38e0e",
  storageBucket: "journal-38e0e.firebasestorage.app",
  messagingSenderId: "382226906837",
  appId: "1:382226906837:web:38df881c0f7beb24256c5c",
  measurementId: "G-R6LXDMQ9K2"
};


// ======================================================
// INITIALIZE FIREBASE
// ======================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();


// ======================================================
// STATE
// ======================================================

let currentUser = null;
let unsubscribeTrades = null;
let unsubscribeSettings = null;

let allTrades = [];

let accountSettings = {
  startingBalance: 0,
  currency: "$"
};


// ======================================================
// DOM
// ======================================================

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const userName = document.getElementById("userName");
const userPhoto = document.getElementById("userPhoto");

const addTradeBtn = document.getElementById("addTradeBtn");
const tradeModal = document.getElementById("tradeModal");
const closeTradeModal = document.getElementById("closeTradeModal");
const cancelTradeBtn = document.getElementById("cancelTradeBtn");

const tradeForm = document.getElementById("tradeForm");

const saveTradeBtn = document.getElementById("saveTradeBtn");


// ======================================================
// LOGIN
// ======================================================

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {

    try {

      googleLoginBtn.disabled = true;
      googleLoginBtn.textContent = "Signing in...";

      await signInWithPopup(auth, provider);

    } catch (error) {

      console.error("LOGIN ERROR:", error);

      let message = "Login failed.";

      if (error.code === "auth/popup-blocked") {
        message = "Popup was blocked. Allow popups for this website.";
      }

      else if (error.code === "auth/popup-closed-by-user") {
        message = "Login popup was closed.";
      }

      else if (error.code === "auth/unauthorized-domain") {
        message = "This website domain is not authorized in Firebase.";
      }

      else if (error.code === "auth/operation-not-allowed") {
        message = "Google login is not enabled in Firebase Authentication.";
      }

      else if (
        error.code === "auth/invalid-api-key" ||
        error.code === "auth/api-key-not-valid"
      ) {
        message = "Firebase API key is invalid.";
      }

      showToast(message, "error");

      googleLoginBtn.disabled = false;
      googleLoginBtn.textContent = "Continue with Google";
    }

  });
}


// ======================================================
// LOGOUT
// ======================================================

if (logoutBtn) {

  logoutBtn.addEventListener("click", async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error("Logout error:", error);

      showToast("Logout failed.", "error");

    }

  });

}


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(auth, user => {

  currentUser = user;

  if (user) {

    if (loginScreen) {
      loginScreen.style.display = "none";
    }

    if (appScreen) {
      appScreen.style.display = "block";
    }

    updateUserUI(user);

    loadUserSettings();
    loadTrades();

  } else {

    if (loginScreen) {
      loginScreen.style.display = "flex";
    }

    if (appScreen) {
      appScreen.style.display = "none";
    }

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


// ======================================================
// USER UI
// ======================================================

function updateUserUI(user) {

  if (userName) {
    userName.textContent = user.displayName || "Trader";
  }

  if (userPhoto) {

    if (user.photoURL) {
      userPhoto.src = user.photoURL;
    } else {
      userPhoto.style.display = "none";
    }

  }

}


// ======================================================
// USER SETTINGS
// ======================================================

function loadUserSettings() {

  if (!currentUser) return;

  const settingsRef = doc(
    db,
    "users",
    currentUser.uid,
    "settings",
    "account"
  );

  unsubscribeSettings = onSnapshot(
    settingsRef,
    snapshot => {

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

      updateDashboard();

    },

    error => {

      console.error("Settings error:", error);

    }
  );

}


// ======================================================
// SAVE ACCOUNT SETTINGS
// ======================================================

const saveAccountBtn = document.getElementById("saveAccountBtn");

if (saveAccountBtn) {

  saveAccountBtn.addEventListener("click", async () => {

    if (!currentUser) return;

    const startingBalanceInput =
      document.getElementById("startingBalance");

    const currencyInput =
      document.getElementById("currency");

    const startingBalance =
      Number(startingBalanceInput?.value) || 0;

    const currency =
      currencyInput?.value || "$";

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
        }
      );

      showToast("Account settings saved.", "success");

    } catch (error) {

      console.error(error);

      showToast("Could not save settings.", "error");

    }

  });

}


// ======================================================
// LOAD TRADES
// ======================================================

function loadTrades() {

  if (!currentUser) return;

  const tradesRef = collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );

  unsubscribeTrades = onSnapshot(
    tradesRef,

    snapshot => {

      allTrades = [];

      snapshot.forEach(docSnap => {

        allTrades.push({
          id: docSnap.id,
          ...docSnap.data()
        });

      });

      allTrades.sort((a, b) => {

        const dateA =
          `${a.date || ""} ${a.time || ""}`;

        const dateB =
          `${b.date || ""} ${b.time || ""}`;

        return dateB.localeCompare(dateA);

      });

      renderTrades();
      updateDashboard();
      updateAnalytics();
      updateWeeklyStats();
      updateMonthlyStats();
      updateEquityCurve();

    },

    error => {

      console.error("Trades error:", error);

      showToast(
        "Could not load trades. Check Firestore rules.",
        "error"
      );

    }
  );

}


// ======================================================
// OPEN TRADE MODAL
// ======================================================

if (addTradeBtn) {

  addTradeBtn.addEventListener("click", () => {

    openTradeModal();

  });

}


function openTradeModal(trade = null) {

  if (!tradeModal) return;

  tradeModal.style.display = "flex";

  if (tradeForm) {

    tradeForm.reset();

  }

  const tradeId =
    document.getElementById("tradeId");

  if (tradeId) {
    tradeId.value = trade?.id || "";
  }

  const dateInput =
    document.getElementById("tradeDate");

  if (dateInput && !trade) {

    dateInput.value = getToday();

  }

  if (trade) {

    fillTradeForm(trade);

    if (saveTradeBtn) {
      saveTradeBtn.textContent = "Update Trade";
    }

  } else {

    if (saveTradeBtn) {
      saveTradeBtn.textContent = "Save Trade";
    }

  }

}


// ======================================================
// CLOSE MODAL
// ======================================================

function closeModal() {

  if (tradeModal) {
    tradeModal.style.display = "none";
  }

}

if (closeTradeModal) {
  closeTradeModal.addEventListener("click", closeModal);
}

if (cancelTradeBtn) {
  cancelTradeBtn.addEventListener("click", closeModal);
}

if (tradeModal) {

  tradeModal.addEventListener("click", event => {

    if (event.target === tradeModal) {
      closeModal();
    }

  });

}


// ======================================================
// FILL EDIT FORM
// ======================================================

function fillTradeForm(trade) {

  setValue("tradeDate", trade.date);
  setValue("tradeTime", trade.time);
  setValue("pair", trade.pair);
  setValue("direction", trade.direction);

  setValue("entry", trade.entry);
  setValue("sl", trade.sl);
  setValue("tp", trade.tp);

  setValue("riskPercent", trade.riskPercent);
  setValue("riskAmount", trade.riskAmount);
  setValue("lotSize", trade.lotSize);

  setValue("setup", trade.setup);
  setValue("session", trade.session);
  setValue("htfBias", trade.htfBias);
  setValue("liquidity", trade.liquidity);
  setValue("confirmation", trade.confirmation);

  setValue("result", trade.result);
  setValue("profit", trade.profit);

  setValue("psychology", trade.psychology);
  setValue("confidence", trade.confidence);
  setValue("mistake", trade.mistake);
  setValue("notes", trade.notes);

}


function setValue(id, value) {

  const element = document.getElementById(id);

  if (element && value !== undefined && value !== null) {

    element.value = value;

  }

}


// ======================================================
// AUTO R:R
// ======================================================

const entryInput = document.getElementById("entry");
const slInput = document.getElementById("sl");
const tpInput = document.getElementById("tp");

const rrInput = document.getElementById("rr");


function calculateRR() {

  const entry = Number(entryInput?.value);
  const sl = Number(slInput?.value);
  const tp = Number(tpInput?.value);

  if (!entry || !sl || !tp) {

    if (rrInput) rrInput.value = "";

    return;

  }

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);

  if (risk === 0) {

    if (rrInput) rrInput.value = "";

    return;

  }

  const rr = reward / risk;

  if (rrInput) {
    rrInput.value = rr.toFixed(2);
  }

}


entryInput?.addEventListener("input", calculateRR);
slInput?.addEventListener("input", calculateRR);
tpInput?.addEventListener("input", calculateRR);


// ======================================================
// RISK AMOUNT
// ======================================================

const riskPercentInput =
  document.getElementById("riskPercent");

const riskAmountInput =
  document.getElementById("riskAmount");


function calculateRiskAmount() {

  const riskPercent =
    Number(riskPercentInput?.value) || 0;

  const balance =
    Number(accountSettings.startingBalance) || 0;

  const riskAmount =
    balance * riskPercent / 100;

  if (riskAmountInput) {

    riskAmountInput.value =
      riskAmount ? riskAmount.toFixed(2) : "";

  }

}


riskPercentInput?.addEventListener(
  "input",
  calculateRiskAmount
);


// ======================================================
// SAVE TRADE
// ======================================================

if (tradeForm) {

  tradeForm.addEventListener("submit", async event => {

    event.preventDefault();

    if (!currentUser) {

      showToast("Please login first.", "error");

      return;

    }

    const tradeId =
      document.getElementById("tradeId")?.value;

    const entry =
      Number(getValue("entry")) || 0;

    const sl =
      Number(getValue("sl")) || 0;

    const tp =
      Number(getValue("tp")) || 0;

    const risk =
      Math.abs(entry - sl);

    const reward =
      Math.abs(tp - entry);

    const rr =
      risk > 0 ? reward / risk : 0;

    const riskPercent =
      Number(getValue("riskPercent")) || 0;

    const riskAmount =
      Number(getValue("riskAmount")) ||
      (
        Number(accountSettings.startingBalance) *
        riskPercent / 100
      );

    const tradeData = {

      date: getValue("tradeDate"),
      time: getValue("tradeTime"),

      pair: getValue("pair"),
      direction: getValue("direction"),

      entry,
      sl,
      tp,

      risk,
      reward,
      rr,

      riskPercent,
      riskAmount,

      lotSize:
        Number(getValue("lotSize")) || 0,

      setup: getValue("setup"),
      session: getValue("session"),

      htfBias:
        getValue("htfBias"),

      liquidity:
        getValue("liquidity"),

      confirmation:
        getValue("confirmation"),

      result:
        getValue("result"),

      profit:
        Number(getValue("profit")) || 0,

      psychology:
        getValue("psychology"),

      confidence:
        Number(getValue("confidence")) || 0,

      mistake:
        getValue("mistake"),

      notes:
        getValue("notes"),

      updatedAt:
        serverTimestamp(),

      savedAt:
        new Date().toISOString()
    };


    try {

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

        showToast(
          "Trade updated successfully.",
          "success"
        );

      } else {

        await addDoc(
          collection(
            db,
            "users",
            currentUser.uid,
            "trades"
          ),
          {
            ...tradeData,
            createdAt: serverTimestamp()
          }
        );

        showToast(
          "Trade saved successfully.",
          "success"
        );

      }

      closeModal();

    } catch (error) {

      console.error("SAVE TRADE ERROR:", error);

      showToast(
        "Could not save trade.",
        "error"
      );

    }

  });

}


// ======================================================
// DELETE TRADE
// ======================================================

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

    showToast(
      "Trade deleted.",
      "success"
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade.",
      "error"
    );

  }

}


// ======================================================
// EDIT TRADE
// ======================================================

function editTrade(id) {

  const trade =
    allTrades.find(t => t.id === id);

  if (!trade) return;

  openTradeModal(trade);

}


// ======================================================
// RENDER TRADE TABLE
// ======================================================

function renderTrades() {

  const tableBody =
    document.getElementById("tradeTableBody");

  if (!tableBody) return;

  const search =
    (
      document.getElementById("tradeSearch")?.value ||
      ""
    ).toLowerCase();

  const resultFilter =
    document.getElementById("resultFilter")?.value ||
    "";

  const directionFilter =
    document.getElementById("directionFilter")?.value ||
    "";

  const setupFilter =
    document.getElementById("setupFilter")?.value ||
    "";


  let trades =
    [...allTrades];


  if (search) {

    trades = trades.filter(trade => {

      const text = [

        trade.pair,
        trade.setup,
        trade.session,
        trade.result,
        trade.psychology,
        trade.mistake,
        trade.notes

      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);

    });

  }


  if (resultFilter) {

    trades =
      trades.filter(
        trade =>
          trade.result === resultFilter
      );

  }


  if (directionFilter) {

    trades =
      trades.filter(
        trade =>
          trade.direction === directionFilter
      );

  }


  if (setupFilter) {

    trades =
      trades.filter(
        trade =>
          trade.setup === setupFilter
      );

  }


  tableBody.innerHTML = "";


  if (!trades.length) {

    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  trades.forEach(trade => {

    const row =
      document.createElement("tr");


    const profit =
      Number(trade.profit) || 0;


    const profitClass =
      profit > 0
        ? "positive"
        : profit < 0
          ? "negative"
          : "";


    row.innerHTML = `

      <td>
        ${escapeHTML(trade.date || "-")}
      </td>

      <td>
        ${escapeHTML(trade.pair || "-")}
      </td>

      <td>
        ${escapeHTML(trade.direction || "-")}
      </td>

      <td>
        ${escapeHTML(trade.setup || "-")}
      </td>

      <td>
        ${formatNumber(trade.entry)}
      </td>

      <td>
        ${formatNumber(trade.sl)}
      </td>

      <td>
        ${formatNumber(trade.tp)}
      </td>

      <td>
        ${formatNumber(trade.rr)}
      </td>

      <td class="${profitClass}">
        ${formatMoney(profit)}
      </td>

      <td>
        <button
          class="small-btn"
          onclick="editTrade('${trade.id}')">
          Edit
        </button>

        <button
          class="small-btn danger"
          onclick="deleteTrade('${trade.id}')">
          Delete
        </button>
      </td>

    `;


    tableBody.appendChild(row);

  });

}


// ======================================================
// FILTER LISTENERS
// ======================================================

[
  "tradeSearch",
  "resultFilter",
  "directionFilter",
  "setupFilter"

].forEach(id => {

  document
    .getElementById(id)
    ?.addEventListener(
      "input",
      renderTrades
    );

});


// ======================================================
// DASHBOARD
// ======================================================

function updateDashboard() {

  const trades =
    allTrades;


  const totalTrades =
    trades.length;


  const wins =
    trades.filter(
      t =>
        normalizeResult(t.result) === "win"
    ).length;


  const losses =
    trades.filter(
      t =>
        normalizeResult(t.result) === "loss"
    ).length;


  const winRate =
    totalTrades > 0
      ? wins / totalTrades * 100
      : 0;


  const totalProfit =
    trades.reduce(
      (sum, t) =>
        sum + (Number(t.profit) || 0),
      0
    );


  const currentBalance =
    Number(accountSettings.startingBalance) +
    totalProfit;


  const winningTrades =
    trades
      .filter(t => Number(t.profit) > 0)
      .map(t => Number(t.profit));


  const losingTrades =
    trades
      .filter(t => Number(t.profit) < 0)
      .map(t => Math.abs(Number(t.profit)));


  const grossProfit =
    winningTrades.reduce(
      (a, b) => a + b,
      0
    );


  const grossLoss =
    losingTrades.reduce(
      (a, b) => a + b,
      0
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const averageWin =
    winningTrades.length
      ? grossProfit / winningTrades.length
      : 0;


  const averageLoss =
    losingTrades.length
      ? grossLoss / losingTrades.length
      : 0;


  const expectancy =
    totalTrades > 0
      ? totalProfit / totalTrades
      : 0;


  const averageRR =
    trades.length
      ? trades.reduce(
          (sum, t) =>
            sum + (Number(t.rr) || 0),
          0
        ) / trades.length
      : 0;


  const maxDrawdown =
    calculateMaxDrawdown(trades);


  setText(
    "totalTrades",
    totalTrades
  );

  setText(
    "winRate",
    `${winRate.toFixed(1)}%`
  );

  setText(
    "wins",
    wins
  );

  setText(
    "losses",
    losses
  );

  setText(
    "totalProfit",
    formatMoney(totalProfit)
  );

  setText(
    "currentBalance",
    formatMoney(currentBalance)
  );

  setText(
    "profitFactor",
    profitFactor === Infinity
      ? "∞"
      : profitFactor.toFixed(2)
  );

  setText(
    "expectancy",
    formatMoney(expectancy)
  );

  setText(
    "averageWin",
    formatMoney(averageWin)
  );

  setText(
    "averageLoss",
    formatMoney(-averageLoss)
  );

  setText(
    "maxDrawdown",
    formatMoney(-maxDrawdown)
  );

  setText(
    "averageRR",
    averageRR.toFixed(2)
  );


  updateStreaks(trades);

}


// ======================================================
// STREAKS
// ======================================================

function updateStreaks(trades) {

  const sorted =
    [...trades].sort(
      (a, b) =>
        `${a.date} ${a.time}`
          .localeCompare(
            `${b.date} ${b.time}`
          )
    );


  let currentStreak = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;

  let winStreak = 0;
  let lossStreak = 0;


  sorted.forEach(trade => {

    const result =
      normalizeResult(trade.result);


    if (result === "win") {

      winStreak++;
      lossStreak = 0;

      bestWinStreak =
        Math.max(
          bestWinStreak,
          winStreak
        );

    }

    else if (result === "loss") {

      lossStreak++;
      winStreak = 0;

      worstLossStreak =
        Math.max(
          worstLossStreak,
          lossStreak
        );

    }

  });


  const last =
    sorted[sorted.length - 1];


  if (last) {

    const lastResult =
      normalizeResult(last.result);

    let streak = 0;

    for (
      let i = sorted.length - 1;
      i >= 0;
      i--
    ) {

      if (
        normalizeResult(
          sorted[i].result
        ) === lastResult
      ) {

        streak++;

      } else {

        break;

      }

    }

    currentStreak =
      lastResult === "loss"
        ? -streak
        : streak;

  }


  const averagePL =
    trades.length
      ? trades.reduce(
          (sum, t) =>
            sum + (Number(t.profit) || 0),
          0
        ) / trades.length
      : 0;


  setText(
    "currentStreak",
    currentStreak
  );

  setText(
    "bestWinStreak",
    bestWinStreak
  );

  setText(
    "worstLossStreak",
    worstLossStreak
  );

  setText(
    "averagePL",
    formatMoney(averagePL)
  );

}


// ======================================================
// MAX DRAWDOWN
// ======================================================

function calculateMaxDrawdown(trades) {

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;


  const sorted =
    [...trades].sort(
      (a, b) =>
        `${a.date} ${a.time}`
          .localeCompare(
            `${b.date} ${b.time}`
          )
    );


  sorted.forEach(trade => {

    equity +=
      Number(trade.profit) || 0;

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


  return maxDrawdown;

}


// ======================================================
// ANALYTICS
// ======================================================

function updateAnalytics() {

  updateSetupAnalytics();
  updateMistakeAnalytics();

}


// ======================================================
// SETUP ANALYTICS
// ======================================================

function updateSetupAnalytics() {

  const container =
    document.getElementById(
      "setupAnalytics"
    );

  if (!container) return;


  const setups = {};


  allTrades.forEach(trade => {

    const setup =
      trade.setup || "Unknown";


    if (!setups[setup]) {

      setups[setup] = {
        trades: 0,
        wins: 0,
        profit: 0
      };

    }


    setups[setup].trades++;

    setups[setup].profit +=
      Number(trade.profit) || 0;


    if (
      normalizeResult(trade.result) ===
      "win"
    ) {

      setups[setup].wins++;

    }

  });


  const entries =
    Object.entries(setups);


  if (!entries.length) {

    container.innerHTML =
      `<p class="empty-state">
        No setup data yet.
      </p>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([setup, data]) => {

        const winRate =
          data.trades
            ? data.wins /
              data.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <div>
              <strong>
                ${escapeHTML(setup)}
              </strong>

              <small>
                ${data.trades} trades
              </small>
            </div>

            <div>
              ${winRate.toFixed(1)}%
            </div>

            <div class="${
              data.profit >= 0
                ? "positive"
                : "negative"
            }">

              ${formatMoney(data.profit)}

            </div>

          </div>

        `;

      }
    ).join("");

}


// ======================================================
// MISTAKE ANALYTICS
// ======================================================

function updateMistakeAnalytics() {

  const container =
    document.getElementById(
      "mistakeAnalytics"
    );

  if (!container) return;


  const mistakes = {};


  allTrades.forEach(trade => {

    const mistake =
      trade.mistake || "No mistake";


    if (!mistakes[mistake]) {

      mistakes[mistake] = {
        count: 0,
        profit: 0
      };

    }


    mistakes[mistake].count++;

    mistakes[mistake].profit +=
      Number(trade.profit) || 0;

  });


  const entries =
    Object.entries(mistakes);


  if (!entries.length) {

    container.innerHTML =
      `<p class="empty-state">
        No mistake data yet.
      </p>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([mistake, data]) => `

        <div class="analytics-row">

          <div>
            <strong>
              ${escapeHTML(mistake)}
            </strong>
          </div>

          <div>
            ${data.count}
          </div>

          <div class="${
            data.profit >= 0
              ? "positive"
              : "negative"
          }">

            ${formatMoney(data.profit)}

          </div>

        </div>

      `
    ).join("");

}


// ======================================================
// WEEKLY STATS
// ======================================================

function updateWeeklyStats() {

  const container =
    document.getElementById(
      "weeklyStats"
    );

  if (!container) return;


  const weeks = {};


  allTrades.forEach(trade => {

    if (!trade.date) return;


    const date =
      new Date(
        `${trade.date}T00:00:00`
      );


    const year =
      date.getFullYear();


    const week =
      getWeekNumber(date);


    const key =
      `${year}-W${String(week).padStart(2, "0")}`;


    if (!weeks[key]) {

      weeks[key] = {
        trades: 0,
        profit: 0,
        wins: 0
      };

    }


    weeks[key].trades++;

    weeks[key].profit +=
      Number(trade.profit) || 0;


    if (
      normalizeResult(trade.result) ===
      "win"
    ) {

      weeks[key].wins++;

    }

  });


  const entries =
    Object.entries(weeks)
      .sort(
        (a, b) =>
          b[0].localeCompare(a[0])
      );


  container.innerHTML =
    entries.map(
      ([week, data]) => {

        const winRate =
          data.trades
            ? data.wins /
              data.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <div>
              <strong>
                ${week}
              </strong>
            </div>

            <div>
              ${data.trades} trades
            </div>

            <div>
              ${winRate.toFixed(1)}%
            </div>

            <div class="${
              data.profit >= 0
                ? "positive"
                : "negative"
            }">

              ${formatMoney(data.profit)}

            </div>

          </div>

        `;

      }
    ).join("");

}


// ======================================================
// MONTHLY STATS
// ======================================================

function updateMonthlyStats() {

  const container =
    document.getElementById(
      "monthlyStats"
    );

  if (!container) return;


  const months = {};


  allTrades.forEach(trade => {

    if (!trade.date) return;


    const key =
      trade.date.slice(0, 7);


    if (!months[key]) {

      months[key] = {
        trades: 0,
        profit: 0,
        wins: 0
      };

    }


    months[key].trades++;

    months[key].profit +=
      Number(trade.profit) || 0;


    if (
      normalizeResult(trade.result) ===
      "win"
    ) {

      months[key].wins++;

    }

  });


  const entries =
    Object.entries(months)
      .sort(
        (a, b) =>
          b[0].localeCompare(a[0])
      );


  container.innerHTML =
    entries.map(
      ([month, data]) => {

        const winRate =
          data.trades
            ? data.wins /
              data.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <div>
              <strong>
                ${month}
              </strong>
            </div>

            <div>
              ${data.trades} trades
            </div>

            <div>
              ${winRate.toFixed(1)}%
            </div>

            <div class="${
              data.profit >= 0
                ? "positive"
                : "negative"
            }">

              ${formatMoney(data.profit)}

            </div>

          </div>

        `;

      }
    ).join("");

}


// ======================================================
// EQUITY CURVE
// ======================================================

function updateEquityCurve() {

  const canvas =
    document.getElementById(
      "equityCurve"
    );

  if (!canvas) return;


  const ctx =
    canvas.getContext("2d");


  const width =
    canvas.clientWidth ||
    700;


  const height =
    canvas.clientHeight ||
    300;


  const ratio =
    window.devicePixelRatio || 1;


  canvas.width =
    width * ratio;


  canvas.height =
    height * ratio;


  ctx.scale(
    ratio,
    ratio
  );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const sorted =
    [...allTrades].sort(
      (a, b) =>
        `${a.date} ${a.time}`
          .localeCompare(
            `${b.date} ${b.time}`
          )
    );


  if (!sorted.length) {

    ctx.font =
      "14px Arial";

    ctx.fillText(
      "No trade data yet.",
      20,
      30
    );

    return;

  }


  let equity =
    Number(accountSettings.startingBalance) ||
    0;


  const values =
    [equity];


  sorted.forEach(trade => {

    equity +=
      Number(trade.profit) || 0;

    values.push(equity);

  });


  const min =
    Math.min(...values);


  const max =
    Math.max(...values);


  const range =
    max - min || 1;


  const padding = 30;


  ctx.beginPath();


  values.forEach(
    (value, index) => {

      const x =
        padding +
        index *
        (
          (width - padding * 2) /
          Math.max(
            values.length - 1,
            1
          )
        );


      const y =
        height -
        padding -
        (
          (value - min) /
          range
        ) *
        (
          height -
          padding * 2
        );


      if (index === 0) {

        ctx.moveTo(x, y);

      } else {

        ctx.lineTo(x, y);

      }

    }
  );


  ctx.strokeStyle =
    "#24d18a";

  ctx.lineWidth = 2;

  ctx.stroke();

}


// ======================================================
// CSV EXPORT
// ======================================================

const exportCsvBtn =
  document.getElementById(
    "exportCsvBtn"
  );


if (exportCsvBtn) {

  exportCsvBtn.addEventListener(
    "click",
    exportCSV
  );

}


function exportCSV() {

  if (!allTrades.length) {

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
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"

  ];


  const rows =
    allTrades.map(trade => [

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
      trade.profit,
      trade.psychology,
      trade.confidence,
      trade.mistake,
      trade.notes

    ]);


  const csv = [

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
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");


  link.href = url;

  link.download =
    "UjR-Fx-Trading-Journal.csv";


  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);


  showToast(
    "CSV exported.",
    "success"
  );

}


// ======================================================
// UTILITY FUNCTIONS
// ======================================================

function getValue(id) {

  return (
    document.getElementById(id)?.value ||
    ""
  );

}


function setText(id, value) {

  const element =
    document.getElementById(id);

  if (element) {

    element.textContent = value;

  }

}


function formatNumber(value) {

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toFixed(2);

}


function formatMoney(value) {

  const number =
    Number(value) || 0;


  const currency =
    accountSettings.currency || "$";


  return `${currency}${number.toFixed(2)}`;

}


function normalizeResult(result) {

  return String(
    result || ""
  )
    .trim()
    .toLowerCase();

}


function getToday() {

  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");


  const day =
    String(
      now.getDate()
    ).padStart(2, "0");


  return `${year}-${month}-${day}`;

}


function getWeekNumber(date) {

  const d =
    new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    );


  const dayNum =
    d.getUTCDay() || 7;


  d.setUTCDate(
    d.getUTCDate() +
    4 -
    dayNum
  );


  const yearStart =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );


  return Math.ceil(
    (
      (
        (d - yearStart) /
        86400000
      ) + 1
    ) / 7
  );

}


function escapeHTML(value) {

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


// ======================================================
// TOAST
// ======================================================

function showToast(
  message,
  type = "success"
) {

  let toast =
    document.getElementById(
      "toast"
    );


  if (!toast) {

    toast =
      document.createElement("div");

    toast.id = "toast";

    document.body.appendChild(toast);

  }


  toast.textContent =
    message;


  toast.className =
    `toast ${type}`;


  toast.classList.add("show");


  setTimeout(() => {

    toast.classList.remove("show");

  }, 3000);

}


// ======================================================
// GLOBAL FUNCTIONS
// ======================================================

window.editTrade = editTrade;
window.deleteTrade = deleteTrade;


// ======================================================
// SERVICE WORKER
// ======================================================

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .then(() => {

          console.log(
            "Service Worker registered."
          );

        })
        .catch(error => {

          console.log(
            "Service Worker not registered:",
            error
          );

        });

    }
  );

}


// ======================================================
// WINDOW RESIZE
// ======================================================

window.addEventListener(
  "resize",
  () => {

    updateEquityCurve();

  }
);


console.log(
  "UjR Fx Trading Journal loaded successfully."
);
