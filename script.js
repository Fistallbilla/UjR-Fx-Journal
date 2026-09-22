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


/* =====================================================
   FIREBASE
===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
  authDomain: "journal-38e0e.firebaseapp.com",
  projectId: "journal-38e0e",
  storageBucket: "journal-38e0e.firebasestorage.app",
  messagingSenderId: "382226906837",
  appId: "1:382226906837:web:38df881c0f7beb24256c5c",
  measurementId: "G-R6LXDMQ9K2"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const provider = new GoogleAuthProvider();


/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let trades = [];

let account = {
  startingBalance: 0,
  currency: "USD"
};

let unsubscribeTrades = null;
let calendarDate = new Date();
let toastTimer = null;


/* =====================================================
   HELPERS
===================================================== */

function $(id) {
  return document.getElementById(id);
}


function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  const now = new Date();

  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}


function getLocalTime() {
  const now = new Date();

  return (
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0")
  );
}


/* =====================================================
   MONEY
===================================================== */

function money(value) {

  const currency = account.currency || "USD";

  try {

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(number(value));

  } catch {

    return `${currency} ${number(value).toFixed(2)}`;

  }
}


/* =====================================================
   LOGIN
===================================================== */

$("googleLoginBtn").addEventListener("click", async () => {

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error(error);

    switch (error.code) {

      case "auth/popup-blocked":
        $("loginError").textContent =
          "Popup blocked. Allow popups and try again.";
        break;

      case "auth/popup-closed-by-user":
        $("loginError").textContent =
          "Login window was closed.";
        break;

      case "auth/unauthorized-domain":
        $("loginError").textContent =
          "This website is not authorized in Firebase.";
        break;

      case "auth/operation-not-allowed":
        $("loginError").textContent =
          "Google login is not enabled in Firebase.";
        break;

      default:
        $("loginError").textContent =
          error.message || "Login failed.";
    }
  }

});


/* =====================================================
   AUTH
===================================================== */

onAuthStateChanged(auth, async user => {

  if (!user) {

    currentUser = null;

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    return;
  }


  currentUser = user;

  $("loginScreen").classList.add("hidden");
  $("app").classList.remove("hidden");


  $("settingsName").textContent =
    user.displayName || "User";

  $("settingsEmail").textContent =
    user.email || "";


  $("settingsPhoto").src =
    user.photoURL || "logo.png";


  await loadAccount();
  subscribeTrades();

});


/* =====================================================
   ACCOUNT
===================================================== */

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

    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {

      const data = snapshot.data();

      account.startingBalance =
        number(data.startingBalance);

      account.currency =
        data.currency || "USD";

    }


    $("startingBalance").value =
      account.startingBalance;

    $("currency").value =
      account.currency;

    $("calcBalance").value =
      account.startingBalance;


  } catch (error) {

    console.error("Account loading error:", error);

  }

}


$("saveAccountBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const startingBalance =
    number($("startingBalance").value);

  const currency =
    $("currency").value || "USD";


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
        currency
      }
    );


    account.startingBalance =
      startingBalance;

    account.currency =
      currency;

    $("calcBalance").value =
      startingBalance;

    $("accountMessage").textContent =
      "Settings saved ✓";

    showToast("Settings saved");

    renderEverything();

  } catch (error) {

    console.error(error);

    $("accountMessage").textContent =
      "Could not save account.";

  }

});


/* =====================================================
   TRADES
===================================================== */

function subscribeTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
    unsubscribeTrades = null;
  }


  const ref = collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );


  unsubscribeTrades = onSnapshot(
    ref,
    snapshot => {

      trades = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      sortTrades();
      renderEverything();

    },
    error => {

      console.error("Trade listener error:", error);

      showToast("Could not load trades");

    }
  );

}


function sortTrades() {

  trades.sort((a, b) => {

    const aValue =
      `${a.date || ""}T${a.time || "00:00"}`;

    const bValue =
      `${b.date || ""}T${b.time || "00:00"}`;

    return bValue.localeCompare(aValue);

  });

}


