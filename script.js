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

const provider = new GoogleAuthProvider();


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let trades = [];

let account = {
  startingBalance: 10000,
  currency: "USD"
};

let unsubscribeTrades = null;

let calendarDate = new Date();


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

function money(value) {

  const num = Number(value) || 0;

  const currency = account.currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}


function number(value) {
  return Number(value) || 0;
}


function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatDate(dateString) {

  if (!dateString) return "-";

  const d = new Date(`${dateString}T00:00:00`);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}


function todayISO() {

  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


function safeText(id, value) {

  const el = $(id);

  if (el) {
    el.textContent = value;
  }
}


/* =========================================================
   LOGIN
========================================================= */

$("googleLoginBtn").addEventListener("click", async () => {

  const button = $("googleLoginBtn");
  const error = $("loginError");

  error.textContent = "";

  button.disabled = true;
  button.textContent = "Signing in...";

  try {

    await signInWithPopup(auth, provider);

  } catch (err) {

    console.error(err);

    let message = "Google login failed.";

    if (err.code === "auth/popup-blocked") {
      message = "Popup was blocked. Allow popups for this site.";
    }

    if (err.code === "auth/popup-closed-by-user") {
      message = "Login window was closed.";
    }

    if (err.code === "auth/unauthorized-domain") {
      message = "This GitHub Pages domain is not authorized in Firebase.";
    }

    if (err.code === "auth/operation-not-allowed") {
      message = "Google Sign-In is not enabled in Firebase.";
    }

    error.textContent = message;

  } finally {

    button.disabled = false;

    button.innerHTML = `
      <span class="google-logo">G</span>
      Continue with Google
    `;
  }

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, async user => {

  if (user) {

    currentUser = user;

    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    loadUserProfile();

    await loadAccount();

    subscribeTrades();

    updateDate();

  } else {

    currentUser = null;

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    $("loginScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
  }

});


/* =========================================================
   PROFILE
========================================================= */

function loadUserProfile() {

  const name = currentUser.displayName || "Trader";
  const email = currentUser.email || "";
  const photo = currentUser.photoURL || "";

  safeText("userName", name);
  safeText("userEmail", email);

  safeText("settingsName", name);
  safeText("settingsEmail", email);

  if (photo) {

    $("userPhoto").src = photo;
    $("settingsPhoto").src = photo;

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

    $("startingBalance").value = account.startingBalance;
    $("currency").value = account.currency;

    updateDashboard();

  } catch (err) {

    console.error("Account load error:", err);

  }

}


$("saveAccountBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const balance = number($("startingBalance").value);
  const currency = $("currency").value;

  if (balance <= 0) {

    showToast("Enter a valid starting balance.");
    return;

  }

  account = {
    startingBalance: balance,
    currency
  };

  try {

    const ref = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

    await setDoc(ref, account);

    $("accountMessage").textContent =
      "Account saved successfully.";

    showToast("Account saved.");

    updateDashboard();

  } catch (err) {

    console.error(err);

    $("accountMessage").textContent =
      `Could not save account: ${err.message}`;

  }

});


/* =========================================================
   TRADES FIRESTORE
========================================================= */

function subscribeTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
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

      trades = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      trades.sort((a, b) => {

        const da = `${a.date || ""} ${a.time || ""}`;
        const db = `${b.date || ""} ${b.time || ""}`;

        return db.localeCompare(da);

      });

      updateEverything();

    },
    error => {

      console.error("Trade listener error:", error);

      showToast("Could not load trades.");

    }
  );

}


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    switchView(button.dataset.view);

    $("sidebar").classList.remove("open");

  });

});


document.querySelectorAll("[data-view-target]").forEach(button => {

  button.addEventListener("click", () => {
    switchView(button.dataset.viewTarget);
  });

});


