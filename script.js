import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
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
   FIREBASE
========================================================= */

const firebaseConfig = {

  apiKey:
    "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",

  authDomain:
    "journal-38e0e.firebaseapp.com",

  databaseURL:
    "https://journal-38e0e-default-rtdb.firebaseio.com",

  projectId:
    "journal-38e0e",

  storageBucket:
    "journal-38e0e.firebasestorage.app",

  messagingSenderId:
    "382226906837",

  appId:
    "1:382226906837:web:38df881c0f7beb24256c5c",

  measurementId:
    "G-R6LXDMQ9K2"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});


/* =========================================================
   STATE
========================================================= */

const state = {

  user: null,

  trades: [],

  settings: {

    startingBalance: 0,

    currency: "USD"

  },

  unsubscribeTrades: null,

  unsubscribeSettings: null,

  editingTradeId: null,

  calendarDate: new Date(),

  selectedCalendarDate: null,

  analyticsPeriod: "all"

};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);


function num(value) {

  const n = Number(value);

  return Number.isFinite(n) ? n : 0;

}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function formatMoney(value) {

  const currency =
    state.settings.currency || "USD";

  const amount = num(value);

  return new Intl.NumberFormat(
    undefined,
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }
  ).format(amount);

}


function todayISO() {

  const d = new Date();

  const offset =
    d.getTimezoneOffset();

  const local =
    new Date(d.getTime() - offset * 60000);

  return local.toISOString().slice(0,10);

}


function formatDate(dateString) {

  if (!dateString) return "-";

  const d =
    new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(d.getTime())) return dateString;

  return d.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );

}


function makeTradeId() {

  const now = new Date();

  const date =
    now.toISOString()
      .slice(0,10)
      .replaceAll("-", "");

  const random =
    Math.floor(1000 + Math.random() * 9000);

  return `UJ-${date}-${random}`;

}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

$("googleLoginBtn").addEventListener(
  "click",
  async () => {

    const button =
      $("googleLoginBtn");

    button.disabled = true;

    button.innerHTML =
      `<span class="google-icon">G</span>
       <span>Signing in...</span>`;

    $("loginError").textContent = "";

    try {

      await signInWithPopup(
        auth,
        provider
      );

    } catch (error) {

      console.error(
        "Google Login Error:",
        error
      );

      if (
        error.code ===
        "auth/popup-blocked"
      ) {

        $("loginError").textContent =
          "Popup was blocked. Allow popups for this website.";

      } else if (
        error.code ===
        "auth/popup-closed-by-user"
      ) {

        $("loginError").textContent =
          "Login window was closed.";

      } else if (
        error.code ===
        "auth/unauthorized-domain"
      ) {

        $("loginError").textContent =
          "This website domain is not authorized in Firebase.";

      } else if (
        error.code ===
        "auth/operation-not-allowed"
      ) {

        $("loginError").textContent =
          "Google login is not enabled in Firebase.";

      } else if (
        error.code ===
        "auth/network-request-failed"
      ) {

        $("loginError").textContent =
          "Network error. Check your internet connection.";

      } else {

        $("loginError").textContent =
          error.message ||
          "Google login failed.";

      }

    } finally {

      button.disabled = false;

      button.innerHTML =
        `<span class="google-icon">G</span>
         <span>Continue with Google</span>`;

    }

  }
);


/*
  If a redirect login was previously started,
  safely consume its result.
*/

getRedirectResult(auth)
  .catch(error => {

    if (error) {

      console.error(
        "Redirect auth error:",
        error
      );

    }

  });


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    if (user) {

      state.user = user;

      $("loginScreen")
        .classList
        .add("hidden");

      $("app")
        .classList
        .remove("hidden");

      updateUserUI();

      await loadUserData();

    } else {

      state.user = null;

      if (state.unsubscribeTrades) {

        state.unsubscribeTrades();

        state.unsubscribeTrades = null;

      }

      if (state.unsubscribeSettings) {

        state.unsubscribeSettings();

        state.unsubscribeSettings = null;

      }

      $("app")
        .classList
        .add("hidden");

      $("loginScreen")
        .classList
        .remove("hidden");

    }

  }
);


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  if (!state.user) return;

  const name =
    state.user.displayName ||
    "Trader";

  const email =
    state.user.email ||
    "";

  const photo =
    state.user.photoURL ||
    "logo.png";


  $("sidebarUserName").textContent =
    name;

  $("sidebarUserEmail").textContent =
    email;

  $("sidebarUserPhoto").src =
    photo;


  $("settingsUserName").textContent =
    name;

  $("settingsUserEmail").textContent =
    email;

  $("settingsUserPhoto").src =
    photo;

}


