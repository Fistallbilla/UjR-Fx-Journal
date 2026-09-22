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


/* =========================
   FIREBASE
========================= */

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


/* =========================
   GLOBAL DATA
========================= */

let currentUser = null;
let trades = [];
let account = {
  startingBalance: 0,
  currency: "USD"
};

let unsubscribeTrades = null;

let calendarDate = new Date();


/* =========================
   ELEMENT HELPERS
========================= */

const $ = id => document.getElementById(id);


/* =========================
   LOGIN
========================= */

$("googleLoginBtn").addEventListener("click", async () => {

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error(error);

    if (error.code === "auth/popup-blocked") {
      $("loginError").textContent = "Popup was blocked. Allow popups and try again.";
    } else if (error.code === "auth/popup-closed-by-user") {
      $("loginError").textContent = "Login window was closed.";
    } else if (error.code === "auth/unauthorized-domain") {
      $("loginError").textContent = "This website is not authorized in Firebase.";
    } else if (error.code === "auth/operation-not-allowed") {
      $("loginError").textContent = "Google login is not enabled in Firebase.";
    } else {
      $("loginError").textContent = error.message;
    }

  }

});


/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth, async user => {

  if (user) {

    currentUser = user;

    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    $("settingsName").textContent = user.displayName || "User";
    $("settingsEmail").textContent = user.email || "";

    if (user.photoURL) {
      $("settingsPhoto").src = user.photoURL;
    }

    await loadAccount();

    subscribeTrades();

  } else {

    currentUser = null;

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

  }

});


/* =========================
   ACCOUNT
========================= */

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
        startingBalance: Number(snap.data().startingBalance || 0),
        currency: snap.data().currency || "USD"
      };

    }

    $("startingBalance").value = account.startingBalance;
    $("currency").value = account.currency;

  } catch (error) {

    console.error("Account load error:", error);

  }

}


$("saveAccountBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const startingBalance =
    Number($("startingBalance").value || 0);

  const currency =
    $("currency").value;

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

    account.startingBalance = startingBalance;
    account.currency = currency;

    $("accountMessage").textContent = "Settings saved ✓";

    showToast("Settings saved");

    renderDashboard();

  } catch (error) {

    console.error(error);

    $("accountMessage").textContent =
      "Could not save account.";

  }

});


/* =========================
   TRADES REALTIME
========================= */

function subscribeTrades() {

  if (!currentUser) return;

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

      sortTrades();

      renderEverything();

    },
    error => {

      console.error("Trade listener error:", error);

    }
  );

}


function sortTrades() {

  trades.sort((a, b) => {

    const dateA =
      `${a.date || ""} ${a.time || ""}`;

    const dateB =
      `${b.date || ""} ${b.time || ""}`;

    return dateB.localeCompare(dateA);

  });

}


/* =========================
   NAVIGATION
========================= */

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    const page = button.dataset.page;

    document.querySelectorAll(".nav-item")
      .forEach(x => x.classList.remove("active"));

    button.classList.add("active");

    document.querySelectorAll(".page")
      .forEach(x => x.classList.remove("active-page"));

    $(`${page}Page`).classList.add("active-page");

    const titles = {
      dashboard: "Dashboard",
      journal: "Journal",
      analytics: "Analytics",
      risk: "Risk Calculator",
      calendar: "Calendar",
      settings: "Settings"
    };

    $("pageTitle").textContent =
      titles[page] || "Dashboard";

    $("sidebar").classList.remove("open");

  });

});


/* =========================
   SIDEBAR
========================= */

$("openSidebar").addEventListener("click", () => {
  $("sidebar").classList.add("open");
});

$("closeSidebar").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
});


/* =========================
   LOGOUT
========================= */

$("logoutBtn").addEventListener("click", async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

  }

});


/* =========================
   TRADE MODAL
========================= */

function openTradeModal(trade = null) {

  $("tradeModal").classList.add("show");

  if (trade) {

    $("modalTitle").textContent = "Edit Trade";

    $("tradeId").value = trade.id || "";

    $("tradeDate").value = trade.date || "";
    $("tradeTime").value = trade.time || "";

    $("pair").value = trade.pair || "XAUUSD";

    $("direction").value =
      trade.direction || "Buy";

    $("entry").value =
      trade.entry ?? "";

    $("sl").value =
      trade.sl ?? "";

    $("tp").value =
      trade.tp ?? "";

    $("rr").value =
      trade.rr ? formatRR(trade.rr) : "";

    $("riskPercent").value =
      trade.riskPercent ?? "";

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

    calculateTradeRR();

  } else {

    $("modalTitle").textContent = "Add Trade";

    $("tradeForm").reset();

    $("tradeId").value = "";

    $("pair").value = "XAUUSD";

    $("direction").value = "Buy";

    $("result").value = "Win";

    $("rr").value = "";

    const today = new Date();

    $("tradeDate").value =
      today.toISOString().split("T")[0];

  }

}