function switchView(viewName) {

  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active-view");
  });

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });

  const view = $(`view-${viewName}`);

  if (view) {
    view.classList.add("active-view");
  }

  const nav = document.querySelector(
    `.nav-item[data-view="${viewName}"]`
  );

  if (nav) {
    nav.classList.add("active");
  }

  const titles = {
    dashboard: "Dashboard",
    journal: "Trade Journal",
    analytics: "Analytics",
    risk: "Risk Calculator",
    calendar: "Trading Calendar",
    settings: "Settings"
  };

  safeText(
    "pageTitle",
    titles[viewName] || "Dashboard"
  );

  if (viewName === "calendar") {
    renderCalendar();
  }

}


/* =========================================================
   SIDEBAR MOBILE
========================================================= */

$("openSidebar").addEventListener("click", () => {

  document.querySelector(".sidebar").classList.add("open");

});


$("closeSidebar").addEventListener("click", () => {

  document.querySelector(".sidebar").classList.remove("open");

});


/* =========================================================
   MODAL
========================================================= */

function openTradeModal(trade = null) {

  $("tradeModal").classList.remove("hidden");

  if (trade) {

    $("modalTitle").textContent = "Edit Trade";

    $("tradeId").value = trade.id || "";

    $("tradeDate").value = trade.date || todayISO();
    $("tradeTime").value = trade.time || "";

    $("pair").value = trade.pair || "XAUUSD";
    $("direction").value = trade.direction || "Buy";

    $("entry").value = trade.entry ?? "";
    $("sl").value = trade.sl ?? "";
    $("tp").value = trade.tp ?? "";
    $("rr").value = trade.rr ?? "";

    $("riskPercent").value = trade.riskPercent ?? "";
    $("riskAmount").value = trade.riskAmount ?? "";
    $("lotSize").value = trade.lotSize ?? "";

    $("setup").value = trade.setup || "Liquidity Sweep";
    $("session").value = trade.session || "London";
    $("htfBias").value = trade.htfBias || "Neutral";
    $("liquidity").value = trade.liquidity || "None";
    $("confirmation").value = trade.confirmation || "None";

    $("result").value = trade.result || "Win";
    $("profitLoss").value = trade.profitLoss ?? "";

    $("psychology").value = trade.psychology || "Calm";
    $("confidence").value = trade.confidence || "5";
    $("mistake").value = trade.mistake || "None";

    $("notes").value = trade.notes || "";

  } else {

    $("modalTitle").textContent = "Add Trade";

    $("tradeForm").reset();

    $("tradeId").value = "";

    $("tradeDate").value = todayISO();
    $("pair").value = "XAUUSD";
    $("direction").value = "Buy";

  }

}


function closeTradeModal() {

  $("tradeModal").classList.add("hidden");

}


$("closeModal").addEventListener("click", closeTradeModal);
$("cancelTrade").addEventListener("click", closeTradeModal);

$("tradeModal").addEventListener("click", e => {

  if (e.target.classList.contains("modal-backdrop")) {
    closeTradeModal();
  }

});


$("quickAddBtn").addEventListener("click", () => {
  openTradeModal();
});

$("journalAddBtn").addEventListener("click", () => {
  openTradeModal();
});

$("emptyAddBtn").addEventListener("click", () => {
  openTradeModal();
});


/* =========================================================
   TRADE SAVE
========================================================= */

$("tradeForm").addEventListener("submit", async e => {

  e.preventDefault();

  if (!currentUser) return;

  const id = $("tradeId").value;

  const trade = {

    date: $("tradeDate").value,
    time: $("tradeTime").value,

    pair: $("pair").value.trim().toUpperCase(),

    direction: $("direction").value,

    entry: number($("entry").value),
    sl: number($("sl").value),
    tp: number($("tp").value),
    rr: number($("rr").value),

    riskPercent: number($("riskPercent").value),
    riskAmount: number($("riskAmount").value),
    lotSize: number($("lotSize").value),

    setup: $("setup").value,
    session: $("session").value,
    htfBias: $("htfBias").value,
    liquidity: $("liquidity").value,
    confirmation: $("confirmation").value,

    result: $("result").value,
    profitLoss: number($("profitLoss").value),

    psychology: $("psychology").value,
    confidence: $("confidence").value,
    mistake: $("mistake").value,

    notes: $("notes").value.trim(),

    updatedAt: Date.now()

  };


  try {

    if (id) {

      const ref = doc(
        db,
        "users",
        currentUser.uid,
        "trades",
        id
      );

      await updateDoc(ref, trade);

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

      showToast("Trade saved.");

    }

    closeTradeModal();

  } catch (err) {

    console.error(err);

    showToast(`Could not save trade: ${err.message}`);

  }

});


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

  if (!currentUser || !id) return;

  const ok = confirm(
    "Delete this trade permanently?"
  );

  if (!ok) return;

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

  } catch (err) {

    console.error(err);

    showToast("Could not delete trade.");

  }

}