/* =====================================================
   NAVIGATION
===================================================== */

const pageTitles = {
  dashboard: "Dashboard",
  journal: "Journal",
  analytics: "Analytics",
  risk: "Risk Calculator",
  calendar: "Calendar",
  settings: "Settings"
};


document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    const page = button.dataset.page;

    document
      .querySelectorAll(".nav-item")
      .forEach(item =>
        item.classList.remove("active")
      );

    button.classList.add("active");


    document
      .querySelectorAll(".page")
      .forEach(item =>
        item.classList.remove("active-page")
      );


    const targetPage = $(`${page}Page`);

    if (targetPage) {
      targetPage.classList.add("active-page");
    }


    $("pageTitle").textContent =
      pageTitles[page] || "Dashboard";


    $("sidebar").classList.remove("open");

  });

});


/* =====================================================
   MOBILE SIDEBAR
===================================================== */

$("openSidebar").addEventListener("click", () => {
  $("sidebar").classList.add("open");
});


$("closeSidebar").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
});


/* =====================================================
   LOGOUT
===================================================== */

$("logoutBtn").addEventListener("click", async () => {

  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }

});


/* =====================================================
   TRADE MODAL
===================================================== */

function openTradeModal(trade = null) {

  $("tradeModal").classList.add("show");


  if (!trade) {

    $("modalTitle").textContent = "Add Trade";

    $("tradeForm").reset();

    $("tradeId").value = "";

    $("pair").value = "XAUUSD";
    $("direction").value = "Buy";
    $("result").value = "Win";

    $("riskPercent").value = 1;

    $("tradeDate").value = getLocalDate();
    $("tradeTime").value = getLocalTime();

    $("rr").value = "";

    updateTradeCalculations();

    return;
  }


  $("modalTitle").textContent = "Edit Trade";

  $("tradeId").value =
    trade.id || "";

  $("tradeDate").value =
    trade.date || "";

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
    trade.confidence ?? "";

  $("mistake").value =
    trade.mistake || "";

  $("notes").value =
    trade.notes || "";

  updateTradeCalculations();

}


function closeTradeModal() {
  $("tradeModal").classList.remove("show");
}


$("quickAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("journalAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("emptyAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("closeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);


/* =====================================================
   AUTOMATIC TRADE CALCULATIONS
===================================================== */

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

  $("rr").value =
    `1:${rr.toFixed(2)}`;

  return rr;
}


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
    $("lotSize").value = "";

    return;

  }


  const riskAmount =
    balance * riskPercent / 100;


  $("riskAmount").value =
    riskAmount.toFixed(2);


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


["entry", "sl", "tp", "riskPercent"].forEach(id => {

  $(id).addEventListener(
    "input",
    updateTradeCalculations
  );

});


$("direction").addEventListener(
  "change",
  updateTradeCalculations
);


/* =====================================================
   RR VALUE
===================================================== */

function getRRValue(value) {

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }


  if (!value) return 0;


  const text =
    String(value)
      .replace("1:", "")
      .trim();


  const result = Number(text);

  return Number.isFinite(result)
    ? result
    : 0;
}


/* =====================================================
   SAVE TRADE
===================================================== */