function closeTradeModal() {

  $("tradeModal").classList.remove("show");

}


$("closeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);

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


/* =========================
   AUTO RR
========================= */

function calculateTradeRR() {

  const entry =
    parseFloat($("entry").value);

  const sl =
    parseFloat($("sl").value);

  const tp =
    parseFloat($("tp").value);

  const direction =
    $("direction").value;

  const rrInput =
    $("rr");

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(sl) ||
    !Number.isFinite(tp)
  ) {

    rrInput.value = "";

    return;

  }


  let risk = 0;
  let reward = 0;


  if (direction === "Buy") {

    risk = Math.abs(entry - sl);

    reward = tp - entry;

  } else {

    risk = Math.abs(sl - entry);

    reward = entry - tp;

  }


  if (risk <= 0 || reward <= 0) {

    rrInput.value = "Invalid";

    return;

  }


  const rr =
    reward / risk;

  rrInput.value =
    `1:${rr.toFixed(2)}`;

}


["entry", "sl", "tp"].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateTradeRR
  );

});


$("direction").addEventListener(
  "change",
  calculateTradeRR
);


/* =========================
   RR FORMAT
========================= */

function formatRR(value) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return `1:${number.toFixed(2)}`;

}


function numericRR(value) {

  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  const cleaned =
    String(value).replace("1:", "");

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;

}


/* =========================
   SAVE TRADE
========================= */

$("tradeForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!currentUser) return;


    calculateTradeRR();


    const rrText =
      $("rr").value;

    let rrValue =
      numericRR(rrText);


    const trade = {

      date: $("tradeDate").value,

      time: $("tradeTime").value,

      pair:
        $("pair").value.trim() ||
        "XAUUSD",

      direction:
        $("direction").value,

      entry:
        Number($("entry").value || 0),

      sl:
        Number($("sl").value || 0),

      tp:
        Number($("tp").value || 0),

      rr:
        rrValue,

      riskPercent:
        Number($("riskPercent").value || 0),

      riskAmount:
        Number($("riskAmount").value || 0),

      lotSize:
        Number($("lotSize").value || 0),

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
        Number($("profitLoss").value || 0),

      psychology:
        $("psychology").value.trim(),

      confidence:
        Number($("confidence").value || 0),

      mistake:
        $("mistake").value.trim(),

      notes:
        $("notes").value.trim(),

      updatedAt:
        Date.now()

    };


    const id =
      $("tradeId").value;


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

      console.error(error);

      showToast(
        "Could not save trade"
      );

    }

  }
);


/* =========================
   DELETE TRADE
========================= */