/* =========================================================
   UPDATE EVERYTHING
========================================================= */

function updateEverything() {

  updateDashboard();

  renderTrades();

  updateFilters();

  renderAnalytics();

  renderCalendar();

  renderRecentTrades();

  renderInsights();

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {

  const starting = number(account.startingBalance);

  const totalPL = trades.reduce(
    (sum, t) => sum + number(t.profitLoss),
    0
  );

  const balance = starting + totalPL;

  const wins = trades.filter(
    t => t.result === "Win"
  );

  const losses = trades.filter(
    t => t.result === "Loss"
  );

  const winRate =
    trades.length
      ? wins.length / trades.length * 100
      : 0;

  const grossProfit = wins.reduce(
    (sum, t) => sum + Math.max(0, number(t.profitLoss)),
    0
  );

  const grossLoss = Math.abs(
    losses.reduce(
      (sum, t) => sum + Math.min(0, number(t.profitLoss)),
      0
    )
  );

  const pf =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const expectancy =
    trades.length
      ? totalPL / trades.length
      : 0;

  const avgRR =
    trades.length
      ? trades.reduce(
          (sum, t) => sum + number(t.rr),
          0
        ) / trades.length
      : 0;

  const avgWin =
    wins.length
      ? wins.reduce(
          (sum, t) => sum + number(t.profitLoss),
          0
        ) / wins.length
      : 0;

  const avgLoss =
    losses.length
      ? losses.reduce(
          (sum, t) => sum + number(t.profitLoss),
          0
        ) / losses.length
      : 0;

  const drawdown = calculateMaxDrawdown();

  const streaks = calculateStreaks();


  safeText("dashBalance", money(balance));

  safeText("totalProfit", money(totalPL));

  safeText(
    "profitPercent",
    starting
      ? `${((totalPL / starting) * 100).toFixed(2)}%`
      : "0%"
  );

  safeText(
    "winRate",
    `${winRate.toFixed(1)}%`
  );

  safeText(
    "winLossText",
    `${wins.length}W / ${losses.length}L`
  );

  safeText(
    "maxDrawdown",
    money(drawdown)
  );

  safeText(
    "profitFactor",
    pf === Infinity ? "∞" : pf.toFixed(2)
  );

  safeText(
    "expectancy",
    money(expectancy)
  );

  safeText(
    "averageRR",
    `${avgRR.toFixed(2)}R`
  );

  safeText(
    "averageWin",
    money(avgWin)
  );

  safeText(
    "averageLoss",
    money(avgLoss)
  );

  safeText(
    "equityProfit",
    money(totalPL)
  );

  safeText(
    "currentStreak",
    streaks.current
  );

  safeText(
    "currentStreakType",
    streaks.type
  );

  safeText(
    "bestWinStreak",
    streaks.bestWin
  );

  safeText(
    "worstLossStreak",
    streaks.worstLoss
  );

  renderEquityChart();

}


/* =========================================================
   DRAW DOWN
========================================================= */

function calculateMaxDrawdown() {

  if (!trades.length) return 0;

  const ordered = [...trades].sort(compareTrades);

  let equity = number(account.startingBalance);
  let peak = equity;
  let maxDD = 0;

  for (const trade of ordered) {

    equity += number(trade.profitLoss);

    if (equity > peak) {
      peak = equity;
    }

    const dd = peak - equity;

    if (dd > maxDD) {
      maxDD = dd;
    }

  }

  return maxDD;
}


/* =========================================================
   STREAKS
========================================================= */

function calculateStreaks() {

  const ordered = [...trades].sort(compareTrades);

  let current = 0;
  let currentType = "No streak";

  let bestWin = 0;
  let worstLoss = 0;

  let winStreak = 0;
  let lossStreak = 0;

  for (const trade of ordered) {

    if (trade.result === "Win") {

      winStreak++;
      lossStreak = 0;

      bestWin = Math.max(
        bestWin,
        winStreak
      );

    } else if (trade.result === "Loss") {

      lossStreak++;
      winStreak = 0;

      worstLoss = Math.max(
        worstLoss,
        lossStreak
      );

    } else {

      winStreak = 0;
      lossStreak = 0;

    }

  }

  if (ordered.length) {

    const last = ordered[ordered.length - 1];

    if (last.result === "Win") {

      current = winStreak;
      currentType = "Win streak";

    } else if (last.result === "Loss") {

      current = lossStreak;
      currentType = "Loss streak";

    }

  }

  return {
    current,
    type: currentType,
    bestWin,
    worstLoss
  };

}


/* =========================================================
   SORT
========================================================= */

function compareTrades(a, b) {

  const da = `${a.date || ""} ${a.time || ""}`;
  const db = `${b.date || ""} ${b.time || ""}`;

  return da.localeCompare(db);

}


/* =========================================================
   EQUITY CHART
========================================================= */

function renderEquityChart() {

  const canvas = $("equityCanvas");

  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();

  const width = Math.max(
    300,
    Math.floor(rect.width)
  );

  const height = 270;

  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  const ordered = [...trades].sort(compareTrades);

  let balance = number(account.startingBalance);

  const points = [
    balance
  ];

  ordered.forEach(t => {

    balance += number(t.profitLoss);

    points.push(balance);

  });

  if (points.length < 2) {

    ctx.fillStyle = "#555";
    ctx.font = "12px Inter";
    ctx.textAlign = "center";

    ctx.fillText(
      "Add trades to see your equity curve",
      width / 2,
      height / 2
    );

    return;

  }

  const min = Math.min(...points);
  const max = Math.max(...points);

  const range = max - min || 1;

  const left = 15;
  const right = width - 15;
  const top = 20;
  const bottom = height - 25;

  ctx.strokeStyle = "#202020";
  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i++) {

    const y =
      top +
      (bottom - top) * i / 4;

    ctx.beginPath();

    ctx.moveTo(left, y);
    ctx.lineTo(right, y);

    ctx.stroke();

  }

  const coords = points.map((value, index) => {

    const x =
      left +
      (right - left) *
      index /
      (points.length - 1);

    const y =
      bottom -
      ((value - min) / range) *
      (bottom - top);

    return { x, y };

  });

  const gradient = ctx.createLinearGradient(
    0,
    top,
    0,
    bottom
  );

  gradient.addColorStop(
    0,
    "rgba(214,173,85,.22)"
  );

  gradient.addColorStop(
    1,
    "rgba(214,173,85,0)"
  );

  ctx.beginPath();

  coords.forEach((p, i) => {

    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }

  });

  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();


  ctx.beginPath();

  coords.forEach((p, i) => {

    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }

  });

  ctx.strokeStyle = "#d6ad55";
  ctx.lineWidth = 2;
  ctx.stroke();


  const last = coords[coords.length - 1];

  ctx.beginPath();
  ctx.arc(
    last.x,
    last.y,
    4,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#f0c86a";
  ctx.fill();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const container = $("recentTrades");

  if (!container) return;

  const recent = [...trades]
    .sort((a, b) => compareTrades(b, a))
    .slice(0, 6);

  if (!recent.length) {

    container.innerHTML = `
      <div class="empty-state">
        <p>No trades recorded.</p>
      </div>
    `;

    return;

  }

  container.innerHTML = recent.map(t => {

    const resultClass =
      t.result === "Win"
        ? "win"
        : t.result === "Loss"
          ? "loss"
          : "be";

    const pl = number(t.profitLoss);

    return `
      <div class="recent-trade">

        <div class="recent-date">
          ${escapeHTML(t.date || "-")}
        </div>

        <div class="recent-main">
          <strong>
            ${escapeHTML(t.pair || "XAUUSD")}
          </strong>

          <small>
            ${escapeHTML(t.direction || "-")}
            •
            ${escapeHTML(t.setup || "-")}
          </small>
        </div>

        <div class="result ${resultClass}">
          ${pl >= 0 ? "+" : ""}${money(pl)}
        </div>

      </div>
    `;

  }).join("");

}


