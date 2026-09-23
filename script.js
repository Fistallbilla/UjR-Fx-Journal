import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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

  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",

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


function money(value) {

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


function escapeHTML(value) {

  return String(value ?? "")

    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function todayString() {

  const d = new Date();

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1)
    .padStart(2, "0");

  const day = String(d.getDate())
    .padStart(2, "0");

  return `${y}-${m}-${day}`;

}


function generateTradeId() {

  const date = new Date();

  const stamp =
    date.getFullYear().toString().slice(-2) +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");

  const random =
    Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();

  return `UJR-${stamp}-${random}`;

}


/* =========================================================
   AUTH
========================================================= */

$("googleLoginBtn").addEventListener(
  "click",
  async () => {

    $("loginError").textContent = "";

    try {

      await signInWithPopup(
        auth,
        provider
      );

    } catch (error) {

      try {

        await signInWithRedirect(
          auth,
          provider
        );

      } catch (redirectError) {

        $("loginError").textContent =
          redirectError.message;

      }

    }

  }
);


getRedirectResult(auth).catch(() => {});


$("logoutBtn").addEventListener(
  "click",
  async () => {

    await signOut(auth);

  }
);


onAuthStateChanged(
  auth,
  async user => {

    if (user) {

      state.user = user;

      $("loginScreen").classList.add("hidden");

      $("app").classList.remove("hidden");

      updateUserUI();

      await loadUserData();

    } else {

      state.user = null;

      $("app").classList.add("hidden");

      $("loginScreen").classList.remove("hidden");

      if (state.unsubscribeTrades) {
        state.unsubscribeTrades();
        state.unsubscribeTrades = null;
      }

      if (state.unsubscribeSettings) {
        state.unsubscribeSettings();
        state.unsubscribeSettings = null;
      }

    }

  }
);


function updateUserUI() {

  $("userName").textContent =
    state.user.displayName || "User";

  $("userEmail").textContent =
    state.user.email || "";

  $("userPhoto").src =
    state.user.photoURL || "";

}


/* =========================================================
   FIRESTORE
========================================================= */

async function loadUserData() {

  const uid = state.user.uid;

  const userRef =
    doc(db, "users", uid);

  const userSnap =
    await getDoc(userRef);

  if (!userSnap.exists()) {

    await setDoc(
      userRef,
      {
        displayName:
          state.user.displayName || "",

        email:
          state.user.email || "",

        createdAt:
          new Date().toISOString()
      },
      { merge: true }
    );

  }


  const settingsRef =
    doc(
      db,
      "users",
      uid,
      "settings",
      "main"
    );


  const settingsSnap =
    await getDoc(settingsRef);


  if (settingsSnap.exists()) {

    state.settings = {
      ...state.settings,
      ...settingsSnap.data()
    };

  }


  renderSettings();


  const tradesRef =
    collection(
      db,
      "users",
      uid,
      "trades"
    );


  const tradesQuery =
    query(
      tradesRef,
      orderBy("date", "desc")
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
            d => ({
              id: d.id,
              ...d.data()
            })
          );

        refreshAll();

      },
      error => {

        console.error(
          "Firestore error:",
          error
        );

      }
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

document
  .querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const page =
          button.dataset.page;

        showPage(page);

        closeSidebar();

      }
    );

  });


function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove("active");

    });


  const target =
    $(`page-${page}`);

  if (target) {
    target.classList.add("active");
  }


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


  if (page === "calendar") {
    renderCalendar();
  }

  if (page === "analytics") {
    renderAnalytics();
  }

}


$("menuBtn").addEventListener(
  "click",
  () => {

    $("sidebar").classList.add("open");

    $("sidebarOverlay")
      .classList.add("show");

  }
);


$("sidebarOverlay").addEventListener(
  "click",
  closeSidebar
);


function closeSidebar() {

  $("sidebar").classList.remove("open");

  $("sidebarOverlay")
    .classList.remove("show");

}


/* =========================================================
   MODAL
========================================================= */

function openTradeModal(trade = null) {

  state.editingTradeId =
    trade ? trade.id : null;

  $("tradeModal")
    .classList.remove("hidden");

  $("tradeError").textContent = "";

  if (trade) {

    $("modalTitle").textContent =
      "Edit Trade";

    fillTradeForm(trade);

  } else {

    $("modalTitle").textContent =
      "Add Trade";

    resetTradeForm();

  }

}