async function deleteTrade(id) {

  if (!currentUser) return;

  const confirmed =
    confirm(
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


/* =========================
   DASHBOARD
========================= */

function getStats() {

  const starting =
    Number(account.startingBalance || 0);

  const totalPL =
    trades.reduce(
      (sum, t) =>
        sum + Number(t.profitLoss || 0),
      0
    );

  const wins =
    trades.filter(
      t => t.result === "Win"
    );

  const losses =
    trades.filter(
      t => t.result === "Loss"
    );

  const winRate =
    trades.length
      ? wins.length / trades.length * 100
      : 0;


  const grossProfit =
    wins.reduce(
      (sum, t) =>
        sum + Math.max(0, Number(t.profitLoss || 0)),
      0
    );


  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, t) =>
          sum + Math.min(0, Number(t.profitLoss || 0)),
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
      .map(t => numericRR(t.rr))
      .filter(x => x > 0);


  const averageRR =
    rrValues.length
      ? rrValues.reduce((a, b) => a + b, 0) /
        rrValues.length
      : 0;


  const averageWin =
    wins.length
      ? wins.reduce(
          (sum, t) =>
            sum + Number(t.profitLoss || 0),
          0
        ) / wins.length
      : 0;


  const averageLoss =
    losses.length
      ? losses.reduce(
          (sum, t) =>
            sum + Number(t.profitLoss || 0),
          0
        ) / losses.length
      : 0;


  const balances = [];

  let balance = starting;

  let peak = starting;
  let maxDD = 0;


  [...trades]
    .sort((a, b) => {

      const A =
        `${a.date || ""} ${a.time || ""}`;

      const B =
        `${b.date || ""} ${b.time || ""}`;

      return A.localeCompare(B);

    })
    .forEach(t => {

      balance +=
        Number(t.profitLoss || 0);

      balances.push(balance);

      peak =
        Math.max(peak, balance);

      maxDD =
        Math.max(
          maxDD,
          peak - balance
        );

    });


  return {
    starting,
    balance: starting + totalPL,
    totalPL,
    wins: wins.length,
    losses: losses.length,
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


function money(value) {

  const currency =
    account.currency || "USD";

  try {

    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency
      }
    ).format(value || 0);

  } catch {

    return `${currency} ${Number(value || 0).toFixed(2)}`;

  }

}


function renderDashboard() {

  const s =
    getStats();


  $("dashBalance").textContent =
    money(s.balance);

  $("totalProfit").textContent =
    money(s.totalPL);

  const profitPercent =
    s.starting > 0
      ? s.totalPL / s.starting * 100
      : 0;

  $("profitPercent").textContent =
    `${profitPercent.toFixed(2)}%`;


  $("winRate").textContent =
    `${s.winRate.toFixed(1)}%`;

  $("winLossText").textContent =
    `${s.wins}W / ${s.losses}L`;


  $("maxDrawdown").textContent =
    money(s.maxDD);


  $("profitFactor").textContent =
    s.profitFactor === Infinity
      ? "∞"
      : s.profitFactor.toFixed(2);


  $("expectancy").textContent =
    money(s.expectancy);


  $("averageRR").textContent =
    s.averageRR
      ? `1:${s.averageRR.toFixed(2)}`
      : "0.00";


  $("averageWin").textContent =
    money(s.averageWin);

  $("averageLoss").textContent =
    money(s.averageLoss);


  $("equityProfit").textContent =
    money(s.totalPL);


  renderEquityCurve();

  renderStreaks();

  renderRecentTrades();

  renderInsights();

}


/* =========================
   EQUITY CURVE
========================= */

function renderEquityCurve() {

  const canvas =
    $("equityCanvas");

  const rect =
    canvas.getBoundingClientRect();

  const width =
    Math.max(rect.width, 300);

  const height =
    Math.max(rect.height, 240);

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    width * ratio;

  canvas.height =
    height * ratio;

  const ctx =
    canvas.getContext("2d");

  ctx.scale(ratio, ratio);


  const stats =
    getStats();

  const values =
    [stats.starting, ...stats.balances];


  if (values.length <= 1) {

    ctx.font = "14px Arial";

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
      ((width - padding * 2) /
        (values.length - 1));

    const y =
      height -
      padding -
      ((value - min) / range) *
      (height - padding * 2);


    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

  });


  ctx.lineWidth = 2;

  ctx.stroke();


  ctx.lineTo(width - padding, height - padding);

  ctx.lineTo(padding, height - padding);

  ctx.closePath();

  ctx.globalAlpha = 0.08;

  ctx.fill();

  ctx.globalAlpha = 1;

}


/* =========================
   STREAKS
========================= */