/* =========================================================
   LOAD USER DATA
========================================================= */

async function loadUserData() {

  if (!state.user) return;


  /* SETTINGS */

  const settingsRef =
    doc(
      db,
      "users",
      state.user.uid,
      "settings",
      "main"
    );


  try {

    const settingsSnap =
      await getDoc(settingsRef);

    if (settingsSnap.exists()) {

      state.settings = {

        ...state.settings,

        ...settingsSnap.data()

      };

    }

  } catch (error) {

    console.error(
      "Settings load error:",
      error
    );

  }


  $("startingBalance").value =
    state.settings.startingBalance || 0;

  $("currency").value =
    state.settings.currency || "USD";


  /* TRADES */

  const tradesRef =
    collection(
      db,
      "users",
      state.user.uid,
      "trades"
    );


  const tradesQuery =
    query(
      tradesRef,
      orderBy("createdAt", "desc")
    );


  if (state.unsubscribeTrades) {

    state.unsubscribeTrades();

  }


  state.unsubscribeTrades =
    onSnapshot(
      tradesQuery,
      snapshot => {

        state.trades =
          snapshot.docs.map(
            docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            })
          );

        refreshUI();

      },

      error => {

        console.error(
          "Trades listener error:",
          error
        );

      }
    );

}


/* =========================================================
   REFRESH UI
========================================================= */

function refreshUI() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

}


/* =========================================================
   NAVIGATION
========================================================= */

const pageTitles = {

  dashboard: [
    "Dashboard",
    "Your trading performance at a glance."
  ],

  journal: [
    "Trading Journal",
    "Review and manage your trades."
  ],

  analytics: [
    "Analytics",
    "Understand what is working in your trading."
  ],

  calculator: [
    "Risk Calculator",
    "Calculate your trade risk before entering."
  ],

  calendar: [
    "Trading Calendar",
    "See your performance by date."
  ],

  settings: [
    "Settings",
    "Manage your journal preferences."
  ]

};


function openPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove(
        "active-page"
      );

    });


  const target =
    $(`page-${page}`);

  if (target) {

    target.classList.add(
      "active-page"
    );

  }


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


  if (pageTitles[page]) {

    $("pageTitle").textContent =
      pageTitles[page][0];

    $("pageSubtitle").textContent =
      pageTitles[page][1];

  }


  $("sidebar")
    .classList
    .remove("open");

}


document
  .querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        openPage(
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

        openPage(
          button.dataset.pageLink
        );

      }
    );

  });


$("menuBtn").addEventListener(
  "click",
  () => {

    $("sidebar")
      .classList
      .toggle("open");

  }
);


/* =========================================================
   MODAL
========================================================= */

function openTradeModal(trade = null) {

  state.editingTradeId =
    trade?.id || null;

  $("modalTitle").textContent =
    trade ? "Edit Trade" : "Add Trade";


  $("tradeError").textContent = "";


  if (trade) {

    $("tradeId").value =
      trade.tradeId || "";

    $("tradeDate").value =
      trade.date || todayISO();

    $("tradingType").value =
      trade.tradingType || "Scalping";

    $("direction").value =
      trade.direction || "Buy";

    $("strategy").value =
      trade.strategy || "Liquidity Sweep";

    $("session").value =
      trade.session || "London";

    $("marketBias").value =
      trade.marketBias || "Bullish";

    $("entry").value =
      trade.entry ?? "";

    $("sl").value =
      trade.sl ?? "";

    $("tp").value =
      trade.tp ?? "";

    $("rr").value =
      trade.rrDisplay || "";

    $("riskAmount").value =
      trade.riskAmount ?? "";

    $("lotSize").value =
      trade.lotSize ?? "";

    $("result").value =
      trade.result || "Win";

    $("profitLoss").value =
      trade.profitLoss ?? "";

    $("confidence").value =
      trade.confidence || "3/5";

    $("emotion").value =
      trade.emotion || "Calm";

    $("notes").value =
      trade.notes || "";

  } else {

    $("tradeForm").reset();

    $("tradeId").value =
      makeTradeId();

    $("tradeDate").value =
      todayISO();

    $("tradingType").value =
      "Scalping";

    $("direction").value =
      "Buy";

    $("strategy").value =
      "Liquidity Sweep";

    $("session").value =
      "London";

    $("marketBias").value =
      "Bullish";

    $("result").value =
      "Win";

    $("confidence").value =
      "3/5";

    $("emotion").value =
      "Calm";

    $("rr").value = "";

  }


  $("tradeModal")
    .classList
    .remove("hidden");


  setTimeout(() => {

    $("entry").focus();

  }, 100);

}


