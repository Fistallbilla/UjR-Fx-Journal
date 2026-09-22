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
let allTrades = [];

let unsubscribeTrades = null;
let unsubscribeSettings = null;

let accountSettings = {
  startingBalance: 0,
  currency: "$"
};

let editingTradeId = null;


// ======================================================
// DOM
// ======================================================

const $ = (id) => document.getElementById(id);


// Login
const loginScreen = $("loginScreen");
const appScreen = $("appScreen");
const googleLoginBtn = $("googleLoginBtn");
const logoutBtn = $("logoutBtn");


// User
const userName = $("userName");
const userPhoto = $("userPhoto");


// Account
const startingBalanceInput = $("startingBalance");
const currencyInput = $("currency");
const saveAccountBtn = $("saveAccountBtn");


// Trade
const tradeModal = $("tradeModal");
const tradeForm = $("tradeForm");


// ======================================================
// SAFE ELEMENT CHECK
// ======================================================

function exists(element) {
  return element !== null && element !== undefined;
}


// ======================================================
// TOAST
// ======================================================

function showToast(message, type = "info") {

  let toast = $("toast");

  if (!toast) {

    toast = document.createElement("div");

    toast.id = "toast";

    toast.style.position = "fixed";
    toast.style.bottom = "25px";
    toast.style.right = "25px";
    toast.style.zIndex = "99999";
    toast.style.padding = "14px 18px";
    toast.style.borderRadius = "12px";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    toast.style.transition = "all .25s";

    document.body.appendChild(toast);
  }

  if (type === "error") {
    toast.style.background = "#ff4d67";
    toast.style.color = "#fff";
  }

  else if (type === "success") {
    toast.style.background = "#20c997";
    toast.style.color = "#fff";
  }

  else {
    toast.style.background = "#263244";
    toast.style.color = "#fff";
  }

  toast.textContent = message;

  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}


// ======================================================
// LOGIN
// ======================================================

if (exists(googleLoginBtn)) {

  googleLoginBtn.addEventListener("click", async () => {

    try {

      googleLoginBtn.disabled = true;

      googleLoginBtn.textContent = "Signing in...";

      await signInWithPopup(auth, provider);

    }

    catch (error) {

      console.error("LOGIN ERROR:", error);

      showToast(
        error.message || "Google login failed.",
        "error"
      );

      googleLoginBtn.disabled = false;

      googleLoginBtn.textContent = "Continue with Google";
    }

  });

}


// ======================================================
// LOGOUT
// ======================================================

if (exists(logoutBtn)) {

  logoutBtn.addEventListener("click", async () => {

    try {

      await signOut(auth);

      showToast("Logged out successfully.", "success");

    }

    catch (error) {

      console.error("LOGOUT ERROR:", error);

      showToast(
        error.message || "Logout failed.",
        "error"
      );
    }

  });

}


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;

    console.log("Logged in:", user.email);

    if (exists(loginScreen)) {
      loginScreen.style.display = "none";
    }

    if (exists(appScreen)) {
      appScreen.style.display = "block";
    }

    if (exists(userName)) {
      userName.textContent =
        user.displayName || user.email || "Trader";
    }

    if (exists(userPhoto)) {

      if (user.photoURL) {
        userPhoto.src = user.photoURL;
      }

      else {
        userPhoto.style.display = "none";
      }
    }

    loadAccountSettings();

    loadTrades();

  }

  else {

    currentUser = null;

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    if (unsubscribeSettings) {
      unsubscribeSettings();
      unsubscribeSettings = null;
    }

    if (exists(loginScreen)) {
      loginScreen.style.display = "flex";
    }

    if (exists(appScreen)) {
      appScreen.style.display = "none";
    }

  }

});


// ======================================================
// ACCOUNT SETTINGS
// ======================================================

function loadAccountSettings() {

  if (!currentUser) return;

  const settingsRef = doc(
    db,
    "users",
    currentUser.uid,
    "settings",
    "account"
  );

  if (unsubscribeSettings) {
    unsubscribeSettings();
  }

  unsubscribeSettings = onSnapshot(
    settingsRef,

    (snapshot) => {

      if (snapshot.exists()) {

        const data = snapshot.data();

        accountSettings.startingBalance =
          Number(data.startingBalance) || 0;

        accountSettings.currency =
          data.currency || "$";

      }

      else {

        accountSettings = {
          startingBalance: 0,
          currency: "$"
        };

      }

      updateAccountInputs();

      updateDashboard();

    },

    (error) => {

      console.error(
        "ACCOUNT LOAD ERROR:",
        error
      );

      showToast(
        "Could not load account settings.",
        "error"
      );

    }
  );
}