function closeTradeModal() {

  $("tradeModal")
    .classList.add("hidden");

  state.editingTradeId = null;

}


$("closeModalBtn")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("cancelTradeBtn")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("modalAddTradeBtn")?.addEventListener(
  "click",
  () => openTradeModal()
);


$("dashboardAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("journalAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("mobileAddTradeBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("tradeModal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target.classList
          .contains("modal-backdrop")
      ) {

        closeTradeModal();

      }

    }
  );


function resetTradeForm() {

  $("tradeForm").reset();

  $("tradeDate").value =
    todayString();

  $("tradeId").value =
    generateTradeId();

  $("direction").value =
    "Buy";

  $("lotSize").dataset.manual =
    "false";

  $("rr").value = "";

}


function fillTradeForm(trade) {

  $("tradeId").value =
    trade.tradeId || generateTradeId();

  $("tradeDate").value =
    trade.date || todayString();

  $("pair").value =
    trade.pair || "";

  $("tradingType").value =
    trade.tradingType || "";

  $("direction").value =
    trade.direction || "Buy";

  $("strategy").value =
    trade.strategy || "";

  $("session").value =
    trade.session || "";

  $("bias").value =
    trade.bias || "";

  $("entry").value =
    trade.entry ?? "";

  $("sl").value =
    trade.sl ?? "";

  $("tp").value =
    trade.tp ?? "";

  $("rr").value =
    trade.rr
      ? `1:${Number(trade.rr).toFixed(2)}`
      : "";

  $("riskAmount").value =
    trade.riskAmount ?? "";

  $("lotSize").value =
    trade.lotSize ?? "";

  $("lotSize").dataset.manual =
    "true";

  $("result").value =
    trade.result || "";

  $("profitLoss").value =
    trade.profitLoss ?? "";

  $("confidence").value =
    trade.confidence || "";

  $("emotion").value =
    trade.emotion || "";

  $("notes").value =
    trade.notes || "";

}


/* =========================================================
   RR
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

    $("rr").value = "Invalid";

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
   MANUAL RISK AMOUNT
========================================================= */

function calculateModalRisk() {

  const entry =
    num($("entry").value);

  const sl =
    num($("sl").value);

  const manualRiskAmount =
    num($("riskAmount").value);


  const distance =
    Math.abs(entry - sl);


  if (
    manualRiskAmount <= 0 ||
    distance <= 0
  ) {

    return;

  }


  /*
    Simple journal estimate only.
    Broker-specific lot calculation may differ.
  */

  const estimatedLot =
    manualRiskAmount /
    (distance * 100);


  if (
    $("lotSize")
      .dataset.manual !== "true"
  ) {

    $("lotSize").value =
      estimatedLot.toFixed(2);

  }

}


$("riskAmount").addEventListener(
  "input",
  () => {

    $("lotSize").dataset.manual =
      "false";

    calculateModalRisk();

  }
);


$("lotSize").addEventListener(
  "input",
  () => {

    $("lotSize").dataset.manual =
      "true";

  }
);


/* =========================================================
   RESULT + P/L
========================================================= */

function normalizeProfitLossByResult() {

  const result =
    $("result").value;

  const input =
    $("profitLoss");


  if (
    result === "Break Even"
  ) {

    input.value = "0";

    return;

  }


  if (
    input.value === ""
  ) {

    return;

  }


  const value =
    Number(input.value);


  if (
    !Number.isFinite(value)
  ) {

    return;

  }


  if (
    result === "Win"
  ) {

    input.value =
      Math.abs(value);

  }


  if (
    result === "Loss"
  ) {

    input.value =
      -Math.abs(value);

  }

}


function getNormalizedPL() {

  const result =
    $("result").value;

  const raw =
    $("profitLoss").value;


  if (
    result === "Break Even"
  ) {

    return 0;

  }


  if (
    raw === ""
  ) {

    return null;

  }


  const value =
    Number(raw);


  if (
    !Number.isFinite(value)
  ) {

    return null;

  }


  if (
    result === "Win"
  ) {

    return Number(
      Math.abs(value)
        .toFixed(2)
    );

  }


  if (
    result === "Loss"
  ) {

    return Number(
      -Math.abs(value)
        .toFixed(2)
    );

  }


  return Number(
    value.toFixed(2)
  );

}


$("result").addEventListener(
  "change",
  normalizeProfitLossByResult
);