$("tradeForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    if (!currentUser) {

      showToast("Please login first");
      return;

    }


    updateTradeCalculations();


    const rr =
      calculateTradeRR();


    if (!rr || !Number.isFinite(rr)) {

      showToast(
        "Check Entry, SL and TP"
      );

      return;
    }


    const trade = {

      date:
        $("tradeDate").value,

      time:
        $("tradeTime").value,

      pair:
        $("pair").value
          .trim()
          .toUpperCase() || "XAUUSD",

      direction:
        $("direction").value,

      entry:
        number($("entry").value),

      sl:
        number($("sl").value),

      tp:
        number($("tp").value),

      rr,

      riskPercent:
        number($("riskPercent").value),

      riskAmount:
        number($("riskAmount").value),

      lotSize:
        number($("lotSize").value),

      setup:
        $("setup").value.trim(),

      session:
        $("session").value,

      htfBias:
        $("htfBias").value,

      liquidity:
        $("liquidity").value.trim(),

      confirmation:
        $("confirmation").value.trim(),

      result:
        $("result").value,

      profitLoss:
        number($("profitLoss").value),

      psychology:
        $("psychology").value.trim(),

      confidence:
        number($("confidence").value),

      mistake:
        $("mistake").value.trim(),

      notes:
        $("notes").value.trim(),

      updatedAt:
        Date.now()

    };


    const tradeId =
      $("tradeId").value;


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
          trade
        );

        showToast("Trade updated ✓");

      } else {

        await addDoc(
          collection(
            db,
            "users",
            currentUser.uid,
            "trades"
          ),
          {
            ...trade,
            createdAt: Date.now()
          }
        );

        showToast("Trade added ✓");
      }


      closeTradeModal();


    } catch (error) {

      console.error(
        "Trade save error:",
        error
      );

      showToast(
        "Could not save trade"
      );

    }

  }
);


/* =====================================================
   DELETE TRADE
===================================================== */

async function deleteTrade(id) {

  if (!currentUser || !id) return;


  const confirmed =
    window.confirm(
      "Delete this trade permanently?"
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

    showToast("Trade deleted");

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade"
    );

  }

}


/* =====================================================
   STATS
===================================================== */

function getChronologicalTrades() {

  return [...trades].sort((a, b) => {

    const A =
      `${a.date || ""}T${a.time || "00:00"}`;

    const B =
      `${b.date || ""}T${b.time || "00:00"}`;

    return A.localeCompare(B);

  });

}


function getStats() {

  const starting =
    number(account.startingBalance);


  const totalPL =
    trades.reduce(
      (sum, trade) =>
        sum + number(trade.profitLoss),
      0
    );


  const wins =
    trades.filter(
      trade => trade.result === "Win"
    );


  const losses =
    trades.filter(
      trade => trade.result === "Loss"
    );


  const winRate =
    trades.length
      ? wins.length / trades.length * 100
      : 0;


  const grossProfit =
    wins.reduce(
      (sum, trade) =>
        sum + Math.max(
          0,
          number(trade.profitLoss)
        ),
      0
    );


  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, trade) =>
          sum + Math.min(
            0,
            number(trade.profitLoss)
          ),
        0
      )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const expectancy =
    trades.length
      ? totalPL / trades.length
      : 0;


  const rrValues =
    trades
      .map(trade => getRRValue(trade.rr))
      .filter(rr => rr > 0);


  const averageRR =
    rrValues.length
      ? rrValues.reduce(
          (a, b) => a + b,
          0
        ) / rrValues.length
      : 0;


  const averageWin =
    wins.length
      ? wins.reduce(
          (sum, trade) =>
            sum + number(trade.profitLoss),
          0
        ) / wins.length
      : 0;


  const averageLoss =
    losses.length
      ? losses.reduce(
          (sum, trade) =>
            sum + number(trade.profitLoss),
          0
        ) / losses.length
      : 0;


  let balance = starting;
  let peak = starting;
  let maxDD = 0;

  const balances = [];


  getChronologicalTrades().forEach(trade => {

    balance += number(trade.profitLoss);

    balances.push(balance);

    if (balance > peak) {
      peak = balance;
    }

    const drawdown =
      peak - balance;

    if (drawdown > maxDD) {
      maxDD = drawdown;
    }

  });


  return {

    starting,

    balance:
      starting + totalPL,

    totalPL,

    wins:
      wins.length,

    losses:
      losses.length,

    winRate,

    grossProfit,

    grossLoss,

    profitFactor,

    expectancy,

    averageRR,

    averageWin,

    averageLoss,

    maxDD,

    balances

  };

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

  const stats = getStats();


  $("dashBalance").textContent =
    money(stats.balance);


  $("totalProfit").textContent =
    money(stats.totalPL);


  const profitPercent =
    stats.starting > 0
      ? stats.totalPL / stats.starting * 100
      : 0;


  $("profitPercent").textContent =
    `${profitPercent.toFixed(2)}%`;


  $("winRate").textContent =
    `${stats.winRate.toFixed(1)}%`;


  $("winLossText").textContent =
    `${stats.wins}W / ${stats.losses}L`;


  $("maxDrawdown").textContent =
    money(stats.maxDD);


  $("profitFactor").textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor.toFixed(2);


  $("expectancy").textContent =
    money(stats.expectancy);


  $("averageRR").textContent =
    stats.averageRR > 0
      ? `1:${stats.averageRR.toFixed(2)}`
      : "0.00";


  $("averageWin").textContent =
    money(stats.averageWin);


  $("averageLoss").textContent =
    money(stats.averageLoss);


  $("equityProfit").textContent =
    money(stats.totalPL);


  renderEquityCurve();
  renderStreaks();
  renderRecentTrades();
  renderInsights();

}