function closeTradeModal() {

  $("tradeModal")
    .classList
    .add("hidden");

  state.editingTradeId = null;

}


$("dashboardAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("mobileAddTradeBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("closeTradeModal")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("cancelTradeBtn")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("modalOverlay")
  .addEventListener(
    "click",
    closeTradeModal
  );


/* =========================================================
   RR CALCULATION
========================================================= */

function calculateTradeRR() {

  const entry =
    num($("entry").value);

  const sl =
    num($("sl").value);

  const tp =
    num($("tp").value);

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

    risk =
      entry - sl;

    reward =
      tp - entry;

  } else {

    risk =
      sl - entry;

    reward =
      entry - tp;

  }


  if (
    risk <= 0 ||
    reward <= 0
  ) {

    $("rr").value =
      "Invalid";

    return 0;

  }


  const rr =
    reward / risk;


  $("rr").value =
    `1:${rr.toFixed(2)}`;


  return rr;

}


[
  "entry",
  "sl",
  "tp",
  "direction"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateTradeRR
  );

  $(id).addEventListener(
    "change",
    calculateTradeRR
  );

});


/* =========================================================
   P/L LOGIC
========================================================= */

function normalizeProfitLossByResult() {

  const result =
    $("result").value;

  const input =
    $("profitLoss");


  if (result === "Break Even") {

    input.value = "0";

    return;

  }


  if (input.value === "") {
    return;
  }


  const value =
    Number(input.value);


  if (!Number.isFinite(value)) {
    return;
  }


  if (result === "Win") {

    input.value =
      Math.abs(value);

  }


  if (result === "Loss") {

    input.value =
      -Math.abs(value);

  }

}


function getNormalizedPL() {

  const result =
    $("result").value;

  const raw =
    $("profitLoss").value;


  if (result === "Break Even") {

    return 0;

  }


  if (raw === "") {

    return null;

  }


  const value =
    Number(raw);


  if (!Number.isFinite(value)) {

    return null;

  }


  if (result === "Win") {

    return Number(
      Math.abs(value).toFixed(2)
    );

  }


  if (result === "Loss") {

    return Number(
      -Math.abs(value).toFixed(2)
    );

  }


  return Number(
    value.toFixed(2)
  );

}


$("result")
  .addEventListener(
    "change",
    normalizeProfitLossByResult
  );


