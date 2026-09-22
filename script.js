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
  apiKey: "AIzaSyADCB2Vke4iXLm1zPj43cNQwC65GZlQ6Ns",
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

const $ = id => document.getElementById(id);


function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


function money(value) {

  const amount = number(value);

  const currency = account.currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}


function moneyClass(value) {

  const n = number(value);

  if (n > 0) return "pl-profit";
  if (n < 0) return "pl-loss";

  return "pl-zero";
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

  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


function showToast(message, type = "success") {

  const toast = $("toast");

  toast.textContent = message;

  toast.className = `toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}


/* =========================================================
   AUTH
========================================================= */

async function login() {

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error(error);

    $("loginError").textContent =
      error.message || "Google login failed.";
  }
}


async function logout() {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

  }
}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  if (!currentUser) return;

  const name =
    currentUser.displayName ||
    "Trader";

  const email =
    currentUser.email ||
    "";

  $("userName").textContent = name;
  $("userEmail").textContent = email;

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;

  const initial =
    name.charAt(0).toUpperCase() || "U";

  $("userAvatar").innerHTML = "";
  $("settingsAvatar").innerHTML = "";

  if (currentUser.photoURL) {

    const img1 = document.createElement("img");
    img1.src = currentUser.photoURL;
    img1.alt = "Profile";

    const img2 = document.createElement("img");
    img2.src = currentUser.photoURL;
    img2.alt = "Profile";

    $("userAvatar").appendChild(img1);
    $("settingsAvatar").appendChild(img2);

  } else {

    $("userAvatar").textContent = initial;
    $("settingsAvatar").textContent = initial;
  }
}


/* =========================================================
   ACCOUNT
========================================================= */

async function loadAccount() {

  if (!currentUser) return;

  const accountRef = doc(
    db,
    "users",
    currentUser.uid,
    "settings",
    "account"
  );

  try {

    const snapshot = await getDoc(accountRef);

    if (snapshot.exists()) {

      const data = snapshot.data();

      account = {
        startingBalance:
          number(data.startingBalance),

        currency:
          data.currency || "USD"
      };

    }

    updateAccountUI();

  } catch (error) {

    console.error("Account load error:", error);

  }
}


function updateAccountUI() {

  $("startingBalance").value =
    account.startingBalance || "";

  $("currency").value =
    account.currency || "USD";

  $("calcBalance").value =
    account.startingBalance || "";

  renderDashboard();
  renderJournal();
  renderAnalytics();
  renderCalendar();
}


async function saveSettings() {

  if (!currentUser) return;

  const balance =
    number($("startingBalance").value);

  const currency =
    $("currency").value || "USD";

  account = {
    startingBalance: balance,
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

    $("settingsMessage").textContent =
      "Settings saved.";

    updateAccountUI();

    showToast("Settings saved successfully.");

    setTimeout(() => {
      $("settingsMessage").textContent = "";
    }, 2500);

  } catch (error) {

    console.error(error);

    showToast(
      "Could not save settings.",
      "error"
    );
  }
}


/* =========================================================
   TRADES
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

    snapshot => {

      trades = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      trades.sort((a, b) => {

        const aValue =
          `${a.date || ""} ${a.time || ""}`;

        const bValue =
          `${b.date || ""} ${b.time || ""}`;

        return bValue.localeCompare(aValue);
      });

      renderAll();

    },

    error => {

      console.error("Trade listener error:", error);

      showToast(
        "Could not load trades.",
        "error"
      );
    }
  );
}


/* =========================================================
   TRADE CALCULATIONS
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


/*
   IMPORTANT:

   Lot size is now editable manually.

   Whenever Entry/SL/Risk changes,
   we calculate a suggested lot size.

   But if the user manually changes the lot size,
   that value stays in the input.
*/

function calculateTradeRisk() {

  const balance =
    number(account.startingBalance);

  const riskPercent =
    number($("riskPercent").value);

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  if (
    balance <= 0 ||
    riskPercent <= 0
  ) {

    $("riskAmount").value = "";
    return;
  }

  const riskAmount =
    balance * riskPercent / 100;

  $("riskAmount").value =
    riskAmount.toFixed(2);

  const distance =
    Math.abs(entry - sl);

  if (distance <= 0) return;

  /*
    XAUUSD contract-size assumption:
    100 ounces per standard lot.
  */

  const contractSize = 100;

  const suggestedLot =
    riskAmount /
    (distance * contractSize);

  /*
    Only automatically fill the lot field
    if it is currently empty.

    This allows manual editing.
  */

  if (
    !$("lotSize").value ||
    $("lotSize").dataset.auto === "true"
  ) {

    $("lotSize").value =
      suggestedLot.toFixed(2);

    $("lotSize").dataset.auto = "true";
  }
}


function updateTradeCalculations() {

  calculateTradeRR();
  calculateTradeRisk();
}


/* =========================================================
   OPEN TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

  $("tradeForm").reset();

  $("tradeError").textContent = "";

  $("tradeId").value = "";

  $("modalTitle").textContent =
    trade ? "Edit Trade" : "Add Trade";


  if (trade) {

    $("tradeId").value = trade.id;

    $("tradeDate").value =
      trade.date || getLocalDate();

    $("tradeTime").value =
      trade.time || getLocalTime();

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

    $("rr").value =
      trade.rr || "";

    $("riskPercent").value =
      trade.riskPercent ?? 1;

    $("riskAmount").value =
      trade.riskAmount ?? "";

    $("lotSize").value =
      trade.lotSize ?? "";

    $("lotSize").dataset.auto =
      "false";

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
      trade.profitLoss ?? "";

    $("psychology").value =
      trade.psychology || "";

    $("confidence").value =
      trade.confidence || "";

    $("mistake").value =
      trade.mistake || "";

    $("notes").value =
      trade.notes || "";

  } else {

    $("tradeDate").value =
      getLocalDate();

    $("tradeTime").value =
      getLocalTime();

    $("pair").value =
      "XAUUSD";

    $("direction").value =
      "Buy";

    $("riskPercent").value =
      "1";

    $("result").value =
      "Win";

    $("lotSize").value = "";

    $("lotSize").dataset.auto =
      "true";
  }


  updateTradeCalculations();

  $("tradeModal").classList.remove("hidden");

  document.body.style.overflow = "hidden";
}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

  document.body.style.overflow = "";
}


/* =========================================================
   SAVE TRADE
========================================================= */

async function saveTrade(event) {

  event.preventDefault();

  if (!currentUser) return;

  $("tradeError").textContent = "";

  const rr =
    calculateTradeRR();

  if (!rr || rr <= 0) {

    $("tradeError").textContent =
      "Please check Entry, Stop Loss and Take Profit.";

    return;
  }


  const lotSize =
    number($("lotSize").value);

  if (lotSize <= 0) {

    $("tradeError").textContent =
      "Please enter a valid lot size.";

    return;
  }


  const tradeData = {

    date:
      $("tradeDate").value,

    time:
      $("tradeTime").value,

    pair:
      $("pair").value.trim().toUpperCase(),

    direction:
      $("direction").value,

    entry:
      number($("entry").value),

    sl:
      number($("sl").value),

    tp:
      number($("tp").value),

    rr:
      rr,

    riskPercent:
      number($("riskPercent").value),

    riskAmount:
      number($("riskAmount").value),

    lotSize:
      lotSize,

    setup:
      $("setup").value,

    session:
      $("session").value,

    htfBias:
      $("htfBias").value,

    liquidity:
      $("liquidity").value,

    confirmation:
      $("confirmation").value.trim(),

    result:
      $("result").value,

    profitLoss:
      number($("profitLoss").value),

    psychology:
      $("psychology").value,

    confidence:
      $("confidence").value,

    mistake:
      $("mistake").value,

    notes:
      $("notes").value.trim(),

    updatedAt:
      new Date().toISOString()
  };


  try {

    const id =
      $("tradeId").value;

    if (id) {

      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "trades",
          id
        ),
        tradeData
      );

      showToast("Trade updated.");

    } else {

      await addDoc(
        collection(
          db,
          "users",
          currentUser.uid,
          "trades"
        ),
        tradeData
      );

      showToast("Trade added.");

    }

    closeTradeModal();

  } catch (error) {

    console.error(error);

    $("tradeError").textContent =
      error.message ||
      "Could not save trade.";
  }
}


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

    showToast(
      "Could not delete trade.",
      "error"
    );
  }
}


/* =========================================================
   RESULT HTML
========================================================= */

function resultBadge(result) {

  if (result === "Win") {

    return `<span class="result-badge result-win">WIN</span>`;

  }

  if (result === "Loss") {

    return `<span class="result-badge result-loss">LOSS</span>`;

  }

  return `<span class="result-badge result-be">BE</span>`;
}


/* =========================================================
   DASHBOARD
========================================================= */

function getStats(list = trades) {

  const wins =
    list.filter(t => t.result === "Win");

  const losses =
    list.filter(t => t.result === "Loss");

  const be =
    list.filter(t => t.result === "BE");

  const totalPL =
    list.reduce(
      (sum, t) => sum + number(t.profitLoss),
      0
    );

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

  const winRate =
    list.length
      ? wins.length / list.length * 100
      : 0;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const rrValues =
    list
      .map(t => number(t.rr))
      .filter(v => v > 0);

  const averageRR =
    rrValues.length
      ? rrValues.reduce((a,b) => a+b,0) /
        rrValues.length
      : 0;

  return {
    wins,
    losses,
    be,
    totalPL,
    grossProfit,
    grossLoss,
    winRate,
    profitFactor,
    averageRR
  };
}


function renderDashboard() {

  const stats =
    getStats();

  const balance =
    account.startingBalance +
    stats.totalPL;

  $("dashBalance").textContent =
    money(balance);

  $("dashPL").textContent =
    money(stats.totalPL);

  $("dashPL").className =
    moneyClass(stats.totalPL);

  $("dashWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("dashTrades").textContent =
    trades.length;

  $("dashProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";

  $("dashRR").textContent =
    `${stats.averageRR.toFixed(2)}R`;

  $("performanceWinRate").textContent =
    `${stats.winRate.toFixed(0)}%`;

  $("performanceWins").textContent =
    stats.wins.length;

  $("performanceLosses").textContent =
    stats.losses.length;

  $("performanceBE").textContent =
    stats.be.length;


  const recent =
    trades.slice(0, 5);

  if (!recent.length) {

    $("recentTrades").innerHTML = `
      <div class="empty-state">
        <h3>No trades yet</h3>
        <p>Your recent trades will appear here.</p>
      </div>
    `;

    return;
  }


  $("recentTrades").innerHTML =
    recent.map(trade => {

      const pl =
        number(trade.profitLoss);

      return `
        <div class="recent-trade">

          <div class="trade-main">

            <strong>
              ${escapeHTML(trade.pair || "XAUUSD")}
              ·
              ${escapeHTML(trade.direction || "")}
            </strong>

            <small>
              ${escapeHTML(trade.date || "")}
              ${escapeHTML(trade.time || "")}
            </small>

          </div>

          <div class="trade-result">

            <strong class="${moneyClass(pl)}">
              ${pl > 0 ? "+" : ""}${money(pl)}
            </strong>

            <small>
              ${escapeHTML(trade.result || "")}
            </small>

          </div>

        </div>
      `;

    }).join("");
}


/* =========================================================
   JOURNAL
========================================================= */

function getFilteredTrades() {

  const search =
    $("tradeSearch").value
      .trim()
      .toLowerCase();

  const result =
    $("resultFilter").value;

  const direction =
    $("directionFilter").value;


  return trades.filter(trade => {

    const text =
      [
        trade.pair,
        trade.setup,
        trade.session,
        trade.notes,
        trade.confirmation
      ]
      .join(" ")
      .toLowerCase();


    const searchOK =
      !search ||
      text.includes(search);

    const resultOK =
      result === "All" ||
      trade.result === result;

    const directionOK =
      direction === "All" ||
      trade.direction === direction;

    return (
      searchOK &&
      resultOK &&
      directionOK
    );
  });
}


function renderJournal() {

  const list =
    getFilteredTrades();

  const stats =
    getStats(list);

  $("journalTotal").textContent =
    list.length;

  $("journalWins").textContent =
    stats.wins.length;

  $("journalLosses").textContent =
    stats.losses.length;

  $("journalPL").textContent =
    money(stats.totalPL);

  $("journalPL").className =
    moneyClass(stats.totalPL);


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

      const pl =
        number(trade.profitLoss);

      const rr =
        number(trade.rr);


      return `
        <tr>

          <td>
            ${escapeHTML(trade.date || "-")}
          </td>

          <td>
            <strong>
              ${escapeHTML(trade.pair || "-")}
            </strong>
          </td>

          <td>
            ${escapeHTML(trade.direction || "-")}
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
            1:${rr.toFixed(2)}
          </td>

          <td>
            ${resultBadge(trade.result)}
          </td>

          <td class="${moneyClass(pl)}">
            ${pl > 0 ? "+" : ""}${money(pl)}
          </td>

          <td>

            <div class="action-buttons">

              <button
                class="action-btn edit-btn"
                data-id="${trade.id}">
                Edit
              </button>

              <button
                class="action-btn delete-btn"
                data-id="${trade.id}">
                Delete
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join("");
}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const stats =
    getStats();

  const total =
    trades.length || 1;


  $("winBar").style.width =
    `${stats.wins.length / total * 100}%`;

  $("lossBar").style.width =
    `${stats.losses.length / total * 100}%`;

  $("beBar").style.width =
    `${stats.be.length / total * 100}%`;


  $("winBarText").textContent =
    stats.wins.length;

  $("lossBarText").textContent =
    stats.losses.length;

  $("beBarText").textContent =
    stats.be.length;


  const winValues =
    stats.wins
      .map(t => number(t.profitLoss))
      .filter(v => v > 0);

  const lossValues =
    stats.losses
      .map(t => number(t.profitLoss))
      .filter(v => v < 0);


  const avgWin =
    winValues.length
      ? winValues.reduce((a,b) => a+b,0) /
        winValues.length
      : 0;

  const avgLoss =
    lossValues.length
      ? lossValues.reduce((a,b) => a+b,0) /
        lossValues.length
      : 0;


  const expectancy =
    trades.length
      ? stats.totalPL / trades.length
      : 0;


  let running =
    account.startingBalance;

  let peak =
    running;

  let maxDrawdown =
    0;


  trades
    .slice()
    .sort((a,b) =>
      `${a.date || ""} ${a.time || ""}`
        .localeCompare(
          `${b.date || ""} ${b.time || ""}`
        )
    )
    .forEach(trade => {

      running +=
        number(trade.profitLoss);

      peak =
        Math.max(peak, running);

      maxDrawdown =
        Math.max(
          maxDrawdown,
          peak - running
        );
    });


  $("avgWin").textContent =
    money(avgWin);

  $("avgWin").className =
    moneyClass(avgWin);

  $("avgLoss").textContent =
    money(avgLoss);

  $("avgLoss").className =
    moneyClass(avgLoss);

  $("expectancy").textContent =
    money(expectancy);

  $("expectancy").className =
    moneyClass(expectancy);

  $("maxDrawdown").textContent =
    money(maxDrawdown);


  const buys =
    trades.filter(t => t.direction === "Buy");

  const sells =
    trades.filter(t => t.direction === "Sell");


  $("buyTrades").textContent =
    buys.length;

  $("sellTrades").textContent =
    sells.length;


  const buyPL =
    buys.reduce(
      (s,t) => s + number(t.profitLoss),
      0
    );

  const sellPL =
    sells.reduce(
      (s,t) => s + number(t.profitLoss),
      0
    );


  $("buyPL").textContent =
    money(buyPL);

  $("buyPL").className =
    moneyClass(buyPL);

  $("sellPL").textContent =
    money(sellPL);

  $("sellPL").className =
    moneyClass(sellPL);


  /* SETUPS */

  const setupMap = {};

  trades.forEach(trade => {

    const setup =
      trade.setup || "No Setup";

    if (!setupMap[setup]) {

      setupMap[setup] = {
        count: 0,
        pl: 0
      };
    }

    setupMap[setup].count++;

    setupMap[setup].pl +=
      number(trade.profitLoss);
  });


  const setupEntries =
    Object.entries(setupMap)
      .sort((a,b) => b[1].pl - a[1].pl);


  if (!setupEntries.length) {

    $("setupAnalytics").innerHTML = `
      <div>
        <span>No setup data</span>
        <strong>0</strong>
      </div>
    `;

  } else {

    $("setupAnalytics").innerHTML =
      setupEntries
        .slice(0,8)
        .map(([name,data]) => `
          <div>

            <span>
              ${escapeHTML(name)}
              (${data.count})
            </span>

            <strong class="${moneyClass(data.pl)}">
              ${data.pl > 0 ? "+" : ""}
              ${money(data.pl)}
            </strong>

          </div>
        `)
        .join("");
  }
}