$("profitLoss").addEventListener(
  "blur",
  normalizeProfitLossByResult
);


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    $("tradeError").textContent = "";


    if (!state.user) {

      $("tradeError").textContent =
        "Please login first.";

      return;

    }


    const riskAmountRaw =
      $("riskAmount").value.trim();


    const riskAmount =
      riskAmountRaw === ""
        ? 0
        : Number(riskAmountRaw);


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


    if (
      profitLoss === null
    ) {

      $("tradeError").textContent =
        "Please enter the actual Profit / Loss amount.";

      return;

    }


    const rr =
      calculateTradeRR();


    if (
      $("rr").value === "Invalid"
    ) {

      $("tradeError").textContent =
        "Please check Entry, Stop Loss and Take Profit.";

      return;

    }


    const trade = {

      tradeId:
        $("tradeId").value.trim(),

      date:
        $("tradeDate").value,

      pair:
        $("pair").value,

      tradingType:
        $("tradingType").value,

      direction:
        $("direction").value,

      strategy:
        $("strategy").value,

      session:
        $("session").value,

      bias:
        $("bias").value,

      entry:
        num($("entry").value),

      sl:
        num($("sl").value),

      tp:
        num($("tp").value),

      rr:
        Number(rr.toFixed(2)),

      riskAmount:
        Number(
          riskAmount.toFixed(2)
        ),

      lotSize:
        num($("lotSize").value),

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
        new Date().toISOString()

    };


    try {

      const tradesRef =
        collection(
          db,
          "users",
          state.user.uid,
          "trades"
        );


      if (
        state.editingTradeId
      ) {

        await updateDoc(
          doc(
            tradesRef,
            state.editingTradeId
          ),
          trade
        );

      } else {

        trade.createdAt =
          new Date().toISOString();

        await addDoc(
          tradesRef,
          trade
        );

      }


      closeTradeModal();

    } catch (error) {

      console.error(error);

      $("tradeError").textContent =
        error.message ||
        "Unable to save trade.";

    }

  }
);


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

  if (!state.user) return;


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

    console.error(error);

    alert(
      "Could not delete trade."
    );

  }

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

  const body =
    $("journalTableBody");


  let trades =
    [...state.trades];


  const result =
    $("filterResult").value;

  const pair =
    $("filterPair").value;

  const tradingType =
    $("filterTradingType").value;

  const date =
    $("filterDate").value;


  if (result) {

    trades =
      trades.filter(
        t => t.result === result
      );

  }


  if (pair) {

    trades =
      trades.filter(
        t => t.pair === pair
      );

  }


  if (tradingType) {

    trades =
      trades.filter(
        t =>
          t.tradingType ===
          tradingType
      );

  }


  if (date) {

    trades =
      trades.filter(
        t => t.date === date
      );

  }


  if (!trades.length) {

    body.innerHTML = `
      <tr>
        <td colspan="10"
            style="text-align:center;color:#8c929e;padding:30px">
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  body.innerHTML =
    trades.map(
      trade => {

        const resultClass =
          trade.result === "Win"
            ? "result-win"
            : trade.result === "Loss"
              ? "result-loss"
              : "result-be";


        const plClass =
          num(trade.profitLoss) >= 0
            ? "positive"
            : "negative";


        return `

          <tr>

            <td>
              ${escapeHTML(trade.date)}
            </td>

            <td>
              <strong>
                ${escapeHTML(trade.pair)}
              </strong>
            </td>

            <td>
              ${escapeHTML(trade.tradingType)}
            </td>

            <td>
              ${escapeHTML(trade.direction)}
            </td>

            <td>
              ${escapeHTML(trade.strategy)}
            </td>

            <td>
              ${num(trade.entry)}
            </td>

            <td>
              1:${num(trade.rr).toFixed(2)}
            </td>

            <td>
              <span class="result-badge ${resultClass}">
                ${escapeHTML(trade.result)}
              </span>
            </td>

            <td class="${plClass}">
              ${money(trade.profitLoss)}
            </td>

            <td>

              <button
                class="action-btn"
                data-edit="${trade.id}">
                ✎
              </button>

              <button
                class="action-btn delete-btn"
                data-delete="${trade.id}">
                ×
              </button>

            </td>

          </tr>

        `;

      }
    ).join("");


  body
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            state.trades.find(
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


  body
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteTrade(
            button.dataset.delete
          )
      );

    });

}


[
  "filterResult",
  "filterPair",
  "filterTradingType",
  "filterDate"
].forEach(id => {

  $(id).addEventListener(
    "change",
    renderJournal
  );

});


$("clearFilters")
  .addEventListener(
    "click",
    () => {

      $("filterResult").value = "";

      $("filterPair").value = "";

      $("filterTradingType").value = "";

      $("filterDate").value = "";

      renderJournal();

    }
  );


/* =========================================================
   DASHBOARD
========================================================= */

function getStats(trades) {

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


  const breakeven =
    trades.filter(
      t => t.result === "Break Even"
    ).length;


  const pl =
    trades.reduce(
      (sum, t) =>
        sum + num(t.profitLoss),
      0
    );


  const winRate =
    total
      ? wins / total * 100
      : 0;


  const grossProfit =
    trades
      .filter(
        t => num(t.profitLoss) > 0
      )
      .reduce(
        (sum,t) =>
          sum + num(t.profitLoss),
        0
      );


  const grossLoss =
    Math.abs(
      trades
        .filter(
          t =>
            num(t.profitLoss) < 0
        )
        .reduce(
          (sum,t) =>
            sum + num(t.profitLoss),
          0
        )
    );


  const pf =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const avgR =
    total
      ? trades.reduce(
          (sum,t) =>
            sum +
            (
              num(t.riskAmount) > 0
                ? num(t.profitLoss) /
                  num(t.riskAmount)
                : 0
            ),
          0
        ) / total
      : 0;


  const expectancy =
    total
      ? pl / total
      : 0;


  return {

    total,
    wins,
    losses,
    breakeven,
    pl,
    winRate,
    pf,
    avgR,
    expectancy

  };

}


function renderDashboard() {

  const stats =
    getStats(state.trades);


  $("statTrades").textContent =
    stats.total;

  $("statWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("statPL").textContent =
    money(stats.pl);

  $("statPF").textContent =
    stats.pf === Infinity
      ? "∞"
      : stats.pf.toFixed(2);

  $("statAvgR").textContent =
    `${stats.avgR.toFixed(2)}R`;

  $("statExpectancy").textContent =
    money(stats.expectancy);

  $("statWins").textContent =
    stats.wins;

  $("statLosses").textContent =
    stats.losses;


  renderRecentTrades();

  renderEquityChart();

}


function renderRecentTrades() {

  const container =
    $("recentTrades");


  const trades =
    [...state.trades]
      .sort(
        (a,b) =>
          new Date(b.date) -
          new Date(a.date)
      )
      .slice(0,7);


  if (!trades.length) {

    container.innerHTML =
      `<div class="muted">
        No trades yet.
      </div>`;

    return;

  }


  container.innerHTML =
    trades.map(
      trade => {

        const pl =
          num(trade.profitLoss);


        return `

          <div class="recent-item">

            <div class="recent-main">

              <strong>
                ${escapeHTML(trade.pair)}
                ·
                ${escapeHTML(trade.direction)}
              </strong>

              <span>
                ${escapeHTML(trade.date)}
                ·
                ${escapeHTML(trade.strategy)}
              </span>

            </div>

            <div class="recent-pl ${
              pl >= 0
                ? "positive"
                : "negative"
            }">

              ${money(pl)}

            </div>

          </div>

        `;

      }
    ).join("");

}


/* =========================================================
   EQUITY CHART
========================================================= */

function renderEquityChart() {

  const canvas =
    $("equityChart");


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


  ctx.scale(dpr,dpr);


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
    [...state.trades]
      .sort(
        (a,b) =>
          new Date(a.date) -
          new Date(b.date)
      );


  if (!trades.length) {

    ctx.fillStyle =
      "#8c929e";

    ctx.font =
      "13px sans-serif";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "No trade data yet",
      width / 2,
      height / 2
    );

    return;

  }


  let equity =
    num(
      state.settings.startingBalance
    );


  const points = [];


  trades.forEach(
    trade => {

      equity +=
        num(trade.profitLoss);

      points.push(equity);

    }
  );


  const min =
    Math.min(
      ...points,
      0
    );

  const max =
    Math.max(
      ...points,
      1
    );


  const range =
    max - min || 1;


  const padding = 25;


  ctx.strokeStyle =
    "rgba(255,255,255,.08)";

  ctx.lineWidth = 1;


  ctx.beginPath();

  ctx.moveTo(
    padding,
    height - padding
  );

  ctx.lineTo(
    width - padding,
    height - padding
  );

  ctx.stroke();


  ctx.beginPath();


  points.forEach(
    (value,index) => {

      const x =
        padding +
        (
          index /
          Math.max(
            points.length - 1,
            1
          )
        ) *
        (
          width -
          padding * 2
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

        ctx.moveTo(x,y);

      } else {

        ctx.lineTo(x,y);

      }

    }
  );


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth = 2;

  ctx.stroke();


  points.forEach(
    (value,index) => {

      const x =
        padding +
        (
          index /
          Math.max(
            points.length - 1,
            1
          )
        ) *
        (
          width -
          padding * 2
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


      ctx.beginPath();

      ctx.arc(
        x,
        y,
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
   ANALYTICS
========================================================= */

function getAnalyticsTrades() {

  const trades =
    [...state.trades];


  const period =
    $("analyticsPeriod").value;


  if (period === "all") {

    return trades;

  }


  const now =
    new Date();


  if (period === "7") {

    const from =
      new Date();

    from.setDate(
      from.getDate() - 6
    );

    return trades.filter(
      t =>
        new Date(t.date) >= from
    );

  }


  if (period === "30") {

    const from =
      new Date();

    from.setDate(
      from.getDate() - 29
    );

    return trades.filter(
      t =>
        new Date(t.date) >= from
    );

  }


  if (period === "month") {

    const year =
      now.getFullYear();

    const month =
      now.getMonth();


    return trades.filter(
      t => {

        const d =
          new Date(t.date);

        return (
          d.getFullYear() === year &&
          d.getMonth() === month
        );

      }
    );

  }


  if (period === "custom") {

    const from =
      $("analyticsFrom").value;

    const to =
      $("analyticsTo").value;


    return trades.filter(
      t => {

        if (
          from &&
          t.date < from
        ) return false;

        if (
          to &&
          t.date > to
        ) return false;

        return true;

      }
    );

  }


  return trades;

}


function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  const stats =
    getStats(trades);


  $("aTrades").textContent =
    stats.total;

  $("aWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("aPL").textContent =
    money(stats.pl);

  $("aPF").textContent =
    stats.pf === Infinity
      ? "∞"
      : stats.pf.toFixed(2);

  $("aAvgR").textContent =
    `${stats.avgR.toFixed(2)}R`;


  const avgRisk =
    trades.length
      ? trades.reduce(
          (sum,t) =>
            sum + num(t.riskAmount),
          0
        ) / trades.length
      : 0;


  $("aAvgRisk").textContent =
    money(avgRisk);


  renderGroupAnalytics(
    trades,
    "tradingType",
    $("tradingTypeAnalytics")
  );


  renderGroupAnalytics(
    trades,
    "strategy",
    $("strategyAnalytics")
  );


  renderGroupAnalytics(
    trades,
    "session",
    $("sessionAnalytics")
  );


  renderGroupAnalytics(
    trades,
    "direction",
    $("directionAnalytics")
  );

}


function renderGroupAnalytics(
  trades,
  field,
  container
) {

  const groups = {};


  trades.forEach(
    trade => {

      const key =
        trade[field] ||
        "Not Set";


      if (!groups[key]) {

        groups[key] = {

          trades: 0,
          wins: 0,
          pl: 0

        };

      }


      groups[key].trades++;

      groups[key].pl +=
        num(trade.profitLoss);


      if (
        trade.result === "Win"
      ) {

        groups[key].wins++;

      }

    }
  );


  const entries =
    Object.entries(groups)
      .sort(
        (a,b) =>
          b[1].trades -
          a[1].trades
      );


  if (!entries.length) {

    container.innerHTML =
      `<div class="muted">
        No data yet.
      </div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([name,data]) => {

        const rate =
          data.trades
            ? data.wins /
              data.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <span>
              ${escapeHTML(name)}
            </span>

            <strong>
              ${data.trades} trades
              · ${rate.toFixed(0)}%
            </strong>

            <strong class="${
              data.pl >= 0
                ? "positive"
                : "negative"
            }">

              ${money(data.pl)}

            </strong>

          </div>

        `;

      }
    ).join("");

}


$("analyticsPeriod")
  .addEventListener(
    "change",
    renderAnalytics
  );


$("analyticsFrom")
  .addEventListener(
    "change",
    renderAnalytics
  );


$("analyticsTo")
  .addEventListener(
    "change",
    renderAnalytics
  );


/* =========================================================
   RISK CALCULATOR
========================================================= */

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
    calculateRiskCalculator
  );

  $(id).addEventListener(
    "change",
    calculateRiskCalculator
  );

});


function calculateRiskCalculator() {

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


  const distance =
    Math.abs(
      entry - sl
    );


  let risk = 0;
  let reward = 0;


  if (
    direction === "Buy"
  ) {

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


  const rr =
    risk > 0 &&
    reward > 0
      ? reward / risk
      : 0;


  const lot =
    riskAmount > 0 &&
    distance > 0
      ? riskAmount /
        (distance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);


  $("calcDistance").textContent =
    distance.toFixed(3);


  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0";


  $("calcLot").textContent =
    lot.toFixed(2);

}


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate
        .setMonth(
          state.calendarDate.getMonth() - 1
        );

      renderCalendar();

    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate
        .setMonth(
          state.calendarDate.getMonth() + 1
        );

      renderCalendar();

    }
  );


function renderCalendar() {

  const date =
    state.calendarDate;


  const year =
    date.getFullYear();

  const month =
    date.getMonth();


  $("calendarTitle").textContent =
    date.toLocaleString(
      "default",
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


  const days =
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
    day <= days;
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1)
        .padStart(2,"0")}-${String(day)
        .padStart(2,"0")}`;


    const dayTrades =
      state.trades.filter(
        t =>
          t.date === dateString
      );


    const pl =
      dayTrades.reduce(
        (sum,t) =>
          sum + num(t.profitLoss),
        0
      );


    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";


    cell.innerHTML = `

      <div class="calendar-day-number">
        ${day}
      </div>

      ${
        dayTrades.length
          ? `
            <div class="calendar-pl ${
              pl >= 0
                ? "positive"
                : "negative"
            }">

              ${money(pl)}

            </div>

            <div class="muted"
                 style="font-size:9px;margin-top:3px">

              ${dayTrades.length} trade${
                dayTrades.length === 1
                  ? ""
                  : "s"
              }

            </div>
          `
          : ""
      }

    `;


    grid.appendChild(cell);

  }

}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

  $("startingBalance").value =
    state.settings.startingBalance || 0;

  $("currency").value =
    state.settings.currency || "USD";


  $("calcBalance").value =
    state.settings.startingBalance || "";

}