$("profitLoss")
  .addEventListener(
    "blur",
    normalizeProfitLossByResult
  );


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!state.user) {

        $("tradeError").textContent =
          "Please login first.";

        return;

      }


      $("tradeError").textContent = "";


      const riskRaw =
        $("riskAmount")
          .value
          .trim();


      const riskAmount =
        riskRaw === ""
          ? 0
          : Number(riskRaw);


      if (
        !Number.isFinite(riskAmount) ||
        riskAmount < 0
      ) {

        $("tradeError").textContent =
          "Risk Amount must be a valid positive number.";

        return;

      }


      normalizeProfitLossByResult();


      const profitLoss =
        getNormalizedPL();


      if (profitLoss === null) {

        $("tradeError").textContent =
          "Please enter the actual Profit / Loss amount.";

        return;

      }


      const rr =
        calculateTradeRR();


      const lotRaw =
        $("lotSize")
          .value
          .trim();


      const lotSize =
        lotRaw === ""
          ? 0
          : Number(lotRaw);


      if (
        !Number.isFinite(lotSize) ||
        lotSize < 0
      ) {

        $("tradeError").textContent =
          "Lot Size must be a valid number.";

        return;

      }


      const tradeData = {

        tradeId:
          $("tradeId").value,

        date:
          $("tradeDate").value,

        tradingType:
          $("tradingType").value,

        direction:
          $("direction").value,

        strategy:
          $("strategy").value,

        session:
          $("session").value,

        marketBias:
          $("marketBias").value,

        entry:
          Number($("entry").value),

        sl:
          Number($("sl").value),

        tp:
          Number($("tp").value),

        rr:
          Number.isFinite(rr)
            ? Number(rr.toFixed(4))
            : 0,

        rrDisplay:
          $("rr").value,

        riskAmount:
          Number(
            riskAmount.toFixed(2)
          ),

        lotSize:
          Number(
            lotSize.toFixed(2)
          ),

        result:
          $("result").value,

        profitLoss:
          Number(
            profitLoss.toFixed(2)
          ),

        confidence:
          $("confidence").value,

        emotion:
          $("emotion").value,

        notes:
          $("notes").value.trim(),

        updatedAt:
          Date.now()

      };


      const saveButton =
        $("saveTradeBtn");


      saveButton.disabled = true;

      saveButton.textContent =
        "Saving...";


      try {

        const tradesRef =
          collection(
            db,
            "users",
            state.user.uid,
            "trades"
          );


        if (state.editingTradeId) {

          const tradeRef =
            doc(
              db,
              "users",
              state.user.uid,
              "trades",
              state.editingTradeId
            );


          await updateDoc(
            tradeRef,
            tradeData
          );

        } else {

          tradeData.createdAt =
            Date.now();


          await addDoc(
            tradesRef,
            tradeData
          );

        }


        closeTradeModal();

      } catch (error) {

        console.error(
          "Save trade error:",
          error
        );

        $("tradeError").textContent =
          error.message ||
          "Could not save trade.";

      } finally {

        saveButton.disabled = false;

        saveButton.textContent =
          "Save Trade";

      }

    }
  );


/* =========================================================
   DASHBOARD
========================================================= */

function getStats(trades) {

  const wins =
    trades.filter(
      t => t.result === "Win"
    );

  const losses =
    trades.filter(
      t => t.result === "Loss"
    );

  const totalPL =
    trades.reduce(
      (sum, t) =>
        sum + num(t.profitLoss),
      0
    );

  const grossProfit =
    wins.reduce(
      (sum, t) =>
        sum + Math.max(0, num(t.profitLoss)),
      0
    );

  const grossLoss =
    losses.reduce(
      (sum, t) =>
        sum + Math.abs(
          Math.min(
            0,
            num(t.profitLoss)
          )
        ),
      0
    );

  const winRate =
    trades.length
      ? (wins.length / trades.length) * 100
      : 0;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const avgR =
    trades.length
      ? trades.reduce(
          (sum, t) => {

            const risk =
              num(t.riskAmount);

            if (risk <= 0) {
              return sum;
            }

            return sum +
              num(t.profitLoss) / risk;

          },
          0
        ) / trades.filter(
          t => num(t.riskAmount) > 0
        ).length
      : 0;

  const expectancy =
    trades.length
      ? totalPL / trades.length
      : 0;


  return {

    wins: wins.length,

    losses: losses.length,

    totalPL,

    grossProfit,

    grossLoss,

    winRate,

    profitFactor,

    avgR:
      Number.isFinite(avgR)
        ? avgR
        : 0,

    expectancy

  };

}