/* =====================================================
   EQUITY CURVE
===================================================== */

function renderEquityCurve() {

  const canvas =
    $("equityCanvas");

  if (!canvas) return;


  const width =
    canvas.clientWidth || 500;

  const height = 240;

  const ratio =
    window.devicePixelRatio || 1;


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


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const stats =
    getStats();


  const values = [
    stats.starting,
    ...stats.balances
  ];


  if (values.length < 2) {

    ctx.fillStyle = "#777";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      "Add trades to see your equity curve",
      width / 2,
      height / 2
    );

    return;
  }


  const min =
    Math.min(...values);

  const max =
    Math.max(...values);

  const range =
    max - min || 1;

  const padding = 25;


  ctx.beginPath();


  values.forEach((value, index) => {

    const x =
      padding +
      index *
      (
        (width - padding * 2) /
        (values.length - 1)
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

  });


  ctx.lineWidth = 2;
  ctx.strokeStyle = "#d8a83e";
  ctx.stroke();

}


/* =====================================================
   STREAKS
===================================================== */

function renderStreaks() {

  const ordered =
    getChronologicalTrades();


  let streak = 0;
  let type = "";

  let bestWin = 0;
  let worstLoss = 0;


  ordered.forEach(trade => {

    if (trade.result === "Win") {

      if (type === "Win") {
        streak++;
      } else {
        streak = 1;
        type = "Win";
      }

      bestWin =
        Math.max(bestWin, streak);

    } else if (trade.result === "Loss") {

      if (type === "Loss") {
        streak++;
      } else {
        streak = 1;
        type = "Loss";
      }

      worstLoss =
        Math.max(worstLoss, streak);

    } else {

      streak = 0;
      type = "";

    }

  });


  $("currentStreak").textContent =
    streak;

  $("currentStreakType").textContent =
    streak
      ? `${type} streak`
      : "No streak";

  $("bestWinStreak").textContent =
    bestWin;

  $("worstLossStreak").textContent =
    worstLoss;

}


/* =====================================================
   RECENT TRADES
===================================================== */

function renderRecentTrades() {

  const container =
    $("recentTrades");

  container.innerHTML = "";


  trades.slice(0, 6).forEach(trade => {

    const row =
      document.createElement("div");

    row.className =
      "recent-trade";


    const resultClass =
      trade.result === "Win"
        ? "win"
        : trade.result === "Loss"
          ? "loss"
          : "be";


    row.innerHTML = `

      <div>
        <strong>
          ${escapeHTML(
            trade.pair || "XAUUSD"
          )}
        </strong>

        <span>
          ${escapeHTML(
            trade.direction || ""
          )}
        </span>
      </div>

      <div>
        <strong class="${resultClass}">
          ${escapeHTML(
            trade.result || ""
          )}
        </strong>

        <span>
          ${money(
            number(trade.profitLoss)
          )}
        </span>
      </div>

    `;


    container.appendChild(row);

  });


  if (!trades.length) {

    container.innerHTML =
      `<div class="empty-small">
        No trades yet.
      </div>`;

  }

}


/* =====================================================
   INSIGHTS
===================================================== */