// ======================================================
// UPDATE ACCOUNT INPUTS
// ======================================================

function updateAccountInputs() {

  if (exists(startingBalanceInput)) {

    startingBalanceInput.value =
      accountSettings.startingBalance;
  }

  if (exists(currencyInput)) {

    currencyInput.value =
      accountSettings.currency;
  }
}


// ======================================================
// SAVE ACCOUNT
// ======================================================

if (exists(saveAccountBtn)) {

  saveAccountBtn.addEventListener("click", async () => {

    if (!currentUser) {

      showToast(
        "Please login first.",
        "error"
      );

      return;
    }

    const balance =
      Number(
        startingBalanceInput?.value
      );

    const currency =
      currencyInput?.value?.trim() || "$";


    // Validate balance

    if (!Number.isFinite(balance) || balance < 0) {

      showToast(
        "Enter a valid demo balance.",
        "error"
      );

      return;
    }


    try {

      saveAccountBtn.disabled = true;

      saveAccountBtn.textContent = "Saving...";


      // IMPORTANT:
      // Exact Firestore path:
      // users / USER_ID / settings / account

      const settingsRef = doc(
        db,
        "users",
        currentUser.uid,
        "settings",
        "account"
      );


      await setDoc(
        settingsRef,
        {
          startingBalance: balance,
          currency: currency,
          updatedAt: serverTimestamp()
        },
        {
          merge: true
        }
      );


      // Update local state immediately

      accountSettings = {
        startingBalance: balance,
        currency: currency
      };


      updateDashboard();


      showToast(
        "Demo balance saved successfully!",
        "success"
      );

    }

    catch (error) {

      console.error(
        "SAVE ACCOUNT ERROR:",
        error
      );


      let message =
        "Could not save account.";


      if (
        error.code ===
        "permission-denied"
      ) {

        message =
          "Firestore permission denied. Update your Firestore rules.";

      }

      else if (
        error.code ===
        "failed-precondition"
      ) {

        message =
          "Firestore database is not ready.";

      }

      else if (
        error.code ===
        "unavailable"
      ) {

        message =
          "Firebase is unavailable. Check your internet.";

      }

      else if (error.message) {

        message =
          error.message;
      }


      showToast(
        message,
        "error"
      );

    }

    finally {

      saveAccountBtn.disabled = false;

      saveAccountBtn.textContent =
        "Save Account";

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


  if (unsubscribeTrades) {
    unsubscribeTrades();
  }


  unsubscribeTrades = onSnapshot(

    tradesRef,

    (snapshot) => {

      allTrades = [];

      snapshot.forEach((item) => {

        allTrades.push({
          id: item.id,
          ...item.data()
        });

      });


      allTrades.sort(
        (a, b) =>
          String(b.date || "").localeCompare(
            String(a.date || "")
          )
      );


      renderTrades();

      updateDashboard();

      updateAnalytics();

    },

    (error) => {

      console.error(
        "TRADES LOAD ERROR:",
        error
      );

      showToast(
        "Could not load trades.",
        "error"
      );

    }

  );

}


// ======================================================
// SAVE TRADE
// ======================================================

async function saveTrade(tradeData) {

  if (!currentUser) {

    showToast(
      "Please login first.",
      "error"
    );

    return;
  }


  try {

    if (editingTradeId) {

      const tradeRef = doc(
        db,
        "users",
        currentUser.uid,
        "trades",
        editingTradeId
      );


      await updateDoc(
        tradeRef,
        {
          ...tradeData,
          updatedAt: serverTimestamp()
        }
      );


      showToast(
        "Trade updated.",
        "success"
      );

    }

    else {

      const tradesRef = collection(
        db,
        "users",
        currentUser.uid,
        "trades"
      );


      await addDoc(
        tradesRef,
        {
          ...tradeData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );


      showToast(
        "Trade saved.",
        "success"
      );

    }


    editingTradeId = null;

    closeTradeModal();

  }

  catch (error) {

    console.error(
      "SAVE TRADE ERROR:",
      error
    );

    showToast(
      error.message ||
      "Could not save trade.",
      "error"
    );

  }

}


// ======================================================
// TRADE FORM
// ======================================================

if (exists(tradeForm)) {

  tradeForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const getValue = (id) =>
        $(id)?.value?.trim() || "";


      const entry =
        Number(getValue("entry"));

      const sl =
        Number(getValue("sl"));

      const tp =
        Number(getValue("tp"));

      const riskPercent =
        Number(getValue("riskPercent")) || 0;

      const profit =
        Number(getValue("profit")) || 0;


      let rr = 0;


      if (
        Number.isFinite(entry) &&
        Number.isFinite(sl) &&
        Number.isFinite(tp) &&
        entry !== sl
      ) {

        rr =
          Math.abs(tp - entry) /
          Math.abs(entry - sl);

      }


      const riskAmount =
        accountSettings.startingBalance *
        riskPercent /
        100;


      const tradeData = {

        date: getValue("tradeDate") ||
          getValue("date"),

        time: getValue("tradeTime") ||
          getValue("time"),

        pair:
          getValue("pair") || "XAUUSD",

        direction:
          getValue("direction"),

        entry,
        sl,
        tp,

        rr:
          Number(rr.toFixed(2)),

        risk:
          riskAmount,

        reward:
          riskAmount * rr,

        riskPercent,

        riskAmount,

        lotSize:
          Number(getValue("lotSize")) || 0,

        setup:
          getValue("setup"),

        session:
          getValue("session"),

        htfBias:
          getValue("htfBias"),

        liquidity:
          getValue("liquidity"),

        confirmation:
          getValue("confirmation"),

        result:
          getValue("result"),

        profit,

        psychology:
          getValue("psychology"),

        confidence:
          Number(getValue("confidence")) || 0,

        mistake:
          getValue("mistake"),

        notes:
          getValue("notes")

      };


      await saveTrade(tradeData);

    }
  );

}


// ======================================================
// DELETE TRADE
// ======================================================

window.deleteTrade = async function(id) {

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
      "Trade deleted.",
      "success"
    );

  }

  catch (error) {

    console.error(
      "DELETE ERROR:",
      error
    );

    showToast(
      "Could not delete trade.",
      "error"
    );

  }

};