function renderDashboard() {

  const stats =
    getStats(state.trades);


  $("statTotalTrades").textContent =
    state.trades.length;


  $("statWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;


  $("statTotalPL").textContent =
    formatMoney(stats.totalPL);


  $("statTotalPL").className =
    stats.totalPL >= 0
      ? "green-text"
      : "red-text";


  $("statProfitFactor").textContent =
    Number.isFinite(stats.profitFactor)
      ? stats.profitFactor.toFixed(2)
      : "∞";


  $("statAverageR").textContent =
    `${stats.avgR.toFixed(2)}R`;


  $("statExpectancy").textContent =
    formatMoney(stats.expectancy);


  $("statWins").textContent =
    stats.wins;


  $("statLosses").textContent =
    stats.losses;


  renderEquityCurve();

  renderRecentTrades();

}


/* =========================================================
   EQUITY CURVE
========================================================= */

function renderEquityCurve() {

  const canvas =
    $("equityCanvas");

  const empty =
    $("emptyChart");


  const rect =
    canvas.getBoundingClientRect();


  const width =
    Math.max(300, rect.width);

  const height =
    Math.max(220, rect.height);


  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;


  const ctx =
    canvas.getContext("2d");


  ctx.scale(dpr, dpr);


  if (!state.trades.length) {

    empty.style.display =
      "grid";

    return;

  }


  empty.style.display =
    "none";


  const sorted =
    [...state.trades]
      .sort(
        (a,b) =>
          String(a.date || "")
            .localeCompare(
              String(b.date || "")
            )
      );


  let equity =
    num(state.settings.startingBalance);


  const points =
    [equity];


  sorted.forEach(trade => {

    equity +=
      num(trade.profitLoss);

    points.push(equity);

  });


  const min =
    Math.min(...points);

  const max =
    Math.max(...points);

  const range =
    max - min || 1;


  const padding = 25;


  const pointX =
    i =>
      padding +
      (i / (points.length - 1 || 1)) *
      (width - padding * 2);


  const pointY =
    value =>
      height -
      padding -
      ((value - min) / range) *
      (height - padding * 2);


  ctx.beginPath();


  points.forEach(
    (value, i) => {

      const x =
        pointX(i);

      const y =
        pointY(value);


      if (i === 0) {

        ctx.moveTo(x,y);

      } else {

        ctx.lineTo(x,y);

      }

    }
  );


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth =
    2.5;

  ctx.stroke();


  points.forEach(
    (value,i) => {

      ctx.beginPath();

      ctx.arc(
        pointX(i),
        pointY(value),
        3,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#f0cf79";

      ctx.fill();

    }
  );

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const container =
    $("recentTrades");


  const trades =
    [...state.trades]
      .sort(
        (a,b) =>
          String(b.date || "")
            .localeCompare(
              String(a.date || "")
            )
      )
      .slice(0,6);


  if (!trades.length) {

    container.innerHTML =
      `<div class="empty-state">
        No trades yet.
       </div>`;

    return;

  }


  container.innerHTML =
    trades.map(trade => {

      const pl =
        num(trade.profitLoss);

      const resultClass =
        trade.result === "Win"
          ? "green-text"
          : trade.result === "Loss"
            ? "red-text"
            : "";


      return `

        <div class="recent-trade">

          <div class="recent-main">

            <strong>
              ${escapeHtml(
                trade.strategy || "Trade"
              )}
            </strong>

            <span>
              ${escapeHtml(
                trade.date || "-"
              )}
              ·
              ${escapeHtml(
                trade.tradingType || "-"
              )}
              ·
              ${escapeHtml(
                trade.direction || "-"
              )}
            </span>

          </div>

          <strong class="recent-pl ${resultClass}">
            ${pl >= 0 ? "+" : ""}
            ${formatMoney(pl)}
          </strong>

        </div>

      `;

    }).join("");

}


/* =========================================================
   JOURNAL
========================================================= */

function getFilteredJournalTrades() {

  const result =
    $("journalResultFilter").value;

  const type =
    $("journalTypeFilter").value;

  const date =
    $("journalDateFilter").value;


  return state.trades.filter(
    trade => {

      if (
        result !== "all" &&
        trade.result !== result
      ) {

        return false;

      }


      if (
        type !== "all" &&
        trade.tradingType !== type
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


function renderJournal() {

  const body =
    $("journalTableBody");

  const empty =
    $("journalEmpty");


  const trades =
    getFilteredJournalTrades();


  if (!trades.length) {

    body.innerHTML = "";

    empty.style.display =
      "block";

    return;

  }


  empty.style.display =
    "none";


  trades.sort(
    (a,b) =>
      String(b.date || "")
        .localeCompare(
          String(a.date || "")
        )
  );


  body.innerHTML =
    trades.map(trade => {

      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";


      const pl =
        num(trade.profitLoss);


      return `

        <tr>

          <td>
            ${escapeHtml(
              formatDate(trade.date)
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.tradingType || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.direction || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.strategy || "-"
            )}
          </td>

          <td>
            ${num(trade.entry).toFixed(3)}
          </td>

          <td>
            ${escapeHtml(
              trade.rrDisplay ||
              (
                num(trade.rr) > 0
                  ? `1:${num(trade.rr).toFixed(2)}`
                  : "-"
              )
            )}
          </td>

          <td>

            <span class="result-badge ${resultClass}">
              ${escapeHtml(
                trade.result || "-"
              )}
            </span>

          </td>

          <td class="${
            pl >= 0
              ? "green-text"
              : "red-text"
          }">

            ${pl >= 0 ? "+" : ""}
            ${formatMoney(pl)}

          </td>

          <td>

            <button
              class="action-btn"
              data-action="edit"
              data-id="${trade.id}"
              title="Edit"
            >
              ✎
            </button>

            <button
              class="action-btn delete"
              data-action="delete"
              data-id="${trade.id}"
              title="Delete"
            >
              ×
            </button>

          </td>

        </tr>

      `;

    }).join("");

}


[
  "journalResultFilter",
  "journalTypeFilter",
  "journalDateFilter"
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


$("clearJournalFilters")
  .addEventListener(
    "click",
    () => {

      $("journalResultFilter").value =
        "all";

      $("journalTypeFilter").value =
        "all";

      $("journalDateFilter").value =
        "";

      renderJournal();

    }
  );


$("journalTableBody")
  .addEventListener(
    "click",
    async event => {

      const button =
        event.target.closest(
          "[data-action]"
        );

      if (!button) return;


      const id =
        button.dataset.id;

      const action =
        button.dataset.action;


      const trade =
        state.trades.find(
          t => t.id === id
        );


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
              state.user.uid,
              "trades",
              id
            )
          );

        } catch (error) {

          console.error(
            "Delete error:",
            error
          );

          alert(
            error.message ||
            "Could not delete trade."
          );

        }

      }

    }
  );


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn")
  .addEventListener(
    "click",
    () => {

      const trades =
        getFilteredJournalTrades();


      if (!trades.length) {

        alert(
          "There are no trades to export."
        );

        return;

      }


      const headers = [

        "Trade ID",
        "Date",
        "Trading Type",
        "Direction",
        "Strategy",
        "Session",
        "Market Bias",
        "Entry",
        "Stop Loss",
        "Take Profit",
        "RR",
        "Risk Amount",
        "Lot Size",
        "Result",
        "Profit/Loss",
        "Confidence",
        "Emotion",
        "Notes"

      ];


      const rows =
        trades.map(t => [

          t.tradeId,
          t.date,
          t.tradingType,
          t.direction,
          t.strategy,
          t.session,
          t.marketBias,
          t.entry,
          t.sl,
          t.tp,
          t.rrDisplay,
          t.riskAmount,
          t.lotSize,
          t.result,
          t.profitLoss,
          t.confidence,
          t.emotion,
          t.notes

        ]);


      const csv = [

        headers,

        ...rows

      ]
      .map(row =>
        row.map(value => {

          const text =
            String(value ?? "");

          return `"${text.replaceAll(
            '"',
            '""'
          )}"`;

        }).join(",")
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


      const a =
        document.createElement("a");

      a.href = url;

      a.download =
        `ujr-fx-journal-${todayISO()}.csv`;

      a.click();


      URL.revokeObjectURL(url);

    }
  );


/* =========================================================
   ANALYTICS
========================================================= */

function getAnalyticsTrades() {

  const period =
    state.analyticsPeriod;


  if (period === "all") {

    return [...state.trades];

  }


  const now =
    new Date();

  const start =
    new Date(now);


  if (period === "7") {

    start.setDate(
      now.getDate() - 7
    );

  } else if (period === "30") {

    start.setDate(
      now.getDate() - 30
    );

  } else if (period === "month") {

    start.setDate(1);

  }


  const startISO =
    start.toISOString().slice(0,10);


  return state.trades.filter(
    trade =>
      String(trade.date || "") >=
      startISO
  );

}


function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  renderAnalyticsCategory(
    "typeAnalytics",
    trades,
    "tradingType"
  );


  renderAnalyticsCategory(
    "strategyAnalytics",
    trades,
    "strategy"
  );


  renderAnalyticsCategory(
    "sessionAnalytics",
    trades,
    "session"
  );


  renderAnalyticsCategory(
    "directionAnalytics",
    trades,
    "direction"
  );

}


function renderAnalyticsCategory(
  elementId,
  trades,
  field
) {

  const container =
    $(elementId);


  if (!trades.length) {

    container.innerHTML =
      `<div class="analytics-empty">
        No data for this period.
       </div>`;

    return;

  }


  const groups = {};


  trades.forEach(trade => {

    const key =
      trade[field] ||
      "Unknown";


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
      num(trade.profitLoss);

  });


  const entries =
    Object.entries(groups)
      .sort(
        (a,b) =>
          b[1].pl - a[1].pl
      );


  const maxAbs =
    Math.max(
      ...entries.map(
        ([,v]) =>
          Math.abs(v.pl)
      ),
      1
    );


  container.innerHTML =
    entries.map(
      ([key,value]) => {

        const percentage =
          Math.min(
            100,
            Math.max(
              2,
              Math.abs(value.pl) /
              maxAbs *
              100
            )
          );


        return `

          <div class="analytics-row">

            <div class="analytics-top">

              <span>
                ${escapeHtml(key)}
              </span>

              <span>
                ${value.trades} trades
                ·
                ${value.wins}/${value.trades} wins
                ·
                ${value.pl >= 0 ? "+" : ""}
                ${formatMoney(value.pl)}
              </span>

            </div>

            <div class="analytics-bar">

              <div
                class="analytics-fill ${
                  value.pl < 0
                    ? "negative"
                    : ""
                }"
                style="width:${percentage}%"
              ></div>

            </div>

          </div>

        `;

      }
    ).join("");

}


document
  .querySelectorAll(".period-btn")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".period-btn"
          )
          .forEach(btn =>
            btn.classList.remove(
              "active"
            )
          );


        button.classList.add(
          "active"
        );


        state.analyticsPeriod =
          button.dataset.period;


        renderAnalytics();

      }
    );

  });