function renderInsights() {

  const container =
    $("quickInsights");

  container.innerHTML = "";


  if (!trades.length) {

    container.innerHTML =
      `<div class="insight">
        Start recording demo trades to generate insights.
      </div>`;

    return;
  }


  const stats = getStats();


  const insights = [

    `You have recorded ${trades.length} trades.`,

    `Current win rate is ${stats.winRate.toFixed(1)}%.`

  ];


  if (stats.averageRR > 0) {

    insights.push(
      `Average planned R:R is 1:${stats.averageRR.toFixed(2)}.`
    );

  }


  const buys =
    trades.filter(
      t => t.direction === "Buy"
    ).length;


  const sells =
    trades.filter(
      t => t.direction === "Sell"
    ).length;


  insights.push(
    `Direction split: ${buys} Buy / ${sells} Sell.`
  );


  insights.forEach(text => {

    const div =
      document.createElement("div");

    div.className =
      "insight";

    div.textContent =
      text;

    container.appendChild(div);

  });

}


/* =====================================================
   JOURNAL FILTER
===================================================== */

function getFilteredTrades() {

  const search =
    $("tradeSearch")
      .value
      .trim()
      .toLowerCase();


  const result =
    $("resultFilter").value;


  const direction =
    $("directionFilter").value;


  const setup =
    $("setupFilter").value;


  return trades.filter(trade => {

    if (
      search &&
      !JSON.stringify(trade)
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }


    if (
      result !== "all" &&
      trade.result !== result
    ) {
      return false;
    }


    if (
      direction !== "all" &&
      trade.direction !== direction
    ) {
      return false;
    }


    if (
      setup !== "all" &&
      trade.setup !== setup
    ) {
      return false;
    }


    return true;

  });

}


/* =====================================================
   JOURNAL
===================================================== */

function renderJournal() {

  const tbody =
    $("tradeTableBody");

  tbody.innerHTML = "";


  const filtered =
    getFilteredTrades();


  filtered.forEach(trade => {

    const row =
      document.createElement("tr");


    const resultClass =
      trade.result === "Win"
        ? "win"
        : trade.result === "Loss"
          ? "loss"
          : "be";


    const rr =
      getRRValue(trade.rr);


    row.innerHTML = `

      <td>
        ${escapeHTML(trade.date || "")}
      </td>

      <td>
        ${escapeHTML(trade.pair || "")}
      </td>

      <td>
        ${escapeHTML(trade.direction || "")}
      </td>

      <td>
        ${escapeHTML(trade.setup || "-")}
      </td>

      <td>
        ${number(trade.entry)}
      </td>

      <td>
        ${number(trade.sl)}
      </td>

      <td>
        ${number(trade.tp)}
      </td>

      <td>
        ${
          rr > 0
            ? `1:${rr.toFixed(2)}`
            : "-"
        }
      </td>

      <td>
        <span class="result-badge ${resultClass}">
          ${escapeHTML(trade.result || "-")}
        </span>
      </td>

      <td>
        ${money(
          number(trade.profitLoss)
        )}
      </td>

      <td>

        <div class="table-actions">

          <button
            class="edit-btn"
            type="button"
            data-edit="${escapeHTML(trade.id)}"
          >
            Edit
          </button>

          <button
            class="delete-btn"
            type="button"
            data-delete="${escapeHTML(trade.id)}"
          >
            Delete
          </button>

        </div>

      </td>

    `;


    tbody.appendChild(row);

  });


  $("emptyTrades").style.display =
    filtered.length
      ? "none"
      : "block";


  const wins =
    filtered.filter(
      trade => trade.result === "Win"
    ).length;


  const losses =
    filtered.filter(
      trade => trade.result === "Loss"
    ).length;


  const pl =
    filtered.reduce(
      (sum, trade) =>
        sum + number(trade.profitLoss),
      0
    );


  $("journalCount").textContent =
    filtered.length;

  $("journalWins").textContent =
    wins;

  $("journalLosses").textContent =
    losses;

  $("journalPL").textContent =
    money(pl);


  tbody
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            trades.find(
              item =>
                item.id ===
                button.dataset.edit
            );


          if (trade) {
            openTradeModal(trade);
          }

        }
      );

    });


  tbody
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          deleteTrade(
            button.dataset.delete
          );
        }
      );

    });

}