// ======================================================
// EDIT TRADE
// ======================================================

window.editTrade = function(id) {

  const trade =
    allTrades.find(
      item => item.id === id
    );


  if (!trade) return;


  editingTradeId = id;


  const setValue = (id, value) => {

    const element = $(id);

    if (element) {
      element.value =
        value ?? "";
    }

  };


  setValue(
    "tradeDate",
    trade.date
  );

  setValue(
    "date",
    trade.date
  );

  setValue(
    "tradeTime",
    trade.time
  );

  setValue(
    "time",
    trade.time
  );

  setValue(
    "pair",
    trade.pair
  );

  setValue(
    "direction",
    trade.direction
  );

  setValue(
    "entry",
    trade.entry
  );

  setValue(
    "sl",
    trade.sl
  );

  setValue(
    "tp",
    trade.tp
  );

  setValue(
    "riskPercent",
    trade.riskPercent
  );

  setValue(
    "lotSize",
    trade.lotSize
  );

  setValue(
    "setup",
    trade.setup
  );

  setValue(
    "session",
    trade.session
  );

  setValue(
    "htfBias",
    trade.htfBias
  );

  setValue(
    "liquidity",
    trade.liquidity
  );

  setValue(
    "confirmation",
    trade.confirmation
  );

  setValue(
    "result",
    trade.result
  );

  setValue(
    "profit",
    trade.profit
  );

  setValue(
    "psychology",
    trade.psychology
  );

  setValue(
    "confidence",
    trade.confidence
  );

  setValue(
    "mistake",
    trade.mistake
  );

  setValue(
    "notes",
    trade.notes
  );


  openTradeModal();

};


// ======================================================
// MODAL
// ======================================================

window.openTradeModal =
  function () {

    if (!tradeModal) return;

    tradeModal.style.display = "flex";

  };


window.closeTradeModal =
  function () {

    if (!tradeModal) return;

    tradeModal.style.display = "none";

    editingTradeId = null;

  };


// ======================================================
// OPEN ADD TRADE BUTTON
// ======================================================

const addTradeBtn =
  $("addTradeBtn");


if (exists(addTradeBtn)) {

  addTradeBtn.addEventListener(
    "click",
    () => {

      editingTradeId = null;

      if (tradeForm) {
        tradeForm.reset();
      }

      openTradeModal();

    }
  );

}


// ======================================================
// CLOSE MODAL BUTTONS
// ======================================================

document
  .querySelectorAll(
    "[data-close-modal]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      closeTradeModal
    );

  });