/* =========================================================
   CALENDAR
========================================================= */

function dateKey(year, month, day) {

  return [
    year,
    String(month + 1).padStart(2,"0"),
    String(day).padStart(2,"0")
  ].join("-");
}


function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  const monthName =
    calendarDate.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    );


  $("calendarMonthLabel").textContent =
    monthName;


  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  /*
    Group trades by date.
  */

  const daily = {};


  trades.forEach(trade => {

    if (!trade.date) return;

    if (!daily[trade.date]) {

      daily[trade.date] = {
        pl: 0,
        trades: 0,
        wins: 0,
        losses: 0
      };
    }

    daily[trade.date].pl +=
      number(trade.profitLoss);

    daily[trade.date].trades++;

    if (trade.result === "Win") {
      daily[trade.date].wins++;
    }

    if (trade.result === "Loss") {
      daily[trade.date].losses++;
    }

  });


  let monthPL = 0;
  let monthWins = 0;
  let monthLosses = 0;


  Object.entries(daily).forEach(
    ([key,data]) => {

      const parts =
        key.split("-").map(Number);

      if (
        parts[0] === year &&
        parts[1] === month + 1
      ) {

        monthPL += data.pl;
        monthWins += data.wins;
        monthLosses += data.losses;
      }
    }
  );


  $("calendarMonthPL").textContent =
    `${monthPL > 0 ? "+" : ""}${money(monthPL)}`;

  $("calendarMonthPL").className =
    moneyClass(monthPL);

  $("calendarWins").textContent =
    monthWins;

  $("calendarLosses").textContent =
    monthLosses;


  let html = "";


  /*
    Empty boxes before first day.
  */

  for (let i = 0; i < firstDay; i++) {

    html += `
      <div class="calendar-day empty"></div>
    `;
  }


  const today =
    getLocalDate();


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const key =
      dateKey(year, month, day);

    const data =
      daily[key];


    const isToday =
      key === today;


    let amountHTML = "";

    if (!data) {

      amountHTML = `
        <div class="calendar-pl calendar-day-neutral">
          No trade
        </div>
      `;

    } else {

      const pl =
        data.pl;


      let className =
        "calendar-day-neutral";

      if (pl > 0) {
        className =
          "calendar-day-profit";
      }

      if (pl < 0) {
        className =
          "calendar-day-loss";
      }


      /*
        THIS IS THE IMPORTANT CHANGE:

        The calendar shows the actual amount,
        not just WIN / LOSS.
      */

      amountHTML = `
        <div class="calendar-pl ${className}">
          ${pl > 0 ? "+" : ""}
          ${money(pl)}
        </div>

        <div class="calendar-trade-count">
          ${data.trades}
          ${data.trades === 1 ? "trade" : "trades"}
        </div>
      `;
    }


    html += `
      <div class="calendar-day ${isToday ? "today" : ""}">

        <div class="calendar-number">
          ${day}
        </div>

        ${amountHTML}

      </div>
    `;
  }


  $("calendarGrid").innerHTML =
    html;
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


  const riskAmount =
    balance * riskPercent / 100;

  const distance =
    Math.abs(entry - sl);


  let lot = 0;

  if (distance > 0) {

    lot =
      riskAmount /
      (distance * 100);
  }


  $("calcRiskAmount").textContent =
    money(riskAmount);

  $("calcDistance").textContent =
    distance.toFixed(3);

  $("calcLot").textContent =
    lot.toFixed(2);
}