/* =====================================================
   FILTER EVENTS
===================================================== */

[
  "tradeSearch",
  "resultFilter",
  "directionFilter",
  "setupFilter"
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


/* =====================================================
   SETUP FILTER
===================================================== */

function updateSetupFilter() {

  const select =
    $("setupFilter");

  const current =
    select.value;


  const setups =
    [
      ...new Set(
        trades
          .map(trade => trade.setup)
          .filter(Boolean)
      )
    ]
    .sort();


  select.innerHTML =
    `<option value="all">All Setups</option>`;


  setups.forEach(setup => {

    const option =
      document.createElement("option");

    option.value =
      setup;

    option.textContent =
      setup;

    select.appendChild(option);

  });


  if (setups.includes(current)) {
    select.value = current;
  }

}


/* =====================================================
   ANALYTICS
===================================================== */

function getGroupData(key) {

  const groups = {};


  trades.forEach(trade => {

    const name =
      trade[key] || "Unknown";


    if (!groups[name]) {

      groups[name] = {
        trades: 0,
        wins: 0,
        pl: 0
      };

    }


    groups[name].trades++;


    if (trade.result === "Win") {
      groups[name].wins++;
    }


    groups[name].pl +=
      number(trade.profitLoss);

  });


  return groups;

}


function renderGroup(containerId, key) {

  const container =
    $(containerId);

  container.innerHTML = "";


  const groups =
    getGroupData(key);


  const entries =
    Object.entries(groups);


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-small">
        No data yet.
      </div>`;

    return;
  }


  entries.forEach(([name, data]) => {

    const winRate =
      data.trades
        ? data.wins / data.trades * 100
        : 0;


    const row =
      document.createElement("div");


    row.className =
      "analytics-row";


    row.innerHTML = `

      <div>

        <strong>
          ${escapeHTML(name)}
        </strong>

        <span>
          ${data.trades} trades ·
          ${winRate.toFixed(0)}% win
        </span>

      </div>

      <strong>
        ${money(data.pl)}
      </strong>

    `;


    container.appendChild(row);

  });

}


function renderPsychology() {

  renderGroup(
    "psychologyAnalytics",
    "psychology"
  );

}


function renderMistakes() {

  const container =
    $("mistakeAnalytics");

  container.innerHTML = "";


  const counts = {};


  trades.forEach(trade => {

    const mistake =
      trade.mistake?.trim();


    if (!mistake) return;


    counts[mistake] =
      (counts[mistake] || 0) + 1;

  });


  const entries =
    Object.entries(counts)
      .sort(
        (a, b) => b[1] - a[1]
      );


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-small">
        No mistakes recorded.
      </div>`;

    return;
  }


  entries.forEach(([mistake, count]) => {

    const row =
      document.createElement("div");

    row.className =
      "analytics-row";


    row.innerHTML = `

      <div>
        <strong>
          ${escapeHTML(mistake)}
        </strong>
      </div>

      <strong>
        ${count}
      </strong>

    `;


    container.appendChild(row);

  });

}


function renderRDistribution() {

  const container =
    $("rAnalytics");

  container.innerHTML = "";


  const buckets = {
    "Below 1R": 0,
    "1R – 2R": 0,
    "2R+": 0
  };


  trades.forEach(trade => {

    const rr =
      getRRValue(trade.rr);


    if (rr <= 0) return;


    if (rr < 1) {

      buckets["Below 1R"]++;

    } else if (rr < 2) {

      buckets["1R – 2R"]++;

    } else {

      buckets["2R+"]++;

    }

  });


  Object.entries(buckets).forEach(
    ([name, count]) => {

      const row =
        document.createElement("div");

      row.className =
        "analytics-row";


      row.innerHTML = `

        <div>
          <strong>
            ${name}
          </strong>
        </div>

        <strong>
          ${count}
        </strong>

      `;


      container.appendChild(row);

    }
  );

}