// ======================================================
// ESC CLOSE MODAL
// ======================================================

document.addEventListener(
  "keydown",
  (event) => {

    if (event.key === "Escape") {
      closeTradeModal();
    }

  }
);


// ======================================================
// RENDER TRADES
// ======================================================

function renderTrades() {

  const tableBody =
    $("tradeTableBody");


  if (!tableBody) return;


  tableBody.innerHTML = "";


  if (allTrades.length === 0) {

    tableBody.innerHTML = `
      <tr>
        <td colspan="100%">
          No trades yet.
        </td>
      </tr>
    `;

    return;
  }


  allTrades.forEach(trade => {

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
        ${escapeHTML(trade.pair || "XAUUSD")}
      </td>

      <td>
        ${escapeHTML(trade.direction || "-")}
      </td>

      <td>
        ${escapeHTML(trade.setup || "-")}
      </td>

      <td>
        ${escapeHTML(trade.result || "-")}
      </td>

      <td class="${profitClass}">
        ${formatMoney(profit)}
      </td>

      <td>
        ${Number(trade.rr || 0).toFixed(2)}
      </td>

      <td>

        <button
          onclick="editTrade('${trade.id}')">
          Edit
        </button>

        <button
          onclick="deleteTrade('${trade.id}')">
          Delete
        </button>

      </td>

    `;


    tableBody.appendChild(row);

  });

}


// ======================================================
// DASHBOARD
// ======================================================

function updateDashboard() {

  const total =
    allTrades.length;


  const wins =
    allTrades.filter(
      trade =>
        String(trade.result)
          .toLowerCase() === "win"
    ).length;


  const losses =
    allTrades.filter(
      trade =>
        String(trade.result)
          .toLowerCase() === "loss"
    ).length;


  const winRate =
    total > 0
      ? (wins / total) * 100
      : 0;


  const totalProfit =
    allTrades.reduce(
      (sum, trade) =>
        sum +
        (Number(trade.profit) || 0),
      0
    );


  const currentBalance =
    accountSettings.startingBalance +
    totalProfit;


  const profitFactor =
    calculateProfitFactor();


  const expectancy =
    total > 0
      ? totalProfit / total
      : 0;


  setText(
    "totalTrades",
    total
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


  const averageRR =
    total > 0
      ? allTrades.reduce(
          (sum, trade) =>
            sum +
            (Number(trade.rr) || 0),
          0
        ) / total
      : 0;


  setText(
    "averageRR",
    averageRR.toFixed(2)
  );


  setText(
    "averageWin",
    formatMoney(
      calculateAverageWin()
    )
  );


  setText(
    "averageLoss",
    formatMoney(
      calculateAverageLoss()
    )
  );


  setText(
    "maxDrawdown",
    formatMoney(
      calculateMaxDrawdown()
    )
  );


  renderEquityCurve();

}


// ======================================================
// ANALYTICS
// ======================================================

function updateAnalytics() {

  updateStreaks();

  updateSetupAnalytics();

  updateMistakeAnalytics();

}


// ======================================================
// STREAKS
// ======================================================

function updateStreaks() {

  const sorted =
    [...allTrades].sort(
      (a, b) =>
        String(a.date || "")
          .localeCompare(
            String(b.date || "")
          )
    );


  let currentWin = 0;
  let bestWin = 0;

  let currentLoss = 0;
  let worstLoss = 0;


  sorted.forEach(trade => {

    const result =
      String(
        trade.result || ""
      ).toLowerCase();


    if (result === "win") {

      currentWin++;
      currentLoss = 0;

      bestWin =
        Math.max(
          bestWin,
          currentWin
        );

    }

    else if (result === "loss") {

      currentLoss++;
      currentWin = 0;

      worstLoss =
        Math.max(
          worstLoss,
          currentLoss
        );

    }

  });


  let currentStreak = 0;


  for (
    let i = sorted.length - 1;
    i >= 0;
    i--
  ) {

    const result =
      String(
        sorted[i].result || ""
      ).toLowerCase();


    if (i === sorted.length - 1) {

      currentStreak =
        result === "win"
          ? 1
          : result === "loss"
          ? -1
          : 0;

    }

    else {

      if (
        currentStreak > 0 &&
        result === "win"
      ) {
        currentStreak++;
      }

      else if (
        currentStreak < 0 &&
        result === "loss"
      ) {
        currentStreak--;
      }

      else {
        break;
      }

    }

  }


  setText(
    "currentStreak",
    currentStreak
  );

  setText(
    "bestWinStreak",
    bestWin
  );

  setText(
    "worstLossStreak",
    worstLoss
  );

}


// ======================================================
// SETUP ANALYTICS
// ======================================================

function updateSetupAnalytics() {

  const container =
    $("setupAnalytics");


  if (!container) return;


  const groups = {};


  allTrades.forEach(trade => {

    const setup =
      trade.setup || "Unknown";


    if (!groups[setup]) {

      groups[setup] = {
        count: 0,
        profit: 0,
        wins: 0
      };

    }


    groups[setup].count++;

    groups[setup].profit +=
      Number(trade.profit) || 0;


    if (
      String(trade.result)
        .toLowerCase() === "win"
    ) {
      groups[setup].wins++;
    }

  });


  container.innerHTML = "";


  Object.entries(groups)
    .forEach(
      ([setup, data]) => {

        const winRate =
          data.count > 0
            ? data.wins /
              data.count *
              100
            : 0;


        const div =
          document.createElement("div");


        div.className =
          "analytics-item";


        div.innerHTML = `

          <strong>
            ${escapeHTML(setup)}
          </strong>

          <span>
            ${data.count} trades
          </span>

          <span>
            Win rate:
            ${winRate.toFixed(1)}%
          </span>

          <span>
            P/L:
            ${formatMoney(data.profit)}
          </span>

        `;


        container.appendChild(div);

      }
    );

}


// ======================================================
// MISTAKE ANALYTICS
// ======================================================

function updateMistakeAnalytics() {

  const container =
    $("mistakeAnalytics");


  if (!container) return;


  const groups = {};


  allTrades.forEach(trade => {

    const mistake =
      trade.mistake || "No mistake";


    groups[mistake] =
      (groups[mistake] || 0) + 1;

  });


  container.innerHTML = "";


  Object.entries(groups)
    .sort(
      (a, b) =>
        b[1] - a[1]
    )
    .forEach(
      ([mistake, count]) => {

        const div =
          document.createElement("div");


        div.className =
          "analytics-item";


        div.innerHTML = `

          <strong>
            ${escapeHTML(mistake)}
          </strong>

          <span>
            ${count} trade(s)
          </span>

        `;


        container.appendChild(div);

      }
    );

}


// ======================================================
// EQUITY CURVE
// ======================================================

function renderEquityCurve() {

  const canvas =
    $("equityCurve");


  if (!canvas) return;


  const ctx =
    canvas.getContext("2d");


  if (!ctx) return;


  const width =
    canvas.clientWidth || 600;


  const height =
    canvas.clientHeight || 250;


  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;


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


  if (allTrades.length === 0) {

    ctx.fillStyle = "#8b98aa";

    ctx.font = "14px Arial";

    ctx.fillText(
      "No trade data yet.",
      20,
      30
    );

    return;
  }


  const sorted =
    [...allTrades].sort(
      (a, b) =>
        String(a.date || "")
          .localeCompare(
            String(b.date || "")
          )
    );


  let balance =
    Number(
      accountSettings.startingBalance
    ) || 0;


  const points = [];


  sorted.forEach(
    trade => {

      balance +=
        Number(trade.profit) || 0;

      points.push(balance);

    }
  );


  const min =
    Math.min(
      ...points,
      accountSettings.startingBalance
    );


  const max =
    Math.max(
      ...points,
      accountSettings.startingBalance
    );


  const range =
    max - min || 1;


  const padding = 30;


  ctx.beginPath();


  points.forEach(
    (value, index) => {

      const x =
        padding +
        (
          index /
          Math.max(
            points.length - 1,
            1
          )
        ) *
        (width - padding * 2);


      const y =
        height -
        padding -
        (
          (value - min) /
          range
        ) *
        (height - padding * 2);


      if (index === 0) {
        ctx.moveTo(x, y);
      }

      else {
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
// HELPER FUNCTIONS
// ======================================================

function setText(
  id,
  value
) {

  const element =
    $(id);

  if (element) {
    element.textContent =
      value;
  }

}


function formatMoney(value) {

  const number =
    Number(value) || 0;


  const symbol =
    accountSettings.currency || "$";


  return (
    number < 0
      ? `-${symbol}${Math.abs(number).toFixed(2)}`
      : `${symbol}${number.toFixed(2)}`
  );

}


function calculateProfitFactor() {

  let grossProfit = 0;
  let grossLoss = 0;


  allTrades.forEach(
    trade => {

      const profit =
        Number(trade.profit) || 0;


      if (profit > 0) {
        grossProfit += profit;
      }

      else if (profit < 0) {
        grossLoss +=
          Math.abs(profit);
      }

    }
  );


  if (grossLoss === 0) {

    return grossProfit > 0
      ? Infinity
      : 0;

  }


  return (
    grossProfit /
    grossLoss
  );

}


function calculateAverageWin() {

  const wins =
    allTrades
      .map(
        trade =>
          Number(trade.profit) || 0
      )
      .filter(
        value => value > 0
      );


  if (!wins.length) return 0;


  return (
    wins.reduce(
      (a, b) => a + b,
      0
    ) /
    wins.length
  );

}


function calculateAverageLoss() {

  const losses =
    allTrades
      .map(
        trade =>
          Number(trade.profit) || 0
      )
      .filter(
        value => value < 0
      );


  if (!losses.length) return 0;


  return (
    losses.reduce(
      (a, b) => a + b,
      0
    ) /
    losses.length
  );

}


function calculateMaxDrawdown() {

  const sorted =
    [...allTrades].sort(
      (a, b) =>
        String(a.date || "")
          .localeCompare(
            String(b.date || "")
          )
    );


  let balance =
    Number(
      accountSettings.startingBalance
    ) || 0;


  let peak =
    balance;


  let maxDrawdown = 0;


  sorted.forEach(
    trade => {

      balance +=
        Number(trade.profit) || 0;


      if (balance > peak) {
        peak = balance;
      }


      const drawdown =
        balance - peak;


      if (
        drawdown <
        maxDrawdown
      ) {

        maxDrawdown =
          drawdown;

      }

    }
  );


  return maxDrawdown;

}


function escapeHTML(value) {

  return String(value)
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


// ======================================================
// SEARCH + FILTERS
// ======================================================

const searchInput =
  $("tradeSearch");

const resultFilter =
  $("resultFilter");

const directionFilter =
  $("directionFilter");

const setupFilter =
  $("setupFilter");


function applyFilters() {

  const search =
    searchInput?.value
      ?.toLowerCase()
      .trim() || "";


  const result =
    resultFilter?.value || "";


  const direction =
    directionFilter?.value || "";


  const setup =
    setupFilter?.value || "";


  const rows =
    document.querySelectorAll(
      "#tradeTableBody tr"
    );


  rows.forEach(row => {

    const text =
      row.textContent
        .toLowerCase();


    let show = true;


    if (
      search &&
      !text.includes(search)
    ) {
      show = false;
    }


    if (
      result &&
      !text.includes(
        result.toLowerCase()
      )
    ) {
      show = false;
    }


    if (
      direction &&
      !text.includes(
        direction.toLowerCase()
      )
    ) {
      show = false;
    }


    if (
      setup &&
      !text.includes(
        setup.toLowerCase()
      )
    ) {
      show = false;
    }


    row.style.display =
      show
        ? ""
        : "none";

  });

}


[
  searchInput,
  resultFilter,
  directionFilter,
  setupFilter
]
.forEach(
  element => {

    if (element) {

      element.addEventListener(
        "input",
        applyFilters
      );

      element.addEventListener(
        "change",
        applyFilters
      );

    }

  }
);


// ======================================================
// CSV EXPORT
// ======================================================

const exportCSVBtn =
  $("exportCSV");


if (exportCSVBtn) {

  exportCSVBtn.addEventListener(
    "click",
    () => {

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
        allTrades.map(
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
            trade.profit,
            trade.psychology,
            trade.confidence,
            trade.mistake,
            trade.notes

          ]
        );


      const csv = [

        headers,

        ...rows

      ]
      .map(
        row =>
          row
            .map(
              value =>
                `"${String(
                  value ?? ""
                ).replace(
                  /"/g,
                  '""'
                )}"`
            )
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
        "UjR_Fx_Trading_Journal.csv";


      document.body.appendChild(link);

      link.click();

      link.remove();


      URL.revokeObjectURL(url);


      showToast(
        "CSV exported.",
        "success"
      );

    }
  );

}


// ======================================================
// INITIAL UI
// ======================================================

if (exists(appScreen)) {
  appScreen.style.display = "none";
}


if (exists(loginScreen)) {
  loginScreen.style.display = "flex";
}


// ======================================================
// SERVICE WORKER
// ======================================================

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .then(
          () =>
            console.log(
              "Service Worker registered."
            )
        )
        .catch(
          error =>
            console.log(
              "Service Worker:",
              error
            )
        );

    }
  );

}