/* =========================================================
   CSV EXPORT
========================================================= */

function exportCSV() {

  const list =
    getFilteredTrades();

  if (!list.length) {

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
    "Profit Loss",
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"
  ];


  const rows =
    list.map(t => [

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
      t.profitLoss,
      t.psychology,
      t.confidence,
      t.mistake,
      t.notes

    ].map(value => {

      const text =
        String(value ?? "");

      return `"${text.replaceAll('"','""')}"`;

    }).join(","));


  const csv =
    [headers.join(","), ...rows].join("\n");


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
    `UjR-Fx-Trading-Journal-${getLocalDate()}.csv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

  showToast("CSV exported.");
}


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

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function closeMobileMenu() {

  $("sidebar")
    .classList.remove("open");

  $("overlay")
    .classList.remove("active");
}


function toggleMobileMenu() {

  $("sidebar")
    .classList.toggle("open");

  $("overlay")
    .classList.toggle("active");
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderDashboard();
  renderJournal();
  renderAnalytics();
  renderCalendar();
  calculateRiskCalculator();
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

$("loginBtn")
  .addEventListener(
    "click",
    login
  );


$("logoutBtn")
  .addEventListener(
    "click",
    logout
  );


$("quickAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


/*
  ONLY ONE Journal Add Trade listener.
*/

$("journalAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


/*
  Mobile + button also opens same modal.
*/

$("mobileAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("closeModal")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("cancelTrade")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("tradeForm")
  .addEventListener(
    "submit",
    saveTrade
  );


$("tradeModal")
  .querySelector(".modal-backdrop")
  .addEventListener(
    "click",
    closeTradeModal
  );


/* Automatic R:R */

[
  "entry",
  "sl",
  "tp",
  "direction"
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


/*
  Risk changes.

  Lot is auto-filled initially.
  User can manually edit afterwards.
*/

[
  "riskPercent",
  "entry",
  "sl"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateTradeRisk
  );
});


/*
  If user manually changes lot size,
  mark it as manually controlled.
*/

$("lotSize").addEventListener(
  "input",
  () => {

    $("lotSize").dataset.auto =
      "false";
  }
);


/* Filters */

[
  "tradeSearch",
  "resultFilter",
  "directionFilter"
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


/* Export */

$("exportBtn")
  .addEventListener(
    "click",
    exportCSV
  );


/* Settings */

$("saveSettingsBtn")
  .addEventListener(
    "click",
    saveSettings
  );


/* Risk calculator */

[
  "calcBalance",
  "calcRisk",
  "calcEntry",
  "calcSL"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateRiskCalculator
  );
});


/* Calendar */

$("prevMonth")
  .addEventListener(
    "click",
    () => {

      calendarDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() - 1,
          1
        );

      renderCalendar();
    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      calendarDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + 1,
          1
        );

      renderCalendar();
    }
  );


$("todayMonth")
  .addEventListener(
    "click",
    () => {

      calendarDate =
        new Date();

      renderCalendar();
    }
  );


/* Mobile */

$("mobileMenuBtn")
  .addEventListener(
    "click",
    toggleMobileMenu
  );


$("overlay")
  .addEventListener(
    "click",
    closeMobileMenu
  );


/* Navigation */

document
  .querySelectorAll(".nav-item")
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


document
  .querySelectorAll("[data-page-link]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.pageLink
        );

      }
    );
  });


/* Journal Edit/Delete */

$("journalTableBody")
  .addEventListener(
    "click",
    event => {

      const editButton =
        event.target.closest(".edit-btn");

      const deleteButton =
        event.target.closest(".delete-btn");


      if (editButton) {

        const id =
          editButton.dataset.id;

        const trade =
          trades.find(t => t.id === id);

        if (trade) {

          openTradeModal(trade);
        }
      }


      if (deleteButton) {

        deleteTrade(
          deleteButton.dataset.id
        );
      }

    }
  );


/* Keyboard shortcuts */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      !$("tradeModal").classList.contains("hidden")
    ) {

      closeTradeModal();
    }


    if (
      event.key.toLowerCase() === "n" &&
      !$("tradeModal").classList.contains("hidden") === false &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA" &&
      document.activeElement.tagName !== "SELECT"
    ) {

      openTradeModal();
    }

  }
);


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    if (user) {

      currentUser = user;

      $("loginScreen")
        .classList.add("hidden");

      $("app")
        .classList.remove("hidden");

      updateUserUI();

      await loadAccount();

      subscribeTrades();

      renderAll();

    } else {

      currentUser = null;

      trades = [];

      if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;
      }

      $("app")
        .classList.add("hidden");

      $("loginScreen")
        .classList.remove("hidden");
    }

  }
);