/* =========================================================
   INSIGHTS
========================================================= */

function renderInsights() {

  const container = $("quickInsights");

  if (!container) return;

  if (!trades.length) {

    container.innerHTML = `
      <div class="insight">
        <strong>Start collecting data.</strong><br>
        Your journal will generate insights after you record trades.
      </div>
    `;

    return;

  }

  const insights = [];

  const wins = trades.filter(t => t.result === "Win");

  const losses = trades.filter(t => t.result === "Loss");

  const winRate =
    trades.length
      ? wins.length / trades.length * 100
      : 0;

  const mistakes = {};

  trades.forEach(t => {

    if (t.mistake && t.mistake !== "None") {
      mistakes[t.mistake] =
        (mistakes[t.mistake] || 0) + 1;
    }

  });

  const topMistake =
    Object.entries(mistakes)
      .sort((a,b) => b[1] - a[1])[0];


  insights.push(`
    <strong>${trades.length} trades recorded.</strong>
    Current win rate is ${winRate.toFixed(1)}%.
  `);


  if (topMistake) {

    insights.push(`
      Your most repeated recorded mistake is
      <strong>${escapeHTML(topMistake[0])}</strong>
      (${topMistake[1]} trades).
    `);

  } else {

    insights.push(`
      <strong>No mistakes recorded.</strong>
      Keep recording honestly so the data becomes useful.
    `);

  }


  if (wins.length && losses.length) {

    const avgW =
      wins.reduce(
        (s,t) => s + number(t.profitLoss),
        0
      ) / wins.length;

    const avgL =
      Math.abs(
        losses.reduce(
          (s,t) => s + number(t.profitLoss),
          0
        ) / losses.length
      );

    insights.push(`
      Average win is <strong>${money(avgW)}</strong>
      while average loss is <strong>${money(avgL)}</strong>.
    `);

  }


  container.innerHTML =
    insights.map(i => `
      <div class="insight">${i}</div>
    `).join("");

}