/* =========================================================
   RISK CALCULATOR
========================================================= */

function calculateRisk() {

  const balance =
    num($("calcBalance").value);

  const riskPercent =
    num(
      $("calcRiskPercent").value
    );

  const entry =
    num($("calcEntry").value);

  const sl =
    num($("calcSL").value);

  const tp =
    num($("calcTP").value);

  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  let stopDistance =
    0;

  let reward =
    0;


  if (direction === "Buy") {

    stopDistance =
      entry - sl;

    reward =
      tp - entry;

  } else {

    stopDistance =
      sl - entry;

    reward =
      entry - tp;

  }


  const rr =
    stopDistance > 0
      ? reward / stopDistance
      : 0;


  /*
    Approximate XAUUSD lot estimate.
    1 lot = approximately 100 oz.
  */

  const lot =
    stopDistance > 0
      ? riskAmount /
        (stopDistance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    formatMoney(riskAmount);


  $("calcStopDistance").textContent =
    stopDistance > 0
      ? stopDistance.toFixed(2)
      : "0.00";


  $("calcRR").textContent =
    rr > 0
      ? `${rr.toFixed(2)}R`
      : "0.00R";


  $("calcLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";

}


$("calculateRiskBtn")
  .addEventListener(
    "click",
    calculateRisk
  );


[
  "calcBalance",
  "calcRiskPercent",
  "calcEntry",
  "calcSL",
  "calcTP",
  "calcDirection"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateRisk
  );

  $(id).addEventListener(
    "change",
    calculateRisk
  );

});