$("saveSettingsBtn")
  .addEventListener(
    "click",
    async () => {

      if (!state.user) return;


      const settings = {

        startingBalance:
          num(
            $("startingBalance").value
          ),

        currency:
          $("currency").value

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
          settings,
          { merge: true }
        );


        state.settings =
          settings;


        $("settingsMessage").textContent =
          "Settings saved successfully.";

        renderDashboard();
        renderJournal();
        renderAnalytics();
        renderCalendar();

      } catch (error) {

        $("settingsMessage").textContent =
          error.message;

      }

    }
  );


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );


function exportCSV() {

  if (!state.trades.length) {

    alert(
      "There are no trades to export."
    );

    return;

  }


  const headers = [

    "Trade ID",
    "Date",
    "Pair",
    "Trading Type",
    "Direction",
    "Strategy",
    "Session",
    "Bias",
    "Entry",
    "SL",
    "TP",
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
    state.trades.map(
      t => [

        t.tradeId,
        t.date,
        t.pair,
        t.tradingType,
        t.direction,
        t.strategy,
        t.session,
        t.bias,
        t.entry,
        t.sl,
        t.tp,
        t.rr,
        t.riskAmount,
        t.lotSize,
        t.result,
        t.profitLoss,
        t.confidence,
        t.emotion,
        t.notes

      ]
    );


  const csv =
    [
      headers,
      ...rows
    ]
      .map(
        row =>
          row.map(
            value =>
              `"${String(
                value ?? ""
              ).replaceAll(
                '"',
                '""'
              )}"`
          ).join(",")
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
    `UjR-Fx-Trading-Journal-${todayString()}.csv`;


  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

}


/* =========================================================
   REFRESH
========================================================= */

function refreshAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

}


/* =========================================================
   INITIAL
========================================================= */

$("tradeDate").value =
  todayString();


window.addEventListener(
  "resize",
  () => {

    if (
      !$("page-dashboard")
        .classList.contains("active")
    ) return;

    renderEquityChart();

  }
);