/* =========================================================
   JOURNAL FILTERS
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

  const setup =
    $("setupFilter").value;

  return trades.filter(t => {

    const searchable = [
      t.pair,
      t.setup,
      t.notes,
      t.session,
      t.psychology,
      t.mistake
    ]
      .join(" ")
      .toLowerCase();

    if (
      search &&
      !searchable.includes(search)
    ) {
      return false;
    }

    if (
      result !== "all" &&
      t.result !== result
    ) {
      return false;
    }

    if (
      direction !== "all" &&
      t.direction !== direction
    ) {
      return false;
    }

    if (
      setup !== "all" &&
      t.setup !== setup
    ) {
      return false;
    }

    return true;

  });

}


[
  "tradeSearch",
  "resultFilter",
  "directionFilter",
  "setupFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderTrades
  );

});


function updateFilters() {

  const select = $("setupFilter");

  const current = select.value;

  const setups = [
    ...new Set(
      trades
        .map(t => t.setup)
        .filter(Boolean)
    )
  ].sort();

  select.innerHTML = `
    <option value="all">All Setups</option>
    ${setups.map(s => `
      <option value="${escapeHTML(s)}">
        ${escapeHTML(s)}
      </option>
    `).join("")}
  `;

  if (
    setups.includes(current)
  ) {
    select.value = current;
  }

}


/* =========================================================
   TRADE TABLE
========================================================= */