/* =========================================================
   CALENDAR
========================================================= */

function renderCalendar() {

  const date =
    state.calendarDate;


  const year =
    date.getFullYear();

  const month =
    date.getMonth();


  $("calendarMonth").textContent =
    date.toLocaleDateString(
      undefined,
      {
        month: "long",
        year: "numeric"
      }
    );


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


  const grid =
    $("calendarGrid");


  grid.innerHTML = "";


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const empty =
      document.createElement("div");

    empty.className =
      "calendar-day empty";

    grid.appendChild(empty);

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dayEl =
      document.createElement("button");

    dayEl.className =
      "calendar-day";


    const dateString =
      `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


    const dayTrades =
      state.trades.filter(
        trade =>
          trade.date === dateString
      );


    const wins =
      dayTrades.filter(
        t => t.result === "Win"
      ).length;


    const losses =
      dayTrades.filter(
        t => t.result === "Loss"
      ).length;


    const pl =
      dayTrades.reduce(
        (sum,t) =>
          sum + num(t.profitLoss),
        0
      );


    if (
      dateString === todayISO()
    ) {

      dayEl.classList.add(
        "today"
      );

    }


    if (
      state.selectedCalendarDate ===
      dateString
    ) {

      dayEl.classList.add(
        "selected"
      );

    }


    dayEl.innerHTML = `

      <div class="day-number">
        ${day}
      </div>

      ${
        dayTrades.length
          ? `
            <div class="day-stats">

              <span class="day-win">
                W ${wins}
              </span>

              <span class="day-loss">
                L ${losses}
              </span>

              <span class="day-pl">
                ${pl >= 0 ? "+" : ""}
                ${formatMoney(pl)}
              </span>

            </div>
          `
          : ""
      }

    `;


    dayEl.addEventListener(
      "click",
      () => {

        state.selectedCalendarDate =
          dateString;

        renderCalendar();

        showCalendarTrades(
          dateString
        );

      }
    );


    grid.appendChild(dayEl);

  }

}


function showCalendarTrades(dateString) {

  const trades =
    state.trades.filter(
      t => t.date === dateString
    );


  $("calendarSelectedTitle")
    .textContent =
      formatDate(dateString);


  if (!trades.length) {

    $("calendarSelectedSummary")
      .textContent =
      "No trades recorded on this date.";

    $("calendarTrades").innerHTML =
      `<div class="empty-state">
        No trades for this date.
       </div>`;

    return;

  }


  const totalPL =
    trades.reduce(
      (sum,t) =>
        sum + num(t.profitLoss),
      0
    );


  $("calendarSelectedSummary")
    .textContent =
      `${trades.length} trade(s) · ${totalPL >= 0 ? "+" : ""}${formatMoney(totalPL)}`;


  $("calendarTrades").innerHTML =
    trades.map(
      trade => {

        const pl =
          num(trade.profitLoss);


        return `

          <div class="recent-trade">

            <div class="recent-main">

              <strong>
                ${escapeHtml(
                  trade.strategy || "Trade"
                )}
              </strong>

              <span>
                ${escapeHtml(
                  trade.direction || "-"
                )}
                ·
                ${escapeHtml(
                  trade.tradingType || "-"
                )}
                ·
                ${escapeHtml(
                  trade.result || "-"
                )}
              </span>

            </div>

            <strong class="recent-pl ${
              pl >= 0
                ? "green-text"
                : "red-text"
            }">

              ${pl >= 0 ? "+" : ""}
              ${formatMoney(pl)}

            </strong>

          </div>

        `;

      }
    ).join("");

}


$("prevMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate.setMonth(
        state.calendarDate.getMonth() - 1
      );

      renderCalendar();

    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate.setMonth(
        state.calendarDate.getMonth() + 1
      );

      renderCalendar();

    }
  );


/* =========================================================
   SETTINGS
========================================================= */

$("saveSettingsBtn")
  .addEventListener(
    "click",
    async () => {

      if (!state.user) return;


      const startingBalance =
        num(
          $("startingBalance").value
        );


      const currency =
        $("currency").value;


      state.settings = {

        startingBalance,

        currency

      };


      try {

        await setDoc(
          doc(
            db,
            "users",
            state.user.uid,
            "settings",
            "main"
          ),

          state.settings,

          {
            merge: true
          }

        );


        $("settingsMessage")
          .textContent =
          "Settings saved successfully.";

        renderDashboard();

        setTimeout(
          () => {

            $("settingsMessage")
              .textContent = "";

          },
          2500
        );

      } catch (error) {

        console.error(
          "Settings save error:",
          error
        );

        $("settingsMessage")
          .textContent =
          "Could not save settings.";

      }

    }
  );


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await signOut(auth);

      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

      }

    }
  );


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      !$("app")
        .classList
        .contains("hidden")
    ) {

      renderEquityCurve();

    }

  }
);


/* =========================================================
   INITIAL DEFAULTS
========================================================= */

$("tradeDate").value =
  todayISO();

$("tradeId").value =
  makeTradeId();

renderCalendar();