/* =====================================================
   RISK CALCULATOR
===================================================== */

function calculateRisk() {

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


  const potentialLoss =
    lot *
    distance *
    contract;


  const potentialProfit =
    lot *
    reward *
    contract;


  $("calcRiskAmount").textContent =
    money(riskAmount);

  $("calcDistance").textContent =
    distance.toFixed(3);

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0.00";

  $("calcLot").textContent =
    lot.toFixed(2);

  $("calcLoss").textContent =
    money(potentialLoss);

  $("calcProfit").textContent =
    money(potentialProfit);

}


$("calculateRisk").addEventListener(
  "click",
  calculateRisk
);


/* =====================================================
   CALENDAR
===================================================== */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  $("calendarMonth").textContent =
    calendarDate.toLocaleString(
      "default",
      {
        month: "long",
        year: "numeric"
      }
    );


  const grid =
    $("calendarGrid");

  grid.innerHTML = "";


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const blank =
      document.createElement("div");

    blank.className =
      "calendar-day empty";

    grid.appendChild(blank);

  }


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dayTrades =
      trades.filter(
        trade =>
          trade.date === dateString
      );


    const pl =
      dayTrades.reduce(
        (sum, trade) =>
          sum + number(trade.profitLoss),
        0
      );


    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";


    cell.innerHTML = `

      <strong>${day}</strong>

      ${
        dayTrades.length
          ? `
            <span>
              ${dayTrades.length}
              trade${dayTrades.length > 1 ? "s" : ""}
            </span>
          `
          : ""
      }

      ${
        dayTrades.length
          ? `
            <b>
              ${money(pl)}
            </b>
          `
          : ""
      }

    `;


    grid.appendChild(cell);

  }

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


/* =====================================================
   CSV
===================================================== */

$("exportCSV").addEventListener(
  "click",
  () => {

    if (!trades.length) {

      showToast(
        "No trades to export"
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
      trades.map(trade => [

        trade.date,
        trade.time,
        trade.pair,
        trade.direction,
        trade.entry,
        trade.sl,
        trade.tp,
        getRRValue(trade.rr).toFixed(2),
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
        trade.psychology,
        trade.confidence,
        trade.mistake,
        trade.notes

      ]);


    const csv =
      [headers, ...rows]
        .map(row =>
          row
            .map(value =>
              `"${String(
                value ?? ""
              ).replaceAll(
                '"',
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
      "ujr-fx-trading-journal.csv";


    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

  }
);


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

  const toast =
    $("toast");


  toast.textContent =
    message;


  toast.classList.add("show");


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2500);

}


/* =====================================================
   EVERYTHING
===================================================== */

function renderEverything() {

  renderDashboard();

  updateSetupFilter();

  renderJournal();

  renderGroup(
    "setupAnalytics",
    "setup"
  );

  renderGroup(
    "directionAnalytics",
    "direction"
  );

  renderGroup(
    "sessionAnalytics",
    "session"
  );

  renderPsychology();

  renderMistakes();

  renderRDistribution();

  renderCalendar();

}


/* =====================================================
   KEYBOARD
===================================================== */

document.addEventListener(
  "keydown",
  event => {

    const tag =
      document.activeElement?.tagName;


    if (
      event.key.toLowerCase() === "n" &&
      ![
        "INPUT",
        "TEXTAREA",
        "SELECT"
      ].includes(tag)
    ) {

      openTradeModal();

    }


    if (event.key === "Escape") {
      closeTradeModal();
    }

  }
);


/* =====================================================
   RESIZE
===================================================== */

window.addEventListener(
  "resize",
  () => {

    const dashboard =
      $("dashboardPage");

    if (!dashboard) return;


    if (
      !dashboard.classList.contains(
        "active-page"
      )
    ) {
      return;
    }


    renderEquityCurve();

  }
);


/* =====================================================
   INITIAL UI
===================================================== */

renderEverything();