function renderTrades() {

  const body = $("tradeTableBody");
  const empty = $("emptyTrades");

  const filtered = getFilteredTrades();

  if (!filtered.length) {

    body.innerHTML = "";

    empty.style.display = "block";

  } else {

    empty.style.display = "none";

    body.innerHTML = filtered.map(t => {

      const resultClass =
        t.result === "Win"
          ? "win"
          : t.result === "Loss"
            ? "loss"
            : "be";

      const directionClass =
        t.direction === "Buy"
          ? "direction-buy"
          : "direction-sell";

      const pl = number(t.profitLoss);

      return `
        <tr>

          <td>
            ${escapeHTML(t.date || "-")}
          </td>

          <td>
            <strong>
              ${escapeHTML(t.pair || "-")}
            </strong>
          </td>

          <td class="${directionClass}">
            ${escapeHTML(t.direction || "-")}
          </td>

          <td>
            ${escapeHTML(t.setup || "-")}
          </td>

          <td>
            ${number(t.rr).toFixed(2)}R
          </td>

          <td>
            <span class="result ${resultClass}">
              ${escapeHTML(t.result || "-")}
            </span>
          </td>

          <td class="${pl >= 0 ? "direction-buy" : "direction-sell"}">
            ${pl >= 0 ? "+" : ""}${money(pl)}
          </td>

          <td>
            ${escapeHTML(t.psychology || "-")}
          </td>

          <td>

            <div class="table-actions">

              <button
                class="small-action edit-trade"
                data-id="${t.id}">
                Edit
              </button>

              <button
                class="small-action delete-trade"
                data-id="${t.id}">
                ×
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join("");

  }


  const wins =
    filtered.filter(t => t.result === "Win");

  const losses =
    filtered.filter(t => t.result === "Loss");

  const pl =
    filtered.reduce(
      (s,t) => s + number(t.profitLoss),
      0
    );

  safeText(
    "journalCount",
    filtered.length
  );

  safeText(
    "journalWins",
    wins.length
  );

  safeText(
    "journalLosses",
    losses.length
  );

  safeText(
    "journalPL",
    money(pl)
  );


  document
    .querySelectorAll(".edit-trade")
    .forEach(button => {

      button.addEventListener("click", () => {

        const trade = trades.find(
          t => t.id === button.dataset.id
        );

        if (trade) {
          openTradeModal(trade);
        }

      });

    });


  document
    .querySelectorAll(".delete-trade")
    .forEach(button => {

      button.addEventListener("click", () => {

        deleteTrade(
          button.dataset.id
        );

      });

    });

}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  renderGroupAnalytics(
    "setupAnalytics",
    "setup"
  );

  renderGroupAnalytics(
    "directionAnalytics",
    "direction"
  );

  renderGroupAnalytics(
    "sessionAnalytics",
    "session"
  );

  renderPsychology();

  renderMistakes();

  renderRDistribution();

}


function renderGroupAnalytics(
  containerId,
  property
) {

  const container = $(containerId);

  if (!container) return;

  const groups = {};

  trades.forEach(t => {

    const key =
      t[property] || "Unknown";

    if (!groups[key]) {

      groups[key] = {
        trades: 0,
        wins: 0,
        pl: 0
      };

    }

    groups[key].trades++;

    if (t.result === "Win") {
      groups[key].wins++;
    }

    groups[key].pl +=
      number(t.profitLoss);

  });


  const rows =
    Object.entries(groups)
      .sort((a,b) => b[1].pl - a[1].pl);


  if (!rows.length) {

    container.innerHTML =
      `<div class="empty-state"><p>No data yet.</p></div>`;

    return;

  }


  const maxTrades =
    Math.max(
      ...rows.map(
        x => x[1].trades
      )
    );


  container.innerHTML =
    rows.map(([name,data]) => {

      const winRate =
        data.trades
          ? data.wins / data.trades * 100
          : 0;

      const width =
        maxTrades
          ? data.trades / maxTrades * 100
          : 0;

      return `
        <div class="analytics-row">

          <div class="analytics-row-top">

            <strong>
              ${escapeHTML(name)}
            </strong>

            <span class="${
              data.pl >= 0
                ? "direction-buy"
                : "direction-sell"
            }">
              ${data.pl >= 0 ? "+" : ""}
              ${money(data.pl)}
            </span>

          </div>

          <div class="analytics-bar">
            <div style="width:${width}%"></div>
          </div>

          <div class="analytics-meta">
            <span>
              ${data.trades} trades
            </span>

            <span>
              ${winRate.toFixed(0)}% win rate
            </span>
          </div>

        </div>
      `;

    }).join("");

}


/* =========================================================
   PSYCHOLOGY
========================================================= */

function renderPsychology() {

  renderGroupAnalytics(
    "psychologyAnalytics",
    "psychology"
  );

}


/* =========================================================
   MISTAKES
========================================================= */

function renderMistakes() {

  const container =
    $("mistakeAnalytics");

  if (!container) return;

  const mistakes = {};

  trades.forEach(t => {

    if (
      !t.mistake ||
      t.mistake === "None"
    ) {
      return;
    }

    mistakes[t.mistake] =
      (mistakes[t.mistake] || 0) + 1;

  });


  const rows =
    Object.entries(mistakes)
      .sort((a,b) => b[1] - a[1]);


  if (!rows.length) {

    container.innerHTML = `
      <div class="empty-state">
        <p>No mistakes recorded.</p>
      </div>
    `;

    return;

  }


  const max =
    Math.max(...rows.map(x => x[1]));


  container.innerHTML =
    rows.map(([name,count]) => {

      const width =
        count / max * 100;

      return `
        <div class="analytics-row">

          <div class="analytics-row-top">
            <strong>
              ${escapeHTML(name)}
            </strong>

            <span>
              ${count}
            </span>
          </div>

          <div class="analytics-bar">
            <div style="width:${width}%"></div>
          </div>

        </div>
      `;

    }).join("");

}


/* =========================================================
   R DISTRIBUTION
========================================================= */

function renderRDistribution() {

  const container =
    $("rAnalytics");

  if (!container) return;

  if (!trades.length) {

    container.innerHTML =
      `<div class="empty-state"><p>No R data yet.</p></div>`;

    return;

  }

  const buckets = {
    "< -2R": 0,
    "-2R to -1R": 0,
    "-1R to 0R": 0,
    "0R to 1R": 0,
    "1R to 2R": 0,
    "> 2R": 0
  };


  trades.forEach(t => {

    const r = number(t.rr);

    let key;

    if (t.result === "Loss") {

      const signed =
        number(t.rMultiple);

      if (signed <= -2) {
        key = "< -2R";
      } else if (signed < -1) {
        key = "-2R to -1R";
      } else {
        key = "-1R to 0R";
      }

    } else if (t.result === "Win") {

      if (r > 2) {
        key = "> 2R";
      } else if (r >= 1) {
        key = "1R to 2R";
      } else {
        key = "0R to 1R";
      }

    } else {

      key = "0R to 1R";

    }

    buckets[key]++;

  });


  const max =
    Math.max(...Object.values(buckets), 1);


  container.innerHTML =
    Object.entries(buckets).map(
      ([name,count]) => {

        return `
          <div class="r-bar">

            <span>${name}</span>

            <div class="r-bar-track">
              <div
                class="r-bar-fill"
                style="width:${count / max * 100}%">
              </div>
            </div>

            <span>${count}</span>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

$("calculateRisk").addEventListener(
  "click",
  calculateRisk
);


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
    calculateRisk
  );

});


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
    number($("calcContract").value);


  const riskAmount =
    balance * riskPercent / 100;

  const distance =
    Math.abs(entry - sl);

  const rewardDistance =
    Math.abs(tp - entry);

  const rr =
    distance > 0
      ? rewardDistance / distance
      : 0;

  const lot =
    distance > 0 && contract > 0
      ? riskAmount / (distance * contract)
      : 0;

  const potentialLoss =
    lot * distance * contract;

  const potentialProfit =
    lot * rewardDistance * contract;


  safeText(
    "calcRiskAmount",
    money(riskAmount)
  );

  safeText(
    "calcDistance",
    distance.toFixed(2)
  );

  safeText(
    "calcRR",
    `${rr.toFixed(2)}R`
  );

  safeText(
    "calcLot",
    lot.toFixed(2)
  );

  safeText(
    "calcLoss",
    money(potentialLoss)
  );

  safeText(
    "calcProfit",
    money(potentialProfit)
  );

}