function renderStreaks() {

  const ordered =
    [...trades].sort((a, b) => {

      const A =
        `${a.date || ""} ${a.time || ""}`;

      const B =
        `${b.date || ""} ${b.time || ""}`;

      return A.localeCompare(B);

    });


  let current = 0;
  let currentType = "";

  let bestWin = 0;
  let worstLoss = 0;

  let streak = 0;
  let type = "";


  ordered.forEach(t => {

    if (t.result === "Win") {

      if (type === "Win") {
        streak++;
      } else {
        streak = 1;
        type = "Win";
      }

      bestWin =
        Math.max(bestWin, streak);

    } else if (t.result === "Loss") {

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


  current = streak;
  currentType = type;


  $("currentStreak").textContent =
    current;

  $("currentStreakType").textContent =
    current
      ? `${currentType} streak`
      : "No streak";

  $("bestWinStreak").textContent =
    bestWin;

  $("worstLossStreak").textContent =
    worstLoss;

}


/* =========================
   RECENT TRADES
========================= */

function renderRecentTrades() {

  const container =
    $("recentTrades");

  container.innerHTML = "";


  trades.slice(0, 6).forEach(t => {

    const row =
      document.createElement("div");

    row.className =
      "recent-trade";


    const resultClass =
      t.result === "Win"
        ? "win"
        : t.result === "Loss"
          ? "loss"
          : "be";


    row.innerHTML = `

      <div>
        <strong>${escapeHTML(t.pair || "XAUUSD")}</strong>
        <span>${escapeHTML(t.direction || "")}</span>
      </div>

      <div>
        <strong class="${resultClass}">
          ${escapeHTML(t.result || "")}
        </strong>

        <span>
          ${money(Number(t.profitLoss || 0))}
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


/* =========================
   INSIGHTS
========================= */

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


  const stats =
    getStats();


  const insights = [];


  insights.push(
    `You have recorded ${trades.length} trades.`
  );


  insights.push(
    `Current win rate is ${stats.winRate.toFixed(1)}%.`
  );


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


  if (buys || sells) {

    insights.push(
      `Direction split: ${buys} Buy / ${sells} Sell.`
    );

  }


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


/* =========================
   JOURNAL
========================= */

function renderJournal() {

  const tbody =
    $("tradeTableBody");

  tbody.innerHTML = "";


  const search =
    $("tradeSearch").value
      .toLowerCase();

  const result =
    $("resultFilter").value;

  const direction =
    $("directionFilter").value;

  const setup =
    $("setupFilter").value;


  const filtered =
    trades.filter(t => {

      const text =
        JSON.stringify(t)
          .toLowerCase();

      if (
        search &&
        !text.includes(search)
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


  filtered.forEach(t => {

    const tr =
      document.createElement("tr");


    const resultClass =
      t.result === "Win"
        ? "win"
        : t.result === "Loss"
          ? "loss"
          : "be";


    tr.innerHTML = `

      <td>${escapeHTML(t.date || "")}</td>

      <td>${escapeHTML(t.pair || "")}</td>

      <td>${escapeHTML(t.direction || "")}</td>

      <td>${escapeHTML(t.setup || "-")}</td>

      <td>${t.entry ?? "-"}</td>

      <td>${t.sl ?? "-"}</td>

      <td>${t.tp ?? "-"}</td>

      <td>
        ${t.rr
          ? `1:${numericRR(t.rr).toFixed(2)}`
          : "-"}
      </td>

      <td>
        <span class="result-badge ${resultClass}">
          ${escapeHTML(t.result || "-")}
        </span>
      </td>

      <td>
        ${money(Number(t.profitLoss || 0))}
      </td>

      <td>

        <div class="table-actions">

          <button
            class="edit-btn"
            data-edit="${t.id}">
            Edit
          </button>

          <button
            class="delete-btn"
            data-delete="${t.id}">
            Delete
          </button>

        </div>

      </td>

    `;


    tbody.appendChild(tr);

  });


  $("emptyTrades").style.display =
    filtered.length
      ? "none"
      : "block";


  const wins =
    filtered.filter(
      t => t.result === "Win"
    ).length;

  const losses =
    filtered.filter(
      t => t.result === "Loss"
    ).length;

  const pl =
    filtered.reduce(
      (sum, t) =>
        sum + Number(t.profitLoss || 0),
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


  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            trades.find(
              t =>
                t.id ===
                button.dataset.edit
            );

          if (trade) {
            openTradeModal(trade);
          }

        }
      );

    });


  document
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


["tradeSearch", "resultFilter", "directionFilter", "setupFilter"]
  .forEach(id => {

    $(id).addEventListener(
      "input",
      renderJournal
    );

    $(id).addEventListener(
      "change",
      renderJournal
    );

  });


/* =========================
   SETUP FILTER
========================= */

function updateSetupFilter() {

  const select =
    $("setupFilter");

  const current =
    select.value;

  const setups =
    [...new Set(
      trades
        .map(t => t.setup)
        .filter(Boolean)
    )].sort();


  select.innerHTML =
    `<option value="all">All Setups</option>`;


  setups.forEach(setup => {

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


/* =========================
   ANALYTICS
========================= */

function groupPerformance(key) {

  const groups = {};


  trades.forEach(t => {

    const name =
      t[key] || "Unknown";


    if (!groups[name]) {

      groups[name] = {
        trades: 0,
        wins: 0,
        pl: 0
      };

    }


    groups[name].trades++;

    if (t.result === "Win") {
      groups[name].wins++;
    }

    groups[name].pl +=
      Number(t.profitLoss || 0);

  });


  return groups;

}


function renderGroup(containerId, key) {

  const container =
    $(containerId);

  container.innerHTML = "";


  const groups =
    groupPerformance(key);


  const entries =
    Object.entries(groups);


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-small">
        No data yet.
      </div>`;

    return;

  }


  entries.forEach(
    ([name, data]) => {

      const winRate =
        data.trades
          ? data.wins /
            data.trades *
            100
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

    }
  );

}


function renderPsychology() {

  const container =
    $("psychologyAnalytics");

  container.innerHTML = "";


  const groups =
    groupPerformance("psychology");


  const entries =
    Object.entries(groups);


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-small">
        No psychology data yet.
      </div>`;

    return;

  }


  entries.forEach(
    ([name, data]) => {

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
            ${data.trades} trades
          </span>
        </div>

        <strong>
          ${money(data.pl)}
        </strong>

      `;


      container.appendChild(row);

    }
  );

}


function renderMistakes() {

  const container =
    $("mistakeAnalytics");

  container.innerHTML = "";


  const counts = {};


  trades.forEach(t => {

    if (!t.mistake) return;

    counts[t.mistake] =
      (counts[t.mistake] || 0) + 1;

  });


  const entries =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1]);


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-small">
        No mistakes recorded.
      </div>`;

    return;

  }


  entries.forEach(
    ([mistake, count]) => {

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

    }
  );

}


function renderRDistribution() {

  const container =
    $("rAnalytics");

  container.innerHTML = "";


  const buckets = {
    "0R": 0,
    "0-1R": 0,
    "1-2R": 0,
    "2R+": 0
  };


  trades.forEach(t => {

    const rr =
      numericRR(t.rr);

    if (!rr) return;


    if (rr < 1) {
      buckets["0-1R"]++;
    } else if (rr < 2) {
      buckets["1-2R"]++;
    } else {
      buckets["2R+"]++;
    }

  });


  Object.entries(buckets)
    .forEach(([name, count]) => {

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

    });

}


/* =========================
   RISK CALCULATOR
========================= */

function calculateRisk() {

  const balance =
    Number($("calcBalance").value || 0);

  const riskPercent =
    Number($("calcRisk").value || 0);

  const entry =
    Number($("calcEntry").value || 0);

  const sl =
    Number($("calcSL").value || 0);

  const tp =
    Number($("calcTP").value || 0);

  const contract =
    Number($("calcContract").value || 100);


  const riskAmount =
    balance *
    riskPercent /
    100;


  const distance =
    Math.abs(entry - sl);


  let reward =
    0;


  if (entry && sl && tp) {
    reward =
      Math.abs(tp - entry);
  }


  const rr =
    distance > 0
      ? reward / distance
      : 0;


  const lot =
    distance > 0 &&
    contract > 0
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
    rr
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


/* =========================
   CALENDAR
========================= */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  const monthName =
    calendarDate.toLocaleString(
      "default",
      {
        month: "long",
        year: "numeric"
      }
    );


  $("calendarMonth").textContent =
    monthName;


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
        t => t.date === dateString
      );


    const pl =
      dayTrades.reduce(
        (sum, t) =>
          sum + Number(t.profitLoss || 0),
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
          ? `<span>
              ${dayTrades.length} trade${dayTrades.length > 1 ? "s" : ""}
             </span>`
          : ""
      }

      ${
        dayTrades.length
          ? `<b>${money(pl)}</b>`
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


/* =========================
   CSV EXPORT
========================= */

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
      trades.map(t => [

        t.date,
        t.time,
        t.pair,
        t.direction,
        t.entry,
        t.sl,
        t.tp,
        numericRR(t.rr).toFixed(2),
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


    const csv =
      [headers, ...rows]
        .map(row =>
          row.map(value =>
            `"${String(value ?? "")
              .replace(/"/g, '""')}"`
          ).join(",")
        )
        .join("\n");


    const blob =
      new Blob(
        [csv],
        {
          type: "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "ujr-fx-trading-journal.csv";

    link.click();

    URL.revokeObjectURL(url);

  }
);


/* =========================
   RENDER EVERYTHING
========================= */

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


/* =========================
   TOAST
========================= */

function showToast(message) {

  const toast =
    $("toast");

  toast.textContent =
    message;

  toast.classList.add("show");


  setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================
   KEYBOARD SHORTCUTS
========================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key.toLowerCase() === "n" &&
      !["INPUT", "TEXTAREA", "SELECT"]
        .includes(
          document.activeElement.tagName
        )
    ) {

      openTradeModal();

    }


    if (
      event.key === "Escape"
    ) {

      closeTradeModal();

    }

  }
);


/* =========================
   RESIZE
========================= */

window.addEventListener(
  "resize",
  () => {

    renderEquityCurve();

  }
);