/* =========================================================
   CALENDAR
========================================================= */

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


function renderCalendar() {

  const grid =
    $("calendarGrid");

  if (!grid) return;

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

  safeText(
    "calendarMonth",
    monthName
  );


  const first =
    new Date(
      year,
      month,
      1
    );

  let start =
    first.getDay();

  start =
    start === 0
      ? 6
      : start - 1;

  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  let html = "";

  for (let i = 0; i < start; i++) {

    html += `
      <div class="calendar-day empty"></div>
    `;

  }


  for (let day = 1; day <= days; day++) {

    const date =
      `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

    const dayTrades =
      trades.filter(
        t => t.date === date
      );

    const pl =
      dayTrades.reduce(
        (s,t) => s + number(t.profitLoss),
        0
      );


    let className = "";

    if (dayTrades.length) {

      className =
        pl > 0
          ? "profit"
          : pl < 0
            ? "loss"
            : "";

    }


    html += `
      <div class="calendar-day ${className}">

        <div class="calendar-number">
          ${day}
        </div>

        ${
          dayTrades.length
            ? `
              <div class="calendar-pl">
                ${pl >= 0 ? "+" : ""}
                ${money(pl)}
              </div>

              <div class="calendar-trades">
                ${dayTrades.length} trade${dayTrades.length > 1 ? "s" : ""}
              </div>
            `
            : ""
        }

      </div>
    `;

  }


  grid.innerHTML = html;

}


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCSV").addEventListener(
  "click",
  exportCSV
);


function exportCSV() {

  if (!trades.length) {

    showToast("No trades to export.");

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
    "P/L",
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"
  ];


  const rows =
    trades.map(t => [

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

    ]);


  const csv = [
    headers,
    ...rows
  ]
    .map(row =>
      row.map(value =>
        `"${String(value ?? "")
          .replaceAll('"', '""')}"`
      ).join(",")
    )
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
    `ujr-fx-trading-journal-${todayISO()}.csv`;

  a.click();

  URL.revokeObjectURL(url);

  showToast("CSV exported.");

}


/* =========================================================
   DATE
========================================================= */

function updateDate() {

  const now = new Date();

  const text =
    now.toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    );

  safeText(
    "todayText",
    text
  );

  safeText(
    "heroDate",
    text
  );

}


updateDate();


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      showToast("Signed out.");

    } catch (err) {

      console.error(err);

      showToast("Could not sign out.");

    }

  }
);


/* =========================================================
   KEYBOARD SHORTCUT
========================================================= */

document.addEventListener(
  "keydown",
  e => {

    if (
      e.key.toLowerCase() === "n" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA" &&
      document.activeElement.tagName !== "SELECT"
    ) {

      openTradeModal();

    }

    if (
      e.key === "Escape" &&
      !$("tradeModal").classList.contains("hidden")
    ) {

      closeTradeModal();

    }

  }
);


/* =========================================================
   RESIZE CHART
========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      !$("appScreen").classList.contains("hidden")
    ) {
      renderEquityChart();
    }

  }
);


/* =========================================================
   INITIAL CALCULATOR
========================================================= */

calculateRisk();
